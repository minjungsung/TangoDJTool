import { test, expect } from './saved-workspace.js';

function wav(name = 'Review tango', amplitude = 10000) {
  const rate = 8000, length = rate * 10, b = Buffer.alloc(44 + length * 2);
  b.write('RIFF'); b.writeUInt32LE(b.length - 8, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16,16); b.writeUInt16LE(1,20); b.writeUInt16LE(1,22); b.writeUInt32LE(rate,24); b.writeUInt32LE(rate*2,28); b.writeUInt16LE(2,32); b.writeUInt16LE(16,34); b.write('data',36); b.writeUInt32LE(length*2,40);
  for (let i=0;i<length;i++) b.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*440/rate)*amplitude),44+i*2);
  return { name: `${name}.wav`, mimeType: 'audio/wav', buffer: b };
}
async function view(page, area) {
  if (await page.locator('button[data-view]').first().isVisible()) await page.locator(`button[data-view=${area}]`).click();
  else await page.locator(`#${area}`).scrollIntoViewIfNeeded();
}
async function menu(page, id) {
  if (await page.locator('#open-menu').isVisible() && !(await page.locator(`#${id}`).isVisible())) await page.locator('#open-menu').click();
  await page.locator(`#${id}`).click();
}
async function action(page, name, index = 0) {
  await view(page, 'library');
  const row = page.locator('#tracks tr').nth(index);
  if (!(await row.locator(`[data-action=${name}]`).isVisible())) { await row.locator('[data-action=more]').click(); await page.locator(`#recording-actions [data-action=${name}]`).click(); }
  else await row.locator(`[data-action=${name}]`).click();
}
async function upload(page, ...files) {
  await view(page,'library'); await page.locator('#file-input').setInputFiles(files);
  await expect(page.locator('#import-progress')).toContainText('Done');
}
async function save(page) { await expect(page.locator('#save-status')).toHaveText('Saved in this browser'); }
async function samples(page) { await menu(page,'open-examples'); await page.locator('#load-real-samples').click(); await expect(page.locator('#library-count')).toHaveText('28'); }
async function provider(page) {
  await page.addInitScript(() => {
    window.YT = { Player: class {
      constructor(id,options) { this.options=options; this.state=2;this.position=0;this.volume=85;this.loads=0;window.reviewProvider=this;setTimeout(()=>options.events.onReady(),0); }
      loadVideoById(value) {this.videoId=typeof value==='string'?value:value.videoId;this.position=typeof value==='string'?0:value.startSeconds;this.state=1;this.loads++;this.options.events.onStateChange({data:1});}
      getCurrentTime(){return this.position;}getDuration(){return 180;}getPlayerState(){return this.state;}getVolume(){return this.volume;}getVideoUrl(){return `https://www.youtube.com/watch?v=${this.videoId}`;}
      setVolume(v){this.volume=v;}pauseVideo(){this.state=2;this.options.events.onStateChange({data:2});}playVideo(){this.state=1;this.options.events.onStateChange({data:1});}seekTo(v){this.position=v;}
    }};
  });
}
test.beforeEach(async ({ page }) => {
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(() => {
    const original = AudioContext.prototype.createGain;
    AudioContext.prototype.createGain = function(...args) { const gain=original.apply(this,args); window.reviewGain=gain; return gain; };
  });
  await page.goto('/'); await expect(page.locator('#library')).toBeVisible();
  page.reviewErrors = errors;
});
test.afterEach(async ({ page }, info) => {
  if (!page.isClosed()) {
    expect(page.reviewErrors).toEqual([]);
    await info.attach('screen', {body: await page.screenshot(),contentType:'image/png'});
  }
});

