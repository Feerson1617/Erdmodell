import * as T from "three";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { position, R, RAD, basis } from "../geo";
import stepsUrl from "./steps.json?url";
import areasUrl from "./plates.png";

export type Step = [
  id: number,
  plates: string,
  kind: string,
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
  speed: number,
  azimuth: number,
];
export const names: Record<string, string> = {
  AF: "Afrikanische Platte",
  AN: "Antarktische Platte",
  SO: "Somalische Platte",
  IN: "Indische Platte",
  AU: "Australische Platte",
  EU: "Eurasische Platte",
  NA: "Nordamerikanische Platte",
  SA: "Südamerikanische Platte",
  NZ: "Nazca-Platte",
  PA: "Pazifische Platte",
  AR: "Arabische Platte",
  SU: "Sundaplatte",
  TI: "Timorplatte",
  KE: "Kermadecplatte",
  TO: "Tongaplatte",
  NI: "Niuafo’ou-Platte",
  WL: "Woodlarkplatte",
  MO: "Maokeplatte",
  SB: "Süd-Bismarck-Platte",
  SS: "Salomonenseeplatte",
  NB: "Nord-Bismarck-Platte",
  NH: "Neue-Hebriden-Platte",
  CA: "Karibische Platte",
  CO: "Cocosplatte",
  OK: "Ochotskplatte",
  JF: "Juan-de-Fuca-Platte",
  AP: "Altiplanoplatte",
  ND: "Nordandenplatte",
  ON: "Okinawaplatte",
  PS: "Philippinische Seeplatte",
  AM: "Amurplatte",
  CL: "Karolinenplatte",
  MA: "Marianenplatte",
  FT: "Futunaplatte",
  SC: "Scotiaplatte",
  SL: "Shetlandplatte",
  AS: "Ägäische Platte",
  AT: "Anatolische Platte",
  YA: "Yangtze-Platte",
  BU: "Burmaplatte",
  RI: "Riveraplatte",
  BH: "Vogelkopfplatte",
  MS: "Molukkenseeplatte",
  BS: "Banda-Platte",
  MN: "Manusplatte",
  CR: "Conway-Riff-Platte",
  BR: "Balmoral-Riff-Platte",
  EA: "Osterplatte",
  JZ: "Juan-Fernández-Platte",
  GP: "Galápagosplatte",
  SW: "Süd-Sandwich-Platte",
  PM: "Panamaplatte",
};
export const regions = {
  island: {
    title: "Island · Reykjanes",
    id: 4209,
    distance: 1250,
    text: "Der Mittelatlantische Rücken tritt auf Island über den Meeresspiegel. Beim Auseinanderdriften steigt Mantelmaterial auf. Druckentlastung ermöglicht partielle Schmelze. An ozeanischen Rücken wächst neue ozeanische Lithosphäre. Auf Island trägt auch ein Hotspot zum Vulkanismus bei.",
  },
  japan: {
    title: "Japan · Tōhoku",
    id: 2629,
    distance: 1750,
    text: "Am Japangraben vor Nordost-Honshū taucht die ozeanische Pazifische Platte unter die Ochotskplatte. Verhakung und plötzlicher Versatz können starke Seebeben auslösen. Der Pfeil zeigt die horizontale Komponente der Plattenbewegung.",
  },
  san: {
    title: "Kalifornien · San Andreas",
    id: 2877,
    distance: 1500,
    text: "Nahe Parkfield gleiten Pazifische und Nordamerikanische Platte rechtsseitig aneinander vorbei. Die Bewegung verteilt sich auf mehrere Störungen. Die Relativgeschwindigkeit des Plattenpaars ist deshalb größer als die örtliche Gleitrate einzelner Störungsabschnitte.",
  },
};
const colors = {
  divergent: 0x77ebde,
  convergent: 0xffa277,
  transform: 0xe6c65e,
};
export const typeOf = (kind: string) =>
  kind === "OSR" || kind === "CRB"
    ? "divergent"
    : kind === "OTF" || kind === "CTF"
      ? "transform"
      : "convergent";
export const kindName = {
  divergent: "Divergenz",
  convergent: "Konvergenz",
  transform: "Transformbewegung",
};
export function center(step: Step) {
  const point = position(step[4], step[3])
    .add(position(step[6], step[5]))
    .normalize();
  return {
    lat: Math.asin(point.y) / RAD,
    lon: Math.atan2(point.x, point.z) / RAD,
  };
}
export function arrowPoints(step: Step) {
  const { lat, lon } = center(step);
  const { up, east, north } = basis(lat, lon);
  const az = step[8] * RAD;
  const a = up.multiplyScalar(R + 18);
  return [
    a,
    a
      .clone()
      .addScaledVector(east, Math.sin(az) * 10)
      .addScaledVector(north, Math.cos(az) * 10),
  ];
}

export async function loadAtlas() {
  const [response, texture] = await Promise.all([
    fetch(stepsUrl),
    new T.TextureLoader().loadAsync(areasUrl),
  ]);
  if (!response.ok) throw Error("Plattengrenzen fehlen.");
  const steps: Step[] = await response.json();
  const lines = new T.Group();
  const pools: Record<keyof typeof colors, number[]> = {
    divergent: [],
    convergent: [],
    transform: [],
  };
  for (const step of steps) {
    const points = pools[typeOf(step[2])];
    points.push(
      ...position(step[4], step[3], 18).toArray(),
      ...position(step[6], step[5], 18).toArray(),
    );
  }
  for (const id of Object.keys(colors) as (keyof typeof colors)[]) {
    const geo = new LineSegmentsGeometry().setPositions(pools[id]);
    const mat = new LineMaterial({
      color: colors[id],
      linewidth: 2.6,
      toneMapped: false,
    });
    lines.add(new LineSegments2(geo, mat));
  }
  texture.colorSpace = T.SRGBColorSpace;
  const areas = new T.Mesh(
    new T.SphereGeometry(R + 15, 256, 144).rotateY(-Math.PI / 2),
    new T.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  areas.renderOrder = 1;
  return { steps, areas, lines };
}
