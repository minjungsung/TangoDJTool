import { readFile } from 'node:fs/promises';
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

async function saveCues(page, id, cueIn, cueOut) {
  await nav(page, 'library'); await recordingAction(page, 'edit', id);
  await page.locator('#metadata-form [name=cueStartSeconds]').fill(String(cueIn));
  await page.locator('#metadata-form [name=cueEndSeconds]').fill(String(cueOut));
  await page.locator('#metadata-form [type=submit]').click();
  await expect(page.locator('#metadata-dialog')).not.toBeVisible();
  await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
}

const playback = page => page.evaluate(() => ({ id: testYT.id, position: testYT.position, state: testYT.state, loads: testYT.loads.length }));
const savedSession = page => page.evaluate(() => JSON.parse(localStorage.getItem('studio-dj-session') || 'null'));

async function finishRecording(page) {
  await page.evaluate(() => { testYT.position = testYT.getDuration(); testYT.state = 0; testYT.options.events.onStateChange({ data: 0 }); });
}

async function freezeClock(page) {
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
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

for (const width of [1440, 390]) {
  test(`${width}px Live mode protects playback replacement while Pause, Stop and Next stay usable`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 }); await bootstrap(page); await start(page);
    await page.locator('#live-mode').check();
    await expect(page.locator('#live-status')).toBeVisible();
    for (const selector of ['#seek', '#previous', '#import-set', '#start-set', '#queue [data-queue-index]']) {
      for (const control of await page.locator(selector).all()) await expect(control).toBeDisabled();
    }
    await nav(page, 'library');
    for (const control of await page.locator('#tracks [data-action=play]').all()) await expect(control).toBeDisabled();
    await nav(page, 'collections'); await page.locator('[data-collection=candidates]').click();
    await expect(page.locator('#collection-play')).toBeDisabled();
    for (const control of await page.locator('[data-candidate-play]').all()) await expect(control).toBeDisabled();
    await nav(page, 'set');
    for (const control of await page.locator('[data-group-action=play-tanda],[data-group-action=play-recording],[data-group-action=cue-play]').all()) await expect(control).toBeDisabled();
    await nav(page, 'deck');
    await expect(page.locator('.queue-item strong')).toHaveText(['A', 'B', 'A', 'C', 'B']);
    await page.locator('#next').click(); await expect(page.locator('#playing-title')).toHaveText('B');
    await expect(page.locator('#previous')).toBeDisabled();
    await page.locator('#play-pause').click(); expect((await playback(page)).state).toBe(2);
    await page.locator('#play-pause').click(); expect((await playback(page)).state).toBe(1);
    await page.locator('#stop').click(); expect((await playback(page)).state).toBe(2);
    await page.locator('#live-mode').uncheck();
    await expect(page.locator('#previous')).toBeEnabled(); await expect(page.locator('#seek')).toBeEnabled();
    await expect(page.locator('#import-set')).toBeEnabled(); await expect(page.locator('#start-set')).toBeEnabled();
    await expect(page.locator('[data-group-action=play-tanda][data-id=empty]')).toBeDisabled();
    await nav(page, 'collections'); await page.locator('[data-collection=empty-candidates]').click();
    await expect(page.locator('#collection-play')).toBeDisabled();
    await page.locator('[data-collection=candidates]').click();
    await expect(page.locator('#collection-play')).toBeEnabled();
    await expect(page.locator('[data-candidate-play=a]')).toBeEnabled();
    await nav(page, 'deck'); await page.locator('[data-queue-index="0"]').click();
    await expect(page.locator('#playing-title')).toHaveText('A');
    await expect(page.locator('#previous')).toBeDisabled();
  });
}

