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
  await page.evaluate(() => window.testYouTube.options.events.onStateChange({ data: 0 }));
  await expect(page.locator('#playing-title')).toHaveText('cortina');
  await expect(page.locator('#youtube-wrap')).toBeHidden();
});
test('practice library teaches the full workflow without replacing existing music', async ({ page }) => {
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({ name: 'my-recording.wav', mimeType: 'audio/wav', buffer: wav() });
  await expect(page.locator('#notice')).toContainText('1 recording added');
  await page.getByRole('button', { name: 'Load practice library', exact: true }).click();
  await expect(page.locator('#library-count')).toHaveText('12');
  await expect(page.locator('.group')).toHaveCount(5);
  await expect(page.locator('.group li')).toHaveCount(11);
  await page.getByRole('button', { name: 'Load practice library', exact: true }).click();
  await expect(page.locator('#library-count')).toHaveText('12');
  await expect(page.locator('.group')).toHaveCount(5);
  await page.getByRole('button', { name: 'Edit first practice track', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('My edited practice');
  await page.getByRole('button', { name: 'Save details' }).click();
  await page.getByRole('button', { name: 'Preview first practice track', exact: true }).click();
  await expect(page.locator('#preview-status')).toBeVisible();
  await page.getByRole('button', { name: 'Stop preview', exact: true }).click();
  await page.getByRole('button', { name: 'Analyze practice recordings', exact: true }).click();
  await expect(page.locator('#notice')).toContainText('11 tracks analyzed', { timeout: 20000 });
  await page.getByRole('button', { name: 'Select practice Tango tanda', exact: true }).click();
  await expect(page.locator('[data-group="sample-group-tango"]')).toHaveClass(/selected/);
  await page.locator('#fade').selectOption('0');
  await page.getByRole('button', { name: 'Play practice set', exact: true }).click();
  await expect(page.locator('#playing-title')).toHaveText('My edited practice');
  await expect(page.locator('#queue-count')).toHaveText('11');
  await expect(page.locator('#position')).not.toHaveText('0:00 / 0:00');
  await page.getByRole('button', { name: 'Add YouTube example tanda', exact: true }).click();
  await expect(page.locator('#library-count')).toHaveText('15');
  await expect(page.locator('.group')).toHaveCount(6);
  await page.getByRole('button', { name: 'Add YouTube example tanda', exact: true }).click();
  await expect(page.locator('#library-count')).toHaveText('15');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export my set', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('tango-dj-set.json');
  await expect(page.locator('#practice-progress-text')).toHaveText('8 / 8 tried');
  await page.reload();
  await expect(page.locator('#library-count')).toHaveText('15');
  await expect(page.locator('#practice-progress-text')).toHaveText('8 / 8 tried');
  await expect(page.locator('.missing')).toHaveCount(0);
  await page.getByRole('button', { name: 'Hide walkthrough', exact: true }).click();
  await expect(page.locator('#practice-guide')).toBeHidden();
  await page.getByRole('button', { name: 'Show walkthrough', exact: true }).click();
  await expect(page.locator('#practice-guide')).toBeVisible();
});
test('practice entry link opens populated local and YouTube examples without autoplay', async ({ page }) => {
  await page.goto('/?practice=1');
  await expect(page.locator('#library-count')).toHaveText('14');
  await expect(page.locator('.group')).toHaveCount(6);
  await expect(page.locator('#playing-title')).toHaveText('No recording loaded');
  await page.reload();
  await expect(page.locator('#library-count')).toHaveText('14');
  await expect(page.locator('.group')).toHaveCount(6);
});
