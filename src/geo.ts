import { Vector3 } from "three";
/** All distances in km. Longitude east, latitude north, mean-radius teaching globe. */
export const R = 6371,
  RAD = Math.PI / 180;
export function basis(lat: number, lon: number) {
  const a = lat * RAD,
    b = lon * RAD;
  const up = new Vector3(
    Math.cos(a) * Math.sin(b),
    Math.sin(a),
    Math.cos(a) * Math.cos(b),
  );
  const east = new Vector3(Math.cos(b), 0, -Math.sin(b));
  return { up, east, north: up.clone().cross(east) };
}
export function position(lat: number, lon: number, height = 0) {
  const a = lat * RAD,
    b = lon * RAD,
    r = R + height,
    horizontal = r * Math.cos(a);
  return new Vector3(
    horizontal * Math.sin(b),
    r * Math.sin(a),
    horizontal * Math.cos(b),
  );
}
export const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));
/** Signed shortest distance in degrees, including longitudes after repeated world tours. */
export function angularDistance(from: number, to: number) {
  return ((to - from) % 360 + 540) % 360 - 180;
}
export function smooth(x: number) {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
}
