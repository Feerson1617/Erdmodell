import * as T from "three";
import { Stage, vec } from "./stage";
import { surface } from "./geology";
import { ramp } from "./volcanism";
import { specimen, randomSequence } from "../observatory/local-plants";

import { bursts, excavation, shoreRadius, surfaceHeight } from "./maar-profile";
function relief(x: number, z: number, t: number) {
  return surfaceHeight(x, z, excavation(t));
}
export function maar(s: Stage) {
  const dry = s.view === "dryMaar";
  s.look(4.1, 4.7, 12, -0.57);
  s.halfWidth = 5.85;
  s.halfHeight = 3.25;
  s.duration = 26;
  const top = surface(
    s,
    90,
    44,
    (u, v) => vec((u - 0.5) * 10, 0, -v * 4.2),
    0x809252,
    "Gelände",
  );
  const positions = top.geometry.attributes.position,
    shades = top.geometry.attributes.color;
  const grass = new T.Color(0x809252),
    ash = new T.Color(0x99816b),
    rock = new T.Color(0x736657),
    tint = new T.Color();
  let previous = -1;
  s.animate((t) => {
    const p = excavation(t);
    if (previous === p) return;
    previous = p;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i),
        z = positions.getZ(i),
        r = Math.hypot(x * 0.92, z * 1.08),
        rim = 0.72 + 1.67 * Math.sqrt(p);
      const ashCover =
        p * (1 - T.MathUtils.smoothstep(r, rim + 0.25, rim + 0.95));
      tint
        .copy(grass)
        .lerp(ash, ashCover)
        .lerp(rock, ashCover * (1 - T.MathUtils.smoothstep(r, 0.6, rim)));
      tint.multiplyScalar(0.94 + 0.06 * Math.sin(x * 22 + z * 17));
      shades.setXYZ(i, tint.r, tint.g, tint.b);
    }
    shades.needsUpdate = true;
  });
  const deform = (
    mesh: T.Mesh,
    fn: (x: number, y: number, z: number, t: number) => number,
  ) => {
    const a = mesh.geometry.getAttribute("position") as T.BufferAttribute,
      base = a.array.slice();
    let last = -1;
    s.animate((t) => {
      const p = excavation(t);
      if (last === p) return;
      last = p;
      for (let i = 0; i < a.count; i++)
        a.setY(i, fn(base[i * 3], base[i * 3 + 1], base[i * 3 + 2], t));
      a.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
      mesh.frustumCulled = false;
    });
  };
  deform(top, (x, _y, z, t) => relief(x, z, t));
  const random = randomSequence(1403);
  const strata = [-3.15, -2.27, -1.72, -1.3, -0.91, -0.48, 0];
  const tones = [0x625446, 0x897460, 0x756e60, 0x887d69, 0xa88a68, 0x896d50];
  for (let k = 0; k < tones.length; k++) {
    const wall = surface(
      s,
      90,
      3,
      (u, v) =>
        vec(10 * u - 5, T.MathUtils.lerp(strata[k], strata[k + 1], v), 0.002),
      tones[k],
      "Gesteinshorizont",
    );
    deform(
      wall,
      (x, y, _z, t) =>
        Math.min(
          y + 0.09 * Math.sin(1.3 * x + y) * Math.min(1, -y),
          relief(x, 0, t),
        ) + (y === 0 ? Math.max(0, relief(x, 0, t)) : 0),
    );
  }
  // Discontinuous pores and joint fillings leave the host rock visible.
  for (let i=0;i<92;i++){
    const x=random()*9.9-4.95,y=-1.32+random()*.31;
    const pore=s.dot(vec(x,y+.06*Math.sin(x),.027),0x5595a1,.022+random()*.022,"Wasser im Porenraum");
    pore.scale.set(1.7,.8,.45);
    s.animate(t=>{pore.visible=pore.position.y<relief(x,0,t)-.02;});
  }
  for(const x of [-3.5,-2.1,2.25,3.65]){
    s.line([vec(x,-1.28,.04),vec(x+.13,-1.15,.04),vec(x+.1,-1.04,.04),vec(x+.23,-.97,.04)],0x78aeb2,"Wasser in einer Kluft");
  }
  // The breccia body and feeder remain below the advancing crater floor.
  const fill = surface(
    s,
    40,
    16,
    (u, v) => vec((2 * u - 1) * (0.15 + 1.55 * v), -3.1 + v * 2.2, 0.024),
    0x79685b,
    "Diatremfüllung",
  );
  s.animate((t) => {
    const p = excavation(t);
    fill.visible = t > 0.34;
    const a = fill.geometry.attributes.position;
    for (let j = 0; j <= 16; j++)
      for (let i = 0; i <= 40; i++) {
        const v = j / 16,
          x = (i / 20 - 1) * (0.15 + 1.55 * v) * (0.2 + 0.8 * p);
        a.setXYZ(
          j * 41 + i,
          x,
          T.MathUtils.lerp(-3.1, surfaceHeight(x, 0, p) - 0.08, v),
          0.025,
        );
      }
    a.needsUpdate = true;
  });
  const feeder = s.mesh(
    new T.TubeGeometry(
      new T.CatmullRomCurve3([
        vec(-0.5, -3.12, 0.075),
        vec(-0.28, -2.4, 0.075),
        vec(-0.36, -1.78, 0.075),
        vec(0.03, -1.16, 0.075),
      ]),
      30,
      0.072,
      8,
      false,
    ),
    0xe27749,
    "Magma",
  );
  s.animate((t) => {
    feeder.geometry.setDrawRange(0, Math.floor(30 * ramp(t, 0.03, 0.3)) * 48);
    feeder.visible = t < 0.77;
  });
  const debris = Array.from({ length: 65 }, (_, i) => ({
    o: s.mesh(
      new T.DodecahedronGeometry(0.026 + random() * 0.055),
      i % 4 ? 0xac9276 : 0x4e4942,
      "Auswurf",
    ),
    speed: 1.7 + random() * 1.4,
    angle: random() * Math.PI,
    delay: random() * 0.027,
    h: 1.1 + random() * 2.3,
  }));
  s.animate((t) =>
    debris.forEach(({ o, speed, angle, delay, h }) => {
      const start = bursts.filter((b) => b <= t - delay).at(-1) ?? 1;
      const u = (t - start - delay) / 0.105;
      o.visible = u>=0&&u<=1;
      if(o.visible){
        const x=Math.cos(angle)*speed,z=-Math.sin(angle)*speed;
        const y=T.MathUtils.lerp(relief(0,0,start),relief(x,z,start+.105),u)+h*4*u*(1-u);
        o.position.set(x*u,y,z*u);
      }
    }),
  );
  const clasts=new T.InstancedMesh(new T.DodecahedronGeometry(1),new T.MeshStandardMaterial({color:0xb19478,roughness:1}),160);
  const transform=new T.Object3D();clasts.count=0;s.scene.add(clasts);clasts.frustumCulled=false;
  const fragments=Array.from({length:160},(_,i)=>{
    const angle=random()*Math.PI, radius=1.65+.2*Math.floor(i/40)+random()*.60;
    return {x:radius*Math.cos(angle),z:-radius*Math.sin(angle),size:.035+random()*.065};
  });
  s.animate(t=>{
    clasts.count=bursts.reduce((n,b)=>n+Math.floor(40*ramp(t,b+.045,b+.105)),0);
    for(let i=0;i<clasts.count;i++){
      const {x,z,size}=fragments[i];transform.position.set(x,relief(x,z,t)+size*.32,z);
      transform.scale.set(size,size*.58,size*.84);transform.rotation.set(i*.61,i*.2,i*.31);transform.updateMatrix();clasts.setMatrixAt(i,transform.matrix);
    }
    clasts.instanceMatrix.needsUpdate=true;
  });
  const breccia=s.mesh(new T.DodecahedronGeometry(.10),0xa49a86,"Brekzienfragment");
  for(let i=0;i<30;i++){
    const v=.1+.78*random(),fraction=(random()-.5)*1.5,o=i?breccia.clone():breccia;
    if(i)s.scene.add(o);
    o.rotation.z=random()*3;o.scale.set(.6+random(),.6+random()*.65,.44);
    s.animate(t=>{const p=excavation(t),x=fraction*(.15+1.55*v)*(.2+.8*p);o.visible=t>.4+i*.008;o.position.set(x,T.MathUtils.lerp(-3.1,surfaceHeight(x,0,p)-.1,v),.06);});
  }
  const trees = specimen("oak", 55, true);
  for (let i = 0; i < 36; i++) {
    const x = random() * 10 - 5,
      z = -random() * 4;
    if (Math.hypot(x, z) < 3.1) continue;
    const o = s.mesh(trees, 0xffffff, "Waldrand");
    (o.material as T.MeshStandardMaterial).vertexColors = true;
    o.scale.setScalar(0.065 + random() * 0.04);
    o.rotation.y = random() * 6;
    o.position.set(x, relief(x, z, 0), z);
  }
  const lake = surface(
    s,
    78,
    12,
    (u, v) => vec(Math.cos(u * Math.PI) * v, 0, -Math.sin(u * Math.PI) * v),
    0x358b9a,
    "Späterer Maarsee",
  );
  s.animate((t) => {
    const p = ramp(t, 0.78, 0.98);
    lake.visible = !dry && p > 0;
    if(!lake.visible)return;
    const level=T.MathUtils.lerp(surfaceHeight(0,0,1)+.001,-.74,p);
    const attr=lake.geometry.attributes.position;
    for(let i=0;i<=78;i++){
      const angle=i*Math.PI/78,r=shoreRadius(angle,level);
      for(let j=0;j<=12;j++){
        const d=r*j/12;attr.setXYZ(j*79+i,Math.cos(angle)*d,level,-Math.sin(angle)*d);
      }
    }
    attr.needsUpdate=true;lake.frustumCulled=false;
  });
  const lakeMat=lake.material as T.MeshStandardMaterial;lakeMat.roughness=.25;lakeMat.metalness=.10;
  s.label(vec(-2.8, -1.1, 0.04), "Grundwasserleiter");
  s.label(
    vec(0, -1.0, 0.1),
    "Kontaktzone",
    "Magma und Grundwasser",
    (t) => t > 0.2 && t < 0.51,
  );
  s.label(
    vec(2.55, 0.52, 0),
    "Tuffwall",
    "abgelagertes Auswurfmaterial",
    (t) => t > 0.6,
  );
  s.label(
    vec(0, -2.55, 0.1),
    "Diatrem",
    "mit Bruchstücken gefüllter Explosionsschlot",
    (t) => t > 0.64,
  );
  s.explain((t) =>
    t < 0.28
      ? "Magma steigt unter der ursprünglichen Geländeoberfläche in wasserführende Schichten."
      : t < 0.76
        ? "Ausgeworfenes Gestein baut den Tuffwall auf. Wiederholte Explosionen und Einbrüche vertiefen den Krater."
        : dry
          ? "Ein Maar kann trocken bleiben oder später verlanden."
          : "Nach der Eruption kann sich Wasser im Krater sammeln. Gezeigt ist eine spätere Entwicklungsphase.",
  );
}
