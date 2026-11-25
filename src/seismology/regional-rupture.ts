import * as T from "three";
import type { RegionalScene } from "../observatory/regional";
import { onset } from "../observatory/fault";

export function addRupturePatch(r: RegionalScene) {
  if (r.spec.theme !== "earthquake") return;
  const f = r.faultModel,
    nx = 27,
    ny = 19,
    coords: number[] = [],
    indices: number[] = [],
    weights: number[] = [];
  for (let j = 0; j <= ny; j++)
    for (let i = 0; i <= nx; i++) {
      const z = (i / nx - 0.5) * 3.6,
        y = f.hy + (j / ny - 0.5) * 1.32,
        x = f.xAt(y);
      coords.push(x, y, z);
      weights.push(Math.hypot((x - f.hx) / 1.8, (y - f.hy) / 0.72, z / 1.8));
      if (i < nx && j < ny) {
        const a = j * (nx + 1) + i;
        indices.push(a, a + 1, a + nx + 1, a + 1, a + nx + 2, a + nx + 1);
      }
    }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(coords, 3));
  g.setAttribute("radius", new T.Float32BufferAttribute(weights, 1));
  g.setIndex(indices);
  const phase = { value: 0 };
  const material = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    side: T.DoubleSide,
    uniforms: { phase },
    vertexShader:
      "attribute float radius; varying float d; void main(){d=radius;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `varying float d;uniform float phase;void main(){if(d>1.)discard;
      float front=clamp((phase-${onset})*4.,0.,1.2);
      vec3 c=mix(vec3(.65,.45,.24),vec3(.91,.32,.1),smoothstep(d,d+.12,front));
      float ring=exp(-15.*abs(d-front))*step(.001,front);
      gl_FragColor=vec4(mix(c,vec3(1.,.9,.62),ring),(.58+.38*ring)*(1.-smoothstep(.87,1.,d)));}`,
  });
  const face = new T.Mesh(g, material);
  face.name = "Begrenzte Bruchfläche";
  r.section.add(face);
  if (r.spec.site === "san") {
    // The Parkfield cut removes the front half. Put the witness surface inside that opening.
    const witnesses = new T.Group();
    r.scene.add(witnesses);
    const p = new T.Vector3(),
      q = new T.Vector3();
    for (const z of [-0.78, 0.54])
      for (const side of [-1, 1]) {
        const pts = Array.from({ length: 34 }, (_, i) => {
          const x = f.trace + side * (0.015 + (i / 33) * 2.7);
          return new T.Vector3(x, r.height(x, z) + 0.047, z);
        });
        const width = 0.035,
          vertices = new Float32Array(pts.length * 6),
          idx = [];
        for (let i = 0; i < pts.length - 1; i++) {
          const a = i * 2;
          idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
        const geom = new T.BufferGeometry(),
          attr = new T.BufferAttribute(vertices, 3);
        geom.setAttribute("position", attr);
        geom.setIndex(idx);
        const strip = new T.Mesh(
          geom,
          new T.MeshBasicMaterial({ color: 0xffdc91, side: T.DoubleSide }),
        );
        strip.frustumCulled = false;
        strip.name = "Spur des Geländeversatzes";
        witnesses.add(strip);
        r.onAnimate((t) => {
          witnesses.visible = r.ruptureAnalysis;
          if (!witnesses.visible) return;
          pts.forEach((point, i) => {
            p.copy(point);
            f.offset(q, p.x, p.y, p.z, side, t);
            p.add(q);
            attr.setXYZ(i * 2, p.x, p.y, p.z - width);
            attr.setXYZ(i * 2 + 1, p.x, p.y, p.z + width);
          });
          attr.needsUpdate = true;
        });
      }
  }
  r.onAnimate((t) => {
    phase.value = t;
    face.visible = r.ruptureAnalysis && r.cut;
  });
}
export function regionalPhase(t: number) {
  if (t < 0.17) return "Langsame Bewegung · die Störung hält örtlich fest.";
  if (t < onset)
    return "Elastische Verformung · im umgebenden Gestein baut sich Spannung auf.";
  if (t < 0.48) return "Bruchbeginn · am Hypozentrum beginnt das Gleiten.";
  if (t < 0.7)
    return "Bruchausbreitung · der Versatz erfasst weitere Teile der Störungsfläche.";
  if (t < 0.91)
    return "Die Erschütterung klingt ab. Der Bruch hat eine begrenzte Fläche erfasst.";
  return "Die Erschütterung ist vorbei. Ein bleibender Versatz zeichnet die Bewegung nach.";
}
