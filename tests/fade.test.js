import test from 'node:test';
import assert from 'node:assert/strict';
import { fadeLevel, playbackMessage } from '../src/fade.js';

test('four-second fades cover the audible beginning and end', () => {
  assert.deepEqual([0, 1, 2, 4, 10, 16, 18, 19, 20].map(p => fadeLevel(p, 20, 4)), [0, .25, .5, 1, 1, 1, .5, .25, 0]);
});
test('short segments, unknown provider durations and disabled fades remain bounded', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(p => fadeLevel(p, 4, 4)), [0, .5, 1, .5, 0]);
  assert.equal(fadeLevel(2, Infinity, 4), .5);
  assert.equal(fadeLevel(90, Infinity, 4), 1);
  assert.equal(fadeLevel(0, 20, 0), 1);
  assert.equal(fadeLevel(-1, 20, 4), 0);
});
test('permission and codec failures provide different recovery instructions', () => {
  assert.match(playbackMessage({ name: 'NotAllowedError' }), /permission.*Retry/);
  assert.match(playbackMessage({ name: 'NotSupportedError' }), /MP3/);
});
