import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectProgram, queueRuntime } from '../src/dj.js';
import { flattenSet } from '../src/model.js';

const local = (id, values = {}) => ({ id, source: 'local', title: id, duration: 180, style: 'Tango', ...values });
const tanda = (id, trackIds) => ({ id, kind: 'tanda', name: id, trackIds });
const ready = tracks => new Map(tracks.map(track => [track.id, 'Stored copy']));

test('remaining runtime uses absolute positions and clips each recording at its source end', () => {
  const queue = [
    { track: { duration: 180 }, startSeconds: 30, limitSeconds: 90 },
    { track: { duration: 45 }, startSeconds: 35, limitSeconds: 20, holdAfter: true },
    { track: { duration: 200 }, startSeconds: 10 },
  ];
  assert.deepEqual(queueRuntime(queue, 0, 50), { knownSeconds: 270, unknownCount: 0, heldCount: 1 });
  assert.deepEqual(queueRuntime(queue, 1, 40), { knownSeconds: 195, unknownCount: 0, heldCount: 1 });
  assert.deepEqual(queueRuntime(queue, -1, 50), { knownSeconds: 290, unknownCount: 0, heldCount: 1 });
  assert.deepEqual(queueRuntime(queue, queue.length, 0), { knownSeconds: 0, unknownCount: 0, heldCount: 0 });
  assert.deepEqual(queueRuntime(queue, 2, 500), { knownSeconds: 0, unknownCount: 0, heldCount: 0 });
});

test('unknown full lengths remain explicit while bounded unknown sources contribute known time', () => {
  const queue = [
    { track: { duration: null }, startSeconds: 40, limitSeconds: 20, holdAfter: true },
    { track: { duration: 0 } },
    { track: {}, startSeconds: 15, holdAfter: true },
  ];
  assert.deepEqual(queueRuntime(queue), { knownSeconds: 20, unknownCount: 2, heldCount: 2 });
  assert.deepEqual(queueRuntime(queue, 0, 45), { knownSeconds: 15, unknownCount: 2, heldCount: 2 });
  assert.deepEqual(queueRuntime(queue, 0, 0), { knownSeconds: 20, unknownCount: 2, heldCount: 2 });
  assert.deepEqual(queueRuntime([], -1), { knownSeconds: 0, unknownCount: 0, heldCount: 0 });
});

test('recommended local tango, vals, and milonga tandas are ready with no stylistic warnings', () => {
  const tracks = [0, 1, 2, 3].map(i => local(`t${i}`));
  tracks.push(...[0, 1, 2].map(i => local(`v${i}`, { style: 'Vals' })));
  tracks.push(...[0, 1, 2].map(i => local(`m${i}`, { style: 'Milonga' })));
  const groups = [tanda('t', tracks.slice(0, 4).map(track => track.id)), tanda('v', tracks.slice(4, 7).map(track => track.id)), tanda('m', tracks.slice(7).map(track => track.id))];
  assert.deepEqual(inspectProgram(groups, tracks, ready(tracks)), []);
  assert.deepEqual(inspectProgram(groups, tracks, Object.fromEntries(ready(tracks))), []);
});

test('source readiness distinguishes absent, changed, unpermitted and unchecked originals', () => {
  const tracks = ['missing', 'permission', 'changed', 'unchecked', 'ready'].map(id => local(id));
  const statuses = new Map([['missing', 'File missing'], ['permission', 'Permission needed'], ['changed', 'File changed'], ['ready', 'Ready']]);
  const issues = inspectProgram([tanda('t', ['missing', 'permission', 'changed', 'unchecked', 'ready']), tanda('next', ['missing'])], tracks, statuses);
  assert.equal(issues.filter(issue => issue.code === 'missing-file').length, 1);
  for (const [trackId, code] of [['missing', 'missing-file'], ['permission', 'permission-needed'], ['changed', 'file-changed']]) {
    assert.ok(issues.some(issue => issue.level === 'error' && issue.code === code && issue.trackId === trackId && issue.groupId === 't'));
  }
  assert.ok(issues.some(issue => issue.level === 'warning' && issue.code === 'source-unchecked' && issue.trackId === 'unchecked'));
  assert.ok(!issues.some(issue => issue.trackId === 'ready'));
});

