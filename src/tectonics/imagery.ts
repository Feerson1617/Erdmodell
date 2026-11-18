import * as T from "three";
import { R, RAD } from "../geo";
import { drape, type Elevation } from "./surface";
import island from "./island.webp";
import japan from "./japan.webp";
import san from "./san.webp";

const patches = [
  { id: "island", url: island, west: -40.5, north: 76.5, width: 36, height: 22.5 },
  { id: "japan", url: japan, west: 126, north: 49.5, width: 31.5, height: 22.5 },
  { id: "san", url: san, west: -135, north: 45, width: 31.5, height: 22.5 },
] as const;

/** All imagery uses the globe's geodetic frame, terrain heights and scene lights. */
export async function regionalImagery(elevation: Elevation = () => 0) {
  const results = await Promise.allSettled(patches.map(async patch => {
    const texture = await new T.TextureLoader().loadAsync(patch.url);
    texture.colorSpace = T.SRGBColorSpace;
    texture.anisotropy = 4;
    const geometry = new T.SphereGeometry(
      R, Math.ceil(patch.width * 3), Math.ceil(patch.height * 3),
      (patch.west + 180) * RAD, patch.width * RAD,
      (90 - patch.north) * RAD, patch.height * RAD,
    ).rotateY(-Math.PI / 2);
    const material = new T.MeshLambertMaterial({
      map: texture, transparent: true, depthWrite: false,
    });
    // In the GIBS mosaic the deep Pacific is often below RGB (3, 7, 25).
    // Lift the dark blue range before lighting so bathymetric shading survives projection.
    material.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        float luma = dot(diffuseColor.rgb, vec3(.2126, .7152, .0722));
        float blue = diffuseColor.b - max(diffuseColor.r, diffuseColor.g);
        float water = smoothstep(0., .003, blue) * (1. - smoothstep(.015, .07, luma));
        diffuseColor.rgb += water * (.28 * sqrt(diffuseColor.rgb) + vec3(.002, .006, .014));`,
      );
    };
    const mesh = new T.Mesh(drape(geometry, elevation, 0.75), material);
    mesh.name = patch.id;
    mesh.renderOrder = 0.5;
    return mesh;
  }));
  const group = new T.Group();
  const missing: string[] = [];
  for (const [index, result] of results.entries()) {
    if (result.status === "fulfilled") group.add(result.value);
    else missing.push(patches[index].id);
  }
  if (!group.children.length) throw Error("Die regionalen Bildmosaike fehlen.");
  group.userData.missing = missing;
  return group;
}
