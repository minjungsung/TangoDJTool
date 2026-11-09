import { test, expect, recordingAction } from './saved-workspace.js';

async function nav(page, view) { await expect(page.locator('.workspace-title')).toBeVisible(); const button = page.locator(`button[data-view="${view}"]`); if (await button.isVisible()) await button.click(); else await page.locator(`.sidebar a[href="#${view}"]`).click(); }

async function setup(page) {
  await page.addInitScript(() => {
    localStorage.setItem('studio-language', 'en');
    window.YT = { Player: class {
      constructor(id, options) { this.options = options; this.state = 2; this.position = 0; this.duration = 180; this.loads = 0; window.testYT = this; setTimeout(() => options.events.onReady(), 0); }
      loadVideoById(value) { this.id = typeof value === 'string' ? value : value.videoId; this.position = typeof value === 'string' ? 0 : value.startSeconds || 0; this.state = 1; this.loads++; this.options.events.onStateChange({ data: 1 }); }
      getPlayerState() { return this.state; } getCurrentTime() { return this.position; } getDuration() { return this.duration; } getVideoUrl() { return `https://www.youtube.com/watch?v=${this.id}`; }
      pauseVideo() { this.state = 2; this.options.events.onStateChange({ data: 2 }); } playVideo() { this.state = 1; this.options.events.onStateChange({ data: 1 }); } setVolume() {} seekTo(value) { this.position = value; }
    } };
  });
  await page.goto('/');
  await page.evaluate(async () => {
    const { loadState, saveState } = await import('/src/storage.js');
    const saved = await loadState();
    await saveState({ tracks: [{ id: 'a', title: 'Old tango', artist: 'Orchestra', singer: 'Singer', source: 'youtube', videoId: 'abcdefghijk', duration: 180 }, { id: 'b', title: 'Second tango', source: 'youtube', videoId: 'abcdefghijl', duration: 180 }], groups: [{ id: 't', name: 'First tanda', kind: 'tanda', trackIds: ['a', 'b'], collapsed: false }] }, saved.revision);
  });
  await page.reload(); await expect(page.locator('#library-count')).toHaveText('2');
}

test('multi-step Undo/Redo restores metadata and composition while live music keeps its position', async ({ page }) => {
  await setup(page); await nav(page, 'set'); await page.locator('#start-set').click();
  await expect(page.locator('#playing-title')).toHaveText('Old tango');
  await page.evaluate(() => { testYT.position = 42; });
  const before = await page.evaluate(() => ({ loads: testYT.loads, position: testYT.position }));
  await nav(page, 'library');
  await recordingAction(page, 'edit', 'a');
  await page.locator('#metadata-form [name=title]').fill('Corrected title'); await page.locator('#metadata-form [type=submit]').click();
  await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
  await nav(page, 'set'); await page.locator('#add-tanda').click(); await expect(page.locator('#groups .group')).toHaveCount(2);
  await nav(page, 'deck'); await page.locator('#live-mode').check();
  await nav(page, 'set');
  await page.locator('#undo-set').click(); await expect(page.locator('#groups .group')).toHaveCount(1);
  await page.locator('#undo-set').click(); await nav(page, 'library'); await expect(page.locator('#tracks [data-track=a] .track-title')).toHaveText('Old tango');
  await page.locator('#redo-set').click(); await expect(page.locator('#tracks [data-track=a] .track-title')).toHaveText('Corrected title');
  expect(await page.evaluate(() => ({ loads: testYT.loads, position: testYT.position }))).toEqual(before);
  await page.reload(); await expect(page.locator('#undo-bar')).toBeHidden();
});

