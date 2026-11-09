import { readFile } from 'node:fs/promises';
import { test, expect, recordingAction } from './saved-workspace.js';

const video = (id, number, values = {}) => ({ id, source: 'youtube', videoId: `abcdefghij${number}`, title: id.toUpperCase(), duration: 180, style: 'Tango', ...values });
const workspace = () => ({
  tracks: [
    video('a', 0, { title: 'Poema', artist: 'Francisco Canaro', singer: 'Roberto Maida', year: '1935', bpm: 64, tags: ['opening'], rating: 4, cueStartSeconds: 10, cueEndSeconds: 70 }),
    video('b', 1, { title: 'El adiós', artist: 'Francisco Canaro', singer: 'Roberto Maida', year: '1938', bpm: 66, tags: ['opening'], rating: 5 }),
    video('unknown', 2, { title: 'Unknown transfer', artist: 'Francisco Canaro', singer: 'Roberto Maida', tags: ['opening'] }),
    video('instrumental', 3, { title: 'Instrumental tango', artist: 'D’Arienzo', singer: 'Instrumental', year: '1940', bpm: 68 }),
    { id: 'local', source: 'local', title: 'Missing local', fileName: 'missing.wav', style: 'Tango', duration: 180 },
  ],
  groups: [{ id: 't', kind: 'tanda', name: 'Opening tanda', trackIds: ['a', 'b'], collapsed: false }],
  collections: [{ id: 'c', name: 'Candidates', trackIds: ['a', 'b', 'unknown'] }], presets: [],
});

