import type { ProcessId } from "./tectonic-process";

export type ProcessPlace = {
  name: string;
  space: string;
  lat: number;
  lon: number;
  model: ProcessId;
  step?: number;
  site?: "san" | "himalaya" | "rift" | "hawaii" | "island";
  bathy?: boolean;
};
export const places: Record<string, ProcessPlace> = {
  tonga: {
    name: "Tongagraben",
    space: "Pazifik",
    lat: -20.395,
    lon: -173.3105,
    model: "arc",
    step: 1510,
    bathy: true,
  },
  peru: {
    name: "Anden · Peru",
    space: "Südamerika",
    lat: -13.2,
    lon: -78.28,
    model: "subduction",
    step: 3109,
  },
  sumatra: {
    name: "Sundagraben · Sumatra",
    space: "Indischer Ozean",
    lat: -2.34,
    lon: 98.59,
    model: "oblique",
    step: 3757,
  },
  gakkel: {
    name: "Gakkelrücken",
    space: "Arktis",
    lat: 85.7035,
    lon: 79.753,
    model: "ridge",
    step: 2308,
    bathy: true,
  },
  island: {
    name: "Reykjanes",
    space: "Nordatlantik",
    lat: 63.88,
    lon: -22.45,
    model: "ridge",
    step: 4209,
    site: "island",
  },
  rift: {
    name: "Ostafrikanischer Graben · Natronsee",
    space: "Afrika",
    lat: -2.59,
    lon: 35.95,
    model: "rift",
    site: "rift",
  },
  himalaya: {
    name: "Himalaya · Zentralnepal",
    space: "Asien",
    lat: 28.1,
    lon: 84.8,
    model: "collision",
    site: "himalaya",
    step: 2093,
  },
  san: {
    name: "San-Andreas-Störung · Parkfield",
    space: "Nordamerika",
    lat: 35.877,
    lon: -120.43,
    model: "transform",
    site: "san",
    step: 2877,
  },
  romanche: {
    name: "Romanche-Transformstörung",
    space: "Atlantik",
    lat: -0.021,
    lon: -18.129,
    model: "oceanTransform",
    step: 668,
  },
  zagros: {
    name: "Zagros-Falten- und Überschiebungsgürtel",
    space: "Asien",
    lat: 28.78,
    lon: 51.14,
    model: "complex",
    step: 1360,
  },
  hawaii: { name: "Hawaii", space: "Pazifik", lat: 20.6, lon: -156.3, model: "hotspot", site: "hawaii" },
  redsea: { name: "Rotes Meer", space: "Afrika und Arabien", lat: 20, lon: 38.6, model: "wilson" },
  atlantic: { name: "Mittelatlantischer Rücken", space: "Atlantik", lat: 25, lon: -45, model: "ridge" },
};
export const referenceFor: Record<ProcessId, string> = {
  ridge: "gakkel",
  rift: "rift",
  subduction: "peru",
  arc: "tonga",
  collision: "himalaya",
  transform: "san",
  oceanTransform: "romanche",
  oblique: "sumatra",
  complex: "zagros",
  hotspot: "hawaii",
  wilson: "rift",
};
export const wilsonPlaces = [
  "rift",
  "rift",
  "redsea",
  "atlantic",
  "atlantic",
  "tonga",
  "peru",
  "himalaya",
  "himalaya",
];
export const regions: Record<string, [number, number]> = {
  Pazifik: [-12, -156],
  Asien: [34, 86],
  Afrika: [2, 23],
  Europa: [52, 15],
  Atlantik: [5, -30],
  "Indischer Ozean": [-12, 82],
  Arktis: [72, 40],
  Nordatlantik: [54, -30],
  Nordamerika: [43, -105],
  Südamerika: [-17, -64],
  "Afrika und Arabien": [21, 37],
};
export const isContinent = (name: string) => ["Europa", "Asien", "Afrika", "Südamerika", "Nordamerika"].includes(name);
