import './style.css';
import { parseBlob } from 'music-metadata';
import { uid, youtubeId, flattenSet, removeTrack, validateSet } from './model.js';
import { saveState, loadState, saveFile, getFile, deleteFile, replaceRecording, storageMessage, saveSource, reconnectRecording } from './storage.js';
import { normalizeProgram, insertGroupAfterSelection, insertNext } from './program.js';
import { canConnectFiles, canConnectFolder, contentHash, resolveSource, attachIdentical, folderFiles } from './file-sources.js';
import { Player } from './player.js';
import { playbackMessage } from './fade.js';
import { REAL_SAMPLE_PACK, realTracks, realGroups, realCollections, removeOldExamples } from './samples.js';
import { guideMarkup } from './guide.js';
import { groupDuration, queueSignature } from './workspace.js';
import { t, startI18n, setLanguage, getLanguage } from './i18n.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const time = seconds => Number.isFinite(seconds) ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : '—';
let state = { tracks: [], groups: [] }, selected = null, queue = [], queueIndex = -1, current = null, busy = false;
let playRequest = 0, timedEnd = false, loadedSignature = null, resumeIndex = 0, resumePosition = 0, queueGroupId = null;
let undoGroups = null, transitioning = false, stopped = false, lastRenderedIndex = -1;
const files = new Map(), sourceStatuses = new Map();
let activeCollection = null, collectingInto = null, reconnectMode = false, addingNext = false;
let savedQueue = [], revision = 0, firstVisit = true;
let settings = {};
try { settings = JSON.parse(localStorage.getItem('studio-settings') || '{}'); } catch {}
let persistence = Promise.resolve(), temporaryWorkspace = false;
function workspaceSnapshot(tracks = state.tracks) {
  normalizeProgram(state);
  return structuredClone({ ...state, tracks, queue: queue.map(item => ({ trackId: item.track.id, occurrenceId: item.occurrenceId, addedAfter: item.addedAfter, pendingAddition: item.pendingAddition, groupId: item.groupId, groupName: item.groupName, kind: item.kind, limitSeconds: item.limitSeconds, startSeconds: item.startSeconds, holdAfter: item.holdAfter })), queueIndex: queueIndex >= 0 ? queueIndex : resumeIndex, selected, loadedSignature, queueGroupId, resumePosition: playbackPosition() });
}
function persist() {
  const snapshot = workspaceSnapshot();
  if (temporaryWorkspace) return Promise.resolve(false);
  $('#save-status').textContent = t('Saving…');
  persistence = persistence.then(() => saveState(snapshot, revision)).then(savedRevision => { revision = savedRevision; $('#storage-recovery').hidden = true; $('#save-status').textContent = t('Saved in this browser'); checkpointPlayback(true); return true; }).catch(error => { $('#save-status').textContent = t('Save failed — export a backup'); notify(`Could not save your library: ${storageMessage(error)}`, true);
    if (!error?.message?.includes('another tab. Export')) showStorageRecovery(error);
    return false; });
  return persistence;
}
function playbackPosition() {
  return queueIndex >= 0 && !transitioning && !stopped && player.track ? Math.max(0, player.position() || 0) : resumePosition;
}
let lastCheckpoint = 0;
function checkpointPlayback(force = false) {
  if (temporaryWorkspace || transitioning || !player.track || (!force && Date.now() - lastCheckpoint < 1000)) return;
  const index = queueIndex >= 0 ? queueIndex : resumeIndex, item = queue[index];
  if (!item) return;
  resumePosition = playbackPosition();
  try {
    localStorage.setItem('studio-playback-position', JSON.stringify({ revision, index, trackId: item.track.id, occurrenceId: item.occurrenceId, position: resumePosition, ended: timedEnd }));
    lastCheckpoint = Date.now();
  } catch {}
}
function renderTimeline(item, sourcePosition, sourceDuration = item?.track.duration) {
  const start = item?.startSeconds || 0, available = Math.max(0, sourceDuration - start);
  const duration = item?.limitSeconds ? Math.min(item.limitSeconds, available > 0 ? available : item.limitSeconds) : available;
  const position = Math.max(0, sourcePosition - start);
  $('#position').textContent = `${time(item?.limitSeconds ? Math.min(position, item.limitSeconds) : position)} / ${time(duration)}`;
  $('#remaining-time').textContent = duration > 0 ? `${t('Remaining')}: ${time(Math.max(0, duration - position))}` : '';
  $('#mini-remaining').textContent = $('#remaining-time').textContent;
  $('#seek').value = duration > 0 ? Math.min(100, position / duration * 100) : 0;
}
window.addEventListener('pagehide', () => checkpointPlayback(true));
document.addEventListener('visibilitychange', () => { if (document.hidden) checkpointPlayback(true); });
function notify(message, error = false) {
  const el = document.querySelector('#notice'); $('#notice-message').textContent = t(message); el.hidden = false; el.classList.toggle('error', error);
  clearTimeout(notify.timer); if (!error) notify.timer = setTimeout(() => { el.hidden = true; }, 5500);
}

 document.querySelector('#app').innerHTML = `
  <aside class="sidebar">
    <a class="brand" href="#"><span class="brand-icon">◈</span><span>TANGO<br><b>DJ STUDIO</b></span></a>
    <div class="workspace-label">YOUR WORKSPACE</div>
    <a href="#library" class="nav active">♫ <span>1 · Music</span><span id="nav-count" class="count">0</span></a>
    <a href="#collections" class="nav">▤ <span>2 · Sets</span></a><a href="#set" class="nav">▤ <span>3 · Tandas</span></a>
    <a href="#deck" class="nav">◉ <span>4 · Playback</span></a>
    <div class="sidebar-bottom"><span class="status-dot"></span> Local-first workspace<p>Music stays in this browser.<br>YouTube plays online.</p></div>
  </aside>
  <nav class="device-nav" aria-label="Workspace navigation"><button data-view="library" aria-current="page">1 · Music</button><button data-view="collections">2 · Sets</button><button data-view="set">3 · Tandas</button><button data-view="deck">4 · Playback</button></nav>
  <main>
    <header class="workspace-header"><div class="workspace-title"><h1>DJ workspace</h1><span id="save-status" role="status">Saved in this browser</span></div><button id="open-menu" class="phone-menu" aria-expanded="false">Menu</button><div class="header-actions"><button id="open-examples">Example sets</button><button id="open-guide">User guide</button><button id="open-settings">Settings</button><button id="import-set">Import set</button><button id="export-set">Export set ↗</button></div></header>
    <div id="notice" role="status" aria-live="polite" hidden><span id="notice-message"></span><button id="dismiss-notice" aria-label="Dismiss notification">×</button></div><div id="undo-bar" hidden><span>Set changed</span><button id="undo-set">Undo last set edit</button></div>
    <p class="workflow-hint">Add music, arrange your tandas, then play your set.</p><div id="storage-recovery" class="storage-recovery" role="status" hidden><strong>Temporary workspace · not saved</strong><p id="storage-recovery-message"></p><p>You can play the example set in this tab. Export your edits before closing or reloading.</p><div><button id="retry-saving">Retry saving</button><button id="temporary-export">Export set</button></div></div><section id="collections" class="panel collections-panel"><div class="section-head"><div><div class="eyebrow">02 / CANDIDATES</div><h2>Sets</h2></div><button id="new-collection" class="primary">Create set</button></div><p class="hint">Collect candidate recordings here, then choose 3–4 for a tanda.</p><div id="collection-list"></div><div id="collection-detail"></div></section><div class="workspace">
      <section id="library" class="panel library">
        <div class="section-head"><div><div class="eyebrow">01 / COLLECTION</div><h2>Music library <span id="library-count">0</span></h2></div><button id="add-files" class="primary">+ Local files</button></div>
        <div id="drop-zone" tabindex="0" role="button" aria-label="Choose or drop local music files"><span class="drop-icon">↥</span><div><strong>Drop your music here</strong><span>MP3, WAV, FLAC, M4A and other browser-supported audio</span></div><span class="drop-link">Browse files</span></div>
        <div class="file-tools"><button id="connect-files">Connect originals</button><button id="check-files">Check files</button><button id="reconnect-folder">Reconnect from folder</button></div><p class="hint storage-explanation">Local files keeps an app copy. Connect originals reads files in place on supported browsers.</p><form id="youtube-form" class="youtube-form"><span class="youtube-mark">▶</span><input name="url" type="url" aria-label="YouTube video URL" placeholder="Paste a YouTube video link" required><button type="submit">Add video</button></form>
        <div class="library-destination"><label for="add-target">Add recordings to</label><select id="add-target" aria-label="Recording destination"></select><button id="finish-adding" hidden>Back to set</button><p id="library-target" class="hint"></p></div><p id="import-progress" class="hint" role="status" hidden></p><div class="filters"><input id="search" type="search" aria-label="Search library" placeholder="Search title, orchestra, singer…"><select id="collection-filter" aria-label="Filter set"><option value="">All sets</option></select><select id="style-filter" aria-label="Filter dance style"><option value="">All styles</option><option>Tango</option><option>Vals</option><option>Milonga</option><option>Cortina</option></select><select id="source-filter" aria-label="Filter source"><option value="">All sources</option><option value="local">Local</option><option value="youtube">YouTube</option></select></div>
        <div class="table-scroll"><table><thead><tr><th>RECORDING</th><th>STYLE / YEAR</th><th>BPM</th><th>LENGTH</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody id="tracks"></tbody></table></div>
        <div id="empty-library" class="empty"><span>♫</span><h3>A home for your collection</h3><p>Bring in your recordings, organize the details,<br>and find the right music for each moment.</p><button id="clear-filters" hidden>Clear filters</button></div>
        <div class="panel-foot"><span id="library-summary">0 recordings · 0:00 known duration</span><button id="analyze-all" class="text-button">Analyze local tracks</button></div>
      </section>
      <section id="set" class="panel set-panel">
        <div class="section-head"><div><div class="eyebrow">03 / TANDAS</div><h2>Tandas</h2></div><span id="set-duration" class="badge">0:00</span></div>
        <div class="builder-actions"><button id="add-tanda">+ Tanda</button><button id="add-cortina">+ Cortina</button><button id="save-preset">Save tanda</button></div>
        <p id="selected-group" class="selection-summary"></p><p class="hint">Choose a tanda, then use Add to tanda in Music. Collect in set only saves candidates.</p>
        <button id="choose-recordings" class="wide">Choose recordings for this group</button><div id="presets"></div><div id="groups"></div>
        <div id="empty-set" class="empty"><span>▤</span><h3>Give your set a shape</h3><p>Create a tanda, choose its recordings,<br>then add a cortina between groups.</p></div>
        <button id="refresh-queue" class="wide" hidden>Update upcoming queue</button><p id="queue-stale" class="hint" hidden>Set changed. Update upcoming queue to keep the current recording, or load the whole set from the start.</p><button id="start-set" class="primary wide">▶ Load & play set</button>
      </section>
    </div>
    <section id="deck" class="panel deck">
      <div class="deck-main"><button id="deck-start-set" class="primary" hidden>Play prepared set</button><div class="eyebrow">04 / PLAYBACK</div><div class="now-playing"><div class="record-art">♫</div><div><span id="playing-group" class="eyebrow">READY WHEN YOU ARE</span><h2 id="playing-title">No recording loaded</h2><p id="playing-artist">Play a track or load your prepared set.</p></div></div>
        <div class="transport"><button id="previous" aria-label="Previous track">⏮</button><button id="play-pause" class="play-button" aria-label="Play or pause">▶</button><button id="next" aria-label="Next track">⏭</button><button id="stop" aria-label="Stop playback">■</button><span id="position">0:00 / 0:00</span></div>
        <button id="next-tanda" class="primary wide" hidden>Next tanda</button><div id="pending-additions"></div><div class="deck-context"><span id="recording-number"></span><span id="remaining-time"></span></div><div id="up-next" class="up-next" hidden></div>
        <input id="seek" type="range" min="0" max="100" value="0" aria-label="Playback position">
        <details class="playback-options" open><summary>Playback settings</summary><div class="deck-settings"><label>Volume <input id="volume" type="range" min="0" max="100" value="85"></label><label>Fade <select id="fade"><option value="0" selected>Off</option><option value="1">1 sec</option><option value="2">2 sec</option><option value="4">4 sec</option></select></label><label><input id="normalize" type="checkbox"> Level local audio</label><label><input id="auto-next" type="checkbox" checked> Auto next</label></div>
        <p class="hint">Fade follows the beginning and end of each recording. YouTube fades depend on device volume support; use local files for reliable fades. Preview uses the live output.</p></details><p id="playback-loading" class="hint" role="status" hidden>Loading recording…</p><div id="playback-recovery" class="playback-stall" hidden><span id="playback-recovery-message"></span><button id="playback-retry">Retry</button><button id="playback-relink">Relink file</button><button id="playback-skip">Skip recording</button></div>
        <div id="preview-status" class="preview-status" hidden><span></span><button id="stop-preview">Stop preview</button></div>
        <p id="playback-permission" class="hint" role="status" hidden>Playback has not started. Press play inside the YouTube video below, or press Play again.</p><div id="playback-stall" class="playback-stall" hidden><span>Playback is waiting for YouTube. Check your connection or retry from the current position.</span><button id="resume-video">Retry here</button></div><div id="youtube-wrap" hidden><div id="youtube-player"></div><div id="youtube-error" hidden><strong>YouTube video unavailable</strong><p id="youtube-error-message"></p><div class="video-recovery"><a id="youtube-open" target="_blank" rel="noopener noreferrer">Open on YouTube</a><button id="youtube-retry">Retry video</button><button id="youtube-replace">Replace video link</button><button id="youtube-local">Use my local recording</button><button id="youtube-skip">Skip unavailable video</button></div></div><p class="hint">If automatic playback is blocked, press play in the video.</p></div>
      </div>
      <div class="queue-panel"><div class="section-head"><h3>Play queue</h3><span id="queue-count" class="badge">0</span></div><p id="queue-resume" class="hint" hidden>Queue restored. Press Play to resume your last recording.</p><div id="queue"><p class="hint">Load a set or play a library track.</p></div></div>
    </section>
    <div id="mini-deck" class="mini-deck" hidden><button id="mini-open" class="mini-recording"><strong></strong><small></small></button><span id="mini-remaining"></span><button id="mini-play" aria-label="Play or pause">▶</button><button id="mini-next" aria-label="Next track">⏭</button></div>
    <footer><div class="footer-credit"><span>Made for the music between people.</span><button id="maker-credit" data-preserve>Made by 별사탕</button></div><span>Library & files saved locally · Export sets for backup</span></footer>
  </main>
  <dialog id="dedication-dialog" aria-labelledby="dedication-title"><button class="dedication-close" data-close="dedication-dialog" aria-label="Close">×</button><span class="dedication-star" aria-hidden="true">✦</span><h2 id="dedication-title" data-preserve>Dedicated to 태풍</h2></dialog>
  <dialog id="examples-dialog"><div class="dialog-heading"><h2>Example sets</h2><button data-close="examples-dialog" aria-label="Close">×</button></div><p class="hint">Six tandas with cortinas. Add this set to your workspace when you need a starting point.</p><div class="example-flow">Tango · Tango · Vals · Tango · Tango · Milonga</div><div id="example-actions"></div></dialog>
  <dialog id="guide-dialog"><div class="dialog-heading"><h2>User guide</h2><button data-close="guide-dialog" aria-label="Close">×</button></div>${guideMarkup}</dialog>
  <dialog id="settings-dialog"><div class="dialog-heading"><h2>Settings</h2><button data-close="settings-dialog" aria-label="Close">×</button></div><label class="language-control">Language <select id="language" aria-label="Language"><option value="ko">한국어</option><option value="en">English</option><option value="es">Español</option></select></label><p><a href="https://minjung-world.notion.site/Tango-DJ-Studio-Privacy-Policy-b7474a525fd882d39c2e01b0091b667b" target="_blank" rel="noopener noreferrer">Privacy policy</a> · <a href="https://minjung-world.notion.site/Tango-DJ-Studio-Terms-of-Use-c3174a525fd8831f9cab81b1b229fa08" target="_blank" rel="noopener noreferrer">Terms of use</a></p><section class="storage-panel"><div><strong>Personal workspace</strong><p>Your library, audio files, set, queue, and preferences are saved for this site in this browser. Other visitors have their own workspace.</p></div><div><button id="persist-storage">Request persistent storage</button><small id="storage-details"></small></div></section></dialog>
  <dialog id="actions-dialog"><div class="dialog-heading"><h2>Recording actions</h2><button data-close="actions-dialog" aria-label="Close">×</button></div><p id="actions-title" data-preserve></p><div id="recording-actions"></div></dialog><input id="file-input" type="file" accept="audio/*,.mp3,.wav,.flac,.m4a,.ogg,.aiff,.aif,.opus" multiple hidden>
  <input id="set-input" type="file" accept="application/json,.json" hidden>
  <input id="relink-input" type="file" accept="audio/*,.mp3,.wav,.flac,.m4a,.ogg,.aiff,.aif,.opus" hidden>
  <dialog id="target-dialog"><div class="dialog-heading"><h2 id="target-heading">Choose target tanda</h2><button data-close="target-dialog" aria-label="Close">×</button></div><p id="target-recording" data-preserve></p><p id="target-explanation" class="hint"></p><label id="target-label" for="next-target">Target tanda</label><select id="next-target" aria-label="Target tanda"></select><button id="confirm-next" class="primary">Add to play next</button></dialog><dialog id="repair-dialog"><div class="dialog-heading"><h2>Review reconnection</h2><button data-close="repair-dialog">×</button></div><div id="repair-results"></div></dialog><dialog id="metadata-dialog"><form id="metadata-form"><div class="eyebrow">RECORDING DETAILS</div><h2>Edit metadata</h2><input name="id" type="hidden"><label>Title<input name="title" required maxlength="300"></label><label>Orchestra / artist<input name="artist" maxlength="300"></label><label>Singer<input name="singer" maxlength="300"></label><div class="form-row"><label>Year<input name="year" maxlength="30"></label><label>Style<select name="style" aria-label="Style"><option value="">Unspecified</option><option>Tango</option><option>Vals</option><option>Milonga</option><option>Cortina</option></select></label><label>BPM<input name="bpm" type="number" min="20" max="300" step="1"></label></div><label id="video-url-label" hidden>Video URL<input name="videoUrl" type="url" placeholder="https://www.youtube.com/watch?v=..."></label><p id="analysis-details" class="hint"></p><div class="dialog-actions"><button id="close-metadata" type="button">Cancel</button><button class="primary" type="submit">Save details</button></div></form></dialog>
`;
const $ = selector => document.querySelector(selector);
$('#dismiss-notice').onclick = () => { $('#notice').hidden = true; clearTimeout(notify.timer); };
for (const [button, dialog] of [['open-examples','examples-dialog'],['open-guide','guide-dialog'],['open-settings','settings-dialog']]) $(`#${button}`).onclick = () => $(`#${dialog}`).showModal();
for (const button of document.querySelectorAll('[data-close]')) button.onclick = () => $(`#${button.dataset.close}`).close();
let creditClicks = 0, lastCreditClick = 0;
$('#maker-credit').onclick = () => {
  const now = Date.now();
  creditClicks = now - lastCreditClick > 3000 ? 1 : creditClicks + 1;
  lastCreditClick = now;
  if (creditClicks === 5) { creditClicks = 0; $('#dedication-dialog').showModal(); }
};
$('#example-actions').append($('#load-real-samples'), $('#real-sample-play'));
const phoneLayout = matchMedia('(max-width: 699px)');
let activeView = 'library';
const viewPositions = new Map();
let choosingForGroup = false;
function showView(view, scroll = true) {
  if (scroll) viewPositions.set(activeView, window.scrollY);
  activeView = view; document.body.dataset.view = view;
  for (const button of document.querySelectorAll('button[data-view]')) {
    if (button.dataset.view === view) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  }
  if (scroll) window.scrollTo({ top: viewPositions.get(view) || 0, behavior: 'instant' });
  for (const link of document.querySelectorAll('.sidebar .nav')) { link.classList.toggle('active', link.hash === `#${view}`); if (link.hash === `#${view}`) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); }
  updateMiniDeck();
}
function revealSelectedGroup() {
  const article = [...document.querySelectorAll('#groups .group')].find(el => el.dataset.group === selected);
  article?.scrollIntoView({ block: 'center', behavior: 'instant' });
}
for (const button of document.querySelectorAll('button[data-view]')) button.onclick = () => showView(button.dataset.view);
for (const link of document.querySelectorAll('.sidebar .nav')) link.onclick = event => { event.preventDefault(); showView(link.hash.slice(1)); };
$('#open-menu').onclick = () => {
  const expanded = document.body.classList.toggle('menu-expanded'); $('#open-menu').setAttribute('aria-expanded', String(expanded));
};
$('#choose-recordings').onclick = () => { collectingInto = null; choosingForGroup = true; syncDestination(); renderLibrary(); showView('library'); $('#search').focus({ preventScroll: true }); };
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
  renderTimeline(queue[queueIndex], position, duration);
  checkpointPlayback();
  position = Math.max(0, position - startSeconds);
  const limit = queue[queueIndex]?.limitSeconds;
  if (!transitioning && limit && position >= limit && !timedEnd) { timedEnd = true; player.stop(); updateTransport(); checkpointPlayback(true); if ($('#auto-next').checked && !queue[queueIndex]?.holdAfter) void next(); else notify('Cortina finished. Press Next to continue.'); }
}, () => { timedEnd = true; checkpointPlayback(true); updateTransport(); if ($('#auto-next').checked && !queue[queueIndex]?.holdAfter) void next(); else if (queue[queueIndex]?.kind === 'cortina') notify('Cortina finished. Press Next to continue.'); }, error => {
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
$('#playback-retry').onclick = () => { if (queueIndex >= 0) void playIndex(queueIndex, playbackPosition()); };
$('#playback-relink').onclick = () => { reconnectMode = false; relinkId = current?.id; $('#relink-input').click(); };
$('#playback-skip').onclick = next;
$('#youtube-retry').onclick = () => { if (queueIndex >= 0) void playIndex(queueIndex, playbackPosition()); };
$('#youtube-skip').onclick = next;
$('#youtube-local').onclick = () => { reconnectMode = false; relinkId = player.track?.id; $('#relink-input').click(); };
$('#youtube-replace').onclick = () => { const track = state.tracks.find(t => t.id === player.track?.id); if (track) editTrack(track); };
function saveSettings() {
  const value = { volume: Number($('#volume').value), fade: $('#fade').value, normalize: $('#normalize').checked, autoNext: $('#auto-next').checked, guideHidden: $('#practice-guide').hidden };
  try { localStorage.setItem('studio-settings', JSON.stringify(value)); } catch { notify('Save failed — export a backup', true); }
}
$('#language').onchange = event => { setLanguage(event.target.value); render(); };
for (const id of ['volume','fade','normalize','auto-next']) $(`#${id}`).addEventListener('change', saveSettings);
if (Number.isFinite(settings.volume)) $('#volume').value = Math.max(0, Math.min(100, settings.volume));
if (['0','1','2','4'].includes(settings.fade)) $('#fade').value = settings.fade;
if (typeof settings.normalize === 'boolean') $('#normalize').checked = settings.normalize;
if (typeof settings.autoNext === 'boolean') $('#auto-next').checked = settings.autoNext;
player.setVolume(Number($('#volume').value) / 100, $('#normalize').checked);
player.onPlaybackState = () => { updateTransport(); checkpointPlayback(true); };
async function storageDetails() {
  try { const estimate = await navigator.storage?.estimate(); const persistent = await navigator.storage?.persisted(); $('#storage-details').textContent = `${t('Browser storage')}: ${Math.round((estimate?.usage || 0) / 1024 / 1024)} MB · ${getLanguage() === 'ko' ? (persistent ? '유지 허용됨' : '브라우저 기본 정책') : getLanguage() === 'es' ? (persistent ? 'persistente' : 'política del navegador') : (persistent ? 'persistent' : 'browser default')}`; } catch {}
}
$('#persist-storage').onclick = async () => { try { await navigator.storage?.persist(); await storageDetails(); } catch (error) { notify(error.message, true); } };
void storageDetails();
$('#language').addEventListener('change', storageDetails);
for (const option of document.querySelectorAll('select option')) if (!option.hasAttribute('value')) option.value = option.textContent;

const tStatus = id => t(sourceStatuses.get(id) || (files.has(id) ? 'Stored copy' : 'File missing'));
const searchKey = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function renderLibrary() {
  syncDestination();
  const filteredCollection = $('#collection-filter').value || null;
  const search = searchKey($('#search').value), style = $('#style-filter').value, source = $('#source-filter').value;
  const visible = state.tracks.filter(t => (!filteredCollection || state.collections?.find(c => c.id === filteredCollection)?.trackIds.includes(t.id)) && searchKey(`${t.title} ${t.artist} ${t.singer} ${t.year}`).includes(search) && (!style || t.style === style) && (!source || t.source === source));
  $('#tracks').innerHTML = visible.map(track => `<tr draggable="true" data-track="${esc(track.id)}"><td><div class="track-title">${esc(track.title)}</div><div class="track-detail"><span class="source-tag ${track.source}">${track.source === 'local' ? 'FILE' : 'YOUTUBE'}</span> ${esc(track.artist || 'Unknown orchestra')}${track.singer ? ` · ${esc(track.singer)}` : ''}${track.source === 'local' ? ` · <span class="source-status ${!files.has(track.id) ? 'missing' : ''}">${esc(track.source === 'local' ? tStatus(track.id) : '')}</span>` : ''}</div></td><td>${esc(track.style || '—')}<small>${esc(track.year || '')}</small></td><td>${track.bpm ? esc(track.bpm) : '—'}</td><td>${time(track.duration)}</td><td class="track-actions"><button data-action="play" data-id="${esc(track.id)}" aria-label="Play ${esc(track.title)}" title="Play">▶ Play</button>${track.source === 'local' ? `<button class="secondary-action" data-action="preview" data-id="${esc(track.id)}" aria-label="Preview ${esc(track.title)}" title="Preview on current output">♬ Preview</button><button class="secondary-action" data-action="analyze" data-id="${esc(track.id)}" aria-label="Analyze ${esc(track.title)}" title="Analyze BPM and level">⌁ Analyze</button>` : ''}<button class="next-action" data-action="play-next" data-id="${esc(track.id)}" ${current ? '' : 'hidden'}>${t('Play next')}</button><button class="collect-action" data-action="collection" data-id="${esc(track.id)}">${t('Collect in set')}</button>${track.source === 'local' ? `<button class="secondary-action" data-action="locate" data-id="${esc(track.id)}">Locate file</button><button class="secondary-action" data-action="copy" data-id="${esc(track.id)}">Keep an app copy</button><button class="secondary-action" data-action="relink" data-id="${esc(track.id)}">Replace recording</button>` : ''}<button class="secondary-action" data-action="edit" data-id="${esc(track.id)}" aria-label="Edit ${esc(track.title)}" title="Edit metadata">✎ Edit</button><button data-action="add" data-id="${esc(track.id)}" aria-label="Add ${esc(track.title)} to selected group" title="Add to selected group">${t(state.groups.find(group => group.id === selected)?.kind === 'cortina' ? 'Use as cortina' : 'Add to tanda')}</button><button class="secondary-action" data-action="delete" data-id="${esc(track.id)}" aria-label="Delete ${esc(track.title)}" title="Remove from library">×</button><button class="more-action" data-action="more" data-id="${esc(track.id)}" aria-label="More actions for ${esc(track.title)}">More</button></td></tr>`).join('');
  $('#empty-library').hidden = visible.length > 0;
  $('#empty-library h3').textContent = state.tracks.length ? 'No matching recordings' : 'A home for your collection';
  $('#empty-library p').textContent = t(state.tracks.length ? 'Try another search or clear the filters to see your recordings.' : 'Bring in your recordings, organize the details, and find the right music for each moment.');
  $('#clear-filters').hidden = !state.tracks.length;
  $('#library-count').textContent = state.tracks.length; $('#nav-count').textContent = state.tracks.length;
  $('#library-summary').textContent = `${state.tracks.length} recordings · ${time(state.tracks.reduce((s, t) => s + (t.duration || 0), 0))} known duration`;
}
function canMoveGroup(group, direction) { const top = state.groups.filter(g => !g.parentId); const index = top.findIndex(g => g.id === group.id); return !group.parentId && index >= 0 && Boolean(top[index + direction]); }
function renderGroups() {
  $('#groups').innerHTML = state.groups.map((g, i) => `<article class="group ${g.collapsed ? 'collapsed' : ''} ${g.parentId ? 'attached-cortina' : ''} ${selected === g.id ? 'selected' : ''}" data-group="${esc(g.id)}"><div class="group-header"><button class="group-select" data-group-action="select" data-id="${esc(g.id)}"><span class="group-number">${String(i + 1).padStart(2, '0')}</span><span><span class="eyebrow">${t(g.kind === 'tanda' ? 'Tanda' : 'Cortina')}</span><strong>${esc(g.name)}</strong></span></button><div class="group-tools"><button data-group-action="collapse" data-id="${esc(g.id)}" aria-expanded="${!g.collapsed}">${t(g.collapsed ? 'Expand' : 'Collapse')}</button>${g.kind === 'tanda' ? `<button data-group-action="play-tanda" data-id="${esc(g.id)}" aria-label="${t('Play this tanda')}" title="${t('Play this tanda')} · ${t('Plays on the live output')}" ${!g.trackIds.length ? 'disabled' : ''}>▶</button><button data-group-action="cortina" data-id="${esc(g.id)}">${t('Cortina')}</button><button data-group-action="notes" data-id="${esc(g.id)}" aria-label="Tanda notes">Notes</button>` : ''}<button data-group-action="up" data-id="${esc(g.id)}" aria-label="Move group up" ${!canMoveGroup(g, -1) ? 'disabled' : ''}>↑</button><button data-group-action="down" data-id="${esc(g.id)}" aria-label="Move group down" ${!canMoveGroup(g, 1) ? 'disabled' : ''}>↓</button><button data-group-action="rename" data-id="${esc(g.id)}" aria-label="Rename group">✎</button><button data-group-action="delete" data-id="${esc(g.id)}" aria-label="Delete group">×</button></div></div>${g.notes ? `<p class="tanda-notes" data-preserve>${esc(g.notes)}</p>` : ''}<ol>${g.trackIds.map((id, j) => { const track = state.tracks.find(t => t.id === id); return `<li><span>${esc(track?.title || 'Missing track')}</span><div>${g.kind === 'tanda' ? `<button data-group-action="play-recording" data-id="${esc(g.id)}" data-index="${j}" aria-label="${esc(`${t('Play only this recording')}: ${track?.title || 'Missing track'}`)}" title="${t('Play only this recording')}">▶</button>` : ''}<button data-group-action="track-up" data-id="${esc(g.id)}" data-index="${j}" aria-label="Move recording up" ${j === 0 ? 'disabled' : ''}>↑</button><button data-group-action="track-down" data-id="${esc(g.id)}" data-index="${j}" aria-label="Move recording down" ${j === g.trackIds.length - 1 ? 'disabled' : ''}>↓</button><button data-group-action="remove" data-id="${esc(g.id)}" data-index="${j}" aria-label="Remove recording from group">×</button></div></li>`; }).join('')}</ol>${g.kind === 'cortina' ? `<div class="cortina-range"><label><span>${t('From')}</span><input type="number" min="0" max="86400" step="1" value="${g.startSeconds || 0}" data-cortina-start="${esc(g.id)}" aria-label="${t('Cortina start position')}"></label><span class="range-arrow">→</span><label><span>${t('To')}</span><input type="number" min="1" max="90000" step="1" value="${(g.startSeconds || 0) + (g.limitSeconds || 20)}" data-cortina-end="${esc(g.id)}" ${g.fullLength ? 'disabled' : ''} aria-label="${t('Cortina end position')}"></label><span class="range-unit">${t('seconds')}</span><button data-group-action="cue-position" data-id="${esc(g.id)}" aria-label="${t('Use deck position')}" title="${t('Use deck position')}" ${!current || !g.trackIds.includes(current.id) ? 'disabled' : ''}>⌖</button><button data-group-action="cue-play" data-id="${esc(g.id)}" aria-label="${t('Play this cortina')}" title="${t('Play this cortina')} · ${t('Plays on the live output')}" ${!g.trackIds.length ? 'disabled' : ''}>▶</button></div><label class="cortina-hold"><input type="checkbox" data-cortina-full="${esc(g.id)}" ${g.fullLength ? 'checked' : ''}>${t('Use the rest of the recording')}</label><label class="cortina-hold"><input type="checkbox" data-cortina-hold="${esc(g.id)}" ${g.holdAfter ? 'checked' : ''}>${t('Wait before the next tanda')}</label>` : ''}${!g.trackIds.length ? '<p class="group-drop">Drop recordings here or select Add to tanda</p>' : ''}<div class="group-duration">${g.trackIds.length} recordings · ${time(groupDuration(g, state.tracks))} known duration</div></article>`).join('');
  refreshGroupSummaries();
}
function playbackGroups() { return queueGroupId ? state.groups.filter(group => group.id === queueGroupId) : state.groups; }
function playbackSignature() { return queueSignature(playbackGroups(), state.tracks); }
function refreshGroupSummaries() {
  const articles = new Map([...document.querySelectorAll('#groups .group')].map(el => [el.dataset.group, el]));
  for (const group of state.groups) {
    const article = articles.get(group.id);
    if (!article) continue;
    const cortina = state.groups.find(g => g.parentId === group.id);
    article.querySelector('.group-duration').textContent = `${group.trackIds.length} ${t('recordings')} · ${time(groupDuration(group, state.tracks))}${group.kind === 'tanda' && ![3,4].includes(group.trackIds.length) ? ` · ${t('Usually 3–4 recordings')}` : ''}${cortina ? ` · ${t('Cortina')}: ${cortina.name}` : ''}${group.trackIds.some(id => state.tracks.find(t => t.id === id)?.source === 'local' && !files.has(id)) ? ` · ${t('File needed')}` : ''}`;
    const startInput = article.querySelector('[data-cortina-start]'), endInput = article.querySelector('[data-cortina-end]');
    if (startInput && document.activeElement !== startInput) startInput.value = group.startSeconds || 0;
    if (endInput && document.activeElement !== endInput) endInput.value = group.fullLength ? (group.trackIds.map(id => state.tracks.find(track => track.id === id)?.duration).find(duration => Number.isFinite(duration)) || '') : (group.startSeconds || 0) + (group.limitSeconds || 20);
    const cueButton = article.querySelector('[data-group-action="cue-position"]');
    if (cueButton) cueButton.disabled = !current || !group.trackIds.includes(current.id);
  }
  $('#empty-set').hidden = state.groups.length > 0;
  $('#set-duration').textContent = time(state.groups.reduce((s, group) => s + groupDuration(group, state.tracks), 0));
  $('#start-set').disabled = !flattenSet(state.groups, state.tracks).length;
  $('#deck-start-set').hidden = $('#start-set').disabled || Boolean(current && loadedSignature && !queueGroupId);
  const chosen = state.groups.find(g => g.id === selected);
  $('#choose-recordings').hidden = !chosen;
  syncDestination();
  $('#selected-group').textContent = chosen ? `${t('Adding to')}: ${chosen.name}` : t('Select a tanda to add recordings');
  $('#queue-stale').hidden = !loadedSignature || loadedSignature === playbackSignature();
  $('#refresh-queue').hidden = $('#queue-stale').hidden || !current || queueIndex < 0; $('#refresh-queue').disabled = transitioning;
}
let deckVisible = false;
function updateMiniDeck() { const visible = Boolean(current && (!deckVisible || (phoneLayout.matches && activeView !== 'deck'))); $('#mini-deck').hidden = !visible; document.body.classList.toggle('mini-deck-visible', visible); }
new IntersectionObserver(entries => { deckVisible = entries[0].isIntersecting; updateMiniDeck(); }, { threshold: 0 }).observe($('#deck .transport'));
$('#mini-open').onclick = () => showView('deck');
$('#mini-play').onclick = () => $('#play-pause').click(); $('#mini-next').onclick = () => $('#next').click();
function renderQueue() {
  renderPending(); updateTransport();
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
function render() { normalizeProgram(state); renderCollections(); renderPresets(); renderLibrary(); renderGroups(); renderQueue(); }

async function importFiles(list, handles = []) {
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
      const hash = await contentHash(file);
      const duplicate = state.tracks.find(t => t.source === 'local' && t.contentHash === hash);
      if (duplicate) { if (handles[index] && confirm(t(`Connect this original to existing recording “${duplicate.title}”?`))) await reconnectSame(duplicate, file, handles[index]); skipped++; continue; }
      notify(`Reading ${file.name}…`);
      let metadata;
      try { metadata = await parseBlob(file); } catch { /* Tag failures do not prevent importing playable audio. */ }
      const common = metadata?.common || {};
      const genre = (common.genre || []).find(g => ['Tango', 'Vals', 'Milonga', 'Cortina'].some(s => s.toLowerCase() === g.toLowerCase()));
      const track = { id: uid(), source: 'local', contentHash: hash, fileName: file.name, fileSize: file.size, lastModified: file.lastModified,
        title: common.title || file.name.replace(/\.[^.]+$/, ''), artist: common.artist || common.albumartist || '', singer: '', year: String(common.year || ''),
        style: genre ? genre[0].toUpperCase() + genre.slice(1).toLowerCase() : '', duration: metadata?.format.duration || null, bpm: common.bpm || null };
      if (handles[index]) await saveSource(track.id, { handle: handles[index] }); else await saveFile(track.id, file);
      sourceStatuses.set(track.id, handles[index] ? 'Ready' : 'Stored copy'); files.set(track.id, file); state.tracks.push(track);
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
  const file = await readyFile(track); if (!file) throw new Error(`Relink ${track.title} first.`);
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
  for (const button of document.querySelectorAll('#tracks [data-action=play-next]')) { button.hidden = !current; button.disabled = transitioning || addingNext; }
  const playing = !stopped && (player.track?.source === 'youtube' ? player.youtube?.getPlayerState?.() === 1 : !player.audio.paused);
  $('#play-pause').textContent = transitioning ? '…' : playing ? 'Ⅱ' : '▶';
  $('#seek').disabled = transitioning || !player.track;
  $('#previous').disabled = transitioning || queueIndex <= 0;
  $('#next').disabled = transitioning || !queue.length || queueIndex >= queue.length - 1;
  $('#stop').disabled = !current && !player.track;
  $('#play-pause').disabled = transitioning || (!queue.length && !player.track);
  $('#mini-play').textContent = $('#play-pause').textContent; $('#mini-play').disabled = $('#play-pause').disabled;
  $('#mini-next').disabled = $('#next').disabled;
  const cortina = queue[queueIndex]?.kind === 'cortina';
  $('#next-tanda').hidden = !cortina; $('#next-tanda').disabled = transitioning;
  $('#next-tanda').textContent = t(queue.slice(queueIndex + 1).some(item => item.kind === 'tanda') ? 'Next tanda' : 'End cortina');
}
function rememberSetEdit() { undoGroups = { groups: structuredClone(state.groups), selected }; $('#undo-bar').hidden = false; }
$('#undo-set').onclick = () => {
  if (!undoGroups) return;
  state.groups = undoGroups.groups.map(group => {
    const remaining = group.trackIds.map((id, index) => ({ id, occurrenceId: group.occurrenceIds[index] })).filter(item => state.tracks.some(track => track.id === item.id));
    return { ...group, trackIds: remaining.map(item => item.id), occurrenceIds: remaining.map(item => item.occurrenceId) };
  }); selected = undoGroups.selected; undoGroups = null;
  $('#undo-bar').hidden = true; void persist(); renderGroups();
};
async function playIndex(index, fromPosition = null) {
  if (index < 0 || index >= queue.length) return;
  const item = queue[index];
  if (Number.isFinite(item.track.duration) && item.track.duration > 0 && (item.startSeconds || 0) >= item.track.duration) {
    notify('The start must be before the recording ends. Choose an earlier cue.', true); return;
  }
  const start = item.startSeconds || 0;
  const end = Math.min(Number.isFinite(item.track.duration) && item.track.duration > 0 ? item.track.duration : Infinity, item.limitSeconds ? start + item.limitSeconds : Infinity);
  const position = Number.isFinite(fromPosition) && fromPosition >= start && fromPosition < end ? fromPosition : start;
  const request = ++playRequest; transitioning = true; updateTransport();
  $('#playback-loading').hidden = false; $('#playback-recovery').hidden = true;
  try {
    $('#youtube-error').hidden = true;
    const sourceFile = item.track.source === 'local' ? await readyFile(item.track, true) : null;
    if (request !== playRequest) return;
    if (!await player.play(item.track, sourceFile, Number($('#fade').value), $('#normalize').checked, item.startSeconds || 0, item.limitSeconds, position)) return;
    if (request !== playRequest) return;
    queueIndex = index; resumeIndex = index; resumePosition = position; current = item.track; timedEnd = false; stopped = false; $('#queue-resume').hidden = true; void persist();
    $('#playing-title').textContent = current.title; $('#playing-artist').textContent = [current.artist, current.singer, current.year].filter(Boolean).join(' · ') || (current.source === 'youtube' ? 'YouTube video' : 'Local recording');
    $('#playing-group').textContent = item.groupName || 'LIBRARY TRACK'; $('#preview-status').hidden = true;
    renderTimeline(item, position);
    renderQueue(); refreshGroupSummaries(); markStep('play'); notify(`Playing ${current.title}`);
  } catch (error) {
    if (request === playRequest) {
      player.stop(); current = structuredClone(item.track); player.track = structuredClone(item.track);
      queueIndex = index; resumeIndex = index; resumePosition = position; stopped = true; timedEnd = false; player.seek(position);
      $('#playing-title').textContent = current.title; $('#playing-artist').textContent = [current.artist, current.singer, current.year].filter(Boolean).join(' · ');
      $('#playing-group').textContent = item.groupName || 'LIBRARY TRACK'; renderTimeline(item, position);
      renderQueue(); void persist();
      $('#playback-recovery').hidden = false; $('#playback-recovery-message').textContent = t(playbackMessage(error));
      $('#playback-relink').hidden = item.track.source !== 'local';
      notify(playbackMessage(error), true);
    }
  }
  finally { if (request === playRequest) { transitioning = false; $('#playback-loading').hidden = true; updateTransport(); } }
}
async function playRecording(track) {
  queue = [{ track: structuredClone(track) }]; queueIndex = -1; queueGroupId = null; loadedSignature = null;
  renderGroups(); renderQueue(); await playIndex(0);
}
async function next() { if (queueIndex + 1 < queue.length) await playIndex(queueIndex + 1); else { notify('End of play queue.'); } }
function addToGroup(id, groupId = selected) {
  const group = state.groups.find(g => g.id === groupId);
  if (!group) { showView('set'); notify('Create or select a tanda or cortina first.'); return; }
  if (!state.tracks.some(t => t.id === id)) return;
  normalizeProgram(state); rememberSetEdit();
  if (group.kind === 'cortina') { group.trackIds = [id]; group.occurrenceIds = [uid()]; }
  else { group.trackIds.push(id); group.occurrenceIds.push(uid()); }
  selected = group.id; void persist(); renderGroups(); markStep('build'); notify(`${t('Added to')} ${t(group.kind === 'cortina' ? 'Cortina' : 'Tanda')}: ${group.name}`);
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
for (const id of ['search', 'style-filter', 'source-filter', 'collection-filter']) $(`#${id}`).oninput = renderLibrary;
$('#clear-filters').onclick = () => {
  for (const id of ['search', 'style-filter', 'source-filter', 'collection-filter']) $(`#${id}`).value = '';
  renderLibrary(); $('#search').focus({ preventScroll: true });
};
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
      case 'play': await playRecording(track); break;
      case 'play-next': await choosePlayNext(track); break;
      case 'collection': addRecordingToCollection(track); break;
      case 'locate': await locateRecording(track); break;
      case 'copy': await keepCopy(track); break;
      case 'preview': await player.previewTrack(track, await readyFile(track, true)); $('#preview-status span').textContent = `Preview: ${track.title} · same output`; $('#preview-status').hidden = false; markStep('preview'); showView('deck'); break;
      case 'analyze': await runAnalysis([track]); break;
      case 'edit': editTrack(track); break;
      case 'add': if (state.groups.some(group => group.id === selected)) addToGroup(track.id); else chooseTandaDestination(track); break;
      case 'relink': reconnectMode = false; relinkId = track.id; $('#relink-input').click(); break;
      case 'delete':
        if (!confirm(t(`Remove “${track.title}” from the library and every group? Your original file will be kept.`))) return;
        if (busy) { notify('Wait for the current import or analysis to finish.'); return; }
        if (player.previewId === track.id) { player.preview.pause(); player.previewId = null; $('#preview-status').hidden = true; }
        const playingItem = queue[queueIndex], restoredItem = queue[resumeIndex];
        const removingCurrent = current?.id === track.id || player.track?.id === track.id;
        const priorIndex = queueIndex >= 0 ? queueIndex : resumeIndex;
        queue = queue.filter(item => item.track.id !== track.id);
        loadedSignature = null;
        if (removingCurrent) {
          ++playRequest; player.stop(); player.track = null; current = null; transitioning = false;
          queueIndex = -1; resumeIndex = Math.min(Math.max(0, priorIndex), Math.max(0, queue.length - 1));
          resumePosition = queue[resumeIndex]?.startSeconds || 0;
          $('#playing-title').textContent = 'No recording loaded'; $('#playing-artist').textContent = 'Play a track or load your prepared set.';
          $('#playing-group').textContent = 'READY WHEN YOU ARE'; $('#position').textContent = '0:00 / 0:00'; $('#seek').value = 0;
          $('#youtube-wrap').hidden = true; $('#preview-status').hidden = true; $('#queue-resume').hidden = !queue.length;
        } else { queueIndex = queue.indexOf(playingItem); const restoredIndex = queue.indexOf(restoredItem); resumeIndex = queueIndex >= 0 ? queueIndex : restoredIndex >= 0 ? restoredIndex : Math.min(resumeIndex, Math.max(0, queue.length - 1)); if (queueIndex < 0 && restoredIndex < 0) resumePosition = queue[resumeIndex]?.startSeconds || 0; }
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
      if (reconnectMode) { await reconnectSame(track, file); render(); notify('File reconnected. Cues and analysis retained.'); return; }
      await persistence;
      if (!confirm(t('Replace recording and reset analysis? Check all cortina cues after replacement.'))) return;
      const updated = { ...track, source: 'local', contentHash: await contentHash(file), fileName: file.name, fileSize: file.size, lastModified: file.lastModified };
      delete updated.videoId;
      for (const field of ['duration', 'bpm', 'rmsDb', 'peakDb', 'gainDb']) updated[field] = null;
      const snapshot = workspaceSnapshot(state.tracks.map(item => item.id === track.id ? updated : item));
      const replacement = persistence.then(async () => {
        revision = await replaceRecording(track.id, file, snapshot, revision);
        return true;
      });
      persistence = replacement.catch(() => false);
      await replacement;
      sourceStatuses.set(track.id, 'Stored copy');
      Object.assign(track, updated); delete track.videoId;
      player.revoke(track.id); files.set(track.id, file);
      for (const item of queue) if (item.track.id === track.id) item.track = structuredClone(track);
      sourceChanged(track);
      render(); notify('File relinked. Analyze it to refresh duration, BPM, and level.');
    } catch (error) { notify(error.message, true); }
    finally { event.target.value = ''; reconnectMode = false; }
  }
  event.target.value = '';
};
function sourceChanged(track) {
  if (current?.id !== track.id && player.track?.id !== track.id) return;
  ++playRequest; player.stop(); player.track = structuredClone(track); current = queue[queueIndex]?.track || structuredClone(track);
  stopped = true; transitioning = false; timedEnd = false; resumePosition = queue[queueIndex]?.startSeconds || 0; player.seek(resumePosition); checkpointPlayback(true);
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
function addGroup(kind) {
  normalizeProgram(state);
  const parent = kind === 'cortina' ? state.groups.find(g => g.id === selected && g.kind === 'tanda') : null;
  const existing = parent && state.groups.find(g => g.parentId === parent.id);
  if (existing) { selected = existing.id; renderGroups(); void persist(); notify('This tanda already has a cortina. Select it to edit.'); return; }
  const group = { id: uid(), kind, name: `${kind === 'tanda' ? 'Tanda' : 'Cortina'} ${state.groups.filter(g => g.kind === kind).length + 1}`, trackIds: [], ...(kind === 'cortina' ? { fullLength: true, holdAfter: true, parentId: parent?.id || '' } : { collapsed: phoneLayout.matches }) };
  rememberSetEdit(); insertGroupAfterSelection(state, group, selected); selected = group.id;
  void persist(); renderGroups(); revealSelectedGroup();
}
$('#add-tanda').onclick = () => addGroup('tanda'); $('#add-cortina').onclick = () => addGroup('cortina');
$('#groups').onclick = event => {
  const button = event.target.closest('[data-group-action]'); if (!button) return;
  const group = state.groups.find(g => g.id === button.dataset.id); if (!group) return;
  const i = state.groups.indexOf(group), j = Number(button.dataset.index);
  const action = button.dataset.groupAction;
  let newName;
  if (action === 'rename') { newName = prompt(t('Group name'), group.name); if (!newName?.trim() || newName.trim() === group.name) return; }
  if (action === 'delete' && !confirm(t(`Remove “${group.name}” from your set? Recordings stay in the library.`))) return;
  if (action === 'cortina') { selected = group.id; $('#add-cortina').click(); const attached = state.groups.find(g => g.parentId === group.id); if (attached) { group.collapsed = false; attached.collapsed = false; selected = attached.id; renderGroups(); void persist(); } revealSelectedGroup(); return; }
  if (action === 'collapse') { group.collapsed = !group.collapsed; const cortina = state.groups.find(g => g.parentId === group.id); if (cortina) cortina.collapsed = group.collapsed; void persist(); renderGroups(); return; }
  if (action === 'notes') { const notes = prompt(t('Tanda notes'), group.notes || ''); if (notes !== null) { group.notes = notes; void persist(); renderGroups(); } return; }
  if (action === 'play-recording') {
    const track = state.tracks.find(track => track.id === group.trackIds[j]);
    if (track) void playRecording(track);
    return;
  }
  if (action === 'play-tanda') {
    const clips = flattenSet([group], state.tracks).map(item => ({ ...item, track: structuredClone(item.track) }));
    if (!clips.length) return;
    selected = group.id; queue = clips; queueIndex = -1; queueGroupId = group.id; loadedSignature = playbackSignature();
    renderGroups(); renderQueue(); showView('deck'); void playIndex(0);
    return;
  }
  if (action === 'cue-play') {
    showView('deck');
    const clips = flattenSet([group], state.tracks).map(item => ({ ...item, track: structuredClone(item.track) }));
    if (!clips.length) return;
    const index = queue.findIndex((item, index) => item.groupId === group.id && clips.every((clip, offset) => {
      const queued = queue[index + offset];
      return queued?.groupId === clip.groupId && queued.track.id === clip.track.id && queued.occurrenceId === clip.occurrenceId && (queued.startSeconds || 0) === (clip.startSeconds || 0) && queued.limitSeconds === clip.limitSeconds && Boolean(queued.holdAfter) === Boolean(clip.holdAfter);
    }) && queue[index + clips.length]?.groupId !== group.id);
    if (index >= 0) void playIndex(index);
    else { const start = queue.length; queue.push(...clips); queueGroupId = null; loadedSignature = null; renderQueue(); void playIndex(start); }
    return;
  }
  if (action === 'cue-position' && (!current || !group.trackIds.includes(current.id))) return;
  normalizeProgram(state);
  if (action !== 'select') rememberSetEdit();
  switch (button.dataset.groupAction) {
    case 'select': selected = group.id; break;
    case 'cue-position': {
      const position = Math.floor(current.source === 'youtube' ? player.youtube?.getCurrentTime() || 0 : player.audio.currentTime);
      const duration = current.source === 'youtube' ? player.youtube?.getDuration() : player.audio.duration;
      if (Number.isFinite(duration) && duration > 0 && position >= duration) { notify('The start must be before the recording ends. Choose an earlier cue.', true); return; }
      group.startSeconds = position;
      if (!group.fullLength && Number.isFinite(duration) && duration > 0) group.limitSeconds = Math.min(group.limitSeconds || 20, Math.ceil(duration) - position);
      break;
    }
    case 'rename': group.name = newName.trim(); break;
    case 'delete': {
      const selectedRemoved = selected === group.id || state.groups.some(g => g.id === selected && g.parentId === group.id);
      state.groups = state.groups.filter(g => g.id !== group.id && g.parentId !== group.id);
      if (selectedRemoved) selected = state.groups[Math.min(i, state.groups.length - 1)]?.id || null;
      break;
    }
    case 'up': moveTanda(group, -1); break;
    case 'down': moveTanda(group, 1); break;
    case 'remove': group.trackIds.splice(j, 1); group.occurrenceIds.splice(j, 1); break;
    case 'track-up': if (j > 0) { [group.trackIds[j - 1], group.trackIds[j]] = [group.trackIds[j], group.trackIds[j - 1]]; [group.occurrenceIds[j - 1], group.occurrenceIds[j]] = [group.occurrenceIds[j], group.occurrenceIds[j - 1]]; } break;
    case 'track-down': if (j < group.trackIds.length - 1) { [group.trackIds[j + 1], group.trackIds[j]] = [group.trackIds[j], group.trackIds[j + 1]]; [group.occurrenceIds[j + 1], group.occurrenceIds[j]] = [group.occurrenceIds[j], group.occurrenceIds[j + 1]]; } break;
  }
  void persist(); renderGroups();
};
$('#groups').onchange = event => {
  if (event.target.dataset.cortinaFull) { const group = state.groups.find(g => g.id === event.target.dataset.cortinaFull); rememberSetEdit(); group.fullLength = event.target.checked; if (group.fullLength) delete group.limitSeconds; else group.limitSeconds = 20; void persist(); renderGroups(); return; }
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
  if (start === priorStart && (group.fullLength || end === priorEnd)) return;
  rememberSetEdit(); group.startSeconds = start; if (!group.fullLength) group.limitSeconds = end - start;
  void persist(); refreshGroupSummaries();
};
$('#groups').ondragover = event => { if (event.target.closest('[data-group]')) event.preventDefault(); };
$('#groups').ondrop = event => { const group = event.target.closest('[data-group]'); if (group) { event.preventDefault(); addToGroup(event.dataTransfer.getData('text/plain'), group.dataset.group); } };
$('#refresh-queue').onclick = async () => {
  const prepared = flattenSet(playbackGroups(), state.tracks).map(item => ({ ...item, track: structuredClone(item.track) }));
  const active = queue[queueIndex]; if (!active || transitioning) return;
  const occurrence = queue.slice(0, queueIndex + 1).filter(item => item.groupId === active.groupId && item.track.id === active.track.id).length;
  const matches = prepared.map((item, index) => ({ item, index })).filter(({ item }) => item.groupId === active.groupId && item.track.id === active.track.id);
  const exact = prepared.findIndex(item => item.occurrenceId && item.occurrenceId === active.occurrenceId);
  const match = active.occurrenceId ? (exact >= 0 ? { index: exact } : null) : matches[occurrence - 1];
  if (!match) { notify('The current recording is no longer in the edited set. Finish it before loading another set.', true); return; }
  const pending = new Map(queue.filter(item => item.pendingAddition).map(item => [item.occurrenceId, item]));
  queue = [...queue.slice(0, queueIndex + 1), ...prepared.slice(match.index + 1).map(item => {
    const addition = pending.get(item.occurrenceId);
    return addition ? { ...item, addedAfter: addition.addedAfter, pendingAddition: true } : item;
  })];
  for (const item of queue) {
    const group = state.groups.find(group => group.id === item.groupId);
    if (group) item.groupName = group.name;
  }
  $('#playing-group').textContent = queue[queueIndex]?.groupName || 'LIBRARY TRACK';
  loadedSignature = playbackSignature(); render(); await persist(); notify('Upcoming queue updated. Current recording keeps playing.');
};
$('#start-set').onclick = async () => { normalizeProgram(state);
  if (transitioning) return;
  const unavailable = [];
  for (const track of state.tracks.filter(t => t.source === 'local' && state.groups.some(group => group.trackIds.includes(t.id)))) if (!await readyFile(track)) unavailable.push(track.title);
  renderLibrary();
  if (unavailable.length) { notify(`${t('Files need attention before playback')}: ${unavailable.join(', ')}`, true); showView('library'); return; } showView('deck'); queueGroupId = null; loadedSignature = playbackSignature(); queue = flattenSet(state.groups, state.tracks).map(item => ({ ...item, track: structuredClone(item.track) })); queueIndex = -1; renderQueue(); void playIndex(0); };
$('#deck-start-set').onclick = () => $('#start-set').click();
$('#queue').onclick = event => { const item = event.target.closest('[data-queue-index]'); if (item) void playIndex(Number(item.dataset.queueIndex)); };
$('#play-pause').onclick = async () => { try { if (!player.track && queue.length) await playIndex(Math.min(resumeIndex, queue.length - 1), resumePosition); else if (timedEnd || stopped) await playIndex(queueIndex >= 0 ? queueIndex : Math.min(resumeIndex, queue.length - 1)); else await player.toggle(); updateTransport(); checkpointPlayback(true); } catch (error) { notify(playbackMessage(error), true); } };
$('#next-tanda').onclick = async () => { if (transitioning) return; const nextIndex = queue.findIndex((item, index) => index > queueIndex && item.kind === 'tanda'); if (nextIndex >= 0) await playIndex(nextIndex); else { transitioning = true; updateTransport(); await player.fadeOut(Number($('#fade').value)); $('#stop').click(); } };
$('#next').onclick = next; $('#previous').onclick = () => playIndex(queueIndex - 1);
$('#stop').onclick = () => {
  ++playRequest; player.stop(); $('#playback-loading').hidden = true; $('#playback-stall').hidden = true; player.seek(queue[queueIndex]?.startSeconds || 0); stopped = true; transitioning = false;
  resumePosition = queue[queueIndex]?.startSeconds || 0; renderTimeline(queue[queueIndex], resumePosition); checkpointPlayback(true);
  $('#seek').value = 0; $('#preview-status').hidden = true; updateTransport(); notify('Playback stopped.');
};
$('#seek').oninput = () => { const available = (current?.source === 'youtube' ? player.youtube?.getDuration() : player.audio.duration) - (queue[queueIndex]?.startSeconds || 0); const duration = Math.min(queue[queueIndex]?.limitSeconds || Infinity, available); if (Number.isFinite(duration) && player.track) { const position = (queue[queueIndex]?.startSeconds || 0) + Number($('#seek').value) / 100 * duration; player.seek(position); resumePosition = position; stopped = false; timedEnd = false; renderTimeline(queue[queueIndex], position, available + (queue[queueIndex]?.startSeconds || 0)); checkpointPlayback(true); } };
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
    resumeIndex = 0; resumePosition = 0; loadedSignature = null; queueGroupId = null; undoGroups = null; timedEnd = false; stopped = false; transitioning = false;
    $('#undo-bar').hidden = true; $('#queue-resume').hidden = true; $('#preview-status').hidden = true; $('#youtube-error').hidden = true;
    $('#position').textContent = '0:00 / 0:00'; $('#seek').value = 0;
    $('#playing-title').textContent = 'No recording loaded'; $('#playing-artist').textContent = 'Play a track or load your prepared set.'; $('#playing-group').textContent = 'READY WHEN YOU ARE'; $('#youtube-wrap').hidden = true;
    const oldIds = state.tracks.filter(t => t.source === 'local').map(t => t.id);
    state = imported; activeCollection = null; collectingInto = null; choosingForGroup = false; candidateSelections.clear(); viewPositions.clear(); sourceStatuses.clear(); normalizeProgram(state); selected = state.groups.some(g => g.id === selected) ? selected : state.groups[0]?.id || null;
    if (!await persist()) { render(); return; }
    for (const id of oldIds) if (!state.tracks.some(t => t.id === id && t.source === 'local')) { await deleteFile(id); player.revoke(id); }
    files.clear();
    for (const track of state.tracks.filter(t => t.source === 'local')) await readyFile(track);
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
    await player.previewTrack(track, await readyFile(track, true));
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
  for (const group of realGroups()) if (!state.groups.some(g => g.id === group.id)) state.groups.push({ ...group, collapsed: phoneLayout.matches });
  state.collections ||= [];
  for (const collection of realCollections()) if (!state.collections.some(item => item.id === collection.id)) state.collections.push(collection);
  normalizeProgram(state);
  selected = 'real-group-tango'; const saved = await persist(); render(); markStep('load'); markStep('youtube');
  if (saved) notify('Real recordings ready: 6 DJ tandas in Tango / Tango / Vals / Tango / Tango / Milonga order, with 20-second cortinas. Press Play milonga set. Internet is required.');
  return true;
}
$('#load-real-samples').onclick = async () => { if (await loadRealSamples()) $('#examples-dialog').close(); };
$('#real-sample-play').onclick = async () => {
  if (!await loadRealSamples()) return; closePanels(); queueGroupId = null; loadedSignature = null;
  queue = flattenSet(state.groups.filter(g => g.samplePack === REAL_SAMPLE_PACK), state.tracks).map(item => ({ ...item, track: structuredClone(item.track) }));
  queueIndex = -1; renderQueue(); showView('deck'); await playIndex(0);
};
$('#real-guide-play').onclick = () => $('#real-sample-play').click();
$('#real-sample-edit').onclick = async () => { closePanels(); if (await loadRealSamples()) editTrack(state.tracks.find(t => t.id === 'real-tango-1')); };
$('#real-sample-select').onclick = async () => { if (await loadRealSamples()) { closePanels(); markStep('build'); showView('set'); } };
renderProgress();

