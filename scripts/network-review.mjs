import {chromium} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
await mkdir('reports/feature-review',{recursive:true});
const browser=await chromium.launch();const context=await browser.newContext();const page=await context.newPage();const report={events:[],errors:[]};
page.on('pageerror',e=>report.errors.push(e.message));
await page.addInitScript(()=>{let ready;Object.defineProperty(window,'onYouTubeIframeAPIReady',{configurable:true,get:()=>ready,set:callback=>{ready=()=>{const Original=YT.Player;YT.Player=new Proxy(Original,{construct(Target,args){const p=Reflect.construct(Target,args);window.actualProvider=p;return p;}});callback();};}});});
try{
 await page.goto(process.env.REVIEW_URL || 'http://localhost:5187/?practice=1');await page.locator('#tracks tr').first().waitFor();await page.locator('#start-set').click();await page.waitForFunction(()=>window.actualProvider?.getCurrentTime?.()>1,null,{timeout:30000});
 await context.setOffline(true);await page.locator('#next').click();await page.waitForTimeout(17000);report.events.push({phase:'offline',waiting:await page.locator('#playback-stall').isVisible(),title:await page.locator('#playing-title').textContent()});
 await context.setOffline(false);if(await page.locator('#resume-video').isVisible())await page.locator('#resume-video').click();else await page.locator('#youtube-retry').click();
 await page.waitForFunction(()=>actualProvider.getPlayerState()===1&&actualProvider.getCurrentTime()>2,null,{timeout:30000});report.events.push({phase:'recovered',title:await page.locator('#playing-title').textContent(),position:await page.locator('#position').textContent()});report.completed=true;
}catch(e){report.errors.push(e.message);}
finally{if(!report.completed||report.errors.length||!report.events.find(event=>event.phase==='offline')?.waiting)process.exitCode=1;await writeFile('reports/feature-review/network-results.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
