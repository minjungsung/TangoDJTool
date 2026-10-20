import { test, expect, recordingAction } from './saved-workspace.js';

async function bootstrap(page) {
  await page.addInitScript(() => {
    localStorage.setItem('studio-language', 'en');
    window.YT = { Player: class {
      constructor(id, options) { this.options = options; this.state = 2; this.position = 0; window.testYT = this; setTimeout(() => options.events.onReady(), 0); }
      loadVideoById(value) { this.id = typeof value === 'string' ? value : value.videoId; this.position = value.startSeconds || 0; this.state = 1; this.options.events.onStateChange({ data: 1 }); }
      getCurrentTime() { return this.position; } getDuration() { return 180; } getPlayerState() { return this.state; }
      getVideoUrl() { return `https://www.youtube.com/watch?v=${this.id}`; } setVolume() {} pauseVideo() { this.state = 2; } playVideo() { this.state = 1; } seekTo(value) { this.position = value; }
    } };
  });
  await page.goto('/');
  await page.evaluate(async () => {
    const tracks = ['a','b','c','x'].map((id, i) => ({ id, source: 'youtube', videoId: `abcdefghij${i}`, title: id.toUpperCase(), duration: 180 }));
    const db = await new Promise(resolve => { const r = indexedDB.open('tango-dj-studio', 2); r.onsuccess = () => resolve(r.result); });
    await new Promise(resolve => { const tx = db.transaction('state', 'readwrite'); tx.objectStore('state').put({ tracks, groups: [{ id: 't', name: 'My tanda', kind: 'tanda', trackIds: ['a','b','a'] }, { id: 'cortina', name: 'My cortina', kind: 'cortina', trackIds: ['c'], fullLength: true, holdAfter: true }, { id: 't2', name: 'Second tanda', kind: 'tanda', trackIds: ['b'] }], revision: 2 }, 'current'); tx.oncomplete = resolve; }); db.close();
  });
  await page.reload();
}
async function nav(page, view) {
  await page.locator('button[data-view]').first().waitFor({ state: 'attached' });
  const button = page.locator(`button[data-view="${view}"]`);
  if (await button.isVisible()) await button.click();
  else await page.locator(`.sidebar a[href="#${view}"]`).click();
}

test('sets create tandas; presets and collapsed cards survive reload and export', async ({ page }) => {
  await bootstrap(page); await nav(page, 'collections');
  page.once('dialog', dialog => dialog.accept('Candidates')); await page.locator('#new-collection').click();
  await nav(page, 'library');
  for (const id of ['a','b','x']) {
    await page.locator(`[data-action="collection"][data-id="${id}"]`).click();
    await page.locator('#confirm-next').click();
  }
  await nav(page, 'collections'); await page.locator('[data-collection]').click();
  for (const input of await page.locator('[data-candidate]').all()) await input.check();
  await page.locator('#collection-tanda').click();
  const candidate = page.locator('#groups .group').filter({ has: page.locator('.group-select strong', { hasText: 'Candidates' }) });
  await expect(candidate).toHaveCount(1);
  page.once('dialog', dialog => dialog.accept('Reusable')); await page.locator('#save-preset').click();
  const group = candidate; await group.locator('[data-group-action="collapse"]').click();
  await expect(group.locator('ol')).toBeHidden();
  await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
  await page.reload(); await nav(page, 'set');
  await expect(page.locator('#presets')).toContainText('Reusable');
  await expect(candidate.locator('ol')).toBeHidden();
  await page.locator('[data-preset]').click();
  await expect(page.locator('#groups .group')).toHaveCount(5);
  const download = page.waitForEvent('download'); await page.locator('#export-set').click();
  const path = await (await download).path();
  page.once('dialog', dialog => dialog.accept()); await page.locator('#set-input').setInputFiles(path);
  await expect(page.locator('#notice')).toContainText('Set imported');
  await expect(page.locator('#presets')).toContainText('Reusable');
});

test('play-next keeps active position, preserves addition order, and leaves preset unchanged', async ({ page }) => {
  await bootstrap(page); await nav(page, 'set'); await page.locator('[data-group-action="select"][data-id="t"]').click();
  page.once('dialog', dialog => dialog.accept('Original')); await page.locator('#save-preset').click();
  await page.locator('#start-set').click(); await expect(page.locator('#playing-title')).toHaveText('A');
  await page.evaluate(() => { window.testYT.position = 42; window.testYT.pauseVideo(); });
  await nav(page, 'library');
  await page.locator('[data-action="play-next"][data-id="x"]').click();
  await page.locator('[data-action="play-next"][data-id="b"]').click();
  expect(await page.evaluate(() => [window.testYT.position, window.testYT.state])).toEqual([42,2]);
  await nav(page, 'deck');
  await expect(page.locator('.queue-item strong')).toHaveText(['A','X','B','B','A','C','B']);
  await page.locator('[data-pending-remove]').last().click();
  await expect(page.locator('.queue-item strong')).toHaveText(['A','X','B','A','C','B']);
  await page.locator('#next').click(); await expect(page.locator('#playing-title')).toHaveText('X');
  await nav(page, 'set'); await page.locator('[data-preset]').click();
  await expect(page.locator('#groups .group').filter({ has: page.locator('.group-select strong', { hasText: 'Original' }) }).locator('li')).toHaveCount(3);
});

