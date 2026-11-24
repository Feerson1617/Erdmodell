import * as T from "three";
import type {RegionalScene} from "./regional";
import {quality,libraryGLSL,type Library} from "./graphics";

type Anchor={position:T.BufferAttribute;indices:number[];weights:number[];matrix:T.Matrix4;color:T.Color};
function foliage(kind:number,planes:number){
  const positions:number[]=[],uv:number[]=[],idx:number[]=[];
  for(let i=0;i<planes;i++){
    const angle=Math.PI*i/planes,c=Math.cos(angle),s=Math.sin(angle),n=positions.length/3;
    for(let j=0;j<3;j++)for(const side of [-1,1]){
      const radius=.5*side,y=j*.5,bend=.08*y*y;
      positions.push(c*radius-s*bend,y,s*radius+c*bend);
      uv.push(((kind%4)+.017+.966*(side+1)/2)/4,(1-Math.floor(kind/4)+.015+.97*y)/2);
    }
    idx.push(n,n+2,n+1,n+2,n+3,n+1,n+2,n+4,n+3,n+4,n+5,n+3);
  }
  const g=new T.BufferGeometry();g.setIndex(idx);g.setAttribute("position",new T.Float32BufferAttribute(positions,3));g.setAttribute("uv",new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;
}
function boulder(detail=2){
  const g=new T.IcosahedronGeometry(1,detail),p=g.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),ridge=1+.21*Math.sin(x*8+z*5-y*2);p.setXYZ(i,x*ridge+.21*y,Math.max(0,(y+.52)*.66),z*(.74+.18*x));}
  g.computeVertexNormals();return g;
}
export function groundCover(r:RegionalScene,lib:Library,image:T.Texture){
  const surfaces:T.BufferGeometry[]=[];r.scene.traverse(o=>{const g=(o as T.Mesh).geometry;if(g?.userData.surface)surfaces.push(g);});
  const canvas=document.createElement("canvas");canvas.width=96;canvas.height=72;
  const ctx=canvas.getContext("2d",{willReadFrequently:true})!;ctx.drawImage(image.image,0,0,96,72);const pixels=ctx.getImageData(0,0,96,72).data;
  const leaves=new T.MeshStandardMaterial({map:lib.plants,alphaTest:.34,side:T.DoubleSide,roughness:.91});
  const stone=new T.MeshStandardMaterial({color:r.spec.site==="island"||r.spec.site==="hawaii"?0x534d49:0xa49177,flatShading:false,roughness:.91});
  stone.onBeforeCompile=s=>{
    Object.assign(s.uniforms,{faciesColor:{value:lib.color},faciesRelief:{value:lib.relief},detailGrade:r.grade});
    s.vertexShader="varying vec3 pebble;\n"+s.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\npebble=position;");
    s.fragmentShader=libraryGLSL+"varying vec3 pebble;\n"+s.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
      vec2 uvRock=pebble.xz*.51+pebble.y*vec2(.17,.64);
      vec3 sampleRock=fieldSample(faciesColor,uvRock,${r.spec.site==="island"||r.spec.site==="hawaii"?"3.":"1."}).rgb;
      diffuseColor.rgb=mix(diffuseColor.rgb*.48,sampleRock,.66)*(.62+.40*smoothstep(0.,.8,pebble.y));
    `);
  };
  let seed=94571;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const batches=new Map<string,Anchor[]>(),dummy=new T.Object3D(),v=new T.Vector3(),site=r.spec.site;
  const tri=new T.Triangle(),bary=new T.Vector3();
  for(const g of surfaces){
    const pos=g.attributes.position as T.BufferAttribute,index=g.index!,front=+g.userData.front;
    for(let attempt=0;attempt<Math.ceil(6200/surfaces.length);attempt++){
      const k=3*Math.floor(random()*index.count/3),ids=[index.getX(k),index.getX(k+1),index.getX(k+2)];
      tri.a.fromBufferAttribute(pos,ids[0]);tri.b.fromBufferAttribute(pos,ids[1]);tri.c.fromBufferAttribute(pos,ids[2]);
      const t=Math.sqrt(random()),s=random();bary.set(1-t,t*(1-s),t*s);
      // Barycentric coordinates directly bind every root to the rendered, deforming triangle.
      const weights=bary.toArray(),x=weights.reduce((n,w,i)=>n+w*pos.getX(ids[i]),0),y=weights.reduce((n,w,i)=>n+w*pos.getY(ids[i]),0),z=weights.reduce((n,w,i)=>n+w*pos.getZ(ids[i]),0);
      if(y<.009||Math.abs(z)<.065||Math.abs(x)>5.9||Math.abs(z)>4.43)continue;
      const j=4*(Math.min(71,Math.floor((z/9+.5)*72))*96+Math.min(95,Math.floor((x/12+.5)*96))),[rr,green,blue]=pixels.subarray(j,j+3);
      const patch=.46+.26*Math.sin(x*3+Math.sin(z*4))+.28*Math.sin(z*2.3-x*.7);
      if(random()>.24+.72*patch||rr<16)continue;
      const slope=1-Math.abs(tri.getNormal(v).y),lush=green>rr*.91&&green>blue*1.13,stoneChance=slope>.23?.83:site==="island"?.50:.13;
      let kind=random()<stoneChance?8:site==="island"?4:site==="hawaii"?(lush?6:8):site==="rift"?(lush&&random()<.17?5:0):site==="himalaya"?(rr>178||!lush?8:1):site==="japan"?(lush?3:1):lush&&patch>.32?(random()<.62?2:1):random()<.8?0:1;
      const size=[.032,.068,.16,.13,.038,.14,.073,.055,.027][kind]*(.55+random()**1.6*1.6);
      dummy.position.set(x,y-.001,z);dummy.scale.set(size*(kind===2?1.15:1),size*(.86+random()*.28),size*(.76+.48*random()));dummy.rotation.y=random()*Math.PI*2;dummy.updateMatrix();
      const color=new T.Color().setRGB(.66+random()*.32,.69+random()*.27,.63+random()*.29);
      const key=front+"-"+kind;let batch=batches.get(key);if(!batch){batch=[];batches.set(key,batch);}
      batch.push({position:pos,indices:ids,weights,matrix:dummy.matrix.clone(),color});
    }
  }
  for(const [key,roots] of batches){
    const [front,kind]=key.split("-").map(Number);
    const near=kind===8?boulder():foliage(kind,3),far=kind===8?boulder(0):foliage(kind,2);
    const mesh=new T.InstancedMesh(near,kind===8?stone:leaves,roots.length);mesh.name=kind===8?"Lesesteine und Blockschutt":"Standorttypischer Modellbewuchs";mesh.castShadow=mesh.receiveShadow=true;mesh.raycast=()=>{};mesh.frustumCulled=false;
    roots.forEach((a,i)=>mesh.setColorAt(i,a.color));(front?r.front:r.scene).add(mesh);
    let last=-1,high=true;const matrix=new T.Matrix4();
    mesh.addEventListener("dispose",()=>{near.dispose();far.dispose();});
    r.onAnimate(t=>{
      const grade=quality(),distance=r.orbit.getDistance();if(distance>(grade===2?12:8)+.45)high=false;else if(distance<(grade===2?12:8)-.45)high=true;
      mesh.geometry=high?near:far;const count=Math.ceil(roots.length*(grade===2?1:grade===1?.74:.44));
      if(t===last&&mesh.count===count)return;mesh.count=count;last=t;
      for(let i=0;i<count;i++){
        const a=roots[i];v.set(0,-.001,0);for(let j=0;j<3;j++){const idx=a.indices[j],w=a.weights[j];v.x+=a.position.getX(idx)*w;v.y+=a.position.getY(idx)*w;v.z+=a.position.getZ(idx)*w;}
        matrix.copy(a.matrix).setPosition(v);mesh.setMatrixAt(i,matrix);
      }
      mesh.instanceMatrix.needsUpdate=true;
    });
  }
}
