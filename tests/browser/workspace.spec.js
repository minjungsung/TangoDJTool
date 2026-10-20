import { test, expect, recordingAction, prepareSavedWorkspace } from './saved-workspace.js';

async function view(page, area) {
  await page.locator('button[data-view]').first().waitFor({ state: 'attached' });
  const button = page.locator(`button[data-view="${area}"]`);
  if (await button.isVisible()) await button.click();
  else await page.locator(`.sidebar .nav[href="#${area}"]`).click();
}
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
  await view(page, 'library'); await recordingAction(page, 'edit');
  await page.getByLabel('Title', { exact: true }).fill('Evening tango');
  await page.getByLabel('Orchestra / artist').fill('Test orchestra');
  await page.getByLabel('Style', { exact: true }).selectOption('Tango');
  await page.getByRole('button', { name: 'Save details' }).click();
  await view(page, 'library'); await recordingAction(page, 'analyze');
  await expect(page.locator('#notice')).toContainText('1 tracks analyzed', { timeout: 20000 });
  await view(page, 'set'); await page.getByRole('button', { name: '+ Tanda', exact: true }).click();
  await view(page, 'library'); await page.getByRole('button', { name: 'Add Evening tango to selected group', exact: true }).click();
  await expect(page.locator('.group li')).toHaveCount(1);
  await view(page, 'set'); await page.getByRole('button', { name: '+ Cortina', exact: true }).click();
  await view(page, 'library'); await page.getByRole('button', { name: 'Add Evening tango to selected group', exact: true }).click();
  await view(page, 'deck'); await page.locator('#fade').selectOption('0');
  await view(page, 'set'); await page.getByRole('button', { name: 'Load & play set' }).click();
  await expect(page.locator('#playing-title')).toHaveText('Evening tango');
  await expect(page.locator('#position')).not.toHaveText('0:00 / 0:00');
  await expect(page.locator('#queue-count')).toHaveText('2');
  await view(page, 'deck'); await page.locator('#next').click();
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

test('an exported mixed set transfers to another browser with cues, holds and local-file recovery', async ({ page, browser }) => {
  const downloadSet = async target => {
    const pending = target.waitForEvent('download'); await target.locator('#export-set').click();
    const artifact = await pending, stream = await artifact.createReadStream(), chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
  };
  await page.goto('/?practice=1');
  await page.locator('#file-input').setInputFiles({ name: 'transfer-tango.wav', mimeType: 'audio/wav', buffer: wav() });
  await expect(page.locator('#library-count')).toHaveText('29');
  await view(page, 'set'); await page.locator('#add-tanda').click();
  await view(page, 'library'); await page.getByRole('button', { name: 'Add transfer-tango to selected group', exact: true }).click();
  await view(page, 'set'); await page.locator('[data-cortina-start]').first().fill('35'); await view(page, 'set'); await page.locator('[data-cortina-start]').first().dispatchEvent('change');
  await view(page, 'set'); await page.locator('[data-cortina-end]').first().fill('50'); await view(page, 'set'); await page.locator('[data-cortina-end]').first().dispatchEvent('change');
  await view(page, 'set'); await page.locator('[data-cortina-hold]').first().check();
  await view(page, 'set'); await page.locator('[data-group-action="track-down"][data-id="real-group-tango"][data-index="0"]').click();
  const exported = await downloadSet(page), original = JSON.parse(exported);
  expect(original.groups[0].trackIds.slice(0, 2)).toEqual(['real-tango-2', 'real-tango-1']);
  expect(original.groups[1]).toMatchObject({ startSeconds: 35, limitSeconds: 15, holdAfter: true });
  const context = await browser.newContext(), other = await context.newPage();
  try {
    await prepareSavedWorkspace(other); await other.goto('/'); await expect(other.locator('#library-count')).toHaveText('0');
    other.on('dialog', dialog => dialog.accept());
    await other.locator('#set-input').setInputFiles({ name: 'exported-set.json', mimeType: 'application/json', buffer: exported });
    await expect(other.locator('#library-count')).toHaveText('29'); await expect(other.locator('.group')).toHaveCount(13);
    await expect(other.locator('[data-cortina-start]').first()).toHaveValue('35');
    await expect(other.locator('[data-cortina-end]').first()).toHaveValue('50');
    await expect(other.locator('[data-cortina-hold]').first()).toBeChecked();
    await expect(other.locator('.missing')).toHaveCount(1);
    expect(JSON.parse(await downloadSet(other))).toEqual(original);
    const local = original.tracks.find(track => track.source === 'local');
    await view(other, 'library'); await recordingAction(other, 'relink', local.id);
    await other.locator('#relink-input').setInputFiles({ name: 'transfer-tango.wav', mimeType: 'audio/wav', buffer: wav() });
    await expect(other.locator('.missing')).toHaveCount(0);
    await view(other, 'library'); await other.locator(`[data-action="play"][data-id="${local.id}"]`).click();
    await expect(other.locator('#playing-title')).toHaveText('transfer-tango');
    await expect(other.locator('#position')).toHaveText(/^0:0[1-7] \/ 0:08$/);
    await expect(other.locator('#save-status')).toHaveText('Saved in this browser');
    await other.reload(); await expect(other.locator('.missing')).toHaveCount(0);
    await expect(other.locator('[data-cortina-start]').first()).toHaveValue('35');
    await expect(other.locator('[data-cortina-hold]').first()).toBeChecked();
    await expect(page.locator('#library-count')).toHaveText('29');
  } finally { await context.close(); }
});