test('manual cortina waits at endpoint, inserts in next tanda, and advances on explicit button', async ({ page }) => {
  await bootstrap(page); await nav(page, 'set'); await page.locator('#start-set').click();
  await page.locator('[data-queue-index="3"]').click();
  await expect(page.locator('#next-tanda')).toBeVisible();
  await page.evaluate(() => { window.testYT.position = 180; window.testYT.state = 0; window.testYT.options.events.onStateChange({ data: 0 }); });
  await expect(page.locator('#playing-title')).toHaveText('C');
  await nav(page, 'library'); await page.locator('[data-action="play-next"][data-id="x"]').click();
  await page.locator('#confirm-next').click(); await nav(page, 'deck');
  await page.locator('#next-tanda').click(); await expect(page.locator('#playing-title')).toHaveText('X');
});

test('copied audio uses content identity for duplicate detection and identical relinking', async ({ page }) => {
  await page.goto('/');
  const audio = Buffer.from('a local source identity fixture');
  await page.locator('#file-input').setInputFiles({ name: 'original.mp3', mimeType: 'audio/mpeg', buffer: audio });
  await expect(page.locator('#library-count')).toHaveText('1');
  await page.locator('#file-input').setInputFiles({ name: 'renamed.mp3', mimeType: 'audio/mpeg', buffer: audio });
  await expect(page.locator('#import-progress')).toContainText('Skipped');
  await expect(page.locator('#library-count')).toHaveText('1');
  await page.locator('#file-input').setInputFiles({ name: 'original.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('a different source') });
  await expect(page.locator('#library-count')).toHaveText('2');
  const ids = await page.locator('#tracks tr').evaluateAll(rows => rows.map(row => row.dataset.track));
  await page.evaluate(async id => {
    const db = await new Promise(resolve => { const req = indexedDB.open('tango-dj-studio', 2); req.onsuccess = () => resolve(req.result); });
    await new Promise(resolve => { const tx = db.transaction('files','readwrite'); tx.objectStore('files').delete(id); tx.oncomplete = resolve; }); db.close();
  }, ids[0]);
  await page.locator('#check-files').click(); await expect(page.locator('.missing')).toHaveCount(1);
  const picker = page.waitForEvent('filechooser');
  // Force the copied-file fallback instead of opening a real OS picker.
  await page.evaluate(() => { window.showOpenFilePicker = undefined; });
  await recordingAction(page, 'locate', ids[0]);
  await (await picker).setFiles({ name: 'moved.mp3', mimeType: 'audio/mpeg', buffer: audio });
  await expect(page.locator('.missing')).toHaveCount(0);
  await expect(page.locator('#notice')).toContainText('Cues and analysis retained');
  await page.reload(); await expect(page.locator('.missing')).toHaveCount(0);
});

test('linked sources renew permission and folder repair verifies renamed bytes without copying', async ({ page }) => {
  await page.addInitScript(() => {
    const handles = new Map(); window.testHandles = handles;
    const native = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(value, key) {
      if (this.name === 'sources' && value?.handle) { handles.set(key, value.handle); return native.call(this, { fakeHandle: key }, key); }
      return native.call(this, value, key);
    };
    const getter = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get = function(key) {
      const req = getter.call(this, key);
      if (this.name === 'sources') req.addEventListener('success', () => { if (req.result?.fakeHandle) Object.defineProperty(req, 'result', { value: { handle: handles.get(key) } }); });
      return req;
    };
    const file = () => new File(['original bytes'], 'source.mp3', { type: 'audio/mpeg' });
    const original = { kind: 'file', name: 'source.mp3', allowed: true, missing: false,
      async queryPermission() { return this.allowed ? 'granted' : 'prompt'; }, async requestPermission() { this.allowed = true; return 'granted'; },
      async getFile() { if (this.missing) throw new Error('Moved'); return file(); } };
    window.originalHandle = original;
    window.showOpenFilePicker = async () => [original];
    window.showDirectoryPicker = async () => ({ async *values() {
      yield { kind: 'file', name: 'renamed.mp3', async queryPermission() { return 'granted'; }, async getFile() { return new File(['original bytes'], 'renamed.mp3', { type: 'audio/mpeg' }); } };
      yield { kind: 'file', name: 'source.mp3', async queryPermission() { return 'granted'; }, async getFile() { return new File(['different bytes'], 'source.mp3', { type: 'audio/mpeg' }); } };
    } });
  });
  await page.goto('/'); await page.locator('#connect-files').click();
  await expect(page.locator('#library-count')).toHaveText('1'); await expect(page.locator('.source-status')).toHaveText('Ready');
  const count = await page.evaluate(async () => { const db = await new Promise(resolve => { const r = indexedDB.open('tango-dj-studio',2); r.onsuccess = () => resolve(r.result); }); const n = await new Promise(resolve => { const r = db.transaction('files').objectStore('files').count(); r.onsuccess = () => resolve(r.result); }); db.close(); return n; });
  expect(count).toBe(0);
  await page.evaluate(() => { window.originalHandle.allowed = false; });
  await page.locator('#check-files').click(); await expect(page.locator('.source-status')).toHaveText('Permission needed');
  page.once('dialog', dialog => dialog.dismiss());
  await recordingAction(page, 'copy');
  await page.evaluate(() => { window.originalHandle.missing = true; });
  await page.locator('#check-files').click(); await expect(page.locator('.source-status')).toHaveText('File missing');
  await page.locator('#reconnect-folder').click();
  await expect(page.locator('#repair-results button')).toHaveCount(1);
  await expect(page.locator('#repair-results button')).toContainText('renamed.mp3');
  await page.locator('#repair-results button').click();
  await expect(page.locator('#repair-results')).toContainText('Ready');
});

for (const width of [390, 1024]) {
  test(`four work areas and collapsed tanda controls fit ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 }); await bootstrap(page);
    for (const area of ['library','collections','set','deck']) {
      await page.locator(`button[data-view="${area}"]`).click();
      await expect(page.locator(`#${area}`)).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
    await page.locator('button[data-view="set"]').click();
    await page.locator('[data-group-action="collapse"][data-id="t"]').click();
    await expect(page.locator('[data-group="t"] ol')).toBeHidden();
    await page.locator('[data-group-action="collapse"][data-id="t"]').click();
    await expect(page.locator('[data-group="t"] ol')).toBeVisible();
  });
}

test('failed next insertion rolls back the queue and tanda', async ({ page }) => {
  await bootstrap(page); await nav(page,'set'); await page.locator('#start-set').click();
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(...args) { if (this.name === 'state') throw new DOMException('Full', 'QuotaExceededError'); return original.apply(this,args); };
  });
  await nav(page,'library'); await page.locator('[data-action="play-next"][data-id="x"]').click();
  await expect(page.locator('#notice')).toContainText('queue is unchanged');
  await expect(page.locator('.queue-item strong')).toHaveText(['A','B','A','C','B']);
  await expect(page.locator('[data-group="t"] li')).toHaveCount(3);
});

