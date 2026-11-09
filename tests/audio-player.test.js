import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Player } from '../src/player.js';
import { audioJob } from '../src/audio-service.js';
import { channelGraph } from '../src/audio-routing.js';
import { pcmWav, measureLoudness } from '../src/audio-measurement.js';
import { sine, wavChannels } from './audio-fixtures.js';

const names = ['Audio', 'window', 'document', 'navigator', 'AudioContext', 'Worker'];
const originals = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
let players, contexts, devices, mediaDevices, decodeGate, resumeGate;
class Node {
  constructor() { this.connections = new Set(); this.gain = { value: 1, setValueAtTime(value) { this.value = value; }, setTargetAtTime(value) { this.value = value; }, cancelScheduledValues() {} }; }
  connect(target, output = 0, input = 0) { this.connections.add(target); this.lastConnection = { target, output, input }; }
  disconnect(target) { if (target) this.connections.delete(target); else this.connections.clear(); }
}
class Context {
  constructor() { this.currentTime = 0; this.destination = { maxChannelCount: 8, channelCount: 2 }; this.sinkId = ''; this.sources = []; this.nodes = []; contexts.push(this); }
  createGain() { const node = new Node(); this.nodes.push(node); return node; }
  createChannelSplitter() { return this.createGain(); }
  createChannelMerger() { if (this.mergerError) throw new Error('Channel graph unavailable'); return this.createGain(); }
  createMediaElementSource(element) { this.sources.push(element); return this.createGain(); }
  async resume() { if (resumeGate) await resumeGate.promise; }
  async close() { this.closed = true; }
  async setSinkId(id) { if (this.sinkError) throw new Error('Disconnected output'); this.sinkId = id; }
  async decodeAudioData(bytes) { if (decodeGate) await decodeGate.promise; const pcm = await wavChannels(new Blob([bytes])); return { sampleRate: pcm.sampleRate, numberOfChannels: pcm.channels.length, duration: pcm.channels[0].length / pcm.sampleRate, getChannelData: index => pcm.channels[index] }; }
}
class Audio extends EventTarget {
  constructor() { super(); this.paused = true; this.duration = 10; this.currentTime = 0; this.sinkId = ''; }
  pause() { this.paused = true; }
  async play() { this.paused = false; }
  async setSinkId(id) { this.sinkId = id; }
}
const output = (deviceId, groupId) => ({ kind: 'audiooutput', deviceId, groupId, label: `Output ${deviceId}` });
const track = id => ({ id, source: 'local', title: id, duration: 10, contentHash: id.repeat(64) });
const file = () => pcmWav([sine(16000, 1, 0.1)], 16000);
const player = () => { const value = new Player(() => {}, () => {}, () => {}); players.push(value); return value; };
beforeEach(() => {
  players = []; contexts = []; decodeGate = null; resumeGate = null;
  devices = [output('default', 'speakers'), output('interface', 'interface'), output('headphones', 'headphones')];
  mediaDevices = new EventTarget(); mediaDevices.enumerateDevices = async () => devices;
  const values = { Audio, AudioContext: Context, window: { AudioContext: Context }, document: { querySelector: () => ({ hidden: true }) }, navigator: { mediaDevices }, Worker: undefined };
  for (const [name, value] of Object.entries(values)) Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
});
afterEach(() => {
  for (const value of players) { value.stop(); clearInterval(value.timer); for (const id of [...value.urls.keys()]) value.revoke(id); }
  for (const [name, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
});

test('failed channel construction keeps the previous master graph connected', async () => {
  const value = player(); await value.context(); const previous = value._masterGraph;
  value.ctx.mergerError = true;
  await assert.rejects(value.setOutputChannels('master', [3, 4]), /unavailable/);
  assert.equal(value._masterGraph, previous); assert.deepEqual(value.masterChannels, [1, 2]); assert.ok(value.gain.connections.has(value.ctx.destination));
});

test('failed channel activation restores the previous destination channel count and route', async () => {
  const value = player(); await value.context(); const destination = value.ctx.destination;
  Object.defineProperty(destination, 'channelCount', { get: () => 2, set: count => { if (count > 2) throw new Error('Hardware rejects channels'); } });
  await assert.rejects(value.setOutputChannels('master', [3, 4]), /Hardware rejects/);
  assert.deepEqual(value.masterChannels, [1, 2]); assert.ok(value.gain.connections.has(destination));
});

test('cue validation and sink failures close only the temporary contexts', async () => {
  const value = player(); await value.context();
  await assert.rejects(value.setOutputChannels('cue', [9, 10]), /1 to 8/);
  assert.equal(contexts.at(-1).closed, true); assert.equal(value._previewContext, undefined); assert.equal(value.ctx.closed, undefined);
  await value.setPreviewOutput('headphones');
  const native = Context.prototype.setSinkId; Context.prototype.setSinkId = async function() { throw new Error('Disconnected output'); };
  try { await assert.rejects(value.setOutputChannels('cue', [3, 4]), /Disconnected/); } finally { Context.prototype.setSinkId = native; }
  assert.equal(contexts.at(-1).closed, true); assert.equal(value.previewOutputId, 'headphones');
});

test('hardware channel isolation requires explicit confirmation and is invalidated by device changes', async () => {
  const value = player(); await value.setMasterOutput('interface'); await value.setPreviewOutput('interface'); await value.setOutputChannels('cue', [3, 4]);
  assert.equal(value.hasSeparatePreviewOutput, false); value.confirmChannelIsolation(true); assert.equal(value.hasSeparatePreviewOutput, true);
  await value.play(track('a'), file(), 0, false); await value.previewSegment(track('b'), file(), { startSeconds: 2, endSeconds: 4 });
  assert.equal(value.preview.paused, false); mediaDevices.dispatchEvent(new Event('devicechange'));
  assert.equal(value.preview.paused, true); assert.equal(value.hasSeparatePreviewOutput, false); assert.equal(value._channelIsolationConfirmed, false);
});

test('YouTube compares cue to system output and never accepts shared interface channel confirmation', async () => {
  const value = player(); await value.setMasterOutput('interface'); await value.setPreviewOutput('interface'); await value.setOutputChannels('cue', [3, 4]); value.confirmChannelIsolation(true);
  value.track = { source: 'youtube' }; assert.equal(value.hasSeparatePreviewOutput, true); // Interface is a separate device from system speakers.
  await value.setPreviewOutput('default'); value.confirmChannelIsolation(true); assert.equal(value.hasSeparatePreviewOutput, false);
});

test('selected master loss pauses local playback and recovery requires explicit output selection', async () => {
  const value = player(); await value.setMasterOutput('interface'); await value.play(track('a'), file(), 0, false);
  devices = devices.filter(device => device.deviceId !== 'interface'); await value.getAudioOutputs();
  assert.equal(value.outputStatus.missing, true); assert.equal(value.audio.paused, true);
  await assert.rejects(value.toggle(), /Master output disconnected/);
  await value.setMasterOutput(''); assert.equal(value.outputStatus.missing, false); assert.equal(await value.toggle(), true);
});

test('pending mapping cannot start playback and Stop cancels it without changing mapping', async () => {
  const value = player(); await value.context(); resumeGate = deferred();
  const pending = value.setOutputChannels('master', [3, 4]);
  await assert.rejects(value.play(track('a'), file(), 0, false), /Wait for/); value.stop(); resumeGate.resolve();
  assert.equal(await pending, false); assert.deepEqual(value.masterChannels, [1, 2]);
});

test('master selection aborted during sink change rolls back the prior sink', async () => {
  const value = player(); await value.context(); const gate = deferred(), native = value.ctx.setSinkId;
  value.ctx.setSinkId = async function(id) { if (id === 'interface') await gate.promise; return native.call(this, id); };
  let canApply = true; const pending = value.setMasterOutput('interface', { canApply: () => canApply });
  await new Promise(resolve => setImmediate(resolve)); canApply = false; gate.resolve();
  assert.equal(await pending, false); assert.equal(value.masterOutputId, 'default'); assert.equal(value.ctx.sinkId, '');
});

test('processing and bypass replace the real loaded source while preserving paused position', async () => {
  const value = player(), original = file(); await value.play(track('a'), original, 0, true); value.audio.pause(); value.audio.currentTime = 0.4;
  const initialUrl = value.audio.src;
  assert.equal(await value.setLoudnessProcessing({ enabled: true }), true); assert.notEqual(value.audio.src, initialUrl); assert.equal(value.audio.currentTime, 0.4); assert.equal(value.audio.paused, true); assert.equal(value._currentProcessed, true);
  assert.equal(value.processingResult.after.integratedLufs, -18); assert.equal(value.targetGain(), value.volume);
  assert.equal(await value.setLoudnessProcessing({ enabled: true, bypass: true }), true); assert.equal(value.audio.src, initialUrl); assert.equal(value.audio.currentTime, 0.4); assert.equal(value._currentProcessed, false);
});

test('late processing respects Live protection, Stop and changed source identity', async () => {
  for (const [cancel, unlock] of [[value => value.stop(), true], [value => { value.track.contentHash = 'c'.repeat(64); }, true], [() => {}, false]]) {
    const value = player(); await value.play(track('a'), file(), 0, false); value.audio.pause(); const initialUrl = value.audio.src;
    decodeGate = deferred(); let canApply = true;
    const pending = value.setLoudnessProcessing({ enabled: true }, { canApply: () => canApply });
    await new Promise(resolve => setImmediate(resolve)); cancel(value); canApply = unlock; decodeGate.resolve();
    assert.equal(await pending, false); assert.equal(value.audio.src, initialUrl); assert.equal(value.processing.enabled, false); decodeGate = null;
  }
});

test('master start cancels a processed preview while decoding shared-output audio', async () => {
  const value = player(); decodeGate = deferred();
  const pending = value.previewSegment(track('b'), file(), { processed: true, startSeconds: 0, endSeconds: 1 });
  await new Promise(resolve => setImmediate(resolve)); await value.play(track('a'), file(), 0, false); decodeGate.resolve();
  assert.equal(await pending, false); assert.equal(value.preview.paused, true); assert.equal(value.audio.paused, false);
});

test('segment audition stops at the requested end and late processed audition is canceled', async () => {
  const value = player(); await value.previewSegment(track('a'), file(), { startSeconds: 2, endSeconds: 3 });
  assert.equal(value.preview.currentTime, 2); value.preview.currentTime = 3; value.preview.dispatchEvent(new Event('timeupdate')); assert.equal(value.preview.paused, true);
  decodeGate = deferred(); const pending = value.previewSegment(track('b'), file(), { processed: true, startSeconds: 0, endSeconds: 1 }); value.stopPreview(); decodeGate.resolve();
  assert.equal(await pending, false); assert.equal(value.preview.paused, true);
  await assert.rejects(value.previewSegment(track('a'), file(), { startSeconds: 10, endSeconds: 11 }), /before the recording ends/);
});

test('mono mapped to one physical channel averages both inputs to avoid doubling output', () => {
  const context = new Context(), source = new Node(); channelGraph(context, source, [3, 3]);
  const gains = context.nodes.filter(node => node.lastConnection?.input === 2);
  assert.equal(gains.length, 2); assert.ok(gains.every(node => node.gain.value === 0.5));
});

test('workers time out, terminate and fall back safely when postMessage fails', async () => {
  let instance;
  globalThis.Worker = class { constructor() { instance = this; } terminate() { this.terminated = true; } postMessage() {} };
  await assert.rejects(audioJob([sine(16000, 0.5)], 16000, undefined, { timeoutMs: 10 }), /took too long/); assert.equal(instance.terminated, true);
  globalThis.Worker = class { constructor() { instance = this; } terminate() { this.terminated = true; } postMessage() { throw new Error('Unavailable'); } };
  const signal = sine(16000, 0.5, 0.1); assert.deepEqual(await audioJob([signal], 16000), measureLoudness([signal], 16000)); assert.equal(instance.terminated, true);
});
