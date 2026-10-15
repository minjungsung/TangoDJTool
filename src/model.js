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
  return groups.flatMap(group => group.trackIds.filter(id => library.has(id)).map(id => ({
    track: library.get(id), groupId: group.id, kind: group.kind, groupName: group.name, ...(group.limitSeconds ? { limitSeconds: group.limitSeconds } : {}),
  })));
}

export function removeTrack(state, id) {
  return { ...state, tracks: state.tracks.filter(t => t.id !== id),
    groups: state.groups.map(g => ({ ...g, trackIds: g.trackIds.filter(t => t !== id) })) };
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
    groupIds.add(group.id);
  }
  return { tracks: value.tracks, groups: value.groups };
}
