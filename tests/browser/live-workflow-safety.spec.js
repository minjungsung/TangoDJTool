import { test, expect, recordingAction } from './saved-workspace.js';

const video = (id, number, values = {}) => ({ id, source: 'youtube', videoId: `abcdefghij${number}`, title: id.toUpperCase(), duration: 180, style: 'Tango', ...values });
const group = (id, trackIds, values = {}) => ({ id, kind: 'tanda', name: id === 't' ? 'My tanda' : id, trackIds, collapsed: false, ...values });

async function bootstrap(page, workspace = {}) {
  const runtimeErrors = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));
  await page.route('https://**', route => route.abort());
  await page.addInitScript(() => {
    localStorage.setItem('studio-language', 'en');
    window.testOnline = true;
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => window.testOnline });
    window.testDurations = {};
    window.YT = { Player: class {
      constructor(id, options) {
        this.options = options; this.state = 2; this.position = 0; this.loads = [];
        window.testYT = this;
        if (window.delayYTReady) window.releaseYTReady = () => options.events.onReady();
        else setTimeout(() => options.events.onReady(), 0);
      }
      loadVideoById(value) {
        this.id = typeof value === 'string' ? value : value.videoId;
        this.position = typeof value === 'string' ? 0 : value.startSeconds || 0;
        this.loads.push({ id: this.id, position: this.position });
        this.state = window.pendingYTLoads ? 3 : 1; this.options.events.onStateChange({ data: this.state });
      }
      getCurrentTime() { return this.position; }
      getDuration() { return window.testDurations[this.id] ?? 180; }
      getPlayerState() { return this.state; }
      getVideoUrl() { return `https://www.youtube.com/watch?v=${this.id}`; }
      setVolume() {}
      pauseVideo() { this.state = 2; this.options.events.onStateChange({ data: 2 }); }
      playVideo() { this.playCalls = (this.playCalls || 0) + 1; this.state = 1; this.options.events.onStateChange({ data: 1 }); }
      seekTo(value) { this.position = value; }
    } };
  });
  await page.goto('/');
  const state = {
    tracks: [video('a', 0), video('b', 1), video('c', 2, { style: 'Cortina' }), video('x', 3)],
    groups: [group('t', ['a', 'b', 'a']), group('cortina', ['c'], { kind: 'cortina', startSeconds: 30, limitSeconds: 20, holdAfter: true }), group('t2', ['b']), group('empty', [])],
    collections: [{ id: 'candidates', name: 'Candidates', trackIds: ['a', 'x'] }, { id: 'empty-candidates', name: 'Empty candidates', trackIds: [] }],
    ...workspace,
  };
  if (!workspace.collections) state.collections = state.collections.map(collection => ({ ...collection, trackIds: collection.trackIds.filter(id => state.tracks.some(track => track.id === id)) }));
  await page.evaluate(async state => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('tango-dj-studio', 2);
      request.onupgradeneeded = () => {
        for (const name of ['files', 'state', 'sources']) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name);
      };
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction('state', 'readwrite'); tx.objectStore('state').put({ ...state, revision: 2 }, 'current');
      tx.oncomplete = resolve; tx.onabort = () => reject(tx.error);
    }); db.close();
  }, state);
  await page.reload();
  await expect(page.locator('#save-status')).toHaveText('Saved in this browser').catch(error => {
    throw new Error(`${error.message}\nApp initialization errors: ${runtimeErrors.join('; ')}`);
  });
}

async function nav(page, view) {
  const button = page.locator(`button[data-view="${view}"]`);
  if (await button.isVisible()) await button.click();
  else await page.locator(`.sidebar a[href="#${view}"]`).click();
}

async function start(page) {
  await nav(page, 'set'); await page.locator('#start-set').click();
  await expect(page.locator('#playing-title')).toHaveText('A');
  await expect(page.locator('#play-pause')).toBeEnabled();
  await nav(page, 'deck');
}

async function delayFileReads(page) {
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.get;
    window.pendingFileReads = [];
    IDBObjectStore.prototype.get = function(key) {
      const native = original.call(this, key);
      if (this.name !== 'files') return native;
      const pending = { result: undefined, error: null, onsuccess: null, onerror: null };
      native.onsuccess = () => { pending.result = native.result; window.pendingFileReads.push(() => pending.onsuccess?.()); };
      native.onerror = () => { pending.error = native.error; pending.onerror?.(); };
      return pending;
    };
    window.releaseFileReads = () => { IDBObjectStore.prototype.get = original; window.pendingFileReads.splice(0).forEach(release => release()); };
  });
}

