import { test, expect, prepareSavedWorkspace } from './saved-workspace.js';
import { devices } from '@playwright/test';


async function view(page, area) {
  await page.locator('button[data-view]').first().waitFor({ state: 'attached' });
  const button = page.locator(`button[data-view="${area}"]`);
  if (await button.isVisible()) await button.click();
  else await page.locator(`.sidebar .nav[href="#${area}"]`).click();
}
function tone() {
  const rate = 8000, length = rate * 12, buffer = Buffer.alloc(44 + length * 2);
  buffer.write('RIFF'); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVE', 8); buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22); buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write('data', 36); buffer.writeUInt32LE(length * 2, 40);
  for (let i = 0; i < length; i++) buffer.writeInt16LE(Math.round(Math.sin(i * 2 * Math.PI * 440 / rate) * 12000), 44 + i * 2);
  return buffer;
}

for (const device of ['iPhone 13', 'iPad (gen 7)', 'Pixel 7']) {
  test(`${device} supports import, group selection, playback and orientation changes`, async ({ browser }) => {
    const context = await browser.newContext({ ...devices[device], locale: 'en-US' });
    const page = await context.newPage(); await prepareSavedWorkspace(page); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto('/'); await expect(page.locator('#library')).toBeVisible();
    const phone = devices[device].viewport.width < 700;
    await expect(page.locator('#library')).toBeVisible();
    if (phone) { await expect(page.locator('#set')).toBeHidden(); await expect(page.locator('#deck')).toBeHidden(); }
    await page.locator('#file-input').setInputFiles({ name: 'device-tango.wav', mimeType: 'audio/wav', buffer: tone() });
    await expect(page.locator('#notice')).toContainText('1 recording added');
    if (phone) {
      await view(page, 'library'); await page.locator('[data-action=more]').click();
      await page.locator('#recording-actions [data-action=edit]').click();
      await page.getByLabel('Title', { exact: true }).fill('Device tango'); await page.getByRole('button', { name: 'Save details' }).click();
      await page.locator('button[data-view=set]').click();
    }
    await view(page, 'set'); await page.locator('#add-tanda').click(); await view(page, 'set'); await page.locator('#choose-recordings').click();
    await view(page, 'library'); await page.locator('[data-action=add]').click();
    await view(page, 'set');
    await view(page, 'set'); await page.locator('#start-set').click();
    await expect(page.locator('#deck')).toBeVisible(); await expect(page.locator('#position')).toContainText('0:01', { timeout: 10000 });
    await page.locator('button[data-view=library]').click();
    await expect(page.locator('#mini-deck')).toBeVisible(); await page.locator('#mini-play').click();
    await expect(page.locator('#mini-play')).toHaveText('▶');
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.locator('#library')).toBeVisible(); await expect(page.locator('#set')).toBeHidden();
    const layout = await page.locator('.workspace').evaluate(el => getComputedStyle(el).display);
    expect(layout).toBe('block'); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1024);
    await page.reload(); await expect(page.locator('#library-count')).toHaveText('1'); await expect(page.locator('.missing')).toHaveCount(0);
    expect(errors).toEqual([]); await context.close();
  });
}

test('local four-second fade changes the rendered output signal and honors pause, seek and volume', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'This WebKit automation environment produces silent MediaElementSource analyser output; real-device listening is required.');
  await page.goto('/'); await expect(page.locator('#library')).toBeVisible();
  await page.evaluate(async () => {
    const { Player } = await import('/src/player.js');
    window.signalPlayer = new Player(() => {}, () => {}, () => {});
    await signalPlayer.context();
    const analyser = signalPlayer.ctx.createAnalyser(); analyser.fftSize = 512; signalPlayer.gain.connect(analyser);
    window.outputRms = () => { const data = new Float32Array(512); analyser.getFloatTimeDomainData(data); return Math.sqrt(data.reduce((sum, n) => sum + n * n, 0) / data.length); };
  });
  const bytes = [...tone()];
  await page.evaluate(async bytes => { await signalPlayer.play({ id: 'signal', source: 'local' }, new Blob([new Uint8Array(bytes)], { type: 'audio/wav' }), 4, false); }, bytes);
  await expect.poll(() => page.evaluate(() => signalPlayer.audio.currentTime)).toBeGreaterThan(.5);
  const intro = await page.evaluate(() => outputRms());
  await page.evaluate(() => signalPlayer.seek(5));
  await expect.poll(() => page.evaluate(() => outputRms())).toBeGreaterThan(intro * 3);
  const full = await page.evaluate(() => outputRms());
  await page.evaluate(() => signalPlayer.seek(10));
  await expect.poll(() => page.evaluate(() => outputRms())).toBeLessThan(full * .6);
  await page.evaluate(() => signalPlayer.setVolume(.4, false));
  await expect.poll(() => page.evaluate(() => outputRms())).toBeLessThan(full * .3);
  await page.evaluate(() => signalPlayer.toggle());
  const held = await page.evaluate(() => signalPlayer.audio.currentTime);
  await page.waitForTimeout(150); expect(await page.evaluate(() => signalPlayer.audio.currentTime)).toBeCloseTo(held, 1);
  await page.evaluate(() => signalPlayer.stop());
});

