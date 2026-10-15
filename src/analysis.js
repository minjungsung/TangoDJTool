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
  const envelopeRate = sampleRate / hop;
  for (let lag = Math.floor(envelopeRate * 60 / 180); lag <= Math.ceil(envelopeRate * 60 / 60); lag++) {
    let correlation = 0;
    for (let i = lag; i < onset.length; i++) correlation += (onset[i] - mean) * (onset[i - lag] - mean);
    correlation /= Math.max(1, onset.length - lag);
    if (correlation > best) { best = correlation; bestLag = lag; }
  }
  return { bpm: bestLag && rms > 0.0001 ? Math.round(envelopeRate * 60 / bestLag) : null,
    rmsDb: Math.round(rmsDb * 10) / 10, peakDb: Math.round(peakDb * 10) / 10,
    gainDb: Math.round(gainDb * 10) / 10 };
}
