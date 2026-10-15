// Original synthesized practice clips. No commercial recordings are bundled.
export const SAMPLE_PACK = 'studio-practice-v1';
const definitions = [
  ['tango-1', 'Amber floor', 'Tango', 120, 18, 220],
  ['tango-2', 'Evening promenade', 'Tango', 120, 18, 246.94],
  ['tango-3', 'Last embrace', 'Tango', 120, 18, 196],
  ['cortina-1', 'A little breathing room', 'Cortina', 100, 6, 329.63],
  ['vals-1', 'Turning lanterns', 'Vals', 90, 15, 261.63],
  ['vals-2', 'Around the room', 'Vals', 90, 15, 293.66],
  ['vals-3', 'Three small steps', 'Vals', 90, 15, 220],
  ['cortina-2', 'Meet someone new', 'Cortina', 100, 6, 349.23],
  ['milonga-1', 'Light on your feet', 'Milonga', 150, 12, 220],
  ['milonga-2', 'Corner conversation', 'Milonga', 150, 12, 261.63],
  ['milonga-3', 'One more smile', 'Milonga', 150, 12, 246.94],
];
export function sampleWav({ style, bpm, duration, frequency }) {
  const rate = 16000, length = rate * duration;
  const buffer = new ArrayBuffer(44 + length * 2), view = new DataView(buffer);
  const word = (offset, value) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  word(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); word(8, 'WAVE'); word(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  word(36, 'data'); view.setUint32(40, length * 2, true);
  const beat = 60 / bpm, melody = [1, 1.1892, 1.4983, 1.3348, 1.1892, 1, .8909, 1];
  for (let i = 0; i < length; i++) {
    const t = i / rate, phase = t % beat, index = Math.floor(t / beat);
    const bass = .2 * Math.exp(-phase * 13) * Math.sin(2 * Math.PI * frequency / 2 * t);
    const note = frequency * melody[index % melody.length];
    const accent = style === 'Vals' && index % 3 !== 0 ? .55 : 1;
    const reed = .14 * accent * Math.exp(-phase * 6) * (Math.sin(2 * Math.PI * note * t) + .3 * Math.sin(2 * Math.PI * note * 2 * t));
    const click = .08 * Math.exp(-phase * 100) * Math.sin(2 * Math.PI * 1600 * t);
    const fade = Math.min(1, t / .08, (duration - t) / .3);
    view.setInt16(44 + i * 2, Math.round((bass + reed + click) * fade * 32767), true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}
export function practiceTracks() {
  return definitions.map(([key, title, style, bpm, duration, frequency]) => ({
    id: `sample-${key}`, source: 'local', title: `${title} · practice`, artist: 'Studio Practice Ensemble', singer: 'Instrumental',
    year: '', style, bpm, duration, frequency, samplePack: SAMPLE_PACK, fileName: `${key}-practice.wav`,
  }));
}
export function practiceGroups() {
  return [
    ['tango', 'tanda', 'Practice 01 · Tango', ['tango-1', 'tango-2', 'tango-3']],
    ['break-1', 'cortina', 'Cortina · Change partners', ['cortina-1']],
    ['vals', 'tanda', 'Practice 02 · Vals', ['vals-1', 'vals-2', 'vals-3']],
    ['break-2', 'cortina', 'Cortina · Reset the floor', ['cortina-2']],
    ['milonga', 'tanda', 'Practice 03 · Milonga', ['milonga-1', 'milonga-2', 'milonga-3']],
  ].map(([key, kind, name, ids]) => ({ id: `sample-group-${key}`, kind, name, trackIds: ids.map(id => `sample-${id}`), samplePack: SAMPLE_PACK }));
}
export const youtubeExamples = [
  { id: 'sample-youtube-tango-1', title: 'Yo soy el tango', videoId: 'c9UaO1KQwpI', artist: 'Aníbal Troilo', singer: 'Francisco Fiorentino', year: '1941', style: 'Tango' },
  { id: 'sample-youtube-tango-2', title: 'Te aconsejo que me olvides', videoId: '0YdWK9Lwc6U', artist: 'Aníbal Troilo', singer: 'Francisco Fiorentino', year: '1941', style: 'Tango' },
  { id: 'sample-youtube-tango-3', title: 'Toda mi vida', videoId: 'yPHYf_m9QdY', artist: 'Aníbal Troilo', singer: 'Francisco Fiorentino', year: '1941', style: 'Tango' },
].map(track => ({ ...track, source: 'youtube', duration: null, samplePack: SAMPLE_PACK }));

export const REAL_SAMPLE_PACK = 'tango-recordings-v1';
const recording = (key, title, videoId, artist, singer, year, style) => ({
  id: `real-${key}`, title, videoId, artist, singer, year, style, source: 'youtube', duration: null, samplePack: REAL_SAMPLE_PACK,
});
export const realTracks = [
  recording('tango-1', 'Yo soy el tango', 'c9UaO1KQwpI', 'Aníbal Troilo', 'Francisco Fiorentino', '1941', 'Tango'),
  recording('tango-2', 'Te aconsejo que me olvides', '0YdWK9Lwc6U', 'Aníbal Troilo', 'Francisco Fiorentino', '1941', 'Tango'),
  recording('tango-3', 'El bulín de la calle Ayacucho', '_B8vvMIClSQ', 'Aníbal Troilo', 'Francisco Fiorentino', '1941', 'Tango'),
  recording('tango-4', 'Toda mi vida', 'yPHYf_m9QdY', 'Aníbal Troilo', 'Francisco Fiorentino', '1941', 'Tango'),
  recording('cortina-1', 'L-O-V-E', 'f_HmF84G7ZY', 'Nat King Cole', '', '', 'Cortina'),
  recording('vals-1', 'Cofrecito', '0_wproPbxNU', 'Francisco Canaro', 'Roberto Maida', '1936', 'Vals'),
  recording('vals-2', 'Secreto de amor', 'L2IBXG66Yc4', 'Francisco Canaro', 'Roberto Maida', '1936', 'Vals'),
  recording('vals-3', 'En voz baja', 'hj6Li8U_Alg', 'Francisco Canaro', 'Roberto Maida', '1937', 'Vals'),
  recording('cortina-2', 'Hit the Road Jack', 'uSiHqxgE2d0', 'Ray Charles', '', '', 'Cortina'),
  recording('milonga-1', 'Largá las penas', 'LsDn9BL526A', 'Francisco Canaro', 'Roberto Maida', '1935', 'Milonga'),
  recording('milonga-2', 'Milonga criolla', '1n2vkEbjcy8', 'Francisco Canaro', 'Roberto Maida', '1936', 'Milonga'),
  recording('milonga-3', 'Silueta porteña', '0UYBUEOoZs4', 'Francisco Canaro', 'Roberto Maida', '1936', 'Milonga'),
];
export function realGroups() {
  return [
    ['tango', 'tanda', 'Troilo / Fiorentino · Tango · 1941', ['tango-1', 'tango-2', 'tango-3', 'tango-4']],
    ['cortina-1', 'cortina', 'L-O-V-E · 20-second cortina', ['cortina-1']],
    ['vals', 'tanda', 'Canaro / Maida · Vals · 1936–1937', ['vals-1', 'vals-2', 'vals-3']],
    ['cortina-2', 'cortina', 'Hit the Road Jack · 20-second cortina', ['cortina-2']],
    ['milonga', 'tanda', 'Canaro / Maida · Milonga · 1935–1936', ['milonga-1', 'milonga-2', 'milonga-3']],
  ].map(([key, kind, name, ids]) => ({ id: `real-group-${key}`, kind, name, trackIds: ids.map(id => `real-${id}`), samplePack: REAL_SAMPLE_PACK,
    ...(kind === 'cortina' ? { limitSeconds: 20 } : {}) }));
}
