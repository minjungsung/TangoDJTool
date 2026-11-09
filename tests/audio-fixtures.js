// Deterministic generated signals. These are test sounds, not historical recordings.
export function sine(rate = 48000, seconds = 1, amplitude = 1, frequency = 1000, phase = 0) {
  return Float32Array.from({ length: Math.round(rate * seconds) }, (_, i) => amplitude * Math.sin(2 * Math.PI * frequency * i / rate + phase));
}

export function expressiveTransfer({ rate = 16000, seconds = 16, expressive = true, transfer = true, amplitude = 0.2 } = {}) {
  const output = new Float32Array(Math.round(rate * seconds));
  const notes = [294, 370, 440, 392, 330, 294, 262, 330];
  for (let beat = 0; beat * 0.5 < seconds; beat++) {
    const start = Math.round((beat * 0.5 + (expressive ? 0.035 * Math.sin(beat * 1.73) : 0)) * rate), frequency = notes[beat % notes.length];
    for (let j = 0; j < rate * 0.38; j++) {
      if (start + j < 0 || start + j >= output.length) continue;
      const time = j / rate, wow = transfer ? 1 + 0.003 * Math.sin(2 * Math.PI * 3.7 * (start + j) / rate) : 1;
      const envelope = Math.exp(-time * 12), tone = Math.sin(2 * Math.PI * frequency * wow * time) + 0.3 * Math.sin(4 * Math.PI * frequency * wow * time);
      const attack = 0.65 * Math.sin(2 * Math.PI * 700 * time) * Math.exp(-time * 90);
      output[start + j] += amplitude * (tone * envelope + attack);
    }
  }
  if (transfer) {
    let seed = 1234567, lowpass = 0;
    for (let i = 0; i < output.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const noise = (seed / 4294967296 - 0.5) * amplitude * 0.018;
      lowpass += 0.7 * (output[i] - lowpass);
      output[i] = lowpass + noise + (i % 12983 === 0 ? amplitude * 0.45 : 0);
    }
  }
  return output;
}

export async function wavChannels(blob) {
  const view = new DataView(await blob.arrayBuffer()), count = view.getUint16(22, true), rate = view.getUint32(24, true), length = view.getUint32(40, true) / (count * 2);
  return { sampleRate: rate, channels: Array.from({ length: count }, (_, channel) => Float32Array.from({ length }, (_, i) => view.getInt16(44 + (i * count + channel) * 2, true) / 32768)) };
}
