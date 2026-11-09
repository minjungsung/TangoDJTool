import { flattenSet } from './model.js';

export function groupDuration(group, tracks) {
  return flattenSet([group], tracks).reduce((total, item) => {
    const available = item.track.duration == null ? (item.limitSeconds ?? 0) : Math.max(0, item.track.duration - item.startSeconds);
    return total + Math.min(item.limitSeconds ?? Infinity, available);
  }, 0);
}

export function queueSignature(groups, tracks) {
  return JSON.stringify(flattenSet(groups, tracks).map(item => [item.track.id, item.groupId, item.groupName, item.limitSeconds ?? null, item.startSeconds, Boolean(item.holdAfter), item.occurrenceId ?? null, item.kind ?? null]));
}

export function locateInQueue(queue, trackId, currentIndex) {
  if (queue[currentIndex]?.track.id === trackId) return currentIndex;
  const later = queue.findIndex((item, index) => index > currentIndex && item.track.id === trackId);
  return later >= 0 ? later : queue.findIndex(item => item.track.id === trackId);
}
