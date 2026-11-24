import assert from "node:assert/strict";
import {chromium} from "playwright";
import {mkdir,writeFile} from "node:fs/promises";
import {resolve,join} from "node:path";
import {pathToFileURL} from "node:url";

const dir=process.env.G521_OUT??"test-results/g521";
await mkdir(dir,{recursive:true});
const browser=await chromium.launch(process.env.G6_NATIVE_GPU?{channel:"chrome",headless:false}:{args:["--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
try{
 const p=await browser.newPage({viewport:{width:1920,height:1080},reducedMotion:"reduce"});p.setDefaultTimeout(60000);
 await p.addInitScript(()=>{window.__THREE_DEVTOOLS__=new EventTarget();window.__THREE_DEVTOOLS__.addEventListener("observe",({detail})=>{
    if(!detail.isWebGLRenderer)return;const draw=detail.render.bind(detail);
    detail.render=(s,c)=>{if(c.far===120)window.renderedSection=s;return draw(s,c);};});});
 await p.goto(pathToFileURL(resolve(process.env.G521_HTML??"artifacts/GeoRisiko-G6.1-Web-Test.html")).href);
 await p.waitForFunction(()=>window.geoObservatory?.().ready);
 const ready=()=>p.waitForFunction(()=>{const w=window.geoObservatory(),o=w.observatory;return !w.flying&&o.mode==="regional"&&o.ready&&o.viewSettled;});
 const audit=()=>p.evaluate(()=>{
   const patches=[],skins=[],slices=[-.61,-1.91,-3.29],nx=185,step=.058,x0=-5.369813;
   const volumes=slices.map(()=>Array.from({length:nx},()=>[])),newCrust=[],marine=[];window.renderedSection.traverseVisible(m=>{
     const geo=m.geometry;if(!geo?.index)return;
     const skin=m.name==="Gelände";if(!geo.attributes.geologyCoord&&!skin)return;
     const pos=geo.attributes.position,idx=geo.index.array,triangles=[],edges=[];
     const hits=slices.map(()=>Array.from({length:nx},()=>[]));
     if(m.name==="Neu gebildete ozeanische Kruste")newCrust.push(pos);
     for(let i=0;i<idx.length;i+=3){
       const ids=[idx[i],idx[i+1],idx[i+2]],front=ids.filter(k=>Math.abs(pos.getZ(k))<.000002);
       if(front.length===3&&!skin){const pts=front.map(k=>[pos.getX(k),pos.getY(k)]);triangles.push(pts);}
       // Intersect a surface triangle with a fixed plane, including the advected Parkfield DEM.
       const segment=z=>{const points=[];for(let n=0;n<3;n++){const a=ids[n],b=ids[(n+1)%3],za=pos.getZ(a),zb=pos.getZ(b);
         if(za===z)points.push([pos.getX(a),pos.getY(a)]);
         if((za<z&&zb>z)||(za>z&&zb<z)){const u=(z-za)/(zb-za);points.push([pos.getX(a)+(pos.getX(b)-pos.getX(a))*u,pos.getY(a)+(pos.getY(b)-pos.getY(a))*u]);}}
         return points;};
       if(skin){const pair=segment(0);if(pair.length===2)edges.push(pair);continue;}
       const zMin=Math.min(...ids.map(k=>pos.getZ(k))),zMax=Math.max(...ids.map(k=>pos.getZ(k)));
       slices.forEach((z,l)=>{if(z<zMin||z>zMax)return;const pair=segment(z);if(pair.length!==2)return;
         const [a,b]=pair.sort((a,b)=>a[0]-b[0]);if(b[0]-a[0]<1e-8)return;
         for(let j=Math.max(0,Math.floor((a[0]-x0)/step));j<nx&&x0+j*step<b[0];j++)
           if(x0+j*step>=a[0])hits[l][j].push(a[1]+(b[1]-a[1])*(x0+j*step-a[0])/(b[0]-a[0]));});
     }
     if(!skin)hits.forEach((columns,l)=>columns.forEach((ys,j)=>{
       ys.sort((a,b)=>a-b);for(let n=1;n<ys.length;n+=2)if(ys[n]-ys[n-1]>1e-6)volumes[l][j].push([ys[n-1],ys[n]]);
     }));
     if(skin&&geo.attributes.position&&window.geoObservatory().observatory.physics?.waterEvent){
       const w=window.geoObservatory().observatory.physics.waterProfile;
       if(w)for(let j=0;j<pos.count;j++)if(Math.abs(pos.getZ(j))<.000001){const i=Math.round((pos.getX(j)+6)/.1);marine.push(Math.abs(pos.getY(j)-w[i].bed));}
     }
     if(triangles.length)patches.push(triangles);if(edges.length)skins.push(...edges);
   });
   const cross=(a,b,x)=>x>=Math.min(a[0],b[0])&&x<Math.max(a[0],b[0])?a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]):null;
   const rows=[];
   for(let j=0;j<185;j++){const x=-5.37+j*.058,intervals=[];
     for(const mesh of patches){const spans=[];for(const [a,b,c] of mesh){
       const ys=[cross(a,b,x),cross(b,c,x),cross(c,a,x)].filter(v=>v!==null);if(ys.length===2)spans.push([Math.min(...ys),Math.max(...ys)]);
     }
     spans.sort((a,b)=>a[0]-b[0]);const merged=[];for(const v of spans){const last=merged.at(-1);if(last&&v[0]<=last[1]+1e-6)last[1]=Math.max(last[1],v[1]);else merged.push(v);}
     intervals.push(...merged);}
     intervals.sort((a,b)=>a[0]-b[0]);const breaks=[];let top=-Infinity,overlap=0;
     for(const [a,b] of intervals){if(Number.isFinite(top)&&a>top+1e-6)breaks.push([top,a]);overlap+=Math.max(0,Math.min(b,top)-a);top=Math.max(top,b);}
     const ground=skins.map(([a,b])=>cross(a,b,x)).filter(v=>v!==null);
     rows.push({x,top,gap:Math.max(0,...breaks.map(([a,b])=>b-a)),deep:Math.max(0,...breaks.filter(([,b])=>b< -1).map(([a,b])=>b-a)),overlap,skin:ground.length?Math.abs(Math.max(...ground)-top):null});
   }
   const max=k=>rows.reduce((a,b)=>(b[k]??0)>(a[k]??0)?b:a)[k]??0;
   let worstInterior={},sampledVolume=0,voidVolume=0,overlapVolume=0,maxVoid=0,maxDeepVoid=0;const dz=4.5/slices.length;
   for(const [s,layer] of volumes.entries())for(const [j,spans] of layer.entries()){spans.sort((a,b)=>a[0]-b[0]);let top;
     for(const [a,b] of spans){if(top!==undefined){const gap=Math.max(0,a-top);if(gap>maxVoid){maxVoid=gap;worstInterior={x:x0+j*step,z:slices[s],low:top,high:a,spans};}if(a< -1)maxDeepVoid=Math.max(maxDeepVoid,gap);voidVolume+=gap*step*dz;overlapVolume+=Math.max(0,Math.min(b,top)-a)*step*dz;}top=Math.max(top??-Infinity,b);}
     if(spans.length)sampledVolume+=(top-spans[0][0])*step*dz;}
   let basaltWidth=0;for(const pos of newCrust)for(let k=0;k<pos.count;k++)basaltWidth=Math.max(basaltWidth,2*Math.abs(pos.getX(k)));
   return {worstInterior,sampledVolume,voidVolume,overlapVolume,maxVoid,maxDeepVoid,basaltWidth,bedMismatch:marine.length?Math.max(...marine):null,meshCount:patches.length,columns:rows.length,gap:max("gap"),deep:max("deep"),overlap:max("overlap"),skin:max("skin"),empty:rows.filter(v=>!Number.isFinite(v.top)).length,worst:rows.sort((a,b)=>b.gap-a.gap).slice(0,2)};
 });
 const results=[];
 for(const site of (process.env.G521_SITES??"rift,ridge,japan,himalaya,san,island").split(",")){
  if(site==="ridge"){await p.click("#nav-plates");await p.click("#g-boundaries");await p.selectOption("#g-example",{label:"Ozeanischer Rücken"});await p.waitForFunction(()=>!window.geoObservatory().flying);
    const b=await p.locator("#earth").boundingBox();await p.mouse.click(b.x+b.width/2,b.y+b.height/2);await p.click("#g-segment");}
  else{await p.click("#nav-earthquake");await p.selectOption("#g-launch",site);}
  await ready();await p.selectOption("#g-view","cut");await ready();
  for(const t of (process.env.G521_PHASES??"0,.3,.49,.74,1").split(",").map(Number)){
    await p.locator("#g-progress").fill(String(t));await p.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
    const q=await audit();results.push({site,t,...q});
    if(["rift","ridge"].includes(site)||t===.74)await p.screenshot({path:join(dir,site+"-"+t+".jpg"),type:"jpeg",quality:82});
  }
  console.log(site,results.filter(x=>x.site===site).map(({t,gap,deep,overlap,skin})=>[t,gap,deep,overlap,skin].map(x=>+x.toFixed(4))));
 }
 await writeFile(join(dir,"Kontakte.json"),JSON.stringify(results,null,2));
 if(!process.env.G521_CHARACTERIZE)for(const row of results){if(row.site==="ridge"&&row.t>0)assert.ok(row.basaltWidth>row.t,"Basalt an der Achse");assert.ok(row.maxDeepVoid<.05,JSON.stringify(row));assert.ok(row.sampledVolume>20&&row.voidVolume/row.sampledVolume<.003&&row.overlapVolume/row.sampledVolume<.003,JSON.stringify(row));if(row.site==="japan")assert.ok(row.bedMismatch!==null&&row.bedMismatch<.00001);assert.ok(row.meshCount>=4&&row.empty===0);assert.ok(row.deep<.025&&row.gap<.045&&row.overlap<.05&&row.skin<.085,JSON.stringify(row));}
}finally{await browser.close();}
