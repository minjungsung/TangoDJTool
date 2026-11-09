import { readFile } from 'node:fs/promises';
import { test, expect, recordingAction } from './saved-workspace.js';

const saved = page => page.evaluate(async () => (await import('/src/storage.js')).loadState());
const original = new URL('../fixtures/audio/expressive-transfer-original.wav', import.meta.url);
async function bootstrap(page) {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('https://**', route => route.abort());
  await page.addInitScript(() => {
    const NativeAudio = window.Audio; window.testAudio = [];
    window.Audio = function(...args) { const element = new NativeAudio(...args); window.testAudio.push(element); return element; }; window.Audio.prototype = NativeAudio.prototype;
  });
  await page.goto('/');
  await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
  const bytes = [...await readFile(original)];
  await page.evaluate(async bytes => {
    localStorage.setItem('studio-language', 'en'); localStorage.setItem('studio-settings', JSON.stringify({ volume: 60, fade: '0', normalize: false, autoNext: false, gapSeconds: 0 }));
    const { saveState, saveFile } = await import('/src/storage.js'), file = new Blob([new Uint8Array(bytes)], { type: 'audio/wav' });
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))].map(value => value.toString(16).padStart(2, '0')).join('');
    const tracks = ['a', 'b'].map(id => ({ id, source: 'local', title: id.toUpperCase(), duration: 16, style: 'Tango', bpm: 120, bpmConfidence: 0.7, bpmCandidates: [120, 60, 240], bpmSource: 'estimate', contentHash: hash, fileName: 'expressive-transfer-original.wav' }));
    await saveFile('a', file); await saveFile('b', file); await saveState({ tracks, groups: [{ id: 't', kind: 'tanda', name: 'Prepared tanda', trackIds: ['a', 'b'] }], collections: [], presets: [] });
  }, bytes);
  await page.reload(); await expect(page.locator('#save-status')).toHaveText('Saved in this browser'); expect(errors).toEqual([]);
}
async function nav(page, view) {
  await expect(page.locator('#save-status')).toBeVisible();
  const button = page.locator(`button[data-view="${view}"]`);
  if (await button.isVisible()) await button.click(); else await page.locator(`.sidebar a[href="#${view}"]`).click();
}
async function review(page, id = 'a') { await nav(page, 'library'); await recordingAction(page, 'audio-review', id); await expect(page.locator('#audio-review-dialog')).toBeVisible(); }
async function closeReview(page) { await page.locator('#audio-review-close').click(); await expect(page.locator('#audio-review-dialog')).toBeHidden(); }
async function settings(page) { if (!(await page.locator('#open-settings').isVisible())) await page.locator('#open-menu').click(); await page.locator('#open-settings').click(); }
async function delayDecode(page) {
  await page.evaluate(() => {
    const native = AudioContext.prototype.decodeAudioData; window.pendingDecode = [];
    AudioContext.prototype.decodeAudioData = function(...args) { return new Promise(resolve => { window.pendingDecode.push(() => resolve(native.apply(this, args))); }); };
    window.releaseDecode = () => { AudioContext.prototype.decodeAudioData = native; window.pendingDecode.splice(0).forEach(release => release()); };
  });
}

for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) test(`tempo review persists manual, half/double and taps at ${viewport.width}px`, async ({ page }) => {
  await page.setViewportSize(viewport); await bootstrap(page); await review(page);
  await page.locator('#audio-half').click(); await page.locator('#audio-save-bpm').click(); await expect(page.locator('#notice')).toContainText('BPM review saved');
  expect((await saved(page)).tracks[0]).toMatchObject({ bpm: 60, bpmSource: 'half', bpmConfidence: null }); expect((await saved(page)).tracks[0].bpmCandidates).toBeUndefined();
  await page.locator('#audio-double').click(); await page.locator('#audio-save-bpm').click(); await expect.poll(async () => (await saved(page)).tracks[0].bpmSource).toBe('double');
  await page.locator('#audio-bpm').fill('86.5'); await page.locator('#audio-save-bpm').click(); await expect.poll(async () => (await saved(page)).tracks[0].bpmSource).toBe('manual');
  for (let i = 0; i < 4; i++) await page.evaluate(i => {
    const native = performance.now; Object.defineProperty(performance, 'now', { configurable: true, value: () => i * 500 });
    try { document.querySelector('#audio-tap').click(); } finally { Object.defineProperty(performance, 'now', { configurable: true, value: native }); }
  }, i);
  await expect(page.locator('#audio-tap-status')).toContainText('120 BPM'); await page.locator('#audio-save-bpm').click(); await expect.poll(async () => (await saved(page)).tracks[0].bpmSource).toBe('tap');
  await page.locator('#audio-reset-tap').click(); await expect(page.locator('#audio-tap-status')).toBeEmpty(); await closeReview(page); await page.reload(); await review(page);
  await expect(page.locator('#audio-bpm')).toHaveValue('120'); await expect(page.locator('#audio-tempo-evidence')).toContainText('tap');
  const overflow = await page.locator('#audio-review-dialog').evaluate(element => element.scrollWidth > element.clientWidth); expect(overflow).toBe(false);
});

