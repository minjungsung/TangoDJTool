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
test('queue freshness distinguishes repeated placements of the same recording', () => {
  const groups = [{ id: 'g', trackIds: ['a','a'], occurrenceIds: ['first','second'] }], tracks = [{ id: 'a' }];
  const before = queueSignature(groups, tracks);
  groups[0].occurrenceIds.reverse();
  assert.notEqual(queueSignature(groups, tracks), before);
  groups[0].occurrenceIds.reverse();
  assert.equal(queueSignature(groups, tracks), before);
});

test('cue offsets affect queue freshness and duration clips at the actual recording end', () => {
  const groups = [{ id: 'g', trackIds: ['a'], limitSeconds: 20 }], tracks = [{ id: 'a', duration: 40 }];
  const before = queueSignature(groups, tracks); groups[0].startSeconds = 35;
  assert.notEqual(queueSignature(groups, tracks), before); assert.equal(groupDuration(groups[0], tracks), 5);
  assert.equal(groupDuration(groups[0], [{ id: 'a' }]), 20);
});

test('tanda duration includes repeated recording cues and bounds each range at the source end', () => {
  const tracks = [
    { id: 'a', duration: 200, cueStartSeconds: 12, cueEndSeconds: 180 },
    { id: 'b', duration: 30, cueStartSeconds: 25, cueEndSeconds: 80 },
    { id: 'c', duration: 45, cueStartSeconds: 5 },
    { id: 'unknown', cueStartSeconds: 15, cueEndSeconds: 35 },
    { id: 'unbounded' },
  ];
  const group = { kind: 'tanda', trackIds: ['a', 'a', 'b', 'c', 'unknown', 'unbounded', 'missing'] };
  assert.equal(groupDuration(group, tracks), 168 * 2 + 5 + 40 + 20);
  assert.equal(tracks[1].cueEndSeconds, 80);
  assert.equal(groupDuration({ kind: 'tanda', trackIds: ['b'] }, [{ ...tracks[1], duration: 20 }]), 0);
});

test('full-length cortinas ignore recording cues and stale group limits while retaining their start position', () => {
  const tracks = [{ id: 'a', duration: 180, cueStartSeconds: 12, cueEndSeconds: 50 }];
  const group = { kind: 'cortina', trackIds: ['a'], startSeconds: 35, limitSeconds: 20, fullLength: true };
  assert.equal(groupDuration(group, tracks), 145);
  assert.equal(groupDuration({ ...group, startSeconds: 185 }, tracks), 0);
  assert.equal(groupDuration(group, [{ ...tracks[0], duration: null }]), 0);
  assert.equal(group.limitSeconds, 20);
});

test('queue freshness follows effective recording cues while duration discoveries remain harmless', () => {
  const group = { id: 't', name: 'Tanda', kind: 'tanda', trackIds: ['a'] };
  const tracks = [{ id: 'a', cueStartSeconds: 12, cueEndSeconds: 180 }, { id: 'unused' }];
  const before = queueSignature([group], tracks);
  tracks[0].duration = 150;
  tracks[1].cueStartSeconds = 20;
  assert.equal(queueSignature([group], tracks), before);
  tracks[0].cueStartSeconds = 15;
  assert.notEqual(queueSignature([group], tracks), before);
  tracks[0].cueStartSeconds = 12;
  tracks[0].cueEndSeconds = 170;
  assert.notEqual(queueSignature([group], tracks), before);
  tracks[0].cueEndSeconds = 180;
  group.limitSeconds = 20;
  group.startSeconds = 35;
  assert.equal(queueSignature([group], tracks), before);
});

test('cortina signatures use their own effective ranges and playback kind', () => {
  const group = { id: 'c', name: 'Break', kind: 'cortina', trackIds: ['a'], startSeconds: 35, limitSeconds: 20, fullLength: true };
  const track = { id: 'a', cueStartSeconds: 12, cueEndSeconds: 180 };
  const before = queueSignature([group], [track]);
  track.cueStartSeconds = 30;
  track.cueEndSeconds = 90;
  group.limitSeconds = 45;
  assert.equal(queueSignature([group], [track]), before);
  group.fullLength = false;
  assert.notEqual(queueSignature([group], [track]), before);
  const withoutLimit = { ...group, startSeconds: 0, limitSeconds: undefined };
  assert.notEqual(queueSignature([withoutLimit], [{ id: 'a' }]), queueSignature([{ ...withoutLimit, kind: 'tanda' }], [{ id: 'a' }]));
});
