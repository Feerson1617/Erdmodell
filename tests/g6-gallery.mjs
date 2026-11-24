// Exercise the same product controls, camera poses and model phases in both releases.
import {chromium} from "playwright";
import assert from "node:assert/strict";
import {mkdir,writeFile} from "node:fs/promises";
import {resolve,join} from "node:path";
import {pathToFileURL} from "node:url";
import {execFileSync} from "node:child_process";
const out=resolve(process.env.G6_OUT??"test-results/g6"),group=process.env.G6_GROUP;
await mkdir(out,{recursive:true});
const server=await chromium.launchServer({headless:!process.env.G6_CHROME,...(process.env.G6_CHROME?{channel:"chrome"}:{args:["--use-angle=swiftshader","--enable-unsafe-swiftshader"]})});
const viewport=process.env.G6_STAGE&&process.env.G6_STAGE!=="Profile"?{width:1280,height:720}:{width:1920,height:1080};
const browser=await chromium.connect(server.wsEndpoint()),ctx=await browser.newContext({viewport,deviceScaleFactor:1,reducedMotion:"reduce"});
// On the paired measurement bench lock CSS-to-framebuffer scale before first draw.
if(process.env.G6_CHROME)await ctx.addInitScript(()=>{
  window.__THREE_DEVTOOLS__=new EventTarget();
  window.__THREE_DEVTOOLS__.addEventListener("observe",({detail:r})=>{if(r.isWebGLRenderer){const original=r.setPixelRatio.bind(r);r.setPixelRatio=()=>original(1);}});
});
const p=await ctx.newPage();p.setDefaultTimeout(110000);const errors=[],network=[],rows=[];
p.on("pageerror",e=>{errors.push(e.message);console.error(e.message);});p.on("console",m=>{if(m.type()==="error"){errors.push(m.text());console.error(m.text());}});p.on("request",r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
await ctx.route(/^https?:/,route=>route.abort());
const rss=()=>{const ps=execFileSync("ps",["-axo","pid=,ppid=,rss="],{encoding:"utf8"}).trim().split("\n").map(line=>line.trim().split(/\s+/).map(Number)),tree=new Set([server.process().pid]);
 for(let n=0;n!==tree.size;){n=tree.size;for(const [id,parent] of ps)if(tree.has(parent))tree.add(id);}
 return ps.reduce((sum,[id,,kb])=>sum+(tree.has(id)?kb:0),0)/1024;};
const state=()=>p.evaluate(()=>window.geoObservatory());
const rest=async()=>{await p.waitForFunction(()=>{const w=window.geoObservatory?.(),s=w?.observatory;return w?.ready&&!w.flying&&(s?.mode!=="regional"||s.ready&&s.viewSettled)&&(s?.mode!=="time"||s.timeReady);});await p.evaluate(()=>new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(ok))));};
const click=async id=>{console.log("click",id);await p.click("#"+id);},select=async(id,v)=>{console.log("choose",id,v);await p.selectOption("#"+id,v);},phase=async v=>p.locator("#g-progress").fill(String(v));
let loadMs=0;
const visit=async(site,volcano=false)=>{const start=performance.now();await click(volcano?"nav-volcano":"nav-earthquake");if(volcano)await rest();await select(volcano?"g-site":"g-launch",site);await rest();loadMs=performance.now()-start;};
const view=async v=>{await select("g-view",v);await rest();};
// Load a reproducible coastal camera via the product's saved-view format. The
// Tōhoku model covers 320 km, with its real shoreline at the western edge.
const savedCamera=async(name,position,target)=>{
 await click("saved-views");await p.fill("#view-name",name);await click("view-save");
 const id=await p.locator("#saved-list").inputValue();await click("view-close");
 await p.evaluate(({id,position,target})=>{const key="georisiko.unterrichtsansichten.v1",items=JSON.parse(localStorage.getItem(key));
   const region=items[Number(id.slice(1))].scene.region;region.position=position;region.target=target;localStorage.setItem(key,JSON.stringify(items));},{id,position,target});
 await click("saved-views");await select("saved-list",id);await click("view-apply");await p.waitForSelector(".classroom-views",{state:"hidden"});await rest();
};
const coastCamera=()=>savedCamera("Sichtprüfung · Küste von Tōhoku",[-2.47,1.68,-.63],[-5.72,.06,-2.83]);
const basaltCamera=()=>savedCamera("Sichtprüfung · Lavafeld auf Reykjanes",[3.5,1.62,-4.0],[.30,.065,-1.80]);
const shot=async(name,measure=false)=>{
 if(process.env.G6_KEEP&&!process.env.G6_KEEP.split(",").some(key=>name.startsWith(key+"-")))return;
 await rest();console.log("capture",name);const w=await state(),s=w.observatory;await p.screenshot({path:join(out,name+".jpg"),type:"jpeg",quality:86});
 const data=measure&&process.env.G6_PERF?await p.evaluate(()=>window.geoDeviceProbe(2500)):undefined;
 let animation;
 if(data&&s.mode==="regional"){
   const startPhase=s.progress;await p.evaluate(()=>document.querySelector("#g-play").click());
   animation=await p.evaluate(()=>window.geoDeviceProbe(2500));
   await p.evaluate(()=>{if(window.geoObservatory().observatory.playing)document.querySelector("#g-play").click();});
   await phase(startPhase);await rest();
 }
 rows.push({name,view:s.view,camera:s.camera??[w.lat,w.lon,w.d,w.tilt,w.bearing],region:s.site??w.mode,phase:s.progress??s.year,cut:s.cut,playing:s.playing,viewport:[viewport.width,viewport.height],resolution:w.resolution,draws:w.draws,triangles:w.triangles,geometries:w.geometries,textures:w.textures,loadMs,warm:s.timings,profile:s.graphics,rssMiB:rss(),data,animation});loadMs=0;
};
const zoom=async()=>{const box=await p.locator("#earth").boundingBox();await p.mouse.move(box.x+box.width*.63,box.y+box.height*.44);await p.mouse.wheel(0,-850);await p.waitForTimeout(400);};
const stage=process.env.G6_STAGE;const groupIs=k=>!stage&&(!group||group===k);
try{
 const start=performance.now();await p.goto(pathToFileURL(resolve(process.argv[2])).href);await rest();loadMs=performance.now()-start;
 if(process.env.G6_PROFILE){await p.click("#g6-quality-menu summary");await p.selectOption("#graphics-profile",process.env.G6_PROFILE);await rest();}
 if(stage==="Profile"){
   await visit("san");await shot("03-Parkfield",true);await visit("japan");await view("ocean");await phase(.63);await shot("14-Offenes-Meer",true);
   await visit("island",true);await view("vent");await phase(.82);await shot("19-Lava",true);
 }
 if(stage==="Referenzen"){
    await visit("japan");await coastCamera();await shot("10a-Kuestenrelief");
    await visit("island",true);await view("land");await shot("16-Reykjanes");await basaltCamera();await shot("17-Basalt");
    await visit("hawaii",true);await view("land");await phase(.81);await shot("21-Hawaii");
 }
 if(stage==="B"){for(const site of ["san","japan","island"]){await visit(site,site==="island");await view("cut");await phase(.49);await shot(site+"-Schnitt");}}
 if(stage==="C"){await visit("japan");await view("land");await phase(.55);await shot("Meer");await view("coast");await phase(.658);await shot("Ufer");}
 if(stage==="D"){await visit("island",true);await view("vent");await phase(.82);await shot("Lavastrom");await select("g-eruption","explosive");await phase(.76);await shot("Aschesaeule");}
 if(stage==="E"){for(const site of ["himalaya","rift","hawaii"]){await visit(site,site==="hawaii");await view("land");await shot(site+"-Landschaft");}}
 if(stage==="F"){await shot("Globus");await click("nav-inside");await shot("Schalen");}
 if(groupIs("world")){await shot("01-Globus",true);await click("nav-inside");await shot("02-Schalen");}
 if(groupIs("san")){await visit("san");await shot("03-Parkfield",true);await zoom();await shot("04-Boden");await view("overhead");await zoom();await shot("05-Bewuchs");await phase(.49);await shot("06-Transform");await view("cut");await shot("07-Schnitt");await view("overhead");if(!await p.isVisible("#g-stress"))await p.locator("#g-stress").locator("xpath=ancestor::details[1]/summary").click();await p.check("#g-stress");await phase(.30);await shot("08-Spannung");await view("waves");await phase(.53);await shot("09-Wellen",true);}
 if(groupIs("japan")){await visit("japan");await shot("10-Tohoku",true);await coastCamera();await shot("10a-Kuestenrelief");await view("water");await phase(.49);await shot("11-Meeresboden");await view("cut");await shot("12-Subduktion");await view("land");await zoom();await phase(.58);await shot("13-Wasser");await view("ocean");await phase(.63);await shot("14-Offenes-Meer",true);await view("coast");await phase(.658);await shot("15-Ueberflutung");}
 if(groupIs("island")){await visit("island",true);await view("land");await shot("16-Reykjanes",true);await basaltCamera();await shot("17-Basalt");await view("cut");await phase(.46);await shot("17a-Schmelze");await view("vent");await shot("18-Schlot");await phase(.82);await shot("19-Lava",true);await select("g-eruption","explosive");await phase(.76);await shot("20-Asche");}
 if(groupIs("other")){await visit("hawaii",true);await view("land");await phase(.81);await shot("21-Hawaii");await visit("himalaya");await view("cut");await phase(.74);await shot("22-Himalaya");await visit("rift");await view("cut");await phase(.74);await shot("23-Graben");await visit("japan",true);await view("vent");await phase(.78);await shot("23a-Zaozan");}
 if(groupIs("global")){await click("nav-plates");await click("g-time");await rest();await p.locator("#g-year").fill("-125");await shot("24-Zeitreise");await select("g-scenario","aurica");await p.locator("#g-year").fill("160");await p.check("#g-compare");await select("g-second","amasia");await shot("25-Zukunft");await click("nav-nyos");await p.waitForFunction(()=>window.geoObservatory().nyos.terrainVisible&&!window.geoObservatory().flying);await shot("26-Nyos");await click("saved-views");await select("saved-list","p3");await click("view-apply");await p.waitForSelector(".classroom-views",{state:"hidden"});await click("present");await shot("27-Smartboard");}
 if(!stage&&!group){
   // Saved classroom presets intentionally enter observation mode and lock the sidebar.
   await click("present");await click("obswitch");await rest();
   await visit("san");await shot("28-Warmstart",true);
 }
 assert.deepEqual(errors,[]);assert.deepEqual(network,[]);await writeFile(join(out,"Aufnahmen.json"),JSON.stringify(rows,null,2));console.log(out,rows.length);
}catch(e){console.error(await p.evaluate(()=>({body:document.body.innerText.slice(0,900),ready:window.geoObservatory?.()?.ready})).catch(()=>({})));throw e;}finally{await browser.close();await server.close();}
