import { removeTrack } from './model.js';

const copy = value => structuredClone(value);
export const preparation = state => copy({ tracks: state.tracks, groups: state.groups, collections: state.collections || [], presets: state.presets || [] });
const key = state => {
  const value = preparation(state);
  for (const group of value.groups) delete group.collapsed;
  return JSON.stringify(value);
};
const sources = state => JSON.stringify(state.tracks.map(track => [track.id, track.source, track.videoId || '', track.contentHash || '']).sort((a, b) => a[0].localeCompare(b[0])));

/** Page-local preparation history. Transport and original audio are never snapshots. */
export class EditHistory {
  constructor(limit = 60) { this.limit = limit; this.undoEntries = []; this.redoEntries = []; this.current = null; this.boundary = 'Reload starts a new edit history.'; }
  reset(state, selected = null, reason = 'Reload starts a new edit history.') {
    this.current = { state: preparation(state), selected }; this.undoEntries = []; this.redoEntries = []; this.boundary = reason;
  }
  updateDuration(track) {
    if (!Number.isFinite(track.duration) || track.duration <= 0) return;
    for (const entry of [this.current, ...this.undoEntries, ...this.redoEntries]) {
      const recording = entry?.state.tracks.find(item => item.id === track.id);
      if (recording && sources({ tracks: [recording] }) === sources({ tracks: [track] })) recording.duration = track.duration;
    }
  }
  observe(state, selected = null, label = null) {
    if (!this.current) return;
    const previousSources = new Map(this.current.state.tracks.map(track => [track.id, sources({ tracks: [track] })]));
    const remainingSources = new Map(state.tracks.map(track => [track.id, sources({ tracks: [track] })]));
    const deletedOnly = remainingSources.size < previousSources.size && [...remainingSources].every(([id, identity]) => previousSources.get(id) === identity);
    if (deletedOnly) {
      const removed = [...previousSources.keys()].filter(id => !remainingSources.has(id));
      for (const entry of [this.current, ...this.undoEntries, ...this.redoEntries]) for (const id of removed) entry.state = removeTrack(entry.state, id);
      this.boundary = 'Deleted recordings are removed from preparation history.';
    }
    if (key(state) === key(this.current.state)) { this.current = { state: preparation(state), selected }; return; }
    if (sources(state) !== sources(this.current.state)) { this.reset(state, selected, 'Library sources changed; a new edit history starts here.'); return; }
    const name = label || (JSON.stringify(state.tracks) !== JSON.stringify(this.current.state.tracks) ? 'Edit recording metadata' : JSON.stringify(state.groups) !== JSON.stringify(this.current.state.groups) ? 'Edit tanda composition' : 'Edit saved sets');
    this.undoEntries.push({ ...copy(this.current), label: name });
    if (this.undoEntries.length > this.limit) this.undoEntries.shift();
    this.redoEntries = []; this.current = { state: preparation(state), selected };
  }
  get undoLabel() { return this.undoEntries.at(-1)?.label || null; }
  get redoLabel() { return this.redoEntries.at(-1)?.label || null; }
  move(direction) {
    const from = direction === 'undo' ? this.undoEntries : this.redoEntries;
    const to = direction === 'undo' ? this.redoEntries : this.undoEntries;
    const entry = from.pop(); if (!entry) return null;
    to.push({ ...copy(this.current), label: entry.label });
    this.current = { state: copy(entry.state), selected: entry.selected };
    return copy(this.current);
  }
}
