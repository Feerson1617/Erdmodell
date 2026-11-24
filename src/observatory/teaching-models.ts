import zao from "./zao.json";
import {eruption} from "./eruption";
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
  if(r.spec.theme==="lithosphere"){ribbon(r,base,h,0xb5a47c,"crust");ribbon(r,lower,base,0x758a83,"rigid");ribbon(r,x=>lower(x)-2.8,lower,0xb6795d,"mantle");return;}
  const curves:[[T.Vector3,T.Vector3,T.Vector3],number,string][]=[
    [[vec(-2.5,-2.7),vec(-3,-1.6),vec(-2.65,-.82)],0xe9b477,"heat"],
    [[vec(-2.5,-.48),vec(-1.8,-.54),vec(-.85,-.65)],0xa9ceb5,"ridge"],
    [[vec(.6,r.faultModel.interfaceY(.6)-.16),vec(1.5,r.faultModel.interfaceY(1.5)-.16),vec(2.7,r.faultModel.interfaceY(2.7)-.16)],0x9ac7cc,"pull"]];
  for(const [pts,color,id] of curves){const c=arrow(pts,color,id,r.section);flow(r,c,color,id,6,0,1);}
}
function magnetic(r:RegionalScene){
  const materials=[chips(0xc1b698),chips(0x495c66)];
  // Each strip freezes the field polarity at birth. New material appears on both sides of x=0.
  const intervals=[[-1,-.65],[-.65,-.42],[-.42,0],[0,.14],[.14,.43],[.43,.53],[.53,.82],[.82,1]];
  for(const sign of [-1,1])for(const [i,[birth,end]] of intervals.entries()){
    const band=object(new T.BoxGeometry(1,.10,1.0),materials[i%2],"stripe");r.scene.add(band);
    r.onAnimate(t=>{const young=Math.max(0,t-end)*2.5,old=(t-birth)*2.5;band.visible=old>0;
      band.scale.x=Math.max(.001,old-young);const x=sign*(old+young)*.5;
      band.position.set(x,r.height(x,-.55)+.075,-.55);});
  }
  flow(r,new T.CatmullRomCurve3([vec(.1,-1.7),vec(-.1,-.7),vec(0,r.height(0,0))]),0xeeb68a,"melt",8,.01,1);
}
function volcano(r:RegionalScene){
  const k=r.spec.process,f=r.faultModel,vent=r.spec.arcTransect?zao.vent:k==="subduction"||k==="arc"?T.MathUtils.clamp(f.trace+f.dipSign*5.4,-4.8,4.8):0,top=r.height(vent,r.spec.arcTransect?0:-.33);
  if(k==="subduction"||k==="arc")flow(r,new T.CatmullRomCurve3([vec(vent,f.interfaceY(vent)),vec(vent-.11,(f.interfaceY(vent)+top)/2),vec(vent,top-.93)]),0x8bd2d7,"fluid",7,.04,.61);
  const plume=new T.CatmullRomCurve3([vec(vent+.2,top-2.15),vec(vent-.17,top-1.47),vec(vent,top-.93),vec(vent,top+.03)]);
  flow(r,plume,0xf2ad6c,k==="hotspot"?"hotspot":"melt",15,.12,.93);
  const reservoir=object(new T.IcosahedronGeometry(1,2),chips(0xb76d49),"chamber");reservoir.position.set(vent,-.98,.16);r.section.add(reservoir);
  reservoir.position.y=top-.91;r.onAnimate(t=>{const f=T.MathUtils.smoothstep(t,.18,.66);reservoir.scale.set(.34+.25*f,.11+.09*f,.095);});
  eruption(r,vent,top);
}
function settlements(r:RegionalScene){
  const walls=chips(0xd8cbb1),roof=chips(0x805643),brace=chips(0x508980);
  const wallGeo=new T.BoxGeometry(.20,.28,.2),roofGeo=new T.ConeGeometry(.18,.105,4),braceGeo=new T.BoxGeometry(.027,.33,.025);
  const buildings:T.Group[]=[],baseX:number[]=[];
  const sediment=object(new T.BoxGeometry(6.8,.27,.56,44,2,4),chips(0xb49b68),"shelter");
  sediment.userData.explanation={name:"Lockerer Untergrund",answer:"Lockere Ablagerungen können die Erschütterung am Standort verstärken."};
  const ground=sediment.geometry.attributes.position;
  for(let i=0;i<ground.count;i++){const x=ground.getX(i),z=ground.getZ(i)+.19;ground.setXYZ(i,x,ground.getY(i)+r.height(x,z)-.15,z);}
  sediment.geometry.computeVertexNormals();r.section.add(sediment);
  for(let i=0;i<30;i++){
    const col=i%6,row=Math.floor(i/6),x=r.spec.coastLesson?-3.6+col*.15:-3.4+col*1.23,z=-2.04+row*.43;
    const g=new T.Group();g.userData.explanation=text.shelter;g.position.set(x,r.height(x,z),z);
    const wall=object(wallGeo,walls,"shelter"),cap=object(roofGeo,roof,"shelter");wall.position.y=.14;cap.position.y=.33;cap.rotation.y=Math.PI/4;
    const beam=object(braceGeo,brace,"shelter");beam.position.set(0,.15,.105);beam.rotation.z=.48;g.add(wall,cap,beam);r.settlement.add(g);buildings.push(g);baseX.push(x);
  }
  const routeStart=r.spec.coastLesson?-3.12:-1.5,routeEnd=r.spec.coastLesson?-5.03:-3.6;
  const way=(t:number)=>{const x=T.MathUtils.lerp(routeStart,routeEnd,t),z=-1.35+.24*Math.sin(t*Math.PI);return vec(x,r.height(x,z)+.09,z);};
  const route=line(Array.from({length:28},(_,i)=>way(i/27)),0xffde72,"route");r.settlement.add(route);
  const beacon=object(new T.ConeGeometry(.12,.45,6),chips(0xe3a349),"route");beacon.position.copy(way(0));beacon.position.y+=.16;r.settlement.add(beacon);
  const walkers=new T.InstancedMesh(new T.SphereGeometry(.052,7,5),chips(0xffdf85),10);r.settlement.add(walkers);const dummy=new T.Object3D();
  const service=object(new T.BoxGeometry(.35,.10,.19),chips(0x5e9771),"shelter");service.userData.explanation={name:"Versorgung wiederherstellen",answer:"Mit Vorbereitung kann die Versorgung nach dem Ereignis früher wieder funktionieren."};service.position.copy(way(1));r.settlement.add(service);
  r.onAnimate(t=>{sediment.visible=r.soil==="loose"&&!r.spec.coastLesson;route.visible=r.safeRoute&&r.exposure!=="empty";beacon.visible=r.warning&&r.exposure!=="empty";walkers.visible=route.visible&&r.warning;
    const available=t<.49||t>(r.warning&&r.safeRoute?.77:.94);service.visible=r.exposure!=="empty";(service.material as T.MeshStandardMaterial).color.setHex(available?0x729f71:0x655d55);
    for(let i=0;i<10;i++){dummy.position.copy(way(T.MathUtils.clamp((t-.36)*2.3+i*.016,0,1)));dummy.updateMatrix();walkers.setMatrixAt(i,dummy.matrix);}walkers.instanceMatrix.needsUpdate=true;
    buildings.forEach((g,i)=>{const x=baseX[i]-(r.relocate&&r.spec.coastLesson?1.55:0),z=g.position.z,h=r.height(x,z);
      const d=r.faultModel.offset(r.deformed,x,h,z,x>r.faultModel.trace?1:-1,t);
      g.position.set(x+d.x,h+d.y,z);g.visible=r.exposure==="dense"||(r.exposure==="sparse"&&i%5===0);
      g.children[2].visible=r.protection;
      g.rotation.z=r.faultModel.shaking(t,x,h,z)*(r.soil==="loose"?2.3:1)*(r.protection?.56:1);
    });
  });
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