async function saveLocalAudio(page, id = 'local', seconds = 10) {
  await page.evaluate(async ({ id, seconds }) => {
    const sampleCount = 8000 * seconds, bytes = new Uint8Array(44 + sampleCount * 2), view = new DataView(bytes.buffer);
    const text = (offset, value) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
    text(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); text(8, 'WAVE'); text(12, 'fmt '); view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 8000, true); view.setUint32(28, 16000, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, sampleCount * 2, true);
    for (let i = 0; i < sampleCount; i++) view.setInt16(44 + i * 2, Math.round(650 * Math.sin(i / 8000 * Math.PI * 440)), true);
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open('tango-dj-studio', 2); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    await new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').put(new Blob([bytes], { type: 'audio/wav' }), id);
      tx.oncomplete = resolve; tx.onabort = () => reject(tx.error);
    }); db.close();
  }, { id, seconds });
}

async function holdReservationSave(page) {
  await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put, get = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.put = function(...args) {
      const request = put.apply(this, args);
      if (this.name === 'state' && args[0]?.queue?.some(item => item.pendingAddition) && !window.heldReservation) {
        window.heldReservation = true;
        const store = this;
        request.addEventListener('success', () => {
          let holding = true;
          const pulse = () => { if (holding) get.call(store, 'current').onsuccess = pulse; };
          window.finishReservationSave = fail => { holding = false; if (fail) store.transaction.abort(); };
          pulse();
        });
      }
      return request;
    };
  });
  await nav(page, 'library'); await page.locator('[data-action=play-next][data-id=x]').click();
  await expect.poll(() => page.evaluate(() => typeof window.finishReservationSave)).toBe('function');
}

async function releaseReservationSave(page, fail = false) {
  await page.evaluate(fail => window.finishReservationSave(fail), fail);
  await expect(page.locator('[data-action=play-next][data-id=x]')).toBeEnabled();
}

const livePlayback = page => page.evaluate(() => ({
  title: document.querySelector('#playing-title').textContent,
  active: document.querySelector('.queue-item.playing strong')?.textContent,
  video: window.testYT.id, state: window.testYT.state, loads: window.testYT.loads.length,
}));

const savedWorkspace = page => page.evaluate(() => new Promise((resolve, reject) => {
  const opening = indexedDB.open('tango-dj-studio', 2);
  opening.onerror = () => reject(opening.error);
  opening.onsuccess = () => {
    const db = opening.result, request = db.transaction('state').objectStore('state').get('current');
    request.onsuccess = () => { db.close(); resolve(request.result); };
    request.onerror = () => { db.close(); reject(request.error); };
  };
}));

const originalQueue = ['A', 'B', 'A', 'C', 'B'];

async function expectUnchangedReservation(page, title = 'A', loads = 1) {
  await expect(page.locator('.queue-item strong')).toHaveText(originalQueue);
  await expect(page.locator('[data-group=t] li')).toHaveCount(3);
  expect(await livePlayback(page)).toMatchObject({ title, active: title, loads });
}

test('a reservation reaches the live queue only after its save succeeds', async ({ page }) => {
  await bootstrap(page); await start(page); await holdReservationSave(page);
  await expectUnchangedReservation(page);
  await releaseReservationSave(page);
  await expect(page.locator('.queue-item strong')).toHaveText(['A', 'X', 'B', 'A', 'C', 'B']);
  expect(await livePlayback(page)).toMatchObject({ title: 'A', active: 'A', loads: 1, state: 1 });
  await nav(page, 'deck'); await page.locator('#next').click();
  await expect(page.locator('#playing-title')).toHaveText('X');
  expect(await livePlayback(page)).toMatchObject({ active: 'X', video: 'abcdefghij3', loads: 2 });
  await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
  expect((await savedWorkspace(page)).queue.map(item => item.trackId)).toEqual(['a', 'x', 'b', 'a', 'c', 'b']);
});

test('a failed reservation keeps the original audio and prepared tanda', async ({ page }) => {
  await bootstrap(page); await start(page); await holdReservationSave(page);
  await releaseReservationSave(page, true);
  await expect(page.locator('#notice')).toContainText('queue is unchanged');
  await expectUnchangedReservation(page);
  expect((await savedWorkspace(page)).groups.find(group => group.id === 't').trackIds).toEqual(['a', 'b', 'a']);
});