test('full-file measurement is opt-in and preserves reviewed BPM', async ({ page }) => {
  await bootstrap(page); expect((await saved(page)).tracks[0].integratedLufs).toBeUndefined(); await review(page);
  await page.locator('#audio-bpm').fill('92'); await page.locator('#audio-save-bpm').click(); await expect(page.locator('#notice')).toContainText('BPM review saved');
  await page.locator('#audio-measure').click(); await expect(page.locator('#audio-measurement')).toContainText('LUFS', { timeout: 15000 });
  const track = (await saved(page)).tracks[0]; expect(track).toMatchObject({ bpm: 92, bpmSource: 'manual', bpmConfidence: null, loudnessAnalysisVersion: 'bs1770-k-4x-v1', measuredSeconds: 16, duration: 16 });
  // Browser decoding may resample the 16 kHz fixture to its output context rate.
  expect(Math.abs(track.integratedLufs + 28.59)).toBeLessThan(0.2); expect(Math.abs(track.truePeakDb + 10.21)).toBeLessThan(0.2);
});

test('closing and reopening another recording cancels a late measurement save', async ({ page }) => {
  await bootstrap(page); await review(page); await delayDecode(page); await page.locator('#audio-measure').click(); await expect.poll(() => page.evaluate(() => pendingDecode.length)).toBe(1);
  await closeReview(page); await review(page, 'b'); await page.evaluate(() => releaseDecode());
  await expect(page.locator('#audio-measure')).toBeEnabled(); await expect(page.locator('#audio-measurement')).toHaveText('No full-file measurement saved.');
  await page.waitForTimeout(500); expect((await saved(page)).tracks.every(track => track.integratedLufs === undefined)).toBe(true);
});

test('Live mode rejects metadata saves and a late measurement', async ({ page }) => {
  await bootstrap(page); await review(page); await delayDecode(page); await page.locator('#audio-measure').click(); await expect.poll(() => page.evaluate(() => pendingDecode.length)).toBe(1);
  await page.evaluate(() => { document.querySelector('#live-mode').checked = true; document.querySelector('#live-mode').dispatchEvent(new Event('change')); releaseDecode(); });
  await expect(page.locator('#notice')).toContainText('Unlock Live mode'); expect((await saved(page)).tracks[0].integratedLufs).toBeUndefined();
  await page.locator('#audio-bpm').fill('100'); await page.locator('#audio-save-bpm').click(); expect((await saved(page)).tracks[0].bpm).toBe(120);
});

test('original and processed segment audition uses real PCM and closing cancels pending audition', async ({ page }) => {
  await bootstrap(page); await review(page); await page.locator('#audio-segment-start').fill('2'); await page.locator('#audio-segment-end').fill('2.5'); await page.locator('#audio-audition-original').click();
  await expect.poll(() => page.evaluate(() => testAudio[1].paused)).toBe(false); const originalUrl = await page.evaluate(() => testAudio[1].src);
  await expect.poll(() => page.evaluate(() => testAudio[1].paused)).toBe(true);
  await page.locator('#audio-audition-processed').click(); await expect.poll(() => page.evaluate(() => testAudio[1].paused)).toBe(false); expect(await page.evaluate(() => testAudio[1].src)).not.toBe(originalUrl);
  await closeReview(page); await review(page, 'b'); await delayDecode(page); await page.locator('#audio-audition-processed').click(); await expect.poll(() => page.evaluate(() => pendingDecode.length)).toBe(1); await closeReview(page); await page.evaluate(() => releaseDecode());
  await page.waitForTimeout(500); expect(await page.evaluate(() => testAudio[1].paused)).toBe(true);
});

