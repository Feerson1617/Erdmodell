import * as T from "three";
import { sectionExtent } from "./section-window";
import { R, RAD, smooth } from "../geo";
import type { Elevation } from "./surface";

export interface ImageBounds {
  west: number;
  north: number;
  width: number;
  height: number;
}
export interface LandscapeImage {
  bounds: ImageBounds;
  map: T.Texture;
}

/** Join the sides and rear of the teaching section to the geographical image.
 * The front remains open so the section and moving material can be observed.
 */
export function landscapeEdge(
  group: T.Group,
  bedrock: T.Mesh[],
  elevation: Elevation,
  image?: LandscapeImage,
) {
  const positions: number[] = [],
    colors: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  const blend: number[] = [];
  const vertices = 80,
    bands = 6;
  const up = new T.Vector3(0, 1, 0).transformDirection(group.matrixWorld);
  const ray = new T.Raycaster();
  for (let i = 0; i <= vertices; i++) {
    const angle = (i / vertices) * 2 * Math.PI;
    const nx = Math.cos(angle),
      nz = Math.sin(angle);
    const edge = 1 / Math.max(Math.abs(nx), Math.abs(nz));
    const x = 21 * edge * nx,
      z = 9 * edge * nz;
    const start = group.localToWorld(new T.Vector3(x * 0.992, 25, z * 0.992));
    ray.set(start, up.clone().negate());
    const hits = ray.intersectObjects(bedrock, false);
    const roof = hits.length ? 25 - hits[0].distance : 7;
    const front = smooth((z / 9 - 0.38) / 0.62);
    const inner = Math.max(0.04, roof * (1 - front) - 0.13);
    // The upper surface meets the mosaic at the sides and rear. In front a long,
    // shallow approach reveals the geology below the surrounding ground level.
    const outerX = (sectionExtent.side + 1) * edge * nx;
    const outerZ =
      (nz > 0 ? sectionExtent.front + 1 : sectionExtent.back + 1) * edge * nz;
    for (let j = 0; j <= bands; j++) {
      const t = j / bands,
        px = T.MathUtils.lerp(x, outerX, t),
        pz = T.MathUtils.lerp(z, outerZ, t);
      const site = group.localToWorld(new T.Vector3(px, 0, pz));
      const lat = Math.asin(site.y / site.length()) / RAD,
        lon = Math.atan2(site.x, site.z) / RAD;
      site.setLength(R + elevation(lat, lon) + 0.81);
      const ground = group.worldToLocal(site).y;
      const y =
        T.MathUtils.lerp(inner, ground, smooth(t / 0.72)) +
        0.22 * Math.sin(angle * 15) * Math.sin(t * Math.PI);
      positions.push(px, y, pz);
      const shade =
        0.82 + 0.15 * t + 0.03 * Math.cos(angle * 17) * Math.sin(t * Math.PI);
      colors.push(shade, shade, shade, 1 - smooth((t - 0.83) / 0.17));
      if (image) {
        const b = image.bounds;
        uvs.push((lon - b.west) / b.width, 1 - (b.north - lat) / b.height);
      }
      blend.push(
        image ? front * 0.72 + (1 - front * 0.72) * smooth(t / 0.68) : 0,
      );
      if (i && j) {
        const a = i * (bands + 1) + j;
        indices.push(a, a - 1, a - bands - 2, a, a - bands - 2, a - bands - 1);
      }
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new T.Float32BufferAttribute(colors, 4));
  g.setAttribute("edgeBlend", new T.Float32BufferAttribute(blend, 1));
  if (image) g.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
