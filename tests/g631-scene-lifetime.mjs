// Hold a real shader warmup across navigation, then observe material lifetime.
import {chromium} from "playwright";
import assert from "node:assert/strict";
import {mkdir,writeFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";
import {resolve,join} from "node:path";
const browser=await chromium.launch(process.env.G6_NATIVE_GPU?{headless:false}:{args:["--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
const out=process.env.G63_OUT||"test-results/g631";await mkdir(out,{recursive:true});
const p=await browser.newPage({viewport:{width:1280,height:800},reducedMotion:"reduce"});
const errors=[];p.on("pageerror",e=>errors.push(e.stack||e.message));
try{
 await p.addInitScript(()=>{
   window.__THREE_DEVTOOLS__=new EventTarget();
   window.__THREE_DEVTOOLS__.addEventListener("observe",({detail:r})=>{
     if(!r.isWebGLRenderer)return;
     const compile=r.compileAsync.bind(r);
     r.compileAsync=async(scene,camera,...rest)=>{
       const active=compile(scene,camera,...rest);
       if(!window.holdNextWarmup)return active;
       window.holdNextWarmup=false;
       const materials=new Set();scene.traverse(o=>{if(o.material)for(const m of [o.material].flat())materials.add(m);});
       window.materialsReleased=0;for(const mat of materials)mat.addEventListener("dispose",()=>window.materialsReleased++);
       const hold=new Promise(ok=>{window.finishWarmup=ok;});
       await Promise.all([active,hold]);return scene;
     };
   });
 });
 await p.goto(pathToFileURL(resolve(process.argv[2])).href);await p.waitForFunction(()=>window.geoObservatory?.().ready);
 await p.evaluate(()=>{window.holdNextWarmup=true;});await p.click("#nav-volcano");
 await p.waitForFunction(()=>typeof window.finishWarmup==="function");
 await p.click("#nav-globe");await p.waitForFunction(()=>window.geoObservatory().observatory.mode==="");
 assert.equal(await p.evaluate(()=>window.materialsReleased),0,"Material während der Grafikvorbereitung freigegeben");
 await p.evaluate(()=>window.finishWarmup());await p.waitForFunction(()=>window.materialsReleased>0);
 await p.click("#nav-volcano");await p.selectOption("#g-site","japan");
 await p.waitForFunction(()=>{const s=window.geoObservatory().observatory;return s.site==="japan"&&s.ready;});
 assert.deepEqual(errors,[]);await writeFile(join(out,"Szenenfreigabe.json"),JSON.stringify({complete:true,released:await p.evaluate(()=>window.materialsReleased),errors}));
}finally{await browser.close();}
