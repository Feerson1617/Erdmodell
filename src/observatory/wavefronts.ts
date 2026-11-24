import * as T from "three";
import {onset,pSpeed,sSpeed} from "./fault";
import type {RegionalScene} from "./regional";

export function waveAnalysis(r:RegionalScene){
  const f=r.faultModel;
  const colors=[0xf5bd67,0x58dadd],fronts:T.Mesh[]=[],markers:T.InstancedMesh[]=[];
  const detail=new T.Group();r.section.add(detail);detail.name="Gesteinspunkte im Detail";
  const dummy=new T.Object3D(),probe=new T.Vector3();
  for(const [n,color] of colors.entries()){
    const points=160,positions=new T.Float32BufferAttribute(new Float32Array((points+1)*6),3);
    const g=new T.BufferGeometry();g.setAttribute("position",positions);
    const indices=[];for(let i=0;i<points;i++){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}g.setIndex(indices);
    const mat=new T.MeshBasicMaterial({color,transparent:true,opacity:.75,depthWrite:false,side:T.DoubleSide});
    const m=new T.Mesh(g,mat);m.name=n?"S-Wellenfront":"P-Wellenfront";m.userData.explanation={name:m.name,answer:n?"Gestein bewegt sich quer zur Laufrichtung.":"Das Gestein wird zusammengedrückt und gedehnt."};m.frustumCulled=false;
    r.section.add(m);fronts.push(m);
    const beads=new T.InstancedMesh(new T.SphereGeometry(.069,10,7),new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.22}),14);
    beads.frustumCulled=false;detail.add(beads);markers.push(beads);
  }
  const fluid=new T.Line(new T.BufferGeometry().setAttribute("position",new T.Float32BufferAttribute(new Float32Array(61*3),3)),new T.LineBasicMaterial({color:colors[0]}));
  fluid.name="Druckwelle im Wasser";fluid.frustumCulled=false;r.section.add(fluid);
  let last="";r.onAnimate(t=>{
    const state=[t,r.showP,r.showS,r.detail,r.cut].join("/");if(state===last)return;last=state;
    const quake=r.spec.theme==="earthquake"||r.spec.theme==="risk";
    detail.visible=quake&&r.detail;
    for(const [n,front] of fronts.entries()){
      const speed=n?sSpeed:pSpeed,rad=(t-onset)*speed;front.visible=quake&&(n?r.showS:r.showP)&&rad>0&&t<.99;
      const pos=front.geometry.attributes.position as T.BufferAttribute;
      let count=0,previous=false;
      const indices=front.geometry.index!;
      if(front.visible)for(let i=0;i<=160;i++){
        const a=i*Math.PI/80,cs=Math.cos(a),sn=Math.sin(a);
        const centerX=f.hx+rad*cs,centerY=f.hy+rad*sn;
        const visible=Math.abs(centerX)<=6&&centerY<=r.height(centerX,0)&&centerY>=-5.5;
        if(previous&&visible){const k=(i-1)*2;for(const vertex of [k,k+1,k+2,k+1,k+3,k+2])indices.setX(count++,vertex);}
        previous=visible;
        for(let j=0;j<2;j++){
          const radius=Math.max(0,rad+(j-.5)*.095),x=f.hx+radius*cs;
          const y=Math.min(r.height(x,0),f.hy+radius*sn);
          const d=f.offset(probe,x,y,0,x>=f.xAt(y)?1:-1,t);
          pos.setXYZ(i*2+j,Math.max(-6,Math.min(6,x)),Math.max(-5.5,y),.036+d.z);
        }
      }
      front.geometry.setDrawRange(0,count);indices.needsUpdate=true;pos.needsUpdate=true;const beads=markers[n];beads.visible=(n?r.showS:r.showP);
      if(detail.visible&&beads.visible)for(let i=0;i<14;i++){
        const distance=.18+i*.27,x=f.hx+distance,y=f.hy-(n?.38:0),arrival=onset+Math.hypot(distance,y-f.hy)/speed,u=t-arrival;
        const phase=u>0?Math.sin(u*105)*Math.exp(-u*12)*Math.min(1,u/.017):0;
        dummy.position.set(x+(n?0:phase*.15),y+(n?phase*.17:0),.44);dummy.updateMatrix();beads.setMatrixAt(i,dummy.matrix);
      }beads.instanceMatrix.needsUpdate=true;
    }
    const epi=r.height(f.hx,0),radius=(t-onset-Math.abs(epi-f.hy)/pSpeed)*8.3;
    fluid.visible=quake&&r.showP&&radius>0&&epi<-.1&&radius<5;
    if(fluid.visible){
      const p=fluid.geometry.attributes.position as T.BufferAttribute;
      for(let i=0;i<=60;i++){const a=i*Math.PI/60,x=f.hx+radius*Math.cos(a),y=epi+radius*Math.sin(a);
        p.setXYZ(i,x,Math.max(r.height(x,0),Math.min(0,y)),.07);}
      p.needsUpdate=true;
    }
  });
  return fronts;
}

