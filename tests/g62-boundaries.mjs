import {build} from "esbuild";
import assert from "node:assert/strict";
import {writeFile,mkdir,readFile} from "node:fs/promises";
import {resolve,join} from "node:path";
const bundled=await build({stdin:{contents:'export {boundaryLesson} from "./src/tectonics/learning";export {names} from "./src/tectonics/atlas";export {geology} from "./src/observatory/boundaries";',resolveDir:process.cwd()},loader:{".png":"empty"},format:"esm",platform:"node",bundle:true,write:false});
const {boundaryLesson,names,geology}=await import("data:text/javascript;base64,"+Buffer.from(bundled.outputFiles[0].contents).toString("base64"));
const steps=JSON.parse(await readFile("src/tectonics/steps.json","utf8")),examples=JSON.parse(await readFile("src/tectonics/examples.json","utf8")),types={},polarities={};
for(const s of steps){
 const a=boundaryLesson(s),g=geology(s),left=s[1].slice(0,2),right=s[1].slice(-2);
 assert.deepEqual(a.plates,[names[left],names[right]]);assert.ok(a.plates.every(Boolean));
 for(const key of ["term","motion","cause","effects","detail","limit","place","watch"])assert.ok(a[key].trim().length>0&& !a[key].includes("undefined"));
 if(s[2]==="SUB"){const down=s[1][2]==="/"?right:left;assert.ok(a.polarity.includes(names[down]+" taucht ab"));assert.equal(g.descending,down);polarities[s[1][2]]=(polarities[s[1][2]]??0)+1;}else assert.equal(a.polarity,"");
 types[g.model]=(types[g.model]??0)+1;
}
const summary={steps:steps.length,plates:Object.keys(names).length,pairs:new Set(Object.values(examples).map(e=>e.step)).size,sub:Object.values(polarities).reduce((a,b)=>a+b,0),polarities,types};
assert.equal(summary.steps,5819);assert.equal(summary.plates,52);assert.equal(summary.pairs,48);assert.equal(summary.sub,1127);assert.equal(Object.keys(types).length,9);
const out=resolve(process.env.G62_OUT||"test-results/g62");await mkdir(out,{recursive:true});await writeFile(join(out,"Grenzerklaerungen.json"),JSON.stringify(summary,null,2));console.log(summary);
