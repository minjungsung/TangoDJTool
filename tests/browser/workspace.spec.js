import { test, expect } from '@playwright/test';
function wav() {
  const rate = 8000, seconds = 8, length = rate * seconds, buffer = Buffer.alloc(44 + length * 2);
  buffer.write('RIFF'); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVE', 8); buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22); buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write('data', 36); buffer.writeUInt32LE(length * 2, 40);
  for (let i = 0; i < length; i++) buffer.writeInt16LE(Math.round(Math.sin(i * 2 * Math.PI * 440 / rate) * Math.exp(-(i % 4000) / 1000) * 12000), 44 + i * 2);
  return buffer;
}
test('local recordings persist, support editing, analysis, set playback and export', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({ name: 'test-tango.wav', mimeType: 'audio/wav', buffer: wav() });
  await expect(page.locator('#library-count')).toHaveText('1');
  await expect(page.locator('#notice')).toContainText('1 recording added');
  await page.getByRole('button', { name: 'Edit test-tango', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('Evening tango');
  await page.getByLabel('Orchestra / artist').fill('Test orchestra');
  await page.getByLabel('Style', { exact: true }).selectOption('Tango');
  await page.getByRole('button', { name: 'Save details' }).click();
  await page.getByRole('button', { name: 'Analyze Evening tango', exact: true }).click();
  await expect(page.locator('#notice')).toContainText('1 tracks analyzed', { timeout: 20000 });
  await page.getByRole('button', { name: '+ Tanda', exact: true }).click();
  await page.getByRole('button', { name: 'Add Evening tango to selected group', exact: true }).click();
  await expect(page.locator('.group li')).toHaveCount(1);
  await page.getByRole('button', { name: '+ Cortina', exact: true }).click();
  await page.getByRole('button', { name: 'Add Evening tango to selected group', exact: true }).click();
  await page.locator('#fade').selectOption('0');
  await page.getByRole('button', { name: 'Load & play set' }).click();
  await expect(page.locator('#playing-title')).toHaveText('Evening tango');
  await expect(page.locator('#position')).not.toHaveText('0:00 / 0:00');
  await expect(page.locator('#queue-count')).toHaveText('2');
  await page.getByRole('button', { name: 'Next track', exact: true }).click();
  await expect(page.locator('#playing-group')).toHaveText('Cortina 1');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export set' }).click();
  const artifact = await download; expect(artifact.suggestedFilename()).toBe('tango-dj-set.json');
  const stream = await artifact.createReadStream(); const chunks = []; for await (const chunk of stream) chunks.push(chunk);
  const exported = JSON.parse(Buffer.concat(chunks).toString());
  expect(exported.groups).toHaveLength(2); expect(exported.tracks[0].rmsDb).toBeLessThan(0);
  await page.reload();
  await expect(page.locator('#library-count')).toHaveText('1');
  await expect(page.locator('.missing')).toHaveCount(0);
  await expect(page.locator('.group li')).toHaveCount(2);
  expect(errors).toEqual([]);
});
test('YouTube import and missing-file recovery work without external services', async ({ page }) => {
  await page.route('https://www.youtube.com/oembed?**', route => route.fulfill({ json: { title: 'Tango video', author_name: 'Test channel' } }));
  await page.goto('/');
  await page.getByLabel('YouTube video URL').fill('https://youtu.be/abcdefghijk');
  await page.getByRole('button', { name: 'Add video', exact: true }).click();
  await expect(page.locator('.track-title')).toHaveText('Tango video');
  await expect(page.getByRole('button', { name: 'Analyze Tango video', exact: true })).toHaveCount(0);
  page.on('dialog', dialog => dialog.accept());
  await page.locator('#set-input').setInputFiles({ name: 'set.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, tracks: [{ id: 'local-a', source: 'local', title: 'Missing recording' }], groups: [{ id: 'tanda-a', name: 'Tanda 1', kind: 'tanda', trackIds: ['local-a'] }] })) });
  await expect(page.locator('.missing')).toHaveText('File needed');
  await page.locator('[data-action="relink"]').click();
  await page.locator('#relink-input').setInputFiles({ name: 'relinked.wav', mimeType: 'audio/wav', buffer: wav() });
  await expect(page.locator('.missing')).toHaveCount(0);
  await page.getByRole('button', { name: 'Play Missing recording', exact: true }).click();
  await expect(page.locator('#playing-title')).toHaveText('Missing recording');
});
test('mobile workspace fits the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.getByRole('button', { name: '+ Local files', exact: true })).toBeVisible();
});
test('YouTube queue uses the iframe API and advances after the video ends', async ({ page }) => {
  await page.addInitScript(() => {
    window.YT = { Player: class {
      constructor(id, options) {
        this.options = options; this.position = 0; this.state = 1;
        window.testYouTube = this;
        const iframe = document.createElement('iframe'); iframe.title = 'YouTube test player';
        document.getElementById(id).replaceWith(iframe);
        setTimeout(() => options.events.onReady(), 0);
      }
      loadVideoById(id) { this.videoId = id; this.state = 1; }
      getCurrentTime() { return this.position; }
      getDuration() { return 120; }
      getPlayerState() { return this.state; }
      setVolume(value) { this.volume = value; }
      playVideo() { this.state = 1; }
      pauseVideo() { this.state = 2; }
      seekTo(value) { this.position = value; }
    } };
  });
  await page.route('https://www.youtube.com/oembed?**', route => route.fulfill({ json: { title: 'Video tanda', author_name: 'Test channel' } }));
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({ name: 'cortina.wav', mimeType: 'audio/wav', buffer: wav() });
  await expect(page.locator('#notice')).toContainText('1 recording added');
  await page.getByLabel('YouTube video URL').fill('https://youtu.be/abcdefghijk');
  await page.getByRole('button', { name: 'Add video', exact: true }).click();
  await expect(page.locator('.track-title').last()).toHaveText('Video tanda');
  await page.getByRole('button', { name: '+ Tanda', exact: true }).click();
  await page.getByRole('button', { name: 'Add Video tanda to selected group', exact: true }).click();
  await page.getByRole('button', { name: '+ Cortina', exact: true }).click();
  await page.getByRole('button', { name: 'Add cortina to selected group', exact: true }).click();
  await page.locator('#fade').selectOption('0');
  await page.getByRole('button', { name: 'Load & play set' }).click();
  await expect(page.locator('#playing-title')).toHaveText('Video tanda');
  expect(await page.evaluate(() => window.testYouTube.videoId)).toBe('abcdefghijk');
  await expect(page.locator('#youtube-wrap')).toBeVisible();
  await page.locator('#seek').fill('50');
  expect(await page.evaluate(() => window.testYouTube.position)).toBe(60);
  await page.evaluate(() => { window.testYouTube.options.events.onStateChange({ data: 1 }); window.testYouTube.state = 0; window.testYouTube.options.events.onStateChange({ data: 0 }); });
  await expect(page.locator('#playing-title')).toHaveText('cortina');
  await expect(page.locator('#youtube-wrap')).toBeHidden();
});
test('milonga playlist preserves personal music and does not duplicate entries', async ({ page }) => {
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({ name: 'my-recording.wav', mimeType: 'audio/wav', buffer: wav() });
  await expect(page.locator('#notice')).toContainText('1 recording added');
  await page.locator('#open-examples').click();
  await page.locator('#load-real-samples').click();
  await expect(page.locator('#library-count')).toHaveText('29');
  await expect(page.locator('.group')).toHaveCount(12);
  await page.locator('#open-examples').click();
  await page.locator('#load-real-samples').click();
  await expect(page.locator('#library-count')).toHaveText('29');
  await expect(page.locator('.group')).toHaveCount(12);
  await page.locator('#open-guide').click();
  await page.locator('#real-sample-edit').click();
  await page.getByRole('button', { name: 'Save details' }).click();
  await page.locator('#open-guide').click();
  await page.locator('#guide-preview').click();
  await expect(page.locator('#preview-status')).toBeVisible();
  await page.getByRole('button', { name: 'Stop preview', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.locator('#export-set').click();
  expect((await download).suggestedFilename()).toBe('tango-dj-set.json');
  await page.reload();
  await expect(page.locator('#library-count')).toHaveText('29');
  await expect(page.locator('.missing')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('synthesized');
});
test('practice entry link opens populated local and YouTube examples without autoplay', async ({ page }) => {
  await page.goto('/?practice=1');
  await expect(page.locator('#library-count')).toHaveText('28');
  await expect(page.locator('.group')).toHaveCount(12);
  await expect(page.locator('#playing-title')).toHaveText('No recording loaded');
  await page.reload();
  await expect(page.locator('#library-count')).toHaveText('28');
  await expect(page.locator('.group')).toHaveCount(12);
});
test('real sample cortina advances at its 20-second limit', async ({ page }) => {
  await page.addInitScript(() => {
    window.YT = { Player: class {
      constructor(id, options) { this.position = 0; window.testYouTube = this; setTimeout(() => options.events.onReady(), 0); }
      loadVideoById(id) { this.videoId = id; this.position = 0; }
      getCurrentTime() { return this.position; }
      getDuration() { return 180; }
      setVolume() {} pauseVideo() {} playVideo() {} getPlayerState() { return 1; }
    } };
  });
  await page.goto('/?practice=1');
  await expect(page.locator('#library-count')).toHaveText('28');
  await page.locator('#open-examples').click();
  await page.locator('#real-sample-play').click();
  await expect(page.locator('#playing-title')).toHaveText('Yo soy el tango');
  await expect(page.locator('#queue-count')).toHaveText('28');
  await page.locator('[data-queue-index="4"]').click();
  await expect(page.locator('#playing-title')).toHaveText('L-O-V-E');
  await page.evaluate(() => { window.testYouTube.position = 20.1; });
  await expect(page.locator('#playing-title')).toHaveText('Poema');
});
test('language, playback preferences, edited tandas and queue survive reload per browser', async ({ page, browser }) => {
  await page.goto('/?practice=1');
  await page.locator('#open-settings').click();
  await page.locator('#language').selectOption('ko');
  await page.locator('[data-close="settings-dialog"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
  await expect(page.locator('#load-real-samples')).toHaveText('밀롱가 목록 불러오기');
  await page.locator('#volume').fill('42'); await page.locator('#volume').dispatchEvent('change');
  await page.locator('#fade').selectOption('4'); await page.locator('#auto-next').uncheck();

  await page.locator('#file-input').setInputFiles({ name: 'personal.wav', mimeType: 'audio/wav', buffer: wav() });
  await expect(page.locator('#library-count')).toHaveText('29');
  await page.locator('[data-action="play"]').last().click();
  await expect(page.locator('#playing-title')).toHaveText('personal');
  page.on('dialog', dialog => dialog.accept());
  await page.locator('[data-group-action="delete"]').first().click();
  await expect(page.locator('.group')).toHaveCount(11);
  await expect(page.locator('#save-status')).toHaveText('이 브라우저에 저장됨');
  await page.goto('/');
  await expect(page.locator('#language')).toHaveValue('ko');
  await expect(page.locator('#volume')).toHaveValue('42');
  await expect(page.locator('#fade')).toHaveValue('4');
  await expect(page.locator('#auto-next')).not.toBeChecked();
  await expect(page.locator('#guide-dialog')).not.toBeVisible();
  await expect(page.locator('.group')).toHaveCount(11);
  await expect(page.locator('#queue-count')).toHaveText('1');
  await expect(page.locator('#playing-title')).toHaveText('재생 중인 곡 없음');
  await page.locator('#open-settings').click();
  await page.locator('#language').selectOption('es');
  await page.locator('[data-close="settings-dialog"]').click();
  await expect(page.locator('#import-set')).toHaveText('Importar sesión');
  await expect(page.locator('#start-set')).toContainText('Cargar y reproducir');
  const context = await browser.newContext(); const other = await context.newPage(); await other.goto('/');
  await expect(other.locator('#library-count')).toHaveText('0'); await context.close();
});
test('YouTube errors expose recovery and a replacement link is saved', async ({ page }) => {
  await page.addInitScript(() => {
    window.YT = { Player: class {
      constructor(id, options) { this.options = options; window.testYouTube = this; setTimeout(() => options.events.onReady(), 0); }
      loadVideoById(id) { this.videoId = id; setTimeout(() => this.options.events.onError({ data: 150 }), 20); }
      getCurrentTime() { return 0; } getDuration() { return 180; } setVolume() {} pauseVideo() {}
    } };
  });
  await page.goto('/?practice=1');
  await page.locator('#open-examples').click();
  await page.locator('#real-sample-play').click();
  await expect(page.locator('#youtube-error')).toBeVisible();
  await expect(page.locator('#youtube-error-message')).toContainText('blocked embedded playback');
  await expect(page.locator('#youtube-open')).toHaveAttribute('href', /c9UaO1KQwpI/);
  await page.locator('#youtube-replace').click();
  await page.locator('[name="videoUrl"]').fill('https://youtu.be/abcdefghijk');
  await page.locator('#metadata-form button[type="submit"]').click();
  await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
  await page.goto('/');
  await page.locator('[data-action="edit"][data-id="real-tango-1"]').click();
  await expect(page.locator('[name="videoUrl"]')).toHaveValue('https://www.youtube.com/watch?v=abcdefghijk');
});
test('numeric loopback workspace migrates audio and preferences to localhost', async ({ page, baseURL }) => {
  await page.goto('/');
  const numericURL = baseURL.replace('localhost', '127.0.0.1');
  // Populate the old origin directly, as an existing installation would have done.
  await page.route(numericURL + '/legacy', route => route.fulfill({ contentType: 'text/html', body: '<html><body>Legacy workspace</body></html>' }));
  await page.goto(numericURL + '/legacy');
  await page.evaluate(async () => {
    const storage = await import('/src/storage.js');
    await storage.saveFile('legacy-track', new Blob(['preserved audio'], { type: 'audio/wav' }));
    await storage.saveState({ tracks: [{ id: 'legacy-track', source: 'local', title: 'My tango' }], groups: [] });
    localStorage.setItem('studio-language', 'es');
  });
  await page.goto(numericURL + '/');
  await page.waitForURL(baseURL + '/');
  await expect(page.locator('#library-count')).toHaveText('1');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.locator('.missing')).toHaveCount(0);
  expect(await page.evaluate(async () => (await (await import('/src/storage.js')).getFile('legacy-track')).text())).toBe('preserved audio');
});
