// Re-run the shipped finite-volume scheme independently of WebGL and of its cached frames.
import assert from "node:assert/strict";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {resolve,join} from "node:path";
import {build} from "esbuild";
const dir=process.env.G521_OUT??"test-results/mac/G521";
await mkdir(dir,{recursive:true});
const code=await build({entryPoints:["src/observatory/water.ts"],bundle:true,format:"esm",platform:"node",write:false});
const {WaterSection}=await import("data:text/javascript;base64,"+Buffer.from(code.outputFiles[0].contents).toString("base64"));
const observations=JSON.parse(await readFile(process.argv[2]??"test-results/mac/G52/Unterricht-App.json"));
const results={};
const interpolate=(xs,x)=>{const col=Math.max(0,Math.min(120,(x+6)*10)),i=Math.min(119,Math.floor(col));return xs[i]+(xs[i+1]-xs[i])*(col-i);};
const examples=Object.entries(observations.profiles).map(([label,v])=>{
 const floor=v.start.map(q=>q.bed),lift=v.end.map((q,i)=>q.bed-floor[i]);
 return [label,{hx:v.focus[0],hy:v.focus[1],height:x=>interpolate(floor,x),uplift:x=>interpolate(lift,x)}];});
for(const forced of [false,true])examples.push([forced?"Flacher Schelf":"Ruhender Hang",{hx:1,hy:-.6,height:x=>-.50-.08*x,uplift:x=>forced?.06*Math.exp(-((x-1)**2)):0}]);
for(const [name,input] of examples){
 const stats=[],solutions=[];
 for(const cells of [121,241,481]){
   const w=new WaterSection(input,cells),depthMin=w.depths.reduce((a,b)=>Math.min(a,b),Infinity);
   assert.ok(depthMin>=0&&w.surfaces.every(Number.isFinite));assert.ok(Math.abs(w.budget.residual)<1e-8,JSON.stringify(w.budget));
   let most=0,range=0;for(let j=0;j<w.frames;j++){const t=j/(w.frames-1);most=Math.max(most,w.extent(t).newlyWet);
     for(let i=0;i<cells;i++)if(w.depths[i]>.001)range=Math.max(range,Math.abs(w.surfaces[j*cells+i]-w.surfaces[i]));}
   const gauge=Array.from({length:w.frames},(_,j)=>w.sample(2.4,j/(w.frames-1))-w.sample(2.4,0));
   const max=gauge.reduce((a,v,i)=>Math.abs(v)>Math.abs(gauge[a])?i:a,0);
   if(name==="Ruhender Hang")assert.ok(range<1e-7);
   else assert.ok(range>1e-4);
   if(name==="Japan")assert.equal(most,0);
   if(name==="Kueste"&&cells===121){assert.equal(most,3);assert.equal(w.extent(1).newlyWet,1);}
   stats.push({cells,dx:w.dx,depthMin,budget:w.budget,most,final:w.extent(1).newlyWet,maxSignal:range,gaugePeak:gauge[max],gaugeTime:max/(w.frames-1)});solutions.push(w);
 }
 const difference=(a,b)=>{let sum=0,n=0;for(let j=0;j<241;j+=4)for(let i=0;i<121;i++){const x=-6+i*.1,t=j/240;if(a.sample(x,0,true)>.001){sum+=(a.sample(x,t)-b.sample(x,t))**2;n++;}}return Math.sqrt(sum/n);};
 const rms=solutions.slice(1).map((s,i)=>difference(s,solutions[i]));
 assert.ok(rms[1]<=rms[0]*1.25+1e-7,name+" "+rms);
 results[name]={stats,rms};
}
await writeFile(join(dir,"Wasserbilanz.json"),JSON.stringify(results,null,2));
console.log(Object.entries(results).map(([name,v])=>[name,v.rms,v.stats.map(s=>s.most)]));
