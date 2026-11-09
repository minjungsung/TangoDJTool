export const uid = () => crypto.randomUUID();

const text = (value, maximum, required = false) => typeof value === 'string' && value.length <= maximum && (!required || value.trim().length > 0);

export function youtubeId(input) {
  try {
    const url = new URL(input);
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    const host = url.hostname.replace(/^www\./, '');
    let id;
    if (host === 'youtu.be') id = url.pathname.split('/')[1];
    else if (['youtube.com', 'm.youtube.com', 'youtube-nocookie.com'].includes(host)) {
      id = url.searchParams.get('v') || (/^\/(embed|shorts|live)\//.test(url.pathname) ? url.pathname.split('/')[2] : null);
    }
    return /^[\w-]{11}$/.test(id || '') ? id : null;
  } catch { return null; }
}

export function recordingClip(track) {
  const startSeconds = track.cueStartSeconds ?? 0;
  return { startSeconds, ...(track.cueEndSeconds != null ? { limitSeconds: track.cueEndSeconds - startSeconds } : {}) };
}

export function flattenSet(groups, tracks) {
  const library = new Map(tracks.map(t => [t.id, t]));
  return groups.flatMap(group => group.trackIds.map((id, index) => ({ id, index })).filter(({ id }) => library.has(id)).map(({ id, index }) => {
    const track = library.get(id);
    const clip = group.kind === 'tanda' ? recordingClip(track) : {
      startSeconds: group.startSeconds ?? 0,
      ...(group.limitSeconds && !(group.kind === 'cortina' && group.fullLength) ? { limitSeconds: group.limitSeconds } : {}),
    };
    return { track, ...clip, ...(group.occurrenceIds?.[index] ? { occurrenceId: group.occurrenceIds[index] } : {}), groupId: group.id, kind: group.kind, groupName: group.name, ...(group.holdAfter ? { holdAfter: true } : {}) };
  }));
}

export function removeTrack(state, id) {
  return { ...state, tracks: state.tracks.filter(t => t.id !== id),
    groups: state.groups.map(g => ({ ...g, trackIds: g.trackIds.filter(t => t !== id), ...(g.occurrenceIds ? { occurrenceIds: g.occurrenceIds.filter((_, index) => g.trackIds[index] !== id) } : {}) })),
    collections: (state.collections || []).map(collection => ({ ...collection, trackIds: collection.trackIds.filter(trackId => trackId !== id) })),
    presets: (state.presets || []).map(preset => ({ ...preset, trackIds: preset.trackIds.filter(trackId => trackId !== id), ...(preset.cortina ? { cortina: { ...preset.cortina, trackIds: preset.cortina.trackIds.filter(trackId => trackId !== id), ...(preset.cortina.occurrenceIds ? { occurrenceIds: preset.cortina.occurrenceIds.filter((_, index) => preset.cortina.trackIds[index] !== id) } : {}) } } : {}) })) };
}

export function validateSet(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.tracks) || !Array.isArray(value.groups)) throw new Error('Unsupported set file.');
  if (value.tracks.length > 10000 || value.groups.length > 1000) throw new Error('Set file is too large.');
  const ids = new Set();
  for (const track of value.tracks) {
    if (!track || !text(track.id, 500, true) || ids.has(track.id) || !['local', 'youtube'].includes(track.source) || !text(track.title, 1000, true)) throw new Error('Invalid track data.');
    ids.add(track.id);
    if (track.source === 'youtube' && (typeof track.videoId !== 'string' || !/^[\w-]{11}$/.test(track.videoId))) throw new Error('Invalid YouTube video.');
    for (const field of ['artist', 'singer', 'year', 'style', 'fileName']) if (track[field] != null && !text(track[field], 1000)) throw new Error('Invalid metadata.');
    if (track.notes != null && !text(track.notes, 4000)) throw new Error('Invalid recording notes.');
    if (track.tags != null && (!Array.isArray(track.tags) || track.tags.length > 30 || Array.from(track.tags).some(tag => !text(tag, 60, true)) || new Set(track.tags.map(tag => tag.trim().toLowerCase())).size !== track.tags.length)) throw new Error('Invalid recording tags.');
    if (track.rating != null && (!Number.isInteger(track.rating) || track.rating < 1 || track.rating > 5)) throw new Error('Invalid recording rating.');
    for (const field of ['fileSize', 'lastModified']) if (track[field] != null && (!Number.isSafeInteger(track[field]) || track[field] < 0)) throw new Error('Invalid file metadata.');
    if (track.bpmConfidence != null && (!Number.isFinite(track.bpmConfidence) || track.bpmConfidence < 0 || track.bpmConfidence > 1)) throw new Error('Invalid BPM confidence.');
    if (track.bpmCandidates != null && (!Array.isArray(track.bpmCandidates) || track.bpmCandidates.length > 6 || Array.from(track.bpmCandidates).some(bpm => !Number.isFinite(bpm) || bpm < 20 || bpm > 300))) throw new Error('Invalid BPM candidates.');
    if (track.bpmSource != null && !['estimate', 'manual', 'tap', 'half', 'double'].includes(track.bpmSource)) throw new Error('Invalid BPM source.');
    if (track.integratedLufs != null && (!Number.isFinite(track.integratedLufs) || track.integratedLufs < -90 || track.integratedLufs > 10)) throw new Error('Invalid measured loudness.');
    if (track.truePeakDb != null && (!Number.isFinite(track.truePeakDb) || track.truePeakDb < -180 || track.truePeakDb > 24)) throw new Error('Invalid measured peak.');
    if (track.loudnessAnalysisVersion != null && track.loudnessAnalysisVersion !== 'bs1770-k-4x-v1') throw new Error('Invalid loudness analysis version.');
    if (track.measuredSeconds != null && (!Number.isFinite(track.measuredSeconds) || track.measuredSeconds <= 0 || track.measuredSeconds > 86400)) throw new Error('Invalid measurement duration.');
    if (track.provenance != null) {
      if (!Array.isArray(track.provenance) || track.provenance.length > 50) throw new Error('Invalid recording provenance.');
      for (const entry of track.provenance) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry) || Object.keys(entry).some(key => !['format', 'sourceName', 'sourceHash', 'row', 'reference', 'playlist'].includes(key)) || !['csv', 'm3u'].includes(entry.format)
          || !text(entry.sourceName, 255, true) || /[\\/]/.test(entry.sourceName) || typeof entry.sourceHash !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sourceHash)
          || !Number.isInteger(entry.row) || entry.row < 1 || entry.row > 1000000 || (entry.reference != null && (!text(entry.reference, 1000) || (/[\\/]/.test(entry.reference) && !/^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/.test(entry.reference))))
          || (entry.playlist != null && !text(entry.playlist, 1000))) throw new Error('Invalid recording provenance.');
      }
    }
    for (const field of ['duration', 'bpm', 'rmsDb', 'peakDb', 'gainDb']) if (track[field] != null && (!Number.isFinite(track[field]) || (['duration', 'bpm'].includes(field) && track[field] < 0) || (field === 'gainDb' && Math.abs(track[field]) > 12))) throw new Error('Invalid analysis.');
    if (track.cueStartSeconds != null && (!Number.isFinite(track.cueStartSeconds) || track.cueStartSeconds < 0 || track.cueStartSeconds > 86400)) throw new Error('Invalid recording cue start.');
    if (track.cueEndSeconds != null && (!Number.isFinite(track.cueEndSeconds) || track.cueEndSeconds <= (track.cueStartSeconds ?? 0) || track.cueEndSeconds > 90000)) throw new Error('Invalid recording cue end.');
  }
  const groupIds = new Set(), occurrenceIds = new Set();
  for (const group of value.groups) {
    if (!group || !text(group.id, 500, true) || groupIds.has(group.id) || !text(group.name, 1000, true) || !['tanda', 'cortina'].includes(group.kind) || !Array.isArray(group.trackIds) || group.trackIds.some(id => !ids.has(id))) throw new Error('Invalid tanda data.');
    if (group.limitSeconds != null && (!Number.isFinite(group.limitSeconds) || group.limitSeconds <= 0 || group.limitSeconds > 3600)) throw new Error('Invalid group playback limit.');
    if (group.startSeconds != null && (!Number.isFinite(group.startSeconds) || group.startSeconds < 0 || group.startSeconds > 86400)) throw new Error('Invalid group start position.');
    if (group.holdAfter != null && typeof group.holdAfter !== 'boolean') throw new Error('Invalid group hold setting.');
    if (group.occurrenceIds != null) {
      if (!Array.isArray(group.occurrenceIds) || group.occurrenceIds.length !== group.trackIds.length) throw new Error('Invalid recording occurrences.');
      for (const id of group.occurrenceIds) {
        if (!text(id, 500, true) || occurrenceIds.has(id)) throw new Error('Invalid recording occurrences.');
        occurrenceIds.add(id);
      }
    }
    for (const field of ['parentId', 'presetId']) if (group[field] != null && !text(group[field], 500)) throw new Error('Invalid tanda metadata.');
    if (group.notes != null && typeof group.notes !== 'string') throw new Error('Invalid tanda metadata.');
    for (const field of ['collapsed', 'fullLength']) if (group[field] != null && typeof group[field] !== 'boolean') throw new Error('Invalid tanda setting.');
    groupIds.add(group.id);
  }
  for (const field of ['collections', 'presets']) {
    if (value[field] == null) continue;
    if (!Array.isArray(value[field]) || value[field].length > 1000) throw new Error('Invalid saved collections.');
    const savedIds = new Set();
    for (const item of value[field]) {
      if (!item || !text(item.id, 500, true) || savedIds.has(item.id) || !text(item.name, 1000, true) || !Array.isArray(item.trackIds) || item.trackIds.length > 10000 || item.trackIds.some(id => !ids.has(id))) throw new Error('Invalid saved collection.');
      savedIds.add(item.id);
      if (item.notes != null && typeof item.notes !== 'string') throw new Error('Invalid notes.');
      if (item.cortina) validateSet({ version: 1, tracks: value.tracks, groups: [item.cortina] });
    }
  }
  for (const track of value.tracks) if (track.contentHash != null && (typeof track.contentHash !== 'string' || !/^[a-f0-9]{64}$/.test(track.contentHash))) throw new Error('Invalid content identity.');
  return { tracks: value.tracks, groups: value.groups, collections: value.collections || [], presets: value.presets || [] };
}