for (const fail of [false, true]) {
  test(`Next during a ${fail ? 'failed' : 'successful'} reservation save keeps the new active occurrence`, async ({ page }) => {
    await bootstrap(page); await start(page); await holdReservationSave(page);
    await nav(page, 'deck'); await page.locator('#next').click();
    await expect(page.locator('#playing-title')).toHaveText('B');
    await releaseReservationSave(page, fail);
    await expectUnchangedReservation(page, 'B', 2);
    await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
    const saved = await savedWorkspace(page);
    expect(saved.queue.map(item => item.trackId)).toEqual(['a', 'b', 'a', 'c', 'b']);
    expect(saved.groups.find(group => group.id === 't').trackIds).toEqual(['a', 'b', 'a']);
    expect(saved.queue[saved.queueIndex].trackId).toBe('b');
    expect(await livePlayback(page)).toMatchObject({ state: 1, video: 'abcdefghij1' });
  });

  test(`Stop during a ${fail ? 'failed' : 'successful'} reservation save never restarts the deck`, async ({ page }) => {
    await bootstrap(page); await start(page); await holdReservationSave(page);
    await nav(page, 'deck'); await page.locator('#stop').click();
    await releaseReservationSave(page, fail);
    await expect(page.locator('.queue-item strong')).toHaveText(fail ? originalQueue : ['A', 'X', 'B', 'A', 'C', 'B']);
    expect(await livePlayback(page)).toMatchObject({ title: 'A', active: 'A', state: 2, loads: 1 });
    expect((await savedWorkspace(page)).groups.find(group => group.id === 't').trackIds).toEqual(fail ? ['a', 'b', 'a'] : ['a', 'x', 'b', 'a']);
  });

  test(`deleting the target during a ${fail ? 'failed' : 'successful'} reservation save preserves deletion and active audio`, async ({ page }) => {
    await bootstrap(page); await start(page); await holdReservationSave(page);
    await nav(page, 'set'); page.once('dialog', dialog => dialog.accept());
    await page.locator('[data-group-action=delete][data-id=t]').click();
    await expect(page.locator('[data-group=t]')).toHaveCount(0);
    await releaseReservationSave(page, fail);
    await expect(page.locator('[data-group=t]')).toHaveCount(0);
    expect(await livePlayback(page)).toMatchObject({ title: 'A', active: 'A', state: 1, loads: 1 });
    await expect(page.locator('.queue-item strong')).toHaveText(originalQueue);
    await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
    expect((await savedWorkspace(page)).groups.some(group => group.id === 't')).toBe(false);
  });

  test(`editing the target during a ${fail ? 'failed' : 'successful'} reservation save preserves the edit and active audio`, async ({ page }) => {
    await bootstrap(page); await start(page); await holdReservationSave(page);
    await nav(page, 'set');
    await page.locator('[data-group-action=remove][data-id=t][data-index="2"]').click();
    await expect(page.locator('[data-group=t] li')).toHaveCount(2);
    await releaseReservationSave(page, fail);
    await expect(page.locator('[data-group=t] li')).toHaveCount(2);
    await expect(page.locator('.queue-item strong')).toHaveText(originalQueue);
    expect(await livePlayback(page)).toMatchObject({ title: 'A', active: 'A', state: 1, loads: 1 });
    await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
    expect((await savedWorkspace(page)).groups.find(group => group.id === 't').trackIds).toEqual(['a', 'b']);
  });
}

async function preparePendingGroup(page, kind = 'tanda', values = {}) {
  await bootstrap(page, {
    tracks: [video('a', 0), video('x', 3), { id: 'local', title: 'Pending local audio', source: 'local', duration: 10 }],
    groups: [group('t', ['a']), group('pending', ['local', 'x'], { kind, ...values })],
  });
  await saveLocalAudio(page); await nav(page, 'library');
  await page.locator('[data-action=play][data-id=a]').click();
  await expect(page.locator('#playing-title')).toHaveText('A');
  await expect(page.locator('#play-pause')).toBeEnabled();
  await delayFileReads(page); await nav(page, 'set');
  await page.locator(`[data-group-action=${kind === 'cortina' ? 'cue-play' : 'play-tanda'}][data-id=pending]`).click();
  await expect.poll(() => page.evaluate(() => window.pendingFileReads.length)).toBe(1);
}

