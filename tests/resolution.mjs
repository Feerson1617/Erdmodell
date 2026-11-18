import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const src = await readFile(new URL("../src/resolution.ts", import.meta.url), "utf8");
const js = ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { RenderResolution } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
for (const device of [0.7, 1, 1.25, 2]) {
  const r = new RenderResolution(device);
  const tick = (fps, n) => { for (let i = 0; i < n; i++) r.sample(fps, 1); };
  tick(15, 1); tick(32, 1);
  assert.equal(r.ratio, Math.min(1.5, device));
  tick(16, 80);
  assert.equal(r.ratio, r.minimum);
  tick(32, 12); tick(55, 7);
  assert.equal(r.ratio, r.minimum);
  tick(55, 1);
  assert.equal(r.ratio, Math.min(r.minimum + 0.1, r.maximum));
  tick(55, 200);
  assert.equal(r.ratio, r.maximum);
}
console.log("Kontrollierte Bildratenfolge: Absenkung, Haltezeiten, Wiederanhebung und Gerätegrenzen bestanden.");
