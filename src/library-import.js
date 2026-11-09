import { uid, youtubeId, validateSet } from './model.js';
import { safeMetadataText } from './metadata.js';
import { assertLibraryPreviewFresh, parseRecordingTags } from './library-service.js';
import { librarySearchKey } from './library-query.js';

const MAX_IMPORT_LENGTH = 5 * 1024 * 1024;
const basename = value => typeof value === 'string' ? value.replace(/\\/g, '/').split('/').pop().trim() : '';
const importName = (value, format) => basename(value).slice(0, 255) || `library.${format}`;
const fields = {
  title: ['title', 'name', 'track'], artist: ['artist', 'orchestra', 'albumartist'], singer: ['singer', 'vocalist'], year: ['year', 'date'], style: ['style', 'genre'], bpm: ['bpm', 'tempo'],
  duration: ['duration', 'seconds', 'durationseconds'], cueStartSeconds: ['cuein', 'cuestart', 'cuestartseconds', 'start'], cueEndSeconds: ['cueout', 'cueend', 'cueendseconds', 'end'],
  fileName: ['filename', 'file', 'path', 'location'], url: ['url', 'youtube', 'videourl'], videoId: ['videoid'], contentHash: ['contenthash', 'sha256', 'hash'], id: ['id', 'trackid'], playlist: ['playlist', 'collection', 'tanda', 'group'],
  notes: ['notes', 'transfernotes'], tags: ['tags', 'character', 'energytags'], rating: ['rating'], source: ['source'],
};
const headerKey = value => value.trim().toLowerCase().replace(/[\s_\-/]/g, '');

export function parseCSV(text) {
  const input = text.replace(/^\uFEFF/, ''), firstLine = input.split(/\r?\n/)[0];
  const delimiter = firstLine.includes('\t') && !firstLine.includes(',') ? '\t' : firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';
  const rows = [], row = []; let cell = '', quoted = false, closed = false;
  const finishCell = () => { row.push(cell); cell = ''; closed = false; };
  const finishRow = () => { finishCell(); if (row.some(value => value.trim())) rows.push([...row]); row.length = 0; };
  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') { cell += '"'; index++; }
      else if (char === '"') { quoted = false; closed = true; }
      else cell += char;
    } else if (char === '"') {
      if (cell || closed) throw new Error('Invalid CSV quotation.');
      quoted = true;
    } else if (char === delimiter) finishCell();
    else if (char === '\n' || char === '\r') { if (char === '\r' && input[index + 1] === '\n') index++; finishRow(); }
    else { if (closed && !/\s/.test(char)) throw new Error('Invalid text after a CSV quotation.'); if (!closed) cell += char; }
    if (rows.length > 10001 || row.length > 50) throw new Error('Library import is too large.');
  }
  if (quoted) throw new Error('Unclosed CSV quotation.');
  if (cell || row.length || closed) finishRow();
  return rows;
}

