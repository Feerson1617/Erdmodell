import * as T from "three";
import { basis, position, RAD, smooth } from "../geo";
import {
  hill,
  mixed,
  ribbon,
  rockBody,
  rockTexture,
  surfaceArrow,
  wave,
} from "./process-geometry";

export type ProcessSiteId = "island" | "japan" | "san";
export const PROCESS_FOCUS_HEIGHT = 21;

// PB2002 relative azimuths at the selected steps: EU/NA 103°, PA/OK 295°, NA/PA 144°.
// Local +x spans the displayed block; local +z faces the viewer, to the right of +x on the map.
const across = { island: 103, japan: 115, san: 54 };
export function processView(id: ProcessSiteId) {
  return { d: 78, tilt: 63, bearing: 105 - across[id] };
}

const color = (c: string) => new T.Color(c);
const stone = {
  mantle: color("#a47f5f"),
  mantleShade: color("#92694e"),
  root: color("#56665c"),
  ocean: color("#415d66"),
  basalt: color("#596064"),
  exposedLava: color("#424949"),
  moss: color("#85916b"),
  land: color("#aa8b6e"),
  sediment: color("#baaa85"),
  dry: color("#a59b6f"),
  vegetation: color("#5e7356"),
  rock: color("#686962"),
  deepSea: color("#4b747c"),
};
const level = (y: number) => () => y;
const v = (x: number, y: number, z: number) => new T.Vector3(x, y, z);

/** Lithospheric packets may move through a near-stationary interface. Morph positions, including their grain, explicitly. */
function displacement(
  mesh: T.Mesh<T.BufferGeometry>,
  offset: (x: number, y: number, z: number) => T.Vector3,
) {
  const geo = mesh.geometry;
  const source = geo.getAttribute("position");
  const end = new Float32Array(source.count * 3);
  for (let i = 0; i < source.count; i++) {
    const x = source.getX(i),
      y = source.getY(i),
      z = source.getZ(i);
    const d = offset(x, y, z);
    end.set([x + d.x, y + d.y, z + d.z], i * 3);
  }
  geo.morphAttributes.position = [new T.BufferAttribute(end, 3)];
  mesh.updateMorphTargets();
  return (fraction: number) => {
    mesh.morphTargetInfluences![0] = fraction;
  };
}

export class ProcessModel {
  readonly group = new T.Group();
  private readonly tangent: ReturnType<typeof basis>;
  private readonly arrows: { plate: string; arrow: T.Group }[] = [];
  private progress = 0;
  private readonly rockMap = rockTexture();
  private readonly reveal = { value: 1 };
  private readonly materials: T.Material[] = [];
  private readonly advance: ((t: number) => void)[] = [];
  private readonly rock = this.material({
    color: 0xffffff,
    vertexColors: true,
    map: this.rockMap,
    roughness: 0.92,
  });
  private readonly ivory = this.material({
    color: "#ffebae",
    roughness: 0.64,
    emissive: "#30220b",
  });
  private readonly charcoal = this.material({
    color: "#343a34",
    roughness: 0.82,
  });
  private readonly melt = this.material({
    color: "#e49b5c",
    emissive: "#8b4023",
    emissiveIntensity: 0.36,
  });
  private readonly bedding = this.material({
    color: "#c39b75",
    roughness: 0.97,
  });

  constructor(id: ProcessSiteId, target: { lat: number; lon: number }) {
    this.tangent = basis(target.lat, target.lon);
    const { up, east, north } = this.tangent;
    const az = across[id] * RAD;
    const x = north
      .clone()
      .multiplyScalar(Math.cos(az))
      .addScaledVector(east, Math.sin(az))
      .normalize();
    this.group.quaternion.setFromRotationMatrix(
      new T.Matrix4().makeBasis(x, up, x.clone().cross(up)),
    );
    this.group.position.copy(position(target.lat, target.lon, 12));
    this.group.name = "Tektonisches Erklärmodell · " + id;
    if (id === "island") this.ridge();
    if (id === "japan") this.subduction();
    if (id === "san") this.transform();
    this.setProgress(0);
  }

