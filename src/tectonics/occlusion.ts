import * as T from "three";

type Cell = { bounds: T.Box3; triangles: number[] };

/** Spatial index for the indexed, morphing rock surfaces. Cell bounds include
 * deformation in both directions. Final visibility uses the actual triangles
 * at the current animation time, including the moving object's world transform.
 */
export class SectionOccluder {
  private readonly cells: Cell[] = [];
  private inverse = new T.Matrix4();
  private ray = new T.Ray();
  private end = new T.Vector3();
  private hit = new T.Vector3();
  private a = new T.Vector3();
  private b = new T.Vector3();
  private c = new T.Vector3();

  constructor(private mesh: T.Mesh<T.BufferGeometry, T.Material>) {
    const g = mesh.geometry;
    const position = g.getAttribute("position");
    const morph = g.morphAttributes.position?.[0];
    g.computeBoundingBox();
    const bounds = g.boundingBox!;
    const size = bounds.getSize(new T.Vector3());
    const columns = 10,
      rows = 5;
    const bins = new Map<number, Cell>();
    const bin = (v: number, lo: number, span: number, count: number) =>
      T.MathUtils.clamp(
        Math.floor((count * (v - lo)) / (span || 1)),
        0,
        count - 1,
      );
    const index = g.getIndex();
    const triBounds = new T.Box3();
    for (
      let offset = 0;
      offset < (index?.count ?? position.count);
      offset += 3
    ) {
      triBounds.makeEmpty();
      for (let j = 0; j < 3; j++) {
        const v = index ? index.getX(offset + j) : offset + j;
        this.a.fromBufferAttribute(position, v);
        triBounds.expandByPoint(this.a);
        if (morph) {
          this.b.fromBufferAttribute(morph, v);
          if (!g.morphTargetsRelative) this.b.sub(this.a);
          triBounds.expandByPoint(this.c.copy(this.a).add(this.b));
          triBounds.expandByPoint(this.c.copy(this.a).sub(this.b));
        }
      }
      const center = triBounds.getCenter(this.a);
      const key =
        bin(center.x, bounds.min.x, size.x, columns) +
        columns * bin(center.z, bounds.min.z, size.z, rows);
      let cell = bins.get(key);
      if (!cell) {
        cell = { bounds: new T.Box3(), triangles: [] };
        bins.set(key, cell);
      }
      cell.bounds.union(triBounds);
      cell.triangles.push(offset);
    }
    this.cells = [...bins.values()];
  }

  prepare(camera: T.Vector3) {
    this.inverse.copy(this.mesh.matrixWorld).invert();
    this.ray.origin.copy(camera).applyMatrix4(this.inverse);
  }

  blocks(worldEnd: T.Vector3) {
    this.end.copy(worldEnd).applyMatrix4(this.inverse);
    this.ray.direction.subVectors(this.end, this.ray.origin);
    const lengthSq = this.ray.direction.lengthSq();
    this.ray.direction.normalize();
    const index = this.mesh.geometry.index;
    for (const cell of this.cells) {
      if (
        !cell.bounds.containsPoint(this.ray.origin) &&
        (!this.ray.intersectBox(cell.bounds, this.hit) ||
          this.ray.origin.distanceToSquared(this.hit) > lengthSq)
      )
        continue;
      for (const offset of cell.triangles) {
        this.mesh.getVertexPosition(
          index ? index.getX(offset) : offset,
          this.a,
        );
        this.mesh.getVertexPosition(
          index ? index.getX(offset + 1) : offset + 1,
          this.b,
        );
        this.mesh.getVertexPosition(
          index ? index.getX(offset + 2) : offset + 2,
          this.c,
        );
        if (
          this.ray.intersectTriangle(
            this.a,
            this.b,
            this.c,
            this.mesh.material.side === T.FrontSide,
            this.hit,
          ) &&
          this.ray.origin.distanceToSquared(this.hit) < lengthSq
        )
          return true;
      }
    }
    return false;
  }
}
