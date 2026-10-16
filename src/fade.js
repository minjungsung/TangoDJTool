// Fade time follows audible source position, including cues and short clips.
export function fadeLevel(position, duration, fadeSeconds) {
  if (!(fadeSeconds > 0)) return 1;
  const fade = Number.isFinite(duration) && duration > 0 ? Math.min(fadeSeconds, duration / 2) : fadeSeconds;
  const intro = Math.max(0, position) / fade;
  const outro = Number.isFinite(duration) && duration > 0 ? Math.max(0, duration - position) / fade : 1;
  return Math.max(0, Math.min(1, intro, outro));
}

export function playbackMessage(error) {
  if (error?.name === 'NotAllowedError') return 'Playback needs your permission. Press Retry, or press play inside the YouTube video.';
  if (error?.name === 'NotSupportedError') return 'This audio format could not be played. Try MP3, WAV, or a supported AAC file.';
  return error?.message || 'Playback could not start. Retry or choose another recording.';
}
