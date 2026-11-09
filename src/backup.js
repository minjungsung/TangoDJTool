import { validateSet } from './model.js';
import { streamHash } from './stream-hash.js';
import { validateSessionSnapshot, serializeSessionSnapshot, parseSessionSnapshot } from './session.js';
import { restoreWorkspace, loadState } from './storage.js';

const MAGIC = new TextEncoder().encode('TANGO-DJ-BACKUP\n');
const MAX_MANIFEST = 12 * 1024 * 1024;
const RECOVERY_KEY = 'studio-backup-restore-recovery';
const trackFields = ['id', 'source', 'videoId', 'title', 'artist', 'singer', 'year', 'style', 'duration', 'bpm', 'rmsDb', 'peakDb', 'gainDb', 'cueStartSeconds', 'cueEndSeconds', 'contentHash', 'fileName', 'fileSize', 'lastModified', 'tags', 'rating', 'notes', 'album', 'label', 'provenance', 'bpmConfidence', 'bpmCandidates', 'bpmSource', 'integratedLufs', 'truePeakDb', 'loudnessAnalysisVersion', 'measuredSeconds'];
const groupFields = ['id', 'kind', 'name', 'trackIds', 'occurrenceIds', 'parentId', 'presetId', 'notes', 'collapsed', 'fullLength', 'startSeconds', 'limitSeconds', 'holdAfter', 'samplePack'];
const pick = (value, fields) => Object.fromEntries(fields.filter(field => Object.hasOwn(value, field)).map(field => [field, value[field]]));
const fail = message => { throw new Error(message); };
const plain = value => value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const hashPattern = /^[a-f0-9]{64}$/;

export function portableWorkspace(value, trackIds = null) {
  const validated = validateSet({ version: 1, ...value }), selected = new Set(trackIds || validated.tracks.map(track => track.id));
  if ([...selected].some(id => !validated.tracks.some(track => track.id === id))) fail('Choose recordings from this workspace.');
  const group = item => {
    const result = pick(item, groupFields), positions = item.trackIds.map((id, index) => ({ id, index })).filter(item => selected.has(item.id));
    result.trackIds = positions.map(item => item.id);
    if (item.occurrenceIds) result.occurrenceIds = positions.map(position => item.occurrenceIds[position.index]);
    return result;
  };
  const saved = item => ({ ...pick(item, ['id', 'name', 'notes']), trackIds: item.trackIds.filter(id => selected.has(id)), ...(item.cortina ? { cortina: group(item.cortina) } : {}) });
  const tracks = validated.tracks.filter(track => selected.has(track.id)).map(track => {
    const result = pick(track, trackFields);
    if (typeof result.fileName === 'string') result.fileName = result.fileName.split(/[\\/]/).at(-1);
    return result;
  });
  return validateSet({ version: 1, tracks, groups: validated.groups.map(group), collections: validated.collections.map(saved), presets: validated.presets.map(saved) });
}

export function validatePreferences(value = {}) {
  if (!plain(value) || Object.keys(value).some(key => !['settings', 'language', 'audioProcessing'].includes(key))) fail('Invalid portable preferences.');
  const result = {};
  if (value.language != null) {
    if (!['en', 'ko', 'es'].includes(value.language)) fail('Invalid saved language.');
    result.language = value.language;
  }
  if (value.settings != null) {
    const settings = value.settings;
    if (!plain(settings) || Object.keys(settings).some(key => !['volume', 'fade', 'normalize', 'autoNext', 'gapSeconds', 'guideHidden', 'eventDeadline', 'finalGroupId'].includes(key))) fail('Invalid playback preferences.');
    if (settings.volume != null && (!Number.isFinite(settings.volume) || settings.volume < 0 || settings.volume > 100)) fail('Invalid saved volume.');
    if (settings.fade != null && !['0', '1', '2', '4'].includes(settings.fade)) fail('Invalid saved fade.');
    for (const key of ['normalize', 'autoNext', 'guideHidden']) if (settings[key] != null && typeof settings[key] !== 'boolean') fail('Invalid playback preference.');
    if (settings.gapSeconds != null && (!Number.isFinite(settings.gapSeconds) || settings.gapSeconds < 0 || settings.gapSeconds > 10)) fail('Invalid saved recording gap.');
    if (settings.eventDeadline != null && (typeof settings.eventDeadline !== 'string' || (settings.eventDeadline !== '' && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(settings.eventDeadline)))) fail('Invalid saved event deadline.');
    if (settings.eventDeadline) {
      const parsed = new Date(`${settings.eventDeadline}Z`);
      if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 16) !== settings.eventDeadline) fail('Invalid saved event deadline.');
    }
    if (settings.finalGroupId != null && (typeof settings.finalGroupId !== 'string' || settings.finalGroupId.length > 500)) fail('Invalid saved final tanda.');
    result.settings = structuredClone(settings);
  }
  if (value.audioProcessing != null) {
    const audio = value.audioProcessing;
    if (!plain(audio) || Object.keys(audio).some(key => !['enabled', 'bypass', 'targetLufs', 'headroomDb', 'limiter'].includes(key)) || ['enabled', 'bypass', 'limiter'].some(key => typeof audio[key] !== 'boolean') || !Number.isFinite(audio.targetLufs) || audio.targetLufs < -30 || audio.targetLufs > -12 || !Number.isFinite(audio.headroomDb) || audio.headroomDb < 0.5 || audio.headroomDb > 12) fail('Invalid saved audio processing preferences.');
    result.audioProcessing = structuredClone(audio);
  }
  return result;
}

