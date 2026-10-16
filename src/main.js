import './style.css';
import { parseBlob } from 'music-metadata';
import { uid, youtubeId, flattenSet, removeTrack, validateSet } from './model.js';
import { saveState, loadState, saveFile, getFile, deleteFile, replaceRecording, storageMessage } from './storage.js';
import { Player } from './player.js';
import { playbackMessage } from './fade.js';
import { REAL_SAMPLE_PACK, realTracks, realGroups, removeOldExamples } from './samples.js';
import { guideMarkup } from './guide.js';
import { groupDuration, queueSignature, locateInQueue } from './workspace.js';
import { t, startI18n, setLanguage, getLanguage } from './i18n.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const time = seconds => Number.isFinite(seconds) ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : '—';
let state = { tracks: [], groups: [] }, selected = null, queue = [], queueIndex = -1, current = null, busy = false;
let playRequest = 0, timedEnd = false, loadedSignature = null, resumeIndex = 0;
let undoGroups = null, transitioning = false, stopped = false, lastRenderedIndex = -1;
const files = new Map();
let savedQueue = [], revision = 0, firstVisit = true;
let settings = {};
try { settings = JSON.parse(localStorage.getItem('studio-settings') || '{}'); } catch {}
let persistence = Promise.resolve(), temporaryWorkspace = false;
function workspaceSnapshot(tracks = state.tracks) {
  return structuredClone({ ...state, tracks, queue: queue.map(item => ({ trackId: item.track.id, groupId: item.groupId, groupName: item.groupName, kind: item.kind, limitSeconds: item.limitSeconds, startSeconds: item.startSeconds, holdAfter: item.holdAfter })), queueIndex: queueIndex >= 0 ? queueIndex : resumeIndex, selected, loadedSignature });
}
function persist() {
  const snapshot = workspaceSnapshot();
  if (temporaryWorkspace) return Promise.resolve(false);
  $('#save-status').textContent = t('Saving…');
  persistence = persistence.then(() => saveState(snapshot, revision)).then(savedRevision => { revision = savedRevision; $('#storage-recovery').hidden = true; $('#save-status').textContent = t('Saved in this browser'); return true; }).catch(error => { $('#save-status').textContent = t('Save failed — export a backup'); notify(`Could not save your library: ${storageMessage(error)}`, true);
    if (!error?.message?.includes('another tab. Export')) showStorageRecovery(error);
    return false; });
  return persistence;
}
function notify(message, error = false) {
  const el = document.querySelector('#notice'); $('#notice-message').textContent = t(message); el.hidden = false; el.classList.toggle('error', error);
  clearTimeout(notify.timer); if (!error) notify.timer = setTimeout(() => { el.hidden = true; }, 5500);
}

 document.querySelector('#app').innerHTML = `
  <aside class="sidebar">
    <a class="brand" href="#"><span class="brand-icon">◈</span><span>TANGO<br><b>DJ STUDIO</b></span></a>
    <div class="workspace-label">YOUR WORKSPACE</div>
    <a href="#library" class="nav active">♫ <span>Music library</span><span id="nav-count" class="count">0</span></a>
    <a href="#set" class="nav">▤ <span>Set builder</span></a>
    <a href="#deck" class="nav">◉ <span>Live deck</span></a>
    <div class="sidebar-bottom"><span class="status-dot"></span> Local-first workspace<p>Music stays in this browser.<br>YouTube plays online.</p></div>
  </aside>
  <nav class="device-nav" aria-label="Workspace navigation"><button data-view="library" aria-current="page">1 · Music</button><button data-view="set">2 · Set</button><button data-view="deck">3 · Play</button></nav>
  <main>
    <header class="workspace-header"><div class="workspace-title"><h1>DJ workspace</h1><span id="save-status" role="status">Saved in this browser</span></div><button id="open-menu" class="phone-menu" aria-expanded="false">Menu</button><div class="header-actions"><button id="open-examples">Example sets</button><button id="open-guide">User guide</button><button id="open-settings">Settings</button><button id="import-set">Import set</button><button id="export-set">Export set ↗</button></div></header>
    <div id="notice" role="status" aria-live="polite" hidden><span id="notice-message"></span><button id="dismiss-notice" aria-label="Dismiss notification">×</button></div><div id="undo-bar" hidden><span>Set changed</span><button id="undo-set">Undo last set edit</button></div>
    <p class="workflow-hint">Add music, arrange your tandas, then play your set.</p><div id="storage-recovery" class="storage-recovery" role="status" hidden><strong>Temporary workspace · not saved</strong><p id="storage-recovery-message"></p><p>You can play the example set in this tab. Export your edits before closing or reloading.</p><div><button id="retry-saving">Retry saving</button><button id="temporary-export">Export set</button></div></div><div class="workspace">
      <section id="library" class="panel library">
        <div class="section-head"><div><div class="eyebrow">01 / COLLECTION</div><h2>Music library <span id="library-count">0</span></h2></div><button id="add-files" class="primary">+ Local files</button></div>
        <div id="drop-zone" tabindex="0" role="button" aria-label="Choose or drop local music files"><span class="drop-icon">↥</span><div><strong>Drop your music here</strong><span>MP3, WAV, FLAC, M4A and other browser-supported audio</span></div><span class="drop-link">Browse files</span></div>
        <form id="youtube-form" class="youtube-form"><span class="youtube-mark">▶</span><input name="url" type="url" aria-label="YouTube video URL" placeholder="Paste a YouTube video link" required><button type="submit">Add video</button></form>
        <p id="library-target" class="selection-summary"></p><p id="import-progress" class="hint" role="status" hidden></p><div class="filters"><input id="search" type="search" aria-label="Search library" placeholder="Search title, orchestra, singer…"><select id="style-filter" aria-label="Filter dance style"><option value="">All styles</option><option>Tango</option><option>Vals</option><option>Milonga</option><option>Cortina</option></select><select id="source-filter" aria-label="Filter source"><option value="">All sources</option><option value="local">Local</option><option value="youtube">YouTube</option></select></div>
        <div class="table-scroll"><table><thead><tr><th>RECORDING</th><th>STYLE / YEAR</th><th>BPM</th><th>LENGTH</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody id="tracks"></tbody></table></div>
        <div id="empty-library" class="empty"><span>♫</span><h3>A home for your collection</h3><p>Bring in your recordings, organize the details,<br>and find the right music for each moment.</p></div>
        <div class="panel-foot"><span id="library-summary">0 recordings · 0:00 known duration</span><button id="analyze-all" class="text-button">Analyze local tracks</button></div>
      </section>
      <section id="set" class="panel set-panel">
        <div class="section-head"><div><div class="eyebrow">02 / THE FLOW</div><h2>Set builder</h2></div><span id="set-duration" class="badge">0:00</span></div>
        <div class="builder-actions"><button id="add-tanda">+ Tanda</button><button id="add-cortina">+ Cortina</button></div>
        <p id="selected-group" class="selection-summary"></p><p class="hint">Select a group, then use + on a recording. Drag recordings into a group to add them.</p>
        <button id="choose-recordings" class="wide">Choose recordings for this group</button><div id="groups"></div>
        <div id="empty-set" class="empty"><span>▤</span><h3>Give your set a shape</h3><p>Create a tanda, choose its recordings,<br>then add a cortina between groups.</p></div>
        <button id="refresh-queue" class="wide" hidden>Update upcoming queue</button><p id="queue-stale" class="hint" hidden>Set changed. Update upcoming queue to keep the current recording, or load the whole set from the start.</p><button id="start-set" class="primary wide">▶ Load & play set</button>
      </section>
    </div>
    <section id="deck" class="panel deck">
      <div class="deck-main"><button id="deck-start-set" class="primary" hidden>Play prepared set</button><div class="eyebrow">03 / LIVE DECK</div><div class="now-playing"><div class="record-art">♫</div><div><span id="playing-group" class="eyebrow">READY WHEN YOU ARE</span><h2 id="playing-title">No recording loaded</h2><p id="playing-artist">Play a track or load your prepared set.</p></div></div>
        <div class="transport"><button id="previous" aria-label="Previous track">⏮</button><button id="play-pause" class="play-button" aria-label="Play or pause">▶</button><button id="next" aria-label="Next track">⏭</button><button id="stop" aria-label="Stop playback">■</button><span id="position">0:00 / 0:00</span></div>
        <div class="deck-context"><span id="recording-number"></span><span id="remaining-time"></span></div><div id="up-next" class="up-next" hidden></div>
        <input id="seek" type="range" min="0" max="100" value="0" aria-label="Playback position">
        <details class="playback-options" open><summary>Playback settings</summary><div class="deck-settings"><label>Volume <input id="volume" type="range" min="0" max="100" value="85"></label><label>Fade <select id="fade"><option value="0" selected>Off</option><option value="1">1 sec</option><option value="2">2 sec</option><option value="4">4 sec</option></select></label><label><input id="normalize" type="checkbox"> Level local audio</label><label><input id="auto-next" type="checkbox" checked> Auto next</label></div>
        <p class="hint">Fade follows the beginning and end of each recording. YouTube fades depend on device volume support; use local files for reliable fades. Preview uses the live output.</p></details><p id="playback-loading" class="hint" role="status" hidden>Loading recording…</p><div id="playback-recovery" class="playback-stall" hidden><span id="playback-recovery-message"></span><button id="playback-retry">Retry</button><button id="playback-relink">Relink file</button><button id="playback-skip">Skip recording</button></div>
        <div id="preview-status" class="preview-status" hidden><span></span><button id="stop-preview">Stop preview</button></div>
        <p id="playback-permission" class="hint" role="status" hidden>Playback has not started. Press play inside the YouTube video below, or press Play again.</p><div id="playback-stall" class="playback-stall" hidden><span>Playback is waiting for YouTube. Check your connection or retry from the current position.</span><button id="resume-video">Retry here</button></div><div id="youtube-wrap" hidden><div id="youtube-player"></div><div id="youtube-error" hidden><strong>YouTube video unavailable</strong><p id="youtube-error-message"></p><div class="video-recovery"><a id="youtube-open" target="_blank" rel="noopener noreferrer">Open on YouTube</a><button id="youtube-retry">Retry video</button><button id="youtube-replace">Replace video link</button><button id="youtube-local">Use my local recording</button><button id="youtube-skip">Skip unavailable video</button></div></div><p class="hint">If automatic playback is blocked, press play in the video.</p></div>
      </div>
      <div class="queue-panel"><div class="section-head"><h3>Play queue</h3><span id="queue-count" class="badge">0</span></div><p id="queue-resume" class="hint" hidden>Queue restored. Press Play to resume your last recording.</p><div id="queue"><p class="hint">Load a set or play a library track.</p></div></div>
    </section>
    <div id="mini-deck" class="mini-deck" hidden><button id="mini-open" class="mini-recording"><strong></strong><small></small></button><span id="mini-remaining"></span><button id="mini-play" aria-label="Play or pause">▶</button><button id="mini-next" aria-label="Next track">⏭</button></div>
    <footer>Made for the music between people.<span>Library & files saved locally · Export sets for backup</span></footer>
  </main>
  <dialog id="examples-dialog"><div class="dialog-heading"><h2>Example sets</h2><button data-close="examples-dialog" aria-label="Close">×</button></div><p class="hint">Six tandas with cortinas. Add this set to your workspace when you need a starting point.</p><div class="example-flow">Tango · Tango · Vals · Tango · Tango · Milonga</div><div id="example-actions"></div></dialog>
  <dialog id="guide-dialog"><div class="dialog-heading"><h2>User guide</h2><button data-close="guide-dialog" aria-label="Close">×</button></div>${guideMarkup}</dialog>
  <dialog id="settings-dialog"><div class="dialog-heading"><h2>Settings</h2><button data-close="settings-dialog" aria-label="Close">×</button></div><label class="language-control">Language <select id="language" aria-label="Language"><option value="ko">한국어</option><option value="en">English</option><option value="es">Español</option></select></label><p><a href="https://minjung-world.notion.site/Tango-DJ-Studio-Privacy-Policy-b7474a525fd882d39c2e01b0091b667b" target="_blank" rel="noopener noreferrer">Privacy policy</a> · <a href="https://minjung-world.notion.site/Tango-DJ-Studio-Terms-of-Use-c3174a525fd8831f9cab81b1b229fa08" target="_blank" rel="noopener noreferrer">Terms of use</a></p><section class="storage-panel"><div><strong>Personal workspace</strong><p>Your library, audio files, set, queue, and preferences are saved for this site in this browser. Other visitors have their own workspace.</p></div><div><button id="persist-storage">Request persistent storage</button><small id="storage-details"></small></div></section></dialog>
  <dialog id="actions-dialog"><div class="dialog-heading"><h2>Recording actions</h2><button data-close="actions-dialog" aria-label="Close">×</button></div><p id="actions-title" data-preserve></p><div id="recording-actions"></div></dialog><input id="file-input" type="file" accept="audio/*,.mp3,.wav,.flac,.m4a,.ogg,.aiff,.aif,.opus" multiple hidden>
  <input id="set-input" type="file" accept="application/json,.json" hidden>
  <input id="relink-input" type="file" accept="audio/*,.mp3,.wav,.flac,.m4a,.ogg,.aiff,.aif,.opus" hidden>
  <dialog id="metadata-dialog"><form id="metadata-form"><div class="eyebrow">RECORDING DETAILS</div><h2>Edit metadata</h2><input name="id" type="hidden"><label>Title<input name="title" required maxlength="300"></label><label>Orchestra / artist<input name="artist" maxlength="300"></label><label>Singer<input name="singer" maxlength="300"></label><div class="form-row"><label>Year<input name="year" maxlength="30"></label><label>Style<select name="style" aria-label="Style"><option value="">Unspecified</option><option>Tango</option><option>Vals</option><option>Milonga</option><option>Cortina</option></select></label><label>BPM<input name="bpm" type="number" min="20" max="300" step="1"></label></div><label id="video-url-label" hidden>Video URL<input name="videoUrl" type="url" placeholder="https://www.youtube.com/watch?v=..."></label><p id="analysis-details" class="hint"></p><div class="dialog-actions"><button id="close-metadata" type="button">Cancel</button><button class="primary" type="submit">Save details</button></div></form></dialog>
`;
const $ = selector => document.querySelector(selector);
$('#dismiss-notice').onclick = () => { $('#notice').hidden = true; clearTimeout(notify.timer); };
for (const [button, dialog] of [['open-examples','examples-dialog'],['open-guide','guide-dialog'],['open-settings','settings-dialog']]) $(`#${button}`).onclick = () => $(`#${dialog}`).showModal();
for (const button of document.querySelectorAll('[data-close]')) button.onclick = () => $(`#${button.dataset.close}`).close();
$('#example-actions').append($('#load-real-samples'), $('#real-sample-play'));
const phoneLayout = matchMedia('(max-width: 699px)');
let activeView = 'library';
function showView(view, scroll = true) {
  activeView = view; document.body.dataset.view = view;
  for (const button of document.querySelectorAll('button[data-view]')) {
    if (button.dataset.view === view) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  }
  if (scroll) $(phoneLayout.matches ? 'main' : `#${view}`).scrollIntoView({ behavior: 'smooth', block: 'start' });
  updateMiniDeck();
}
for (const button of document.querySelectorAll('button[data-view]')) button.onclick = () => showView(button.dataset.view);
for (const link of document.querySelectorAll('.sidebar .nav')) link.onclick = () => showView(link.hash.slice(1), false);
$('#open-menu').onclick = () => {
  const expanded = document.body.classList.toggle('menu-expanded'); $('#open-menu').setAttribute('aria-expanded', String(expanded));
};
$('#choose-recordings').onclick = () => { showView('library'); $('#search').focus({ preventScroll: true }); };
function syncDeviceLayout() { $('.playback-options').open = !phoneLayout.matches; showView(activeView, false); }
phoneLayout.addEventListener('change', syncDeviceLayout);
document.body.dataset.view = activeView;
$('.playback-options').open = !phoneLayout.matches;

