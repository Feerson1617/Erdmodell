import assert from "node:assert/strict";
import {mkdir,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {fullHDPhoto} from "./native-picture.mjs";
import {screencast} from "./g5-abnahme.mjs";

export async function classroom(p,dir,record=false){
  await mkdir(dir,{recursive:true});
  const display=await p.context().newCDPSession(p);
  const log={steps:[],pictures:[],movies:[],coast:[],favorites:[],coverage:{}};
  if(record)await display.send("Emulation.setDeviceMetricsOverride",{width:1920,height:1080,screenWidth:1920,screenHeight:1080,deviceScaleFactor:1,mobile:false});
  let actions=[];
  const click=async id=>{actions.push(id);await p.locator("#"+id).click();};
  const choose=async(id,value)=>{actions.push(id+"="+value);await p.selectOption("#"+id,value);};
  const fill=async(id,value)=>{actions.push(id+"="+value);await p.locator("#"+id).fill(String(value));};
  const state=()=>p.evaluate(()=>window.geoObservatory().observatory);
  const paint=()=>p.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
  const rest=async()=>{await p.waitForFunction(()=>{const w=window.geoObservatory(),s=w.observatory;return !w.flying&&(s.mode!=="regional"||s.ready&&s.viewSettled)&&(s.mode!=="time"||s.timeReady);});await paint();};
  const shot=async label=>{await rest();if(record){await fullHDPhoto(p,display,dir,label);log.pictures.push(label);}};
  const film=async(name,run)=>{if(record)log.movies.push(await screencast(p,dir,name,run));else await run();};
  const step=async(label,run)=>{actions=[];const start=performance.now();await run();await rest();const s=await state();
    log.steps.push({label,actions:[...actions],ms:Math.round(performance.now()-start),mode:s.mode,view:s.view,camera:s.camera,progress:s.progress,playing:s.playing,observing:await p.locator("body").evaluate(e=>e.classList.contains("observing")),visibleAnswers:await p.locator("#sidebar details[open] p:visible").count()});};
  const at=async value=>{await rest();const s=await state();assert.equal(s.progress,value);assert.equal(s.playing,false);return s;};
  const recall=async key=>{await click("saved-views");await choose("saved-list",key);await click("view-apply");await p.waitForSelector(".classroom-views",{state:"hidden"});await rest();};
  async function save(label){await click("saved-views");await fill("view-name",label);await click("view-save");const key=await p.locator("#saved-list").inputValue();assert.match(key,/^s/);await click("view-close");return key;}
  try{
    await click("home");await rest();
    if(await p.locator("body").evaluate(e=>e.classList.contains("observing")))await click("obswitch");
    await film("Unterricht-Erde-Parkfield-Japan",async()=>{
      await step("Präsentation starten",async()=>{if(!await p.locator("body").evaluate(b=>b.classList.contains("present")))await click("present");await p.waitForSelector("body.present");});
      await step("Erdbebenpunkte ohne Grenzen",()=>recall("p0"));assert.deepEqual((await state()).mapLayers,{events:true,lines:false,depth:false});
      await shot("01-Karte-ohne-Grenzen");
      await step("Ruhende Karte beobachten",async()=>{const pose=await p.evaluate(()=>{const {lat,lon,d,tilt,bearing}=window.geoObservatory();return [lat,lon,d,tilt,bearing];});await p.waitForTimeout(400);assert.deepEqual(await p.evaluate(()=>{const {lat,lon,d,tilt,bearing}=window.geoObservatory();return [lat,lon,d,tilt,bearing];}),pose);});
      await step("Grenzen im Beobachtungsmodus aufdecken",async()=>{await click("observe-lines");await p.waitForFunction(()=>window.geoObservatory().observatory.mapLayers.lines);});await shot("02-Karte-mit-Grenzen");
      await step("Kalifornien wählen",()=>choose("observe-region","san"));
      await step("Von oben auf den Vergleichsweg blicken",()=>choose("observe-view","overhead"));await shot("03-Weg-vorher");
      const start=await at(0);
      await step("Spannungsaufbau anhalten",async()=>{await choose("observe-stage",".30");await click("observe-stress");});
      const strain=await at(.30);assert.ok(strain.settings.stress);await shot("04-Spannungsaufbau");
      await step("Bruch und Versatz aufrufen",()=>choose("observe-stage",".42"));const rupture=await at(.42);assert.ok(rupture.physics.rupture.length>0);await shot("05-Versatz");
      await step("Vorher und nachher vergleichen",async()=>{await click("observe-before");await at(0);await click("observe-after");});
      const end=await at(1);await shot("06-Weg-nachher");
      const offset=s=>Math.abs(s.physics.markerEnds[0][2]-s.physics.markerEnds[1][2]);
      log.marker={start:offset(start),strain:offset(strain),rupture:offset(rupture),end:offset(end)};
      assert.ok(log.marker.start<.001&&log.marker.end>.25);
      await step("Untergrund und Wellen untersuchen",async()=>{await choose("observe-stage",".53");await choose("observe-view","waves");});
      assert.ok((await at(.53)).cut);await shot("07-Wellen");
      for(const id of ["p","s"]){await click("observe-"+id);await rest();assert.equal((await state()).physics.waveFronts[id==="p"?0:1],false);await click("observe-"+id);}
      assert.equal(await p.locator("#sidebar").isVisible(),false);
      await step("Namen und Phasen freigeben",async()=>{await click("obswitch");await click("g-names");await p.locator("details").filter({has:p.locator("#g-phases")}).locator("summary").click();actions.push("Modell steuern");await click("g-phases");});assert.equal((await at(.53)).settings.phasesShown,true);
      await step("Japan als Transferbeispiel öffnen",async()=>{await choose("g-site","japan");await rest();await choose("g-view","cut");});await shot("08-Japan");
      await step("Zur globalen Erde zurückkehren",()=>click("g-world"));assert.equal((await state()).mode,"");
    });
    assert.equal(log.steps.length,13);assert.ok(log.steps.slice(1,10).every(s=>s.visibleAnswers===0));
    await click("nav-earthquake");await choose("g-launch","san");await rest();await choose("g-view","cut");
    const cut=[];for(const t of [0,.18,.3,.36,.42,.53,.72,1]){await fill("g-progress",t);const s=await at(t);const err=s.physics.cutPlaneError;assert.ok(err<.000002);cut.push([t,err]);}log.cut=cut;
    await shot("09-Schnitt-Endzustand");
    await choose("g-view","overhead");await fill("g-progress",.42);await click("g-vectors");await click("g-names");await click("g-s");await click("obswitch");await rest();
    const expected=await state(),key=await save("Parkfield · Prüfung");await recall("p6");await recall(key);
    let actual=await state();for(const field of ["view","cut","settings","camera","progress","site"])assert.deepEqual(actual[field],expected[field],field);assert.equal(await p.locator("body.observing").count(),1);
    log.favorites.push("Region, Schnitt, Kamera, Modellzeit, Pause, Zustand, Namen, Wellen, Vektoren und Beobachten");
    await click("obswitch");await choose("g-site","japan");await rest();await fill("g-progress",.52);
    await film("Meeresboden-Offenes-Meer-Kueste",async()=>{
      for(const event of ["flat","buried","vertical"]){await choose("g-sea",event);await rest();const s=await at(.52);assert.equal(s.physics.waterEvent,event==="vertical");}
      await choose("g-view","water");await shot("10-Meeresboden");
      await choose("g-view","ocean");await at(.52);await fill("g-progress",.63);await shot("11-Offenes-Meer");
      await choose("g-view","coast");assert.ok((await at(.63)).coastLesson);
      const history=await p.evaluate(()=>{const input=document.querySelector("#g-progress"),rows=[];
        for(let i=0;i<=120;i++){input.value=String(i/120);input.dispatchEvent(new Event("input"));const t=+input.value;rows.push({t,...window.geoObservatory().observatory.physics.flood});}return rows;});
      const peak=history.reduce((a,b)=>b.newlyWet>a.newlyWet||b.newlyWet===a.newlyWet&&b.deepest>a.deepest?b:a);
      const ebb=history.filter(v=>v.t>peak.t).reduce((a,b)=>b.newlyWet<a.newlyWet?b:a);
      assert.equal(history[0].newlyWet,0);assert.ok(peak.newlyWet>0&&ebb.newlyWet<peak.newlyWet);log.coast={initial:history[0],peak,ebb,history};
      await fill("g-progress",0);await shot("12-Kueste-vorher");await fill("g-progress",peak.t);await shot("13-Kueste-Ueberflutung");await fill("g-progress",ebb.t);await shot("14-Kueste-Rueckzug");
      await choose("g-view","water");assert.equal((await at(ebb.t)).site,"japan");
    });
    await click("g-depth-open");const svg=p.locator(".depth-plot svg");assert.equal(await svg.locator("circle").count(),176);assert.equal(await svg.locator("polyline").count(),0);await shot("15-Tiefenschnitt-Messpunkte");
    await click("depth-line");await click("depth-values");assert.equal((await svg.locator("polyline").getAttribute("points")).split(" ").length,13);await shot("16-Tiefenschnitt-Profil");await click("depth-model");assert.equal((await at(log.coast.ebb.t)).view,"cut");
    await click("g-map");await rest();const records=await p.evaluate(()=>window.geoBoundaryModels());
    for(const [label,predicate,n] of [["gesamt",()=>true,5819],["Subduktion",s=>s.category==="SUB",1127],["komplex",s=>!s.localQuake,43],["schraeg",s=>s.oblique,435],["unsichereHoehe",s=>s.coastalUncertainty,246]]){
      log.coverage[label]=records.filter(predicate).length;assert.equal(log.coverage[label],n,label);}
    assert.ok(records.every(s=>s.marine===(s.elevation<0&&!s.coastalUncertainty)));
    await click("nav-plates");await click("g-boundaries");await p.selectOption("#g-example",{label:"Komplexe Grenzzone"});await rest();
    const box=await p.locator("#earth").boundingBox();await p.mouse.click(box.x+box.width/2,box.y+box.height/2);assert.equal(await p.locator("#g-quake-explain").count(),0);assert.match(await p.locator("#sidebar").innerText(),/genaue Störung/);
    await click("g-segment");await rest();await choose("g-view","cut");await fill("g-progress",.53);actual=await at(.53);
    assert.equal(actual.focus,undefined);assert.equal(actual.epicenter,undefined);assert.equal(actual.physics.rupture.length,0);assert.deepEqual(actual.physics.waveFronts,[false,false]);assert.equal(await p.locator("#g-quake-from-process").count(),0);
    await click("nav-plates");await click("g-time");await click("obswitch");await choose("observe-station","-100");await rest();assert.match(await p.locator("#observe-note").innerText(),/100.*Rekonstruktion/);
    await choose("observe-track","501");await click("observe-trail");await shot("17-Zeitreise-Beobachten");
    const timeKey=await save("Zeitreise · Prüfung");await recall("p0");const mapKey=await save("Karte · Prüfung");await recall(timeKey);
    assert.equal((await state()).tracking,"501");assert.equal((await state()).year,-100);await recall(mapKey);assert.deepEqual((await state()).mapLayers,{events:true,lines:false,depth:false});
    log.favorites.push("Historischer Zeitpunkt und Verfolgung","Globale Karte und Datenebenen");
    // Remove only the three temporary scenes created during this test.
    for(const id of [mapKey,timeKey,key]){await click("saved-views");await choose("saved-list",id);await click("view-remove");await click("view-close");}
    await click("obswitch");await click("home");if(await p.locator("body.present").count())await click("present");
    await writeFile(join(dir,record?"Unterricht-App.json":"Unterricht-HTML.json"),JSON.stringify(log,null,2));return log;
  }finally{await display.detach();}
}
