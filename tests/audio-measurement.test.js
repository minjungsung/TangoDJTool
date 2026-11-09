import test from 'node:test';
import assert from 'node:assert/strict';
import { measureLoudness, truePeak, processPCM, pcmWav, processingOptions } from '../src/audio-measurement.js';
import { analyzeSamples, TapTempo } from '../src/analysis.js';
import { sine, expressiveTransfer, wavChannels } from './audio-fixtures.js';

const near = (actual, expected, tolerance = 0.05) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} expected ${expected} ± ${tolerance}`);

// Independent reference: published BS.1770 48 kHz coefficients, steady-state
// transfer response, rather than reusing the production filter implementation.
function referenceLufs(frequency, amplitude, count = 1) {
  const w = 2 * Math.PI * frequency / 48000;
  const power = (b, a) => {
    const real = b[0] + b[1] * Math.cos(w) + b[2] * Math.cos(2 * w);
    const imaginary = -b[1] * Math.sin(w) - b[2] * Math.sin(2 * w);
    const dr = 1 + a[0] * Math.cos(w) + a[1] * Math.cos(2 * w), di = -a[0] * Math.sin(w) - a[1] * Math.sin(2 * w);
    return (real * real + imaginary * imaginary) / (dr * dr + di * di);
  };
  const shelf = power([1.53512485958697, -2.69169618940638, 1.19839281085285], [-1.69065929318241, 0.73248077421585]);
  const rlb = power([1, -2, 1], [-1.99004745483398, 0.99007225036621]);
  return -0.691 + 10 * Math.log10(amplitude * amplitude / 2 * shelf * rlb * count);
}

test('K-weighted mono and stereo loudness match published coefficient response', () => {
  for (const frequency of [100, 1000, 4000]) {
    const signal = sine(48000, 1, 0.1, frequency);
    near(measureLoudness([signal], 48000).integratedLufs, referenceLufs(frequency, 0.1));
    near(measureLoudness([signal, signal], 48000).integratedLufs, referenceLufs(frequency, 0.1, 2));
  }
});

test('opposite stereo polarity retains energy and absolute silence remains below the gate', () => {
  const signal = sine(48000, 0.8, 0.1), opposite = signal.map(value => -value);
  near(measureLoudness([signal, opposite], 48000).integratedLufs, referenceLufs(1000, 0.1, 2));
  assert.deepEqual(measureLoudness([new Float32Array(8000)], 8000), { integratedLufs: null, truePeakDb: -180, measuredSeconds: 1, loudnessAnalysisVersion: 'bs1770-k-4x-v1' });
});

test('relative gating excludes an extended low-level tail', () => {
  const loud = sine(48000, 1.6, 0.1), quiet = sine(48000, 1.6, 0.001), combined = new Float32Array(loud.length + quiet.length);
  combined.set(loud); combined.set(quiet, loud.length);
  near(measureLoudness([combined], 48000).integratedLufs, measureLoudness([loud], 48000).integratedLufs, 0.5);
});

test('reconstructed peaks detect between-sample clipping hidden by sample peaks', () => {
  const signal = sine(48000, 0.1, 1, 12000, Math.PI / 4), samplePeak = signal.reduce((maximum, value) => Math.max(maximum, Math.abs(value)), 0);
  near(samplePeak, Math.SQRT1_2, 0.00001);
  assert.ok(truePeak([signal]) > samplePeak * 1.35);
});

test('opt-in gain changes quiet PCM to target and bypass leaves every sample identical', () => {
  const input = [sine(48000, 1, 0.1)]; const output = processPCM(input, 48000, { enabled: true, targetLufs: -18 });
  near(output.after.integratedLufs, -18); assert.ok(output.gainDb > 4); assert.equal(output.bypassed, false);
  const bypass = processPCM(input, 48000, { enabled: true, bypass: true });
  assert.deepEqual(bypass.channels[0], input[0]); assert.notEqual(bypass.channels[0], input[0]); assert.equal(bypass.gainDb, 0);
  assert.equal(processingOptions().enabled, false);
});

test('limiting keeps linked stereo channels aligned and exported PCM below reconstructed ceiling', async () => {
  const signal = expressiveTransfer({ rate: 16000, seconds: 4, amplitude: 0.15 }); signal[12345] = 0.95;
  const output = processPCM([signal, signal.map(value => value * 0.5)], 16000, { enabled: true, targetLufs: -12, headroomDb: 2, limiter: true });
  assert.ok(output.reductionDb > 0); assert.ok(output.after.truePeakDb <= -2);
  for (let i = 0; i < signal.length; i++) near(output.channels[1][i], output.channels[0][i] * 0.5, 1e-7);
  const exported = await wavChannels(pcmWav(output.channels, 16000));
  assert.ok(measureLoudness(exported.channels, exported.sampleRate).truePeakDb <= -2);
});

test('no-limiter mode respects headroom with static gain instead of deforming transients', () => {
  const input = [expressiveTransfer({ seconds: 2, amplitude: 0.1 })]; input[0][8000] = 0.9;
  const output = processPCM(input, 16000, { enabled: true, targetLufs: -12, headroomDb: 3, limiter: false });
  assert.ok(output.after.truePeakDb <= -3); assert.ok(output.after.integratedLufs < -12);
  const gain = output.channels[0][8000] / input[0][8000];
  for (let i = 0; i < input[0].length; i += 83) near(output.channels[0][i], input[0][i] * gain, 1e-7);
});

test('invalid measurements and settings fail explicitly', () => {
  for (const [channels, rate] of [[[], 48000], [[new Float32Array(0)], 48000], [[new Float32Array([NaN])], 48000], [[new Float32Array(8), new Float32Array(9)], 48000], [[sine()], 1]]) assert.throws(() => measureLoudness(channels, rate));
  for (const settings of [{ enabled: 1 }, { targetLufs: -5 }, { headroomDb: 0 }, { limiter: null }]) assert.throws(() => processingOptions(settings));
});

test('steady pulse confidence decreases for expressive transfers and candidates expose octave uncertainty', () => {
  const steady = analyzeSamples(expressiveTransfer({ expressive: false, transfer: false }), 16000);
  const expressive = analyzeSamples(expressiveTransfer(), 16000);
  assert.equal(steady.bpm, 120); assert.ok(steady.bpmConfidence > 0.7);
  assert.ok(expressive.bpmConfidence < steady.bpmConfidence - 0.3);
  assert.deepEqual(steady.bpmCandidates, [120, 60, 240]);
  assert.equal(analyzeSamples(new Float32Array(16000 * 4), 16000).bpm, null);
  assert.equal(analyzeSamples(sine(16000, 2), 16000).bpmConfidence, 0);
});

test('tap tempo requires four taps, resists one outlier and resets after pauses or clock reversal', () => {
  const tap = new TapTempo();
  for (const time of [0, 500, 1000]) assert.equal(tap.tap(time), null);
  assert.equal(tap.tap(1500), 120); tap.tap(2300); assert.equal(tap.tap(2800), 120);
  assert.equal(tap.tap(7000), null); assert.equal(tap.taps.length, 1);
  assert.equal(tap.tap(6999), null); assert.equal(tap.taps.length, 1);
  tap.reset(); assert.equal(tap.taps.length, 0); assert.throws(() => tap.tap(NaN));
});
