import {build} from "esbuild";
import assert from "node:assert/strict";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {join} from "node:path";

const built=await build({stdin:{resolveDir:process.cwd(),contents:`
 export * from "./src/observatory/boundaries";export * from "./src/tectonics/learning";
 export {poleVector,relativeVelocity} from "./src/tectonics/comparison";
 export {position} from "./src/geo";export {Quaternion} from "three";
 export {regionalReading} from "./src/observatory/lesson";export {Fault} from "./src/observatory/fault";export {WaterSection} from "./src/observatory/water";
`},bundle:true,platform:"node",format:"esm",write:false,loader:{".png":"empty"}});
const {geology,boundaryLesson,poleVector,relativeVelocity,position,Quaternion,regionalReading,Fault,WaterSection}=await import("data:text/javascript;base64,"+Buffer.from(built.outputFiles[0].contents).toString("base64"));
const load=async n=>JSON.parse(await readFile("src/tectonics/"+n+".json","utf8"));
const [steps,mosaic]=await Promise.all([load("steps"),load("mosaic")]);let oblique=0,subduction=0,uncertain=0;
for(const step of steps){
 const g=geology(step),a=boundaryLesson(step),w=poleVector(mosaic[g.left].pole).sub(poleVector(mosaic[g.right].pole)).normalize();
 const at=position(g.lat,g.lon);
 for(const side of [0,1]){
   const v=relativeVelocity(w,at,side),q=new Quaternion().setFromAxisAngle(w,(side?-1:1)*1e-6);
   assert.ok(v.dot(at.clone().applyQuaternion(q).sub(at).normalize())>.999999);
 }
 if(g.descending){subduction++;assert.ok(a.polarity.includes("taucht ab"));}
 if(g.oblique){oblique++;assert.match(a.motion,/schräg/);assert.match(a.limit,/Überschiebung/);}
 if(!g.localQuake){uncertain++;assert.match(a.limit,/unbekannt/);}
}
assert.equal(steps.length,5819);assert.equal(oblique,435);assert.equal(subduction,1127);
const phases=[];const spec={site:"san",theme:"earthquake",process:"transform"},fault=new Fault(spec,()=>0);
const row={spec,faultModel:fault,view:"waves",epicenter:[fault.hx,0,0],progress:0};
for(const t of [0,.05,.3,.361,.42,.5,.71,.83,1,0]){
 row.progress=t;row.stress=false;const plain=regionalReading(row);row.stress=true;assert.deepEqual(regionalReading(row),plain);
 phases.push([t,plain[1]]);if(t===0)assert.equal(plain[1],"Ausgangszustand");if(t===.05)assert.match(plain[1],/Verhakung/);
}
for(const event of ["strike","buried"]){row.spec={...spec,event};for(const t of [0,.48,1]){row.progress=t;const name=regionalReading(row)[1];assert.equal(name,t===0?"Vor dem Bruch":t===1?"Nach dem Bruch":event==="strike"?"Seitlicher Versatz am Meeresboden":"Bruch in der Tiefe");}}
const waterSpec={site:"japan",theme:"earthquake",process:"subduction",event:"uplift",coastLesson:true};
const waterFault=new Fault(waterSpec,x=>-1+.09*x),water=new WaterSection(waterFault);
const waterPhases=[];for(let i=0;i<=240;i++){const progress=i/240;const signals=water.signals(progress),phase=regionalReading({...row,spec:waterSpec,water,faultModel:waterFault,view:"ocean",progress})[1];
 if(signals.surface<.00001&&signals.bed<.00001)assert.equal(phase,"Wasser im Ruhezustand");
 if(!waterPhases.includes(phase))waterPhases.push(phase);}
assert.ok(waterPhases.length>1);
const quiet=regionalReading({...row,spec:{site:"island",process:"ridge",theme:"volcano"},localActive:true,eruption:"explosive",progress:.8});assert.equal(quiet[1],"Ruhendes Lavafeld");
const log={steps:steps.length,subduction,oblique,uncertain,phases,waterPhases};
const out=process.env.G63_OUT||"test-results/g63";await mkdir(out,{recursive:true});await writeFile(join(out,"Fachtests.json"),JSON.stringify(log,null,2));console.log(log);