async function expectPreparedPlaybackCancelled(page) {
  await page.evaluate(() => window.releaseFileReads());
  await expect(page.locator('#notice')).toContainText('prepared set changed');
  await expect(page.locator('#play-pause')).toBeEnabled();
  expect(await livePlayback(page)).toMatchObject({ title: 'A', active: 'A', state: 1, loads: 1 });
  await expect(page.locator('.queue-item strong')).toHaveText(['A']);
}

for (const kind of ['tanda', 'cortina']) {
  test(`a deleted ${kind} cannot start after its pending file check`, async ({ page }) => {
    await preparePendingGroup(page, kind);
    page.once('dialog', dialog => dialog.accept());
    await page.locator('[data-group-action=delete][data-id=pending]').click();
    await expect(page.locator('[data-group=pending]')).toHaveCount(0);
    await expectPreparedPlaybackCancelled(page);
  });
}

test('removing a recording cancels a tanda pending readiness', async ({ page }) => {
  await preparePendingGroup(page);
  await page.locator('[data-group-action=remove][data-id=pending][data-index="0"]').click();
  await expectPreparedPlaybackCancelled(page);
});

test('changing a cortina cue cancels its pending readiness', async ({ page }) => {
  await preparePendingGroup(page, 'cortina', { startSeconds: 1, limitSeconds: 5 });
  await page.locator('[data-cortina-start=pending]').fill('2');
  await page.locator('[data-cortina-start=pending]').dispatchEvent('change');
  await expectPreparedPlaybackCancelled(page);
});

test('changing the full prepared set cancels a pending set load', async ({ page }) => {
  await bootstrap(page, {
    tracks: [video('a', 0), { id: 'local', title: 'Pending local audio', source: 'local', duration: 10 }],
    groups: [group('t', ['a']), group('pending', ['local'])],
  });
  await saveLocalAudio(page); await nav(page, 'library'); await page.locator('[data-action=play][data-id=a]').click();
  await expect(page.locator('#playing-title')).toHaveText('A'); await expect(page.locator('#play-pause')).toBeEnabled();
  await delayFileReads(page); await nav(page, 'set'); await page.locator('#start-set').click();
  await expect.poll(() => page.evaluate(() => window.pendingFileReads.length)).toBe(1);
  await page.locator('[data-group-action=remove][data-id=pending][data-index="0"]').click();
  await expectPreparedPlaybackCancelled(page);
});

async function preparePendingLibrary(page, { hashed = false, collection = false, groupKind = null } = {}) {
  await bootstrap(page, {
    tracks: [video('a', 0), video('x', 3), { id: 'local', title: 'Pending local audio', source: 'local', duration: 10 }],
    groups: [group('t', ['a']), ...(groupKind ? [group('pending', ['local'], { kind: groupKind, startSeconds: 0, limitSeconds: 5 })] : [])],
    collections: [{ id: 'candidates', name: 'Candidates', trackIds: ['local', 'x'] }],
  });
  await saveLocalAudio(page);
  let replacement;
  if (hashed) {
    replacement = await page.evaluate(async () => {
      const { getFile } = await import('/src/storage.js'), { contentHash } = await import('/src/file-sources.js');
      const file = await getFile('local'), hash = await contentHash(file), bytes = new Uint8Array(await file.arrayBuffer());
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('tango-dj-studio', 2);
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
      await new Promise((resolve, reject) => {
        const tx = db.transaction('state', 'readwrite'), store = tx.objectStore('state'), request = store.get('current');
        request.onsuccess = () => {
          const state = request.result; state.tracks.find(track => track.id === 'local').contentHash = hash;
          state.revision++; store.put(state, 'current');
        };
        tx.oncomplete = resolve; tx.onabort = () => reject(tx.error);
      });
      db.close(); bytes[44] ^= 255; return [...bytes];
    });
    await page.reload();
  }
  await nav(page, 'library'); await page.locator('[data-action=play][data-id=a]').click();
  await expect(page.locator('#playing-title')).toHaveText('A'); await expect(page.locator('#play-pause')).toBeEnabled();
  await expect(page.locator('#session-count')).toHaveText('1');
  await delayFileReads(page);
  if (collection) {
    await nav(page, 'collections'); await page.locator('[data-collection=candidates]').click();
    await page.locator('#collection-play').click();
  } else if (groupKind) {
    await nav(page, 'set'); await page.locator('[data-group-action=cue-play][data-id=pending]').click();
  } else await page.locator('[data-action=play][data-id=local]').click();
  await expect.poll(() => page.evaluate(() => window.pendingFileReads.length)).toBe(1);
  return replacement;
}

