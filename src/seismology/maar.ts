import * as T from "three";
import { Stage, vec } from "./stage";
import { surface } from "./geology";
import { ramp } from "./volcanism";
import { specimen, randomSequence } from "../observatory/local-plants";

import { bursts, excavation, surfaceHeight } from "./maar-profile";
function relief(x: number, z: number, t: number) {
  return surfaceHeight(x, z, excavation(t));
}
export function maar(s: Stage) {
  const dry = s.view === "dryMaar";
  s.look(4.1, 4.7, 12, -0.57);
  s.halfWidth = 5.85;
  s.halfHeight = 3.25;
  s.duration = 26;
  const top = surface(
    s,
    90,
    44,
    (u, v) => vec((u - 0.5) * 10, 0, -v * 4.2),
    0x809252,
    "Gelände",
  );
  const positions = top.geometry.attributes.position,
    shades = top.geometry.attributes.color;
  const grass = new T.Color(0x809252),
    ash = new T.Color(0x99816b),
    rock = new T.Color(0x736657),
    tint = new T.Color();
  let previous = -1;
  s.animate((t) => {
    const p = excavation(t);
    if (previous === p) return;
    previous = p;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i),
        z = positions.getZ(i),
        r = Math.hypot(x * 0.92, z * 1.08),
        rim = 0.72 + 1.67 * Math.sqrt(p);
      const ashCover =
        p * (1 - T.MathUtils.smoothstep(r, rim + 0.25, rim + 0.95));
      tint
        .copy(grass)
        .lerp(ash, ashCover)
        .lerp(rock, ashCover * (1 - T.MathUtils.smoothstep(r, 0.6, rim)));
      tint.multiplyScalar(0.94 + 0.06 * Math.sin(x * 22 + z * 17));
      shades.setXYZ(i, tint.r, tint.g, tint.b);
    }
    shades.needsUpdate = true;
  });
  const deform = (
    mesh: T.Mesh,
    fn: (x: number, y: number, z: number, t: number) => number,
  ) => {
    const a = mesh.geometry.getAttribute("position") as T.BufferAttribute,
      base = a.array.slice();
    let last = -1;
    s.animate((t) => {
      const p = excavation(t);
      if (last === p) return;
      last = p;
      for (let i = 0; i < a.count; i++)
        a.setY(i, fn(base[i * 3], base[i * 3 + 1], base[i * 3 + 2], t));
      a.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
      mesh.frustumCulled = false;
    });
  };
  deform(top, (x, _y, z, t) => relief(x, z, t));
  const strata = [-3.15, -2.27, -1.72, -1.3, -0.91, -0.48, 0];
  const tones = [0x625446, 0x897460, 0x756e60, 0x528b93, 0xa88a68, 0x896d50];
  for (let k = 0; k < tones.length; k++) {
    const wall = surface(
      s,
      90,
      3,
      (u, v) =>
        vec(10 * u - 5, T.MathUtils.lerp(strata[k], strata[k + 1], v), 0.002),
      tones[k],
      "Gesteinshorizont",
    );
    deform(
      wall,
      (x, y, _z, t) =>
        Math.min(
          y + 0.09 * Math.sin(1.3 * x + y) * Math.min(1, -y),
          relief(x, 0, t),
        ) + (y === 0 ? Math.max(0, relief(x, 0, t)) : 0),
    );
  }
  // The breccia body and feeder remain below the advancing crater floor.
  const fill = surface(
    s,
    40,
    16,
    (u, v) => vec((2 * u - 1) * (0.15 + 1.55 * v), -3.1 + v * 2.2, 0.024),
    0x79685b,
    "Diatremfüllung",
  );
  s.animate((t) => {
    const p = excavation(t);
    fill.visible = t > 0.34;
    const a = fill.geometry.attributes.position;
    for (let j = 0; j <= 16; j++)
      for (let i = 0; i <= 40; i++) {
        const v = j / 16,
          x = (i / 20 - 1) * (0.15 + 1.55 * v) * (0.2 + 0.8 * p);
        a.setXYZ(
          j * 41 + i,
          x,
          T.MathUtils.lerp(-3.1, surfaceHeight(x, 0, p) - 0.08, v),
          0.025,
        );
      }
    a.needsUpdate = true;
  });
  const feeder = s.mesh(
    new T.TubeGeometry(
      new T.CatmullRomCurve3([
        vec(-0.5, -3.12, 0.075),
        vec(-0.28, -2.4, 0.075),
        vec(-0.36, -1.78, 0.075),
        vec(0.03, -1.16, 0.075),
      ]),
      30,
      0.072,
      8,
      false,
    ),
    0xe27749,
    "Magma",
  );
  s.animate((t) => {
    feeder.geometry.setDrawRange(0, Math.floor(30 * ramp(t, 0.03, 0.3)) * 48);
    feeder.visible = t < 0.77;
  });
  const random = randomSequence(1403);
  const debris = Array.from({ length: 65 }, (_, i) => ({
    o: s.mesh(
      new T.DodecahedronGeometry(0.026 + random() * 0.055),
      i % 4 ? 0xac9276 : 0x4e4942,
      "Auswurf",
    ),
    speed: 0.7 + random() * 2.15,
    angle: random() * Math.PI,
    delay: random() * 0.027,
    h: 1.1 + random() * 2.3,
  }));
  s.animate((t) =>
    debris.forEach(({ o, speed, angle, delay, h }) => {
      const start = bursts.filter((b) => b <= t - delay).at(-1) ?? 1;
      const u = (t - start - delay) / 0.105;
      o.visible = u >= 0 && u <= 1;
      if (o.visible)
        o.position.set(
          Math.cos(angle) * speed * u,
          relief(0, 0, start) + h * 4 * u * (1 - u),
          -Math.sin(angle) * speed * u,
        );
    }),
  );
  const trees = specimen("oak", 55, true);
  for (let i = 0; i < 36; i++) {
    const x = random() * 10 - 5,
      z = -random() * 4;
    if (Math.hypot(x, z) < 3.1) continue;
    const o = s.mesh(trees, 0xffffff, "Waldrand");
    (o.material as T.MeshStandardMaterial).vertexColors = true;
    o.scale.setScalar(0.065 + random() * 0.04);
    o.rotation.y = random() * 6;
    o.position.set(x, relief(x, z, 0), z);
  }
  const lake = surface(
    s,
    78,
    12,
    (u, v) => vec(Math.cos(u * Math.PI) * v, 0, -Math.sin(u * Math.PI) * v),
    0x358b9a,
    "Späterer Maarsee",
  );
  s.animate((t) => {
    const p = ramp(t, 0.78, 0.98);
    lake.visible = !dry && p > 0;
    lake.position.y = -2.02 + 1.28 * p;
    lake.scale.set(2.04 * Math.sqrt(p), 1, 1.75 * Math.sqrt(p));
  });
  s.label(vec(-2.8, -1.1, 0.04), "Grundwasserleiter");
  s.label(
    vec(0, -1.0, 0.1),
    "Kontaktzone",
    "Magma und Grundwasser",
    (t) => t > 0.2 && t < 0.51,
  );
  s.label(
    vec(2.55, 0.52, 0),
    "Tuffwall",
    "abgelagertes Auswurfmaterial",
    (t) => t > 0.6,
  );
  s.label(
    vec(0, -2.55, 0.1),
    "Diatrem",
    "mit Bruchstücken gefüllter Schlot",
    (t) => t > 0.64,
  );
  s.explain((t) =>
    t < 0.28
      ? "Magma steigt unter der ursprünglichen Geländeoberfläche in wasserführende Schichten."
      : t < 0.76
        ? "Wiederholte phreatomagmatische Explosionen werfen Magma und Nebengestein aus. Einbruch vertieft den Trichter; Auswurf baut den Wall auf."
        : dry
          ? "Ein Maar kann trocken bleiben oder später verlanden."
          : "Später kann sich Wasser im eingetieften Maar sammeln. Der See entsteht nach der Eruption.",
  );
}
