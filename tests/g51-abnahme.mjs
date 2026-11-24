import {fullHDPhoto} from "./native-picture.mjs";
import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {join} from "node:path";
import {screencast} from "./g5-abnahme.mjs";

function controls(page){
  const click=id=>page.locator("#"+id).click();
  const select=(id,value)=>page.selectOption("#"+id,value);
  const ready=()=>page.waitForFunction(()=>{const world=window.geoObservatory();return !world.flying&&world.observatory.ready&&world.observatory.mode==="regional"&&world.observatory.viewSettled;});
  const visit=async id=>{await click("nav-earthquake");await select("g-launch",id);await ready();};
  const time=async()=>{await click("nav-plates");await click("g-time");await page.waitForFunction(()=>window.geoObservatory().observatory.timeReady);};
  return {click,select,ready,visit,time};
}

export async function acceptG51(p,dir,films=true){
  await mkdir(dir,{recursive:true});
  const display=await p.context().newCDPSession(p);
  const {click,select,ready,visit,time}=controls(p),pictures=[],movies=[];
  const range=(id,v)=>p.locator("#"+id).fill(String(v));
  const view=id=>select("g-view",id);
  const phase=v=>range("g-progress",v);
  const details=async id=>{const input=p.locator("#"+id);if(!await input.isVisible())await input.locator("xpath=ancestor::details[1]/summary").click();};
  const shot=async name=>{
    await p.waitForFunction(()=>{const w=window.geoObservatory(),s=w.observatory;return !w.flying&&(s.mode!=="regional"||s.ready&&s.viewSettled)&&(s.mode!=="time"||s.timeReady);});
    await p.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
    await fullHDPhoto(p,display,dir,name);pictures.push(name);
  };
  const film=async(name,fn)=>{if(films)movies.push(await screencast(p,dir,name,fn));else await fn();};
  await visit("san");await shot("01-Parkfield-Landschaft");await view("cut");await shot("02-Parkfield-Schnitt");
  await view("fault");await phase(.03);await shot("03-Verriegelter-Kontakt");
  await details("g-stress");await p.check("#g-stress");await phase(.31);await shot("04-Elastische-Verformung");
  await film("Bewegung-Bruch-und-Wellen",async()=>{await click("g-play");await p.waitForFunction(()=>window.geoObservatory().observatory.progress>.64);await click("g-play");});
  await phase(.48);await shot("05-Bruch-und-Versatz");await view("waves");await phase(.54);await shot("06-Wellenfronten");
  await visit("japan");await shot("07-Tohoku-Landschaft");await view("cut");await shot("08-Miyagi-Plattenkontakt");
  await phase(.48);await shot("09-Seebeben");await view("water");await shot("10-Wassersaeule");
  await film("Bewegung-Wasser-und-Kueste",async()=>{await click("g-play");await p.waitForFunction(()=>window.geoObservatory().observatory.progress>.76);await click("g-play");});
  await view("cut");await phase(.63);await shot("11-Ausbreitung");await view("coast");await phase(.83);await shot("12-Kueste");
  await visit("rift");await view("cut");await phase(.74);await shot("13-Grabenbruch");
  await visit("himalaya");await view("cut");await phase(.74);await shot("14-Kontinentkollision");
  await click("nav-plates");await click("g-boundaries");await p.selectOption("#g-example",{label:"Ozeanischer Rücken"});
  await p.waitForFunction(()=>!window.geoObservatory().flying);const box=await p.locator("#earth").boundingBox();await p.mouse.click(box.x+box.width/2,box.y+box.height/2);
  await click("g-segment");await ready();await view("cut");await phase(.82);await shot("15-Ozeanbodenbildung");
  await click("nav-plates");await click("g-forces");await ready();await phase(.66);await shot("16-Plattenantrieb");
  await click("nav-volcano");await ready();await select("g-site","japan");await ready();await phase(.60);await shot("17-Vulkanbogen");
  await select("g-site","hawaii");await ready();await phase(.77);await shot("18-Inselkette");
  await select("g-eruption","effusive");await phase(.69);await shot("19-Lavastrom");
  await select("g-site","japan");await ready();await select("g-eruption","explosive");await view("vent");await phase(.75);await shot("20-Ascheausbruch");
  await time();await range("g-year",-170);await shot("21-Kontinentalbewegung");
  await p.locator("#g-tracking summary").click();await select("g-track","501");await p.check("#g-trail");await p.check("#g-follow");await range("g-year",-70);await shot("22-Indien-verfolgen");
  await select("g-scenario","aurica");await range("g-year",165);await p.check("#g-compare");await select("g-second","amasia");await p.check("#g-future-lines");await shot("23-Zukunftsvergleich");
  await click("nav-earthquake");await shot("24-Ereigniskarte");
  await select("g-launch","japan");await ready();await view("cut");await p.locator("#g-depth-section summary").click();
  await p.locator("#g-depth-section figcaption").scrollIntoViewIfNeeded();await shot("25-Tiefenquerschnitt");
  await click("nav-risk");await ready();await view("cut");await phase(.54);await select("g-soil","rock");await shot("26a-Fels");await select("g-soil","loose");await shot("26b-Ablagerungen");
  await p.check("#g-protect");await shot("27-Verstaerkte-Bauweise");
  await select("g-risk-kind","coast");await ready();await details("g-route");await p.check("#g-route");await p.check("#g-warning");await p.check("#g-relocate");await phase(.85);await shot("28-Tsunamivorsorge");
  await visit("san");await view("cut");await click("obswitch");await p.waitForSelector("#observe-progress");assert.ok(await p.locator("#sidebar").evaluate(e=>e.inert));
  await range("observe-progress",.43);await shot("29-Beobachten");await click("present");await p.waitForFunction(()=>document.body.classList.contains("present"));await shot("30-Smartboard");
  await click("present");await click("obswitch");assert.equal(await p.locator("#sidebar").evaluate(e=>e.inert),false);
  await display.detach();return {pictures,movies,dimensions:[1920,1080]};
}