test('file picker, keyboard drop zone, batch import, duplicate and unsupported file handling', async ({page}) => {
  const chooser=page.waitForEvent('filechooser');await page.locator('#add-files').click();await (await chooser).setFiles(wav('First'));
  await expect(page.locator('#library-count')).toHaveText('1');
  if(await page.locator('#drop-zone').isVisible()) {const chooser=page.waitForEvent('filechooser');await page.locator('#drop-zone').focus();await page.keyboard.press('Enter');await (await chooser).setFiles(wav('Second'));await expect(page.locator('#library-count')).toHaveText('2');}
  await upload(page,wav('Batch'), {name:'notes.txt',mimeType:'text/plain',buffer:Buffer.from('ignore')});
  const count=await page.locator('#library-count').textContent();
  for(let i=0;i<2;i++) {await page.locator('#import-progress').evaluate(el=>el.textContent='');await page.locator('#drop-zone').evaluate(el=>{const transfer=new DataTransfer();transfer.items.add(new File(['duplicate'],'Duplicate.mp3',{type:'audio/mpeg',lastModified:123}));el.dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:transfer}));});await expect(page.locator('#import-progress')).toContainText('Done');}
  expect(Number(await page.locator('#library-count').textContent())).toBe(Number(count)+1);
  await save(page);await page.reload();await expect(page.locator('#library-count')).toHaveText(String(Number(count)+1));await expect(page.locator('.missing')).toHaveCount(0);
});

test('file drop and recording drag into a group use their actual event paths', async ({page}) => {
  await page.locator('#drop-zone').evaluate(el => { const transfer=new DataTransfer();transfer.items.add(new File(['unsupported tags'],'drop.mp3',{type:'audio/mpeg'}));el.dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:transfer})); });
  await expect(page.locator('#library-count')).toHaveText('1');await view(page,'set');await page.locator('#add-tanda').click();
  await page.locator('#tracks tr').evaluate(el=>{const transfer=new DataTransfer();el.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:transfer}));document.querySelector('.group').dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:transfer}));});
  await expect(page.locator('.group li')).toHaveCount(1);
});

test('all metadata fields, cancel, validation, accent search, style and source filters', async ({page}) => {
  await upload(page,wav());await action(page,'edit');
  for (const [label,value] of [['Title','Canción'],['Orchestra / artist','Aníbal Review'],['Singer','Singer'],['Year','1941'],['BPM','120']]) await page.getByLabel(label,{exact:true}).fill(value);
  await page.getByLabel('Style',{exact:true}).selectOption('Tango');await page.getByRole('button',{name:'Save details'}).click();await save(page);
  await page.locator('#search').fill('cancion');await expect(page.locator('#tracks tr')).toHaveCount(1);
  await page.locator('#style-filter').selectOption('Vals');await expect(page.locator('#tracks tr')).toHaveCount(0);await expect(page.locator('#empty-library')).toBeVisible();
  await page.locator('#style-filter').selectOption('Tango');await page.locator('#source-filter').selectOption('youtube');await expect(page.locator('#tracks tr')).toHaveCount(0);await page.locator('#source-filter').selectOption('local');
  await action(page,'edit');await page.getByLabel('Title',{exact:true}).fill('Canceled');await page.locator('#close-metadata').click();await expect(page.locator('.track-title')).toHaveText('Canción');
  await action(page,'edit');await page.getByLabel('Title',{exact:true}).fill('');await page.getByRole('button',{name:'Save details'}).click();await expect(page.locator('#metadata-dialog')).toBeVisible();await page.locator('#close-metadata').click();
  await page.reload();await expect(page.locator('.track-title')).toHaveText('Canción');
});

test('YouTube URL rejection, duplicate prevention, unavailable metadata and manual correction', async ({page}) => {
  await page.route('https://www.youtube.com/oembed?**',r=>r.abort());
  await page.getByLabel('YouTube video URL').fill('https://example.com/not-a-video');await page.getByRole('button',{name:'Add video',exact:true}).click();await expect(page.locator('#notice')).toContainText('Enter a YouTube');
  await page.getByLabel('YouTube video URL').fill('https://youtu.be/abcdefghijk');await page.getByRole('button',{name:'Add video',exact:true}).click();await expect(page.locator('#library-count')).toHaveText('1');
  await page.getByLabel('YouTube video URL').fill('https://youtu.be/abcdefghijk');await page.getByRole('button',{name:'Add video',exact:true}).click();await expect(page.locator('#notice')).toContainText('already');
  await action(page,'edit');await page.getByLabel('Title',{exact:true}).fill('Manual video');await page.getByRole('button',{name:'Save details'}).click();await save(page);await page.reload();await expect(page.locator('.track-title')).toHaveText('Manual video');
});

