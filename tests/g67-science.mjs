import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  bursts,
  excavation,
  surfaceHeight,
  lakeDimensions,
} from "../src/seismology/maar-profile.ts";

assert.equal(excavation(0.3), 0);
assert.equal(excavation(1), 1);
let previous = 0;
for (let i = 0; i <= 1000; i++) {
  const progress = excavation(i / 1000);
  assert.ok(progress >= previous && progress <= 1);
  previous = progress;
}
for (const onset of bursts)
  assert.ok(excavation(onset + 0.04) > excavation(onset));
const difference = (x, z) => surfaceHeight(x, z, 1) - surfaceHeight(x, z, 0);
assert.ok(difference(0, 0) < -2);
assert.ok(difference(2.72, 0) > 0.5);
assert.ok(Math.abs(difference(4.5, -3.8)) < 0.005);
assert.equal(lakeDimensions.ulmen.depth, 38);
assert.equal(lakeDimensions.nyos.depth, 208);
assert.equal(lakeDimensions.ulmen.span, 340);
const result = {
  lakeDimensions,
  craterChange: difference(0, 0),
  rimChange: difference(2.72, 0),
  terrain: {},
};
for (const name of ["ulmen", "eifel"]) {
  const d = JSON.parse(
    await readFile("src/seismology/" + name + "-dsm.json", "utf8"),
  );
  assert.equal(d.values.length, d.n * d.n);
  const [west, south, east, north] = d.box;
  const row = Math.round(((north - 50.2106) / (north - south)) * (d.n - 1));
  const col = Math.round(((6.9828 - west) / (east - west)) * (d.n - 1));
  const centre = d.values[row * d.n + col];
  assert.equal(centre, 424);
  assert.ok(d.values.every(Number.isFinite));
  const photo = await readFile("public/data/vulkaneifel/" + name + ".webp");
  assert.equal(photo.toString("ascii", 8, 12), "WEBP");
  result.terrain[name] = {
    bbox: d.box,
    samples: d.values.length,
    centreDSM: centre,
    minimum: Math.min(...d.values),
    maximum: Math.max(...d.values),
  };
}
if (process.argv[2]) {
  await mkdir(process.argv[2], { recursive: true });
  await writeFile(
    join(process.argv[2], "Vulkan-Fachpruefung.json"),
    JSON.stringify(result, null, 2),
  );
}
console.log(
  "Vier Auswurfimpulse, Einsenkung, Tuffwall, Seeabmessungen und beide georeferenzierten Geländegitter geprüft.",
);