function closePanels() { for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close(); }
function showStorageRecovery(error) {
  temporaryWorkspace = true; $('#storage-recovery').hidden = false;
  $('#storage-recovery-message').textContent = t(storageMessage(error));
  $('#save-status').textContent = t('Temporary · not saved');
}
$('#retry-saving').onclick = async () => {
  $('#retry-saving').disabled = true; temporaryWorkspace = false;
  try { await persist(); } finally { $('#retry-saving').disabled = false; }
};
$('#temporary-export').onclick = () => $('#export-set').click();


const player = new Player((position, duration) => {
  if (transitioning) return;
  const track = player.track;
  if (track?.source === 'youtube' && Number.isFinite(duration) && duration > 0) {
    const original = state.tracks.find(t => t.id === track.id);
    if (original && Math.abs((original.duration || 0) - duration) > 1) {
      original.duration = duration; for (const item of queue) if (item.track.id === track.id) item.track.duration = duration;
      void persist(); renderLibrary(); refreshGroupSummaries();
    }
  }
  const startSeconds = queue[queueIndex]?.startSeconds || 0;
  if (!transitioning && !timedEnd && Number.isFinite(duration) && duration > 0 && startSeconds >= duration) {
    timedEnd = true; player.stop(); updateTransport();
    notify('The start must be before the recording ends. Choose an earlier cue.', true); return;
  }
  position = Math.max(0, position - startSeconds);
  duration = Math.max(0, duration - startSeconds);
  const clipLimit = queue[queueIndex]?.limitSeconds;
  const playableDuration = clipLimit ? Math.min(clipLimit, duration > 0 ? duration : clipLimit) : duration;
  $('#position').textContent = `${time(clipLimit ? Math.min(position, clipLimit) : position)} / ${time(playableDuration)}`;
  const timelineDuration = playableDuration;
  $('#remaining-time').textContent = Number.isFinite(timelineDuration) && timelineDuration > 0 ? `${t('Remaining')}: ${time(Math.max(0, timelineDuration - position))}` : '';
  $('#mini-remaining').textContent = $('#remaining-time').textContent;
  $('#seek').value = Number.isFinite(timelineDuration) && timelineDuration > 0 ? Math.min(100, position / timelineDuration * 100) : 0;
  const limit = queue[queueIndex]?.limitSeconds;
  if (!transitioning && limit && position >= limit && !timedEnd) { timedEnd = true; player.stop(); if ($('#auto-next').checked && !queue[queueIndex]?.holdAfter) void next(); else notify('Cortina finished. Press Next to continue.'); }
}, () => { timedEnd = true; updateTransport(); if ($('#auto-next').checked && !queue[queueIndex]?.holdAfter) void next(); else if (queue[queueIndex]?.kind === 'cortina') notify('Cortina finished. Press Next to continue.'); }, error => {
  if (error?.type !== 'youtube') {
    if (current?.source === 'local') { $('#playback-recovery').hidden = false; $('#playback-recovery-message').textContent = t(error); $('#playback-relink').hidden = false; }
    notify(error, true); return;
  }
  const reason = error.code === 100 ? 'This video is private, removed, or unavailable in your region.' : [101,150].includes(error.code) ? 'YouTube blocked embedded playback. This may be a video restriction or a website origin issue.' : error.code === 153 ? 'YouTube could not identify this website. Try opening the app normally and allow its referrer.' : 'YouTube playback failed. Retry, replace the link, or open the video on YouTube.';
  player.onPlaybackState?.(); $('#youtube-error').hidden = false; $('#youtube-error-message').textContent = t(reason) + ` (${error.code})`;
  $('#youtube-open').href = `https://www.youtube.com/watch?v=${error.track.videoId}`;
  notify(reason, true);
});
player.onStall = waiting => { $('#playback-stall').hidden = !waiting; };
player.onNeedsGesture = needed => { $('#playback-permission').hidden = !needed; };
$('#resume-video').onclick = () => { const yt = player.youtube; if (!yt || !player.track) return; const position = yt.getCurrentTime() || 0; yt.loadVideoById({ videoId: player.track.videoId, startSeconds: position }); player.lastProgress = Date.now(); player.stallNotified = false; $('#playback-stall').hidden = true; };
$('#playback-retry').onclick = () => { if (queueIndex >= 0) void playIndex(queueIndex); };
$('#playback-relink').onclick = () => { relinkId = current?.id; $('#relink-input').click(); };
$('#playback-skip').onclick = next;
$('#youtube-retry').onclick = () => { if (queueIndex >= 0) void playIndex(queueIndex); };
$('#youtube-skip').onclick = next;
$('#youtube-local').onclick = () => { relinkId = player.track?.id; $('#relink-input').click(); };
$('#youtube-replace').onclick = () => { const track = state.tracks.find(t => t.id === player.track?.id); if (track) editTrack(track); };
function saveSettings() {
  const value = { volume: Number($('#volume').value), fade: $('#fade').value, normalize: $('#normalize').checked, autoNext: $('#auto-next').checked, guideHidden: $('#practice-guide').hidden };
  try { localStorage.setItem('studio-settings', JSON.stringify(value)); } catch { notify('Save failed — export a backup', true); }
}
$('#language').onchange = event => setLanguage(event.target.value);
for (const id of ['volume','fade','normalize','auto-next']) $(`#${id}`).addEventListener('change', saveSettings);
if (Number.isFinite(settings.volume)) $('#volume').value = Math.max(0, Math.min(100, settings.volume));
if (['0','1','2','4'].includes(settings.fade)) $('#fade').value = settings.fade;
if (typeof settings.normalize === 'boolean') $('#normalize').checked = settings.normalize;
if (typeof settings.autoNext === 'boolean') $('#auto-next').checked = settings.autoNext;
player.setVolume(Number($('#volume').value) / 100, $('#normalize').checked);
player.onPlaybackState = updateTransport;
async function storageDetails() {
  try { const estimate = await navigator.storage?.estimate(); const persistent = await navigator.storage?.persisted(); $('#storage-details').textContent = `${t('Browser storage')}: ${Math.round((estimate?.usage || 0) / 1024 / 1024)} MB · ${getLanguage() === 'ko' ? (persistent ? '유지 허용됨' : '브라우저 기본 정책') : getLanguage() === 'es' ? (persistent ? 'persistente' : 'política del navegador') : (persistent ? 'persistent' : 'browser default')}`; } catch {}
}
$('#persist-storage').onclick = async () => { try { await navigator.storage?.persist(); await storageDetails(); } catch (error) { notify(error.message, true); } };
void storageDetails();
$('#language').addEventListener('change', storageDetails);
for (const option of document.querySelectorAll('select option')) if (!option.hasAttribute('value')) option.value = option.textContent;

