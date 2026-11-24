import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';import {resolve} from 'node:path';
const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
const p=await b.newPage({viewport:{width:1320,height:820},reducedMotion:'reduce'});const errors=[];
p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,340));});
await p.goto(pathToFileURL(resolve(process.env.G5_HTML||'artifacts/GeoRisiko-G5-Web-Test.html')).href);
await p.waitForFunction(()=>window.geoObservatory?.().ready);await p.click('#nav-plates');await p.click('#g-time');await p.waitForFunction(()=>window.geoObservatory().observatory.timeReady&&!window.geoObservatory().flying);
await p.screenshot({path:'/tmp/g5-pangaea.png'});await p.click('#g-time-play');await p.waitForFunction(()=>window.geoObservatory().observatory.year>-249);await p.click('#g-time-play');await p.click('#g-today');
for(const scenario of ['ultima','novo','aurica','amasia']){
 await p.selectOption('#g-scenario',scenario);await p.locator('#g-year').fill('200');await p.waitForFunction(()=>window.geoObservatory().observatory.year===200);await p.waitForTimeout(100);
}
await p.check('#g-compare');await p.screenshot({path:'/tmp/g5-zukunft.png'});await p.click('#g-to-atlas');await p.waitForSelector('#g-time');assert.deepEqual(errors,[]);console.log('Zeitreise, Pause, vier Zukunftsszenarien und geteilte Ansicht in der Offline-HTML geprüft');
}finally{await b.close();}
