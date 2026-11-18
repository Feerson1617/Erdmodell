import { PerspectiveCamera, Vector3 } from "three";
import { R, RAD, basis, clamp, smooth } from "./geo";
export const HOME = { lat: 18, lon: 19, d: 14450, tilt: 0, bearing: 0 };
export type Pose = typeof HOME;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const angle = (a: number, b: number) => ((b - a + 540) % 360) - 180;
export class CameraController {
  readonly camera = new PerspectiveCamera(39, 1, 0.01, 60000);
  pose = { ...HOME };
  goal = { ...HOME };
  flight?: { from: Pose; to: Pose; start: number; ms: number };
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
    if (this.flight) {
      this.goal = { ...this.pose };
      this.flight = undefined;
    }
  }
  zoom(f: number) {
    this.stop();
    this.goal.d = clamp(this.goal.d * f, 0.06, 35000);
  }
  pan(dx: number, dy: number) {
    this.stop();
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
  fly(to: Pose) {
    this.flight = {
      from: { ...this.pose },
      to: { ...to },
      start: performance.now(),
      ms: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : clamp(Math.abs(Math.log(this.pose.d / to.d)) * 590, 950, 6400),
    };
  }
  update(now: number, dt: number, height: number) {
    if (this.flight) {
      const { from: a, to: b, start, ms } = this.flight;
      const p = ms ? clamp((now - start) / ms, 0, 1) : 1,
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
      const separation =
        R *
        RAD *
        Math.hypot(
          b.lat - a.lat,
          angle(a.lon, b.lon) * Math.cos(((a.lat + b.lat) * RAD) / 2),
        );
      if (separation > 10 && Math.max(a.d, b.d) < separation / 3) {
        const cruise = Math.min(separation * 0.8, 400);
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
    const target = b.up.clone().multiplyScalar(R + height);
    this.camera.position
      .copy(target)
      .addScaledVector(b.up, d * Math.cos(a))
      .addScaledVector(back, d * Math.sin(a));
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
