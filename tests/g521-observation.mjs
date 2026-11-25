import {chromium} from "playwright";
import {PNG} from "pngjs";
import assert from "node:assert/strict";
import {mkdir,writeFile} from "node:fs/promises";
import {resolve,join} from "node:path";
import {pathToFileURL} from "node:url";
const out=process.env.G521_OUT??"test-results/mac/G521";await mkdir(out,{recursive:true});
const browser=await chromium.launch(process.env.G6_NATIVE_GPU?{channel:"chrome",headless:false}:{args:["--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
try{
 const p=await browser.newPage({viewport:{width:1366,height:768},reducedMotion:"reduce"});p.setDefaultTimeout(90000);
 await p.goto(pathToFileURL(resolve("artifacts/GeoRisiko-G6.4-Web-Test.html")).href);
 const state=()=>p.evaluate(()=>window.geoObservatory().observatory);
 const settle=()=>p.waitForFunction(()=>{const w=window.geoObservatory?.(),s=w?.observatory;return w?.ready&&!w.flying&&(s.mode!=="regional"||s.ready&&s.viewSettled)&&(s.mode!=="time"||s.timeReady);});
 const choose=async(id,v)=>{await p.selectOption("#"+id,v);await settle();};
 const click=async id=>{await p.click("#"+id);await settle();};
 await settle();await p.click("#saved-views");await p.selectOption("#saved-list","p3");await p.click("#view-apply");await p.waitForSelector(".classroom-views",{state:"hidden"});await settle();
 const shot=async()=>PNG.sync.read(await p.screenshot({clip:{x:370,y:220,width:500,height:320}}));
 const loaded=await shot();await click("observe-stress");const natural=await shot();
 let changed=0;for(let i=0;i<loaded.data.length;i+=4)if([0,1,2].some(k=>Math.abs(loaded.data[i+k]-natural.data[i+k])>12))changed++;
 assert.ok(changed>1500,"Oberflächenänderung in der Draufsicht "+changed);assert.equal((await state()).progress,.30);
 await click("observe-detail");assert.equal((await state()).view,"waves");assert.equal((await state()).settings.detail,true);
 assert.equal(await p.innerText("#observe-cut"),"An die Oberfläche");await click("observe-cut");assert.equal(await p.innerText("#observe-cut"),"Untergrund öffnen");assert.equal((await state()).progress,.3);
 await click("nav-risk");await choose("observe-risk-site","far");await choose("observe-soil","loose");await click("observe-protect");const risk=await state();assert.equal(risk.settings.riskSite,"far");assert.equal(risk.settings.soil,"loose");assert.ok(risk.settings.protection);
 await click("nav-plates");await click("observe-time");await choose("observe-scenario","ultima");await click("observe-compare");await choose("observe-second","aurica");const initial=(await state()).futureLines;await click("observe-future-lines");
 await p.waitForFunction(old=>{const s=window.geoObservatory().observatory;return s.futureLines!==old&&document.querySelector("#observe-future-lines").getAttribute("aria-pressed")===String(s.futureLines);},initial);
 assert.ok((await state()).compare);assert.equal((await state()).second,"aurica");
 await click("nav-plates");await click("observe-boundaries");await choose("observe-example","1438");
 const box=await p.locator("#earth").boundingBox();await p.mouse.click(box.x+box.width/2,box.y+box.height/2);await click("observe-quake-explain");
 const boundary=await state();assert.equal(boundary.geology.id,1438);assert.equal(boundary.theme,"earthquake");
 await writeFile(join(out,"Bedienung.json"),JSON.stringify({loadedGroundPixels:changed,sampledPixels:160000,particleDetail:true,cutLabels:true,
   timePreserved:true,risk:{site:risk.settings.riskSite,soil:risk.settings.soil,protected:risk.settings.protection},compared:["ultima","aurica"],futureLines:true,boundary:boundary.geology.id},null,2));
}finally{await browser.close();}
