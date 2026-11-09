import { flattenSet } from './model.js';
import { queueRuntime } from './dj.js';

export function backTiming(queue, { deadline, now = Date.now(), index = -1, position = 0, gapSeconds = 0, gapRemaining = null } = {}) {
  const target = typeof deadline === 'number' ? deadline : Date.parse(deadline);
  if (!Number.isFinite(target) || !Number.isFinite(now)) return null;
  const runtime = queueRuntime(queue, index, position, gapSeconds);
  if (gapRemaining != null) runtime.knownSeconds = Math.max(0, runtime.knownSeconds - gapSeconds + gapRemaining);
  const availableSeconds = (target - now) / 1000;
  const candidates = [];
  const start = Math.max(0, index);
  for (let i = start; i < queue.length; i++) {
    const item = queue[i], next = queue[i + 1];
    if (item.kind !== 'tanda' || (next?.kind === 'tanda' && next.groupId === item.groupId)) continue;
    const partial = queueRuntime(queue.slice(0, i + 1), index, position, gapSeconds);
    if (gapRemaining != null) partial.knownSeconds = Math.max(0, partial.knownSeconds - gapSeconds + gapRemaining);
    candidates.push({ groupId: item.groupId, name: item.groupName, endIndex: i, ...partial,
      slackSeconds: availableSeconds - partial.knownSeconds, conditional: Boolean(partial.unknownCount || partial.heldCount) });
  }
  const fitting = candidates.filter(candidate => candidate.slackSeconds >= 0 && !candidate.conditional);
  return { ...runtime, availableSeconds, slackSeconds: availableSeconds - runtime.knownSeconds,
    conditional: Boolean(runtime.unknownCount || runtime.heldCount), candidates,
    suggestion: fitting.at(-1) || null };
}

const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const planTime = seconds => Number.isFinite(seconds) ? `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.floor(Math.max(0, seconds)) % 60).padStart(2, '0')}` : 'Unknown';

/** A portable document references source identities, never filesystem paths. */
export function eventRundown(state, { gapSeconds = 0, deadline = '', finalGroupId = '' } = {}) {
  const items = flattenSet(state.groups, state.tracks);
  const total = queueRuntime(items, -1, 0, gapSeconds);
  const groups = state.groups.map((group, index) => {
    const clips = items.filter(item => item.groupId === group.id);
    const runtime = queueRuntime(clips, -1, 0, gapSeconds);
    const missing = group.trackIds.length - clips.length;
    const rows = clips.map((item, j) => {
      const recording = item.track, duration = queueRuntime([item]);
      const reference = recording.source === 'youtube' ? `https://www.youtube.com/watch?v=${recording.videoId}` : recording.contentHash ? `SHA-256 ${recording.contentHash}` : 'Local source identity unverified';
      return `<tr><td>${j + 1}</td><td><strong>${esc(recording.title)}</strong><br>${esc(recording.artist || 'Unknown orchestra')}${recording.singer ? ` · ${esc(recording.singer)}` : ' · Singer unknown'}<br><small>${esc(recording.style || 'Style unknown')} · ${esc(recording.year || 'Year unknown')}</small></td><td>${planTime(item.startSeconds || 0)} → ${item.limitSeconds ? planTime((item.startSeconds || 0) + item.limitSeconds) : 'Source end'}<br>${duration.unknownCount ? 'Unknown length' : planTime(duration.knownSeconds)}</td><td>${item.holdAfter ? 'Manual advance required' : 'Auto next if enabled'}<br><small>${esc(reference)}</small></td></tr>`;
    }).join('');
    return `<section><h2>${index + 1}. ${esc(group.name)} · ${group.kind === 'tanda' ? 'Tanda' : 'Cortina'}${finalGroupId === group.id ? ' · Reviewed final tanda' : ''}</h2><p>Known runtime ${planTime(runtime.knownSeconds)} · Unknown lengths ${runtime.unknownCount + missing} · Manual waits ${runtime.heldCount}</p>${group.notes ? `<p>${esc(group.notes)}</p>` : ''}${missing ? `<p>Missing recording references: ${missing}</p>` : ''}<table><thead><tr><th>#</th><th>Recording / orchestra / singer</th><th>Source cues / duration</th><th>Transition / portable source reference</th></tr></thead><tbody>${rows}</tbody></table></section>`;
  }).join('');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Tango DJ event rundown</title><style>body{font:15px system-ui,sans-serif;max-width:1100px;margin:32px auto;padding:0 20px;color:#162027}h1{font-size:28px}h2{font-size:20px}section{margin:28px 0}table{width:100%;border-collapse:collapse}td,th{text-align:left;vertical-align:top;border-bottom:1px solid #ccc;padding:10px}small{overflow-wrap:anywhere}thead{display:table-header-group}@media print{body{font-size:11px;margin:0}tr{break-inside:avoid}h2{break-after:avoid}}</style><h1>Tango DJ event rundown</h1><p>Known program time: ${planTime(total.knownSeconds)} · Unknown lengths: ${total.unknownCount} · Manual waits: ${total.heldCount} · In-tanda gap: ${gapSeconds} seconds</p>${deadline ? `<p>Event deadline (local time): ${esc(deadline.replace('T', ' '))}</p>` : ''}<p>Times include recording cues and configured in-tanda gaps. Holds and unknown sources need review; no finish time is guaranteed. The reviewed final tanda is a manual planning marker and does not truncate or stop playback. Rehearse the sources and sound system before the event.</p>${groups}</html>`;
}
