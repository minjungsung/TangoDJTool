// Reproduce digital evidence: node tests/audio-evidence.js [--historical]
// Historical MP3 downloads must already exist in the OS temporary directory.
// Historical recordings and their processed derivatives are never redistributed.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { measureLoudness, processPCM, pcmWav } from '../src/audio-measurement.js';
import { analyzeSamples } from '../src/analysis.js';
import { expressiveTransfer } from './audio-fixtures.js';

const destination = new URL('./fixtures/audio/', import.meta.url);
await mkdir(destination, { recursive: true });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function independentMeasure(path) {
  const run = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true:framelog=verbose', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 2000000 });
  if (run.status !== 0) throw new Error(run.stderr);
  const summary = run.stderr.split('Summary:').at(-1);
  return { integratedLufs: Number(summary.match(/I:\s*(-?\d+(?:\.\d+)?)\s*LUFS/)[1]), truePeakDb: Number(summary.match(/Peak:\s*(-?\d+(?:\.\d+)?)\s*dBFS/)[1]) };
}
const generated = [];
for (const [name, amplitude, transient] of [['expressive-transfer', 0.18, false], ['transient-transfer', 0.17, true]]) {
  const rate = 16000, input = expressiveTransfer({ rate, seconds: 16, amplitude });
  if (transient) for (let second = 1; second < 16; second += 2) input[second * rate] = 0.97;
  const settings = { enabled: true, targetLufs: -18, headroomDb: 1, limiter: true }, processed = processPCM([input], rate, settings);
  const originalBytes = Buffer.from(await pcmWav([input], rate).arrayBuffer()), processedBytes = Buffer.from(await pcmWav(processed.channels, rate).arrayBuffer());
  await writeFile(new URL(`${name}-original.wav`, destination), originalBytes); await writeFile(new URL(`${name}-processed.wav`, destination), processedBytes);
  const beforePath = new URL(`${name}-original.wav`, destination), afterPath = new URL(`${name}-processed.wav`, destination);
  generated.push({ name, source: 'Deterministic generated melody, expressive pulse, wow, noise and optional transient; not a historical recording.', original: { file: `${name}-original.wav`, sha256: hash(originalBytes), ...processed.before, ffmpeg: independentMeasure(beforePath.pathname) }, processed: { file: `${name}-processed.wav`, sha256: hash(processedBytes), ...processed.after, ffmpeg: independentMeasure(afterPath.pathname) }, settings, gainDb: processed.gainDb, reductionDb: processed.reductionDb, tempo: analyzeSamples(input, rate) });
}
await writeFile(new URL('generated-evidence.json', destination), `${JSON.stringify({ evidence: 'Digital PCM measurement and reproducible A/B artifacts. No physical output or human listening verification.', fixtures: generated }, null, 2)}\n`);
console.log(JSON.stringify(generated.map(({ name, original, processed, gainDb, reductionDb }) => ({ name, before: original.ffmpeg, after: processed.ffmpeg, gainDb, reductionDb }))));

if (process.argv.includes('--historical')) {
  const sources = [
    { name: 'nelly', identifier: '78_nelly_the-orquesta-tipica-francisco-canaro-hector-bates_gbia3007392a', filename: 'NELLY - The Orquesta Tipica FRANCISCO CANARO.mp3', description: 'Waltz, 78-rpm transfer' },
    { name: 'sufro', identifier: '78_sufro-i-suffer_orquesta-tipica-francisco-canaro-canaro-blanco_gbia3007687b', filename: 'SUFRO (I Suffer) - ORQUESTA TIPICA FRANCISCO CANARO.mp3', description: 'Tango con canto, 78-rpm transfer' },
  ];
  const measured = [];
  for (const source of sources) {
    const workingDirectory = process.env.TANGO_AUDIO_EVIDENCE_DIR || tmpdir();
    const inputPath = join(workingDirectory, `tango-audio-evidence-${source.name}.mp3`), rawPath = join(workingDirectory, `tango-audio-evidence-${source.name}.f32`), outputPath = join(workingDirectory, `tango-audio-evidence-${source.name}-processed.wav`);
    const inputBytes = await readFile(inputPath), decode = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', inputPath, '-ar', '48000', '-ac', '2', '-f', 'f32le', rawPath], { encoding: 'utf8' });
    if (decode.status !== 0) throw new Error(decode.stderr);
    const raw = await readFile(rawPath), frames = raw.length / 8, channels = [new Float32Array(frames), new Float32Array(frames)];
    for (let i = 0; i < frames; i++) for (let channel = 0; channel < 2; channel++) channels[channel][i] = raw.readFloatLE((i * 2 + channel) * 4);
    const started = performance.now(), settings = { enabled: true, targetLufs: -18, headroomDb: 1, limiter: true }, processed = processPCM(channels, 48000, settings), elapsedSeconds = (performance.now() - started) / 1000;
    const mono = new Float32Array(Math.min(frames, 48000 * 180)); for (let i = 0; i < mono.length; i++) mono[i] = (channels[0][i] + channels[1][i]) / 2;
    const exported = Buffer.from(await pcmWav(processed.channels, 48000).arrayBuffer()); await writeFile(outputPath, exported);
    measured.push({ source: { url: `https://archive.org/download/${source.identifier}/${encodeURIComponent(source.filename)}`, metadataUrl: `https://archive.org/metadata/${source.identifier}`, description: source.description, bytes: inputBytes.length, sha256: hash(inputBytes) }, decoded: { sampleRate: 48000, channels: 2, seconds: frames / 48000 }, original: { ...processed.before, ffmpeg: independentMeasure(inputPath) }, processed: { ...processed.after, ffmpeg: independentMeasure(outputPath), sha256: hash(exported), gainDb: processed.gainDb, reductionDb: processed.reductionDb }, settings, tempo: { ...analyzeSamples(mono, 48000), analyzedSeconds: mono.length / 48000, interpretation: 'Estimate only; no verified BPM ground truth, beat grid or musical suitability.' }, softwareProcessingSeconds: Math.round(elapsedSeconds * 100) / 100 });
    console.log(JSON.stringify(measured.at(-1)));
  }
  await writeFile(new URL('historical-evidence.json', destination), `${JSON.stringify({ evidence: 'Independent FFmpeg digital PCM comparison. Audio and processed historical derivatives remained temporary and are not included. No physical output or human listening verification.', ffmpegVersion: spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' }).stdout.split('\n')[0], recordings: measured }, null, 2)}\n`);
}
