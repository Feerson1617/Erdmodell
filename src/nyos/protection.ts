import * as T from "three";
import { clamp, smooth } from "../geo";
import type { NyosSection } from "./section";
import type { NyosTerrain } from "./terrain";
import type { NyosMeasure } from "./state";

export const reliefSites = [
  { name: "Talsohle", lat: 6.4699727, lon: 10.3028889 },
  { name: "Hanglage", lat: 6.4699727, lon: 10.309 },
] as const;

const steel = new T.MeshStandardMaterial({
  color: "#91a7ab",
  metalness: 0.38,
  roughness: 0.55,
  side: T.DoubleSide,
});
const shadowSteel = new T.MeshStandardMaterial({
  color: "#425c63",
  metalness: 0.28,
  roughness: 0.6,
  side: T.DoubleSide,
});
const flotation = new T.MeshStandardMaterial({
  color: "#d0b077",
  roughness: 0.7,
  metalness: 0.03,
});
const flowInk = new T.MeshBasicMaterial({
  color: "#b7e3db",
  side: T.DoubleSide,
});
const liquid = new T.MeshBasicMaterial({ color: "#407c85" });
const splash = new T.MeshStandardMaterial({
  color: "#b3d3ce",
  roughness: 0.48,
  metalness: 0.04,
});
const markerMetal = new T.MeshBasicMaterial({ color: "#ebdfb4" });

function pipe(
  parent: T.Object3D,
  radius: number,
  low: number,
  high: number,
  x: number,
  z: number,
  mat: T.Material,
) {
  const mesh = new T.Mesh(
    new T.CylinderGeometry(radius, radius, high - low, 14),
    mat,
  );
  mesh.position.set(x, (low + high) / 2, z);
  parent.add(mesh);
  return mesh;
}
function collar(
  parent: T.Object3D,
  radius: number,
  thick: number,
  x: number,
  y: number,
  z: number,
  mat: T.Material,
) {
  const ring = new T.Mesh(new T.TorusGeometry(radius, thick, 7, 24), mat);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(x, y, z);
  parent.add(ring);
}

/** An illustrative 3D overlay in the terrain's east/up/south frame. Device sizes and teaching time are deliberately enlarged. */
export class NyosProtection {
  readonly group = new T.Group();
  private pipeView = new T.Group();
  private monitor = new T.Group();
  private land = new T.Group();
  private flow = new T.Group();
  private outlet = new T.Group();
  private arrows: T.Mesh[] = [];
  private spray: T.Mesh[] = [];
  private intakeY = 0;
  private stock = 1;
  private devicesBuilt = false;
  private measure: NyosMeasure = "pipe";
  private terrainPoints: {
    name: string;
    lat: number;
    lon: number;
    heightM: number;
  }[] = [];
  constructor(private terrain: NyosTerrain) {
    this.group.name = "Risikominderung · spätere Maßnahmen";
    this.group.add(this.pipeView, this.monitor, this.land);
    this.pipeView.add(this.flow, this.outlet);
    this.group.visible = false;
    this.makeLand();
  }

  private makePipe(section: NyosSection) {
    const z = section.start + 0.56 * (section.end - section.start);
    const x = 0.016,
      r = 0.012;
    this.intakeY = -section.depthAt(z) + 0.017;
    const top = 0.027;
    // The open east side exposes the ascending water inside the pipe. The intake remains above the model floor.
    const shell = new T.Mesh(
      new T.CylinderGeometry(
        r,
        r,
        top - this.intakeY,
        26,
        1,
        true,
        Math.PI * 0.74,
        Math.PI * 1.52,
      ),
      steel,
    );
    shell.position.set(x, (top + this.intakeY) / 2, z);
    this.pipeView.add(shell);
    pipe(this.pipeView, 0.007, this.intakeY, top, x, z, liquid);
    collar(this.pipeView, r, 0.0022, x, this.intakeY, z, shadowSteel);
    collar(this.pipeView, r, 0.002, x, top, z, steel);
    for (const sign of [-1, 1]) {
      const float = new T.Mesh(
        new T.CapsuleGeometry(0.006, 0.034, 4, 12),
        flotation,
      );
      float.rotation.x = Math.PI / 2;
      float.position.set(x + sign * 0.023, 0.006, z);
      this.pipeView.add(float);
    }
    const deck = new T.Mesh(new T.BoxGeometry(0.055, 0.003, 0.02), shadowSteel);
    deck.position.set(x, 0.009, z + 0.01);
    this.pipeView.add(deck);
    const profile = new T.Shape();
    profile.moveTo(-0.0025, -0.007);
    profile.lineTo(0.0025, -0.007);
    profile.lineTo(0.0025, 0.001);
    profile.lineTo(0.006, 0.001);
    profile.lineTo(0, 0.008);
    profile.lineTo(-0.006, 0.001);
    profile.lineTo(-0.0025, 0.001);
    profile.closePath();
    const arrowGeo = new T.ShapeGeometry(profile);
    arrowGeo.rotateY(Math.PI / 2);
    for (let i = 0; i < 4; i++) {
      const arrow = new T.Mesh(arrowGeo, flowInk);
      arrow.position.set(x + r * 0.89, this.intakeY, z);
      this.flow.add(arrow);
      this.arrows.push(arrow);
    }
    // Only a small, local return jet and foam at the outlet mark the controlled release.
    const path = new T.CatmullRomCurve3([
      new T.Vector3(x, top, z),
      new T.Vector3(x + 0.0005, 0.041, z - 0.001),
      new T.Vector3(x + 0.002, 0.049, z - 0.005),
      new T.Vector3(x + 0.005, 0.045, z - 0.012),
      new T.Vector3(x + 0.009, 0.025, z - 0.019),
    ]);
    this.outlet.add(
      new T.Mesh(new T.TubeGeometry(path, 22, 0.0026, 8, false), splash),
    );
    const droplet = new T.IcosahedronGeometry(0.0024, 1);
    for (let i = 0; i < 4; i++) {
      const bead = new T.Mesh(droplet, splash);
      this.outlet.add(bead);
      this.spray.push(bead);
    }
    this.outlet.position.set(0, 0, 0);
  }

