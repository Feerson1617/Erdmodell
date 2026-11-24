import {chromium} from 'playwright';
import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';import {resolve} from 'node:path';
const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{const p=await b.newPage({viewport:{width:1366,height:768},reducedMotion:'reduce'});const errors=[];
p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,260));});
await p.goto(pathToFileURL(resolve(process.env.G5_HTML||'artifacts/GeoRisiko-G5.1-Web-Test.html')).href);await p.waitForFunction(()=>window.geoObservatory?.().ready);
for(const [width,height] of [[1920,1080],[1366,768],[1024,768],[768,1024]]){await p.setViewportSize({width,height});await p.click('#nav-plates');assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),String(width));}
await p.setViewportSize({width:1366,height:768});await p.click('#g-forces');await p.waitForSelector('#g-play');await p.click('#g-step');await p.screenshot({path:'/tmp/g5-antrieb.png'});
await p.click('#nav-inside');await p.click('#g-litho');await p.waitForSelector('#g-cut');await p.screenshot({path:'/tmp/g5-litho.png'});
await p.click('#nav-volcano');await p.click('#g-step');await p.locator('#g-progress').fill('0.75');await p.screenshot({path:'/tmp/g5-hawaii.png'});
await p.click('#nav-risk');await p.selectOption('#g-exposure','empty');await p.selectOption('#g-exposure','dense');await p.check('#g-protect');await p.locator('#g-progress').fill('0.54');await p.screenshot({path:'/tmp/g5-schutz.png'});
await p.click('#nav-plates');await p.click('#g-boundaries');await p.waitForFunction(()=>window.geoBoundaryModels().length===5819);
const coverage=await p.evaluate(()=>window.geoBoundaryModels());assert.equal(new Set(coverage.map(s=>s.id)).size,5819);assert.equal(new Set(coverage.map(s=>s.category)).size,7);assert.ok(coverage.every(s=>s.model&&Number.isFinite(s.strike)&&s.lon>=-180&&s.lon<=180));
const ids=await p.locator('#g-example option').evaluateAll(els=>els.map(e=>e.value).filter(Boolean));assert.ok(ids.length>=30);
for(const id of ids){
 await p.selectOption('#g-example',id);await p.waitForFunction(()=>!window.geoObservatory().flying);
 const box=await p.locator('#earth').boundingBox();await p.mouse.click(box.x+box.width/2,box.y+box.height/2);
 assert.equal((await p.evaluate(()=>window.geoObservatory().observatory.selected)),Number(id));await p.click('#g-segment');await p.waitForSelector('#g-cut');await p.click('#g-world');await p.click('#nav-plates');await p.click('#g-boundaries');
}
assert.deepEqual(errors,[]);console.log('Schnittmodelle, Siedlungsvergleich, vier Fenstergrößen und neun weltweit angeklickte Modelltypen erfolgreich');}
finally{await b.close();}
