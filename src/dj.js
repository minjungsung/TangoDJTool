import { flattenSet } from './model.js';

const positive = value => Number.isFinite(value) && value > 0;
const normalizeLabel = value => typeof value === 'string' ? value.normalize('NFD').replace(/\p{M}/gu, '').trim().replace(/\s+/g, ' ').toLowerCase() : '';
const knownName = value => {
  const name = normalizeLabel(value);
  return ['unknown', 'unknown orchestra', 'unknown singer', 'unspecified', 'n/a', '-', '—', '?'].includes(name) ? '' : name;
};

/** Position is the absolute source position, including any saved cue offset. */
export function queueRuntime(queue, index = -1, position = 0, gapSeconds = 0) {
  const from = Number.isInteger(index) && index >= 0 ? index : 0;
  const gap = Number.isFinite(gapSeconds) ? Math.min(10, Math.max(0, gapSeconds)) : 0;
  const result = { knownSeconds: 0, unknownCount: 0, heldCount: 0 };
  for (let i = from; i < queue.length; i++) {
    const item = queue[i];
    const start = Number.isFinite(item.startSeconds) ? Math.max(0, item.startSeconds) : 0;
    const sourceEnd = positive(item.track?.duration) ? item.track.duration : Infinity;
    const clipEnd = positive(item.limitSeconds) ? start + item.limitSeconds : Infinity;
    const end = Math.min(sourceEnd, clipEnd);
    const elapsedPosition = i === index && Number.isFinite(position) ? Math.max(start, position) : start;
    if (Number.isFinite(end)) result.knownSeconds += Math.max(0, end - elapsedPosition);
    else result.unknownCount++;
    const next = queue[i + 1];
    if (gap && item.kind === 'tanda' && item.groupId && next?.kind === 'tanda' && next.groupId === item.groupId) result.knownSeconds += gap;
    if (item.holdAfter) result.heldCount++;
  }
  return result;
}

