import * as T from "three";
import { clamp, smooth } from "../geo";
import type { NyosSection } from "./section";
import type { NyosTerrain } from "./terrain";

const vertexShader = `
  varying vec2 vEventUv;
  void main() {
    vEventUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
  }
`;

/** Marks movement of liquid water in the open section, without colouring the gas in air. */
function risingWater(depth: number, z: number) {
  const material = new T.ShaderMaterial({
    uniforms: { eventTime: { value: 0 } },
    vertexShader,
    fragmentShader: `
      varying vec2 vEventUv; uniform float eventTime;
      void main() {
        float y = vEventUv.y;
        float head = mix(.12,.94,smoothstep(.17,.46,eventTime));
        float axis = .49 + .09 * sin(y * 6. - .6);
        float dx = vEventUv.x - axis;
        float band = exp(-pow(dx / (.20 + .14*y), 2.));
        float flow = .5 + .5 * cos(40. * dx + 1.5 * sin(7.*y - eventTime*13.));
        float trail = band * (.27 + .46 * flow) * smoothstep(.00,.12,y)
                    * (1. - smoothstep(head-.16,head+.02,y));
        float shoulder = 1. - smoothstep(.012,.045,abs(y - head + .54 * abs(dx)));
        float crest = shoulder * (1. - smoothstep(.15,.30,abs(dx)));
        float opacity = max(trail, .86 * crest) * (1.-smoothstep(.60,.68,eventTime));
        if (opacity < .018) discard;
        gl_FragColor = vec4(mix(vec3(.20,.63,.58),vec3(.77,.94,.80),max(crest,.45*flow)),opacity);
        #include <colorspace_fragment>
      }
    `,
    transparent: true, depthWrite: false, side: T.DoubleSide, toneMapped: false,
  });
  const mesh = new T.Mesh(new T.PlaneGeometry(.205, depth), material);
  mesh.rotation.y = Math.PI / 2;
  mesh.position.set(.0028, -depth / 2, z);
  mesh.renderOrder = 4;
  return mesh;
}

/** Small surface waves sharing the exact local water level and the cut's east edge. */
function surfaceWaves(z: number) {
  const geometry = new T.PlaneGeometry(.55, .55).rotateX(-Math.PI / 2);
  const material = new T.ShaderMaterial({
    uniforms: { eventTime: { value: 0 } },
    vertexShader,
    fragmentShader: `
      varying vec2 vEventUv; uniform float eventTime;
      void main() {
        vec2 p = (vEventUv - .5) * 2.;
        if(eventTime < .68 && p.x * .275 > .028) discard;
        float azimuth = atan(p.y,p.x + .00001);
        float base = length(p * vec2(1.03,.94));
        float d = base * (1. + .040*sin(3.*azimuth + base*4.) + .028*sin(5.*azimuth-base*2.));
        float advance = clamp((eventTime-.53)/.14,0.,1.);
        float limit = .20 + .76 * advance;
        float wave = .5+.5*cos(50.*d - 31.*advance + .55*sin(8.*p.y));
        float glints = .30+.70*smoothstep(-.5,.8,sin(2.*azimuth+5.*d)+.7*cos(4.*azimuth-6.*d));
        float ring = pow(wave, 3.) * glints;
        float outer = 1.-smoothstep(limit-.15,limit,d);
        float center = exp(-14.*d*d);
        float opacity = outer * (.72*ring + .17*center) * (1.-smoothstep(.68,.79,eventTime));
        if(opacity < .025) discard;
        gl_FragColor=vec4(mix(vec3(.26,.63,.55),vec3(.86,.91,.70),ring),opacity);
        #include <colorspace_fragment>
      }
    `,
    transparent: true, depthWrite: false, side: T.DoubleSide, toneMapped: false,
  });
  const mesh = new T.Mesh(geometry, material);
  mesh.position.set(-.028, .0026, z);
  mesh.renderOrder = 5;
  return mesh;
}

/**
 * Short illustrative strip in a hollow near the north shore. Only the underlying
 * ground height is sampled. The graphic does not compute transport, reach or dose.
 */
