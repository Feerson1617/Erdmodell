import { chromium } from "playwright";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
const samples=JSON.parse(readFileSync("src/tectonics/steps.json"));
const browser=await chromium.launch({args:["--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
try{
 const p=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:"reduce"});
 const errors=[];p.on("pageerror",e=>errors.push(e.message));
 await p.goto(pathToFileURL(resolve(process.env.G51_HTML||"artifacts/GeoRisiko-G5.1-Web-Test.html")).href);
 await p.waitForFunction(()=>window.geoObservatory?.().ready);
 await p.click("#nav-earthquake");await p.waitForFunction(()=>window.geoBoundaryModels().length===5819);
 const records=await p.evaluate(()=>window.geoBoundaryModels());
 let sub=0;const polarities=new Set();
 for(const r of records){
   const s=samples[r.id-1];assert.equal(r.pair,s[1]);assert.ok(Number.isFinite(r.elevation)&&Number.isFinite(r.dextral));
   if(s[2]==="SUB"){
     sub++;polarities.add(r.polarity);const dipsRight=s[1][2]==="\\";
     assert.equal(r.descending,dipsRight?r.left:r.right);assert.equal(r.overriding,dipsRight?r.right:r.left);
     assert.equal(r.dipAzimuth,(r.strike+(dipsRight?90:270))%360);
   }else assert.equal(r.descending,null);
 }
 assert.equal(sub,1127);assert.equal(polarities.size,2);
 assert.equal(records[2628].descending,"PA");assert.equal(records[3078].descending,"NZ");assert.equal(records[4208].model,"ridge");
 const data=()=>p.evaluate(()=>window.geoObservatory().observatory);
 const results=[];
 const ready=()=>p.waitForFunction(()=>window.geoObservatory().observatory.ready&&document.querySelector("#g-cut"));
 const progress=async v=>{await p.locator("#g-progress").fill(String(v));await p.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));};
 for(const [i,site] of ["san","japan","rift","himalaya"].entries()){
   await p.selectOption(i?"#g-site":"#g-launch",site);await ready();await p.click("#g-cut");
   const initial=await data();await progress(.52);const event=await data();const f=event.physics;
   assert.ok(f.rupture.length>6);assert.equal(event.focus[0],event.epicenter[0]);assert.ok(event.epicenter[1]>event.focus[1]);
   assert.ok(f.maxPlaneError<2e-5,site+" Bruch auf der Kontaktfläche");assert.ok(f.focusError<1e-8);
   assert.ok(f.earlyShake===0 && f.lateShake===0);assert.ok(f.pArrival<f.sArrival);
   await progress(1);const end=await data();assert.notDeepEqual(end.physics.vertex.drawn,end.physics.vertex.rest);
   await progress(0);assert.deepEqual((await data()).physics.vertex.drawn,initial.physics.vertex.drawn);
   results.push([site,f.fault,f.maxPlaneError]);
   if(site==="japan"){
     await p.selectOption("#g-sea","flat");await ready();const flat=await data();assert.equal(flat.physics.fault,"strike");assert.equal(flat.physics.waterEvent,false);
     await p.selectOption("#g-sea","vertical");await ready();assert.equal((await data()).physics.fault,"interface");
   }
 }
 assert.deepEqual(errors,[]);if(process.env.G51_PHYSICS_LOG)writeFileSync(process.env.G51_PHYSICS_LOG,JSON.stringify({sub,results,records},null,1));
 console.log("5.819 Regionen, 1.127 Polungen, vier gerenderte Störungsfamilien und zwei getrennte Meeresereignisse",results);
}finally{await browser.close();}

