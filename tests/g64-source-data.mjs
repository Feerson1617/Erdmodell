// Fixed samples read independently with GDAL at geographic coordinates in the original GMT grids.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
const root = new URL("../public/data/g64/", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("quellen.json", root)));
const data = {};
for (const [id, file] of [
  ["age", "age.i16"],
  ["magnetik", "magnetik.i16"],
  ["volcanoes", "vulkane.json"],
]) {
  const bytes = await readFile(new URL(file, root));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), manifest.datasets[id].sha256);
  data[id] = bytes;
}
const sample = (grid, lat, lon) =>
  grid.readInt16LE(2 * ((90 - lat) * 360 + ((((180 + lon) % 360) + 360) % 360)));
for (const [lat, lon, age, mag] of [
  [-25, -13, -9616, -3889],
  [-25, -30, -2209, -3867],
  [24, 10, -32768, -32768],
  [-30, 14, 3327, -3924],
  [30, -45, -8236, -4088],
  [-23, 179, -6927, -4008],
  [-23, 180, -6733, -3913],
  [64, -15, -6448, -3443],
]) {
  assert.equal(sample(data.age, lat, lon), age);
  assert.equal(sample(data.magnetik, lat, lon), mag);
}
const rows = JSON.parse(data.volcanoes);
assert.equal(rows.length, 1609);
assert.equal(new Set(rows.map((r) => r[0])).size, 1609);
assert.ok(
  rows.every(([id, name, lat, lon]) => id && name && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180),
);
assert.deepEqual(rows.find((r) => r[0] === 10001).slice(0, 4), [
  10001,
  "West Eifel Volcanic Field",
  50.17,
  6.85,
]);
const read = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url)));
const steps = await read("../src/tectonics/steps.json"),
  fields = await read("../src/observatory/pb-fields.json");
// Bird (2003), original 95-column records. Positive normal = divergence, positive shear = dextral.
for (const [id, azimuth, speed, normal, shear] of [
  [1510, 115, 167.5, -167.5, -0.8],
  [2308, 26, 10.2, 10.1, -1.1],
  [2629, 295, 92, -89, -23.2],
  [2877, 144, 45.6, -4.2, 45.4],
  [4209, 103, 18.9, 10.9, -15.5],
  [5505, 78, 4.7, 3.6, -3],
]) {
  assert.equal(steps[id - 1][8], azimuth);
  assert.equal(steps[id - 1][7], speed);
  assert.deepEqual(fields[id - 1].slice(1, 3), [normal, shear]);
  assert.ok(Math.abs(Math.hypot(normal, shear) - speed) < 0.14);
}
console.log("8 unabhängige GMT-Koordinatenpaare, 1.609 NOAA-Standorte und sechs PB2002-Vektoren bestätigt.");