test('YouTube envelope follows cues, buffering and endpoints through the official volume API', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#library')).toBeVisible();
  await page.evaluate(async () => {
    const { Player } = await import('/src/player.js');
    window.envelopePlayer = new Player(() => {}, () => {}, () => {});
    envelopePlayer.youtube = { position: 35, state: 3, volume: 0, getCurrentTime() { return this.position; }, getDuration() { return 180; }, getPlayerState() { return this.state; }, setVolume(v) { this.volume = v; }, loadVideoById() {}, pauseVideo() { this.state = 2; } };
    await envelopePlayer.play({ id: 'video', source: 'youtube', videoId: 'abcdefghijk' }, null, 4, false, 35, 20);
    envelopePlayer.youtube.state = 1; envelopePlayer.youtube.position = 37; envelopePlayer.updateEnvelope();
  });
  expect(await page.evaluate(() => envelopePlayer.youtube.volume)).toBeCloseTo(42.5);
  await page.evaluate(() => { envelopePlayer.youtube.state = 3; envelopePlayer.youtube.position = 40; });
  await page.waitForTimeout(150); expect(await page.evaluate(() => envelopePlayer.youtube.volume)).toBeCloseTo(42.5);
  await page.evaluate(() => { envelopePlayer.youtube.state = 1; envelopePlayer.youtube.position = 53; envelopePlayer.updateEnvelope(); });
  expect(await page.evaluate(() => envelopePlayer.youtube.volume)).toBeCloseTo(42.5);
  await page.evaluate(() => { envelopePlayer.youtube.position = 55; envelopePlayer.updateEnvelope(); });
  expect(await page.evaluate(() => envelopePlayer.youtube.volume)).toBe(0);
});

test('blocked playback exposes explicit retry and keeps the queue', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#library')).toBeVisible(); await page.locator('#file-input').setInputFiles({ name: 'retry.wav', mimeType: 'audio/wav', buffer: tone() });
  await expect(page.locator('#notice')).toContainText('1 recording added');
  await page.evaluate(() => { const original = HTMLMediaElement.prototype.play; let blocked = true; HTMLMediaElement.prototype.play = function() { if (blocked) { blocked = false; return Promise.reject(new DOMException('Denied', 'NotAllowedError')); } return original.call(this); }; });
  await view(page, 'library'); await page.locator('[data-action=play]').click();
  await expect(page.locator('#playback-recovery')).toBeVisible(); await expect(page.locator('#playback-recovery-message')).toContainText('permission');
  await expect(page.locator('#queue-count')).toHaveText('1'); await page.locator('#playback-retry').click();
  await expect(page.locator('#playback-recovery')).toBeHidden(); await expect(page.locator('#play-pause')).toHaveText('Ⅱ');
});

test('quota failures stop import and do not claim files were saved', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#library')).toBeVisible();
  await page.evaluate(() => { const original = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function(...args) { if (this.name === 'files') throw new DOMException('Full', 'QuotaExceededError'); return original.apply(this, args); }; });
  await page.locator('#file-input').setInputFiles({ name: 'quota.wav', mimeType: 'audio/wav', buffer: tone() });
  await expect(page.locator('#notice')).toContainText('storage is full'); await expect(page.locator('#library-count')).toHaveText('0');
  await expect(page.locator('#add-files')).toBeEnabled();
});

test('Stop cancels a pending manual fade before it can replace the recording', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#library')).toBeVisible();
  await page.evaluate(async () => {
    const { Player } = await import('/src/player.js');
    window.cancelPlayer = new Player(() => {}, () => {}, () => {});
    cancelPlayer.youtube = { position: 10, state: 1, loads: 0, getCurrentTime() { return this.position; }, getDuration() { return 180; }, getPlayerState() { return this.state; }, setVolume(v) { this.volume = v; }, loadVideoById() { this.loads++; }, pauseVideo() { this.state = 2; } };
    cancelPlayer.track = { id: 'current', source: 'youtube', videoId: 'abcdefghijk' }; cancelPlayer.startSeconds = 0;
    window.pendingTransition = cancelPlayer.play({ id: 'next', source: 'youtube', videoId: '123456789ab' }, null, 1, false);
  });
  await expect.poll(() => page.evaluate(() => cancelPlayer.youtube.volume)).toBeLessThan(80);
  await page.evaluate(() => cancelPlayer.stop());
  expect(await page.evaluate(async () => await pendingTransition)).toBe(false);
  expect(await page.evaluate(() => cancelPlayer.track.id)).toBe('current');
  expect(await page.evaluate(() => cancelPlayer.youtube.loads)).toBe(0);
});

test('Galaxy example playback works in a temporary workspace after database opening fails, then saving recovers', async ({ browser }) => {
  const context = await browser.newContext({ ...devices['Galaxy S9+'], locale: 'en-US' });
  const page = await context.newPage();
  await page.addInitScript(() => {
    const original = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function(...args) {
      if (!window.allowDatabase) throw new DOMException('Database unavailable', 'UnknownError');
      return original.apply(this, args);
    };
    window.YT = { Player: class {
      constructor(id, options) { this.state = 2; setTimeout(() => options.events.onReady(), 0); }
      setVolume() {} pauseVideo() { this.state = 2; } loadVideoById() { this.state = 1; }
      getPlayerState() { return this.state; } getCurrentTime() { return 1; } getDuration() { return 180; }
    } };
  });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await expect(page.locator('#storage-recovery')).toBeVisible();
  await page.locator('#open-menu').click(); await page.locator('#open-examples').click();
  await page.locator('#real-sample-play').click(); await expect(page.locator('#playing-title')).toHaveText('Yo soy el tango');
  await expect(page.locator('#queue-count')).toHaveText('28'); await expect(page.locator('#save-status')).toHaveText('Temporary · not saved');
  await page.evaluate(() => { window.allowDatabase = true; }); await page.locator('#retry-saving').click();
  await expect(page.locator('#storage-recovery')).toBeHidden(); await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
  expect(errors).toEqual([]); await context.close();
});