/** Preparation review only: an online connection cannot validate a video embed. */
export function inspectProgram(groups, tracks, sourceStatuses = new Map(), online = true) {
  const issues = [];
  const library = new Map(tracks.map(track => [track.id, track]));
  const checkedSources = new Set(), repeated = new Set(), seenMusic = new Set();
  const add = (level, code, message, groupId, trackId) => issues.push({ level, code, message,
    ...(groupId != null ? { groupId } : {}), ...(trackId != null ? { trackId } : {}) });
  if (!groups.length) add('error', 'empty-program', 'The program has no tandas or cortinas.');
  for (const group of groups) {
    if (!group.trackIds.length) {
      add('warning', 'empty-group', 'This group has no recordings and will be skipped.', group.id);
      continue;
    }
    const groupTracks = [];
    for (const trackId of group.trackIds) {
      const track = library.get(trackId);
      if (!track) {
        add('error', 'missing-recording', 'A recording referenced by this group is missing from the library.', group.id, trackId);
        continue;
      }
      groupTracks.push(track);
      if (!checkedSources.has(trackId)) {
        checkedSources.add(trackId);
        if (track.source === 'local') {
          const status = sourceStatuses instanceof Map ? sourceStatuses.get(trackId) : sourceStatuses?.[trackId];
          if (status === 'Permission needed') add('error', 'permission-needed', 'Grant access to this original file before playback.', group.id, trackId);
          else if (status === 'File changed') add('error', 'file-changed', 'The original file has changed. Reconnect identical audio or review a replacement.', group.id, trackId);
          else if (status === 'File missing') add('error', 'missing-file', 'Locate or relink this local recording before playback.', group.id, trackId);
          else if (!['Ready', 'Stored copy'].includes(status)) add('warning', 'source-unchecked', 'Check this local file before playback; its availability has not been confirmed.', group.id, trackId);
        } else if (track.source === 'youtube') {
          add(online ? 'warning' : 'error', online ? 'youtube-network' : 'youtube-offline', online
            ? 'YouTube requires an internet connection. Video availability and permission to embed have not been verified.'
            : 'YouTube cannot play while offline. Connect to the internet or use a local recording.', group.id, trackId);
        }
      }
      if (group.kind === 'tanda') {
        const identity = track.source === 'youtube' && track.videoId ? `youtube:${track.videoId}`
          : track.source === 'local' && track.contentHash ? `local:${track.contentHash}` : `id:${track.id}`;
        if (seenMusic.has(identity) && !repeated.has(identity)) {
          add('warning', 'repeated-recording', 'This recording is used more than once in the tandas. Review whether the repeat is intentional.', group.id, trackId);
          repeated.add(identity);
        }
        seenMusic.add(identity);
      }
    }
    const checkedClips = new Set();
    for (const clip of flattenSet([group], tracks)) {
      if (checkedClips.has(clip.track.id)) continue;
      checkedClips.add(clip.track.id);
      const start = clip.startSeconds ?? 0, limit = clip.limitSeconds;
      if (!Number.isFinite(start) || start < 0 || (limit != null && (!positive(limit)))) {
        add('error', 'cue-range', 'The playback cue must have a nonnegative start and an end after the start.', group.id, clip.track.id);
      } else if (positive(clip.track.duration)) {
        if (start >= clip.track.duration) add('error', 'cue-start', 'The playback cue starts at or beyond the recording end. Choose an earlier start.', group.id, clip.track.id);
        else if (limit != null && start + limit > clip.track.duration) add('warning', 'cue-end', 'The selected cue ends beyond the recording length. Playback will stop at the source end.', group.id, clip.track.id);
      }
    }
    if (group.kind !== 'tanda' || !groupTracks.length) continue;
    const orchestras = new Set(groupTracks.map(track => knownName(track.artist)).filter(Boolean));
    if (orchestras.size > 1) add('warning', 'mixed-orchestras', 'This tanda includes recordings from different orchestras or artists. Review whether this combination is intentional.', group.id);
    // Instrumental is explicit metadata; an empty singer field remains unknown.
    const singers = new Set(groupTracks.map(track => knownName(track.singer)).filter(Boolean));
    if (singers.size > 1) add('warning', 'mixed-singers', 'This tanda includes different singers or mixes identified instrumental and vocal recordings. Review whether this combination is intentional.', group.id);
    const styles = new Set(groupTracks.map(track => normalizeLabel(track.style)).filter(style => ['tango', 'vals', 'milonga', 'cortina'].includes(style)));
    if (styles.has('cortina')) add('warning', 'cortina-in-tanda', 'This tanda includes a recording marked as Cortina. Review whether its placement in the tanda is intentional.', group.id, groupTracks.find(track => normalizeLabel(track.style) === 'cortina').id);
    if (styles.size > 1) add('warning', 'mixed-styles', 'This tanda mixes dance styles. Review whether that progression is intentional.', group.id);
    const expected = styles.size === 1 && styles.has('tango') ? 4 : styles.size === 1 && (styles.has('vals') || styles.has('milonga')) ? 3 : null;
    if (expected && group.trackIds.length !== expected) add('warning', 'tanda-size', `This ${styles.has('tango') ? 'tango' : styles.has('vals') ? 'vals' : 'milonga'} tanda has ${group.trackIds.length} recordings; ${expected} is the usual recommendation.`, group.id);
    else if (!expected && ![3, 4].includes(group.trackIds.length)) add('warning', 'tanda-size', 'A tanda usually contains 3–4 recordings. Review the chosen length.', group.id);
  }
  const tandas = groups.filter(group => group.kind === 'tanda');
  if (tandas.length >= 6) {
    const styles = tandas.map(group => {
      const recordings = group.trackIds.map(id => library.get(id));
      if (!recordings.length || recordings.some(track => !track)) return null;
      const style = normalizeLabel(recordings[0].style);
      return ['tango', 'vals', 'milonga'].includes(style) && recordings.every(track => normalizeLabel(track.style) === style) ? style : null;
    });
    if (styles.every(Boolean)) {
      const cycle = ['tango', 'tango', 'vals', 'tango', 'tango', 'milonga'];
      const deviation = styles.findIndex((style, index) => style !== cycle[index % cycle.length]);
      if (deviation >= 0) add('warning', 'dance-cycle', 'The tanda order differs from the common Tango / Tango / Vals / Tango / Tango / Milonga cycle. Review whether this sequence is intentional.', tandas[deviation].id);
    }
  }
  return issues;
}
