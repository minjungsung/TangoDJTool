import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRecordingTags, previewBatchEdit, applyBatchEdit } from '../src/library-service.js';
import { validateSet } from '../src/model.js';

const fixture = () => ({ tracks: [{ id: 'a', source: 'youtube', videoId: 'abcdefghijk', title: 'Poema', artist: 'Canaro', bpm: null, cueStartSeconds: 12, cueEndSeconds: 90 }, { id: 'b', source: 'local', title: 'Other recording', artist: '', contentHash: 'a'.repeat(64), bpm: 120 }], groups: [{ id: 't', kind: 'tanda', name: 'Opening', trackIds: ['a', 'b'] }], collections: [], presets: [] });
test('reviewed batch edits fill only missing fields and preserve identities and source cues', () => {
  const state = fixture(), original = structuredClone(state);
  const preview = previewBatchEdit(state, ['a', 'b'], { artist: { mode: 'fill', value: 'D’Arienzo' }, notes: { mode: 'set', value: 'Review transfer' }, tags: { mode: 'set', value: 'Warm, warm, Expressive' }, rating: { mode: 'set', value: 4 } });
  assert.equal(preview.changes.length, 2);
  const next = applyBatchEdit(state, preview);
  assert.equal(next.tracks[0].artist, 'Canaro'); assert.equal(next.tracks[1].artist, 'D’Arienzo');
  assert.deepEqual(next.tracks[0].tags, ['Warm', 'Expressive']); assert.equal(next.tracks[0].rating, 4);
  assert.equal(next.tracks[0].cueStartSeconds, 12); assert.equal(next.tracks[0].videoId, original.tracks[0].videoId); assert.equal(next.tracks[1].contentHash, original.tracks[1].contentHash);
  assert.deepEqual(state, original); assert.deepEqual(validateSet(JSON.parse(JSON.stringify({ version: 1, ...next }))).tracks, next.tracks);
});
test('blank batch values cannot silently erase metadata and Clear is explicit', () => {
  const state = fixture();
  assert.throws(() => previewBatchEdit(state, ['a'], { artist: { mode: 'set', value: ' ' } }), /Blank/);
  assert.throws(() => previewBatchEdit(state, ['a'], { tags: { mode: 'set', value: ', , ' } }), /Blank/);
  assert.throws(() => previewBatchEdit(state, ['a'], { tags: { mode: 'set', value: 4 } }), /Tags must be text/);
  assert.throws(() => previewBatchEdit(state, ['a'], { title: { mode: 'clear' } }), /cannot be cleared/);
  const next = applyBatchEdit(state, previewBatchEdit(state, ['a'], { artist: { mode: 'clear' }, cueEndSeconds: { mode: 'clear' } }));
  assert.equal(next.tracks[0].artist, ''); assert.equal(next.tracks[0].cueEndSeconds, null); assert.equal(next.tracks[0].cueStartSeconds, 12);
  assert.throws(() => previewBatchEdit(state, ['a'], { cueStartSeconds: { mode: 'set', value: 91 } }), /cue end/);
  assert.throws(() => previewBatchEdit(state, ['a'], { videoId: { mode: 'set', value: 'abcdefghijx' } }), /Unsupported/);
});
test('batch review refuses stale state and manual BPM discards old estimator evidence', () => {
  const state = fixture(); state.tracks[0].bpmConfidence = .7; state.tracks[0].bpmCandidates = [120]; state.tracks[0].bpmSource = 'estimate';
  const preview = previewBatchEdit(state, ['a'], { bpm: { mode: 'set', value: 110 } });
  assert.equal(preview.nextState.tracks[0].bpmSource, 'manual'); assert.equal(preview.nextState.tracks[0].bpmConfidence, null); assert.equal(preview.nextState.tracks[0].bpmCandidates, undefined);
  state.tracks[1].title = 'Edited during review';
  assert.throws(() => applyBatchEdit(state, preview), /library changed/);
});
test('subjective tags, ratings, notes and provenance have typed portable bounds', () => {
  const state = fixture(), validate = values => validateSet({ version: 1, ...state, tracks: [{ ...state.tracks[0], ...values }] , groups: [] });
  assert.deepEqual(parseRecordingTags('Warm, warm,  Ágil , Agil'), ['Warm', 'Ágil']);
  for (const tags of [1, [''], ['x'.repeat(61)], new Array(1), Array.from({ length: 31 }, (_, index) => String(index)), ['Warm', 'warm']]) assert.throws(() => validate({ tags }), /tags/);
  for (const rating of [0, 6, 1.5, '5', true]) assert.throws(() => validate({ rating }), /rating/);
  assert.throws(() => validate({ notes: 'n'.repeat(4001) }), /notes/);
  const provenance = { format: 'csv', sourceName: 'library.csv', sourceHash: 'a'.repeat(64), row: 2, reference: 'song.wav' };
  assert.doesNotThrow(() => validate({ provenance: [provenance], rating: null }));
  assert.throws(() => validate({ provenance: [{ ...provenance, sourceName: '/music/library.csv' }] }), /provenance/);
  assert.throws(() => validate({ provenance: [{ ...provenance, reference: '/music/song.wav' }] }), /provenance/);
  assert.throws(() => validate({ provenance: [{ ...provenance, sourceHash: ['a'.repeat(64)] }] }), /provenance/);
  assert.throws(() => validate({ fileSize: -1 }), /file metadata/);
});
test('optional measured audio evidence remains finite, typed and versioned across imports', () => {
  const state = fixture(), validate = values => validateSet({ version: 1, tracks: [{ ...state.tracks[0], ...values }], groups: [] });
  assert.doesNotThrow(() => validate({ bpmConfidence: 0, bpmCandidates: [], bpmSource: 'tap', integratedLufs: -90, truePeakDb: -180, loudnessAnalysisVersion: 'bs1770-k-4x-v1', measuredSeconds: 86400 }));
  for (const bpmConfidence of [true, '0.8', -.1, 1.1, NaN]) assert.throws(() => validate({ bpmConfidence }), /confidence/);
  for (const bpmCandidates of [new Array(1), [19], [301], ['64'], Array(7).fill(64)]) assert.throws(() => validate({ bpmCandidates }), /candidates/);
  for (const integratedLufs of [-91, 11, Infinity, '-20']) assert.throws(() => validate({ integratedLufs }), /loudness/);
  for (const truePeakDb of [-181, 25, NaN, '-3']) assert.throws(() => validate({ truePeakDb }), /peak/);
  for (const measuredSeconds of [0, -1, 86401, Infinity, true]) assert.throws(() => validate({ measuredSeconds }), /duration/);
  assert.throws(() => validate({ bpmSource: 'automatic' }), /source/); assert.throws(() => validate({ loudnessAnalysisVersion: 'unsupported' }), /version/);
});
