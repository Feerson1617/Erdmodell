import * as T from "three";
import { Stage, vec } from "./stage";
import { localAsset } from "../assets";
import ulmen from "./ulmen-dsm.json";
import region from "./eifel-dsm.json";
import nyos from "./nyos-crop.json";
import environs from "./umfeld-dsm.json";

function landscape(
  s: Stage,
  d: typeof ulmen,
  asset: string,
  cx: number,
  width: number,
  exaggeration: number,
) {
  const depth = (width * d.depth) / d.width,
    low = Math.min(...d.values);
  const at = (i: number, j: number) =>
    (((d.values[j * d.n + i] - low) * width) / d.width) * exaggeration;
  const g = new T.PlaneGeometry(width, depth, d.n - 1, d.n - 1);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position,
    shades = [];
  for (let j = 0; j < d.n; j++)
    for (let i = 0; i < d.n; i++) {
      const h = at(i, j);
      p.setY(j * d.n + i, h);
      const shade = T.MathUtils.clamp(
        0.96 +
          (at(Math.max(0, i - 1), j) - h) * 0.8 +
          (at(i, Math.min(d.n - 1, j + 1)) - h) * 0.45,
        0.76,
        1.12,
      );
      shades.push(shade, shade, shade);
    }
  g.setAttribute("color", new T.Float32BufferAttribute(shades, 3));
  g.computeVertexNormals();
  const m = s.mesh(g, 0xffffff, "Georeferenziertes Relief");
  m.position.x = cx;
  const mat = m.material as T.MeshStandardMaterial;
  s.pendingTextures++;
  mat.map = new T.TextureLoader().load(
    localAsset("data/vulkaneifel/" + asset + ".webp"),
    () => {
      s.pendingTextures--;
      if (!s.disposed) s.refresh();
    },
  );
  mat.map.colorSpace = T.SRGBColorSpace;
  mat.map.anisotropy = 4;
  mat.vertexColors = true;
  mat.roughness = 0.96;
  mat.transparent = true;
  // A feathered cartographic edge keeps missing surroundings distinct from surveyed terrain.
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <alphamap_fragment>",
      `#include <alphamap_fragment>
    vec2 edge = min(vMapUv, 1.0-vMapUv);
    diffuseColor.a *= smoothstep(0.0,0.056,min(edge.x,edge.y));
  `,
    );
  };
  const site = (lon: number, lat: number) => {
    const [w, b, e, n] = d.box,
      u = (lon - w) / (e - w),
      v = (n - lat) / (n - b);
    const x = T.MathUtils.clamp(Math.round(u * (d.n - 1)), 0, d.n - 1),
      y = T.MathUtils.clamp(Math.round(v * (d.n - 1)), 0, d.n - 1);
    return vec(cx + (u - 0.5) * width, at(x, y) + 0.045, (v - 0.5) * depth);
  };
  return site;
}
export function lakeAtlas(s: Stage) {
  if (s.view === "landCompare") {
    const u = landscape(s, ulmen, "ulmen", -2.73, 5.05, 1.6);
    const n = landscape(s, nyos, "nyos", 2.73, 5.05, 1.6);
    s.look(0.1, 10, 7, 0.2);
    s.halfWidth = 5.75;
    s.halfHeight = 3;
    s.label(
      u(6.9828, 50.2106),
      "Ulmener Maar",
      "Deutschland · Bildbreite 1,2 km",
    );
    s.label(n(10.29866, 6.43834), "Nyos", "Kamerun · Bildbreite 3,9 km");
    s.explain(
      () =>
        "Blick nach Norden, Höhen jeweils 1,6-fach überhöht. Die Bildfelder zeigen unterschiedlich große Gebiete. Der Profilvergleich zeigt beide Seen im selben Maßstab.",
    );
    const links = document.createElement("div");
    links.className = "lake-origins";
    for (const [name, id] of [
      ["Ulmen verorten", "globe-ulmen"],
      ["Nyos verorten", "globe-nyos"],
    ]) {
      const button = document.createElement("button");
      button.textContent = name;
      button.onclick = () => s.visitPlace?.(id);
      links.append(button);
    }
    s.root.append(links);
    return;
  }
  const wide = s.view === "eifel",
    vertical = s.view === "aerial";
  const d = wide ? region : vertical ? environs : ulmen;
  const site = landscape(
    s,
    d,
    wide ? "eifel" : vertical ? "umfeld" : "ulmen",
    0,
    11,
    wide ? 4 : 1.6,
  );
  const pin = (x: number, y: number, name: string, detail = "") =>
    s.label(site(x, y), name, detail);
  pin(
    6.9828,
    50.2106,
    "Ulmener Maar",
    wide ? "Westeifeler Vulkanfeld" : "Ufer aus amtlichem Luftbild",
  );
  if (wide) {
    pin(6.83639, 50.1775, "Gemündener Maar");
    pin(6.85806, 50.16944, "Schalkenmehrener Maar");
    pin(
      7.26972,
      50.41028,
      "Laacher See · Caldera",
      "Forschungsgebiet tiefer niederfrequenter Beben",
    );
    const area = Array.from({ length: 81 }, (_, i) =>
      site(
        7.267 + 0.031 * Math.cos((i * Math.PI) / 40),
        50.396 + 0.024 * Math.sin((i * Math.PI) / 40),
      ),
    );
    s.line(area, 0xeac88b, "Untersuchungsregion · schematischer Umriss");
  } else {
    pin(6.98149, 50.20845, "Burgberg");
    pin(6.9794, 50.2097, "Ortskern Ulmen");
    if (vertical) pin(6.98039, 50.2183, "Jungferweiher");
  }
  s.look(
    vertical ? 0 : 1.05,
    vertical ? 14 : 6.9,
    vertical ? 0.001 : 8.8,
    0.33,
  );
  s.halfWidth = wide ? 5.35 : 5.1;
  s.halfHeight = vertical ? 4.8 : 3.15;
  s.explain(() =>
    wide
      ? "Intrakontinental auf der Eurasischen Platte. Tiefe Beben beim Laacher See deuten auf aufsteigende Fluide. Der Umriss bezeichnet ein Forschungsgebiet, einzelne Herde sind hier nicht verortet."
      : vertical
        ? "Norden oben · Jungferweiher und Ulmener Maar liegen in benachbarten Becken."
        : "Blick über das Ulmener Maar. Luftbild und Oberflächenmodell enthalten Wald und Bebauung. Höhen 1,6-fach überhöht.",
  );
}
