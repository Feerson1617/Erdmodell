import {chromium} from "playwright";
import {resolve,join} from "node:path";
import {pathToFileURL} from "node:url";
import {writeFile,mkdir} from "node:fs/promises";
import assert from "node:assert/strict";
const browser=await chromium.launch(process.env.G6_NATIVE_GPU?{headless:false}:{args:["--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
const p=await browser.newPage({viewport:{width:1366,height:860},reducedMotion:"no-preference"});
const out=process.env.G63_OUT||"test-results/g63",rows=[];await mkdir(out,{recursive:true});
await p.addInitScript(()=>{
 window.__THREE_DEVTOOLS__=new EventTarget();window.__THREE_DEVTOOLS__.addEventListener("observe",({detail:r})=>{if(!r.isWebGLRenderer)return;
  const draw=r.render.bind(r);r.render=(s,c)=>{window.geoTestScene=s;window.geoTestCamera=c;
   if(window.geoTestAudit&&s===window.geoGlobeScene)window.geoFlights.push(document.querySelector("#observatory-labels")?.childElementCount||0);
   return draw(s,c);};
 });
});
const ready=()=>p.waitForFunction(()=>{const o=window.geoObservatory?.(),s=o?.observatory;return o?.ready&&!o.flying&&(s.mode!=="regional"||s.ready&&s.viewSettled);});
const change=async(id,v)=>{await p.locator("#"+id).fill(String(v));await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));};
try{
 await p.goto(pathToFileURL(resolve(process.argv[2])).href);await ready();await p.evaluate(()=>{window.geoGlobeScene=window.geoTestScene;window.geoFlights=[];});
 await p.click("#nav-earthquake");await p.selectOption("#g-launch","san");await ready();await p.selectOption("#g-view","overhead");await ready();await change("g-progress",.2);
 // Pick a triangle well inside a real, visible half of the road. The driver independently
 // reconstructs the intersection from its triangle's currently rendered vertex buffer.
 const points=await p.evaluate(()=>{
   const rect=document.querySelector("#earth").getBoundingClientRect(),c=window.geoTestCamera,options=[];
   window.geoTestScene.traverse(o=>{if(o.name!=="Schematischer Vergleichsweg")return;
     const a=o.geometry.attributes.position,index=o.geometry.index;
     for(const triangle of [33,52,71,89,107]){const pt=c.position.clone().set(0,0,0);
       for(let j=0;j<3;j++)pt.add(c.position.clone().fromBufferAttribute(a,index.getX(3*triangle+j)));pt.divideScalar(3);o.localToWorld(pt);pt.project(c);
       const x=rect.x+rect.width*(1+pt.x)/2,y=rect.y+rect.height*(1-pt.y)/2;if(document.elementFromPoint(x,y)?.id==="earth")options.push([x,y]);}
   });return options;});
 let found;
 for(const point of points){await p.mouse.click(...point);await p.waitForTimeout(230);const s=await p.evaluate(()=>window.geoObservatory().observatory.selection);
   if(s?.hit&&s.point&&s.id.includes("Vergleichsweg")){found=s;break;}}
 assert.ok(found?.hit,"Triangulierter Vergleichsweg mit physischem Zeiger getroffen");
 console.log("Materialpunkt",found);
 const rowsAt=async t=>{await change("g-progress",t);await p.waitForTimeout(250);
   const result=await p.evaluate(()=>{const s=window.geoObservatory().observatory.selection;if(!s?.hit||!s.point)return;
     const o=window.geoTestScene.getObjectByProperty("uuid",s.hit.mesh);const v=o.position.clone().set(0,0,0);
     s.hit.indices.forEach((id,i)=>v.addScaledVector(o.position.clone().fromBufferAttribute(o.geometry.attributes.position,id),s.hit.weights[i]));
     o.localToWorld(v);return {name:s.id,xyz:s.point,independent:v.toArray(),error:v.distanceTo(o.position.clone().fromArray(s.point))};});
   assert.ok(result&&result.error<1e-7,"Dreiecksanker bei "+t);rows.push({t,...result});};
 await rowsAt(.2);await rowsAt(.49);await rowsAt(1);assert.notDeepEqual(rows[0].xyz,rows.at(-1).xyz);
 await p.evaluate(()=>window.geoTestAudit=true);await p.click("#nav-earthquake");await ready();await p.selectOption("#g-launch","japan");await ready();
 const flights=await p.evaluate(()=>window.geoFlights);assert.ok(flights.length>0);assert.ok(flights.every(n=>n===0),"Regionale Beschriftung auf Globus");
 await p.selectOption("#g-view","coast");await ready();await change("g-progress",0);
 assert.equal(await p.getByRole("button",{name:"Überfluteter Bereich",exact:true}).count(),0);
 await change("g-progress",.658);await p.getByRole("button",{name:"Überfluteter Bereich",exact:true}).waitFor({state:"visible"});
 const wet=await p.evaluate(()=>window.geoObservatory().observatory.physics.flood);assert.ok(wet.newlyWet>0);
 await writeFile(join(out,"Ankerpruefung.json"),JSON.stringify({rows,flightFrames:flights.length,staleLabels:Math.max(...flights),wet},null,2));
}finally{await browser.close();}
