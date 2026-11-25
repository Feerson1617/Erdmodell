import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import {
  referenceSource,
  moment,
  magnitude,
  arrival,
  displacement,
  stationTrace,
  rupture,
  volcanicTrace,
  mechanisms, faultMotion,groundMotion,
} from "../src/seismology/physics.ts";
const read = async (file) => JSON.parse(await readFile(file, "utf8"));
const checks = [];
function near(actual, expected, tolerance, name) {
  assert.ok(Math.abs(actual - expected) <= tolerance, name + " " + actual);
  checks.push({ name, actual, expected, tolerance });
}
near(moment(1e8, 0.5, 30e9), 1.5e18, 0, "100 km², 0,5 m, 30 GPa");
near(
  magnitude(1e18),
  5.933333333333334,
  1e-10,
  "10¹⁸ Nm nach Hanks/Kanamori, SI-Konvention",
);
near(
  referenceSource(7).moment / referenceSource(6).moment,
  31.6227766,
  1e-7,
  "Verhältnis für ΔMw = 1",
);
near(arrival(42, "p"), 7, 0, "42 km / 6 km/s");
near(arrival(42, "s"), 12, 0, "42 km / 3,5 km/s");
for (const wave of ["p", "s", "love", "rayleigh"]) {
  assert.deepEqual(displacement(wave, 42, 6), [0, 0, 0]);
  const a = displacement(wave, 42, arrival(42, wave) + 0.27);
  if (wave === "p") assert.ok(a[0] && a[1] === 0 && a[2] === 0);
  if (wave === "s") assert.ok(a[1] && a[0] === 0 && a[2] === 0);
  if (wave === "love") assert.ok(a[2] && a[0] === 0 && a[1] === 0);
  if (wave === "rayleigh") assert.ok(a[0] && a[1] && a[2] === 0);
}
assert.equal(stationTrace(60, 9.99), 0);
assert.notEqual(stationTrace(30, 9.99), 0);
assert.ok(
  rupture(1, 0, 0) > rupture(0.5, 0, 0) &&
    rupture(0.45, 2, 0) < rupture(0.45, 0, 0) &&
    rupture(1, 5, 0) === 0,
);
assert.equal(Object.keys(mechanisms).length, 6);
assert.ok(
  mechanisms.normal.rake < 0 &&
    mechanisms.thrust.dip < mechanisms.reverse.dip &&
    mechanisms.oblique.rake > 0 &&
    mechanisms.oblique.rake < 90,
);
for(const [km,p,s] of [[30,5,8.5714285714],[60,10,17.1428571429]]){
  near(arrival(km,"p"),p,1e-8,"P bei "+km+" km");near(arrival(km,"s"),s,1e-8,"S bei "+km+" km");
  const before=groundMotion(km,p-.001);assert.equal(before.longitudinal,0);assert.equal(before.transverse,0);
}
const transient=[false,true].map(soil=>Array.from({length:350},(_,i)=>groundMotion(45,15+i/50,soil).transverse));
assert.ok(transient[1].reduce((v,a)=>v+a*a,0)>transient[0].reduce((v,a)=>v+a*a,0)*2);
const strain=t=>faultMotion(t,.4,0,0).offset-faultMotion(t,.05,0,0).offset;
assert.ok(strain(.34)>.1&&Math.abs(strain(1))<.001&&faultMotion(1,.05,0,0).permanent>.4);
near(faultMotion(1,0,5,0).permanent,0,0,"Außerhalb der Bruchfläche");
const rays = await read("src/seismology/iasp91.json");
for (const q of rays) {
  const maxDepth = Math.max(...q.points.map((p) => p[2]));
  near(
    (q.points.at(-1)[1] * 180) / Math.PI,
    q.angle,
    0.03,
    q.phase + " Endpunkt",
  );
  assert.ok(q.points.every((p, i) => i === 0 || p[0] >= q.points[i - 1][0]));
  if (q.phase === "S" || q.phase === "P") assert.ok(maxDepth < 2891);
  if (q.phase.includes("K")) assert.ok(maxDepth > 2891);
  if (q.phase.includes("I")) assert.ok(maxDepth > 5100);
}
const local = await read("src/observatory/japan-events.json"),
  world = await read("public/data/g5/comcat.json");
assert.equal(local.length, 176);
assert.equal(world.events.length, 697);
assert.ok(local.every((d) => d[6] >= 4.5 && d[5] >= "2019" && d[5] < "2024"));
assert.ok(new Set(local.map((a) => a[0])).size === 176);
const tr = await read("src/seismology/tohoku-anmo.json");
assert.equal(tr.id, "IU.ANMO.00.BHZ");
assert.equal(tr.samples, 25200);
assert.equal(tr.rate, 20);
assert.equal(tr.envelope.length, 1260);
assert.ok(tr.envelope.every(([a, b]) => a <= b));
assert.ok(
  volcanicTrace("tremor", 20) !== 0 &&
    volcanicTrace("quiet", 10) !== volcanicTrace("vt", 10),
);
const report = {
  checks,
  regionalEvents: local.length,
  globalEvents: world.events.length,
  originalSamples: tr.samples,
  rayPhases: rays.map((r) => r.phase),
  complete: true,
};
if (process.argv[2]) {
  await mkdir(process.argv[2], { recursive: true });
  await writeFile(
    process.argv[2] + "/Fachpruefung.json",
    JSON.stringify(report, null, 2),
  );
}
console.log(
  "Fachprüfung bestanden · 6 Mechanismen, 4 Wellenarten, 7 IASP91-Laufwege, Momentenvergleich und Originaldaten.",
);
