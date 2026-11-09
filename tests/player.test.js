import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Player } from '../src/player.js';

const originalGlobals = new Map(['Audio', 'window', 'document', 'navigator', 'location'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
let players, devices, mediaDevices, resume;
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const track = id => ({ id, source: 'local', title: id, duration: 180 });
const file = () => new Blob(['test audio'], { type: 'audio/wav' });

class FakeAudio extends EventTarget {
  constructor() { super(); this.paused = true; this.currentTime = 0; this.duration = 180; this.sinkId = ''; this.playCalls = 0; this.pauseCalls = 0; this.playQueue = []; this.sinkCalls = []; }
  play() {
    this.playCalls++;
    const pending = this.playQueue.shift();
    const started = () => { this.paused = false; this.dispatchEvent(new Event('play')); };
    if (pending) return pending.then(started);
    started(); return Promise.resolve();
  }
  pause() { this.paused = true; this.pauseCalls++; this.dispatchEvent(new Event('pause')); }
  async setSinkId(id) { this.sinkCalls.push(id); if (this.sinkError) throw this.sinkError; this.sinkId = id; }
}
class FakeContext {
  constructor() { this.currentTime = 0; this.destination = {}; this.sources = []; }
  createGain() {
    return { connect() {}, gain: { value: 1, initialValues: [],
      setTargetAtTime(value) { this.value = value; },
      setValueAtTime(value) { this.value = value; this.initialValues.push(value); },
      cancelScheduledValues() {} } };
  }
  createMediaElementSource(element) { this.sources.push(element); return { connect() {} }; }
  resume() { return resume(); }
}
function player() { const result = new Player(() => {}, () => {}, () => {}); players.push(result); return result; }
async function localPlaying(result, id = 'master') { assert.equal(await result.play(track(id), file(), 0, false), true); }
const output = (deviceId, groupId) => ({ kind: 'audiooutput', deviceId, groupId, label: deviceId });
async function youtubeLoaded(result) {
  window.YT = { Player: class {
    constructor(id, options) { this.options = options; this.state = -1; this.position = 0; queueMicrotask(() => options.events.onReady()); }
    loadVideoById(value) { this.videoId = typeof value === 'string' ? value : value.videoId; this.emit(-1); }
    emit(state) { this.state = state; this.options.events.onStateChange({ data: state }); }
    getVideoUrl() { return `https://www.youtube.com/watch?v=${this.videoId}`; }
    getPlayerState() { return this.state; } getCurrentTime() { return this.position; } getDuration() { return 180; }
    setVolume() {} pauseVideo() { this.emit(2); } playVideo() { this.emit(-1); }
  } };
  assert.equal(await result.play({ id: 'video', source: 'youtube', videoId: 'abcdefghijk' }, null, 0, false), true);
  return result.youtube;
}

beforeEach(() => {
  players = []; devices = [output('default', 'speakers'), output('speakers-id', 'speakers'), output('headphones', 'headphones')]; resume = () => Promise.resolve();
  mediaDevices = new EventTarget(); mediaDevices.enumerateDevices = async () => devices;
  const values = { Audio: FakeAudio, window: { AudioContext: FakeContext }, document: { querySelector: () => ({ hidden: true }) }, navigator: { mediaDevices }, location: { origin: 'https://example.test' } };
  for (const [name, value] of Object.entries(values)) Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
});
afterEach(() => {
  for (const result of players) { result.stop(); clearInterval(result.timer); for (const id of result.urls.keys()) result.revoke(id); }
  for (const [name, descriptor] of originalGlobals) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
});

test('Stop cancels a local load before a delayed audio context resumes', async () => {
  const result = player(), gate = deferred(); resume = () => gate.promise;
  const pending = result.play(track('a'), file(), 0, false);
  assert.equal(result.starting, true); result.stop(); gate.resolve();
  assert.equal(await pending, false); assert.equal(result.audio.playCalls, 0); assert.equal(result.starting, false);
});

test('Stop cancels a delayed pause-resume operation', async () => {
  const result = player(), gate = deferred(); result.track = track('a'); resume = () => gate.promise;
  const pending = result.toggle(); result.stop(); gate.resolve();
  assert.equal(await pending, false); assert.equal(result.audio.playCalls, 0); assert.equal(result.audio.paused, true);
});

test('a late local play completion after Stop cannot restart audio', async () => {
  const result = player(), gate = deferred(); result.audio.playQueue.push(gate.promise);
  const pending = result.play(track('a'), file(), 0, false);
  await Promise.resolve(); await Promise.resolve();
  assert.equal(result.audio.playCalls, 1); result.stop(); gate.resolve();
  assert.equal(await pending, false); assert.equal(result.audio.paused, true);
});

test('an older load completion cannot pause a newer recording', async () => {
  const result = player(), gate = deferred(); result.audio.playQueue.push(gate.promise);
  const earlier = result.play(track('a'), file(), 0, false);
  await Promise.resolve(); await Promise.resolve();
  await localPlaying(result, 'b'); gate.resolve();
  assert.equal(await earlier, false); assert.equal(result.track.id, 'b'); assert.equal(result.audio.paused, false);
});

test('shared preview is blocked while master playback is active or starting', async () => {
  const result = player(); await localPlaying(result);
  await assert.rejects(result.previewTrack(track('cue'), file()), /shares the live output/);
  assert.equal(result.preview.playCalls, 0);
  result.stop(); const gate = deferred(); resume = () => gate.promise;
  const pending = result.play(track('next'), file(), 0, false);
  await assert.rejects(result.previewTrack(track('cue'), file()), /shares the live output/);
  result.stop(); gate.resolve(); assert.equal(await pending, false);
});

test('starting master playback cancels a pending shared preview', async () => {
  const result = player(), gate = deferred(); result.preview.playQueue.push(gate.promise);
  const pending = result.previewTrack(track('cue'), file());
  await localPlaying(result); gate.resolve();
  assert.equal(await pending, false); assert.equal(result.preview.paused, true); assert.equal(result.audio.paused, false);
});

test('Stop preview cancels a late start and leaves master playback alone', async () => {
  const result = player(); await result.setPreviewOutput('headphones'); await localPlaying(result);
  const gate = deferred(); result.preview.playQueue.push(gate.promise);
  const pending = result.previewTrack(track('cue'), file());
  await Promise.resolve(); await Promise.resolve();
  result.stopPreview(); gate.resolve();
  assert.equal(await pending, false); assert.equal(result.preview.paused, true); assert.equal(result.audio.paused, false); assert.equal(result.previewId, null);
});

test('newer preview survives an older preview completion', async () => {
  const result = player(), gate = deferred(); result.preview.playQueue.push(gate.promise);
  const earlier = result.previewTrack(track('a'), file());
  assert.equal(await result.previewTrack(track('b'), file()), true); gate.resolve();
  assert.equal(await earlier, false); assert.equal(result.previewId, 'b'); assert.equal(result.preview.paused, false);
});

test('explicit selection of the system default device is still shared', async () => {
  const result = player();
  assert.equal(await result.setPreviewOutput('speakers-id'), 'speakers-id');
  assert.equal(result.previewSinkId, 'speakers-id'); assert.equal(result.hasSeparatePreviewOutput, false);
  await localPlaying(result);
  await assert.rejects(result.previewTrack(track('cue'), file()), /shares the live output/);
});

test('dedicated preview routes through its media element and survives master advancement', async () => {
  const result = player(); await result.setPreviewOutput('headphones'); result.setPreviewVolume(0.3);
  await localPlaying(result); assert.equal(result.hasSeparatePreviewOutput, true);
  assert.equal(await result.previewTrack(track('cue'), file()), true);
  await localPlaying(result, 'next');
  assert.deepEqual(result.ctx.sources, [result.audio]); assert.equal(result.preview.paused, false);
  assert.equal(result.preview.volume, 0.3); assert.equal(result.previewOutputId, 'headphones');
  result.setVolume(0, false); assert.equal(result.preview.volume, 0.3);
});

test('unidentified default output groups cannot certify isolation', async () => {
  const result = player(); devices[0] = output('default', '');
  await result.setPreviewOutput('headphones'); assert.equal(result.hasSeparatePreviewOutput, false);
});

test('permission and disconnected output failures never silently reroute', async () => {
  const result = player(); await result.setPreviewOutput('headphones');
  result.preview.sinkError = new DOMException('Denied', 'NotAllowedError');
  await assert.rejects(result.setPreviewOutput('speakers-id'), /permission.*denied/);
  assert.equal(result.previewOutputId, 'headphones');
  await assert.rejects(result.setPreviewOutput('missing-device'), /unavailable/);
  assert.deepEqual(result.preview.sinkCalls, ['headphones', 'speakers-id']);
});

test('output changes stop preview before routing and cannot overlap', async () => {
  const result = player(); await result.previewTrack(track('cue'), file());
  const gate = deferred(); mediaDevices.enumerateDevices = () => gate.promise;
  const pending = result.setPreviewOutput('headphones');
  assert.equal(result.preview.paused, true);
  await assert.rejects(result.setPreviewOutput('speakers-id'), /Wait for the current/);
  await assert.rejects(result.previewTrack(track('cue'), file()), /output change/);
  gate.resolve(devices); assert.equal(await pending, 'headphones');
});

test('device changes immediately stop cue audio and invalidate isolation', async () => {
  const result = player(); await result.setPreviewOutput('headphones'); await localPlaying(result); await result.previewTrack(track('cue'), file());
  mediaDevices.dispatchEvent(new Event('devicechange'));
  assert.equal(result.hasSeparatePreviewOutput, false); assert.equal(result.preview.paused, true); assert.equal(result.audio.paused, false);
  devices = [output('default', 'speakers')];
  await assert.rejects(result.previewTrack(track('cue'), file()), /disconnected/);
});

test('unsupported output selection is explicit while silent-deck preview remains available', async () => {
  const result = player(); result.preview.setSinkId = undefined;
  await assert.rejects(result.getAudioOutputs(), /cannot choose a separate/);
  await assert.rejects(result.setPreviewOutput('headphones'), /cannot choose a separate/);
  assert.equal(await result.previewTrack(track('cue'), file()), true);
});

test('YouTube pending autoplay and buffering block shared preview until paused', async () => {
  const result = player(), provider = await youtubeLoaded(result);
  assert.equal(result.starting, false); assert.equal(result.mainPlaybackPending, true);
  await assert.rejects(result.previewTrack(track('cue'), file()), /shares the live output/);
  provider.emit(3); await assert.rejects(result.previewTrack(track('cue'), file()), /shares the live output/);
  await result.toggle(); assert.equal(provider.state, 2); assert.equal(result.mainPlaybackPending, false);
  assert.equal(await result.previewTrack(track('cue'), file()), true);
});

test('playing or buffering inside the YouTube iframe immediately stops shared preview', async () => {
  const result = player(), provider = await youtubeLoaded(result); provider.emit(2);
  await result.previewTrack(track('cue'), file()); provider.emit(1);
  assert.equal(result.preview.paused, true); assert.equal(result.previewId, null);
  provider.emit(2); await result.previewTrack(track('cue'), file()); provider.emit(3);
  assert.equal(result.preview.paused, true);
});

test('YouTube resume marks pending playback and Stop cancels it', async () => {
  const result = player(), provider = await youtubeLoaded(result); provider.emit(2);
  await result.previewTrack(track('cue'), file()); await result.toggle();
  assert.equal(result.mainPlaybackPending, true); assert.equal(result.preview.paused, true);
  await assert.rejects(result.previewTrack(track('cue'), file()), /shares the live output/);
  result.stop(); assert.equal(result.mainPlaybackPending, false);
  assert.equal(await result.previewTrack(track('cue'), file()), true);
});

test('Stop during delayed YouTube initialization never loads the video later', async () => {
  const result = player(), gate = deferred(); let loads = 0;
  result.loadYouTube = () => gate.promise;
  const pending = result.play({ id: 'video', source: 'youtube', videoId: 'abcdefghijk' }, null, 0, false);
  assert.equal(result.mainPlaybackPending, true); result.stop();
  gate.resolve({ loadVideoById() { loads++; } });
  assert.equal(await pending, false); assert.equal(loads, 0); assert.equal(result.mainPlaybackPending, false);
});

test('timed stopping preserves only verified dedicated preview; explicit Stop clears it', async () => {
  const result = player(); await result.setPreviewOutput('headphones'); await localPlaying(result); await result.previewTrack(track('cue'), file());
  result.stop({ preservePreview: true }); assert.equal(result.preview.paused, false); assert.equal(result.audio.paused, true);
  await localPlaying(result, 'next'); assert.equal(result.preview.paused, false);
  result.stop(); assert.equal(result.preview.paused, true);
  await result.setPreviewOutput('speakers-id'); await result.previewTrack(track('cue'), file());
  result.stop({ preservePreview: true }); assert.equal(result.preview.paused, true);
});

test('normalization and disabling fade during context loading control the first local gain', async () => {
  const result = player(), gate = deferred(); resume = () => gate.promise;
  const pending = result.play({ ...track('quiet'), gainDb: 12 }, file(), 4, false);
  result.setVolume(0.5, true); result.setFade(0); gate.resolve();
  assert.equal(await pending, true);
  const expected = 0.5 * 10 ** (12 / 20);
  assert.equal(result.normalize, true); assert.equal(result.fade, 0);
  assert.deepEqual(result.gain.gain.initialValues, [expected]); assert.equal(result.gain.gain.value, expected);
});

test('enabling fade during context loading starts the local recording silently', async () => {
  const result = player(), gate = deferred(); resume = () => gate.promise;
  const pending = result.play({ ...track('quiet'), gainDb: 12 }, file(), 0, false);
  result.setVolume(0.5, true); result.setFade(4); gate.resolve();
  assert.equal(await pending, true);
  assert.equal(result.normalize, true); assert.equal(result.fade, 4);
  assert.deepEqual(result.gain.gain.initialValues, [0]); assert.equal(result.level, 0);
  assert.equal(result.targetGain(), 0.5 * 10 ** (12 / 20));
});

test('fade changes during YouTube initialization control volume before loading the video', async () => {
  const result = player(), gate = deferred(), volumes = [], loads = [];
  result.loadYouTube = () => gate.promise;
  const pending = result.play({ id: 'video', source: 'youtube', videoId: 'abcdefghijk' }, null, 0, false);
  const provider = { setVolume(value) { volumes.push(value); }, loadVideoById() { loads.push(volumes.at(-1)); } };
  result.setVolume(0.4, true); result.setFade(4); result.youtube = provider; gate.resolve(provider);
  assert.equal(await pending, true); assert.equal(result.fade, 4); assert.equal(result.normalize, true);
  assert.deepEqual(loads, [0]); assert.equal(result.level, 0);
});

test('disabling fade during YouTube initialization avoids a stale silent start', async () => {
  const result = player(), gate = deferred(), volumes = [], loads = [];
  result.loadYouTube = () => gate.promise;
  const pending = result.play({ id: 'video', source: 'youtube', videoId: 'abcdefghijk' }, null, 4, true);
  const provider = { setVolume(value) { volumes.push(value); }, loadVideoById() { loads.push(volumes.at(-1)); } };
  result.setVolume(0.4, false); result.setFade(0); result.youtube = provider; gate.resolve(provider);
  assert.equal(await pending, true); assert.equal(result.fade, 0); assert.equal(result.normalize, false);
  assert.deepEqual(loads, [40]); assert.equal(result.level, 1);
});
