import { getFile, getSource } from './storage.js';
import { streamHash } from './stream-hash.js';
export const canConnectFiles = () => typeof window.showOpenFilePicker === 'function';
export const canConnectFolder = () => typeof window.showDirectoryPicker === 'function';
export async function contentHash(file) {
  let worker;
  try { worker = new Worker(new URL('./hash-worker.js', import.meta.url), { type: 'module' }); }
  catch { return streamHash(file); }
  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = (error, hash) => {
      if (finished) return;
      finished = true; worker.terminate(); error ? reject(error) : resolve(hash);
    };
    const fallback = () => {
      if (finished) return;
      finished = true; worker.terminate();
      // The page already loaded this hasher, even if a new worker cannot load offline.
      streamHash(file).then(resolve, reject);
    };
    worker.onmessage = ({ data }) => {
      if (data?.error) finish(new Error(data.error));
      else if (typeof data?.hash !== 'string' || !/^[a-f0-9]{64}$/.test(data.hash)) finish(new Error('Audio identity verification did not return a valid hash.'));
      else finish(null, data.hash);
    };
    worker.onerror = event => { event.preventDefault?.(); fallback(); };
    try { worker.postMessage(file); } catch { fallback(); }
  });
}
export async function resolveSource(track, requestPermission = false) {
  try {
    const source = await getSource(track.id);
    if (!source?.handle) {
      const file = await getFile(track.id);
      if (file && track.contentHash && await contentHash(file) !== track.contentHash) return { status: 'File changed' };
      return { file, status: file ? 'Stored copy' : 'File missing' };
    }
    let permission = await source.handle.queryPermission({ mode: 'read' });
    if (permission !== 'granted' && requestPermission) permission = await source.handle.requestPermission({ mode: 'read' });
    if (permission !== 'granted') return { status: 'Permission needed' };
    const file = await source.handle.getFile();
    // Imported metadata and file size/timestamps cannot establish audio identity.
    if (track.contentHash && await contentHash(file) !== track.contentHash) return { status: 'File changed' };
    return { file, status: 'Ready' };
  } catch { return { status: 'File missing' }; }
}
export async function attachIdentical(track, file, handle) {
  const hash = await contentHash(file);
  if (track.contentHash && track.contentHash !== hash) throw new Error('This is different audio. Use Replace recording to review the change.');
  if (!track.contentHash) throw new Error('Original identity is unavailable. Use Replace recording to review the change.');
  return file;
}
export async function* folderFiles(directory) {
  for await (const handle of directory.values()) {
    if (handle.kind === 'directory') yield* folderFiles(handle);
    else if (/\.(mp3|wav|flac|m4a|ogg|aiff?|opus|aac)$/i.test(handle.name)) yield { handle, file: await handle.getFile() };
  }
}