test('manual cortina fade can be canceled by Stop without starting another recording', async ({ page }) => {
  await bootstrap(page); await nav(page,'set'); await page.locator('#start-set').click();
  await page.locator('[data-queue-index="3"]').click();
  await page.evaluate(() => { window.testYT.position = 10; }); await page.waitForTimeout(150);
  await page.locator('.playback-options').evaluate(el => el.open = true); await page.locator('#fade').selectOption('1');
  await page.locator('#next-tanda').click(); await page.locator('#stop').click();
  await expect(page.locator('#playing-title')).toHaveText('C');
  await expect(page.locator('#play-pause')).toHaveText('▶');
  await page.waitForTimeout(1100);
  await expect(page.locator('#playing-title')).toHaveText('C');
});

test('collecting candidates and choosing a tanda change separate destinations', async ({ page }) => {
  await bootstrap(page); await nav(page, 'collections');
  page.once('dialog', dialog => dialog.accept('Candidates')); await page.locator('#new-collection').click();
  await nav(page, 'library');
  await page.locator('[data-action=collection][data-id=x]').click();
  await expect(page.locator('#target-heading')).toHaveText('Choose candidate set');
  await expect(page.locator('#target-recording')).toHaveText('X');
  await expect(page.locator('#target-explanation')).toContainText('does not change any tanda');
  await page.locator('#confirm-next').click();
  await expect(page.locator('[data-group=t] li')).toHaveCount(3);
  await page.locator('#add-target').selectOption('t2');
  await page.locator('[data-action=add][data-id=x]').click();
  await expect(page.locator('[data-group=t2] li')).toHaveCount(2);
  await expect(page.locator('[data-group=t] li')).toHaveCount(3);
  await page.locator('#add-target').selectOption('');
  await page.locator('[data-action=add][data-id=a]').click();
  await expect(page.locator('#target-heading')).toHaveText('Choose target tanda');
  await expect(page.locator('#target-recording')).toHaveText('A');
  await page.locator('#next-target').selectOption('t2'); await page.locator('#confirm-next').click();
  await expect(page.locator('[data-group=t2] li')).toHaveCount(3);
  await nav(page, 'collections'); await page.locator('[data-collection]').click();
  await expect(page.locator('[data-candidate]')).toHaveCount(1);
  await page.locator('#collection-browse').click();
  await expect(page.locator('#library-target')).toContainText('Candidates');
  await page.locator('[data-action=collection][data-id=b]').click();
  await expect(page.locator('#target-dialog')).toBeHidden();
  await page.locator('#finish-adding').click();
  await expect(page.locator('#collections')).toBeVisible();
  await expect(page.locator('[data-candidate]')).toHaveCount(2);
  await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
  await page.reload(); await nav(page, 'collections'); await page.locator('[data-collection]').click();
  await expect(page.locator('[data-candidate]')).toHaveCount(2);
});

