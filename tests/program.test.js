import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProgram, insertGroupAfterSelection, insertNext } from '../src/program.js';
import { flattenSet, validateSet } from '../src/model.js';

function fixture() {
  const state = normalizeProgram({ tracks: ['a','b','c','x'].map(id => ({ id, source: 'local', title: id })), groups: [{ id: 't', kind: 'tanda', name: 'Tanda', trackIds: ['a','b','a'] }, { id: 'break', kind: 'cortina', name: 'Break', trackIds: ['c'], holdAfter: true }] });
  const queue = flattenSet(state.groups, state.tracks);
  return { state, queue };
}
test('group insertion follows selection and keeps a tanda with its attached cortina', () => {
  const { state } = fixture();
  state.groups.push({ id: 'last', kind: 'tanda', name: 'Last', trackIds: [] });
  const add = (id, selectedId, kind = 'tanda', parentId) => insertGroupAfterSelection(state, { id, kind, name: id, trackIds: [], ...(kind === 'cortina' ? { parentId: parentId || '' } : {}) }, selectedId);
  add('new', 't');
  assert.deepEqual(state.groups.map(g => g.id), ['t', 'break', 'new', 'last']);
  add('attached', 'new', 'cortina', 'new');
  add('standalone', 'attached', 'cortina');
  add('after-cortina', 'standalone');
  assert.deepEqual(state.groups.map(g => g.id), ['t', 'break', 'new', 'attached', 'standalone', 'after-cortina', 'last']);
  add('fallback', 'missing');
  assert.equal(state.groups.at(-1).id, 'fallback');
  assert.equal(state.groups.find(g => g.id === 'attached').parentId, 'new');
  assert.equal(state.groups.find(g => g.id === 'standalone').parentId, '');
});
test('ordered next additions preserve repeated occurrences and attached cortina', () => {
  const { state, queue } = fixture(), current = queue[0];
  const first = insertNext(state, queue, 0, state.tracks[3], 't');
  const second = insertNext(state, queue, 0, state.tracks[1], 't');
  assert.deepEqual(queue.map(item => item.track.id), ['a','x','b','b','a','c']);
  assert.equal(queue[0], current);
  assert.notEqual(first.occurrenceId, second.occurrenceId);
  assert.deepEqual(state.groups[0].trackIds, ['a','x','b','b','a']);
  assert.deepEqual(flattenSet(state.groups, state.tracks).map(item => item.occurrenceId), queue.map(item => item.occurrenceId));
  assert.equal(state.groups[1].parentId, 't');
  assert.doesNotThrow(() => validateSet({ version: 1, ...state }));
});
test('last-recording insertion occurs before cortina and malformed occurrences reject', () => {
  const { state, queue } = fixture();
  insertNext(state, queue, 2, state.tracks[3], 't');
  assert.deepEqual(queue.map(item => item.track.id), ['a','b','a','x','c']);
  state.groups[0].occurrenceIds[1] = state.groups[0].occurrenceIds[0];
  assert.throws(() => validateSet({ version: 1, ...state }), /occurrences/);
});
test('cortina insertion targets next tanda without reopening prior tanda', () => {
  const { state, queue } = fixture();
  state.groups.push({ id: 'next', kind: 'tanda', name: 'Next', trackIds: ['b'] });
  normalizeProgram(state); queue.push(...flattenSet([state.groups[2]], state.tracks));
  insertNext(state, queue, 3, state.tracks[3], 'next');
  assert.deepEqual(state.groups[0].trackIds, ['a','b','a']);
  assert.deepEqual(state.groups[2].trackIds, ['x','b']);
  assert.deepEqual(queue.map(item => item.track.id), ['a','b','a','c','x','b']);
});
