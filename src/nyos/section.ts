import * as T from "three";
import { clamp, smooth } from "../geo";

export type SectionSample = { height: number; u: number; v: number };
type Sample = (x: number, z: number) => SectionSample;

/** The real north–south shoreline chord brackets a deliberately schematic basin profile. */
export class NyosSection {
  readonly group = new T.Group();
  readonly maxDepth = 0.208;
  readonly start: number;
  readonly end: number;
  readonly window: T.Vector4;
  readonly dissolved = { value: 0 };
  private source = new T.Group();

  constructor(
    shore: T.Vector3[],
    private sample: Sample,
    photo: T.Texture,
    sun: { value: T.Vector3 },
  ) {
    // Intersections are measured in local east/up/south. Choose the interval containing the anchored lake centre.
    const hits: number[] = [];
    for (let i = 0; i < shore.length; i++) {
      const a = shore[i],
        b = shore[(i + 1) % shore.length];
      if (a.x > 0 !== b.x > 0)
        hits.push(T.MathUtils.lerp(a.z, b.z, -a.x / (b.x - a.x)));
    }
    hits.sort((a, b) => a - b);
    const pair = hits.findIndex(
      (z, i) => i % 2 === 0 && z <= 0 && hits[i + 1] > 0,
    );
    if (pair < 0)
      throw Error("Der Schnitt trifft kein geschlossenes Seebecken.");
    this.start = hits[pair];
    this.end = hits[pair + 1];
    const east = Math.max(...shore.map((p) => p.x)) + 0.86;
    this.window = new T.Vector4(0, east, this.start - 0.29, this.end + 0.29);
    this.group.name = "Nyos · offener Seeschnitt in der Landschaft";
    const zs: number[] = [];
    for (const [a, b, steps] of [
      [this.window.z, this.start, 15],
      [this.start, this.end, 74],
      [this.end, this.window.w, 15],
    ]) {
      for (let i = 0; i < steps; i++)
        zs.push(T.MathUtils.lerp(a, b, i / steps));
    }
    zs.push(this.window.w);
    this.group.add(
      this.apron(photo, sun, zs),
      this.bedrock(zs),
      this.waterFace(),
      this.source,
    );
    this.makeSource();
    this.group.visible = false;
  }

  depthAt(z: number) {
    const u = clamp((z - this.start) / (this.end - this.start), 0, 1);
    const broad = Math.pow(Math.max(0, Math.sin(Math.PI * u)), 0.73);
    // A smooth shoulder at one end distinguishes the teaching profile from a measured sounding curve.
    const shoulder = 1 - 0.085 * Math.exp(-Math.pow((u - 0.24) / 0.105, 2));
    return this.maxDepth * broad * shoulder;
  }

  private excavation(x: number, z: number) {
    const opening =
      (1 - smooth((x - 0.46) / (this.window.y - 0.46))) *
      smooth((z - this.window.z) / 0.29) *
      smooth((this.window.w - z) / 0.29);
    const original = this.sample(x, z);
    const rockFloor =
      Math.min(original.height, -0.292) + 0.014 * x + 0.004 * Math.sin(4 * z);
    return {
      ...original,
      y: T.MathUtils.lerp(original.height, rockFloor, opening),
      opening,
    };
  }