for (const language of ['en','ko','es']) {
  test(`recording actions and tanda toolbars fit narrow and wide screens in ${language}`, async ({ page }) => {
    await bootstrap(page);
    await page.locator('#open-settings').click();
    await page.locator('#language').selectOption(language);
    await page.locator('[data-close=settings-dialog]').click();
    for (const width of [320,390,1024,1440]) {
      await page.setViewportSize({width,height:900});
      const navigate = async area => {
        const button = page.locator(`button[data-view="${area}"]`);
        if (await button.isVisible()) await button.click(); else await nav(page,area);
      };
      await navigate('library');
      if (await page.locator('#dismiss-notice').isVisible()) await page.locator('#dismiss-notice').click();
      const row = page.locator('#tracks tr').first();
      await row.scrollIntoViewIfNeeded();
      for (const name of ['play','collection','add','more']) {
        await expect.poll(async () => {
          const box = await row.locator(`[data-action="${name}"]`).boundingBox();
          return box && box.x >= 0 && box.x + box.width <= width && box.height >= 40;
        }).toBeTruthy();
      }
      await expect(row.locator('[data-action=play-next]')).toBeHidden();
      await navigate('set');
      const tools = page.locator('[data-group=t] .group-tools');
      // Button boxes must also contain their labels, especially next to Play.
      const overflowingLabels = await tools.locator('button').evaluateAll(buttons => buttons
        .filter(button => button.scrollWidth > button.clientWidth)
        .map(button => button.textContent));
      expect(overflowingLabels).toEqual([]);
      const boxes = await tools.locator('button').evaluateAll(buttons => buttons.map(button => {
        const {x,y,width,height}=button.getBoundingClientRect(); return {x,y,width,height};
      }));
      for (const box of boxes) { expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x+box.width).toBeLessThanOrEqual(width); expect(box.height).toBeGreaterThanOrEqual(40); }
      for (let i=0;i<boxes.length;i++) for (let j=i+1;j<boxes.length;j++) {
        const a=boxes[i],b=boxes[j]; expect(a.x+a.width <= b.x+0.1 || b.x+b.width <= a.x+0.1 || a.y+a.height <= b.y+0.1 || b.y+b.height <= a.y+0.1).toBeTruthy();
      }
      const checkbox = await page.locator('[data-cortina-hold]').boundingBox(); expect(checkbox.height).toBe(18);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
  });
}

for (const width of [1440, 390]) {
  test(`${width}px adds groups after selection and preserves attached cortinas`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await bootstrap(page); await nav(page, 'set');
    const ids = () => page.locator('#groups .group').evaluateAll(groups => groups.map(group => group.dataset.group));
    await page.locator('[data-group-action="select"][data-id="t"]').click();
    await page.locator('#add-tanda').click();
    const inserted = await page.locator('#groups .selected').getAttribute('data-group');
    expect(await ids()).toEqual(['t', 'cortina', inserted, 't2']);
    await page.locator('#add-cortina').click();
    const attached = await page.locator('#groups .selected').getAttribute('data-group');
    expect(await ids()).toEqual(['t', 'cortina', inserted, attached, 't2']);
    await page.locator('#add-cortina').click();
    const standalone = await page.locator('#groups .selected').getAttribute('data-group');
    expect(await ids()).toEqual(['t', 'cortina', inserted, attached, standalone, 't2']);
    await page.locator('[data-group-action="select"][data-id="t"]').click();
    await page.locator('#add-cortina').click();
    await expect(page.locator('#groups .selected')).toHaveAttribute('data-group', 'cortina');
    await expect(page.locator('#groups .group')).toHaveCount(6);
    await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
    await page.reload(); await nav(page, 'set');
    expect(await ids()).toEqual(['t', 'cortina', inserted, attached, standalone, 't2']);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });

  test(`${width}px plays only the chosen tanda in order and uses current edits`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await bootstrap(page); await nav(page, 'set');
    await page.locator('#start-set').click();
    await nav(page, 'set');
    await page.locator('[data-group-action="play-tanda"][data-id="t2"]').click();
    await expect(page.locator('#playing-title')).toHaveText('B');
    await expect(page.locator('.queue-item strong')).toHaveText(['B']);
    await nav(page, 'set');
    await page.locator('[data-group-action="play-tanda"][data-id="t"]').click();
    await expect(page.locator('#playing-title')).toHaveText('A');
    await expect(page.locator('.queue-item strong')).toHaveText(['A', 'B', 'A']);
    await page.locator('#next').click(); await expect(page.locator('#playing-title')).toHaveText('B');
    await page.locator('#next').click(); await expect(page.locator('#playing-title')).toHaveText('A');
    await page.evaluate(() => { window.testYT.state = 0; window.testYT.options.events.onStateChange({ data: 0 }); });
    await expect(page.locator('#notice')).toContainText('End of play queue');
    await expect(page.locator('#playing-title')).toHaveText('A');
    await nav(page, 'set');
    const collapse = page.locator('[data-group-action="collapse"][data-id="t"]');
    if (await collapse.getAttribute('aria-expanded') === 'false') await collapse.click();
    await page.locator('[data-group-action="remove"][data-id="t"][data-index="0"]').click();
    await page.locator('[data-group-action="play-tanda"][data-id="t"]').click();
    await expect(page.locator('#playing-title')).toHaveText('B');
    await expect(page.locator('.queue-item strong')).toHaveText(['B', 'A']);
    await nav(page, 'set'); await page.locator('#add-tanda').click();
    await expect(page.locator('#groups .selected [data-group-action="play-tanda"]')).toBeDisabled();
  });
}

