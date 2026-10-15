import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

// A generated audio fixture validates transport mechanics; it is not a library example.
const rate = 8000, seconds = 12, length = rate * seconds, buffer = Buffer.alloc(44 + length * 2);
buffer.write('RIFF'); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVE', 8); buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22); buffer.writeUInt32LE(rate, 24);
buffer.writeUInt32LE(rate * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write('data', 36); buffer.writeUInt32LE(length * 2, 40);
for (let i = 0; i < length; i++) buffer.writeInt16LE(Math.round(Math.sin(i * Math.PI / 20) * 3000), 44 + i * 2);
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const report = { started: new Date().toISOString(), checkpoints: [], errors: [] };
await mkdir('reports', { recursive: true });
page.on('pageerror', error => report.errors.push(error.message));
await page.goto(process.env.LOCAL_URL || 'http://localhost:5182');
await page.locator('#file-input').setInputFiles({ name: 'transport-fixture.wav', mimeType: 'audio/wav', buffer });
await page.locator('#add-tanda').click();
for (let i = 0; i < 3; i++) await page.locator('[data-action="add"]').click();
await page.locator('#add-cortina').click(); await page.locator('[data-action="add"]').click();
await page.locator('[data-cortina-start]').fill('3'); await page.locator('[data-cortina-start]').blur();
await page.locator('[data-cortina-end]').fill('6'); await page.locator('[data-cortina-end]').blur();
await page.locator('#start-set').click();
const started = Date.now(), duration = Number(process.env.LOCAL_SECONDS || 600);
try {
  let cycle = 0;
  while (Date.now() - started < duration * 1000) {
    await new Promise(resolve => setTimeout(resolve, 15000));
    const state = await page.evaluate(() => ({
      title: document.querySelector('#playing-title').textContent,
      position: document.querySelector('#position').textContent,
      active: document.querySelector('.queue-item.playing')?.dataset.queueIndex,
      save: document.querySelector('#save-status').textContent,
      queue: document.querySelector('#queue-count').textContent,
    }));
    const checkpoint = { at: new Date().toISOString(), elapsedSeconds: Math.round((Date.now() - started) / 1000), ...state };
    report.checkpoints.push(checkpoint); console.log(JSON.stringify(checkpoint));
    if (state.active === '3' && state.position === '0:03 / 0:03') await page.locator('#start-set').click();
    if (++cycle % 3 === 0) {
      await page.locator('#play-pause').click(); await new Promise(resolve => setTimeout(resolve, 500));
      await page.locator('#play-pause').click();
    }
    if (cycle % 5 === 0) {
      await page.locator('#stop').click(); await page.locator('#play-pause').click();
      await page.locator('#fade').selectOption(cycle % 10 === 0 ? '0' : '1');
    }
    await writeFile('reports/local-session-latest.json', JSON.stringify(report, null, 2) + '\n');
  }
  report.completed = true;
} catch (error) { report.errors.push(error.message); }
finally {
  report.finished = new Date().toISOString(); report.elapsedSeconds = Math.round((Date.now() - started) / 1000);
  await writeFile('reports/local-session-latest.json', JSON.stringify(report, null, 2) + '\n');
  await browser.close(); console.log(JSON.stringify({ completed: report.completed, errors: report.errors }));
}
