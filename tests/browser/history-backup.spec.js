import { readFile } from 'node:fs/promises';
import { test, expect } from './saved-workspace.js';

async function seed(page) {
  await page.route('https://**', route => route.abort());
  await page.evaluate(async () => {
    localStorage.setItem('studio-language', 'en');
    localStorage.setItem('studio-settings', JSON.stringify({ volume: 67, fade: '1', normalize: true, autoNext: false, gapSeconds: 1, eventDeadline: '2026-11-09T23:00', finalGroupId: 't' }));
    const count = 8000 * 6, bytes = new Uint8Array(44 + count * 2), view = new DataView(bytes.buffer);
    const word = (offset, value) => [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
    word(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); word(8, 'WAVE'); word(12, 'fmt '); view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 8000, true); view.setUint32(28, 16000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    word(36, 'data'); view.setUint32(40, count * 2, true); for (let i = 0; i < count; i++) view.setInt16(44 + i * 2, Math.round(1000 * Math.sin(i / 8000 * Math.PI * 440)), true);
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('');
    const track = { id: 'local', source: 'local', title: 'Poema', artist: 'Canaro', style: 'Tango', duration: 6, contentHash: hash, fileName: '/private-music/original.wav', cueStartSeconds: 1, cueEndSeconds: 4, notes: 'Gentle opening', tags: ['opening'], rating: 4, bpm: 64, bpmConfidence: 0.8, bpmCandidates: [64, 128], bpmSource: 'estimate', integratedLufs: -20, truePeakDb: -3, loudnessAnalysisVersion: 'bs1770-k-4x-v1', measuredSeconds: 6, provenance: [{ format: 'csv', sourceName: 'library.csv', sourceHash: 'a'.repeat(64), row: 2, reference: 'original.wav' }] };
    const workspace = { tracks: [track, { id: 'video', source: 'youtube', title: 'El choclo', videoId: 'abcdefghijk', duration: 180, style: 'Tango' }], groups: [{ id: 't', kind: 'tanda', name: 'Opening tanda', trackIds: ['local', 'video'], occurrenceIds: ['first', 'second'] }], collections: [{ id: 'c', name: 'Candidates', trackIds: ['local', 'video'] }], presets: [], revision: 2 };
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open('tango-dj-studio', 2); request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('sources')) request.result.createObjectStore('sources'); }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    await new Promise((resolve, reject) => { const tx = db.transaction(['state', 'files', 'sources'], 'readwrite'); tx.objectStore('state').put(workspace, 'current'); tx.objectStore('files').put({ audioBytes: bytes.buffer, type: 'audio/wav' }, 'local'); tx.objectStore('sources').put({ fixture: true }, 'local'); tx.oncomplete = resolve; tx.onabort = () => reject(tx.error); }); db.close();
    const { DJSession } = await import('/src/session.js'); const session = new DJSession();
    session.start('Friday milonga'); session.recordPlayback(101, { track, groupId: 't', groupName: 'Opening tanda', occurrenceId: 'first' }, 1); session.annotate(session.id, 'Opening worked well');
    session.start('Deleted event'); const deleted = session.id; session.start('Saturday milonga'); session.deleteHistory(deleted);
  });
  await page.goto('/'); await expect(page.locator('#library-count')).toHaveText('2');
}
async function nav(page, view) {
  await expect(page.locator('.workspace-title h1')).toBeVisible();
  const button = page.locator(`button[data-view="${view}"]`);
  if (await button.isVisible()) await button.click();
  else await page.locator(`.sidebar a[href="#${view}"]`).click();
}
async function openSettings(page) {
  if (!(await page.locator('#open-settings').isVisible())) await page.locator('#open-menu').click();
  await page.locator('#open-settings').click();
}
async function openBackup(page) {
  await openSettings(page); await page.locator('#open-backup').click();
  await expect(page.locator('#backup-dialog')).toBeVisible();
}
async function bundle(page, audio = true) {
  await openBackup(page); if (audio) await page.locator('#backup-audio').check();
  await page.locator('#prepare-backup').click(); await expect(page.locator('#download-backup')).toBeEnabled();
  const waiting = page.waitForEvent('download'); await page.locator('#download-backup').click();
  return readFile(await (await waiting).path());
}
async function inspect(page, bytes) {
  await page.locator('#backup-dialog details').filter({ has: page.locator('summary', { hasText: 'Restore backup' }) }).locator('summary').click();
  await page.locator('#backup-input').setInputFiles({ name: 'portable.tdjb', mimeType: 'application/octet-stream', buffer: bytes });
  await expect(page.locator('#restore-review')).toBeVisible();
}
async function database(page) {
  return page.evaluate(async () => {
    const { loadState, getFile } = await import('/src/storage.js'), { streamHash } = await import('/src/stream-hash.js');
    const state = await loadState(), file = await getFile('local');
    return { state, audioHash: file ? await streamHash(file) : null, settings: localStorage.getItem('studio-settings'), histories: localStorage.getItem('studio-dj-session') };
  });
}

 test('archived history search, annotations, selected CSV and recoverable deletion survive reload', async ({ page }) => {
  await seed(page); await nav(page, 'deck'); await page.locator('#open-session-history').click();
  await expect(page.locator('#history-session option')).toHaveCount(2);
  const first = await page.locator('#history-session option').filter({ hasText: 'Friday milonga' }).getAttribute('value');
  await page.locator('#history-session').selectOption(first); await expect(page.locator('#session-history strong')).toHaveText('Poema');
  await page.locator('#history-note').fill('Excellent opening flow'); await page.locator('#save-history-note').click();
  await page.locator('#history-search').fill('excellent'); await expect(page.locator('[data-history-select]')).toHaveCount(1);
  await page.locator('[data-history-select]').check();
  const waiting = page.waitForEvent('download'); await page.locator('#export-session').click(); const csv = await readFile(await (await waiting).path(), 'utf8');
  expect(csv).toContain('Friday milonga'); expect(csv).toContain('Excellent opening flow'); expect(csv).not.toContain('Saturday milonga');
  page.once('dialog', dialog => dialog.accept()); await page.locator('#delete-history').click(); await expect(page.locator('#history-session option')).toHaveCount(1);
  await page.locator('#session-dialog details summary').click(); await page.locator(`[data-restore-history="${first}"]`).click();
  await page.reload(); await nav(page, 'deck'); await page.locator('#open-session-history').click();
  await expect(page.locator('#history-session option')).toHaveCount(2); await page.locator('#history-session').selectOption(first);
  await expect(page.locator('#history-note')).toHaveValue('Excellent opening flow');
  await page.locator('[data-history-event]').check();
  const eventDownload = page.waitForEvent('download'); await page.locator('#export-session').click();
  const eventCSV = await readFile(await (await eventDownload).path(), 'utf8'); expect(eventCSV).toContain('Friday milonga'); expect(eventCSV).toContain('Poema'); expect(eventCSV).not.toContain('Saturday milonga');
 });

 test('audio-inclusive reviewed backup restores identity, cues, metadata, preferences and all histories in a fresh browser', async ({ page, browser }, testInfo) => {
  await seed(page); const bytes = await bundle(page);
  const options = Object.fromEntries(['viewport', 'isMobile', 'hasTouch', 'deviceScaleFactor', 'userAgent'].filter(key => testInfo.project.use[key] !== undefined).map(key => [key, testInfo.project.use[key]]));
  const fresh = await browser.newContext(options); await fresh.addInitScript(() => { localStorage.setItem('studio-language', 'en'); }); const target = await fresh.newPage();
  try {
    await target.goto(new URL('/', page.url()).href); await expect(target.locator('.workspace-title h1')).toBeVisible(); await openBackup(target); await inspect(target, bytes);
    await expect(target.locator('#restore-summary')).toContainText('1 audio files');
    await target.locator('#confirm-backup-restore').click(); await expect(target.locator('#backup-status')).toContainText('Playback is stopped');
    const saved = await database(target), track = saved.state.tracks.find(track => track.id === 'local');
    expect(saved.audioHash).toBe(track.contentHash); expect(track.cueStartSeconds).toBe(1); expect(track.cueEndSeconds).toBe(4); expect(track.fileName).toBe('original.wav');
    expect(track.tags).toEqual(['opening']); expect(track.rating).toBe(4); expect(track.provenance[0].sourceName).toBe('library.csv'); expect(track.bpmCandidates).toEqual([64, 128]); expect(track.integratedLufs).toBe(-20);
    expect(saved.state.groups[0].occurrenceIds).toEqual(['first', 'second']); expect(saved.state.collections[0].trackIds).toEqual(['local', 'video']);
    expect(JSON.parse(saved.settings).volume).toBe(67); expect(JSON.parse(saved.settings).eventDeadline).toBe('2026-11-09T23:00');
    expect(JSON.parse(saved.histories).archives[0].name).toBe('Friday milonga'); expect(JSON.parse(saved.histories).trash[0].history.name).toBe('Deleted event');
    await expect(target.locator('#playing-title')).toHaveText('No recording loaded'); await expect(target.locator('.queue-item')).toHaveCount(0);
    await target.reload(); expect((await database(target)).audioHash).toBe(track.contentHash);
  } finally { await fresh.close(); }
 });

 test('metadata-only reviewed selection reports missing files and excludes unselected recordings', async ({ page }) => {
  await seed(page); const bytes = await bundle(page, false); await inspect(page, bytes);
  await expect(page.locator('#restore-summary')).toContainText('Files to relink');
  await page.locator('#restore-recordings [data-backup-track=video]').uncheck(); await page.locator('#restore-preferences').uncheck();
  await page.locator('#confirm-backup-restore').click(); await expect(page.locator('#backup-status')).toContainText('Playback is stopped');
  const saved = await database(page); expect(saved.state.tracks.map(track => track.id)).toEqual(['local']); expect(saved.audioHash).toBe(null); expect(saved.state.groups[0].trackIds).toEqual(['local']); expect(saved.state.groups[0].occurrenceIds).toEqual(['first']);
 });

 test('tampered audio is rejected before any library, preference or history mutation', async ({ page }) => {
  await seed(page); const bytes = await bundle(page), before = await database(page); bytes[bytes.length - 1] ^= 255;
  await page.locator('#backup-dialog details').filter({ has: page.locator('summary', { hasText: 'Restore backup' }) }).locator('summary').click();
  await page.locator('#backup-input').setInputFiles({ name: 'tampered.tdjb', mimeType: 'application/octet-stream', buffer: bytes });
  await expect(page.locator('#backup-status')).toContainText('identity verification'); await expect(page.locator('#restore-review')).toBeHidden();
  expect(await database(page)).toEqual(before);
 });

 test('transaction failure after clearing audio restores original workspace, bytes, preferences and histories', async ({ page }) => {
  await seed(page); const bytes = await bundle(page), before = await database(page); await inspect(page, bytes);
  await page.evaluate(() => { const put = IDBObjectStore.prototype.put; window.restoreAudioPut = put; IDBObjectStore.prototype.put = function(...args) { if (this.name === 'files') throw new DOMException('Full', 'QuotaExceededError'); return put.apply(this, args); }; });
  await page.locator('#confirm-backup-restore').click(); await expect(page.locator('#backup-status')).toContainText('Browser storage is full');
  expect(await database(page)).toEqual(before);
  await page.evaluate(() => { IDBObjectStore.prototype.put = function(...args) { const request = window.restoreAudioPut.apply(this, args); if (this.name === 'files') this.add(...args); return request; }; });
  await page.locator('#confirm-backup-restore').click(); await expect(page.locator('#backup-status')).not.toHaveText(/Backup verified|Restoring backup|Browser storage is full/);
  await expect(page.locator('#confirm-backup-restore')).toBeEnabled(); expect(await database(page)).toEqual(before);
 });