export async function longClassroom(p,measure,readMemory){
  const {click,ready,visit,time}=controls(p);
  const display=await p.context().newCDPSession(p),start=performance.now(),samples=[],home=[];
  const sizes=[[1280,800],[1920,1080],[2560,1440]];
  let n=0,localFavorite;
  try{
    while(performance.now()-start<900000){
      const [width,height]=sizes[Math.min(2,Math.floor((performance.now()-start)/300000))];
      await display.send("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:false});
      await p.waitForFunction(([w,h])=>innerWidth===w&&innerHeight===h,[width,height]);
      const label=["Parkfield","Tohoku und Tsunami","Zeitreise","Vulkanismus"][n%4];
      const loadStart=performance.now();
      if(n%4===2){await time();if(n%8===6){await p.selectOption("#g-scenario","aurica");await p.locator("#g-year").fill("160");await p.check("#g-compare");await p.waitForFunction(()=>window.geoObservatory().observatory.timeReady);}await click("g-time-play");}
      else{if(n%4===3){await click("nav-volcano");await ready();}else{await visit(n%4===0?"san":"japan");await click("g-cut");}if(n%8===0||n%8===3||n%8===5){
          await p.selectOption("#g-view","local");await ready();await p.selectOption("#g-view","ground");await ready();
          if(n%8===0){
            await click("saved-views");
            if(!localFavorite){await p.fill("#view-name","Dauerlauf · Nahperspektive");await click("view-save");localFavorite=await p.locator("#saved-list").inputValue();await click("view-close");}
            else{await p.selectOption("#saved-list",localFavorite);await click("view-apply");await p.waitForSelector(".classroom-views",{state:"hidden"});await ready();assert.equal(await p.locator("#g-view").inputValue(),"ground");}
          }
        }
        await click("g-play");}
      samples.push({width,height,readyMs:performance.now()-loadStart,futureComparison:n%8===6,...await measure(label,15000)});
      if(n%4===2)await click("g-time-play");
      await click("home");await p.waitForFunction(()=>!window.geoObservatory().flying);
      const resources=await p.evaluate(()=>{const s=window.geoObservatory();return {geometries:s.geometries,textures:s.textures,programs:s.programs,jsHeap:performance.memory?.usedJSHeapSize};});
      home.push({cycle:n,width,height,rssMiB:readMemory(),...resources});
      if(n%8===0)console.log("Unterrichtsdauer",Math.round((performance.now()-start)/1000),"s",width,height);
      n++;
    }
  }finally{await display.send("Emulation.setDeviceMetricsOverride",{width:1920,height:1080,deviceScaleFactor:1,mobile:false});await display.detach();}
  assert.equal(new Set(samples.map(s=>s.width)).size,3);
  return {elapsedMs:performance.now()-start,samples,home};
}
