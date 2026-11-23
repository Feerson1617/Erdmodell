import assert from "node:assert/strict";
import {writeFile,mkdir} from "node:fs/promises";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {chromium,webkit} from "playwright";
import {hz,processTicks} from "./prozesszeit.mjs";
const results=[];
for(const engine of [chromium,webkit]){
  if(process.env.TEST_ENGINES && !process.env.TEST_ENGINES.includes(engine.name()))continue;
  for(const version of engine===chromium?["G4.3","G4.3.1"]:["G4.3.1","G4.3"]){
    const server=await engine.launchServer({executablePath:engine===webkit?process.env.WEBKIT_PATH:undefined,
      args:engine===chromium?["--use-angle=swiftshader","--enable-unsafe-swiftshader"]:[]});
    const b=await engine.connect(server.wsEndpoint());
    try{
      const p=await b.newPage({viewport:{width:1120,height:730},reducedMotion:"reduce"});
      const file=resolve(version==="G4.3"?"ausgabe":"artifacts","GeoRisiko-Erdmodell-"+version+".html");
      await p.goto(pathToFileURL(file).href);await p.waitForFunction(()=>window.geoObservatory?.().ready);
      await p.click("#nav-plates");await p.waitForFunction(()=>window.geoObservatory().tectonics.ready);
      const renderer=await p.evaluate(()=>{const gl=document.querySelector("canvas").getContext("webgl2");
        const ext=gl.getExtension("WEBGL_debug_renderer_info");return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);});
      const row={engine:engine.name(),version,renderer,stages:[]};
      for(const stage of ["Atlas","Bewegung","Wechsel","Steckbriefe"]){
        if(stage==="Bewegung"){
          await p.click("#atlasPlay");await p.waitForFunction(()=>window.geoObservatory().tectonics.mosaic.progress>.02);
        }
        if(stage==="Wechsel"){
          await p.click("#atlasReset");await p.click("#home");await p.click("#nav-plates");
        }
        if(stage==="Steckbriefe"){
          await p.click("#home");await p.click("#nav-plates");await p.click("#plateSettings summary");
          await p.waitForFunction(()=>document.querySelector("#plateSelect")?.options.length===53);
        }
        const pid=server.process().pid,start=await processTicks(pid),from=performance.now();
        const measure=await p.evaluate(async stage=>{
          const states=[],gaps=[];let prev;
          const button=id=>document.getElementById(id)?.click();
          const snapshot=()=>{const s=window.geoObservatory();return {geometries:s.geometries,textures:s.textures,
            programs:s.programs,draws:s.draws,triangles:s.triangles,ratio:s.pixelRatio,width:s.resolution.width,height:s.resolution.height};};
          const sequence=["nav-inside","nav-plates","atlasPlay","atlasReset","home","nav-plates"];
          for(let i=0;i<=48;i++){
            const now=await new Promise(requestAnimationFrame);
            if(prev!==undefined)gaps.push(now-prev);prev=now;
            if(stage==="Wechsel" && i<48 && i%2===0)button(sequence[(i/2)%sequence.length]);
            if(stage==="Steckbriefe" && i<48){
              if(i%4===0){
                const select=document.getElementById("plateSelect");
                select.value=["NA","FT","PA","GP"][(i/4)%4];select.dispatchEvent(new Event("change"));
              }else if(i%4===2)button("atlasAll");
            }
            if(i%12===0)states.push(snapshot());
          }
          return {gaps,states};
        },stage);
        const after=await processTicks(pid),elapsed=performance.now()-from;
        const ticks=[...after].reduce((sum,[id,t])=>sum+Math.max(0,t-(start.get(id)??t)),0);
        const gaps=[...measure.gaps].sort((a,b)=>a-b);assert.ok(gaps.length===48 && gaps[47]>0);
        row.stages.push({stage,fps:1000*gaps.length/gaps.reduce((a,b)=>a+b,0),p95:gaps[Math.floor(.95*gaps.length)],
          max:gaps.at(-1),over150:gaps.filter(x=>x>150).length,cpuPercent:ticks/hz/elapsed*100000,...measure});
      }
      results.push(row);console.log(engine.name(),version,row.stages.map(s=>s.fps.toFixed(1)).join(" / "));
    }finally{await b.close();await server.close();}
  }
}
await mkdir("test-results/plattenatlas",{recursive:true});
await writeFile("test-results/plattenatlas/leistungsvergleich.json",JSON.stringify(results,null,2)+"\n");