test('a workspace changed in another tab rejects restore and preserves the latest database and audio', async ({ page }) => {
  await seed(page); const bytes = await bundle(page); await inspect(page, bytes);
  await page.evaluate(async () => { const { loadState, saveState } = await import('/src/storage.js'); const state = await loadState(); state.tracks[0].title = 'Latest library edit'; await saveState(state, state.revision); });
  const before = await database(page);
  await page.locator('#confirm-backup-restore').click(); await expect(page.locator('#backup-status')).toContainText('changed in another tab');
  expect(await database(page)).toEqual(before);
});

test('startup recovery follows the restore marker through later workspace saves without autoplay', async ({ page }) => {
  await seed(page);
  await page.evaluate(async () => {
    const { loadState, saveState, restoreWorkspace } = await import('/src/storage.js'); const state = await loadState();
    await restoreWorkspace(state, new Map(), state.revision, 'interrupted-restore');
    const restored = await loadState(); delete restored.backupRestoreId; await saveState(restored, restored.revision);
    localStorage.setItem('studio-backup-restore-recovery', JSON.stringify({ version: 1, id: 'interrupted-restore', previous: { 'studio-settings': JSON.stringify({ volume: 23 }) }, next: { 'studio-settings': JSON.stringify({ volume: 77, fade: '1' }) } }));
    localStorage.setItem('studio-settings', JSON.stringify({ volume: 23 }));
  });
  await page.reload(); await expect(page.locator('#volume')).toHaveValue('77');
  await expect(page.locator('#playing-title')).toHaveText('No recording loaded');
  expect(await page.evaluate(() => localStorage.getItem('studio-backup-restore-recovery'))).toBeNull();
  expect((await database(page)).state.backupRestoreId).toBe('interrupted-restore');
});

