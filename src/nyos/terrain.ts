import * as T from "three";
import { basis, clamp, position, RAD, smooth } from "../geo";
import { nyosBlendGLSL } from "./blend";
import { NyosSection } from "./section";
import { splitNyosSurface } from "./surface-lod";

export type NyosBounds = [
  west: number,
  south: number,
  east: number,
  north: number,
];
type ImageArea = { bounds: NyosBounds; file: string };
export type NyosMeta = {
  anchor: { lat: number; lon: number };
  bounds: NyosBounds;
  width: number;
  height: number;
  waterLevelM: number;
  heightRangeM?: [number, number];
  shoreline: [lon: number, lat: number][];
  heightFile: string;
  surfaceFile: string;
  regional?: ImageArea;
  vicinity?: ImageArea;
};

const folder = import.meta.env.BASE_URL + "data/nyos/";
const vector = () => new T.Vector3();

async function readTexture(name: string) {
  const tex = await new T.TextureLoader().loadAsync(folder + name);
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** No duplicate vertices across LOD rings: axis sampling stays dense near the shoreline and relaxes towards the mosaic margins. */
function samples(n: number, near0: number, near1: number) {
  const indices: number[] = [];
  for (let i = 0; i < n - 1; ) {
    indices.push(i);
    const margin = Math.max(near0 - i, i - near1, 0);
    i += margin < 12 ? 1 : margin < 45 ? 2 : 3;
  }
  indices.push(n - 1);
  return indices;
}

export class NyosTerrain {
  /** Local coordinates are east, up, south in kilometres, relative to the DEM water level at the anchor. */
  readonly group = new T.Group();
  meta: NyosMeta | null = null;
  ready = false;
  error = "";
  regionTexture: T.Texture | null = null;
  vicinityTexture: T.Texture | null = null;
  waterMesh: T.Mesh<T.ShapeGeometry, T.MeshStandardMaterial> | null = null;
  terrainMesh: T.Mesh<T.BufferGeometry, T.MeshBasicMaterial> | null = null;
  private fullWater?: T.ShapeGeometry;
  private cutWater?: T.ShapeGeometry;
  private shoreChord = { value: new T.Vector2() };
  private pending?: Promise<boolean>;
  private heights?: Int16Array;
  private shoreCells: Uint8ClampedArray | null = null;
  private origin = vector();
  private east = vector();
  private up = vector();
  private south = vector();
  private reveal = { value: 0 };
  private terrainLod?: T.LOD;
  private cut = { value: 0 };
  private cutWindow = { value: new T.Vector4() };
  private dissolved = false;
  section: NyosSection | null = null;
  private sun = { value: new T.Vector3(-1.2, 0.91, -1.05).normalize() };

  constructor(private globalHeight: (lat: number, lon: number) => number) {
    this.group.visible = false;
    this.group.name = "Landschaft am Nyos-See";
  }
  get localWeight() {
    return this.reveal.value;
  }
  load() {
    return (this.pending ??= this.loadData().then((ok) => {
      if (!ok) this.pending = undefined;
      return ok;
    }));
  }

  private async loadData() {
    const created: T.Texture[] = [];
    try {
      const response = await fetch(folder + "landscape.json");
      if (!response.ok) throw Error("Gebietsbeschreibung");
      const meta: NyosMeta = await response.json();
      if (
        !(
          meta.width >= 2 &&
          meta.height >= 2 &&
          meta.bounds?.length === 4 &&
          meta.shoreline?.length >= 4 &&
          Number.isFinite(meta.waterLevelM) &&
          Number.isFinite(meta.anchor?.lon)
        )
      )
        throw Error("Gebietsgeometrie");
      const height = fetch(folder + meta.heightFile).then(async (r) => {
        if (!r.ok) throw Error("Höhenraster");
        const data = new Int16Array(await r.arrayBuffer());
        if (data.length !== meta.width * meta.height)
          throw Error("Größe des Höhenrasters");
        return data;
      });
      const texture = async (name: string) => {
        const map = await readTexture(name);
        created.push(map);
        return map;
      };
      const [elevation, image, regional, nearby] = await Promise.allSettled([
        height,
        texture(meta.surfaceFile),
        meta.regional ? texture(meta.regional.file).catch(() => null) : null,
        meta.vicinity ? texture(meta.vicinity.file).catch(() => null) : null,
      ]);
      if (elevation.status === "rejected") throw elevation.reason;
      if (image.status === "rejected") throw image.reason;
      this.meta = meta;
      this.heights = elevation.value;
      this.regionTexture =
        regional.status === "fulfilled" ? regional.value : null;
      this.vicinityTexture =
        nearby.status === "fulfilled" ? nearby.value : null;
      const { lat, lon } = meta.anchor;
      const { east, up, north } = basis(lat, lon);
      this.east.copy(east);
      this.up.copy(up);
      this.south.copy(north).negate();
      this.origin.copy(position(lat, lon, meta.waterLevelM / 1000));
      this.group.position.copy(this.origin);
      this.group.quaternion.setFromRotationMatrix(
        new T.Matrix4().makeBasis(this.east, this.up, this.south),
      );
      this.waterMask();
      const surface = this.makeSurface(image.value);
      const water = this.makeWater();
      this.terrainMesh = surface;
      this.waterMesh = water;
      this.terrainLod = splitNyosSurface(surface);
      this.group.add(this.terrainLod, water);
      this.error = "";
      this.ready = true;
      if (this.cut.value) this.setSection(true);
      return true;
    } catch (e) {
      this.error = e instanceof Error ? e.message : "Landschaftsdaten";
      for (const tex of created) tex.dispose();
      this.regionTexture = null;
      this.vicinityTexture = null;
      this.meta = null;
      this.heights = undefined;
      return false;
    }
  }

  /** Geodetic point in the shared local tangent frame, including terrestrial curvature. */
  toLocal(lon: number, lat: number, elevationKm: number) {
    const d = position(lat, lon, elevationKm).sub(this.origin);
    return new T.Vector3(d.dot(this.east), d.dot(this.up), d.dot(this.south));
  }

  private waterMask() {
    const m = this.meta!,
      [w, s, e, n] = m.bounds;
    const canvas = document.createElement("canvas");
    // Separate, detailed optical shoreline mask: the elevation raster is too coarse to define the water edge.
    const scale = 3;
    canvas.width = Math.min(m.width * scale, 2048);
    canvas.height = Math.min(m.height * scale, 2048);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    m.shoreline.forEach(([lon, lat], i) => {
      const x = ((lon - w) / (e - w)) * canvas.width,
        y = ((n - lat) / (n - s)) * canvas.height;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = "#fff";
    ctx.fill();
    // Get the contact fraction of just the DEM nodes adjacent to the water.
    const small = document.createElement("canvas");
    small.width = m.width;
    small.height = m.height;
    const c = small.getContext("2d")!;
    c.drawImage(canvas, 0.5, 0.5, m.width - 1, m.height - 1);
    this.shoreCells = c.getImageData(0, 0, m.width, m.height).data;
  }

  private heightAt(i: number, j: number) {
    const m = this.meta!,
      k = j * m.width + i;
    const raw = this.heights![k] * 0.001;
    const onWater = this.shoreCells![4 * k] / 255;
    // Reconcile a 10 m optical shoreline with the larger radar cells at the strand.
    return T.MathUtils.lerp(raw, m.waterLevelM * 0.001, onWater);
  }

  ground(lat: number, lon: number): number | null {
    if (!this.meta || !this.heights || !this.shoreCells) return null;
    const m = this.meta,
      [w, s, e, n] = m.bounds;
    const epsilon = 1e-9;
    if (
      lon < w - epsilon ||
      lon > e + epsilon ||
      lat < s - epsilon ||
      lat > n + epsilon
    )
      return null;
    const xf = clamp((lon - w) / (e - w), 0, 1) * (m.width - 1),
      yf = clamp((n - lat) / (n - s), 0, 1) * (m.height - 1);
    const i = Math.min(m.width - 2, Math.floor(xf)),
      j = Math.min(m.height - 2, Math.floor(yf));
    const tx = xf - i,
      ty = yf - j;
    const height = T.MathUtils.lerp(
      T.MathUtils.lerp(this.heightAt(i, j), this.heightAt(i + 1, j), tx),
      T.MathUtils.lerp(
        this.heightAt(i, j + 1),
        this.heightAt(i + 1, j + 1),
        tx,
      ),
      ty,
    );
    const edge = Math.min(
      xf / (m.width - 1),
      yf / (m.height - 1),
      1 - xf / (m.width - 1),
      1 - yf / (m.height - 1),
    );
    return T.MathUtils.lerp(
      this.globalHeight(lat, lon) + 0.002,
      height,
      smooth(edge / 0.05),
    );
  }

  /** Soft valley occlusion sampled from the same DEM. The existing globe lights supply the directional shading. */
  private occlusion(i: number, j: number) {
    const m = this.meta!,
      tex = this.heights!,
      h = tex[j * m.width + i];
    const spacing =
      ((m.bounds[3] - m.bounds[1]) * RAD * 6371000) / (m.height - 1);
    let obstruction = 0;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      let horizon = 0;
      for (const r of [3, 8, 16]) {
        const x = clamp(i + r * dx, 0, m.width - 1),
          y = clamp(j + r * dy, 0, m.height - 1);
        horizon = Math.max(horizon, (tex[y * m.width + x] - h) / (spacing * r));
      }
      obstruction += Math.min(0.8, horizon);
    }
    return 1 - 0.05 * obstruction;
  }

  lightDirection(worldSun: T.Vector3) {
    if (this.group.visible)
      this.sun.value.set(
        worldSun.dot(this.east),
        worldSun.dot(this.up),
        worldSun.dot(this.south),
      );
  }

  private makeSurface(photo: T.Texture) {
    const m = this.meta!,
      [w, s, e, n] = m.bounds;
    const ix = m.shoreline.map((p) => ((p[0] - w) / (e - w)) * (m.width - 1));
    const iy = m.shoreline.map((p) => ((n - p[1]) / (n - s)) * (m.height - 1));
    const x = samples(m.width, Math.min(...ix), Math.max(...ix));
    const y = samples(m.height, Math.min(...iy), Math.max(...iy));
    const pos: number[] = [],
      tex: number[] = [],
      colors: number[] = [],
      faces: number[] = [];
    for (const [r, j] of y.entries()) {
      const v = j / (m.height - 1),
        lat = n - v * (n - s);
      for (const [c, i] of x.entries()) {
        const u = i / (m.width - 1),
          lon = w + u * (e - w),
          height = this.ground(lat, lon)!;
        // A covered backing surface closes tiny subpixel shoreline gaps across different DEM and optical resolutions.
        // It is hidden under the water and carries no bathymetric information.
        const backing = (0.008 * this.shoreCells![4 * (j * m.width + i)]) / 255;
        const p = this.toLocal(lon, lat, height - backing);
        pos.push(p.x, p.y, p.z);
        tex.push(u, 1 - v);
        const ao = this.occlusion(i, j);
        colors.push(ao, ao, ao);
        if (r && c) {
          const d = r * x.length + c,
            a = d - x.length - 1,
            b = a + 1,
            f = d - 1;
          faces.push(a, f, b, b, f, d);
        }
      }
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new T.Float32BufferAttribute(tex, 2));
    geo.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    geo.userData = { columns: x.length, rows: y.length };
    geo.setIndex(faces);
    geo.computeVertexNormals();
    // Satellite colour already includes ground texture. The matte terrain uses
    // Lambert shading at DEM vertices and the globe's current sun in this tangent frame.
    const mat = new T.MeshBasicMaterial({
      map: photo,
      transparent: true,
      depthWrite: true,
      vertexColors: true,
    });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uNyosWeight = this.reveal;
      shader.uniforms.uNyosSun = this.sun;
      shader.uniforms.nyosCut = this.cut;
      shader.uniforms.nyosCutWindow = this.cutWindow;
      shader.uniforms.nyosShoreChord = this.shoreChord;
      shader.vertexShader =
        "uniform vec3 uNyosSun; varying vec3 nyosLandPoint;\n" +
        shader.vertexShader.replace(
          "#include <color_vertex>",
          `#include <color_vertex>
         nyosLandPoint=position.xzy;
         float sunlight=max(dot(normalize(normal),uNyosSun),0.0);
         vColor.rgb *= vec3(.57,.61,.59) + vec3(.68,.62,.53)*sunlight;`,
        );
      shader.fragmentShader =
        `uniform float uNyosWeight, nyosCut; uniform vec4 nyosCutWindow; uniform vec2 nyosShoreChord; varying vec3 nyosLandPoint;
        ${nyosBlendGLSL}\n` +
        shader.fragmentShader.replace(
          "#include <map_fragment>",
          `
          // Set the submerged DEM backing back from the optical cut edge. Drawing a
          // second shallow surface on that viewing line produces a stippled seam.
          float startX = nyosLandPoint.z<-.001 && nyosLandPoint.y>nyosShoreChord.x &&
                         nyosLandPoint.y<nyosShoreChord.y ? -.026 : nyosCutWindow.x;
          if(nyosCut>.5 && nyosLandPoint.x>=startX && nyosLandPoint.x<nyosCutWindow.y &&
              nyosLandPoint.y>nyosCutWindow.z && nyosLandPoint.y<nyosCutWindow.w) discard;
          float coverage=nyosCoverage(vMapUv,uNyosWeight);
          if (coverage<.002) discard;
          diffuseColor.a *= coverage;
          #include <map_fragment>
        `,
        );
    };
    const mesh = new T.Mesh(geo, mat);
    mesh.name = "Nyos · Satellitenbild auf Copernicus-Höhenraster";
    return mesh;
  }

  private makeWater() {
    const m = this.meta!;
    const shore = m.shoreline.map(([lon, lat]) =>
      this.toLocal(lon, lat, m.waterLevelM / 1000),
    );
    const makeGeometry = (ring: T.Vector3[]) => {
      const outline = new T.Shape();
      ring.forEach((p, i) => {
        if (i) outline.lineTo(p.x, -p.z);
        else outline.moveTo(p.x, -p.z);
      });
      outline.closePath();
      const geometry = new T.ShapeGeometry(outline);
      geometry.rotateX(-Math.PI / 2);
      return geometry;
    };
    // Clip the polygon before triangulation. Both section faces now share the same
    // exact chord in space, including under multisampling at shallow viewing angles.
    const west: T.Vector3[] = [];
    for (let i = 0; i < shore.length; i++) {
      const a = shore[i],
        b = shore[(i + 1) % shore.length];
      if (a.x > 0 !== b.x > 0)
        west.push(
          new T.Vector3(0, 0, T.MathUtils.lerp(a.z, b.z, -a.x / (b.x - a.x))),
        );
      if (b.x <= 0) west.push(b);
    }
    this.fullWater = makeGeometry(shore);
    this.cutWater = makeGeometry(west);
    const geom = this.fullWater;
    const mat = new T.MeshStandardMaterial({
      color: "#31593e",
      transparent: true,
      depthWrite: true,
      metalness: 0.02,
      roughness: 0.34,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const t = this.reveal;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uNyosWeight = t;
      shader.uniforms.nyosCut = this.cut;
      shader.vertexShader =
        "varying vec2 nyosSurface;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\n nyosSurface = position.xz;",
        );
      shader.fragmentShader =
        `varying vec2 nyosSurface; uniform float uNyosWeight,nyosCut;\n${nyosBlendGLSL}\n` +
        shader.fragmentShader
          .replace(
            "#include <alphatest_fragment>",
            "#include <alphatest_fragment>\n diffuseColor.a *= uNyosWeight;",
          )
          .replace(
            "#include <opaque_fragment>",
            `
          // A calm surface picks up the sky at grazing angles. Stable, metre-scale ripples leave the shoreline fixed.
          float shoreSky = pow(1.0-clamp(dot(normalize(vViewPosition),normal),0.0,1.0),3.0);
          vec2 p = nyosSurface*1000.0;
          float grain = sin(p.y*.27 + .8*sin(p.x*.062+p.y*.013)) *
                        sin(p.y*.082 + p.x*.031 + .7*sin(p.x*.02));
          float resolved = 1.0-smoothstep(2.2,8.0,max(fwidth(p.y),fwidth(p.x)));
          outgoingLight=mix(outgoingLight,vec3(.17,.26,.25),.08+.49*shoreSky);
          outgoingLight += vec3(.008,.012,.009)*grain*resolved;
          #include <opaque_fragment>
        `,
          );
    };
    const water = new T.Mesh(geom, mat);
    water.renderOrder = 1;
    water.name = "Nyos · beobachtete Wasserfläche";
    return water;
  }

  fromLocal(x: number, z: number) {
    const point = this.origin
      .clone()
      .addScaledVector(this.east, x)
      .addScaledVector(this.south, z);
    return {
      lon: Math.atan2(point.x, point.z) / RAD,
      lat: Math.asin(point.y / point.length()) / RAD,
    };
  }

  setSection(enabled: boolean) {
    this.cut.value = Number(enabled);
    const meta = this.meta,
      photo = this.terrainMesh?.material.map;
    if (enabled && this.ready && meta && photo && !this.section) {
      const [w, s, e, n] = meta.bounds;
      const shore = meta.shoreline.map(([lon, lat]) =>
        this.toLocal(lon, lat, meta.waterLevelM / 1000),
      );
      this.section = new NyosSection(
        shore,
        (x, z) => {
          const { lon, lat } = this.fromLocal(x, z);
          const elevation = this.ground(lat, lon) ?? meta.waterLevelM / 1000;
          const u = (lon - w) / (e - w),
            v = (lat - s) / (n - s);
          const i = clamp(Math.round(u * (meta.width - 1)), 0, meta.width - 1);
          const j = clamp(
            Math.round((1 - v) * (meta.height - 1)),
            0,
            meta.height - 1,
          );
          return {
            height: this.toLocal(lon, lat, elevation).y,
            u,
            v,
            water: this.shoreCells![4 * (i + j * meta.width)] / 255,
          };
        },
        photo,
        this.sun,
      );
      this.cutWindow.value.copy(this.section.window);
      this.shoreChord.value.set(this.section.start, this.section.end);
      this.group.add(this.section.group);
    }
    if (this.waterMesh && this.fullWater && this.cutWater)
      this.waterMesh.geometry = enabled ? this.cutWater : this.fullWater;
    if (this.section) {
      this.section.group.visible = enabled;
      this.section.showDissolved(this.dissolved);
    }
  }
  setDissolved(enabled: boolean) {
    this.dissolved = enabled;
    this.section?.showDissolved(enabled);
  }

  update(distanceKm: number, active: boolean) {
    this.reveal.value =
      active && this.ready ? 1 - smooth((distanceKm - 16) / 26) : 0;
    this.group.visible = this.reveal.value > 0;
  }
  diagnostics() {
    return {
      ready: this.ready,
      error: this.error,
      localWeight: this.localWeight,
      surfaceVisible: this.group.visible && !!this.terrainMesh,
      surfaceLod: this.terrainLod?.userData.surfaceStats,
      sectionVisible: this.group.visible && !!this.section?.group.visible,
      dissolvedVisible:
        this.group.visible && !!this.section?.group.visible && this.dissolved,
      supplyVisible:
        this.group.visible && !!this.section?.group.visible && this.dissolved,
      depthM: this.section ? this.section.maxDepth * 1000 : null,
      profileSpanKm: this.section
        ? this.section.end - this.section.start
        : null,
      waterVisible: this.group.visible && !!this.waterMesh?.visible,
      triangles: (this.terrainMesh?.geometry.index?.count ?? 0) / 3,
      shorelineVertices: this.meta?.shoreline.length ?? 0,
      waterLevelM: this.meta?.waterLevelM ?? null,
      bounds: this.meta?.bounds ?? null,
      regionTextureReady: !!this.regionTexture,
      vicinityTextureReady: !!this.vicinityTexture,
    };
  }
}
