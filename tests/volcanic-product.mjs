import assert from "node:assert/strict";
import {mkdir,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {geometry,sizes} from "./g651-visual.mjs";
import {screencast} from "./g5-abnahme.mjs";
export async function volcanicProduct(page,out,{app,phase="G66",film=false}={}){
 await mkdir(out,{recursive:true});
 const report={phase,frames:[],movies:[],windows:[],errors:[]};
 const errors=e=>report.errors.push(String(e));page.on("pageerror",errors);
 const select=(id,v)=>page.selectOption("#"+id,v);
 const arrived=id=>page.waitForFunction(id=>window.geoObservatory().observatory.lessonView===id && document.querySelector("#geo-crumb").dataset.settled==="true",id);
 const open=async(id,child=false)=>{await select(child?"geo-preset":"geo-topic",child?id:"seismic-"+id);await arrived(id);};
 const time=async(t)=>{await page.locator("#geo-time").fill(String(t));await page.evaluate(()=>new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(ok))));};
 const check=async id=>{const g=await geometry(page);report.frames.push({id,foreground:g.foreground});await page.screenshot({path:join(out,id+".jpg"),type:"jpeg",quality:84});};
 await select("geo-info","explain");
 for(const [id,child] of [["shield",false],["lava",true],["cone",false],["plume",true],["storage",false],["degassing",false],["contact",false]]){
  await open(id,child);await time(.68);await check(id);
 }
 if(phase==="G67")await lakes();
 async function lakes(){}
 assert.deepEqual(report.errors,[]);page.off("pageerror",errors);
 await writeFile(join(out,phase+".json"),JSON.stringify(report,null,2));
}
