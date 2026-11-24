import {classroom} from "./g52-classroom.mjs";
// Exercises the executable copied off the ejected DMG and the single-file export on the same Mac.
import {acceptG51,longClassroom} from "./g51-abnahme.mjs";
import {acceptG5} from "./g5-abnahme.mjs";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { _electron, chromium } from "playwright";
import { PNG } from "pngjs";

const out=resolve("test-results/mac"), film=join(out,"film");
await mkdir(film,{recursive:true});
const executablePath=(await readFile(join(out,"executable-path.txt"),"utf8")).trim();
const html=pathToFileURL(resolve("artifacts/GeoRisiko-G6-Web-Test.html")).href;
const cases=JSON.parse(await readFile("src/tectonics/examples.json","utf8"));
const report={commit:process.env.TEST_COMMIT, run:process.env.GITHUB_RUN_ID, platform:process.platform, arch:process.arch, runs:[]};
const runCmd=(name,args)=>{const r=spawnSync(name,args,{encoding:"utf8"});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
report.hardware={cpu:runCmd("sysctl",["-n","machdep.cpu.brand_string"]),cores:runCmd("sysctl",["-n","hw.logicalcpu"]),
  memoryBytes:runCmd("sysctl",["-n","hw.memsize"]),macOS:runCmd("sw_vers",["-productVersion"])};
const rest=p=>p.waitForFunction(()=>window.geoObservatory?.().ready && !window.geoObservatory().flying);
const read=p=>p.evaluate(()=>window.geoObservatory());
function processes(root) {
  const all=runCmd("ps",["-axo","pid=,ppid=,time=,rss="]).split("\n").map(line=>line.trim().split(/\s+/));
  const family=new Set([String(root)]);
  for(let previous=0;previous!==family.size;){previous=family.size;for(const [id,parent] of all)if(family.has(parent))family.add(id);}
  const rows=all.filter(([id])=>family.has(id));
  const ticks=new Map(rows.map(([id,,time])=>[id,time.split(":").reduce((seconds,part)=>seconds*60+Number(part),0)]));
  return {ticks,rssMiB:rows.reduce((sum,row)=>sum+Number(row[3]),0)/1024};
}
async function capture(p,name) {
  const file=join(out,name+".png");
  const bytes=await p.screenshot({path:file});
  const image=PNG.sync.read(bytes);
  // Sample the central model, independently of renderer counters.
  const colors=new Set();
  for(let y=Math.floor(image.height*.3);y<image.height*.72;y+=7)for(let x=Math.floor(image.width*.44);x<image.width*.71;x+=7){
    const i=(y*image.width+x)*4;colors.add((image.data[i]>>3)*1024+(image.data[i+1]>>3)*32+(image.data[i+2]>>3));
  }
  assert.ok(colors.size>12,name+" gerenderte Farbwerte "+colors.size);
}
async function measure(p,root,name,actions,milliseconds=3000) {
  const before=processes(root), from=performance.now();
  await p.evaluate(done=>{window.geoTestCycleDone=done;},!actions);
  const sample=p.evaluate(ms=>window.geoDeviceProbe(ms,()=>window.geoTestCycleDone),milliseconds);
  if(actions) {
    try {await actions();} finally {await p.evaluate(()=>{window.geoTestCycleDone=true;});}
  }
  const data=await sample,after=processes(root),elapsed=(performance.now()-from)/1000;
  const seconds=[...after.ticks].reduce((n,[pid,time])=>n+Math.max(0,time-(before.ticks.get(pid)??0)),0);
  assert.ok(data.frames>1,name+" Bildfolge");
  const empty=data.states.filter(s=>!(s.draws>0 && s.geometries>0));
  assert.deepEqual(empty,[],name+" ohne gerenderte Geometrie");
  return {scene:name,...data,cpuPercent:seconds/elapsed*100,rssBeforeMiB:before.rssMiB,rssAfterMiB:after.rssMiB};
}
async function selectPlate(p,code) {
  if (!await p.locator("#plateSelect").isVisible()) await p.click("#plateSettings summary");
  await p.selectOption("#plateSelect",code);
  assert.equal((await read(p)).tectonics.plate,code);
}
async function compare(p,code) {
  await selectPlate(p,code);
  await p.click("#atlasCompare");await rest(p);
  const before=(await read(p)).tectonics.mosaic.pair;
  assert.equal(before.step,cases[code].step);
  await p.click("#atlasPlay");
  await p.waitForFunction(()=>window.geoObservatory().tectonics.mosaic.progress>.025);
}
async function scenarios(p,name,pid,row) {
  const record=async(scene)=>{console.log(name,scene);await rest(p);row.scenes.push(await measure(p,pid,scene));await capture(p,name+"-"+scene);};
  await p.click("#home");await record("01-Globus");
  const pose=await read(p);await p.locator("#earth").focus();await p.keyboard.press("ArrowRight");
  await p.waitForFunction(lon=>Math.abs(window.geoObservatory().lon-lon)>.01,pose.lon);
  await p.click("#home");await p.click("#nav-inside");await rest(p);
  assert.equal(await p.locator("#pins button").count(),0);await record("02-Schalenschnitt");
  await p.click('[data-layer="1"]');await p.click("#revealOne");
  await p.waitForFunction(()=>document.querySelectorAll("#pins button").length===1);
  await p.click("#hideOne");await p.click("#labels");
  await p.waitForFunction(()=>document.querySelectorAll("#pins button").length===4);
  await record("03-Vier-Schalen");
  for(let i=0;i<4;i++){
    await p.click('[data-object="shell-'+i+'"]');
    for(const q of await p.locator(".shellQuestions button").all()){
      await q.click();assert.ok((await p.locator("#shellAnswer").innerText()).length>25);
    }
    await p.click("#definition > button");
  }
  await p.click('[data-layer="2"]');await p.locator("#opacity").fill("40");assert.equal((await read(p)).shell.opacity[2],.4);
  await p.click("#restoreLayers");await p.click("#evidence");assert.match(await p.locator("#content").innerText(),/vieler Erdbeben/);
  await p.click("#closeDialog");
  await p.check("#scale");assert.ok((await read(p)).shell.expanded);
  await p.click("#lithosphere");assert.ok((await read(p)).shell.lithosphere);
  await p.click("#home");await p.click("#nav-plates");
  await p.waitForFunction(()=>window.geoObservatory().tectonics.mosaic?.opening===1);
  await record("04-Plattenatlas");await selectPlate(p,"NA");await p.click("#atlasLocate");await record("05-Nordamerika");
  await p.click("#atlasCompare");await rest(p);await p.click("#atlasPlay");await p.waitForFunction(()=>window.geoObservatory().tectonics.mosaic.progress>0);
  await record("06-Grenzvergleich");await p.click("#atlasReset");assert.equal((await read(p)).tectonics.mosaic.progress,0);
  await p.click("#atlasWorld");
  for(const [i,site] of ["island","japan","san"].entries()){
    await p.selectOption("#tectonicSite",site);
    await p.waitForFunction(site=>{const w=window.geoObservatory();return !w.flying && w.tectonics.site===site && w.tectonics.processVisible;},site);
    await p.click("#playProcess");await p.waitForFunction(()=>window.geoObservatory().tectonics.progress>.015);
    await record(["07-Island","08-Japan","09-Kalifornien"][i]);await p.click("#resetProcess");
    assert.equal((await read(p)).tectonics.progress,0);
  }
  await p.click("#nav-nyos");await p.waitForFunction(()=>window.geoObservatory().nyos.terrainVisible && !window.geoObservatory().flying);
  await record("10-Nyos");await p.click("#nyos-section");await p.check("#nyos-dissolved");
  await p.click("#nyos-event");await p.click("#nyos-play");await p.waitForFunction(()=>window.geoObservatory().nyos.progress>0);
  await p.click("#nyos-reset");await p.click("#nyos-protection");await p.selectOption("#nyos-measure","pipe");
  await p.waitForFunction(()=>window.geoObservatory().nyos.pipeVisible);
  // Repeat the full module cycle, retaining snapshots after each scene has settled.
  row.cycles=[];
  for(let cycle=0;cycle<5;cycle++) {
    const measurement=await measure(p,pid,"11-Modulwechsel",async()=>{
      for(const nav of ["home","nav-inside","nav-plates","nav-nyos","home"]){await p.click("#"+nav);await rest(p);}
    });row.cycles.push(measurement);
  }
  row.scenes.push(row.cycles.at(-1));
}
async function allPairs(p) {
  await p.click("#nav-plates");await p.waitForFunction(()=>window.geoObservatory().tectonics.mosaic?.opening===1);
  const checked=[];
  for(const code of Object.keys(cases)){
    await selectPlate(p,code);await p.click("#atlasLocate");await rest(p);
    await p.locator("#atlasAll").evaluate(b=>b.click());
    const box=await p.locator("#earth").boundingBox();await p.mouse.click(box.x+box.width/2,box.y+box.height/2);
    assert.equal((await read(p)).tectonics.plate,code);
    await p.click("#atlasCompare");await rest(p);
    assert.equal((await read(p)).tectonics.mosaic.pair.step,cases[code].step);
    await p.click("#atlasPlay");await p.waitForFunction(()=>window.geoObservatory().tectonics.mosaic.progress>.02);
    await p.click("#atlasReset");assert.equal((await read(p)).tectonics.mosaic.progress,0);
    await p.click("#atlasWorld");await rest(p);
    const s=await read(p);
    if (checked.length%10===0) console.log("Plattenvergleich",checked.length+1,code);
    assert.ok(s.lon>=-180 && s.lon<180,"Geografischer Längengrad nach dem Atlasumlauf");
    checked.push({code,step:cases[code].step,geometries:s.geometries,textures:s.textures,programs:s.programs});
  }
  return checked;
}
async function recordFilm(p,context) {
  const cdp=await context.newCDPSession(p),frames=[],writes=[];
  cdp.on("Page.screencastFrame",event=>{
    const name=String(frames.length).padStart(6,"0")+".jpg";
    frames.push({name,time:event.metadata.timestamp});
    writes.push(writeFile(join(film,name),Buffer.from(event.data,"base64")));
    void cdp.send("Page.screencastFrameAck",{sessionId:event.sessionId}).catch(()=>{});
  });
  await p.click("#home");await rest(p);await p.emulateMedia({reducedMotion:"no-preference"});
  await cdp.send("Page.startScreencast",{format:"jpeg",quality:82,maxWidth:1152,maxHeight:648,everyNthFrame:2});
  await p.waitForTimeout(600);await p.click("#nav-inside");await p.click("#labels");await p.waitForTimeout(800);
  await p.click("#nav-plates");await p.waitForFunction(()=>window.geoObservatory().tectonics.mosaic?.opening===1);
  await compare(p,"NA");await p.waitForFunction(()=>window.geoObservatory().tectonics.mosaic.progress>.57);
  await p.click("#atlasPlay");await p.waitForTimeout(500);await cdp.send("Page.stopScreencast");await cdp.detach();await Promise.all(writes);
  assert.ok(frames.length>=8,"Bedienfilm");
  const lines=frames.flatMap((frame,i)=>["file '"+frame.name+"'","duration "+Math.min(8,Math.max(.016,(frames[i+1]?.time??frame.time+.3)-frame.time))]);
  await writeFile(join(film,"frames.txt"),lines.join("\n")+"\nfile '"+frames.at(-1).name+"'\n");
  runCmd("ffmpeg",["-loglevel","error","-y","-f","concat","-safe","1","-i",join(film,"frames.txt"),"-vf","pad=ceil(iw/2)*2:ceil(ih/2)*2","-c:v","libx264","-pix_fmt","yuv420p","-movflags","+faststart",join(out,"Bedienfilm.mp4")]);
}
async function exercise(p,context,name,pid) {
  p.setDefaultTimeout(60000);
  const errors=[],network=[],assets=new Set();
  p.on("pageerror",e=>errors.push(e.message));
  p.on("console",m=>{if(m.type()==="error")errors.push(m.text());});
  p.on("request",r=>{const u=new URL(r.url());if(u.protocol==="georisiko:")assets.add(u.pathname);if(/^https?:$/.test(u.protocol))network.push(r.url());});
  p.on("response",r=>{if(r.status()>=400)errors.push(r.url()+": "+r.status());});
  await context.route(/^https?:/,route=>route.abort());
  const launchStart=performance.now();if(name==="Electron")await p.reload();else await p.goto(html);
  await rest(p);await p.emulateMedia({reducedMotion:"reduce"});
  const row={name,initialPageReadyMs:performance.now()-launchStart,viewport:await p.evaluate(()=>[innerWidth,innerHeight,devicePixelRatio]),
    gpu:await p.evaluate(()=>{const gl=document.querySelector("#earth").getContext("webgl2"),ext=gl.getExtension("WEBGL_debug_renderer_info");return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);}),
    scenes:[],errors,network};
  report.runs.push(row);
  console.log("Szenenprüfung",name,row.viewport,row.gpu);
  await scenarios(p,name,pid,row);
  if(name==="Electron"){
    row.pairs=await allPairs(p);
    row.places=[];
    await p.click("#nav-place");
    for(const place of ["hooge","helgoland"]) {
      await p.selectOption("#siteSelect",place);
      await p.waitForFunction(id=>{const w=window.geoObservatory();return w.region===id && w.localVisible && w.localReady && !w.flying;},place);
      row.places.push(place);await capture(p,name+"-"+place);
    }
    await recordFilm(p,context);
    assert.ok(assets.has("/data/nyos/landscape.json") && assets.has("/data/relief.i16"));
  }
  row.g5=await acceptG5(p,{dir:join(out,"G5"),product:name,films:name==="Electron",measure:(label,actions)=>measure(p,pid,label,actions)});
  row.g52=await classroom(p,join(out,"G52"),name==="Electron");
  if(name==="Electron"){
    row.g51=await acceptG51(p,join(out,"G51"));
    row.classroom=await longClassroom(p,(label,ms)=>measure(p,pid,label,undefined,ms),()=>processes(pid).rssMiB);
  }
  row.requestedAssets=[...assets].sort();
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);return row;
}
const launchInstalled=()=>_electron.launch({executablePath,args:["--force-device-scale-factor=1","--user-data-dir="+join(out,"testprofil")],timeout:90000});
const savedState=async p=>p.evaluate(()=>{const s=window.geoObservatory().observatory;return {view:s.view,cut:s.cut,settings:s.settings,camera:s.camera,site:s.site,playing:s.playing,progress:s.progress,observing:document.body.classList.contains("observing")};});
const openView=async(p,key)=>{await p.click("#saved-views");await p.selectOption("#saved-list",key);await p.click("#view-apply");await p.waitForSelector(".classroom-views",{state:"hidden"});await p.waitForFunction(()=>window.geoObservatory().observatory.ready&&window.geoObservatory().observatory.viewSettled);};
let viewport,favorite;
try {
  const app=await launchInstalled();
  const stderr=[];
  app.process().stderr?.on("data",chunk=>stderr.push(String(chunk)));
  try{
    const p=await app.firstWindow(),ctx=app.context();
    await rest(p);
    const prefs=await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setContentSize(1920,1080);
      const v=w.webContents.getLastWebPreferences();return {sandbox:v.sandbox,contextIsolation:v.contextIsolation,nodeIntegration:v.nodeIntegration,webSecurity:v.webSecurity};});
    assert.deepEqual(prefs,{sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true});
    // devTools is a BrowserWindow option, not a Blink preference returned on macOS.
    const toolsOpened=await app.evaluate(async({BrowserWindow})=>{
      const contents=BrowserWindow.getAllWindows()[0].webContents;
      contents.openDevTools({mode:"detach",activate:false});
      await new Promise(done=>setTimeout(done,350));
      return contents.isDevToolsOpened();
    });
    assert.equal(toolsOpened,false,"Entwicklerwerkzeuge im Präsentationsfenster");
    report.devToolsOpened=toolsOpened;
    assert.equal(await p.evaluate(()=>typeof require+" "+typeof process),"undefined undefined");
    assert.equal(p.url(),"georisiko://modell/");
    const originPolicy=await p.evaluate(async()=>{
      const response=await fetch("/index.html");
      let denied=false;
      try {await fetch("https://example.invalid/georisiko-offline-test");} catch {denied=true;}
      window.open("about:blank","_blank");
      return {denied,csp:response.headers.get("Content-Security-Policy"),missing:(await fetch("/unbekannt.txt")).status};
    });
    assert.ok(originPolicy.denied && originPolicy.csp.includes("connect-src 'self'") && originPolicy.missing===404);
    assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().length),1);
    report.originPolicy=originPolicy;
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1024,700));
    await p.waitForFunction(()=>innerWidth<=1024 && window.geoObservatory().resolution.width>0);
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1920,1080));
    for(let i=0;i<2;i++){
      await p.click("#present");await p.waitForFunction(()=>document.body.classList.contains("present"));
      assert.ok(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isFullScreen()));
      await p.click("#present");await p.waitForFunction(()=>!document.body.classList.contains("present"));
    }
    report.windowContent=await p.evaluate(()=>({width:innerWidth,height:innerHeight}));
    report.display=await app.evaluate(({screen})=>screen.getAllDisplays().map(d=>({size:d.size,scaleFactor:d.scaleFactor})));
    viewport={width:1920,height:1080};
    report.viewportOverride=report.windowContent.width!==viewport.width || report.windowContent.height!==viewport.height;
    if(report.viewportOverride) {
      const viewportSession=await ctx.newCDPSession(p);
      await viewportSession.send("Emulation.setDeviceMetricsOverride",{...viewport,deviceScaleFactor:1,mobile:false});
    }
    await p.waitForFunction(()=>innerWidth===1920 && innerHeight===1080);
    report.security=prefs;report.electron=await app.evaluate(({app})=>({version:process.versions.electron,chrome:process.versions.chrome,
      packaged:app.isPackaged,gpu:app.getGPUFeatureStatus()}));
    assert.ok(report.electron.packaged);
    await exercise(p,ctx,"Electron",app.process().pid);
    await p.close();const opened=app.waitForEvent("window");await app.evaluate(({app})=>app.emit("activate"));const reopened=await opened;await rest(reopened);
    await openView(reopened,"p3");await reopened.selectOption("#observe-view","overhead");await reopened.selectOption("#observe-stage",".30");
    await reopened.waitForFunction(()=>window.geoObservatory().observatory.viewSettled);
    await reopened.click("#saved-views");await reopened.fill("#view-name","Neustartprüfung");await reopened.click("#view-save");
    favorite=await reopened.locator("#saved-list").inputValue();assert.match(favorite,/^s/);await reopened.click("#view-close");
    report.restart={firstPID:app.process().pid,before:await savedState(reopened)};
    report.windowReopened=true;
  }finally{
    await app.close();
    await writeFile(join(out,"Electron-stderr.log"),stderr.join(""));
    assert.ok(!stderr.some(line=>/FATAL:|GPU process isn't usable|Renderer process crashed/i.test(line)),"Electron-Prozessfehler");
  }
  const second=await launchInstalled();
  try{report.restart.secondPID=second.process().pid;assert.notEqual(report.restart.firstPID,report.restart.secondPID);
    const p=await second.firstWindow();await rest(p);await openView(p,favorite);report.restart.after=await savedState(p);
    assert.deepEqual(report.restart.after,report.restart.before);report.restart.verified=true;
    await p.click("#saved-views");await p.selectOption("#saved-list",favorite);await p.click("#view-remove");await p.click("#view-close");
  }finally{await second.close();}
  const browserServer=await chromium.launchServer({headless:false,channel:"chrome",args:["--force-device-scale-factor=1","--disable-background-networking"]});
  try{
    const browser=await chromium.connect(browserServer.wsEndpoint());
    const ctx=await browser.newContext({viewport,deviceScaleFactor:1});report.chrome=browser.version();
    await exercise(await ctx.newPage(),ctx,"HTML",browserServer.process().pid);
    await browser.close();
  }finally{await browserServer.close();}
}catch(error){report.failure=String(error.stack);throw error;}
finally{await writeFile(join(out,"Pruefung.json"),JSON.stringify(report,null,2));}
