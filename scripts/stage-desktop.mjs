import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
const manifest = JSON.parse(await readFile("package.json","utf8"));
await mkdir(".scratch", {recursive:true});
const stage = await mkdtemp(".scratch/desktop-");
await cp("dist",stage+"/dist",{recursive:true});
await mkdir(stage+"/desktop");
for (const file of ["main.cjs","protocol.cjs","preload.cjs"])
  await cp("desktop/"+file,stage+"/desktop/"+file);
const {name,version,description,author,main} = manifest;
await writeFile(stage+"/package.json",JSON.stringify({name,version,description,author,main}));
await writeFile(".scratch/desktop-stage.txt",stage);
