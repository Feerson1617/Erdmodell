import * as T from "three";
import { basin, wilsonMotion, margin, clamp, geologyAt, spreading, subducts, type ProcessId } from "./tectonic-process";
import { libraryGLSL, materials, quality } from "./graphics";

export type Analysis = "natural" | "materials" | "age" | "magnet";
const W = 4.8,
  D = 2.5;
const color = (hex: number) => new T.Color(hex);
const palette = [0xc4ae86, 0x9c7360, 0x8c8172, 0x4c5b61, 0x6e7555, 0x966851, 0x795345].map(color);
const ocean = color(0x45616c),
  land = color(0x81906e),
  peak = color(0xccbda4),
  fissure = color(0x342e2b);
const colorSnow = color(0xe1e6df);
const ages = [0xec7959, 0xe5b77c, 0xd9c798, 0x8eaea7, 0x608bba].map(color);
const positive = color(0xdb997b),
  negative = color(0x536e8d);
type Writer = (u: number, v: number, pos: T.Vector3, c: T.Color) => void;
class Grid {
  geometry = new T.BufferGeometry();
  mesh: T.Mesh;
  private positions: T.BufferAttribute;
  private colors: T.BufferAttribute;
  private previous: T.BufferAttribute;
  constructor(
    readonly nx: number,
    private ny: number,
    material: T.Material,
    private changingNormals = false,
  ) {
    const count = (nx + 1) * (ny + 1);
    this.positions = new T.BufferAttribute(new Float32Array(count * 3), 3).setUsage(T.DynamicDrawUsage);
    this.colors = new T.BufferAttribute(new Float32Array(count * 3), 3).setUsage(T.DynamicDrawUsage);
    this.previous = new T.BufferAttribute(new Float32Array(count * 3), 3).setUsage(T.DynamicDrawUsage);
    this.geometry.setAttribute("previousPosition", this.previous);
    this.geometry.setAttribute("position", this.positions);
    this.geometry.setAttribute("color", this.colors);
    const indices: number[] = [];
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const a = j * (nx + 1) + i,
          b = a + 1,
          d = a + nx + 1;
        indices.push(a, d, b, b, d, d + 1);
      }
    this.geometry.setIndex(indices);
    this.mesh = new T.Mesh(this.geometry, material);
    this.mesh.frustumCulled = false;
  }
  write(fn: Writer) {
    this.previous.array.set(this.positions.array);
    this.previous.needsUpdate = true;
    const p = new T.Vector3(),
      c = new T.Color();
    for (let j = 0, k = 0; j <= this.ny; j++)
      for (let i = 0; i <= this.nx; i++, k++) {
        fn(i / this.nx, j / this.ny, p, c);
        this.positions.setXYZ(k, p.x, p.y, p.z);
        this.colors.setXYZ(k, c.r, c.g, c.b);
      }
    this.positions.needsUpdate = this.colors.needsUpdate = true;
    if (this.changingNormals || !this.geometry.hasAttribute("normal")) this.geometry.computeVertexNormals();
  }
}
// A closed solid swept along dip. The two end caps and the four longitudinal
// faces share positions. Only the deliberately opened teaching view exposes it.
class SectionBody {
  readonly group = new T.Group();
  private skin: Grid;
  private caps: Grid[];
  constructor(material: T.Material) {
    this.skin = new Grid(32, 24, material, true);
    this.caps = [new Grid(8, 4, material, true), new Grid(8, 4, material, true)];
    this.group.add(this.skin.mesh, ...this.caps.map((g) => g.mesh));
  }
  shape(draw: (along: number, strike: number, depth: number, p: T.Vector3, c: T.Color) => void) {
    this.skin.write((u, v, p, c) => {
      const q = v * 4,
        face = Math.min(3, Math.floor(q)),
        w = q - face;
      if (face === 0) draw(u, w, 0, p, c);
      if (face === 1) draw(u, 1, w, p, c);
      if (face === 2) draw(u, 1 - w, 1, p, c);
      if (face === 3) draw(u, 0, 1 - w, p, c);
    });
    this.caps.forEach((cap, index) => cap.write((u, v, p, c) => draw(index, u, v, p, c)));
  }
}
export class PlateSection {
  readonly group = new T.Group();
  readonly fraction = { value: 1 };
  private natural = { value: 1 };
  private surface: Grid;
  private front: Grid;
  private ends: Grid[];
  private slab: Grid;
  private water: T.Mesh;
  private rock: T.MeshStandardMaterial;
  private pockets = new T.Group();
  private bodies?: [SectionBody, SectionBody];
  private zone: T.InstancedMesh;
  private pillows: T.InstancedMesh;
  private fluids: T.InstancedMesh;
  private melt: T.InstancedMesh;
  private arrows = new T.Group();
  private localArrows = new T.Group();
  private meltField: T.Mesh;
  private reservoir: T.Mesh;
  private mantleUp: T.ArrowHelper;
  private ruler: T.Mesh;
  private disposed = false;
  constructor(
    readonly kind: ProcessId,
    repaint: () => void,
  ) {
    this.rock = new T.MeshStandardMaterial({ vertexColors: true, side: T.DoubleSide, roughness: 0.91 });
    const div = quality() === 0 ? 48 : quality()===2 ? 104 : 80;
    this.surface = new Grid(div, Math.round(div * 0.55), this.rock, true);
    this.front = new Grid(div, 30, this.rock);
    this.ends = [new Grid(28, 24, this.rock), new Grid(28, 24, this.rock), new Grid(div, 24, this.rock)];
    this.slab = new Grid(57, 7, this.rock);
    this.group.add(...[this.surface, this.front, ...this.ends, this.slab].map((g) => g.mesh));
    const waterMat = new T.MeshPhysicalMaterial({
      color: 0x527f91,
      transparent: true,
      opacity: 0.29,
      roughness: 0.3,
      metalness: 0.24,
      side: T.DoubleSide,
      depthWrite: false,
    });
    this.water = new T.Mesh(new T.PlaneGeometry(2 * W, 2 * D), waterMat);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = -0.13;
    this.water.renderOrder = 2;
    this.group.add(this.water);
    const drop = new T.SphereGeometry(0.047, 8, 6);
    const particles = (hex: number, count: number) =>
      new T.InstancedMesh(
        drop,
        new T.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.19 }),
        count,
      );
    this.zone = new T.InstancedMesh(
      new T.IcosahedronGeometry(1, 1),
      new T.MeshStandardMaterial({ color: 0xbc774b, emissive: 0x4c2008, roughness: 0.92 }),
      40,
    );
    this.pillows = new T.InstancedMesh(
      new T.IcosahedronGeometry(1, 1),
      new T.MeshStandardMaterial({ color: 0x435a5d, roughness: 0.92 }),
      76,
    );
    this.zone.frustumCulled = this.pillows.frustumCulled = false;
    this.group.add(this.pillows);
    this.pockets.add(this.zone);
    this.fluids = particles(0x68c9d7, 17);
    this.melt = particles(0xffad5c, 21);
    this.pockets.add(this.fluids, this.melt);
    this.group.add(this.pockets);
    for (const side of [-1, 1]) {
      const arrow = new T.ArrowHelper(
        new T.Vector3(side, 0, 0),
        new T.Vector3(side * 2, 1, 0),
        1.12,
        0xf1df92,
        0.29,
        0.16,
      );
      this.arrows.add(arrow);
    }
    this.group.add(this.arrows, this.localArrows);
    for (const side of [-1, 1]) {
      this.localArrows.add(new T.ArrowHelper(new T.Vector3(side,0,0),new T.Vector3(),.53,0x69d5cb,.19,.12));
    }
    const volume = (shade: number) => new T.Mesh(new T.IcosahedronGeometry(1, 2),
      new T.MeshStandardMaterial({color: shade, emissive: 0x733719, emissiveIntensity:.32,
        roughness:.84, flatShading:true}));
    this.meltField = volume(0xae6d45);
    this.reservoir = volume(0xe58c55);
    this.mantleUp=new T.ArrowHelper(new T.Vector3(0,1,0),new T.Vector3(),.65,0xf3d995,.18,.13);
    this.pockets.add(this.meltField,this.reservoir,this.mantleUp);
    this.ruler = new T.Mesh(
      new T.SphereGeometry(0.095, 12, 8),
      new T.MeshBasicMaterial({ color: 0xffebae }),
    );
    this.group.add(this.ruler);
    void materials()
      .then((lib) => {
        if (this.disposed) return;
        const m = this.rock;
        m.onBeforeCompile = (s) => {
          Object.assign(s.uniforms, {
            faciesColor: { value: lib.color },
            faciesRelief: { value: lib.relief },
            detailGrade: { value: 1 },
            geometryFraction: this.fraction,
            naturalFacies: this.natural,
          });
          s.vertexShader =
            "attribute vec3 previousPosition; uniform float geometryFraction; varying vec3 specimenPoint;\n" +
            s.vertexShader.replace(
              "#include <begin_vertex>",
              "#include <begin_vertex>\ntransformed=mix(previousPosition,position,geometryFraction);specimenPoint=transformed;",
            );
          s.fragmentShader =
            "varying vec3 specimenPoint;uniform float naturalFacies;\n" + libraryGLSL + s.fragmentShader;
          s.fragmentShader = s.fragmentShader.replace(
            "#include <color_fragment>",
            `#include <color_fragment>
          vec3 p=specimenPoint; vec3 n=abs(normalize(cross(dFdx(p),dFdy(p))));
          vec2 uv=n.y>max(n.x,n.z)?p.xz:(n.z>n.x?p.xy:p.zy);
          float facies=n.y>.67?(p.y<-.14?3.:(p.y>1.0?5.:0.)):(p.y<-.9?4.:5.);
          float strata=sin(uv.x*5.+p.z*.76+sin(p.y*4.));
          float ledge=smoothstep(.42,.92,n.y);
          facies=mix(facies,1.,step(.72,ledge)*step(.38,p.y)*step(p.y,1.0));
          vec2 bedding=uv*vec2(.81,1.48)+vec2(.16*sin(p.y*2.6+p.z*.41),0.);
          vec3 stone=fieldSample(faciesColor,bedding*.66,facies).rgb;
          vec3 gravel=fieldSample(faciesColor,uv*2.1+.24,facies).rgb;
          float macro=clamp(.53+1.88*sqrt(luma6(stone)),.55,1.54);
          float fine=clamp(.73+1.1*sqrt(luma6(gravel)),.74,1.35);
          vec3 tint=clamp(stone/(luma6(stone)+.035),vec3(.54),vec3(1.55));
          float grain=mix(.74,1.24,smoothstep(.06,.48,luma6(gravel)));
          float veins=.82+.18*cos(uv.y*48.+strata*1.9);
          diffuseColor.rgb*=mix(vec3(1.),mix(vec3(1.),tint,.46)*macro*fine*mix(veins,grain,ledge),naturalFacies);
          vec2 detailNormal=fieldSample(faciesRelief,bedding*.66,facies).rg*2.-1.;`,
          );
          s.fragmentShader = s.fragmentShader.replace(
            "#include <normal_fragment_maps>",
            `#include <normal_fragment_maps>
            vec3 t=normalize(dFdx(vViewPosition));vec3 b=normalize(dFdy(vViewPosition));
            normal=normalize(normal+.27*naturalFacies*(detailNormal.x*t+detailNormal.y*b));`,
          );
        };
        m.customProgramCacheKey = () => "g641-rock-facies";
        m.needsUpdate = true;
        repaint();
      })
      .catch(() => {});
  }
  update(
    t: number,
    analysis: Analysis,
    cut: boolean,
    paths: boolean,
    vectors: boolean,
    rate: number,
    km: number,
    ruler: boolean,
    expose = false,
  ) {
    this.natural.value = analysis === "natural" ? 1 : 0;
    const k = this.kind;
    const motion = wilsonMotion(t);
    const sub = subducts(k) || (k === "wilson" && motion.subduction);
    const open = expose && sub;
    const edge = open ? 0.18 : k === "hotspot" && cut && paths ? 0 : D;
    this.surface.write((a, b, p, c) => {
      const x = (a * 2 - 1) * W,
        z = -D + b * (D + edge),
        g = geologyAt(k, x, z, t);
      p.set(x, g.top, z);
      if (analysis === "age" || analysis === "magnet") {
        const s = spreading(Math.abs(g.u) * 40, rate, t);
        if (analysis === "age") c.copy(ages[Math.min(4, Math.floor(s.age / 1.5))]);
        else c.copy(s.polarity > 0 ? positive : negative);
      } else {
        c.copy(g.ocean ? ocean : land);
        if (g.ocean) c.multiplyScalar(.56 + .34*clamp(g.top+.71) + .12*Math.abs(Math.sin(4*x+z)));
        else {
          const relief = clamp((g.top-.36)*.78);
          c.lerp(peak, relief).lerp(colorSnow, clamp((g.top-1.38)*1.75));
          c.multiplyScalar(.83 + .18*Math.abs(Math.sin(z*3.4+Math.sin(x)*1.9)));
        }
        if (analysis === "materials") c.copy(g.ocean ? palette[3] : palette[0]);
        else c.lerp(fissure, g.fault * 0.78);
      }
    });
    const section = (
      g: ReturnType<typeof geologyAt>,
      x: number,
      z: number,
      depth: number,
      p: T.Vector3,
      c: T.Color,
    ) => {
      const y = g.top + depth * (-2.52 - g.top);
      const d = g.top - y,
        fold =
          k === "collision" || k === "complex" || k === "wilson"
            ? (0.12 + .22*t) * Math.sin(x * (3 + t) + z * 0.48) * Math.exp(-x*x*.28) + .10*t*Math.tanh(9*(x-.42*y))
            : 0;
      const l = (d + fold) / g.crust;
      const lid = g.crust + (g.ocean ? 0.3 + 0.33 * Math.sqrt(Math.abs(g.u) / W) : 0.5);
      const bands = l < 0.13 ? 0 : l < 0.35 ? 1 : l < 0.66 ? 2 : l < 1 ? 3 : d < lid ? 4 : 5;
      c.copy(palette[bands]);
      if (analysis === "natural") {
        const bedding =
          d < g.crust ? 0.91 + 0.09 * Math.cos(l * 42 + z * 0.2) : 0.96 + 0.04 * Math.sin(x * 2 + y * 4);
        c.multiplyScalar(bedding);
      }
      p.set(x, y, z);
    };
    if (cut) {
      // All vertices down a vertical column share one surface and one crustal thickness.
      // Side walls stay planar throughout the animation.
      const profiles = [this.front, ...this.ends];
      for (const [i, grid] of profiles.entries()) {
        const columns = Array.from({ length: grid.nx + 1 }, (_, j) => {
          const u = (2 * j) / grid.nx - 1,
            x = i === 1 ? -W : i === 2 ? W : u * W,
            z = i === 0 ? edge : i === 3 ? -D : -D + (u + 1) * 0.5 * (D + edge);
          return { x, z, g: geologyAt(k, x, z, t) };
        });
        grid.write((u, depth, p, c) => {
          const { x, z, g } = columns[Math.round(u * grid.nx)];
          section(g, x, z, depth, p, c);
        });
      }
    }

    const x0 = k === "wilson" ? basin(t) - 0.28 : 0;
    const extension =
      k === "wilson" ? clamp((t - 0.53) / 0.16) * clamp((0.89 - t) / 0.06) : 0.59 + 0.41 * t;
    if (open && !this.bodies) {
      this.bodies = [new SectionBody(this.rock), new SectionBody(this.rock)];
      this.bodies[0].group.name = "Abtauchende Lithosphäre";
      this.bodies[1].group.name = "Mantelkeil";
      this.group.add(...this.bodies.map((b) => b.group));
    }
    if (this.bodies) for (const body of this.bodies) body.group.visible = open;
    if (open && this.bodies) {
      const slabHeight = (x: number, z: number) => {
        const dx = x - x0;
        return dx < 0
          ? geologyAt(k, x, z, t).top - 0.05
          : geologyAt(k, x0, z, t).top - 0.05 - dx * 0.54 - dx * dx * 0.19;
      };
      this.bodies[0].shape((u, v, depth, p, c) => {
        const x = x0 - 1.74 + u * (1.74 + 2.4 * extension),
          z = edge + v * (D - edge);
        p.set(x, slabHeight(x, z) - depth * 0.4, z);
        c.copy(depth < 0.4 ? palette[3] : palette[4]);
      });
      this.bodies[1].shape((u, v, depth, p, c) => {
        const x = x0 + 0.25 + u * (1.97 * extension),
          z = edge + v * (D - edge);
        const g = geologyAt(k, x, z, t),
          floor = slabHeight(x, z) + 0.009,
          roof = Math.max(floor, g.top - g.crust);
        p.set(x, roof + (floor - roof) * depth, z);
        c.copy(palette[4]).lerp(palette[5], depth * 0.65);
      });
    }
    this.slab.mesh.visible = sub && cut && !open;
    if (sub)
      this.slab.write((u, v, p, c) => {
        const x = x0 - 1.75 + u * (1.75 + 2.4 * extension),
          dx = x - x0;
        const oceanTop = geologyAt(k, x, D, t).top;
        const y = dx < 0 ? oceanTop - 0.05 : geologyAt(k, x0, D, t).top - 0.05 - dx * 0.54 - dx * dx * 0.19;
        p.set(x, Math.max(-2.55, y - v * 0.4), D + 0.013);
        c.copy(v < 0.4 ? palette[3] : palette[4]);
      });
    this.pockets.visible = (sub || k === "ridge" || k === "hotspot") && cut && paths;
    this.fluids.visible = sub;
    if (this.pockets.visible) {
      const dummy = new T.Object3D();
      const plume = k === "hotspot", axis = plume ? -1.55 : 0;
      const meltX = sub ? x0 + 1.33 : axis;
      const localTop = geologyAt(k, meltX, edge, t);
      const roofY = localTop.top-localTop.crust;
      const floorY = sub ? geologyAt(k,x0,edge,t).top-.05-.54*1.33-.19*1.33**2 : -2.0;
      const height = Math.max(.10,roofY-floorY);
      this.meltField.position.set(meltX, floorY + height*.51, edge+.025);
      this.meltField.scale.set(sub ? .4 : .45, height*.42, .056);
      this.meltField.rotation.z = sub ? -.32 : .13;
      this.reservoir.position.set(meltX+.05,localTop.top-.24,edge+.05);
      this.reservoir.scale.set(.20,.059,.045);
      this.mantleUp.visible=!sub;this.mantleUp.position.set(axis,-2.4,edge+.09);
      // Discrete melt-bearing volumes sit between the plate surface and the base of the overriding crust.
      for (let i = 0; i < 40; i++) {
        const px = k === "ridge" ? 0.44 * Math.sin(i * 2.3) : x0 + 0.94 + 0.56 * ((i * 0.618034) % 1),
          pz = D - 1.18 + 1.18 * ((i * 0.75488) % 1);
        const a = geologyAt(k, px, pz, t),
          floor = geologyAt(k, x0, pz, t).top - 0.54 * (px - x0) - 0.19 * (px - x0) ** 2;
        const roof = a.top - a.crust - 0.055,
          thickness = Math.max(0, roof - floor - 0.07);
        const exposed = i % 4 === 0;
        dummy.position.set(
          px,
          floor + 0.04 + thickness * (0.24 + 0.52 * ((i * 0.321) % 1)),
          exposed ? D + 0.014 : pz,
        );
        if (!sub) dummy.position.set(axis+.37*Math.sin(i*2.3),floorY+height*(.2+.64*((i*.417)%1)),edge+.065);
        else if(exposed) dummy.position.z=edge+.066;
        dummy.scale.set(
          0.072,
          k === "ridge" ? 0.06 : Math.min(0.056, thickness * 0.12),
          exposed ? 0.045 : 0.092,
        );
        dummy.rotation.z = (i % 5) * 0.28;
        dummy.updateMatrix();
        this.zone.setMatrixAt(i, dummy.matrix);
      }
      this.zone.instanceMatrix.needsUpdate = true;
      dummy.rotation.z = 0;
      for (const [mesh, n, fluid] of [
        [this.fluids, 17, true],
        [this.melt, 21, false],
      ] as const) {
        for (let i = 0; i < n; i++) {
          const lane = i % 3,
            f = (i / n + t * 0.8) % 1,
            px = x0 + 1.16 + 0.13 * lane + (fluid ? -0.24 * f : 0.22 * f);
          const slabY = geologyAt(k, x0, D, t).top - 0.1 - (px - x0) * 0.54 - (px - x0) ** 2 * 0.19;
          const roof = geologyAt(k, px, D, t).top - geologyAt(k, px, D, t).crust;
          const zone = roof - 0.12;
          const y = fluid
            ? slabY + (zone - slabY) * f
            : zone + (geologyAt(k, px, D, t).top - 0.11 - zone) * f;
          dummy.position.set(px, y, D + 0.032 + 0.018 * Math.cos(i));
          if (!sub)
            dummy.position.set(
              axis + 0.15 * Math.sin(lane * 2.2) * (1 - f),
              roofY-.18 + f * (localTop.top - roofY+.16),
              edge + 0.08,
            );
          dummy.scale.set(fluid ? 0.6 : 0.81, fluid ? 1.4 : 1.7, 0.68);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
    this.pillows.visible = k === "ridge" && analysis === "natural";
    if (this.pillows.visible) {
      const dummy = new T.Object3D();
      for (let i = 0; i < 76; i++) {
        const z = -D + 0.1 + (2 * D - 0.2) * ((i * 0.618034) % 1),
          x =
            0.14 * Math.sin(z * 1.4) +
            0.055 * Math.sin(z * 3.7) +
            (i % 2 ? 1 : -1) * (0.08 + 0.26 * ((i * 0.75488 + t * 0.35) % 1));
        const radius = 0.046 + 0.095 * ((i * 0.366) % 1);
        dummy.position.set(x, geologyAt(k, x, z, t).top + 0.015, z);
        dummy.scale.set(radius * 1.45, radius * 0.72, radius);
        dummy.rotation.y = i * 0.47;
        dummy.updateMatrix();
        this.pillows.setMatrixAt(i, dummy.matrix);
      }
      this.pillows.instanceMatrix.needsUpdate = true;
    }
    this.water.scale.y=(edge+D)/(2*D); this.water.position.z=(edge-D)*.5;
    this.water.visible =
      !open && analysis === "natural" && !["transform", "collision", "complex"].includes(k);
    this.front.mesh.visible = cut;
    this.ends.forEach((e) => (e.mesh.visible = cut));
    this.arrows.visible = vectors;
    this.localArrows.visible = vectors && k === "wilson" && motion.spreadingRidge;
    this.localArrows.children.forEach((arrow,i) => arrow.position.set(i ? .15 : -.15, geologyAt(k,0,0,t).top+.24,0));
    for (const [i, a] of this.arrows.children.entries()) {
      const side = i === 0 ? -1 : 1,
        dir = ["rift", "ridge"].includes(k) ? side : k === "wilson" ? side * motion.outward : -side,
        along = ["transform", "oceanTransform"].includes(k);
      const arrow = a as T.ArrowHelper;
      arrow.position.set(side * 2.5, geologyAt(k, side * 2.5, 0, t).top + 0.38, 0);
      arrow.visible = (k !== "hotspot" || i === 1) && (k !== "wilson" || motion.outward !== 0);
      if(k === "wilson") {
        const x=side*(.65+margin(t)); arrow.position.set(x,geologyAt(k,x,0,t).top+.36,0);
      }
      if (k === "oceanTransform") arrow.position.set(0, geologyAt(k, 0, side, t).top + 0.4, side);
      arrow.setDirection(
        k === "oceanTransform"
          ? new T.Vector3(-side, 0, 0)
          : k === "hotspot"
            ? new T.Vector3(1, 0, 0)
            : new T.Vector3(
                along ? 0 : dir || side,
                0,
                along ? -side : k === "oblique" ? -side * 0.72 : 0,
              ).normalize(),
      );
    }
    this.ruler.visible = k === "ridge" && ruler;
    this.ruler.position.set(km / 40, geologyAt(k, km / 40, 0, t).top + 0.1, 0);
  }
  motionSample() {
    const read=(g:T.Group)=>g.children.filter(a=>a.visible && g.visible).map(a=>({
      x:a.position.x, dir:new T.Vector3(0,1,0).applyQuaternion(a.quaternion).toArray()
    }));
    return {margins:read(this.arrows),ridge:read(this.localArrows),melt:this.pockets.visible,fluids:this.pockets.visible&&this.fluids.visible};
  }
  dispose() {
    this.disposed = true;
    const mats = new Set<T.Material>(),
      geos = new Set<T.BufferGeometry>();
    this.group.traverse((o) => {
      const m = o as T.Mesh;
      if (m.geometry) geos.add(m.geometry);
      if (m.material) for (const a of Array.isArray(m.material) ? m.material : [m.material]) mats.add(a);
      if (o instanceof T.InstancedMesh) o.dispose();
    });
    geos.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
  }
}