test('create/select/rename/reorder/delete groups and reorder/remove recordings with Undo', async ({page}) => {
  await upload(page,wav('A'),wav('B'));await view(page,'set');await page.locator('#add-tanda').click();await action(page,'add',0);await action(page,'add',1);await view(page,'set');
  await page.locator('[data-group-action=track-down][data-index="0"]').click();await expect(page.locator('.group li>span').first()).toHaveText('B');
  await page.locator('[data-group-action=track-up][data-index="1"]').click();await expect(page.locator('.group li>span').first()).toHaveText('A');
  page.once('dialog',d=>d.accept('Renamed tanda'));await page.locator('[data-group-action=rename]').click();await expect(page.locator('.group-select strong')).toHaveText('Renamed tanda');
  await page.locator('#add-cortina').click();await page.locator('[data-group-action=up]').last().click();await expect(page.locator('.group').first()).toContainText('Cortina');
  await page.locator('[data-group-action=down]').first().click();await expect(page.locator('.group').first()).toContainText('Renamed tanda');
  await page.locator('[data-group-action=remove]').first().click();await expect(page.locator('.group li')).toHaveCount(1);await page.locator('#undo-set').click();await expect(page.locator('.group li')).toHaveCount(2);
  page.once('dialog',d=>d.dismiss());await page.locator('[data-group-action=delete]').last().click();await expect(page.locator('.group')).toHaveCount(2);
  page.once('dialog',d=>d.accept());await page.locator('[data-group-action=delete]').last().click();await expect(page.locator('.group')).toHaveCount(1);await save(page);await page.reload();await expect(page.locator('.group')).toHaveCount(1);
});

test('individual/bulk analysis, gain adjustment, preview/stop preview, and preview from a filtered guide', async ({page}) => {
  await upload(page,wav('Quiet',2000),wav('Loud',18000));await action(page,'analyze',0);await expect(page.locator('#notice')).toContainText('1 tracks analyzed');
  await action(page,'edit');await expect(page.locator('#analysis-details')).toContainText('RMS');await page.locator('#close-metadata').click();
  await page.locator('#analyze-all').click();await expect(page.locator('#notice')).toContainText('2 tracks analyzed');
  await action(page,'play',0);await view(page,'deck');await page.locator('.playback-options').evaluate(el=>el.open=true);await page.locator('#normalize').check();await expect.poll(()=>page.evaluate(()=>window.reviewGain.gain.value)).toBeGreaterThan(1);
  await page.locator('#normalize').uncheck();await expect.poll(()=>page.evaluate(()=>window.reviewGain.gain.value)).toBeLessThan(.9);
  await action(page,'preview',1);await expect(page.locator('#preview-status')).toBeVisible();await page.locator('#stop-preview').click();await expect(page.locator('#preview-status')).toBeHidden();
  await view(page,'library');await page.locator('#search').fill('No matching track');await menu(page,'open-guide');await page.locator('#guide-preview').click();await expect(page.locator('#preview-status')).toBeVisible();
});

test('local transport: pause/resume, previous/next, seek, volume/mute, keyboard, final endpoint and Auto next', async ({page}) => {
  await upload(page,wav('A'),wav('B'));await view(page,'set');await page.locator('#add-tanda').click();await action(page,'add',0);await action(page,'add',1);await view(page,'set');await page.locator('#start-set').click();
  await expect(page.locator('#playing-title')).toHaveText('A');await expect(page.locator('#position')).toContainText('0:01');await page.locator('#play-pause').click();await expect(page.locator('#play-pause')).toHaveText('▶');
  const position=await page.locator('#position').textContent();await page.waitForTimeout(300);await expect(page.locator('#position')).toHaveText(position);await page.locator('#play-pause').click();
  await page.locator('#next').click();await expect(page.locator('#playing-title')).toHaveText('B');await page.locator('#previous').click();await expect(page.locator('#playing-title')).toHaveText('A');
  await page.locator('.playback-options').evaluate(el=>el.open=true);await page.locator('#volume').fill('0');await expect.poll(()=>page.evaluate(()=>window.reviewGain.gain.value)).toBeLessThan(.01);await page.locator('#volume').fill('50');
  await page.locator('#auto-next').uncheck();await page.locator('#seek').fill('95');await expect(page.locator('#play-pause')).toHaveText('▶',{timeout:5000});await expect(page.locator('#playing-title')).toHaveText('A');
  await page.locator('#play-pause').click();await expect(page.locator('#position')).toContainText('0:00');await page.locator('#auto-next').check();await page.locator('#seek').fill('95');await expect(page.locator('#playing-title')).toHaveText('B');
  await page.locator('#stop').click();await expect(page.locator('#position')).toContainText('0:00');await page.locator('#play-pause').click();
  await page.locator('h1').click();await page.keyboard.press('Space');await expect(page.locator('#play-pause')).toHaveText('▶');
});