for (const width of [1440, 390]) {
  test(`${width}px returns to the selected tanda and restores work-area scroll positions`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await bootstrap(page); await nav(page, 'set');
    for (let i = 0; i < 12; i++) await page.locator('#add-tanda').click();
    await page.locator('#choose-recordings').click();
    await expect(page.locator('#finish-adding')).toHaveText('Back to tanda');
    await page.locator('[data-action=add][data-id=x]').click();
    await page.locator('#finish-adding').click();
    await expect(page.locator('#set')).toBeVisible();
    const selected = page.locator('#groups .selected');
    await expect(selected).toBeInViewport();
    await expect(selected.locator('li')).toHaveCount(1);
    await expect(selected.locator('ol')).toBeVisible();
    const position = await page.evaluate(() => window.scrollY);
    await nav(page, 'library'); await nav(page, 'set');
    expect(await page.evaluate(() => window.scrollY)).toBe(position);
  });
}

test('choosing another cortina replaces its recording, supports undo, and plays the new source', async ({ page }) => {
  await bootstrap(page); await nav(page, 'set');
  await page.locator('[data-group-action=cue-play][data-id=cortina]').click();
  await expect(page.locator('#playing-title')).toHaveText('C');
  await nav(page, 'set'); await page.locator('[data-group-action=select][data-id=cortina]').click();
  await page.locator('#choose-recordings').click();
  await page.locator('[data-action=add][data-id=x]').click();
  await page.locator('#finish-adding').click();
  await expect(page.locator('[data-group=cortina] li')).toHaveCount(1);
  await expect(page.locator('[data-group=cortina] li')).toContainText('X');
  await page.locator('#undo-set').click();
  await expect(page.locator('[data-group=cortina] li')).toContainText('C');
  await page.locator('#choose-recordings').click();
  await page.locator('[data-action=add][data-id=x]').click();
  await page.locator('#finish-adding').click();
  await page.locator('[data-group-action=cue-play][data-id=cortina]').click();
  await expect(page.locator('#playing-title')).toHaveText('X');
  await nav(page, 'set'); await page.locator('[data-group-action=cue-play][data-id=cortina]').click();
  await expect(page.locator('#playing-title')).toHaveText('X');
  await expect(page.locator('.queue-item strong')).toHaveText(['C', 'X']);
});

test('candidate choices survive removing other recordings, renaming, and changing work areas', async ({ page }) => {
  await bootstrap(page); await nav(page, 'collections');
  page.once('dialog', dialog => dialog.accept('Candidates')); await page.locator('#new-collection').click();
  await page.locator('#collection-browse').click();
  for (const id of ['a', 'b', 'x']) await page.locator(`[data-action=collection][data-id=${id}]`).click();
  await page.locator('#finish-adding').click();
  await page.locator('[data-candidate=a]').check(); await page.locator('[data-candidate=b]').check();
  await page.locator('[data-candidate-remove="2"]').click();
  await expect(page.locator('[data-candidate]:checked')).toHaveCount(2);
  page.once('dialog', dialog => dialog.accept('Chosen pair')); await page.locator('#collection-rename').click();
  await expect(page.locator('[data-candidate]:checked')).toHaveCount(2);
  await nav(page, 'library'); await nav(page, 'collections');
  await expect(page.locator('[data-candidate]:checked')).toHaveCount(2);
  await page.locator('#collection-tanda').click();
  await expect(page.locator('#groups .selected li>span')).toHaveText(['A', 'B']);
});


test('an empty search can clear every filter without changing the recording destination', async ({ page }) => {
  await bootstrap(page);
  await page.locator('#add-target').selectOption('t2');
  await page.locator('#search').fill('No matching orchestra');
  await page.locator('#style-filter').selectOption('Vals');
  await page.locator('#source-filter').selectOption('local');
  await expect(page.locator('#empty-library')).toBeVisible();
  await expect(page.locator('#empty-library p')).toContainText('clear the filters');
  await page.locator('#clear-filters').click();
  await expect(page.locator('#tracks tr')).toHaveCount(4);
  await expect(page.locator('#add-target')).toHaveValue('t2');
  await expect(page.locator('#search')).toBeFocused();
  await expect(page.locator('#style-filter')).toHaveValue('');
  await expect(page.locator('#source-filter')).toHaveValue('');
});

