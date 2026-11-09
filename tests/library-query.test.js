import test from 'node:test';
import assert from 'node:assert/strict';
import { libraryQuery, vocalCategory } from '../src/library-query.js';

const tracks = [
  { id: 'a', title: 'Poema', artist: 'Francisco Canaro', singer: 'Roberto Maida', year: '1935', style: 'Tango', bpm: 120, rating: 5, tags: ['Warm'], notes: 'Clean transfer', source: 'local' },
  { id: 'b', title: 'Valsecito', artist: 'Ángel D’Agostino', singer: 'Instrumental', year: '1942', style: 'Vals', bpm: 140, source: 'local' },
  { id: 'c', title: 'Unknown transfer', artist: '', singer: 'Unknown singer', year: '', style: '', bpm: null, rating: null, source: 'local' },
  { id: 'd', title: 'Milonga', artist: 'Canaro', singer: 'Maida', year: '1937', style: 'Milonga', bpm: 110, rating: 4, tags: ['Bright'], source: 'youtube' },
];
test('rich filters combine accent-insensitive artists, voices, tags and numeric ranges', () => {
  assert.deepEqual(libraryQuery(tracks, { artist: 'canaro', singer: 'maida', yearMin: 1930, yearMax: 1940, bpmMin: 115, tag: 'warm', ratingMin: 5, vocal: 'vocal' }).map(track => track.id), ['a']);
  assert.deepEqual(libraryQuery(tracks, { artist: 'angel', vocal: 'instrumental' }).map(track => track.id), ['b']);
  assert.deepEqual(libraryQuery(tracks, { search: 'clean transfer' }).map(track => track.id), ['a']);
  assert.deepEqual(libraryQuery(tracks, { search: 'bright' }).map(track => track.id), ['d']);
});
test('numeric filters keep unknown values by explicit default and can exclude them', () => {
  assert.deepEqual(libraryQuery(tracks, { yearMin: 1940, bpmMin: 130 }).map(track => track.id), ['b', 'c']);
  assert.deepEqual(libraryQuery(tracks, { yearMin: 1940, bpmMin: 130, includeUnknown: false }).map(track => track.id), ['b']);
  assert.equal(vocalCategory(tracks[2]), 'unknown'); assert.equal(vocalCategory(tracks[1]), 'instrumental');
});
test('readiness and existing collection/style/source/played filters remain composable', () => {
  const sourceStatus = track => ({ a: 'Stored copy', b: 'Permission needed', c: '' }[track.id] || '');
  assert.deepEqual(libraryQuery(tracks, { readiness: 'ready' }, { sourceStatus }).map(track => track.id), ['a']);
  assert.deepEqual(libraryQuery(tracks, { readiness: 'attention' }, { sourceStatus }).map(track => track.id), ['b']);
  assert.deepEqual(libraryQuery(tracks, { readiness: 'unknown' }, { sourceStatus }).map(track => track.id), ['c']);
  assert.deepEqual(libraryQuery(tracks, { ids: ['a', 'd'], style: 'Milonga', source: 'youtube', readiness: 'online' }, { sourceStatus }).map(track => track.id), ['d']);
  assert.deepEqual(libraryQuery(tracks, { hidePlayed: true }, { hasPlayed: track => track.id === 'a' }).map(track => track.id), ['b', 'c', 'd']);
});
test('both sort directions put unknown numeric metadata last and preserve source order', () => {
  const original = structuredClone(tracks);
  assert.deepEqual(libraryQuery(tracks, { sort: 'year' }).map(track => track.id), ['a', 'd', 'b', 'c']);
  assert.deepEqual(libraryQuery(tracks, { sort: 'year', direction: 'desc' }).map(track => track.id), ['b', 'd', 'a', 'c']);
  assert.deepEqual(libraryQuery(tracks, { sort: 'rating', direction: 'desc' }).map(track => track.id), ['a', 'd', 'b', 'c']);
  assert.deepEqual(tracks, original); assert.equal(libraryQuery(tracks)[0], tracks[0]);
});
