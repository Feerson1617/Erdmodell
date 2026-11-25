// Recorded interactions run against the shipped HTML on the same machine and browser.
import {chromium} from "playwright";
import assert from "node:assert/strict";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {join,resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {screencast} from "./g5-abnahme.mjs";
const file=resolve(process.argv[2]),before=process.argv.includes("--before"),fast=Boolean(process.env.G63_QUICK);
const out=join(process.env.G63_OUT||"test-results/g63",before?"Vorher":"Nachher");await mkdir(out,{recursive:true});
const browser=await chromium.launch(process.env.G6_NATIVE_GPU?{headless:false}:{args:["--enable-unsafe-swiftshader","--use-angle=swiftshader"]});
const p=await browser.newPage({viewport:fast?{width:1280,height:800}:{width:1920,height:1080},deviceScaleFactor:1,reducedMotion:"reduce"});
p.setDefaultTimeout(75000);
await p.addInitScript(()=>{localStorage.setItem("georisiko.graphics.g6","classroom");});
const report={engine:browser.version(),product:createHash("sha256").update(await readFile(file)).digest("hex"),actions:[],shots:[],films:[],checks:[],bench:[],errors:[],network:[]};
p.on("pageerror",e=>report.errors.push(e.message));p.on("request",r=>{if(/^https?:/.test(r.url()))report.network.push(r.url());});await p.route(/^https?:/,r=>r.abort());
const rest=async()=>{await p.waitForFunction(()=>{const w=window.geoObservatory?.(),o=w?.observatory;return w?.ready&&!w.flying&&(o.mode!=="regional"||o.ready&&o.viewSettled)&&(o.mode!=="time"||o.timeReady);});await p.evaluate(()=>new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(ok))));};
const state=()=>p.evaluate(()=>window.geoObservatory());
const act=async(id,value)=>{console.log("Bedienung",id,value??"Klick");const start=Date.now(),e=p.locator('#'+id);if(value===undefined)await e.click();else if(await e.evaluate(x=>x.tagName==="SELECT"))await e.selectOption(String(value));else await e.fill(String(value));await rest();report.actions.push({id,value:value??"Klick",elapsedMs:Date.now()-start});};
const note=async()=>p.evaluate(()=>{const w=window.geoObservatory(),s=w.observatory,canvas=document.querySelector("#earth").getBoundingClientRect();
 const pins=[...document.querySelectorAll(".annotations button")].filter(b=>b.offsetWidth).map(b=>{const v=b.getBoundingClientRect(),a=b.parentElement.getBoundingClientRect();return {name:b.textContent,id:b.dataset.object,x:v.x,y:v.y,w:v.width,h:v.height,anchor:[a.x,a.y]};});
 return {mode:s.mode,site:s.site,view:s.view,model:s.scenario,year:s.year,progress:s.progress,camera:s.camera,playing:s.playing,phase:document.querySelector("#learn-phase")?.textContent,cause:document.querySelector("#learn-cause")?.textContent,release:document.querySelector("#observe-insight")?.textContent,pins,canvas:canvas.toJSON(),pair:w.tectonics?.mosaic?.pair?.step};});
