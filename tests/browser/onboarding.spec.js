import { test, expect } from '@playwright/test';

async function provider(page) {
  await page.addInitScript(() => {
    window.YT = { Player: class {
      constructor(id, options) { this.options = options; this.position = 0; this.state = 2; window.onboardingProvider = this; setTimeout(() => options.events.onReady(), 0); }
      loadVideoById(value) { this.id = typeof value === 'string' ? value : value.videoId; this.position = typeof value === 'string' ? 0 : value.startSeconds; this.state = 1; this.options.events.onStateChange({ data: 1 }); }
      getCurrentTime() { return this.position; } getDuration() { return 180; } getPlayerState() { return this.state; }
      getVideoUrl() { return `https://www.youtube.com/watch?v=${this.id}`; } setVolume() {}
      pauseVideo() { this.state = 2; } playVideo() { this.state = 1; } seekTo(value) { this.position = value; }
    } };
  });
}

for (const viewport of [{ width: 390, height: 844 }, { width: 1024, height: 768 }, { width: 1440, height: 900 }]) {
  test(`first visit prepares examples and opens Playback without autoplay at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport); await provider(page);
    await page.goto('/');
    await expect(page.locator('body')).toHaveAttribute('data-view', 'deck');
    await expect(page.locator('#deck')).toBeVisible();
    await expect(page.locator('#library-count')).toHaveText('28');
    await expect(page.locator('#queue-count')).toHaveText('28');
    await expect(page.locator('#groups .group')).toHaveCount(12);
    await expect(page.locator('[data-collection]')).toHaveCount(7);
    await expect(page.locator('#play-pause')).toBeEnabled();
    expect(await page.evaluate(() => window.onboardingProvider)).toBeUndefined();
    await page.locator('#play-pause').click();
    await expect(page.locator('#playing-title')).toHaveText('Yo soy el tango');
    await expect(page.locator('.queue-item.playing')).toHaveAttribute('data-queue-index', '0');
    await page.locator('#next').click();
    await expect(page.locator('#playing-title')).toHaveText('Te aconsejo que me olvides');
    await page.locator('#stop').click();
    await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
    await page.reload();
    await expect(page.locator('#queue-count')).toHaveText('28');
    expect(await page.evaluate(() => window.onboardingProvider)).toBeUndefined();
  });
}

test('clearing examples is retained across reload; first-use defaults do not return', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#library-count')).toHaveText('28');
  const download = page.waitForEvent('download');
  if (await page.locator('#open-menu').isVisible()) await page.locator('#open-menu').click();
  await page.locator('#export-set').click(); expect((await download).suggestedFilename()).toBe('tango-dj-set.json');
  page.on('dialog', dialog => dialog.accept());
  await page.locator('#set-input').setInputFiles({ name: 'empty-set.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, tracks: [], groups: [] })) });
  await expect(page.locator('#library-count')).toHaveText('0');
  await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
  await page.reload();
  await expect(page.locator('#library-count')).toHaveText('0');
  await expect(page.locator('#queue-count')).toHaveText('0');
  await expect(page.locator('[data-collection]')).toHaveCount(0);
});

test('database failure still starts with playable examples and explicit temporary storage', async ({ page }) => {
  await provider(page);
  await page.addInitScript(() => { Object.defineProperty(window, 'indexedDB', { configurable: true, value: { open() { throw new DOMException('Storage disabled', 'SecurityError'); } } }); });
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-view', 'deck');
  await expect(page.locator('#queue-count')).toHaveText('28');
  await expect(page.locator('#storage-recovery')).toBeVisible();
  await expect(page.locator('#save-status')).toHaveText('Temporary · not saved');
  await page.locator('#play-pause').click();
  await expect(page.locator('#playing-title')).toHaveText('Yo soy el tango');
});


test('curated candidate sets contain valid recordings, survive deletion, and can be explicitly restored', async ({ page }) => {
  await page.goto('/');
  const navigate = async area => {
    const button = page.locator(`button[data-view="${area}"]`);
    if (await button.isVisible()) await button.click(); else await page.locator(`.sidebar a[href="#${area}"]`).click();
  };
  await navigate('collections');
  await expect(page.locator('[data-collection]')).toHaveCount(7);
  const saved = await page.evaluate(async () => {
    const db = await new Promise(resolve => { const request=indexedDB.open('tango-dj-studio',2); request.onsuccess=()=>resolve(request.result); });
    const state=await new Promise(resolve => { const request=db.transaction('state').objectStore('state').get('current'); request.onsuccess=()=>resolve(request.result); }); db.close(); return state;
  });
  expect(saved.collections.map(set=>set.trackIds.length)).toEqual([4,4,3,4,4,3,6]);
  for (const set of saved.collections) for (const id of set.trackIds) expect(saved.tracks.some(track=>track.id===id)).toBeTruthy();
  await page.locator('[data-collection="real-set-tango"]').click();
  await expect(page.locator('[data-candidate]')).toHaveCount(4);
  for (const checkbox of await page.locator('[data-candidate]').all()) await checkbox.check();
  await page.locator('#collection-tanda').click();
  await expect(page.locator('#groups .group')).toHaveCount(13);
  await navigate('collections'); page.once('dialog',dialog=>dialog.accept());
  await page.locator('[data-collection-delete="real-set-tango"]').click();
  await expect(page.locator('#save-status')).toHaveText('Saved in this browser'); await page.reload();
  await expect(page.locator('[data-collection]')).toHaveCount(6);
  await page.locator('#open-examples').click(); await page.locator('#load-real-samples').click();
  await expect(page.locator('[data-collection]')).toHaveCount(7);
  await expect(page.locator('#groups .group')).toHaveCount(13);
});
