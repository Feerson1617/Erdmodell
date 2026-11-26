import assert from "node:assert/strict";
import {writeFile} from "node:fs/promises";
import {resolve,join} from "node:path";
import {pathToFileURL} from "node:url";
import {chromium} from "playwright";
import {selectControl} from "./lesson-navigation.mjs";
import {sizes} from "./g651-visual.mjs";

const output=process.argv[2], file=process.argv[3];
const browser=await chromium.launch(process.env.G6_NATIVE_GPU?{headless:false}:{args:["--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
const page=await browser.newPage({viewport:{width:1366,height:768},hasTouch:true,reducedMotion:"reduce"});
const network=[], errors=[], places=[], inputs=[];
page.on("pageerror",e=>errors.push(String(e)));
await page.route(/^https?:/,route=>{network.push(route.request().url());return route.abort();});
const open=(key,id)=>selectControl(page,"#geo-"+key,id);
const settle=()=>page.waitForFunction(()=>!window.geoObservatory().flying&&document.querySelector("#geo-crumb").dataset.settled==="true",null,{timeout:65000});
const close=()=>page.keyboard.press("Escape");
try{
  await page.goto(pathToFileURL(resolve(file)).href);
  await page.waitForFunction(()=>window.geoObservatory?.().ready);
  const options=await page.locator("#geo-place option").evaluateAll(es=>es.filter(e=>e.value).map(e=>[e.value,e.text]));
  for(const [id,title] of options){
    await open("place",id);await settle();await page.click("#geo-help");
    const help=await page.locator("#content").innerText();
    assert.match(help,/Was kann ich hier machen/);
    places.push({id,title,help});await close();
  }
  for(const [w,h] of sizes){
    await page.setViewportSize({width:w,height:h});await open("topic","inside");await settle();
    const layers=[];
    for(let i=0;i<4;i++){
      const pin=page.locator('#pins [data-object="shell-'+i+'"]');
      await pin.tap();const layer=await page.locator("#dialogTitle").innerText();
      await page.getByRole("button",{name:"Woher wissen wir das?"}).tap();
      const explanation=await page.locator("#shellAnswer").innerText();
      assert.ok(explanation.length>25);layers.push({layer,explanation});await close();
    }
    const mantle=page.locator('#pins [data-object="shell-1"]');
    const [x,y]=await mantle.evaluate(e=>{const r=e.parentElement.getBoundingClientRect();return [r.x,r.y];});
    await page.mouse.click(x,y);
    assert.equal(await page.locator("#dialogTitle").innerText(),"Erdmantel");await close();
    await page.locator("#geo-help").focus();await page.keyboard.press("Enter");
    assert.ok(await page.locator("#dialog").isVisible());await close();
    await open("info","neutral");await page.tap("#geo-help");
    const neutral=await page.locator("#content").innerText();
    assert.doesNotMatch(neutral,/Erdkruste|Erdkern|Erdmantel/);await close();await open("info","terms");
    inputs.push({w,h,layers,clickedSurface:"Erdmantel",keyboardHelp:true,neutral});
  }
  const ventInputs=[];
  for(const [place,view,term] of [["maunaloa","maunaCut","Schildvulkan"],["zaozan","zaoCut","Schichtvulkan"]]){
    await open("place",place);await settle();await page.tap("#geo-section");
    await page.waitForFunction(id=>window.geoObservatory().observatory.lessonView===id,view);await settle();
    await page.locator("#geo-time").fill("0.55");
    await page.locator('button.seismic-label[data-term="'+term+'"]').tap();
    assert.equal(await page.locator("#dialogTitle").innerText(),term);
    ventInputs.push({place,view,term,explanation:await page.locator("#content").innerText()});await close();
    await page.click("#geo-back");await settle();
  }
  assert.deepEqual(network,[]);assert.deepEqual(errors,[]);
  await writeFile(join(output,"Orte-und-Eingabe.json"),JSON.stringify({places,inputs,ventInputs,errors,network},null,2));
}finally{await browser.close();}
