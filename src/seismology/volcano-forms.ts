import * as T from "three";
import { Stage, vec } from "./stage";
import { surface } from "./geology";
export function volcanoForms(s: Stage) {
  s.look(0.5, 3.5, 14, 0.45);
  s.halfWidth = 5.6;
  s.halfHeight = 2.4;
  s.duration = 18;
  for (const shield of [true, false]) {
    const cx = shield ? -2.65 : 2.75,
      radius = shield ? 2.68 : 1.96,
      height = shield ? 0.82 : 2.45;
    const top = (r: number) =>
      height *
        (shield ? Math.max(0, 1 - r * r) ** 1.66 : Math.max(0, 1 - r) ** 1.08) -
      0.16 * Math.exp((-r * r) / 0.006);
    surface(
      s,
      74,
      32,
      (u, v) => {
        const a = -u * Math.PI,
          r = v;
        return vec(
          cx + Math.cos(a) * r * radius,
          top(r) - 0.85 + 0.03 * Math.sin(a * 8) * Math.sin(v * Math.PI),
          Math.sin(a) * r * radius,
        );
      },
      shield ? 0x546e58 : 0x8a806b,
      "Vulkanflanke",
    );
    for (let i = 0; i < 9; i++) {
      surface(
        s,
        74,
        2,
        (u, v) => {
          const x = 2 * u - 1;
          return vec(
            cx + x * radius,
            -0.85 + ((i + v) / 9) * top(Math.abs(x)),
            0.015,
          );
        },
        shield
          ? [0x645e58, 0x82766b][i % 2]
          : [0x7f6b59, 0xb79a77, 0x655c58][i % 3],
        "Ablagerung",
      );
    }
    s.label(
      vec(cx, height - 0.85, 0.04),
      shield ? "Schildvulkan" : "Schichtvulkan",
      shield
        ? "Hawaii · breite flache Lavaflanken"
        : "Japan · steilere Flanken, Lava und Lockermaterial",
    );
    if (shield) {
      const flow = s.line(
        Array.from({ length: 61 }, (_, i) => {
          const u = i / 60;
          return vec(cx + u * radius, top(u) - 0.81, 0.045);
        }),
        0xef9658,
        "Lavaweg",
      );
      s.animate((t) =>
        flow.geometry.setDrawRange(0, Math.max(1, Math.floor(61 * t))),
      );
    } else {
      for (let i = 0; i < 14; i++) {
        const piece = s.dot(
          vec(),
          0xa9a39d,
          0.045 + (i % 3) * 0.018,
          "Asche und Fragmente",
        );
        s.animate((t) => {
          const u = (t * 2 + i / 14) % 1;
          piece.position.set(
            cx + Math.sin(i * 3) * u * 0.55,
            height - 0.92 + 1.18 * u,
            0.06,
          );
          piece.visible = t > 0.12;
        });
      }
    }
  }
  s.explain(
    () =>
      "Idealisierte Schnitte · Wiederholte dünnflüssige Lavaströme bauen breite Flanken auf. Lava und lockerer Auswurf können steilere Schichtvulkane aufbauen. Die Eruptionsweise kann an einem Vulkan wechseln.",
  );
}