test('prepared set checks report source and musical issues without changing active playback', async ({ page }) => {
  const tracks = [video('a', 0), video('b', 1, { style: 'Vals' }), { id: 'missing', title: 'Missing local', source: 'local', style: 'Tango', duration: 40, cueStartSeconds: 50 }];
  await bootstrap(page, { tracks, groups: [group('t', ['a', 'b', 'missing'])] });
  await nav(page, 'library'); await page.locator('[data-action=play][data-id=a]').click();
  await expect(page.locator('#playing-title')).toHaveText('A');
  await page.evaluate(() => { testYT.position = 42; window.testOnline = false; window.dispatchEvent(new Event('offline')); });
  const before = await playback(page);
  await nav(page, 'deck'); await page.locator('#performance-check').click();
  await expect(page.locator('#check-summary')).toContainText('Blocking issues: 4');
  for (const code of ['missing-file', 'cue-start', 'mixed-styles', 'youtube-offline']) await expect(page.locator(`[data-check-code=${code}]`).first()).toBeVisible();
  await expect(page.locator('[data-check-code=cue-start]')).toHaveClass(/error/);
  await expect(page.locator('[data-check-code=mixed-styles]')).toHaveClass(/warning/);
  expect(await playback(page)).toEqual(before);
  await expect(page.locator('.queue-item strong')).toHaveText(['A']);
  await page.locator('[data-close=performance-dialog]').click();
  await page.evaluate(() => { window.testOnline = true; window.dispatchEvent(new Event('online')); });
  await page.locator('#performance-check').click();
  await expect(page.locator('[data-check-code=youtube-network]')).toHaveCount(2);
  await expect(page.locator('[data-check-code=youtube-network]').first()).toContainText('have not been verified');
  expect(await playback(page)).toEqual(before);
});

test('recording cues survive export and reload and apply to tanda and library playback', async ({ page }) => {
  await bootstrap(page); await saveCues(page, 'a', 12, 90);
  const downloading = page.waitForEvent('download'); await page.locator('#export-set').click();
  const downloaded = await downloading;
  const backup = JSON.parse(await readFile(await downloaded.path(), 'utf8'));
  expect(backup.tracks.find(track => track.id === 'a')).toMatchObject({ cueStartSeconds: 12, cueEndSeconds: 90 });
  await page.reload(); await nav(page, 'library'); await recordingAction(page, 'edit', 'a');
  await expect(page.locator('#metadata-form [name=cueStartSeconds]')).toHaveValue('12');
  await expect(page.locator('#metadata-form [name=cueEndSeconds]')).toHaveValue('90');
  await page.locator('#close-metadata').click();
  await nav(page, 'set'); await page.locator('[data-group-action=play-tanda][data-id=t]').click();
  await expect(page.locator('#playing-title')).toHaveText('A'); await expect(page.locator('#play-pause')).toBeEnabled();
  expect((await playback(page)).position).toBe(12);
  await expect(page.locator('#position')).toHaveText('0:00 / 1:18');
  await nav(page, 'library'); await page.locator('[data-action=play][data-id=a]').click();
  await expect(page.locator('#play-pause')).toBeEnabled(); expect((await playback(page)).position).toBe(12);
  await expect(page.locator('.queue-item strong')).toHaveText(['A']);
  await expect(page.locator('#position')).toHaveText('0:00 / 1:18');
});

test('cue edits leave the active clip and seek position intact while refresh updates future occurrences', async ({ page }) => {
  await bootstrap(page); await start(page); await page.locator('#play-pause').click(); await page.locator('#seek').fill('25');
  await expect(page.locator('#position')).toHaveText('0:45 / 3:00');
  const before = await playback(page); await saveCues(page, 'a', 10, 80);
  expect(await playback(page)).toEqual(before);
  await expect(page.locator('#position')).toHaveText('0:45 / 3:00');
  await nav(page, 'set'); await expect(page.locator('#queue-stale')).toBeVisible();
  await page.locator('#refresh-queue').click();
  await expect(page.locator('#queue-stale')).toBeHidden(); expect(await playback(page)).toEqual(before);
  await expect(page.locator('.queue-item').first().locator('span').last()).toHaveText('3:00');
  await expect(page.locator('[data-queue-index="2"] span').last()).toHaveText('1:10');
  await nav(page, 'deck'); await page.locator('[data-queue-index="2"]').click();
  await expect(page.locator('#play-pause')).toBeEnabled(); expect((await playback(page)).position).toBe(10);
  await expect(page.locator('#position')).toHaveText('0:00 / 1:10');
});

