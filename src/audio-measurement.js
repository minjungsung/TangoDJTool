const db = value => 20 * Math.log10(Math.max(value, 1e-9));
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
export const loudnessAnalysisVersion = 'bs1770-k-4x-v1';

function coefficients(rate, shelf) {
  const frequency = shelf ? 1681.974450955533 : 38.13547087602444;
  const q = shelf ? 0.7071752369554196 : 0.5003270373238773;
  const k = Math.tan(Math.PI * frequency / rate), k2 = k * k, denominator = 1 + k / q + k2;
  if (!shelf) return { b: [1, -2, 1], a: [2 * (k2 - 1) / denominator, (1 - k / q + k2) / denominator] };
  const high = 10 ** (3.999843853973347 / 20), middle = high ** 0.4996667741545416;
  return { b: [(high + middle * k / q + k2) / denominator, 2 * (k2 - high) / denominator, (high - middle * k / q + k2) / denominator], a: [2 * (k2 - 1) / denominator, (1 - k / q + k2) / denominator] };
}
function gatedPowers(channels, rate) {
  const shelf = coefficients(rate, true), highpass = coefficients(rate, false);
  const histories = channels.map(() => new Float64Array(8));
  const block = Math.round(rate * 0.4), hop = Math.round(rate * 0.1), ring = new Float64Array(block), powers = [];
  let sum = 0;
  for (let i = 0; i < channels[0].length; i++) {
    let power = 0;
    for (let channel = 0; channel < channels.length; channel++) {
      const history = histories[channel], x = channels[channel][i];
      const y = shelf.b[0] * x + shelf.b[1] * history[0] + shelf.b[2] * history[1] - shelf.a[0] * history[2] - shelf.a[1] * history[3];
      history[1] = history[0]; history[0] = x; history[3] = history[2]; history[2] = y;
      const z = highpass.b[0] * y + highpass.b[1] * history[4] + highpass.b[2] * history[5] - highpass.a[0] * history[6] - highpass.a[1] * history[7];
      history[5] = history[4]; history[4] = y; history[7] = history[6]; history[6] = z;
      power += z * z;
    }
    const index = i % block; sum += power - ring[index]; ring[index] = power;
    if (i + 1 >= block && (i + 1 - block) % hop === 0) powers.push(Math.max(0, sum / block));
  }
  if (!powers.length) powers.push(Math.max(0, sum / channels[0].length));
  return powers;
}
const sinc = x => Math.abs(x) < 1e-12 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
const kernels = [1, 2, 3].map(phase => {
  const fraction = phase / 4, coefficients = [];
  for (let offset = -11; offset <= 12; offset++) { const distance = fraction - offset; coefficients.push(sinc(distance) * sinc(distance / 12)); }
  const sum = coefficients.reduce((a, b) => a + b, 0);
  return coefficients.map(value => value / sum);
});
export function truePeak(channels) {
  let peak = 0;
  for (const samples of channels) {
    for (let i = 0; i < samples.length; i++) {
      peak = Math.max(peak, Math.abs(samples[i]));
      for (const kernel of kernels) {
        let value = 0;
        for (let tap = 0; tap < kernel.length; tap++) value += (samples[i + tap - 11] || 0) * kernel[tap];
        peak = Math.max(peak, Math.abs(value));
      }
    }
  }
  return peak;
}
export function measureLoudness(channels, sampleRate) {
  if (!Array.isArray(channels) || !channels.length || channels.length > 2 || !Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000) throw new Error('Measure mono or stereo PCM at a supported sample rate.');
  const length = channels[0].length;
  if (!length || channels.some(channel => channel.length !== length || channel.some(value => !Number.isFinite(value)))) throw new Error('Audio samples are missing or invalid.');
  const powers = gatedPowers(channels, sampleRate);
  const absolute = powers.filter(power => -0.691 + 10 * Math.log10(Math.max(power, 1e-18)) >= -70);
  const mean = absolute.reduce((a, b) => a + b, 0) / Math.max(1, absolute.length);
  const gated = absolute.filter(power => power >= mean / 10);
  const integratedLufs = gated.length ? -0.691 + 10 * Math.log10(gated.reduce((a, b) => a + b, 0) / gated.length) : null;
  return { integratedLufs: integratedLufs == null ? null : Math.round(integratedLufs * 100) / 100, truePeakDb: Math.round(db(truePeak(channels)) * 100) / 100, loudnessAnalysisVersion, measuredSeconds: length / sampleRate };
}
export const defaultProcessing = Object.freeze({ enabled: false, bypass: false, targetLufs: -18, headroomDb: 1, limiter: true });
export function processingOptions(value = {}) {
  const result = { ...defaultProcessing, ...value };
  for (const field of ['enabled', 'bypass', 'limiter']) if (typeof result[field] !== 'boolean') throw new Error('Choose a valid loudness processing mode.');
  if (!Number.isFinite(result.targetLufs) || result.targetLufs < -30 || result.targetLufs > -12 || !Number.isFinite(result.headroomDb) || result.headroomDb < 0.5 || result.headroomDb > 12) throw new Error('Choose a target from −30 to −12 LUFS and headroom from 0.5 to 12 dB.');
  return result;
}
export function processPCM(channels, sampleRate, options = {}) {
  const settings = processingOptions(options), before = measureLoudness(channels, sampleRate);
  if (!settings.enabled || settings.bypass) return { channels: channels.map(channel => new Float32Array(channel)), before, after: before, gainDb: 0, reductionDb: 0, bypassed: true };
  const requestedDb = before.integratedLufs == null ? 0 : clamp(settings.targetLufs - before.integratedLufs, -12, 12);
  const ceiling = 10 ** (-(settings.headroomDb + 0.01) / 20);
  const appliedDb = settings.limiter ? requestedDb : Math.min(requestedDb, -settings.headroomDb - before.truePeakDb - 0.01);
  const gain = 10 ** (appliedDb / 20), output = channels.map(channel => Float32Array.from(channel, value => value * gain));
  let reductionDb = 0;
  if (settings.limiter) {
    const length = output[0].length, lookahead = Math.max(1, Math.round(sampleRate * 0.005)), maxima = new Float32Array(length);
    for (let i = 0; i < length; i++) for (const channel of output) maxima[i] = Math.max(maxima[i], Math.abs(channel[i]));
    const deque = new Int32Array(length), release = Math.exp(-1 / (sampleRate * 0.1)); let first = 0, last = 0, envelope = 1, next = 0;
    for (let i = 0; i < length; i++) {
      while (next < Math.min(length, i + lookahead + 1)) { while (last > first && maxima[deque[last - 1]] <= maxima[next]) last--; deque[last++] = next++; }
      while (last > first && deque[first] < i) first++;
      const target = Math.min(1, ceiling / Math.max(maxima[deque[first]], 1e-12));
      envelope = Math.min(target, release * envelope + (1 - release));
      for (const channel of output) channel[i] *= envelope;
      reductionDb = Math.max(reductionDb, -db(envelope));
    }
  }
  // Measure the reconstructed result too: sample limiting alone can miss intersample peaks.
  const reconstructed = truePeak(output), correction = Math.min(1, ceiling / Math.max(reconstructed, 1e-12));
  if (correction < 1) for (const channel of output) for (let i = 0; i < channel.length; i++) channel[i] *= correction;
  reductionDb += -db(correction);
  return { channels: output, before, after: measureLoudness(output, sampleRate), gainDb: Math.round(appliedDb * 100) / 100, reductionDb: Math.round(reductionDb * 100) / 100, bypassed: false };
}
export function pcmWav(channels, sampleRate) {
  const count = channels.length, length = channels[0].length, bytes = new ArrayBuffer(44 + length * count * 2), view = new DataView(bytes);
  const text = (offset, value) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, bytes.byteLength - 8, true); text(8, 'WAVE'); text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, count, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * count * 2, true); view.setUint16(32, count * 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, bytes.byteLength - 44, true);
  for (let i = 0; i < length; i++) for (let channel = 0; channel < count; channel++) view.setInt16(44 + (i * count + channel) * 2, Math.round(clamp(channels[channel][i], -1, 1) * 32767), true);
  return new Blob([bytes], { type: 'audio/wav' });
}