test('cortina segment cue/play reaches deck on phone, copies position, waits and resumes next tanda', async ({page}) => {
  await upload(page,wav());await view(page,'set');await page.locator('#add-cortina').click();await action(page,'add');await view(page,'set');
  await page.locator('[data-cortina-start]').fill('2');await page.locator('[data-cortina-start]').blur();await page.locator('[data-cortina-end]').fill('5');await page.locator('[data-cortina-end]').blur();await page.locator('[data-cortina-hold]').check();
  await page.locator('[data-group-action=cue-play]').click();await expect(page.locator('#deck')).toBeVisible();await expect(page.locator('#position')).toContainText('/ 0:03');
  await expect(page.locator('#play-pause')).toHaveText('▶',{timeout:7000});await page.locator('#play-pause').click();await expect(page.locator('#position')).toContainText('0:00');
  await view(page,'set');await page.locator('[data-group-action=cue-position]').click();await expect(page.locator('[data-cortina-start]')).not.toHaveValue('0');
});

test('empty guide actions, sample link, reset walkthrough, practice link and persistent language/settings', async ({page}) => {
  await menu(page,'open-guide');await page.locator('#guide-preview').click();await expect(page.locator('#notice')).toContainText('Import a local');
  await menu(page,'open-guide');await page.locator('#guide-analyze').click();await expect(page.locator('#notice')).toContainText('Import local');
  await menu(page,'open-guide');await page.locator('#sample-link').click();await expect(page.locator('#library')).toBeVisible();await expect(page.locator('#youtube-form input')).toHaveValue(/youtube/);
  await samples(page);await menu(page,'open-guide');await page.locator('#reset-guide').click();await expect(page.locator('#practice-progress-text')).toHaveText('0 / 8 tried');await page.locator('[data-close=guide-dialog]').click();
  await menu(page,'open-settings');await page.locator('#persist-storage').click();await expect(page.locator('#storage-details')).toContainText('MB');
  for(const language of ['ko','es','en']) {await page.locator('#language').selectOption(language);await expect(page.locator('html')).toHaveAttribute('lang',language);}
  await page.locator('[data-close=settings-dialog]').click();await view(page,'deck');await page.locator('.playback-options').evaluate(el=>el.open=true);await page.locator('#fade').selectOption('2');await page.locator('#normalize').check();await page.locator('#auto-next').uncheck();await page.locator('#volume').fill('33');await page.locator('#volume').dispatchEvent('change');
  await page.reload();await view(page,'deck');await page.locator('.playback-options').evaluate(el=>el.open=true);await expect(page.locator('#fade')).toHaveValue('2');await expect(page.locator('#volume')).toHaveValue('33');await expect(page.locator('#normalize')).toBeChecked();await expect(page.locator('#auto-next')).not.toBeChecked();
});