export async function createBackup({ workspace, preferences = null, histories = null, includeAudio = false, trackIds = null, readyFile, hash = streamHash }) {
  const portable = portableWorkspace(workspace, trackIds), payloads = [], blobs = [], missing = [], byHash = new Map();
  for (const track of portable.tracks.filter(track => track.source === 'local')) {
    if (!includeAudio) { missing.push({ trackId: track.id, title: track.title, reason: 'Audio not included' }); continue; }
    let file;
    try { file = await readyFile(structuredClone(track), true); } catch { file = null; }
    if (!(file instanceof Blob)) { missing.push({ trackId: track.id, title: track.title, reason: 'File unavailable' }); continue; }
    const identity = await hash(file);
    if (!hashPattern.test(identity) || (track.contentHash && track.contentHash !== identity)) fail(`Audio identity changed: ${track.title}. Check the file before backing up.`);
    track.contentHash = identity;
    if (byHash.has(identity)) { byHash.get(identity).trackIds.push(track.id); continue; }
    const entry = { hash: identity, size: file.size, type: file.type || 'application/octet-stream', trackIds: [track.id] };
    byHash.set(identity, entry); payloads.push(entry); blobs.push(file);
  }
  const manifest = { format: 'tango-dj-backup', version: 1, createdAt: new Date().toISOString(), workspace: portable, preferences: preferences === null ? null : validatePreferences(preferences), histories: histories === null ? null : validateSessionSnapshot(histories), payloads, missing };
  const json = new TextEncoder().encode(JSON.stringify(manifest));
  if (json.length > MAX_MANIFEST) fail('Backup metadata is too large. Select fewer histories or recordings.');
  const length = new Uint8Array(8); new DataView(length.buffer).setBigUint64(0, BigInt(json.length), true);
  return { blob: new Blob([MAGIC, length, json, ...blobs], { type: 'application/octet-stream' }), manifest, report: { tracks: portable.tracks.length, audioFiles: payloads.length, audioBytes: payloads.reduce((sum, entry) => sum + entry.size, 0), missing } };
}

