import * as T from "three";
import { R, RAD, position, clamp, smooth } from "./geo";
import { type Style, styles } from "./model";
export const dataUrl = (file: string) =>
  import.meta.env.BASE_URL + "data/" + file;
export async function texture(file: string) {
  const t = await new T.TextureLoader().loadAsync(dataUrl(file));
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
type Tile = { mesh: T.Mesh; used: number };
export class TerrainLODManager {
  group = new T.Group();
  private cache = new Map<string, Tile>();
  private tick = 0;
  private stamp = "";
  style: Style = "A";
  heightData?: Int16Array;
  maps: Partial<Record<Style, T.Texture>> = {};
  material = new T.MeshStandardMaterial({
    roughness: 0.92,
    vertexColors: true,
  });
  regionWeight = { value: 0 };
  regional?: T.Texture;
  baseline?: T.Texture;
  constructor(private warn: (s: string) => void) {}
  async init() {
    this.baseline = await texture("earth-base.webp");
    this.material.map = this.baseline;
    const [a, b, r, h] = await Promise.allSettled([
      texture("earth.webp"),
      texture("earth-soft.webp"),
      texture("region.webp"),
      fetch(dataUrl("relief.i16")).then(async (r) => {
        if (!r.ok) throw Error();
        const a = new Int16Array(await r.arrayBuffer());
        if (a.length !== 721 * 361) throw Error();
        return a;
      }),
    ]);
    if (a.status === "fulfilled") this.maps.A = a.value;
    if (b.status === "fulfilled") this.maps.B = b.value;
    if (h.status === "fulfilled") this.heightData = h.value;
    if ([a, b, r, h].some((x) => x.status === "rejected"))
      this.warn("Vereinfachte Weltkarte · Detaildaten fehlen");
    if (r.status === "fulfilled") {
      this.regional = r.value;
      this.material.onBeforeCompile = (s) => {
        s.uniforms.regional = { value: this.regional };
        s.uniforms.rWeight = this.regionWeight;
        s.fragmentShader =
          "uniform sampler2D regional; uniform float rWeight;\n" +
          s.fragmentShader;
        s.fragmentShader = s.fragmentShader.replace(
          "#include <map_fragment>",
          `#include <map_fragment>
       vec2 rr=(vMapUv*vec2(360.,180.)-vec2(184.,141.))/vec2(9.,8.);
       float edge=min(min(rr.x,rr.y),min(1.-rr.x,1.-rr.y));
       diffuseColor.rgb=mix(diffuseColor.rgb,texture2D(regional,clamp(rr,0.,1.)).rgb,rWeight*smoothstep(0.,.09,edge));`,
        );
      };
    }
    this.setStyle(this.style);
  }
  elevation(lat: number, lon: number) {
    if (!this.heightData) return 0;
    const x = ((((lon + 180) % 360) + 360) % 360) * 2,
      y = clamp((90 - lat) * 2, 0, 359.999),
      i = Math.floor(x),
      j = Math.floor(y),
      s = x - i,
      t = y - j,
      a = this.heightData;
    const h =
      (1 - t) * ((1 - s) * a[j * 721 + i] + s * a[j * 721 + i + 1]) +
      t * ((1 - s) * a[(j + 1) * 721 + i] + s * a[(j + 1) * 721 + i + 1]);
    // Modelled Hallig patch meets mean sea level, not a coarse filtered DEM.
    const w = smooth(
      Math.max(Math.abs(lon - 8.544) / 0.12, Math.abs(lat - 54.57) / 0.09) - 1,
    );
    return Math.max(0, h * 0.001) * w;
  }
  setStyle(s: Style) {
    this.style = s;
    this.material.map = this.maps[s] ?? this.baseline ?? null;
    this.material.flatShading = s === "B";
    this.material.needsUpdate = true;
    for (const t of this.cache.values()) {
      this.group.remove(t.mesh);
      t.mesh.geometry.dispose();
    }
    this.cache.clear();
    this.stamp = "";
  }
  private tile(z: number, x: number, y: number) {
    const key = [z, x, y].join("/");
    let t = this.cache.get(key);
    if (t) {
      t.used = this.tick;
      t.mesh.visible = true;
      return;
    }
    const span = 45 / 2 ** z,
      west = -180 + x * span,
      south = -90 + y * span,
      n = styles[this.style].segments;
    const center = position(south + span / 2, west + span / 2),
      pos: number[] = [],
      uv: number[] = [],
      nor: number[] = [],
      col: number[] = [],
      idx: number[] = [];
    for (let j = 0; j <= n; j++)
      for (let i = 0; i <= n; i++) {
        const lat = south + (span * j) / n,
          lon = west + (span * i) / n,
          p = position(lat, lon, this.elevation(lat, lon)),
          v = p.clone().normalize();
        pos.push(...p.sub(center).toArray());
        nor.push(...v.toArray());
        uv.push((lon + 180) / 360, (lat + 90) / 180);
      }
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const a = j * (n + 1) + i,
          b = a + n + 1;
        idx.push(a, a + 1, b, a + 1, b + 1, b);
      }
    // Short skirts bridge fine edges to coarser spherical chords at LOD boundaries.
    const edge = [...Array(n).keys()],
      rim = [
        ...edge,
        ...edge.map((j) => j * (n + 1) + n),
        ...edge.map((i) => n * (n + 1) + n - i),
        ...edge.map((j) => (n - j) * (n + 1)),
      ];
    const drop = R * (1 - Math.cos((span * RAD) / n)) + 0.003;
    const start = pos.length / 3;
    rim.forEach((k, i) => {
      for (let c = 0; c < 3; c++) {
        pos.push(pos[3 * k + c] - nor[3 * k + c] * drop);
        nor.push(nor[k * 3 + c]);
      }
      uv.push(uv[2 * k], uv[2 * k + 1]);
      const next = (i + 1) % rim.length;
      idx.push(k, start + i, rim[next], rim[next], start + i, start + next);
    });
    let g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new T.Float32BufferAttribute(nor, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    if (this.style === "B") {
      const original = g;
      g = g.toNonIndexed();
      original.dispose();
      for (let i = 0; i < g.attributes.position.count / 3; i++) {
        const q =
          0.84 + 0.24 * (0.5 + 0.5 * Math.sin(i * 79.7 + x * 53 + y * 2));
        for (let j = 0; j < 3; j++) col.push(q, q, q);
      }
    } else for (let i = 0; i < pos.length / 3; i++) col.push(1, 1, 1);
    g.setAttribute("color", new T.Float32BufferAttribute(col, 3));
    const mesh = new T.Mesh(g, this.material);
    mesh.position.copy(center);
    this.group.add(mesh);
    this.cache.set(key, { mesh, used: this.tick });
  }
  update(lat: number, lon: number, d: number) {
    lon = ((((lon + 180) % 360) + 360) % 360) - 180;
    this.regionWeight.value = 1 - smooth((d - 80) / 800);
    const level = clamp(Math.ceil(Math.log2(1300 / d)), 0, 10),
      q = 45 / 2 ** level / 4;
    const stamp = [level, Math.floor(lon / q), Math.floor(lat / q)].join(":");
    if (stamp === this.stamp) return;
    this.stamp = stamp;
    this.tick++;
    for (const t of this.cache.values()) t.mesh.visible = false;
    const visit = (z: number, x: number, y: number) => {
      const s = 45 / 2 ** z,
        dx = Math.abs(((lon - (-180 + (x + 0.5) * s) + 540) % 360) - 180),
        dy = Math.abs(lat - (-90 + (y + 0.5) * s));
      if (z < level && dx < 1.05 * s && dy < 1.05 * s) {
        for (let j = 0; j < 2; j++)
          for (let i = 0; i < 2; i++) visit(z + 1, 2 * x + i, 2 * y + j);
      } else this.tile(z, x, y);
    };
    for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) visit(0, x, y);
    for (const [k, t] of this.cache) {
      if (
        t.used < this.tick - 2 ||
        (this.cache.size > 224 && t.used < this.tick)
      ) {
        this.group.remove(t.mesh);
        t.mesh.geometry.dispose();
        this.cache.delete(k);
      }
    }
  }
  get tileCount() {
    return this.cache.size;
  }
}
