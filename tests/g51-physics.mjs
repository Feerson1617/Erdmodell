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
 await p.goto(pathToFileURL(resolve(process.env.G51_HTML||"artifacts/GeoRisiko-G5.2-Web-Test.html")).href);
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
   const movement=end.physics.vertices.map(v=>({side:v.side,x:v.drawn[0]-v.rest[0],y:v.drawn[1]-v.rest[1],z:v.drawn[2]-v.rest[2]}));
   for(const d of movement){
     if(site==="san"){assert.ok(Math.abs(d.x)+Math.abs(d.y)<1e-5);assert.ok(d.z*d.side*f.sense>0);}
     if(site==="rift"){assert.ok(d.side===0?d.y<0&&Math.abs(d.x)<1e-5:d.x*d.side>0&&Math.abs(d.y)<1e-5);}
     if(site==="himalaya"){assert.ok(d.y*d.side*f.dipSign>0);assert.ok(Math.abs(d.x+f.dipSign*d.y/Math.tan(27*Math.PI/180))<2e-5);}
     if(site==="japan"){assert.ok(d.y*d.side*f.dipSign>=-1e-6);assert.ok(Math.abs(d.z)<1e-5);}
   }
   if(site==="japan"){
     assert.ok(f.profilePoints.every(v=>Math.abs(v.y+v.km*12*4.7/320)<.00001));
     assert.ok(f.waterSignals.every(row=>row.every(Number.isFinite)));assert.ok(Math.max(...f.waterSignals.map(s=>Math.abs(s[1]-f.waterSignals[0][1])))>0.0001);
   }
   await progress(0);
   const reset=await data();assert.deepEqual(reset.physics.vertices,initial.physics.vertices);
   assert.deepEqual((await data()).physics.vertex.drawn,initial.physics.vertex.drawn);
   results.push({site,fault:f.fault,maxPlaneError:f.maxPlaneError,focusError:f.focusError,pArrival:f.pArrival,sArrival:f.sArrival,movement,waterSignals:f.waterSignals});
   if(site==="japan"){
     await p.selectOption("#g-sea","flat");await ready();const flat=await data();assert.equal(flat.physics.fault,"strike");assert.equal(flat.physics.waterEvent,false);
     await p.selectOption("#g-sea","vertical");await ready();assert.equal((await data()).physics.fault,"interface");
   }
 }
 for(const [nav,child] of [["nav-volcano",null],["nav-plates","g-forces"]]){
   await p.click("#"+nav);if(child)await p.click("#"+child);await ready();await progress(.59);
   const state=await data();assert.equal(state.physics.waterEvent,false);assert.equal(state.physics.rupture.length,0);assert.deepEqual(state.physics.waveFronts,[false,false]);
 }
 await p.click("#nav-plates");await p.click("#g-time");await p.waitForFunction(()=>window.geoObservatory().observatory.timeReady);
 assert.equal((await data()).physics,undefined);
 assert.deepEqual(errors,[]);if(process.env.G51_PHYSICS_LOG)writeFileSync(process.env.G51_PHYSICS_LOG,JSON.stringify({sub,results,records},null,1));
 console.log("5.819 Regionen, 1.127 Polungen, vier gerenderte Störungsfamilien und zwei getrennte Meeresereignisse",results.map(r=>[r.site,r.maxPlaneError]));
}finally{await browser.close();}