test('the playback screen can return from tanda listening to the full prepared set', async ({ page }) => {
  await bootstrap(page); await nav(page, 'set');
  await page.locator('[data-group-action=play-tanda][data-id=t2]').click();
  await expect(page.locator('#playing-title')).toHaveText('B');
  await expect(page.locator('.queue-item')).toHaveCount(1);
  await expect(page.locator('#deck-start-set')).toBeVisible();
  await page.locator('#deck-start-set').click();
  await expect(page.locator('#playing-title')).toHaveText('A');
  await expect(page.locator('.queue-item strong')).toHaveText(['A','B','A','C','B']);
});

for (const width of [1440, 390]) {
  test(`${width}px listens from a chosen recording within a tanda without searching the library`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 }); await bootstrap(page); await nav(page, 'set');
    const collapse = page.locator('[data-group-action=collapse][data-id=t]');
    if (await collapse.getAttribute('aria-expanded') === 'false') await collapse.click();
    const play = page.locator('[data-group-action=play-recording][data-id=t][data-index="1"]');
    if (width < 700) {
      const bounds = await play.boundingBox();
      expect(bounds.width).toBeGreaterThanOrEqual(44); expect(bounds.height).toBeGreaterThanOrEqual(44);
    }
    await play.click();
    await expect(page.locator('#playing-title')).toHaveText('B');
    await expect(page.locator('#recording-number')).toHaveText('Recording 2 / 3');
    await expect(page.locator('.queue-item strong')).toHaveText(['A','B','A']);
    await page.locator('#next').click(); await expect(page.locator('#playing-title')).toHaveText('A');
    await expect(page.locator('#next')).toBeDisabled();
  });
}

test('removing the parent of a selected cortina selects a nearby group for the next insertion', async ({ page }) => {
  await bootstrap(page); await nav(page, 'set');
  await page.locator('[data-group-action=select][data-id=cortina]').click();
  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-group-action=delete][data-id=t]').click();
  await expect(page.locator('.selected')).toHaveAttribute('data-group', 't2');
  await page.locator('#add-cortina').click();
  await expect(page.locator('.group')).toHaveCount(2);
  await expect(page.locator('.group').first()).toHaveAttribute('data-group', 't2');
  await expect(page.locator('.group').last()).toHaveClass(/attached-cortina/);
});


test('queue refresh cannot confuse a removed recording occurrence with a later repeat', async ({ page }) => {
  await bootstrap(page); await nav(page, 'set'); await page.locator('#start-set').click();
  await expect(page.locator('#playing-title')).toHaveText('A');
  await page.evaluate(() => { testYT.position = 42; testYT.pauseVideo(); });
  await nav(page, 'set');
  await page.locator('[data-group-action=remove][data-id=t][data-index="0"]').click();
  await page.locator('#refresh-queue').click();
  await expect(page.locator('#notice')).toContainText('current recording is no longer');
  await expect(page.locator('.queue-item strong')).toHaveText(['A','B','A','C','B']);
  expect(await page.evaluate(() => [testYT.position, testYT.state])).toEqual([42,2]);
});

test('tanda-only queue edits and play-next stay inside the tanda after refresh and reload', async ({ page }) => {
  await bootstrap(page); await nav(page, 'set');
  await page.locator('[data-group-action=play-tanda][data-id=t]').click();
  await expect(page.locator('#playing-title')).toHaveText('A');
  await page.evaluate(() => { testYT.position = 42; testYT.pauseVideo(); });
  await nav(page, 'library'); await page.locator('[data-action=play-next][data-id=x]').click();
  await nav(page, 'set');
  await page.locator('[data-group-action=track-down][data-id=t][data-index="1"]').click();
  await expect(page.locator('#queue-stale')).toBeVisible();
  await page.locator('#refresh-queue').click();
  await expect(page.locator('.queue-item strong')).toHaveText(['A','B','X','A']);
  expect(await page.evaluate(() => [testYT.position, testYT.state])).toEqual([42,2]);
  await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
  await page.reload(); await nav(page, 'deck'); await page.locator('#play-pause').click();
  await expect(page.locator('#playing-title')).toHaveText('A');
  await nav(page, 'set');
  await page.locator('[data-group-action=track-down][data-id=t][data-index="1"]').click();
  await page.locator('#refresh-queue').click();
  await expect(page.locator('.queue-item strong')).toHaveText(['A','X','B','A']);
  await nav(page, 'deck'); await expect(page.locator('#deck-start-set')).toBeVisible();
});


test('canceling a reservation keeps unrelated unreflected edits visible', async ({ page }) => {
  await bootstrap(page); await nav(page, 'set'); await page.locator('#start-set').click();
  await expect(page.locator('#playing-title')).toHaveText('A');
  await nav(page, 'library'); await page.locator('[data-action=play-next][data-id=x]').click();
  await nav(page, 'set'); await page.locator('[data-group-action=track-down][data-id=t][data-index="2"]').click();
  await expect(page.locator('#queue-stale')).toBeVisible();
  await nav(page, 'deck'); await page.locator('[data-pending-remove]').click();
  await nav(page, 'set'); await expect(page.locator('#queue-stale')).toBeVisible();
  await expect(page.locator('.queue-item strong')).toHaveText(['A','B','A','C','B']);
  await expect(page.locator('[data-group=t] li>span')).toHaveText(['A','A','B']);
});

