import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {build} from "esbuild";
const moduleFor=async name=>{
  const b=await build({entryPoints:["src/observatory/"+name+".ts"],bundle:true,format:"esm",write:false});
  return import("data:text/javascript;base64,"+Buffer.from(b.outputFiles[0].contents).toString("base64"));
};
const {wilsonMotion,margin,basin,geologyAt,processes}=await moduleFor("tectonic-process");
const {places,referenceFor,wilsonPlaces}=await moduleFor("process-places");
for(let i=1;i<999;i++){
  const t=i/1000,m=wilsonMotion(t),delta=margin(t+.002)-margin(t-.002);
  assert.equal(m.outward,Math.abs(delta)<1e-9?0:Math.sign(delta));
  if(t>.62&&t<.73){assert.ok(basin(t+.001)<basin(t));assert.ok(m.spreadingRidge&&m.subduction);assert.match(m.reading,/schrumpft/);}
}
assert.deepEqual(Object.keys(referenceFor).sort(),Object.keys(processes).sort());
const steps=JSON.parse(await readFile("src/tectonics/steps.json"));
for(const [key,category,pair] of [["tonga","SUB","TO/PA"],["peru","SUB","NZ\\SA"],["sumatra","SUB","SU/AU"],["romanche","OTF","AF-SA"],["zagros","CCB","AR-EU"]]){
  const p=places[key],s=steps[p.step-1];assert.equal(s[2],category);assert.equal(s[1],pair);assert.ok(Math.abs(p.lat-(s[4]+s[6])/2)<.01);assert.ok(Math.abs(p.lon-(s[3]+s[5])/2)<.01);
}
assert.equal(wilsonPlaces.length,9);assert.ok(wilsonPlaces.every(id=>places[id]));
const series=[0,.25,.5,.75,1].map(t=>geologyAt("hotspot",-1.55+(2+t)*1.05,0,t).top);assert.ok(series.every(Number.isFinite));
const stations=JSON.parse(await readFile("src/observatory/gnss.json"));assert.equal(stations.length,33);assert.equal(new Set(stations.map(s=>s.id)).size,33);
for(const [id,e,n] of [["REYK",-10.03,19.76],["HOFN",13.94,14.94],["KOKB",-62.29,34.54]]){const row=stations.find(s=>s.id===id);assert.deepEqual([row.east,row.north],[e,n]);}
const ice=JSON.parse(await readFile("public/data/g5/evidence.json")).filter(f=>f.kind==="ice");
assert.equal(ice.length,3);assert.ok(ice.every(s=>s.coords.length===51));assert.deepEqual(ice.map(s=>s.coords[0]),[[-24.2,-50.1],[-32.8,20.7],[20.9,85.2]]);
console.log("Wilson-Bewegung, ältere Hotspotbauten, alle Raumreferenzen, fünf PB2002-Originalsegmente, GNSS und rekonstruierte Vereisungsregionen geprüft.");
