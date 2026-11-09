import test from 'node:test';
import assert from 'node:assert/strict';
import { youtubeId, recordingClip, flattenSet, removeTrack, validateSet } from '../src/model.js';
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

test('milonga cycle uses coherent tandas, short cortinas, and removes legacy samples only', async () => {
  const { realTracks, realGroups, removeOldExamples } = await import('../src/samples.js');
  const groups = realGroups(), library = new Map(realTracks.map(t => [t.id, t]));
  assert.equal(realTracks.length, 28);
  const tandas = groups.filter(g => g.kind === 'tanda');
  assert.deepEqual(tandas.map(g => library.get(g.trackIds[0]).style), ['Tango', 'Tango', 'Vals', 'Tango', 'Tango', 'Milonga']);
  for (const tanda of tandas) {
    const tracks = tanda.trackIds.map(id => library.get(id));
    assert.equal(new Set(tracks.map(t => t.artist)).size, 1);
    assert.equal(new Set(tracks.map(t => t.singer)).size, 1);
    assert.equal(tracks.length, tracks[0].style === 'Tango' ? 4 : 3);
  }
  assert.equal(groups.filter(g => g.kind === 'cortina' && g.limitSeconds === 20).length, 6);
  const result = removeOldExamples({ tracks: [{ id: 'old', source: 'local', samplePack: 'studio-practice-v1' }, { id: 'mine', source: 'local' }], groups: [{ id: 'my-group', trackIds: ['mine', 'old'] }, { id: 'old-group', samplePack: 'studio-practice-v1', trackIds: ['old'] }] });
  assert.deepEqual(result.state.tracks.map(t => t.id), ['mine']);
  assert.deepEqual(result.state.groups[0].trackIds, ['mine']);
  assert.equal(result.state.groups.length, 1);
});

test('cortina start positions survive export and queue construction, rejecting invalid values', () => {
  const value = { version: 1, tracks: [{ id: 'a', source: 'youtube', title: 'Break', videoId: 'abcdefghijk' }], groups: [{ id: 'g', kind: 'cortina', name: 'Break', trackIds: ['a'], startSeconds: 35, limitSeconds: 20 }] };
  assert.equal(flattenSet(validateSet(value).groups, value.tracks)[0].startSeconds, 35);
  for (const startSeconds of [-1, Infinity, '35', 86401]) assert.throws(() => validateSet({ ...value, groups: [{ ...value.groups[0], startSeconds }] }));
});

test('recording cues use an absolute end position and preserve saved values beyond a known source end', () => {
  assert.deepEqual(recordingClip({}), { startSeconds: 0 });
  assert.deepEqual(recordingClip({ cueStartSeconds: null, cueEndSeconds: null }), { startSeconds: 0 });
  assert.deepEqual(recordingClip({ cueStartSeconds: 12.5 }), { startSeconds: 12.5 });
  assert.deepEqual(recordingClip({ cueEndSeconds: 30 }), { startSeconds: 0, limitSeconds: 30 });
  const track = { duration: 20, cueStartSeconds: 15, cueEndSeconds: 45 };
  assert.deepEqual(recordingClip(track), { startSeconds: 15, limitSeconds: 30 });
  assert.deepEqual(track, { duration: 20, cueStartSeconds: 15, cueEndSeconds: 45 });
});

test('tanda occurrences inherit recording cues while cortinas keep their own ranges', () => {
  const tracks = [{ id: 'a', cueStartSeconds: 12, cueEndSeconds: 150 }];
  const groups = [
    { id: 't', kind: 'tanda', name: 'Tanda', trackIds: ['a', 'a'], occurrenceIds: ['first', 'repeat'], startSeconds: 2, limitSeconds: 10 },
    { id: 'c', kind: 'cortina', name: 'Short break', trackIds: ['a'], startSeconds: 35, limitSeconds: 20 },
    { id: 'f', kind: 'cortina', name: 'Remaining break', trackIds: ['a'], startSeconds: 40, limitSeconds: 20, fullLength: true },
    { id: 'u', kind: 'cortina', name: 'Whole break', trackIds: ['a'], fullLength: true },
  ];
  const queue = flattenSet(groups, tracks);
  assert.deepEqual(queue.map(item => [item.startSeconds, item.limitSeconds]), [[12, 138], [12, 138], [35, 20], [40, undefined], [0, undefined]]);
  assert.deepEqual(queue.slice(0, 2).map(item => item.occurrenceId), ['first', 'repeat']);
  assert.equal(queue[0].track, tracks[0]);
  assert.equal(groups[2].limitSeconds, 20);
});

