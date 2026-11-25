// Inspect the actual offline renderer and its panels, including the island arc reached from PB2002.
import {chromium} from "playwright";
import {mkdir, writeFile} from "node:fs/promises";
import {resolve,join} from "node:path";
import {pathToFileURL} from "node:url";
import assert from "node:assert/strict";
import {screencast} from "./g5-abnahme.mjs";

const before=process.argv.includes("--before");
const out=join(process.env.G63_OUT||"test-results/g631",before?"Vorher":"Nachher");
await mkdir(out,{recursive:true});
const browser=await chromium.launch(process.env.G6_NATIVE_GPU?{headless:false}:{args:["--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
const page=await browser.newPage({viewport:{width:1600,height:900},reducedMotion:"reduce"});
const result={cases:[],shots:[],films:[],errors:[],network:[],engine:browser.version()};
page.setDefaultTimeout(90000);
page.on("pageerror",e=>result.errors.push(e.message));
await page.route(/^https?:/,r=>{result.network.push(r.request().url());return r.abort();});
await page.addInitScript(()=>{
 localStorage.setItem("georisiko.graphics.g6","classroom");
 window.__THREE_DEVTOOLS__=new EventTarget();
 window.__THREE_DEVTOOLS__.addEventListener("observe",({detail:r})=>{
   if(!r.isWebGLRenderer)return;
   const render=r.render.bind(r);
   r.render=(scene,camera)=>{window.acceptanceScene=scene;return render(scene,camera);};
 });
});
async function ready(){
 await page.waitForFunction(()=>{const w=window.geoObservatory?.(),s=w?.observatory;return w?.ready&&!w.flying&&(s.mode!=="regional"||s.ready&&s.viewSettled);});
 await page.evaluate(()=>new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(ok))));
}
async function boundary(id){
 await page.click("#nav-plates");await page.click("#g-boundaries");await page.waitForFunction(()=>window.geoObservatory().observatory.steps===5819);await page.selectOption("#g-example",String(id));await ready();
 const box=await page.locator("#earth").boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
 await page.waitForFunction(id=>window.geoObservatory().observatory.selected===id,id);
 await page.click("#g-segment-volcano");await ready();
}
async function shot(name){
 await ready();await page.screenshot({type:"jpeg",quality:83,path:join(out,name+".jpg")});result.shots.push(name);
}
async function renderedPath(){
 return page.evaluate(()=>{
   let path,fluid=false,inside=false;const wedges=[];
   window.acceptanceScene.traverse(o=>{
     if(o.userData.explanation?.name==="Wasserhaltige Fluide")fluid=true;
     if(o.userData.explanation?.name==="Mantelkeil")wedges.push(o.geometry);
     if(o.geometry?.parameters?.path && ["Hotspot","Magma"].includes(o.userData.explanation?.name) && o.geometry.parameters.tubularSegments===64)path=o;
   });
   if(!path)return {fluid,inside};
   const q=path.geometry.parameters.path.getPoint(0);
   for(const geo of wedges){
     const p=geo.attributes.position,ix=geo.index;
     for(let i=0;i<ix.count;i+=3){
       const [a,b,c]=[ix.getX(i),ix.getX(i+1),ix.getX(i+2)];
       if([a,b,c].some(v=>Math.abs(p.getZ(v))>.012))continue;
       const ax=p.getX(a),ay=p.getY(a),bx=p.getX(b),by=p.getY(b),cx=p.getX(c),cy=p.getY(c);
       const area=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);if(Math.abs(area)<1e-8)continue;
       const u=((q.x-ax)*(cy-ay)-(q.y-ay)*(cx-ax))/area,v=((bx-ax)*(q.y-ay)-(by-ay)*(q.x-ax))/area;
       if(u>=-1e-5&&v>=-1e-5&&u+v<=1.00001){inside=true;break;}
     }
   }
   return {fluid,inside,source:[q.x,q.y,q.z],label:path.userData.explanation};
 });
}
try{
 await page.goto(pathToFileURL(resolve(process.argv[2])).href);await ready();
 for(const [label,site,id,expected] of [
   ["Tonga",null,1510,/Mantelkeil/],["Gakkelruecken",null,2308,/Druck/],
   ["Japan","japan",null,/Mantelkeil/],["Island","island",null,/Hotspot/],["Hawaii","hawaii",null,/Druck/]
 ]){
   console.log("Referenzregion",label);
   if(id)await boundary(id);else{await page.click("#nav-volcano");await ready();await page.selectOption("#g-site",site);await ready();}
   await page.selectOption("#g-view","cut");await ready();
   const details=page.getByText("Wie entsteht Schmelze?",{exact:true}).locator("..");
   await details.locator("summary").click();
   const explanation=await details.locator("p").textContent();
   await page.locator("#g-progress").fill("0.4");await ready();
   const cause=await page.locator("#learn-cause").textContent(),geometry=await renderedPath();
   result.cases.push({label,explanation,cause,geometry});
   if(!before){
     assert.match(explanation,expected,label);assert.equal(explanation,cause,label);assert.equal(geometry.label?.answer,cause,label);
     const arc=["Tonga","Japan"].includes(label);assert.equal(geometry.fluid,arc,label);if(arc)assert.equal(geometry.inside,true,label+" · Schmelzquelle im Mantelkeil");
     assert.doesNotMatch(await page.locator("body").innerText(),/Denkauftrag|Weiterer Auftrag|Prüfe deine Vermutung/i);
   }
   await shot("23-"+label+"-Schmelzbildung");
   if(label==="Tonga"){
     const demonstrate=async()=>{
       await page.locator("#g-progress").fill("0");await ready();await shot("24-Inselbogen-Ausgangszustand");
       if(before||process.env.G63_QUICK)await page.locator("#g-progress").fill("1");
       else{await page.click("#g-play");await page.waitForFunction(()=>window.geoObservatory().observatory.progress>=.995);}
       await shot("25-Inselbogen-Ausbruch");
       await page.locator("#g-progress").fill("0.4");await ready();
     };
     if(before||process.env.G63_QUICK)await demonstrate();
     else result.films.push(await screencast(page,out,"09-Inselbogen-Fluide-und-Schmelze",demonstrate,{maxWidth:1366,maxHeight:768,quality:82}));
   }
 }
 assert.deepEqual(result.errors,[]);assert.deepEqual(result.network,[]);result.complete=true;
}finally{await writeFile(join(out,"Vulkanpruefung.json"),JSON.stringify(result,null,2));await browser.close();}