test('remaining runtime includes cue offsets, unknown lengths and manual waits after reload', async ({ page }) => {
  await bootstrap(page, {
    tracks: [video('a', 0, { cueStartSeconds: 30, cueEndSeconds: 90 }), video('b', 1, { duration: null }), video('c', 2, { style: 'Cortina' })],
    groups: [group('t', ['a']), group('cortina', ['c'], { kind: 'cortina', startSeconds: 20, limitSeconds: 20, holdAfter: true }), group('t2', ['b'])],
  });
  await start(page);
  await expect(page.locator('#program-runtime')).toHaveText('Set remaining: 1:20 · Unknown lengths: 1 · Manual waits: 1');
  await page.locator('#play-pause').click(); await page.locator('#seek').fill('50');
  await expect(page.locator('#program-runtime')).toHaveText('Set remaining: 0:50 · Unknown lengths: 1 · Manual waits: 1');
  await page.reload(); await nav(page, 'deck');
  await expect(page.locator('#position')).toHaveText('0:30 / 1:00');
  await expect(page.locator('#program-runtime')).toHaveText('Set remaining: 0:50 · Unknown lengths: 1 · Manual waits: 1');
  expect(await page.evaluate(() => Boolean(window.testYT))).toBe(false);
});

test('keyboard Next and Stop work globally and ignore typing and open dialogs', async ({ page }) => {
  await bootstrap(page); await start(page); await page.locator('#live-mode').check();
  await nav(page, 'library'); await page.locator('#search').focus(); await page.keyboard.type('ns');
  await expect(page.locator('#search')).toHaveValue('ns');
  await expect(page.locator('#playing-title')).toHaveText('A'); expect((await playback(page)).state).toBe(1);
  await page.locator('#search').fill(''); await recordingAction(page, 'edit', 'a');
  await page.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyN', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS', bubbles: true }));
  });
  await expect(page.locator('#playing-title')).toHaveText('A'); expect((await playback(page)).state).toBe(1);
  await page.locator('#close-metadata').click(); await nav(page, 'deck');
  await page.evaluate(() => document.activeElement.blur()); await page.keyboard.press('n');
  await expect(page.locator('#playing-title')).toHaveText('B');
  await page.evaluate(() => document.activeElement.blur()); await page.keyboard.press('s');
  expect((await playback(page)).state).toBe(2); await expect(page.locator('#notice')).toContainText('Playback stopped');
});

test('Stop cancels a pending YouTube load before its delayed ready event can start audio', async ({ page }) => {
  await bootstrap(page); await page.evaluate(() => { window.delayYTReady = true; });
  await nav(page, 'set'); await page.locator('#start-set').click();
  await nav(page, 'deck');
  await expect(page.locator('#playback-loading')).toBeVisible();
  await expect(page.locator('#stop')).toBeEnabled(); await page.locator('#stop').click();
  await page.evaluate(() => window.releaseYTReady());
  await expect(page.locator('#playback-loading')).toBeHidden();
  expect(await page.evaluate(() => [testYT.state, testYT.loads.length])).toEqual([2, 0]);
  await expect(page.locator('#notice')).toContainText('Playback stopped');
});

test('Stop wins over a pending prepared-file check and keeps the active queue stopped', async ({ page }) => {
  await bootstrap(page, {
    tracks: [video('a', 0), { id: 'local', title: 'Local recording', source: 'local', duration: 2 }],
    groups: [group('t', ['a', 'local'])],
  });
  await saveLocalAudio(page);
  await nav(page, 'library'); await page.locator('[data-action=play][data-id=a]').click();
  await expect(page.locator('#playing-title')).toHaveText('A'); await expect(page.locator('#play-pause')).toBeEnabled();
  await delayFileReads(page);
  await nav(page, 'set'); await page.locator('#start-set').click();
  await expect.poll(() => page.evaluate(() => window.pendingFileReads.length)).toBe(1);
  await nav(page, 'deck'); await page.locator('#stop').click(); await page.evaluate(() => window.releaseFileReads());
  await expect(page.locator('#notice')).toContainText('Playback stopped');
  await expect(page.locator('.queue-item strong')).toHaveText(['A']);
  expect(await playback(page)).toMatchObject({ state: 2, loads: 1, position: 0 });
});

