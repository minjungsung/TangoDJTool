export function groupDuration(group, tracks) {
  const byId = new Map(tracks.map(track => [track.id, track]));
  return group.trackIds.reduce((total, id) => total + (group.limitSeconds || byId.get(id)?.duration || 0), 0);
}

export function queueSignature(groups, tracks) {
  return JSON.stringify(groups.flatMap(group => group.trackIds.filter(id => tracks.some(track => track.id === id))
    .map(id => [id, group.id, group.limitSeconds || null])));
}

export function locateInQueue(queue, trackId, currentIndex) {
  if (queue[currentIndex]?.track.id === trackId) return currentIndex;
  const later = queue.findIndex((item, index) => index > currentIndex && item.track.id === trackId);
  return later >= 0 ? later : queue.findIndex(item => item.track.id === trackId);
}
