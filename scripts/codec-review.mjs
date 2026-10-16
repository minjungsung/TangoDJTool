import {chromium,webkit} from '@playwright/test';
import {readFile,writeFile,mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
const fixtureDir=await mkdtemp(join(tmpdir(),'tangodj-codecs-'));
const codecs={mp3:'libmp3lame',m4a:'aac',flac:'flac',ogg:'vorbis',aiff:'pcm_s16be',opus:'libopus'};
for(const [extension,codec] of Object.entries(codecs)) execFileSync('ffmpeg',['-y','-f','lavfi','-i','sine=frequency=440:duration=20','-ac','2','-c:a',codec,'-strict','-2','-metadata','title=Codec review '+extension.toUpperCase(),'-metadata','artist=Review orchestra',join(fixtureDir,'sample.'+extension)],{stdio:'ignore'});
await mkdir('reports/feature-review',{recursive:true});
const results=[];
for(const [name,type] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch();const page=await browser.newPage();await page.addInitScript(()=>{const original=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(...args){window.codecAudio=this;return original.apply(this,args);};});await page.goto(process.env.REVIEW_URL || 'http://localhost:5187/');await page.locator('#library').waitFor();
 for(const extension of ['mp3','m4a','flac','ogg','aiff','opus']){
  const bytes=await readFile(join(fixtureDir,`sample.${extension}`));await page.locator('#file-input').setInputFiles({name:`sample.${extension}`,mimeType:'',buffer:bytes});await page.waitForFunction(()=>!document.querySelector('#add-files').disabled);
  const row=page.locator('#tracks tr').last();await row.locator('[data-action=play]').click();let playable=false;
  try{await page.waitForFunction(()=>window.codecAudio?.currentTime>1,null,{timeout:18000});await page.waitForTimeout(350);playable=true;}catch{}
  results.push({browser:name,extension,playable,title:await row.locator('.track-title').textContent(),metadata:await row.locator('.track-detail').textContent(),timeline:await page.locator('#position').textContent(),sourceTime:await page.evaluate(()=>window.codecAudio?.currentTime),message:await page.locator('#notice-message').textContent()});await page.locator('#stop').click();
 }
 await browser.close();
}
await writeFile('reports/feature-review/codec-results.json',JSON.stringify(results,null,2)+'\n');
await rm(fixtureDir,{recursive:true,force:true});
