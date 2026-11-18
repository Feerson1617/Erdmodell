import { Box3, BufferGeometry, Group, LOD, Mesh, Sphere, Vector3 } from "three";

/** Keep the original single draw in regional views. Up close Three can cull individual
 * shoreline/valley cells without changing a single DEM vertex or normal. */
export function splitNyosSurface(surface: Mesh): LOD {
  const original = surface.geometry, index = original.getIndex()!;
  const { columns, rows } = original.userData;
  const position = original.getAttribute("position");
  if (columns * rows !== position.count || index.count !== 6 * (columns - 1) * (rows - 1))
    throw Error("Inkonsistentes DEM-Gitternetz");

  const lod = new LOD(), chunks = new Group(), probe = new Vector3();
  const stats = { frame: -1, drawnChunks: 0, triangles: 0, totalChunks: 0 };
  lod.name = "Nyos · maßstabsabhängige Geländeabschnitte";
  lod.userData.surfaceStats = stats;
  function record(mesh: Mesh, triangles: number) {
    mesh.onBeforeRender = (renderer) => {
      const frame = renderer.info.render.frame;
      if (stats.frame !== frame) { stats.frame = frame; stats.drawnChunks = 0; stats.triangles = 0; }
      stats.drawnChunks++;
      stats.triangles += triangles;
    };
  }

  const width = Math.ceil((columns - 1) / 6), height = Math.ceil((rows - 1) / 6);
  for (let y = 0; y < rows - 1; y += height) {
    for (let x = 0; x < columns - 1; x += width) {
      const xmax = Math.min(columns - 1, x + width), ymax = Math.min(rows - 1, y + height);
      const geom = new BufferGeometry(), indices: number[] = [], bounds = new Box3();
      for (let j = y; j <= ymax; j++) for (let i = x; i <= xmax; i++) {
        bounds.expandByPoint(probe.fromBufferAttribute(position, j * columns + i));
        if (j === ymax || i === xmax) continue;
        const offset = (j * (columns - 1) + i) * 6;
        for (let k = offset; k < offset + 6; k++) indices.push(index.getX(k));
      }
      for (const [name, attr] of Object.entries(original.attributes)) geom.setAttribute(name, attr);
      geom.setIndex(indices);
      geom.boundingBox = bounds;
      geom.boundingSphere = bounds.getBoundingSphere(new Sphere());
      const tile = new Mesh(geom, surface.material);
      tile.name = `Nyos · Gelände ${x}/${y}`;
      tile.castShadow = surface.castShadow;
      tile.receiveShadow = surface.receiveShadow;
      tile.renderOrder = surface.renderOrder;
      record(tile, indices.length / 3);
      chunks.add(tile);
    }
  }
  stats.totalChunks = chunks.children.length;
  record(surface, index.count / 3);
  lod.addLevel(chunks, 0);
  lod.addLevel(surface, 8, 0.1);
  return lod;
}
