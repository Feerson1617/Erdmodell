import * as T from "three";
import { basis, position, R, RAD, smooth, clamp } from "./geo";
import {
  LocalFrame,
  sampleGrid,
  type HeightGrid,
  type Region,
} from "./regions";
import { texture, dataUrl } from "./planet";
import type { Style } from "./model";
type Point = [number, number];
type Data = {
  bounds: [number, number, number, number];
  coast: Point[];
  mounds: { name: string; point: Point }[];
  buildings: Point[][];
};
function inside(x: number, z: number, ring: Point[]) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [a, b] = ring[i],
      [c, d] = ring[j];
    if (b > z !== d > z && x < ((c - a) * (z - b)) / (d - b) + a) hit = !hit;
  }
  return hit;
}
const sag = (x: number, z: number) => (x * x + z * z) / (2 * R);
export class LocalTerrain {
  group = new T.Group();
  ready = false;
  warning = "";
  loading?: Promise<void>;
  data?: Data;
  map?: T.Texture;
  private ortho?: T.Texture;
  private detail?: T.Texture;
  private soft?: T.Texture;
  private mounds: Point[] = [];
  private coast: Point[] = [];
  private style: Style = "A";
  private surface?: T.Mesh;
  private buildings = new T.Group();
  time = { value: 0 };
  weight = { value: 0 };
  readonly frame: LocalFrame;
  private grid?: HeightGrid;
  private terrain?: T.BufferGeometry;
  private variants = new Map<Style, T.Group>();
  constructor(readonly region: Region) {
    const { lat, lon } = region.target,
      anchor = position(lat, lon),
      frame = basis(lat, lon);
    this.frame = new LocalFrame(region);
    this.group.position.copy(anchor);
    this.group.quaternion.setFromRotationMatrix(
      new T.Matrix4().makeBasis(
        frame.east,
        frame.up,
        frame.north.clone().negate(),
      ),
    );
    this.group.visible = false;
  }
  load() {
    return (this.loading ??= this.fetchData().catch(() => {
      this.warning =
        (this.region.id === "hooge" ? "Hallig" : this.region.name) +
        "-Detaildaten fehlen · regionale Küstenkarte aktiv";
    }));
  }
  private async fetchData() {
    const r = this.region;
    const get = async (name: string) => {
      const res = await fetch(dataUrl(name));
      if (!res.ok) throw Error("Kartendatei fehlt: " + name);
      return res;
    };
    const [data, map, buffer, grid] = await Promise.all([
      r.features
        ? get(r.features).then((res) => res.json() as Promise<Data>)
        : Promise.resolve({
            bounds: r.bounds,
            coast: [],
            mounds: [],
            buildings: [],
          } as Data),
      texture(r.maps.base),
      get(r.mesh).then((res) => res.arrayBuffer()),
      r.height.kind === "dsm"
        ? get(r.height.file).then((res) => res.json() as Promise<HeightGrid>)
        : undefined,
    ]);
    this.data = data;
    this.map = map;
    this.grid = grid;
    this.coast = data.coast.map(this.frame.project);
    this.mounds = data.mounds.map((m) => this.frame.project(m.point));
    const extras = await Promise.allSettled([
      r.maps.A === r.maps.base ? map : texture(r.maps.A),
      r.maps.B === r.maps.base ? map : texture(r.maps.B),
      r.maps.detail ? texture(r.maps.detail) : undefined,
    ]);
    if (extras[0].status === "fulfilled") this.ortho = extras[0].value;
    if (extras[1].status === "fulfilled") this.soft = extras[1].value;
    if (extras[2].status === "fulfilled") this.detail = extras[2].value;
    if (extras.some((e) => e.status === "rejected"))
      this.warning = "Luftbild unvollständig · lokale Ersatzkarte aktiv";
    this.terrain = this.unpackTerrain(buffer);
    this.ready = true;
    this.rebuild();
  }
  private unpackTerrain(buf: ArrayBuffer) {
    if (buf.byteLength < 8) throw Error("Geländedatei unvollständig");
    const [count, indices] = new Uint32Array(buf, 0, 2);
    if (
      count > 65535 ||
      !count ||
      !indices ||
      indices % 3 ||
      8 + count * 16 + indices * 2 !== buf.byteLength
    )
      throw Error("Geländenetz ungültig");
    const floats = new Float32Array(buf, 8, count * 4),
      index = new Uint16Array(buf, 8 + count * 16, indices);
    const [w, s, e, n] = this.region.bounds,
      [x0, z0] = this.frame.project([w, n]),
      [x1, z1] = this.frame.project([e, s]);
    if (!floats.every(Number.isFinite) || index.some((k) => k >= count))
      throw Error("Ungültige Geländekoordinaten");
    const pos = new Float32Array(count * 3),
      uv = new Float32Array(count * 2),
      land = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const u = floats[i * 4],
        v = floats[i * 4 + 1],
        x = x0 + (x1 - x0) * u,
        z = z0 + (z1 - z0) * v;
      pos.set([x, floats[i * 4 + 2] + 0.0012 - sag(x, z), z], i * 3);
      uv.set([u, 1 - v], i * 2);
      land[i] = floats[i * 4 + 3];
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.BufferAttribute(pos, 3));
    g.setAttribute("uv", new T.BufferAttribute(uv, 2));
    g.setAttribute("land", new T.BufferAttribute(land, 1));
    const core: number[] = [],
      collar: number[] = [];
    for (let j = 0; j < indices; j += 3) {
      const a = index[j],
        b = index[j + 1],
        c = index[j + 2];
      if (land[a] <= -1 && land[b] <= -1 && land[c] <= -1) continue;
      const central = [a, b, c].every(
        (k) =>
          land[k] >= 0 &&
          Math.min(uv[2 * k], 1 - uv[2 * k], uv[2 * k + 1], 1 - uv[2 * k + 1]) >
            0.12,
      );
      (central ? core : collar).push(a, b, c);
    }
    g.setIndex(new T.BufferAttribute(new Uint16Array(core.concat(collar)), 1));
    g.addGroup(0, core.length, 0);
    g.addGroup(core.length, collar.length, 1);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
  private height(x: number, z: number, land = true) {
    const spec = this.region.height;
    if (spec.kind !== "mounds") return 0;
    let h = land ? spec.baseM * 0.001 : 0;
    if (land)
      for (const [cx, cz] of this.mounds) {
        if (
          Math.abs(x - cx) > spec.radiusKm[0] * 1.48 ||
          Math.abs(z - cz) > spec.radiusKm[1] * 1.48
        )
          continue;
        const r = Math.hypot(
          (x - cx) / spec.radiusKm[0],
          (z - cz) / spec.radiusKm[1],
        );
        if (r < 1.48) h += spec.riseM * 0.001 * (1 - smooth(r - 0.48));
      }
    return h + 0.0012 - sag(x, z);
  }
  ground(lat: number, lon: number) {
    if (!this.ready) return 0;
    if (!this.frame.contains(lat, lon)) return 0;
    const [w, s, e, n] = this.region.bounds;
    if (this.grid)
      return (
        sampleGrid(this.grid, (lon - w) / (e - w), (n - lat) / (n - s)) + 0.0012
      );
    const [x, z] = this.frame.project([lon, lat]);
    return this.height(x, z, inside(x, z, this.coast)) + sag(x, z);
  }
  setStyle(s: Style) {
    if (this.style === s) return;
    this.style = s;
    if (this.ready) this.rebuild();
  }
  private rebuild() {
    if (!this.data || !this.terrain || !this.map) return;
    for (const [key, v] of this.variants) v.visible = key === this.style;
    const cached = this.variants.get(this.style);
    if (cached) {
      this.surface = cached.children[0] as T.Mesh;
      this.buildings = cached.children[1] as T.Group;
      return;
    }
    const variant = new T.Group();
    this.variants.set(this.style, variant);
    this.group.add(variant);
    const g = this.terrain;
    this.buildings = new T.Group();
    const mat = new T.MeshLambertMaterial({
      map: (this.style === "A" ? this.ortho : this.soft) ?? this.map,

      flatShading: this.style === "B",
      transparent: true,
      depthWrite: false,
    });
    const useFinePhoto = this.style === "A";
    mat.onBeforeCompile = (shader) => {
      const rect = this.region.maps.detailBounds ?? this.region.bounds;
      const [left, top] = this.frame.project([rect[0], rect[3]]),
        [right, bottom] = this.frame.project([rect[2], rect[1]]);
      shader.uniforms.detailRect = {
        value: new T.Vector4(left, top, right - left, bottom - top),
      };
      shader.uniforms.detailMap = { value: this.detail ?? this.map };
      shader.uniforms.detailWeight = {
        value: this.detail && useFinePhoto ? 0.9 : 0,
      };
      shader.uniforms.tideTime = this.time;
      shader.uniforms.lodWeight = this.weight;
      shader.vertexShader =
        "attribute float land;varying float dry;varying vec2 site;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\n dry=land;site=position.xz;",
        );
      shader.fragmentShader =
        "uniform vec4 detailRect;uniform sampler2D detailMap;uniform float detailWeight;varying float dry;varying vec2 site;uniform float tideTime;uniform float lodWeight;\n" +
        shader.fragmentShader.replace(
          "#include <map_fragment>",
          `#include <map_fragment>
 vec2 duv=(site-detailRect.xy)/detailRect.zw; duv.y=1.-duv.y;
 float de=min(min(duv.x,duv.y),min(1.-duv.x,1.-duv.y));
 if(de>0. && detailWeight>0.) diffuseColor.rgb=mix(diffuseColor.rgb,texture2D(detailMap,clamp(duv,0.,1.)).rgb,smoothstep(0.,.09,de)*detailWeight);
 float wobble=sin(site.y*18.+site.x*6.);float wave=sin(site.x*340.+site.y*650.+wobble*4.+tideTime)*.5+.5;
 float field=sin(site.x*443.+site.y*28.)*sin(site.y*980.)*.04;
 diffuseColor.rgb*=1.+mix((wave-.5)*.14,field,max(dry,0.))/(1.+length(fwidth(site))*100.);
 float edge=min(min(vMapUv.x,vMapUv.y),min(1.-vMapUv.x,1.-vMapUv.y));
 diffuseColor.a*=lodWeight*smoothstep(0.,.12,edge)*smoothstep(-1.,0.,dry);`,
        );
    };
    const inner = mat.clone();
    inner.onBeforeCompile = mat.onBeforeCompile;
    inner.depthWrite = true;
    this.surface = new T.Mesh(g, [inner, mat]);
    this.surface.renderOrder = -2;
    this.surface.receiveShadow = true;
    variant.add(this.surface, this.buildings);
    if (!this.data.buildings.length) return;
    const vertices: number[] = [],
      colors: number[] = [];
    let seed = 90210;
    const rand = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    function tri(a: number[], b: number[], c: number[], color: T.Color) {
      vertices.push(...a, ...b, ...c);
      for (let i = 0; i < 3; i++) colors.push(color.r, color.g, color.b);
    }
    const trees: { x: number; z: number; y: number; h: number }[] = [];
    for (const footprint of this.data.buildings) {
      const p = footprint.map(this.frame.project);
      let length = 0,
        theta = 0;
      p.forEach(([x, z], i) => {
        const q = p[(i + 1) % p.length],
          d = Math.hypot(q[0] - x, q[1] - z);
        if (d > length) {
          length = d;
          theta = Math.atan2(q[1] - z, q[0] - x);
        }
      });
      const c = Math.cos(theta),
        ss = Math.sin(theta),
        us = p.map(([x, z]) => x * c + z * ss),
        vs = p.map(([x, z]) => -x * ss + z * c);
      const u0 = Math.min(...us),
        u1 = Math.max(...us),
        v0 = Math.min(...vs),
        v1 = Math.max(...vs),
        um = (u0 + u1) / 2,
        vm = (v0 + v1) / 2;
      const x = um * c - vm * ss,
        z = um * ss + vm * c,
        y = this.height(x, z),
        h = 0.003 + rand() * 0.0025,
        roofH = Math.min(0.005, (v1 - v0) * 0.44);
      const vertex = (u: number, v: number, h: number) => [
        u * c - v * ss,
        y + h,
        u * ss + v * c,
      ];
      const base = [
          [u0, v0],
          [u1, v0],
          [u1, v1],
          [u0, v1],
        ],
        wall = new T.Color(
          this.style === "B"
            ? rand() < 0.6
              ? "#ede0bc"
              : "#b98e72"
            : rand() < 0.55
              ? "#e2d6b6"
              : "#aa7964",
        ),
        roof = new T.Color(
          this.style === "B"
            ? rand() < 0.55
              ? "#ad6749"
              : "#6e796e"
            : rand() < 0.54
              ? "#795d47"
              : "#7b4b3e",
        );
      for (let k = 0; k < 4; k++) {
        const a = base[k],
          b = base[(k + 1) % 4],
          p = vertex(a[0], a[1], -0.0008),
          q = vertex(b[0], b[1], -0.0008),
          r = vertex(a[0], a[1], h),
          t = vertex(b[0], b[1], h);
        tri(p, r, q, wall);
        tri(q, r, t, wall);
      }
      const eave = this.style === "B" ? 0.00085 : 0.00035;
      const corners = base.map(([u, v]) =>
          vertex(u + Math.sign(u - um) * eave, v + Math.sign(v - vm) * eave, h),
        ),
        ra = vertex(u0 + 0.17 * (u1 - u0), vm, h + roofH),
        rb = vertex(u1 - 0.17 * (u1 - u0), vm, h + roofH);
      tri(corners[0], ra, corners[3], roof);
      tri(corners[1], corners[2], rb, roof);
      tri(corners[0], corners[1], rb, roof);
      tri(corners[0], rb, ra, roof);
      tri(corners[3], ra, rb, roof);
      tri(corners[3], rb, corners[2], roof);
      if (this.style === "B" && u1 - u0 > 0.012) {
        // A small projecting gable articulates the model entrance.
        const front = v0 - 0.0016,
          back = v0 + 0.0018,
          span = 0.0021,
          peak = h + 0.0024;
        const a = vertex(um - span, front, h - 0.001),
          b = vertex(um + span, front, h - 0.001),
          ridge = vertex(um, front, peak),
          end = vertex(um, back, peak);
        tri(a, b, ridge, wall);
        tri(a, ridge, end, roof);
        tri(b, end, ridge, roof);
      }
      const glass = new T.Color("#3b5355"),
        sill = new T.Color("#d7c9af");
      for (const v of [v0 - 0.00005, v1 + 0.00005])
        for (let u = u0 + 0.0024; u < u1 - 0.0011; u += 0.0035) {
          const a = vertex(u, v, 0.0011),
            b = vertex(u + 0.0012, v, 0.0011),
            c = vertex(u, v, 0.0026),
            d = vertex(u + 0.0012, v, 0.0026);
          tri(a, b, c, glass);
          tri(b, d, c, glass);
          tri(a, b, vertex(u, v, 0.00092), sill);
        }
      for (let k = 0; k < 4; k++) {
        const tx = x + (rand() - 0.5) * 0.06,
          tz = z + (rand() - 0.5) * 0.058;
        if (inside(tx, tz, this.coast))
          trees.push({
            x: tx,
            z: tz,
            y: this.height(tx, tz),
            h: 0.003 + rand() * 0.005,
          });
      }
    }
    const bg = new T.BufferGeometry();
    bg.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
    bg.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    bg.computeVertexNormals();
    const houses = new T.Mesh(
      bg,
      new T.MeshLambertMaterial({
        vertexColors: true,
        side: T.DoubleSide,
      }),
    );
    houses.castShadow = true;
    houses.receiveShadow = true;
    this.buildings.add(houses);
    const dummy = new T.Object3D();
    const crowns = new T.InstancedMesh(
      this.style === "A"
        ? new T.IcosahedronGeometry(1, 1)
        : new T.DodecahedronGeometry(1, 0),
      new T.MeshLambertMaterial({
        flatShading: this.style === "B",
      }),
      trees.length,
    );
    const trunks = new T.InstancedMesh(
      new T.CylinderGeometry(1, 1.35, 1, 6),
      new T.MeshLambertMaterial({ color: 0x715d47 }),
      trees.length,
    );
    const cluster = crowns.geometry.getAttribute("position");
    for (let k = 0; k < cluster.count; k++) {
      const x = cluster.getX(k),
        y = cluster.getY(k),
        z = cluster.getZ(k);
      const d = 1 + 0.12 * Math.sin(11 * x + 9 * y + 5 * z);
      cluster.setXYZ(k, x * d, y * d, z * d);
    }
    crowns.geometry.computeVertexNormals();
    trees.forEach((t, i) => {
      dummy.position.set(t.x, t.y + t.h * 0.22, t.z);
      dummy.scale.set(t.h * 0.052, t.h * 0.44, t.h * 0.052);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      dummy.position.set(t.x, t.y + t.h * 0.78, t.z);
      dummy.scale.set(t.h * 0.53, t.h * 0.48, t.h * 0.47);
      dummy.rotation.y = i * 2;
      dummy.updateMatrix();
      crowns.setMatrixAt(i, dummy.matrix);
      crowns.setColorAt(
        i,
        new T.Color().setHSL(
          0.21 + rand() * 0.06,
          0.17 + rand() * 0.13,
          0.25 + rand() * 0.12,
        ),
      );
    });
    crowns.castShadow = true;
    this.buildings.add(crowns, trunks);
  }
  update(lat: number, lon: number, d: number, now: number) {
    const close =
      Math.abs(lat - this.region.target.lat) < 1.4 &&
      Math.abs(lon - this.region.target.lon) < 2.5;
    if (close && d < this.region.lod.loadKm && !this.loading) void this.load();
    const [near, far] = this.region.lod.fadeKm;
    this.weight.value = 1 - smooth((d - near) / (far - near));
    this.group.visible = this.ready && close && d < far;
    if (this.surface) {
      const material = (this.surface.material as T.MeshLambertMaterial[])[0];
      material.transparent = this.weight.value < 0.9999;
      material.depthWrite = !material.transparent;
    }
    this.buildings.visible = d < this.region.lod.buildingsKm;
    this.time.value = now / 1700;
  }
}