const searchKey = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function renderLibrary() {
  const search = searchKey($('#search').value), style = $('#style-filter').value, source = $('#source-filter').value;
  const visible = state.tracks.filter(t => searchKey(`${t.title} ${t.artist} ${t.singer} ${t.year}`).includes(search) && (!style || t.style === style) && (!source || t.source === source));
  $('#tracks').innerHTML = visible.map(t => `<tr draggable="true" data-track="${esc(t.id)}"><td><div class="track-title">${esc(t.title)}</div><div class="track-detail"><span class="source-tag ${t.source}">${t.source === 'local' ? 'FILE' : 'YOUTUBE'}</span> ${esc(t.artist || 'Unknown orchestra')}${t.singer ? ` · ${esc(t.singer)}` : ''}${t.source === 'local' && !files.has(t.id) ? ' · <span class="missing">File needed</span>' : ''}</div></td><td>${esc(t.style || '—')}<small>${esc(t.year || '')}</small></td><td>${t.bpm ? esc(t.bpm) : '—'}</td><td>${time(t.duration)}</td><td class="track-actions"><button data-action="play" data-id="${esc(t.id)}" aria-label="Play ${esc(t.title)}" title="Play">▶ Play</button>${t.source === 'local' ? `<button class="secondary-action" data-action="preview" data-id="${esc(t.id)}" aria-label="Preview ${esc(t.title)}" title="Preview on current output">♬ Preview</button><button class="secondary-action" data-action="analyze" data-id="${esc(t.id)}" aria-label="Analyze ${esc(t.title)}" title="Analyze BPM and level">⌁ Analyze</button>${!files.has(t.id) ? `<button data-action="relink" data-id="${esc(t.id)}" title="Relink file">↥ Relink</button>` : ''}` : ''}<button class="secondary-action" data-action="edit" data-id="${esc(t.id)}" aria-label="Edit ${esc(t.title)}" title="Edit metadata">✎ Edit</button><button data-action="add" data-id="${esc(t.id)}" aria-label="Add ${esc(t.title)} to selected group" title="Add to selected group">+ Add</button><button class="secondary-action" data-action="delete" data-id="${esc(t.id)}" aria-label="Delete ${esc(t.title)}" title="Remove from library">×</button><button class="more-action" data-action="more" data-id="${esc(t.id)}" aria-label="More actions for ${esc(t.title)}">More</button></td></tr>`).join('');
  $('#empty-library').hidden = visible.length > 0;
  $('#empty-library h3').textContent = state.tracks.length ? 'No matching recordings' : 'A home for your collection';
  $('#library-count').textContent = state.tracks.length; $('#nav-count').textContent = state.tracks.length;
  $('#library-summary').textContent = `${state.tracks.length} recordings · ${time(state.tracks.reduce((s, t) => s + (t.duration || 0), 0))} known duration`;
}
function renderGroups() {
  $('#groups').innerHTML = state.groups.map((g, i) => `<article class="group ${selected === g.id ? 'selected' : ''}" data-group="${esc(g.id)}"><div class="group-header"><button class="group-select" data-group-action="select" data-id="${esc(g.id)}"><span class="group-number">${String(i + 1).padStart(2, '0')}</span><span><span class="eyebrow">${g.kind.toUpperCase()}</span><strong>${esc(g.name)}</strong></span></button><div class="group-tools"><button data-group-action="up" data-id="${esc(g.id)}" aria-label="Move group up" ${i === 0 ? 'disabled' : ''}>↑</button><button data-group-action="down" data-id="${esc(g.id)}" aria-label="Move group down" ${i === state.groups.length - 1 ? 'disabled' : ''}>↓</button><button data-group-action="rename" data-id="${esc(g.id)}" aria-label="Rename group">✎</button><button data-group-action="delete" data-id="${esc(g.id)}" aria-label="Delete group">×</button></div></div><ol>${g.trackIds.map((id, j) => { const t = state.tracks.find(t => t.id === id); return `<li><span>${esc(t?.title || 'Missing track')}</span><div><button data-group-action="track-up" data-id="${esc(g.id)}" data-index="${j}" aria-label="Move recording up" ${j === 0 ? 'disabled' : ''}>↑</button><button data-group-action="track-down" data-id="${esc(g.id)}" data-index="${j}" aria-label="Move recording down" ${j === g.trackIds.length - 1 ? 'disabled' : ''}>↓</button><button data-group-action="remove" data-id="${esc(g.id)}" data-index="${j}" aria-label="Remove recording from group">×</button></div></li>`; }).join('')}</ol>${g.kind === 'cortina' ? `<div class="cortina-range"><label><span>${t('From')}</span><input type="number" min="0" max="86400" step="1" value="${g.startSeconds || 0}" data-cortina-start="${esc(g.id)}" aria-label="${t('Cortina start position')}"></label><span class="range-arrow">→</span><label><span>${t('To')}</span><input type="number" min="1" max="90000" step="1" value="${(g.startSeconds || 0) + (g.limitSeconds || 20)}" data-cortina-end="${esc(g.id)}" aria-label="${t('Cortina end position')}"></label><span class="range-unit">${t('seconds')}</span><button data-group-action="cue-position" data-id="${esc(g.id)}" aria-label="${t('Use deck position')}" title="${t('Use deck position')}" ${!current || !g.trackIds.includes(current.id) ? 'disabled' : ''}>⌖</button><button data-group-action="cue-play" data-id="${esc(g.id)}" aria-label="${t('Play this cortina')}" title="${t('Play this cortina')} · ${t('Plays on the live output')}" ${!g.trackIds.length ? 'disabled' : ''}>▶</button></div><label class="cortina-hold"><input type="checkbox" data-cortina-hold="${esc(g.id)}" ${g.holdAfter ? 'checked' : ''}>${t('Wait before the next tanda')}</label>` : ''}${!g.trackIds.length ? '<p class="group-drop">Drop recordings here or select and use +</p>' : ''}<div class="group-duration">${g.trackIds.length} recordings · ${time(groupDuration(g, state.tracks))} known duration</div></article>`).join('');
  refreshGroupSummaries();
}
function refreshGroupSummaries() {
  const articles = new Map([...document.querySelectorAll('#groups .group')].map(el => [el.dataset.group, el]));
  for (const group of state.groups) {
    const article = articles.get(group.id);
    if (!article) continue;
    article.querySelector('.group-duration').textContent = `${group.trackIds.length} recordings · ${time(groupDuration(group, state.tracks))} known duration`;
    const startInput = article.querySelector('[data-cortina-start]'), endInput = article.querySelector('[data-cortina-end]');
    if (startInput && document.activeElement !== startInput) startInput.value = group.startSeconds || 0;
    if (endInput && document.activeElement !== endInput) endInput.value = (group.startSeconds || 0) + (group.limitSeconds || 20);
    const cueButton = article.querySelector('[data-group-action="cue-position"]');
    if (cueButton) cueButton.disabled = !current || !group.trackIds.includes(current.id);
  }
  $('#empty-set').hidden = state.groups.length > 0;
  $('#set-duration').textContent = time(state.groups.reduce((s, group) => s + groupDuration(group, state.tracks), 0));
  $('#start-set').disabled = !flattenSet(state.groups, state.tracks).length;
  $('#deck-start-set').hidden = $('#start-set').disabled || Boolean(current);
  const chosen = state.groups.find(g => g.id === selected);
  $('#choose-recordings').hidden = !chosen;
  $('#library-target').textContent = chosen ? `${t('Adding to')}: ${chosen.name}` : t('Create a tanda in Set, then add recordings here.');
  $('#selected-group').textContent = chosen ? `${t('Adding to')}: ${chosen.name}` : t('Select a tanda to add recordings');
  $('#queue-stale').hidden = !loadedSignature || loadedSignature === queueSignature(state.groups, state.tracks);
  $('#refresh-queue').hidden = $('#queue-stale').hidden || !current || queueIndex < 0; $('#refresh-queue').disabled = transitioning;
}
let deckVisible = false;
function updateMiniDeck() { const visible = Boolean(current && (!deckVisible || (phoneLayout.matches && activeView !== 'deck'))); $('#mini-deck').hidden = !visible; document.body.classList.toggle('mini-deck-visible', visible); }
new IntersectionObserver(entries => { deckVisible = entries[0].isIntersecting; updateMiniDeck(); }, { threshold: 0 }).observe($('#deck .transport'));
$('#mini-open').onclick = () => showView('deck');
$('#mini-play').onclick = () => $('#play-pause').click(); $('#mini-next').onclick = () => $('#next').click();
function renderQueue() {
  updateTransport();
  const item = queue[queueIndex], upcoming = queue[(queueIndex >= 0 ? queueIndex : resumeIndex) + (queueIndex >= 0 ? 1 : 0)];
  const sameGroup = item?.groupId ? queue.filter(entry => entry.groupId === item.groupId) : [];
  $('#recording-number').textContent = item ? item.kind === 'cortina' ? `${t('Cortina')} · ${t('Start at')} ${time(item.startSeconds || 0)}` : sameGroup.length ? `${t('Recording')} ${sameGroup.indexOf(item) + 1} / ${sameGroup.length}` : `${t('Recording')} ${queueIndex + 1} / ${queue.length}` : '';
  $('#up-next').hidden = !upcoming;
  $('#up-next').innerHTML = upcoming ? `<span>${t('Up next')}</span><strong>${esc(upcoming.track.title)}</strong><small>${esc(upcoming.groupName || upcoming.track.artist || '')}</small>` : '';

  $('#mini-open strong').textContent = current?.title || ''; $('#mini-open small').textContent = $('#recording-number').textContent; updateMiniDeck();
  $('#queue-count').textContent = queue.length;
  $('#queue').innerHTML = queue.length ? queue.map((item, i) => `<button class="queue-item ${i === queueIndex ? 'playing' : ''}" data-queue-index="${i}"><span>${i === queueIndex ? '▶' : String(i + 1).padStart(2, '0')}</span><div><strong>${esc(item.track.title)}</strong><small>${esc(item.groupName || item.track.artist || 'Library track')}</small></div><span>${time(item.limitSeconds || item.track.duration)}</span></button>`).join('') : '<p class="hint">Load a set or play a library track.</p>';
  if (queueIndex !== lastRenderedIndex) {
    const active = $('#queue .playing'), panel = $('#queue');
    if (active) { const row = active.getBoundingClientRect(), box = panel.getBoundingClientRect();
      if (row.top < box.top || row.bottom > box.bottom) panel.scrollTop += row.top - box.top - box.height / 2 + row.height / 2; }
    lastRenderedIndex = queueIndex;
  }
}
function render() { renderLibrary(); renderGroups(); renderQueue(); }

