import { analyzeSamples } from './analysis.js';
import { measureLoudness, processPCM, pcmWav, processingOptions } from './audio-measurement.js';

export async function decodeRecording(file) {
  const Context = globalThis.AudioContext || globalThis.webkitAudioContext || globalThis.window?.AudioContext || globalThis.window?.webkitAudioContext;
  if (!Context) throw new Error('Audio measurement is unavailable in this browser.');
  const context = new Context();
  try {
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    if (buffer.numberOfChannels > 2) throw new Error('Audio measurement supports mono and stereo recordings.');
    return { channels: Array.from({ length: buffer.numberOfChannels }, (_, index) => new Float32Array(buffer.getChannelData(index))), sampleRate: buffer.sampleRate, duration: buffer.duration };
  } finally { await context.close(); }
}
export async function audioJob(channels, sampleRate, processing, { timeoutMs = 120000 } = {}) {
  let worker;
  try { worker = new Worker(new URL('./analysis-worker.js', import.meta.url), { type: 'module' }); }
  catch { return processing ? processPCM(channels, sampleRate, processing) : measureLoudness(channels, sampleRate); }
  return new Promise((resolve, reject) => {
    let done = false, timeout;
    const finish = (error, result) => { if (done) return; done = true; clearTimeout(timeout); worker.terminate(); error ? reject(error) : resolve(result); };
    worker.onmessage = ({ data }) => finish(data.error ? new Error(data.error) : null, data.result);
    const fallback = event => { event?.preventDefault?.(); if (done) return; try { finish(null, processing ? processPCM(channels, sampleRate, processing) : measureLoudness(channels, sampleRate)); } catch (error) { finish(error); } };
    worker.onerror = fallback;
    timeout = setTimeout(() => finish(new Error('Audio measurement took too long. Try a shorter mono or stereo recording.')), timeoutMs);
    try { worker.postMessage({ channels, sampleRate, measureLoudness: true, processing }); } catch { fallback(); }
  });
}
export async function measureFile(file) {
  const decoded = await decodeRecording(file), result = await audioJob(decoded.channels, decoded.sampleRate);
  const length = Math.min(decoded.channels[0].length, decoded.sampleRate * 180), mono = new Float32Array(length);
  for (const channel of decoded.channels) for (let i = 0; i < length; i++) mono[i] += channel[i] / decoded.channels.length;
  return { ...analyzeSamples(mono, decoded.sampleRate), ...result, duration: decoded.duration };
}
const prepared = new WeakMap();
export async function prepareRecording(file, options) {
  const settings = processingOptions(options);
  if (!settings.enabled || settings.bypass) return { file, bypassed: true };
  const key = JSON.stringify(settings); let cache = prepared.get(file);
  if (!cache) { cache = new Map(); prepared.set(file, cache); }
  if (!cache.has(key)) cache.set(key, (async () => {
    const { channels, sampleRate } = await decodeRecording(file), result = await audioJob(channels, sampleRate, settings);
    return { file: pcmWav(result.channels, sampleRate), before: result.before, after: result.after, gainDb: result.gainDb, reductionDb: result.reductionDb, bypassed: false };
  })().catch(error => { cache.delete(key); throw error; }));
  return cache.get(key);
}