test('deadline review and clearing preserve playback and expose unknown waits', async ({ page }) => {
  await setup(page); await nav(page, 'set'); await page.locator('#start-set').click();
  await expect(page.locator('#playing-title')).toHaveText('Old tango');
  await nav(page, 'set'); await page.locator('.event-tools summary').click();
  const deadline = await page.evaluate(() => { const date = new Date(Date.now() + 900000); const pad = value => String(value).padStart(2, '0'); return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`; });
  await page.locator('#event-deadline').fill(deadline); await page.locator('#event-deadline').dispatchEvent('change');
  await expect(page.locator('#deadline-status')).toContainText('Known runtime');
  const before = await page.evaluate(() => testYT.loads);
  await page.locator('#review-final-tanda').click(); await expect(page.locator('#final-tanda-status')).toContainText('Reviewed final tanda');
  expect(await page.evaluate(() => testYT.loads)).toBe(before);
  await page.locator('#clear-deadline').click(); await expect(page.locator('#deadline-status')).toHaveText('No deadline selected.');
});

test('readable rundown download contains the full portable plan', async ({ page }) => {
  await setup(page); await nav(page, 'set'); await page.locator('.event-tools summary').click();
  const downloadPromise = page.waitForEvent('download'); await page.locator('#export-rundown').click();
  const download = await downloadPromise; expect(download.suggestedFilename()).toBe('tango-dj-event-rundown.html');
  const stream = await download.createReadStream(); const chunks = []; for await (const chunk of stream) chunks.push(chunk);
  const html = Buffer.concat(chunks).toString(); expect(html).toContain('First tanda'); expect(html).toContain('Orchestra'); expect(html).toContain('Singer'); expect(html).toContain('Source cues'); expect(html).toContain('Unknown lengths'); expect(html).toContain('https://www.youtube.com/watch?v=abcdefghijk');
});

test('a known-hash relink cannot overwrite metadata edited while source verification is pending', async ({ page }) => {
  await setup(page);
  const bytes = Buffer.from('verified recording bytes');
  await page.evaluate(async audio => {
    const blob = new Blob([new Uint8Array(audio)], { type: 'audio/wav' });
    const { loadState, saveState, saveFile } = await import('/src/storage.js');
    const { streamHash } = await import('/src/stream-hash.js');
    const saved = await loadState(); const track = { id: 'local', source: 'local', title: 'Original title', contentHash: await streamHash(blob) };
    saved.tracks.push(track); await saveFile(track.id, blob); await saveState(saved, saved.revision);
  }, [...bytes]);
  await page.reload(); await expect(page.locator('#library-count')).toHaveText('3');
  await page.evaluate(() => {
    window.showOpenFilePicker = undefined;
    const NativeWorker = Worker;
    window.Worker = class {
      constructor(url, options) { this.worker = new NativeWorker(url, options); this.worker.onmessage = event => { window.releaseRelinkHash = () => this.onmessage?.(event); }; this.worker.onerror = event => this.onerror?.(event); }
      postMessage(value) { this.worker.postMessage(value); } terminate() { this.worker.terminate(); }
    };
  });
  const choosing = page.waitForEvent('filechooser'); await recordingAction(page, 'locate', 'local');
  await (await choosing).setFiles({ name: 'identical.wav', mimeType: 'audio/wav', buffer: bytes });
  await expect.poll(() => page.evaluate(() => typeof window.releaseRelinkHash)).toBe('function');
  await recordingAction(page, 'edit', 'local'); await page.locator('#metadata-form [name=title]').fill('Latest title'); await page.locator('#metadata-form [type=submit]').click();
  await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
  await page.evaluate(() => releaseRelinkHash());
  await expect(page.locator('#notice-message')).toContainText('Review the source again');
  const saved = await page.evaluate(async () => (await import('/src/storage.js')).loadState());
  expect(saved.tracks.find(track => track.id === 'local').title).toBe('Latest title');
  await expect(page.locator('#tracks [data-track=local] .track-title')).toHaveText('Latest title');
});

test('deadline review uses the restored queue position and excludes past tandas', async ({ page }) => {
  await setup(page);
  await page.evaluate(async () => {
    const { loadState, saveState } = await import('/src/storage.js');
    const { flattenSet } = await import('/src/model.js');
    const saved = await loadState();
    saved.groups = [{ id: 'past-1', name: 'Past first', kind: 'tanda', trackIds: ['a'] }, { id: 'past-2', name: 'Past second', kind: 'tanda', trackIds: ['b'] }, { id: 'remaining', name: 'Remaining tanda', kind: 'tanda', trackIds: ['a'] }];
    saved.queue = flattenSet(saved.groups, saved.tracks).map(({ track, ...clip }) => ({ ...clip, trackId: track.id }));
    saved.queueIndex = 2; saved.resumePosition = 60;
    await saveState(saved, saved.revision);
  });
  await page.reload(); await nav(page, 'set'); await page.locator('.event-tools summary').click();
  const deadline = await page.evaluate(() => { const date = new Date(Date.now() + 900000); const pad = value => String(value).padStart(2, '0'); return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`; });
  await page.locator('#event-deadline').fill(deadline); await page.locator('#event-deadline').dispatchEvent('change');
  await expect(page.locator('#deadline-status')).toContainText('Known runtime: 2:00');
  await expect(page.locator('#final-tanda option')).toHaveCount(1);
  await expect(page.locator('#final-tanda option')).toContainText('Remaining tanda');
  expect(await page.evaluate(() => window.testYT?.loads || 0)).toBe(0);
});