test('refresh keeps reservation cancellation available without removing the wrong recording', async ({ page }) => {
  await bootstrap(page); await nav(page, 'set'); await page.locator('#start-set').click();
  await expect(page.locator('#playing-title')).toHaveText('A');
  await nav(page, 'library'); await page.locator('[data-action=play-next][data-id=x]').click();
  await nav(page, 'set'); await page.locator('[data-group-action=track-down][data-id=t][data-index="1"]').click();
  await page.locator('#refresh-queue').click();
  await nav(page, 'deck'); await expect(page.locator('[data-pending-remove]')).toBeVisible();
  await page.locator('[data-pending-remove]').click();
  await expect(page.locator('.queue-item strong')).toHaveText(['A','B','A','C','B']);
  await nav(page, 'set'); await expect(page.locator('#queue-stale')).toBeHidden();
});

test('canceling a reservation already removed from the tanda leaves its other recordings intact', async ({ page }) => {
  await bootstrap(page); await nav(page, 'set'); await page.locator('#start-set').click();
  await expect(page.locator('#playing-title')).toHaveText('A');
  await nav(page, 'library'); await page.locator('[data-action=play-next][data-id=x]').click();
  await nav(page, 'set'); await page.locator('[data-group-action=remove][data-id=t][data-index="1"]').click();
  await nav(page, 'deck'); await page.locator('[data-pending-remove]').click();
  await nav(page, 'set'); await expect(page.locator('[data-group=t] li>span')).toHaveText(['A','B','A']);
  await expect(page.locator('.queue-item strong')).toHaveText(['A','B','A','C','B']);
});


test('a reservation can still be canceled after its tanda is removed', async ({ page }) => {
  await bootstrap(page); await nav(page, 'set'); await page.locator('#start-set').click();
  await expect(page.locator('#playing-title')).toHaveText('A');
  await nav(page, 'library'); await page.locator('[data-action=play-next][data-id=x]').click();
  await nav(page, 'set'); page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-group-action=delete][data-id=t]').click();
  await nav(page, 'deck'); await page.locator('[data-pending-remove]').click();
  await expect(page.locator('[data-pending-remove]')).toHaveCount(0);
  await expect(page.locator('.queue-item strong')).toHaveText(['A','B','A','C','B']);
});


test('Undo after library deletion retains the placement identities of surviving recordings', async ({ page }) => {
  await bootstrap(page); await nav(page, 'set');
  const read = () => page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('tango-dj-studio', 2);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result, reading = db.transaction('state').objectStore('state').get('current');
      reading.onsuccess = () => { db.close(); resolve(reading.result.groups.find(group => group.id === 't')); };
      reading.onerror = () => { db.close(); reject(reading.error); };
    };
  }));
  await page.locator('[data-group-action=select][data-id=t]').click();
  await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
  const original = await read();
  await page.locator('[data-group-action=track-down][data-id=t][data-index="0"]').click();
  await nav(page, 'library'); page.once('dialog', dialog => dialog.accept());
  await recordingAction(page, 'delete', 'a');
  await nav(page, 'set'); await page.locator('#undo-set').click();
  await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
  const restored = await read();
  expect(restored.trackIds).toEqual(['b']);
  expect(restored.occurrenceIds).toEqual([original.occurrenceIds[1]]);
});


test('renaming the current tanda updates Playback labels without restarting its recording', async ({ page }) => {
  await bootstrap(page); await nav(page, 'set');
  await page.locator('[data-group-action=play-tanda][data-id=t]').click();
  await expect(page.locator('#playing-title')).toHaveText('A');
  await page.evaluate(() => { testYT.position = 33; testYT.pauseVideo(); });
  await nav(page, 'set'); page.once('dialog', dialog => dialog.accept('Audition tanda'));
  await page.locator('[data-group-action=rename][data-id=t]').click();
  await page.locator('#refresh-queue').click();
  await nav(page, 'deck');
  await expect(page.locator('#playing-group')).toHaveText('Audition tanda');
  await expect(page.locator('.queue-item small')).toHaveText(['Audition tanda','Audition tanda','Audition tanda']);
  expect(await page.evaluate(() => [testYT.position, testYT.state])).toEqual([33,2]);
});

