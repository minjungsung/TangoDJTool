import test from 'node:test';
import assert from 'node:assert/strict';
import { backTiming, eventRundown } from '../src/event-plan.js';
import { EditHistory } from '../src/edit-history.js';

const state = () => ({ tracks: [{ id: 'a', source: 'local', title: '<Old tango>', artist: 'Orchestra', singer: 'Singer', duration: 180, cueStartSeconds: 10, cueEndSeconds: 160, fileName: '/private/library/audio.wav', contentHash: 'a'.repeat(64) }, { id: 'b', source: 'youtube', title: 'Second', videoId: 'abcdefghijk', duration: 180 }], groups: [{ id: 't1', kind: 'tanda', name: 'First', trackIds: ['a'] }, { id: 't2', kind: 'tanda', name: 'Second', trackIds: ['b'] }], collections: [], presets: [] });
const queue = () => [{ groupId: 't1', groupName: 'First', kind: 'tanda', track: { duration: 180 }, startSeconds: 10, limitSeconds: 150 }, { groupId: 't2', groupName: 'Second', kind: 'tanda', track: { duration: 180 } }];

test('deadline candidates end at complete tanda boundaries and preserve the active clip', () => {
  const items = queue(), before = structuredClone(items);
  const plan = backTiming(items, { now: 0, deadline: 280000, index: 0, position: 40 });
  assert.equal(plan.knownSeconds, 300); assert.equal(plan.slackSeconds, -20);
  assert.equal(plan.suggestion.groupId, 't1'); assert.equal(plan.suggestion.knownSeconds, 120);
  assert.deepEqual(items, before);
});
test('unknown sources and manual waits make plans conditional and never get fitting guarantees', () => {
  const items = queue(); items[0].holdAfter = true; delete items[1].track.duration;
  const plan = backTiming(items, { now: 0, deadline: 1000000 });
  assert.equal(plan.conditional, true); assert.equal(plan.unknownCount, 1); assert.equal(plan.heldCount, 1); assert.equal(plan.suggestion, null);
});
test('pending silence and expressive source cues count correctly in back timing', () => {
  const items = queue(); items[1].groupId = 't1';
  const plan = backTiming(items, { now: 0, deadline: 500000, index: 1, position: 0, gapSeconds: 5, gapRemaining: 2 });
  // The caller retains the just-ended current item while its remaining gap runs.
  const waiting = backTiming(items, { now: 0, deadline: 500000, index: 0, position: 160, gapSeconds: 5, gapRemaining: 2 });
  assert.equal(waiting.knownSeconds, 182); assert.ok(plan);
  assert.equal(backTiming(items, { deadline: 'invalid' }), null);
});
test('rundown exports portable source evidence, escaped metadata, cues and waits', () => {
  const value = state(); value.groups[0].holdAfter = true;
  const html = eventRundown(value, { gapSeconds: 2, finalGroupId: 't1' });
  assert.match(html, /&lt;Old tango&gt;/); assert.match(html, /Singer/); assert.match(html, /0:10 → 2:40/);
  assert.match(html, /Manual advance required/); assert.match(html, /Reviewed final tanda/);
  assert.match(html, /SHA-256/); assert.doesNotMatch(html, /\/private\/library/);
});
test('multi-step metadata/composition undo and redo preserve transport boundaries', () => {
  const value = state(), history = new EditHistory(); history.reset(value, 't1');
  value.groups[0].name = 'New'; history.observe(value, 't1', 'Rename tanda');
  value.tracks[0].title = 'Corrected'; history.observe(value, 't1', 'Edit title');
  assert.equal(history.undoLabel, 'Edit title'); assert.equal(history.move('undo').state.tracks[0].title, '<Old tango>');
  assert.equal(history.move('undo').state.groups[0].name, 'First');
  assert.equal(history.move('redo').state.groups[0].name, 'New');
  const next = history.move('redo'); assert.equal(next.state.tracks[0].title, 'Corrected'); assert.ok(!('queue' in next.state));
  next.state.tracks[0].contentHash = 'b'.repeat(64); history.observe(next.state);
  assert.equal(history.undoLabel, null); assert.match(history.boundary, /sources changed/);
});
test('a new preparation edit clears redo and history has an explicit reload boundary', () => {
  const value = state(), history = new EditHistory(2); history.reset(value);
  for (let i = 0; i < 3; i++) { value.groups[0].name = `Name ${i}`; history.observe(value); }
  assert.equal(history.undoEntries.length, 2);
  const restored = history.move('undo'); restored.state.groups[0].name = 'Branch'; history.observe(restored.state);
  assert.equal(history.redoLabel, null); history.reset(restored.state); assert.equal(history.undoLabel, null);
});

test('opening a tanda after choosing music does not consume a composition undo step', () => {
  const value = state(), history = new EditHistory(); history.reset(value);
  value.groups[0].trackIds = ['b']; history.observe(value, 't1', 'Choose cortina');
  value.groups[0].collapsed = false; history.observe(value, 't1');
  assert.equal(history.undoEntries.length, 1);
  assert.deepEqual(history.move('undo').state.groups[0].trackIds, ['a']);
});

test('library deletion rebases earlier preparation edits without resurrecting deleted audio', () => {
  const value = state(), history = new EditHistory(); history.reset(value);
  value.groups[0].name = 'Renamed'; history.observe(value, 't1');
  value.tracks = value.tracks.filter(track => track.id !== 'a'); value.groups[0].trackIds = []; history.observe(value, 't1');
  const restored = history.move('undo');
  assert.equal(restored.state.groups[0].name, 'First'); assert.deepEqual(restored.state.groups[0].trackIds, []);
  assert.deepEqual(restored.state.tracks.map(track => track.id), ['b']);
});

test('unverified imported source identifiers cannot expose workstation paths in a rundown', () => {
  const value = state(); value.tracks[0].id = '/music/library/recording.wav'; delete value.tracks[0].contentHash;
  value.groups[0].trackIds = [value.tracks[0].id];
  assert.doesNotMatch(eventRundown(value), /\/music\/library/);
});

test('provider duration observations preserve user Undo order and refresh every matching snapshot', () => {
  const value = state(), history = new EditHistory(); history.reset(value);
  value.groups[0].name = 'Renamed'; history.observe(value, 't1', 'Rename tanda');
  value.tracks[0].duration = 195; history.updateDuration(value.tracks[0]); history.observe(value);
  assert.equal(history.undoLabel, 'Rename tanda');
  const restored = history.move('undo');
  assert.equal(restored.state.groups[0].name, 'First'); assert.equal(restored.state.tracks[0].duration, 195);
  assert.equal(history.move('redo').state.tracks[0].duration, 195);
  history.updateDuration({ ...value.tracks[0], contentHash: 'b'.repeat(64), duration: 220 });
  assert.equal(history.current.state.tracks[0].duration, 195);
});
