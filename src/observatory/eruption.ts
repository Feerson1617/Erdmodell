import * as T from "three";
import type {RegionalScene} from "./regional";
const material=(color:number)=>new T.MeshStandardMaterial({color,roughness:.9});

function edifice(shield:boolean){
  const p:number[]=[],indices:number[]=[],rings=13,sectors=64;
  for(let j=0;j<=rings;j++)for(let i=0;i<=sectors;i++){
    const a=2*Math.PI*i/sectors,u=j/rings,channel=.08*Math.sin(5*a+.8)+.04*Math.sin(11*a-2*u)+.03*Math.sin(21*a+3*u);
    const radius=u*(shield?1.13:.76)*(1+channel*(.4+.6*u));
    const profile=u<.16?.62+u*1.9:Math.pow((1-u)/.84,shield?1.7:1.15);
    const h=(shield?.54:1.05)*profile*(1+channel*.19);
    p.push(radius*Math.cos(a),h,radius*Math.sin(a));
    if(j<rings&&i<sectors){const k=j*(sectors+1)+i,l=k+sectors+1;indices.push(k,k+1,l,k+1,l+1,l);}
  }
  const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(p,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function eruption(r:RegionalScene,x:number,top:number){
  const hotspot=r.spec.process==="hotspot",z=-.33;const centres:T.Mesh[]=[];
  const shape=edifice(hotspot),rock=material(0x726352);rock.side=T.DoubleSide;
  for(let i=0;i<(hotspot?5:1);i++){
    const m=new T.Mesh(shape,rock);m.userData.explanation={name:"Vulkanbau",answer:"Viele Ausbrüche können einen Vulkan aufbauen. Über der Quelle entsteht ein neuer Vulkan."};
    centres.push(m);r.scene.add(m);
  }
  const hot=new T.MeshStandardMaterial({color:0xca5728,emissive:0x93270e,emissiveIntensity:.62,roughness:.72});
  const curve=new T.CatmullRomCurve3([new T.Vector3(x,top+(hotspot?.45:.86),z),new T.Vector3(x+.19,top+(hotspot?.46:.93),z),new T.Vector3(x+.48,top+.29,z-.14),new T.Vector3(x+.91,top+.06,z-.08),new T.Vector3(x+1.47,r.height(x+1.47,z-.34)+.04,z-.34)]);
  const lava=new T.Mesh(new T.TubeGeometry(curve,54,.065,7,false),hot);lava.userData.explanation={name:"Lavafluss",answer:"Gas kann entweichen. Die fließfähige Lava bewegt sich hangabwärts."};r.scene.add(lava);
  const ash=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),material(0x88847b),42);
  const clasts=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),material(0x564138),26);ash.frustumCulled=clasts.frustumCulled=false;
  ash.userData.explanation={name:"Asche und Gas",answer:"Aufsteigendes Gas dehnt sich aus. Es kann zähe Schmelze zerreißen."};clasts.userData.explanation=ash.userData.explanation;r.scene.add(ash,clasts);
  const dummy=new T.Object3D();
  r.onAnimate(t=>{
    centres.forEach((m,i)=>{const age=hotspot?t*4+.92-i:1;const growth=T.MathUtils.clamp(age*1.6,.02,1);
      m.visible=age>0;const travel=hotspot?Math.max(0,age-1)*.92:0;
      const px=x-.64*travel,pz=z-.59*travel;m.position.set(px,r.height(px,pz)-.018,pz);m.scale.set(growth,growth*(1-.045*travel),growth);});
    const erupt=T.MathUtils.smoothstep(t,.55,.96);lava.visible=r.eruption==="effusive"&&erupt>0;
    lava.geometry.setDrawRange(0,Math.floor(54*erupt)*7*6);
    ash.visible=clasts.visible=r.eruption==="explosive"&&t>.54;
    if(ash.visible)for(const [group,count] of [[ash,42],[clasts,26]] as const){
      for(let i=0;i<count;i++){
        const age=(t-.54)*2.85-i/count*.58,a=i*2.399;let radius=0;
        if(age>=0&&age<1){const plume=group===ash;
          const spread=plume?.16+.55*age:age*1.4;
          const rise=plume?2.65*age:2.9*age-3.9*age*age;
          dummy.position.set(x+Math.cos(a)*spread+(plume?.55*age:0),top+(hotspot?.52:.98)+rise,z+Math.sin(a)*spread);
          radius=plume?.045+.21*age:.035*(1-age);
        }
        dummy.scale.setScalar(radius);dummy.updateMatrix();group.setMatrixAt(i,dummy.matrix);
      }group.instanceMatrix.needsUpdate=true;
    }
  });
}

