import { validateSet } from './model.js';
import { librarySearchKey } from './library-query.js';

export const editableRecordingFields = ['title', 'artist', 'singer', 'year', 'style', 'bpm', 'cueStartSeconds', 'cueEndSeconds', 'notes', 'tags', 'rating'];
export function parseRecordingTags(value) {
  if (!Array.isArray(value) && typeof value !== 'string') throw new Error('Tags must be text.');
  const tags = Array.isArray(value) ? value : value.split(',');
  const result = [], seen = new Set();
  for (const item of tags) {
    if (typeof item !== 'string') throw new Error('Tags must be text.');
    const tag = item.trim();
    if (!tag) continue;
    if (tag.length > 60) throw new Error('Each tag must be at most 60 characters.');
    const key = librarySearchKey(tag);
    if (!seen.has(key)) { result.push(tag); seen.add(key); }
  }
  if (result.length > 30) throw new Error('Use at most 30 tags per recording.');
  return result;
}
const unknown = value => value == null || value === '' || Array.isArray(value) && value.length === 0;
export function assertLibraryPreviewFresh(state, preview) {
  if (!preview?.base || JSON.stringify(state) !== JSON.stringify(preview.base)) throw new Error('The library changed. Review the changes again before applying them.');
}
export function previewBatchEdit(state, ids, edits) {
  if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length || ids.some(id => !state.tracks.some(track => track.id === id))) throw new Error('Choose existing recordings for the batch.');
  if (!edits || typeof edits !== 'object' || Array.isArray(edits) || Object.keys(edits).some(field => !editableRecordingFields.includes(field))) throw new Error('Unsupported recording field.');
  const nextState = structuredClone(state), changes = [];
  for (const track of nextState.tracks.filter(track => ids.includes(track.id))) {
    const fields = [];
    for (const [field, edit] of Object.entries(edits)) {
      if (!edit || !['keep', 'set', 'fill', 'clear'].includes(edit.mode)) throw new Error('Choose a valid batch edit action.');
      if (edit.mode === 'keep' || edit.mode === 'fill' && !unknown(track[field])) continue;
      let value = edit.value;
      if (edit.mode === 'clear') {
        if (field === 'title') throw new Error('Recording titles cannot be cleared.');
        value = field === 'tags' ? [] : ['bpm', 'cueStartSeconds', 'cueEndSeconds', 'rating'].includes(field) ? null : '';
      } else {
        if (unknown(value)) throw new Error('Blank values are kept. Choose Clear explicitly to remove a value.');
        if (field === 'tags') { value = parseRecordingTags(value); if (!value.length) throw new Error('Blank values are kept. Choose Clear explicitly to remove a value.'); }
        else if (['bpm', 'cueStartSeconds', 'cueEndSeconds', 'rating'].includes(field)) {
          if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Use a finite numeric value.');
        } else {
          if (typeof value !== 'string') throw new Error('Metadata values must be text.');
          value = value.trim();
          if (!value) throw new Error('Blank values are kept. Choose Clear explicitly to remove a value.');
        }
      }
      if (JSON.stringify(track[field]) === JSON.stringify(value)) continue;
      fields.push({ field, before: structuredClone(track[field]), after: structuredClone(value) });
      track[field] = value;
      if (field === 'bpm') { track.bpmSource = value == null ? undefined : 'manual'; track.bpmConfidence = null; delete track.bpmCandidates; }
    }
    if (fields.length) changes.push({ trackId: track.id, title: track.title, fields });
  }
  validateSet({ version: 1, ...nextState });
  return { base: structuredClone(state), nextState, changes, ids: [...ids] };
}
export function applyBatchEdit(state, preview) { assertLibraryPreviewFresh(state, preview); return structuredClone(preview.nextState); }
