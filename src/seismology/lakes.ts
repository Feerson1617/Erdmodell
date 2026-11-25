import * as T from "three";
import { Stage, vec } from "./stage";
import { localAsset } from "../assets";
import local from "./ulmen-dsm.json";
import regional from "./eifel-dsm.json";
import { lakeDimensions } from "./maar-profile";
import { ramp } from "./volcanism";

export function eifelTerrain(s: Stage) {
  const wide = s.view === "eifel",
    vertical = s.view === "aerial",
    d = wide ? regional : local;
  const width = 10,
    depth = (width * d.depth) / d.width,
    min = Math.min(...d.values),
    relief = wide ? 4 : 1.6;
  const at = (i: number, j: number) =>
    (width * (d.values[j * d.n + i] - min) * relief) / d.width;
  const g = new T.PlaneGeometry(width, depth, d.n - 1, d.n - 1);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  for (let j = 0; j < d.n; j++)
    for (let i = 0; i < d.n; i++) pos.setY(j * d.n + i, at(i, j));
  g.computeVertexNormals();
  const m = s.mesh(g, 0xffffff, "Georeferenziertes Oberflächenmodell"),
    mat = m.material as T.MeshStandardMaterial;
  const texture = new T.TextureLoader().load(
    localAsset("data/vulkaneifel/" + (wide ? "eifel" : "ulmen") + ".webp"),
    () => {
      if (!s.disposed) s.refresh();
    },
  );
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  mat.map = texture;
  mat.roughness = 0.94;
  const pin = (lon: number, lat: number, name: string) => {
    const [w, south, e, n] = d.box,
      u = (lon - w) / (e - w),
      v = (n - lat) / (n - south);
    s.label(
      vec(
        (u - 0.5) * width,
        at(Math.round(u * (d.n - 1)), Math.round(v * (d.n - 1))) + 0.08,
        (v - 0.5) * depth,
      ),
      name,
    );
  };
  if (wide) {
    pin(6.9828, 50.2106, "Ulmener Maar");
    pin(6.83639, 50.1775, "Gemündener Maar");
    pin(6.85806, 50.16944, "Schalkenmehrener Maar");
    pin(7.26972, 50.41028, "Laacher See · Caldera");
  } else {
    pin(6.9828, 50.2106, "Ulmener Maar");
    pin(6.9794, 50.2097, "Ulmen · Ortskern");
    pin(6.98149, 50.20845, "Burgberg");
  }
  s.look(vertical ? 0 : 2.4, vertical ? 14 : 8, vertical ? 0.01 : 9, 0.3);
  s.halfWidth = 5.8;
  s.halfHeight = 4;
  s.explain(() =>
    wide
      ? "Vulkanfelder innerhalb der Eurasischen Platte. Mantelanomalien und tiefe Beben liefern Hinweise auf magmatische Prozesse. Die genaue Ursache bleibt Gegenstand der Forschung."
      : "Amtliches Orthofoto auf Copernicus-Oberflächenmodell. Ufer, Bebauung und Wald sind georeferenziert. Die Uferlinie folgt dem Luftbild.",
  );
}

