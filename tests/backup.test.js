import test from 'node:test';
import assert from 'node:assert/strict';
import { streamHash } from '../src/stream-hash.js';
import { createBackup, inspectBackup, selectBackupRestore, validatePreferences, commitBackupRestore, recoverBackupRestore } from '../src/backup.js';
import { DJSession } from '../src/session.js';

async function fixture() {
  const audio = new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: 'audio/wav' }), hash = await streamHash(audio);
  const tracks = ['a', 'alias'].map(id => ({ id, title: id, source: 'local', contentHash: hash, cueStartSeconds: 2, cueEndSeconds: 8, sourcePath: '/private-music/song.wav', deviceId: 'private-output' }));
  tracks.push({ id: 'missing', title: 'Missing file', source: 'local' }, { id: 'video', title: 'Video', source: 'youtube', videoId: 'abcdefghijk' });
  const workspace = { tracks, groups: [{ id: 't', name: 'Opening', kind: 'tanda', trackIds: ['a', 'alias', 'video'], occurrenceIds: ['first', 'repeat', 'video-placement'] }], collections: [{ id: 'set', name: 'Candidates', trackIds: ['a', 'video'] }], presets: [] };
  const session = new DJSession({ storage: null }); session.start('Past'); session.recordPlayback(1, { track: tracks[0] }, 2); session.start('Current');
  const preferences = { settings: { volume: 75, fade: '2', eventDeadline: '2026-11-09T23:00', finalGroupId: 't' }, language: 'en', audioProcessing: { enabled: true, bypass: false, targetLufs: -18, headroomDb: 1, limiter: true } };
  return { audio, identity: hash, workspace, histories: session.snapshot(), preferences, readyFile: async track => track.id === 'missing' ? null : audio };
}
function memory(values = {}) {
  const entries = new Map(Object.entries(values));
  return { entries, storage: { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) } };
}

test('binary backups deduplicate verified audio and preserve cues, sets, preferences and all histories', async () => {
  const input = await fixture(), backup = await createBackup({ ...input, includeAudio: true });
  assert.equal(backup.report.audioFiles, 1); assert.equal(backup.report.missing.length, 1);
  assert.doesNotMatch(JSON.stringify(backup.manifest), /sourcePath|deviceId|private-music|base64|handle/);
  const verified = await inspectBackup(backup.blob);
  assert.equal(verified.files.size, 2); assert.equal(await streamHash(verified.files.get('a')), input.identity);
  assert.deepEqual(verified.workspace.groups[0].occurrenceIds, ['first', 'repeat', 'video-placement']);
  assert.equal(verified.workspace.tracks[0].cueEndSeconds, 8); assert.deepEqual(verified.histories, input.histories); assert.deepEqual(verified.preferences, input.preferences);
  const selected = selectBackupRestore(verified, { trackIds: ['alias', 'video'], preferences: false });
  assert.deepEqual(selected.workspace.groups[0].trackIds, ['alias', 'video']); assert.deepEqual(selected.workspace.groups[0].occurrenceIds, ['repeat', 'video-placement']);
  assert.equal(selected.files.size, 1); assert.equal(selected.preferences, null);
});

test('metadata-only backups report every local recording for relinking', async () => {
  const input = await fixture(), backup = await createBackup(input), verified = await inspectBackup(backup.blob);
  assert.equal(verified.files.size, 0); assert.equal(verified.report.missing.length, 3); assert.equal(verified.workspace.tracks.length, 4);
});

test('tampered or truncated audio and changed source identity fail before restore', async () => {
  const input = await fixture(), backup = await createBackup({ ...input, includeAudio: true });
  const bytes = new Uint8Array(await backup.blob.arrayBuffer()); bytes[bytes.length - 1] ^= 255;
  await assert.rejects(inspectBackup(new Blob([bytes])), /identity verification/);
  await assert.rejects(inspectBackup(backup.blob.slice(0, backup.blob.size - 1)), /Invalid audio entry/);
  await assert.rejects(createBackup({ ...input, includeAudio: true, readyFile: async () => new Blob(['changed']) }), /identity changed/);
});

test('portable preferences reject devices and invalid processing or playback values', () => {
  assert.throws(() => validatePreferences({ deviceId: 'private' }));
  assert.throws(() => validatePreferences({ settings: { previewDeviceId: 'private' } }));
  assert.throws(() => validatePreferences({ settings: { eventDeadline: 'tomorrow' } }));
  assert.throws(() => validatePreferences({ audioProcessing: { enabled: true, bypass: false, limiter: true, targetLufs: 0, headroomDb: 1 } }));
});

