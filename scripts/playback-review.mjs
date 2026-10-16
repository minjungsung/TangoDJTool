import { chromium, devices } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const output = 'reports/device-playback';
await mkdir(output, { recursive: true });
const report = { started: new Date().toISOString(), target: process.env.REVIEW_URL || 'http://localhost:5185', observations: [], errors: [], measurements: [] };
const browser = await chromium.launch({ headless: process.env.REVIEW_HEADLESS === '1' });
const context = await browser.newContext({ ...devices['Galaxy S9+'], locale: 'en-US' });
const page = await context.newPage();
page.on('pageerror', e => report.errors.push(e.message));
await page.addInitScript(() => {
  const originalGain = AudioContext.prototype.createGain;
  AudioContext.prototype.createGain = function(...args) {
    const gain = originalGain.apply(this, args), analyser = this.createAnalyser(); analyser.fftSize = 512; gain.connect(analyser);
    window.reviewAudio = { ctx: this, gain, analyser }; return gain;
  };
  let ready;
  Object.defineProperty(window, 'onYouTubeIframeAPIReady', {
    configurable: true, get: () => ready,
    set: callback => { ready = () => { const Original = YT.Player; YT.Player = new Proxy(Original, { construct(Target, args) { const player = Reflect.construct(Target, args); window.reviewVideo = player; return player; } }); callback(); }; },
  });
});
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function observe(label) {
  const result = await page.evaluate(() => {
    const video = window.reviewVideo, output = window.reviewAudio;
    let rms = null;
    if (output) { const data = new Float32Array(512); output.analyser.getFloatTimeDomainData(data); rms = Math.sqrt(data.reduce((sum,n) => sum+n*n,0)/data.length); }
    return { title: document.querySelector('#playing-title')?.textContent, position: document.querySelector('#position')?.textContent, active: document.querySelector('.queue-item.playing')?.dataset.queueIndex, save: document.querySelector('#save-status')?.textContent, videoPosition: video?.getCurrentTime?.(), videoState: video?.getPlayerState?.(), videoVolume: video?.getVolume?.(), gain: output?.gain.gain.value, rms, notice: document.querySelector('#notice-message')?.textContent, providerError: document.querySelector('#youtube-error-message')?.textContent };
  });
  const observation = { label, elapsedSeconds: +( (Date.now() - started) / 1000).toFixed(2), ...result };
  report.observations.push(observation); console.log(JSON.stringify(observation)); return result;
}
let started = Date.now();
try {
  await page.goto(report.target); await page.locator('#library').waitFor();
  if (process.env.REVIEW_DEPLOYED) {
    await page.screenshot({ path: `${output}/deployed-phone.png` });
    report.deployed = await page.evaluate(() => ({ hasDeviceNavigation: !!document.querySelector('.device-nav'), recovery: !!document.querySelector('#storage-recovery'), fadeOptions: [...document.querySelector('#fade').options].map(o => o.value) }));
  }
  if (await page.locator('#open-menu').isVisible()) await page.locator('#open-menu').click();
  await page.locator('#open-examples').click(); await page.locator('#load-real-samples').click();
  if (await page.locator('button[data-view=deck]').isVisible()) await page.locator('button[data-view=deck]').click();
  if (await page.locator('.playback-options').count()) await page.locator('.playback-options').evaluate(el => { el.open = true; });
  await page.locator('#fade').selectOption('4');
  if (await page.locator('button[data-view=set]').isVisible()) await page.locator('button[data-view=set]').click();
  await page.locator('#start-set').click();
  await page.waitForFunction(() => window.reviewVideo?.getPlayerState?.() === 1, null, { timeout: 30000 });
  for (let i = 0; i < 10; i++) { await observe('real-youtube-intro'); await wait(500); }
  if (!process.env.REVIEW_DEPLOYED) {
    const intro = report.observations.filter(o => o.label === 'real-youtube-intro');
    assert(intro.some(o => o.videoPosition < 1 && o.videoVolume < 20), 'Real YouTube fade-in was absent');
    assert(intro.some(o => o.videoPosition >= 4 && o.videoVolume === 85), 'Real YouTube did not reach master volume');
  }
  await page.screenshot({path:`${output}/${process.env.REVIEW_DEPLOYED ? 'deployed' : 'revised'}-youtube.png`});
  if (!process.env.REVIEW_DEPLOYED) {
    await page.locator('button[data-view=set]').click();
    await page.locator('[data-cortina-start]').first().fill('35'); await page.locator('[data-cortina-start]').first().blur();
    await page.locator('[data-cortina-end]').first().fill('47'); await page.locator('[data-cortina-end]').first().blur();
    await page.locator('#refresh-queue').click();
    await page.locator('button[data-view=deck]').click();
    await page.locator('[data-queue-index="4"]').click();
    await page.waitForFunction(() => window.reviewVideo?.getPlayerState?.() === 1 && window.reviewVideo.getCurrentTime() >= 35);
    for (let i = 0; i < 32; i++) { await observe('real-cortina-endpoint'); await wait(500); }
    const cortina = report.observations.filter(o => o.label === 'real-cortina-endpoint');
    assert(cortina.some(o => o.title === 'L-O-V-E' && o.videoPosition > 46 && o.videoVolume < 25), 'Real cortina fade-out was absent');
    assert(cortina.some(o => o.title === 'Poema' && o.active === '5'), 'Cortina did not enter the next tanda first recording');
    await page.locator('#stop').click();
    // UI import and playback, with downstream audio measurements, no direct Player.play calls.
    const rate=8000,length=rate*12,bytes=Buffer.alloc(44+length*2);
    bytes.write('RIFF');bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVE',8);bytes.write('fmt ',12);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(rate,24);bytes.writeUInt32LE(rate*2,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(length*2,40);
    for(let i=0;i<length;i++)bytes.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*440/rate)*12000),44+i*2);
    await page.locator('button[data-view=library]').click();
    await page.locator('#file-input').setInputFiles({name:'review-tone.wav',mimeType:'audio/wav',buffer:bytes});
    await page.locator('[data-action=play]').last().click();
    for(let i=0;i<27;i++){report.measurements.push(await observe('local-ui-fade'));await wait(500);}
    assert(report.measurements.some(o=>o.rms>.15),'Local full-level output was not measured');
    assert(report.measurements.some(o=>o.position?.startsWith('0:01')&&o.rms<.1),'Local fade-in was not measured');
    assert(report.measurements.some(o=>o.position?.startsWith('0:11')&&o.rms<.1),'Local fade-out was not measured');
    await page.locator('button[data-view=library]').click();await page.locator('[data-action=more]').last().click();await page.locator('#recording-actions [data-action=edit]').click();
    await page.getByLabel('Title',{exact:true}).fill('Reviewed local recording');await page.getByRole('button',{name:'Save details'}).click();
    await page.waitForFunction(()=>document.querySelector('#save-status').textContent==='Saved in this browser');
    await page.reload();await page.locator('#library').waitFor();await page.locator('#tracks tr').last().waitFor();assert.equal(await page.locator('.missing').count(),0);assert.equal(await page.locator('.track-title').last().textContent(),'Reviewed local recording');
    await page.screenshot({path:`${output}/revised-phone-library.png`});
    await page.setViewportSize({width:1024,height:768});await page.screenshot({path:`${output}/revised-tablet.png`});
  }
  report.completed = true;
} catch(e) {report.errors.push(e.message);await observe('failure').catch(()=>{});await page.screenshot({path:`${output}/review-failure.png`}).catch(()=>{});console.log('Review failed:',e.message);process.exitCode=1;}
finally { report.finished=new Date().toISOString();await writeFile(`${output}/${process.env.REVIEW_DEPLOYED ? 'deployed' : 'revised'}-session.json`,JSON.stringify(report,null,2)+'\n');await browser.close(); }