export async function inspectBackup(blob, { hash = streamHash } = {}) {
  if (!(blob instanceof Blob) || blob.size < MAGIC.length + 8) fail('Choose a Tango DJ portable backup file.');
  const header = new Uint8Array(await blob.slice(0, MAGIC.length + 8).arrayBuffer());
  if (MAGIC.some((byte, index) => header[index] !== byte)) fail('This is not a Tango DJ portable backup.');
  const length = Number(new DataView(header.buffer).getBigUint64(MAGIC.length, true));
  if (!Number.isSafeInteger(length) || length <= 0 || length > MAX_MANIFEST || MAGIC.length + 8 + length > blob.size) fail('Invalid backup metadata length.');
  let manifest;
  try { manifest = JSON.parse(await blob.slice(MAGIC.length + 8, MAGIC.length + 8 + length).text()); } catch { fail('Backup metadata could not be read.'); }
  if (!plain(manifest) || Object.keys(manifest).some(key => !['format', 'version', 'createdAt', 'workspace', 'preferences', 'histories', 'payloads', 'missing'].includes(key)) || manifest.format !== 'tango-dj-backup' || manifest.version !== 1 || typeof manifest.createdAt !== 'string' || !Number.isFinite(Date.parse(manifest.createdAt)) || !Array.isArray(manifest.payloads) || manifest.payloads.length > 10000 || !Array.isArray(manifest.missing) || manifest.missing.length > 10000) fail('Invalid portable backup manifest.');
  const workspace = portableWorkspace(manifest.workspace);
  const missingIds = new Set();
  for (const entry of manifest.missing) {
    if (!plain(entry) || Object.keys(entry).some(key => !['trackId', 'title', 'reason'].includes(key)) || !workspace.tracks.some(track => track.id === entry.trackId && track.source === 'local' && track.title === entry.title) || !['Audio not included', 'File unavailable'].includes(entry.reason) || missingIds.has(entry.trackId)) fail('Invalid missing-file report.');
    missingIds.add(entry.trackId);
  }
  // Reject hidden fields instead of silently accepting nonportable source data.
  if (JSON.stringify(workspace) !== JSON.stringify(manifest.workspace)) fail('Backup contains unsupported workspace fields.');
  const preferences = manifest.preferences === null ? null : validatePreferences(manifest.preferences);
  const histories = manifest.histories === null ? null : validateSessionSnapshot(manifest.histories);
  const files = new Map(), identities = new Set(); let offset = MAGIC.length + 8 + length;
  for (const entry of manifest.payloads) {
    if (!plain(entry) || Object.keys(entry).some(key => !['hash', 'size', 'type', 'trackIds'].includes(key)) || typeof entry.hash !== 'string' || !hashPattern.test(entry.hash) || identities.has(entry.hash) || !Number.isSafeInteger(entry.size) || entry.size < 0 || typeof entry.type !== 'string' || entry.type.length > 200 || !Array.isArray(entry.trackIds) || !entry.trackIds.length || entry.trackIds.length > 10000 || offset + entry.size > blob.size) fail('Invalid audio entry in backup.');
    const file = blob.slice(offset, offset + entry.size, entry.type); offset += entry.size;
    if (await hash(file) !== entry.hash) fail('Backup audio failed identity verification. Nothing has been restored.');
    identities.add(entry.hash);
    for (const id of entry.trackIds) {
      const track = workspace.tracks.find(track => track.id === id);
      if (!track || track.source !== 'local' || track.contentHash !== entry.hash || files.has(id)) fail('Backup audio does not match its recording metadata.');
      files.set(id, file);
    }
  }
  if (workspace.tracks.some(track => track.source === 'local' && files.has(track.id) === missingIds.has(track.id))) fail('Invalid missing-file report.');
  if (offset !== blob.size) fail('Backup contains unexpected trailing data.');
  const missing = workspace.tracks.filter(track => track.source === 'local' && !files.has(track.id)).map(track => ({ trackId: track.id, title: track.title, reason: 'Relink file after restore' }));
  return { workspace, preferences, histories, files, manifest, report: { tracks: workspace.tracks.length, audioFiles: identities.size, audioBytes: manifest.payloads.reduce((sum, entry) => sum + entry.size, 0), missing } };
}

export function selectBackupRestore(verified, { trackIds = null, preferences = true, histories = true } = {}) {
  const workspace = portableWorkspace(verified.workspace, trackIds), selected = new Set(workspace.tracks.map(track => track.id));
  return { workspace, files: new Map([...verified.files].filter(([id]) => selected.has(id))), preferences: preferences ? verified.preferences : null, histories: histories ? verified.histories : null };
}

function sideValues(preferences, histories) {
  const values = {};
  if (preferences !== null) {
    const saved = validatePreferences(preferences);
    if (saved.settings) values['studio-settings'] = JSON.stringify(saved.settings);
    if (saved.language) values['studio-language'] = saved.language;
    if (saved.audioProcessing) values['studio-audio-processing'] = JSON.stringify(saved.audioProcessing);
  }
  if (histories !== null) values['studio-dj-session'] = serializeSessionSnapshot(histories);
  return values;
}
function setValues(storage, values) {
  for (const [key, value] of Object.entries(values)) { if (value === null) storage.removeItem(key); else storage.setItem(key, value); }
}
function recoveryError(cause) { const error = new Error('Backup restore recovery is pending. Keep this browser open and retry recovery before another restore.', { cause }); error.code = 'backup-recovery-pending'; return error; }