test('preview stays off the room output and separate headphones are canceled on device changes', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeAudio = window.Audio, sinks = new WeakMap();
    window.testAudioElements = [];
    window.Audio = function(...args) { const audio = new NativeAudio(...args); window.testAudioElements.push(audio); return audio; };
    window.Audio.prototype = NativeAudio.prototype;
    Object.defineProperty(HTMLMediaElement.prototype, 'sinkId', { configurable: true, get() { return sinks.get(this) || ''; } });
    HTMLMediaElement.prototype.setSinkId = async function(id) { sinks.set(this, id); };
    window.testOutputs = [
      { kind: 'audiooutput', deviceId: 'default', groupId: 'room', label: 'System room output' },
      { kind: 'audiooutput', deviceId: 'room-speakers', groupId: 'room', label: 'Room speakers' },
      { kind: 'audiooutput', deviceId: 'headphones', groupId: 'headphones', label: 'DJ headphones' },
    ];
    Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', { configurable: true, value: async () => window.testOutputs });
  });
  await bootstrap(page, { tracks: [video('a', 0), { id: 'local', title: 'Local recording', source: 'local', duration: 10 }], groups: [group('t', ['a'])] });
  await saveLocalAudio(page); await nav(page, 'library');
  await page.locator('[data-action=play][data-id=a]').click(); await expect(page.locator('#play-pause')).toBeEnabled();
  const before = await playback(page);
  await recordingAction(page, 'preview', 'local');
  await expect(page.locator('#notice')).toContainText('Preview shares the live output');
  expect(await page.evaluate(() => testAudioElements[1].paused)).toBe(true); expect(await playback(page)).toEqual(before);
  await nav(page, 'deck'); await page.locator('#live-mode').check();
  await page.locator('#open-settings').click(); await page.locator('#detect-outputs').click();
  await page.locator('#preview-output').selectOption('room-speakers');
  await expect(page.locator('#output-status')).toContainText('Shared output');
  await page.locator('[data-close=settings-dialog]').click(); await nav(page, 'library'); await recordingAction(page, 'preview', 'local');
  await expect(page.locator('#notice')).toContainText('Choose a separate preview output');
  expect(await page.evaluate(() => testAudioElements[1].paused)).toBe(true); expect(await playback(page)).toEqual(before);
  await page.locator('#open-settings').click(); await page.locator('#preview-output').selectOption('headphones');
  await expect(page.locator('#output-status')).toContainText('Separate preview output selected');
  await page.locator('#preview-volume').fill('35'); await page.locator('[data-close=settings-dialog]').click();
  await recordingAction(page, 'preview', 'local'); await nav(page, 'deck');
  await expect(page.locator('#preview-status')).toBeVisible(); await expect(page.locator('#preview-status')).toContainText('Headphone output');
  expect(await page.evaluate(() => [testAudioElements[1].paused, testAudioElements[1].sinkId, testAudioElements[1].volume])).toEqual([false, 'headphones', 0.35]);
  expect(await playback(page)).toEqual(before);
  await page.evaluate(() => { window.testOutputs = window.testOutputs.filter(output => output.deviceId !== 'headphones'); navigator.mediaDevices.dispatchEvent(new Event('devicechange')); });
  await expect(page.locator('#preview-status')).toBeHidden();
  expect(await page.evaluate(() => testAudioElements[1].paused)).toBe(true); expect(await playback(page)).toEqual(before);
  await page.locator('#open-settings').click(); await expect(page.locator('#preview-output')).toHaveValue('headphones');
  await expect(page.locator('#preview-output option:checked')).toHaveText('Selected output unavailable');
  await expect(page.locator('#output-status')).toContainText('Shared output');
  await page.locator('[data-close=settings-dialog]').click(); await nav(page, 'library'); await recordingAction(page, 'preview', 'local');
  await expect(page.locator('#notice')).toContainText('Choose a separate preview output');
  expect(await page.evaluate(() => testAudioElements[1].paused)).toBe(true); expect(await playback(page)).toEqual(before);
});

