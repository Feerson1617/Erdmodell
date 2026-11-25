import * as T from "three";
import { localAsset } from "../assets";
let surface: Promise<T.Texture> | undefined;
const earthPhoto = () =>
  (surface ??= new T.TextureLoader()
    .loadAsync(localAsset("data/g6/earth-day.webp"))
    .then((t) => {
      t.colorSpace = T.SRGBColorSpace;
      return t;
    })
    .catch((e) => {
      surface = undefined;
      throw e;
    }));

export type Division = "composition" | "mechanics";
type Shell = [
  name: string,
  bottom: number,
  material: string,
  explanation: string,
  pressure: string,
  temperature: string,
  density: string,
  color: number,
];
// Representative 1-D profile. The regional Moho and thermal lithosphere have variable depths.
const composition: Shell[] = [
  [
    "Erdkruste",
    35,
    "Festes Gestein",
    "Die dünne äußere Gesteinsschicht trägt Kontinente und Meeresböden. Das Bild verwendet 35 km als kontinentales Beispiel.",
    "0–1 GPa",
    "örtlich sehr verschieden",
    "ca. 2,7–3,0 g/cm³",
    0xa3a08a,
  ],
  [
    "Oberer Mantel",
    660,
    "Überwiegend festes Silikatgestein",
    "Mantelgestein kann über Millionen Jahre fließen. Die Übergangszone reicht etwa von 410 bis 660 km.",
    "ca. 1–24 GPa",
    "größenordnungsmäßig 500–2.000 °C",
    "ca. 3,3–4,4 g/cm³",
    0xaf7351,
  ],
  [
    "Unterer Mantel",
    2891,
    "Festes Silikatgestein",
    "Druck verändert die Minerale. Auch dieser feste Mantel kann sich langsam verformen.",
    "ca. 24–136 GPa",
    "grob 2.000–4.000 °C",
    "ca. 4,4–5,6 g/cm³",
    0x845140,
  ],
  [
    "Äußerer Kern",
    5150,
    "Flüssige Eisenlegierung",
    "Bewegungen der elektrisch leitenden Flüssigkeit tragen zum Erdmagnetfeld bei.",
    "ca. 136–330 GPa",
    "mehrere Tausend Grad",
    "ca. 9,9–12,2 g/cm³",
    0xe89b43,
  ],
  [
    "Innerer Kern",
    6371,
    "Feste Eisenlegierung",
    "Unter dem hohen Druck kann das Metall trotz der Hitze fest bleiben.",
    "ca. 330–364 GPa",
    "grob 5.000–6.000 °C",
    "ca. 12,8–13,1 g/cm³",
    0xf1ce8b,
  ],
];
const mechanics: Shell[] = [
  [
    "Lithosphäre",
    100,
    "Feste, mechanisch starre Hülle",
    "Kruste und oberster Mantel bilden zusammen die Platten. Hier liegt ihre Untergrenze beispielhaft bei 100 km.",
    "regional verschieden",
    "von der Oberfläche bis ungefähr 1.300 °C",
    "abhängig von Kruste und Mantel",
    0x89998a,
  ],
  [
    "Asthenosphäre",
    350,
    "Fest und vergleichsweise leicht verformbar",
    "Unter der starren Platte kann heißes Gestein leichter fließen. Mächtigkeit und Grenzen sind regional verschieden.",
    "regional verschieden",
    "nahe an der örtlichen Schmelztemperatur",
    "im oberen Mantel ca. 3,3–3,6 g/cm³",
    0xb97550,
  ],
  [
    "Tieferer Mantel",
    2891,
    "Überwiegend fest und zähfließend",
    "Unterhalb der weichen Zone nimmt die Zähigkeit im Mittel zu. Die 660-km-Grenze liegt innerhalb dieses Modellbereichs.",
    "bis ca. 136 GPa",
    "mit Tiefe zunehmend",
    "mit Tiefe zunehmend",
    0x875646,
  ],
  composition[3],
  composition[4],
];
export const layersFor = (d: Division) => (d === "composition" ? composition : mechanics);
export class EarthClassification {
  readonly group = new T.Group();
  private meshes: T.Mesh[] = [];
  private revision = 0;
  constructor(
    public division: Division,
    public expanded: boolean,
    public selected: number,
    private repaint: () => void,
  ) {
    this.rebuild();
  }
  rebuild() {
    this.clear();
    const revision = ++this.revision;
    const layers = layersFor(this.division);
    let outer = 3.2;
    for (const [i, layer] of layers.entries()) {
      const radius = ((6371 - layer[1]) / 6371) * 3.2;
      const shown = i === 0 && this.expanded ? Math.min(radius, 3.2 * 0.945) : radius;
      const color = new T.Color(layer[7]);
      if (this.selected === i) color.offsetHSL(0, 0.09, 0.1);
      const rock = new T.MeshStandardMaterial({
        color,
        roughness: i === 3 ? 0.34 : 0.86,
        metalness: i >= 3 ? 0.22 : 0.02,
        side: T.DoubleSide,
      });
      // A 90-degree spherical wedge is removed. Both meridional walls share the exact sphere radii.
      const skin = i === 0 ? new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86 }) : rock;
      if (i === 0)
        void earthPhoto()
          .then((photo) => {
            if (revision !== this.revision) return;
            skin.map = photo;
            skin.needsUpdate = true;
            this.repaint();
          })
          .catch(() => {});
      rock.onBeforeCompile = (shader) => {
        shader.vertexShader =
          "varying vec3 specimen;\n" +
          shader.vertexShader.replace(
            "#include <begin_vertex>",
            "#include <begin_vertex>\nspecimen=position;",
          );
        shader.fragmentShader =
          "varying vec3 specimen;\n" +
          shader.fragmentShader.replace(
            "#include <color_fragment>",
            `#include <color_fragment>
          float r=length(specimen);float bend=sin(specimen.y*6.+specimen.z*3.2)+.5*sin(specimen.x*12.);
          float fabric=sin(r*98.+bend*1.5)*sin(specimen.y*17.+specimen.x*6.);
          float mottling=sin(specimen.x*11.+bend)*cos(specimen.y*13.-specimen.z*8.);
          diffuseColor.rgb*=1.+.065*fabric+.065*mottling;`,
          );
      };
      const mesh = new T.Mesh(new T.SphereGeometry(outer, 96, 56, Math.PI / 2, Math.PI * 1.5), skin);
      if (i === 0) {
        const uv = mesh.geometry.attributes.uv;
        for (let j = 0; j < uv.count; j++) uv.setX(j, 0.25 + 0.75 * uv.getX(j));
      }
      this.meshes.push(mesh);
      this.group.add(mesh);
      const wall = new T.Shape();
      wall.absarc(0, 0, outer, -Math.PI / 2, Math.PI / 2, false);
      if (shown > 0) {
        wall.lineTo(0, shown);
        wall.absarc(0, 0, shown, Math.PI / 2, -Math.PI / 2, true);
      } else wall.lineTo(0, 0);
      wall.closePath();
      for (const rotation of [Math.PI, -Math.PI / 2]) {
        // The open wedge spans the -X and +Z meridians.
        const face = new T.Mesh(new T.ShapeGeometry(wall, 72), rock);
        face.rotation.y = rotation;
        this.meshes.push(face);
        this.group.add(face);
      }
      outer = shown;
    }
    this.group.rotation.y = 1.03;
  }
  private clear() {
    const mats = new Set<T.Material>();
    for (const m of this.meshes) {
      m.geometry.dispose();
      mats.add(m.material as T.Material);
      m.removeFromParent();
    }
    mats.forEach((m) => m.dispose());
    this.meshes = [];
  }
  dispose() {
    this.revision++;
    this.clear();
  }
}
