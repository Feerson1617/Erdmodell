import * as T from "three";
import { Stage, vec } from "./stage";
import { lakeDimensions } from "./maar-profile";
import profiles from "./nyos-profiles.json";

const missing = "Für diese Darstellung liegen keine belastbaren Messdaten vor.";
const aspects = [
  {
    name: "Lage und Struktur",
    time: 0.22,
    ulmen:
      "Deutschland · gemäßigt. Maar vor rund 10.900 Jahren. Modell: 38 m Tiefe, Spannweite 340 m.",
    nyos: "Kamerun · tropisches Hochland. Vulkanischer Kratersee. Rund 208 m tief, Spannweite rund 1.800 m.",
  },
  {
    name: "Schichtung und Gas",
    time: 0.62,
    ulmen:
      "LfU-Einstufung meromiktisch. CO₂-Zufuhr, Tiefenprofil, Gasdruck und Sättigung: " +
      missing,
    nyos: "Tiefe Zuflüsse liefern CO₂. Historische Profile zeigen die Anreicherung. 2001 bis 15,6 bar Gesamtgasdruck. Zur Sättigung gehört der Umgebungsdruck in derselben Tiefe.",
  },
  {
    name: "Beobachtung und Maßnahmen",
    time: 0.95,
    ulmen:
      "LfU-Protokolle 2025/26: Belüftung tiefer Wasserschichten für die Gewässerqualität. Am 04.03.2026 in 30 m Tiefe 9,6 mg/L Sauerstoff.",
    nyos: "21.08.1986: limnische Eruption. Seit 2001 kontrollierte Entgasung. Tiefenprofile dokumentieren Veränderungen des Gasvorrats.",
  },
];
export function compareBasins(s: Stage) {
  s.controls.enableRotate=false;
  s.look(0, 0.2, 15, 0.2);
  s.halfWidth = 5.72;
  s.halfHeight = 2.6;
  const scale = 0.0045,
    surface = 1.2;
  for (const [cx, d, name] of [
    [-4.16, lakeDimensions.ulmen, "Ulmener Maar"],
    [0.96, lakeDimensions.nyos, "Nyos"],
  ] as const) {
    const width = d.span * scale,
      dep = d.depth * scale,
      shape = new T.Shape();
    shape.moveTo(-width / 2, 0);
    for (let i = 0; i <= 100; i++) {
      const x = i / 50 - 1;
      shape.lineTo((x * width) / 2, -dep * Math.max(0, 1 - x * x) ** 0.69);
    }
    shape.closePath();
    const bed = s.mesh(
      new T.ExtrudeGeometry(shape, { depth: 0.28, bevelEnabled: false }),
      0x518b99,
      name,
    );
    bed.position.set(cx, surface, -0.32);
    s.line(
      [vec(cx - width / 2, surface, 0.01), vec(cx + width / 2, surface, 0.01)],
      0xc1dfdd,
      "Wasserspiegel",
    );
    s.line(
      [vec(cx, surface, 0.01), vec(cx, surface - dep, 0.01)],
      0xffda93,
      "Maximale Tiefe",
    );
    s.label(vec(cx, surface + 0.04, 0.03), name, d.depth + " m");
  }
  const x = 5.16;
  s.line(
    [vec(x, surface, 0.04), vec(x, surface - 200 * scale, 0.04)],
    0xc5d8d4,
    "Tiefenachse",
  );
  for (const depth of [0, 100, 200])
    s.line(
      [
        vec(x - 0.1, surface - depth * scale, 0.04),
        vec(x + 0.1, surface - depth * scale, 0.04),
      ],
      0xc5d8d4,
      "Tiefenmarke",
    );
  s.label(
    vec(x, surface - 200 * scale, 0.04),
    "200 m",
    "Tiefenachse · Teilung 100 m",
  );
  s.line(
    [vec(-4.65, 1.94, 0.06), vec(-4.65 + 100 * scale, 1.94, 0.06)],
    0xffda93,
    "100 m",
  );
  s.label(
    vec(-4.43, 1.94, 0.06),
    "100 m",
    "Beckenprofile idealisiert · horizontal und vertikal gleicher Maßstab",
  );
  const panel = document.createElement("section");
  panel.className = "lake-evidence";
  const field = document.createElement("select");
  field.setAttribute("aria-label", "Vergleichsbereich");
  aspects.forEach((a, i) => field.add(new Option(a.name, String(i))));
  const columns = ["Ulmener Maar", "Nyos"].map((name) => {
    const article = document.createElement("div"),
      head = document.createElement("strong"),
      value = document.createElement("span");
    head.textContent = name;
    article.append(head, value);
    return { article, value };
  });
  panel.append(field, ...columns.map((c) => c.article));
  s.root.append(panel);
  let selected = -1;
  const show = (i: number) => {
    if (selected === i) return;
    selected = i;
    field.value = String(i);
    columns[0].value.textContent = aspects[i].ulmen;
    columns[1].value.textContent = aspects[i].nyos;
  };
  field.onchange = () => {
    const i = field.selectedIndex;
    show(i);
    s.time = aspects[i].time;
    s.refresh();
  };
  // Preserve the original saved comparison position across the three groups.
  s.animate((t) => show(t < 4 / 12 ? 0 : t < 9 / 12 ? 1 : 2));
}
export function historicalProfiles(s: Stage) {
  s.controls.enableRotate=false;
  const conductivity = s.view === "conductivity",
    max = conductivity ? 1800 : 400;
  s.look(0, 0, 14, 0);
  s.halfWidth = 5.3;
  s.halfHeight = 2.64;
  const c = document.createElement("canvas");
  c.width = 1400;
  c.height = 720;
  const ctx = c.getContext("2d")!,
    x = (v: number) => 154 + (v / max) * 1100,
    y = (d: number) => 142 + (d / 210) * 484;
  ctx.fillStyle = "#1a3237";
  ctx.fillRect(0, 0, 1400, 720);
  ctx.font = "bold 38px system-ui";
  ctx.fillStyle = "#f4f2dc";
  ctx.fillText(
    conductivity
      ? "Elektrische Leitfähigkeit bei 25 °C"
      : "Gelöstes CO₂ im Tiefenprofil",
    65,
    62,
  );
  ctx.font = "27px system-ui";
  ctx.fillStyle = "#c4d9d4";
  ctx.fillText(conductivity ? "µS/cm" : "mmol/kg Wasser", 151, 114);
  ctx.fillText("Tiefe (m)", 16, 113);
  for (const d of [0, 50, 100, 150, 200]) {
    ctx.fillText(String(d), 55, y(d) + 9);
    ctx.strokeStyle = "#4f6669";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x(0), y(d));
    ctx.lineTo(x(max), y(d));
    ctx.stroke();
  }
  for (let i = 0; i <= 4; i++) {
    const v = (max * i) / 4;
    ctx.fillText(String(v), x(v) - 14, 672);
    ctx.beginPath();
    ctx.moveTo(x(v), y(0));
    ctx.lineTo(x(v), y(210));
    ctx.stroke();
  }
  profiles.forEach((series, i) => {
    const colour = i ? "#ebae79" : "#82d4db";
    ctx.lineWidth = 4;
    ctx.strokeStyle = ctx.fillStyle = colour;
    ctx.setLineDash(i ? [13, 7] : []);
    ctx.beginPath();
    for (const [j, p] of series.samples.entries()) {
      const px = x(p[conductivity ? 1 : 2]),
        py = y(p[0]);
      if (j === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    series.samples.forEach((p) => {
      const px = x(p[conductivity ? 1 : 2]),
        py = y(p[0]);
      ctx.beginPath();
      if (i) {
        ctx.moveTo(px, py - 7);
        ctx.lineTo(px - 6, py + 5);
        ctx.lineTo(px + 6, py + 5);
        ctx.closePath();
      } else ctx.arc(px, py, 5.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillText((i ? "▲ " : "● ") + series.date, 635 + i * 300, 109);
  });
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  const graph = s.mesh(
    new T.PlaneGeometry(9.8, 5.04),
    0xffffff,
    "Publizierte Tiefenprofile",
    true,
  );
  (graph.material as T.MeshBasicMaterial).map = tex;
  const sample=profiles[0].samples[2];
  s.label(vec((x(sample[conductivity?1:2])/1400-.5)*9.8,(.5-y(sample[0])/720)*5.04,.025),
    "Tabellenwert", "November 1993 · 50 m Tiefe",()=>document.body.dataset.infoDepth==="observe");

  s.explain(() =>
    conductivity
      ? "Leitfähigkeit beschreibt gelöste Ionen. Die beiden Jahre zeigen eigene Messreihen."
      : "1993 vor und 2006 während der Entgasung. Tabelle 3 enthält Messungen und aus Leitfähigkeit abgeleitete CO₂-Werte. Keine vergleichbare Ulmener CO₂-Kurve im Modell.",
  );
}
