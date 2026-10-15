import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', ...(process.env.DJ_DEBUG_PORT ? [`--remote-debugging-port=${Number(process.env.DJ_DEBUG_PORT)}`] : [])] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const report = { started: new Date().toISOString(), events: [], errors: [] };
const durationSeconds = Number(process.env.DJ_SECONDS || 6000);
await mkdir('reports', { recursive: true });
page.on('pageerror', error => report.errors.push({ at: new Date().toISOString(), message: error.message }));
const url = process.env.DJ_URL || 'http://localhost:5181/?practice=1';
await page.goto(url);
await page.locator('#start-set').click();
const started = Date.now();
let action = 0, previous, stalled = 0;
async function record(label) {
  const state = await page.evaluate(() => ({
    title: document.querySelector('#playing-title').textContent,
    position: document.querySelector('#position').textContent,
    remaining: document.querySelector('#remaining-time').textContent,
    next: document.querySelector('#up-next').textContent,
    active: document.querySelector('.queue-item.playing')?.dataset.queueIndex,
    queue: document.querySelector('#queue-count').textContent,
    saved: document.querySelector('#save-status').textContent,
    error: !document.querySelector('#youtube-error').hidden ? document.querySelector('#youtube-error-message').textContent : null,
  }));
  const entry = { at: new Date().toISOString(), elapsedSeconds: Math.round((Date.now() - started) / 1000), label, ...state };
  report.events.push(entry); console.log(JSON.stringify(entry));
  await writeFile(process.env.DJ_REPORT || 'reports/dj-session-latest.json', JSON.stringify(report, null, 2) + '\n');
  return state;
}
try {
  while (Date.now() - started < durationSeconds * 1000) {
    await new Promise(resolve => setTimeout(resolve, 45000));
    const state = await record('live-check');
    if (previous?.title === state.title && previous?.position === state.position && !state.error) stalled++; else stalled = 0;
    if (stalled >= 2 && !(state.active === '27' && state.position === '0:20 / 0:20')) {
      report.errors.push({ at: new Date().toISOString(), type: 'stalled', title: state.title, position: state.position });
      const retry = page.locator('#resume-video');
      if (await retry.isVisible()) await retry.click(); else await page.locator('#play-pause').click(); stalled = 0;
    }
    previous = state;
    if (state.title === 'No recording loaded' && state.queue !== '0') { report.errors.push({ at: new Date().toISOString(), type: 'workspace-reset' }); await page.locator('#play-pause').click(); }
    if (state.error) { report.errors.push({ at: new Date().toISOString(), type: 'provider', message: state.error }); await page.locator('#next').click(); }
    if (++action % 4 === 0) {
      const sequence = Math.floor(action / 4) % 4;
      if (sequence === 1) {
        await page.locator('#search').fill('anibal');
        await record('search-during-playback');
        await page.locator('#search').clear();
      } else if (sequence === 2) {
        await page.locator('#open-settings').click();
        await page.locator('#language').selectOption('ko');
        await record('korean-during-playback');
        await page.locator('#language').selectOption('es');
        await record('spanish-during-playback');
        await page.locator('#language').selectOption('en');
        await page.locator('[data-close="settings-dialog"]').click();
      } else if (sequence === 3) {
        await page.locator('#library').scrollIntoViewIfNeeded();
        await record('library-while-live');
      } else {
        await page.locator('#deck').scrollIntoViewIfNeeded();
        await page.locator('#volume').fill('55'); await page.locator('#volume').dispatchEvent('change');
        await page.locator('#volume').fill('85'); await page.locator('#volume').dispatchEvent('change');
        await record('volume-during-playback');
      }
    }
    if (state.active === '27' && state.position === '0:20 / 0:20') await page.locator('#start-set').click();
  }
  report.completed = true;
} catch (error) { report.errors.push({ at: new Date().toISOString(), type: 'harness', message: error.message }); }
finally {
  report.finished = new Date().toISOString(); report.elapsedSeconds = Math.round((Date.now() - started) / 1000);
  await writeFile(process.env.DJ_REPORT || 'reports/dj-session-latest.json', JSON.stringify(report, null, 2) + '\n');
  await browser.close(); console.log(JSON.stringify({ completed: report.completed, elapsedSeconds: report.elapsedSeconds, errors: report.errors.length }));
}
