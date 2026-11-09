const MAX_TEXT_LENGTH = 1000;
const danceStyles = ['Tango', 'Vals', 'Milonga', 'Cortina'];

export function safeMetadataText(value, fallback = '') {
  const normalize = text => typeof text === 'string' ? text.trim().slice(0, MAX_TEXT_LENGTH).trim() : '';
  return normalize(value) || normalize(fallback);
}

const nonnegativeNumber = value => Number.isFinite(value) && value >= 0 ? value : null;

export function localRecordingMetadata(common, format, fileName) {
  common = common && typeof common === 'object' && !Array.isArray(common) ? common : {};
  format = format && typeof format === 'object' && !Array.isArray(format) ? format : {};
  const filenameStem = typeof fileName === 'string' ? fileName.replace(/\.[^.]+$/, '') : '';
  const fallbackTitle = safeMetadataText(filenameStem, 'Untitled recording');
  const year = typeof common.year === 'number' && Number.isFinite(common.year) ? String(common.year) : common.year;
  const genres = Array.isArray(common.genre) ? common.genre : [common.genre];
  let style = '';
  for (const genre of genres) {
    if (typeof genre !== 'string') continue;
    style = danceStyles.find(candidate => candidate.toLowerCase() === genre.trim().toLowerCase()) || '';
    if (style) break;
  }
  return {
    title: safeMetadataText(common.title, fallbackTitle),
    artist: safeMetadataText(common.artist, safeMetadataText(common.albumartist)),
    singer: safeMetadataText(common.singer),
    year: safeMetadataText(year),
    style,
    bpm: nonnegativeNumber(common.bpm),
    duration: nonnegativeNumber(format.duration),
  };
}
