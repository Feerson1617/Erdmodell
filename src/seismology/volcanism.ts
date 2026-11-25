import * as T from "three";
import { Stage, vec } from "./stage";
import { intrusion } from "./geology";

export const ramp = (x: number, a: number, b: number) =>
  T.MathUtils.smoothstep(x, a, b);

export function plumbing(s: Stage) {
  intrusion(s);
  s.duration = 22;
  if (s.view === "storage") {
    s.label(vec(-1.4, -2.2, 0.3), "Kristallreicher Bereich");
    s.explain((t) =>
      t < 0.45
        ? "Ein Teil des Gesteins schmilzt. Kristalle und Schmelze liegen nebeneinander."
        : "Dichteunterschiede und Überdruck begünstigen den Aufstieg durch Gänge. Magma kann im Gestein erstarren.",
    );
    return;
  }
  const wet = s.view === "contact";
  const knots = wet
    ? [vec(3, -0.53, 0.21), vec(1.65, -0.48, 0.21), vec(0.25, -0.39, 0.21)]
    : [
        vec(-0.35, -1.6, 0.25),
        vec(0.18, -0.78, 0.25),
        vec(0.64, -0.51, 0.25),
        vec(0.73, 0.46, 0.25),
        vec(1.12, 1.45, 0.25),
      ];
  const path = new T.CatmullRomCurve3(knots);
  if (wet)
    s.box(1.65, -0.55, 0.1, 2.85, 0.19, 0.15, 0x508ea1, "Grundwasserleiter");
  else s.line(knots, 0xa9aca0, "Kluft");
  const bubbles = Array.from({ length: 27 }, () =>
    s.dot(
      vec(),
      wet ? 0xb5ddeb : 0xe4d2b2,
      0.065,
      wet ? "Porenwasser" : "Gas · Analysefarbe",
    ),
  );
  const fragments = Array.from({ length: 38 }, (_, i) =>
    s.mesh(
      new T.DodecahedronGeometry(0.035 + (i % 5) * 0.014),
      i % 3 ? 0xb59a7b : 0x655b54,
      "Fragment",
    ),
  );
  s.animate((t) => {
    bubbles.forEach((o, i) => {
      const a = (t * 1.7 + i / 27) % 1;
      path.getPointAt(a, o.position);
      o.position.x += Math.sin(i * 3.1) * 0.045;
      o.visible = t > 0.1;
      o.scale.setScalar(0.5 + a);
    });
    fragments.forEach((o, i) => {
      const a = (t - 0.48) * 2.5 - (i % 4) * 0.035;
      o.visible = wet && a > 0 && a < 1;
      o.position.set(
        0.25 + Math.cos(i * 2.4) * a * 2,
        -0.38 + 6 * a * (1 - a),
        0.3 + Math.sin(i) * a * 0.4,
      );
    });
  });
  s.label(knots[0], wet ? "Wasserführende Schicht" : "Gasführende Schmelze");
  s.label(
    knots[knots.length - 1],
    wet ? "Kontaktzone" : "Gasaustritt",
    wet
      ? "Wärmeübertragung und mögliche Fragmentierung"
      : "Analysefarbe für unsichtbare Gase",
  );
  s.explain((t) =>
    wet
      ? t < 0.48
        ? "Externes Grundwasser nähert sich dem aufsteigenden Magma."
        : "Bei engem Kontakt kann Wasser rasch verdampfen. Expansion kann Magma und Nebengestein zerbrechen."
      : "Bei sinkendem Druck können H₂O, CO₂ und SO₂ aus der Schmelze austreten. Gase wandern auch in Ruhephasen durch Klüfte. CO₂ ist unsichtbar; die Punkte markieren seinen Weg.",
  );
}
