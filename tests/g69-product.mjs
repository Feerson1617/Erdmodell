import assert from "node:assert/strict";
import {writeFile} from "node:fs/promises";
import {join} from "node:path";
import {geometry} from "./g651-visual.mjs";
import {selectControl} from "./lesson-navigation.mjs";
import {screencast} from "./g5-abnahme.mjs";

export async function geographicProduct(page,out,film){
  const views=[], terms=[], screens=[],movies=[];
  const route=(key,v)=>selectControl(page,"#geo-"+key,v);
  const settled=()=>page.waitForFunction(()=>!window.geoObservatory().flying && document.querySelector("#geo-crumb").dataset.settled==="true");
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
    for(const delta of [-180,-180,-150,200,240,280,320,340,420,500]){
      await page.mouse.wheel(0,delta);await page.waitForTimeout(film?1200:140);
    }
    await route("place","maunaloa");await settled();await page.click("#geo-section");await settled();
  };
  if(film)movies.push(await screencast(page,out,"G69-Zoom-und-Vulkanschnitt",zoom,{fixedFrame:true,resizeFilm:true}));else await zoom();
  const visit=async(key,id)=>{
    await route(key,id);await settled();await page.waitForTimeout(130);
    const labels=await page.locator(".seismic-label,[data-object],.studio-object").evaluateAll(es=>es.map(e=>({name:e.dataset.term||e.getAttribute("aria-label")||e.textContent,detail:e.dataset.explanation||"",button:e.tagName==="BUTTON",visible:!!e.offsetWidth})));
    terms.push({id,labels});
    await page.click("#geo-help");
    const help=await page.locator("#content").innerText();
    assert.match(help,/Was kann ich hier machen/);views.push({id,help});
    if(["inside","seismic-forms","research","seismic-profiles"].includes(id))await capture("Hilfe-"+id);
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
      await route("topic",id);await settled();await visit("preset",v);done.add(v);
    }
  }
  await route("topic","globe");await settled();
  await writeFile(join(out,"G69.json"),JSON.stringify({views,terms,screens,movies},null,2));
}