test('set import accepts optional recording cues and rejects invalid positions without rewriting source bounds', () => {
  const valid = { version: 1, tracks: [{ id: 'a', source: 'local', title: 'Music', duration: 15 }], groups: [] };
  for (const cues of [{}, { cueStartSeconds: null, cueEndSeconds: null }, { cueStartSeconds: 12.5 }, { cueEndSeconds: 20 }, { cueStartSeconds: 86400, cueEndSeconds: 90000 }]) {
    const track = { ...valid.tracks[0], ...cues };
    assert.equal(validateSet({ ...valid, tracks: [track] }).tracks[0], track);
  }
  for (const cueStartSeconds of [-1, 86401, Infinity, NaN, '12', true]) {
    assert.throws(() => validateSet({ ...valid, tracks: [{ ...valid.tracks[0], cueStartSeconds }] }), /cue start/);
  }
  for (const cueEndSeconds of [0, -1, 90001, Infinity, NaN, '20', true]) {
    assert.throws(() => validateSet({ ...valid, tracks: [{ ...valid.tracks[0], cueEndSeconds }] }), /cue end/);
  }
  for (const cueEndSeconds of [10, 9]) {
    assert.throws(() => validateSet({ ...valid, tracks: [{ ...valid.tracks[0], cueStartSeconds: 10, cueEndSeconds }] }), /cue end/);
  }
});

test('recording occurrence identities remain aligned, nonempty, and unique throughout the live set', () => {
  const track = { id: 'a', source: 'local', title: 'Music' };
  const group = { id: 't', kind: 'tanda', name: 'Tanda', trackIds: ['a', 'a'], occurrenceIds: ['first', 'repeat'] };
  const valid = { version: 1, tracks: [track], groups: [group] };
  assert.doesNotThrow(() => validateSet(valid));
  assert.doesNotThrow(() => validateSet({ ...valid, groups: [{ ...group, occurrenceIds: undefined }] }));
  for (const occurrenceIds of [['first'], ['first', 'first'], ['first', ''], ['first', ' '], ['first', 1], ['first', null], new Array(2)]) {
    assert.throws(() => validateSet({ ...valid, groups: [{ ...group, occurrenceIds }] }), /occurrences/);
  }
  assert.throws(() => validateSet({ ...valid, groups: [group, { ...group, id: 'other', trackIds: ['a'], occurrenceIds: ['first'] }] }), /occurrences/);
  const cortina = { id: 'c', kind: 'cortina', name: 'Break', trackIds: ['a'], occurrenceIds: ['break'] };
  assert.doesNotThrow(() => validateSet({ ...valid, groups: [group, cortina], presets: [{ id: 'p', name: 'Reusable', trackIds: ['a'], cortina }] }));
});

test('removing a recording preserves identities of the remaining repeated placements and preset cortinas', () => {
  const group = { id: 't', trackIds: ['a', 'b', 'a', 'b'], occurrenceIds: ['a1', 'b1', 'a2', 'b2'] };
  const state = { tracks: [{ id: 'a' }, { id: 'b' }], groups: [group], presets: [{ id: 'p', trackIds: ['a', 'b'], cortina: group }] };
  const result = removeTrack(state, 'a');
  assert.deepEqual(result.groups[0].trackIds, ['b', 'b']);
  assert.deepEqual(result.groups[0].occurrenceIds, ['b1', 'b2']);
  assert.deepEqual(result.presets[0].cortina.occurrenceIds, ['b1', 'b2']);
  assert.deepEqual(group.occurrenceIds, ['a1', 'b1', 'a2', 'b2']);
});
