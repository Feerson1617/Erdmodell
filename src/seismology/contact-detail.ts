import * as T from "three";
import { Stage, vec } from "./stage";
import { randomSequence } from "../observatory/local-plants";
import { ramp } from "./volcanism";
export function contactDetail(s: Stage) {
  s.look(0.9, 1, 13, 0);
  s.halfWidth = 4.8;
  s.halfHeight = 2.6;
  s.duration = 16;
  s.box(0, 0, -0.45, 9, 4.1, 0.75, 0x796a59, "Poröses Gestein");
  const random = randomSequence(168);
  for (let j = 0; j < 7; j++)
    for (let i = 0; i < 18; i++) {
      const x = (i - 8.5) * 0.49 + (j % 2) * 0.18,
        y = (j - 3) * 0.54 + 0.05 * Math.sin(i + j);
      const grain = s.mesh(
        new T.DodecahedronGeometry(0.32 + random() * 0.09),
        [0xb9a07f, 0x9a856c, 0xc0ad91][(i + j) % 3],
        "Mineralkorn",
      );
      grain.scale.set(1, 0.74 + random() * 0.25, 0.53);
      grain.rotation.z = random();
      grain.position.set(x, y, 0.04);
      if (i % 3 !== 0 && j < 5) {
        const pore = s.dot(
          vec(x + 0.2, y + 0.2, 0.017),
          0x378591,
          0.1,
          "Porenwasser",
        );
        pore.scale.set(1.3, 0.7, 0.4);
      }
    }
  const path = new T.CatmullRomCurve3([
    vec(-0.7, -2, 0.26),
    vec(-0.6, -1.3, 0.26),
    vec(-0.23, -0.82, 0.26),
    vec(-0.33, -0.42, 0.26),
    vec(0.04, -0.1, 0.26),
  ]);
  const dyke = s.mesh(
    new T.TubeGeometry(path, 40, 0.12, 8, false),
    0xd67847,
    "Aufsteigendes Magma",
  );
  const vapour = Array.from({ length: 14 }, () =>
    s.dot(vec(), 0xc9d7ce, 0.075, "Dampf"),
  );
  const clasts = Array.from({ length: 20 }, (_, i) =>
    s.mesh(
      new T.DodecahedronGeometry(0.065 + (i % 4) * 0.017),
      i % 3 ? 0x9c846d : 0x534d47,
      "Bruchstück",
    ),
  );
  s.animate((t) => {
    dyke.geometry.setDrawRange(0, Math.round(40 * ramp(t, 0, 0.39)) * 48);
    const q = ramp(t, 0.4, 0.78);
    vapour.forEach((o, i) => {
      const a = i * 2.4;
      o.visible = t > 0.4 + i * 0.007 && t < 0.88;
      o.scale.setScalar(0.5 + 2 * q);
      o.position.set(
        0.06 + Math.cos(a) * q * 0.68,
        -0.05 + Math.sin(a) * q * 0.55,
        0.43,
      );
    });
    clasts.forEach((o, i) => {
      const a = i * 2.4,
        p = ramp(t, 0.55, 1);
      o.visible = t > 0.55;
      o.position.set(
        0.06 + Math.cos(a) * p * (0.8 + (i % 3) * 0.4),
        -0.05 + Math.sin(a) * p * 1.1 + 1.15 * p * (1 - p),
        0.43 + p * 0.13,
      );
    });
  });
  s.label(
    vec(-2, 0.75, 0.22),
    "Porenraum",
    "Wasser füllt Lücken zwischen Mineral- und Gesteinskörnern",
  );
  s.label(
    vec(0.04, -0.1, 0.43),
    "Kontaktfläche",
    "Wärme gelangt vom Magma ins externe Wasser",
    (t) => t > 0.3 && t < 0.65,
  );
  s.label(
    vec(0.5, 0.4, 0.46),
    "Dampfexpansion",
    "Bei rascher Wärmeübertragung kann Gestein fragmentieren",
    (t) => t > 0.56,
  );
  s.explain((t) =>
    t < 0.39
      ? "Vergrößerter Ausschnitt · Wasser sitzt in Poren und Klüften des Gesteins."
      : t < 0.66
        ? "Bei innigem Kontakt kann Wasser rasch verdampfen. Die räumliche Begrenzung beeinflusst den Druckaufbau."
        : "Dampf dehnt sich aus. Unter geeigneten Bedingungen zerbrechen Magma und Nebengestein. Der Ablauf ist ein qualitatives Beispiel.",
  );
}
