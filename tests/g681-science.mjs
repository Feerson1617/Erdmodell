import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { gasParcel, dissolvedTint } from "../src/seismology/lake-physics.ts";
import { greatCircleKm, towns } from "../src/seismology/ulmen-wittlich.ts";

const read = async (path) => JSON.parse(await readFile(path, "utf8"));
// Whole-lake column in Kusakabe et al. (2008), Table 4, p. 114. Values in Gmol.
const original = [
  [1986, 11, 13.05, 0.07],
  [1988, 12, 13.33, 0.05],
  [1993, 11, 13.57, 0.54],
  [1998, 4, 14.06, 0.53],
  [1999, 11, 14.41, 0.51],
  [2001, 1, 14.78, 0.52],
  [2001, 12, 14.2, 0.49],
  [2003, 1, 13.1, 0.48],
  [2004, 1, 13.16, 0.49],
  [2005, 1, 12.29, 0.45],
  [2006, 1, 11.83, 0.43],
];
const inventory = await read("src/seismology/nyos-inventory.json");
assert.deepEqual(
  inventory.map(({ year, month, total, uncertainty }) => [
    year,
    month,
    total,
    uncertainty,
  ]),
  original,
);
const d = greatCircleKm(towns.ulmen, towns.wittlich);
// Independent spherical law of cosines, using the two Nominatim town centroids.
const rad = Math.PI / 180,
  a = 50.2082684 * rad,
  b = 49.9850353 * rad;
const reference =
  6371 *
  Math.acos(
    Math.sin(a) * Math.sin(b) +
      Math.cos(a) * Math.cos(b) * Math.cos((6.979957 - 6.88844) * rad),
  );
assert.ok(Math.abs(d - reference) < 1e-6 && d > 25 && d < 26);
const region = await read("src/seismology/ulmen-wittlich-dsm.json");
const [w, s, e, n] = region.box;
assert.equal(region.values.length, region.n ** 2);
for (const p of Object.values(towns))
  assert.ok(w < p.lon && p.lon < e && s < p.lat && p.lat < n);

for (let i = 0; i <= 12; i++) {
  const seed = i / 12,
    endLift = 0.37 + 0.08 * seed;
  for (let j = 0; j <= 12; j++) {
    const time = (endLift * j) / 12,
      r = gasParcel(time, seed, "rich"),
      u = gasParcel(time, seed, "weak");
    assert.ok(
      Math.abs(r.rise - u.rise) < 1e-12 && r.free < 1e-12 && u.free === 0,
    );
  }
  const at = (t) => gasParcel(t, seed, "rich");
  const delta1 = at(endLift + 0.13).rise - at(endLift + 0.06).rise;
  const delta2 = at(endLift + 0.2).rise - at(endLift + 0.13).rise;
  assert.ok(
    delta2 > delta1 && at(endLift + 0.2).free > at(endLift + 0.13).free,
  );
  assert.equal(gasParcel(1, seed, "weak").free, 0);
}
const tint = (t, id, x = 0) => dissolvedTint(0.86, x, t, id);
assert.ok(
  tint(0, "rich") > 4 * tint(0, "weak") && tint(0.75, "rich") < tint(0, "rich"),
);
assert.equal(tint(0.75, "weak"), tint(0, "weak"));
assert.ok(tint(0.75, "rich", 0.8) > tint(0.75, "rich"));
if (process.argv[2]) {
  await mkdir(process.argv[2], { recursive: true });
  await writeFile(
    join(process.argv[2], "G681-Fachpruefung.json"),
    JSON.stringify(
      {
        distanceKm: d,
        reference,
        region: region.box,
        inventory,
        tint: {
          rich: tint(0, "rich"),
          weak: tint(0, "weak"),
          richAfter: tint(0.75, "rich"),
        },
        sources: [
          "https://doi.org/10.2343/geochemj.42.93",
          "https://www.openstreetmap.org/relation/1269805",
          "https://www.openstreetmap.org/relation/661036",
          "https://www.cdc.gov/niosh/npg/npgd0103.html",
        ],
      },
      null,
      2,
    ),
  );
}
console.log(
  "Gaszustände, Rückkopplung, Luftlinie und 11 publizierte Inventarschätzungen geprüft.",
);
