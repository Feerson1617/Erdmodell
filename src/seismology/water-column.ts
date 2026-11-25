import * as T from "three";
import { Stage, vec } from "./stage";
import { basinFloor, circulationPoint, plumeParcel } from "./lake-physics";

const cool = new T.Color(0x326e92),
  warm = new T.Color(0xdbbd6a),
  dissolved = new T.Color(0x77588e);
const smooth = T.MathUtils.smoothstep;
function water(
  s: Stage,
  cx: number,
  half: number,
  height: number,
  column = false,
) {
  const nx = 52,
    ny = 26,
    xyz: number[] = [],
    rgb: number[] = [],
    indices: number[] = [];
  const depthAt = (x: number) => (column ? 0.97 : -basinFloor(x));
  for (let j = 0; j <= ny; j++)
    for (let i = 0; i <= nx; i++) {
      const x = (i / nx) * 2 - 1,
        f = j / ny;
      xyz.push(cx + x * half, 1.55 - height * depthAt(x) * f, 0);
      rgb.push(cool.r, cool.g, cool.b);
      if (i < nx && j < ny) {
        const k = j * (nx + 1) + i;
        indices.push(k, k + 1, k + nx + 1, k + 1, k + nx + 2, k + nx + 1);
      }
    }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(xyz, 3));
  g.setAttribute("color", new T.Float32BufferAttribute(rgb, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  const lens = s.mesh(g, 0xffffff, "Wasserkörper", true);
  (lens.material as T.MeshBasicMaterial).vertexColors = true;
  const rim = Array.from({ length: nx + 1 }, (_, i) => {
    const x = (i / nx) * 2 - 1;
    return vec(cx + x * half, 1.55 - height * depthAt(x), 0.015);
  });
  s.line(rim, 0xb09977, "Beckenboden");
  s.line(
    [vec(cx - half, 1.55, 0.015), vec(cx + half, 1.55, 0.015)],
    0xb4e5e0,
    "Wasserspiegel",
  );
  const tint = new T.Color(),
    attr = g.attributes.color;
  return (t: number, gas: boolean) => {
    for (let j = 0; j <= ny; j++)
      for (let i = 0; i <= nx; i++) {
        const x = (i / nx) * 2 - 1,
          depth = (j / ny) * depthAt(x);
        if (gas)
          tint
            .copy(cool)
            .lerp(
              dissolved,
              smooth(depth, 0.3, 0.9) * (0.34 + 0.66 * smooth(t, 0, 0.32)),
            );
        else
          tint
            .copy(cool)
            .lerp(
              warm,
              (1 - smooth(depth, 0.02, 0.56)) *
                (0.5 + 0.5 * Math.cos(t * Math.PI * 2)),
            );
        tint.multiplyScalar(1.08 - depth * 0.21);
        attr.setXYZ(j * (nx + 1) + i, tint.r, tint.g, tint.b);
      }
    attr.needsUpdate = true;
  };
}
function motionLines(
  s: Stage,
  count: number,
  colour: number,
  name: string,
  position: (i: number, t: number) => T.Vector3,
) {
  const trails = Array.from({ length: count }, (_, i) => {
    const line = s.line(
      Array.from({ length: 10 }, () => vec()),
      colour,
      name,
      0.72,
    );
    const head = s.dot(vec(), colour, 0.045, name);
    line.frustumCulled = false;
    return { line, head, i };
  });
  s.animate((t) => {
    for (const { line, head, i } of trails) {
      const attr = line.geometry.attributes.position;
      for (let j = 0; j < attr.count; j++) {
        const p = position(i, Math.max(0, t - (attr.count - 1 - j) * 0.0035));
        attr.setXYZ(j, p.x, p.y, p.z);
        if (j === attr.count - 1) head.position.copy(p);
      }
      attr.needsUpdate = true;
    }
  });
}
export function mixingSection(s: Stage) {
  const pair = s.view === "mixCompare";
  const kinds = pair ? [false, true] : [s.view === "mixing"];
  const height = pair ? 3.15 : 3.55,
    half = pair ? 2.45 : 4.7;
  s.look(0, 1.5, 14, -0.12);
  s.halfWidth = 5.6;
  s.halfHeight = 2.65;
  s.duration = 22;
  kinds.forEach((chemical, k) => {
    const cx = pair ? (k === 0 ? -2.8 : 2.8) : 0;
    const colour = water(s, cx, half, height);
    s.animate((t) => colour(t, false));
    motionLines(s, pair ? 17 : 27, 0xeaf7cc, "Wasserbewegung", (i, t) => {
      const p = circulationPoint(t, (i + 0.3) / (pair ? 17 : 27), chemical);
      return vec(cx + p.x * half, 1.55 - p.depth * height, 0.065);
    });
    if (chemical) {
      const depth = 0.49,
        extent = half * Math.sqrt(1 - depth ** (1 / 0.69));
      s.line(
        [
          vec(cx - extent, 1.55 - height * depth, 0.05),
          vec(cx + extent, 1.55 - height * depth, 0.05),
        ],
        0xcba2db,
        "Chemische Schichtgrenze",
      );
      for (let i = 0; i < 18; i++) {
        const x = (i / 17 - 0.5) * 1.1,
          d = 0.57 + 0.28 * Math.sin(i * 1.4) ** 2;
        if (d >= -basinFloor(x)) continue;
        const crystal = s.mesh(
          new T.OctahedronGeometry(0.055),
          0xcba2db,
          "Symbol für gelöste Stoffe",
        );
        crystal.position.set(cx + x * half, 1.55 - d * height, 0.05);
      }
      s.label(
        vec(cx, 1.55 - height * 0.7, 0.07),
        "Stabile Tiefenschicht",
        "Mehr gelöste Stoffe erhöhen die Dichte",
      );
    }
    s.label(
      vec(cx, 1.55, 0.02),
      chemical ? "Meromiktischer See" : "See mit Vollzirkulation",
      chemical ? "Mischung im oberen Wasser" : "Austausch bis in die Tiefe",
    );
  });
  s.explain((t) =>
    t < 0.22 || t > 0.8
      ? "Sommer · warmes Oberflächenwasser. Gold bis Blau zeigt die Temperatur, helle Spuren zeigen Wasserbewegung."
      : t < 0.38
        ? "Die Oberfläche kühlt ab. Süßwasser hat bei etwa 4 °C seine größte Dichte."
        : "Bei ähnlicher Dichte kann Wind die Wassersäule mischen. Wo gelöste Stoffe das Tiefenwasser dichter halten, endet die starke Mischung an der Schichtgrenze.",
  );
}

export function gasColumn(s: Stage) {
  const pipe = s.view === "pipeCut",
    weak = s.view === "unsaturated",
    only = s.view === "dissolved";
  const height = 3.65,
    half = 3.15;
  s.look(0.3, 1.25, 14, -0.15);
  s.halfWidth = 4.65;
  s.halfHeight = 2.8;
  s.duration = 22;
  const colour = water(s, 0, half, height, true);
  s.animate((t) => colour(t, true));
  const bed = s.box(0, -2.35, -0.13, 6.35, 0.74, 0.38, 0x76695a, "Untergrund");
  bed.rotation.z = 0.012;
  s.line(
    [
      vec(-1.7, -2.65, 0.12),
      vec(-1.25, -2.38, 0.12),
      vec(-1.36, -2.16, 0.12),
      vec(-0.92, -1.91, 0.12),
    ],
    0xb49ab3,
    "Tiefer Zufluss",
  );
  s.label(
    vec(-1.08, -1.96, 0.1),
    "Gelöstes CO₂",
    "Violett ist eine qualitative Analysefarbe",
  );
  if (only) {
    s.label(
      vec(-1.58, -2.45, 0.13),
      "Zufuhr im Untergrund",
      "CO₂ kann mit tiefem Wasser in ein Becken gelangen",
    );
    s.label(
      vec(2.44, -1.34, 0.08),
      "Hoher Umgebungsdruck",
      "Die Gaslöslichkeit hängt auch von Temperatur, Partialdruck und Wasserchemie ab",
    );
    s.explain((t) =>
      t < 0.36
        ? "Bei passender Zufuhr und geringer Tiefenmischung kann sich gelöstes CO₂ anreichern."
        : "Die zusammenhängende Farbe steht für gelöstes Gas. Freie Blasen bilden sich erst bei geeigneter Übersättigung.",
    );
    return;
  }
  const cx = pipe ? 0.35 : 0;
  if (pipe) {
    for (const x of [cx - 0.44, cx + 0.44])
      s.box(x, -0.06, 0.1, 0.095, 3.78, 0.18, 0xbeb9a5, "Rohrwand");
    s.label(
      vec(cx + 0.45, -1.88, 0.22),
      "Einlass",
      "Gasreiches Tiefenwasser tritt ein",
    );
    s.label(
      vec(cx + 0.44, 1.78, 0.22),
      "Auslass",
      "Wasser und Gas verlassen das Rohr",
    );
  }
  const bubbles = Array.from({ length: 55 }, (_, i) => {
    const b = s.dot(vec(), 0xc8e6e2, 0.055, "Freie Gasblase");
    const m = b.material as T.MeshStandardMaterial;
    m.transparent = true;
    m.opacity = 0.78;
    m.roughness = 0.18;
    return b;
  });
  // Parcels enter the intake and continue flushing after the initial lift.
  const parcel = (t: number, seed: number) => {
    if (!pipe || t < 0.57) return plumeParcel(t, seed, !weak);
    const initial = plumeParcel(0.57, seed, true).rise;
    const phase = (Math.sqrt(initial) + (t - 0.57) * (1.5 + seed * 0.85)) % 1;
    const rise = phase * phase;
    return { rise, exsolved: Math.max(0, (rise - 0.18) / 0.82) };
  };
  motionLines(s, 22, 0x92e4dc, "Mitbewegtes Wasser", (i, t) => {
    const seed = (i + 0.5) / 22;
    const q = parcel(t, seed);
    const osc = Math.sin(i * 2.39);
    const amplitude = pipe
      ? 0.29 + 0.7 * (1 - smooth(q.rise, 0, 0.055))
      : 1.55 * (1 - 0.78 * q.rise);
    return vec(
      cx + osc * amplitude,
      -1.81 + 3.35 * q.rise + Math.cos(i) * 0.12,
      0.16,
    );
  });
  s.animate((t) =>
    bubbles.forEach((b, i) => {
      const seed = i / 55;
      const q = parcel(t, seed);
      b.visible =
        !weak &&
        q.exsolved > 0.015 &&
        seed < Math.min(1, 0.09 + q.exsolved * 1.1) &&
        (pipe || t < 0.98);
      b.position.set(
        cx + Math.sin(i * 2.63) * (pipe ? 0.3 : 0.32 + 0.27 * q.rise),
        -1.81 + 3.46 * q.rise,
        0.23 + 0.035 * Math.cos(i),
      );
      b.scale.setScalar(0.28 + 1.45 * q.exsolved * (0.65 + 0.35 * seed));
    }),
  );
  if (!weak) {
    const air = Array.from({ length: 16 }, (_, i) => {
      const o = s.mesh(
        new T.SphereGeometry(1, 16, 10),
        0xd4c39c,
        "CO₂-reiche Luft · Analysefarbe",
        true,
      );
      const m = o.material as T.MeshBasicMaterial;
      m.transparent = true;
      m.depthWrite = false;
      return { o, m, i };
    });
    s.animate((t) =>
      air.forEach(({ o, m, i }) => {
        const q = smooth(t, 0.73, 0.99),
          u = (i + 0.3) / 16;
        o.visible = q > u * 0.55;
        o.position.set(
          cx + (u - 0.4) * 4.4 * q,
          1.65 + 0.32 * Math.sin(i * 1.7) ** 2 + 0.18 * q,
          0.1,
        );
        o.scale.set(0.2 + 0.44 * q, 0.07 + 0.12 * u, 0.22);
        m.opacity = 0.15 * (1 - 0.45 * u) * q;
      }),
    );
  }
  if (!pipe)
    s.label(
      vec(0.2, -0.85, 0.2),
      weak ? "Wasserpaket" : "Beginnende Blasenbildung",
      weak
        ? "Das angehobene Wasser bleibt untersättigt"
        : "Bei genügend gelöstem Gas kann Druckentlastung Ausperlen auslösen",
      (t) => t > 0.25 && t < 0.8,
    );
  if (!weak)
    s.label(
      vec(cx + 0.1, 0.75, 0.24),
      "Gas-Wasser-Gemisch",
      "Wachsende Blasen verringern seine mittlere Dichte",
      (t) => t > 0.55 && t < 0.92,
    );
  s.explain((t) =>
    weak
      ? "Gegenbeispiel · Das Wasser wird angehoben. Bei diesem Gasgehalt bleibt es untersättigt. Eine selbstverstärkende Freisetzung setzt nicht ein."
      : t < 0.24
        ? pipe
          ? "Zu Beginn wird die Strömung im Rohr angestoßen."
          : "Gas kann sich über längere Zeit im Tiefenwasser ansammeln. Der historische Auslöser von 1986 ist ungeklärt."
        : t < 0.55
          ? "Aufsteigendes Wasser gelangt unter geringeren Druck. Bei genügender Sättigung entsteht eine freie Gasphase."
          : t < 0.82
            ? "Blasen wachsen. Das leichtere Gemisch steigt schneller und nimmt weiteres Wasser mit."
            : pipe
              ? "Am Auslass entweicht Gas. Über längere Zeit kann das Inventar sinken, wenn die Entnahme die Zufuhr übertrifft."
              : "CO₂ gelangt in die Atmosphäre. Die helle Analysefarbe zeigt die Gasphase über dem Wasser.",
  );
}