test('Keep screen awake reports granted, released and declined requests and cancels a late grant', async ({ page }) => {
  await page.addInitScript(() => {
    window.testWakeLocks = [];
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async type => {
      if (window.declineWakeLock) throw new DOMException('Request denied', 'NotAllowedError');
      const lock = new EventTarget(); lock.type = type; lock.released = false;
      lock.release = async () => { lock.released = true; lock.dispatchEvent(new Event('release')); };
      window.testWakeLocks.push(lock);
      if (window.delayWakeLock) await new Promise(resolve => { window.releaseWakeRequest = resolve; });
      return lock;
    } } });
  });
  await bootstrap(page); await nav(page, 'deck'); await page.locator('#keep-awake').check();
  await expect(page.locator('#awake-status')).toHaveText('Screen stays awake while this page is visible.');
  expect(await page.evaluate(() => [testWakeLocks[0].type, testWakeLocks[0].released])).toEqual(['screen', false]);
  await page.locator('#keep-awake').uncheck(); await expect(page.locator('#awake-status')).toBeHidden();
  expect(await page.evaluate(() => testWakeLocks[0].released)).toBe(true);
  await page.locator('#keep-awake').check(); await page.evaluate(() => testWakeLocks.at(-1).release());
  await expect(page.locator('#awake-status')).toContainText('Screen wake lock released');
  await page.locator('#keep-awake').uncheck(); await page.evaluate(() => { window.declineWakeLock = true; });
  await page.locator('#keep-awake').check(); await expect(page.locator('#awake-status')).toContainText('Screen wake lock was declined');
  await page.locator('#keep-awake').uncheck(); await page.evaluate(() => { window.declineWakeLock = false; window.delayWakeLock = true; });
  await page.locator('#keep-awake').check(); await page.locator('#keep-awake').uncheck();
  await page.evaluate(() => window.releaseWakeRequest());
  await expect.poll(() => page.evaluate(() => testWakeLocks.at(-1).released)).toBe(true);
  await expect(page.locator('#awake-status')).toBeHidden();
});

test('actual starts create a DJ session, preserve history across resume and reload, and export before reset', async ({ page }) => {
  const tracks = [video('a', 0, { cueStartSeconds: 12 }), video('alias', 1, { videoId: 'abcdefghij0', title: 'Alternate title for A' }), video('b', 2), video('c', 3, { style: 'Cortina', videoId: 'abcdefghij0' }), { id: 'local', source: 'local', title: 'Local preview', duration: 10 }, { id: 'missing', source: 'local', title: 'Missing recording' }];
  await bootstrap(page, { tracks, groups: [group('t', ['a', 'b'])] }); await saveLocalAudio(page);
  await nav(page, 'library'); await recordingAction(page, 'preview', 'local'); await nav(page, 'deck');
  await expect(page.locator('#preview-status')).toBeVisible(); await expect(page.locator('#session-count')).toHaveText('0');
  expect(await savedSession(page)).toBeNull(); await page.locator('#stop-preview').click();
  await nav(page, 'library'); await page.locator('[data-action=play][data-id=missing]').click();
  await expect(page.locator('#notice')).toContainText('Files need attention before playback'); expect(await savedSession(page)).toBeNull();
  await page.locator('[data-action=play][data-id=a]').click(); await expect(page.locator('#session-count')).toHaveText('1');
  await nav(page, 'deck'); await expect(page.locator('#session-name')).toHaveText('Milonga session');
  expect((await savedSession(page)).events[0]).toMatchObject({ trackId: 'a', title: 'A', position: 12, identity: 'youtube:abcdefghij0' });
  await page.locator('#play-pause').click(); await page.locator('#play-pause').click();
  await page.evaluate(() => testYT.options.events.onStateChange({ data: 1 }));
  await expect(page.locator('#session-count')).toHaveText('1');
  await nav(page, 'library'); await expect(page.locator('[data-track=a] .played-badge')).toBeVisible();
  await expect(page.locator('[data-track=alias] .played-badge')).toBeVisible();
  await expect(page.locator('[data-track=c] .played-badge')).toHaveCount(0);
  await page.locator('#hide-played').check(); await expect(page.locator('[data-track=a]')).toHaveCount(0); await expect(page.locator('[data-track=alias]')).toHaveCount(0);
  await expect(page.locator('[data-track=c]')).toHaveCount(1); await page.locator('#hide-played').uncheck();
  await page.locator('[data-action=play][data-id=alias]').click(); await expect(page.locator('#session-count')).toHaveText('2');
  await nav(page, 'deck'); await page.locator('#play-pause').click(); await page.reload(); await nav(page, 'deck');
  await expect(page.locator('#session-count')).toHaveText('2'); expect(await page.evaluate(() => Boolean(window.testYT))).toBe(false);
  await page.locator('#open-session-history').click(); await expect(page.locator('.session-entry strong')).toHaveText(['Alternate title for A', 'A']);
  const downloading = page.waitForEvent('download'); await page.locator('#export-session').click(); const downloaded = await downloading;
  expect(downloaded.suggestedFilename()).toBe('tango-dj-session.csv');
  const csv = await readFile(await downloaded.path(), 'utf8'); expect(csv).toContain('"Session","Session started","Played at"');
  expect(csv).toContain('"Alternate title for A"'); expect(csv).toContain('"youtube:abcdefghij0"'); expect(csv).not.toContain('fileName');
  await page.locator('[data-close=session-dialog]').click();
  page.once('dialog', dialog => dialog.dismiss()); await page.locator('#new-dj-session').click(); await expect(page.locator('#session-count')).toHaveText('2');
  const cancelReset = dialog => dialog.type() === 'prompt' ? dialog.accept('Friday milonga') : dialog.dismiss();
  page.on('dialog', cancelReset); await page.locator('#new-dj-session').click(); page.off('dialog', cancelReset);
  await expect(page.locator('#session-name')).toHaveText('Milonga session'); await expect(page.locator('#session-count')).toHaveText('2');
  const acceptReset = dialog => dialog.type() === 'prompt' ? dialog.accept('Friday milonga') : dialog.accept();
  page.on('dialog', acceptReset); await page.locator('#new-dj-session').click(); page.off('dialog', acceptReset);
  await expect(page.locator('#session-name')).toHaveText('Friday milonga'); await expect(page.locator('#session-count')).toHaveText('0');
  await nav(page, 'library'); await expect(page.locator('.played-badge')).toHaveCount(0); expect((await savedSession(page)).events).toEqual([]);
});

