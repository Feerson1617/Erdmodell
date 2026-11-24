import assert from "node:assert/strict";
import {mkdir,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {fullHDPhoto} from "./native-picture.mjs";
import {screencast} from "./g5-abnahme.mjs";

export async function classroom(p,dir,record=false){
  await mkdir(dir,{recursive:true});
  const display=await p.context().newCDPSession(p);
  const log={steps:[],transfer:[],switches:[],profiles:{},pictures:[],movies:[],coast:[],favorites:[],coverage:{}};
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
      await step("Bruch und Versatz aufrufen",()=>choose("observe-stage",".49"));const rupture=await at(.49);assert.ok(rupture.physics.rupture.length>0);await shot("05-Versatz");
      await step("Vorher und nachher vergleichen",async()=>{await click("observe-before");await at(0);await click("observe-after");});
      const end=await at(1);await shot("06-Weg-nachher");
      const offset=s=>Math.abs(s.physics.markerEnds[0][2]-s.physics.markerEnds[1][2]);
      log.marker={start:offset(start),strain:offset(strain),rupture:offset(rupture),end:offset(end)};
      assert.ok(log.marker.start<.001&&log.marker.rupture>.2&&log.marker.end>.25);
      await step("Untergrund und Wellen untersuchen",async()=>{await choose("observe-stage",".53");await choose("observe-view","waves");});
      assert.ok((await at(.53)).cut);await shot("07-Wellen");
      for(const id of ["p","s"]){await click("observe-"+id);await rest();assert.equal((await state()).physics.waveFronts[id==="p"?0:1],false);await click("observe-"+id);}
      assert.equal(await p.locator("#sidebar").isVisible(),false);
      await step("Namen und Phasen freigeben",async()=>{await click("obswitch");await p.check("#g-names");await p.locator("details").filter({has:p.locator("#g-phases")}).locator("summary").click();actions.push("Modell steuern");await p.check("#g-phases");});assert.equal((await at(.53)).settings.phasesShown,true);
      await step("Japan als Transferbeispiel öffnen",async()=>{await choose("g-site","japan");await rest();await choose("g-view","cut");});await shot("08-Japan");
      const transfer=async(label,fn)=>{actions=[];const start=performance.now();await fn();await rest();const s=await state();
        log.transfer.push({label,actions:[...actions],ms:Math.round(performance.now()-start),site:s.site,phase:s.progress,view:s.view,playing:s.playing,focus:s.focus,mode:s.mode});};
      await transfer("Vorhersage im ruhenden Japanschnitt",async()=>{await at(0);await p.waitForTimeout(500);await at(0);});
      await transfer("Subduktionsbeben abspielen",async()=>{await fill("g-progress",.32);await click("g-play");await p.waitForFunction(()=>window.geoObservatory().observatory.progress>=.49,null,{timeout:180000});await click("g-play");});
      await transfer("Herd und Wellenausbreitung",async()=>{await fill("g-progress",.53);await choose("g-view","focus");await rest();await choose("g-view","waves");await rest();
        const s=await at(.53);assert.ok(s.focus&&s.physics.waveFronts.every(Boolean));assert.equal(await p.innerText("#g-cut"),"An die Oberfläche");await shot("18-Japan-Herd-Wellen");});
      await transfer("Kalifornien in derselben Modellphase",async()=>{await choose("g-site","san");await rest();await fill("g-progress",.53);await choose("g-view","waves");assert.equal((await at(.53)).site,"san");await shot("19-Kalifornien-Transfer");});
      await transfer("Zur globalen Erdbebenkarte",async()=>{await click("g-map");assert.equal((await state()).mode,"map");});
      await step("Zur globalen Erde zurückkehren",()=>click("g-world"));assert.equal((await state()).mode,"");
    });
    assert.equal(log.steps.length,13);assert.ok(log.steps.slice(1,10).every(s=>s.visibleAnswers===0));
    await click("nav-earthquake");await choose("g-launch","san");await rest();await choose("g-view","cut");
    const cut=[];for(const t of [0,.18,.3,.36,.42,.53,.72,1]){await fill("g-progress",t);const s=await at(t);const err=s.physics.cutPlaneError;assert.ok(err<.000002);cut.push([t,err]);}log.cut=cut;
    await shot("09-Schnitt-Endzustand");
    await choose("g-view","overhead");await fill("g-progress",.42);await click("g-vectors");await p.check("#g-names");await click("g-s");await click("obswitch");await rest();
    const expected=await state(),key=await save("Parkfield · Prüfung");await recall("p6");await recall(key);
    let actual=await state();for(const field of ["view","cut","settings","camera","progress","site"])assert.deepEqual(actual[field],expected[field],field);assert.equal(await p.locator("body.observing").count(),1);
    log.favorites.push("Region, Schnitt, Kamera, Modellzeit, Pause, Zustand, Namen, Wellen, Vektoren und Beobachten");
    await click("obswitch");await choose("g-site","japan");await rest();await fill("g-progress",.52);
    const profile=async key=>{const was=(await state()).progress;
      await fill("g-progress",0);const start=await at(0);await fill("g-progress",1);const end=await at(1);
      log.profiles[key]={focus:start.focus,start:start.physics.waterProfile,end:end.physics.waterProfile};await fill("g-progress",was);};
    await profile("Japan");await film("Meeresboden-Offenes-Meer-Kueste",async()=>{
      for(const event of ["flat","buried","flat","vertical"]){await choose("g-sea",event);await rest();const s=await at(.52);assert.equal(s.physics.waterEvent,event==="vertical");log.switches.push({event,progress:s.progress,...s.timings});}
      await choose("g-view","water");await shot("10-Meeresboden");await click("g-water-profile");await p.waitForSelector("#water-profile:visible");await at(.52);
      await choose("g-view","ocean");await at(.52);await fill("g-progress",.63);await shot("11-Offenes-Meer");
      const showWave=async()=>{await fill("g-progress",.37);await click("g-play");
        await p.waitForFunction(()=>window.geoObservatory().observatory.progress>.80,null,{timeout:180000});await click("g-play");};
      if(record){await showWave();await fill("g-progress",.63);}
      await choose("g-view","coast");assert.ok((await at(.63)).coastLesson);
      const history=(await state()).physics.floodHistory;
      const peak=history.reduce((a,b)=>b.newlyWet>a.newlyWet||b.newlyWet===a.newlyWet&&b.deepest>a.deepest?b:a);
      const ebb=history.filter(v=>v.t>peak.t).reduce((a,b)=>b.newlyWet<a.newlyWet?b:a);
      assert.equal(history[0].newlyWet,0);assert.ok(peak.newlyWet>0&&ebb.newlyWet<peak.newlyWet);log.coast={initial:history[0],peak,ebb,history};
      await fill("g-progress",0);await shot("12-Kueste-vorher");if(record)await showWave();await fill("g-progress",peak.t);await shot("13-Kueste-Ueberflutung");await fill("g-progress",ebb.t);await shot("14-Kueste-Rueckzug");
      for(const phase of ["before","peak","ebb"]){await click("profile-"+phase);await rest();const s=await state();assert.ok(!s.playing);const wet=await p.locator('[data-line="inland"]').getAttribute("d");
        const width=await p.locator('[data-line="advance"]').evaluate(path=>path.getTotalLength());(log.shoreline??={})[phase]=width;
        if(phase==="peak")assert.ok(s.physics.flood.newlyWet>0&&wet.includes("Z")&&width>30);
        if(phase==="before")assert.equal(width,0);if(phase==="ebb")assert.ok(width<log.shoreline.peak);await shot("Profil-"+phase);}
      await fill("g-progress",ebb.t);await choose("g-view","water");assert.equal((await at(ebb.t)).site,"japan");await click("profile-close");
    });
    await choose("g-view","coast");await rest();await profile("Kueste");await choose("g-view","water");await rest();
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
    const selectBoundary=async id=>{
      await click("nav-plates");await click("g-boundaries");await choose("g-example",String(id));await rest();
      const box=await p.locator("#earth").boundingBox();await p.mouse.click(box.x+box.width/2,box.y+box.height/2);
      assert.equal((await state()).selected,id);
    };
    await selectBoundary(1438);assert.equal(await p.locator("#g-quake-explain").innerText(),"Erdbeben erklären");
    await click("g-quake-explain");await rest();assert.match(await p.locator("#sidebar").textContent(),/keine sichere Zuordnung/);
    await selectBoundary(3757);assert.equal(await p.locator("#g-quake-explain").innerText(),"Seebeben erklären");await click("g-quake-explain");await rest();
    assert.equal((await state()).physics.waterEvent,false);assert.equal(await p.locator("#g-sea").count(),0);
    await click("g-vectors");await rest();assert.equal((await state()).view,"overhead");assert.match(await p.locator("#sidebar").textContent(),/längs der Grenze/);
    await click("nav-risk");await rest();await fill("g-progress",.54);const risk=await at(.54);
    await choose("g-risk-site","far");const riskB=await at(.54);assert.deepEqual(risk.focus,riskB.focus);assert.equal(riskB.settings.riskSite,"far");
    log.contrasts={unknown:false,uncertainLandSea:"Alpine Fault",oblique:"Sumatra",sumatraTsunami:false,riskSource:[risk.focus,riskB.focus]};
    await click("nav-plates");await click("g-time");await click("obswitch");await choose("observe-station","-100");await rest();assert.match(await p.locator("#observe-note").innerText(),/100.*Rekonstruktion/);
    await choose("observe-track","501");await click("observe-trail");await shot("17-Zeitreise-Beobachten");
    const timeKey=await save("Zeitreise · Prüfung");await recall("p0");const mapKey=await save("Karte · Prüfung");await recall(timeKey);
    assert.equal((await state()).tracking,"501");assert.equal((await state()).year,-100);await recall(mapKey);assert.deepEqual((await state()).mapLayers,{events:true,lines:false,depth:false});
    log.favorites.push("Historischer Zeitpunkt und Verfolgung","Globale Karte und Datenebenen");
    await recall("p2");await click("observe-play");const running=await save("Wiedergabe · Prüfung");await recall("p0");
    await recall(running);assert.ok((await state()).playing);await click("observe-play");
    const nativePresentation=await p.evaluate(()=>Boolean(window.geoPresentation)&&document.body.classList.contains("present"));
    await p.reload();await p.waitForFunction(()=>window.geoObservatory?.().ready);
    if(nativePresentation)await p.waitForSelector("body.present");await recall(key);
    assert.equal((await state()).site,"san");assert.deepEqual((await state()).camera,expected.camera);
    log.favorites.push("Laufende Wiedergabe und Abruf nach Neuladen");
    // Remove only the three temporary scenes created during this test.
    for(const id of [running,mapKey,timeKey,key]){await click("saved-views");await choose("saved-list",id);await click("view-remove");await click("view-close");}
    await click("obswitch");await click("home");if(await p.locator("body.present").count()){await click("present");await p.waitForSelector("body.present",{state:"detached"});}
    await film("Nahmodell-und-Untergrund",async()=>{
      await click("nav-earthquake");await choose("g-launch","san");await rest();await fill("g-progress",.46);
      await choose("g-view","local");await rest();await choose("g-view","ground");await rest();
      const before=await at(.46),favorite=await save("Bodennahe Kamera");
      await choose("g-view","cut");await rest();await recall(favorite);const after=await at(.46);
      assert.equal(after.view,"ground");for(const key of ["position","target"])assert.ok(after.camera[key].every((x,i)=>Math.abs(x-before.camera[key][i])<1e-7));
      await click("saved-views");await choose("saved-list",favorite);await click("view-remove");await click("view-close");
      await choose("g-view","cut");await rest();await click("home");await rest();
    });
    await writeFile(join(dir,record?"Unterricht-App.json":"Unterricht-HTML.json"),JSON.stringify(log,null,2));return log;
  }finally{await display.detach();}
}