test('YouTube connection warnings never claim to validate provider availability', () => {
  const track = { id: 'video', title: 'Video', source: 'youtube', videoId: 'abcdefghijk', style: 'Tango' };
  const groups = [tanda('t', ['video', 'video'])];
  const connected = inspectProgram(groups, [track], new Map(), true).filter(issue => issue.code.startsWith('youtube-'));
  assert.equal(connected.length, 1);
  assert.equal(connected[0].level, 'warning');
  assert.equal(connected[0].code, 'youtube-network');
  assert.match(connected[0].message, /have not been verified/);
  const offline = inspectProgram(groups, [track], new Map(), false).find(issue => issue.code === 'youtube-offline');
  assert.equal(offline.level, 'error');
  assert.match(offline.message, /offline/);
});

test('preparation reviews empty groups and broken references without mutating the program', () => {
  const tracks = [local('a')], groups = [tanda('empty', []), tanda('broken', ['a', 'gone'])];
  const before = structuredClone({ tracks, groups });
  const issues = inspectProgram(groups, tracks, ready(tracks));
  assert.ok(issues.some(issue => issue.level === 'warning' && issue.code === 'empty-group' && issue.groupId === 'empty'));
  assert.ok(issues.some(issue => issue.level === 'error' && issue.code === 'missing-recording' && issue.trackId === 'gone'));
  assert.deepEqual({ tracks, groups }, before);
  assert.deepEqual(inspectProgram([], [], new Map()).map(issue => [issue.level, issue.code]), [['error', 'empty-program']]);
});

test('tanda cues are reviewed independently from full-length and bounded cortina cues', () => {
  const tracks = [local('a', { duration: 100, cueStartSeconds: 100 }), local('b', { duration: 45, cueStartSeconds: 30, cueEndSeconds: 80 })];
  const groups = [tanda('t', ['a', 'b']), { id: 'c', kind: 'cortina', name: 'Break', trackIds: ['a'], startSeconds: 30, fullLength: true, limitSeconds: 120 }];
  const issues = inspectProgram(groups, tracks, ready(tracks));
  assert.ok(issues.some(issue => issue.code === 'cue-start' && issue.level === 'error' && issue.trackId === 'a' && issue.groupId === 't'));
  assert.ok(issues.some(issue => issue.code === 'cue-end' && issue.level === 'warning' && issue.trackId === 'b'));
  assert.ok(!issues.some(issue => issue.groupId === 'c'));
  const clips = flattenSet(groups.slice(1), tracks);
  assert.deepEqual(queueRuntime(clips), { knownSeconds: 70, unknownCount: 0, heldCount: 0 });
  const invalid = [tanda('invalid', ['b'])];
  assert.ok(inspectProgram(invalid, [{ ...tracks[1], cueEndSeconds: 20 }], ready(tracks)).some(issue => issue.level === 'error' && issue.code === 'cue-range'));
  assert.ok(!inspectProgram(invalid, [{ ...tracks[1], duration: null }], ready(tracks)).some(issue => issue.code === 'cue-end'));
});

test('mixed styles, customary tanda sizes, and repeated music are review warnings', () => {
  const tracks = [local('a'), local('b', { style: ' vals ' }), local('c', { style: 'Milonga' }), local('d', { style: 'Tango' })];
  const groups = [tanda('mixed', ['a', 'b', 'c']), tanda('short', ['d', 'a']), { id: 'c1', kind: 'cortina', name: 'Break', trackIds: ['b'] }, { id: 'c2', kind: 'cortina', name: 'Break again', trackIds: ['b'] }];
  const issues = inspectProgram(groups, tracks, ready(tracks));
  assert.ok(issues.some(issue => issue.code === 'mixed-styles' && issue.groupId === 'mixed'));
  assert.ok(issues.some(issue => issue.code === 'tanda-size' && issue.groupId === 'short'));
  assert.deepEqual(issues.filter(issue => issue.code === 'repeated-recording').map(issue => issue.trackId), ['a']);
  assert.ok(issues.every(issue => issue.level === 'warning'));
});

test('repeat review detects identical content under distinct IDs while allowing reused cortinas', () => {
  const hash = 'a'.repeat(64);
  const tracks = [local('a', { contentHash: hash }), local('copy', { contentHash: hash }), local('break')];
  const groups = [tanda('t', ['a', 'copy', 'a', 'a']), { id: 'c', kind: 'cortina', name: 'Break', trackIds: ['break', 'break'] }];
  const issues = inspectProgram(groups, tracks, ready(tracks));
  assert.deepEqual(issues.filter(issue => issue.code === 'repeated-recording').map(issue => issue.trackId), ['copy']);
});

