import * as T from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { graphics } from "../observatory/graphics";

export const vec = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
export type Update = (t: number) => void;
export interface SeismicState {
  view: string;
  time: number;
  playing: boolean;
  eye: number[];
  target: number[];
  zoom: number;
}
type Label = {
  point: T.Vector3;
  node: HTMLElement;
  leader: SVGLineElement;
  name: string;
  detail: string;
  show: (t: number) => boolean;
};
export const colors = {
  p: 0xffcf79,
  s: 0x76ded7,
  hot: 0xff895a,
  ice: 0x9dcaf8,
  lime: 0xbcdb89,
  lilac: 0xb8a1ef,
};
export class Stage {
  scene = new T.Scene();
  camera = new T.OrthographicCamera(-8, 8, 4, -4, 0.1, 200);
  controls: OrbitControls;
  painted = false;
  time = 0;
  playing = false;
  duration = 18;
  halfWidth = 7.5;
  halfHeight = 3.4;
  root = document.createElement("div");
  caption = document.createElement("div");
  plot?: HTMLCanvasElement;
  disposed = false;
  private leaders = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "svg",
  );
  private labels: Label[] = [];
  private updates: Update[] = [];
  private lastKey = "";
  private tick = -1;
  syncUI?: () => void;
  private statement: (t: number) => string = () => "";
  private lastLayout = 0;
  private dynamic?: {
    draw: (
      c: CanvasRenderingContext2D,
      w: number,
      h: number,
      t: number,
    ) => void;
  };
  constructor(
    readonly gl: T.WebGLRenderer,
    readonly view: string,
  ) {
    const canvas = gl.domElement;
    this.scene.background = new T.Color(0x182a32);
    this.scene.add(new T.HemisphereLight(0xfff1d5, 0x8298ad, 2.1));
    const sun = new T.DirectionalLight(0xffe3b6, 2.2);
    sun.position.set(-5, 10, 7);
    this.scene.add(sun);
    const fill = new T.DirectionalLight(0x8cd9ed, 0.85);
    fill.position.set(4, 5, -8);
    this.scene.add(fill);
    this.camera.position.set(6, 4.6, 15);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enablePan = false;
    this.controls.minZoom = 0.7;
    this.controls.maxZoom = 2.4;
    this.controls.maxPolarAngle = Math.PI * 0.82;
    this.root.className = "seismic-figure";
    this.leaders.setAttribute("aria-hidden", "true");
    this.caption.className = "seismic-caption";
    this.root.append(this.leaders, this.caption);
    canvas.parentElement!.append(this.root);
  }
  look(x: number, y: number, z: number, cy = 0) {
    this.camera.position.set(x, y, z);
    this.controls.target.set(0, cy, 0);
    this.controls.update();
  }
  mesh(g: T.BufferGeometry, color: number, name: string, unlit = false) {
    const mat = unlit
      ? new T.MeshBasicMaterial({ color, side: T.DoubleSide })
      : new T.MeshStandardMaterial({
          color,
          roughness: 0.88,
          side: T.DoubleSide,
        });
    const obj = new T.Mesh(g, mat);
    obj.name = name;
    this.scene.add(obj);
    return obj;
  }
  dot(p: T.Vector3, color: number, r = 0.085, name = "Messpunkt") {
    const m = this.mesh(new T.SphereGeometry(r, 16, 10), color, name);
    m.position.copy(p);
    return m;
  }
  line(points: T.Vector3[], color: number, name = "Profil", opacity = 1) {
    const g = new T.BufferGeometry().setFromPoints(points),
      mat = new T.LineBasicMaterial({
        color,
        transparent: opacity < 1,
        opacity,
      });
    const l = new T.Line(g, mat);
    l.name = name;
    this.scene.add(l);
    return l;
  }
  box(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: number,
    name: string,
  ) {
    const o = this.mesh(new T.BoxGeometry(w, h, d), color, name);
    o.position.set(x, y, z);
    return o;
  }
  label(
    point: T.Vector3,
    name: string,
    detail = "",
    show: (t: number) => boolean = () => true,
  ) {
    const node = document.createElement("div");
    node.className = "seismic-label";
    node.textContent = name;
    const leader = document.createElementNS(
      this.leaders.namespaceURI!,
      "line",
    ) as SVGLineElement;
    this.leaders.append(leader);
    this.root.append(node);
    this.labels.push({ point, node, leader, name, detail, show });
  }
  explain(f: (t: number) => string) {
    this.statement = f;
  }
  animate(f: Update) {
    this.updates.push(f);
  }
  chart(
    draw: (
      c: CanvasRenderingContext2D,
      w: number,
      h: number,
      t: number,
    ) => void,
  ) {
    this.plot = document.createElement("canvas");
    this.plot.className = "seismic-chart";
    this.root.append(this.plot);
    this.dynamic = { draw };
  }
  refresh() {
    this.lastKey = "";
  }
  frame(dt: number) {
    if (this.playing) {
      this.time = Math.min(1, this.time + dt / this.duration);
      if (this.time === 1) this.playing = false;
    }
    this.controls.update();
    const cv = this.gl.domElement,
      w = cv.clientWidth,
      h = cv.clientHeight,
      aspect = w / Math.max(h, 1);
    const height = Math.max(this.halfHeight, this.halfWidth / aspect);
    this.camera.left = -height * aspect;
    this.camera.right = height * aspect;
    this.camera.top = height;
    this.camera.bottom = -height;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    const depth = document.body.dataset.infoDepth || "terms",
      key = [
        w,
        h,
        this.camera.zoom,
        ...this.camera.matrixWorld.elements,
        depth,
        this.time,
      ].join("/");
    graphics.scope = "Seismologie/" + this.view;
    graphics.idle = this.lastKey === key;
    graphics.activity = graphics.idle
      ? "cached"
      : this.playing
        ? "animation"
        : "still";
    if (graphics.idle) return true;
    if (this.tick !== this.time) {
      this.updates.forEach((f) => f(this.time));
      this.tick = this.time;
      this.syncUI?.();
    }
    this.gl.render(this.scene, this.camera);
    this.painted = true;
    const hidden = depth === "observe",
      now = performance.now();
    if (!this.playing || now - this.lastLayout > 75 || !this.lastKey) {
      this.lastLayout = now;
      if (this.plot) this.plot.hidden = hidden;
      const text = this.statement(this.time);
      this.caption.hidden = depth !== "explain" || !text;
      if (this.caption.textContent !== text) this.caption.textContent = text;
      const used: { x: number; y: number; right: number; bottom: number }[] =
        [];
      if (!this.caption.hidden)
        used.push({
          x: this.caption.offsetLeft,
          y: this.caption.offsetTop,
          right: this.caption.offsetLeft + this.caption.offsetWidth,
          bottom: this.caption.offsetTop + this.caption.offsetHeight,
        });
      const pts = this.labels.map((l) => {
        const p = l.point.clone().project(this.camera);
        return { x: ((p.x + 1) * w) / 2, y: ((1 - p.y) * h) / 2 };
      });
      this.labels.forEach((l, i) => {
        const { x, y } = pts[i];
        let visible =
          !hidden &&
          l.show(this.time) &&
          x > 4 &&
          x < w - 4 &&
          y > 4 &&
          y < h - 4;
        l.node.hidden = !visible;
        l.leader.style.display = visible ? "" : "none";
        if (!visible) return;
        const wording =
          depth === "explain" && l.detail ? l.name + " · " + l.detail : l.name;
        if (l.node.textContent !== wording) l.node.textContent = wording;
        const a = l.node.offsetWidth,
          b = l.node.offsetHeight;
        const choices = [
          [16, -b - 18],
          [-a - 16, -b - 18],
          [18, 16],
          [-a - 18, 16],
          [18, -b - 45],
          [-a - 18, -b - 45],
        ];
        const pos = choices
          .map(([u, v]) => ({
            x: x + u,
            y: y + v,
            right: x + u + a,
            bottom: y + v + b,
          }))
          .find(
            (q) =>
              q.x >= 4 &&
              q.right < w - 4 &&
              q.y > 22 &&
              q.bottom < h * (this.plot?.hidden === false ? 0.74 : 0.89) &&
              !used.some(
                (r) =>
                  q.right >= r.x - 4 &&
                  q.x <= r.right + 4 &&
                  q.bottom >= r.y - 4 &&
                  q.y <= r.bottom + 4,
              ) &&
              !pts.some(
                (p) =>
                  p.x >= q.x - 4 &&
                  p.x <= q.right + 4 &&
                  p.y >= q.y - 4 &&
                  p.y <= q.bottom + 4,
              ),
          );
        if (!pos) {
          l.node.hidden = true;
          l.leader.style.display = "none";
          return;
        }
        used.push(pos);
        l.node.style.transform =
          "translate(" + Math.round(pos.x) + "px," + Math.round(pos.y) + "px)";
        for (const [k, v] of Object.entries({
          x1: x,
          y1: y,
          x2: Math.max(pos.x, Math.min(pos.right, x)),
          y2: Math.max(pos.y, Math.min(pos.bottom, y)),
        }))
          l.leader.setAttribute(k, String(v));
      });
    }
    if (this.plot && this.dynamic) {
      this.plot.hidden = hidden;
      if (!hidden) {
        const cw = this.plot.clientWidth,
          ch = this.plot.clientHeight;
        if (this.plot.width !== cw || this.plot.height !== ch) {
          this.plot.width = cw;
          this.plot.height = ch;
        }
        this.dynamic.draw(this.plot.getContext("2d")!, cw, ch, this.time);
      }
    }
    this.lastKey = key;
    return true;
  }
  snapshot(): SeismicState {
    return {
      view: this.view,
      time: this.time,
      playing: this.playing,
      eye: this.camera.position.toArray(),
      target: this.controls.target.toArray(),
      zoom: this.camera.zoom,
    };
  }
  restore(s: SeismicState) {
    this.time = s.time;
    this.playing = s.playing;
    this.camera.position.fromArray(s.eye);
    this.controls.target.fromArray(s.target);
    this.camera.zoom = s.zoom;
    this.controls.update();
  }
  dispose() {
    this.disposed = true;
    this.controls.dispose();
    this.root.remove();
    const mats = new Set<T.Material>(),
      geos = new Set<T.BufferGeometry>();
    this.scene.traverse((o) => {
      const m = o as T.Mesh;
      if (m.geometry) geos.add(m.geometry);
      if (m.material)
        (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) =>
          mats.add(x),
        );
      if (m instanceof T.InstancedMesh) m.dispose();
    });
    geos.forEach((g) => g.dispose());
    mats.forEach((m) => {
      if (m instanceof T.MeshStandardMaterial) m.map?.dispose();
      m.dispose();
    });
  }
}
