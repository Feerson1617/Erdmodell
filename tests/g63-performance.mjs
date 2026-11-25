// Exercise the two exported products in one browser process. DPR 0.75 fixes both
// ends of the existing resolution controller at the same ratio for this test only.
import {chromium} from "playwright";
import {join,resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {mkdir,writeFile} from "node:fs/promises";
import assert from "node:assert/strict";
const browser=await chromium.launch(process.env.G6_NATIVE_GPU?{headless:false}:{args:["--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
const out=process.env.G63_OUT||"test-results/g63";await mkdir(out,{recursive:true});
const raw={engine:browser.version(),window:[1920,1080],hardware:process.arch,samples:[]},contexts=[];
try{
 for(const file of process.argv.slice(2)){
  const p=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:.75,reducedMotion:"reduce"});
  await p.addInitScript(()=>localStorage.setItem("georisiko.graphics.g6","classroom"));await p.goto(pathToFileURL(resolve(file)).href);
  await p.waitForFunction(()=>window.geoObservatory?.().ready);await p.click("#nav-earthquake");await p.selectOption("#g-launch","japan");
  const ready=()=>p.waitForFunction(()=>{const w=window.geoObservatory();return !w.flying&&w.observatory.ready&&w.observatory.viewSettled;});
  await ready();await p.selectOption("#g-view","coast");await ready();
  await p.addStyleTag({content:".view{width:1600px!important;height:960px!important;position:relative!important}#earth{width:1600px!important;height:960px!important}"});
  await p.waitForFunction(()=>document.querySelector("#earth").width===1200&&document.querySelector("#earth").height===720);
  contexts.push(p);
 }
 for(const round of [0,1,2])for(const index of round%2?[1,0]:[0,1])for(const names of round%2?[false,true]:[true,false]){
  const p=contexts[index];await p.bringToFront();await p.locator("#g-names").setChecked(names);await p.waitForTimeout(450);
  const row=await p.evaluate(async()=>{
   const time=document.querySelector("#g-progress");time.value="0.15";time.dispatchEvent(new Event("input"));
   await new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(ok)));
   const s=window.geoObservatory().observatory,settings={...s.settings};delete settings.moreNames;
   const start={progress:s.progress,view:s.view,playing:s.playing,camera:s.camera,soil:settings.soil,analysis:s.analysis,stress:settings.stress,profile:s.graphics.profile,names:settings.names};
   document.querySelector("#g-play").click();
   const log=await window.geoDeviceProbe(6000);
   document.querySelector("#g-play").click();return {start,log};
  });
  assert.equal(row.start.progress,.15);assert.equal(row.start.playing,false);assert.equal(row.start.names,names);
  assert.equal(row.start.profile,"classroom");assert.equal(row.start.view,"coast");
  for(const s of row.log.states)assert.deepEqual([s.resolution.width,s.resolution.height],[1200,720]);
  const sample={round,version:index?"G6.3.1":"G6.3",names,...row};
  const reference=raw.samples.find(x=>x.names===names);if(reference)assert.deepEqual(row.start,reference.start);
  raw.samples.push(sample);console.log(sample.version,names,row.log.renderedFps);
 }
 // Repeat the same two-globe playback and then measure it explicitly at rest.
 raw.future=[];
 for(const p of contexts){
   await p.bringToFront();await p.click("#nav-plates");await p.click("#g-time");
   await p.selectOption("#g-scenario","aurica");await p.locator("#g-year").fill("100");
   await p.check("#g-compare");await p.selectOption("#g-second","amasia");await p.selectOption("#g-compare-camera","same");
   await p.waitForFunction(()=>window.geoObservatory().observatory.timeReady);
 }
 for(let round=0;round<3;round++)for(const idx of round%2?[1,0]:[0,1]){
   const p=contexts[idx];await p.bringToFront();
   for(const running of [true,false]){
     await p.locator("#g-year").fill("100");await p.waitForFunction(()=>window.geoObservatory().observatory.timeReady&&!window.geoObservatory().flying);
     await p.waitForTimeout(500);
     const sample=await p.evaluate(async running=>{
       let changes=0;const observer=new MutationObserver(records=>changes+=records.length);
       observer.observe(document.querySelector("#sidebar"),{childList:true,subtree:true,characterData:true});
       const o=window.geoObservatory().observatory;
       const start={year:o.year,models:[o.scenario,o.second],eyes:o.cameras,overview:o.overview,profile:o.graphics.profile};
       if(running)document.querySelector("#g-time-play").click();
       const log=await window.geoDeviceProbe(4000);
       observer.disconnect();if(running)document.querySelector("#g-time-play").click();
       return {start,log,changes};
     },running);
     assert.equal(sample.start.year,100);assert.equal(sample.start.overview,false);assert.deepEqual(sample.start.models,["aurica","amasia"]);
     for(const state of sample.log.states)assert.deepEqual([state.resolution.width,state.resolution.height],[1200,720]);
     const first=raw.future.find(v=>v.running===running);if(first)assert.deepEqual(sample.start,first.start);
     if(running)assert.ok(sample.log.renderedFrames>0);else assert.ok(sample.log.renderedFrames<=2);
     raw.future.push({version:idx?"G6.3.1":"G6.3",round,running,...sample});
   }
 }
 assert.equal(raw.future.length,12);
 assert.equal(raw.samples.length,12);raw.complete=true;
}finally{await writeFile(join(out,"Leistungsvergleich.json"),JSON.stringify(raw));await browser.close();}
