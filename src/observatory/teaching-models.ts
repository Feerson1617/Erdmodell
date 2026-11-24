import * as T from "three";
import type { RegionalScene, Theme } from "./regional";

type Explanation={name:string;answer:string};
const text:Record<string,Explanation>={
  crust:{name:"Erdkruste",answer:"Die Kruste ist die äußerste Schicht. Sie ist unter dem Meer meist dünner als unter einem Kontinent."},
  rigid:{name:"Starrer oberster Mantel",answer:"Auch ein Teil des Erdmantels gehört zur starren Außenhülle. Zusammen mit der Kruste bildet er die Lithosphäre."},
  mantle:{name:"Langsam verformbarer Mantel",answer:"Das heiße Gestein ist überwiegend fest. Über sehr lange Zeit kann es sich verformen."},
  heat:{name:"Wärme aus dem Erdinneren",answer:"Wärme steigt mit heißem Gestein langsam auf. Die Stärke und Richtung dieser Bewegung ist nicht überall gleich."},
  pull:{name:"Zug der absinkenden Platte",answer:"Kalte, dichte Lithosphäre sinkt ab. Ihr Gewicht kann einen weiteren Teil der Platte mitziehen."},
  ridge:{name:"Kraft am Rücken",answer:"Die junge, warme Lithosphäre liegt am Rücken höher. Die Schwerkraft begünstigt eine Bewegung vom Rücken weg."},
  stripe:{name:"Magnetstreifen",answer:"Beim Abkühlen richten sich magnetische Minerale nach dem damaligen Feld aus. Beide Seiten tragen so ein ähnliches Muster."},
  fluid:{name:"Wasserhaltige Fluide",answer:"Aus der abtauchenden Platte treten wasserhaltige Stoffe aus. Gestein im Mantel darüber kann dadurch leichter teilweise schmelzen."},
  melt:{name:"Magma",answer:"Gesteinsschmelze im Erdinneren heißt Magma. Sie kann aufsteigen und sich in einem Reservoir sammeln."},
  chamber:{name:"Magmareservoir",answer:"In einem Bereich unter dem Vulkan sammelt sich Schmelze zwischen Kristallen und festem Gestein."},
  lava:{name:"Lava und Eruption",answer:"Erreicht Magma die Oberfläche, heißt es Lava. Bei einem Ausbruch können auch Gas und Asche austreten."},
  hotspot:{name:"Hotspot",answer:"An dieser Stelle steigt heißes Material auf. Während die Platte weiterwandert, können nacheinander Vulkane entstehen."},
  shelter:{name:"Gebäude",answer:"Bauweise und Untergrund beeinflussen die Folgen. Auch erdbebengerechte Gebäude bieten keinen vollkommenen Schutz."},
  route:{name:"Evakuierungsweg",answer:"Ein erkennbarer Weg zu höherem Gelände hilft, wenn er erreichbar ist und Menschen ihn kennen."},
  marker:{name:"Versetzte Geländelinie",answer:"Die helle Linie dient als Vergleich. Nach dem Beben bleibt ihr Versatz bestehen. Die kurzen Bodenschwingungen klingen ab."}
};
function object(g:T.BufferGeometry,mat:T.Material,id:string){const m=new T.Mesh(g,mat);m.userData.explanation=text[id];return m;}
const chips=(color:number)=>new T.MeshStandardMaterial({color,roughness:.88});
function line(coords:T.Vector3[],color:number,id:string){
  const l=new T.Line(new T.BufferGeometry().setFromPoints(coords),new T.LineBasicMaterial({color}));l.userData.explanation=text[id];return l;
}
function arrow(points:T.Vector3[],color:number,id:string,group:T.Group){
  const c=new T.CatmullRomCurve3(points),tube=object(new T.TubeGeometry(c,32,.033,6,false),chips(color),id);
  const tip=object(new T.ConeGeometry(.12,.31,12),chips(color),id),d=c.getTangent(1);tip.position.copy(c.getPoint(1));tip.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d);
  group.add(tube,tip);return c;
}
const vec=(x:number,y:number,z=.17)=>new T.Vector3(x,y,z);
function ribbon(r:RegionalScene,lo:(x:number)=>number,hi:(x:number)=>number,color:number,id:string){
  const p:number[]=[],indices:number[]=[];
  for(let i=0;i<=120;i++){const x=i/10-6;p.push(x,hi(x),.07,x,lo(x),.07);if(i<120){const n=i*2;indices.push(n,n+1,n+2,n+2,n+1,n+3);}}
  const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(p,3));g.setIndex(indices);g.computeVertexNormals();
  const mat=chips(color);mat.side=T.DoubleSide;const m=object(g,mat,id);r.section.add(m);return m;
}
function flow(r:RegionalScene,c:T.CatmullRomCurve3,color:number,id:string,count:number,start:number,end:number){
  const geo=new T.SphereGeometry(.075,9,7),mat=chips(color);
  const m=new T.InstancedMesh(geo,mat,count);m.userData.explanation=text[id];m.frustumCulled=false;r.section.add(m);
  const dummy=new T.Object3D();r.onAnimate(t=>{const f=T.MathUtils.clamp((t-start)/(end-start),0,1);m.visible=t>=start&&t<=end;
    for(let i=0;i<count;i++){const k=(f*1.9+i/count)%1;dummy.position.copy(c.getPoint(k));dummy.scale.setScalar(.6+.35*Math.sin(k*Math.PI));dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);}m.instanceMatrix.needsUpdate=true;});
}
function mantle(r:RegionalScene){
  const h=(x:number)=>r.height(x,0),base=(x:number)=>h(x)-.33,lower=(x:number)=>base(x)-.65;
  ribbon(r,base,h,0xb5a47c,"crust");ribbon(r,lower,base,0x758a83,"rigid");ribbon(r,x=>lower(x)-2.8,lower,0xb6795d,"mantle");
  if(r.spec.theme==="lithosphere")return;
  const curves:[[T.Vector3,T.Vector3,T.Vector3],number,string][]=[
    [[vec(-2.5,-2.7),vec(-3,-1.6),vec(-2.65,-.82)],0xe9b477,"heat"],
    [[vec(-2.5,-.48),vec(-1.8,-.54),vec(-.85,-.65)],0xa9ceb5,"ridge"],
    [[vec(.6,-.6),vec(1.5,-1.23),vec(2.25,-2.45)],0x9ac7cc,"pull"]];
  for(const [pts,color,id] of curves){const c=arrow(pts,color,id,r.section);flow(r,c,color,id,6,0,1);}
}
function magnetic(r:RegionalScene){
  const palette=[chips(0xb6c3a9),chips(0x555e5d)],widths=[.35,.16,.49,.26,.62,.22,.35,.52];
  for(const sign of [-1,1]){let cursor=0;for(let i=0;i<widths.length;i++){
    const w=widths[i],x=sign*(cursor+w/2);cursor+=w;
    const stripe=object(new T.BoxGeometry(w,.11,1.3),palette[i%2],"stripe");r.scene.add(stripe);
    r.onAnimate(t=>{const dx=x+sign*t*.8;stripe.position.set(dx,r.height(dx,-.7)+.09,-.7);});}
    const fresh=object(new T.BoxGeometry(1,.095,1.3),palette[0],"stripe");r.scene.add(fresh);r.onAnimate(t=>{fresh.scale.x=Math.max(.002,t*.8);fresh.position.set(sign*t*.4,r.height(0,-.7)+.075,-.7);});
  }
  flow(r,new T.CatmullRomCurve3([vec(.1,-1.7),vec(-.1,-.7),vec(0,r.height(0,0))]),0xeeb68a,"melt",8,.01,1);
}
function volcano(r:RegionalScene){
  const k=r.spec.process,vent=k==="subduction"||k==="arc"?-2.7:0,top=r.height(vent,0);
  if(k==="subduction"||k==="arc")flow(r,new T.CatmullRomCurve3([vec(-2,-2.35),vec(-2.17,-1.85),vec(-2.7,-1.45)]),0x8bd2d7,"fluid",7,.04,.61);
  const plume=new T.CatmullRomCurve3([vec(vent+.2,-2.45),vec(vent-.17,-1.64),vec(vent,-.93),vec(vent,top+.03)]);
  flow(r,plume,0xf2ad6c,k==="hotspot"?"hotspot":"melt",15,.12,.93);
  const reservoir=object(new T.IcosahedronGeometry(1,2),chips(0xb76d49),"chamber");reservoir.position.set(vent,-.98,.16);r.section.add(reservoir);
  const cone=object(new T.ConeGeometry(.58,.65,40),chips(0x655d4d),"lava");r.scene.add(cone);
  r.onAnimate(t=>{const f=T.MathUtils.smoothstep(t,.4,.95);reservoir.scale.set(.34+.28*f,.11+.075*f,.075);cone.scale.set(.85+.3*f,.1+.9*f,.85+.3*f);
    cone.position.set(vent,top+cone.scale.y*.325,-.08);});
  const lava=line(Array.from({length:28},(_,i)=>vec(vent+i/60,top+.63-i*.022,-.12+i*.008)),0xf4a16a,"lava");r.scene.add(lava);r.onAnimate(t=>{lava.visible=t>.67;lava.geometry.setDrawRange(0,Math.floor(28*T.MathUtils.smoothstep(t,.67,.94)));});
  if(k==="hotspot"){
    for(let i=0;i<5;i++){const mound=object(new T.ConeGeometry(.5,.68,32),chips(0x698063),"hotspot");r.scene.add(mound);r.onAnimate(t=>{const age=t*4.4-i;mound.visible=age>=0;
      const z=-1.4+Math.max(0,age)*1.16,x=.32*Math.sin(age),f=T.MathUtils.clamp(age*2.7,.03,1);mound.scale.setScalar(f);mound.position.set(x,r.height(x,z)+.33*f,z);});}
  }
}
function settlements(r:RegionalScene){
  const walls=chips(0xd8cbb1),roof=chips(0x805643),brace=chips(0x508980);
  const wallGeo=new T.BoxGeometry(.20,.28,.2),roofGeo=new T.ConeGeometry(.18,.105,4),braceGeo=new T.BoxGeometry(.027,.33,.025);
  const buildings:T.Group[]=[],baseX:number[]=[];
  for(let i=0;i<30;i++){
    const col=i%6,row=Math.floor(i/6);const x=-3.4+col*1.23,z=-2.02+row*.72;
    const g=new T.Group();g.userData.explanation=text.shelter;g.position.set(x,r.height(x,z),z);
    const wall=object(wallGeo,walls,"shelter"),cap=object(roofGeo,roof,"shelter");wall.position.y=.14;cap.position.y=.33;cap.rotation.y=Math.PI/4;
    const beam=object(braceGeo,brace,"shelter");beam.position.set(0,.15,.105);beam.rotation.z=.48;g.add(wall,cap,beam);r.settlement.add(g);buildings.push(g);baseX.push(x);
  }
  const route=line(Array.from({length:28},(_,i)=>{const x=1-i*.16,z=-1.1+Math.sin(i/7)*.38;return vec(x,r.height(x,z)+.14,z);}),0xffde72,"route");r.settlement.add(route);
  const beacon=object(new T.ConeGeometry(.12,.45,6),chips(0xe3a349),"route");beacon.position.set(1,r.height(1,-1.1)+.22,-1.1);r.settlement.add(beacon);
  const walkers=new T.InstancedMesh(new T.SphereGeometry(.045,6,5),chips(0xf5d78a),10);r.settlement.add(walkers);const dummy=new T.Object3D();
  r.onAnimate(t=>{route.visible=r.safeRoute&&r.exposure!=="empty";beacon.visible=r.warning&&r.exposure!=="empty";walkers.visible=route.visible&&r.warning;
    for(let i=0;i<10;i++){const phase=T.MathUtils.clamp((t-.38)*1.8+i*.026,0,1),x=1-phase*4.32,z=-1.1+Math.sin(phase*27/7)*.38;dummy.position.set(x,r.height(x,z)+.17,z);dummy.updateMatrix();walkers.setMatrixAt(i,dummy.matrix);}walkers.instanceMatrix.needsUpdate=true;
    buildings.forEach((g,i)=>{g.position.x=r.relocate?baseX[i]*.62-1.7:baseX[i];g.position.y=r.height(g.position.x,g.position.z);
    const x=g.position.x;g.visible=r.exposure==="dense"||(r.exposure==="sparse"&&i%5===0);g.children[2].visible=r.protection;
    const rel=(t-.42)*17.-Math.abs(x)*.69,shaking=rel>0?Math.sin(rel*13)*Math.exp(-rel*1.22):0;
    const ground=x>0?1.65:.77;g.rotation.z=shaking*.13*ground*(r.protection?.44:1);});});
}
function witness(r:RegionalScene){
  for(const s of [-1,1]){
    const p=Array.from({length:40},(_,i)=>{const x=s*(i/13+.012),z=-.80+.07*Math.sin(x*2);return vec(x,r.height(x,z)+.022,z);});
    const seam=line(p,0xe7dfae,"marker");r.witnesses.add(seam);
    r.onAnimate(t=>{const vals=seam.geometry.attributes.position as T.BufferAttribute;
      for(let i=0;i<p.length;i++){const pt=p[i],y=r.height(pt.x,pt.z),d=r.faultModel.offset(r.deformed,pt.x,y,pt.z,s,t);vals.setXYZ(i,pt.x+d.x,y+.025+d.y,pt.z+d.z);}vals.needsUpdate=true;});
  }
}
export function addTeachingModels(r:RegionalScene){
  r.extraBuilder=()=>{
    switch(r.spec.theme){
      case "forces":case "lithosphere":mantle(r);break;
      case "magnet":magnetic(r);break;
      case "volcano":volcano(r);break;
      case "risk":settlements(r);break;
      case "process":
        if(r.spec.process==="ridge")magnetic(r);
        else if(["subduction","arc"].includes(r.spec.process))volcano(r);
        else if(r.spec.process==="transform"||r.spec.process==="oceanTransform")witness(r);
        r.reframe(true);break;
      case "earthquake":if(r.spec.process==="transform")witness(r);break;
    }
    if(["forces","lithosphere","magnet","volcano"].includes(r.spec.theme))r.reframe(true);
  };
}
export const topicNames:Record<Theme,string>={process:"Tektonischer Prozess",earthquake:"Erdbeben",volcano:"Vulkanismus",risk:"Naturrisiken und Schutz",forces:"Antrieb der Platten",lithosphere:"Äußere Erde im Detail",magnet:"Magnetstreifen"};
export const explanations=text;
