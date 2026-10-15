export class Player {
  constructor(onUpdate, onEnded, onError) {
    this.audio = new Audio(); this.preview = new Audio(); this.audio.preload = 'metadata';
    this.onUpdate = onUpdate; this.onError = onError; this.volume = 0.85; this.token = 0; this.urls = new Map();
    this.audio.addEventListener('timeupdate', () => onUpdate(this.audio.currentTime, this.audio.duration));
    this.audio.addEventListener('ended', onEnded);
    this.audio.addEventListener('error', () => onError('This audio format could not be played. Try MP3, WAV, or a supported AAC file.'));
    this.preview.addEventListener('error', () => onError('Preview playback failed.'));
    this.timer = setInterval(() => {
      if (this.track?.source === 'youtube' && this.youtube?.getCurrentTime) onUpdate(this.youtube.getCurrentTime(), this.youtube.getDuration());
    }, 500);
    this.onEnded = onEnded;
  }
  async context() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.gain = this.ctx.createGain(); this.gain.connect(this.ctx.destination);
      this.ctx.createMediaElementSource(this.audio).connect(this.gain);
      this.ctx.createMediaElementSource(this.preview).connect(this.ctx.destination);
    }
    await this.ctx.resume();
  }
  fileUrl(id, file) { if (!this.urls.has(id)) this.urls.set(id, URL.createObjectURL(file)); return this.urls.get(id); }
  async loadYouTube() {
    if (this.youtube) return this.youtube;
    if (this.youtubeLoading) return this.youtubeLoading;
    this.youtubeLoading = this.createYouTube().catch(error => { this.youtubeLoading = null; throw error; });
    return this.youtubeLoading;
  }
  async createYouTube() {
    if (!window.YT?.Player) {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('YouTube could not load. Check your connection or browser blocking settings.')), 15000);
        window.onYouTubeIframeAPIReady = () => { clearTimeout(timeout); resolve(); };
        const script = document.createElement('script'); script.src = 'https://www.youtube.com/iframe_api';
        script.onerror = () => { clearTimeout(timeout); reject(new Error('YouTube could not load.')); }; document.head.append(script);
      });
    }
    this.youtube = await new Promise(resolve => {
      const player = new window.YT.Player('youtube-player', { width: '100%', height: '220',
        playerVars: { playsinline: 1, origin: location.origin }, events: {
          onReady: () => resolve(player),
          onStateChange: event => { if (event.data === 0 && this.track?.source === 'youtube') this.onEnded(); },
          onError: () => this.onError('YouTube cannot play this video. It may be private, unavailable, or disallow embedding.'),
        } });
    });
    return this.youtube;
  }
  async play(track, file, fade, normalize) {
    if (track.source === 'local' && !file) throw new Error('Relink the local file before playing this track.');
    const token = ++this.token;
    if (this.track?.source === 'local' && !this.audio.paused && fade > 0 && track.source === 'local') {
      this.gain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.gain.gain.setValueAtTime(this.gain.gain.value, this.ctx.currentTime);
      this.gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + fade);
      await new Promise(resolve => setTimeout(resolve, fade * 1000));
      if (token !== this.token) return false;
    }
    this.audio.pause(); this.youtube?.pauseVideo?.(); this.preview.pause();
    this.track = track; this.normalize = normalize;
    document.querySelector('#youtube-wrap').hidden = track.source !== 'youtube';
    if (track.source === 'youtube') {
      const yt = await this.loadYouTube(); if (token !== this.token) return false;
      yt.setVolume(this.volume * 100); yt.loadVideoById(track.videoId);
    } else {
      if (!file) throw new Error('Relink the local file before playing this track.');
      await this.context(); if (token !== this.token) return false;
      this.audio.src = this.fileUrl(track.id, file);
      const target = this.targetGain(); this.gain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.gain.gain.setValueAtTime(fade > 0 ? 0 : target, this.ctx.currentTime);
      if (fade > 0) this.gain.gain.linearRampToValueAtTime(target, this.ctx.currentTime + fade);
      await this.audio.play();
    }
    return true;
  }
  targetGain() { return this.volume * 10 ** ((this.normalize ? (this.track?.gainDb || 0) : 0) / 20); }
  setVolume(value, normalize) {
    this.volume = value; this.normalize = normalize;
    if (this.gain) { this.gain.gain.cancelScheduledValues(this.ctx.currentTime); this.gain.gain.setValueAtTime(this.targetGain(), this.ctx.currentTime); }
    this.youtube?.setVolume?.(value * 100);
  }
  async toggle() {
    if (this.track?.source === 'youtube') {
      if (this.youtube?.getPlayerState() === 1) this.youtube.pauseVideo(); else this.youtube?.playVideo();
    } else if (this.track) { await this.context(); if (this.audio.paused) await this.audio.play(); else this.audio.pause(); }
  }
  seek(seconds) { if (this.track?.source === 'youtube') this.youtube?.seekTo(seconds, true); else if (Number.isFinite(this.audio.duration)) this.audio.currentTime = seconds; }
  stop() {
    ++this.token; this.audio.pause(); this.youtube?.pauseVideo?.(); this.preview.pause();
    if (this.gain) { this.gain.gain.cancelScheduledValues(this.ctx.currentTime); this.gain.gain.setValueAtTime(this.targetGain(), this.ctx.currentTime); }
  }
  async previewTrack(track, file) {
    if (!file) throw new Error('Relink the local file before previewing.');
    await this.context(); this.preview.src = this.fileUrl(track.id, file); this.preview.volume = 0.55; await this.preview.play();
  }
  revoke(id) { if (this.urls.has(id)) URL.revokeObjectURL(this.urls.get(id)); this.urls.delete(id); }
}