function numeric(value, field, errors) {
  if (value == null || value.trim() === '') return undefined;
  const result = Number(value);
  if (!Number.isFinite(result) || result < 0) { errors.push(`Invalid ${field}.`); return undefined; }
  return result;
}
function importedRow(values, index, playlist = '') {
  const errors = [], rawFile = values.fileName || '', url = values.url || '', explicitVideo = values.videoId || '';
  const videoId = youtubeId(url || rawFile) || (/^[\w-]{11}$/.test(explicitVideo) ? explicitVideo : null);
  const wantsVideo = values.source === 'youtube' || url || explicitVideo;
  if (wantsVideo && !videoId) errors.push('Only local files and valid YouTube links are supported.');
  if (!videoId && /^https?:\/\//i.test(rawFile)) errors.push('Online audio streams are not supported.');
  const fileName = safeMetadataText(basename(rawFile));
  const track = { source: videoId ? 'youtube' : 'local', title: safeMetadataText(values.title, fileName.replace(/\.[^.]+$/, '') || (videoId ? `YouTube · ${videoId}` : 'Untitled recording')), artist: safeMetadataText(values.artist), singer: safeMetadataText(values.singer), year: safeMetadataText(values.year), style: safeMetadataText(values.style) };
  track.style = ['Tango', 'Vals', 'Milonga', 'Cortina'].find(style => librarySearchKey(style) === librarySearchKey(track.style)) || track.style;
  if (videoId) track.videoId = videoId;
  else if (fileName) track.fileName = fileName;
  for (const field of ['bpm', 'duration', 'cueStartSeconds', 'cueEndSeconds']) {
    const value = numeric(values[field], field, errors); if (value !== undefined) track[field] = value;
  }
  if (track.cueStartSeconds > 86400 || track.cueEndSeconds > 90000 || track.cueEndSeconds != null && track.cueEndSeconds <= (track.cueStartSeconds || 0)) errors.push('Cue out must follow cue in within supported source positions.');
  if (values.contentHash) {
    if (/^[a-f0-9]{64}$/.test(values.contentHash.trim())) track.contentHash = values.contentHash.trim();
    else errors.push('Invalid SHA-256 content hash.');
  }
  if (values.notes) track.notes = values.notes.trim().slice(0, 4000);
  if (values.tags) { try { track.tags = parseRecordingTags(values.tags); } catch (error) { errors.push(error.message); } }
  if (values.rating) { track.rating = numeric(values.rating, 'rating', errors); if (!Number.isInteger(track.rating) || track.rating < 1 || track.rating > 5) errors.push('Rating must be a whole number from 1 to 5.'); }
  return { index, track, externalId: values.id?.trim() || '', identitySpecified: Boolean(rawFile || url || explicitVideo || values.source || values.contentHash), providedFields: Object.keys(values).filter(field => typeof values[field] === 'string' && values[field].trim()), playlist: safeMetadataText(values.playlist, playlist), reference: videoId ? `https://www.youtube.com/watch?v=${videoId}` : fileName, errors };
}

export async function parseLibraryImport(text, format, sourceName = '') {
  if (typeof text !== 'string' || text.length > MAX_IMPORT_LENGTH) throw new Error('Library files must be smaller than 5 MB.');
  if (!['csv', 'm3u'].includes(format)) throw new Error('Choose a CSV or M3U library file.');
  const name = importName(sourceName, format), sourceHash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(byte => byte.toString(16).padStart(2, '0')).join('');
  const rows = [], warnings = [];
  if (format === 'csv') {
    const records = parseCSV(text);
    if (records.length < 2) throw new Error('CSV needs a header and at least one recording.');
    const headers = records.shift().map(headerKey), mapping = headers.map(header => Object.keys(fields).find(field => fields[field].includes(header)));
    if (!mapping.some(field => ['title', 'fileName', 'url', 'videoId', 'id'].includes(field))) throw new Error('CSV needs a Title, File, URL, Video ID or ID column.');
    if (new Set(mapping.filter(Boolean)).size !== mapping.filter(Boolean).length) throw new Error('CSV has duplicate metadata columns.');
    const unknown = headers.filter((header, index) => !mapping[index]); if (unknown.length) warnings.push(`Unmapped columns: ${unknown.join(', ')}`);
    records.forEach((record, index) => {
      const values = {};
      mapping.forEach((field, column) => { if (field) values[field] = record[column] || ''; });
      const row = importedRow(values, index + 2); if (record.length !== headers.length) row.errors.push('CSV row does not match its header.'); rows.push(row);
    });
  } else {
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/); let details = {}, playlist = safeMetadataText(name.replace(/\.[^.]+$/, ''), 'Imported playlist');
    lines.forEach((line, index) => {
      line = line.trim();
      if (!line) return;
      if (line.startsWith('#PLAYLIST:')) { playlist = safeMetadataText(line.slice(10), playlist); return; }
      if (line.startsWith('#EXTINF:')) {
        const match = /^#EXTINF:([^,]*),(.*)$/.exec(line); details = {};
        if (match) {
          const duration = Number(match[1]); if (Number.isFinite(duration) && duration >= 0) details.duration = String(duration);
          const label = match[2], separator = label.indexOf(' - ');
          if (separator >= 0) { details.artist = label.slice(0, separator); details.title = label.slice(separator + 3); } else details.title = label;
        }
        return;
      }
      if (line.startsWith('#EXTVLCOPT:start-time=')) { details.cueStartSeconds = line.slice('#EXTVLCOPT:start-time='.length); return; }
      if (line.startsWith('#EXTVLCOPT:stop-time=')) { details.cueEndSeconds = line.slice('#EXTVLCOPT:stop-time='.length); return; }
      if (line.startsWith('#')) return;
      rows.push(importedRow({ ...details, fileName: line }, index + 1, playlist)); details = {};
    });
  }
  if (!rows.length || rows.length > 10000 || rows.some(row => row.index > 1000000)) throw new Error('Choose a library with 1 to 10,000 supported recording rows.');
  return { format, sourceName: name, sourceHash, rows, warnings };
}

