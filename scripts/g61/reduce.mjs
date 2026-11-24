import {MeshoptSimplifier} from 'meshoptimizer';
import {readFileSync,writeFileSync} from 'node:fs';
const [dir,ratio]=process.argv.slice(2);
const read=(name,Type)=>new Type(Uint8Array.from(readFileSync(dir+'/'+name)).buffer);
await MeshoptSimplifier.ready;
const pos=read('pos',Float32Array),indices=read('idx',Uint32Array);
const [reduced]=MeshoptSimplifier.simplify(indices,pos,3,Math.floor(indices.length*Number(ratio)/3)*3,.12);
writeFileSync(dir+'/result',new Uint8Array(reduced.buffer,reduced.byteOffset,reduced.byteLength));
