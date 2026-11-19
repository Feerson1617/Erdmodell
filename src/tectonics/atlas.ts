import * as T from "three";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { position, R, RAD, basis } from "../geo";
import { project } from "../annotations";
import stepsUrl from "./steps.json?url";
import areasUrl from "./plates.png";
import sites from "./labels.json";
import { drape, type Elevation } from "./surface";

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
export const boundaryColors = {
  divergent: 0x79d6cb,
  convergent: 0xf0a16f,
  transform: 0xc2adee,
};
export type BoundaryKind = keyof typeof boundaryColors;
export const kindName = {
  divergent: "Divergenz",
  convergent: "Konvergenz",
  transform: "Transformbewegung",
};
const kinds: Record<string, BoundaryKind> = {
  OSR: "divergent", CRB: "divergent",
  SUB: "convergent", CCB: "convergent", OCB: "convergent",
  CTF: "transform", OTF: "transform",
};
export function typeOf(code: string): BoundaryKind {
  const kind = kinds[code];
  if (!kind) throw Error("Unbekannter PB2002-Grenztyp.");
  return kind;
}
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


type Site = "island" | "japan" | "san";
const major = ["PA", "EU", "NA", "SA", "AF", "AN", "AU", "IN"];
const plateCodes = Object.keys(sites).sort();
const regionalLabels: Record<Site, Record<string, T.Vector3>> = {
  island: { EU: position(63.88, -18.65, 2), NA: position(64.55, -24.7, 2) },
  japan: { PA: position(38.18, 146.15, 2), OK: position(38.7, 141.55, 2) },
  san: { NA: position(36.5, -118.75, 2), PA: position(35.3, -122, 2) },
};
const labels = [...major, ...plateCodes.filter(code => !major.includes(code))].map(code => {
  const [lon, lat] = sites[code as keyof typeof sites];
  return { code, name: names[code], point: position(lat, lon, 2) };
});

type Label = { code: string; name: string; x: number; y: number };
function projectLabels(camera: T.Camera, width: number, height: number, distance: number, site?: Site, selected = "", picked?: T.Vector3, single = false, small = false) {
  const visible: Label[] = [];
  const regional = site && distance < 4000 ? regionalLabels[site] : undefined;
  const ordered = selected ? [...labels.filter(l => l.code === selected), ...labels.filter(l => l.code !== selected)] : labels;
  for (const {code,name,point} of ordered) {
    if (single && code !== selected) continue;
    if (!small && code !== selected && distance >= 5000 && !major.includes(code)) continue;
    const anchor = code === selected && picked ? picked : regional?.[code] ?? point;
    if (anchor.dot(camera.position) <= anchor.lengthSq()) continue;
    const xy = project(anchor,camera,width,height);
    if (xy) visible.push({code,name,...xy});
  }
  return visible;
}

type Arc = { step: Step; a: T.Vector3; b: T.Vector3; normal: T.Vector3; radians: number };

function boundaryVertices(arc: Arc, elevation: Elevation) {
  const coordinates: number[] = [];
  const divisions = Math.max(1, Math.ceil(arc.radians / (0.5 * RAD)));
  const p = new T.Vector3();
  for (let i = 0; i <= divisions; i++) {
    // These short great-circle steps interpolate correctly across the date line.
    p.lerpVectors(arc.a, arc.b, i / divisions).normalize();
    const lat = Math.asin(p.y) / RAD, lon = Math.atan2(p.x, p.z) / RAD;
    p.multiplyScalar(R + elevation(lat, lon) + 2.3);
    if (i > 0) coordinates.push(p.x, p.y, p.z);
    if (i < divisions) coordinates.push(p.x, p.y, p.z);
  }
  return coordinates;
}

function makeLine(geometry: LineSegmentsGeometry, color: number, width: number, order: number) {
  const material = new LineMaterial({
    color, linewidth: width, toneMapped: false, transparent: true, depthWrite: false,
  });
  const line = new LineSegments2(geometry, material);
  line.renderOrder = order;
  return line;
}