  private makeMonitor(section: NyosSection) {
    const f = 0.48,
      z = T.MathUtils.lerp(section.start, section.end, f),
      x = 0.014;
    const depth = section.depthAt(z);
    const float = new T.Mesh(new T.SphereGeometry(0.019, 16, 9), flotation);
    float.scale.set(1, 0.48, 1);
    float.position.set(x, 0.008, z);
    this.monitor.add(float);
    pipe(this.monitor, 0.0022, -depth + 0.022, 0.009, x, z, shadowSteel);
    // One vertical depth profile. Separate sampler depths are visible without a digital readout.
    for (const part of [0.22, 0.54, 0.81]) {
      const y = -depth * part;
      const sensor = pipe(
        this.monitor,
        0.0078,
        y - 0.012,
        y + 0.012,
        x,
        z,
        steel,
      );
      sensor.name = "Messsonde auf dem Tiefenprofil";
      collar(this.monitor, 0.0079, 0.0016, x, y + 0.007, z, flotation);
    }
    pipe(
      this.monitor,
      0.005,
      -depth + 0.012,
      -depth + 0.026,
      x,
      z,
      shadowSteel,
    );
    this.monitor.name = "Schematisches Messprofil unter einer Boje";
  }

  private makeLand() {
    for (const site of reliefSites) {
      const elevation = this.terrain.ground(site.lat, site.lon);
      if (elevation === null) continue;
      const pos = this.terrain.toLocal(site.lon, site.lat, elevation);
      this.terrainPoints.push({
        ...site,
        heightM: Math.round(elevation * 1000),
      });
      const rim: T.Vector3[] = [];
      // Terrain-following halo: both markers use identical styling, independent of elevation.
      for (let i = 0; i < 28; i++) {
        const a = (i * 2 * Math.PI) / 28;
        const p = this.terrain.fromLocal(
          pos.x + 0.044 * Math.cos(a),
          pos.z + 0.044 * Math.sin(a),
        );
        const surface = this.terrain.ground(p.lat, p.lon) ?? elevation;
        const v = this.terrain.toLocal(p.lon, p.lat, surface + 0.003);
        rim.push(v);
      }
      const curve = new T.CatmullRomCurve3(rim, true);
      const ring = new T.Mesh(
        new T.TubeGeometry(curve, 40, 0.0025, 6, true),
        markerMetal,
      );
      this.land.add(ring);
      pipe(
        this.land,
        0.0022,
        pos.y + 0.002,
        pos.y + 0.063,
        pos.x,
        pos.z,
        markerMetal,
      );
    }
    this.land.name = "Zwei reale Geländepunkte · Talsohle und Hang";
  }

  update(active: boolean, measure: NyosMeasure, progress: number) {
    this.group.visible = active;
    this.measure = measure;
    this.pipeView.visible = active && measure === "pipe";
    this.monitor.visible = active && measure === "monitor";
    this.land.visible = active && measure === "settlements";
    const section = this.terrain.section;
    if (!active) {
      this.flow.visible = false;
      this.outlet.visible = false;
      this.stock = 1;
      return;
    }
    if (section && !this.devicesBuilt) {
      this.makePipe(section);
      this.makeMonitor(section);
      this.devicesBuilt = true;
    }
    const t = clamp(progress, 0, 1);
    this.stock = this.pipeView.visible ? 1 - 0.62 * smooth(t) : 1;
    this.flow.visible = this.pipeView.visible && t > 0.025;
    this.outlet.visible = this.pipeView.visible && t > 0.23;
    if (!this.pipeView.visible || !section) return;
    for (let i = 0; i < this.arrows.length; i++) {
      const u = (t * 2.7 + i / this.arrows.length) % 1;
      this.arrows[i].position.y = T.MathUtils.lerp(
        this.intakeY + 0.012,
        0.016,
        u,
      );
    }
    const z = section.start + 0.56 * (section.end - section.start);
    for (let i = 0; i < this.spray.length; i++) {
      const u = (t * 6 + i / this.spray.length) % 1;
      this.spray[i].position.set(
        0.025 + u * 0.003,
        0.025 - u * u * 0.026,
        z - 0.019 - 0.01 * u,
      );
    }
  }

  diagnostics() {
    const pipe =
      this.group.visible && this.pipeView.visible && this.devicesBuilt;
    return {
      protectionVisible: this.group.visible,
      measure: this.measure,
      pipeVisible: pipe,
      monitorVisible:
        this.group.visible && this.monitor.visible && this.devicesBuilt,
      settlementVisible: this.group.visible && this.land.visible,
      settlementComparisonVisible: this.group.visible && this.land.visible,
      pipeFlowVisible: pipe && this.flow.visible,
      controlledVentVisible: pipe && this.outlet.visible,
      remainingDissolved: pipe ? this.stock : null,
      reliefMarkers: this.terrainPoints.map((p) => ({
        ...p,
        visible: this.group.visible && this.land.visible,
      })),
    };
  }

  get dissolvedFraction() {
    return this.stock;
  }
}
