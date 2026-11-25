import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { shoreRadius, surfaceHeight } from "../src/seismology/maar-profile.ts";
import {
  basinFloor,
  circulationPoint,
  plumeParcel,
} from "../src/seismology/lake-physics.ts";
let shoreError = 0,
  deepestUpper = 0,
  shallowestDeep = 1;
for (let i = 0; i < 180; i++) {
  const angle = (i * Math.PI) / 90;
  for (const level of [-1.7, -1.4, -1, -0.65]) {
    const r = shoreRadius(angle, level);
    shoreError = Math.max(
      shoreError,
      Math.abs(
        surfaceHeight(r * Math.cos(angle), -r * Math.sin(angle), 1) - level,
      ),
    );
  }
  for (let j = 0; j < 80; j++) {
    for (const chemical of [true, false]) {
      const q = circulationPoint(i / 180, j / 80, chemical);
      assert.ok(q.depth >= 0 && q.depth <= -basinFloor(q.x));
      if (chemical && q.excluded)
        shallowestDeep = Math.min(q.depth, shallowestDeep);
      if (chemical && !q.excluded)
        deepestUpper = Math.max(q.depth, deepestUpper);
    }
    assert.equal(plumeParcel(i / 180, j / 80, false).exsolved, 0);
  }
}
assert.ok(shoreError < 0.0001);
assert.ok(deepestUpper < 0.49 && shallowestDeep > 0.49);
const profiles = JSON.parse(
  await readFile("src/seismology/nyos-profiles.json", "utf8"),
);
assert.deepEqual(
  profiles.map((p) => p.samples.find((r) => r[0] === 50)),
  [
    [50, 617.3, 53.6],
    [50, 134.5, 1.7],
  ],
);
assert.equal(profiles[1].samples.at(-1)[2], 366.6);
const extents = {};
for (const [name, site] of [
  ["umfeld-dsm", [6.98039, 50.2183]],
  ["nyos-crop", [10.29866, 6.43834]],
]) {
  const { box, values, n } = JSON.parse(
    await readFile("src/seismology/" + name + ".json", "utf8"),
  );
  assert.ok(
    site[0] > box[0] &&
      site[0] < box[2] &&
      site[1] > box[1] &&
      site[1] < box[3],
  );
  assert.equal(values.length, n * n);
  assert.ok(values.every(Number.isFinite));
  extents[name] = box;
}
if (process.argv[2]) {
  await mkdir(process.argv[2], { recursive: true });
  await writeFile(
    join(process.argv[2], "G68-Fachpruefung.json"),
    JSON.stringify(
      { shoreError, deepestUpper, shallowestDeep, extents, profiles },
      null,
      2,
    ),
  );
}
console.log(
  "Uferschnitt, Wasserwege, Schichtgrenze, Gegenbeispiel, Originaltabellen und Raumausschnitte geprüft.",
);
