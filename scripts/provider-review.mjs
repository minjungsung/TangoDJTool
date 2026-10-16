import { chromium } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';
import { realTracks } from '../src/samples.js';
const output='reports/feature-review';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:390,height:844},locale:'en-US'});const page=await context.newPage();
const report={started:new Date().toISOString(),tracks:[],errors:[]};
page.on('pageerror',e=>report.errors.push(e.message));
await page.addInitScript(()=>{let ready;Object.defineProperty(window,'onYouTubeIframeAPIReady',{configurable:true,get:()=>ready,set:callback=>{ready=()=>{const Original=YT.Player;YT.Player=new Proxy(Original,{construct(Target,args){const player=Reflect.construct(Target,args);window.actualProvider=player;return player;}});callback();};}});});
try {
 await page.goto(process.env.PROVIDER_URL||'http://localhost:5187/?practice=1');await page.locator('#tracks tr').first().waitFor();
 for(const track of realTracks){
  await page.locator('button[data-view=library]').click();await page.locator(`[data-action=play][data-id="${track.id}"]`).click();
  const entry={id:track.id,title:track.title};
  try{
   await page.waitForFunction(()=>window.actualProvider?.getPlayerState?.()===1,null,{timeout:20000});
   const start=await page.evaluate(()=>actualProvider.getCurrentTime());await page.waitForTimeout(1500);const end=await page.evaluate(()=>actualProvider.getCurrentTime());
   entry.progress=end-start;entry.pass=end>start+.5;
   entry.duration=await page.evaluate(()=>actualProvider.getDuration());
   if(!entry.pass)entry.issue='No sustained progress';
  }catch(e){entry.pass=false;entry.issue=(await page.locator('#youtube-error-message').textContent())||e.message;}
  report.tracks.push(entry);await writeFile(`${output}/real-provider-results.json`,JSON.stringify(report,null,2)+'\n');
  await page.locator('#stop').click();
 }
 report.completed=true;
}catch(e){report.errors.push(e.message);}
finally{if(!report.completed||report.errors.length||report.tracks.some(track=>!track.pass))process.exitCode=1;report.finished=new Date().toISOString();await writeFile(`${output}/real-provider-results.json`,JSON.stringify(report,null,2)+'\n');await browser.close();}