function candidatesFor(state, row) {
  const result = [];
  for (const track of state.tracks) {
    let reason = '';
    if (row.track.source === 'youtube' && track.source === 'youtube' && row.track.videoId === track.videoId) reason = 'Same YouTube recording';
    else if (row.track.contentHash && track.source === 'local' && track.contentHash === row.track.contentHash) reason = 'Same audio hash';
    else if (row.externalId && (row.externalId === track.id || row.externalId === track._externalId)) reason = 'Matching recording ID';
    else if (row.track.fileName && track.source === 'local' && librarySearchKey(basename(track.fileName)) === librarySearchKey(row.track.fileName)) reason = 'Matching filename; verify the recording';
    else if (librarySearchKey(row.track.title) === librarySearchKey(track.title) && row.track.artist && librarySearchKey(row.track.artist) === librarySearchKey(track.artist)) reason = 'Matching title and artist; verify the recording';
    if (reason) result.push({ id: track.id, title: track.title, reason });
  }
  return result;
}
export function previewLibraryImport(state, parsed) {
  const available = { tracks: [...state.tracks] }, rows = [];
  for (const row of parsed.rows) {
    const proposedId = uid();
    rows.push({ ...structuredClone(row), proposedId, candidates: candidatesFor(available, row) });
    if (!row.errors.length) available.tracks.push({ id: proposedId, ...row.track, _externalId: row.externalId });
  }
  return { base: structuredClone(state), parsed, rows };
}
const mergeFields = ['title', 'artist', 'singer', 'year', 'style', 'bpm', 'duration', 'cueStartSeconds', 'cueEndSeconds', 'notes', 'tags', 'rating'];
const unknownValue = value => value == null || value === '' || Array.isArray(value) && !value.length;
export function applyLibraryImport(state, preview, decisions, { createPlaylists = true } = {}) {
  assertLibraryPreviewFresh(state, preview);
  if (!Array.isArray(decisions) || decisions.length !== preview.rows.length) throw new Error('Review a duplicate decision for every row.');
  const next = structuredClone(state), playlists = new Map(), resolved = new Map();
  preview.rows.forEach((row, index) => {
    const decision = decisions[index];
    if (!decision || !['skip', 'new', 'reuse', 'merge', 'replace'].includes(decision.action)) throw new Error('Choose an explicit duplicate decision for every row.');
    if (decision.action === 'skip') return;
    if (row.errors.length) throw new Error(`Row ${row.index}: ${row.errors.join(' ')}`);
    let track;
    if (decision.action === 'new') { track = { id: row.proposedId, ...structuredClone(row.track) }; next.tracks.push(track); }
    else {
      track = next.tracks.find(track => track.id === (resolved.get(decision.trackId) || decision.trackId));
      if (!track || !row.candidates.some(candidate => candidate.id === decision.trackId)) throw new Error('Choose one of the reviewed matching recordings.');
      if (row.identitySpecified && (track.source !== row.track.source || track.source === 'youtube' && track.videoId !== row.track.videoId || track.contentHash && row.track.contentHash && track.contentHash !== row.track.contentHash)) throw new Error('Different audio cannot replace a recording through metadata import. Choose Add separately.');
      if (decision.action !== 'reuse') for (const field of mergeFields) if (row.providedFields.includes(field) && !unknownValue(row.track[field]) && (decision.action === 'replace' || unknownValue(track[field]))) {
        if (field === 'bpm' && track.bpm !== row.track.bpm) { track.bpmSource = 'manual'; track.bpmConfidence = null; delete track.bpmCandidates; }
        track[field] = structuredClone(row.track[field]);
      }
    }
    resolved.set(row.proposedId, track.id);
    const provenance = { format: preview.parsed.format, sourceName: preview.parsed.sourceName, sourceHash: preview.parsed.sourceHash, row: row.index, ...(row.reference ? { reference: row.reference } : {}), ...(row.playlist ? { playlist: row.playlist } : {}) };
    track.provenance ||= [];
    if (!track.provenance.some(entry => JSON.stringify(entry) === JSON.stringify(provenance))) track.provenance = [...track.provenance, provenance].slice(-50);
    if (createPlaylists) {
      const name = row.playlist || safeMetadataText(preview.parsed.sourceName.replace(/\.[^.]+$/, ''), 'Imported library');
      if (!playlists.has(name)) playlists.set(name, []);
      playlists.get(name).push(track.id);
    }
  });
  next.collections ||= [];
  for (const [name, trackIds] of playlists) next.collections.push({ id: uid(), name, trackIds });
  validateSet({ version: 1, ...next });
  return next;
}
