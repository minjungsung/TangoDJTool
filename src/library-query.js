export const librarySearchKey = value => typeof value === 'string' ? value.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase() : '';
const unknownNames = new Set(['', 'unknown', 'unknown singer', 'unspecified', 'n/a', '-', '—', '?']);
export function vocalCategory(track) {
  const singer = librarySearchKey(track.singer);
  if (unknownNames.has(singer)) return 'unknown';
  return ['instrumental', 'instrumental recording', 'sin cantor', 'sin cantante'].includes(singer) ? 'instrumental' : 'vocal';
}
const knownNumber = value => Number.isFinite(value) && value > 0 ? value : null;
const knownYear = value => typeof value === 'string' && /^\d{1,4}$/.test(value.trim()) ? Number(value) : null;
const optionalNumber = value => value === '' || value == null ? null : Number(value);
function inRange(value, minimum, maximum, includeUnknown) {
  if (minimum == null && maximum == null) return true;
  if (value == null) return includeUnknown;
  return (minimum == null || value >= minimum) && (maximum == null || value <= maximum);
}

export function libraryQuery(tracks, options = {}, { sourceStatus = () => '', hasPlayed = () => false } = {}) {
  const includeUnknown = options.includeUnknown !== false;
  const yearMin = optionalNumber(options.yearMin), yearMax = optionalNumber(options.yearMax);
  const bpmMin = optionalNumber(options.bpmMin), bpmMax = optionalNumber(options.bpmMax), ratingMin = optionalNumber(options.ratingMin);
  const search = librarySearchKey(options.search), artist = librarySearchKey(options.artist), singer = librarySearchKey(options.singer), tag = librarySearchKey(options.tag);
  const result = tracks.map((track, index) => ({ track, index })).filter(({ track }) => {
    if (options.ids && !options.ids.includes(track.id)) return false;
    if (options.style && track.style !== options.style || options.source && track.source !== options.source) return false;
    if (search && !librarySearchKey([track.title, track.artist, track.singer, track.year, track.notes, ...(track.tags || [])].filter(value => typeof value === 'string').join(' ')).includes(search)) return false;
    if (artist && !librarySearchKey(track.artist).includes(artist) || singer && !librarySearchKey(track.singer).includes(singer)) return false;
    if (tag && !(track.tags || []).some(value => librarySearchKey(value).includes(tag))) return false;
    if (options.vocal && vocalCategory(track) !== options.vocal) return false;
    if (options.hidePlayed && hasPlayed(track)) return false;
    if (!inRange(knownYear(track.year), yearMin, yearMax, includeUnknown) || !inRange(knownNumber(track.bpm), bpmMin, bpmMax, includeUnknown) || !inRange(knownNumber(track.rating), ratingMin, null, includeUnknown)) return false;
    const status = sourceStatus(track);
    if (options.readiness === 'ready' && !(track.source === 'local' && ['Ready', 'Stored copy'].includes(status))) return false;
    if (options.readiness === 'attention' && !(track.source === 'local' && ['File missing', 'File changed', 'Permission needed'].includes(status))) return false;
    if (options.readiness === 'unknown' && !(track.source === 'local' && !['Ready', 'Stored copy', 'File missing', 'File changed', 'Permission needed'].includes(status))) return false;
    if (options.readiness === 'online' && track.source !== 'youtube') return false;
    return true;
  });
  const sort = options.sort || 'library';
  if (sort !== 'library') {
    const value = track => sort === 'year' ? knownYear(track.year) : ['bpm', 'duration', 'rating'].includes(sort) ? knownNumber(track[sort]) : librarySearchKey(track[sort]) || null;
    const direction = options.direction === 'desc' ? -1 : 1;
    result.sort((a, b) => {
      const first = value(a.track), second = value(b.track);
      if (first == null || second == null) return first == null && second == null ? a.index - b.index : first == null ? 1 : -1;
      const comparison = typeof first === 'number' ? first - second : first.localeCompare(second);
      return direction * comparison || a.index - b.index;
    });
  }
  return result.map(item => item.track);
}
