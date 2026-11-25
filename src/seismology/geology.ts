import * as T from "three";
import { Stage, colors, vec } from "./stage";
import { mechanisms, rupture, referenceSource, faultMotion } from "./physics";
import { materials, libraryGLSL, quality } from "../observatory/graphics";
import { specimen, randomSequence } from "../observatory/local-plants";
import events from "../observatory/japan-events.json";
import miyagi from "../observatory/miyagi.json";

const terrain = (x: number, z: number) =>
  0.23 * Math.sin(0.72 * x + 0.4 * z) +
  0.32 * Math.exp(-0.48 * ((x + 2.4) ** 2 + (z + 1.6) ** 2)) +
  0.07 * Math.sin(x * 1.5 - z * 0.72) +
  0.035 * Math.cos(z * 2 + x);
const palette = [0x706660, 0x9f8471, 0xc4a588, 0x917456, 0xc3b793, 0x85977e];
type Mapping = (u: number, v: number) => T.Vector3;
export function surface(
  s: Stage,
  cols: number,
  rows: number,
  map: Mapping,
  color: number,
  name: string,
) {
  const positions: number[] = [],
    indices: number[] = [],
    shades: number[] = [];
  const paint = new T.Color(color);
  for (let j = 0; j <= rows; j++)
    for (let i = 0; i <= cols; i++) {
      const p = map(i / cols, j / rows);
      positions.push(p.x, p.y, p.z);
      const grain =
        0.92 +
        0.056 * Math.sin(18 * p.y + 1.5 * p.x + 0.62 * p.z) +
        0.03 * Math.sin(13 * p.x - 19 * p.z + 9 * p.y);
      shades.push(paint.r * grain, paint.g * grain, paint.b * grain);
      if (i < cols && j < rows) {
        const a = j * (cols + 1) + i;
        indices.push(a, a + cols + 1, a + 1, a + 1, a + cols + 1, a + cols + 2);
      }
    }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new T.Float32BufferAttribute(shades, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  const m = s.mesh(g, 0xffffff, name),
    mat = m.material as T.MeshStandardMaterial;
  mat.vertexColors = true;
  m.receiveShadow = true;
  // Fine discontinuous bedding follows each material point as the block deforms.
  g.setAttribute("rockPoint", new T.Float32BufferAttribute(positions, 3));
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader =
      "attribute vec3 rockPoint; varying vec3 rockCoord;\n" +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nrockCoord=rockPoint;",
      );
    shader.fragmentShader =
      "varying vec3 rockCoord;\n" +
      shader.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
      float bedding=rockCoord.y*72.0+2.4*sin(rockCoord.x*1.6+rockCoord.z*.8);
      float grains=fract(sin(dot(floor(rockCoord*95.0),vec3(15.73,71.17,44.89)))*437.52);
      diffuseColor.rgb*=.91+.09*sin(bedding)+.105*grains;
    `,
      );
  };
  if (mechanisms[s.view] || ["storage","degassing","contact","maar","dryMaar","lakeMaar"].includes(s.view)) {
    void materials().then((lib) => {
      if (s.disposed) return;
      const base = mat.onBeforeCompile;
      mat.customProgramCacheKey = () =>
        "seismic-facies-" + (name === "Gelände" ? "land" : "rock");
      mat.onBeforeCompile = (shader, renderer) => {
        base.call(mat, shader, renderer);
        Object.assign(shader.uniforms, {
          faciesColor: { value: lib.color },
          faciesRelief: { value: lib.relief },
          detailGrade: { value: quality() },
        });
        const uv =
          name === "Gelände"
            ? "rockCoord.xz"
            : "vec2(rockCoord.x+.7*rockCoord.z,rockCoord.y)";
        const tile = name === "Gelände" ? "0." : "1.";
        shader.fragmentShader =
          libraryGLSL +
          shader.fragmentShader.replace(
            "#include <color_fragment>",
            `#include <color_fragment>
          vec2 strataUV=${uv}*1.4;
          vec3 grain=fieldSample(faciesColor,strataUV,${tile}).rgb;
          vec3 relief=fieldSample(faciesRelief,strataUV,${tile}).rgb;
          diffuseColor.rgb*=clamp(.55+1.45*luma6(grain)+.55*(relief.g-.5),.42,1.55);
          `,
          );
      };
      mat.needsUpdate = true;
      s.refresh();
    });
  }
  return m;
}
export function faultStudy(s: Stage) {
  const { dip, rake } = mechanisms[s.view],
    angle = (dip * Math.PI) / 180,
    r = (rake * Math.PI) / 180;
  const plane = (y: number) => -y / Math.tan(angle) - 0.75,
    depth = -1.0;
  const origin = vec(plane(depth), depth, 0),
    along = vec(
      -Math.cos(angle) * Math.sin(r),
      Math.sin(angle) * Math.sin(r),
      Math.cos(r),
    );
  const movement = (p: T.Vector3, side: number, t: number, out: T.Vector3) => {
    const motion = faultMotion(
      t,
      p.x - plane(p.y),
      p.z,
      (p.y - depth) / Math.sin(angle),
    );
    return out.copy(p).addScaledVector(along, side * motion.offset);
  };
  s.look(
    s.view === "strike" ? 5.2 : 3.2,
    s.view === "strike" ? 6.7 : 3.8,
    13,
    -0.65,
  );
  s.halfWidth = 6.5;
  s.halfHeight = 3.15;
  const levels = [-3, -2.25, -1.72, -1.16, -0.69, -0.29, 0];
  for (const side of [-1, 1]) {
    const front = side > 0 ? -0.1 : 2.65;
    const map = (u: number, h: number, z: number) => {
      const seam = T.MathUtils.clamp(plane(h), -4.97, 4.97),
        x = seam + (side * 5 - seam) * u;
      return vec(x, h + terrain(x, z) * Math.exp(h * 0.9), z);
    };
    const witness = vec(
      plane(depth) + side * 0.19,
      depth,
      side > 0 ? -0.08 : 0.07,
    );
    const marker = s.dot(
      witness,
      side > 0 ? 0x78ded1 : 0xf3bd75,
      0.13,
      side > 0 ? "Material rechts" : "Material links",
    );
    s.animate((t) => movement(witness, side, t, marker.position));
    const patches: T.Mesh[] = [];
    for (let k = 0; k < levels.length - 1; k++) {
      for (const z of [-2.65, front])
        patches.push(
          surface(
            s,
            35,
            3,
            (u, v) => map(u, T.MathUtils.lerp(levels[k], levels[k + 1], v), z),
            palette[k],
            "Gesteinsschicht",
          ),
        );
      for (const u of [0, 1])
        patches.push(
          surface(
            s,
            32,
            3,
            (v, h) =>
              map(
                u,
                T.MathUtils.lerp(levels[k], levels[k + 1], h),
                v * (front + 2.65) - 2.65,
              ),
            u ? palette[k] : 0xa87555,
            "Schicht an der Störung",
          ),
        );
    }
    patches.push(
      surface(
        s,
        36,
        26,
        (u, v) => map(u, 0, v * (front + 2.65) - 2.65),
        0x758660,
        "Gelände",
      ),
    );
    for (const patch of patches) {
      const g = patch.geometry,
        attr = g.attributes.position as T.BufferAttribute,
        base = Float32Array.from(attr.array),
        p = vec(),
        q = vec();
      s.animate((t) => {
        for (let i = 0; i < attr.count; i++) {
          p.fromArray(base, i * 3);
          movement(p, side, t, q);
          attr.setXYZ(i, q.x, q.y, q.z);
        }
        attr.needsUpdate = true;
      });
    }
    // A marked road and outcrop markers follow exactly the same displacement field as the rocks.
    const points = Array.from({ length: 44 }, (_, j) => {
      const p = map(j / 43, 0, -0.44);
      p.y += 0.043;
      return p;
    });
    const road = s.line(points, 0xffe4af, "Straßenmarkierung"),
      a = road.geometry.attributes.position as T.BufferAttribute,
      q = vec();
    s.animate((t) => {
      points.forEach((p, i) => {
        movement(p, side, t, q);
        a.setXYZ(i, q.x, q.y, q.z);
      });
      a.needsUpdate = true;
    });
    const random = randomSequence(436 + side),
      grove = [specimen("oak", 51, true), specimen("shrub", 82, true)];
    for (let i = 0; i < 17; i++) {
      const p = map(
        0.12 + random() * 0.83,
        0,
        -2.55 + random() * (front + 2.48),
      );
      if (Math.abs(p.z + 0.44) < 0.16) continue;
      const k = i % 2,
        tree = s.mesh(grove[k], 0xffffff, "Vegetation");
      (tree.material as T.MeshStandardMaterial).vertexColors = true;
      tree.castShadow = true;
      tree.scale.setScalar((k ? 0.16 : 0.075) * (0.72 + random() * 0.7));
      tree.rotation.y = random() * Math.PI * 2;
      s.animate((t) => movement(p, side, t, tree.position));
    }
  }
  const faultFace = surface(
    s,
    48,
    24,
    (u, v) => {
      const y = -0.14 - 2.4 * v;
      return vec(plane(y) + 0.025, y, u * 4 - 1.7);
    },
    0xbd8867,
    "Endliche Störungsfläche",
  );
  const attr = faultFace.geometry.attributes.position,
    shades = faultFace.geometry.attributes.color as T.BufferAttribute;
  const intact = new T.Color(0x846b53),
    active = new T.Color(0xffa74e),
    spent = new T.Color(0xb45c42),
    mix = new T.Color();
  s.animate((t) => {
    for (let i = 0; i < attr.count; i++) {
      const z = attr.getZ(i),
        dist = (attr.getY(i) - depth) / Math.sin(angle),
        q = rupture(t, z, dist);
      const pulse = Math.sin(q * Math.PI);
      mix
        .copy(intact)
        .lerp(spent, q)
        .lerp(active, pulse * 0.85);
      shades.setXYZ(i, mix.r, mix.g, mix.b);
    }
    shades.needsUpdate = true;
  });
  const hypo = s.dot(origin, colors.hot, 0.13, "Hypozentrum"),
    epi = vec(origin.x, terrain(origin.x, 0) + 0.02, 0);
  s.dot(epi, colors.p, 0.085, "Epizentrum");
  s.line([origin, epi], colors.p, "Herdtiefe", 0.75);
  const ring = s.line(
    Array.from({ length: 81 }, () => origin.clone()),
    colors.hot,
    "Bruchfront",
  );
  const a = ring.geometry.attributes.position as T.BufferAttribute;
  s.animate((t) => {
    const grow = Math.min(1, Math.max(0, (t - 0.34) * 2.8));
    ring.visible = grow > 0 && t < 0.79;
    hypo.scale.setScalar(1 + 0.27 * Math.exp(-Math.abs(t - 0.34) * 17));
    for (let i = 0; i < a.count; i++) {
      const b = (i * 2 * Math.PI) / (a.count - 1),
        y = origin.y + Math.sin(b) * grow * 0.88 * Math.sin(angle);
      a.setXYZ(i, plane(y) + 0.015, y, Math.cos(b) * grow * 2.9);
    }
    a.needsUpdate = true;
    ring.frustumCulled = false;
  });
  s.label(epi, "Epizentrum", "senkrecht über dem Herd");
  s.label(origin, "Hypozentrum", "Beginn des Bruchs");
  s.label(vec(-2.3, 0, -0.44), "Geländemarker");
  s.label(vec(plane(-0.62), -0.62, 0.9), "Störungsfläche");
  s.explain((t) =>
    t < 0.34
      ? "Der Fernbereich bewegt sich langsam. Am verhakten Abschnitt verformt sich das Gestein elastisch."
      : t < 0.65
        ? "Der Bruch beginnt am Herd und erfasst einen begrenzten Teil der Störungsfläche."
        : "Die elastische Verzerrung lässt am gebrochenen Abschnitt nach. Die versetzten Geländemarker zeigen die bleibende Verschiebung.",
  );
}
export function japan(s: Stage) {
  s.look(0, 0.5, 17, -0.25);
  s.halfWidth = 6.5;
  s.halfHeight = 2.8;
  // The catalogue projection is in kilometres transversely to the trench; both datasets share the same scales.
  const X = (km: number) => (km + 130) / 48,
    Y = (km: number) => 1.6 - km / 36;
  for (const d of [0, 40, 80, 120, 160]) {
    s.line(
      [vec(X(-410), Y(d)), vec(X(150), Y(d))],
      0x627b7b,
      "Tiefenraster",
      0.55,
    );
    s.label(vec(X(-396), Y(d)), d + " km");
  }
  const g = new T.SphereGeometry(0.067, 12, 9),
    m = new T.InstancedMesh(
      g,
      new T.MeshStandardMaterial({ roughness: 0.53 }),
      events.length,
    ),
    dummy = new T.Object3D();
  const byDepth = [...events].sort((a, b) => Number(a[2]) - Number(b[2]));
  events.forEach((e, i) => {
    const d = Number(e[2]);
    dummy.position.set(X(Number(e[1])), Y(d), 0);
    dummy.scale.setScalar(0.88 + (Number(e[6]) - 4.5) * 0.42);
    dummy.updateMatrix();
    m.setMatrixAt(i, dummy.matrix);
    m.setColorAt(i, new T.Color(d >= 70 ? 0xff9668 : colors.p));
  });
  m.name = "176 beobachtete Hypozentren";
  s.scene.add(m);
  if (s.view === "slab") {
    const pts = miyagi.map(([x, d]) => vec(X((x * 320) / 12), Y(d), 0.08));
    s.line(pts, colors.s, "Miyagi · seismisches Profil");
    s.label(pts[7], "Unabhängiges Profil");
  }
  if (s.view === "shallowDeep") {
    for (const e of [byDepth[4], byDepth.at(-3)!]) {
      const p = vec(X(Number(e[1])), Y(Number(e[2])), 0.06);
      s.dot(p, colors.s, 0.1);
      s.line([p, vec(p.x, Y(0), 0.06)], colors.s, "Lot zur Oberfläche");
      s.label(p, Number(e[2]).toLocaleString("de-DE") + " km");
    }
  }
  s.label(vec(X(-290), Y(0)), "West · Honshū");
  s.label(vec(X(87), Y(0)), "Ost · Pazifik");
  s.explain(() =>
    s.view === "slab"
      ? "Die geneigte Zone von Erdbebenherden zeichnet die abtauchende Platte nach. Die türkisfarbene Profillinie stammt aus einem eigenen seismischen Datensatz."
      : "Jeder Punkt ist ein katalogisiertes Beben. Die Projektion auf einen 200 km breiten Profilstreifen fasst unterschiedliche Orte zusammen.",
  );
}
export function sources(s: Stage) {
  s.look(4, 4, 15, -0.2);
  s.halfWidth = 6.8;
  for (const [i, mw] of [6, 7].entries()) {
    const src = referenceSource(mw),
      center = i ? 1.7 : -3.8,
      scale = src.length / 14000;
    for (let k = 0; k < 4; k++)
      s.box(
        center,
        -scale * 0.25 + k * scale * 0.15,
        -0.39,
        scale * 1.22,
        scale * 0.145,
        0.62,
        [0x8b7966, 0x9f826a, 0xb19d80, 0x8d9475][k],
        "Gesteinsvolumen",
      );
    const patch = s.mesh(
      new T.PlaneGeometry(scale, scale / 2),
      i ? 0xf1a16d : 0xebca8a,
      "Bruchfläche Mw " + mw,
    );
    patch.position.set(center, 0.1, 0);
    patch.rotation.x = -0.35;
    const edge = new T.LineSegments(
      new T.EdgesGeometry(patch.geometry),
      new T.LineBasicMaterial({ color: 0xffedbc }),
    );
    edge.position.copy(patch.position);
    edge.rotation.copy(patch.rotation);
    s.scene.add(edge);
    const grid = new T.LineSegments(
      new T.WireframeGeometry(
        new T.PlaneGeometry(
          scale,
          scale / 2,
          Math.round(scale * 3),
          Math.max(2, Math.round(scale * 1.5)),
        ),
      ),
      new T.LineBasicMaterial({
        color: 0x845b41,
        transparent: true,
        opacity: 0.48,
      }),
    );
    grid.position.copy(patch.position);
    grid.position.z += 0.012;
    grid.rotation.copy(patch.rotation);
    s.scene.add(grid);
    const p = patch.position.clone();
    s.label(
      p,
      "Mw " +
        mw +
        " · " +
        Math.round(src.length / 1000) +
        " × " +
        Math.round(src.width / 1000) +
        " km",
    );
    const border = s.line(
      [vec(center - scale / 2, -1.55), vec(center + scale / 2, -1.55)],
      colors.s,
      "Mittlerer Versatz",
    );
    border.position.y = 0.12;
    const marker = s.dot(vec(center, -1.42), colors.s, 0.09);
    s.animate((t) => {
      marker.position.x =
        center + src.slip * Math.min(1, Math.max(0, (t - 0.32) * 4));
    });
    s.label(
      vec(center, -1.53),
      "Versatz " + src.slip.toFixed(2).replace(".", ",") + " m",
    );
  }
  s.explain(
    () =>
      "Im Beispiel wachsen Bruchfläche und mittlerer Versatz gemeinsam. Bei gleicher Gesteinssteifigkeit hat Mw 7 das 31,6-Fache des seismischen Moments von Mw 6.",
  );
}
export function intrusion(s: Stage) {
  s.look(3.4, 2.8, 14, -0.5);
  s.halfWidth = 6.8;
  const top = (x: number, z: number) =>
    0.55 +
    0.65 * Math.exp(-0.36 * (x * x + z * z)) +
    0.17 * Math.sin(0.9 * x + 0.5 * z);
  const deform = (mesh: T.Mesh) => {
    const a = mesh.geometry.attributes.position as T.BufferAttribute,
      base = Float32Array.from(a.array);
    s.animate((t) => {
      const lift = s.view === "tectonic" ? 0 : 0.2 * t;
      for (let i = 0; i < a.count; i++) {
        const x = base[i * 3],
          y = base[i * 3 + 1],
          z = base[i * 3 + 2];
        a.setY(
          i,
          y +
            lift *
              Math.exp(-0.27 * (x + 0.2) ** 2 - 0.12 * z * z) *
              Math.max(0.2, (y + 3) / 4),
        );
      }
      a.needsUpdate = true;
    });
  };
  for (let j = 0; j < 5; j++) {
    const bottom = -3 + j * 0.72;
    deform(
      surface(
        s,
        64,
        6,
        (u, v) => {
          const x = (u - 0.5) * 10;
          return vec(x, bottom + v * 0.72 + top(x, 0) * 0.55, 0);
        },
        palette[j],
        "Geschichtete Kruste",
      ),
    );
  }
  deform(
    surface(
      s,
      52,
      20,
      (u, v) => {
        const x = (u - 0.5) * 10,
          z = -v * 3;
        return vec(x, 0.6 + top(x, z) * 0.55, z);
      },
      0x76816a,
      "Landoberfläche",
    ),
  );
  const reservoir = s.dot(
    vec(-0.7, -1.95, 0.09),
    0x83685a,
    1,
    "Kristallreiches Speichergestein",
  );
  reservoir.scale.set(1.25, 0.48, 0.26);
  // Melt lenses and crystals occupy only part of the crustal volume.
  for(let i=0;i<22;i++){
    const x=-1.76+(i%8)*.29, y=-1.96+Math.sin(i*2.37)*.34;
    const lens=s.dot(vec(x,y,0.28),i%3===0?0xbdb19b:0xe68c59,.12,"Kristall und Schmelzlinse");
    lens.scale.set(i%3===0?.7:1.68,.43,.72);
    lens.rotation.z=.24*Math.sin(i*2.2);
  }
  const path = [
    vec(-0.55, -1.95, 0.11),
    vec(-0.18, -1.34, 0.11),
    vec(-0.28, -0.9, 0.11),
    vec(0.32, -0.29, 0.11),
    vec(0.24, 0.06, 0.11),
  ];
  const dyke = s.mesh(
    new T.TubeGeometry(new T.CatmullRomCurve3(path), 36, 0.064, 9, false),
    0xe98055,
    "Magmatischer Gang",
  );
  const crack = s.line(
    [
      vec(0.45, 0.13, 0.17),
      vec(0.76, -0.25, 0.17),
      vec(0.7, -0.48, 0.17),
      vec(1.08, -0.83, 0.17),
    ],
    colors.p,
    "Spröder Bruch",
  );
  const fluid = Array.from({ length: 9 }, () =>
    s.dot(vec(), colors.s, 0.049, "Fluid"),
  );
  const active = s.view !== "tectonic";
  s.animate((t) => {
    dyke.visible = active;
    dyke.geometry.setDrawRange(0, Math.floor((0.35 + 0.65 * t) * 36) * 9 * 6);

    crack.visible = s.view !== "quiet" && t > 0.26;
    fluid.forEach((m, i) => {
      const f = (t + i / 9) % 1;
      m.visible = ["fluid", "tremor", "monitor"].includes(s.view);
      m.position.set(
        0.34 + 0.48 * f + 0.11 * Math.sin(f * 11),
        -0.7 + 1.75 * f,
        0.14,
      );
    });
  });
  s.label(reservoir.position, "Schmelzreiche Zone", "Magma im Gestein");
  s.label(vec(0.27, -0.55, 0.2), "Gang", "", () => active);
  if (s.view !== "quiet")
    s.label(vec(0.8, -0.32, 0.15), "Bruchzone", "", (t) => t > 0.26);
  if (s.view === "monitor") {
    s.label(vec(2.2,0.7,0),"Temperatur","Wärmefluss und Oberflächentemperatur ergänzen Gas-, Lage- und Erschütterungsmessungen");
    for (const [x, n, c] of [
      [-3, "GNSS", colors.s],
      [1.7, "Seismometer", colors.p],
      [3.4, "Gasmessung", colors.lime],
    ] as const) {
      const p = vec(x, 0.67 + top(x, 0) * 0.55, 0);
      s.box(p.x, p.y, p.z, 0.18, 0.23, 0.14, c, n);
      s.label(p, n);
    }
  }
  const explanations: Record<string, string> = {
    tectonic:
      "Auch in einem Vulkangebiet können regionale tektonische Spannungen einen spröden Bruch auslösen.",
    vt: "Veränderte Spannungen um eine Intrusion können kleine spröde Brüche auslösen. Ihr impulsives Signal ähnelt dem eines tektonischen Bebens.",
    fluid:
      "Fluide können Risse unter Druck setzen und Schwingungen anregen. Auch hydrothermales Wasser ist eine mögliche Quelle.",
    tremor:
      "Eine länger anhaltende Anregung kann Tremor erzeugen. Der Verlauf allein lässt seine Ursache offen.",
    quiet:
      "Ein möglicher Verlauf mit schwacher seismischer Aktivität. Intrusionen können in der Tiefe zum Stillstand kommen.",
    monitor:
      "Seismometer, GNSS, Satellitenradar und Gasmessungen erfassen unterschiedliche Veränderungen. Ihre gemeinsame Auswertung grenzt mögliche Ursachen ein.",
  };
  s.explain(() => explanations[s.view]);
}
