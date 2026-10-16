import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'en-US' });
const report = { errors: [] };
page.on('pageerror', error => report.errors.push(error.message));
await page.addInitScript(() => {
  let ready;
  Object.defineProperty(window, 'onYouTubeIframeAPIReady', { configurable: true, get: () => ready, set: callback => {
    ready = () => { const Original = YT.Player; YT.Player = new Proxy(Original, { construct(Target, args) { const player = Reflect.construct(Target, args); window.realProvider = player; return player; } }); callback(); };
  } });
});
try {
  await page.goto(process.env.REVIEW_URL || 'http://localhost:5187/');
  await page.waitForFunction(() => document.body.dataset.view === 'deck' && document.querySelector('#queue-count').textContent === '28');
  assert.equal(await page.evaluate(() => !!window.realProvider), false);
  await page.locator('#play-pause').click();
  await page.waitForFunction(() => window.realProvider?.getPlayerState?.() === 1 && realProvider.getCurrentTime() > 1, null, { timeout: 30000 });
  report.first = { title: await page.locator('#playing-title').textContent(), time: await page.evaluate(() => realProvider.getCurrentTime()) };
  await page.locator('#next').click();
  await page.waitForFunction(() => document.querySelector('#playing-title').textContent === 'Te aconsejo que me olvides' && realProvider.getPlayerState() === 1 && realProvider.getCurrentTime() > 1, null, { timeout: 30000 });
  report.next = { title: await page.locator('#playing-title').textContent(), time: await page.evaluate(() => realProvider.getCurrentTime()) };
  report.completed = true;
} catch (error) { report.errors.push(error.message); process.exitCode = 1; }
finally { await mkdir('reports/onboarding', { recursive: true }); await writeFile('reports/onboarding/real-playback.json', JSON.stringify(report, null, 2) + '\n'); await browser.close(); }
