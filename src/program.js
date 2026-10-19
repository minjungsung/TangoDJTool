import { uid } from './model.js';

export function normalizeProgram(state) {
  state.collections ||= [];
  state.presets ||= [];
  for (const group of state.groups) {
    group.occurrenceIds = group.trackIds.map((_, i) => group.occurrenceIds?.[i] || uid());
  }
  // Preserve standalone cortinas and saved advance behavior.
  state.groups.forEach((group, i) => {
    if (group.kind === 'cortina' && group.parentId === undefined && state.groups[i - 1]?.kind === 'tanda') group.parentId = state.groups[i - 1].id;
  });
  return state;
}

export function insertNext(state, queue, currentIndex, track, targetId) {
  normalizeProgram(state);
  const active = queue[currentIndex];
  const group = state.groups.find(group => group.id === targetId && group.kind === 'tanda');
  if (!group) throw new Error('Choose a target tanda first.');
  const sameTanda = active?.groupId === targetId && active.kind === 'tanda';
  const occurrenceIndex = sameTanda ? group.occurrenceIds.indexOf(active.occurrenceId) : -1;
  if (sameTanda && occurrenceIndex < 0) throw new Error('Update the upcoming queue before adding a recording.');
  let position = sameTanda ? occurrenceIndex + 1 : 0;
  while (position < group.trackIds.length && queue.some(item => item.occurrenceId === group.occurrenceIds[position] && item.addedAfter === active?.occurrenceId)) position++;
  const occurrenceId = uid();
  group.trackIds.splice(position, 0, track.id); group.occurrenceIds.splice(position, 0, occurrenceId);
  let queuePosition = sameTanda ? currentIndex + 1 : queue.findIndex((item, i) => i > currentIndex && item.groupId === targetId);
  if (queuePosition < 0) {
    const cortina = state.groups.find(item => item.parentId === targetId);
    queuePosition = queue.findIndex((item, i) => i > currentIndex && item.groupId === cortina?.id);
    if (queuePosition < 0) queuePosition = queue.length;
  }
  while (queue[queuePosition]?.addedAfter === active?.occurrenceId && queue[queuePosition]?.groupId === targetId) queuePosition++;
  const item = { track: structuredClone(track), groupId: group.id, groupName: group.name, kind: 'tanda', occurrenceId, addedAfter: active?.occurrenceId, pendingAddition: true };
  queue.splice(queuePosition, 0, item);
  return item;
}