for (const width of [1440, 390]) {
  test(`${width}px reload restores the exact repeated placement and paused seek position without autoplay`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 }); await bootstrap(page); await nav(page, 'set');
    await page.locator('[data-group-action=play-tanda][data-id=t]').click();
    await expect(page.locator('#play-pause')).toBeEnabled();
    await nav(page, 'deck'); await page.locator('.queue-item').last().click();
    await expect(page.locator('#recording-number')).toHaveText('Recording 3 / 3');
    await expect(page.locator('#play-pause')).toBeEnabled();
    await page.locator('#play-pause').click(); await page.locator('#seek').fill('25');
    await expect(page.locator('#position')).toHaveText('0:45 / 3:00');
    await expect(page.locator('#remaining-time')).toHaveText('Remaining: 2:15');
    await page.reload(); await nav(page, 'deck');
    await expect(page.locator('#playing-title')).toHaveText('A');
    await expect(page.locator('#position')).toHaveText('0:45 / 3:00');
    await expect(page.locator('#play-pause')).toHaveText('▶');
    await expect(page.locator('#seek')).toBeDisabled();
    expect(await page.evaluate(() => Boolean(window.testYT))).toBe(false);
    await page.locator('#play-pause').click();
    await expect(page.locator('#recording-number')).toHaveText('Recording 3 / 3');
    await expect(page.locator('#play-pause')).toBeEnabled();
    expect(await page.evaluate(() => testYT.position)).toBe(45);
    await expect(page.locator('.queue-item strong')).toHaveText(['A','B','A']);
    await page.locator('#stop').click(); await page.reload(); await nav(page, 'deck');
    await expect(page.locator('#position')).toHaveText('0:00 / 3:00');
    await page.locator('#play-pause').click(); await expect(page.locator('#play-pause')).toBeEnabled();
    expect(await page.evaluate(() => testYT.position)).toBe(0);
  });
}

test('restored cortina position stays relative to its cue and honors its original endpoint', async ({ page }) => {
  await bootstrap(page); await nav(page, 'set');
  await page.locator('[data-cortina-full=cortina]').uncheck();
  await page.locator('[data-cortina-start=cortina]').fill('30'); await page.locator('[data-cortina-start=cortina]').blur();
  await page.locator('[data-cortina-end=cortina]').fill('50'); await page.locator('[data-cortina-end=cortina]').blur();
  await page.locator('[data-group-action=cue-play][data-id=cortina]').click();
  await expect(page.locator('#play-pause')).toBeEnabled();
  await page.locator('#play-pause').click(); await page.locator('#seek').fill('50');
  await expect(page.locator('#position')).toHaveText('0:10 / 0:20');
  await page.reload(); await nav(page, 'deck');
  await expect(page.locator('#position')).toHaveText('0:10 / 0:20');
  await page.locator('#play-pause').click(); await expect(page.locator('#play-pause')).toBeEnabled();
  expect(await page.evaluate(() => testYT.position)).toBe(40);
  await page.evaluate(() => { testYT.position = 50; });
  await expect(page.locator('#play-pause')).toHaveText('▶');
  await page.reload(); await nav(page, 'deck');
  await expect(page.locator('#position')).toHaveText('0:00 / 0:20');
  await page.locator('#play-pause').click(); await expect(page.locator('#play-pause')).toBeEnabled();
  expect(await page.evaluate(() => testYT.position)).toBe(30);
  await page.locator('#stop').click();
  await expect(page.locator('#remaining-time')).toHaveText('Remaining: 0:20');
});

test('a stale checkpoint cannot move playback in a newer workspace revision', async ({ page }) => {
  await bootstrap(page); await nav(page, 'set'); await page.locator('#start-set').click();
  await expect(page.locator('#play-pause')).toBeEnabled(); await page.locator('#play-pause').click();
  await page.locator('#seek').fill('25');
  const checkpoint = await page.evaluate(() => localStorage.getItem('studio-playback-position'));
  await nav(page, 'set'); page.once('dialog', dialog => dialog.accept('Renamed'));
  await page.locator('[data-group-action=rename][data-id=t]').click();
  await expect(page.locator('#save-status')).toHaveText('Saved in this browser');
  await page.addInitScript(checkpoint => { const stale = JSON.parse(checkpoint); stale.position = 90; localStorage.setItem('studio-playback-position', JSON.stringify(stale)); }, checkpoint);
  await page.reload(); await nav(page, 'deck');
  await expect(page.locator('#position')).toHaveText('0:45 / 3:00');
});


test('seeking after Stop resumes from the chosen position and Retry keeps it', async ({ page }) => {
  await bootstrap(page); await nav(page, 'set'); await page.locator('#start-set').click();
  await expect(page.locator('#play-pause')).toBeEnabled(); await page.locator('#stop').click();
  await page.locator('#seek').fill('25'); await page.locator('#play-pause').click();
  expect(await page.evaluate(() => testYT.position)).toBe(45);
  await page.evaluate(() => { testYT.position = 57; testYT.options.events.onError({ data: 100 }); });
  await nav(page, 'deck'); await page.locator('#youtube-retry').click();
  await expect(page.locator('#play-pause')).toBeEnabled();
  expect(await page.evaluate(() => testYT.position)).toBe(57);
});


test('deleting the restored recording cannot apply its saved position to the next recording', async ({ page }) => {
  await bootstrap(page); await nav(page, 'set'); await page.locator('#start-set').click();
  await expect(page.locator('#play-pause')).toBeEnabled(); await page.locator('#play-pause').click();
  await page.locator('#seek').fill('25'); await page.reload(); await nav(page, 'library');
  page.once('dialog', dialog => dialog.accept()); await recordingAction(page, 'delete', 'a');
  await nav(page, 'deck'); await page.locator('#play-pause').click();
  await expect(page.locator('#playing-title')).toHaveText('B');
  await expect(page.locator('#play-pause')).toBeEnabled();
  expect(await page.evaluate(() => testYT.position)).toBe(0);
});
