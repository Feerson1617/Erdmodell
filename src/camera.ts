import { PerspectiveCamera, Vector3 } from "three";
import { R, RAD, basis, clamp, smooth } from "./geo";
export const HOME = { lat: 18, lon: 19, d: 14450, tilt: 0, bearing: 0 };
export type Pose = typeof HOME;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const angle = (a: number, b: number) => ((b - a + 540) % 360) - 180;
export class CameraController {
  readonly camera = new PerspectiveCamera(39, 1, 0.01, 60000);
  readonly reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  pose = { ...HOME };
  goal = { ...HOME };
  orbit = false;
  orbitMinimum = 38;
  inputRevision = 0;
  flight?: { from: Pose; to: Pose; start: number; ms: number; cruise: number; paced: boolean; elapsed: number; last: number };
  private pointers = new Map<number, { x: number; y: number }>();
  private drag = 0;
  onPick?: (x: number, y: number) => void;
  constructor(private canvas: HTMLCanvasElement) {
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.zoom(
          Math.exp(
            clamp(e.deltaY * (e.deltaMode === 1 ? 0.025 : 0.0015), -1, 1),
          ),
        );
      },
      { passive: false },
    );
    canvas.oncontextmenu = (e) => e.preventDefault();
    canvas.onpointerdown = (e) => {
      this.stop();
      canvas.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.drag = 0;
    };
    canvas.onpointermove = (e) => {
      const prev = this.pointers.get(e.pointerId);
      if (!prev) return;
      const other = [...this.pointers].find(([k]) => k !== e.pointerId)?.[1];
      const x = e.clientX,
        y = e.clientY,
        dx = x - prev.x,
        dy = y - prev.y;
      this.drag += Math.hypot(dx, dy);
      if (other) {
        const a = Math.hypot(other.x - prev.x, other.y - prev.y),
          b = Math.hypot(other.x - x, other.y - y);
        if (a > 5 && b > 5) this.zoom(a / b);
        this.goal.tilt = clamp(this.goal.tilt + dy * 0.18, 0, 75);
      } else if (e.shiftKey || e.buttons === 2) {
        this.goal.bearing -= dx * 0.3;
        this.goal.tilt = clamp(this.goal.tilt + dy * 0.22, 0, 75);
      } else this.pan(dx, dy);
      this.pointers.set(e.pointerId, { x, y });
    };
    canvas.onpointerup = (e) => {
      if (this.drag < 4 && this.pointers.size === 1)
        this.onPick?.(e.clientX, e.clientY);
      this.pointers.delete(e.pointerId);
    };
    canvas.onpointercancel = (e) => this.pointers.delete(e.pointerId);
  }
  stop() {
    this.inputRevision++;
    if (this.flight) {
      this.goal = { ...this.pose };
      this.flight = undefined;
    }
  }
  zoom(f: number) {
    this.stop();
    this.goal.d = clamp(this.goal.d * f, this.orbit ? this.orbitMinimum : 0.06, 35000);
  }
  pan(dx: number, dy: number) {
    this.stop();
    if (this.orbit) {
      this.goal.bearing -= dx * 0.32;
      this.goal.tilt = clamp(this.goal.tilt + dy * 0.25, 8, 75);
      return;
    }
    const scale =
      (Math.min(1.8, this.goal.d / R) * 52) / this.canvas.clientHeight;
    const a = this.goal.bearing * RAD;
    this.goal.lon -=
      ((dx * Math.cos(a) + dy * Math.sin(a)) * scale) /
      Math.max(0.09, Math.cos(this.goal.lat * RAD));
    this.goal.lat = clamp(
      this.goal.lat + (dy * Math.cos(a) - dx * Math.sin(a)) * scale,
      -89.7,
      89.7,
    );
  }
  fly(to: Pose, paced = false, minimumMs = 950) {
    const from = this.pose;
    const separation = R * Math.acos(clamp(
      basis(from.lat, from.lon).up.dot(basis(to.lat, to.lon).up), -1, 1,
    ));
    // Rise before crossing distant sites. Near-island flights keep their original route.
    const cruise = separation > 10 && Math.max(from.d, to.d) < separation / 3
      ? Math.min(separation * 0.8, 10500)
      : 0;
    const now = performance.now();
    this.flight = {
      cruise, paced, elapsed: 0, last: now,
      from: { ...this.pose },
      to: { ...to },
      start: now,
      ms: this.reducedMotion.matches
        ? 0
        : clamp(Math.max(Math.abs(Math.log(from.d / to.d)) * 590, cruise * 0.55), minimumMs, 6400),
    };
  }
  update(
    now: number, dt: number, heightAt: (pose: Pose) => number,
    terrainBelowEye?: (lat: number, lon: number) => number | null,
    holdPacedFlight = false,
  ) {
    if (this.flight) {
      const { from: a, to: b, start, ms, cruise } = this.flight;
      // Do not skip an entire regional LOD when the first GPU upload takes a long frame.
      if (!holdPacedFlight) this.flight.elapsed += clamp(now - this.flight.last, 0, 125);
      this.flight.last = now;
      const elapsed = this.flight.paced ? this.flight.elapsed : now - start;
      const p = ms ? clamp(elapsed / ms, 0, 1) : 1,
        t = smooth(p);
      // Arrive over the target region before descending. On ascent clear the region first.
      const geo =
        b.d < a.d
          ? smooth(clamp(p / 0.44, 0, 1))
          : smooth(clamp((p - 0.56) / 0.44, 0, 1));
      this.pose = {
        lat: lerp(a.lat, b.lat, geo),
        lon: a.lon + angle(a.lon, b.lon) * geo,
        d: Math.exp(lerp(Math.log(a.d), Math.log(b.d), t)),
        tilt: lerp(a.tilt, b.tilt, t),
        bearing: a.bearing + angle(a.bearing, b.bearing) * t,
      };
      if (cruise) {
        this.pose.d =
          p < 0.5
            ? Math.exp(lerp(Math.log(a.d), Math.log(cruise), smooth(2 * p)))
            : Math.exp(
                lerp(Math.log(cruise), Math.log(b.d), smooth(2 * p - 1)),
              );
        const horizontal = smooth(clamp((p - 0.16) / 0.68, 0, 1));
        this.pose.lat = lerp(a.lat, b.lat, horizontal);
        this.pose.lon = a.lon + angle(a.lon, b.lon) * horizontal;
      }
      this.goal = { ...this.pose };
      if (p === 1) this.flight = undefined;
    } else {
      const t = 1 - Math.exp(-dt * 12);
      for (const k of ["lat", "lon", "tilt", "bearing"] as const)
        this.pose[k] = lerp(this.pose[k], this.goal[k], t);
      this.pose.d = Math.exp(
        lerp(Math.log(this.pose.d), Math.log(this.goal.d), t),
      );
    }
    const { lat, lon, d, tilt, bearing } = this.pose,
      b = basis(lat, lon),
      a = tilt * RAD;
    const back = b.north
      .clone()
      .multiplyScalar(-Math.cos(bearing * RAD))
      .addScaledVector(b.east, Math.sin(bearing * RAD));
    const target = b.up.clone().multiplyScalar(R + heightAt(this.pose));
    this.camera.position
      .copy(target)
      .addScaledVector(b.up, d * Math.cos(a))
      .addScaledVector(back, d * Math.sin(a));
    if (terrainBelowEye) {
      const eye = this.camera.position, radius = eye.length();
      const surface = terrainBelowEye(Math.asin(eye.y / radius) / RAD, Math.atan2(eye.x, eye.z) / RAD);
      if (surface !== null && radius < R + surface + 0.045) {
        eye.multiplyScalar((R + surface + 0.045) / radius);
      }
    }
    this.camera.up
      .copy(b.up)
      .multiplyScalar(Math.sin(a))
      .addScaledVector(back, -Math.cos(a));
    this.camera.lookAt(target);
    this.camera.near = Math.max(0.00008, d * 0.001);
    this.camera.far = d + 2.2 * R;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }
}
export const projectPoint = (p: Vector3, c: PerspectiveCamera) =>
  p.clone().project(c);
