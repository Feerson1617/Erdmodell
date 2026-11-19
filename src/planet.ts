import * as T from "three";
import { angularDistance, R, RAD, position, clamp, smooth } from "./geo";
import { flattening } from "./regions";
import { type Style, styles } from "./model";
import type { Bounds } from "./regions";
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
  readonly uploadedTiles = new Set<T.BufferGeometry>();
  private cache = new Map<string, Tile>();
  private tick = 0;
  private stamp = "";
  style: Style = "A";
  heightData?: Int16Array;
  maps: Partial<Record<Style, T.Texture>> = {};
  material = new T.MeshBasicMaterial({ vertexColors: true });
  private light = { value: new T.Vector3(0, 1, 1).normalize() };
  private mapWeights = { value: new T.Vector3() };
  private nyos = {
    far: { value: null as T.Texture | null },
    mid: { value: null as T.Texture | null },
    farBounds: { value: new T.Vector4(0, 0, 1, 1) },
    midBounds: { value: new T.Vector4(0, 0, 1, 1) },
    bounds: { value: new T.Vector4(0, 0, 1, 1) },
    weights: { value: new T.Vector3() },
  };
  setNyosMaps(bounds: Bounds, farBounds?: Bounds, far?: T.Texture | null, midBounds?: Bounds, mid?: T.Texture | null) {
    const setRect = (v: T.Vector4, b: Bounds) => v.set(b[0], b[1], b[2] - b[0], b[3] - b[1]);
    setRect(this.nyos.bounds.value, bounds);
    if (farBounds) setRect(this.nyos.farBounds.value, farBounds);
    if (midBounds) setRect(this.nyos.midBounds.value, midBounds);
    this.nyos.far.value = far ?? this.baseline ?? null;
    this.nyos.mid.value = mid ?? this.baseline ?? null;
  }
  setNyosWeights(far: number, mid: number, local: number) {
    this.nyos.weights.value.set(far, mid, local);
  }
  private midMaps: (T.Texture | undefined)[] = [];
  private regionalAtlas?: T.Texture;
  private regionalSampler: { value: T.Texture | undefined } = {
    value: undefined,
  };
  private deadline = 0;
  private incomplete = false;
  private alternate = new Map<string, Tile>();
  lightDirection(v: T.Vector3) {
    this.light.value.copy(v);
  }
  baseline?: T.Texture;
  constructor(private warn: (s: string) => void) {}
  async init() {
    this.baseline = await texture("earth-base.webp");
    this.material.map = this.baseline;
    const [a, b, r, h, cover, aerial, atlas] = await Promise.allSettled([
      texture("earth.webp"),
      texture("earth-atlas.webp"),
      texture("north-europe.webp"),
      fetch(dataUrl("relief.i16")).then(async (r) => {
        if (!r.ok) throw Error();
        const a = new Int16Array(await r.arrayBuffer());
        if (a.length !== 721 * 361) throw Error();
        return a;
      }),
      texture("northsea-cover.webp"),
      texture("wadden-air.webp"),
      texture("north-europe-atlas.webp"),
    ]);
    if (a.status === "fulfilled") this.maps.A = a.value;
    if (b.status === "fulfilled") this.maps.B = b.value;
    if (h.status === "fulfilled") this.heightData = h.value;
    if ([a, b, r, h].some((x) => x.status === "rejected"))
      this.warn("Vereinfachte Weltkarte · Detaildaten fehlen");
    this.midMaps = [r, cover, aerial].map((p) =>
      p.status === "fulfilled" ? p.value : undefined,
    );
    if (cover.status === "rejected" || aerial.status === "rejected")
      this.warn("Regionale Detailkarte fehlt · verfügbare Auflösungen aktiv");
    this.regionalAtlas = atlas.status === "fulfilled" ? atlas.value : undefined;
    this.material.onBeforeCompile = (shader) => {
      shader.uniforms.sunUnit = this.light;
      shader.uniforms.weights = this.mapWeights;
      Object.assign(shader.uniforms, {
        nyosFar: this.nyos.far, nyosMid: this.nyos.mid,
        nyosFarBounds: this.nyos.farBounds, nyosMidBounds: this.nyos.midBounds,
        nyosBounds: this.nyos.bounds, nyosWeights: this.nyos.weights,
      });
      this.midMaps.forEach(
        (map, i) =>
          (shader.uniforms["layer" + i] = { value: map ?? this.baseline }),
      );
      shader.uniforms.layer0 = this.regionalSampler;
      shader.vertexShader =
        "uniform vec3 sunUnit;varying float earthLight;uniform vec3 nyosWeights;uniform vec4 nyosBounds;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\n earthLight=.36+1.05*max(0.,dot(normalize(normal),sunUnit))+.10*normal.y;",
        ).replace("#include <project_vertex>", `
          #include <project_vertex>
          if(nyosWeights.z>0.0) {
            vec2 p=(uv*vec2(360.,180.)-vec2(180.,90.)-nyosBounds.xy)/nyosBounds.zw;
            float margin=min(min(p.x,1.-p.x),min(p.y,1.-p.y));
            float footprint=smoothstep(-0.7,-0.15,margin);
            // Keep a continuous, opaque map beneath the DEM, including its feathered rim.
            // Change depth alone, preserving the geographic position of every background pixel.
            gl_Position.z += max(0.,gl_Position.w-gl_Position.z)*.96*nyosWeights.z*footprint;
          }`);
      shader.fragmentShader =
        `
        varying float earthLight;uniform vec3 weights;uniform sampler2D layer0,layer1,layer2;
        uniform vec3 nyosWeights;uniform vec4 nyosFarBounds,nyosMidBounds,nyosBounds;
        uniform sampler2D nyosFar,nyosMid;
        vec4 sampleLayer(sampler2D img,vec2 ll,vec4 rect,float weight){
          vec2 uv=(ll-rect.xy)/rect.zw;float edge=min(min(uv.x,uv.y),min(1.-uv.x,1.-uv.y));
          if(edge<=0.||weight<=0.)return vec4(0.);
          vec4 c=texture2D(img,uv);return vec4(c.rgb,c.a*weight*smoothstep(0.,.1,edge));}
        ` +
        shader.fragmentShader.replace(
          "#include <map_fragment>",
          `
          vec2 ll=vMapUv*vec2(360.,180.)-vec2(180.,90.);
          vec4 local=sampleLayer(layer2,ll,vec4(8.26,54.42,.62,.38),weights.z);
          vec4 cover=sampleLayer(layer1,ll,vec4(7.55,54.01,1.44,1.09),weights.y);
          vec3 earth=cover.rgb;
          if(cover.a<.9999){
            vec4 region=sampleLayer(layer0,ll,vec4(4.,51.,9.,8.),weights.x);
            earth=region.rgb;
            if(region.a<.9999)earth=mix(texture2D(map,vMapUv).rgb,region.rgb,region.a);
            earth=mix(earth,cover.rgb,cover.a);
          }
          if(nyosWeights.x>0.0) {
            vec4 farRegion=sampleLayer(nyosFar,ll,nyosFarBounds,nyosWeights.x);
            earth=mix(earth,farRegion.rgb,farRegion.a);
          }
          if(nyosWeights.y>0.0) {
            vec4 nearRegion=sampleLayer(nyosMid,ll,nyosMidBounds,nyosWeights.y);
            earth=mix(earth,nearRegion.rgb,nearRegion.a);
          }
          diffuseColor.rgb*=mix(earth,local.rgb,local.a);
          diffuseColor.rgb*=earthLight;`,
        );
    };
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
    return Math.max(0, h * 0.001) * flattening(lat, lon);
  }
  setStyle(s: Style) {
    if (this.style !== s) {
      for (const { mesh } of this.cache.values()) mesh.visible = false;
      [this.cache, this.alternate] = [this.alternate, this.cache];
    }
    this.regionalSampler.value =
      (s === "B" ? this.regionalAtlas : undefined) ??
      this.midMaps[0] ??
      this.baseline;
    this.style = s;
    this.material.map = this.maps[s] ?? this.baseline ?? null;
    this.material.needsUpdate = true;
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
      n =
        z < 3
          ? styles[this.style].segments
          : Math.max(6, styles[this.style].segments / 3);
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
        nor.push(v.x, v.y, v.z);
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
          0.94 + 0.12 * (0.5 + 0.5 * Math.sin(i * 79.7 + x * 53 + y * 2));
        for (let j = 0; j < 3; j++) col.push(q, q, q);
      }
    } else for (let i = 0; i < pos.length / 3; i++) col.push(1, 1, 1);
    g.setAttribute("color", new T.Float32BufferAttribute(col, 3));
    // Count an actual WebGL upload, including reupload after context restoration.
    (g.getAttribute("position") as T.BufferAttribute).onUpload(() => this.uploadedTiles.add(g));
    const mesh = new T.Mesh(g, this.material);
    mesh.position.copy(center);
    this.group.add(mesh);
    this.cache.set(key, { mesh, used: this.tick });
  }
  update(lat: number, lon: number, d: number) {
    lon = ((((lon + 180) % 360) + 360) % 360) - 180;
    this.mapWeights.value.set(
      this.midMaps[0] ? 1 - smooth((d - 240) / 1200) : 0,
      this.midMaps[1] ? 1 - smooth((d - 65) / 380) : 0,
      this.midMaps[2]
        ? (this.style === "A" ? 0.95 : 0.38) * (1 - smooth((d - 12) / 100))
        : 0,
    );
    const level = clamp(Math.ceil(Math.log2(1300 / d)), 0, 10),
      q = 45 / 2 ** level / 4;
    const stamp = [level, Math.floor(lon / q), Math.floor(lat / q)].join(":");
    if (stamp === this.stamp && !this.incomplete) return;
    this.incomplete = false;
    this.deadline = performance.now() + 3;
    this.stamp = stamp;
    this.tick++;
    for (const t of this.cache.values()) t.mesh.visible = false;
    // Conservative spherical horizon around the target, allowing for tilted cameras,
    // LOD position quantization and the maximum terrestrial elevation.
    const horizon =
      Math.acos(R / (R + Math.max(d, 1300 / 2 ** Math.max(0, level - 1)))) +
      Math.acos(R / (R + 9)) +
      Math.asin(Math.min(1, d / R)) +
      q * RAD * 2;
    const sl = Math.sin(lat * RAD),
      cl = Math.cos(lat * RAD);
    const visit = (z: number, x: number, y: number) => {
      const s = 45 / 2 ** z,
        dx = Math.abs(angularDistance(-180 + (x + 0.5) * s, lon)),
        dy = Math.abs(lat - (-90 + (y + 0.5) * s));
      const limit = horizon + s * RAD,
        centerLat = (-90 + (y + 0.5) * s) * RAD;
      if (
        limit < Math.PI &&
        sl * Math.sin(centerLat) +
          cl * Math.cos(centerLat) * Math.cos(dx * RAD) <
          Math.cos(limit)
      )
        return;
      if (z < level && dx < 1.05 * s && dy < 1.05 * s) {
        // Keep the parent until all four children are resident (no holes on budget exhaustion).
        for (let j = 0; j < 2; j++)
          for (let i = 0; i < 2; i++) {
            const k = [z + 1, 2 * x + i, 2 * y + j].join("/"),
              t = this.cache.get(k);
            if (t) {
              t.used = this.tick;
              continue;
            }
            if (performance.now() > this.deadline) {
              this.incomplete = true;
              this.tile(z, x, y);
              return;
            }
            this.tile(z + 1, 2 * x + i, 2 * y + j);
            this.cache.get(k)!.mesh.visible = false;
          }
        for (let j = 0; j < 2; j++)
          for (let i = 0; i < 2; i++) visit(z + 1, 2 * x + i, 2 * y + j);
      } else this.tile(z, x, y);
    };
    for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) visit(0, x, y);
    for (const [k, t] of this.cache) {
      if (
        this.cache.size > 260 &&
        t.used < this.tick - 2 &&
        !k.startsWith("0/")
      ) {
        this.group.remove(t.mesh);
        this.uploadedTiles.delete(t.mesh.geometry);
        t.mesh.geometry.dispose();
        this.cache.delete(k);
      }
    }
  }
  get cachedTileCount() {
    return this.cache.size + this.alternate.size;
  }
  get tileCount() {
    return this.cache.size;
  }
}
