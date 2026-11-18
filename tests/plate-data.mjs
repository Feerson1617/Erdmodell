import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PNG } from "pngjs";

const folder = new URL("../src/tectonics/", import.meta.url);
const read = name => readFile(new URL(name, folder));
const [stepsFile, labelsFile, image] = await Promise.all([
  read("steps.json"), read("labels.json"), read("plates.png"),
]);
assert.equal(createHash("sha256").update(stepsFile).digest("hex"),
  "d5352d743d97bbc12c959c69a2deb80a77c6b35597c69daa4bcb2a3bac2088d9");
const steps = JSON.parse(stepsFile);
assert.equal(steps.length, 5819);
assert.deepEqual(steps.map(s => s[0]), Array.from({ length: 5819 }, (_, i) => i + 1));
assert.deepEqual(steps[4208], [4209, "EU-NA", "OSR", -22.066, 63.922, -22.537, 63.836, 18.9, 103]);
assert.deepEqual(steps[2628], [2629, "PA\\OK", "SUB", 143.973, 38.359, 143.928, 38.166, 92, 295]);
assert.deepEqual(steps[2876], [2877, "NA-PA", "CTF", -120.438, 35.91, -119.936, 35.45, 45.6, 144]);
const plateSites = JSON.parse(labelsFile);
const codes = Object.keys(plateSites).sort();
const mask = PNG.sync.read(image);
assert.equal(codes.length, 52);
assert.equal(mask.width, 2048);
assert.equal(mask.height, 1024);
function plateAt([lon, lat]) {
  const x = Math.floor((lon + 180) * mask.width / 360);
  const y = Math.floor((90 - lat) * mask.height / 180);
  return codes[mask.data[(y * mask.width + x) * 4] - 1];
}
for (const [code, point] of Object.entries(plateSites)) assert.equal(plateAt(point), code);
for (const [point, code] of [
  [[-18.65,63.88],"EU"], [[-24.7,64.55],"NA"],
  [[146.15,38.18],"PA"], [[141.55,38.7],"OK"],
  [[-118.75,36.5],"NA"], [[-122,35.3],"PA"],
]) assert.equal(plateAt(point), code);
console.log("PB2002 geprüft: 5.819 Originalschritte, drei Relativvektoren und Beschriftungen aller 52 Platten.");
