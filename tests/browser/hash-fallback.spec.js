import { test, expect } from './saved-workspace.js';

test('offline worker-construction fallback preserves stored and connected content verification', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    window.hashSources = await import('/src/file-sources.js');
    const file = new File(['original recording bytes'], 'original.mp3', { type: 'audio/mpeg', lastModified: 1000 });
    await (await import('/src/storage.js')).saveFile('copied', file);
    window.hashFile = file;
    window.expectedHash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))].map(value => value.toString(16).padStart(2, '0')).join('');
  });
  await context.setOffline(true);
  const results = await page.evaluate(async () => {
    const nativeWorker = window.Worker, nativeGet = IDBObjectStore.prototype.get;
    window.Worker = class { constructor() { throw new DOMException('Worker blocked', 'SecurityError'); } };
    IDBObjectStore.prototype.get = function(key) {
      if (this.name !== 'sources' || key !== 'linked') return nativeGet.call(this, key);
      const request = { result: { handle: { queryPermission: async () => 'granted', getFile: async () => window.hashFile } } };
      setTimeout(() => request.onsuccess?.(), 0); return request;
    };
    try {
      const results = [];
      for (const id of ['copied', 'linked']) {
        const track = { id, contentHash: window.expectedHash, fileSize: hashFile.size, lastModified: hashFile.lastModified };
        const ready = await hashSources.resolveSource(track);
        const changed = await hashSources.resolveSource({ ...track, contentHash: 'b'.repeat(64) });
        results.push({ ready: ready.status, bytes: ready.file?.size, changed: changed.status, blocked: !changed.file });
      }
      const nativeSlice = Blob.prototype.slice;
      Blob.prototype.slice = () => { throw new Error('File disconnected'); };
      try {
        const failed = await hashSources.resolveSource({ id: 'copied', contentHash: expectedHash });
        return { results, failed: failed.status, failedBlocked: !failed.file };
      } finally { Blob.prototype.slice = nativeSlice; }
    } finally { window.Worker = nativeWorker; IDBObjectStore.prototype.get = nativeGet; }
  });
  expect(results).toEqual({ results: [
    { ready: 'Stored copy', bytes: 24, changed: 'File changed', blocked: true },
    { ready: 'Ready', bytes: 24, changed: 'File changed', blocked: true },
  ], failed: 'File missing', failedBlocked: true });
});

test('an aborted hash worker request falls back to the already loaded page hasher', async ({ page }) => {
  await page.goto('/');
  let workerRequests = 0;
  await page.route('**/src/hash-worker.js*', route => { workerRequests++; return route.abort(); });
  const hash = await page.evaluate(async () => (await import('/src/file-sources.js')).contentHash(new Blob(['abc'])));
  expect(workerRequests).toBe(1);
  expect(hash).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('worker-reported hashing errors and invalid digests fail without retrying the file in the page', async ({ page }) => {
  await page.goto('/');
  const results = await page.evaluate(async () => {
    const { contentHash } = await import('/src/file-sources.js');
    const nativeWorker = window.Worker, nativeSlice = Blob.prototype.slice;
    let reads = 0, response;
    window.Worker = class {
      postMessage() { queueMicrotask(() => this.onmessage({ data: response })); }
      terminate() {}
    };
    Blob.prototype.slice = function(...args) { reads++; return nativeSlice.apply(this, args); };
    try {
      const errors = [];
      for (response of [{ error: 'File disconnected' }, { hash: 'invalid' }]) {
        try { await contentHash(new Blob(['abc'])); errors.push('Accepted invalid bytes'); }
        catch (error) { errors.push(error.message); }
      }
      return { reads, errors };
    } finally { window.Worker = nativeWorker; Blob.prototype.slice = nativeSlice; }
  });
  expect(results).toEqual({ reads: 0, errors: ['File disconnected', 'Audio identity verification did not return a valid hash.'] });
});
