import './style.css';
import { parseBlob } from 'music-metadata';
import { uid, youtubeId, flattenSet, removeTrack, validateSet } from './model.js';
import { saveState, loadState, saveFile, getFile, deleteFile } from './storage.js';
import { Player } from './player.js';
import { REAL_SAMPLE_PACK, realTracks, realGroups, removeOldExamples } from './samples.js';
import { guideMarkup } from './guide.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const time = seconds => Number.isFinite(seconds) ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : '—';
let state = { tracks: [], groups: [] }, selected = null, queue = [], queueIndex = -1, current = null, busy = false;
let playRequest = 0, timedEnd = false;
const files = new Map();
let persistence = Promise.resolve();
function persist() {
  const snapshot = structuredClone(state);
  persistence = persistence.then(() => saveState(snapshot)).catch(error => notify(`Could not save your library: ${error.message}`, true));
  return persistence;
}
function notify(message, error = false) {
  const el = document.querySelector('#notice'); el.textContent = message; el.classList.toggle('error', error);
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
  <main>
    <header><div><div class="eyebrow">PREPARE. LISTEN. CONNECT.</div><h1>Your next milonga starts here.</h1><p>Build the flow, one tanda at a time.</p></div><div class="header-actions"><button id="import-set">Import set</button><button id="export-set">Export set ↗</button></div></header>
    <div id="notice" role="status" aria-live="polite">Add your recordings or a YouTube video to get started.</div>
    ${guideMarkup}
    <div class="workspace">
      <section id="library" class="panel library">
        <div class="section-head"><div><div class="eyebrow">01 / COLLECTION</div><h2>Music library <span id="library-count">0</span></h2></div><button id="add-files" class="primary">+ Local files</button></div>
        <div id="drop-zone" tabindex="0" role="button" aria-label="Choose or drop local music files"><span class="drop-icon">↥</span><div><strong>Drop your music here</strong><span>MP3, WAV, FLAC, M4A and other browser-supported audio</span></div><span class="drop-link">Browse files</span></div>
        <form id="youtube-form" class="youtube-form"><span class="youtube-mark">▶</span><input name="url" type="url" aria-label="YouTube video URL" placeholder="Paste a YouTube video link" required><button type="submit">Add video</button></form>
        <div class="filters"><input id="search" type="search" aria-label="Search library" placeholder="Search title, orchestra, singer…"><select id="style-filter" aria-label="Filter dance style"><option value="">All styles</option><option>Tango</option><option>Vals</option><option>Milonga</option><option>Cortina</option></select><select id="source-filter" aria-label="Filter source"><option value="">All sources</option><option value="local">Local</option><option value="youtube">YouTube</option></select></div>
        <div class="table-scroll"><table><thead><tr><th>RECORDING</th><th>STYLE / YEAR</th><th>BPM</th><th>LENGTH</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody id="tracks"></tbody></table></div>
        <div id="empty-library" class="empty"><span>♫</span><h3>A home for your collection</h3><p>Bring in your recordings, organize the details,<br>and find the right music for each moment.</p></div>
        <div class="panel-foot"><span id="library-summary">0 recordings · 0:00 known duration</span><button id="analyze-all" class="text-button">Analyze local tracks</button></div>
      </section>
      <section id="set" class="panel set-panel">
        <div class="section-head"><div><div class="eyebrow">02 / THE FLOW</div><h2>Set builder</h2></div><span id="set-duration" class="badge">0:00</span></div>
        <div class="builder-actions"><button id="add-tanda">+ Tanda</button><button id="add-cortina">+ Cortina</button></div>
        <p class="hint">Select a group, then use + on a recording. Drag recordings into a group to add them.</p>
        <div id="groups"></div>
        <div id="empty-set" class="empty"><span>▤</span><h3>Give your set a shape</h3><p>Create a tanda, choose its recordings,<br>then add a cortina between groups.</p></div>
        <button id="start-set" class="primary wide">▶ Load & play set</button>
      </section>
    </div>
    <section id="deck" class="panel deck">
      <div class="deck-main"><div class="eyebrow">03 / LIVE DECK</div><div class="now-playing"><div class="record-art">♫</div><div><span id="playing-group" class="eyebrow">READY WHEN YOU ARE</span><h2 id="playing-title">No recording loaded</h2><p id="playing-artist">Play a track or load your prepared set.</p></div></div>
        <div class="transport"><button id="previous" aria-label="Previous track">⏮</button><button id="play-pause" class="play-button" aria-label="Play or pause">▶ / Ⅱ</button><button id="next" aria-label="Next track">⏭</button><button id="stop" aria-label="Stop playback">■</button><span id="position">0:00 / 0:00</span></div>
        <input id="seek" type="range" min="0" max="100" value="0" aria-label="Playback position">
        <div class="deck-settings"><label>Volume <input id="volume" type="range" min="0" max="100" value="85"></label><label>Fade <select id="fade"><option value="0">Off</option><option value="1">1 sec</option><option value="2" selected>2 sec</option><option value="4">4 sec</option></select></label><label><input id="normalize" type="checkbox"> Level local audio</label><label><input id="auto-next" type="checkbox" checked> Auto next</label></div>
        <p class="hint">Preview uses the same audio output as the live deck. Fades and level adjustment apply to local audio. YouTube uses its own player controls.</p>
        <div id="preview-status" class="preview-status" hidden><span></span><button id="stop-preview">Stop preview</button></div>
        <div id="youtube-wrap" hidden><div id="youtube-player"></div><p class="hint">If automatic playback is blocked, press play in the video.</p></div>
      </div>
      <div class="queue-panel"><div class="section-head"><h3>Play queue</h3><span id="queue-count" class="badge">0</span></div><div id="queue"><p class="hint">Load a set or play a library track.</p></div></div>
    </section>
    <footer>Made for the music between people.<span>Library & files saved locally · Export sets for backup</span></footer>
  </main>
  <input id="file-input" type="file" accept="audio/*,.mp3,.wav,.flac,.m4a,.ogg,.aiff,.aif,.opus" multiple hidden>
  <input id="set-input" type="file" accept="application/json,.json" hidden>
  <input id="relink-input" type="file" accept="audio/*,.mp3,.wav,.flac,.m4a,.ogg,.aiff,.aif,.opus" hidden>
  <dialog id="metadata-dialog"><form id="metadata-form"><div class="eyebrow">RECORDING DETAILS</div><h2>Edit metadata</h2><input name="id" type="hidden"><label>Title<input name="title" required maxlength="300"></label><label>Orchestra / artist<input name="artist" maxlength="300"></label><label>Singer<input name="singer" maxlength="300"></label><div class="form-row"><label>Year<input name="year" maxlength="30"></label><label>Style<select name="style" aria-label="Style"><option value="">Unspecified</option><option>Tango</option><option>Vals</option><option>Milonga</option><option>Cortina</option></select></label><label>BPM<input name="bpm" type="number" min="20" max="300" step="1"></label></div><p id="analysis-details" class="hint"></p><div class="dialog-actions"><button id="close-metadata" type="button">Cancel</button><button class="primary" type="submit">Save details</button></div></form></dialog>
`;
const $ = selector => document.querySelector(selector);
const player = new Player((position, duration) => {
  $('#position').textContent = `${time(position)} / ${time(duration)}`;
  $('#seek').value = Number.isFinite(duration) && duration > 0 ? position / duration * 100 : 0;
  const limit = queue[queueIndex]?.limitSeconds;
  if (limit && position >= limit && !timedEnd) { timedEnd = true; player.stop(); if ($('#auto-next').checked) void next(); else notify('Cortina finished. Press Next to continue.'); }
}, () => { if ($('#auto-next').checked) void next(); }, message => notify(message, true));

function renderLibrary() {
  const search = $('#search').value.toLowerCase(), style = $('#style-filter').value, source = $('#source-filter').value;
  const visible = state.tracks.filter(t => `${t.title} ${t.artist} ${t.singer} ${t.year}`.toLowerCase().includes(search) && (!style || t.style === style) && (!source || t.source === source));
  $('#tracks').innerHTML = visible.map(t => `<tr draggable="true" data-track="${esc(t.id)}"><td><div class="track-title">${esc(t.title)}</div><div class="track-detail"><span class="source-tag ${t.source}">${t.source === 'local' ? 'FILE' : 'YOUTUBE'}</span> ${esc(t.artist || 'Unknown orchestra')}${t.singer ? ` · ${esc(t.singer)}` : ''}${t.source === 'local' && !files.has(t.id) ? ' · <span class="missing">File needed</span>' : ''}</div></td><td>${esc(t.style || '—')}<small>${esc(t.year || '')}</small></td><td>${t.bpm ? esc(t.bpm) : '—'}</td><td>${time(t.duration)}</td><td class="track-actions"><button data-action="play" data-id="${esc(t.id)}" aria-label="Play ${esc(t.title)}" title="Play">▶ Play</button>${t.source === 'local' ? `<button data-action="preview" data-id="${esc(t.id)}" aria-label="Preview ${esc(t.title)}" title="Preview on current output">♬ Preview</button><button data-action="analyze" data-id="${esc(t.id)}" aria-label="Analyze ${esc(t.title)}" title="Analyze BPM and level">⌁ Analyze</button>${!files.has(t.id) ? `<button data-action="relink" data-id="${esc(t.id)}" title="Relink file">↥ Relink</button>` : ''}` : ''}<button data-action="edit" data-id="${esc(t.id)}" aria-label="Edit ${esc(t.title)}" title="Edit metadata">✎ Edit</button><button data-action="add" data-id="${esc(t.id)}" aria-label="Add ${esc(t.title)} to selected group" title="Add to selected group">+ Add</button><button data-action="delete" data-id="${esc(t.id)}" aria-label="Delete ${esc(t.title)}" title="Remove from library">×</button></td></tr>`).join('');
  $('#empty-library').hidden = visible.length > 0;
  $('#empty-library h3').textContent = state.tracks.length ? 'No matching recordings' : 'A home for your collection';
  $('#library-count').textContent = state.tracks.length; $('#nav-count').textContent = state.tracks.length;
  $('#library-summary').textContent = `${state.tracks.length} recordings · ${time(state.tracks.reduce((s, t) => s + (t.duration || 0), 0))} known duration`;
}
function renderGroups() {
  $('#groups').innerHTML = state.groups.map((g, i) => `<article class="group ${selected === g.id ? 'selected' : ''}" data-group="${esc(g.id)}"><div class="group-header"><button class="group-select" data-group-action="select" data-id="${esc(g.id)}"><span class="group-number">${String(i + 1).padStart(2, '0')}</span><span><span class="eyebrow">${g.kind.toUpperCase()}</span><strong>${esc(g.name)}</strong></span></button><div class="group-tools"><button data-group-action="up" data-id="${esc(g.id)}" aria-label="Move group up" ${i === 0 ? 'disabled' : ''}>↑</button><button data-group-action="down" data-id="${esc(g.id)}" aria-label="Move group down" ${i === state.groups.length - 1 ? 'disabled' : ''}>↓</button><button data-group-action="rename" data-id="${esc(g.id)}" aria-label="Rename group">✎</button><button data-group-action="delete" data-id="${esc(g.id)}" aria-label="Delete group">×</button></div></div><ol>${g.trackIds.map((id, j) => { const t = state.tracks.find(t => t.id === id); return `<li><span>${esc(t?.title || 'Missing track')}</span><div><button data-group-action="track-up" data-id="${esc(g.id)}" data-index="${j}" aria-label="Move recording up" ${j === 0 ? 'disabled' : ''}>↑</button><button data-group-action="track-down" data-id="${esc(g.id)}" data-index="${j}" aria-label="Move recording down" ${j === g.trackIds.length - 1 ? 'disabled' : ''}>↓</button><button data-group-action="remove" data-id="${esc(g.id)}" data-index="${j}" aria-label="Remove recording from group">×</button></div></li>`; }).join('')}</ol>${!g.trackIds.length ? '<p class="group-drop">Drop recordings here or select and use +</p>' : ''}<div class="group-duration">${g.trackIds.length} recordings · ${time(g.trackIds.reduce((sum, id) => sum + (state.tracks.find(t => t.id === id)?.duration || 0), 0))} known duration</div></article>`).join('');
  $('#empty-set').hidden = state.groups.length > 0;
  $('#set-duration').textContent = time(flattenSet(state.groups, state.tracks).reduce((s, item) => s + (item.track.duration || 0), 0));
  $('#start-set').disabled = !flattenSet(state.groups, state.tracks).length;
}
function renderQueue() {
  $('#queue-count').textContent = queue.length;
  $('#queue').innerHTML = queue.length ? queue.map((item, i) => `<button class="queue-item ${i === queueIndex ? 'playing' : ''}" data-queue-index="${i}"><span>${i === queueIndex ? '▶' : String(i + 1).padStart(2, '0')}</span><div><strong>${esc(item.track.title)}</strong><small>${esc(item.groupName || item.track.artist || 'Library track')}</small></div><span>${time(item.track.duration)}</span></button>`).join('') : '<p class="hint">Load a set or play a library track.</p>';
}
function render() { renderLibrary(); renderGroups(); renderQueue(); }

async function importFiles(list) {
  if (busy) { notify('Wait for the current import or analysis to finish.'); return; }
  busy = true; let count = 0;
  try {
    for (const file of list) {
      if (!file.type.startsWith('audio/') && !/\.(mp3|wav|flac|m4a|ogg|aiff?|opus|aac)$/i.test(file.name)) continue;
      if (state.tracks.some(t => t.source === 'local' && t.fileName === file.name && t.fileSize === file.size && t.lastModified === file.lastModified)) continue;
      notify(`Reading ${file.name}…`);
      let metadata;
      try { metadata = await parseBlob(file); } catch { /* Unsupported tags do not prevent importing playable audio. */ }
      const common = metadata?.common || {};
      const genre = (common.genre || []).find(g => ['Tango', 'Vals', 'Milonga', 'Cortina'].some(s => s.toLowerCase() === g.toLowerCase()));
      const track = { id: uid(), source: 'local', fileName: file.name, fileSize: file.size, lastModified: file.lastModified,
        title: common.title || file.name.replace(/\.[^.]+$/, ''), artist: common.artist || common.albumartist || '', singer: '', year: String(common.year || ''),
        style: genre ? genre[0].toUpperCase() + genre.slice(1).toLowerCase() : '', duration: metadata?.format.duration || null, bpm: common.bpm || null };
      await saveFile(track.id, file); files.set(track.id, file); state.tracks.push(track); count++;
      await persist(); renderLibrary(); markStep('load');
    }
    notify(`${count} recording${count === 1 ? '' : 's'} added. Files are saved in this browser; keep your originals for backup.`);
  } catch (error) { notify(`Import stopped: ${error.message}. Keep your original files; browser storage may be full.`, true); }
  finally { busy = false; render(); }
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
async function playIndex(index) {
  if (index < 0 || index >= queue.length) return;
  const request = ++playRequest, item = queue[index];
  try {
    if (!await player.play(item.track, files.get(item.track.id), Number($('#fade').value), $('#normalize').checked)) return;
    if (request !== playRequest) return;
    queueIndex = index; current = item.track; timedEnd = false;
    $('#playing-title').textContent = current.title; $('#playing-artist').textContent = [current.artist, current.singer, current.year].filter(Boolean).join(' · ') || (current.source === 'youtube' ? 'YouTube video' : 'Local recording');
    $('#playing-group').textContent = item.groupName || 'LIBRARY TRACK'; $('#preview-status').hidden = true;
    renderQueue(); markStep('play'); notify(`Playing ${current.title}`);
  } catch (error) { if (request === playRequest) notify(error.message, true); }
}
async function next() { if (queueIndex + 1 < queue.length) await playIndex(queueIndex + 1); else { notify('End of play queue.'); } }
function addToGroup(id, groupId = selected) {
  const group = state.groups.find(g => g.id === groupId);
  if (!group) { notify('Create or select a tanda or cortina first.'); return; }
  if (!state.tracks.some(t => t.id === id)) return;
  group.trackIds.push(id); selected = group.id; void persist(); renderGroups(); markStep('build');
}
function editTrack(track) {
  const form = $('#metadata-form');
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
$('#tracks').onclick = async event => {
  const button = event.target.closest('[data-action]'); if (!button) return;
  const track = state.tracks.find(t => t.id === button.dataset.id); if (!track) return;
  try {
    switch (button.dataset.action) {
      case 'play': queue = [{ track }]; queueIndex = -1; renderQueue(); await playIndex(0); break;
      case 'preview': await player.previewTrack(track, files.get(track.id)); $('#preview-status span').textContent = `Preview: ${track.title} · same output`; $('#preview-status').hidden = false; markStep('preview'); break;
      case 'analyze': await runAnalysis([track]); break;
      case 'edit': editTrack(track); break;
      case 'add': addToGroup(track.id); break;
      case 'relink': relinkId = track.id; $('#relink-input').click(); break;
      case 'delete':
        if (!confirm(`Remove “${track.title}” from the library and every group? Your original file will be kept.`)) return;
        if (busy) { notify('Wait for the current import or analysis to finish.'); return; }
        if (current?.id === track.id || player.track?.id === track.id) { player.stop(); current = null; queue = []; queueIndex = -1; $('#playing-title').textContent = 'No recording loaded'; $('#playing-artist').textContent = 'Play a track or load your prepared set.'; }
        else { const playingItem = queue[queueIndex]; queue = queue.filter(item => item.track.id !== track.id); queueIndex = queue.indexOf(playingItem); }
        state = removeTrack(state, track.id); await persist(); await deleteFile(track.id); files.delete(track.id); player.revoke(track.id); render(); break;
    }
  } catch (error) { notify(error.message, true); }
};
$('#relink-input').onchange = async event => {
  const file = event.target.files[0], track = state.tracks.find(t => t.id === relinkId);
  if (file && track) {
    try {
      await saveFile(track.id, file); player.revoke(track.id); files.set(track.id, file);
      track.fileName = file.name; track.fileSize = file.size; track.lastModified = file.lastModified;
      for (const field of ['duration', 'bpm', 'rmsDb', 'peakDb', 'gainDb']) track[field] = null;
      await persist(); render(); notify('File relinked. Analyze it to refresh duration, BPM, and level.');
    } catch (error) { notify(error.message, true); }
  }
  event.target.value = '';
};
$('#metadata-form').onsubmit = event => {
  event.preventDefault(); const data = new FormData(event.target), track = state.tracks.find(t => t.id === data.get('id'));
  if (!track) return;
  for (const field of ['title', 'artist', 'singer', 'year', 'style']) track[field] = data.get(field).trim();
  track.bpm = data.get('bpm') ? Number(data.get('bpm')) : null;
  void persist(); render(); markStep('edit'); $('#metadata-dialog').close();
};
$('#close-metadata').onclick = () => $('#metadata-dialog').close();
function addGroup(kind) { const group = { id: uid(), kind, name: `${kind === 'tanda' ? 'Tanda' : 'Cortina'} ${state.groups.filter(g => g.kind === kind).length + 1}`, trackIds: [] }; state.groups.push(group); selected = group.id; void persist(); renderGroups(); }
$('#add-tanda').onclick = () => addGroup('tanda'); $('#add-cortina').onclick = () => addGroup('cortina');
$('#groups').onclick = event => {
  const button = event.target.closest('[data-group-action]'); if (!button) return;
  const group = state.groups.find(g => g.id === button.dataset.id); if (!group) return;
  const i = state.groups.indexOf(group), j = Number(button.dataset.index);
  switch (button.dataset.groupAction) {
    case 'select': selected = group.id; break;
    case 'rename': { const name = prompt('Group name', group.name); if (name?.trim()) group.name = name.trim(); break; }
    case 'delete': if (confirm(`Remove “${group.name}” from your set? Recordings stay in the library.`)) { state.groups.splice(i, 1); if (selected === group.id) selected = state.groups[0]?.id || null; } break;
    case 'up': if (i > 0) [state.groups[i - 1], state.groups[i]] = [state.groups[i], state.groups[i - 1]]; break;
    case 'down': if (i < state.groups.length - 1) [state.groups[i + 1], state.groups[i]] = [state.groups[i], state.groups[i + 1]]; break;
    case 'remove': group.trackIds.splice(j, 1); break;
    case 'track-up': if (j > 0) [group.trackIds[j - 1], group.trackIds[j]] = [group.trackIds[j], group.trackIds[j - 1]]; break;
    case 'track-down': if (j < group.trackIds.length - 1) [group.trackIds[j + 1], group.trackIds[j]] = [group.trackIds[j], group.trackIds[j + 1]]; break;
  }
  void persist(); renderGroups();
};
$('#groups').ondragover = event => { if (event.target.closest('[data-group]')) event.preventDefault(); };
$('#groups').ondrop = event => { const group = event.target.closest('[data-group]'); if (group) { event.preventDefault(); addToGroup(event.dataTransfer.getData('text/plain'), group.dataset.group); } };
$('#start-set').onclick = () => { queue = flattenSet(state.groups, state.tracks).map(item => ({ ...item, track: structuredClone(item.track) })); queueIndex = -1; renderQueue(); void playIndex(0); };
$('#queue').onclick = event => { const item = event.target.closest('[data-queue-index]'); if (item) void playIndex(Number(item.dataset.queueIndex)); };
$('#play-pause').onclick = async () => { try { if (!player.track && queue.length) await playIndex(0); else await player.toggle(); } catch (error) { notify(error.message, true); } };
$('#next').onclick = next; $('#previous').onclick = () => playIndex(queueIndex - 1);
$('#stop').onclick = () => { ++playRequest; player.stop(); notify('Playback stopped.'); };
$('#seek').oninput = () => { const duration = current?.source === 'youtube' ? player.youtube?.getDuration() : player.audio.duration; if (Number.isFinite(duration)) player.seek(Number($('#seek').value) / 100 * duration); };
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
    if (!confirm('Replace your current library and set with this file? Export your current set first if you want to keep it.')) return;
    ++playRequest; player.stop(); queue = []; queueIndex = -1; current = null;
    $('#playing-title').textContent = 'No recording loaded'; $('#playing-artist').textContent = 'Play a track or load your prepared set.'; $('#playing-group').textContent = 'READY WHEN YOU ARE'; $('#youtube-wrap').hidden = true;
    const oldIds = state.tracks.filter(t => t.source === 'local').map(t => t.id);
    state = imported; selected = state.groups[0]?.id || null; await persist();
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
  $('#toggle-guide').setAttribute('aria-expanded', String(!$('#practice-guide').hidden));
};
$('#sample-link').onclick = () => {
  $('#youtube-form input').value = `https://www.youtube.com/watch?v=${realTracks[0].videoId}`;
  $('#youtube-form').scrollIntoView({ behavior: 'smooth', block: 'center' }); $('#youtube-form input').focus();
  notify('Recording link filled. Press Add video to import it.');
};
$('#guide-files').onclick = () => $('#file-input').click();
$('#guide-preview').onclick = () => {
  const track = state.tracks.find(t => t.source === 'local' && files.has(t.id));
  if (!track) { notify('Import a local tango recording with + Local files to use Preview. YouTube recordings use Play.'); return; }
  $('#tracks [data-action="preview"][data-id="' + track.id + '"]')?.click();
};
$('#guide-analyze').onclick = () => {
  const tracks = state.tracks.filter(t => t.source === 'local');
  if (!tracks.length) { notify('Import local tango recordings to analyze BPM and level. YouTube audio cannot be analyzed.'); return; }
  void runAnalysis(tracks);
};
$('#sample-export').onclick = () => $('#export-set').click();
async function loadRealSamples() {
  if (busy) { notify('Wait for the current import or analysis to finish.'); return false; }
  for (const track of realTracks) { const existing = state.tracks.find(t => t.id === track.id); if (!existing) state.tracks.push({ ...track }); else existing.samplePack = REAL_SAMPLE_PACK; }
  for (const group of realGroups()) if (!state.groups.some(g => g.id === group.id)) state.groups.push(group);
  selected = 'real-group-tango'; await persist(); render(); markStep('load'); markStep('youtube');
  notify('Real recordings ready: 6 DJ tandas in Tango / Tango / Vals / Tango / Tango / Milonga order, with 20-second cortinas. Press Play milonga set. Internet is required.');
  return true;
}
$('#load-real-samples').onclick = loadRealSamples;
$('#real-sample-play').onclick = async () => {
  if (!await loadRealSamples()) return;
  queue = flattenSet(state.groups.filter(g => g.samplePack === REAL_SAMPLE_PACK), state.tracks).map(item => ({ ...item, track: structuredClone(item.track) }));
  queueIndex = -1; renderQueue(); $('#deck').scrollIntoView({ behavior: 'smooth', block: 'start' }); await playIndex(0);
};
$('#real-guide-play').onclick = () => $('#real-sample-play').click();
$('#real-sample-edit').onclick = async () => { if (await loadRealSamples()) editTrack(state.tracks.find(t => t.id === 'real-tango-1')); };
$('#real-sample-select').onclick = async () => { if (await loadRealSamples()) { markStep('build'); $('#set').scrollIntoView({ behavior: 'smooth', block: 'start' }); } };
renderProgress();

try {
  const saved = await loadState(); if (saved) state = validateSet({ version: 1, ...saved });
  const migrated = removeOldExamples(state); state = migrated.state;
  for (const track of migrated.removed) if (track.source === 'local') await deleteFile(track.id);
  if (saved) await persist();
  for (const track of state.tracks.filter(t => t.source === 'local')) { const file = await getFile(track.id); if (file) files.set(track.id, file); }
  selected = state.groups[0]?.id || null;
} catch (error) { notify(`Could not restore your library: ${error.message}`, true); }
render();

// A shareable local entry point opens a populated workspace without starting audio.
if (new URLSearchParams(location.search).get('practice') === '1' || state.tracks.some(t => t.id === 'real-tango-1')) {
  await loadRealSamples();
}