export async function loadAtlas(elevation: Elevation = () => 0) {
  const [response, texture] = await Promise.all([
    fetch(stepsUrl), new T.TextureLoader().loadAsync(areasUrl),
  ]);
  if (!response.ok) {
    texture.dispose();
    throw Error("Die lokalen Plattengrenzen fehlen.");
  }
  const steps: Step[] = await response.json();
  const group = new T.Group();
  group.name = "PB2002";
  group.visible = false;
  const pools: Record<BoundaryKind, number[]> = { divergent: [], convergent: [], transform: [] };
  const arcs = steps.map(step => {
    const a = position(step[4], step[3]).normalize(), b = position(step[6], step[5]).normalize();
    const arc = { step, a, b, normal: new T.Vector3().crossVectors(a, b).normalize(), radians: a.angleTo(b) };
    pools[typeOf(step[2])].push(...boundaryVertices(arc, elevation));
    return arc;
  });
  const types = (Object.keys(pools) as BoundaryKind[]).map(kind => {
    const geometry = new LineSegmentsGeometry().setPositions(pools[kind]);
    const line = makeLine(geometry, 0xe1ead5, 3.6, 3);
    // One draw per category. A dark outer stroke keeps ice and desert boundaries legible.
    line.material.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float edge = length(vec2(vUv.x, max(abs(vUv.y) - 1., 0.)));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.02, .031, .03), smoothstep(.5, .8, edge));`,
      );
    };
    group.add(line);
    return { kind, line };
  });

  // Plate IDs are categorical. Bilinear or mipmap filtering would invent false plates.
  texture.minFilter = texture.magFilter = T.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = T.NoColorSpace;
  const regionId = { value: -1 };
  const fillMaterial = new T.MeshBasicMaterial({
    map: texture, color: 0xc1e995, opacity: 0.32, transparent: true,
    depthWrite: false, toneMapped: false,
  });
  fillMaterial.onBeforeCompile = shader => {
    shader.uniforms.plateId = regionId;
    shader.fragmentShader = "uniform float plateId;\n" + shader.fragmentShader.replace(
      "#include <map_fragment>",
      "if (abs(texture2D(map, vMapUv).r * 255.0 - plateId) > 0.5) discard;",
    );
  };
  const fill = new T.Mesh(drape(new T.SphereGeometry(R, 360, 180).rotateY(-Math.PI / 2), elevation, 1.8), fillMaterial);
  fill.renderOrder = 1;
  fill.visible = false;
  group.add(fill);
  const selected = makeLine(new LineSegmentsGeometry().setPositions([0, 0, 0, 0, 0, 0]), 0xfff6c6, 6, 4);
  selected.visible = false;
  group.add(selected);
  let active: Step | null = null;
  let filter: BoundaryKind | null = null;
  let enabled = false;
  let opacity = 1;

  function selectStep(step: Step | null) {
    if (step && step !== active) {
      selected.geometry.dispose();
      selected.geometry = new LineSegmentsGeometry().setPositions(boundaryVertices(arcs[step[0] - 1], elevation));
    }
    active = step;
    selected.visible = !!active && (!filter || typeOf(active[2]) === filter);
  }
  function setLayers(visible: boolean, typed: boolean, category: BoundaryKind | null, plate: string | null) {
    enabled = visible;
    group.visible = enabled && opacity > 0;
    filter = category;
    for (const { kind, line } of types) {
      line.visible = !category || category === kind;
      line.material.color.setHex(typed || category ? boundaryColors[kind] : 0xe1ead5);
    }
    regionId.value = plate ? plateCodes.indexOf(plate) + 1 : 0;
    fill.visible = regionId.value > 0;
    selectStep(active);
  }

  // Sample the same categorical raster and orientation as the selected fill.
  // Allocate the readable image only for a geographical area pick.
  let platePixels: CanvasRenderingContext2D | null = null;
  function plateAt(point: T.Vector3) {
    if (!platePixels) {
      const canvas = document.createElement("canvas");
      canvas.width = texture.image.width;
      canvas.height = texture.image.height;
      platePixels = canvas.getContext("2d",{willReadFrequently:true});
      if (!platePixels) return "";
      platePixels.drawImage(texture.image,0,0);
    }
    const {width,height} = platePixels.canvas;
    const u = (Math.atan2(point.x,point.z)/RAD + 180)/360;
    const v = (90-Math.asin(point.y)/RAD)/180;
    const x = Math.floor(u*width)%width, y = Math.min(height-1,Math.max(0,Math.floor(v*height)));
    return plateCodes[platePixels.getImageData(x,y,1,1).data[0]-1] ?? "";
  }
  function setOpacity(fraction: number) {
    const value = Math.max(0, Math.min(1, fraction));
    if (opacity === value) return;
    opacity = value;
    group.visible = enabled && opacity > 0;
    for (const { line } of types) line.material.opacity = opacity;
    selected.material.opacity = opacity;
    fillMaterial.opacity = 0.32 * opacity;
  }

  /** Distance to the finite great-circle segment rather than just its midpoint. */
  function pick(point: T.Vector3, maxAngleRad: number): Step | null {
    if (!group.visible) return null;
    const p = point.clone().normalize(), projected = new T.Vector3(), cross = new T.Vector3();
    let best = Math.cos(maxAngleRad), hit: Step | null = null;
    for (const arc of arcs) {
      if (filter && typeOf(arc.step[2]) !== filter) continue;
      let score = Math.max(p.dot(arc.a), p.dot(arc.b));
      projected.copy(p).addScaledVector(arc.normal, -p.dot(arc.normal)).normalize();
      if (arc.radians > 1e-9 && cross.crossVectors(arc.a, projected).dot(arc.normal) >= 0 &&
          cross.crossVectors(projected, arc.b).dot(arc.normal) >= 0) {
        score = Math.max(score, p.dot(projected));
      }
      if (score > best) { best = score; hit = arc.step; }
    }
    return hit;
  }
  return { group, steps, setLayers, setOpacity, selectStep, pick, plateAt, labels: projectLabels };
}
