// Run the same classroom journeys against both shipped single-file products.
import {chromium} from "playwright";
import assert from "node:assert/strict";
import {mkdir,writeFile,readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {resolve,join} from "node:path";
import {pathToFileURL} from "node:url";
import {screencast} from "./g5-abnahme.mjs";

const file=process.argv[2],before=process.argv.includes("--before"),out=resolve(process.env.G62_OUT||"test-results/g62",before?"Vorher":"Nachher");
await mkdir(out,{recursive:true});
const browser=await chromium.launch(process.env.G6_NATIVE_GPU?{channel:"chrome",headless:false}:{args:["--enable-unsafe-swiftshader","--use-angle=swiftshader"]});
const size=process.env.G62_SMALL?{width:1366,height:800}:{width:1920,height:1080};
const p=await browser.newPage({viewport:size,deviceScaleFactor:1,reducedMotion:"reduce"});p.setDefaultTimeout(75000);
const report={product:/^http/.test(file)?file:createHash("sha256").update(await readFile(file)).digest("hex"),size,engine:browser.version(),before,shots:[],actions:[],movies:[],checks:[],errors:[],network:[],measurements:[]};
p.on("pageerror",e=>report.errors.push(e.message));p.on("console",e=>{if(e.type()==="error")report.errors.push(e.text());});
if(!/^http/.test(file)){p.on("request",r=>{if(/^https?:/.test(r.url()))report.network.push(r.url());});await p.route(/^https?:/,r=>r.abort());}
const state=()=>p.evaluate(()=>window.geoObservatory().observatory);
const rest=async()=>{await p.waitForFunction(()=>{const w=window.geoObservatory?.(),s=w?.observatory;return w?.ready&&!w.flying&&(s.mode!=="regional"||s.ready&&s.viewSettled)&&(s.mode!=="time"||s.timeReady);});await p.evaluate(()=>new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(ok))));};
const act=async(id,value)=>{report.actions.push([id,value??"Klick"]);const el=p.locator("#"+id);
 if(value===undefined)await el.click();else if(await el.evaluate(e=>e.tagName==="SELECT"))await el.selectOption(String(value));else await el.fill(String(value));await rest();};
