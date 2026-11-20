import {strict as assert} from "node:assert";
import {createHash} from "node:crypto";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {createServer} from "vite";
import {Color,Vector3} from "three";

const original=await readFile("tests/fixtures/PB2002_poles.dat.txt");
assert.equal(createHash("sha256").update(original).digest("hex"),"887d208bda44cea75ee0c778c1883476906757a3d8035608a6cff7b79cf40f2e");
const poles=Object.fromEntries(original.toString().trim().split(/\r?\n/).map(row=>{
  const [code,...rest]=row.trim().split(/\s+/);return [code,rest.slice(0,3).map(Number)];
}));
const server=await createServer({server:{middlewareMode:true},logLevel:"error"});
const read=name=>readFile("src/tectonics/"+name+".json","utf8").then(JSON.parse);
try {
  const [{BoundaryComparison},{basis,R,RAD},{center},data,examples,steps]=await Promise.all([
    server.ssrLoadModule("/src/tectonics/comparison.ts"),server.ssrLoadModule("/src/geo.ts"),
    server.ssrLoadModule("/src/tectonics/atlas.ts"),read("mosaic"),read("examples"),read("steps")
  ]);
  assert.deepEqual(Object.keys(poles).sort(),Object.keys(examples).sort());
  assert.deepEqual(Object.keys(poles).sort(),Object.keys(data).sort());
  const report={phases:32,polesSHA256:createHash("sha256").update(original).digest("hex"),plates:{},pairs:{}};
  for(const [code,example] of Object.entries(examples)){
    assert.deepEqual(data[code].pole,poles[code]);
    const step=steps[example.step-1],codes=[step[1].slice(0,2),step[1].slice(-2)];
    assert.ok(codes.includes(code));
    report.plates[code]={step:example.step,where:example.where,peer:codes.find(c=>c!==code),pole:poles[code]};
    if(report.pairs[step[0]])continue;
    const loc=center(step),{up,east,north}=basis(loc.lat,loc.lon);
    const omega=c=>basis(...poles[c].slice(0,2)).up.multiplyScalar(poles[c][2]*RAD);
    const velocity=omega(codes[0]).sub(omega(codes[1])).cross(up).multiplyScalar(R);
    const bearing=(360+Math.atan2(velocity.dot(east),velocity.dot(north))/RAD)%360;
    const bearingError=Math.abs((bearing-step[8]+540)%360-180);
    assert.ok(bearingError<2 && Math.abs(velocity.length()-step[7])<.4,code+" relative Geschwindigkeit "+bearingError);
    const pair=new BoundaryComparison(step,codes.map(c=>poles[c]),[new Color("tan"),new Color("grey")]);
    const separationAxis=basis(step[6],step[5]).up.sub(basis(step[4],step[3]).up).cross(up).normalize();
    const originals=pair.bodies.map(b=>Buffer.from(b.geometry.attributes.position.array.buffer).toString("base64"));
    const probes=pair.bodies.map(b=>[0,17,44,310,489,816].map(i=>b.getVertexPosition(i,new Vector3())));
    let maxError=0,minGap=Infinity,minDeterminant=Infinity,endSeparationChange=0,orthogonalityError=0;
    const relativeAxis=omega(codes[0]).sub(omega(codes[1])).normalize();
    const levers=pair.bodies.map(b=>{
      assert.deepEqual(Object.keys(b.geometry.morphAttributes),[]);
      const attr=b.geometry.attributes.position;let maximum=0;
      for(let i=0;i<attr.count;i++)maximum=Math.max(maximum,b.getVertexPosition(i,new Vector3()).cross(relativeAxis).length());
      return maximum;
    });
    let prior;
    for(let i=0;i<=report.phases;i++){
      pair.setTime(i/report.phases);
      const limits=[],moving=[];
      for(const [side,b] of pair.bodies.entries()){
        const transformed=probes[side].map(p=>b.localToWorld(p.clone()));
        for(let a=0;a<transformed.length;a++)for(let j=0;j<a;j++)
          maxError=Math.max(maxError,Math.abs(transformed[a].distanceTo(transformed[j])-probes[side][a].distanceTo(probes[side][j])));
        const basisVectors=[0,1,2].map(i=>new Vector3().setFromMatrixColumn(b.matrixWorld,i));
        for(let a=0;a<3;a++)for(let k=0;k<3;k++)
          orthogonalityError=Math.max(orthogonalityError,Math.abs(basisVectors[a].dot(basisVectors[k])-(a===k?1:0)));
        minDeterminant=Math.min(minDeterminant,b.matrixWorld.determinant());
        const attr=b.geometry.attributes.position,point=new Vector3();let extreme=side?Infinity:-Infinity;
        for(let k=0;k<attr.count;k++){
          const x=b.localToWorld(point.fromBufferAttribute(attr,k)).dot(separationAxis);
          extreme=side?Math.min(extreme,x):Math.max(extreme,x);
        }
        limits.push(extreme);moving.push(transformed[2]);
      }
      minGap=Math.min(minGap,limits[1]-limits[0]);
      const rel=moving[0].clone().sub(moving[1]);
      if(i===0)prior=rel;
      if(i===report.phases)endSeparationChange=rel.distanceTo(prior);
    }
    // Between neighbouring samples, bound both support planes by the maximum arc speed.
    const angle=2*Math.acos(Math.min(1,pair.bodies[0].quaternion.w));
    const continuousGap=minGap-(levers[0]+levers[1])*angle/(2*report.phases);
    assert.ok(continuousGap>0 && orthogonalityError<1e-12,code+" kontinuierliche Trennung oder Orthogonalität");
    assert.ok(maxError<1e-8 && minDeterminant>1-1e-12 && minGap>0 && endSeparationChange>1,code+" Starrheit oder Trennebene");
    pair.setTime(0);
    for(const [i,b] of pair.bodies.entries()){
      assert.ok(b.quaternion.x===0 && b.quaternion.y===0 && b.quaternion.z===0 && b.quaternion.w===1);
      assert.equal(Buffer.from(b.geometry.attributes.position.array.buffer).toString("base64"),originals[i]);
    }
    report.pairs[step[0]]={codes,bearing,sourceBearing:step[8],speed:velocity.length(),sourceSpeed:step[7],bearingError,maxError,minGap,continuousGap,orthogonalityError,minDeterminant,endSeparationChange};
    pair.dispose();
  }
  await mkdir("test-results/plattenatlas",{recursive:true});
  await writeFile("test-results/plattenatlas/geometrie.json",JSON.stringify(report,null,2)+"\n");
  console.log(Object.keys(report.plates).length,"Platten,",Object.keys(report.pairs).length,"Vergleiche ohne Durchdringung.");
} finally {await server.close();}
