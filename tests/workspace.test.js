import test from 'node:test';
import assert from 'node:assert/strict';
import { groupDuration, locateInQueue, queueSignature } from '../src/workspace.js';
test('cortina runtime follows the playback limit instead of full song length', () => {
  const tracks = [{ id: 'a', duration: 180 }];
  assert.equal(groupDuration({ trackIds: ['a'], limitSeconds: 20 }, tracks), 20);
  assert.equal(groupDuration({ trackIds: ['a'] }, tracks), 180);
});
test('library playback selects the current or next repeated queue entry', () => {
  const queue = ['a','b','a'].map(id => ({ track: { id } }));
  assert.equal(locateInQueue(queue, 'a', 0), 0);
  assert.equal(locateInQueue(queue, 'a', 1), 2);
  assert.equal(locateInQueue(queue, 'a', 2), 2);
  assert.equal(locateInQueue(queue, 'c', 0), -1);
});
test('queue staleness follows order and limits while ignoring discovered durations', () => {
  const groups = [{ id: 'g', trackIds: ['a','b'] }], tracks = [{ id: 'a' }, { id: 'b' }];
  const before = queueSignature(groups, tracks); tracks[0].duration = 120;
  assert.equal(queueSignature(groups, tracks), before);
  groups[0].trackIds.reverse(); assert.notEqual(queueSignature(groups, tracks), before);
});

test('cue offsets affect queue freshness and duration clips at the actual recording end', () => {
  const groups = [{ id: 'g', trackIds: ['a'], limitSeconds: 20 }], tracks = [{ id: 'a', duration: 40 }];
  const before = queueSignature(groups, tracks); groups[0].startSeconds = 35;
  assert.notEqual(queueSignature(groups, tracks), before); assert.equal(groupDuration(groups[0], tracks), 5);
  assert.equal(groupDuration(groups[0], [{ id: 'a' }]), 20);
});