test('processing apply and explicit bypass replace loaded PCM at the same paused position', async ({ page }) => {
  await bootstrap(page); await nav(page, 'library'); await page.locator('[data-action=play][data-id=a]').click(); await expect(page.locator('#playing-title')).toHaveText('A');
  await nav(page, 'deck'); await page.locator('#play-pause').click(); await expect.poll(() => page.evaluate(() => testAudio[0].paused)).toBe(true);
  await page.evaluate(() => { testAudio[0].currentTime = 3; }); const originalUrl = await page.evaluate(() => testAudio[0].src), sessionBefore = await page.evaluate(() => localStorage.getItem('studio-dj-session'));
  await settings(page); await page.locator('#audio-processing-enabled').check(); await page.locator('#audio-apply-processing').click(); await expect(page.locator('#audio-processing-status')).toContainText('Measured processing', { timeout: 15000 });
  expect(await page.evaluate(() => testAudio[0].src)).not.toBe(originalUrl); expect(await page.evaluate(() => testAudio[0].currentTime)).toBeCloseTo(3); expect(await page.evaluate(() => testAudio[0].paused)).toBe(true);
  await page.locator('#audio-processing-bypass').check(); await page.locator('#audio-apply-processing').click(); await expect(page.locator('#audio-processing-status')).toContainText('processing bypassed');
  expect(await page.evaluate(() => testAudio[0].src)).toBe(originalUrl); expect(await page.evaluate(() => testAudio[0].currentTime)).toBeCloseTo(3); expect(await page.evaluate(() => localStorage.getItem('studio-dj-session'))).toBe(sessionBefore);
});

test('real browser analyser observes gain and exact bypass through the Player graph', async ({ page }) => {
  await bootstrap(page);
  await page.evaluate(async () => {
    const { Player } = await import('/src/player.js'), { pcmWav } = await import('/src/audio-measurement.js');
    const rate = 48000, signal = Float32Array.from({ length: rate * 3 }, (_, i) => 0.1 * Math.sin(2 * Math.PI * 1000 * i / rate)), file = pcmWav([signal], rate);
    const run = async () => {
    const player = new Player(() => {}, () => {}, () => {}), track = { id: 'reference', source: 'local', duration: 3 };
    player.volume = 1; await player.play(track, file, 0, false); const analyser = player.ctx.createAnalyser(); analyser.fftSize = 2048; player.gain.connect(analyser);
    const rms = async () => {
      const samples = new Float32Array(analyser.fftSize), deadline = Date.now() + 5000;
      const sample = () => { analyser.getFloatTimeDomainData(samples); return Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length); };
      while (Date.now() < deadline) { await new Promise(resolve => setTimeout(resolve, 50)); if (sample() > 0.01) { await new Promise(resolve => setTimeout(resolve, 80)); return sample(); } }
      return sample();
    };
    try {
      const before = await rms(); player.audio.pause(); await player.setLoudnessProcessing({ enabled: true, targetLufs: -18 }); await player.toggle(); const after = await rms(); player.audio.pause(); await player.setLoudnessProcessing({ enabled: true, bypass: true }); await player.toggle(); const bypass = await rms();
      return { before, after, bypass, gainDb: 20 * Math.log10(after / before), bypassDb: 20 * Math.log10(bypass / before), contextState: player.ctx.state, mediaReady: player.audio.readyState, paused: player.audio.paused, position: player.audio.currentTime };
    } finally { player.stop(); clearInterval(player.timer); player.revoke(track.id); await player.ctx.close(); }
    };
    const button = document.createElement('button'); button.id = 'audio-reference-start'; button.textContent = 'Start audio reference';
    button.onclick = () => { window.audioReferenceResult = run(); }; document.querySelector('#library').prepend(button);
  });
  await page.locator('#audio-reference-start').click(); const results = await page.evaluate(() => window.audioReferenceResult);
  expect(results.before, JSON.stringify(results)).toBeGreaterThan(0.06); expect(results.gainDb).toBeCloseTo(5, 0); expect(Math.abs(results.bypassDb)).toBeLessThan(0.1);
});