test('YouTube recovery: retry, open URL, replace invalid/valid link, use local recording and skip', async ({page}) => {
  await provider(page);await page.reload();await samples(page);await view(page,'set');await page.locator('#start-set').click();await expect(page.locator('#playing-title')).toHaveText('Yo soy el tango');
  await page.evaluate(()=>reviewProvider.options.events.onError({data:150}));await expect(page.locator('#youtube-error')).toBeVisible();await expect(page.locator('#youtube-open')).toHaveAttribute('href',/youtube.com\/watch/);
  await page.locator('#youtube-retry').click();await expect(page.locator('#youtube-error')).toBeHidden();
  await page.evaluate(()=>reviewProvider.options.events.onError({data:100}));await page.locator('#youtube-replace').click();await page.locator('[name=videoUrl]').fill('https://example.com');await page.getByRole('button',{name:'Save details'}).click();await expect(page.locator('#metadata-dialog')).toBeVisible();await page.locator('[name=videoUrl]').fill('https://youtu.be/abcdefghijk');await page.getByRole('button',{name:'Save details'}).click();await page.locator('#play-pause').click();await expect.poll(()=>page.evaluate(()=>reviewProvider.videoId)).toBe('abcdefghijk');
  await page.evaluate(()=>reviewProvider.options.events.onError({data:101}));await page.locator('#youtube-local').click({trial:true});
  const chooser=page.waitForEvent('filechooser');await page.locator('#youtube-local').click();await (await chooser).setFiles(wav('Replacement'));await expect(page.locator('#notice')).toContainText('File relinked');await page.locator('#play-pause').click();await expect(page.locator('#youtube-wrap')).toBeHidden();
  await page.locator('#next').click();await page.evaluate(()=>reviewProvider.options.events.onError({data:153}));await page.locator('#youtube-skip').click();await expect(page.locator('#playing-title')).toHaveText('El bulín de la calle Ayacucho');
});

test('delete library recording: cancel then confirm while previewing stops deleted preview', async ({page}) => {
  await upload(page,wav());await action(page,'preview');await expect(page.locator('#preview-status')).toBeVisible();
  page.once('dialog',d=>d.dismiss());await action(page,'delete');await expect(page.locator('#library-count')).toHaveText('1');
  page.once('dialog',d=>d.accept());await action(page,'delete');await expect(page.locator('#library-count')).toHaveText('0');await view(page,'deck');await expect(page.locator('#preview-status')).toBeHidden();
});

async function exportSet(page) {
  const pending=page.waitForEvent('download');await menu(page,'export-set');const download=await pending;
  const stream=await download.createReadStream();const chunks=[];for await(const chunk of stream) chunks.push(chunk);return Buffer.concat(chunks);
}
async function importSet(page, contents, accept=true) {
  page.once('dialog',d=>accept?d.accept():d.dismiss());await menu(page,'import-set');
  await page.locator('#set-input').setInputFiles({name:'review-set.json',mimeType:'application/json',buffer:contents});
}

