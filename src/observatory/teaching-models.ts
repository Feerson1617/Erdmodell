import {meltingExplanation,meltingSetting} from "./melting";
import {eruption} from "./eruption";
import * as T from "three";
import type { RegionalScene, Theme } from "./regional";

type Explanation={name:string;answer:string};
const text:Record<string,Explanation>={
  crust:{name:"Erdkruste",answer:"Die Kruste ist die äußerste Schicht. Sie ist unter dem Meer meist dünner als unter einem Kontinent."},
  rigid:{name:"Starrer oberster Mantel",answer:"Auch ein Teil des Erdmantels gehört zur starren Außenhülle. Zusammen mit der Kruste bildet er die Lithosphäre."},
  mantle:{name:"Langsam verformbarer Mantel",answer:"Das heiße Gestein ist überwiegend fest. Über sehr lange Zeit kann es sich verformen."},
  coupling:{name:"Wechselwirkung",answer:"Platte und Mantel übertragen Kräfte durch Scherung. Richtung und Bedeutung sind örtlich verschieden."},
  motion:{name:"Mantelbewegung",answer:"Festes Mantelgestein kann sich über Millionen Jahre verformen. Die Pfeile stehen für eine mögliche örtliche Bewegung."},
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
  if(id==="melt"||id==="hotspot"){
    const tube=new T.TubeGeometry(c,64,.024,7,false),mat=new T.MeshStandardMaterial({color,emissive:0xa64219,emissiveIntensity:.32,roughness:.72});
    const vein=object(tube,mat,id);
    vein.userData.explanation={name:text[id].name,answer:meltingExplanation(r.spec.process,r.spec.site)};
    r.section.add(vein);
    r.onAnimate(t=>{const extent=T.MathUtils.smoothstep(t,start,end);vein.visible=extent>0;tube.setDrawRange(0,Math.floor(64*extent)*42);});return;
  }
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
  curves.push([[vec(-1.8,-2.25),vec(-1.25,-1.75),vec(-.6,-1.52)],0x98b2ca,"motion"],[[vec(-1.85,-1.1),vec(-1.24,-1.06),vec(-.65,-1.1)],0xe0d1a6,"coupling"]);
  for(const [index,[pts,color,id]] of curves.entries()){
    const group=new T.Group();r.section.add(group);const c=arrow(pts,color,id,group);
    const first=r.section.children.length;flow(r,c,color,id,6,0,1);
    group.add(...r.section.children.slice(first));
    r.onAnimate(()=>{group.visible=Boolean((r.forceLayers??31)&(1<<index));});
  }
}
function magnetic(r:RegionalScene){
  const materials=[chips(0xc1b698),chips(0x495c66)];
  // Each strip freezes the field polarity at birth. New material appears on both sides of x=0.
  const intervals=[[-1,-.65],[-.65,-.42],[-.42,0],[0,.14],[.14,.43],[.43,.53],[.53,.82],[.82,1]];
  if(r.spec.theme==="magnet")for(const sign of [-1,1])for(const [i,[birth,end]] of intervals.entries()){
    const geometry=new T.PlaneGeometry(1,1,8,8),pos=geometry.attributes.position;
    const band=object(geometry,materials[i%2],"stripe");band.frustumCulled=false;r.scene.add(band);
    r.onAnimate(t=>{const young=Math.max(0,t-end)*.65,old=(t-birth)*.65;band.visible=old>0;
      if(!band.visible)return;
      for(let k=0;k<pos.count;k++){const x=sign*T.MathUtils.lerp(young,old,k%9/8),z=-1+Math.floor(k/9)/8;
        const source=sign*Math.max(0,Math.abs(x)-.65*t);
        pos.setXYZ(k,x,r.height(source,z)+.006,z);}
      pos.needsUpdate=true;geometry.computeVertexNormals();});
  }
  if(r.spec.theme==="process"){
    const top=r.height(0,0);
    for(const sign of [-1,1]){
      const path=new T.CatmullRomCurve3([vec(sign*.12,top-3.2),vec(sign*.15,top-2.35),vec(sign*.32,top-1.75),vec(sign*.74,top-1.48)]);
      flow(r,path,0xc2a783,"mantle",4,0,1);
    }
  }
  flow(r,new T.CatmullRomCurve3([vec(.1,T.MathUtils.lerp(r.height(0,0),-5.8,.74)),vec(-.1,-.7),vec(0,r.height(0,0))]),0xeeb68a,"melt",8,.01,1);
}
function volcano(r:RegionalScene){
  const setting=meltingSetting(r.spec.process,r.spec.site);
  if(setting==="uncertain")return;
  const k=r.spec.process,f=r.faultModel,vent=r.volcanicVentX,top=r.height(vent,r.spec.arcTransect?0:-.33);
  // In a subduction section the crust ends 0.65 model units below the surface.
  // Fluids leave the slab. The melt path starts above it, inside the mantle wedge.
  const slab=f.interfaceY(vent),sectionTop=r.height(vent,0);
  const sourceY=setting==="arc"?T.MathUtils.lerp(slab,sectionTop-.65,.48):T.MathUtils.lerp(sectionTop,-5.8,.74);
  const source=vec(vent,sourceY);
  if(setting==="arc"){
    const fluids=new T.CatmullRomCurve3([vec(vent,slab),vec(vent-.07,(slab+sourceY)/2),source]);
    flow(r,fluids,0x8bd2d7,"fluid",7,.04,.61);
  }
  const plume=new T.CatmullRomCurve3([source,vec(vent-.12,T.MathUtils.lerp(sourceY,top-.65,.5)),vec(vent,top-.65),vec(vent,top+.03)]);
  flow(r,plume,0xf2ad6c,k==="hotspot"?"hotspot":"melt",15,.12,.53);
  const lenses=new T.Group();lenses.position.set(vent,top-.91,.075);r.section.add(lenses);
  const mush=chips(0x786157),melt=chips(0xb98269);
  for(const m of [mush,melt]){
    m.onBeforeCompile=s=>{s.vertexShader="varying vec3 inclusion;\n"+s.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\ninclusion=position;");
      s.fragmentShader="varying vec3 inclusion;\n"+s.fragmentShader.replace("#include <color_fragment>","#include <color_fragment>\nvec3 p=inclusion*vec3(8.,12.,5.);float seams=abs(sin(p.y+1.6*sin(p.x*.8)+p.z)*cos(p.x*1.3-p.y*.4));float light=1.-smoothstep(.06,.24,seams);diffuseColor.rgb=mix(diffuseColor.rgb*.78,vec3(.72,.24,.064),light*.49);");};
  }
  for(let i=0;i<21;i++){
    const a=i*2.399,size=.125+.08*(1+Math.sin(3.2*i)),lens=object(new T.IcosahedronGeometry(1,1),i%3?mush:melt,"chamber");
    const p=lens.geometry.attributes.position;for(let j=0;j<p.count;j++){const k=1+.21*Math.sin(3.6*p.getX(j)+7*p.getZ(j)+i)*Math.cos(4*p.getY(j));p.setXYZ(j,p.getX(j)*k,p.getY(j)*k,p.getZ(j)*k);}lens.geometry.computeVertexNormals();
    lens.position.set(.27*Math.cos(a)*Math.sqrt(i/21),.12*Math.sin(a),.025*Math.cos(a));lens.scale.set(size*1.42,.044+.03*Math.cos(i)**2,.049);lens.rotation.z=.35*Math.sin(a*2);lenses.add(lens);
  }
  for(const sign of [-1,1]){
    const path=new T.CatmullRomCurve3([vec(0,0),vec(sign*.17,.11),vec(sign*.20,.29),vec(sign*.36,.44)]);
    const dike=object(new T.TubeGeometry(path,18,.013,5,false),melt,"chamber");lenses.add(dike);
  }
  r.onAnimate(t=>{const filled=.62+.38*T.MathUtils.smoothstep(t,.18,.66);lenses.scale.set(filled,filled,1);});
  for(let i=0;i<4;i++){
    const x=(i-1.5)*.17;
    const path=new T.CatmullRomCurve3([vec(x*.24,.02),vec(x,.25),vec(x*.58,.52),vec(.055*Math.sin(i),.78),vec(0,.91)]);
    lenses.add(object(new T.TubeGeometry(path,26,.007+i*.0015,5,false),melt,"melt"));
  }
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
    const beam=object(braceGeo,brace,"shelter");beam.userData.explanation={name:"Erdbebengerechte Bauweise",answer:"Verstrebungen können ein Gebäude bei Erschütterungen stabilisieren."};beam.position.set(0,.15,.105);beam.rotation.z=.48;g.add(wall,cap,beam);r.settlement.add(g);buildings.push(g);baseX.push(x);
  }
  const routeStart=r.spec.coastLesson?-3.12:-1.5,routeEnd=r.spec.coastLesson?-5.03:-3.6;
  const way=(t:number)=>{const x=T.MathUtils.lerp(routeStart,routeEnd,t),z=-1.35+.24*Math.sin(t*Math.PI);return vec(x,r.height(x,z)+.09,z);};
  const route=line(Array.from({length:28},(_,i)=>way(i/27)),0xffde72,"route");r.settlement.add(route);
  const beacon=object(new T.ConeGeometry(.12,.45,6),chips(0xe3a349),"route");beacon.userData.explanation={name:"Warnsystem",answer:"Eine rechtzeitige Warnung hilft, wenn Menschen sie erhalten und den Fluchtweg kennen."};beacon.position.copy(way(0));beacon.position.y+=.16;r.settlement.add(beacon);
  const walkers=new T.InstancedMesh(new T.SphereGeometry(.052,7,5),chips(0xffdf85),10);walkers.name="Gefährdete Menschen";r.settlement.add(walkers);const dummy=new T.Object3D();
  const service=object(new T.BoxGeometry(.35,.10,.19),chips(0x5e9771),"shelter");service.userData.explanation={name:"Versorgung wiederherstellen",answer:"Mit Vorbereitung kann die Versorgung nach dem Ereignis früher wieder funktionieren."};service.position.copy(way(1));r.settlement.add(service);
  r.onAnimate(t=>{sediment.visible=r.soil==="loose"&&!r.spec.coastLesson;route.visible=r.safeRoute&&r.exposure!=="empty";beacon.visible=r.warning&&r.exposure!=="empty";walkers.visible=route.visible&&r.warning;
    const available=t<.49||t>(r.warning&&r.safeRoute?.77:.94);service.visible=r.exposure!=="empty";(service.material as T.MeshStandardMaterial).color.setHex(available?0x729f71:0x655d55);
    for(let i=0;i<10;i++){dummy.position.copy(way(T.MathUtils.clamp((t-.36)*2.3+i*.016,0,1)));dummy.updateMatrix();walkers.setMatrixAt(i,dummy.matrix);}walkers.instanceMatrix.needsUpdate=true;
    buildings.forEach((g,i)=>{const x=baseX[i]+(!r.spec.coastLesson&&r.riskSite==="far"?1.35:0)-(r.relocate&&r.spec.coastLesson?1.55:0),z=g.position.z,h=r.height(x,z);
      const d=r.faultModel.offset(r.deformed,x,h,z,x>r.faultModel.trace?1:-1,t);
      g.position.set(x+d.x,h+d.y,z);g.visible=r.exposure==="dense"||(r.exposure==="sparse"&&i%5===0);
      g.children[2].visible=r.protection;
      g.rotation.z=r.faultModel.shaking(t,x,h,z)*(r.soil==="loose"?2.3:1)*(r.protection?.56:1);
    });
  });
}
function witness(r:RegionalScene){
  r.markerEnds=[[0,0,0],[0,0,0]];
  for(const [index,side] of [-1,1].entries()){
    for(const stripe of [false,true]){
      const coords:number[]=[],indices:number[]=[],half=stripe?.022:.095;
      for(let i=0;i<=72;i++){
        const x=side*i*.055,center=-.42+.12*Math.sin(x*.9);
        for(const edge of [-1,1]){const z=center+edge*half;coords.push(x,r.height(x,z)+(stripe?.032:.026),z);}
        if(i<72){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
      }
      const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(coords,3));g.setIndex(indices);g.computeVertexNormals();
      const mat=new T.MeshStandardMaterial({color:stripe?0xe5d8ae:0x8d795f,roughness:.92,side:T.DoubleSide});
      if(!stripe&&r.lib){const tex=r.lib.color;mat.onBeforeCompile=sh=>{
        sh.uniforms.track={value:tex};sh.vertexShader="varying vec2 trackUV;\n"+sh.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\ntrackUV=position.xz;");
        sh.fragmentShader="uniform sampler2D track;varying vec2 trackUV;\n"+sh.fragmentShader.replace("#include <color_fragment>","#include <color_fragment>\nvec2 p=trackUV*3.;float grit=textureGrad(track,(vec2(1.,1.)+.004+.992*fract(p))/vec2(4.,2.),dFdx(p)/vec2(4.,2.),dFdy(p)/vec2(4.,2.)).g;diffuseColor.rgb*=.57+1.4*sqrt(grit);");};}
      const road=object(g,mat,"marker");road.name="Schematischer Vergleichsweg";
      Object.defineProperty(road.userData,"explanation",{get:()=>{
        const released=r.faultModel.release(r.progress,0,r.height(0,-.42),-.42);
        const offset=Math.abs(r.markerEnds[0][2]-r.markerEnds[1][2]);
        if(released<=0||offset<.006)return {name:"Vergleichsweg",answer:"Die helle Linie verbindet beide Seiten. Ihre Lage lässt sich vor und nach dem Beben vergleichen."};
        return {name:released>=.999?"Versetzte Geländelinie":"Sich verschiebende Geländelinie",answer:released>=.999?"Die beiden Wegenden liegen jetzt seitlich versetzt.":"Die Wegenden verschieben sich gerade gegeneinander."};
      }});r.witnesses.add(road);r.bindRock(g,side);
      if(stripe)r.onAnimate(()=>{const p=g.attributes.position;r.markerEnds[index]=[p.getX(0),p.getY(0),(p.getZ(0)+p.getZ(1))/2];});
    }
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