test('pending verification locks mutable choices until the inspected file has been verified', async ({ page }) => {
  await seed(page); const bytes = await bundle(page);
  await page.evaluate(() => {
    const read = Blob.prototype.arrayBuffer;
    const pending = new Promise(resolve => { window.releaseBackupReads = resolve; });
    Blob.prototype.arrayBuffer = async function(...args) { await pending; return read.apply(this, args); };
    window.restoreBackupReads = () => { Blob.prototype.arrayBuffer = read; window.releaseBackupReads(); };
  });
  try {
    await page.locator('#backup-dialog details').filter({ has: page.locator('summary', { hasText: 'Restore backup' }) }).locator('summary').click();
    await page.locator('#backup-input').setInputFiles({ name: 'portable.tdjb', mimeType: 'application/octet-stream', buffer: bytes });
    await expect(page.locator('#backup-input')).toBeDisabled(); await expect(page.locator('#backup-audio')).toBeDisabled(); await expect(page.locator('#confirm-backup-restore')).toBeDisabled();
    await page.evaluate(() => window.restoreBackupReads());
    await expect(page.locator('#restore-review')).toBeVisible(); await expect(page.locator('#backup-input')).toBeEnabled(); await expect(page.locator('#confirm-backup-restore')).toBeEnabled();
    await expect(page.locator('#restore-summary')).toContainText('1 audio files');
  } finally { await page.evaluate(() => window.restoreBackupReads()); }
});