test('portable export/import in another browser, canceled import, malformed/oversized input and file relink', async ({page,browser}) => {
  await upload(page,wav('Portable'));await view(page,'set');await page.locator('#add-cortina').click();await action(page,'add');await view(page,'set');
  await page.locator('[data-cortina-start]').fill('2');await page.locator('[data-cortina-start]').blur();await page.locator('[data-cortina-end]').fill('6');await page.locator('[data-cortina-end]').blur();await page.locator('[data-cortina-hold]').check();await save(page);
  const exported=await exportSet(page);const value=JSON.parse(exported);expect(value.groups[0]).toMatchObject({startSeconds:2,limitSeconds:4,holdAfter:true});
  await importSet(page,Buffer.from(JSON.stringify({version:1,tracks:[],groups:[]})),false);await expect(page.locator('#library-count')).toHaveText('1');
  await menu(page,'import-set');await page.locator('#set-input').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{bad')});await expect(page.locator('#notice')).toContainText('Import failed');await expect(page.locator('#library-count')).toHaveText('1');
  await page.locator('#set-input').setInputFiles({name:'large.json',mimeType:'application/json',buffer:Buffer.alloc(10*1024*1024+1)});await expect(page.locator('#notice')).toContainText('10 MB');
  const context=await browser.newContext({locale:'en-US'}),other=await context.newPage();await other.goto('/');await expect(other.locator('#library')).toBeVisible();await importSet(other,exported);
  await expect(other.locator('#library-count')).toHaveText('1');await expect(other.locator('.missing')).toHaveCount(1);expect(JSON.parse(await exportSet(other))).toEqual(value);
  await action(other,'relink');await other.locator('#relink-input').setInputFiles(wav('Portable'));await expect(other.locator('.missing')).toHaveCount(0);
  await action(other,'play');await expect(other.locator('#position')).toContainText('0:01');await save(other);await other.reload();await expect(other.locator('#library-count')).toHaveText('1');await expect(other.locator('.missing')).toHaveCount(0);await context.close();
});

test('prepared-deck button, queue selection, stale queue update, Undo and restored queue', async ({page}) => {
  await provider(page);await page.reload();await samples(page);await view(page,'deck');await page.locator('#deck-start-set').click();await expect(page.locator('#queue-count')).toHaveText('28');
  await page.locator('[data-queue-index="5"]').click();await expect(page.locator('#playing-title')).toHaveText('Poema');
  const loads=await page.evaluate(()=>reviewProvider.loads);await view(page,'set');await page.locator('[data-group-action=track-down][data-id="real-group-canaro"][data-index="1"]').click();
  await expect(page.locator('#queue-stale')).toBeVisible();await page.locator('#refresh-queue').click();await expect(page.locator('#queue-stale')).toBeHidden();expect(await page.evaluate(()=>reviewProvider.loads)).toBe(loads);
  await page.locator('#undo-set').click();await page.locator('#refresh-queue').click();await save(page);await page.reload();await expect(page.locator('#queue-count')).toHaveText('28');await view(page,'deck');await expect(page.locator('#queue-resume')).toBeVisible();await page.locator('#play-pause').click();await expect(page.locator('#playing-title')).toHaveText('Poema');
});

test('local decode failure and preview failure report errors, playback relink and skip recover', async ({page}) => {
  await upload(page,{name:'broken.mp3',mimeType:'audio/mpeg',buffer:Buffer.from('invalid codec')},wav('Valid'));await action(page,'analyze',0);await expect(page.locator('#notice')).toContainText('failed');
  await action(page,'preview',0);await expect(page.locator('#notice')).toHaveClass(/error/);
  await action(page,'play',0);await expect(page.locator('#playback-recovery')).toBeVisible();const chooser=page.waitForEvent('filechooser');await page.locator('#playback-relink').click();await (await chooser).setFiles(wav('Fixed'));await expect(page.locator('#notice')).toContainText('File relinked');await page.locator('#play-pause').click();await expect(page.locator('#youtube-wrap')).toBeHidden();
  await action(page,'play',1);await page.locator('#stop').click();await action(page,'play',0);await expect(page.locator('#playing-title')).toHaveText('broken');
});

test('temporary database failure: example-only queue, backup export, local import guard and saving recovery', async ({page}) => {
  await page.evaluate(() => new Promise((resolve,reject) => { const request=indexedDB.deleteDatabase('tango-dj-studio');request.onsuccess=resolve;request.onerror=()=>reject(request.error); }));await provider(page);await page.addInitScript(()=>{const original=IDBFactory.prototype.open;IDBFactory.prototype.open=function(...args){if(!window.storageAllowed)throw new DOMException('Unavailable','SecurityError');return original.apply(this,args);};});await page.reload();await expect(page.locator('#storage-recovery')).toBeVisible();await menu(page,'open-examples');await page.locator('#real-sample-play').click();await expect(page.locator('#queue-count')).toHaveText('28');await expect(page.locator('#save-status')).toHaveText('Temporary · not saved');
  const pending=page.waitForEvent('download');await page.locator('#temporary-export').click();expect((await pending).suggestedFilename()).toBe('tango-dj-set.json');
  await page.locator('#file-input').setInputFiles(wav());await expect(page.locator('#notice')).toContainText('Retry saving');await expect(page.locator('#library-count')).toHaveText('28');
  await page.evaluate(()=>window.storageAllowed=true);await page.locator('#retry-saving').click();await save(page);await expect(page.locator('#storage-recovery')).toBeHidden();
});

test('dialog Escape, guide editing/group handoffs, notification dismissal and mobile menu state', async ({page}) => {
  await menu(page,'open-guide');await page.keyboard.press('Escape');await expect(page.locator('#guide-dialog')).toBeHidden();
  await menu(page,'open-guide');await page.locator('#real-sample-edit').click();await expect(page.locator('#metadata-dialog')).toBeVisible();await page.locator('#close-metadata').click();
  await menu(page,'open-guide');await page.locator('#real-sample-select').click();await expect(page.locator('#set')).toBeVisible();
  await view(page,'library');await page.locator('#search').fill('not found');await expect(page.locator('#empty-library')).toBeVisible();await page.locator('#search').clear();
  await menu(page,'open-examples');await page.locator('#load-real-samples').click();await expect(page.locator('#notice')).toBeVisible();await page.locator('#dismiss-notice').click();await expect(page.locator('#notice')).toBeHidden();
});

test('partial file import preserves successful audio when a later file hits quota, then permits retry', async ({page}) => {
  await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;const ids=new Set();IDBObjectStore.prototype.put=function(...args){if(this.name==='files')ids.add(args[1]);if(this.name==='files'&&ids.size===2)throw new DOMException('Full','QuotaExceededError');return original.apply(this,args);};});
  await page.locator('#file-input').setInputFiles([wav('Saved'),wav('Rejected')]);await expect(page.locator('#notice')).toContainText('storage is full');await expect(page.locator('#library-count')).toHaveText('1');
  await action(page,'play');await expect(page.locator('#position')).toContainText('0:01');await upload(page,wav('Retry'));await expect(page.locator('#library-count')).toHaveText('2');await save(page);await page.reload();await expect(page.locator('#library-count')).toHaveText('2');await expect(page.locator('.missing')).toHaveCount(0);
});