async function bootstrap(page, state = workspace()) {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('https://**', route => route.abort());
  await page.addInitScript(() => {
    localStorage.setItem('studio-language', 'en');
    window.YT = { Player: class {
      constructor(id, options) { this.options = options; this.state = 2; this.position = 0; this.loads = 0; window.testYT = this; setTimeout(() => options.events.onReady(), 0); }
      loadVideoById(value) { this.id = typeof value === 'string' ? value : value.videoId; this.position = typeof value === 'string' ? 0 : value.startSeconds || 0; this.state = 1; this.loads++; this.options.events.onStateChange({ data: 1 }); }
      getPlayerState() { return this.state; } getCurrentTime() { return this.position; } getDuration() { return 180; } getVideoUrl() { return `https://www.youtube.com/watch?v=${this.id}`; }
      pauseVideo() { this.state = 2; this.options.events.onStateChange({ data: 2 }); } playVideo() { this.state = 1; this.options.events.onStateChange({ data: 1 }); } setVolume() {} seekTo(value) { this.position = value; }
    } };
  });
  await page.goto('/');
  await page.evaluate(async state => {
    const { loadState, saveState } = await import('/src/storage.js');
    const saved = await loadState(); await saveState(state, saved.revision);
  }, state);
  await page.reload();
  await expect(page.locator('#library-count')).toHaveText(String(state.tracks.length)).catch(error => { throw new Error(`${error.message}\nApp errors: ${errors.join('; ')}`); });
  await nav(page, 'library'); await page.locator('.library-tools summary').click();
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
async function start(page) {
  await nav(page, 'set'); await page.locator('#start-set').click(); await expect(page.locator('#playing-title')).toHaveText('Poema');
  await page.evaluate(() => { testYT.position = 42; }); await nav(page, 'library');
}
const saved = page => page.evaluate(async () => (await import('/src/storage.js')).loadState());
const playback = page => page.evaluate(() => ({ id: testYT.id, position: testYT.position, state: testYT.state, loads: testYT.loads, session: JSON.parse(localStorage.getItem('studio-dj-session')) }));
const visibleIds = page => page.locator('#tracks [data-track]').evaluateAll(rows => rows.map(row => row.dataset.track));
async function readImport(page, text, name = 'library.csv') {
  await page.locator('#open-library-import').click();
  await page.locator('#library-import-file').setInputFiles({ name, mimeType: name.endsWith('.csv') ? 'text/csv' : 'audio/x-mpegurl', buffer: Buffer.from(text) });
  await expect(page.locator('#apply-library-import')).toBeEnabled();
}
async function saveDetails(page, id, notes, tags, rating) {
  await recordingAction(page, 'library-details', id);
  await page.locator('#recording-notes-form [name=notes]').fill(notes); await page.locator('#recording-notes-form [name=tags]').fill(tags);
  await page.locator('#recording-notes-form [name=rating]').selectOption(String(rating)); await page.locator('#recording-notes-form [type=submit]').click();
  await expect(page.locator('#recording-notes-dialog')).toBeHidden();
}
async function setBatch(page, field, mode, value) {
  await page.locator(`#batch-edit-form [name=${field}-mode]`).selectOption(mode);
  if (value != null) await page.locator(`#batch-edit-form [name=${field}-value]`).fill(String(value));
}

test('combined filters, unknown ranges, sorting and reset work without changing saved library order', async ({ page }) => {
  await bootstrap(page);
  const query = name => page.locator(`#library-query [name=${name}]`);
  await query('artist').fill('CANARO'); await query('singer').fill('maida'); await query('tag').fill('opening');
  await query('yearMin').fill('1930'); await query('yearMax').fill('1939'); await query('bpmMin').fill('63'); await query('bpmMax').fill('67');
  await query('vocal').selectOption('vocal'); await query('ratingMin').selectOption('4'); await query('readiness').selectOption('online');
  await page.locator('#collection-filter').selectOption('c'); await page.locator('#style-filter').selectOption('Tango');
  await query('sort').selectOption('year'); await query('direction').selectOption('desc');
  expect(await visibleIds(page)).toEqual(['b', 'a', 'unknown']);
  await query('includeUnknown').uncheck(); expect(await visibleIds(page)).toEqual(['b', 'a']);
  await query('direction').selectOption('asc'); expect(await visibleIds(page)).toEqual(['a', 'b']);
  await query('includeUnknown').check(); expect(await visibleIds(page)).toEqual(['a', 'b', 'unknown']);
  await query('artist').fill('none'); await expect(page.locator('#clear-filters')).toBeVisible(); await page.locator('#clear-filters').click();
  expect(await visibleIds(page)).toEqual(workspace().tracks.map(track => track.id));
  await query('vocal').selectOption('instrumental'); expect(await visibleIds(page)).toEqual(['instrumental']);
  await page.locator('#library-query [type=reset]').click(); await query('readiness').selectOption('attention'); expect(await visibleIds(page)).toEqual(['local']);
  expect((await saved(page)).tracks.map(track => track.id)).toEqual(workspace().tracks.map(track => track.id));
});

test('notes, tags and rating are searchable and survive export, import, reload and language changes', async ({ page }) => {
  await bootstrap(page); await saveDetails(page, 'a', 'Warm opening; restored transfer', 'opening, Énergie, energie, Select', 5);
  let track = (await saved(page)).tracks.find(track => track.id === 'a');
  expect(track.notes).toBe('Warm opening; restored transfer'); expect(track.tags).toEqual(['opening', 'Énergie', 'Select']); expect(track.rating).toBe(5);
  await page.locator('#search').fill('restored'); expect(await visibleIds(page)).toEqual(['a']);
  await page.locator('#search').fill(''); await page.locator('#library-query [name=tag]').fill('energie'); expect(await visibleIds(page)).toEqual(['a']);
  await openSettings(page); await page.locator('#language').selectOption('ko'); await page.locator('[data-close=settings-dialog]').click();
  await expect(page.locator('[data-track=a] .track-actions')).toContainText('Énergie · Select');
  await openSettings(page); await page.locator('#language').selectOption('es'); await page.locator('[data-close=settings-dialog]').click();
  await expect(page.locator('[data-track=a] .track-actions')).toContainText('Énergie · Select');
  const waiting = page.waitForEvent('download'); await page.locator('#export-set').click(); const exported = await readFile(await (await waiting).path());
  const document = JSON.parse(exported.toString()); expect(document.tracks.find(track => track.id === 'a').tags).toEqual(track.tags);
  const beforeImportRevision = (await saved(page)).revision;
  const confirmed = new Promise(resolve => { page.once('dialog', async dialog => { await dialog.accept(); resolve(); }); });
  await page.locator('#set-input').setInputFiles({ name: 'portable.json', mimeType: 'application/json', buffer: exported }); await confirmed;
  await expect.poll(async () => (await saved(page)).revision).toBeGreaterThan(beforeImportRevision);
  await expect(page.locator('#save-status')).toHaveText('Guardado en este navegador');
  await page.reload(); await nav(page, 'library'); await recordingAction(page, 'library-details', 'a');
  await expect(page.locator('#recording-notes-form [name=notes]')).toHaveValue('Warm opening; restored transfer');
  await expect(page.locator('#recording-notes-form [name=tags]')).toHaveValue('opening, Énergie, Select'); await expect(page.locator('#recording-notes-form [name=rating]')).toHaveValue('5');
});

test('reviewed batch fill, explicit clear and cues are undoable while active playback keeps its clip', async ({ page }) => {
  await bootstrap(page); await start(page); const before = await playback(page);
  await page.locator('[data-library-select=a]').check(); await page.locator('[data-library-select=unknown]').check(); await page.locator('#open-batch-edit').click();
  await expect(page.locator('#apply-batch-edit')).toBeDisabled();
  await setBatch(page, 'year', 'fill', '1936'); await setBatch(page, 'singer', 'clear'); await setBatch(page, 'cueStartSeconds', 'set', 25); await setBatch(page, 'cueEndSeconds', 'set', 80);
  await page.locator('#batch-edit-form [type=submit]').click(); await expect(page.locator('#apply-batch-edit')).toBeEnabled();
  await expect(page.locator('#batch-edit-preview')).toContainText('1936');
  expect((await saved(page)).tracks.find(track => track.id === 'a')).toMatchObject({ year: '1935', singer: 'Roberto Maida', cueStartSeconds: 10, cueEndSeconds: 70 });
  await page.locator('#apply-batch-edit').click(); await expect(page.locator('#batch-edit-dialog')).toBeHidden();
  let state = await saved(page); expect(state.tracks.find(track => track.id === 'a')).toMatchObject({ year: '1935', singer: '', cueStartSeconds: 25, cueEndSeconds: 80 });
  expect(state.tracks.find(track => track.id === 'unknown')).toMatchObject({ year: '1936', singer: '', cueStartSeconds: 25, cueEndSeconds: 80 });
  expect(await playback(page)).toEqual(before);
  await page.locator('#undo-set').click(); expect((await saved(page)).tracks.find(track => track.id === 'a')).toMatchObject({ singer: 'Roberto Maida', cueStartSeconds: 10, cueEndSeconds: 70 });
  await page.locator('#redo-set').click(); expect((await saved(page)).tracks.find(track => track.id === 'a').cueStartSeconds).toBe(25); expect(await playback(page)).toEqual(before);
  await nav(page, 'deck'); await expect(page.locator('#position')).toHaveText('0:32 / 1:00');
});

test('CSV preview exposes mapped metadata and requires reviewed duplicates without replacing playback', async ({ page }) => {
  await bootstrap(page); await start(page); const before = await playback(page), groups = (await saved(page)).groups;
  const csv = 'ID,File,Title,Artist,Singer,Year,Genre,BPM,Duration,Cue in,Cue out,Playlist,Notes,Tags,Rating\na,,New Poema,Francisco Canaro,Maida,1937,Tango,65,180,12,90,Import opening,My transfer,warm,4\nb,,Ignored title,,,,,,,,,Import opening,,,\n,/portable-music/new.wav,New local,Canaro,Maida,1935,Tango,62,180,5,120,Import opening,Good copy,"opening, warm",3\n,/portable-music/skip.wav,Skipped,,,,,,,,,Import opening,,,';
  await readImport(page, csv);
  await expect(page.locator('#library-import-preview')).toContainText('Singer: Maida'); await expect(page.locator('#library-import-preview')).toContainText('Cue in: 12 s');
  await expect(page.locator('#library-import-preview')).toContainText('Cue out: 90 s'); await expect(page.locator('#library-import-preview')).toContainText('Personal rating: 4/5');
  await expect(page.locator('#library-import-preview')).toContainText('Source reference: new.wav'); await expect(page.locator('#library-import-status')).toContainText('SHA256');
  await page.locator('#apply-library-import').click(); await expect(page.locator('#notice')).toContainText('explicit duplicate decision'); expect((await saved(page)).tracks).toHaveLength(5);
  await page.locator('[data-import-row="0"]').selectOption('merge:a'); await page.locator('[data-import-row="1"]').selectOption('reuse:b'); await page.locator('[data-import-row="3"]').selectOption('skip');
  await page.locator('#apply-library-import').click(); await expect(page.locator('#library-import-dialog')).toBeHidden();
  const state = await saved(page), a = state.tracks.find(track => track.id === 'a'), local = state.tracks.find(track => track.title === 'New local');
  expect(state.tracks).toHaveLength(6); expect(a.title).toBe('Poema'); expect(a.notes).toBe('My transfer'); expect(a.cueStartSeconds).toBe(10); expect(a.year).toBe('1935');
  expect(state.tracks.find(track => track.id === 'b').title).toBe('El adiós'); expect(local).toMatchObject({ fileName: 'new.wav', cueStartSeconds: 5, cueEndSeconds: 120, tags: ['opening', 'warm'], rating: 3 });
  expect(local.provenance[0]).toMatchObject({ sourceName: 'library.csv', format: 'csv', reference: 'new.wav' }); expect(JSON.stringify(state)).not.toContain('/portable-music/');
  expect(state.collections.find(collection => collection.name === 'Import opening').trackIds).toEqual(['a', 'b', local.id]); expect(state.groups).toEqual(groups); expect(await playback(page)).toEqual(before);
});

test('M3U repeated placements and VLC cues preserve playlist order with explicit within-file reuse', async ({ page }) => {
  await bootstrap(page);
  await readImport(page, '#EXTM3U\n#PLAYLIST:Warmup\n#EXTINF:180,Canaro - Poema\n#EXTVLCOPT:start-time=12\n#EXTVLCOPT:stop-time=60\n/music/poema.wav\n#EXTINF:180,Canaro - Poema\n/music/poema.wav\nhttps://youtu.be/abcdefghij1', 'warmup.m3u8');
  const first = await page.locator('[data-import-row="1"] option').filter({ hasText: 'Reuse unchanged: Poema' }).last().getAttribute('value');
  await page.locator('[data-import-row="0"]').selectOption('new'); await page.locator('[data-import-row="1"]').selectOption(first); await page.locator('[data-import-row="2"]').selectOption('reuse:b');
  await page.locator('#apply-library-import').click(); await expect(page.locator('#library-import-dialog')).toBeHidden();
  const state = await saved(page), imported = state.tracks.find(track => track.fileName === 'poema.wav');
  expect(imported).toMatchObject({ cueStartSeconds: 12, cueEndSeconds: 60, artist: 'Canaro', title: 'Poema' });
  expect(state.collections.find(collection => collection.name === 'Warmup').trackIds).toEqual([imported.id, imported.id, 'b']); expect(imported.provenance).toHaveLength(2);
});

test('imported missing local audio can adopt a verified file while preserving cues and provenance', async ({ page }) => {
  await bootstrap(page); await start(page); const before = await playback(page);
  await readImport(page, 'File,Title,Duration,Cue in,Cue out,Notes\n/music/relink.wav,Relink candidate,180,12,70,Keep this transfer');
  await page.locator('#apply-library-import').click(); await expect(page.locator('#library-import-dialog')).toBeHidden();
  const imported = (await saved(page)).tracks.find(track => track.title === 'Relink candidate');
  await page.evaluate(() => { window.showOpenFilePicker = undefined; });
  const chooser = page.waitForEvent('filechooser'); await recordingAction(page, 'locate', imported.id);
  let confirmation = ''; page.once('dialog', async dialog => { confirmation = dialog.message(); await dialog.accept(); });
  await (await chooser).setFiles({ name: 'relink.wav', mimeType: 'audio/wav', buffer: Buffer.from('portable source bytes') });
  await expect(page.locator('#notice')).toContainText('File reconnected.');
  const updated = (await saved(page)).tracks.find(track => track.id === imported.id);
  expect(confirmation).toContain('no verified audio identity'); expect(updated).toMatchObject({ cueStartSeconds: 12, cueEndSeconds: 70, notes: 'Keep this transfer', fileName: 'relink.wav' });
  expect(updated.contentHash).toMatch(/^[a-f0-9]{64}$/); expect(updated.provenance).toEqual(imported.provenance); expect(await playback(page)).toEqual(before);
  await page.reload(); await nav(page, 'library'); await expect(page.locator(`[data-track="${imported.id}"] .source-status`)).toHaveText('Stored copy');
});

test('notes-dialog fallback relink waits for completion, handles cancellation and keeps unsaved details', async ({ page }) => {
  await bootstrap(page); await readImport(page, 'File,Title,Duration,Cue in,Cue out,Notes\nnotes.wav,Select,180,12,70,Original notes');
  await page.locator('#apply-library-import').click(); await expect(page.locator('#library-import-dialog')).toBeHidden();
  const imported = (await saved(page)).tracks.find(track => track.title === 'Select');
  await page.evaluate(() => { window.showOpenFilePicker = undefined; });
  await recordingAction(page, 'library-details', imported.id);
  await page.locator('#recording-notes-form [name=notes]').fill('Unsaved preparation notes'); await page.locator('#recording-notes-form [name=tags]').fill('Select, Clear'); await page.locator('#recording-notes-form [name=rating]').selectOption('5');
  const cancelledChooser = page.waitForEvent('filechooser'); await page.locator('#recording-notes-relink').click(); await cancelledChooser;
  await expect(page.locator('#recording-notes-relink')).toBeDisabled();
  await page.locator('#relink-input').dispatchEvent('cancel'); await expect(page.locator('#recording-notes-relink')).toBeEnabled();
  await expect(page.locator('#recording-notes-form [name=notes]')).toHaveValue('Unsaved preparation notes');
  const declinedChooser = page.waitForEvent('filechooser'); await page.locator('#recording-notes-relink').click(); page.once('dialog', dialog => dialog.dismiss());
  await (await declinedChooser).setFiles({ name: 'notes.wav', mimeType: 'audio/wav', buffer: Buffer.from('declined source') });
  await expect(page.locator('#recording-notes-relink')).toBeEnabled(); expect((await saved(page)).tracks.find(track => track.id === imported.id).contentHash).toBeUndefined();
  const acceptedChooser = page.waitForEvent('filechooser'); await page.locator('#recording-notes-relink').click(); page.once('dialog', dialog => dialog.accept());
  await (await acceptedChooser).setFiles({ name: 'notes.wav', mimeType: 'audio/wav', buffer: Buffer.from('accepted source') });
  await expect(page.locator('#recording-notes-relink')).toBeEnabled(); await expect(page.locator('#recording-notes-form [name=notes]')).toHaveValue('Unsaved preparation notes');
  await expect(page.locator('#recording-notes-form [name=tags]')).toHaveValue('Select, Clear'); await expect(page.locator('#recording-notes-form [name=rating]')).toHaveValue('5');
  await page.locator('#recording-notes-form [type=submit]').click(); await expect(page.locator('#recording-notes-dialog')).toBeHidden();
  const connected = (await saved(page)).tracks.find(track => track.id === imported.id);
  expect(connected).toMatchObject({ notes: 'Unsaved preparation notes', tags: ['Select', 'Clear'], rating: 5, cueStartSeconds: 12, cueEndSeconds: 70 }); expect(connected.contentHash).toMatch(/^[a-f0-9]{64}$/); expect(connected.provenance).toEqual(imported.provenance);
  await openSettings(page); await page.locator('#language').selectOption('ko'); await page.locator('[data-close=settings-dialog]').click();
  await recordingAction(page, 'library-details', imported.id); await expect(page.locator('#recording-notes-title')).toHaveText('Select');
});

test('stale import and batch reviews reject preparation changes and keep independent edits', async ({ page }) => {
  await bootstrap(page); await readImport(page, 'File,Title\nnew.wav,New candidate');
  await page.locator('[data-close=library-import-dialog]').click(); await saveDetails(page, 'a', 'Changed after preview', 'opening', 4); await page.locator('#open-library-import').click();
  await page.locator('#apply-library-import').click(); await expect(page.locator('#notice')).toContainText('library changed'); expect((await saved(page)).tracks).toHaveLength(5);
  await page.locator('[data-close=library-import-dialog]').click(); await page.locator('[data-library-select=a]').check(); await page.locator('#open-batch-edit').click();
  await setBatch(page, 'artist', 'set', 'Changed orchestra'); await page.locator('#batch-edit-form [type=submit]').click(); await page.locator('[data-close=batch-edit-dialog]').click();
  await saveDetails(page, 'a', 'Independent change', 'opening', 4);
  // Reopen the reviewed dialog without regenerating its preview, as a delayed background edit can leave it stale.
  await page.evaluate(() => document.querySelector('#batch-edit-dialog').showModal()); await page.locator('#apply-batch-edit').click();
  await expect(page.locator('#notice')).toContainText('library changed'); const track = (await saved(page)).tracks.find(track => track.id === 'a');
  expect(track.artist).toBe('Francisco Canaro'); expect(track.notes).toBe('Independent change');
});

test('library tools and reviewed dialogs remain usable on a phone viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 }); await bootstrap(page);
  await page.locator('#select-visible-recordings').click(); await expect(page.locator('#recording-selection-count')).toHaveText('5');
  await page.locator('#open-batch-edit').click(); await setBatch(page, 'tags', 'fill', 'phone preparation'); await page.locator('#batch-edit-form [type=submit]').click();
  await expect(page.locator('#apply-batch-edit')).toBeEnabled(); await page.locator('#apply-batch-edit').click(); await expect(page.locator('#batch-edit-dialog')).toBeHidden();
  expect((await saved(page)).tracks.find(track => track.id === 'local').tags).toEqual(['phone preparation']);
  const layout = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, innerWidth,
    sidebar: getComputedStyle(document.querySelector('.sidebar')).display, view: document.body.dataset.view,
    phone: matchMedia('(max-width:699px)').matches,
    overflow: [...document.querySelectorAll('*')].map(element => { const rect = element.getBoundingClientRect(); return { tag: element.tagName, id: element.id, classes: typeof element.className === 'string' ? element.className : '', x: rect.x, width: rect.width, right: rect.right }; }).filter(item => item.width && (item.right > innerWidth + 1 || item.x < -1)).slice(0, 25),
  }));
  if (layout.scrollWidth > 390) await page.screenshot({ path: testInfo.outputPath('library-width.png'), fullPage: true });
  expect(layout.scrollWidth, JSON.stringify(layout)).toBeLessThanOrEqual(390);
});
