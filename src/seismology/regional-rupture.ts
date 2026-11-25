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
    side: T.DoubleSide,
    uniforms: { phase },
    vertexShader:
      "attribute float radius; varying float d; void main(){d=radius;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `varying float d;uniform float phase;void main(){if(d>1.)discard;
      float front=clamp((phase-${onset})*4.,0.,1.2);
      vec3 c=mix(vec3(.65,.45,.24),vec3(.91,.32,.1),smoothstep(d,d+.12,front));
      float ring=exp(-24.*abs(d-front))*step(.001,front);
      gl_FragColor=vec4(mix(c,vec3(1.,.9,.62),ring),(.26+.41*ring)*(1.-smoothstep(.87,1.,d)));}`,
  });
  const face = new T.Mesh(g, material);
  face.name = "Begrenzte Bruchfläche";
  r.section.add(face);
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
