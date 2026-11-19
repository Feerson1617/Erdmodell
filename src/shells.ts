import * as T from "three";
import { R, position } from "./geo";
import { layers, type Style } from "./model";

export const expandedCrustBase = R * 0.935;
type Surface = "body" | "closure" | "section";
type Part = T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>;

/** Shared radii for the surfaces, section faces, model pins and readout. */
export function shellRadii(expanded: boolean) {
  return [
    R,
    expanded ? expandedCrustBase : layers[0].inner,
    ...layers.slice(1).map((l) => l.inner),
  ];
}
export class Shells {
  group = new T.Group();
  cut = true;
  private comparisonMode: "reference" | "expanded" | "lithosphere" = "reference";
  get expanded() { return this.comparisonMode === "expanded"; }
  get lithosphere() { return this.comparisonMode === "lithosphere"; }
  setComparison(mode: typeof this.comparisonMode) { this.comparisonMode = mode; }
  visible = [true, true, true, true];
  opacity = [1, 1, 1, 1];
  selected: number | null = null;
  subdued = false;
  style: Style = "A";
  map?: T.Texture;
  private variants = new Map<Style, { map?: T.Texture; parts: Part[] }>();
  builds = 0;
  private comparison = new T.Group();
  constructor() {
    // Separate hatching crosses the compositional boundary on a short section of each cut face.
    // The variable lower envelope illustrates mechanical behaviour, rather than another global shell.
    const material = new T.LineBasicMaterial({color: 0xd5f4e5, toneMapped: false});
    for (const face of [-25, 65]) {
      const vertices: T.Vector3[] = [];
      const base = shellRadii(false)[1];
      const point = (lat: number, depth: number) => position(lat, face + (face < 0 ? .12 : -.12), depth - R);
      const lower = (lat: number) => base - 120 - 42 * Math.sin(lat*.095);
      for (let lat = 8; lat < 59; lat++) {
        vertices.push(point(lat,lower(lat)),point(lat+1,lower(lat+1)));
        if ((lat-8)%4===0) vertices.push(point(lat,R),point(lat+2,lower(lat+2)));
      }
      const hatch = new T.LineSegments(new T.BufferGeometry().setFromPoints(vertices),material);
      this.comparison.add(hatch);
    }
    this.group.add(this.comparison);
  }
  get parts() {
    return this.variants.get(this.style)?.parts ?? [];
  }
  restore() {
    this.visible.fill(true);
    this.opacity.fill(1);
    this.selected = null;
    this.subdued = false;
  }
  rebuild() {
    let variant = this.variants.get(this.style);
    if (!variant || variant.map !== this.map) {
      if (variant)
        for (const p of variant.parts) {
          this.group.remove(p);
          p.geometry.dispose();
          p.material.dispose();
        }
      variant = { map: this.map, parts: this.build() };
      this.variants.set(this.style, variant);
      this.builds++;
    }
    this.comparison.visible = this.lithosphere && this.cut && this.visible[0] && this.visible[1];
    const radii = shellRadii(this.expanded);
    for (const [style, { parts }] of this.variants)
      for (const part of parts) {
        const { layer, kind, inner, base } = part.userData;
        const buried = style === "A" && !inner && kind !== "section" && layer >= 2 && this.visible[layer - 1]
          && this.opacity[layer - 1] === 1 && this.opacity[layer] === 1;
        const edgeCount = part.userData.edgeCount ?? 0;
        if (edgeCount) {
          // The opaque neighbour hides the curved interior. Keep the exact rim
          // triangles where the curved mesh and the planar section meet.
          part.geometry.setDrawRange(buried ? 0 : edgeCount, buried ? edgeCount : Infinity);
        }
        part.visible =
          style === this.style &&
          this.visible[layer] &&
          !(buried && !this.cut) &&
          (kind === "section"
            ? this.cut
            : kind === "closure"
              ? !this.cut
              : true) &&
          (!inner || !this.visible[layer + 1] || this.opacity[layer + 1] < 1);
        if (style !== this.style) continue;
        if (kind !== "section")
          part.scale.setScalar(radii[layer + (inner ? 1 : 0)]);
        if (part.morphTargetInfluences)
          part.morphTargetInfluences[0] = Number(this.expanded);
        const mat = part.material,
          selected = layer === this.selected,
          dim = this.selected !== null && this.subdued && !selected;
        if (part.userData.selected === selected && part.userData.dim === dim &&
            mat.opacity === this.opacity[layer]) continue;
        part.userData.selected = selected;
        part.userData.dim = dim;
        mat.color
          .setHex(base)
          .multiplyScalar(
            dim ? 0.44 : 1,
          );
        mat.emissive.setHex(selected ? layers[layer].color : 0);
        mat.emissiveIntensity = selected ? 0.28 : 0;
        mat.opacity = this.opacity[layer];
        const blend = mat.opacity < 1;
        if (mat.transparent !== blend) {
          mat.transparent = blend;
          mat.depthWrite = !blend;
          mat.needsUpdate = true;
        }
      }
  }
  private build() {
    const parts: Part[] = [],
      n = this.style === "A" ? 96 : 64,
      m = n / 2;
    const natural = shellRadii(false),
      wide = shellRadii(true);
    for (const [i, l] of layers.entries()) {
      const pigment =
        this.style === "A"
          ? l.color
          : [0x879d88, 0xa96853, 0xe2a568, 0xeedbb5][i];
      const add = (g: T.BufferGeometry, kind: Surface, inner = false) => {
        const skin = i === 0 && !inner && kind !== "section",
          base = skin || kind === "section" ? 0xffffff : pigment;
        const mat = new T.MeshStandardMaterial({
          color: base,
          map: skin ? this.map : null,
          vertexColors: kind === "section",
          roughness: skin ? 0.93 : [0.9, 0.94, 0.62, 0.76][i],
          flatShading: this.style === "B",
          side: T.DoubleSide,
        });
        // All parts are closed manifold patches or planar faces. A single pass avoids double blending of transparent cut faces.
        mat.forceSinglePass = true;
        const part = new T.Mesh(g, mat);
        part.userData = { layer: i, kind, inner, base };
        part.renderOrder = 4 - i;
        this.group.add(part);
        parts.push(part);
      };
      for (const inner of [false, true]) {
        if (inner && !l.inner) continue;
        for (const [start, end, kind] of [
          [65, 335, "body"],
          [335, 425, "closure"],
        ] as const) {
          const nx = Math.round((n * (end - start)) / 360),
            pos = [],
            norm = [],
            uv = [],
            idx = [];
          for (let j = 0; j <= m; j++)
            for (let k = 0; k <= nx; k++) {
              const lat = -90 + (180 * j) / m,
                lon = start + ((end - start) * k) / nx,
                v = position(lat, lon, 1 - R);
              pos.push(v.x, v.y, v.z);
              const sign = inner ? -1 : 1;
              norm.push(sign * v.x, sign * v.y, sign * v.z);
              uv.push((lon + 180) / 360, (lat + 90) / 180);
            }
          for (let j = 0; j < m; j++)
            for (let k = 0; k < nx; k++) {
              const a = j * (nx + 1) + k,
                b = a + nx + 1;
              idx.push(a, a + 1, b, a + 1, b + 1, b);
            }
          const g = new T.BufferGeometry();
          g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
          g.setAttribute("normal", new T.Float32BufferAttribute(norm, 3));
          g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
          const rim: number[] = [];
          if (this.style === "A" && !inner && i >= 2 && kind === "body") {
            for (let row = 0; row < m; row++) {
              const offset = row * nx * 6;
              if (row === 0 || row === m - 1) rim.push(...idx.slice(offset, offset + nx * 6));
              else rim.push(...idx.slice(offset, offset + 18), ...idx.slice(offset + (nx - 3) * 6, offset + nx * 6));
            }
          }
          g.setIndex([...rim, ...idx]);
          add(g, kind, inner);
          parts[parts.length - 1].userData.edgeCount = rim.length;
        }
      }
      for (const lon of [65, 335]) {
        const pos = [],
          target = [],
          colors = [],
          idx = [],
          steps = this.style === "A" ? 24 : 12;
        for (let j = 0; j <= m; j++)
          for (let k = 0; k <= steps; k++) {
            const lat = -90 + (180 * j) / m,
              t = k / steps,
              v = position(lat, lon, 1 - R);
            const rad = T.MathUtils.lerp(natural[i + 1], natural[i], t),
              ex = T.MathUtils.lerp(wide[i + 1], wide[i], t);
            pos.push(v.x * rad, v.y * rad, v.z * rad);
            target.push(v.x * ex, v.y * ex, v.z * ex);
            const grain =
              (lon === 65 ? .96 : .84) - .14 * Math.exp(-20 * (1-t)) - .08 * Math.exp(-24*t) +
              0.052 * Math.sin(lat * 0.11 + t * 8) +
              0.027 * Math.cos(lat * 0.23 - t * 17) + .025 * Math.sin(lat*.28 + t*26 + Math.sin(lat*.13));
            const c = new T.Color(pigment).multiplyScalar(grain);
            colors.push(c.r, c.g, c.b);
          }
        for (let j = 0; j < m; j++)
          for (let k = 0; k < steps; k++) {
            const a = j * (steps + 1) + k,
              b = a + steps + 1;
            idx.push(a, b, a + 1, a + 1, b, b + 1);
          }
        let g = new T.BufferGeometry();
        g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
        g.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
        g.setIndex(idx);
        g.computeVertexNormals();
        if (i < 2)
          g.morphAttributes.position = [
            new T.Float32BufferAttribute(target, 3),
          ];
        if (this.style === "B") {
          const original = g;
          g = g.toNonIndexed();
          original.dispose();
          const colors = g.attributes.color;
          for (let v = 0; v < colors.count; v += 3) {
            const c = new T.Color(pigment).multiplyScalar(
              0.82 + 0.2 * (0.5 + 0.5 * Math.sin(v * 4.91 + i)),
            );
            for (let j = 0; j < 3; j++) colors.setXYZ(v + j, c.r, c.g, c.b);
          }
        }
        add(g, "section");
      }
    }
    return parts;
  }
}