test('successful local playback marks content-identical aliases while preview and cortinas remain eligible', async ({ page }) => {
  const local = { id: 'local', source: 'local', title: 'Local tango', style: 'Tango', duration: 10, contentHash: 'a'.repeat(64) };
  await bootstrap(page, { tracks: [local, { ...local, id: 'alias', title: 'Renamed copy' }, { ...local, id: 'cortina-copy', title: 'Cortina use', style: 'Cortina' }], groups: [group('t', ['local'])] });
  await saveLocalAudio(page); await nav(page, 'library'); await recordingAction(page, 'preview', 'local');
  await expect(page.locator('#session-count')).toHaveText('0');
  await page.locator('[data-action=play][data-id=local]').click(); await expect(page.locator('#session-count')).toHaveText('1');
  await nav(page, 'deck'); await page.locator('#play-pause').click(); await nav(page, 'library');
  await expect(page.locator('[data-track=alias] .played-badge')).toBeVisible();
  await page.locator('#hide-played').check(); await expect(page.locator('#tracks tr')).toHaveCount(1); await expect(page.locator('#tracks tr')).toHaveAttribute('data-track', 'cortina-copy');
  expect((await savedSession(page)).events[0].source).toBe('local'); expect((await savedSession(page)).events[0].identity).toBe(`local:${'a'.repeat(64)}`);
});

test('MediaSession Play is idempotent and Pause cancels provider buffering before a history entry starts', async ({ page }) => {
  await page.addInitScript(() => {
    window.mediaActions = {};
    Object.defineProperty(navigator.mediaSession, 'setActionHandler', { configurable: true, value: (name, handler) => { window.mediaActions[name] = handler; } });
  });
  await bootstrap(page); await page.evaluate(() => { window.pendingYTLoads = true; }); await start(page);
  expect((await playback(page)).state).toBe(3); await expect(page.locator('#session-count')).toHaveText('0'); expect(await savedSession(page)).toBeNull();
  await page.evaluate(() => { mediaActions.play(); mediaActions.play(); });
  expect(await page.evaluate(() => [testYT.state, testYT.loads.length, testYT.playCalls || 0])).toEqual([3, 1, 0]);
  await page.evaluate(() => mediaActions.pause()); expect((await playback(page)).state).toBe(2); await expect(page.locator('#session-count')).toHaveText('0');
  await page.evaluate(() => { window.pendingYTLoads = false; mediaActions.play(); }); await expect(page.locator('#session-count')).toHaveText('1');
  expect((await playback(page)).state).toBe(1); await page.evaluate(() => mediaActions.play()); expect((await playback(page)).state).toBe(1);
  await page.evaluate(() => { mediaActions.pause(); mediaActions.play(); }); await expect(page.locator('#session-count')).toHaveText('1');
});

