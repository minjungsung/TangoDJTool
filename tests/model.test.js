import test from 'node:test';
import assert from 'node:assert/strict';
import { youtubeId, flattenSet, removeTrack, validateSet } from '../src/model.js';
import { analyzeSamples } from '../src/analysis.js';

test('YouTube URLs accept canonical variants and reject unrelated hosts', () => {
  const id = 'abcdefghijk';
  for (const url of [`https://youtu.be/${id}?t=4`, `https://www.youtube.com/watch?v=${id}`, `https://m.youtube.com/shorts/${id}`, `https://youtube.com/live/${id}`]) assert.equal(youtubeId(url), id);
  for (const url of ['https://youtube.com.evil.test/watch?v=abcdefghijk', 'https://example.com/abcdefghijk', 'javascript:alert(1)', 'https://youtube.com/playlist?list=abc', 'https://youtu.be/short']) assert.equal(youtubeId(url), null);
});

test('set playback preserves group order, repeats, and cortinas', () => {
  const tracks = [{ id: 'a' }, { id: 'b' }];
  const groups = [{ id: 't', kind: 'tanda', name: 'Tanda', trackIds: ['a', 'a'] }, { id: 'c', kind: 'cortina', name: 'Cortina', trackIds: ['b', 'missing'] }];
  const queue = flattenSet(groups, tracks);
  assert.deepEqual(queue.map(t => t.track.id), ['a', 'a', 'b']);
  assert.equal(queue[2].kind, 'cortina');
  const removed = removeTrack({ tracks, groups }, 'a');
  assert.deepEqual(removed.groups[0].trackIds, []);
  assert.equal(groups[0].trackIds.length, 2);
});

test('set import rejects corrupt references, duplicate IDs, and invalid video data', () => {
  const valid = { version: 1, tracks: [{ id: 'a', source: 'local', title: 'Music' }], groups: [{ id: 'g', kind: 'tanda', name: 'Tanda', trackIds: ['a'] }] };
  assert.equal(validateSet(valid).tracks[0].title, 'Music');
  assert.throws(() => validateSet({ ...valid, version: 2 }));
  assert.throws(() => validateSet({ ...valid, tracks: [...valid.tracks, ...valid.tracks] }));
  assert.throws(() => validateSet({ ...valid, tracks: [{ ...valid.tracks[0], source: 'youtube', videoId: 'bad' }] }));
  assert.throws(() => validateSet({ ...valid, groups: [{ ...valid.groups[0], trackIds: ['missing'] }] }));
  assert.throws(() => validateSet({ ...valid, tracks: [{ ...valid.tracks[0], duration: -1 }] }));
});

test('tempo estimation recognizes a pulse train and measures its RMS and peak', () => {
  const sampleRate = 8000, samples = new Float32Array(sampleRate * 20);
  for (let start = 0; start < samples.length; start += sampleRate / 2) {
    for (let j = 0; j < 400; j++) samples[start + j] = .7 * Math.exp(-j / 80) * Math.sin(j * .2);
  }
  const result = analyzeSamples(samples, sampleRate);
  assert.ok(Math.abs(result.bpm - 120) <= 2, `Estimated ${result.bpm}`);
  assert.ok(result.rmsDb < -10 && result.rmsDb > -40);
  assert.ok(result.peakDb <= 0);
  assert.ok(result.peakDb + result.gainDb <= -0.9);
  assert.equal(analyzeSamples(new Float32Array(8000), sampleRate).bpm, null);
});

test('cortina playback limits survive queue construction and import validation', () => {
  const value = { version: 1, tracks: [{ id: 'a', source: 'local', title: 'Break' }], groups: [{ id: 'g', kind: 'cortina', name: 'Break', trackIds: ['a'], limitSeconds: 20 }] };
  assert.equal(flattenSet(value.groups, value.tracks)[0].limitSeconds, 20);
  assert.equal(validateSet(value).groups[0].limitSeconds, 20);
  assert.throws(() => validateSet({ ...value, groups: [{ ...value.groups[0], limitSeconds: -1 }] }));
});