const shot=async name=>{await rest();await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const s=await note();await p.screenshot({type:"jpeg",quality:82,path:join(out,name+".jpg")});report.shots.push({name,...s});console.log(name,s.phase||"",s.pins.map(a=>a.name).join(", "));if(!before)for(const [i,a] of s.pins.entries()){assert.ok(a.x>=s.canvas.x-1&&a.x+a.w<=s.canvas.right+1&&a.y>=s.canvas.y-1&&a.y+a.h<=s.canvas.bottom+1,name+" canvas");for(const b of s.pins.slice(i+1))assert.ok(a.x+a.w<=b.x+1||b.x+b.w<=a.x+1||a.y+a.h<=b.y+1||b.y+b.h<=a.y+1,name+" overlap");}return s;};
const hold=ms=>p.waitForTimeout(before||fast?100:ms);
const film=async(name,fn)=>{if(before||fast)await fn();else{const movie=await screencast(p,out,name,fn,{maxWidth:1366,maxHeight:768,quality:82});assert.ok(movie.seconds>=8,name+" Laufzeit "+movie.seconds);report.films.push(movie);}};
const reg=async(site)=>{await act("nav-earthquake");await act("g-launch",site);};
const playToEnd=async()=>{await act("g-progress",0);if(fast||before){await act("g-progress",.52);return;}await act("g-play");await p.waitForFunction(()=>window.geoObservatory().observatory.progress>=.999);await hold(1700);};
const contrast=async(name,a,b)=>{assert.deepEqual(a,b,name);report.checks.push(name);};
const obs=(id)=>"observe-"+id;
try{
 await p.goto(pathToFileURL(file).href);await rest();
 await act("nav-plates");
 await film("01-Plattenbewegungen",async()=>{
   for(const [id,name] of [[4209,"01-Divergenz"],[2629,"02-Konvergenz"],[2877,"03-Transformbewegung"],[4155,"04-Schraege-Bewegung"]]){
     if(before&&id===4155){await act("atlasWorld");if(!await p.locator("#plateSelect").isVisible())await p.locator("#plateSettings summary").click();await act("plateSelect","BU");await act("atlasCompare");}
     else await act("pair-examples",id);
     if(!before&&id===4155)assert.match(await p.locator(".lesson-lead").textContent(),/schräg/);
     await shot(name);
     await act("atlasPlay");if(fast||before)await hold(250);else await p.waitForFunction(()=>window.geoObservatory().tectonics.mosaic.progress>=.997);
     await hold(1000);await act("atlasReset");
   }
 });
 await act("pair-examples",2629);
 await film("02-Grenzvergleich-und-Schnitt",async()=>{await hold(2200);await act("pair-process");await act("g-view","cut");await shot("05-Prozess");await hold(2500);await shot("10-Subduktionsschnitt");await hold(2200);
   if(!before){await act("g-return-pair");assert.equal((await state()).tectonics.mosaic.pair.step,2629);await hold(1900);}
 });
 if(!before){
   await act("nav-plates");await act("pair-examples",4155);await act("obswitch");
   assert.equal((await note()).pins.length,0);await act("observe-pair-arrows");assert.equal((await state()).tectonics.mosaic.pair.arrows,false);
   await act("observe-pair-step");const step=(await state()).tectonics.mosaic.progress;assert.ok(step>0);
   await act("observe-pair-examples",2629);await act("observe-atlasPlay");await hold(450);await act("observe-atlasPlay");await act("observe-atlasReset");
   await act("observe-pair-process");assert.equal((await state()).observatory.geology.id,2629);await act("observe-return-pair");
   await act("observe-atlasWorld");await act("obswitch");report.checks.push("Grenzwahl, Pfeile, Schritt, Pause, Rückweg und Weltkarte im Beobachtungsmodus");
 }
 await reg("san");await act("g-view","overhead");
 await film("03-Erdbeben",async()=>{await act("g-progress",0);await shot("06-Ausgangszustand");if(!before)assert.ok(!(await note()).pins.some(x=>x.name==="Versetzte Geländelinie"));
   await act("g-progress",.05);const a=(await note()).phase;await p.locator("#g-stress").evaluate(e=>e.click());await hold(300);if(!before)await contrast("Die Analysefarbe verändert die Ereignisphase nicht",a,(await note()).phase);
   await act("g-progress",.30);await shot("07-Spannungsaufbau");await act("g-view","waves");await playToEnd();await act("g-progress",.53);await shot("09-Wellen");await hold(2300);await act("g-view","overhead");await act("g-progress",1);await shot("08-Bleibender-Versatz");await hold(1800);
 });
 await act("g-progress",.3);await act("obswitch");
 await film("07-Beobachten-und-Freigeben",async()=>{
   const s=await shot("17-Beobachten");assert.equal(s.pins.length,0);await hold(1600);
   await p.click("#observe-release summary");await p.click('[data-release="one"]');await hold(650);const one=(await note()).pins;
   if(!before){assert.equal(one.length,1);await p.locator("#earth").hover();await p.mouse.wheel(0,-80);await hold(500);assert.ok((await note()).pins.every(v=>v.id===one[0].id));}
   await p.click('[data-channel="phase"]');await hold(2000);await shot("17a-Freigabe");await p.click('[data-release="none"]');await p.click("#observe-release summary");
   if(!before){await act("think");assert.ok(await p.locator("#think-text").isVisible());await hold(2400);}
   await shot("18-Denkauftrag");if(!before){await act("think");}
   await hold(1700);await act("obswitch");if(!before)assert.equal((await state()).observatory.progress,.3);
 });
 if(!before){await act("focus-reading");await hold(350);await contrast("Lesefokus erhält Modellzeit",.3,(await state()).observatory.progress);await act("focus-reading");}
 const pin=p.locator("#observatory-labels button:visible").first();await pin.click();await shot("19-Objektauswahl");if(!before)assert.ok((await p.locator("#g-object").textContent()).length>15);
 await reg("japan");await act("g-view","water");await act("g-progress",.48);await shot("11-Seebeben");
 await film("04-Seebeben-und-Kueste",async()=>{await act("g-sea","flat");await act("g-progress",0);await hold(1500);await act("g-progress",1);if(!before)assert.equal((await note()).phase,"Nach dem Bruch");await hold(1800);await act("g-sea","buried");await hold(1800);await act("g-sea","vertical");await act("g-view","ocean");await playToEnd();await shot("12-Tsunami");
   await act("g-view","coast");await playToEnd();await act("g-progress",.658);await shot("13-Ueberflutung");await hold(2000);await act("g-progress",.94);await shot("13a-Rueckzug");await hold(1700);
 });
 await act("nav-plates");await act("g-time");
 await film("05-Historische-Zeitreise",async()=>{await shot("14-Pangaea");await act("g-track","501");await act("g-time-play");await hold(6500);await act("g-time-play");await act("g-year",-100);await shot("15-Kontinentalbewegung");await hold(2000);await act("g-today");await hold(1900);});
 await act("g-scenario","aurica");await act("g-year",160);await act("g-compare");await act("g-second","amasia");
 await film("06-Zukunftsvergleich",async()=>{await shot("16-Zukunft-Uebersicht");await hold(2900);if(!before){
   const x=(await state()).observatory;assert.notDeepEqual(x.cameras[0],x.cameras[1]);await act("g-compare-camera","same");
   const mirror=(await state()).observatory.cameras;assert.deepEqual(mirror[0],mirror[1]);}
   await shot("16a-Gleiche-Perspektive");await hold(2900);
   for(const [first,second,age] of [["novo","ultima",80],["ultima","aurica",200],["amasia","novo",110]]){await act("g-scenario",first);await act("g-second",second);await act("g-year",age);await hold(1300);}
   if(!before){const models=["aurica","amasia","ultima","novo"];
     for(const [i,a] of models.entries())for(const b of models.slice(i+1)){await act("g-scenario",a);await act("g-second",b);
       for(const [age,mode] of [[60,"same"],[160,"overview"]]){
         await act("g-year",age);await act("g-compare-camera",mode);const v=(await state()).observatory;
         assert.equal(v.timeReady,true);assert.equal(v.scenario,a);assert.equal(v.second,b);assert.equal(v.compare,true);
         if(mode==="same")assert.deepEqual(v.cameras[0],v.cameras[1]);else assert.notDeepEqual(v.cameras[0],v.cameras[1]);
         report.checks.push({scenarios:[a,b],age,mode});
       }
     }
   }
   await act("g-today");assert.equal((await state()).observatory.year,0);
 });
 await act("nav-nyos");await p.waitForFunction(()=>window.geoObservatory().nyos.terrainVisible);
 await film("08-Nyos-See-und-Vorsorge",async()=>{const prefix=before?"":"observe-";if(!before)await act("obswitch");
   await act(prefix+"nyos-section");await act(prefix+"nyos-dissolved");await hold(1800);await shot("20-Nyos");
   await act(prefix+"nyos-event");await act(prefix+"nyos-play");
   if(!fast){await p.waitForFunction(()=>window.geoObservatory().nyos.progress>=.58,{},{timeout:90000});await act(prefix+"nyos-air");await p.waitForFunction(()=>window.geoObservatory().nyos.progress>=.90);}
   await act(prefix+"nyos-protection");for(const m of ["pipe","monitor","settlements"]){await act(prefix+"nyos-measure",m);if(m==="pipe"){await act(prefix+"nyos-play");await hold(3200);}else await hold(1700);}
   await shot("20a-Vorsorge");if(!before)await act("obswitch");
 });
 if(!before){
   await reg("san");await act("g-view","waves");await act("g-progress",.53);
   for(const size of [{width:1024,height:768},{width:768,height:960},{width:1920,height:1080}]){await p.setViewportSize(size);await hold(350);await shot("21-Layout-"+size.width);}
   await act("present");await shot("22-Praesentation");await act("present");
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.network,[]);report.complete=true;
}catch(e){report.failure=String(e.stack);await p.screenshot({path:join(out,"Fehler.jpg")}).catch(()=>{});throw e;}
finally{await writeFile(join(out,"Unterricht.json"),JSON.stringify(report,null,2));await browser.close();}