test('known orchestra and singer names match across accents, case, and whitespace', () => {
  const tracks = [
    local('a', { artist: 'Aníbal Troilo', singer: 'José María' }),
    local('b', { artist: ' ANIBAL   TROILO ', singer: ' jose maria ' }),
    local('c', { artist: 'Ani\u0301bal Troilo', singer: 'JOSE\u0301 MARI\u0301A' }),
    local('d', { artist: '', singer: undefined }),
  ];
  assert.deepEqual(inspectProgram([tanda('t', tracks.map(track => track.id))], tracks, ready(tracks)), []);
  tracks[3].artist = 'Unknown orchestra'; tracks[3].singer = 'Unknown singer';
  assert.deepEqual(inspectProgram([tanda('t', tracks.map(track => track.id))], tracks, ready(tracks)), []);
});

test('mixed known orchestras and singers are intentional-choice review warnings', () => {
  const tracks = [
    local('a', { artist: 'Aníbal Troilo', singer: 'Francisco Fiorentino' }),
    local('b', { artist: 'Francisco Canaro', singer: 'Roberto Maida' }),
    local('c', { artist: undefined, singer: '' }),
    local('d', { artist: 'N/A', singer: 'Unspecified' }),
  ];
  const before = structuredClone(tracks);
  const issues = inspectProgram([tanda('t', tracks.map(track => track.id))], tracks, ready(tracks));
  assert.deepEqual(issues.map(issue => issue.code), ['mixed-orchestras', 'mixed-singers']);
  for (const issue of issues) {
    assert.equal(issue.level, 'warning');
    assert.equal(issue.groupId, 't');
    assert.match(issue.message, /Review whether .* intentional/);
  }
  assert.deepEqual(tracks, before);
});

test('singer review recognizes explicit instrumental metadata without treating missing singers as instrumental', () => {
  const tracks = [
    local('a', { singer: 'Francisco Fiorentino' }),
    local('b', { singer: '' }),
    local('c', { singer: undefined }),
    local('d', { singer: 'Unknown' }),
  ];
  const groups = [tanda('t', tracks.map(track => track.id))];
  assert.deepEqual(inspectProgram(groups, tracks, ready(tracks)), []);
  tracks[1].singer = ' Instrumental ';
  const issue = inspectProgram(groups, tracks, ready(tracks)).find(issue => issue.code === 'mixed-singers');
  assert.equal(issue.level, 'warning');
  assert.match(issue.message, /identified instrumental and vocal/);
  assert.match(issue.message, /Review whether .* intentional/);
  tracks[0].singer = 'INSTRUMENTAL';
  assert.deepEqual(inspectProgram(groups, tracks, ready(tracks)), []);
});

test('cortina style inside a tanda is reviewed even when every recording has that style', () => {
  const tracks = [0, 1, 2, 3].map(index => local(`c${index}`, { style: ' Cortina ' }));
  const group = tanda('t', tracks.map(track => track.id));
  const issues = inspectProgram([group], tracks, ready(tracks));
  assert.deepEqual(issues.map(issue => issue.code), ['cortina-in-tanda']);
  assert.equal(issues[0].level, 'warning');
  assert.equal(issues[0].trackId, 'c0');
  assert.match(issues[0].message, /Review whether .* intentional/);
  assert.deepEqual(inspectProgram([{ ...group, kind: 'cortina' }], tracks, ready(tracks)), []);
});

function danceProgram(styles) {
  const tracks = [], groups = [];
  for (const [index, style] of styles.entries()) {
    const recordings = Array.from({ length: style.toLowerCase().trim() === 'tango' ? 4 : 3 }, (_, recording) => local(`${index}-${recording}`, { style }));
    tracks.push(...recordings);
    groups.push(tanda(`t${index}`, recordings.map(track => track.id)));
  }
  return { tracks, groups };
}