test('canceling or rejecting a set import preserves the current library and saved audio', async ({ page }) => {
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({ name: 'kept-tango.wav', mimeType: 'audio/wav', buffer: wav() });
  await expect(page.locator('#library-count')).toHaveText('1');
  await view(page, 'set'); await page.locator('#add-tanda').click(); await view(page, 'library'); await page.locator('[data-action="add"]').click();
  await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
  page.on('dialog', dialog => dialog.dismiss());
  await page.locator('#set-input').setInputFiles({ name: 'replacement.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, tracks: [], groups: [] })) });
  await expect(page.locator('#library-count')).toHaveText('1');
  await page.locator('#set-input').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{ invalid json') });
  await expect(page.locator('#notice')).toContainText('Import failed');
  await expect(page.locator('.group li')).toHaveCount(1);
  await page.reload(); await expect(page.locator('.missing')).toHaveCount(0);
  await view(page, 'library'); await page.locator('[data-action="play"]').click(); await expect(page.locator('#playing-title')).toHaveText('kept-tango');
  await expect(page.locator('#position')).toHaveText(/^0:0[1-7] \/ 0:08$/);
});
test('YouTube import and missing-file recovery work without external services', async ({ page }) => {
  await page.route('https://www.youtube.com/oembed?**', route => route.fulfill({ json: { title: 'Tango video', author_name: 'Test channel' } }));
  await page.goto('/');
  await page.getByLabel('YouTube video URL').fill('https://youtu.be/abcdefghijk');
  await view(page, 'library'); await page.getByRole('button', { name: 'Add video', exact: true }).click();
  await expect(page.locator('.track-title')).toHaveText('Tango video');
  await expect(page.getByRole('button', { name: 'Analyze Tango video', exact: true })).toHaveCount(0);
  page.on('dialog', dialog => dialog.accept());
  await page.locator('#set-input').setInputFiles({ name: 'set.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, tracks: [{ id: 'local-a', source: 'local', title: 'Missing recording' }], groups: [{ id: 'tanda-a', name: 'Tanda 1', kind: 'tanda', trackIds: ['local-a'] }] })) });
  await expect(page.locator('.missing')).toHaveText('File missing');
  await view(page, 'library'); await recordingAction(page, 'relink');
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
  await view(page, 'library'); await page.getByRole('button', { name: 'Add video', exact: true }).click();
  await expect(page.locator('.track-title').last()).toHaveText('Video tanda');
  await view(page, 'set'); await page.getByRole('button', { name: '+ Tanda', exact: true }).click();
  await view(page, 'library'); await page.getByRole('button', { name: 'Add Video tanda to selected group', exact: true }).click();
  await view(page, 'set'); await page.getByRole('button', { name: '+ Cortina', exact: true }).click();
  await view(page, 'library'); await page.getByRole('button', { name: 'Add cortina to selected group', exact: true }).click();
  await view(page, 'deck'); await page.locator('#fade').selectOption('0');
  await view(page, 'set'); await page.getByRole('button', { name: 'Load & play set' }).click();
  await expect(page.locator('#playing-title')).toHaveText('Video tanda');
  expect(await page.evaluate(() => window.testYouTube.videoId)).toBe('abcdefghijk');
  await expect(page.locator('#youtube-wrap')).toBeVisible();
  await view(page, 'deck'); await page.locator('#seek').fill('50');
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
  await view(page, 'deck'); await page.locator('[data-queue-index="4"]').click();
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
  await view(page, 'deck'); await page.locator('#volume').fill('42'); await view(page, 'deck'); await page.locator('#volume').dispatchEvent('change');
  await view(page, 'deck'); await page.locator('#fade').selectOption('4'); await view(page, 'deck'); await page.locator('#auto-next').uncheck();

  await page.locator('#file-input').setInputFiles({ name: 'personal.wav', mimeType: 'audio/wav', buffer: wav() });
  await expect(page.locator('#library-count')).toHaveText('29');
  await view(page, 'library'); await page.locator('[data-action="play"]').last().click();
  await expect(page.locator('#playing-title')).toHaveText('personal');
  page.on('dialog', dialog => dialog.accept());
  await view(page, 'set'); await page.locator('[data-group-action="delete"]').first().click();
  await expect(page.locator('.group')).toHaveCount(10);
  await expect(page.locator('#save-status')).toHaveText('이 브라우저에 저장됨');
  await page.goto('/');
  await expect(page.locator('#language')).toHaveValue('ko');
  await expect(page.locator('#volume')).toHaveValue('42');
  await expect(page.locator('#fade')).toHaveValue('4');
  await expect(page.locator('#auto-next')).not.toBeChecked();
  await expect(page.locator('#guide-dialog')).not.toBeVisible();
  await expect(page.locator('.group')).toHaveCount(10);
  await expect(page.locator('#queue-count')).toHaveText('1');
  await expect(page.locator('#playing-title')).toHaveText('재생 중인 곡 없음');
  await page.locator('#open-settings').click();
  await page.locator('#language').selectOption('es');
  await page.locator('[data-close="settings-dialog"]').click();
  await expect(page.locator('#import-set')).toHaveText('Importar sesión');
  await expect(page.locator('#start-set')).toContainText('Cargar y reproducir');
  const context = await browser.newContext(); const other = await context.newPage(); await prepareSavedWorkspace(other); await other.goto('/');
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
  await view(page, 'library'); await recordingAction(page, 'edit', 'real-tango-1');
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
test('DJ edits preserve queue, can be undone, and resume the last track after reload', async ({ page }) => {
  await page.addInitScript(() => {
    window.YT = { Player: class {
      constructor(id, options) { this.state = 2; window.testYouTube = this; setTimeout(() => options.events.onReady(), 0); }
      loadVideoById(id) { this.videoId = id; this.state = 1; }
      getCurrentTime() { return 0; } getDuration() { return 180; } getPlayerState() { return this.state; }
      setVolume() {} pauseVideo() { this.state = 2; } playVideo() { this.state = 1; }
    } };
  });
  await page.goto('/?practice=1');
  await expect(page.locator('#set-duration')).toHaveText('2:00');
  await view(page, 'set'); await page.locator('#start-set').click();
  await expect(page.locator('#queue-count')).toHaveText('28');
  await view(page, 'library'); await page.locator('[data-action="play"][data-id="real-vals-1"]').click();
  await expect(page.locator('#playing-title')).toHaveText('Cofrecito');
  await expect(page.locator('#queue-count')).toHaveText('28');
  await expect(page.locator('#play-pause')).toHaveText('Ⅱ');
  await view(page, 'deck'); await page.locator('#play-pause').click();
  await expect(page.locator('#play-pause')).toHaveText('▶');
  await view(page, 'set'); await page.locator('[data-group-action=select][data-id=real-group-cortina-6]').click(); await page.locator('#add-cortina').click();
  await expect(page.locator('[data-cortina-full]').last()).toBeChecked(); await expect(page.locator('[data-cortina-end]').last()).toBeDisabled();
  await view(page, 'library'); await page.locator('[data-action="add"][data-id="real-cortina-1"]').click();
  await expect(page.locator('#selected-group')).toContainText('Cortina 7');
  await view(page, 'set'); await expect(page.locator('#queue-stale')).toBeVisible();
  await page.locator('#undo-set').click();
  await expect(page.locator('.group').last().locator('li')).toHaveCount(0);
  await view(page, 'set'); await page.locator('[data-cortina-end]').first().fill('30');
  await view(page, 'set'); await page.locator('[data-cortina-end]').first().dispatchEvent('change');
  await expect(page.locator('.group[data-group="real-group-cortina-1"] .group-duration')).toContainText('0:30');
  await page.reload();
  await view(page, 'deck'); await expect(page.locator('#queue-resume')).toBeVisible();
  await view(page, 'deck'); await page.locator('#play-pause').click();
  await expect(page.locator('#playing-title')).toHaveText('Cofrecito');
  await expect(page.locator('#queue-count')).toHaveText('28');
});
test('deleting a loaded recording keeps the remaining queue ready to play', async ({ page }) => {
  await page.addInitScript(() => {
    window.YT = { Player: class {
      constructor(id, options) { this.state = 2; setTimeout(() => options.events.onReady(), 0); }
      loadVideoById(id) { this.videoId = id; this.state = 1; }
      getCurrentTime() { return 0; } getDuration() { return 180; } getPlayerState() { return this.state; }
      setVolume() {} pauseVideo() { this.state = 2; } playVideo() { this.state = 1; }
    } };
  });
  await page.goto('/?practice=1'); await view(page, 'set'); await page.locator('#start-set').click();
  await expect(page.locator('#playing-title')).toHaveText('Yo soy el tango');
  page.on('dialog', dialog => dialog.accept());
  await view(page, 'library'); await recordingAction(page, 'delete', 'real-tango-1');
  await expect(page.locator('#queue-count')).toHaveText('27');
  await expect(page.locator('#playing-title')).toHaveText('No recording loaded');
  await view(page, 'deck'); await page.locator('#play-pause').click();
  await expect(page.locator('#playing-title')).toHaveText('Te aconsejo que me olvides');
});
test('completed cortina can be replayed without bypassing its limit', async ({ page }) => {
  await page.addInitScript(() => {
    window.YT = { Player: class {
      constructor(id, options) { this.state = 2; this.position = 0; this.loads = 0; window.testYouTube = this; setTimeout(() => options.events.onReady(), 0); }
      loadVideoById(id) { this.videoId = id; this.state = 1; this.position = 0; this.loads++; }
      getCurrentTime() { return this.position; } getDuration() { return 180; } getPlayerState() { return this.state; }
      setVolume() {} pauseVideo() { this.state = 2; } playVideo() { this.state = 1; }
    } };
  });
  await page.goto('/?practice=1'); await view(page, 'deck'); await page.locator('#auto-next').uncheck(); await view(page, 'set'); await page.locator('#start-set').click();
  await view(page, 'deck'); await page.locator('[data-queue-index="4"]').click();
  await page.evaluate(() => { window.testYouTube.position = 20.1; });
  await expect(page.locator('#notice')).toContainText('Cortina finished');
  const loads = await page.evaluate(() => window.testYouTube.loads);
  await view(page, 'deck'); await page.locator('#play-pause').click();
  expect(await page.evaluate(() => window.testYouTube.loads)).toBe(loads + 1);
  expect(await page.evaluate(() => window.testYouTube.position)).toBe(0);
  await expect(page.locator('#playing-title')).toHaveText('L-O-V-E');
});

async function simulatedDeck(page) {
  await page.addInitScript(() => {
    window.YT = { Player: class {
      constructor(id, options) { this.options = options; this.state = 2; this.position = 0; this.loads = 0; window.testYouTube = this; setTimeout(() => options.events.onReady(), 0); }
      loadVideoById(id) { this.videoId = typeof id === 'object' ? id.videoId : id; this.state = 1; this.position = typeof id === 'object' ? id.startSeconds || 0 : 0; this.loads++; this.options.events.onStateChange({ data: 1 }); }
      getCurrentTime() { return this.position; } getDuration() { return 180; } getPlayerState() { return this.state; }
      getVideoUrl() { return `https://www.youtube.com/watch?v=${this.videoId}`; }
      setVolume() {} pauseVideo() { this.state = 2; } playVideo() { this.state = 1; }
      seekTo(value) { this.position = value; }
    } };
  });
}

test('pause resumes while Stop rewinds and Space leaves text editing alone', async ({ page }) => {
  await simulatedDeck(page); await page.goto('/?practice=1'); await view(page, 'set'); await page.locator('#start-set').click(); await expect(page.locator('#playing-title')).toHaveText('Yo soy el tango');
  await page.evaluate(() => { window.testYouTube.position = 12; });
  await view(page, 'deck'); await page.locator('#play-pause').click(); await view(page, 'deck'); await page.locator('#play-pause').click();
  expect(await page.evaluate(() => window.testYouTube.position)).toBe(12);
  await view(page, 'deck'); await page.locator('#stop').click(); await expect(page.locator('#position')).toContainText('0:00 /');
  await view(page, 'deck'); await page.locator('#play-pause').click(); expect(await page.evaluate(() => window.testYouTube.position)).toBe(0);
  await page.locator('body').click({ position: { x: 2, y: 2 } }); await page.keyboard.press('Space');
  await expect(page.locator('#play-pause')).toHaveText('▶');
  await view(page, 'library'); await page.locator('#search').fill('Troilo'); await page.keyboard.press('Space');
  await expect(page.locator('#search')).toHaveValue('Troilo '); await expect(page.locator('#play-pause')).toHaveText('▶');
});

test('cortina seek uses its playable segment and edited queue warning survives reload', async ({ page }) => {
  await simulatedDeck(page); await page.goto('/?practice=1'); await view(page, 'set'); await page.locator('#start-set').click(); await expect(page.locator('#playing-title')).toHaveText('Yo soy el tango');
  await view(page, 'deck'); await page.locator('[data-queue-index="4"]').click();
  await view(page, 'deck'); await page.locator('#seek').fill('50'); await view(page, 'deck'); await page.locator('#seek').dispatchEvent('input');
  expect(await page.evaluate(() => window.testYouTube.position)).toBe(10);
  await expect(page.locator('#position')).toHaveText('0:10 / 0:20');
  await view(page, 'set'); await page.locator('[data-cortina-end]').first().fill('30'); await view(page, 'set'); await page.locator('[data-cortina-end]').first().dispatchEvent('change');
  await view(page, 'set'); await expect(page.locator('#queue-stale')).toBeVisible(); await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
  await page.reload(); await view(page, 'set'); await expect(page.locator('#queue-stale')).toBeVisible();
});

test('changing the playing video stops the old source and Play loads the replacement', async ({ page }) => {
  await simulatedDeck(page); await page.goto('/?practice=1'); await view(page, 'set'); await page.locator('#start-set').click(); await expect(page.locator('#playing-title')).toHaveText('Yo soy el tango');
  await view(page, 'library'); await recordingAction(page, 'edit', 'real-tango-1');
  await page.locator('[name="videoUrl"]').fill('https://youtu.be/abcdefghijk'); await page.locator('#metadata-form button[type="submit"]').click();
  await expect(page.locator('#play-pause')).toHaveText('▶'); await view(page, 'deck'); await page.locator('#play-pause').click();
  expect(await page.evaluate(() => window.testYouTube.videoId)).toBe('abcdefghijk');
});

test('importing a set clears the old deck and Undo cannot restore the previous set', async ({ page }) => {
  await simulatedDeck(page); await page.goto('/?practice=1'); await view(page, 'set'); await page.locator('#start-set').click(); await expect(page.locator('#playing-title')).toHaveText('Yo soy el tango'); await view(page, 'set'); await page.locator('#add-tanda').click();
  page.on('dialog', dialog => dialog.accept());
  const imported = { version: 1, tracks: [{ id: 'new', source: 'youtube', videoId: 'abcdefghijk', title: 'New tango' }], groups: [{ id: 'new-group', kind: 'tanda', name: 'New tanda', trackIds: ['new'] }] };
  await page.locator('#set-input').setInputFiles({ name: 'set.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(imported)) });
  await expect(page.locator('#playing-title')).toHaveText('No recording loaded'); await expect(page.locator('#play-pause')).toBeDisabled();
  await expect(page.locator('#undo-bar')).toBeHidden(); await view(page, 'set'); await page.locator('#start-set').click(); await expect(page.locator('#playing-title')).toHaveText('New tango');
});

test('cortina cue starts at the saved offset, seeks within it, then enters the next tanda first recording', async ({ page }) => {
  await simulatedDeck(page); await page.goto('/?practice=1');
  const group = page.locator('[data-group="real-group-cortina-1"]');
  await view(page, 'set'); await group.locator('[data-cortina-start]').fill('35'); await group.locator('[data-cortina-start]').dispatchEvent('change');
  await view(page, 'set'); await page.locator('#start-set').click(); await expect(page.locator('#playing-title')).toHaveText('Yo soy el tango');
  await view(page, 'deck'); await page.locator('[data-queue-index="4"]').click(); await expect(page.locator('#playing-title')).toHaveText('L-O-V-E');
  expect(await page.evaluate(() => window.testYouTube.position)).toBe(35);
  await view(page, 'deck'); await page.locator('#seek').fill('50'); await view(page, 'deck'); await page.locator('#seek').dispatchEvent('input');
  expect(await page.evaluate(() => window.testYouTube.position)).toBe(45);
  await expect(page.locator('#position')).toHaveText('0:10 / 0:20');
  await page.evaluate(() => { window.testYouTube.position = 55.2; });
  await expect(page.locator('#playing-title')).toHaveText('Poema');
  await expect(page.locator('.queue-item.playing')).toHaveAttribute('data-queue-index', '5');
  await page.reload(); await expect(group.locator('[data-cortina-start]')).toHaveValue('35');
});

test('local cortina cue also starts and restarts at the chosen offset', async ({ page }) => {
  await page.goto('/'); await view(page, 'deck'); await page.locator('#fade').selectOption('0');
  await page.locator('#file-input').setInputFiles({ name: 'test-cortina.wav', mimeType: 'audio/wav', buffer: wav() });
  await expect(page.locator('#tracks tr')).toHaveCount(1); await view(page, 'set'); await page.locator('#add-cortina').click(); await view(page, 'library'); await page.locator('[data-action="add"]').click();
  await view(page, 'set'); await page.locator('[data-cortina-start]').fill('3'); await view(page, 'set'); await page.locator('[data-cortina-start]').dispatchEvent('change');
  await view(page, 'set'); await page.locator('[data-cortina-full]').uncheck(); await page.locator('[data-cortina-end]').fill('5'); await view(page, 'set'); await page.locator('[data-cortina-end]').dispatchEvent('change');
  await view(page, 'deck'); await page.locator('#auto-next').uncheck(); await view(page, 'set'); await page.locator('#start-set').click();
  await expect(page.locator('#position')).toHaveText('0:00 / 0:02'); await expect(page.locator('#notice')).toContainText('Cortina finished');
  await view(page, 'deck'); await page.locator('#play-pause').click(); await expect(page.locator('#position')).toHaveText('0:00 / 0:02');
});

test('DJ can hold after a cortina and explicitly start the next tanda', async ({ page }) => {
  await simulatedDeck(page); await page.goto('/?practice=1');
  await view(page, 'set'); await page.locator('[data-cortina-hold]').first().check(); await view(page, 'set'); await page.locator('#start-set').click(); await expect(page.locator('#playing-title')).toHaveText('Yo soy el tango');
  await view(page, 'deck'); await page.locator('[data-queue-index="4"]').click(); await expect(page.locator('#playing-title')).toHaveText('L-O-V-E');
  await expect(page.locator('#up-next')).toContainText('Poema');
  await page.evaluate(() => { window.testYouTube.position = 20.1; }); await expect(page.locator('#notice')).toContainText('Cortina finished');
  await expect(page.locator('.queue-item.playing')).toHaveAttribute('data-queue-index', '4'); await view(page, 'deck'); await page.locator('#next').click();
  await expect(page.locator('#playing-title')).toHaveText('Poema'); await expect(page.locator('#recording-number')).toHaveText('Recording 1 / 4');
});

test('mobile library actions stay visible and floating deck controls work while preparing music', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await simulatedDeck(page); await page.goto('/?practice=1');
  await view(page, 'library'); const firstPlay = page.locator('[data-action="play"]').first(); await firstPlay.scrollIntoViewIfNeeded();
  const box = await firstPlay.boundingBox(); expect(box.x + box.width).toBeLessThanOrEqual(390);
  await firstPlay.click(); await expect(page.locator('#playing-title')).toHaveText('Yo soy el tango');
  await page.locator('button[data-view="set"]').click();
  await view(page, 'set'); await page.locator('#start-set').click(); await expect(page.locator('#queue-count')).toHaveText('28');
  await page.locator('button[data-view="library"]').click(); await expect(page.locator('#mini-deck')).toBeVisible();
  await page.locator('#mini-play').click(); await expect(page.locator('#mini-play')).toHaveText('▶');
  await page.locator('#mini-next').click(); await expect(page.locator('#playing-title')).toHaveText('Te aconsejo que me olvides');
  await page.locator('#mini-open').click(); await expect(page.locator('#mini-deck')).toBeHidden();
});

test('older tabs cannot overwrite newer saved workspace edits', async ({ page, context }) => {
  await page.goto('/?practice=1'); await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
  const other = await context.newPage(); await other.goto('/'); await expect(other.locator('.group')).toHaveCount(12);
  await view(page, 'set'); await page.locator('#add-tanda').click(); await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
  await view(other, 'set'); await other.locator('#add-tanda').click(); await expect(other.locator('#save-status')).toHaveText('Save failed — export a backup');
  await expect(other.locator('#notice')).toContainText('another tab');
  await page.reload(); await expect(page.locator('.group')).toHaveCount(13);
  await expect(page.locator('.group').nth(2).locator('.group-select strong')).toHaveText('Tanda 7'); await other.close();
});

test('failed workspace saves keep stored audio safe when a stale tab removes a recording', async ({ page, context }) => {
  await page.goto('/'); await page.locator('#file-input').setInputFiles({name:'saved-tango.wav',mimeType:'audio/wav',buffer:wav()});
  await expect(page.locator('#save-status')).toHaveText('Saved in this browser'); await expect(page.locator('#tracks tr')).toHaveCount(1);
  const other = await context.newPage(); await other.goto('/'); await expect(other.locator('#tracks tr')).toHaveCount(1);
  await view(page, 'set'); await page.locator('#add-tanda').click(); await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
  other.on('dialog',d=>d.accept()); await view(other, 'library'); await recordingAction(other, 'delete'); await expect(other.locator('#save-status')).toHaveText('Save failed — export a backup');
  await page.reload(); await expect(page.locator('#tracks tr')).toHaveCount(1); await expect(page.locator('.missing')).toHaveCount(0); await other.close();
});

test('YouTube initialization failure leaves the chosen recording ready to retry', async ({ page }) => {
  await page.addInitScript(() => {
    let calls = 0;
    window.YT = { Player: class {
      constructor(id, options) { if (++calls === 1) throw new Error('Connection interrupted'); this.state = 2; window.retryYouTube = this; setTimeout(() => options.events.onReady(), 0); }
      loadVideoById(id) { this.videoId = id; this.state = 1; }
      getCurrentTime() { return 0; } getDuration() { return 180; } getPlayerState() { return this.state; }
      setVolume() {} pauseVideo() { this.state = 2; }
    } };
  });
  await page.goto('/?practice=1'); await view(page, 'set'); await page.locator('#start-set').click();
  await expect(page.locator('#notice')).toContainText('Connection interrupted'); await expect(page.locator('#play-pause')).toBeEnabled();
  await view(page, 'deck'); await page.locator('#play-pause').click(); await expect(page.locator('#play-pause')).toHaveText('Ⅱ');
  expect(await page.evaluate(() => window.retryYouTube.videoId)).toBe('c9UaO1KQwpI');
});

test('upcoming queue refresh applies edits without restarting the live recording', async ({ page }) => {
  await simulatedDeck(page); await page.goto('/?practice=1'); await view(page, 'set'); await page.locator('#start-set').click(); await expect(page.locator('#playing-title')).toHaveText('Yo soy el tango');
  await page.evaluate(() => { window.testYouTube.position = 40; });
  await view(page, 'set'); await page.locator('[data-cortina-start]').first().fill('35'); await view(page, 'set'); await page.locator('[data-cortina-start]').first().dispatchEvent('change');
  await view(page, 'set'); await page.locator('[data-cortina-hold]').first().check();
  const loads = await page.evaluate(() => window.testYouTube.loads);
  await view(page, 'set'); await page.locator('#refresh-queue').click(); await expect(page.locator('#queue-stale')).toBeHidden();
  expect(await page.evaluate(() => window.testYouTube.loads)).toBe(loads); expect(await page.evaluate(() => window.testYouTube.position)).toBe(40);
  await view(page, 'deck'); await page.locator('[data-queue-index="4"]').click(); await expect(page.locator('#playing-title')).toHaveText('L-O-V-E');
  expect(await page.evaluate(() => window.testYouTube.position)).toBe(35);
  await page.evaluate(() => { window.testYouTube.position = 55.1; }); await expect(page.locator('#notice')).toContainText('Cortina finished');
  await expect(page.locator('.queue-item.playing')).toHaveAttribute('data-queue-index', '4');
});


test('cortina interval rejects reversed endpoints and keeps a valid segment when moving its start', async ({ page }) => {
  await page.goto('/?practice=1');
  const group = page.locator('[data-group="real-group-cortina-1"]');
  await view(page, 'set'); await group.locator('[data-cortina-start]').fill('35'); await group.locator('[data-cortina-start]').dispatchEvent('change');
  await expect(group.locator('[data-cortina-end]')).toHaveValue('55');
  await group.locator('[data-cortina-end]').fill('30'); await group.locator('[data-cortina-end]').dispatchEvent('change');
  await expect(group.locator('[data-cortina-end]')).toHaveValue('55');
  await group.locator('[data-cortina-end]').fill('50'); await group.locator('[data-cortina-end]').dispatchEvent('change');
  await expect(group.locator('.group-duration')).toContainText('0:15');
});

test('editing a cortina interval keeps keyboard focus and updates its endpoint without replacing controls', async ({ page }) => {
  await page.goto('/?practice=1');
  const start = page.locator('[data-cortina-start]').first(), end = page.locator('[data-cortina-end]').first();
  await view(page, 'set'); await start.fill('35'); await page.keyboard.press('Tab'); await expect(end).toBeFocused(); await expect(end).toHaveValue('55');
  await end.fill('60'); await page.keyboard.press('Tab');
  await expect(page.locator('[data-group-action="cue-position"]').first()).not.toBeFocused();
  await expect(page.locator('[data-group-action="cue-play"]').first()).toBeFocused();
  await expect(page.locator('.group-duration').filter({hasText:'0:25'})).toHaveCount(1);
});

test('stale tab relinking does not replace newer stored audio or metadata', async ({ page, context }) => {
  await page.goto('/'); await page.locator('#file-input').setInputFiles({name:'original-tango.wav',mimeType:'audio/wav',buffer:wav()});
  await expect(page.locator('#tracks tr')).toHaveCount(1); await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
  const id = await page.locator('#tracks tr').getAttribute('data-track');
  const other = await context.newPage(); await other.goto('/'); await expect(other.locator('#tracks tr')).toHaveCount(1);
  await view(page, 'set'); await page.locator('#add-tanda').click(); await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
  // Use the storage API directly to verify the transaction cannot commit either store on conflict.
  const result = await other.evaluate(async ({id,bytes}) => {
    const storage = await import('/src/storage.js'), state = await storage.loadState();
    try { await storage.replaceRecording(id,new Blob([new Uint8Array(bytes)]), {...state,tracks:[]},state.revision-1); return 'unexpected success'; }
    catch(error){ return error.message; }
  },{id,bytes:[1,2,3]});
  expect(result).toContain('another tab');
  expect(await page.evaluate(async id => (await (await import('/src/storage.js')).getFile(id)).size,id)).toBe(wav().length);
  await page.reload(); await expect(page.locator('.track-title')).toHaveText('original-tango'); await expect(page.locator('.missing')).toHaveCount(0); await other.close();
});

test('language changes translate the live countdown and tanda position immediately', async ({ page }) => {
  await simulatedDeck(page); await page.goto('/?practice=1'); await view(page, 'set'); await page.locator('#start-set').click(); await expect(page.locator('#playing-title')).toHaveText('Yo soy el tango');
  await page.evaluate(() => { window.testYouTube.position = 30; }); await expect(page.locator('#remaining-time')).toHaveText('Remaining: 2:30');
  await page.locator('#open-settings').click(); await page.locator('#language').selectOption('ko');
  await expect(page.locator('#remaining-time')).toHaveText('남은 시간: 2:30'); await expect(page.locator('#recording-number')).toHaveText('곡 1 / 4');
  await page.locator('#language').selectOption('es'); await expect(page.locator('#remaining-time')).toHaveText('Tiempo restante: 2:30');
  await expect(page.locator('#recording-number')).toHaveText('Grabación 1 / 4');
  await page.locator('#language').selectOption('ko');
  // Playback writes a fresh translated text node between language changes.
  await page.evaluate(() => { window.testYouTube.position = 31; });
  await expect(page.locator('#remaining-time')).toHaveText('남은 시간: 2:29');
  await page.locator('#language').selectOption('es'); await expect(page.locator('#remaining-time')).toHaveText('Tiempo restante: 2:29');
  await page.locator('#language').selectOption('en'); await expect(page.locator('#remaining-time')).toHaveText('Remaining: 2:29');
});

test('small Spanish cortina controls retain readable input widths', async ({ page }) => {
  await page.setViewportSize({width:320,height:700}); await page.goto('/?practice=1');
  await page.locator('#open-menu').click(); await page.locator('#open-settings').click(); await page.locator('#language').selectOption('es'); await page.locator('[data-close="settings-dialog"]').click();
  await page.locator('button[data-view="set"]').click(); await page.locator('.group.collapsed:not(.attached-cortina) [data-group-action=collapse]').evaluateAll(buttons=>buttons.forEach(button=>button.click()));
  const dimensions = await page.locator('.cortina-range').first().evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth,widths:[...el.querySelectorAll('input')].map(input=>input.getBoundingClientRect().width)}));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client); expect(Math.min(...dimensions.widths)).toBeGreaterThanOrEqual(60);
});

test('Spanish header and cortina actions fit common narrow viewports', async ({ page }) => {
  await page.goto('/?practice=1'); await page.locator('#open-settings').click(); await page.locator('#language').selectOption('es'); await page.locator('[data-close="settings-dialog"]').click();
  for (const width of [320, 390, 414, 768]) {
    await page.setViewportSize({ width, height: 900 });
    if (width < 700) { await page.locator('#open-menu').click(); await page.locator('button[data-view="set"]').click(); }
    await page.locator('.group.collapsed:not(.attached-cortina) [data-group-action=collapse]').evaluateAll(buttons=>buttons.forEach(button=>button.click()));
    const dimensions = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth,
      header: [...document.querySelectorAll('.header-actions button')].map(el => ({ client: el.clientWidth, scroll: el.scrollWidth })),
      ranges: [...document.querySelectorAll('.cortina-range')].map(el => ({ client: el.clientWidth, scroll: el.scrollWidth })),
    }));
    expect(dimensions.page).toBeLessThanOrEqual(width);
    for (const item of [...dimensions.header, ...dimensions.ranges]) expect(item.scroll).toBeLessThanOrEqual(item.client + 1);
  }
});

test('changing metadata during playback preserves the source and playhead', async ({ page }) => {
  await simulatedDeck(page); await page.goto('/?practice=1'); await view(page, 'set'); await page.locator('#start-set').click(); await expect(page.locator('#playing-title')).toHaveText('Yo soy el tango');
  await page.evaluate(() => { window.testYouTube.position = 40; });
  const loads = await page.evaluate(() => window.testYouTube.loads);
  await view(page, 'library'); await recordingAction(page, 'edit', 'real-tango-1'); await page.locator('[name="title"]').fill('Yo soy el tango (edited)');
  await page.locator('#metadata-form button[type="submit"]').click(); await expect(page.locator('#playing-title')).toHaveText('Yo soy el tango (edited)');
  expect(await page.evaluate(() => window.testYouTube.loads)).toBe(loads); expect(await page.evaluate(() => window.testYouTube.position)).toBe(40);
});

test('YouTube buffering is visible and retry preserves the current source position', async ({ page }) => {
  await page.addInitScript(() => {
    const realNow = Date.now; let offset = 0; Date.now = () => realNow() + offset;
    window.advanceStallClock = () => { offset += 16000; };
    window.YT = {Player:class {
      constructor(id,o){this.state=2;this.position=0;window.stallPlayer=this;setTimeout(()=>o.events.onReady(),0);}
      loadVideoById(value){this.id=typeof value==='object'?value.videoId:value;this.position=typeof value==='object'?value.startSeconds:0;this.state=1;}
      getCurrentTime(){return this.position;}getDuration(){return 180;}getPlayerState(){return this.state;}
      setVolume(){}pauseVideo(){this.state=2;}seekTo(position){this.position=position;}
    }};
  });
  await page.goto('/?practice=1');await view(page, 'set'); await page.locator('#start-set').click();await expect(page.locator('#playing-title')).toHaveText('Yo soy el tango');
  await page.evaluate(()=>window.stallPlayer.position=30);await expect(page.locator('#position')).toHaveText('0:30 / 3:00');
  await page.evaluate(()=>{window.stallPlayer.state=3;window.advanceStallClock();});await expect(page.locator('#playback-stall')).toBeVisible();
  await view(page, 'deck'); await page.locator('#resume-video').click();expect(await page.evaluate(()=>window.stallPlayer.position)).toBe(30);await expect(page.locator('#playback-stall')).toBeHidden();
  await view(page, 'deck'); await page.locator('#stop').click();await page.evaluate(()=>window.advanceStallClock());await expect(page.locator('#playback-stall')).toBeHidden();
});

test('local session can play, edit and export while the network is offline', async ({ page, context }) => {
  await page.goto('/');await page.locator('#file-input').setInputFiles({name:'offline-tango.wav',mimeType:'audio/wav',buffer:wav()});
  await expect(page.locator('#tracks tr')).toHaveCount(1);await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
  await context.setOffline(true);await view(page, 'set'); await page.locator('#add-tanda').click();await view(page, 'library'); await page.locator('[data-action="add"]').click();
  await view(page, 'set'); await page.locator('#start-set').click();await expect(page.locator('#playing-title')).toHaveText('offline-tango');
  await view(page, 'library'); await recordingAction(page, 'edit');await page.locator('[name="artist"]').fill('Offline orchestra');await page.locator('#metadata-form button[type="submit"]').click();
  await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
  const download=page.waitForEvent('download');await page.locator('#export-set').click();expect((await download).suggestedFilename()).toBe('tango-dj-set.json');
  await context.setOffline(false);await page.reload();await expect(page.locator('.missing')).toHaveCount(0);await expect(page.locator('.track-detail')).toContainText('Offline orchestra');
});

test('library cortina playback opens the full source for cue preparation without removing the set queue', async ({ page }) => {
  await simulatedDeck(page);await page.goto('/?practice=1');await view(page, 'set'); await page.locator('#start-set').click();await expect(page.locator('#queue-count')).toHaveText('28');
  await view(page, 'library'); await page.locator('[data-action="play"][data-id="real-cortina-1"]').click();await expect(page.locator('#playing-title')).toHaveText('L-O-V-E');await expect(page.locator('#queue-count')).toHaveText('29');
  await page.evaluate(()=>{window.testYouTube.position=35;});await expect(page.locator('#position')).toHaveText('0:35 / 3:00');
  await view(page, 'set'); await page.locator('[data-group-action="cue-position"][data-id="real-group-cortina-1"]').click();
  await expect(page.locator('[data-cortina-start]').first()).toHaveValue('35');await expect(page.locator('[data-cortina-end]').first()).toHaveValue('55');
  await view(page, 'library'); await page.locator('[data-action="play"][data-id="real-cortina-1"]').click();await expect(page.locator('#queue-count')).toHaveText('29');
});

test('cortina intervals respect known source length and retain a usable endpoint near the end', async ({ page }) => {
  await simulatedDeck(page); await page.goto('/?practice=1');
  await view(page, 'library'); await page.locator('[data-action="play"][data-id="real-cortina-1"]').click();
  await expect(page.locator('#position')).toContainText('/ 3:00');
  const group = page.locator('[data-group="real-group-cortina-1"]');
  await view(page, 'set'); const start = group.locator('[data-cortina-start]'), end = group.locator('[data-cortina-end]');
  await start.fill('200'); await start.dispatchEvent('change');
  await expect(start).toHaveValue('0'); await expect(page.locator('#notice')).toContainText('within the recording length');
  await start.fill('175'); await start.dispatchEvent('change'); await expect(end).toHaveValue('180');
  await end.fill('181'); await end.dispatchEvent('change'); await expect(end).toHaveValue('180');
  await expect(page.locator('#playing-title')).toHaveText('L-O-V-E');
});

test('a saved cue beyond source length cannot interrupt the current recording', async ({ page }) => {
  await simulatedDeck(page); await page.goto('/'); page.on('dialog', dialog => dialog.accept());
  await page.locator('#set-input').setInputFiles({ name: 'set.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({
    version: 1, tracks: [{ id: 'tango', source: 'youtube', videoId: 'c9UaO1KQwpI', title: 'Current tango', duration: 180 }, { id: 'cortina', source: 'youtube', videoId: 'abcdefghijk', title: 'Late cortina', duration: 180 }],
    groups: [{ id: 'tanda', name: 'Tanda', kind: 'tanda', trackIds: ['tango'] }, { id: 'break', name: 'Cortina', kind: 'cortina', trackIds: ['cortina'], startSeconds: 200, limitSeconds: 20 }],
  })) });
  await view(page, 'set'); await page.locator('#start-set').click(); await expect(page.locator('#playing-title')).toHaveText('Current tango');
  await page.evaluate(() => { window.testYouTube.position = 40; });
  const loads = await page.evaluate(() => window.testYouTube.loads);
  await view(page, 'deck'); await page.locator('[data-queue-index="1"]').click();
  await expect(page.locator('#notice')).toContainText('before the recording ends');
  await expect(page.locator('#playing-title')).toHaveText('Current tango');
  expect(await page.evaluate(() => window.testYouTube.loads)).toBe(loads);
  expect(await page.evaluate(() => window.testYouTube.position)).toBe(40);
});

test('discovering a source shorter than its saved cue stops it and explains the invalid cue', async ({ page }) => {
  await simulatedDeck(page); await page.goto('/?practice=1');
  const start = page.locator('[data-cortina-start]').first();
  await view(page, 'set'); await start.fill('200'); await start.dispatchEvent('change');
  await view(page, 'set'); await page.locator('[data-group-action="cue-play"]').first().click();
  await expect(page.locator('#notice')).toContainText('before the recording ends');
  expect(await page.evaluate(() => window.testYouTube.state)).toBe(2);
  await expect(page.locator('.queue-item.playing')).toHaveAttribute('data-queue-index', '0');
});
