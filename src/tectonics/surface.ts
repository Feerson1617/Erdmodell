import * as T from "three";
import { R, RAD } from "../geo";

export type Elevation = (lat: number, lon: number) => number;

/** Apply the same reference radius and sampled land relief as the terrain tiles. */
export function drape(geometry: T.SphereGeometry, elevation: Elevation, offset: number) {
  const vertices = geometry.getAttribute("position");
  const direction = new T.Vector3();
  for (let i = 0; i < vertices.count; i++) {
    direction.fromBufferAttribute(vertices, i).normalize();
    const lat = Math.asin(direction.y) / RAD;
    const lon = Math.atan2(direction.x, direction.z) / RAD;
    direction.multiplyScalar(R + elevation(lat, lon) + offset);
    vertices.setXYZ(i, direction.x, direction.y, direction.z);
  }
  geometry.computeBoundingSphere();
  return geometry;
}