export const lakeEvidence = [
  ["Lage", "Ulmen · Deutschland, 50,21° N", "Nyos · Kamerun, 6,44° N"],
  [
    "Klima",
    "Gemäßigt; jahreszeitliche Erwärmung und Abkühlung",
    "Tropisches Hochland; Regen- und Trockenzeit",
  ],
  [
    "Entstehung",
    "Phreatomagmatisches Maar, rund 10.900 Jahre",
    "Vulkanischer Kratersee der Kamerunlinie",
  ],
  [
    "Tiefe",
    "38 m laut LfU-Stammdaten; weitere Angaben 35 und 39 m",
    "Rund 208 m",
  ],
  [
    "Schichtung",
    "LfU: meromiktisch. Wind erreicht das Tiefenwasser nur begrenzt.",
    "Stabile Dichteunterschiede begünstigten die Gasspeicherung.",
  ],
  [
    "Wasserchemie",
    "LfU beschreibt starke Eutrophierung.",
    "Gelöste Stoffe und CO₂ beeinflussen die Dichte.",
  ],
  [
    "CO₂-Zufuhr",
    "Lokale CO₂-Zufuhr ins Tiefenwasser: Keine belastbaren Daten verfügbar",
    "Tiefes CO₂ gelangt über Zuflüsse ins Becken.",
  ],
  [
    "Gelöster Gasgehalt",
    "Keine belastbaren Daten verfügbar",
    "Tiefenprofile belegen gelöstes CO₂. Der Vorrat veränderte sich durch natürliche Zufuhr und Entgasung.",
  ],
  [
    "Gasdruck und Sättigung",
    "Keine belastbaren Daten verfügbar",
    "2001 wurden bis zu 15,6 bar Gesamtgasdruck gemessen. Für die Sättigung zählt auch der Umgebungsdruck in derselben Tiefe.",
  ],
  [
    "Beobachtung",
    "Angeln und Trinkwassergewinnung durch Uferfiltration",
    "Limnische Eruption am 21. August 1986",
  ],
  [
    "Gelände und Siedlungen",
    "Siedlung Ulmen am Kraterrand",
    "Täler unterhalb des Sees mit betroffenen Siedlungen",
  ],
  [
    "Überwachung",
    "LfU-Seenmessstelle; keine lokale CO₂-Zeitreihe im Modell",
    "Tiefenprofile und kontrollierte Entgasung seit 2001",
  ],
];
function basin(
  s: Stage,
  cx: number,
  width: number,
  depth: number,
  top: number,
  c: number,
  name: string,
) {
  const shape = new T.Shape();
  shape.moveTo(-width / 2, 0);
  for (let i = 0; i <= 72; i++) {
    const x = i / 36 - 1;
    shape.lineTo((x * width) / 2, -depth * Math.max(0, 1 - x * x) ** 0.69);
  }
  shape.lineTo(width / 2, 0);
  shape.closePath();
  const o = s.mesh(
    new T.ExtrudeGeometry(shape, { depth: 0.74, bevelEnabled: false }),
    c,
    name,
  );
  o.position.set(cx, top, -0.45);
  return o;
}
export function lakeSection(s: Stage) {
  const compare = s.view === "lakeCompare",
    mix = ["mixing", "turnover"].includes(s.view),
    gas = s.view === "dissolved";
  s.look(0.7, 2.1, 14, -0.14);
  s.halfWidth = 5.9;
  s.halfHeight = 2.55;
  if (compare) {
    const scale = 0.0043;
    for (const [cx, w, dep, name] of [
      [
        -4.25,
        lakeDimensions.ulmen.span,
        lakeDimensions.ulmen.depth,
        "Ulmener Maar",
      ],
      [1.05, lakeDimensions.nyos.span, lakeDimensions.nyos.depth, "Nyos"],
    ] as const) {
      basin(s, cx, w * scale, dep * scale, 0.6, 0x458c99, name);
      s.label(vec(cx, 0.6, 0.34), name, dep + " m");
      s.line(
        [vec(cx, 0.59, 0.35), vec(cx, 0.6 - dep * scale, 0.35)],
        0xe7d49a,
        "Tiefe",
      );
    }
    s.line(
      [vec(-4.55, -0.95, 0.35), vec(-4.55 + 100 * scale, -0.95, 0.35)],
      0xffd998,
      "100 m",
    );
    s.label(
      vec(-4.35, -0.95, 0.35),
      "100 m",
      "Gemeinsamer Horizontal- und Tiefenmaßstab",
    );
    const panel = document.createElement("section");
    panel.className = "lake-evidence";
    const field = document.createElement("select");
    field.setAttribute("aria-label", "Vergleichsmerkmal");
    lakeEvidence.forEach(([label], i) =>
      field.add(new Option(label, String(i))),
    );
    const columns = ["Ulmener Maar", "Nyos"].map((name) => {
      const article = document.createElement("div"),
        heading = document.createElement("strong"),
        value = document.createElement("span");
      heading.textContent = name;
      article.append(heading, value);
      return { article, value };
    });
    panel.append(field, ...columns.map((c) => c.article));
    s.root.append(panel);
    let selected = -1;
    const display = (index: number) => {
      if (selected === index) return;
      selected = index;
      field.value = String(index);
      columns.forEach((column, j) => {
        column.value.textContent = lakeEvidence[index][j + 1];
      });
    };
    field.onchange = () => {
      const index = field.selectedIndex;
      s.playing = false;
      s.time = (index + 0.25) / lakeEvidence.length;
      display(index);
      s.refresh();
    };
    s.animate(t => display(Math.min(lakeEvidence.length-1, Math.floor(t * lakeEvidence.length))));
    s.duration = 55;
    return;
  }
  const dep = 2.35,
    w = 8.65,
    top = 1.08;
  if (s.view === "lakeCut" || gas) {
    // Horizons terminate at the lake floor. Their geometry is explicitly conceptual.
    const bed = (x: number) =>
      Math.abs(x) <= w / 2
        ? top - dep * Math.max(0, 1 - ((2 * x) / w) ** 2) ** 0.69
        : top + 0.35 * Math.sin((Math.abs(x) - w / 2) * 3);
    for (let j = 0; j < 5; j++) {
      const rock = new T.Shape();
      for (let i = 0; i <= 100; i++) {
        const x = i * 0.106 - 5.3,
          y = bed(x) - j * 0.23;
        i ? rock.lineTo(x, y) : rock.moveTo(x, y);
      }
      for (let i = 100; i >= 0; i--) {
        const x = i * 0.106 - 5.3;
        rock.lineTo(x, bed(x) - (j + 1) * 0.23);
      }
      rock.closePath();
      const layer = s.mesh(
        new T.ExtrudeGeometry(rock, { depth: 0.9, bevelEnabled: false }),
        [0x907754, 0xb19d7b, 0x766e5e, 0x8e7663, 0x67574e][j],
        "Idealisierter Untergrund",
      );
      layer.position.z = -0.52;
    }
    if (!gas)
      s.label(
        vec(4.64, 1.35, 0.38),
        "Kraterrand",
        "Gesteinsschichten schematisch",
      );
  }
  basin(s, 0, w, dep, top, 0x296375, "Idealisiertes Becken");
  const layer = (
    level: number,
    thickness: number,
    color: number,
    name: string,
  ) => {
    const shape = new T.Shape();
    for (let k = 0; k < 2; k++) {
      for (let i = 0; i <= 48; i++) {
        const d = level + thickness * (k ? 1 - i / 48 : i / 48),
          x =
            (((k ? 1 : -1) * w) / 2) *
            Math.sqrt(Math.max(0, 1 - d ** (1 / 0.69)));
        if (!i && !k) shape.moveTo(x, top - dep * d);
        else shape.lineTo(x, top - dep * d);
      }
    }
    shape.closePath();
    return s.mesh(new T.ShapeGeometry(shape), color, name);
  };
  const bandMaterials: T.MeshStandardMaterial[] = [];
  for (let i = 0; i < 16; i++) {
    const band = layer(
      i / 16,
      1 / 16,
      new T.Color().setHSL(0.51 + i * 0.002, 0.35, 0.52 - i * 0.016).getHex(),
      "Wasserschicht",
    );
    band.position.z = 0.31;
    bandMaterials.push(band.material as T.MeshStandardMaterial);
  }
  if (mix) {
    s.animate((t) => {
      const cooling = 0.5 - 0.5 * Math.cos(t * 2 * Math.PI);
      bandMaterials.forEach((material, i) => {
        const fraction = i / 15;
        const thermal = (1 - cooling) * Math.max(0, 1 - fraction * 1.8);
        const chemical = s.view === "mixing" ? ramp(fraction, 0.35, 0.72) : 0;
        material.color.setHSL(
          0.535 - 0.43 * thermal + 0.025 * chemical,
          0.36 + 0.12 * thermal,
          0.53 + 0.09 * thermal - 0.16 * chemical,
        );
      });
    });
    s.label(
      vec(2.45, 0.7, 0.4),
      "Temperatur",
      "Warmton: wärmeres Oberflächenwasser",
      (t) => t < 0.25 || t > 0.75,
    );
    if (s.view === "mixing")
      s.label(
        vec(-1.85, -0.64, 0.4),
        "Chemische Schichtung",
        "Gelöste Stoffe erhöhen die Dichte",
      );
  }
  if (gas) {
    const channel = [
      vec(-2.5, -1.98, 0.46),
      vec(-1.87, -1.62, 0.46),
      vec(-1.33, -1.48, 0.46),
      vec(-1.12, -1.12, 0.46),
    ];
    const route = new T.CatmullRomCurve3(channel);
    s.line(channel, 0xb3a3b2, "Zuflussweg");
    const flow = Array.from({ length: 8 }, () =>
      s.dot(vec(), 0xbda7c3, 0.045, "CO₂-Zufuhr im Untergrund"),
    );
    s.animate((t) =>
      flow.forEach((marker, i) => {
        route.getPointAt((t * 2 + i / flow.length) % 1, marker.position);
      }),
    );
    s.label(channel[0], "Tiefer Zufluss", "Möglicher Eintrag von Kohlendioxid");
  }
  s.label(vec(-2.6, 0.93, 0.37), "Oberflächenwasser");
  s.label(
    vec(0.25, -0.94, 0.37),
    "Tiefenwasser",
    s.view === "turnover"
      ? "Bei Vollzirkulation in den Austausch einbezogen"
      : "dichter und schwach durchmischt",
  );
  if (mix || gas) {
    const tracers = Array.from({ length: 56 }, (_, i) =>
      s.dot(
        vec(),
        gas ? 0xc7a8d7 : 0xd8e8bb,
        0.034,
        gas ? "Gelöstes CO₂ · Konzentrationsmarker" : "Wasserbewegung",
      ),
    );
    s.animate((t) =>
      tracers.forEach((o, i) => {
        const a = i * 2.4 + t * 6.28;
        if (gas) {
          o.visible = i < 3 + t * 52;
          o.position.set(
            Math.cos(i * 3.7) * (1.1 + 0.95 * Math.sin(i) ** 2),
            -0.35 - 0.57 * Math.sin(i * 1.8) ** 2,
            0.38,
          );
        } else {
          const autumn = 0.5 - 0.5 * Math.cos(t * 6.28);
          const deep = s.view === "turnover" ? autumn : 0;
          o.position.set(
            Math.cos(a) * (1.4 + (i % 4) * 0.4),
            0.76 -
              deep * 0.78 +
              Math.sin(a) * (0.12 + 0.18 * autumn + 0.58 * deep),
            0.38,
          );
        }
      }),
    );
  }
  if (s.view === "turnover")
    s.explain((t) =>
      t > 0.28 && t < 0.74
        ? "Mit ähnlichen Dichten kann Wind Wasser bis in die Tiefe mischen. Pfeilfreie Spuren markieren Wasserteilchen."
        : "Süßwasser ist nahe 4 °C am dichtesten. Im Sommer liegt warmes, leichteres Wasser über kühlerem Wasser.",
    );
  else
    s.explain((t) =>
      mix
        ? "Die obere Wasserschicht kann sich jahreszeitlich durchmischen. Gelöste Stoffe können das Tiefenwasser dauerhaft dichter halten. Stabile Schichtung allein belegt keine CO₂-Anreicherung."
        : gas
          ? "Analysefarbe zeigt gelöstes CO₂. Hoher Druck und kühles Wasser begünstigen seine Lösung. Wasserchemie und geringe Durchmischung beeinflussen den Vorrat. Qualitatives Beispiel."
          : "Ulmener Maar · idealisierter Schnitt an der tiefsten Stelle. LfU-Stammdaten: 38 m. Profil und vertikale Überhöhung dienen der Anschauung.",
    );
}