const shot=async(name)=>{
 await rest();const result=await p.evaluate(()=>{
   const w=window.geoObservatory(),s=w.observatory,box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};};
   return {mode:s.mode||w.mode,site:s.site,step:s.geology?.id??w.tectonics?.mosaic?.pair?.step,view:s.view,phase:s.progress??s.year??w.tectonics?.mosaic?.progress,camera:s.camera,canvas:box(document.querySelector("#earth")),title:document.querySelector("#learn-phase")?.textContent,term:document.querySelector("#learn-term,.boundary-lesson h1")?.textContent,observing:document.body.classList.contains("observing"),pins:[...document.querySelectorAll(".annotations button")].filter(b=>b.offsetWidth).map(e=>({name:e.innerText,...box(e)}))};});
 if(!before)for(const [i,a] of result.pins.entries()){
   assert.ok(a.x>=result.canvas.x-1&&a.x+a.w<=result.canvas.x+result.canvas.w+1&&a.y>=result.canvas.y-1&&a.y+a.h<=result.canvas.y+result.canvas.h+1,name+" bounds "+a.name);
   for(const b of result.pins.slice(i+1))assert.ok(a.x+a.w<=b.x+1||b.x+b.w<=a.x+1||a.y+a.h<=b.y+1||b.y+b.h<=a.y+1,name+" collision "+a.name+"/"+b.name);
 }
 await p.screenshot({path:join(out,name+".jpg"),type:"jpeg",quality:81});report.shots.push({name,...result});console.log(name,result.title||"",result.pins.map(v=>v.name).join(", "));
};
const film=async(name,fn)=>{if(before||process.env.G62_NO_FILM)await fn();else report.movies.push(await screencast(p,out,name,fn));};
const measure=async(name)=>{if(!process.env.G62_BENCH)return;await act("g-play");const data=await p.evaluate(()=>window.geoDeviceProbe(3500));await act("g-play");report.measurements.push({name,renderedFps:data.renderedFps,frames:data.renderedFrames,raf:data.fps,p95:data.p95,max:data.max,gaps:data.gaps,resolution:data.states.at(-1).resolution,profile:data.states.at(-1).observatory.graphics});};
const selectPair=async(code)=>{await act("nav-plates");if(!await p.locator("#plateSelect").count())await act("atlasWorld");if(!await p.locator("#plateSelect").isVisible())await p.locator("#plateSettings summary").click();await act("plateSelect",code);await act("atlasCompare");};
const visit=async(site,theme="earthquake")=>{await act(theme==="volcano"?"nav-volcano":"nav-earthquake");await act(theme==="volcano"?"g-site":"g-launch",site);};
async function checkPair(name,code){
 await selectPair(code);await shot(name);
 if(!before){const step=await p.evaluate(()=>window.geoObservatory().tectonics.mosaic.pair.step);assert.ok(await p.locator("#pair-process").isVisible());
   const box=await p.locator("#earth").boundingBox();assert.ok(box.width/size.width>=.54&&box.width/size.width<=.66);
   await act("pair-process");assert.equal((await state()).geology.id,step);report.checks.push({name,transferred:step});}
}
try{
 await p.goto(/^http/.test(file)?file:pathToFileURL(resolve(file)).href);await rest();
 await p.click("#g6-quality-menu summary");await p.selectOption("#graphics-profile","classroom");await rest();
 await film("A-Platteninteraktionen",async()=>{await selectPair("EU");await act("atlasPlay");await p.waitForTimeout(730);await act("atlasPlay");
 await shot("01a-Divergenz-in-Bewegung");await checkPair("01-Divergenz","EU");await selectPair("OK");await act("atlasPlay");await p.waitForTimeout(650);await act("atlasPlay");await act("atlasReset");await shot("03-Subduktion");if(!before){assert.match(await p.locator(".boundary-lesson").innerText(),/Pazifische Platte taucht ab/);await act("pair-process");assert.equal((await state()).geology.descending,"PA");}await checkPair("05-Transformbewegung","NA");});
 await checkPair("02-Kontinentaler-Graben","AF");await checkPair("04-Kontinentkollision","IN");await checkPair("06-Inselbogen","TO");await checkPair("06b-Untermeerische-Transformgrenze","CL");
 await act("nav-plates");if(!await p.locator("#plateSelect").count())await act("atlasWorld");
 if(before){await act("g-boundaries");await act("g-example","3986");const b=await p.locator("#earth").boundingBox();await p.mouse.click(b.x+b.width/2,b.y+b.height/2);await rest();}else await act("pair-examples","3986");
 await shot("07-Komplexe-Grenze");if(!before){assert.match(await p.locator(".boundary-lesson h1").innerText(),/Komplex/);await act("atlasWorld");}else await act("nav-plates");await shot("08-Plattenatlas");
 await act("nav-inside");await shot("09-Schalenbau");if(!before)assert.equal(await p.locator("#pins button:visible").count(),4);
 await p.locator("#lithosphere").check();await shot("10-Lithosphaere");await act("nav-plates");await act("g-forces");await act("g-view","cut");await shot("11-Plattenantrieb");
 await act("nav-earthquake");await p.uncheck("#g-lines");await shot("11a-Erdbebenpunkte");await p.check("#g-lines");await shot("11b-Punkte-und-Grenzen");
 await visit("san");await act("g-view","overhead");await act("obswitch");await act("observe-stage",".30");await shot("30-Beobachten-Parkfield");
 await film("E-Erklaeren-und-Beobachten",async()=>{
  const old=await state();
  if(!before){assert.equal(await p.locator("#observatory-labels button:visible").count(),0);await p.click("#observe-release summary");await p.click('[data-channel="phase"]');await p.waitForFunction(()=>document.querySelector("#observe-insight").textContent.includes("Spannungsaufbau"));await p.click('[data-release="one"]');await p.waitForTimeout(280);await shot("30a-Erste-Freigabe");await p.click('[data-release="none"]');assert.equal(await p.locator("#observe-insight").innerText(),"");await p.click("#observe-release summary");}
  await act("obswitch");const current=await state();assert.deepEqual(old.camera,current.camera);assert.equal(old.progress,current.progress);assert.equal(old.playing,current.playing);
 });
 await film("B-Erdbeben",async()=>{
   await act("g-progress",0);await shot("12-Vor-dem-Bruch");await p.locator("#g-stress").evaluate(e=>{if(!e.checked)e.click();});await act("g-progress",.30);await shot("13-Spannungsaufbau");await act("g-progress",.49);await shot("14-Bruch-und-Versatz");
   await act("g-view","focus");await act("g-progress",.37);await shot("15-Herd-und-Epizentrum");
   await act("g-view","waves");await act("g-progress",.53);await shot("16-Wellen");if(!before){const pin=p.locator("#observatory-labels button:visible").first();await pin.click();assert.ok((await p.locator("#g-object").innerText()).length>20);assert.equal((await state()).progress,.53);await shot("16a-Objektauswahl");}
 });
 const favoriteKey="georisiko.unterrichtsansichten.v1",favPath=process.env.G62_FAVORITE||join(out,"..","Favorit-G61.json");
 if(before){
   await act("saved-views");await p.fill("#view-name","G6.1 · Wellen in Parkfield");await p.click("#view-save");await p.click("#view-close");
   const saved=await p.evaluate(k=>JSON.parse(localStorage.getItem(k)),favoriteKey);
   await writeFile(favPath,JSON.stringify(saved,null,2));report.checks.push({saved:saved[0].name});
 }else if(process.env.G62_BENCH||process.env.G62_FAVORITE){
   const saved=JSON.parse(await readFile(favPath));await p.evaluate(([k,v])=>localStorage.setItem(k,JSON.stringify(v)),[favoriteKey,saved]);
   await act("g-progress",.12);await act("saved-views");await p.selectOption("#saved-list","s0");await p.click("#view-apply");await rest();
   const now=await state(),old=saved[0].scene.region;assert.equal(now.site,"san");assert.equal(now.view,old.view);assert.equal(now.progress,old.settings.progress);assert.equal(now.playing,false);
   assert.ok(now.camera.position.every((x,i)=>Math.abs(x-old.position[i])<1e-7));report.checks.push({oldFavorite:saved[0].name,restored:true,view:now.view,progress:now.progress});
 }
 await act("g-progress",.1);await measure("Parkfield · Wellen");
 await visit("japan");await act("g-view","cut");await act("g-progress",.4);await shot("17-Seebeben");
 await film("D-Seebeben-und-Tsunami",async()=>{
   await act("g-view","water");await act("g-progress",.48);await shot("18-Meeresboden");await act("g-sea","flat");await shot("18a-Seitenversatz");await act("g-sea","buried");await shot("18b-Tiefer-Bruch");await act("g-sea","vertical");await act("g-view","ocean");await act("g-progress",.65);await shot("19-Tsunami");
   await act("g-view","coast");await act("g-progress",.658);await shot("20-Ueberflutung");await act("g-progress",.94);await shot("20a-Rueckzug");
 });await act("g-progress",.15);await measure("Schematische Küste");
 await visit("island","volcano");await act("g-view","vent");await act("g-progress",.86);await shot("21-Island");await act("g-view","ground");await shot("21a-Lokale-Lava");await act("g-eruption","explosive");await shot("21b-Explosiv-im-Nahmodell");if(!before)assert.ok(await p.locator("#g-play").isDisabled());
 await visit("hawaii","volcano");await act("g-progress",.86);await shot("22-Hawaii");await visit("japan","volcano");await act("g-view","vent");await act("g-eruption","explosive");await act("g-progress",.76);await shot("23-Japan");
 await visit("japan");await act("g-view","ground");await shot("23a-Ruhige-Bucht");if(!before){assert.ok(await p.locator("#g-play").isDisabled());await act("g-local-process");assert.equal((await state()).view,"water");}
 await act("nav-plates");await act("g-time");
 await film("C-Zeitreise",async()=>{await shot("24-Pangaea");await act("g-time-play");await p.waitForTimeout(800);await act("g-time-play");if(!await p.locator("#g-track").isVisible())await p.click("#g-tracking summary");await act("g-track","501");await act("g-year",-100);await shot("25-Kontinentalbewegung");await act("g-today");await shot("25a-Gegenwart");await act("g-scenario","aurica");await act("g-year",160);await p.check("#g-compare");await act("g-second","amasia");await shot("26-Zukunftsvergleich");});
 await act("nav-risk");await act("g-exposure","dense");await act("g-progress",.53);await shot("27-Verwundbarkeit");await p.check("#g-protect");await p.locator("#g-route").evaluate(e=>e.click());await p.locator("#g-warning").evaluate(e=>e.click());await act("g-progress",.85);await shot("28-Schutzmassnahmen");
 await act("nav-nyos");await p.waitForFunction(()=>window.geoObservatory().nyos.terrainVisible);await act("nyos-section");await shot("29-Nyos");await act("obswitch");await shot("30b-Beobachten-Nyos");await act("obswitch");
 if(!before){await visit("san");await act("g-view","waves");await act("g-progress",.53);for(const sz of [{width:1024,height:768},{width:768,height:960},size]){await p.setViewportSize(sz);await p.waitForTimeout(250);await shot("31-Layout-"+sz.width);}
 await act("present");await shot("32-Praesentation");await act("present");
 await act("g-view","overhead");await act("g-progress",.30);
 const canvas=await p.locator("#earth").boundingBox(),cx=canvas.x+canvas.width*.55,cy=canvas.y+canvas.height*.56;
 const original=await state();await p.mouse.move(cx,cy);await p.mouse.down();await p.mouse.move(cx+80,cy+19,{steps:8});await p.mouse.up();
 await p.mouse.wheel(0,-140);await p.waitForTimeout(450);await rest();const moved=await state();
 assert.notDeepEqual(original.camera,moved.camera);assert.equal(original.progress,moved.progress);assert.equal(moved.playing,false);
 await shot("33-Pause-Drehen-und-Zoom");
 const anchor=await p.locator("#observatory-labels button:visible").first().evaluate(b=>{const r=b.parentElement.getBoundingClientRect();return [r.left,r.top];});
 await p.mouse.click(...anchor);await rest();assert.ok((await p.locator("#g-object").innerText()).length>15);
 report.checks.push({cameraChanged:true,pausedAt:moved.progress,hit:await p.locator("#g-object").innerText()});}
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.network,[]);report.complete=true;
}catch(error){report.failure=String(error.stack);await p.screenshot({path:join(out,"Fehler.jpg"),type:"jpeg"}).catch(()=>{});throw error;}finally{await writeFile(join(out,"Unterricht.json"),JSON.stringify(report,null,2));await browser.close();}