async function importFiles(list) {
  if (busy) { notify('Wait for the current import or analysis to finish.'); return; }
  if (temporaryWorkspace) { notify('Storage is unavailable. Retry saving before importing local audio. You can still play the example set.', true); return; }
  busy = true; let count = 0, skipped = 0;
  const candidates = [...list];
  const progress = $('#import-progress'); progress.hidden = false;
  $('#add-files').disabled = true; $('#analyze-all').disabled = true;
  try {
    for (const [index, file] of candidates.entries()) {
      progress.textContent = `${index + 1} / ${candidates.length} · ${file.name}`;
      if (!file.type.startsWith('audio/') && !/\.(mp3|wav|flac|m4a|ogg|aiff?|opus|aac)$/i.test(file.name)) { skipped++; continue; }
      if (state.tracks.some(t => t.source === 'local' && t.fileName === file.name && t.fileSize === file.size && t.lastModified === file.lastModified)) { skipped++; continue; }
      notify(`Reading ${file.name}…`);
      let metadata;
      try { metadata = await parseBlob(file); } catch { /* Tag failures do not prevent importing playable audio. */ }
      const common = metadata?.common || {};
      const genre = (common.genre || []).find(g => ['Tango', 'Vals', 'Milonga', 'Cortina'].some(s => s.toLowerCase() === g.toLowerCase()));
      const track = { id: uid(), source: 'local', fileName: file.name, fileSize: file.size, lastModified: file.lastModified,
        title: common.title || file.name.replace(/\.[^.]+$/, ''), artist: common.artist || common.albumartist || '', singer: '', year: String(common.year || ''),
        style: genre ? genre[0].toUpperCase() + genre.slice(1).toLowerCase() : '', duration: metadata?.format.duration || null, bpm: common.bpm || null };
      await saveFile(track.id, file); files.set(track.id, file); state.tracks.push(track);
      if (!await persist()) { progress.textContent = t('Save failed — export a backup'); return; }
      count++; renderLibrary(); markStep('load');
    }
    progress.textContent = `${count} / ${candidates.length} · ${t('Done')}${skipped ? ` · ${skipped} ${t('Skipped duplicates or unsupported files')}` : ''}`;
    notify(`${count} recording${count === 1 ? '' : 's'} added. Files are saved in this browser; keep your originals for backup.`);
  } catch (error) {
    progress.textContent = `${count} / ${candidates.length} · ${t('Import stopped')}`;
    notify(`Import stopped: ${storageMessage(error)}`, true);
  } finally { busy = false; $('#add-files').disabled = false; $('#analyze-all').disabled = false; render(); }
}
async function addYouTube(url) {
  const videoId = youtubeId(url);
  if (!videoId) { notify('Enter a YouTube watch, short, live, or youtu.be video link.', true); return; }
  if (state.tracks.some(t => t.source === 'youtube' && t.videoId === videoId)) { notify('This YouTube video is already in your library.'); return; }
  const track = { id: uid(), source: 'youtube', videoId, title: `YouTube · ${videoId}`, artist: '', singer: '', year: '', style: '', duration: null };
  state.tracks.push(track); await persist(); renderLibrary(); $('#youtube-form').reset();
  markStep('youtube'); notify('Video added. Edit its title and orchestra while YouTube details load.');
  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`, { signal: AbortSignal.timeout(8000) });
    if (response.ok) {
      const data = await response.json();
      if (!state.tracks.includes(track)) return;
      if (track.title === `YouTube · ${videoId}`) track.title = data.title || track.title;
      if (!track.artist) track.artist = data.author_name || '';
      await persist(); render();
    }
  } catch { /* Manual metadata editing is available when oEmbed is unavailable. */ }
}
function workerAnalysis(samples, sampleRate) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./analysis-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => { worker.terminate(); data.error ? reject(new Error(data.error)) : resolve(data.result); };
    worker.onerror = error => { worker.terminate(); reject(new Error(error.message)); };
    worker.postMessage({ samples, sampleRate }, [samples.buffer]);
  });
}
async function analyzeTrack(track) {
  const file = files.get(track.id); if (!file) throw new Error(`Relink ${track.title} first.`);
  notify(`Analyzing ${track.title}…`);
  const context = new AudioContext();
  try {
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    // Decode the recording, then analyze up to its first three minutes off the UI thread.
    const length = Math.min(buffer.length, buffer.sampleRate * 180);
    const samples = new Float32Array(length);
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const data = buffer.getChannelData(channel); for (let i = 0; i < length; i++) samples[i] += data[i] / buffer.numberOfChannels;
    }
    const result = await workerAnalysis(samples, buffer.sampleRate);
    // Loudness uses channel energy, so stereo phase cancellation cannot inflate gain.
    let energy = 0, peak = 0;
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < buffer.length; i++) { energy += data[i] * data[i]; peak = Math.max(peak, Math.abs(data[i])); }
    }
    const rmsDb = 20 * Math.log10(Math.max(Math.sqrt(energy / Math.max(1, buffer.length * buffer.numberOfChannels)), 1e-9));
    const peakDb = 20 * Math.log10(Math.max(peak, 1e-9));
    Object.assign(track, result, { duration: buffer.duration, rmsDb: Math.round(rmsDb * 10) / 10,
      peakDb: Math.round(peakDb * 10) / 10, gainDb: Math.round(Math.max(-12, Math.min(12, -18 - rmsDb, -1 - peakDb)) * 10) / 10 });
    for (const item of queue) if (item.track.id === track.id) Object.assign(item.track, track);
    if (player.track?.id === track.id) { Object.assign(player.track, track); player.setVolume(Number($('#volume').value) / 100, $('#normalize').checked); }
    await persist(); render();
  } finally { await context.close(); }
}
async function runAnalysis(tracks) {
  if (busy) { notify('Wait for the current import or analysis to finish.'); return; }
  busy = true; $('#analyze-all').disabled = true; let completed = 0, errors = [];
  try {
    for (const track of tracks) { try { await analyzeTrack(track); completed++; markStep('analyze'); } catch (error) { errors.push(error.message); } }
    notify(`${completed} tracks analyzed. BPM is an estimate; review it by ear.${errors.length ? ` ${errors.length} failed: ${errors[0]}` : ''}`, errors.length > 0);
  } finally { busy = false; $('#analyze-all').disabled = false; }
}
function updateTransport() {
  const playing = !stopped && (player.track?.source === 'youtube' ? player.youtube?.getPlayerState?.() === 1 : !player.audio.paused);
  $('#play-pause').textContent = transitioning ? '…' : playing ? 'Ⅱ' : '▶';
  $('#previous').disabled = transitioning || queueIndex <= 0;
  $('#next').disabled = transitioning || !queue.length || queueIndex >= queue.length - 1;
  $('#stop').disabled = !current && !player.track;
  $('#play-pause').disabled = transitioning || (!queue.length && !player.track);
  $('#mini-play').textContent = $('#play-pause').textContent; $('#mini-play').disabled = $('#play-pause').disabled;
  $('#mini-next').disabled = $('#next').disabled;
}
function rememberSetEdit() { undoGroups = { groups: structuredClone(state.groups), selected }; $('#undo-bar').hidden = false; }
$('#undo-set').onclick = () => {
  if (!undoGroups) return;
  state.groups = undoGroups.groups.map(group => ({ ...group, trackIds: group.trackIds.filter(id => state.tracks.some(track => track.id === id)) })); selected = undoGroups.selected; undoGroups = null;
  $('#undo-bar').hidden = true; void persist(); renderGroups();
};
async function playIndex(index) {
  if (index < 0 || index >= queue.length) return;
  const item = queue[index];
  if (Number.isFinite(item.track.duration) && item.track.duration > 0 && (item.startSeconds || 0) >= item.track.duration) {
    notify('The start must be before the recording ends. Choose an earlier cue.', true); return;
  }
  const request = ++playRequest; transitioning = true; updateTransport();
  $('#playback-loading').hidden = false; $('#playback-recovery').hidden = true;
  try {
    $('#youtube-error').hidden = true;
    if (!await player.play(item.track, files.get(item.track.id), Number($('#fade').value), $('#normalize').checked, item.startSeconds || 0, item.limitSeconds)) return;
    if (request !== playRequest) return;
    queueIndex = index; resumeIndex = index; current = item.track; timedEnd = false; stopped = false; $('#queue-resume').hidden = true; void persist();
    $('#playing-title').textContent = current.title; $('#playing-artist').textContent = [current.artist, current.singer, current.year].filter(Boolean).join(' · ') || (current.source === 'youtube' ? 'YouTube video' : 'Local recording');
    $('#playing-group').textContent = item.groupName || 'LIBRARY TRACK'; $('#preview-status').hidden = true;
    $('#position').textContent = `0:00 / ${time(item.limitSeconds || (Number.isFinite(current.duration) ? Math.max(0, current.duration - (item.startSeconds || 0)) : NaN))}`; $('#seek').value = 0;
    renderQueue(); refreshGroupSummaries(); markStep('play'); notify(`Playing ${current.title}`);
  } catch (error) {
    if (request === playRequest) {
      player.stop(); current = structuredClone(item.track); player.track = structuredClone(item.track);
      queueIndex = index; resumeIndex = index; stopped = true; timedEnd = false;
      $('#playing-title').textContent = current.title; $('#playing-artist').textContent = [current.artist, current.singer, current.year].filter(Boolean).join(' · ');
      $('#playing-group').textContent = item.groupName || 'LIBRARY TRACK'; $('#position').textContent = '0:00 / —'; $('#seek').value = 0;
      renderQueue(); void persist();
      $('#playback-recovery').hidden = false; $('#playback-recovery-message').textContent = t(playbackMessage(error));
      $('#playback-relink').hidden = item.track.source !== 'local';
      notify(playbackMessage(error), true);
    }
  }
  finally { if (request === playRequest) { transitioning = false; $('#playback-loading').hidden = true; updateTransport(); } }
}
async function next() { if (queueIndex + 1 < queue.length) await playIndex(queueIndex + 1); else { notify('End of play queue.'); } }
function addToGroup(id, groupId = selected) {
  const group = state.groups.find(g => g.id === groupId);
  if (!group) { showView('set'); notify('Create or select a tanda or cortina first.'); return; }
  if (!state.tracks.some(t => t.id === id)) return;
  rememberSetEdit(); group.trackIds.push(id); selected = group.id; void persist(); renderGroups(); markStep('build');
}
function editTrack(track) {
  const form = $('#metadata-form');
  $('#video-url-label').hidden = track.source !== 'youtube'; form.elements.videoUrl.value = track.source === 'youtube' ? `https://www.youtube.com/watch?v=${track.videoId}` : '';
  for (const field of ['id', 'title', 'artist', 'singer', 'year', 'style', 'bpm']) form.elements[field].value = track[field] || '';
  $('#analysis-details').textContent = track.source === 'youtube' ? 'YouTube audio cannot be decoded for analysis. Enter BPM and metadata manually.' : track.rmsDb != null ? `RMS ${track.rmsDb} dBFS · Peak ${track.peakDb} dBFS · Suggested gain ${track.gainDb} dB. RMS level is not integrated LUFS. BPM estimates can be corrected here.` : 'Use Analyze to estimate BPM, RMS level, peak, and gain. You can edit BPM manually.';
  $('#metadata-dialog').showModal();
}