async function expectPendingRequestCancelled(page) {
  await expectPreparedPlaybackCancelled(page);
  await expect(page.locator('#session-count')).toHaveText('1');
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('studio-dj-session'))).events.map(event => event.title)).toEqual(['A']);
}

test('relinking a same-ID library recording during readiness keeps the original live queue', async ({ page }) => {
  const replacement = await preparePendingLibrary(page, { hashed: true });
  await recordingAction(page, 'relink', 'local'); page.once('dialog', dialog => dialog.accept());
  await page.locator('#relink-input').setInputFiles({ name: 'replacement.wav', mimeType: 'audio/wav', buffer: Buffer.from(replacement) });
  await expect(page.locator('#notice')).toContainText('File relinked');
  await expectPendingRequestCancelled(page);
});

test('changing library cues during readiness keeps the original live queue', async ({ page }) => {
  await preparePendingLibrary(page); await recordingAction(page, 'edit', 'local');
  await page.locator('#metadata-form [name=cueStartSeconds]').fill('2');
  await page.locator('#metadata-form [name=cueEndSeconds]').fill('8');
  await page.locator('#metadata-form [type=submit]').click();
  await expect(page.locator('#metadata-dialog')).not.toBeVisible();
  await expectPendingRequestCancelled(page);
});

for (const action of ['delete', 'remove', 'rename']) {
  test(`collection ${action} during readiness keeps the original live queue`, async ({ page }) => {
    await preparePendingLibrary(page, { collection: true });
    if (action === 'delete') {
      page.once('dialog', dialog => dialog.accept());
      await page.locator('[data-collection-delete=candidates]').click();
    } else if (action === 'remove') await page.locator('[data-candidate-remove="0"]').click();
    else {
      page.once('dialog', dialog => dialog.accept('Updated candidates'));
      await page.locator('#collection-rename').click();
    }
    await expectPendingRequestCancelled(page);
  });
}

test('an unchanged collection starts after readiness and logs only the actual recording', async ({ page }) => {
  await preparePendingLibrary(page, { collection: true });
  await page.evaluate(() => window.releaseFileReads());
  await expect(page.locator('#playing-title')).toHaveText('Pending local audio');
  await expect(page.locator('.queue-item strong')).toHaveText(['Pending local audio', 'X']);
  await expect(page.locator('.queue-item.playing strong')).toHaveText('Pending local audio');
  await expect(page.locator('#session-count')).toHaveText('2');
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('studio-dj-session'))).events.map(event => event.title)).toEqual(['A', 'Pending local audio']);
});

for (const scope of ['library', 'cortina']) {
  test(`${scope} readiness hands off the verified source before a later replacement can start stale audio`, async ({ page }) => {
    const replacement = await preparePendingLibrary(page, { hashed: true, groupKind: scope === 'cortina' ? 'cortina' : null });
    await page.evaluate(() => window.pendingFileReads.shift()());
    // Older behavior opened a second readiness read after publishing the queue.
    // A replacement in that window could start the first file under the new
    // recording identity. A verified handoff reaches actual playback directly.
    await expect.poll(() => page.evaluate(() => window.pendingFileReads.length > 0 || (document.querySelector('#playing-title').textContent === 'Pending local audio' && !document.querySelector('#play-pause').disabled))).toBe(true);
    await nav(page, 'library'); await recordingAction(page, 'relink', 'local');
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#relink-input').setInputFiles({ name: 'replacement.wav', mimeType: 'audio/wav', buffer: Buffer.from(replacement) });
    await expect(page.locator('#notice')).toContainText('File relinked');
    await page.evaluate(() => window.releaseFileReads());
    await expect(page.locator('#play-pause')).toBeEnabled();
    await expect(page.locator('#play-pause')).toHaveText('▶');
    await expect(page.locator('#playing-title')).toHaveText('Pending local audio');
    await expect(page.locator('.queue-item.playing strong')).toHaveText('Pending local audio');
  });
}
