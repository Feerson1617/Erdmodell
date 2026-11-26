import assert from "node:assert/strict";
import {writeFile} from "node:fs/promises";
import {join} from "node:path";
import {geometry} from "./g651-visual.mjs";
import {selectControl} from "./lesson-navigation.mjs";
import {screencast} from "./g5-abnahme.mjs";

export async function geographicProduct(page,out,film){
  const views=[], terms=[], screens=[],movies=[], checked=new Set();
  const route=(key,v)=>selectControl(page,"#geo-"+key,v);
  let current="";
  const settled=async()=>{
    try{await page.waitForFunction(()=>!window.geoObservatory().flying && document.querySelector("#geo-crumb").dataset.settled==="true",null,{timeout:65000});}
    catch(error){throw new Error("Ansicht "+current+" lädt nicht vollständig: "+await page.evaluate(()=>JSON.stringify({mode:window.geoObservatory().observatory.mode,view:window.geoObservatory().observatory.lessonView,ready:window.geoObservatory().observatory.ready,flying:window.geoObservatory().flying,painted:window.geoObservatory().observatory.painted})),{cause:error});}
  };
  const capture=async name=>{
    await page.screenshot({path:join(out,"G69-"+name+".jpg"),quality:86,type:"jpeg",timeout:120000});
    screens.push(name);
  };
  await route("info","terms");
  await page.click("#geo-explore");
  await page.getByRole("button",{name:"Vulkanismus",exact:true}).click();
  assert.ok(await page.locator('[data-target="geo-place/maunaloa"]').isVisible());
  await capture("Themenwahl");await page.click("#closeDialog");
  for(const place of ["schleswig","sylt","denmark","country-de","alps","eifel","maunaloa","zaozan","himalaya","san","globe-nyos"]){
    if(place==="globe-nyos") await route("topic","nyos-event"); else await route("place",place);
    await settled();await capture(place);
    const pixels=await geometry(page,{enforce:false});
    assert.ok(pixels.paletteSize>=24,place+" · Farbverteilung der isolierten Landschaft: "+pixels.paletteSize);
  }
  const zoom=async()=>{
    await route("topic","globe");await settled();
    await route("place","sylt");await settled();
    const cv=await page.locator("#earth").boundingBox();
    await page.mouse.move(cv.x+cv.width/2,cv.y+cv.height/2);
    for(const delta of [-180,-180,-150,200,240,280,320,340,420,500,650,650,650,650]){
      await page.mouse.wheel(0,delta);await page.waitForTimeout(film?1200:140);
    }
    await page.waitForFunction(()=>window.geoObservatory().d>13000);
    for(const [id,cut] of [["maunaloa","maunaCut"],["zaozan","zaoCut"]]){
      await route("place",id);await settled();await page.click("#geo-section");
      await page.waitForFunction(id=>window.geoObservatory().observatory.lessonView===id,cut);await settled();
      await page.locator("#geo-time").fill("0.55");await capture(cut);
      await page.click("#geo-back");await settled();
    }
  };
  if(film)movies.push(await screencast(page,out,"G69-Zoom-und-Vulkanschnitt",zoom,{fixedFrame:true,resizeFilm:true}));else await zoom();
  await page.emulateMedia({reducedMotion:"reduce"});
  const visit=async(key,id)=>{
    current=key+"/"+id;console.log("Geografische Abnahme",current);await route(key,id);await settled();await page.waitForTimeout(130);
    const labels=await page.locator(".seismic-label,[data-object],.studio-object").evaluateAll(es=>es.map(e=>({name:e.dataset.term||e.getAttribute("aria-label")||e.textContent,detail:e.dataset.explanation||"",button:e.tagName==="BUTTON",visible:!!e.offsetWidth})));
    const tested=[];
    for(const button of await page.locator(id==="inside"?"#pins button:visible":"button.seismic-label:visible").all()){
      const title=await button.getAttribute("data-term") || (await button.innerText()).trim();
      if(!title || checked.has(title))continue;
      const reachable=await button.evaluate(b=>{const r=b.getBoundingClientRect();return b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));});
      if(!reachable)continue;
      await button.click();
      const dialog=page.locator("#dialog");
      if(await dialog.isVisible()){
        const detail=await page.locator("#content").innerText();
        assert.ok(detail.length>title.length);tested.push({title,detail});checked.add(title);
        await page.click("#closeDialog");
      }
    }
    terms.push({id,labels,tested});
    await page.click("#geo-help");
    const help=await page.locator("#content").innerText();
    assert.match(help,/Was kann ich hier machen/);views.push({id,help});
    if(["inside","seismic-forms","research","seismic-profiles","system"].includes(id))await capture("Hilfe-"+id);
    await page.click("#closeDialog");
  };
  const topics=await page.locator("#geo-topic option").evaluateAll(es=>es.map(e=>e.value).filter(Boolean));
  const done=new Set();
  for(const id of topics){
    await visit("topic",id);
    if(id==="inside" || id==="seismic-forms"){
      const label=page.locator(id==="inside"?"#pins button:visible":"button.seismic-label:visible").first();
      await label.click();assert.ok(await page.locator("#dialog").isVisible());await capture("Begriff-"+id);await page.click("#closeDialog");
    }
    if(!id.startsWith("seismic-"))continue;
    done.add(id.slice(8));
    const variants=await page.locator("#geo-preset optgroup:first-of-type option").evaluateAll(es=>es.map(e=>e.value).filter(v=>!v.includes(":")));
    for(const v of variants){
      if(done.has(v) || topics.includes("seismic-"+v))continue;
      if(!(await page.locator("#geo-preset option").evaluateAll((options,v)=>options.some(o=>o.value===v),v))){
        current="topic/"+id;await route("topic",id);await settled();
      }
      await visit("preset",v);done.add(v);
    }
  }
  await route("topic","globe");await settled();
  await page.emulateMedia({reducedMotion:null});
  await writeFile(join(out,"G69.json"),JSON.stringify({views,terms,screens,movies},null,2));
}
