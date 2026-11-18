import * as T from "three";
import { R, RAD } from "../geo";
import island from "./island.webp";
import japan from "./japan.webp";
import san from "./san.webp";

export async function regionalImagery() {
  const patches = [
    { url: island, west: -40.5, north: 76.5, width: 36, height: 22.5 },
    { url: japan, west: 126, north: 49.5, width: 31.5, height: 22.5 },
    { url: san, west: -135, north: 45, width: 31.5, height: 22.5 },
  ];
  const group = new T.Group();
  await Promise.all(
    patches.map(async (patch) => {
      const texture = await new T.TextureLoader().loadAsync(patch.url);
      texture.colorSpace = T.SRGBColorSpace;
      texture.anisotropy = 4;
      const geometry = new T.SphereGeometry(
        R + 10,
        80,
        56,
        (patch.west + 180) * RAD,
        patch.width * RAD,
        (90 - patch.north) * RAD,
        patch.height * RAD,
      );
      geometry.rotateY(-Math.PI / 2);
      const material = new T.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      });
      group.add(new T.Mesh(geometry, material));
    }),
  );
  return group;
}
