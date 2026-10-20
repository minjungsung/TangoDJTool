import { test, expect } from './saved-workspace.js';

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

test('audit visible controls across work areas and dialogs', async ({ page }) => {
  test.setTimeout(60000);
  await bootstrap(page);
  const issues = [];
  const check = async (context) => {
    const found = await page.evaluate(() => {
      const visible = el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
      const controls = [...document.querySelectorAll('button,input:not([type=hidden]),select')].filter(visible);
      const id = el => el.id || el.dataset.groupAction || el.dataset.action || el.textContent.trim().slice(0,50);
      const result = [];
      for (const el of controls) {
        if (el.matches('button:not(.group-select):not(.mini-recording)') && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1))
          result.push({type:'label overflow',control:id(el),width:el.clientWidth,scroll:el.scrollWidth,height:el.clientHeight,scrollHeight:el.scrollHeight});
        const a = el.getBoundingClientRect();
        if (a.x < -1 || a.right > innerWidth + 1) result.push({type:'outside viewport',control:id(el),x:a.x,right:a.right});
        for (const other of controls) {
          if (other === el || other.parentElement !== el.parentElement || controls.indexOf(other) <= controls.indexOf(el)) continue;
          const b = other.getBoundingClientRect();
          if (Math.min(a.right,b.right)-Math.max(a.left,b.left)>1 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)
            result.push({type:'overlap',controls:[id(el),id(other)]});
        }
      }
      return result;
    });
    issues.push(...found.map(issue => ({context,...issue})));
  };
  for (const language of ['en','ko','es']) {
    await page.setViewportSize({width:1440,height:900});
    await page.locator('#open-settings').click();
    await page.locator('#language').selectOption(language);
    await page.locator('[data-close=settings-dialog]').click();
    for (const width of [320,390,650,699,700,768,1024,1200,1440,1920]) {
      await page.setViewportSize({width,height:900});
      for (const area of ['library','collections','set','deck']) {
        await nav(page,area);
        await check(`${language}/${width}/${area}`);
        if (area === 'collections') {
          const offsets = await page.locator('.collections-panel > .hint, #collection-list > .hint').evaluateAll(elements => elements.map(el => el.getBoundingClientRect().left));
          expect(offsets).toHaveLength(2);
          expect(offsets[0]).toBe(offsets[1]);
        }
      }
      if (await page.locator('#open-menu').isVisible() && !(await page.locator('#open-settings').isVisible())) await page.locator('#open-menu').click();
      for (const dialog of ['settings','examples','guide']) {
        await page.locator(`#open-${dialog}`).click();
        await check(`${language}/${width}/${dialog}`);
        await page.locator(`[data-close=${dialog}-dialog]`).click();
      }
      await nav(page,'library');
      await page.locator('[data-action=more]').first().click();
      await check(`${language}/${width}/recording-actions`);
      await page.locator('[data-close=actions-dialog]').click();
    }
  }
  await page.setViewportSize({width:1440,height:900});
  await nav(page,'collections');
  page.once('dialog', dialog => dialog.accept('Candidate recordings'));
  await page.locator('#new-collection').click(); await page.locator('#collection-browse').click();
  for (const id of ['a','b']) await page.locator(`[data-action=collection][data-id=${id}]`).click();
  await page.locator('#finish-adding').click();
  await page.locator('[data-candidate-play=a]').click();
  for (const language of ['en','ko','es']) {
    await page.setViewportSize({width:1440,height:900});
    await page.locator('#open-settings').click(); await page.locator('#language').selectOption(language);
    await page.locator('[data-close=settings-dialog]').click();
    for (const width of [320,390,650,699,700,768,1024,1200,1440,1920]) {
      await page.setViewportSize({width,height:900});
      await check(`${language}/${width}/candidate playback`);
    }
  }
  expect(issues).toEqual([]);
});
