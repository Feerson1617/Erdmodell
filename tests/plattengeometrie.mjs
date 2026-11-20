import assert from "node:assert/strict";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {Vector3} from "three";

const data=JSON.parse(await readFile("src/tectonics/mosaic.json","utf8"));
const steps=JSON.parse(await readFile("src/tectonics/steps.json","utf8"));
const rad=Math.PI/180;
const unit=(lat,lon)=>new Vector3(Math.cos(lat*rad)*Math.sin(lon*rad),Math.sin(lat*rad),Math.cos(lat*rad)*Math.cos(lon*rad));
const report={triangles:0,phases:32,plates:{},boundaries:{}};
const cross=new Vector3(),other=new Vector3();
function orientation(a,b,c) {
  return a.dot(cross.subVectors(b,a).cross(other.subVectors(c,a)));
}
for(const [code,plate] of Object.entries(data)){
  const [lat,lon,rate]=plate.pole,axis=unit(lat,lon);
  const original=plate.weights.map((_,i)=>unit(plate.vertices[i*3+1]/1e5,plate.vertices[i*3]/1e5));
  const before=[];
  for(let i=0;i<plate.triangles.length;i+=3){
    const [a,b,c]=plate.triangles.slice(i,i+3);
    before.push(orientation(original[a],original[b],original[c]));
  }
  assert.ok(before.every(area=>area>1e-15),code+" Orientierung der Ausgangsfläche");
  let minimumAreaRatio=1;
  for(const i of plate.rim)assert.equal(plate.weights[i],0,code+" gemeinsamer Saum");
  for(let phase=1;phase<=report.phases;phase++){
    const turned=original.map((p,i)=>p.clone().applyAxisAngle(axis,rate*rad*2*phase/report.phases*plate.weights[i]/65535));
    for(let t=0;t<before.length;t++){
      if(Math.abs(before[t])<1e-15)continue;
      const j=t*3;
      const after=orientation(turned[plate.triangles[j]],turned[plate.triangles[j+1]],turned[plate.triangles[j+2]]);
      minimumAreaRatio=Math.min(minimumAreaRatio,after/before[t]);
    }
  }
  assert.ok(minimumAreaRatio>=.10,code+" umgeklappte oder kollabierte Fläche");
  report.triangles+=before.length;
  report.plates[code]={triangles:before.length,minimumAreaRatio};
}
function spin(code) {
  const [lat,lon,rate]=data[code].pole;
  return unit(lat,lon).multiplyScalar(rate*rad);
}
for(const id of [4209,2629,2877,5502]){
  const [,pair,,lon,lat,,,speed,direction]=steps[id-1];
  const up=unit(lat,lon),east=unit(0,lon+90),north=up.clone().cross(east);
  const relative=spin(pair.slice(0,2)).sub(spin(pair.slice(-2))).cross(up).multiplyScalar(6371);
  const azimuth=(Math.atan2(relative.dot(east),relative.dot(north))/rad+360)%360;
  assert.ok(Math.abs(azimuth-direction)<1.5 && Math.abs(relative.length()-speed)<.25);
  report.boundaries[id]={pair,azimuth,sourceAzimuth:direction,mmPerYear:relative.length(),sourceMmPerYear:speed};
}
await mkdir("test-results/plattenatlas",{recursive:true});
await writeFile("test-results/plattenatlas/geometrie.json",JSON.stringify(report,null,2)+"\n");
console.log(report.triangles+" Dreiecke, "+report.phases+" Phasen und vier relative Grenzvektoren geprüft.");
