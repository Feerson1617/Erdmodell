import * as T from "three";
import { CameraController, HOME } from "./camera";
import { R, position, basis, smooth, clamp } from "./geo";
import { TerrainLODManager } from "./planet";
import { regions, firstRegion, type Region } from "./regions";
import { LocalTerrain } from "./local";
import { Shells, shellRadii } from "./shells";
import { type Style, styles } from "./model";
export class World {
  scene = new T.Scene();
  gl: T.WebGLRenderer;
  nav: CameraController;
  planet: TerrainLODManager;
  private terrains = new Map<string, LocalTerrain>();
  region: Region = firstRegion;
  get local() {
    return this.terrains.get(this.region.id)!;
  }
  private renderMs = 0;
  private terrainMs = 0;

  shell = new Shells();
  mode: "globe" | "inside" | "place" = "globe";
  style: Style = "A";
  ready = false;
  fps = 0;
  frames = 0;
  private running = true;
  private waitingForAscent = false;
  private last = 0;
  private slow = 0;
  private shadowStamp = "";
  private fpsStart = 0;
  private frameCount = 0;
  private hemi = new T.HemisphereLight(0xfcffff, 0xa0acaa, 1.48);
  private sun = new T.DirectionalLight(0xfff1da, 2.05);
  private grid = new T.Group();
  private air: T.Mesh;
  private marker = position(firstRegion.target.lat, firstRegion.target.lon, 10);
  onFrame?: () => void;
  onLayer?: (i: number) => void;
  constructor(
    public canvas: HTMLCanvasElement,
    public warn: (s: string) => void,
  ) {
    this.gl = new T.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.gl.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.autoUpdate = false;
    this.gl.shadowMap.type = T.PCFSoftShadowMap;
    this.gl.toneMapping = T.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.06;
    this.gl.setClearColor(0, 0);
    this.nav = new CameraController(canvas);
    this.planet = new TerrainLODManager(warn);
    for (const region of regions.values()) {
      const terrain = new LocalTerrain(region);
      this.terrains.set(region.id, terrain);
      this.scene.add(terrain.group);
    }
    this.scene.add(
      this.planet.group,
      this.shell.group,

      this.hemi,
      this.sun,
      this.sun.target,
      this.grid,
    );
    this.shell.group.visible = false;
    const lines: number[] = [];
    for (let lat = -60; lat <= 60; lat += 30)
      for (let i = -180; i < 180; i += 2)
        lines.push(
          ...position(lat, i, 10).toArray(),
          ...position(lat, i + 2, 10).toArray(),
        );
    for (let lon = -180; lon < 180; lon += 30)
      for (let i = -90; i < 90; i += 2)
        lines.push(
          ...position(i, lon, 10).toArray(),
          ...position(i + 2, lon, 10).toArray(),
        );
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(lines, 3));
    this.grid.add(
      new T.LineSegments(
        g,
        new T.LineBasicMaterial({
          color: 0xd8edf0,
          transparent: true,
          opacity: 0.105,
          depthWrite: false,
        }),
      ),
    );
    this.air = new T.Mesh(
      new T.SphereGeometry(R * 1.021, 120, 64),
      new T.ShaderMaterial({
        transparent: true,
        side: T.BackSide,
        depthWrite: false,
        uniforms: { color: { value: new T.Color("#74b8d5") } },
        vertexShader: `varying vec3 n;varying vec3 eye;void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);eye=-p.xyz;gl_Position=projectionMatrix*p;}`,
        fragmentShader: `varying vec3 n;varying vec3 eye;uniform vec3 color;void main(){float rim=pow(1.-abs(dot(normalize(n),normalize(eye))),11.);gl_FragColor=vec4(color,rim*.46);}`,
      }),
    );
    this.scene.add(this.air);
    this.scene.fog = new T.FogExp2(0xb6cfd0, 0);
    this.nav.onPick = (x, y) => {
      if (this.mode !== "inside") return;
      const b = canvas.getBoundingClientRect(),
        ray = new T.Raycaster();
      ray.setFromCamera(
        new T.Vector2(
          ((x - b.x) / b.width) * 2 - 1,
          1 - ((y - b.y) / b.height) * 2,
        ),
        this.nav.camera,
      );
      const hit = ray
        .intersectObjects(this.shell.group.children, true)
        .find((entry) => entry.object.visible);
      if (hit) this.onLayer?.(hit.object.userData.layer);
    };
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.running = false;
      this.warn(
        "Grafikkontext unterbrochen. Seite neu laden, um das Modell wieder zu öffnen.",
      );
    });
    canvas.addEventListener("webglcontextrestored", () => {
      this.running = true;
      this.last = 0;
      requestAnimationFrame(this.render);
    });
  }
  private sizeDirty = true;
  resize() {
    this.sizeDirty = true;
  }
  private applySize() {
    this.sizeDirty = false;
    const w = this.canvas.clientWidth,
      h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.gl.setSize(w, h, false);
    this.nav.camera.aspect = w / h;
    this.nav.camera.fov =
      w < h
        ? (2 * Math.atan((Math.tan((39 * Math.PI) / 360) * h) / w) * 180) /
          Math.PI
        : 39;
    this.nav.camera.updateProjectionMatrix();
  }
  async init() {
    try {
      await this.planet.init();
    } catch {
      this.warn("Basiskarte fehlt · Reliefkugel ohne Bilddaten");
    }
    this.setStyle("A");
    this.ready = true;
    requestAnimationFrame(this.render);
  }
  setStyle(s: Style) {
    this.style = s;
    this.planet.setStyle(s);
    for (const terrain of this.terrains.values()) terrain.setStyle(s);
    this.shell.style = s;
    this.shell.map = this.planet.maps[s] ?? this.planet.baseline;
    if (this.shell.map) {
      this.shell.map.wrapS = T.RepeatWrapping;
      if (this.shell.map.version === 0) this.shell.map.needsUpdate = true;
    }
    if (this.mode === "inside") this.shell.rebuild();
    this.hemi.intensity = styles[s].sky;
    this.sun.intensity = styles[s].sun;
  }
  visit(id = firstRegion.id, overview = false) {
    const r = regions.get(id);
    if (!r) return;
    this.region = r;
    this.local.setStyle(this.style);
    this.mode = "place";
    const target = overview ? { ...r.target, ...r.overview } : r.target;
    this.nav.fly(target);
    const flight = this.nav.flight;
    void this.local.load().then(() => {
      if (
        !this.local.ready &&
        this.region === r &&
        this.mode === "place" &&
        (this.nav.flight === flight || this.nav.pose.d <= target.d + 0.001)
      )
        this.nav.fly({ ...target, d: r.lod.fallbackKm, tilt: 0, bearing: 0 });
    });
  }
  globe() {
    this.mode = "globe";
    this.nav.fly(HOME);
  }
  inside() {
    this.waitingForAscent = this.mode !== "inside" && this.nav.pose.d < 3500;
    this.mode = "inside";
    this.shell.rebuild();
    this.nav.fly({ ...HOME, lon: 3, lat: 17 });
  }
  layerMarkers() {
    const camera = this.nav.camera,
      eyeLongitude =
        (Math.atan2(camera.position.x, camera.position.z) * 180) / Math.PI;
    if (
      !this.shell.cut ||
      !this.shell.group.visible ||
      eyeLongitude <= -25 ||
      eyeLongitude >= 65
    )
      return [];
    const radii = shellRadii(this.shell.expanded),
      face = eyeLongitude < 20 ? 65 : -25;
    return this.shell.visible.map((visible, i) => {
      if (!visible) return null;
      const projected = position(
        [38, 18, -7, -48][i],
        face,
        (radii[i] + radii[i + 1]) / 2 - R,
      ).project(camera);
      if (
        Math.abs(projected.x) > 1 ||
        Math.abs(projected.y) > 1 ||
        Math.abs(projected.z) > 1
      )
        return null;
      return { x: (projected.x + 1) * 50, y: (1 - projected.y) * 50 };
    });
  }
  markerPosition() {
    const c = this.nav.camera;
    const p = this.marker.clone().project(c);
    return {
      x: (p.x + 1) * 50,
      y: (1 - p.y) * 50,
      visible:
        this.marker.dot(c.position.clone().sub(this.marker)) > 0 &&
        this.mode !== "inside" &&
        this.nav.pose.d > 1600 &&
        p.z < 1,
    };
  }
  diagnostics() {
    const { lat, lon, d, tilt, bearing } = this.nav.pose;
    return {
      ready: this.ready,
      mode: this.mode,
      style: this.style,
      lat,
      lon,
      d,
      tilt,
      bearing,
      flying: !!this.nav.flight,
      fps: this.fps,
      frames: this.frames,
      pixelRatio: this.gl.getPixelRatio(),
      tiles: this.planet.tileCount,
      region: this.region.id,
      renderMs: this.renderMs,
      terrainMs: this.terrainMs,
      programs: this.gl.info.programs?.length,
      shell: {
        radii: shellRadii(this.shell.expanded),
        cut: this.shell.cut,
        expanded: this.shell.expanded,
        selected: this.shell.selected,
        visible: [...this.shell.visible],
        opacity: [...this.shell.opacity],
        subdued: this.shell.subdued,
        builds: this.shell.builds,
      },
      localReady: this.local.ready,
      localVisible: this.local.group.visible,
      draws: this.gl.info.render.calls,
      triangles: this.gl.info.render.triangles,
      ...this.gl.info.memory,
    };
  }
  private render = (now: number) => {
    if (!this.running) return;
    requestAnimationFrame(this.render);
    if (document.hidden) return;
    const dt = clamp((now - this.last) / 1000, 0.001, 0.12);
    this.last = now;
    if (this.sizeDirty) this.applySize();
    this.frames++;
    this.frameCount++;
    if (now - this.fpsStart >= 900) {
      this.fps = (this.frameCount * 1000) / (now - this.fpsStart);
      this.frameCount = 0;
      this.fpsStart = now;
      if (this.frames > 12 && this.fps < 22) this.slow++;
      else this.slow = 0;
      if (this.slow >= 2 && this.gl.getPixelRatio() > 0.76) {
        this.gl.setPixelRatio(Math.max(0.75, this.gl.getPixelRatio() * 0.85));
        this.slow = 0;
      }
    }
    const prev = this.nav.pose;
    const ground =
      this.mode === "inside"
        ? 0
        : Math.max(
            ...Array.from(this.terrains.values(), (t) =>
              t.ground(prev.lat, prev.lon),
            ),
            this.planet.elevation(prev.lat, prev.lon),
          );
    this.nav.update(now, dt, ground);
    const { lat, lon, d } = this.nav.pose;
    if (d >= 3500 || !this.nav.flight) this.waitingForAscent = false;
    const inside = this.mode === "inside" && !this.waitingForAscent,
      zoom = 1 - smooth((d - 2) / 58);
    this.planet.group.visible = !inside;
    this.shell.group.visible = inside;
    this.air.visible = !inside && d > 2200;
    this.grid.visible = !inside && d > 2400;
    const before = performance.now();
    if (!inside) this.planet.update(lat, lon, d);
    this.terrainMs = performance.now() - before;
    for (const terrain of this.terrains.values()) {
      if (terrain === this.local || terrain.ready)
        terrain.update(lat, lon, d, now);
      if (inside) terrain.group.visible = false;
    }
    const b = basis(lat, lon),
      target = position(lat, lon),
      dir = b.up
        .clone()
        .multiplyScalar(0.91)
        .addScaledVector(b.north, 1.05)
        .addScaledVector(b.east, -1.2)
        .normalize();
    this.planet.lightDirection(dir);
    const shadow = this.local.group.visible && d < 2.3;
    this.sun.castShadow = shadow;
    this.sun.target.position.copy(target);
    this.sun.position.copy(target).addScaledVector(dir, shadow ? 4 : 20000);
    if (shadow) {
      const cam = this.sun.shadow.camera,
        r = d > 1 ? 2.5 : 0.9;
      const anchored = position(
        Math.round(lat * 150) / 150,
        Math.round(lon * 100) / 100,
      );
      this.sun.target.position.copy(anchored);
      this.sun.position.copy(anchored).addScaledVector(dir, 4);
      Object.assign(cam, {
        left: -r,
        right: r,
        top: r,
        bottom: -r,
        near: 0.1,
        far: 9,
      });
      cam.updateProjectionMatrix();
      this.sun.shadow.bias = -0.00012;
      this.sun.shadow.normalBias = 0.0003;
      const stamp = [
        Math.round(lat * 150),
        Math.round(lon * 100),
        r.toFixed(3),
        this.style,
        this.local.ready,
      ].join("/");
      if (stamp !== this.shadowStamp) {
        this.gl.shadowMap.needsUpdate = true;
        this.shadowStamp = stamp;
      }
    }
    const fog = this.scene.fog as T.FogExp2;
    fog.density = Math.min(0.085, 0.28 / Math.max(1, d)) * zoom;
    if (fog.density > 0.0001) {
      this.nav.camera.far = Math.min(
        this.nav.camera.far,
        Math.max(d * 2.5, 3.6 / fog.density),
      );
      this.nav.camera.updateProjectionMatrix();
    }
    this.gl.setClearColor(0xaccbd0, zoom);
    const submit = performance.now();
    this.gl.render(this.scene, this.nav.camera);
    this.renderMs = performance.now() - submit;
    this.onFrame?.();
  };
}
