// Exercise the two exported products in one browser process. DPR 0.75 fixes both
// ends of the existing resolution controller at the same ratio for this test only.
import {chromium} from "playwright";
import {join,resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {mkdir,writeFile} from "node:fs/promises";
import assert from "node:assert/strict";
const browser=await chromium.launch(process.env.G6_NATIVE_GPU?{channel:"chrome",headless:false}:{args:["--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
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
  const sample={round,version:index?"G6.3":"G6.2",names,...row};
  const reference=raw.samples.find(x=>x.names===names);if(reference)assert.deepEqual(row.start,reference.start);
  raw.samples.push(sample);console.log(sample.version,names,row.log.renderedFps);
 }
 assert.equal(raw.samples.length,12);raw.complete=true;
}finally{await writeFile(join(out,"Leistungsvergleich.json"),JSON.stringify(raw));await browser.close();}