test('confident uniform tanda styles review deviations from the common repeated dance cycle', () => {
  const cycle = ['Tango', ' TANGO ', 'Vals', 'Tango', 'Tango', 'Milonga'];
  const matching = danceProgram([...cycle, ...cycle]);
  assert.deepEqual(inspectProgram(matching.groups, matching.tracks, ready(matching.tracks)), []);
  const changed = danceProgram(['Tango', 'Tango', 'Milonga', 'Tango', 'Tango', 'Vals']);
  const issues = inspectProgram(changed.groups, changed.tracks, ready(changed.tracks));
  assert.deepEqual(issues.map(issue => issue.code), ['dance-cycle']);
  assert.equal(issues[0].level, 'warning');
  assert.equal(issues[0].groupId, 't2');
  assert.match(issues[0].message, /Review whether .* intentional/);
  const incompleteSecondCycle = danceProgram([...cycle, 'Vals']);
  assert.equal(inspectProgram(incompleteSecondCycle.groups, incompleteSecondCycle.tracks, ready(incompleteSecondCycle.tracks)).find(issue => issue.code === 'dance-cycle').groupId, 't6');
});

test('cycle review skips short programs, unknown or mixed styles, empty tandas, and broken references', () => {
  const styles = ['Tango', 'Tango', 'Milonga', 'Tango', 'Tango', 'Vals'];
  const short = danceProgram(styles.slice(0, 5));
  assert.ok(!inspectProgram(short.groups, short.tracks, ready(short.tracks)).some(issue => issue.code === 'dance-cycle'));
  for (const variation of ['unknown', 'other', 'mixed', 'empty', 'missing']) {
    const { tracks, groups } = danceProgram(styles);
    if (variation === 'unknown') delete tracks[0].style;
    if (variation === 'other') tracks[0].style = 'Other';
    if (variation === 'mixed') tracks[0].style = 'Vals';
    if (variation === 'empty') groups[0].trackIds = [];
    if (variation === 'missing') groups[0].trackIds.push('missing');
    assert.ok(!inspectProgram(groups, tracks, ready(tracks)).some(issue => issue.code === 'dance-cycle'), variation);
  }
  const { tracks, groups } = danceProgram(['Tango', 'Tango', 'Vals', 'Tango', 'Tango', 'Milonga']);
  const cortina = local('break', { style: 'Cortina' }); tracks.push(cortina);
  groups.splice(2, 0, { id: 'c', kind: 'cortina', name: 'Break', trackIds: ['break'] });
  assert.deepEqual(inspectProgram(groups, tracks, ready(tracks)), []);
});

test('configured silence contributes only between consecutive recordings in the same tanda', () => {
  const item = (kind, groupId, duration = 30) => ({ kind, groupId, track: { duration } });
  const queue = [
    item('tanda', 'a'), item('tanda', 'a'), item('cortina', 'c'),
    item('tanda', 'b'), item('tanda', 'b'), item('tanda', 'different'),
    item(undefined, undefined), item(undefined, undefined), item('tanda', ''), item('tanda', ''),
  ];
  assert.deepEqual(queueRuntime(queue, -1, 0, 3), { knownSeconds: 306, unknownCount: 0, heldCount: 0 });
  assert.deepEqual(queueRuntime(queue, 0, 30, 3), { knownSeconds: 276, unknownCount: 0, heldCount: 0 });
  assert.deepEqual(queueRuntime(queue, 1, 30, 3), { knownSeconds: 243, unknownCount: 0, heldCount: 0 });
  assert.deepEqual(queueRuntime(queue, 9, 30, 3), { knownSeconds: 0, unknownCount: 0, heldCount: 0 });
});

test('runtime silence is bounded and leaves unknown lengths and manual waits explicit', () => {
  const queue = [
    { kind: 'tanda', groupId: 't', track: {}, holdAfter: true },
    { kind: 'tanda', groupId: 't', track: { duration: 30 }, startSeconds: 20, limitSeconds: 5 },
  ];
  assert.deepEqual(queueRuntime(queue, -1, 0, 2.5), { knownSeconds: 7.5, unknownCount: 1, heldCount: 1 });
  assert.deepEqual(queueRuntime(queue, -1, 0, 100), { knownSeconds: 15, unknownCount: 1, heldCount: 1 });
  for (const gap of [-1, NaN, Infinity, '3', null]) assert.deepEqual(queueRuntime(queue, -1, 0, gap), queueRuntime(queue));
  assert.deepEqual(queueRuntime(queue, 1, 23, 3), { knownSeconds: 2, unknownCount: 0, heldCount: 0 });
});
