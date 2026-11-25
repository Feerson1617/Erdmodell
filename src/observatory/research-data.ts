import { localAsset } from "../assets";
import { type Step, center, names } from "../tectonics/atlas";
import gnss from "./gnss.json";
import type { MapLayers } from "./globe";
import { geology } from "./boundaries";

export const atlasLayers = {
  plates: "Plattenflächen",
  bounds: "Grenztypen",
  vectors: "Relativbewegung",
  quakes: "Erdbeben",
  depth: "Herdtiefe",
  magnitude: "Magnitudensymbole",
  volcano: "Vulkanstandorte",
  hotspot: "Hotspotregionen",
  ridge: "Ozeanische Rücken",
  trench: "Subduktionsgrenzen",
  mountain: "Gebirgs- und Deformationsgürtel",
  age: "Alter des Ozeanbodens",
  magnetic: "Magnetische Anomalie",
  gnss: "GNSS-Vektoren",
  fossil: "Fossilfundregionen",
  rock: "Geologische Entsprechungen",
  ice: "Ehemalige Vereisung",
};
export type Layer = keyof typeof atlasLayers;
export type AtlasPoint = {
  lat: number;
  lon: number;
  title: string;
  detail: string;
  layer: Layer;
  azimuth?: number;
  speed?: number;
  depth?: number;
  magnitude?: number;
  year?: number;
};
const color: Partial<Record<Layer, string>> = {
  volcano: "#ff906e",
  hotspot: "#ffcc55",
  gnss: "#70f5dc",
  fossil: "#bcdf7e",
  rock: "#eab6ee",
  ice: "#a4d9f4",
  mountain: "#fedba3",
  vectors: "#fff5ad",
};
export function pointColor(p: AtlasPoint, depth: boolean) {
  return p.layer === "quakes"
    ? depth
      ? p.depth! >= 300
        ? "#ae9cff"
        : p.depth! >= 70
          ? "#ffae68"
          : "#ffe78d"
      : "#ffe78d"
    : (color[p.layer] ?? "#d3eaf0");
}
export const degree = (d: number) => ((d % 360) + 360) % 360;
export function gridValue(grid: Int16Array, lat: number, lon: number, scale: number, offset: number) {
  const x = degree(Math.round(lon) + 180),
    y = Math.max(0, Math.min(180, Math.round(90 - lat)));
  const v = grid[y * 360 + x];
  return v === -32768 ? undefined : v * scale + offset;
}
export function kinematics(step: Step, years: number) {
  const g = geology(step);
  return {
    pair: names[g.left] + " relativ zur " + names[g.right].replace(/e (Platte|Seeplatte)$/, "en $1"),
    speed: step[7],
    azimuth: step[8],
    normal: g.divergent,
    parallel: g.dextral,
    distanceKm: (step[7] * years) / 1e6,
  };
}
export async function loadResearch(m: MapLayers) {
  const json = async (path: string) => {
    const r = await fetch(localAsset(path));
    if (!r.ok) throw Error(path);
    return r.json();
  };
  const grid = async (name: string) => {
    const r = await fetch(localAsset("data/g64/" + name + ".i16"));
    if (!r.ok) throw Error(name);
    const v = new Int16Array(await r.arrayBuffer());
    if (v.length !== 360 * 181) throw Error(name);
    return v;
  };
  const [age, magnetic, volcanoes, evidence] = await Promise.all([
    grid("age"),
    grid("magnetik"),
    json("data/g64/vulkane.json") as Promise<[number, string, number, number, string][]>,
    json("data/g5/evidence.json") as Promise<{ kind: string; name: string; coords: number[][] }[]>,
  ]);
  const points: AtlasPoint[] = m.rows.map(([id, date, lon, lat, depth, magnitude, scale]) => ({
    lat,
    lon,
    layer: "quakes",
    year: Number(date.slice(0, 4)),
    title: "Erdbeben · " + date,
    detail: "USGS ComCat " + id + " · " + magnitude + " " + scale + " · " + depth + " km Herdtiefe",
    depth,
    magnitude,
  }));
  for (const [id, title, lat, lon, form] of volcanoes)
    points.push({
      lat,
      lon,
      layer: "volcano",
      title,
      detail:
        "NOAA NCEI · Vulkanstandort " +
        id +
        (form ? " · Katalogform: " + form : "") +
        ". Die Lage beschreibt keinen aktuellen Aktivitätszustand.",
    });
  for (const s of gnss) {
    const speed = Math.hypot(s.north, s.east),
      azimuth = degree((Math.atan2(s.east, s.north) * 180) / Math.PI);
    points.push({
      lat: s.lat,
      lon: s.lon,
      layer: "gnss",
      title: s.id,
      detail:
        "NGL MIDAS · " +
        speed.toLocaleString("de-DE", { maximumFractionDigits: 1 }) +
        " mm/Jahr · Azimut " +
        azimuth.toFixed(0) +
        "° · IGS14 · " +
        s.start +
        "–" +
        s.end,
      azimuth,
      speed,
    });
  }
  for (const e of evidence) {
    if (e.kind !== "rock" && e.kind !== "fossil" && e.kind !== "ice") continue;
    const [lat, lon] = e.coords[0];
    points.push({
      lat,
      lon,
      title: e.name,
      layer: e.kind,
      detail:
        e.kind === "ice" ? "Spätpaläozoische glaziale Ablagerungen. Die Markierung bezeichnet eine Beckenregion." : e.kind === "rock"
          ? "Vergleichsregion eines alten Gebirgsgürtels. Der Punkt bezeichnet einen ausgedehnten Raum."
          : "Mesosaurus-Fundregion. Die Lage bezeichnet das Sedimentbecken.",
    });
  }
  points.push(
    {
      lat: 19.4,
      lon: -155.3,
      layer: "hotspot",
      title: "Hawaii",
      detail:
        "Hotspotregion im Inneren der Pazifischen Platte. Regionaler Hinweis, keine Messposition einer tiefen Quelle.",
    },
    {
      lat: 64.8,
      lon: -17.2,
      layer: "hotspot",
      title: "Island",
      detail:
        "Rücken mit Hotspoteinfluss. Die Marke kennzeichnet die regionale Kombination beider Mechanismen.",
    },
  );
  const vectorSteps: AtlasPoint[] = [],
    occupied = new Set<string>();
  for (const step of m.steps) {
    const point = center(step),
      cell = Math.floor(point.lat / 13) + "/" + Math.floor(point.lon / 14);
    if (occupied.has(cell)) continue;
    occupied.add(cell);
    const k = kinematics(step, 1);
    vectorSteps.push({
      ...point,
      layer: "vectors",
      title: k.pair,
      detail: k.speed + " mm/Jahr · Azimut " + k.azimuth + "° · PB2002 Abschnitt " + step[0],
      azimuth: k.azimuth,
      speed: k.speed,
    });
  }
  return { age, magnetic, points: points.concat(vectorSteps) };
}