test('busy import protects analysis/import/sample actions and completes the pending operation', async ({page}) => {
  await page.evaluate(()=>{const original=Blob.prototype.arrayBuffer;let first=true;Blob.prototype.arrayBuffer=async function(){if(first){first=false;await new Promise(r=>window.releaseImport=r);}return original.call(this);};});
  await page.locator('#file-input').setInputFiles(wav());await expect(page.locator('#add-files')).toBeDisabled();await expect(page.locator('#analyze-all')).toBeDisabled();
  await menu(page,'open-examples');await page.locator('#load-real-samples').click();await expect(page.locator('#notice')).toContainText('Wait for');await page.locator('[data-close=examples-dialog]').click();await page.evaluate(()=>window.releaseImport());
  await expect(page.locator('#library-count')).toHaveText('1',{timeout:20000});await expect(page.locator('#add-files')).toBeEnabled();
});

test('analysis during playback refreshes normalized gain without restarting the current recording', async ({page}) => {
  await upload(page,wav('Quiet live',2000));await action(page,'play');await view(page,'deck');await page.locator('.playback-options').evaluate(el=>el.open=true);await page.locator('#normalize').check();
  await expect.poll(()=>page.evaluate(()=>window.reviewGain.gain.value)).toBeLessThan(.9);await action(page,'analyze');await expect(page.locator('#notice')).toContainText('1 tracks analyzed');
  await expect.poll(()=>page.evaluate(()=>window.reviewGain.gain.value)).toBeGreaterThan(1);await view(page,'deck');await expect(page.locator('#playing-title')).toHaveText('Quiet live');await expect(page.locator('#position')).not.toContainText('0:00');
});

test('local playback waiting longer than fifteen seconds exposes retry and relink', async ({page}) => {
  await upload(page,wav());await action(page,'play');
  // Trigger the browser media event path without replacing Player's implementation.
  await page.evaluate(()=>{const original=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(...args){window.waitingAudio=this;return original.apply(this,args);};});
  await page.locator('#stop').click();await page.locator('#play-pause').click();await page.waitForFunction(()=>window.waitingAudio?.currentTime>.5);
  await page.evaluate(()=>{const realNow=Date.now;const held=waitingAudio.currentTime;Object.defineProperty(waitingAudio,'currentTime',{get:()=>held});waitingAudio.dispatchEvent(new Event('timeupdate'));waitingAudio.dispatchEvent(new Event('waiting'));Date.now=()=>realNow()+16000;});
  await expect(page.locator('#playback-recovery')).toBeVisible();await expect(page.locator('#playback-recovery-message')).toContainText('stalled');
});
