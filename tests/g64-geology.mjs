import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { build } from "esbuild";

const code = await build({
  entryPoints: ["src/observatory/tectonic-process.ts"],
  bundle: true,
  write: false,
  format: "esm",
});
const { geologyAt, basin, spreading, wilsonStages } = await import(
  "data:text/javascript;base64," + Buffer.from(code.outputFiles[0].contents).toString("base64")
);
const center = (k, t) => geologyAt(k, 0, 0, t);
const results = {};
for (const rate of [15, 25, 50]) {
  for (const distance of [0, 25, 75, 150]) {
    const s = spreading(distance, rate);
    assert.equal(s.age * rate, distance);
    assert.equal(s.full, rate * 2);
    assert.deepEqual(s, spreading(-distance, rate));
  }
  // Material moves rate * 1.2 Ma over the full model interval. Its recorded polarity stays fixed.
  for (let x = 0; x < 50; x += 0.5)
    assert.equal(spreading(x, rate, 0).polarity, spreading(x + 1.2 * rate, rate, 1).polarity);
}
assert.ok(center("rift", 1).top < center("rift", 0).top);
assert.ok(center("rift", 1).crust < center("rift", 0).crust);
assert.ok(center("collision", 1).crust > center("collision", 0).crust + 0.6);
assert.ok(center("collision", 1).top > center("collision", 0).top + 0.6);
for (const k of ["subduction", "arc", "oblique"]) {
  assert.ok(center(k, 0.8).top < geologyAt(k, -3, 0, 0.8).top);
  const crest = (t) =>
    Math.max(...Array.from({ length: 81 }, (_, i) => geologyAt(k, 1.4, i / 20 - 2, t).top));
  assert.ok(crest(0.9) > crest(0.1));
}
assert.equal(wilsonStages.length, 9);
assert.equal(basin(0), 0);
assert.ok(basin(0.5) > 3);
assert.equal(basin(1), 0);
for (let i = 1; i <= 1000; i++) assert.ok(Math.abs(basin(i / 1000) - basin((i - 1) / 1000)) < 0.03);
const source = JSON.parse(await readFile("public/data/g64/bathymetrie.json"));
const { createHash } = await import("node:crypto");
for (const [id, region] of Object.entries(source.regions)) {
  const bytes = await readFile("public/data/g64/bathy-" + id + ".i16");
  assert.equal(bytes.length, 193 * 145 * 2);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), region.sha256);
  const heights = new Int16Array(bytes.buffer, bytes.byteOffset, 193 * 145);
  assert.deepEqual([Math.min(...heights), Math.max(...heights)], region.rangeMetres);
  if (id === "1510") assert.ok(Math.min(...heights) < -9000);
  if (id === "2308") assert.ok(Math.max(...heights) < -1500);
  results[id] = {
    center: region.center,
    rangeMetres: region.rangeMetres,
    grid: region.grid,
    widthKm: region.widthKm,
  };
}
if (process.env.G64_OUT) {
  await mkdir(process.env.G64_OUT, { recursive: true });
  await writeFile(
    join(process.env.G64_OUT, "Geologie.json"),
    JSON.stringify(
      { regions: results, stages: wilsonStages.length, spreading: true, deformation: true },
      null,
      2,
    ),
  );
}
console.log(
  "Rift, Kollisionswurzel, Mantelkeil-Lage, Wilson-Kontinuität, Erhaltung der Magnetisierung und georeferenzierte Meerestiefen geprüft.",
);
