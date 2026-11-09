// An approximate tempo estimator for preparation, not a beat grid.
export function analyzeSamples(samples, sampleRate) {
  let energy = 0, peak = 0;
  const hop = Math.max(1, Math.round(sampleRate / 100));
  const envelope = [];
  for (let start = 0; start < samples.length; start += hop) {
    let block = 0;
    for (let i = start; i < Math.min(start + hop, samples.length); i++) {
      const v = samples[i]; energy += v * v; block += v * v; peak = Math.max(peak, Math.abs(v));
    }
    envelope.push(Math.sqrt(block / Math.min(hop, samples.length - start)));
  }
  const rms = Math.sqrt(energy / Math.max(1, samples.length));
  const rmsDb = 20 * Math.log10(Math.max(rms, 1e-9));
  const peakDb = 20 * Math.log10(Math.max(peak, 1e-9));
  const gainDb = Math.max(-12, Math.min(12, -18 - rmsDb, -1 - peakDb));
  const onset = envelope.map((v, i) => Math.max(0, v - (envelope[i - 1] || 0)));
  const mean = onset.reduce((a, b) => a + b, 0) / Math.max(1, onset.length);
  let best = 0, bestLag = 0;
  const correlations = [];
  const envelopeRate = sampleRate / hop;
  for (let lag = Math.floor(envelopeRate * 60 / 180); lag <= Math.ceil(envelopeRate * 60 / 60); lag++) {
    let correlation = 0, left = 0, right = 0;
    for (let i = lag; i < onset.length; i++) {
      const a = onset[i] - mean, b = onset[i - lag] - mean;
      correlation += a * b; left += a * a; right += b * b;
    }
    correlation /= Math.max(1e-12, Math.sqrt(left * right));
    correlations.push({ lag, correlation });
    if (correlation > best) { best = correlation; bestLag = lag; }
  }
  // Prefer the shorter pulse period when an octave has essentially the same
  // support; preserve both alternatives and reduce certainty in that case.
  const nearBest = correlations.find(value => value.correlation > 0 && value.correlation >= best * 0.98);
  if (nearBest) bestLag = nearBest.lag;
  const bpm = bestLag && rms > 0.0001 && samples.length / sampleRate >= 3 ? Math.round(envelopeRate * 60 / bestLag) : null;
  const competing = correlations.filter(value => Math.abs(value.lag - bestLag) > 3 && Math.abs(value.lag - bestLag * 2) > 3 && Math.abs(value.lag * 2 - bestLag) > 3).reduce((maximum, value) => Math.max(maximum, value.correlation), 0);
  const octave = correlations.filter(value => Math.abs(value.lag - bestLag * 2) <= 2 || Math.abs(value.lag * 2 - bestLag) <= 2).reduce((maximum, value) => Math.max(maximum, value.correlation), 0);
  const confidence = bpm ? Math.max(0, Math.min(1, best * (octave >= best * 0.9 ? 0.75 : 1) * Math.min(1, samples.length / sampleRate / 12) * (0.5 + 0.5 * Math.max(0, (best - competing) / Math.max(best, 1e-9))))) : 0;
  const bpmCandidates = bpm ? [...new Set([bpm, Math.round(bpm / 2), bpm * 2].filter(value => value >= 20 && value <= 300))] : [];
  return { bpm, bpmConfidence: Math.round(confidence * 100) / 100, bpmCandidates, bpmSource: 'estimate',
    rmsDb: Math.round(rmsDb * 10) / 10, peakDb: Math.round(peakDb * 10) / 10,
    gainDb: Math.round(gainDb * 10) / 10 };
}

export class TapTempo {
  constructor() { this.taps = []; }
  reset() { this.taps = []; }
  tap(time = performance.now()) {
    if (!Number.isFinite(time)) throw new Error('Tap timing must be finite.');
    if (this.taps.length && (time <= this.taps.at(-1) || time - this.taps.at(-1) > 3000)) this.reset();
    this.taps.push(time); this.taps = this.taps.slice(-12);
    if (this.taps.length < 4) return null;
    const intervals = this.taps.slice(1).map((value, index) => value - this.taps[index]).sort((a, b) => a - b);
    const middle = Math.floor(intervals.length / 2), median = intervals.length % 2 ? intervals[middle] : (intervals[middle - 1] + intervals[middle]) / 2;
    const bpm = Math.round(60000 / median * 10) / 10;
    return bpm >= 20 && bpm <= 300 ? bpm : null;
  }
}
