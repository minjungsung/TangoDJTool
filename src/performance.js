import { flattenSet } from './model.js';
import { inspectProgram, queueRuntime } from './dj.js';
import { t, getLanguage } from './i18n.js';

export const performanceControls = `
  <div class="performance-tools">
    <label class="live-control"><input id="live-mode" type="checkbox"> Live mode</label>
    <button id="performance-check">Check prepared set</button>
    <label><input id="keep-awake" type="checkbox"> Keep screen awake</label>
  </div>
  <p id="live-status" class="hint" hidden>Live mode protects the queue. Pause, Stop and Next remain available; unlock to jump, seek or replace playback.</p>
  <p id="awake-status" class="hint" role="status" hidden></p>
  <p id="program-runtime" class="program-runtime" role="status"></p>`;

export const performanceSettings = `
  <section class="preview-routing">
    <h3>Headphone preview</h3>
    <p class="hint">Choose a separate audio device for local preview. Test the headphones before going live. YouTube uses the main output.</p>
    <label for="preview-output">Preview output</label>
    <select id="preview-output"><option value="">System output</option></select>
    <button id="detect-outputs">Detect audio outputs</button>
    <button id="choose-output" hidden>Choose headphone device</button>
    <p id="output-status" class="hint" role="status">Shared output: preview is blocked during playback.</p>
    <label>Preview volume <input id="preview-volume" type="range" min="0" max="100" value="55"></label>
  </section>`;

export const performanceDialog = `
  <dialog id="performance-dialog" aria-labelledby="performance-title">
    <div class="dialog-heading"><h2 id="performance-title">Prepared set check</h2><button data-close="performance-dialog" aria-label="Close">×</button></div>
    <p class="hint">Review files and musical choices before the event. This check does not prove a YouTube video will play or verify the venue sound system.</p>
    <p id="check-summary" role="status"></p><div id="check-results"></div>
    <div class="dialog-actions"><button id="check-files-again">Check again</button><button id="check-open-music">Open Music</button></div>
  </dialog>`;

