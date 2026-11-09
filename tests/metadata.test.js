import test from 'node:test';
import assert from 'node:assert/strict';
import { safeMetadataText, localRecordingMetadata } from '../src/metadata.js';
import { validateSet } from '../src/model.js';
import { DJSession } from '../src/session.js';

test('external text accepts strings, trims and bounds them, and falls back without coercing values', () => {
  assert.equal(safeMetadataText('  Poema  '), 'Poema');
  assert.equal(safeMetadataText(`  ${'t'.repeat(1005)}  `).length, 1000);
  for (const value of [undefined, null, 1943, true, [], ['Poema'], { toString: () => 'Poema' }, ' \n\t ']) {
    assert.equal(safeMetadataText(value), '');
    assert.equal(safeMetadataText(value, '  Fallback  '), 'Fallback');
  }
  assert.equal(safeMetadataText(null, ['Fallback']), '');
  assert.equal(safeMetadataText(null, 'f'.repeat(1005)).length, 1000);
});

test('missing or whitespace-only tag titles use the filename stem and then a usable default', () => {
  for (const title of [undefined, null, '', ' \n ', ['Title'], {}]) {
    assert.equal(localRecordingMetadata({ title }, {}, '  recording.flac').title, 'recording');
    assert.equal(localRecordingMetadata({ title }, {}, '.wav').title, 'Untitled recording');
  }
  assert.equal(localRecordingMetadata(null, null, undefined).title, 'Untitled recording');
  assert.equal(localRecordingMetadata([], 'invalid', null).title, 'Untitled recording');
});

test('local tags retain typed artist and singer text and support numeric or string years', () => {
  assert.deepEqual(localRecordingMetadata({ title: ' Poema ', artist: ' Canaro ', albumartist: 'Other artist', singer: ' Maida ', year: 1935, genre: [' tAnGo '], bpm: 120 }, { duration: 180.5 }, 'file.wav'), {
    title: 'Poema', artist: 'Canaro', singer: 'Maida', year: '1935', style: 'Tango', bpm: 120, duration: 180.5,
  });
  assert.equal(localRecordingMetadata({ artist: ' ', albumartist: ' Canaro ', year: ' 1935 ' }, {}, '').artist, 'Canaro');
  assert.equal(localRecordingMetadata({ year: ' 1935 ' }, {}, '').year, '1935');
  for (const year of [Infinity, NaN, true, {}, []]) assert.equal(localRecordingMetadata({ year }, {}, '').year, '');
});

test('malformed numeric analysis and genre tags do not reject otherwise playable music', () => {
  for (const value of [-1, -12, Infinity, -Infinity, NaN, '120', true, {}, [], undefined, null]) {
    const metadata = localRecordingMetadata({ bpm: value, genre: [null, {}, 1, 'Unknown', ' mILONGA '] }, { duration: value }, 'file.wav');
    assert.equal(metadata.bpm, null); assert.equal(metadata.duration, null); assert.equal(metadata.style, 'Milonga');
  }
  assert.equal(localRecordingMetadata({ genre: ' vals ' }, {}, '').style, 'Vals');
  assert.equal(localRecordingMetadata({ genre: [' jazz ', null] }, {}, '').style, '');
  assert.equal(localRecordingMetadata({ genre: {} }, {}, '').style, '');
  const zero = localRecordingMetadata({ bpm: 0 }, { duration: 0 }, 'file.wav');
  assert.equal(zero.bpm, 0); assert.equal(zero.duration, 0);
});

test('bounded external metadata survives set validation and session recording without changing raw tags', () => {
  const common = { title: `  ${'t'.repeat(1005)}  `, artist: 'a'.repeat(1005), singer: 's'.repeat(1005), year: 'y'.repeat(1005), genre: [null, 'Cortina'], bpm: -1 };
  const original = structuredClone(common);
  const track = { id: 'recording', source: 'local', ...localRecordingMetadata(common, { duration: Infinity }, 'file.wav') };
  assert.doesNotThrow(() => validateSet({ version: 1, tracks: [track], groups: [] }));
  const session = new DJSession({ storage: null }); session.start('Milonga');
  assert.ok(session.recordPlayback(1, { track }, 0));
  assert.equal(session.events[0].title.length, 1000); assert.equal(session.events[0].artist.length, 1000);
  assert.deepEqual(common, original);
});
