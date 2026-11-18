import * as T from "three";

type Height = (x: number, z: number) => number;
type Limit = number | ((z: number) => number);
type SurfacePaint = (x: number, z: number, height: number) => T.Color;

export const hill = (v: number, width: number) =>
  Math.exp((-v * v) / (width * width));
export const wave = (x: number, z: number) =>
  0.43 * Math.sin(x * 0.53 + Math.sin(z * 0.46)) +
  0.29 * Math.sin(z * 0.71 - x * 0.23) +
  0.18 * Math.cos(x * 1.13 + z * 0.37) +
  0.1 * Math.cos(x * 2.18 - z * 1.51);

export function mixed(a: T.Color, b: T.Color, t: number) {
  return a.clone().lerp(b, T.MathUtils.clamp(t, 0, 1));
}

/** Closed, contiguous lithological volumes. Horizontal faces and sawn edges have independent normals/UVs. */
export function rockBody(
  parent: T.Group,
  name: string,
  material: T.MeshStandardMaterial,
  left: Limit,
  right: Limit,
  roof: Height,
  floor: Height,
  edge: T.Color,
  paint?: SurfacePaint,
  divisions = 48,
) {
  const positions: number[] = [],
    colors: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  const xAt = (u: number, z: number) =>
    T.MathUtils.lerp(
      typeof left === "number" ? left : left(z),
      typeof right === "number" ? right : right(z),
      u,
    );
  const point = (
    x: number,
    y: number,
    z: number,
    side: "top" | "bottom" | "front" | "end",
  ) => {
    positions.push(x, y, z);
    const c = side === "top" && paint ? paint(x, z, y) : edge.clone();
    // Variation in the exposed material follows depth and gentle bedding rather than random triangles.
    const grain =
      side === "top"
        ? 0.055 * wave(x * 1.6, z * 1.6)
        : 0.085 * Math.sin(y * 3.9 + 0.38 * Math.sin(x * 0.46 + z * 0.19)) +
          0.055 * wave(x + z, y);
    c.multiplyScalar(1 + grain);
    colors.push(c.r, c.g, c.b);
    uv.push(
      (side === "end" ? z : x) * 0.17,
      (side === "top" || side === "bottom" ? z : y) * 0.17,
    );
  };
  function face(
    cols: number,
    rows: number,
    reverse: boolean,
    sample: (u: number, v: number) => void,
  ) {
    const first = positions.length / 3;
    for (let j = 0; j <= rows; j++) {
      for (let i = 0; i <= cols; i++) sample(i / cols, j / rows);
    }
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const a = first + j * (cols + 1) + i,
          b = a + 1,
          d = a + cols + 1,
          c = d + 1;
        if (reverse) indices.push(a, d, b, b, d, c);
        else indices.push(a, b, d, b, c, d);
      }
    }
  }
  const zAt = (v: number) => -9 + 18 * v;
  for (const [surface, top] of [
    [roof, true],
    [floor, false],
  ] as const) {
    face(divisions, 24, top, (u, v) => {
      const z = zAt(v),
        x = xAt(u, z);
      point(x, surface(x, z), z, top ? "top" : "bottom");
    });
  }
  for (const z of [-9, 9]) {
    face(divisions, 6, z < 0, (u, v) => {
      const x = xAt(u, z);
      point(x, T.MathUtils.lerp(floor(x, z), roof(x, z), v), z, "front");
    });
  }
  for (const end of [0, 1]) {
    face(24, 6, end === 1, (u, v) => {
      const z = zAt(u),
        x = xAt(end, z);
      point(x, T.MathUtils.lerp(floor(x, z), roof(x, z), v), z, "end");
    });
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  geo.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new T.Mesh(geo, material);
  mesh.name = name;
  parent.add(mesh);
  return mesh;
}

export function rockTexture() {
  const size = 96;
  const values = new Uint8Array(size * size * 4);
  let seed = 51;
  for (let i = 0; i < values.length; i += 4) {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    const grain = 226 + (seed >>> 27) * 0.85;
    values.set([grain, grain, grain, 255], i);
  }
  const texture = new T.DataTexture(values, size, size);
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.generateMipmaps = true;
  texture.magFilter = T.LinearFilter;
  texture.minFilter = T.LinearMipmapLinearFilter;
  texture.colorSpace = T.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/** A shallow bevel keeps the motion glyphs legible against earth, rock or water. Angle is measured from local +x towards +z. */
export function surfaceArrow(
  material: T.Material,
  rim: T.Material,
  x: number,
  y: number,
  z: number,
  angle: number,
  length = 6.5,
) {
  const arrow = new T.Group();
  const shape = new T.Shape();
  shape.moveTo(-length / 2, -0.4);
  shape.lineTo(length / 2 - 2.25, -0.4);
  shape.lineTo(length / 2 - 2.25, -1.28);
  shape.lineTo(length / 2, 0);
  shape.lineTo(length / 2 - 2.25, 1.28);
  shape.lineTo(length / 2 - 2.25, 0.4);
  shape.lineTo(-length / 2, 0.4);
  shape.closePath();
  const geo = new T.ExtrudeGeometry(shape, {
    depth: 0.12,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.07,
    bevelSegments: 1,
  });
  geo.rotateX(-Math.PI / 2);
  const base = new T.Mesh(geo, rim);
  base.scale.set(1.06, 1.1, 1.22);
  const cap = new T.Mesh(geo, material);
  cap.position.y = 0.08;
  arrow.add(base, cap);
  arrow.rotation.y = -angle;
  arrow.position.set(x, y, z);
  return arrow;
}

/** Visible streak on a geological section; width carries no quantitative information. */
export function ribbon(
  parent: T.Group,
  name: string,
  material: T.Material,
  path: T.Vector3[],
  radius: number,
) {
  const geom = new T.TubeGeometry(
    new T.CatmullRomCurve3(path),
    28,
    radius,
    6,
    false,
  );
  const mesh = new T.Mesh(geom, material);
  mesh.name = name;
  parent.add(mesh);
  return mesh;
}
