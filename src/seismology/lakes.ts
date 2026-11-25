import * as T from "three";
import {Stage,vec} from "./stage";
function basin(
  s: Stage,
  cx: number,
  width: number,
  depth: number,
  top: number,
  c: number,
  name: string,
) {
  const shape = new T.Shape();
  shape.moveTo(-width / 2, 0);
  for (let i = 0; i <= 72; i++) {
    const x = i / 36 - 1;
    shape.lineTo((x * width) / 2, -depth * Math.max(0, 1 - x * x) ** 0.69);
  }
  shape.lineTo(width / 2, 0);
  shape.closePath();
  const o = s.mesh(
    new T.ExtrudeGeometry(shape, { depth: 0.74, bevelEnabled: false }),
    c,
    name,
  );
  o.position.set(cx, top, -0.45);
  return o;
}
export function lakeSection(s:Stage){
  s.look(.7,2.1,14,-.14);s.halfWidth=5.9;s.halfHeight=2.55;
  const dep = 2.35,
    w = 8.65,
    top = 1.08;
  {
    // Horizons terminate at the lake floor. Their geometry is explicitly conceptual.
    const bed = (x: number) =>
      Math.abs(x) <= w / 2
        ? top - dep * Math.max(0, 1 - ((2 * x) / w) ** 2) ** 0.69
        : top + 0.35 * Math.sin((Math.abs(x) - w / 2) * 3);
    for (let j = 0; j < 5; j++) {
      const rock = new T.Shape();
      for (let i = 0; i <= 100; i++) {
        const x = i * 0.106 - 5.3,
          y = bed(x) - j * 0.23;
        i ? rock.lineTo(x, y) : rock.moveTo(x, y);
      }
      for (let i = 100; i >= 0; i--) {
        const x = i * 0.106 - 5.3;
        rock.lineTo(x, bed(x) - (j + 1) * 0.23);
      }
      rock.closePath();
      const layer = s.mesh(
        new T.ExtrudeGeometry(rock, { depth: 0.9, bevelEnabled: false }),
        [0x907754, 0xb19d7b, 0x766e5e, 0x8e7663, 0x67574e][j],
        "Idealisierter Untergrund",
      );
      layer.position.z = -0.52;
    }
      s.label(
        vec(4.64, 1.35, 0.38),
        "Kraterrand",
        "Gesteinsschichten schematisch",
      );
  }
  basin(s, 0, w, dep, top, 0x296375, "Idealisiertes Becken");
  s.label(vec(-2.6,.93,.37),"Oberflächenwasser");
  s.label(vec(.25,-.94,.37),"Tiefenwasser","LfU-Stammdaten: maximale Tiefe 38 m");
  s.explain(()=>"Ulmener Maar · Beckenboden und Gesteinsschichten idealisiert. Stammdaten 38 m, weitere Quellen 35 und 39 m. Das Profil ist vertikal überhöht.");
}