$('#add-files').onclick = () => $('#file-input').click();
$('#file-input').onchange = async event => { await importFiles(event.target.files); event.target.value = ''; };
$('#drop-zone').onclick = () => $('#file-input').click();
$('#drop-zone').onkeydown = event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); $('#file-input').click(); } };
$('#drop-zone').ondragover = event => { event.preventDefault(); $('#drop-zone').classList.add('dragging'); };
$('#drop-zone').ondragleave = () => $('#drop-zone').classList.remove('dragging');
$('#drop-zone').ondrop = event => { event.preventDefault(); $('#drop-zone').classList.remove('dragging'); void importFiles(event.dataTransfer.files); };
$('#youtube-form').onsubmit = event => { event.preventDefault(); void addYouTube(new FormData(event.target).get('url')); };
for (const id of ['search', 'style-filter', 'source-filter']) $(`#${id}`).oninput = renderLibrary;
$('#tracks').ondragstart = event => { const row = event.target.closest('[data-track]'); if (row) event.dataTransfer.setData('text/plain', row.dataset.track); };
let relinkId = null;
$('#recording-actions').onclick = event => {
  const action = event.target.closest('[data-action]'); if (!action) return;
  $('#actions-dialog').close();
  const original = [...$('#tracks').querySelectorAll('[data-action]')].find(button => button.dataset.id === action.dataset.id && button.dataset.action === action.dataset.action);
  original?.click();
};
$('#tracks').onclick = async event => {
  const button = event.target.closest('[data-action]'); if (!button) return;
  if (button.dataset.action === 'more') {
    const row = button.closest('tr'); $('#actions-title').textContent = row.querySelector('.track-title').textContent;
    $('#recording-actions').replaceChildren(...[...row.querySelectorAll('.secondary-action')].map(action => action.cloneNode(true)));
    $('#actions-dialog').showModal(); return;
  }

  const track = state.tracks.find(t => t.id === button.dataset.id); if (!track) return;
  try {
    switch (button.dataset.action) {
      case 'play': {
        const sourcePlayback = track.style === 'Cortina';
        const existingIndex = sourcePlayback ? queue.findIndex(item => item.track.id === track.id && !item.limitSeconds && !item.startSeconds) : locateInQueue(queue, track.id, queueIndex);
        if (existingIndex >= 0) await playIndex(existingIndex);
        else { queue.push({ track: structuredClone(track) }); loadedSignature = null; renderQueue(); await playIndex(queue.length - 1); }
        showView('deck'); break;
      }
      case 'preview': await player.previewTrack(track, files.get(track.id)); $('#preview-status span').textContent = `Preview: ${track.title} · same output`; $('#preview-status').hidden = false; markStep('preview'); showView('deck'); break;
      case 'analyze': await runAnalysis([track]); break;
      case 'edit': editTrack(track); break;
      case 'add': addToGroup(track.id); break;
      case 'relink': relinkId = track.id; $('#relink-input').click(); break;
      case 'delete':
        if (!confirm(t(`Remove “${track.title}” from the library and every group? Your original file will be kept.`))) return;
        if (busy) { notify('Wait for the current import or analysis to finish.'); return; }
        if (player.previewId === track.id) { player.preview.pause(); player.previewId = null; $('#preview-status').hidden = true; }
        const playingItem = queue[queueIndex];
        const removingCurrent = current?.id === track.id || player.track?.id === track.id;
        const priorIndex = queueIndex >= 0 ? queueIndex : resumeIndex;
        queue = queue.filter(item => item.track.id !== track.id);
        loadedSignature = null;
        if (removingCurrent) {
          ++playRequest; player.stop(); player.track = null; current = null; transitioning = false;
          queueIndex = -1; resumeIndex = Math.min(Math.max(0, priorIndex), Math.max(0, queue.length - 1));
          $('#playing-title').textContent = 'No recording loaded'; $('#playing-artist').textContent = 'Play a track or load your prepared set.';
          $('#playing-group').textContent = 'READY WHEN YOU ARE'; $('#position').textContent = '0:00 / 0:00'; $('#seek').value = 0;
          $('#youtube-wrap').hidden = true; $('#preview-status').hidden = true; $('#queue-resume').hidden = !queue.length;
        } else { queueIndex = queue.indexOf(playingItem); resumeIndex = queueIndex >= 0 ? queueIndex : Math.min(resumeIndex, Math.max(0, queue.length - 1)); }
        state = removeTrack(state, track.id); const saved = await persist();
        if (saved) { await deleteFile(track.id); files.delete(track.id); player.revoke(track.id); }
        render(); break;
    }
  } catch (error) { notify(error.message, true); }
};
$('#relink-input').onchange = async event => {
  const file = event.target.files[0], track = state.tracks.find(t => t.id === relinkId);
  if (file && track) {
    try {
      await persistence;
      const updated = { ...track, source: 'local', fileName: file.name, fileSize: file.size, lastModified: file.lastModified };
      delete updated.videoId;
      for (const field of ['duration', 'bpm', 'rmsDb', 'peakDb', 'gainDb']) updated[field] = null;
      const snapshot = workspaceSnapshot(state.tracks.map(item => item.id === track.id ? updated : item));
      const replacement = persistence.then(async () => {
        revision = await replaceRecording(track.id, file, snapshot, revision);
        return true;
      });
      persistence = replacement.catch(() => false);
      await replacement;
      Object.assign(track, updated); delete track.videoId;
      player.revoke(track.id); files.set(track.id, file);
      for (const item of queue) if (item.track.id === track.id) item.track = structuredClone(track);
      sourceChanged(track);
      render(); notify('File relinked. Analyze it to refresh duration, BPM, and level.');
    } catch (error) { notify(error.message, true); }
  }
  event.target.value = '';
};
function sourceChanged(track) {
  if (current?.id !== track.id && player.track?.id !== track.id) return;
  ++playRequest; player.stop(); player.track = structuredClone(track); current = queue[queueIndex]?.track || structuredClone(track);
  stopped = true; transitioning = false; timedEnd = false;
  $('#position').textContent = `0:00 / ${time(queue[queueIndex]?.limitSeconds || track.duration)}`; $('#seek').value = 0;
  $('#youtube-wrap').hidden = track.source !== 'youtube'; $('#youtube-error').hidden = true;
  updateTransport(); notify('Recording source changed. Press Play to use the updated recording.');
}
$('#metadata-form').onsubmit = event => {
  event.preventDefault(); const data = new FormData(event.target), track = state.tracks.find(t => t.id === data.get('id'));
  if (!track) return;
  const oldVideoId = track.videoId;
  if (track.source === 'youtube') { const id = youtubeId(data.get('videoUrl')); if (!id) { notify('Enter a YouTube watch, short, live, or youtu.be video link.', true); return; } track.videoId = id; for (const item of queue) if (item.track.id === track.id) item.track.videoId = id; }
  for (const field of ['title', 'artist', 'singer', 'year', 'style']) track[field] = data.get(field).trim();
  track.bpm = data.get('bpm') ? Number(data.get('bpm')) : null;
  for (const item of queue) if (item.track.id === track.id) Object.assign(item.track, track);
  if (current?.id === track.id) { $('#playing-title').textContent = track.title; $('#playing-artist').textContent = [track.artist, track.singer, track.year].filter(Boolean).join(' · '); }
  if (oldVideoId !== track.videoId) { track.duration = null; for (const item of queue) if (item.track.id === track.id) item.track.duration = null; sourceChanged(track); }
  renderQueue();
  void persist(); render(); markStep('edit'); $('#metadata-dialog').close();
};
$('#close-metadata').onclick = () => $('#metadata-dialog').close();
function addGroup(kind) { rememberSetEdit(); const group = { id: uid(), kind, name: `${kind === 'tanda' ? 'Tanda' : 'Cortina'} ${state.groups.filter(g => g.kind === kind).length + 1}`, trackIds: [], ...(kind === 'cortina' ? { limitSeconds: 20 } : {}) }; state.groups.push(group); selected = group.id; void persist(); renderGroups(); }
$('#add-tanda').onclick = () => addGroup('tanda'); $('#add-cortina').onclick = () => addGroup('cortina');
$('#groups').onclick = event => {
  const button = event.target.closest('[data-group-action]'); if (!button) return;
  const group = state.groups.find(g => g.id === button.dataset.id); if (!group) return;
  const i = state.groups.indexOf(group), j = Number(button.dataset.index);
  const action = button.dataset.groupAction;
  let newName;
  if (action === 'rename') { newName = prompt(t('Group name'), group.name); if (!newName?.trim() || newName.trim() === group.name) return; }
  if (action === 'delete' && !confirm(t(`Remove “${group.name}” from your set? Recordings stay in the library.`))) return;
  if (action === 'cue-play') {
    showView('deck');
    const clips = flattenSet([group], state.tracks).map(item => ({ ...item, track: structuredClone(item.track) }));
    if (!clips.length) return;
    const index = queue.findIndex(item => item.groupId === group.id && (item.startSeconds || 0) === (group.startSeconds || 0) && item.limitSeconds === (group.limitSeconds || 20) && Boolean(item.holdAfter) === Boolean(group.holdAfter));
    if (index >= 0) void playIndex(index);
    else { const start = queue.length; queue.push(...clips); loadedSignature = null; renderQueue(); void playIndex(start); }
    return;
  }
  if (action === 'cue-position' && (!current || !group.trackIds.includes(current.id))) return;
  if (action !== 'select') rememberSetEdit();
  switch (button.dataset.groupAction) {
    case 'select': selected = group.id; break;
    case 'cue-position': {
      const position = Math.floor(current.source === 'youtube' ? player.youtube?.getCurrentTime() || 0 : player.audio.currentTime);
      const duration = current.source === 'youtube' ? player.youtube?.getDuration() : player.audio.duration;
      if (Number.isFinite(duration) && duration > 0 && position >= duration) { notify('The start must be before the recording ends. Choose an earlier cue.', true); return; }
      group.startSeconds = position;
      if (Number.isFinite(duration) && duration > 0) group.limitSeconds = Math.min(group.limitSeconds || 20, Math.ceil(duration) - position);
      break;
    }
    case 'rename': group.name = newName.trim(); break;
    case 'delete': state.groups.splice(i, 1); if (selected === group.id) selected = state.groups[0]?.id || null; break;
    case 'up': if (i > 0) [state.groups[i - 1], state.groups[i]] = [state.groups[i], state.groups[i - 1]]; break;
    case 'down': if (i < state.groups.length - 1) [state.groups[i + 1], state.groups[i]] = [state.groups[i], state.groups[i + 1]]; break;
    case 'remove': group.trackIds.splice(j, 1); break;
    case 'track-up': if (j > 0) [group.trackIds[j - 1], group.trackIds[j]] = [group.trackIds[j], group.trackIds[j - 1]]; break;
    case 'track-down': if (j < group.trackIds.length - 1) [group.trackIds[j + 1], group.trackIds[j]] = [group.trackIds[j], group.trackIds[j + 1]]; break;
  }
  void persist(); renderGroups();
};
$('#groups').onchange = event => {
  if (event.target.dataset.cortinaHold) {
    const group = state.groups.find(g => g.id === event.target.dataset.cortinaHold); if (!group) return;
    rememberSetEdit(); group.holdAfter = event.target.checked; void persist(); refreshGroupSummaries(); return;
  }
  const isStart = Boolean(event.target.dataset.cortinaStart);
  const id = event.target.dataset.cortinaStart || event.target.dataset.cortinaEnd; if (!id) return;
  const value = Number(event.target.value), group = state.groups.find(g => g.id === id);
  if (!group) return;
  const priorStart = group.startSeconds || 0, priorEnd = priorStart + (group.limitSeconds || 20);
  const start = isStart ? value : priorStart;
  // Moving the start past the old end keeps a useful segment of the same length.
  let end = isStart ? Math.max(priorEnd, start + (start >= priorEnd ? group.limitSeconds || 20 : 1)) : value;
  const durations = group.trackIds.map(id => state.tracks.find(track => track.id === id)?.duration).filter(duration => Number.isFinite(duration) && duration > 0);
  const sourceEnd = durations.length ? Math.min(...durations) : Infinity;
  if (start >= sourceEnd || (!isStart && end > Math.ceil(sourceEnd))) {
    event.target.value = isStart ? priorStart : priorEnd;
    notify('Choose a cortina interval within the recording length.', true); return;
  }
  if (isStart) end = Math.min(end, Math.ceil(sourceEnd));
  if (!Number.isInteger(value) || start < 0 || start > 86400 || end <= start || end - start > 3600) {
    event.target.value = isStart ? priorStart : priorEnd; return;
  }
  if (start === priorStart && end === priorEnd) return;
  rememberSetEdit(); group.startSeconds = start; group.limitSeconds = end - start;
  void persist(); refreshGroupSummaries();
};
$('#groups').ondragover = event => { if (event.target.closest('[data-group]')) event.preventDefault(); };
$('#groups').ondrop = event => { const group = event.target.closest('[data-group]'); if (group) { event.preventDefault(); addToGroup(event.dataTransfer.getData('text/plain'), group.dataset.group); } };
$('#refresh-queue').onclick = async () => {
  const prepared = flattenSet(state.groups, state.tracks).map(item => ({ ...item, track: structuredClone(item.track) }));
  const active = queue[queueIndex]; if (!active || transitioning) return;
  const occurrence = queue.slice(0, queueIndex + 1).filter(item => item.groupId === active.groupId && item.track.id === active.track.id).length;
  const matches = prepared.map((item, index) => ({ item, index })).filter(({ item }) => item.groupId === active.groupId && item.track.id === active.track.id);
  const match = matches[occurrence - 1];
  if (!match) { notify('The current recording is no longer in the edited set. Finish it before loading another set.', true); return; }
  queue = [...queue.slice(0, queueIndex + 1), ...prepared.slice(match.index + 1)];
  loadedSignature = queueSignature(state.groups, state.tracks); render(); await persist(); notify('Upcoming queue updated. Current recording keeps playing.');
};
$('#start-set').onclick = () => { showView('deck'); loadedSignature = queueSignature(state.groups, state.tracks); queue = flattenSet(state.groups, state.tracks).map(item => ({ ...item, track: structuredClone(item.track) })); queueIndex = -1; renderQueue(); void playIndex(0); };
$('#deck-start-set').onclick = () => $('#start-set').click();
$('#queue').onclick = event => { const item = event.target.closest('[data-queue-index]'); if (item) void playIndex(Number(item.dataset.queueIndex)); };
$('#play-pause').onclick = async () => { try { if (!player.track && queue.length) await playIndex(Math.min(resumeIndex, queue.length - 1)); else if (timedEnd || stopped) await playIndex(queueIndex >= 0 ? queueIndex : Math.min(resumeIndex, queue.length - 1)); else await player.toggle(); updateTransport(); } catch (error) { notify(playbackMessage(error), true); } };
$('#next').onclick = next; $('#previous').onclick = () => playIndex(queueIndex - 1);
$('#stop').onclick = () => {
  ++playRequest; player.stop(); $('#playback-loading').hidden = true; $('#playback-stall').hidden = true; player.seek(queue[queueIndex]?.startSeconds || 0); stopped = true; transitioning = false;
  $('#position').textContent = `0:00 / ${time(queue[queueIndex]?.limitSeconds || current?.duration)}`;
  $('#remaining-time').textContent = `${t('Remaining')}: ${time(queue[queueIndex]?.limitSeconds || current?.duration)}`; $('#mini-remaining').textContent = $('#remaining-time').textContent;
  $('#seek').value = 0; $('#preview-status').hidden = true; updateTransport(); notify('Playback stopped.');
};
$('#seek').oninput = () => { const available = (current?.source === 'youtube' ? player.youtube?.getDuration() : player.audio.duration) - (queue[queueIndex]?.startSeconds || 0); const duration = Math.min(queue[queueIndex]?.limitSeconds || Infinity, available); if (Number.isFinite(duration)) player.seek((queue[queueIndex]?.startSeconds || 0) + Number($('#seek').value) / 100 * duration); };
$('#fade').oninput = () => player.setFade(Number($('#fade').value));
for (const id of ['volume', 'normalize']) $(`#${id}`).oninput = () => player.setVolume(Number($('#volume').value) / 100, $('#normalize').checked);
$('#stop-preview').onclick = () => { player.preview.pause(); $('#preview-status').hidden = true; };
player.preview.addEventListener('ended', () => { $('#preview-status').hidden = true; });
$('#analyze-all').onclick = () => runAnalysis(state.tracks.filter(t => t.source === 'local'));
$('#export-set').onclick = () => {
  const blob = new Blob([JSON.stringify({ version: 1, ...state }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'tango-dj-set.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  markStep('export'); notify('Set exported. Audio is not included; keep your original recordings.');
};
$('#import-set').onclick = () => { if (busy) { notify('Wait for the current import or analysis to finish.'); return; } $('#set-input').click(); };
$('#set-input').onchange = async event => {
  try {
    if (busy) throw new Error('Wait for the current import or analysis to finish.');
    const file = event.target.files[0]; if (!file) return;
    if (file.size > 10 * 1024 * 1024) throw new Error('Set files must be smaller than 10 MB.');
    const imported = validateSet(JSON.parse(await file.text()));
    if (!confirm(t('Replace your current library and set with this file? Export your current set first if you want to keep it.'))) return;
    ++playRequest; player.stop(); player.track = null; queue = []; queueIndex = -1; current = null;
    resumeIndex = 0; loadedSignature = null; undoGroups = null; timedEnd = false; stopped = false; transitioning = false;
    $('#undo-bar').hidden = true; $('#queue-resume').hidden = true; $('#preview-status').hidden = true; $('#youtube-error').hidden = true;
    $('#position').textContent = '0:00 / 0:00'; $('#seek').value = 0;
    $('#playing-title').textContent = 'No recording loaded'; $('#playing-artist').textContent = 'Play a track or load your prepared set.'; $('#playing-group').textContent = 'READY WHEN YOU ARE'; $('#youtube-wrap').hidden = true;
    const oldIds = state.tracks.filter(t => t.source === 'local').map(t => t.id);
    state = imported; selected = state.groups.some(g => g.id === selected) ? selected : state.groups[0]?.id || null;
    if (!await persist()) { render(); return; }
    for (const id of oldIds) if (!state.tracks.some(t => t.id === id && t.source === 'local')) { await deleteFile(id); player.revoke(id); }
    files.clear();
    for (const track of state.tracks.filter(t => t.source === 'local')) { const blob = await getFile(track.id); if (blob) files.set(track.id, blob); }
    render(); notify('Set imported. Relink any local recordings marked “File needed”.');
  } catch (error) { notify(`Import failed: ${error.message}`, true); }
  finally { event.target.value = ''; }
};


let triedSteps = new Set();
try { triedSteps = new Set(JSON.parse(localStorage.getItem('studio-walkthrough') || '[]')); } catch { /* Progress is optional. */ }
function renderProgress() {
  const steps = [...document.querySelectorAll('[data-step]')];
  for (const step of steps) {
    const done = triedSteps.has(step.dataset.step); step.classList.toggle('tried', done);
    step.querySelector('.step-number').textContent = done ? '✓ Tried' : String(steps.indexOf(step) + 1).padStart(2, '0');
  }
  $('#practice-progress-text').textContent = `${steps.filter(step => triedSteps.has(step.dataset.step)).length} / 8 tried`;
}
function markStep(step) {
  triedSteps.add(step); renderProgress();
  try { localStorage.setItem('studio-walkthrough', JSON.stringify([...triedSteps])); } catch { /* Progress is optional. */ }
}
$('#reset-guide').onclick = () => { triedSteps.clear(); try { localStorage.removeItem('studio-walkthrough'); } catch { /* Optional. */ } renderProgress(); };
$('#toggle-guide').onclick = () => {
  $('#practice-guide').hidden = !$('#practice-guide').hidden;
  $('#toggle-guide').textContent = $('#practice-guide').hidden ? 'Show walkthrough' : 'Hide walkthrough';
  $('#toggle-guide').setAttribute('aria-expanded', String(!$('#practice-guide').hidden)); saveSettings();
};
$('#sample-link').onclick = () => { closePanels(); showView('library');
  $('#youtube-form input').value = `https://www.youtube.com/watch?v=${realTracks[0].videoId}`;
  $('#youtube-form').scrollIntoView({ behavior: 'smooth', block: 'center' }); $('#youtube-form input').focus();
  notify('Recording link filled. Press Add video to import it.');
};
$('#guide-files').onclick = () => { closePanels(); showView('library'); $('#file-input').click(); };
$('#guide-preview').onclick = async () => {
  closePanels(); const track = state.tracks.find(t => t.source === 'local' && files.has(t.id));
  if (!track) { notify('Import a local tango recording with + Local files to use Preview. YouTube recordings use Play.'); return; }
  try {
    await player.previewTrack(track, files.get(track.id));
    $('#preview-status span').textContent = `Preview: ${track.title} · same output`;
    $('#preview-status').hidden = false; markStep('preview'); showView('deck');
  } catch (error) { notify(playbackMessage(error), true); }
};
$('#guide-analyze').onclick = () => {
  closePanels(); const tracks = state.tracks.filter(t => t.source === 'local');
  if (!tracks.length) { notify('Import local tango recordings to analyze BPM and level. YouTube audio cannot be analyzed.'); return; }
  void runAnalysis(tracks);
};
$('#sample-export').onclick = () => { closePanels(); $('#export-set').click(); };
async function loadRealSamples() {
  if (busy) { notify('Wait for the current import or analysis to finish.'); return false; }
  for (const track of realTracks) { const existing = state.tracks.find(t => t.id === track.id); if (!existing) state.tracks.push({ ...track }); else existing.samplePack = REAL_SAMPLE_PACK; }
  for (const group of realGroups()) if (!state.groups.some(g => g.id === group.id)) state.groups.push(group);
  selected = 'real-group-tango'; const saved = await persist(); render(); markStep('load'); markStep('youtube');
  if (saved) notify('Real recordings ready: 6 DJ tandas in Tango / Tango / Vals / Tango / Tango / Milonga order, with 20-second cortinas. Press Play milonga set. Internet is required.');
  return true;
}
$('#load-real-samples').onclick = async () => { if (await loadRealSamples()) $('#examples-dialog').close(); };
$('#real-sample-play').onclick = async () => {
  if (!await loadRealSamples()) return; closePanels(); loadedSignature = null;
  queue = flattenSet(state.groups.filter(g => g.samplePack === REAL_SAMPLE_PACK), state.tracks).map(item => ({ ...item, track: structuredClone(item.track) }));
  queueIndex = -1; renderQueue(); showView('deck'); await playIndex(0);
};
$('#real-guide-play').onclick = () => $('#real-sample-play').click();
$('#real-sample-edit').onclick = async () => { closePanels(); if (await loadRealSamples()) editTrack(state.tracks.find(t => t.id === 'real-tango-1')); };
$('#real-sample-select').onclick = async () => { if (await loadRealSamples()) { closePanels(); markStep('build'); showView('set'); } };
renderProgress();

try {
  const saved = await loadState(); firstVisit = !saved; if (saved) { revision = saved.revision || 0; state = validateSet({ version: 1, ...saved }); selected = saved.selected; loadedSignature = typeof saved.loadedSignature === 'string' ? saved.loadedSignature : null; resumeIndex = Number.isInteger(saved.queueIndex) && saved.queueIndex >= 0 ? saved.queueIndex : 0; savedQueue = Array.isArray(saved.queue) ? saved.queue : []; }
  const migrated = removeOldExamples(state); state = migrated.state;
  for (const group of state.groups) if (group.samplePack === REAL_SAMPLE_PACK && group.kind === 'cortina') {
    const defaults = realGroups().find(item => item.id === group.id);
    if (defaults && [defaults.name + ' · 20-second cortina', defaults.name + ' · Closing cortina'].includes(group.name)) group.name = defaults.name;
  }
  for (const track of migrated.removed) if (track.source === 'local') await deleteFile(track.id);
  queue = savedQueue.filter(item => state.tracks.some(t => t.id === item.trackId)).map(item => ({ ...item, kind: item.kind || state.groups.find(group => group.id === item.groupId)?.kind, track: structuredClone(state.tracks.find(t => t.id === item.trackId)) }));
  if (saved) { queueIndex = -1; $('#queue-resume').hidden = !queue.length; }
  for (const track of state.tracks.filter(t => t.source === 'local')) { const file = await getFile(track.id); if (file) files.set(track.id, file); }
  selected = state.groups.some(g => g.id === selected) ? selected : state.groups[0]?.id || null;
} catch (error) { showStorageRecovery(error); notify(`Could not restore your library: ${storageMessage(error)}`, true); }
render();

// Seed examples only when there is no saved workspace. An intentionally empty
// saved workspace is still existing work and must remain empty.
if (firstVisit) {
  await loadRealSamples();
  loadedSignature = queueSignature(state.groups, state.tracks);
  queue = flattenSet(state.groups, state.tracks).map(item => ({ ...item, track: structuredClone(item.track) }));
  resumeIndex = 0; queueIndex = -1;
  $('#queue-resume').hidden = true;
  $('#playing-title').textContent = queue[0]?.track.title || 'No recording loaded';
  $('#playing-artist').textContent = queue[0]?.track.artist || '';
  $('#playing-group').textContent = queue[0]?.groupName || 'READY WHEN YOU ARE';
  $('#position').textContent = `0:00 / ${time(queue[0]?.track.duration)}`;
  render(); await persist(); showView('deck');
  if (!temporaryWorkspace) notify('Example set ready. Press Play to start. YouTube needs an internet connection.');
}

// A shareable entry point can add examples to an existing workspace.
if (new URLSearchParams(location.search).get('practice') === '1') {
  await loadRealSamples();
  const url = new URL(location.href); url.searchParams.delete('practice'); history.replaceState(null, '', url);
}

if (settings.guideHidden) { $('#practice-guide').hidden = true; $('#toggle-guide').textContent = 'Show walkthrough'; $('#toggle-guide').setAttribute('aria-expanded', 'false'); }
startI18n();

document.addEventListener('keydown', event => {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || document.querySelector('dialog[open]') || event.target.closest('input,select,textarea,button,a,[contenteditable]')) return;
  if (event.repeat) return;
  if (event.code === 'Space') { event.preventDefault(); if (!$('#play-pause').disabled) $('#play-pause').click(); }
});
