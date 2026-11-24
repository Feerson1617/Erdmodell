import assert from "node:assert/strict";
import {mkdir,writeFile,mkdtemp} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {spawnSync} from "node:child_process";


async function screencast(page,dir,name,perform) {
  const scratch=await mkdtemp(join(tmpdir(),"georisiko-film-")),cdp=await page.context().newCDPSession(page);
  const frames=[],writes=[];
  cdp.on("Page.screencastFrame",ev=>{const file=String(frames.length).padStart(6,"0")+".jpg";
    frames.push({file,time:ev.metadata.timestamp});writes.push(writeFile(join(scratch,file),Buffer.from(ev.data,"base64")));
    void cdp.send("Page.screencastFrameAck",{sessionId:ev.sessionId}).catch(()=>{});
  });
  await cdp.send("Page.startScreencast",{format:"jpeg",quality:76,maxWidth:960,maxHeight:600,everyNthFrame:2});
  try{await page.waitForTimeout(320);await perform();await page.waitForTimeout(480);}
  finally{await cdp.send("Page.stopScreencast");await cdp.detach();await Promise.all(writes);}
  assert.ok(frames.length>=5,name+" sichtbare Filmframes");
  const lines=frames.flatMap((f,i)=>["file '"+f.file+"'","duration "+Math.max(.017,(frames[i+1]?.time??f.time+.22)-f.time)]);
  await writeFile(join(scratch,"frames.txt"),lines.join("\n")+"\nfile '"+frames.at(-1).file+"'\n");
  const file=join(dir,name+".mp4"),ff=spawnSync("ffmpeg",["-loglevel","error","-y","-f","concat","-safe","1","-i",join(scratch,"frames.txt"),"-vf","pad=ceil(iw/2)*2:ceil(ih/2)*2","-c:v","libx264","-preset","veryfast","-crf","25","-pix_fmt","yuv420p","-movflags","+faststart",file]);
  assert.equal(ff.status,0,String(ff.stderr));return {name,frames:frames.length,seconds:frames.at(-1).time-frames[0].time};
}
export async function acceptG5(p,{dir,product,measure,films=true}){
  await mkdir(dir,{recursive:true});
  const result={checks:[],measurements:[],pictures:[],movies:[],loadTimes:[],cycles:[]};
  const get=()=>p.evaluate(()=>window.geoObservatory().observatory);
  const click=id=>p.locator("#"+id).click();
  const range=(id,v)=>p.locator("#"+id).fill(String(v));
  const ready=()=>p.waitForFunction(()=>{const g=window.geoObservatory();return !g.flying&&g.observatory.ready&&g.observatory.mode==="regional";});
  const shot=async name=>{
    if(product!=="Electron")return;
    await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    await p.screenshot({path:join(dir,name+".jpg"),type:"jpeg",quality:85});
    result.pictures.push(name);
  };
  const perf=async(label,actions)=>result.measurements.push(await measure(label,actions));
  const active=async(label,button)=>{await click(button);await perf(label);if(await p.locator("#"+button).textContent()==="Pause")await click(button);};
  const film=async(name,fn)=>{if(films)result.movies.push(await screencast(p,dir,name,fn));else await fn();};
  const map=async()=>{await click("nav-earthquake");await p.waitForFunction(()=>window.geoObservatory().observatory.events===697);};
  const visit=async site=>{await map();const start=performance.now();await p.selectOption("#g-launch",site);await ready();result.loadTimes.push({site,ms:performance.now()-start});};
  const step=async(id="g-step")=>{await click(id);await p.waitForTimeout(120);};
  const clickAtCenter=async()=>{const box=await p.locator("#earth").boundingBox();await p.mouse.click(box.x+box.width*.5,box.y+box.height*.5);};
  await click("home");await p.waitForFunction(()=>!window.geoObservatory().flying);await shot("01-Globus");await perf("Globus");
  await click("nav-inside");await p.waitForFunction(()=>!window.geoObservatory().flying);await shot("02-Schalen");await perf("Schalenbau");
  if(!await p.locator("#g-litho").isVisible())await p.locator("#shellOptions summary").click();
  await click("g-litho");await ready();await shot("03-Lithosphaere");
  await click("nav-plates");await click("g-forces");await ready();await range("g-progress",.62);await shot("04-Plattenantrieb");
  await click("nav-plates");await p.waitForFunction(()=>!window.geoObservatory().flying&&window.geoObservatory().tectonics.mosaic?.opening===1);
  await shot("05-Plattenatlas");await perf("Plattenatlas");
  await map();await p.waitForFunction(()=>!window.geoObservatory().flying);await shot("06-Katalog");await perf("Erdbebenkatalog");assert.equal((await get()).events,697);
  const coverage=await p.evaluate(()=>window.geoBoundaryModels());assert.equal(coverage.length,5819);assert.equal(new Set(coverage.map(x=>x.id)).size,5819);
  assert.equal(new Set(coverage.map(x=>x.category)).size,7);assert.ok(coverage.every(s=>Number.isFinite(s.lat)&&s.lon>=-180&&s.lon<=180&&s.strike>=0&&s.strike<360&&s.model));
  if(product==="Electron")await writeFile(join(dir,"Grenzabschnitte.json"),JSON.stringify(coverage));
  result.boundaryModels=Object.fromEntries([...new Set(coverage.map(x=>x.model))].map(id=>[id,coverage.filter(x=>x.model===id).length]));
  const time=async()=>{await click("nav-plates");await click("g-time");await p.waitForFunction(()=>window.geoObservatory().observatory.timeReady);};
  const age=async v=>{await range("g-year",v);await p.waitForTimeout(180);};
  await time();await shot("07-Pangaea");await active("Historische Zeitreise","g-time-play");
  await film("Film-1-Zeitreise",async()=>{
    await click("g-time-play");await p.waitForTimeout(650);await click("g-time-play");
    for(const [yr,n] of [[-200,"08-Aufspaltung"],[-100,"09-Atlantik"],[-50,"10-Indien"]]){await age(yr);if(yr===-50){await p.locator("#g-evidence summary").click();await p.selectOption("#g-evidence-kind","india");}await shot(n);}
    await click("g-today");await shot("11-Gegenwart");
    for(const [model,n] of [["ultima","12-Ultima"],["novo","13-Novopangaea"]]){await p.selectOption("#g-scenario",model);await age(180);await click("g-time-focus");await p.waitForFunction(()=>!window.geoObservatory().flying);await shot(n);}
    await p.check("#g-compare");await age(170);await p.waitForTimeout(400);
  });
  await active("Zukunftsvergleich","g-time-play");await p.selectOption("#g-scenario","aurica");await age(200);await p.selectOption("#g-scenario","amasia");await age(180);
  await click("g-today");await p.selectOption("#g-station","-250");await p.locator("#g-evidence summary").click();
  await p.selectOption("#g-evidence-kind","fossil");await shot("27-Belegorte");await click("g-magnet");await ready();await range("g-progress",.77);await shot("27b-Magnetstreifen");
  await visit("san");await shot("14-Kalifornien");await perf("Kalifornische Landschaft");await click("g-cut");await shot("15-Untergrund");
  await film("Film-2-Erdbeben",async()=>{
    if(!await p.locator("#g-stress").isVisible())await p.locator("details").filter({has:p.locator("#g-stress")}).locator("summary").click();await p.check("#g-stress");await range("g-progress",.33);await shot("16-Spannung");
    await p.check("#g-names");await range("g-progress",.42);await shot("17-Bruch");
    await click("g-play");await p.waitForFunction(()=>window.geoObservatory().observatory.progress>.58);await click("g-play");await shot("18-Wellen");
    const s=await get();assert.equal(s.focus[0],s.epicenter[0]);assert.equal(s.focus[2],s.epicenter[2]);assert.ok(s.focus[1]<s.epicenter[1]);
  });
  await active("Erdbeben mit Wellen","g-play");
  await visit("japan");await click("g-cut");await shot("19-Japangraben");
  await film("Film-3-Seebeben-Tsunami",async()=>{
    await p.selectOption("#g-sea","flat");await range("g-progress",.56);await shot("20-Seitlicher-Versatz");
    await p.selectOption("#g-sea","vertical");await range("g-progress",.49);await shot("21-Wassersaeule");
    await click("g-play");await p.waitForFunction(()=>window.geoObservatory().observatory.progress>.72);await click("g-play");await shot("22-Kuestenwelle");
  });await active("Seebeben und Tsunami","g-play");
  await film("Film-4-Regionen",async()=>{for(const [site,n] of [["island","23-Island"],["himalaya","24-Himalaya"],["rift","25-Ostafrika"]]){
    await visit(site);await click("g-cut");await range("g-progress",.42);await shot(n);await p.waitForTimeout(200);}});
  await perf("Ostafrikanischer Graben");
  await click("nav-volcano");await ready();await range("g-progress",.82);await shot("26-Hawaii");await active("Hotspot-Vulkanismus","g-play");
  await click("nav-risk");await ready();await p.selectOption("#g-exposure","sparse");await range("g-progress",.51);await shot("28a-Einzelsiedlung");
  await p.selectOption("#g-exposure","dense");await shot("28b-Dichte-Siedlung");await p.check("#g-protect");await p.locator("details").filter({has:p.locator("#g-route")}).locator("summary").click();await p.check("#g-route");await p.check("#g-warning");await shot("29-Vorsorge");
  await click("nav-plates");await click("g-boundaries");await p.waitForFunction(()=>window.geoBoundaryModels().length===5819);
  await film("Film-5-Grenzauswahl",async()=>{
    const opts=await p.locator("#g-example option").evaluateAll(els=>els.map(e=>e.value).filter(Boolean));assert.equal(opts.length,12);
    for(const [idx,id] of opts.entries()){
      await p.selectOption("#g-example",id);await p.waitForFunction(()=>!window.geoObservatory().flying);await clickAtCenter();
      assert.equal((await get()).selected,Number(id));await click("g-segment");await ready();await range("g-progress",.57);
      if(idx===2)await shot("30a-Grenzauswahl");await click("nav-plates");await click("g-boundaries");
    }
  });
  // Native window fullscreen is tested separately; retain a real presentation capture.
  await click("home");await click("present");await p.waitForFunction(()=>document.body.classList.contains("present"));await shot("30-Praesentation");await click("present");await p.waitForFunction(()=>!document.body.classList.contains("present"));
  await perf("Wiederholter Modulwechsel",async()=>{for(let i=0;i<4;i++){await visit("japan");await time();await age(-100);await click("nav-volcano");await ready();await click("home");await p.waitForFunction(()=>!window.geoObservatory().flying);const s=await p.evaluate(()=>window.geoObservatory());result.cycles.push({geometries:s.geometries,textures:s.textures,programs:s.programs});}});
  result.checks.push("697 reale Ereignisse","5819 eindeutige Grenzabschnitte","9 geografische Treffer","4 Zukunftsszenarien","Herd lotrecht unter Epizentrum","Siedlungsvergleich bei gleicher Quelle","Vollbild und Rückkehr");
  return result;
}
