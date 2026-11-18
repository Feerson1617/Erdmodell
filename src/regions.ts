import sites from "./sites.json";
import { clamp, R, RAD, smooth } from "./geo";
import type { Pose } from "./camera";
export type Point = [number, number];
export type Bounds = [number, number, number, number];
export interface Region {
  id: string;
  name: string;
  context: string;
  description: string;
  target: Pose;
  overview: Pick<Pose, "d" | "tilt" | "bearing">;
  bounds: Bounds;
  sources: string[];
  limits: string;
  label: string;
  validatedHazards: readonly string[];
  height:
    | { kind: "mounds"; baseM: number; riseM: number; radiusKm: Point }
    | { kind: "dsm"; file: string };
  mesh: string;
  features: string | null;
  maps: {
    base: string;
    A: string;
    B: string;
    detail?: string;
    detailBounds?: Bounds;
  };
  lod: {
    loadKm: number;
    fadeKm: Point;
    buildingsKm: number;
    fallbackKm: number;
  };
}
export const regions: ReadonlyMap<string, Region> = new Map(
  (sites as unknown as Region[]).map((r) => [r.id, r]),
);
export const firstRegion = regions.values().next().value!;
export class LocalFrame {
  xScale: number;
  zScale = R * RAD;
  constructor(readonly region: Region) {
    this.xScale = this.zScale * Math.cos(region.target.lat * RAD);
  }
  project = ([lon, lat]: Point): Point => [
    (lon - this.region.target.lon) * this.xScale,
    (this.region.target.lat - lat) * this.zScale,
  ];
  contains(lat: number, lon: number) {
    const [w, s, e, n] = this.region.bounds;
    return lon >= w && lon <= e && lat >= s && lat <= n;
  }
}
export function flattening(lat: number, lon: number) {
  for (const {
    bounds: [w, s, e, n],
  } of regions.values()) {
    const t = Math.max(
      Math.abs(2 * lon - w - e) / (e - w),
      Math.abs(2 * lat - n - s) / (n - s),
    );
    if (t < 2) return smooth(t - 1);
  }
  return 1;
}
export interface HeightGrid {
  width: number;
  height: number;
  meters: number[];
}
export function sampleGrid(grid: HeightGrid, u: number, v: number) {
  const x = clamp(u, 0, 1) * (grid.width - 1),
    y = clamp(v, 0, 1) * (grid.height - 1),
    i = Math.min(grid.width - 2, Math.floor(x)),
    j = Math.min(grid.height - 2, Math.floor(y)),
    a = grid.meters;
  return (
    ((1 - y + j) *
      ((1 - x + i) * a[j * grid.width + i] +
        (x - i) * a[j * grid.width + i + 1]) +
      (y - j) *
        ((1 - x + i) * a[(j + 1) * grid.width + i] +
          (x - i) * a[(j + 1) * grid.width + i + 1])) *
    0.001
  );
}
