import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {chromium} from "playwright";
import {pathToFileURL} from "node:url";import {resolve} from "node:path";
const idx=JSON.parse(readFileSync("public/data/g51/historic.json")),bytes=readFileSync("public/data/g51/historic-rotations.f32");
const q=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.length/4);
assert.equal(q.length,idx.pids.length*251*4);
for(let i=0;i<q.length;i+=4)assert.ok(Math.abs(Math.hypot(q[i],q[i+1],q[i+2],q[i+3])-1)<.000002);
const b=await chromium.launch({args:["--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
try{
 const page=await b.newPage({viewport:{width:1440,height:900},reducedMotion:"reduce"});
 const errors=[];page.on("pageerror",e=>errors.push(String(e)));page.on("console",m=>{if(m.type()==="error")errors.push(m.text());});
 await page.goto(pathToFileURL(resolve(process.env.G51_HTML||"artifacts/GeoRisiko-G5.2-Web-Test.html")).href);
 await page.click("#nav-plates");await page.click("#g-time");
 const get=()=>page.evaluate(()=>window.geoObservatory().observatory);
 await page.waitForFunction(()=>window.geoObservatory().observatory.rigid);
 await page.locator("#g-tracking summary").click();await page.selectOption("#g-track","501");await page.check("#g-trail");
 const age=async years=>{await page.locator("#g-year").fill(String(years));await page.waitForFunction(y=>{const s=window.geoObservatory().observatory;return s.year===y && s.timeReady;},years);};
 const coords=[];for(let y=-250;y<=0;y+=5){await age(y);coords.push((await get()).tracked);}
 assert.ok(new Set(coords.map(v=>v.join(","))).size>45);
 await page.click("#g-reverse");await page.waitForFunction(()=>window.geoObservatory().observatory.year<-1);await page.click("#g-time-play");
 for(const id of ["201","701","501","801","802","101","301"]){await page.selectOption("#g-track",id);assert.equal((await get()).tracked.length,3);}
 await page.click("#g-today");await page.locator("#g-gnss summary").click();await page.selectOption("#g-station-gnss","KOKB");assert.match(await page.locator("#g-gnss-text").innerText(),/Nordwesten/);
 for(const m of ["ultima","novo","aurica","amasia"]){
   await page.selectOption("#g-scenario",m);await page.check("#g-future-lines");await age(175);await page.check("#g-compare");
   for(const other of ["ultima","novo","aurica","amasia"].filter(x=>x!==m)){await page.selectOption("#g-second",other);assert.equal((await get()).second,other);}
   await page.uncheck("#g-compare");
 }
 assert.deepEqual(errors,[]);console.log("51 Kartenstände, 519 zeitgültige Kontinentalgeometrien, sieben Bezugspunkte, 12 geordnete Zukunftspaare, GNSS");
}finally{await b.close();}

