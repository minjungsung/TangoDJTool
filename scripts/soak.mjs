import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const duration = Number(process.env.SOAK_SECONDS || 7200);
const url = process.env.SOAK_URL || 'http://localhost:5180';
await mkdir('reports', { recursive: true });
const report = { started: new Date().toISOString(), durationSeconds: duration, checkpoints: [], errors: [], completed: false };
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const live = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
live.on('pageerror', error => report.errors.push({ at: new Date().toISOString(), type: 'page', message: error.message }));
await live.goto(url + '/?practice=1');
await live.locator('#start-set').click();
const started = Date.now();
let previous, repeatedStalls = 0;
async function checkpoint() {
  const data = await live.evaluate(() => ({
    title: document.querySelector('#playing-title').textContent,
    position: document.querySelector('#position').textContent,
    queue: document.querySelector('#queue-count').textContent,
    error: !document.querySelector('#youtube-error').hidden ? document.querySelector('#youtube-error-message').textContent : null,
    save: document.querySelector('#save-status').textContent,
    active: document.querySelector('.queue-item.playing')?.dataset.queueIndex,
    heap: performance.memory?.usedJSHeapSize || null,
  }));
  const entry = { at: new Date().toISOString(), elapsedSeconds: Math.round((Date.now() - started) / 1000), ...data };
  report.checkpoints.push(entry);
  if (data.error) {
    report.errors.push({ at: entry.at, type: 'provider', message: data.error, title: data.title });
    await live.locator('#next').click();
  } else if (previous?.title === data.title && previous?.position === data.position) {
    repeatedStalls++;
    if (repeatedStalls >= 2) {
      report.errors.push({ at: entry.at, type: 'stalled', title: data.title, position: data.position });
      await live.locator('#play-pause').click(); repeatedStalls = 0;
    }
  } else repeatedStalls = 0;
  // Replay the prepared set after its final timed cortina.
  if (data.active === '27' && data.position === '0:20 / 0:20') await live.locator('#start-set').click();
  previous = data;
  await writeFile('reports/soak-latest.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(entry));
}
try {
  while (Date.now() - started < duration * 1000) {
    await new Promise(resolve => setTimeout(resolve, Math.min(45000, Math.max(1, duration * 1000 - (Date.now() - started)))));
    await checkpoint();
  }
  report.completed = true;
} catch (error) { report.errors.push({ at: new Date().toISOString(), type: 'harness', message: error.message }); }
finally {
  report.finished = new Date().toISOString(); report.elapsedSeconds = Math.round((Date.now() - started) / 1000);
  await writeFile('reports/soak-latest.json', JSON.stringify(report, null, 2) + '\n');
  await browser.close(); console.log(JSON.stringify({ completed: report.completed, elapsedSeconds: report.elapsedSeconds, errors: report.errors.length }));
}
