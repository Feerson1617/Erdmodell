import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {resolve,join} from "node:path";
import {pathToFileURL} from "node:url";
import {chromium,webkit} from "playwright";
import {Vector3} from "three";
import {PNG} from "pngjs";

const out=resolve("test-results/plattenatlas"), html=resolve("artifacts/GeoRisiko-Erdmodell-G4.3.html");
const fallback=resolve("sicherung/Erdmodell.html");
const hash=async file=>createHash("sha256").update(await readFile(file)).digest("hex");
const surfaces=JSON.parse(await readFile("src/tectonics/mosaic.json","utf8"));
const codes=Object.keys(surfaces), report={htmlSHA256:await hash(html),fallbackSHA256:await hash(fallback),runs:[]};
assert.equal(report.fallbackSHA256,"7d89cb8cdc4611f6c2fc3971b7293784402a3d1497114cf2c791fa700390f3bd");
assert.equal(codes.length,52);
await mkdir(out,{recursive:true});
const read=p=>p.evaluate(()=>window.geoObservatory());
const ready=p=>p.waitForFunction(()=>window.geoObservatory?.().frames>2);
const rest=p=>p.waitForFunction(()=>!window.geoObservatory().flying);
const frame=p=>p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const camera=s=>[s.lat,s.lon,s.d,s.tilt,s.bearing];
const centre=async p=>{const r=await p.locator("#earth").boundingBox();return [r.x+r.width/2,r.y+r.height/2];};
const image=async p=>PNG.sync.read(await p.locator("#earth").screenshot());
function pixelChanges(a,b) {
  assert.equal(a.width,b.width);let changed=0;
  for(let i=0;i<a.data.length;i+=4){
    if(Math.max(...[0,1,2].map(k=>Math.abs(a.data[i+k]-b.data[i+k])))>4)changed++;
  }
  return changed;
}
for(const engine of [chromium,webkit]){
  if(process.env.TEST_ENGINES && !process.env.TEST_ENGINES.split(",").includes(engine.name()))continue;
  const browser=await engine.launch({executablePath:engine===webkit?process.env.WEBKIT_PATH:undefined,
    args:engine===chromium?["--use-angle=swiftshader","--enable-unsafe-swiftshader"]:[]});
  const run={engine:engine.name(),version:browser.version(),files:[],requests:[],errors:[],shells:{},plates:{},sites:[],viewports:[],images:[]};
  const context=await browser.newContext({viewport:{width:1120,height:730},hasTouch:true,reducedMotion:"reduce"});
  const p=await context.newPage();
  p.on("request",r=>{const protocol=new URL(r.url()).protocol;if(protocol==="file:")run.files.push(r.url().split("/").pop());else if(!["blob:","data:"].includes(protocol))run.requests.push(r.url());});
  p.on("pageerror",e=>run.errors.push(e.message));
  p.on("console",m=>{if(m.type()==="error")run.errors.push(m.text().slice(0,250));});
  await context.route(/^https?:/,r=>r.abort());
  const shot=async name=>{
    if(engine!==chromium)return;
    const path=join(out,name+".jpg");await p.screenshot({path,quality:84,type:"jpeg"});
    run.images.push({name,sha256:await hash(path)});
  };
  try{
    await p.goto(pathToFileURL(fallback).href);await ready(p);await p.click("#nav-inside");
    await p.click("#labels");await p.waitForSelector("#pins button");assert.equal(await p.locator("#pins button").count(),4);
    run.fallback = {files:run.files.splice(0), errors:run.errors.splice(0), requests:run.requests.splice(0)};
    assert.ok(run.fallback.files.includes("Erdmodell.html"));
    assert.ok(run.fallback.files.every(f=>f==="Erdmodell.html" || f==="sky.png"));
    assert.deepEqual(run.fallback.requests,[]);
    await p.goto(pathToFileURL(html).href);await ready(p);
    const home=await read(p), [cx,cy]=await centre(p);await p.mouse.move(cx,cy);await p.mouse.down();
    await p.mouse.move(cx+66,cy+15,{steps:6});await p.mouse.up();
    await p.waitForFunction(lon=>Math.abs(window.geoObservatory().lon-lon)>.25,home.lon);
    await p.click("#home");await rest(p);await shot("01-globus");
    await p.click("#nav-inside");await rest(p);assert.equal(await p.locator("#pins button").count(),0);
    await p.click("#labels");
    for(let i=0;i<4;i++){
      const pin=p.locator('[data-object="shell-'+i+'"]');await pin.tap();
      assert.equal((await read(p)).shell.selected,i);
      const title=await p.locator("#definition strong").innerText();
      const answers=[];
      for(const b of await p.locator(".shellQuestions button").all()){
        await b.tap();answers.push(await p.locator("#shellAnswer:visible").innerText());
      }
      assert.equal(new Set(answers).size,2);assert.ok(answers.every(t=>t.length>35 && t.length<240));
      run.shells[title]=answers;if(i===1)await shot("02-mantel");
      await p.tap("#definition > button");assert.ok(await p.locator("#definition").isHidden());
    }
    await p.click("#labels");assert.equal(await p.locator(".shellQuestions,#pins button").count(),0);
    await p.click("#nav-globe");await rest(p);
    await p.emulateMedia({reducedMotion:"no-preference"});
    await p.click("#nav-plates");await p.waitForFunction(()=>{const o=window.geoObservatory().tectonics.mosaic?.opening;return o>0 && o<1;});
    await p.waitForFunction(()=>window.geoObservatory().tectonics.mosaic?.opening===1);
    await shot("03-plattenmosaik");await p.emulateMedia({reducedMotion:"reduce"});
    await p.tap("#plateSettings summary");
    await p.waitForFunction(()=>document.querySelector("#plateSelect")?.options.length===53);
    const options=await p.locator("#plateSelect option").evaluateAll(os=>Object.fromEntries(os.filter(o=>o.value).map(o=>[o.value,o.textContent])));
    assert.deepEqual(Object.keys(options).sort(),codes);
    for(const code of codes){
      // Set up each geographic view using the same controls as the teacher.
      // Identification itself always uses a physical pointer event on the canvas.
      await p.selectOption("#plateSelect",code);
      await p.locator("#atlasLocate").evaluate(b=>b.click());await rest(p);
      await p.locator("#atlasAll").evaluate(b=>b.click());await frame(p);
      const [x,y]=await centre(p);
      if(engine===webkit)await p.touchscreen.tap(x,y);else await p.mouse.click(x,y);
      const state=await read(p);
      assert.equal(state.tectonics.plate,code,engine.name()+": Flächentreffer "+code);
      const title=await p.locator("#plateProfile h2").innerText();assert.equal(title,options[code]);
      const info=await p.locator("#plateProfile dd").allTextContents();
      assert.equal(info.length,3);assert.ok(info.every(t=>t.length>20 && !/undefined|NaN/.test(t)));
      assert.equal((await p.locator('#platePins [data-object="'+code+'"]').innerText()).trim(),title);
      run.plates[code]={name:title,info};
      if(code==="GP")await shot("04-galapagos");
      await p.locator("#atlasAll").evaluate(b=>b.click());
    }
    await p.selectOption("#plateSelect","NA");await p.click("#atlasLocate");await rest(p);
    await p.click("#plateSettings summary");await frame(p);await shot("05-auswahl");
    const before=(await read(p)).tectonics.mosaic, fixed=camera(await read(p));
    await p.click("#atlasSlow");await p.click("#atlasPlay");
    await p.waitForFunction(()=>window.geoObservatory().tectonics.mosaic.progress>.025);await p.click("#atlasPlay");
    const paused=(await read(p)).tectonics.mosaic;await frame(p);
    assert.deepEqual((await read(p)).tectonics.mosaic.anchors,paused.anchors);
    await p.click("#atlasSlow");await p.click("#atlasPlay");
    await p.waitForFunction(()=>window.geoObservatory().tectonics.mosaic.progress===1,null,{timeout:90000});
    const end=(await read(p)).tectonics.mosaic, moved=await image(p);
    assert.deepEqual(camera(await read(p)),fixed);
    run.displacementKm={};
    for(const code of codes){
      const a=new Vector3(...before.anchors[code]), b=new Vector3(...end.anchors[code]);
      const [lat,lon,rate]=surfaces[code].pole.map(v=>v*Math.PI/180);
      assert.ok(Math.abs(end.rotations[code]-2*rate)<1e-9,code+" Körperrotation");
      const axis=new Vector3(Math.cos(lat)*Math.sin(lon),Math.sin(lat),Math.cos(lat)*Math.cos(lon));
      const delta=b.clone().sub(a);run.displacementKm[code]=Number(delta.length().toFixed(4));
      if(code==="PA"){assert.ok(delta.length()<.001);continue;}
      assert.ok(delta.length()>.005,code+" unbewegt");
      assert.ok(Math.abs(delta.dot(axis))<.003,code+" Rotationsachse");
      const u=a.clone().addScaledVector(axis,-a.dot(axis)),v=b.clone().addScaledVector(axis,-b.dot(axis));
      const angle=Math.atan2(axis.dot(u.clone().cross(v)),u.dot(v));
      assert.ok(angle>0 && angle<=2*rate+1e-5,code+" Drehsinn oder Winkel");
    }
    await p.click("#atlasReset");await frame(p);const reset=(await read(p)).tectonics.mosaic;
    assert.deepEqual(reset.anchors,before.anchors);assert.equal(reset.progress,0);
    run.changedPixels=pixelChanges(moved,await image(p));assert.ok(run.changedPixels>250);
    await p.click("#atlasPlay");await p.waitForFunction(()=>window.geoObservatory().tectonics.mosaic.progress>0);await p.click("#atlasReset");
    await p.click("#atlasWorld");await rest(p);assert.ok((await read(p)).d>10000);
    for(const site of ["island","japan","san"]){
      await p.selectOption("#tectonicSite",site);await p.waitForFunction(()=>window.geoObservatory().tectonics.processVisible && !window.geoObservatory().flying);
      await p.click("#playProcess");await p.waitForFunction(()=>window.geoObservatory().tectonics.progress>.01);
      await p.click("#resetProcess");run.sites.push(site);await p.click("#plateOverview");await rest(p);
    }
    for(const [width,height] of [[1920,1080],[768,1024],[1024,768]]){
      await p.setViewportSize({width,height});await p.click("#home");await rest(p);await p.click("#nav-plates");await frame(p);
      await p.touchscreen.tap(...await centre(p));await p.waitForSelector("#plateProfile");
      assert.ok(await p.locator("#atlasAll").isEnabled());
      assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      const box=await p.locator("#earth").boundingBox();assert.ok(box.width>=400 && box.height>=300);
      run.viewports.push({width,height,model:box});
      if(width===1920){await p.click("#present");await shot("06-smartboard");await p.click("#present");}
      if(width===768)await shot("07-tablet");
    }
    run.resources=[];
    for(let i=0;i<4;i++){
      await p.click("#nav-globe");await p.click("#nav-inside");await rest(p);await p.click("#nav-plates");await rest(p);await frame(p);
      const s=await read(p);run.resources.push({geometries:s.geometries,textures:s.textures,programs:s.programs,draws:s.draws,triangles:s.triangles,frameMs:s.frameMs});
    }
    for(const key of ["geometries","textures","programs"])assert.equal(run.resources[1][key],run.resources.at(-1)[key],key);
    assert.deepEqual(run.requests,[]);assert.deepEqual(run.errors,[]);
    assert.deepEqual(run.files,["GeoRisiko-Erdmodell-G4.3.html"]);
    report.runs.push(run);console.log(run.engine,"52 Flächen, acht Antworten, Offline-Betrieb geprüft");
    if(engine===chromium){
      const film=await browser.newContext({viewport:{width:1024,height:680},recordVideo:{dir:out,size:{width:960,height:638}}});
      const tab=await film.newPage();await tab.goto(pathToFileURL(html).href);await ready(tab);
      await tab.click("#nav-plates");await tab.waitForFunction(()=>window.geoObservatory().tectonics.mosaic?.opening===1);
      await tab.mouse.click(...await centre(tab));await tab.waitForSelector("#plateProfile");await tab.click("#atlasLocate");await rest(tab);
      await tab.click("#atlasPlay");await tab.waitForFunction(()=>window.geoObservatory().tectonics.mosaic.progress>.72);
      await tab.click("#atlasPlay");await tab.waitForTimeout(400);await tab.close();await film.close();
      const video=tab.video();const path=join(out,"bedienung.webm");await video.saveAs(path);await video.delete();
      run.videoSHA256=await hash(path);
    }
  } catch(error) {await p.screenshot({path:join(out,"fehler-"+engine.name()+".jpg")});throw error;}
  finally{await context.close();await browser.close();}
}
await writeFile(join(out,"pruefung.json"),JSON.stringify(report,null,2)+"\n");