test('database restore failure rolls back staged preferences and histories', async () => {
  const input = await fixture(), verified = await inspectBackup((await createBackup({ ...input, includeAudio: true })).blob);
  const { storage, entries } = memory({ 'studio-settings': '{old-settings}', 'studio-language': 'ko', 'studio-dj-session': '{old-history}' });
  const before = new Map(entries);
  await assert.rejects(commitBackupRestore({ ...verified, expectedRevision: 5 }, { storage, commitWorkspace: async () => { throw new Error('Revision conflict'); } }), /Revision conflict/);
  assert.deepEqual(entries, before);
});

test('staging failure leaves the database untouched and restores already written local values', async () => {
  const input = await fixture(), { storage, entries } = memory({ 'studio-settings': '{old}', 'studio-language': 'ko' });
  const before = new Map(entries), write = storage.setItem; let fail = true, commits = 0;
  storage.setItem = (key, value) => { if (key === 'studio-language' && fail) { fail = false; throw new Error('Quota'); } write(key, value); };
  await assert.rejects(commitBackupRestore({ workspace: input.workspace, files: new Map(), preferences: input.preferences, histories: null, expectedRevision: 0 }, { storage, commitWorkspace: async () => { commits++; } }), /Nothing has been restored/);
  assert.equal(commits, 0); assert.deepEqual(entries, before);
});

test('interrupted restore recovery follows the atomic database marker', async () => {
  for (const committed of [false, true]) {
    const journal = { version: 1, id: 'restore-id', previous: { 'studio-language': 'ko' }, next: { 'studio-language': 'en' } };
    const { storage, entries } = memory({ 'studio-backup-restore-recovery': JSON.stringify(journal), 'studio-language': 'en' });
    const result = await recoverBackupRestore({ storage, getWorkspace: async () => committed ? { backupRestoreId: 'restore-id' } : {} });
    assert.equal(result.status, committed ? 'restored' : 'rolled-back'); assert.equal(entries.get('studio-language'), committed ? 'en' : 'ko'); assert.equal(entries.has('studio-backup-restore-recovery'), false);
  }
});

test('commit rechecks audio identity even if an inspected backup result was replaced', async () => {
  const input = await fixture(), { storage } = memory(); let commits = 0;
  await assert.rejects(commitBackupRestore({ workspace: input.workspace, files: new Map([['a', new Blob(['tampered'])]]), expectedRevision: 0 }, { storage, commitWorkspace: async () => { commits++; } }), /identity verification/);
  assert.equal(commits, 0);
});

test('invalid recovery payloads are retained without mutating saved preferences or histories', async () => {
  for (const [key, value] of [['studio-settings', 'null'], ['studio-settings', JSON.stringify({ deviceId: 'unportable' })], ['studio-language', 'unknown'], ['studio-audio-processing', '{}'], ['studio-dj-session', '{}']]) {
    const journal = { version: 1, id: 'restore-id', previous: { [key]: 'preserved' }, next: { [key]: value } };
    const { storage, entries } = memory({ 'studio-backup-restore-recovery': JSON.stringify(journal), [key]: 'preserved' }), before = new Map(entries);
    await assert.rejects(recoverBackupRestore({ storage, getWorkspace: async () => ({ backupRestoreId: 'restore-id' }) }), error => error.code === 'backup-recovery-pending');
    assert.deepEqual(entries, before);
  }
});

test('successful database commit retains recoverable staging when journal cleanup is unavailable', async () => {
  const input = await fixture(), { storage, entries } = memory({ 'studio-language': 'ko' }), remove = storage.removeItem;
  storage.removeItem = () => { throw new Error('Storage unavailable'); };
  const result = await commitBackupRestore({ workspace: input.workspace, files: new Map(), preferences: { language: 'en' }, expectedRevision: 0 }, { storage, now: () => 'restore-id', commitWorkspace: async () => 1 });
  assert.equal(result.recoveryPending, true); assert.equal(entries.get('studio-language'), 'en');
  await assert.rejects(commitBackupRestore({ workspace: input.workspace, files: new Map(), expectedRevision: 1 }, { storage }), error => error.code === 'backup-recovery-pending');
  storage.removeItem = remove;
  assert.deepEqual(await recoverBackupRestore({ storage, getWorkspace: async () => ({ backupRestoreId: 'restore-id' }) }), { status: 'restored' });
  assert.equal(entries.has('studio-backup-restore-recovery'), false);
});

test('backup review rejects inconsistent missing-file reports', async () => {
  const input = await fixture(), backup = await createBackup(input), headerLength = new TextEncoder().encode('TANGO-DJ-BACKUP\n').length;
  const metadata = { ...backup.manifest, missing: [] }, json = new TextEncoder().encode(JSON.stringify(metadata)), length = new Uint8Array(8);
  new DataView(length.buffer).setBigUint64(0, BigInt(json.length), true);
  await assert.rejects(inspectBackup(new Blob([backup.blob.slice(0, headerLength), length, json])), /missing-file report/);
});
