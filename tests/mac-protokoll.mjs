import assert from "node:assert/strict";
import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import protocol from "../desktop/protocol.cjs";

const root=await mkdtemp(join(tmpdir(),"GeoRisiko-Ressourcen-"));
try {
  await writeFile(join(root,"Erdschale außen.txt"),"Feste Gesteinskruste");
  const handle=await protocol.assetHandler(root);
  const path=protocol.origin+"/"+encodeURIComponent("Erdschale außen.txt");
  const valid=await handle(new Request(path));
  assert.equal(valid.status,200);
  assert.equal(await valid.text(),"Feste Gesteinskruste");
  assert.match(valid.headers.get("Content-Security-Policy"),/script-src 'self'/);
  assert.equal((await handle(new Request(path,{method:"POST"}))).status,405);
  for(const url of [protocol.origin+"/fehlt",path.replace("modell","fremd"),path.replace("georisiko:","file:")])
    assert.equal((await handle(new Request(url))).status,404);
} finally {await rm(root,{recursive:true,force:true});}