  private apron(photo: T.Texture, sun: { value: T.Vector3 }, zs: number[]) {
    const positions: number[] = [],
      uv: number[] = [],
      exposure: number[] = [],
      indices: number[] = [];
    const width = 54;
    for (let row = 0; row < zs.length; row++)
      for (let col = 0; col <= width; col++) {
        const x = (this.window.y * col) / width,
          z = zs[row],
          p = this.excavation(x, z);
        positions.push(x, p.y, z);
        uv.push(p.u, p.v);
        exposure.push(smooth(p.opening / 0.64));
        if (row && col) {
          const d = row * (width + 1) + col,
            a = d - width - 2;
          indices.push(a, d - 1, a + 1, a + 1, d - 1, d);
        }
      }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    g.setAttribute("exposure", new T.Float32BufferAttribute(exposure, 1));
    g.setIndex(indices);
    g.computeVertexNormals();
    const m = new T.MeshBasicMaterial({ map: photo });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uNyosSun = sun;
      shader.vertexShader =
        "attribute float exposure; uniform vec3 uNyosSun; varying float cutExposure,cutLight; varying vec2 cutXZ;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\n cutExposure=exposure; cutLight=.60+.58*max(0.0,dot(normalize(normal),uNyosSun)); cutXZ=position.xz;",
        );
      shader.fragmentShader =
        "varying float cutExposure,cutLight; varying vec2 cutXZ;\n" +
        shader.fragmentShader.replace(
          "#include <map_fragment>",
          `#include <map_fragment>
        float grain=.94+.06*sin(38.*cutXZ.x+sin(9.*cutXZ.y))*.65+.035*sin(75.*cutXZ.y+19.*cutXZ.x);
        diffuseColor.rgb = mix(diffuseColor.rgb,vec3(.20,.158,.111)*grain,cutExposure)*cutLight;`,
        );
    };
    const apron = new T.Mesh(g, m);
    apron.name = "Vorderes Gelände bis unter die Schnittsohle geöffnet";
    return apron;
  }

  private bedrock(zs: number[]) {
    const xyz: number[] = [],
      colors: number[] = [],
      idx: number[] = [];
    const rows = 12;
    const low = new T.Color("#64594b"),
      high = new T.Color("#9b8160");
    for (let i = 0; i < zs.length; i++) {
      const z = zs[i],
        basement = this.excavation(0, z);
      const border =
        z >= this.start && z <= this.end ? -this.depthAt(z) : basement.height;
      for (let j = 0; j <= rows; j++) {
        const t = j / rows,
          y = T.MathUtils.lerp(basement.y, border, t);
        xyz.push(0, y, z);
        const c = low
          .clone()
          .lerp(high, 0.3 + 0.55 * t)
          .multiplyScalar(
            0.96 + 0.045 * Math.sin(y * 214 + 1.1 * Math.sin(z * 8)),
          );
        colors.push(c.r, c.g, c.b);
        if (i && j) {
          const d = i * (rows + 1) + j,
            a = d - rows - 2;
          idx.push(a, a + 1, d - 1, d - 1, a + 1, d);
        }
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(xyz, 3));
    g.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    g.setIndex(idx);
    const rock = new T.Mesh(
      g,
      new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide }),
    );
    rock.name = "Gestein am schematischen Seegrund";
    return rock;
  }

  private waterFace() {
    const xyz: number[] = [],
      idx: number[] = [];
    const n = 86;
    for (let i = 0; i <= n; i++) {
      const z = T.MathUtils.lerp(this.start, this.end, i / n);
      xyz.push(0.0004, 0, z, 0.0004, -this.depthAt(z), z);
      if (i) {
        const a = 2 * i - 2;
        idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(xyz, 3));
    g.setIndex(idx);
    const mat = new T.MeshBasicMaterial({ side: T.DoubleSide });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.nyosDissolved = this.dissolved;
      shader.vertexShader =
        "varying float depthAtFace;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\n depthAtFace=max(0.,-position.y);",
        );
      shader.fragmentShader =
        "varying float depthAtFace; uniform float nyosDissolved;\n" +
        shader.fragmentShader.replace(
          "#include <color_fragment>",
          `#include <color_fragment>
         float mid = smoothstep(.016,.075,depthAtFace);
         float deep = smoothstep(.062,.196,depthAtFace);
         vec3 water=mix(vec3(.26,.52,.45),vec3(.072,.25,.25),mid);
         water=mix(water,vec3(.032,.12,.166),deep);
         vec3 dissolved=mix(water,vec3(.34,.14,.25),.86*deep*nyosDissolved);
         diffuseColor.rgb *= dissolved;`,
        );
    };
    const water = new T.Mesh(g, mat);
    water.name = "Geschichtetes Wasser auf der geöffneten Schnittfläche";
    return water;
  }

  private makeSource() {
    const mat = new T.MeshBasicMaterial({
      color: "#d6be91",
      side: T.DoubleSide,
    });
    // Each quiet solid arrow stays within bedrock. Locations and inclinations are illustrative.
    for (const f of [0.37, 0.65]) {
      const z = T.MathUtils.lerp(this.start, this.end, f),
        bed = -this.depthAt(z);
      const base = bed - 0.063,
        end = bed - 0.01,
        shift = 0.017;
      const xyz = [
        0.0015,
        base,
        z - shift - 0.0035,
        0.0015,
        base,
        z - shift + 0.0035,
        0.0015,
        end - 0.015,
        z + 0.0035,
        0.0015,
        base,
        z - shift - 0.0035,
        0.0015,
        end - 0.015,
        z + 0.0035,
        0.0015,
        end - 0.015,
        z - 0.0035,
        0.0015,
        end - 0.016,
        z - 0.01,
        0.0015,
        end - 0.016,
        z + 0.01,
        0.0015,
        end,
        z + 0.004,
      ];
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(xyz, 3));
      this.source.add(new T.Mesh(g, mat));
    }
    this.source.name =
      "Geologische Zufuhr von CO₂-haltigem Wasser · schematische Wege";
  }
  showDissolved(on: boolean) {
    this.dissolved.value = Number(on);
    this.source.visible = on;
  }
}