  private material(parameters: T.MeshStandardMaterialParameters) {
    const mat = new T.MeshStandardMaterial({ roughness: 0.86, ...parameters });
    const reveal = this.reveal;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.rockReveal = reveal;
      shader.fragmentShader =
        "uniform float rockReveal;\n" +
        shader.fragmentShader.replace(
          "#include <alphatest_fragment>",
          `#include <alphatest_fragment>
        if (rockReveal < 1.0) {
          vec2 pixel = floor(gl_FragCoord.xy);
          float dither = fract(52.9829189 * fract(dot(pixel, vec2(0.06711056, 0.00583715))));
          if (dither >= rockReveal) discard;
        }`,
        );
    };
    this.materials.push(mat);
    return mat;
  }

  private almond(
    parent: T.Group,
    material: T.Material,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    angle = 0,
  ) {
    const mesh = new T.Mesh(new T.IcosahedronGeometry(1, 1), material);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, 0.13);
    mesh.rotation.z = angle;
    parent.add(mesh);
    return mesh;
  }

  private addArrow(
    parent: T.Group,
    plate: string,
    x: number,
    y: number,
    z: number,
    angle: number,
    length?: number,
  ) {
    const arrow = surfaceArrow(
      this.ivory,
      this.charcoal,
      x,
      y,
      z,
      angle,
      length,
    );
    parent.add(arrow);
    this.arrows.push({ plate, arrow });
    return arrow;
  }

  private ridge() {
    const mantleTop = (x: number, z: number) =>
      6.3 + 4.9 * hill(x, 7.5) + 0.13 * wave(x, z);
    const crest = (x: number, z: number) =>
      10.4 +
      3.8 * hill(x, 8.4) -
      1.5 * hill(x - 0.25 * Math.sin(z * 0.65), 1.1) +
      0.53 * wave(x * 0.85, z * 0.7) +
      0.23 * wave(x * 2.3, z * 1.7) +
      0.38 * Math.cos(2 * x + 0.22 * z) * hill(x, 7);
    const crustBottom = (x: number, z: number) =>
      Math.max(
        mantleTop(x, z) + 0.12,
        crest(x, z) - 1.8 - 0.13 * wave(x * 0.6, z),
      );
    const mantle = new T.Group();
    this.group.add(mantle);
    rockBody(
      mantle,
      "Fester, verformbarer Mantel",
      this.rock,
      -21,
      21,
      mantleTop,
      level(0),
      stone.mantle,
    );
    // Solid mantle streamlines arch up beneath the ridge; warm melt pockets occur only near its axis.
    for (const depth of [1.7, 3.5, 5.05]) {
      const path = Array.from({ length: 19 }, (_, i) => {
        const x = -20.5 + (i * 41) / 18;
        return v(
          x,
          depth + depth * 0.54 * hill(x, 7.4) + 0.17 * Math.cos(x * 0.45),
          9.035,
        );
      });
      ribbon(mantle, "Verformung im festen Mantel", this.bedding, path, 0.056);
    }
    const flow = this.material({ color: "#dec398", roughness: 0.84 });
    for (const [x, y, w] of [
      [-1.1, 6.8, 0.42],
      [1.1, 7.3, 0.28],
      [-0.31, 8.7, 0.35],
      [0.62, 9.15, 0.24],
    ]) {
      const lens = this.almond(
        mantle,
        this.melt,
        x,
        y,
        9.08,
        w,
        w * 1.8,
        x * 0.46,
      );
      this.advance.push((t) => {
        lens.scale.y = w * (1.15 + t * 0.9);
        lens.position.y = y + t * 0.52;
      });
    }
    for (const x of [-3.0, 3.0]) {
      const group = new T.Group();
      ribbon(
        group,
        "Aufsteigendes festes Mantelmaterial",
        flow,
        [v(x, 3.7, 9.12), v(x * 0.77, 4.45, 9.12), v(x * 0.64, 5.35, 9.12)],
        0.094,
      );
      ribbon(
        group,
        "Fließrichtung",
        flow,
        [
          v(x * 0.64 - 0.37, 4.9, 9.12),
          v(x * 0.64, 5.4, 9.12),
          v(x * 0.64 + 0.37, 4.9, 9.12),
        ],
        0.094,
      );
      mantle.add(group);
      this.advance.push((t) => {
        group.position.y = t * 0.9;
      });
    }
    for (const sign of [-1, 1]) {
      const flank = new T.Group();
      this.group.add(flank);
      const left = sign < 0 ? -21 : 0,
        right = sign < 0 ? 0 : 21;
      rockBody(
        flank,
        "Starrer oberster Mantel",
        this.rock,
        left,
        right,
        crustBottom,
        mantleTop,
        stone.root,
      );
      const surface = (x: number, z: number, y: number) =>
        mixed(
          stone.exposedLava,
          stone.moss,
          0.36 +
            0.58 * wave(x * 0.78, z * 0.9) +
            0.18 * wave(x * 2.2, z * 1.6) +
            (12 - y) * 0.1,
        );
      rockBody(
        flank,
        "Basaltische Kruste · Reykjanes",
        this.rock,
        left,
        right,
        crest,
        crustBottom,
        stone.basalt,
        surface,
      );
      this.addArrow(
        flank,
        sign > 0 ? "EU" : "NA",
        sign * 10.5,
        13.5,
        -1.9,
        sign > 0 ? 0 : Math.PI,
      );
      this.advance.push((t) => {
        flank.position.x = sign * 2.55 * t;
      });
    }
    // New basalt fills the spreading seam. The newly formed lithosphere progressively thickens off-axis.
    const newFloor = (x: number) => 10.8 - 0.45 * Math.abs(x);
    const newTop = (x: number, z: number) => crest(0, z) + 0.19 * Math.abs(x);
    const seam = new T.Group();
    this.group.add(seam);
    rockBody(
      seam,
      "Neu gebildete ozeanische Kruste",
      this.rock,
      -1,
      1,
      newTop,
      newFloor,
      color("#55524e"),
      (x, z) =>
        mixed(
          color("#514543"),
          stone.basalt,
          0.3 + 0.32 * Math.abs(x) + 0.18 * wave(x, z),
        ),
      10,
    );
    this.advance.push((t) => {
      seam.visible = t > 0.003;
      seam.scale.x = Math.max(0.001, t * 2.56);
      mantle.scale.x = 1 + (t * 2.55) / 21;
    });
  }

  private subduction() {
    const trench = 4;
    // +x is roughly east-southeast. The Pacific slab moves towards -x and dips towards Honshū.
    const slabTop = (x: number, z: number) => {
      const inward = Math.max(trench - x, 0);
      return (
        8.4 +
        2.7 * (1 - Math.exp(-Math.max(x - trench, 0) / 4)) -
        0.13 * inward -
        0.013 * inward * inward +
        0.1 * Math.sin(z * 0.43 + x * 0.13)
      );
    };
    const slabBase = (x: number, z: number) => slabTop(x, z) - 2.02;
    const west = -13.6,
      east = 21;
    const floor = (x: number, z: number) => slabBase(Math.max(west, x), z);
    rockBody(
      this.group,
      "Mantel unter der pazifischen Platte",
      this.rock,
      -21,
      east,
      floor,
      level(-0.5),
      stone.mantleShade,
    );
    const arcSurface = (x: number, z: number) => {
      const land = smooth((4 - x) / 12);
      const arc = 4.0 * hill(x + 10.9, 2.6) * hill(z + 1.3, 3.5);
      const relief =
        (0.49 * wave(x * 0.75, z * 0.63) +
          0.49 * Math.cos(z * 0.61 + x * 0.8)) *
        land;
      return slabTop(trench, z) + 4.38 * land + arc + relief;
    };
    const arcBase = (x: number, z: number) =>
      Math.max(slabTop(Math.max(west, x), z), 5.75 + 0.17 * wave(x * 0.65, z));
    const crustFloor = (x: number, z: number) =>
      Math.max(
        arcBase(x, z),
        arcSurface(x, z) - 2.35 * smooth((trench - x) / 5),
      );
    const wedge = (x: number, z: number) =>
      x < west ? slabBase(west, z) : slabTop(x, z);
    rockBody(
      this.group,
      "Fester Mantelkeil über der abtauchenden Platte",
      this.rock,
      -21,
      trench,
      arcBase,
      wedge,
      stone.mantle,
    );
    rockBody(
      this.group,
      "Mantellithosphäre der Oberplatte",
      this.rock,
      -21,
      trench,
      crustFloor,
      arcBase,
      stone.root,
    );
    rockBody(
      this.group,
      "Oberplatte mit Küste und Vulkanbogen",
      this.rock,
      -21,
      trench,
      arcSurface,
      crustFloor,
      stone.land,
      (x, z, y) => {
        const land = mixed(
          stone.vegetation,
          stone.rock,
          0.23 + 0.34 * wave(x, z) + (y - 13) * 0.18,
        );
        return mixed(stone.deepSea, land, smooth((-x - 0.9) / 4.1));
      },
    );
    const oceanCrust = (x: number, z: number) => slabTop(x, z) - 0.65;
    const moving = [
      rockBody(
        this.group,
        "Pazifische Mantellithosphäre",
        this.rock,
        west,
        east,
        oceanCrust,
        slabBase,
        stone.ocean,
      ),
      rockBody(
        this.group,
        "Ozeanische Kruste taucht in den Mantel",
        this.rock,
        west,
        east,
        slabTop,
        oceanCrust,
        color("#728488"),
        (x, z) =>
          mixed(stone.deepSea, stone.ocean, 0.3 + 0.3 * wave(x * 0.45, z)),
      ),
    ];
    for (const mesh of moving) {
      this.advance.push(
        displacement(mesh, (x, _y, z) => {
          const dx = -2.2 * Math.sin((Math.PI * (x - west)) / (east - west));
          return v(dx, slabTop(x + dx, z) - slabTop(x, z), 0);
        }),
      );
    }
    // Identifiable material packets trace the slab's direction across the exposed face.
    const inclusion = this.material({ color: "#a6b2a4" });
    for (const x of [-9.6, -4.0, 2, 8.6, 15]) {
      const nodule = this.almond(
        this.group,
        inclusion,
        x,
        0,
        9.065,
        0.67,
        0.13,
      );
      this.advance.push((t) => {
        const cx = x - 2.3 * t;
        nodule.position.set(cx, slabTop(cx, 9) - 1.12, 9.065);
        nodule.rotation.z = Math.atan(
          (slabTop(cx + 0.1, 9) - slabTop(cx - 0.1, 9)) / 0.2,
        );
      });
    }
    // Wedge melt lies above the still-solid slab. Its ascending pathway heads towards the volcanic arc.
    const fluids = this.material({ color: "#a3c8c0" });
    for (const [x, y] of [
      [-9.5, 3.15],
      [-10.15, 3.75],
      [-10.6, 4.1],
    ]) {
      const drop = this.almond(
        this.group,
        fluids,
        x,
        y,
        9.09,
        0.14,
        0.3,
        -0.25,
      );
      this.advance.push((t) => {
        drop.position.y = y + t * 0.39;
      });
    }
    for (const [x, y, w] of [
      [-11.7, 4.25, 0.47],
      [-10.9, 4.65, 0.4],
      [-11.4, 5.06, 0.28],
    ]) {
      const lens = this.almond(this.group, this.melt, x, y, 9.1, w, 0.23, 0.34);
      this.advance.push((t) => {
        lens.scale.y = 0.16 + 0.15 * t;
      });
    }
    ribbon(
      this.group,
      "Schematischer Aufstiegsweg zum Vulkanbogen",
      this.melt,
      [
        v(-11.25, 5.0, 9.06),
        v(-11.6, 7.2, 9.06),
        v(-10.8, 9.1, 9.06),
        v(-11.0, 11.8, 9.06),
      ],
      0.095,
    );
    const quake = this.material({ color: "#f3dba5", emissive: "#553714" });
    for (const x of [-6, -2, 1.4]) {
      const patch = this.almond(
        this.group,
        quake,
        x,
        slabTop(x, 9) + 0.04,
        9.12,
        0.23,
        0.12,
        0.44,
      );
      this.advance.push((t) => {
        const pulse = hill(t - 0.59 + (x + 2) * 0.01, 0.075);
        patch.scale.set(0.2 + 0.27 * pulse, 0.11 + 0.18 * pulse, 0.12);
      });
    }
    const upperArrow = this.addArrow(
      this.group,
      "OK",
      -15.5,
      14.05,
      4.9,
      0,
      5.8,
    );
    const lowerArrow = this.addArrow(
      this.group,
      "PA",
      13.6,
      11.85,
      -1.8,
      Math.PI,
      7.2,
    );
    this.advance.push((t) => {
      upperArrow.position.x = -15.5 + 0.62 * t;
      lowerArrow.position.x = 13.6 - 1.7 * t;
    });
  }

  private transform() {
    const axis = (z: number) =>
      0.31 * Math.sin(z * 0.34) + 0.12 * Math.sin(z * 0.75);
    const mantleTop = (x: number, z: number) =>
      4.9 + 0.23 * wave(x * 0.52, z * 0.45);
    const channel = (x: number) => -0.9 + 0.17 * x + 0.65 * Math.sin(x * 0.3);
    const surface = (x: number, z: number) => {
      const trace = x - axis(z);
      const slopes =
        1.15 * Math.sin(0.37 * x - 0.16 * z) * Math.cos(0.21 * z + 0.13 * x) +
        0.53 * wave(x * 0.8, z * 0.6);
      return (
        10.95 +
        slopes -
        1.25 * hill(trace, 0.92) -
        0.4 * hill(z - channel(x), 0.68)
      );
    };
    const crustBase = (x: number, z: number) =>
      8.05 + 0.31 * wave(x * 0.68, z * 0.57);
    rockBody(
      this.group,
      "Verformbarer Mantel unter Kalifornien",
      this.rock,
      -21,
      21,
      mantleTop,
      level(0),
      stone.mantle,
    );
    const gravel = this.material({ color: "#b5aa8e", roughness: 1 });
    for (const sign of [-1, 1]) {
      // Pacific block on the southwest side moves northwest (local -z); opposite relative motion on the other side.
      const plate = new T.Group();
      this.group.add(plate);
      const left = sign < 0 ? -21 : (z: number) => axis(z) + 0.07;
      const right = sign < 0 ? (z: number) => axis(z) - 0.07 : 21;
      const rocks: T.Mesh<T.BufferGeometry>[] = [
        rockBody(
          plate,
          "Lithosphärischer Mantel",
          this.rock,
          left,
          right,
          crustBase,
          mantleTop,
          stone.root,
        ),
        rockBody(
          plate,
          "Kruste an der San-Andreas-Verwerfung",
          this.rock,
          left,
          right,
          surface,
          crustBase,
          stone.sediment,
          (x, z) => {
            const grass = mixed(
              stone.dry,
              stone.vegetation,
              0.32 +
                0.58 * wave(x * 0.8, z * 0.65) +
                0.17 * wave(x * 1.9, z * 2.2),
            );
            return mixed(
              grass,
              stone.sediment,
              0.68 * hill(z - channel(x), 0.75),
            );
          },
        ),
      ];
      // A continuous illustrative drainage trace provides a readout of right-lateral offset without labels.
      const drainage = Array.from({ length: 22 }, (_, i) => {
        const x = sign * (0.24 + (20.1 * i) / 21),
          z = channel(x);
        return v(x, surface(x, z) + 0.065, z);
      });
      rocks.push(
        ribbon(
          plate,
          "Schematischer versetzter Bachlauf",
          gravel,
          drainage,
          0.12,
        ),
      );
      const strain = rocks.map((mesh) =>
        displacement(mesh, (x, _y, z) =>
          v(0, 0, sign * 3.2 * hill(x - axis(z), 4.9)),
        ),
      );
      this.addArrow(
        plate,
        sign < 0 ? "PA" : "NA",
        sign * 10,
        13.0,
        0,
        (sign * Math.PI) / 2,
        7.8,
      );
      this.advance.push((t) => {
        const slip = 0.69 * smooth((t - 0.54) / 0.15) + Math.max(0, t - 0.69);
        plate.position.z = sign * 3.2 * t;
        // Initially the far field moves, while the two sides of the locked contact remain together.
        for (const deform of strain) deform(slip - t);
      });
    }
  }

  setProgress(fraction: number) {
    const t = T.MathUtils.clamp(fraction, 0, 1);
    this.progress = t;
    for (const move of this.advance) move(t);
  }
  diagnostics() {
    const arrows = this.arrows.map(({ plate, arrow }) => {
      arrow.updateWorldMatrix(true, false);
      const direction = new T.Vector3(1, 0, 0).transformDirection(
        arrow.matrixWorld,
      );
      const azimuth =
        Math.atan2(
          direction.dot(this.tangent.east),
          direction.dot(this.tangent.north),
        ) / RAD;
      return { plate, azimuth: (azimuth + 360) % 360 };
    });
    return { arrows, progress: this.progress };
  }
  setReveal(fraction: number) {
    this.reveal.value = T.MathUtils.clamp(fraction, 0, 1);
  }
  dispose() {
    this.group.removeFromParent();
    const geometries = new Set<T.BufferGeometry>();
    this.group.traverse((obj) => {
      if (obj instanceof T.Mesh) geometries.add(obj.geometry);
    });
    for (const geo of geometries) geo.dispose();
    for (const material of this.materials) material.dispose();
    this.rockMap.dispose();
  }
}
