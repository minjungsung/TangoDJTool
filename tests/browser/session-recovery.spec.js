import { test, expect, recordingAction } from './saved-workspace.js';

const storageKey = 'studio-dj-session';

async function bootstrap(page, savedHistory) {
  await page.route('https://**', route => route.abort());
  await page.addInitScript(() => {
    const save = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (window.blockSessionWrites && key === 'studio-dj-session') throw new DOMException('Full', 'QuotaExceededError');
      return save.call(this, key, value);
    };
    window.YT = { Player: class {
      constructor(id, options) { this.options = options; this.state = 2; this.position = 0; this.loads = 0; window.sessionYT = this; setTimeout(() => options.events.onReady(), 0); }
      loadVideoById(value) { this.id = typeof value === 'string' ? value : value.videoId; this.position = typeof value === 'string' ? 0 : value.startSeconds || 0; this.loads++; this.state = 1; this.options.events.onStateChange({ data: 1 }); }
      getCurrentTime() { return this.position; }
      getDuration() { return 180; }
      getPlayerState() { return this.state; }
      getVideoUrl() { return `https://www.youtube.com/watch?v=${this.id}`; }
      setVolume() {}
      pauseVideo() { this.state = 2; this.options.events.onStateChange({ data: 2 }); }
      playVideo() { this.state = 1; this.options.events.onStateChange({ data: 1 }); }
      seekTo(value) { this.position = value; }
    } };
  });
  await page.evaluate(async ({ storageKey, savedHistory }) => {
    localStorage.setItem('studio-language', 'en');
    if (savedHistory !== undefined) localStorage.setItem(storageKey, savedHistory);
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('tango-dj-studio', 1);
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction('state', 'readwrite');
      tx.objectStore('state').put({ tracks: [{ id: 'a', source: 'youtube', videoId: 'abcdefghijk', title: 'Poema', artist: 'Orchestra', style: 'Tango', duration: 180 }], groups: [], revision: 2 }, 'current');
      tx.oncomplete = resolve; tx.onabort = () => reject(tx.error);
    }); db.close();
  }, { storageKey, savedHistory });
  await page.goto('/');
  await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
}

async function deck(page) {
  const button = page.locator('button[data-view="deck"]');
  if (await button.isVisible()) await button.click();
  else await page.locator('.sidebar a[href="#deck"]').click();
}

async function newSession(page, name) {
  const accept = dialog => dialog.accept(dialog.type() === 'prompt' ? name : undefined);
  page.on('dialog', accept);
  try { await page.locator('#new-dj-session').click(); }
  finally { page.off('dialog', accept); }
}

const savedBytes = page => page.evaluate(key => localStorage.getItem(key), storageKey);

test('invalid recovery name preserves corrupt saved history and the previous UI', async ({ page }) => {
  const original = '{preserved-corrupt-history';
  await bootstrap(page, original); await deck(page);
  await newSession(page, 'n'.repeat(301));
  await expect(page.locator('#notice-message')).toContainText('between 1 and 300 characters');
  expect(await savedBytes(page)).toBe(original);
  await expect(page.locator('#session-name')).toHaveText('Not started');
  await expect(page.locator('#session-count')).toHaveText('0');
  await page.locator('#open-session-history').click();
  await expect(page.locator('#session-error')).toContainText('invalid');
});

test('quota failure preserves corrupt history and a successful retry replaces it', async ({ page }) => {
  const original = '{preserved-corrupt-history';
  await bootstrap(page, original); await deck(page);
  await page.evaluate(() => { window.blockSessionWrites = true; });
  await newSession(page, 'Recovered session');
  await expect(page.locator('#notice-message')).toContainText('could not be saved');
  expect(await savedBytes(page)).toBe(original);
  await expect(page.locator('#session-name')).toHaveText('Not started');
  await page.evaluate(() => { window.blockSessionWrites = false; });
  await newSession(page, 'Recovered session');
  await expect(page.locator('#session-name')).toHaveText('Recovered session');
  expect(JSON.parse(await savedBytes(page))).toMatchObject({ name: 'Recovered session', events: [] });
});

test('changing sessions during music excludes ongoing callbacks and logs an explicit new Play', async ({ page }) => {
  await bootstrap(page); await recordingAction(page, 'play', 'a'); await deck(page);
  await expect(page.locator('#session-count')).toHaveText('1');
  await page.evaluate(() => { sessionYT.position = 31; });
  await newSession(page, 'Next session');
  await expect(page.locator('#session-count')).toHaveText('0');
  await page.evaluate(() => { sessionYT.options.events.onStateChange({ data: 1 }); });
  await page.locator('#auto-next').uncheck();
  await page.locator('#play-pause').click(); await page.locator('#play-pause').click();
  await expect(page.locator('#session-count')).toHaveText('0');
  expect(await page.evaluate(() => sessionYT.loads)).toBe(1);
  await page.locator('#stop').click(); await page.locator('#play-pause').click();
  await expect(page.locator('#session-count')).toHaveText('1');
  expect(JSON.parse(await savedBytes(page))).toMatchObject({ name: 'Next session', events: [{ title: 'Poema', position: 0 }] });
  expect(await page.evaluate(() => sessionYT.loads)).toBe(2);
});