async function readyFile(track, requestPermission = false) {
  if (track.source !== 'local') return null;
  const result = await resolveSource(track, requestPermission);
  sourceStatuses.set(track.id, result.status);
  if (result.file) files.set(track.id, result.file); else files.delete(track.id);
  return result.file;
}
async function checkSources() {
  if (busy) return;
  busy = true;
  try {
    for (const track of state.tracks.filter(t => t.source === 'local')) {
      await readyFile(track);
      if (!track.contentHash && files.has(track.id)) track.contentHash = await contentHash(files.get(track.id));
    }
    await persist(); render(); await storageDetails();
    notify('File check complete. Locate missing files or grant access before playback.');
  } finally { busy = false; }
}
$('#connect-files').hidden = !canConnectFiles();
$('#reconnect-folder').hidden = !canConnectFolder();
$('#check-files').onclick = () => checkSources().catch(error => notify(error.message, true));
$('#connect-files').onclick = async () => {
  if (busy || temporaryWorkspace) { notify('Finish saving or importing before connecting files.', true); return; }
  try {
    const handles = await window.showOpenFilePicker({ multiple: true, types: [{ description: 'Audio', accept: { 'audio/*': ['.mp3', '.wav', '.flac', '.m4a', '.ogg', '.aac', '.opus', '.aiff'] } }] });
    await importFiles(await Promise.all(handles.map(handle => handle.getFile())), handles);
  } catch (error) { if (error.name !== 'AbortError') notify(error.message, true); }
};
async function reconnectSame(track, file, handle) {
  await attachIdentical(track, file, handle);
  const updated = { ...track, fileName: file.name || track.fileName, fileSize: file.size, lastModified: file.lastModified || track.lastModified };
  await persistence;
  const snapshot = workspaceSnapshot(state.tracks.map(item => item.id === track.id ? updated : item));
  const operation = persistence.then(() => reconnectRecording(track.id, file, handle, snapshot, revision));
  persistence = operation.then(saved => { revision = saved; return true; }).catch(() => false);
  revision = await operation;
  Object.assign(track, updated); files.set(track.id, file); sourceStatuses.set(track.id, handle ? 'Ready' : 'Stored copy');
  $('#save-status').textContent = t('Saved in this browser');
}
async function locateRecording(track) {
  if (busy || temporaryWorkspace) throw new Error('Finish saving or importing before reconnecting files.');
  if (canConnectFiles()) {
    const [handle] = await window.showOpenFilePicker({ multiple: false });
    const file = await handle.getFile();
    await reconnectSame(track, file, handle); render(); notify('File reconnected. Cues and analysis retained.');
  } else { reconnectMode = true; relinkId = track.id; $('#relink-input').click(); }
}
async function keepCopy(track) {
  if (busy || temporaryWorkspace) throw new Error('Finish saving or importing before copying files.');
  const file = await readyFile(track, true); if (!file) throw new Error('Locate the original file or grant access first.');
  if (!confirm(t(`Keep an app copy (${Math.ceil(file.size / 1024 / 1024)} MB)?`))) return;
  await reconnectSame(track, file); render(); await storageDetails();
}
$('#reconnect-folder').onclick = async () => {
  if (busy || temporaryWorkspace) return;
  try {
    const directory = await window.showDirectoryPicker({ mode: 'read' }); busy = true;
    const candidates = new Map();
    for await (const candidate of folderFiles(directory)) {
      $('#import-progress').hidden = false; $('#import-progress').textContent = `${t('Checking')}: ${candidate.file.name}`;
      const hash = await contentHash(candidate.file);
      if (!candidates.has(hash)) candidates.set(hash, []);
      candidates.get(hash).push(candidate);
    }
    $('#repair-results').replaceChildren();
    for (const track of state.tracks.filter(t => t.source === 'local')) {
      const source = await resolveSource(track);
      if (source.file) continue;
      const matches = candidates.get(track.contentHash) || [];
      const row = document.createElement('div'); row.className = 'repair-row';
      const label = document.createElement('strong'); label.textContent = `${track.title} · ${matches.length ? t('Identical matches') : t('No verified match')}`; row.append(label);
      for (const [i, candidate] of matches.entries()) {
        const button = document.createElement('button'); button.textContent = `${t('Connect')} ${candidate.file.name} (${i + 1})`;
        button.onclick = async () => {
          button.disabled = true;
          try { await reconnectSame(track, candidate.file, candidate.handle); render(); row.replaceChildren(label); label.textContent = `${track.title} · ${t('Ready')}`; }
          catch (error) { button.disabled = false; notify(error.message, true); }
        }; row.append(button);
      }
      $('#repair-results').append(row);
    }
    if (!$('#repair-results').children.length) $('#repair-results').textContent = t('All files are available.');
    $('#repair-dialog').showModal();
  } catch (error) { if (error.name !== 'AbortError') notify(error.message, true); }
  finally { busy = false; $('#import-progress').hidden = true; }
};
function configureTarget(heading, label, explanation, track) {
  $('#target-heading').textContent = t(heading);
  $('#target-label').textContent = t(label);
  $('#next-target').setAttribute('aria-label', t(label));
  $('#target-explanation').textContent = t(explanation);
  $('#target-recording').textContent = track.title;
}
function syncDestination() {
  const collection = state.collections?.find(c => c.id === collectingInto);
  const chosen = state.groups.find(g => g.id === selected);
  $('#add-target').innerHTML = `<option value="">${t('Choose a tanda')}</option>` + state.groups.map(group => `<option value="${esc(group.id)}" data-preserve>${t(group.kind === 'cortina' ? 'Cortina' : 'Tanda')}: ${esc(group.name)}</option>`).join('');
  $('#add-target').value = chosen?.id || '';
  $('#library-target').textContent = collection ? `${t('Collecting candidates in')}: ${collection.name}` : t('Collect in set saves candidates. Add to tanda changes the selected tanda.');
  $('#finish-adding').hidden = !collection && !(choosingForGroup && chosen);
  $('#finish-adding').textContent = t(collection ? 'Back to set' : 'Back to tanda');
  for (const button of document.querySelectorAll('#tracks [data-action=add]')) button.textContent = t(chosen?.kind === 'cortina' ? 'Use as cortina' : 'Add to tanda');
}
$('#add-target').onchange = () => { selected = $('#add-target').value || null; void persist(); renderGroups(); renderLibrary(); };
$('#finish-adding').onclick = () => {
  if (collectingInto) { activeCollection = collectingInto; collectingInto = null; renderCollections(); renderLibrary(); showView('collections'); }
  else {
    choosingForGroup = false;
    const group = state.groups.find(g => g.id === selected);
    if (group) { group.collapsed = false; void persist(); }
    renderGroups(); showView('set'); revealSelectedGroup();
  }
};
function collectRecording(track, collectionId) {
  const collection = state.collections.find(c => c.id === collectionId); if (!collection) return;
  const exists = collection.trackIds.includes(track.id);
  if (!exists) collection.trackIds.push(track.id);
  void persist(); renderCollections(); syncDestination();
  notify(`${t(exists ? 'Already in candidate set' : 'Collected in candidate set')}: ${collection.name}`);
}
function chooseTandaDestination(track) {
  if (!state.groups.length) { showView('set'); notify('Create or select a tanda or cortina first.'); return; }
  configureTarget('Choose target tanda', 'Target tanda', 'Add this recording to the chosen tanda. The live queue changes only when you update it.', track);
  $('#next-target').innerHTML = state.groups.map(group => `<option value="${esc(group.id)}" data-preserve>${t(group.kind === 'cortina' ? 'Cortina' : 'Tanda')}: ${esc(group.name)}</option>`).join('');
  $('#confirm-next').textContent = t('Add to tanda');
  $('#confirm-next').onclick = () => { addToGroup(track.id, $('#next-target').value); $('#target-dialog').close(); };
  $('#target-dialog').showModal();
}
const candidateSelections = new Map();
function renderCollections() {
  state.collections ||= [];
  const detail = $('#collection-detail');
  if (detail.dataset.selectionCollection) candidateSelections.set(detail.dataset.selectionCollection, new Set([...detail.querySelectorAll('[data-candidate]:checked')].map(input => input.dataset.candidate)));
  const previousFilter = $('#collection-filter').value;
  $('#collection-filter').innerHTML = `<option value="">${t('All sets')}</option>` + state.collections.map(c => `<option value="${esc(c.id)}" data-preserve>${esc(c.name)}</option>`).join('');
  $('#collection-filter').value = state.collections.some(c => c.id === previousFilter) ? previousFilter : '';
  const collection = state.collections.find(c => c.id === activeCollection);
  detail.dataset.selectionCollection = collection?.id || '';
  $('#collection-list').innerHTML = state.collections.map(c => `<div class="collection-row"><button data-collection="${esc(c.id)}" ${c.id === activeCollection ? 'aria-current="true"' : ''}><strong data-preserve>${esc(c.name)}</strong><span class="collection-count">${c.trackIds.length} ${t('recordings')}</span></button><button data-collection-delete="${esc(c.id)}">${t('Delete')}</button></div>`).join('') || `<p class="hint">${t('Create a set to collect candidate recordings.')}</p>`;
  $('#collection-detail').innerHTML = collection ? `<div class="builder-actions"><button id="collection-browse">${t('Add recordings')}</button><button id="collection-tanda">${t('Create tanda from selected recordings')}</button><button id="collection-rename">${t('Rename')}</button></div>${collection.trackIds.map((id, index) => { const track = state.tracks.find(t => t.id === id); return `<div class="collection-recording"><label><input type="checkbox" data-candidate="${esc(id)}"><span data-preserve>${esc(track?.title)}</span></label><div class="candidate-actions"><button data-candidate-play="${esc(id)}" aria-label="${esc(`${t('Play only this recording')}: ${track?.title || 'Missing track'}`)}" title="${t('Play only this recording')}" ${track ? '' : 'disabled'}>▶ ${t('Play')}</button><button data-candidate-remove="${index}">${t('Remove')}</button></div></div>`; }).join('')}` : '';
  if (collection) {
    for (const input of detail.querySelectorAll('[data-candidate]')) input.checked = candidateSelections.get(collection.id)?.has(input.dataset.candidate) || false;
    $('#collection-browse').onclick = () => { collectingInto = collection.id; choosingForGroup = false; activeCollection = null; $('#collection-filter').value = ''; renderLibrary(); showView('library'); };
    $('#collection-tanda').onclick = () => {
      const ids = [...$('#collection-detail').querySelectorAll('[data-candidate]:checked')].map(el => el.dataset.candidate);
      if (!ids.length) { notify('Choose recordings first.'); return; }
      rememberSetEdit(); const group = { id: uid(), kind: 'tanda', name: collection.name, trackIds: ids, collapsed: phoneLayout.matches };
      insertGroupAfterSelection(state, group, selected); selected = group.id; normalizeProgram(state); void persist(); render(); showView('set'); revealSelectedGroup();
    };
    $('#collection-rename').onclick = () => { const name = prompt(t('Set name'), collection.name); if (name?.trim()) { collection.name = name.trim(); void persist(); renderCollections(); } };
  }
}
$('#new-collection').onclick = () => { const name = prompt(t('Set name')); if (!name?.trim()) return; state.collections ||= []; const collection = { id: uid(), name: name.trim(), trackIds: [] }; state.collections.push(collection); activeCollection = collection.id; void persist(); renderCollections(); };
$('#collection-list').onclick = event => {
  const open = event.target.closest('[data-collection]'), remove = event.target.closest('[data-collection-delete]');
  if (open) { activeCollection = open.dataset.collection; renderCollections(); renderLibrary(); }
  if (remove && confirm(t('Delete this set? Recordings and tandas are kept.'))) { state.collections = state.collections.filter(c => c.id !== remove.dataset.collectionDelete); activeCollection = null; if (collectingInto === remove.dataset.collectionDelete) collectingInto = null; void persist(); renderCollections(); renderLibrary(); }
};
$('#collection-detail').onclick = event => {
  const play = event.target.closest('[data-candidate-play]');
  if (play) { const track = state.tracks.find(track => track.id === play.dataset.candidatePlay); if (track) void playRecording(track); return; }
  const remove = event.target.closest('[data-candidate-remove]');
  if (remove) { state.collections.find(c => c.id === activeCollection).trackIds.splice(Number(remove.dataset.candidateRemove), 1); void persist(); renderCollections(); }
};
function addRecordingToCollection(track) {
  if (!state.collections?.length) { notify('Create a set first.'); showView('collections'); return; }
  if (collectingInto && state.collections.some(c => c.id === collectingInto)) { collectRecording(track, collectingInto); return; }
  const dialog = $('#target-dialog'); configureTarget('Choose candidate set', 'Candidate set', 'Save this recording as a candidate. This does not change any tanda or playback order.', track); $('#next-target').innerHTML = state.collections.map(c => `<option value="${esc(c.id)}" data-preserve>${esc(c.name)}</option>`).join('');
  $('#confirm-next').textContent = t('Collect in set');
  $('#confirm-next').onclick = () => { collectRecording(track, $('#next-target').value); dialog.close(); };
  dialog.showModal();
}
function renderPresets() {
  $('#presets').innerHTML = (state.presets || []).map(preset => `<div class="preset-row"><strong data-preserve>${esc(preset.name)}</strong><button data-preset="${esc(preset.id)}">${t('Add tanda to playback')}</button><button data-preset-delete="${esc(preset.id)}">${t('Delete')}</button></div>`).join('');
}
$('#save-preset').onclick = () => {
  const group = state.groups.find(g => g.id === selected && g.kind === 'tanda'); if (!group) { notify('Select a tanda first.'); return; }
  const name = prompt(t('Tanda name'), group.name); if (!name?.trim()) return;
  state.presets ||= [];
  const cortina = state.groups.find(g => g.parentId === group.id);
  state.presets.push({ id: uid(), name: name.trim(), notes: group.notes || '', trackIds: [...group.trackIds], ...(cortina ? { cortina: structuredClone(cortina) } : {}) });
  void persist(); renderPresets(); notify('Reusable tanda saved. Playback edits keep this original unchanged.');
};
$('#presets').onclick = event => {
  const add = event.target.closest('[data-preset]'), remove = event.target.closest('[data-preset-delete]');
  if (remove) { state.presets = state.presets.filter(p => p.id !== remove.dataset.presetDelete); void persist(); renderPresets(); return; }
  if (!add) return;
  const preset = state.presets.find(p => p.id === add.dataset.preset);
  const group = { id: uid(), kind: 'tanda', name: preset.name, notes: preset.notes, trackIds: [...preset.trackIds], presetId: preset.id, collapsed: phoneLayout.matches };
  rememberSetEdit(); insertGroupAfterSelection(state, group, selected); selected = group.id;
  if (preset.cortina) insertGroupAfterSelection(state, { ...structuredClone(preset.cortina), id: uid(), parentId: group.id, occurrenceIds: undefined }, group.id);
  normalizeProgram(state); void persist(); renderGroups();
};
function moveTanda(group, direction) {
  if (group.parentId) return;
  const top = state.groups.filter(g => !g.parentId), position = top.indexOf(group), other = top[position + direction];
  if (!other) return;
  [top[position], top[position + direction]] = [top[position + direction], top[position]];
  state.groups = top.flatMap(g => [g, ...state.groups.filter(c => c.parentId === g.id)]);
}
let nextTrack = null;
async function choosePlayNext(track) {
  if (transitioning || addingNext || queueIndex < 0) { notify('Start a tanda before adding a recording to play next.'); return; }
  const active = queue[queueIndex];
  if (active.kind === 'tanda' && state.groups.some(g => g.id === active.groupId)) { await addNext(track, active.groupId); return; }
  nextTrack = track; configureTarget('Choose target tanda', 'Target tanda', 'Insert after the current recording. During a cortina, insert at the beginning of the next tanda.', track);
  const passed = new Set(queue.slice(0, queueIndex + 1).filter(item => item.kind === 'tanda').map(item => item.groupId));
  const groups = state.groups.filter(g => g.kind === 'tanda' && !passed.has(g.id));
  if (!groups.length) { const name = prompt(t('Tanda name')); if (!name?.trim()) return; const group = { id: uid(), kind: 'tanda', name: name.trim(), trackIds: [], collapsed: phoneLayout.matches }; state.groups.push(group); groups.push(group); normalizeProgram(state); await persist(); renderGroups(); }
  $('#next-target').innerHTML = groups.map(g => `<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('');
  if (active.kind === 'cortina') $('#next-target').value = queue.slice(queueIndex + 1).find(item => item.kind === 'tanda')?.groupId || groups[0].id;
  $('#confirm-next').textContent = t('Add to play next');
  $('#confirm-next').onclick = async () => { try { await addNext(nextTrack, $('#next-target').value); $('#target-dialog').close(); } catch (error) { notify(error.message, true); } };
  $('#target-dialog').showModal();
}
async function addNext(track, targetId) {
  if (transitioning || addingNext) return;
  addingNext = true; updateTransport();
  const token = playRequest, active = queue[queueIndex];
  try {
    if (track.source === 'local' && !await readyFile(track, true)) throw new Error('Locate the file or grant access before adding it.');
    if (token !== playRequest || active !== queue[queueIndex] || transitioning) throw new Error('Playback advanced. Choose the target tanda again.');
    if (loadedSignature && loadedSignature !== playbackSignature()) throw new Error('Update the upcoming queue before adding a recording.');
    const previousGroups = structuredClone(state.groups), previousQueue = [...queue], previousSignature = loadedSignature;
    if (!queue.slice(queueIndex + 1).some(item => item.groupId === targetId) && active.groupId !== targetId) {
      const group = state.groups.find(g => g.id === targetId); const cortina = state.groups.find(g => g.parentId === targetId);
      queue.push(...flattenSet([group, ...(cortina ? [cortina] : [])], state.tracks).map(item => ({ ...item, track: structuredClone(item.track) })));
    }
    insertNext(state, queue, queueIndex, track, targetId); loadedSignature = playbackSignature();
    if (!await persist()) { state.groups = previousGroups; queue = previousQueue; loadedSignature = previousSignature; renderGroups(); renderQueue(); throw new Error('Could not save the added recording. The queue is unchanged.'); } renderGroups(); renderQueue(); notify('Recording added to this tanda. Current recording keeps playing.');
  } finally { addingNext = false; updateTransport(); }
}
function renderPending() {
  $('#pending-additions').innerHTML = queue.map((item, index) => ({ item, index })).filter(({ item, index }) => item.pendingAddition && index > queueIndex).map(({ item, index }) => `<div class="pending-row"><span data-preserve>${esc(item.groupName)} · ${esc(item.track.title)}</span><button data-pending-up="${index}">↑</button><button data-pending-down="${index}">↓</button><button data-pending-remove="${index}">${t('Cancel addition')}</button></div>`).join('');
}
$('#pending-additions').onclick = event => {
  if (transitioning) return;
  const button = event.target.closest('button'); if (!button) return;
  const index = Number(button.dataset.pendingRemove ?? button.dataset.pendingUp ?? button.dataset.pendingDown), item = queue[index];
  if (!item?.pendingAddition || index <= queueIndex) return;
  const group = state.groups.find(g => g.id === item.groupId);
  const wasSynchronized = loadedSignature === playbackSignature();
  const position = group?.occurrenceIds.indexOf(item.occurrenceId) ?? -1;
  if (button.dataset.pendingRemove !== undefined) { queue.splice(index, 1); if (position >= 0) { group.trackIds.splice(position, 1); group.occurrenceIds.splice(position, 1); } }
  else {
    if (!group) return;
    const nextIndex = index + (button.dataset.pendingUp !== undefined ? -1 : 1), other = queue[nextIndex];
    if (nextIndex <= queueIndex || !other?.pendingAddition || other.groupId !== item.groupId) return;
    const otherPosition = group.occurrenceIds.indexOf(other.occurrenceId);
    if (position < 0 || otherPosition < 0) return;
    [queue[index], queue[nextIndex]] = [other, item];
    [group.trackIds[position], group.trackIds[otherPosition]] = [group.trackIds[otherPosition], group.trackIds[position]];
    [group.occurrenceIds[position], group.occurrenceIds[otherPosition]] = [group.occurrenceIds[otherPosition], group.occurrenceIds[position]];
  }
  if (wasSynchronized) loadedSignature = playbackSignature();
  void persist(); renderGroups(); renderQueue();
};

try {
  const saved = await loadState(); firstVisit = !saved; if (saved) { revision = saved.revision || 0; state = validateSet({ version: 1, ...saved }); selected = saved.selected; queueGroupId = typeof saved.queueGroupId === 'string' ? saved.queueGroupId : null; loadedSignature = typeof saved.loadedSignature === 'string' ? saved.loadedSignature : null; resumeIndex = Number.isInteger(saved.queueIndex) && saved.queueIndex >= 0 ? saved.queueIndex : 0; savedQueue = Array.isArray(saved.queue) ? saved.queue : []; resumePosition = Number.isFinite(saved.resumePosition) ? Math.max(0, saved.resumePosition) : 0; }
  const migrated = removeOldExamples(state); state = migrated.state; normalizeProgram(state);
  for (const group of state.groups) if (group.samplePack === REAL_SAMPLE_PACK && group.kind === 'cortina') {
    const defaults = realGroups().find(item => item.id === group.id);
    if (defaults && [defaults.name + ' · 20-second cortina', defaults.name + ' · Closing cortina'].includes(group.name)) group.name = defaults.name;
  }
  for (const track of migrated.removed) if (track.source === 'local') await deleteFile(track.id);
  queue = savedQueue.filter(item => state.tracks.some(t => t.id === item.trackId)).map(item => ({ ...item, kind: item.kind || state.groups.find(group => group.id === item.groupId)?.kind, track: structuredClone(state.tracks.find(t => t.id === item.trackId)) }));
  const occurrenceCounts = new Map();
  for (const item of queue) { const key = `${item.groupId}:${item.track.id}`; const index = occurrenceCounts.get(key) || 0; occurrenceCounts.set(key, index + 1); if (!item.occurrenceId) { const group = state.groups.find(g => g.id === item.groupId); const positions = group?.trackIds.map((id, index) => ({ id, index })).filter(entry => entry.id === item.track.id); item.occurrenceId = group?.occurrenceIds[positions?.[index]?.index]; } }
  if (saved) {
    const original = savedQueue[resumeIndex];
    resumeIndex = Math.max(0, queue.findIndex(item => original && item.track.id === original.trackId && item.occurrenceId === original.occurrenceId));
    let checkpoint;
    try { checkpoint = JSON.parse(localStorage.getItem('studio-playback-position') || 'null'); } catch {}
    const item = queue[resumeIndex];
    if (checkpoint?.revision === revision && checkpoint.index === resumeIndex && checkpoint.trackId === item?.track.id && checkpoint.occurrenceId === item?.occurrenceId && Number.isFinite(checkpoint.position)) resumePosition = checkpoint.ended ? (item.startSeconds || 0) : Math.max(0, checkpoint.position);
    if (!original || original.trackId !== item?.track.id) resumePosition = item?.startSeconds || 0;
    const start = item?.startSeconds || 0, end = Math.min(item?.track.duration > 0 ? item.track.duration : Infinity, item?.limitSeconds ? start + item.limitSeconds : Infinity);
    if (resumePosition < start || resumePosition >= end) resumePosition = start;
    queueIndex = -1; $('#queue-resume').hidden = !queue.length;
    if (item) {
      $('#playing-title').textContent = item.track.title; $('#playing-artist').textContent = item.track.artist || '';
      $('#playing-group').textContent = item.groupName || 'LIBRARY TRACK'; renderTimeline(item, resumePosition);
    }
  }
  for (const track of state.tracks.filter(t => t.source === 'local')) { await readyFile(track); if (!track.contentHash && files.has(track.id)) track.contentHash = await contentHash(files.get(track.id)); }
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