export async function commitBackupRestore({ workspace, files, preferences = null, histories = null, expectedRevision }, { storage = globalThis.localStorage, commitWorkspace = restoreWorkspace, now = () => crypto.randomUUID() } = {}) {
  const portable = portableWorkspace(workspace), next = sideValues(preferences, histories), previous = {};
  if (!(files instanceof Map)) fail('Invalid restore audio.');
  // Reverify at the commit boundary; callers cannot bypass the review validator.
  for (const [id, file] of files) {
    const track = portable.tracks.find(track => track.id === id);
    if (!track || track.source !== 'local' || !(file instanceof Blob) || await streamHash(file) !== track.contentHash) fail('Restore audio failed identity verification. Nothing has been restored.');
  }
  const id = now();
  try {
    if (storage.getItem(RECOVERY_KEY) !== null) throw recoveryError();
    for (const key of Object.keys(next)) previous[key] = storage.getItem(key);
    storage.setItem(RECOVERY_KEY, JSON.stringify({ version: 1, id, previous, next }));
    setValues(storage, next);
  } catch (cause) {
    if (cause?.code === 'backup-recovery-pending') throw cause;
    try { setValues(storage, previous); storage.removeItem(RECOVERY_KEY); } catch { throw recoveryError(cause); }
    throw new Error('Preferences or histories could not be staged. Nothing has been restored.', { cause });
  }
  let revision;
  try { revision = await commitWorkspace(portable, files, expectedRevision, id); }
  catch (cause) {
    try { setValues(storage, previous); storage.removeItem(RECOVERY_KEY); } catch { throw recoveryError(cause); }
    throw cause;
  }
  try { storage.removeItem(RECOVERY_KEY); }
  catch { return { revision, recoveryPending: true }; }
  return { revision, recoveryPending: false };
}

export async function recoverBackupRestore({ storage = globalThis.localStorage, getWorkspace = loadState } = {}) {
  let raw;
  try { raw = storage.getItem(RECOVERY_KEY); } catch (cause) { throw recoveryError(cause); }
  if (raw === null) return { status: 'none' };
  try {
    const journal = JSON.parse(raw), allowed = new Set(['studio-settings', 'studio-language', 'studio-audio-processing', 'studio-dj-session']);
    if (!plain(journal) || Object.keys(journal).some(key => !['version', 'id', 'previous', 'next'].includes(key)) || journal.version !== 1 || typeof journal.id !== 'string' || !journal.id.trim() || journal.id.length > 500 || !plain(journal.previous) || !plain(journal.next) || Object.keys(journal.previous).some(key => !allowed.has(key)) || Object.keys(journal.next).some(key => !allowed.has(key)) || Object.keys(journal.previous).length !== Object.keys(journal.next).length || Object.keys(journal.next).some(key => !Object.hasOwn(journal.previous, key)) || Object.values(journal.previous).some(value => value !== null && typeof value !== 'string') || Object.values(journal.next).some(value => typeof value !== 'string')) fail('Invalid backup recovery journal.');
    const next = journal.next, settings = Object.hasOwn(next, 'studio-settings') ? JSON.parse(next['studio-settings']) : undefined, audioProcessing = Object.hasOwn(next, 'studio-audio-processing') ? JSON.parse(next['studio-audio-processing']) : undefined;
    if ((settings !== undefined && !plain(settings)) || (audioProcessing !== undefined && !plain(audioProcessing))) fail('Invalid backup recovery journal.');
    validatePreferences({
      ...(settings !== undefined ? { settings } : {}),
      ...(Object.hasOwn(next, 'studio-language') ? { language: next['studio-language'] } : {}),
      ...(audioProcessing !== undefined ? { audioProcessing } : {}),
    });
    if (Object.hasOwn(next, 'studio-dj-session')) parseSessionSnapshot(next['studio-dj-session']);
    const committed = (await getWorkspace())?.backupRestoreId === journal.id;
    setValues(storage, committed ? journal.next : journal.previous); storage.removeItem(RECOVERY_KEY);
    return { status: committed ? 'restored' : 'rolled-back' };
  } catch (cause) { throw recoveryError(cause); }
}
