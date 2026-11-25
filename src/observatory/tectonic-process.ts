import relief from "./relief-samples.json";
// Bilinear sample of band-limited DEM detail. Warped coordinates move with the material.
function reliefDetail(grid: number[], x: number, z: number) {
  const col = clamp((x + 5.8) / 11.6) * 63.9999,
    row = clamp((z + 3.2) / 6.4) * 47.9999;
  const i = Math.floor(col),
    j = Math.floor(row),
    u = col - i,
    v = row - j,
    n = j * 65 + i;
  return (
    0.01 * ((grid[n] * (1 - u) + grid[n + 1] * u) * (1 - v) + (grid[n + 65] * (1 - u) + grid[n + 66] * u) * v)
  );
}
// Coordinates in the process landscapes are dimensionless. Only the spreading ruler has length units.
export const processes = {
  ridge: "Mittelozeanischer Rücken",
  rift: "Kontinentaler Grabenbruch",
  subduction: "Ozean–Kontinent-Subduktion",
  arc: "Ozeanischer Inselbogen",
  collision: "Kontinentkollision",
  transform: "Transformstörung an Land",
  oceanTransform: "Ozeanische Transformstörung",
  oblique: "Schräge Subduktion",
  complex: "Breite Deformationszone",
  hotspot: "Hotspot",
  wilson: "Wilson-Zyklus",
} as const;
export type ProcessId = keyof typeof processes;
export const explanations: Record<ProcessId, string> = {
  ridge:
    "Am Rücken steigt fester Mantel auf. Sinkender Druck lässt einen Teil schmelzen. Schmelze steigt auf und erstarrt als neue Kruste. Seitlich kühlt die Platte ab. Ihr fester Mantelanteil wird mächtiger und im Mittel dichter. Alte ozeanische Lithosphäre kann an einer anderen Grenze abtauchen.",
  rift: "Die kontinentale Kruste wird gedehnt und dünner. Zwischen Abschiebungen sinken Schollen ab.",
  subduction:
    "Die dichtere ozeanische Lithosphäre taucht ab. Wasserhaltige Minerale geben Fluide ab. Diese begünstigen partielle Schmelze im darüberliegenden Mantelkeil.",
  arc: "Eine ozeanische Platte taucht unter eine zweite. Über dem Mantelkeil kann eine Kette vulkanischer Inseln wachsen.",
  collision:
    "Nach der Schließung des Ozeans verkürzen und verdicken sich Gesteinspakete. Über einer tiefen Krustenwurzel wächst ein Gebirge.",
  transform:
    "Zwei Seiten verschieben sich aneinander vorbei. Eine ältere Gesteinsspur zeigt den bleibenden seitlichen Versatz.",
  oceanTransform:
    "Zwei Rückenabschnitte sind durch eine aktive Transformstörung verbunden. Außerhalb der Rückenachsen setzen sich inaktive Bruchzonen fort.",
  oblique:
    "Die Bewegung hat eine Komponente quer und eine längs zum Graben. Die Unterplatte taucht schräg unter die Oberplatte.",
  complex:
    "Die Bewegung verteilt sich auf mehrere Störungen und Falten. Das Modell zeigt eine mögliche Verteilung innerhalb einer breiten Zone.",
  hotspot:
    "Heißes Mantelgestein steigt auf. Bei nachlassendem Druck schmilzt es teilweise. Magma speist einen Vulkan. Die bewegte Platte trägt ältere Bauten fort. Lage, Tiefe und Bewegung der länger beständigen Quelle sind nur indirekt erschlossen.",
  wilson:
    "Ein Ozean kann sich öffnen und später schließen. Der Ablauf verbindet mögliche Stadien; die Orte sind heutige Analogien.",
};
export const wilsonStages = [
  ["Dehnung", "Kontinentale Lithosphäre wird gedehnt.", "Ostafrika"],
  ["Grabenbruch", "Zwischen Abschiebungen sinkt ein Graben ein.", "Ostafrikanischer Graben"],
  ["Junger Ozean", "Zwischen den Kontinenträndern entsteht ozeanische Kruste.", "Rotes Meer"],
  ["Rückenbildung", "Am Rücken wird auf beiden Flanken Ozeanboden angefügt.", "Mittelatlantischer Rücken"],
  ["Weites Ozeanbecken", "Alte Kruste liegt weit vom Rücken entfernt.", "Atlantik"],
  [
    "Beginnende Subduktion",
    "An einem Rand kann Lithosphäre in den Mantel abtauchen.",
    "Pazifische Subduktionsräume",
  ],
  ["Schließung", "Subduktion verbraucht mehr Ozeanboden als neu entsteht.", "Pazifische Ränder"],
  ["Kollision", "Kontinente treffen aufeinander. Die Kruste verkürzt sich.", "Indien und Eurasien"],
  ["Gebirgsbildung", "Verdickte kontinentale Kruste trägt ein Hochgebirge.", "Himalaya"],
];
export const clamp = (n: number, a = 0, b = 1) => Math.max(a, Math.min(b, n));
const gauss = (v: number, width: number) => Math.exp((-v * v) / (width * width));
function smooth(a: number, b: number, v: number) {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
}
export const subducts = (k: ProcessId) => ["subduction", "arc", "oblique"].includes(k);
export function spreading(km: number, rate: number, time = 1) {
  const age = Math.abs(km) / rate; // 1 mm/a = 1 km/Ma
  // Illustrative unequal intervals in Ma. These are not a geomagnetic polarity time scale.
  const reversals = [
    0.78, 1.03, 1.16, 1.81, 2.15, 2.49, 2.64, 3.08, 3.32, 3.69, 4.18, 4.54, 4.79, 5.24, 5.87, 6.18, 6.46,
    7.01, 7.52, 7.81, 8.42, 8.69, 9.1, 9.48, 9.76,
  ];
  return {
    age,
    polarity: reversals.filter((v) => v <= age + 1.2 * (1 - time) + 1e-10).length % 2 ? -1 : 1,
    full: rate * 2,
  };
}
export function basin(t: number) {
  return 3.65 * smooth(0.08, 0.53, t) * (1 - smooth(0.61, 0.89, t));
}
// Signed outward displacement of one continental margin, in model coordinates.
export function margin(t: number) {
  return basin(t) + 0.3 * smooth(0, 0.19, t) - 0.72 * smooth(0.84, 1, t);
}
export function wilsonMotion(t: number) {
  const change = margin(Math.min(1, t + 0.002)) - margin(Math.max(0, t - 0.002));
  const outward = Math.abs(change) < 1e-9 ? 0 : Math.sign(change);
  const spreadingRidge = t >= 0.3 && t < 0.74;
  const subduction = t >= 0.55 && t < 0.89;
  const reading =
    outward > 0
      ? "Die Kontinentränder entfernen sich."
      : outward < 0
        ? t < 0.89
          ? "Die Ränder nähern sich. Das Ozeanbecken schrumpft."
          : "Die kontinentale Kruste verkürzt und verdickt sich."
        : "Die Beckenbreite ändert sich vorübergehend kaum.";
  return {
    outward,
    spreadingRidge,
    subduction,
    reading:
      reading +
      (spreadingRidge ? " Am Rücken entsteht weiterhin Kruste." : "") +
      (subduction ? " Am rechten Rand taucht Lithosphäre ab." : ""),
  };
}
export function geologyAt(kind: ProcessId, x: number, z: number, t: number) {
  const axis = 0.14 * Math.sin(z * 1.4) + 0.055 * Math.sin(z * 3.7);
  const u = x - axis,
    a = Math.abs(u);
  const shear =
    kind === "transform" || kind === "oblique" || kind === "complex" ? Math.tanh(u * 7) * t * 1.25 : 0;
  const v = z + shear;
  const grain =
    0.095 * Math.sin(3.1 * x + 1.73 * v) * Math.sin(1.4 * x - 3.8 * v) +
    0.036 * Math.sin(8 * x + 5 * v) +
    0.018 * Math.sin(14 * x - 9 * v);
  let h = 0.27,
    crust = 0.83,
    ocean = false,
    arc = 0,
    fault = 0;
  // Branching ridgelines and incised valleys, tied to the shearing material coordinates.
  const drainage = Math.abs(Math.sin(2.9 * v + 0.83 * Math.sin(2.1 * u) + 1.7 * u));
  const crest = Math.abs(Math.sin(3.3 * u + 0.9 * Math.sin(2.4 * v) + 0.65 * v));
  const range = (0.79 + 0.21 * Math.cos(2.5 * z)) * (1 + 0.13 * Math.cos(5 * u + 3 * z));
  if (kind === "ridge") {
    ocean = true;
    h =
      -0.29 +
      0.58 * Math.exp(-a / 1.35) -
      0.23 * gauss(u, 0.14) +
      (0.11 * Math.cos(10 * (a - t * 0.67) + 0.8 * Math.sin(z * 2)) + 0.055 * Math.sin(4 * z + 3 * u)) *
        (1 - Math.exp(-a * 3));
    crust = 0.28;
    fault = gauss(u, 0.073);
  } else if (kind === "rift") {
    const width = 0.28 + 0.94 * t,
      edge = smooth(width - 0.13, width + 0.13, a);
    h =
      0.29 +
      0.33 * gauss(a - width - 0.18, 0.39) -
      (0.28 + 0.48 * t) * (1 - edge) +
      (0.11 * Math.floor(3 * smooth(width * 0.3, width, a))) / 3;
    crust = 0.89 - 0.51 * t * gauss(u, width * 1.15);
    fault = gauss(a - width, 0.07);
  } else if (subducts(kind)) {
    const arcX = 1.4 + 0.09 * Math.cos(z * 1.25),
      along = Math.pow(0.52 + 0.48 * Math.cos(3.2 * v), 1.6);
    ocean = kind === "arc" || u < -0.05;
    arc = gauss(u - arcX, 0.37) * along;
    h =
      -0.39 +
      0.72 * smooth(-0.08, 0.93, u) * (kind === "arc" ? 0.19 : 1) -
      (0.35 + 0.22 * t) * gauss(u, 0.25) +
      (0.55 + 0.63 * t) * arc;
    crust = (kind === "arc" ? 0.32 : 0.29 + 0.64 * smooth(0.08, 1.2, u)) + 0.18 * arc;
  } else if (kind === "collision" || kind === "complex") {
    const fold = 0.5 + 0.5 * Math.cos(u * (4 + t * 1.7) + 0.8 * Math.sin(v * 2));
    h =
      0.19 +
      (0.32 + 1.36 * t) *
        gauss(u, 1.35 + t * 0.68) *
        range *
        (0.43 + 0.34 * fold + 0.31 * Math.sqrt(crest) + 0.27 * Math.sqrt(drainage));
    crust = 0.79 + (0.4 + t * 0.86) * gauss(u, 1.62);
    fault = kind === "complex" ? Math.pow(Math.max(0, Math.cos(u * 4 + 0.65 * z)), 18) * gauss(u, 2.1) : 0;
  } else if (kind === "transform") {
    const marker = v - 0.33 * Math.sin(x * 1.13);
    h =
      0.28 +
      0.43 * gauss(marker, 0.3) +
      0.21 * Math.sin(x * 2 + v) * Math.cos(v * 1.7) -
      0.14 * gauss(u, 0.1);
    fault = gauss(u, 0.065);
  } else if (kind === "oceanTransform") {
    ocean = true;
    const ridge = u - (z > 0 ? 1.42 : -1.42);
    h =
      -0.46 +
      0.5 * gauss(ridge, 0.48) -
      0.19 * gauss(z, 0.11) * gauss(x, 2.8) +
      0.09 * Math.cos((x - Math.sign(z) * t * 0.6) * 6.5);
    crust = 0.27;
    fault = gauss(z, 0.084) * (Math.abs(x) < 1.42 ? 1 : 0.28);
  } else if (kind === "hotspot") {
    ocean = true;
    h = -0.54;
    crust = 0.29;
    for (let i = 0; i < 5; i++) {
      const age = i + t,
        center = -1.55 + age * 1.05;
      h += (1.04 - 0.115 * i) * gauss(x - center, 0.46 + 0.04 * i) * gauss(z - 0.25 * Math.sin(age), 0.66);
    }
    h += t * gauss(x + 1.55, 0.39) * gauss(z, 0.55);
  } else {
    const width = basin(t),
      shelf = smooth(width - 0.23, width + 0.25, a),
      collision = smooth(0.77, 1, t);
    ocean = width > 0.18 && a < width;
    h =
      0.28 -
      0.24 * gauss(a, 0.12 + 0.45 * smooth(0, 0.19, t)) * (1 - smooth(0.16, 0.29, t)) -
      (0.39 + 0.55 * smooth(0.12, 0.41, t)) * (1 - shelf) +
      0.43 * gauss(u, 0.38) * smooth(0.17, 0.4, t) * (1 - smooth(0.69, 0.75, t)) -
      0.38 * gauss(u - width + 0.1, 0.24) * smooth(0.5, 0.65, t) * (1 - smooth(0.78, 0.89, t)) +
      1.48 * collision * gauss(u, 1.48) * range;
    crust = 0.88 - 0.59 * (1 - shelf) * smooth(0.04, 0.28, t) + collision * gauss(u, 1.4);
  }
  const mountains = kind === "collision" || kind === "complex" || (kind === "wilson" && t > 0.82);
  const ridged = kind === "ridge" || kind === "oceanTransform";
  const field = mountains
    ? relief.mountain
    : ridged
      ? relief.ocean
      : kind === "hotspot"
        ? relief.island
        : subducts(kind)
          ? relief.arc
          : kind === "rift"
            ? relief.rift
            : relief.shear;
  const materialX = ridged
    ? x - Math.sign(u) * t * 0.67
    : mountains
      ? x * (1 + 0.26 * t)
      : kind === "hotspot"
        ? x - t * 1.05
        : x;
  const amplitude = mountains
    ? 0.12 + 0.5 * t * gauss(u, 2.1)
    : kind === "rift"
      ? 0.23
      : ridged
        ? 0.19
        : 0.15;
  h += reliefDetail(field, materialX, v) * amplitude;
  return { top: h + grain * (ocean ? 0.63 : 1), crust, ocean, arc, fault, u };
}