test('metadata edited during a relink transaction survives source publication and reload', async ({ page }) => {
  await setup(page);
  const bytes = Buffer.from('verified recording bytes');
  await page.evaluate(async audio => {
    const blob = new Blob([new Uint8Array(audio)], { type: 'audio/wav' });
    const { loadState, saveState, saveFile } = await import('/src/storage.js');
    const { streamHash } = await import('/src/stream-hash.js');
    const saved = await loadState(); const track = { id: 'local', source: 'local', title: 'Original title', contentHash: await streamHash(blob) };
    saved.tracks.push(track); await saveFile(track.id, blob); await saveState(saved, saved.revision);
  }, [...bytes]);
  await page.reload(); await expect(page.locator('#library-count')).toHaveText('3');
  await page.evaluate(() => {
    window.showOpenFilePicker = undefined;
    const transaction = IDBDatabase.prototype.transaction;
    const completion = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, 'oncomplete');
    IDBDatabase.prototype.transaction = function (stores, ...args) {
      const tx = transaction.call(this, stores, ...args);
      if (Array.isArray(stores) && stores.includes('state') && stores.includes('sources') && stores.includes('files')) {
        Object.defineProperty(tx, 'oncomplete', { set(handler) { completion.set.call(tx, event => { window.releaseRelinkCommit = () => handler.call(tx, event); }); } });
      }
      return tx;
    };
  });
  const choosing = page.waitForEvent('filechooser'); await recordingAction(page, 'locate', 'local');
  await (await choosing).setFiles({ name: 'identical.wav', mimeType: 'audio/wav', buffer: bytes });
  await expect.poll(() => page.evaluate(() => typeof window.releaseRelinkCommit)).toBe('function');
  await recordingAction(page, 'edit', 'local'); await page.locator('#metadata-form [name=title]').fill('Edited during commit'); await page.locator('#metadata-form [type=submit]').click();
  await page.evaluate(() => releaseRelinkCommit());
  await expect(page.locator('#notice-message')).toContainText('File reconnected');
  await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
  await page.reload(); await expect(page.locator('#tracks [data-track=local] .track-title')).toHaveText('Edited during commit');
  const saved = await page.evaluate(async () => (await import('/src/storage.js')).loadState());
  expect(saved.tracks.find(track => track.id === 'local').fileName).toBe('identical.wav');
});

test('automatic provider duration updates do not consume a composition Undo or move live playback', async ({ page }) => {
  await setup(page); await nav(page, 'set'); await page.locator('#start-set').click();
  await expect(page.locator('#playing-title')).toHaveText('Old tango');
  await page.evaluate(() => { testYT.position = 42; });
  const loads = await page.evaluate(() => testYT.loads);
  await page.locator('[data-group-action=track-down][data-id=t][data-index="0"]').click();
  await expect(page.locator('#groups li').first()).toContainText('Second tango');
  await page.evaluate(() => { testYT.duration = 210; });
  await expect.poll(() => page.evaluate(async () => (await (await import('/src/storage.js')).loadState()).tracks.find(track => track.id === 'a').duration)).toBe(210);
  await expect(page.locator('#edit-history-label')).toContainText('Edit tanda composition');
  await page.locator('#undo-set').click(); await expect(page.locator('#groups li').first()).toContainText('Old tango');
  expect(await page.evaluate(() => ({ loads: testYT.loads, position: testYT.position }))).toEqual({ loads, position: 42 });
  const saved = await page.evaluate(async () => (await import('/src/storage.js')).loadState());
  expect(saved.tracks.find(track => track.id === 'a').duration).toBe(210);
});
