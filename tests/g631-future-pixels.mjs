// Compare the actual GPU output with the pinned reference renderer at fixed poses.
import {chromium} from "playwright";
import {PNG} from "pngjs";
import {mkdir,writeFile} from "node:fs/promises";
import {resolve,join} from "node:path";
import {pathToFileURL} from "node:url";
import assert from "node:assert/strict";
const out=process.env.G63_OUT||"test-results/g631";
await mkdir(out,{recursive:true});
const browser=await chromium.launch(process.env.G6_NATIVE_GPU?{headless:false}:{args:["--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
const cases=[["aurica","amasia",100,false],["ultima","novo",180,true],["amasia","aurica",75,true],["novo","ultima",135,false]];
const reference=[],report={cases:[],errors:[],external:[]};
try{
 for(const [version,file] of process.argv.slice(2).entries()){
   const p=await browser.newPage({viewport:{width:1000,height:660},deviceScaleFactor:.75,reducedMotion:"reduce"});
   p.on("pageerror",e=>report.errors.push(e.message));await p.route(/^https?:/,r=>{report.external.push(r.request().url());return r.abort();});
   await p.goto(pathToFileURL(resolve(file)).href);await p.waitForFunction(()=>window.geoObservatory?.().ready);
   await p.click("#nav-plates");await p.click("#g-time");
   for(const [i,[first,second,year,lines]] of cases.entries()){
     await p.selectOption("#g-scenario",first);await p.locator("#g-year").fill(String(year));
     await p.locator("#g-compare").check();await p.selectOption("#g-second",second);
     await p.selectOption("#g-compare-camera","same");await p.locator("#g-future-lines").setChecked(lines);
     await p.waitForFunction(()=>{const s=window.geoObservatory();return s.observatory.timeReady&&!s.flying;});
     await p.evaluate(()=>new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(ok))));
     const bitmap=PNG.sync.read(await p.locator("#earth").screenshot());
     if(!version){reference.push(bitmap);continue;}
     const old=reference[i];assert.deepEqual([bitmap.width,bitmap.height],[old.width,old.height]);
     let different=0,large=0,total=0;
     for(let j=0;j<bitmap.data.length;j+=4){
       const dr=Math.abs(bitmap.data[j]-old.data[j]),dg=Math.abs(bitmap.data[j+1]-old.data[j+1]),db=Math.abs(bitmap.data[j+2]-old.data[j+2]);
       const delta=Math.max(dr,dg,db);if(delta)different++;if(delta>6)large++;total+=(dr+dg+db)/3;
     }
     const area=bitmap.width*bitmap.height;report.cases.push({first,second,year,lines,different,total:area,meanAbsoluteError:total/area,overSix:large});
     assert.ok(large/area<.005&&total/area<.5,"Bildvergleich "+first+" "+JSON.stringify(report.cases.at(-1)));
   }
   await p.click("#g-today");await p.waitForFunction(()=>window.geoObservatory().observatory.timeReady&&window.geoObservatory().observatory.year===0);await p.close();
 }
 assert.equal(report.cases.length,4);assert.deepEqual(report.errors,[]);assert.deepEqual(report.external,[]);report.complete=true;
}finally{await writeFile(join(out,"Zukunft-Bildvergleich.json"),JSON.stringify(report,null,2));await browser.close();}