test('one-second natural spacing is silent and logs the next recording only after it starts; manual Next skips it', async ({ page }) => {
  await page.clock.install(); await bootstrap(page, { groups: [group('t', ['a', 'b'])] }); await start(page);
  await expect(page.locator('#track-gap')).toHaveValue('0'); await page.locator('#track-gap').fill('1'); await page.locator('#track-gap').blur(); await freezeClock(page);
  await finishRecording(page); await expect(page.locator('#gap-status')).toBeVisible();
  await expect(page.locator('#session-count')).toHaveText('1'); expect((await playback(page)).state).toBe(0);
  await page.clock.runFor(900); await expect(page.locator('#playing-title')).toHaveText('A'); await expect(page.locator('#session-count')).toHaveText('1');
  await page.clock.runFor(200); await expect(page.locator('#playing-title')).toHaveText('B'); await expect(page.locator('#session-count')).toHaveText('2');
  await expect(page.locator('#gap-status')).toBeHidden();
  await nav(page, 'set'); await page.locator('#start-set').click(); await expect(page.locator('#playing-title')).toHaveText('A'); await nav(page, 'deck');
  await finishRecording(page); await expect(page.locator('#gap-status')).toBeVisible(); await page.locator('#next').click();
  await expect(page.locator('#playing-title')).toHaveText('B'); await expect(page.locator('#session-count')).toHaveText('4');
  await page.clock.runFor(2000); expect((await playback(page)).loads).toBe(4); await expect(page.locator('#gap-status')).toBeHidden();
});

test('natural advance does not insert recording spacing at a cortina or tanda boundary', async ({ page }) => {
  await page.clock.install(); await bootstrap(page, { groups: [group('t', ['a']), group('cortina', ['c'], { kind: 'cortina', fullLength: true, holdAfter: false }), group('t2', ['b'])] }); await start(page);
  await page.locator('#track-gap').fill('1'); await page.locator('#track-gap').blur(); await freezeClock(page);
  await finishRecording(page); await expect(page.locator('#playing-title')).toHaveText('C'); await expect(page.locator('#gap-status')).toBeHidden();
  await finishRecording(page); await expect(page.locator('#playing-title')).toHaveText('B'); await expect(page.locator('#gap-status')).toBeHidden();
  await expect(page.locator('#session-count')).toHaveText('3'); expect((await playback(page)).loads).toBe(3);
});

for (const cancel of ['Stop', 'Pause', 'Auto next']) {
  test(`${cancel} cancels a pending natural recording gap without starting or logging the next recording`, async ({ page }) => {
    await page.clock.install(); await bootstrap(page, { groups: [group('t', ['a', 'b'])] }); await start(page);
    await page.locator('#track-gap').fill('1'); await page.locator('#track-gap').blur(); await freezeClock(page);
    await finishRecording(page); await expect(page.locator('#gap-status')).toBeVisible();
    if (cancel === 'Stop') await page.locator('#stop').click();
    else if (cancel === 'Pause') await page.locator('#play-pause').click();
    else await page.locator('#auto-next').uncheck();
    await expect(page.locator('#gap-status')).toBeHidden(); await page.clock.runFor(2000);
    await expect(page.locator('#playing-title')).toHaveText('A'); expect((await playback(page)).loads).toBe(1); await expect(page.locator('#session-count')).toHaveText('1');
    await page.locator('#next').click(); await expect(page.locator('#playing-title')).toHaveText('B'); await expect(page.locator('#session-count')).toHaveText('2');
  });
}

test('deleting the target during a delayed Next file check cannot start or log the removed recording', async ({ page }) => {
  await bootstrap(page, { tracks: [video('a', 0), video('b', 1), { id: 'local', source: 'local', title: 'Removed next recording', duration: 10 }], groups: [group('t', ['a', 'local', 'b'])] });
  await saveLocalAudio(page); await start(page); const before = await playback(page); await delayFileReads(page);
  await page.locator('#next').click(); await expect.poll(() => page.evaluate(() => pendingFileReads.length)).toBe(1);
  await nav(page, 'library'); page.once('dialog', dialog => dialog.accept()); await recordingAction(page, 'delete', 'local');
  await expect(page.locator('[data-track=local]')).toHaveCount(0); await page.evaluate(() => releaseFileReads()); await nav(page, 'deck');
  await expect(page.locator('#play-pause')).toBeEnabled(); expect(await playback(page)).toEqual(before);
  await expect(page.locator('.queue-item strong')).toHaveText(['A', 'B']); await expect(page.locator('#session-count')).toHaveText('1');
});
