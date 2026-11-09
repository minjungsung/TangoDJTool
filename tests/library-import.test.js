import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV, parseLibraryImport, previewLibraryImport, applyLibraryImport } from '../src/library-import.js';

const fixture = () => ({ tracks: [{ id: 'known', source: 'local', title: 'Poema', artist: 'Canaro', singer: '', fileName: 'poema.wav', contentHash: 'a'.repeat(64), cueStartSeconds: 5 }], groups: [], collections: [], presets: [] });
test('CSV reads quoted commas, escaped quotes and multiline notes without losing record order', () => {
  assert.deepEqual(parseCSV('Title,Notes\r\n"Poema, Canaro","Transfer ""A""\nSecond line"\r\n'), [['Title', 'Notes'], ['Poema, Canaro', 'Transfer "A"\nSecond line']]);
  assert.deepEqual(parseCSV('Title;Artist\nPoema;Canaro'), [['Title', 'Artist'], ['Poema', 'Canaro']]);
  assert.throws(() => parseCSV('Title\n"unfinished'), /Unclosed/);
});
test('CSV preview maps metadata and cues, preserves portable provenance and requires duplicate decisions', async () => {
  const state = fixture(), parsed = await parseLibraryImport('File,Title,Orchestra,Singer,Year,Genre,BPM,Cue in,Cue out,Playlist\n/music/poema.wav,Poema,Canaro,Maida,1935,Tango,120,12,150,Opening', 'csv', '/imports/library.csv');
  const preview = previewLibraryImport(state, parsed);
  assert.equal(preview.rows[0].candidates[0].id, 'known');
  assert.throws(() => applyLibraryImport(state, preview, [{ action: '' }]), /explicit/);
  const next = applyLibraryImport(state, preview, [{ action: 'merge', trackId: 'known' }]);
  assert.equal(next.tracks.length, 1); assert.equal(next.tracks[0].singer, 'Maida'); assert.equal(next.tracks[0].cueStartSeconds, 5); assert.equal(next.tracks[0].cueEndSeconds, 150);
  assert.equal(next.collections[0].name, 'Opening'); assert.deepEqual(next.collections[0].trackIds, ['known']);
  assert.equal(next.tracks[0].provenance[0].sourceName, 'library.csv'); assert.equal(next.tracks[0].provenance[0].reference, 'poema.wav'); assert.match(next.tracks[0].provenance[0].sourceHash, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(next).includes('/imports/'), false); assert.equal(JSON.stringify(next).includes('/music/'), false); assert.equal(state.tracks[0].singer, '');
});
test('M3U import preserves repeated playlist placements and explicit duplicate reuse within the file', async () => {
  const state = { tracks: [], groups: [], collections: [], presets: [] };
  const parsed = await parseLibraryImport('#EXTM3U\n#PLAYLIST:Opening\n#EXTINF:180,Canaro - Poema\n/music/poema.wav\n#EXTINF:180,Canaro - Poema\n/music/poema.wav\nhttps://youtu.be/abcdefghijk', 'm3u', 'opening.m3u');
  const preview = previewLibraryImport(state, parsed);
  assert.equal(preview.rows[1].candidates[0].id, preview.rows[0].proposedId);
  const next = applyLibraryImport(state, preview, [{ action: 'new' }, { action: 'reuse', trackId: preview.rows[0].proposedId }, { action: 'new' }]);
  assert.equal(next.tracks.length, 2); assert.equal(next.tracks[0].fileName, 'poema.wav'); assert.equal(next.tracks[0].contentHash, undefined);
  assert.deepEqual(next.collections[0].trackIds, [next.tracks[0].id, next.tracks[0].id, next.tracks[1].id]); assert.equal(next.tracks[1].videoId, 'abcdefghijk');
});
test('invalid rows can be reviewed and skipped but cannot mutate sources or stale previews', async () => {
  const state = fixture();
  const invalid = previewLibraryImport(state, await parseLibraryImport('File,Title,BPM\npoema.wav,Poema,-12', 'csv', 'bad.csv'));
  assert.ok(invalid.rows[0].errors.length); assert.throws(() => applyLibraryImport(state, invalid, [{ action: 'new' }]), /Invalid bpm/);
  assert.equal(applyLibraryImport(state, invalid, [{ action: 'skip' }]).tracks.length, 1);
  const conflict = previewLibraryImport(state, await parseLibraryImport(`ID,Title,SHA256\nknown,Poema,${'b'.repeat(64)}`, 'csv', 'changed.csv'));
  assert.throws(() => applyLibraryImport(state, conflict, [{ action: 'replace', trackId: 'known' }]), /Different audio/);
  state.tracks[0].title = 'Changed while reviewing';
  assert.throws(() => applyLibraryImport(state, conflict, [{ action: 'new' }]), /library changed/);
});
test('ID-only metadata imports preserve absent titles and the existing provider identity', async () => {
  const state = { tracks: [{ id: 'video', source: 'youtube', videoId: 'abcdefghijk', title: 'Original title', artist: '' }], groups: [], collections: [], presets: [] };
  const preview = previewLibraryImport(state, await parseLibraryImport('ID,Artist\nvideo,Canaro', 'csv', 'artists.csv'));
  const next = applyLibraryImport(state, preview, [{ action: 'replace', trackId: 'video' }]);
  assert.equal(next.tracks[0].title, 'Original title'); assert.equal(next.tracks[0].videoId, 'abcdefghijk'); assert.equal(next.tracks[0].artist, 'Canaro');
});
test('VLC M3U cues are source seconds and malformed intervals remain reviewable errors', async () => {
  const parsed = await parseLibraryImport('#EXTM3U\n#EXTINF:180,Canaro - Poema\n#EXTVLCOPT:start-time=12.5\n#EXTVLCOPT:stop-time=60\npoema.wav\n#EXTVLCOPT:start-time=60\n#EXTVLCOPT:stop-time=12\nbad.wav', 'm3u', 'opening.m3u');
  assert.equal(parsed.rows[0].track.cueStartSeconds, 12.5); assert.equal(parsed.rows[0].track.cueEndSeconds, 60); assert.deepEqual(parsed.rows[0].errors, []);
  assert.match(parsed.rows[1].errors.join(' '), /Cue out/);
});
test('known imported styles match existing filters and supplied BPM replaces obsolete estimator evidence', async () => {
  const state = fixture(); Object.assign(state.tracks[0], { bpm: 64, bpmConfidence: .8, bpmCandidates: [64, 128], bpmSource: 'estimate' });
  const parsed = await parseLibraryImport('ID,Style,BPM\nknown,tango,66', 'csv', 'tempos.csv');
  const next = applyLibraryImport(state, previewLibraryImport(state, parsed), [{ action: 'replace', trackId: 'known' }]);
  assert.equal(next.tracks[0].style, 'Tango'); assert.equal(next.tracks[0].bpm, 66); assert.equal(next.tracks[0].bpmConfidence, null); assert.equal(next.tracks[0].bpmCandidates, undefined); assert.equal(next.tracks[0].bpmSource, 'manual');
  const retained = applyLibraryImport(state, previewLibraryImport(state, parsed), [{ action: 'merge', trackId: 'known' }]);
  assert.equal(retained.tracks[0].bpm, 64); assert.equal(retained.tracks[0].bpmConfidence, .8); assert.deepEqual(retained.tracks[0].bpmCandidates, [64, 128]);
});
