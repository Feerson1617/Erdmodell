import assert from "node:assert/strict";
import * as T from "three";
import { createServer } from "vite";

const server = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  logLevel: "error",
});
try {
  const { SectionOccluder } = await server.ssrLoadModule(
    "/src/tectonics/occlusion.ts",
  );
  const geometry = new T.BoxGeometry(12, 6, 8, 12, 6, 8);
  const base = geometry.attributes.position;
  const end = base.clone();
  for (let i = 0; i < end.count; i++)
    end.setZ(i, base.getZ(i) + 1.25 * Math.cos(base.getX(i) * 0.4));
  geometry.morphAttributes.position = [end];
  const mesh = new T.Mesh(
    geometry,
    new T.MeshStandardMaterial({ side: T.DoubleSide }),
  );
  mesh.position.set(3700, 2500, 3700);
  mesh.rotation.set(0.3, 0.51, 0.12);
  mesh.scale.set(1.3, 0.79, 1.1);
  mesh.updateMatrixWorld();
  const indexed = new SectionOccluder(mesh),
    reference = new T.Raycaster();
  let hits = 0,
    misses = 0;
  for (const t of [-0.55, 0, 0.61, 1]) {
    mesh.morphTargetInfluences[0] = t;
    for (const side of [-1, 1]) {
      const eye = mesh.localToWorld(new T.Vector3(7 * side, 14, 25 * side));
      indexed.prepare(eye);
      for (let x = -7; x <= 7; x += 2)
        for (let y = -5; y <= 5; y += 2)
          for (const z of [-6, 1, 7]) {
            const point = mesh.localToWorld(
              new T.Vector3(x + 0.07, y + 0.11, z + 0.17),
            );
            const direction = point.clone().sub(eye);
            reference.far = direction.length();
            reference.set(eye, direction.normalize());
            const expected = reference.intersectObject(mesh, false).length > 0;
            assert.equal(
              indexed.blocks(point),
              expected,
              JSON.stringify({ t, side, x, y, z }),
            );
            assert.equal(indexed.blocks(point, "probe"), expected);
            assert.equal(indexed.blocks(point, "probe"), expected);
            if (expected) hits++;
            else misses++;
          }
    }
  }
  assert.ok(hits > 100 && misses > 100);
  console.log(
    `Sichtlinien mit verformten Oberflächen: ${hits} verdeckte und ${misses} freie Ziele stimmen mit der vollständigen Dreieckssuche überein.`,
  );
} finally {
  await server.close();
}