async function simulatedOutputs(page, masterSupported = true) {
  await page.addInitScript(masterSupported => {
    window.testDevices = [{ kind: 'audiooutput', deviceId: 'default', groupId: 'speakers', label: 'System speakers' }, { kind: 'audiooutput', deviceId: 'interface', groupId: 'interface', label: 'DJ interface' }];
    navigator.mediaDevices.enumerateDevices = async () => window.testDevices;
    HTMLMediaElement.prototype.setSinkId = async function(id) { Object.defineProperty(this, 'sinkId', { configurable: true, value: id }); };
    AudioContext.prototype.setSinkId = masterSupported ? async function(id) { Object.defineProperty(this, 'sinkId', { configurable: true, value: id }); } : undefined;
  }, masterSupported);
}

test('routing UI handles logical device/channel selection and reconnect feedback', async ({ page }) => {
  // Device identity is simulated; channel graph creation uses native Web Audio.
  await simulatedOutputs(page); await bootstrap(page); await settings(page); await page.locator('#audio-detect-outputs').click();
  await page.locator('#audio-master-output').selectOption('interface'); await expect(page.locator('#audio-routing-status')).toContainText('DJ interface');
  await page.locator('#detect-outputs').click(); await page.locator('#preview-output').selectOption('interface');
  await page.locator('#audio-master-right').fill('1'); await page.locator('#audio-map-master').click(); await expect(page.locator('#audio-routing-status')).toContainText('channels 1/1');
  await page.locator('#audio-cue-left').fill('2'); await page.locator('#audio-map-cue').click(); await expect(page.locator('#audio-routing-status')).toContainText('channels 2/2');
  await expect(page.locator('#audio-routing-status')).toContainText('shared output'); await page.locator('#audio-confirm-channels').check(); await expect(page.locator('#audio-routing-status')).toContainText('separate route configured');
  await page.locator('[data-close=settings-dialog]').click(); await nav(page, 'library'); await page.locator('[data-action=play][data-id=a]').click(); await expect.poll(() => page.evaluate(() => testAudio[0].paused)).toBe(false);
  await page.evaluate(() => { window.testDevices = window.testDevices.filter(device => device.deviceId !== 'interface'); navigator.mediaDevices.dispatchEvent(new Event('devicechange')); });
  await expect.poll(() => page.evaluate(() => testAudio[0].paused)).toBe(true); await settings(page); await expect(page.locator('#audio-routing-status')).toContainText('Master output disconnected'); await expect(page.locator('#audio-confirm-channels')).not.toBeChecked();
  await page.locator('#audio-detect-outputs').click(); await page.locator('#audio-master-output').selectOption(''); await expect(page.locator('#audio-routing-status')).toContainText('System output');
});

test('unsupported master selection and rejected channels retain the working system route', async ({ page }) => {
  await simulatedOutputs(page, false); await bootstrap(page); await settings(page); await page.locator('#audio-detect-outputs').click(); await page.locator('#audio-master-output').selectOption('interface');
  await expect(page.locator('#notice')).toContainText('cannot choose a master output'); await expect(page.locator('#audio-master-output')).toHaveValue('');
  await page.locator('#audio-master-left').fill('9'); await page.locator('#audio-map-master').click(); await expect(page.locator('#notice')).toContainText('output channels from 1 to'); await expect(page.locator('#audio-routing-status')).toContainText('channels 1/2');
  await page.locator('[data-close=settings-dialog]').click(); await nav(page, 'library'); await page.locator('[data-action=play][data-id=a]').click(); await expect.poll(() => page.evaluate(() => testAudio[0].paused)).toBe(false);
});

test('late processing cannot apply after Live is enabled', async ({ page }) => {
  await bootstrap(page); await nav(page, 'library'); await page.locator('[data-action=play][data-id=a]').click(); await nav(page, 'deck'); await page.locator('#play-pause').click(); await expect.poll(() => page.evaluate(() => testAudio[0].paused)).toBe(true);
  const originalUrl = await page.evaluate(() => testAudio[0].src); await settings(page); await page.locator('#audio-processing-enabled').check(); await delayDecode(page); await page.locator('#audio-apply-processing').click(); await expect.poll(() => page.evaluate(() => pendingDecode.length)).toBe(1);
  await page.locator('[data-close=settings-dialog]').click(); await page.locator('#live-mode').check(); await page.evaluate(() => releaseDecode()); await settings(page);
  await expect(page.locator('#audio-processing-status')).toContainText('Audio settings canceled'); await expect(page.locator('#audio-processing-enabled')).not.toBeChecked(); expect(await page.evaluate(() => testAudio[0].src)).toBe(originalUrl);
});