test('deleted histories can be exported before explicitly confirmed permanent removal', async ({ page }) => {
  await seed(page); await nav(page, 'deck'); await page.locator('#open-session-history').click();
  const archived = await page.locator('#history-session option').filter({ hasText: 'Friday milonga' }).getAttribute('value');
  await page.locator('#history-session').selectOption(archived);
  page.once('dialog', dialog => dialog.accept()); await page.locator('#delete-history').click(); await page.locator('#session-dialog details summary').click();
  const waiting = page.waitForEvent('download'); await page.locator(`[data-export-history="${archived}"]`).click();
  const csv = await readFile(await (await waiting).path(), 'utf8'); expect(csv).toContain('Friday milonga'); expect(csv).toContain('Poema');
  page.once('dialog', dialog => dialog.dismiss()); await page.locator(`[data-purge-history="${archived}"]`).click(); await expect(page.locator(`[data-restore-history="${archived}"]`)).toBeVisible();
  page.once('dialog', dialog => dialog.accept()); await page.locator(`[data-purge-history="${archived}"]`).click(); await expect(page.locator(`[data-restore-history="${archived}"]`)).toHaveCount(0);
  await page.reload(); await nav(page, 'deck'); await page.locator('#open-session-history').click();
  await expect(page.locator(`#history-session option[value="${archived}"]`)).toHaveCount(0); await expect(page.locator(`[data-restore-history="${archived}"]`)).toHaveCount(0);
});

test('audio conversion failure rolls back staged preferences before opening a workspace transaction', async ({ page }) => {
  await seed(page); const before = await database(page);
  const result = await page.evaluate(async () => {
    const { loadState, getFile } = await import('/src/storage.js'), { commitBackupRestore } = await import('/src/backup.js');
    const workspace = await loadState(), file = await getFile('local'); file.arrayBuffer = async () => { throw new Error('Audio conversion failed'); };
    const transaction = IDBDatabase.prototype.transaction; let writes = 0;
    IDBDatabase.prototype.transaction = function(...args) { if (args[1] === 'readwrite') writes++; return transaction.apply(this, args); };
    try { await commitBackupRestore({ workspace, files: new Map([['local', file]]), preferences: { settings: { volume: 12 }, language: 'es' }, expectedRevision: workspace.revision }); return { error: null, writes }; }
    catch (error) { return { error: error.message, writes }; }
    finally { IDBDatabase.prototype.transaction = transaction; }
  });
  expect(result).toEqual({ error: 'Audio conversion failed', writes: 0 }); expect(await database(page)).toEqual(before);
  expect(await page.evaluate(() => localStorage.getItem('studio-backup-restore-recovery'))).toBeNull();
  const guarded = await page.evaluate(async () => {
    const { loadState, getFile, restoreWorkspace } = await import('/src/storage.js'), { commitBackupRestore } = await import('/src/backup.js');
    const workspace = await loadState(), file = await getFile('local'), read = file.arrayBuffer.bind(file); let allowed = true;
    file.arrayBuffer = async () => { const bytes = await read(); allowed = false; return bytes; };
    try { await commitBackupRestore({ workspace, files: new Map([['local', file]]), preferences: { settings: { volume: 13 }, language: 'es' }, expectedRevision: workspace.revision }, { commitWorkspace: (...args) => restoreWorkspace(...args, () => { if (!allowed) throw new Error('Workspace changed during audio conversion'); }) }); return null; }
    catch (error) { return error.message; }
  });
  expect(guarded).toBe('Workspace changed during audio conversion'); expect(await database(page)).toEqual(before);
  expect(await page.evaluate(() => localStorage.getItem('studio-backup-restore-recovery'))).toBeNull();
});
