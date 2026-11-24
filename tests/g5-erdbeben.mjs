import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';import {resolve} from 'node:path';
const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
const page=await b.newPage({viewport:{width:1420,height:880},reducedMotion:'reduce'});const errors=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,200));});
await page.goto(pathToFileURL(resolve('artifacts/GeoRisiko-G5.2-Web-Test.html')).href);
await page.waitForFunction(()=>window.geoObservatory?.().ready);await page.click('#nav-earthquake');await page.waitForFunction(()=>window.geoObservatory().observatory.events===697);
await page.selectOption('#g-launch','san');await page.waitForSelector('#g-cut');await page.click('#g-cut');await page.click('#g-names');await page.click('#g-step');await page.click('#g-step');
await page.waitForFunction(()=>document.querySelectorAll('#observatory-labels span').length===2);await page.screenshot({path:'/tmp/g5-parkfield.png'});
await page.selectOption('#g-site','japan');await page.click('#g-cut');await page.locator('#g-progress').fill('0.68');await page.screenshot({path:'/tmp/g5-japan.png'});
await page.selectOption('#g-sea','flat');await page.click('#g-step');await page.click('#home');await page.click('#nav-nyos');await page.waitForFunction(()=>window.geoObservatory().nyos.terrainVisible);assert.deepEqual(errors,[]);
console.log('Phase B: 697 Ereignisse, Parkfield, Tōhoku, beide Seebebentypen und Rückkehr zum Nyos-See erfolgreich');
}finally{await b.close();}
