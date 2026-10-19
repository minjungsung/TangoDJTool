export const REAL_SAMPLE_PACK = 'milonga-dj-v2';
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
const additionalTangos = [
  ['canaro-1', 'Poema', 'GrfBFswBX_s', '1935'],
  ['canaro-2', 'Envidia', 'blMHutvTj44', '1936'],
  ['canaro-3', 'Yo también soñé', 'xV9C_q8d8_Y', '1936'],
  ['canaro-4', 'Invierno', 'lds063fBFSs', '1937'],
  ['rhythmic-1', 'Milagro', 'pHcywj-b6no', '1937'],
  ['rhythmic-2', 'Recuerdos de París', 'S7wbiQOjZUQ', '1937'],
  ['rhythmic-3', 'Nada más', 'OJWqMx_D-bQ', '1938'],
  ['rhythmic-4', 'Yo seré como tú quieras', 'D9PfLHGskvY', '1938'],
];
realTracks.push(...additionalTangos.map(([key, title, id, year]) => recording(key, title, id, 'Francisco Canaro', 'Roberto Maida', year, 'Tango')));
realTracks.push(...[
  ['instrumental-1', 'Cachirulo', 'KDnItdfc3VI'],
  ['instrumental-2', 'Guapeando', 'M65wX9AWKMY'],
  ['instrumental-3', 'El tamango', '1ZThSxVyx7I'],
  ['instrumental-4', 'Milongueando en el 40', 'hMBGbORsQ4E'],
].map(([key, title, id]) => recording(key, title, id, 'Aníbal Troilo', 'Instrumental', '1941', 'Tango')));
realTracks.push(
  recording('cortina-3', 'Sway', 'J76ExFgg0Vs', 'Dean Martin', '', '', 'Cortina'),
  recording('cortina-4', 'Fly Me to the Moon', 'JYuyWrkwpok', 'Frank Sinatra', '', '', 'Cortina'),
  recording('cortina-5', 'The Girl from Ipanema', 'sVdaFQhS86E', 'Astrud Gilberto & Stan Getz', '', '', 'Cortina'),
  recording('cortina-6', 'Stand By Me', 'hwZNL7QVJjE', 'Ben E. King', '', '', 'Cortina'),
);
export function realGroups() {
  return [
    ['tango', 'tanda', '01 · Troilo / Fiorentino · Tango · 1941', ['tango-1', 'tango-2', 'tango-3', 'tango-4']],
    ['cortina-1', 'cortina', 'L-O-V-E', ['cortina-1']],
    ['canaro', 'tanda', '02 · Canaro / Maida · Lyrical tango · 1935–1937', ['canaro-1', 'canaro-2', 'canaro-3', 'canaro-4']],
    ['cortina-2', 'cortina', 'Hit the Road Jack', ['cortina-2']],
    ['vals', 'tanda', '03 · Canaro / Maida · Vals · 1936–1937', ['vals-1', 'vals-2', 'vals-3']],
    ['cortina-3', 'cortina', 'Sway', ['cortina-3']],
    ['instrumental', 'tanda', '04 · Troilo · Instrumental tango · 1941', ['instrumental-1', 'instrumental-2', 'instrumental-3', 'instrumental-4']],
    ['cortina-4', 'cortina', 'Fly Me to the Moon', ['cortina-4']],
    ['rhythmic', 'tanda', '05 · Canaro / Maida · Rhythmic tango · 1937–1938', ['rhythmic-1', 'rhythmic-2', 'rhythmic-3', 'rhythmic-4']],
    ['cortina-5', 'cortina', 'The Girl from Ipanema', ['cortina-5']],
    ['milonga', 'tanda', '06 · Canaro / Maida · Milonga · 1935–1936', ['milonga-1', 'milonga-2', 'milonga-3']],
    ['cortina-6', 'cortina', 'Stand By Me', ['cortina-6']],
  ].map(([key, kind, name, ids]) => ({ id: `real-group-${key}`, kind, name, trackIds: ids.map(id => `real-${id}`), samplePack: REAL_SAMPLE_PACK,
    ...(kind === 'cortina' ? { limitSeconds: 20 } : {}) }));
}
export function realCollections() {
  const groups = realGroups().filter(group => group.kind === 'tanda');
  return [
    ...groups.map(group => ({ id: group.id.replace('real-group-', 'real-set-'), name: group.name.replace(/^\d+ · /, ''), trackIds: [...group.trackIds], samplePack: REAL_SAMPLE_PACK })),
    { id: 'real-set-cortinas', name: 'Cortina selections', trackIds: realTracks.filter(track => track.style === 'Cortina').map(track => track.id), samplePack: REAL_SAMPLE_PACK },
  ];
}
export function removeOldExamples(state) {
  const oldPacks = ['studio-practice-v1', 'tango-recordings-v1'];
  const keepIds = new Set(realTracks.map(t => t.id));
  const removed = state.tracks.filter(t => oldPacks.includes(t.samplePack) && !keepIds.has(t.id));
  const removedIds = new Set(removed.map(t => t.id));
  return { removed, state: { ...state, tracks: state.tracks.filter(t => !removedIds.has(t.id)),
    groups: state.groups.filter(g => !oldPacks.includes(g.samplePack)).map(g => ({ ...g, trackIds: g.trackIds.filter(id => !removedIds.has(id)) })) } };
}