const clock = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export class PerformanceControls {
  constructor({ player, context, notify, readyFile, refreshLibrary, showView }) {
    Object.assign(this, { player, context, notify, readyFile, refreshLibrary, showView });
    this.previewRequest = 0;
    this.awakeRequest = 0;
    this.$ = selector => document.querySelector(selector);
    this.$('#live-mode').onchange = () => {
      if (this.live && !player.hasSeparatePreviewOutput) this.cancelPreview();
      this.sync();
    };
    this.$('#performance-check').onclick = () => this.check();
    this.$('#check-files-again').onclick = () => this.check();
    this.$('#check-open-music').onclick = () => { this.$('#performance-dialog').close(); showView('library'); };
    this.$('#detect-outputs').onclick = () => this.detectOutputs();
    this.$('#choose-output').hidden = !navigator.mediaDevices?.selectAudioOutput;
    this.$('#choose-output').onclick = async () => {
      try {
        const output = await navigator.mediaDevices.selectAudioOutput();
        this.cancelPreview();
        await player.setPreviewOutput(output.deviceId);
        await this.detectOutputs();
      } catch (error) { if (error.name !== 'AbortError') notify(error.message, true); }
    };
    this.$('#preview-output').onchange = () => this.changeOutput();
    this.$('#preview-volume').oninput = event => player.setPreviewVolume(Number(event.target.value) / 100);
    this.$('#keep-awake').onchange = () => this.updateWakeLock();
    document.addEventListener('visibilitychange', () => this.updateWakeLock());
    navigator.mediaDevices?.addEventListener('devicechange', () => {
      this.cancelPreview();
      void this.detectOutputs();
    });
    window.addEventListener('online', () => this.sync());
    window.addEventListener('offline', () => this.sync());
    this.installMediaSession();
    player.onRoutingChange = () => { this.renderOutputStatus(); };
  }

  get live() { return this.$('#live-mode').checked; }

  canReplace() {
    if (!this.live) return true;
    this.notify('Unlock Live mode to jump, seek or replace playback.', true);
    return false;
  }

  sync() {
    const { state, queue, index, resumeIndex, position, transitioning, current } = this.context();
    this.$('#live-status').hidden = !this.live;
    this.$('#live-mode').closest('label').classList.toggle('active', this.live);
    for (const button of document.querySelectorAll('#start-set,#import-set,#real-sample-play,#real-guide-play,#collection-play,#queue [data-queue-index],[data-group-action="play-tanda"],[data-group-action="play-recording"],[data-group-action="cue-play"],#tracks [data-action="play"],[data-candidate-play]')) {
      let unavailable = false;
      if (button.id === 'start-set') unavailable = !flattenSet(state.groups, state.tracks).length;
      if (button.dataset.groupAction) unavailable = !state.groups.find(group => group.id === button.dataset.id)?.trackIds.length;
      if (button.dataset.candidatePlay) unavailable = !state.tracks.some(track => track.id === button.dataset.candidatePlay);
      if (button.id === 'collection-play') unavailable = !this.$('#collection-detail [data-candidate-play]');
      button.disabled = this.live || transitioning || unavailable;
    }
    this.$('#previous').disabled = this.live || transitioning || index <= 0;
    this.$('#seek').disabled = this.live || transitioning || !this.player.track;
    this.$('#stop').disabled = !current && !this.player.track && !transitioning && this.player.preview.paused;
    this.renderRuntime(queue, index >= 0 ? index : resumeIndex, position);
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = this.player.isPlaying() ? 'playing' : this.player.track ? 'paused' : 'none';
  }

  renderRuntime(queue, index, position) {
    const gap = Math.max(0, Math.min(10, Number(this.$('#track-gap').value) || 0));
    const runtime = queueRuntime(queue, index, position, gap);
    const { gapPending, gapRemaining } = this.context();
    if (gapPending) runtime.knownSeconds = Math.max(0, runtime.knownSeconds - gap + gapRemaining);
    const parts = [`${t('Set remaining')}: ${clock(runtime.knownSeconds)}`];
    if (runtime.unknownCount) parts.push(`${t('Unknown lengths')}: ${runtime.unknownCount}`);
    if (runtime.heldCount) parts.push(`${t('Manual waits')}: ${runtime.heldCount}`);
    if (queue.length && !runtime.unknownCount && !runtime.heldCount && this.player.isPlaying() && this.$('#auto-next').checked) {
      const end = new Date(Date.now() + runtime.knownSeconds * 1000);
      parts.push(`${t('Estimated finish')}: ${end.toLocaleTimeString(getLanguage(), { hour: '2-digit', minute: '2-digit' })}`);
    }
    this.$('#program-runtime').textContent = queue.length ? parts.join(' · ') : '';
  }

  cancelPreview() {
    ++this.previewRequest;
    this.player.stopPreview();
    this.$('#preview-status').hidden = true;
  }

  async preview(track) {
    if (!this.canPreview()) {
      return false;
    }
    const request = ++this.previewRequest;
    const file = await this.readyFile(track, true);
    if (request !== this.previewRequest) return false;
    if (!this.canPreview()) return false;
    const played = await this.player.previewTrack(track, file);
    if (request !== this.previewRequest || played === false) return false;
    if (!this.canPreview()) { this.cancelPreview(); return false; }
    const output = this.player.hasSeparatePreviewOutput ? t('Headphone output') : t('Shared output');
    this.$('#preview-status span').textContent = `${t('Preview')}: ${track.title} · ${output}`;
    this.$('#preview-status').hidden = false;
    this.sync();
    return true;
  }

  canPreview() {
    if (!this.player.hasSeparatePreviewOutput && (this.live || this.context().transitioning || this.player.mainPlaybackPending || this.player.isPlaying())) {
      this.notify(this.live ? 'Choose a separate preview output before previewing in Live mode.' : 'Preview shares the live output. Pause playback or choose a separate headphone output before previewing.', true);
      return false;
    }
    return true;
  }

  async detectOutputs() {
    this.$('#detect-outputs').disabled = true;
    try {
      const outputs = await this.player.getAudioOutputs();
      const select = this.$('#preview-output');
      select.replaceChildren(new Option(t('System output'), ''));
      for (const [index, device] of outputs.entries()) {
        if (device.deviceId !== 'default' && device.deviceId !== 'communications') select.add(new Option(device.label || `${t('Audio output')} ${index + 1}`, device.deviceId));
      }
      const selected = this.player.previewOutputId === 'default' ? '' : this.player.previewOutputId;
      if (selected && !outputs.some(device => device.deviceId === selected)) select.add(new Option(t('Selected output unavailable'), selected));
      select.value = selected;
      this.renderOutputStatus();
    } catch (error) {
      this.$('#output-status').textContent = t(error.message);
    } finally { this.$('#detect-outputs').disabled = false; }
  }

  async changeOutput() {
    this.cancelPreview();
    this.$('#preview-output').disabled = true;
    try { await this.player.setPreviewOutput(this.$('#preview-output').value); this.renderOutputStatus(); }
    catch (error) { this.$('#preview-output').value = this.player.previewOutputId === 'default' ? '' : this.player.previewOutputId; this.notify(error.message, true); this.renderOutputStatus(); }
    finally { this.$('#preview-output').disabled = false; }
  }

  renderOutputStatus() {
    this.$('#output-status').textContent = t(this.player.hasSeparatePreviewOutput ? 'Separate preview output selected. Test the headphones before going live.' : 'Shared output: preview is blocked during playback.');
  }

  async check() {
    const dialog = this.$('#performance-dialog');
    if (!dialog.open) dialog.showModal();
    this.$('#check-summary').textContent = t('Checking prepared files…');
    this.$('#check-files-again').disabled = true;
    try {
      const { state } = this.context();
      const ids = new Set(state.groups.flatMap(group => group.trackIds));
      for (const track of state.tracks.filter(track => track.source === 'local' && ids.has(track.id))) await this.readyFile(track);
      const { state: latest, sourceStatuses } = this.context();
      const issues = inspectProgram(latest.groups, latest.tracks, sourceStatuses, navigator.onLine);
      this.$('#check-results').replaceChildren();
      const runtime = queueRuntime(flattenSet(latest.groups, latest.tracks));
      this.$('#check-summary').textContent = `${t('Blocking issues')}: ${issues.filter(issue => issue.level === 'error').length} · ${t('Review notes')}: ${issues.filter(issue => issue.level === 'warning').length} · ${t('Known runtime')}: ${clock(runtime.knownSeconds)}`;
      if (!issues.length) this.$('#check-results').textContent = t('Prepared files and cues are ready. Rehearse the sound output before the event.');
      for (const issue of issues) {
        const row = document.createElement('div'); row.className = `check-issue ${issue.level}`; row.dataset.checkCode = issue.code;
        const label = document.createElement('strong'); label.textContent = t(issue.level === 'error' ? 'Needs attention' : 'Review');
        const title = document.createElement('span'); title.className = 'check-recording'; title.dataset.preserve = '';
        title.textContent = [latest.groups.find(group => group.id === issue.groupId)?.name, latest.tracks.find(track => track.id === issue.trackId)?.title].filter(Boolean).join(' · ');
        const text = document.createElement('p'); text.textContent = t(issue.message);
        row.append(label, title, text);
        this.$('#check-results').append(row);
      }
      this.refreshLibrary();
    } catch (error) { this.$('#check-summary').textContent = t(error.message); }
    finally { this.$('#check-files-again').disabled = false; }
  }

  async updateWakeLock() {
    const wanted = this.$('#keep-awake').checked && !document.hidden;
    const request = ++this.awakeRequest;
    const status = this.$('#awake-status'); status.hidden = !this.$('#keep-awake').checked;
    if (!wanted) { const lock = this.wakeLock; this.wakeLock = null; await lock?.release(); return; }
    if (this.wakeLock && !this.wakeLock.released) return;
    if (!navigator.wakeLock) { status.textContent = t('Screen wake lock is unavailable in this browser.'); return; }
    try {
      const lock = await navigator.wakeLock.request('screen');
      if (request !== this.awakeRequest || !this.$('#keep-awake').checked || document.hidden) { await lock.release(); return; }
      this.wakeLock = lock; status.textContent = t('Screen stays awake while this page is visible.');
      lock.addEventListener('release', () => { if (this.wakeLock === lock) { this.wakeLock = null; status.textContent = t('Screen wake lock released. Toggle Keep screen awake to retry.'); } });
    } catch { status.textContent = t('Screen wake lock was declined. Check device power settings.'); }
  }

  installMediaSession() {
    if (!('mediaSession' in navigator)) return;
    const actions = {
      play: () => { if (!this.player.isPlaying() && !this.player.mainPlaybackPending && !this.context().gapPending) this.$('#play-pause').click(); },
      pause: () => {
        if (this.context().transitioning) this.$('#stop').click();
        else if (this.player.isPlaying() || this.player.mainPlaybackPending || this.context().gapPending) this.$('#play-pause').click();
      },
      stop: () => this.$('#stop').click(),
      nexttrack: () => this.$('#next').click(),
      previoustrack: () => this.$('#previous').click(),
    };
    for (const [action, handler] of Object.entries(actions)) try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* Browser-specific transport support. */ }
  }
}
