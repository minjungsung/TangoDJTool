import { fadeLevel, playbackMessage } from './fade.js';

export class Player {
  constructor(onUpdate, onEnded, onError) {
    this.audio = new Audio(); this.preview = new Audio(); this.audio.preload = 'metadata'; this.preview.preload = 'metadata';
    this.audio.playsInline = true; this.preview.playsInline = true;
    this.onUpdate = onUpdate; this.onError = onError; this.volume = 0.85; this.fade = 0; this.level = 1; this.token = 0; this.urls = new Map();
    this.previewToken = 0; this.previewVolume = 0.55; this.preview.volume = this.previewVolume;
    this.starting = false; this.youtubePending = false; this.previewStarting = false; this._audioOwner = null; this._previewOwner = null; this._previewOutputs = [];
    navigator.mediaDevices?.addEventListener?.('devicechange', () => {
      this._previewOutputs = [];
      // A changed system default can make a previously separate cue output shared.
      this.stopPreview();
    });
    this.audio.addEventListener('timeupdate', () => {
      if (this.audio.currentTime !== this.localLastPosition) { this.localLastPosition = this.audio.currentTime; this.localWaitingSince = null; this.localStallReported = false; }
      if (this.track?.source === 'local' && !this.audio.paused) onUpdate(this.audio.currentTime, this.audio.duration);
    });
    this.audio.addEventListener('waiting', () => { this.localWaitingSince = Date.now(); });
    this.audio.addEventListener('playing', () => { this.localWaitingSince = null; this.localStallReported = false; });
    this.audio.addEventListener('ended', () => { if (this.track?.source === 'local' && this.audio.ended && !this.switching) onEnded(); });
    for (const event of ['play','pause','ended']) this.audio.addEventListener(event, () => this.onPlaybackState?.());
    this.audio.addEventListener('error', () => onError('This audio format could not be played. Try MP3, WAV, or a supported AAC file.'));
    this.preview.addEventListener('error', () => onError('Preview playback failed.'));
    this.lastProgress = Date.now(); this.lastPosition = -1; this.stallNotified = false;
    this.timer = setInterval(() => {
      this.updateEnvelope();
      if (this.track?.source === 'local' && !this.audio.paused) {
        const position = this.audio.currentTime;
        if (position !== this.localLastPosition) { this.localLastPosition = position; this.localWaitingSince = null; this.localStallReported = false; }
        if (!this.lastLocalUpdate || Date.now() - this.lastLocalUpdate >= 250) { this.lastLocalUpdate = Date.now(); onUpdate(position, this.audio.duration); }
      }
      if (this.track?.source === 'local' && !this.audio.paused && this.localWaitingSince && Date.now() - this.localWaitingSince > 15000 && !this.localStallReported) {
        this.localStallReported = true; this.onError('Audio playback is stalled. Retry or relink a browser-supported MP3, WAV, or AAC file.');
      }
      if (this.track?.source !== 'youtube' || !this.youtube?.getCurrentTime || !this.matchesVideo()) return;
      const position = this.youtube.getCurrentTime(), state = this.youtube.getPlayerState?.();
      this.onNeedsGesture?.(!this.youtubeArmed && ![1,3].includes(state) && Date.now() - this.loadStarted > 8000);
      if (Math.abs(position - this.lastPosition) > 0.1 || ![1,3].includes(state)) {
        this.lastPosition = position; this.lastProgress = Date.now();
        if (this.stallNotified) { this.stallNotified = false; this.onStall?.(false); }
      }
      if ([1,3].includes(state) && Date.now() - this.lastProgress > 15000 && !this.stallNotified) {
        this.stallNotified = true; this.onStall?.(true);
      }
      if (state === 1 && (!this.lastUpdate || Date.now() - this.lastUpdate >= 250)) { this.lastUpdate = Date.now(); onUpdate(position, this.youtube.getDuration()); }
    }, 50);
    this.onEnded = onEnded; this.youtubeArmed = false;
  }
  matchesVideo() {
    if (!this.youtube?.getVideoUrl) return true;
    try { return new URL(this.youtube.getVideoUrl()).searchParams.get('v') === this.track?.videoId; } catch { return false; }
  }
  async context() {
    if (!this.ctx) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) throw new Error('Audio processing is unavailable in this browser. Try a current Safari or Chrome browser.');
      this.ctx = new Context();
      this.gain = this.ctx.createGain(); this.gain.connect(this.ctx.destination);
      this.ctx.createMediaElementSource(this.audio).connect(this.gain);
      // Preview remains a direct media element: setSinkId does not route audio
      // that has already been connected to the main Web Audio destination.
    }
    await this.ctx.resume();
  }
  fileUrl(id, file) { if (!this.urls.has(id)) this.urls.set(id, URL.createObjectURL(file)); return this.urls.get(id); }
  async loadYouTube(videoId) {
    if (this.youtube) return this.youtube;
    if (this.youtubeLoading) return this.youtubeLoading;
    this.youtubeLoading = this.createYouTube(videoId).catch(error => { this.youtubeLoading = null; throw error; });
    return this.youtubeLoading;
  }
  async createYouTube(videoId) {
    if (!window.YT?.Player) {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('YouTube could not load. Check your connection or browser blocking settings.')), 15000);
        window.onYouTubeIframeAPIReady = () => { clearTimeout(timeout); resolve(); };
        const script = document.createElement('script'); script.src = 'https://www.youtube.com/iframe_api';
        script.onerror = () => { clearTimeout(timeout); reject(new Error('YouTube could not load.')); }; document.head.append(script);
      });
    }
    this.youtube = await new Promise((resolve, reject) => {
      let player, settled = false;
      const timeout = setTimeout(() => {
        settled = true;
        player?.destroy?.();
        const wrap = document.querySelector('#youtube-wrap');
        if (!document.querySelector('#youtube-player')) {
          const target = document.createElement('div'); target.id = 'youtube-player'; wrap.prepend(target);
        }
        reject(new Error('YouTube player did not become ready. Check your connection and try again.'));
      }, 15000);
      try {
        player = new window.YT.Player('youtube-player', { videoId, width: '100%', height: '260',
          playerVars: { playsinline: 1, origin: location.origin, rel: 0 }, events: {
            onReady: () => { if (settled) return; settled = true; clearTimeout(timeout); resolve(player); },
            onStateChange: event => {
              if (this.track?.source !== 'youtube' || !this.matchesVideo()) return;
              if ([0, 1, 2].includes(event.data)) this.youtubePending = false;
              // The iframe can begin playback independently of the deck controls.
              if ([1, 3].includes(event.data) && !this.hasSeparatePreviewOutput) this.stopPreview();
              this.onPlaybackState?.();
              if (event.data === 1) this.youtubeArmed = true;
              if (event.data === 0 && this.youtubeArmed && !this.switching && (!this.youtube?.getPlayerState || this.youtube.getPlayerState() === 0)) {
                this.youtubeArmed = false; this.onEnded();
              }
            },
            onError: event => { if (this.track?.source === 'youtube') { this.youtubePending = false; this.onError({ type: 'youtube', code: event.data, track: this.track }); } },
          },
        });
      } catch (error) { settled = true; clearTimeout(timeout); reject(error); }
    });
    return this.youtube;
  }
  position() { return this.track?.source === 'youtube' ? this.youtube?.getCurrentTime?.() || 0 : this.audio.currentTime; }
  isPlaying() { return this.track?.source === 'youtube' ? this.youtube?.getPlayerState?.() === 1 : !this.audio.paused; }
  get mainPlaybackPending() { return this.starting || (this.track?.source === 'youtube' && (this.youtubePending || this.youtube?.getPlayerState?.() === 3)); }
  updateEnvelope() {
    if (!this.track || this.switching || !this.isPlaying() || (this.track.source === 'youtube' && !this.matchesVideo())) return;
    const sourceDuration = this.track.source === 'youtube' ? this.youtube?.getDuration?.() : this.audio.duration;
    const available = sourceDuration > 0 ? Math.max(0, sourceDuration - this.startSeconds) : Infinity;
    const duration = Math.min(this.limitSeconds || Infinity, available);
    this.applyLevel(fadeLevel(this.position() - this.startSeconds, duration, this.fade));
  }
  applyLevel(level) {
    this.level = level;
    if (this.track?.source === 'youtube') this.youtube?.setVolume?.(this.volume * level * 100);
    else if (this.gain) this.gain.gain.setTargetAtTime(this.targetGain() * level, this.ctx.currentTime, 0.015);
  }
  async play(track, file, fade, normalize, startSeconds = 0, limitSeconds = null, resumeSeconds = startSeconds) {
    if (track.source === 'local' && !file) throw new Error('Relink the local file before playing this track.');
    this.updateEnvelope();
    const token = ++this.token;
    // Controls may change these settings while the source is loading.
    this.normalize = normalize; this.fade = fade;
    this.starting = true;
    if (!this.hasSeparatePreviewOutput) this.stopPreview();
    try {
      // Unlock Web Audio while this call still belongs to the user's gesture.
      if (track.source === 'local') { await this.context(); if (token !== this.token) return false; }
      const switchFade = this.fade;
      if (this.track && this.isPlaying() && switchFade > 0 && this.level > 0.01) {
        this.switching = true;
        const initial = this.level, started = performance.now();
        await new Promise(resolve => {
          const timer = setInterval(() => {
            if (token !== this.token) { clearInterval(timer); resolve(); return; }
            const progress = Math.min(1, (performance.now() - started) / (switchFade * 1000));
            this.applyLevel(initial * (1 - progress));
            if (progress === 1) { clearInterval(timer); resolve(); }
          }, 25);
        });
        if (token !== this.token) return false;
      }
      this.audio.pause(); this.youtube?.pauseVideo?.();
      this.switching = false;
      this.youtubeArmed = false; this.youtubePending = false; this.lastProgress = Date.now(); this.lastPosition = -1; this.stallNotified = false; this.onStall?.(false);
      this.localWaitingSince = null; this.localStallReported = false;
      this.loadStarted = Date.now(); this.onNeedsGesture?.(false);
      this.track = structuredClone(track);
      this.startSeconds = startSeconds; this.limitSeconds = limitSeconds;
      document.querySelector('#youtube-wrap').hidden = track.source !== 'youtube';
      if (track.source === 'youtube') {
        const yt = await this.loadYouTube(track.videoId); if (token !== this.token) return false;
        this.applyLevel(this.fade > 0 ? 0 : 1);
        this.youtubePending = true;
        yt.loadVideoById(resumeSeconds ? { videoId: track.videoId, startSeconds: resumeSeconds } : track.videoId);
      } else {
        this.audio.src = this.fileUrl(track.id, file);
        this.audio.currentTime = resumeSeconds;
        this.gain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.gain.gain.setValueAtTime(this.fade > 0 ? 0 : this.targetGain(), this.ctx.currentTime);
        this.level = this.fade > 0 ? 0 : 1;
        try {
          await this.startMedia(this.audio, token, false);
        } catch (error) {
          if (token !== this.token) return false;
          throw new Error(playbackMessage(error));
        }
        if (token !== this.token) return false;
        this.updateEnvelope();
      }
      return true;
    } catch (error) { if (token !== this.token) return false; this.youtubePending = false; throw error; }
    finally { if (token === this.token) this.starting = false; }
  }
  async startMedia(element, token, preview) {
    const requestKey = preview ? 'previewToken' : 'token', ownerKey = preview ? '_previewOwner' : '_audioOwner';
    this[ownerKey] = token;
    let timeout, expired = false;
    const playback = Promise.resolve(element.play()).then(() => {
      // A media promise may finish after Stop or a loading timeout. A newer
      // request using this same element still owns its playback and must survive.
      if ((this[requestKey] !== token || expired) && (this[ownerKey] === token || this[ownerKey] === null)) element.pause();
    });
    try {
      await Promise.race([playback, new Promise((_, reject) => {
        timeout = setTimeout(() => { expired = true; reject(new Error(preview ? 'Preview is taking too long to load. Retry or relink the original file.' : 'Audio is taking too long to load. Retry or relink the original file.')); }, 15000);
      })]);
    } catch (error) {
      if (this[requestKey] === token) { element.pause(); this[ownerKey] = null; }
      throw error;
    } finally { clearTimeout(timeout); }
  }
  targetGain() { return this.volume * 10 ** ((this.normalize ? (this.track?.gainDb || 0) : 0) / 20); }
  setVolume(value, normalize) {
    this.volume = value; this.normalize = normalize;
    this.applyLevel(this.level);
  }
  setFade(value) { this.fade = value; this.updateEnvelope(); }
  async toggle() {
    const token = ++this.token;
    this.starting = false; this.switching = false;
    if (this.track?.source === 'youtube') {
      if (this.youtube?.getPlayerState() === 1 || this.mainPlaybackPending) { this.youtubePending = false; this.youtube?.pauseVideo(); }
      else {
        if (!this.hasSeparatePreviewOutput) this.stopPreview();
        this.youtubePending = Boolean(this.youtube?.playVideo);
        try { this.youtube?.playVideo(); } catch (error) { this.youtubePending = false; throw error; }
      }
    } else if (this.track) {
      if (!this.audio.paused) { this.audio.pause(); return true; }
      this.starting = true;
      if (!this.hasSeparatePreviewOutput) this.stopPreview();
      try {
        await this.context(); if (token !== this.token) return false;
        await this.startMedia(this.audio, token, false);
        if (token !== this.token) return false;
        this.updateEnvelope();
      } catch (error) { if (token !== this.token) return false; throw error; }
      finally { if (token === this.token) this.starting = false; }
    }
    return true;
  }
  seek(seconds) { if (this.track?.source === 'youtube') this.youtube?.seekTo?.(seconds, true); else if (Number.isFinite(this.audio.duration)) this.audio.currentTime = seconds; this.updateEnvelope(); }
  async fadeOut(seconds) {
    const token = this.token, initial = this.level;
    if (seconds > 0 && this.isPlaying()) {
      this.switching = true;
      const started = performance.now();
      await new Promise(resolve => {
        const timer = setInterval(() => {
          if (token !== this.token) { clearInterval(timer); resolve(); return; }
          const progress = Math.min(1, (performance.now() - started) / (seconds * 1000));
          this.applyLevel(initial * (1 - progress));
          if (progress === 1) { clearInterval(timer); resolve(); }
        }, 25);
      });
    }
    if (token === this.token) this.stop();
  }
  stop({ preservePreview = false } = {}) {
    ++this.token; this.starting = false; this.youtubePending = false; this._audioOwner = null; this.onNeedsGesture?.(false); this.switching = false; this.youtubeArmed = false; this.stallNotified = false; this.onStall?.(false); this.audio.pause(); this.youtube?.pauseVideo?.();
    if (!preservePreview || !this.hasSeparatePreviewOutput) this.stopPreview();
    if (this.gain) { this.gain.gain.cancelScheduledValues(this.ctx.currentTime); this.gain.gain.setValueAtTime(this.targetGain(), this.ctx.currentTime); }
  }
  async previewTrack(track, file) {
    if (!file) throw new Error('Relink the local file before previewing.');
    const token = ++this.previewToken;
    this.preview.pause(); this.previewStarting = true;
    try {
      if (this._settingPreviewOutput) throw new Error('Wait for the preview output change to finish before previewing.');
      if (this.previewOutputId !== 'default') {
        const outputs = await this.getAudioOutputs();
        if (!outputs.some(output => output.deviceId === this.previewOutputId)) throw new Error('The preview output was disconnected. Select an available output before previewing.');
      }
      if (token !== this.previewToken) return false;
      if ((this.mainPlaybackPending || this.isPlaying()) && !this.hasSeparatePreviewOutput) throw new Error('Preview shares the live output. Pause playback or choose a separate headphone output before previewing.');
      this.previewId = track.id; this.preview.src = this.fileUrl(track.id, file); this.preview.volume = this.previewVolume;
      await this.startMedia(this.preview, token, true);
      return token === this.previewToken;
    } catch (error) {
      if (token !== this.previewToken) return false;
      this.previewId = null;
      throw new Error(playbackMessage(error));
    } finally { if (token === this.previewToken) this.previewStarting = false; }
  }
  stopPreview() { ++this.previewToken; this.previewStarting = false; this._previewOwner = null; this.preview.pause(); this.previewId = null; }
  setPreviewVolume(value) {
    if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error('Choose a preview volume between 0 and 100%.');
    this.previewVolume = value; this.preview.volume = value;
  }
  get previewOutputId() { return this.preview.sinkId || 'default'; }
  get previewSinkId() { return this.previewOutputId; }
  get hasSeparatePreviewOutput() {
    if (this._settingPreviewOutput || this.previewOutputId === 'default') return false;
    const selected = this._previewOutputs.find(output => output.deviceId === this.previewOutputId);
    const systemDefault = this._previewOutputs.find(output => output.deviceId === 'default');
    return Boolean(selected?.groupId && systemDefault?.groupId && selected.groupId !== systemDefault.groupId);
  }
  async getAudioOutputs() {
    if (!this.preview.setSinkId || !navigator.mediaDevices?.enumerateDevices) throw new Error('This browser cannot choose a separate preview output. Use a browser with audio output selection, or pause playback before previewing.');
    let devices;
    try { devices = await navigator.mediaDevices.enumerateDevices(); }
    catch { throw new Error('Audio outputs could not be listed. Check browser permissions and reconnect your headphones.'); }
    this._previewOutputs = devices.filter(device => device.kind === 'audiooutput').map(({ deviceId, groupId, label }) => ({ deviceId, groupId, label, kind: 'audiooutput' }));
    if (!this.hasSeparatePreviewOutput && (this.mainPlaybackPending || this.isPlaying()) && !this.preview.paused) this.stopPreview();
    return this._previewOutputs.map(output => ({ ...output }));
  }
  async setPreviewOutput(deviceId) {
    if (this._settingPreviewOutput) throw new Error('Wait for the current preview output change to finish.');
    if (typeof deviceId !== 'string') throw new Error('Choose an available preview output.');
    const id = deviceId || 'default';
    this._settingPreviewOutput = true;
    try {
      this.stopPreview();
      const outputs = await this.getAudioOutputs();
      if (id !== 'default' && !outputs.some(output => output.deviceId === id)) throw new Error('This preview output is unavailable. Reconnect the device and refresh the output list.');
      await this.preview.setSinkId(id === 'default' ? '' : id);
      if (this.previewOutputId !== id) throw new Error('The browser did not switch to the requested preview output.');
      return this.previewOutputId;
    } catch (error) {
      if (error.name === 'NotAllowedError') throw new Error('Browser permission for this preview output was denied. Allow the device and select it again.');
      if (error.name === 'NotFoundError') throw new Error('This preview output was disconnected. Reconnect it and select the output again.');
      throw new Error(error.message || 'The preview output could not be changed. Select the device again.');
    } finally { this._settingPreviewOutput = false; }
  }
  revoke(id) { if (this.urls.has(id)) URL.revokeObjectURL(this.urls.get(id)); this.urls.delete(id); }
}
