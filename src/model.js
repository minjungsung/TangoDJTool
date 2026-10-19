export const uid = () => crypto.randomUUID();

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

export function flattenSet(groups, tracks) {
  const library = new Map(tracks.map(t => [t.id, t]));
  return groups.flatMap(group => group.trackIds.map((id, index) => ({ id, index })).filter(({ id }) => library.has(id)).map(({ id, index }) => ({
    track: library.get(id), ...(group.occurrenceIds?.[index] ? { occurrenceId: group.occurrenceIds[index] } : {}), groupId: group.id, kind: group.kind, groupName: group.name, ...(group.limitSeconds ? { limitSeconds: group.limitSeconds } : {}), ...(group.startSeconds ? { startSeconds: group.startSeconds } : {}), ...(group.holdAfter ? { holdAfter: true } : {}),
  })));
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
    if (!track || typeof track.id !== 'string' || ids.has(track.id) || !['local', 'youtube'].includes(track.source) || typeof track.title !== 'string') throw new Error('Invalid track data.');
    ids.add(track.id);
    if (track.source === 'youtube' && !/^[\w-]{11}$/.test(track.videoId || '')) throw new Error('Invalid YouTube video.');
    for (const field of ['artist', 'singer', 'year', 'style', 'fileName']) if (track[field] != null && typeof track[field] !== 'string') throw new Error('Invalid metadata.');
    for (const field of ['duration', 'bpm', 'rmsDb', 'peakDb', 'gainDb']) if (track[field] != null && (!Number.isFinite(track[field]) || (field === 'duration' && track[field] < 0))) throw new Error('Invalid analysis.');
  }
  const groupIds = new Set();
  for (const group of value.groups) {
    if (!group || typeof group.id !== 'string' || groupIds.has(group.id) || typeof group.name !== 'string' || !['tanda', 'cortina'].includes(group.kind) || !Array.isArray(group.trackIds) || group.trackIds.some(id => !ids.has(id))) throw new Error('Invalid tanda data.');
    if (group.limitSeconds != null && (!Number.isFinite(group.limitSeconds) || group.limitSeconds <= 0 || group.limitSeconds > 3600)) throw new Error('Invalid group playback limit.');
    if (group.startSeconds != null && (!Number.isFinite(group.startSeconds) || group.startSeconds < 0 || group.startSeconds > 86400)) throw new Error('Invalid group start position.');
    if (group.holdAfter != null && typeof group.holdAfter !== 'boolean') throw new Error('Invalid group hold setting.');
    if (group.occurrenceIds != null && (!Array.isArray(group.occurrenceIds) || group.occurrenceIds.length !== group.trackIds.length || group.occurrenceIds.some(id => typeof id !== 'string') || new Set(group.occurrenceIds).size !== group.occurrenceIds.length)) throw new Error('Invalid recording occurrences.');
    for (const field of ['parentId', 'notes', 'presetId']) if (group[field] != null && typeof group[field] !== 'string') throw new Error('Invalid tanda metadata.');
    for (const field of ['collapsed', 'fullLength']) if (group[field] != null && typeof group[field] !== 'boolean') throw new Error('Invalid tanda setting.');
    groupIds.add(group.id);
  }
  for (const field of ['collections', 'presets']) {
    if (value[field] == null) continue;
    if (!Array.isArray(value[field]) || value[field].length > 1000) throw new Error('Invalid saved collections.');
    const savedIds = new Set();
    for (const item of value[field]) {
      if (!item || typeof item.id !== 'string' || savedIds.has(item.id) || typeof item.name !== 'string' || !Array.isArray(item.trackIds) || item.trackIds.length > 10000 || item.trackIds.some(id => !ids.has(id))) throw new Error('Invalid saved collection.');
      savedIds.add(item.id);
      if (item.notes != null && typeof item.notes !== 'string') throw new Error('Invalid notes.');
      if (item.cortina) validateSet({ version: 1, tracks: value.tracks, groups: [item.cortina] });
    }
  }
  for (const track of value.tracks) if (track.contentHash != null && !/^[a-f0-9]{64}$/.test(track.contentHash)) throw new Error('Invalid content identity.');
  return { tracks: value.tracks, groups: value.groups, collections: value.collections || [], presets: value.presets || [] };
}