function reliefIllustration(terrain: NyosTerrain) {
  const center = terrain.meta!.anchor;
  // Offsets in degrees merely position this diagram on the visible terrain.
  const curve = new T.CatmullRomCurve3([
    new T.Vector3(-.0036, .0066, 0),
    new T.Vector3(-.0056, .0077, 0),
    new T.Vector3(-.0065, .0091, 0),
    new T.Vector3(-.0079, .0105, 0),
    new T.Vector3(-.0098, .0121, 0),
  ]);
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  const rows = 48, cols = 20;
  for (let row = 0; row <= rows; row++) {
    const t = row / rows, point = curve.getPoint(t), tangent = curve.getTangent(t);
    const width = .0013 + .0012 * t;
    for (let col = 0; col <= cols; col++) {
      const u = col / cols, lateral = (2*u - 1)*width;
      const lon = center.lon + point.x + tangent.y*lateral;
      const lat = center.lat + point.y - tangent.x*lateral;
      const ground = terrain.ground(lat, lon)!;
      const local = terrain.toLocal(lon, lat, ground + .012);
      positions.push(local.x, local.y, local.z);
      uv.push(u, t);
      if (row && col) {
        const i = row*(cols+1)+col;
        indices.push(i-cols-2, i-cols-1, i, i-cols-2, i, i-1);
      }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  const material = new T.ShaderMaterial({
    uniforms: { eventTime: { value: 0 } },
    vertexShader,
    fragmentShader: `
      varying vec2 vEventUv; uniform float eventTime;
      void main() {
        float t = vEventUv.y;
        float head = .16 + .95 * smoothstep(.68,.92,eventTime);
        float along = smoothstep(0.,.10,t) * (1. - smoothstep(head-.18,head,t))
                      * (1.-smoothstep(.66,1.,t));
        float x = vEventUv.x*2.-1.;
        float soft = exp(-4.*x*x);
        float strands = .5+.5*cos(13.*x + sin(8.*t - 4.*eventTime));
        float opacity = along * soft * (.35 + .37*strands) * (1.-.32*t);
        if (opacity < .025) discard;
        gl_FragColor = vec4(mix(vec3(.48,.29,.61),vec3(.76,.60,.85),strands),opacity);
        #include <colorspace_fragment>
      }
    `,
    transparent: true, depthWrite: false, side: T.DoubleSide, toneMapped: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const mesh = new T.Mesh(geometry, material);
  mesh.renderOrder = 5;
  return mesh;
}

export class NyosEvent {
  readonly group = new T.Group();
  private readonly flow;
  private readonly waves;
  private readonly relief;
  private readonly bubbles;
  private readonly bubblePose = new T.Object3D();
  private readonly z: number;
  private readonly depth: number;
  private lastTime = -1;
  private lastAnalysis = false;

  constructor(terrain: NyosTerrain, section: NyosSection) {
    this.z = T.MathUtils.lerp(section.start, section.end, .52);
    this.depth = section.depthAt(this.z) * .88;
    this.flow = risingWater(this.depth, this.z);
    this.waves = surfaceWaves(this.z);
    this.relief = reliefIllustration(terrain);
    this.bubbles = new T.InstancedMesh(
      new T.SphereGeometry(1, 12, 8),
      new T.ShaderMaterial({
        vertexShader: `
          varying vec3 bubbleNormal; varying vec3 toEye;
          void main(){
            vec4 p=modelViewMatrix*instanceMatrix*vec4(position,1.);
            bubbleNormal=normalize(normalMatrix*mat3(instanceMatrix)*normal);
            toEye=-p.xyz;
            gl_Position=projectionMatrix*p;
          }`,
        fragmentShader: `
          varying vec3 bubbleNormal; varying vec3 toEye;
          void main(){
            vec3 n=normalize(bubbleNormal);
            float rim=1.-smoothstep(.10,.72,abs(dot(n,normalize(toEye))));
            float lit=smoothstep(-.36,.30,dot(n,normalize(vec3(-.55,.85,.12))));
            float glint=pow(max(0.,dot(n,normalize(vec3(-.43,.58,.69)))),19.);
            vec3 edge=mix(vec3(.015,.08,.085),vec3(.90,.98,.84),lit);
            vec3 color=mix(vec3(.12,.43,.43),edge,rim);
            gl_FragColor=vec4(mix(color,vec3(.96,1.,.90),glint),clamp(.27+.73*rim+.70*glint,0.,1.));
            #include <colorspace_fragment>
          }`,
        transparent: true, depthWrite: false, toneMapped: false,
      }), 16,
    );
    this.bubbles.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.bubbles.frustumCulled = false;
    this.bubbles.renderOrder = 5;
    this.group.name = "Nyos · historisch orientiertes Erklärungsmodell";
    this.group.add(this.flow, this.bubbles, this.waves, this.relief);
    this.update(0, false, false);
  }

  update(progress: number, analysis: boolean, active: boolean) {
    this.group.visible = active;
    const t = active ? clamp(progress, 0, 1) : 0;
    if (t === this.lastTime && analysis === this.lastAnalysis) return;
    this.lastTime = t;
    this.lastAnalysis = analysis;
    this.flow.visible = t >= .17 && t < .68;
    this.bubbles.visible = t >= .33 && t < .68;
    this.waves.visible = t >= .53 && t < .79;
    this.relief.visible = analysis && t >= .68;
    this.flow.material.uniforms.eventTime.value = t;
    this.waves.material.uniforms.eventTime.value = t;
    this.relief.material.uniforms.eventTime.value = t;
    this.bubbles.count = this.bubbles.visible
      ? Math.min(16, 1 + Math.floor((t-.33) * 90)) : 0;
    // Each mark starts in shallower water and is advected upwards. Even at the
    // start of exsolution the deep, quiet water remains free of bubble symbols.
    const rise = t - .33;
    for (let i = 0; i < this.bubbles.count; i++) {
      const age = (rise * (3.8 + .13*(i%4)) + i*.381966) % 1;
      const phase = i * 2.39996;
      const radius = .0064 + .0050*age;
      const spread = (.042 + .070*age) * Math.sin(phase + age);
      const reach = .28 + .72 * smooth(clamp(rise / .20, 0, 1));
      const y = T.MathUtils.lerp(-this.depth*.41, -.007, age * reach);
      this.bubblePose.position.set(.0028, y, this.z+spread);
      this.bubblePose.scale.setScalar(radius);
      this.bubblePose.updateMatrix();
      this.bubbles.setMatrixAt(i, this.bubblePose.matrix);
    }
    if (this.bubbles.count) this.bubbles.instanceMatrix.needsUpdate = true;
  }

  diagnostics() {
    return {
      risingWater: this.group.visible && this.flow.visible,
      freeBubbles: this.group.visible ? this.bubbles.count : 0,
      surfaceRelease: this.group.visible && this.waves.visible,
      reliefAnalysis: this.group.visible && this.relief.visible,
    };
  }
}
