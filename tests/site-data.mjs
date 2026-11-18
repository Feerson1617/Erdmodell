import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sites = JSON.parse(await readFile("src/sites.json", "utf8"));
assert.ok(sites.length >= 2);
assert.equal(new Set(sites.map((s) => s.id)).size, sites.length);
for (const site of sites) {
  const [w, s, e, n] = site.bounds;
  assert.ok(
    w < site.target.lon &&
      site.target.lon < e &&
      s < site.target.lat &&
      site.target.lat < n,
  );
  const data = await readFile("public/data/" + site.mesh);
  const count = data.readUInt32LE(0),
    indices = data.readUInt32LE(4);
  assert.equal(data.length, 8 + count * 16 + indices * 2);
  assert.equal(indices % 3, 0);
  const points = Array.from({ length: count }, (_, i) =>
    Array.from({ length: 4 }, (_, j) => data.readFloatLE(8 + i * 16 + j * 4)),
  );
  assert.ok(
    points.every(
      ([u, v, h, land]) =>
        u >= 0 &&
        v >= 0 &&
        u <= 1 &&
        v <= 1 &&
        Number.isFinite(h) &&
        (land === 1 || (land >= -1 && land <= 0)),
    ),
  );
  const edges = new Map();
  let area = 0;
  for (let i = 0; i < indices; i += 3) {
    const ids = [0, 1, 2].map((j) =>
      data.readUInt16LE(8 + 16 * count + 2 * (i + j)),
    );
    assert.ok(ids.every((k) => k < count));
    const [a, b, c] = ids.map((k) => points[k]);
    const twice = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    assert.ok(twice < 0, "Umgekehrtes oder entartetes Dreieck");
    area -= twice / 2;
    for (let k = 0; k < 3; k++) {
      const x = ids[k],
        y = ids[(k + 1) % 3],
        key = Math.min(x, y) * 65536 + Math.max(x, y);
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  assert.ok(Math.abs(area - 1) < 1e-6);
  for (const [key, incidence] of edges) {
    if (incidence === 2) continue;
    const a = points[Math.floor(key / 65536)],
      b = points[key % 65536];
    assert.ok(
      incidence === 1 &&
        [0, 1].some((i) => a[i] === b[i] && [0, 1].includes(a[i])),
      "Offene Innenkante",
    );
  }
  if (site.height.kind === "dsm") {
    const grid = JSON.parse(await readFile("public/data/" + site.height.file));
    assert.equal(grid.meters.length, grid.width * grid.height);
    assert.ok(
      points.every(
        ([u, v, h]) =>
          Math.abs(
            grid.meters[
              Math.round(v * (grid.height - 1)) * grid.width +
                Math.round(u * (grid.width - 1))
            ] -
              h * 1000,
          ) <= 0.501,
      ),
    );
  }
  console.log(
    site.name,
    count,
    "Stützpunkte,",
    indices / 3,
    "Dreiecke, vollständige Fläche und Innenkanten geprüft.",
  );
}
