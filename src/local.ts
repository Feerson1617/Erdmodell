import * as T from 'three';
import {basis,position,R,RAD,smooth,clamp} from './geo';
import {HOOGE} from './camera';
import {texture,dataUrl} from './planet';
import type {Style} from './model';
type Point=[number,number];
type Data={bounds:[number,number,number,number];coast:Point[];mounds:{name:string;point:Point}[];buildings:Point[][]};
const anchor=position(HOOGE.lat,HOOGE.lon),frame=basis(HOOGE.lat,HOOGE.lon);
const kx=R*RAD*Math.cos(HOOGE.lat*RAD),ky=R*RAD;
function local([lon,lat]:Point):Point{return [(lon-HOOGE.lon)*kx,(HOOGE.lat-lat)*ky];}
function inside(x:number,z:number,ring:Point[]){let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){
 const [a,b]=ring[i],[c,d]=ring[j];if((b>z)!==(d>z) && x<(c-a)*(z-b)/(d-b)+a)hit=!hit;}return hit;}
const sag=(x:number,z:number)=>(x*x+z*z)/(2*R);
export class LocalTerrain {
 group=new T.Group();ready=false;loading?:Promise<void>;data?:Data;map?:T.Texture;
 private mounds:Point[]=[];private coast:Point[]=[];private style:Style='A';private surface?:T.Mesh;private buildings=new T.Group();
 time={value:0};weight={value:0};
 constructor(private warn:(s:string)=>void){this.group.position.copy(anchor);this.group.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(frame.east,frame.up,frame.north.clone().negate()));this.group.visible=false;this.group.add(this.buildings);}
 load(){return this.loading??=this.fetchData().catch(()=>this.warn('Hallig-Detaildaten fehlen · regionale Küstenkarte aktiv'));}
 private async fetchData(){const [data,map]=await Promise.all([fetch(dataUrl('hooge.json')).then(r=>{if(!r.ok)throw Error();return r.json() as Promise<Data>;}),texture('hooge.webp')]);
 this.data=data;this.map=map;this.coast=data.coast.map(local);this.mounds=data.mounds.map(m=>local(m.point));this.ready=true;this.rebuild();}
 private height(x:number,z:number,land=true){let h=land?.0017:0;
 if(land)for(const [cx,cz] of this.mounds){const r=Math.hypot((x-cx)/.125,(z-cz)/.085);if(r<1.48)h+=.0058*(1-smooth((r-.48)));}
 return h+.0012-sag(x,z);}
 ground(lat:number,lon:number){if(!this.ready)return 0;const [x,z]=local([lon,lat]);if(Math.abs(x)>5||Math.abs(z)>4)return 0;return this.height(x,z,inside(x,z,this.coast))+sag(x,z);}
 setStyle(s:Style){this.style=s;if(this.ready)this.rebuild();}
 private rebuild(){if(!this.data || !this.map)return;
 if(this.surface){this.group.remove(this.surface);this.surface.geometry.dispose();(this.surface.material as T.Material).dispose();}
 this.buildings.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();o.material.dispose();}});this.buildings.clear();
 const [w,s,e,n]=this.data.bounds,[x0,z0]=local([w,n]),[x1,z1]=local([e,s]),nx=this.style==='A'?240:155,nz=Math.round(nx*(z1-z0)/(x1-x0)),pos=[],uv=[],idx=[],mask=[];
 for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){const u=i/nx,v=j/nz,x=x0+(x1-x0)*u,z=z0+(z1-z0)*v,land=inside(x,z,this.coast);pos.push(x,this.height(x,z,land),z);uv.push(u,1-v);mask.push(land?1:0);}
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+nx+1;idx.push(a,b,a+1,a+1,b,b+1);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('land',new T.Float32BufferAttribute(mask,1));g.setIndex(idx);g.computeVertexNormals();
 const mat=new T.MeshStandardMaterial({map:this.map,roughness:.89,flatShading:this.style==='B',transparent:true,depthWrite:false});
 mat.onBeforeCompile=shader=>{shader.uniforms.tideTime=this.time;shader.uniforms.lodWeight=this.weight;
 shader.vertexShader='attribute float land;varying float dry;varying vec2 site;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n dry=land;site=position.xz;');
 shader.fragmentShader='varying float dry;varying vec2 site;uniform float tideTime;uniform float lodWeight;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
 float wobble=sin(site.y*18.+site.x*6.);float wave=sin(site.x*340.+site.y*650.+wobble*4.+tideTime)*.5+.5;
 float field=sin(site.x*443.+site.y*28.)*sin(site.y*980.)*.04;
 diffuseColor.rgb*=1.+mix((wave-.5)*.14,field,dry)/(1.+length(fwidth(site))*100.);
 float edge=min(min(vMapUv.x,vMapUv.y),min(1.-vMapUv.x,1.-vMapUv.y));
 diffuseColor.a*=lodWeight*smoothstep(0.,.12,edge);`);};
 this.surface=new T.Mesh(g,mat);this.surface.renderOrder=1;this.surface.receiveShadow=true;this.group.add(this.surface);
 const vertices:number[]=[],colors:number[]=[];let seed=90210;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 function tri(a:number[],b:number[],c:number[],color:T.Color){vertices.push(...a,...b,...c);for(let i=0;i<3;i++)colors.push(color.r,color.g,color.b);}
 const trees:{x:number,z:number,y:number,h:number}[]=[];
 for(const footprint of this.data.buildings){const p=footprint.map(local);let length=0,theta=0;
 p.forEach(([x,z],i)=>{const q=p[(i+1)%p.length],d=Math.hypot(q[0]-x,q[1]-z);if(d>length){length=d;theta=Math.atan2(q[1]-z,q[0]-x);}});
 const c=Math.cos(theta),ss=Math.sin(theta),us=p.map(([x,z])=>x*c+z*ss),vs=p.map(([x,z])=>-x*ss+z*c);
 const u0=Math.min(...us),u1=Math.max(...us),v0=Math.min(...vs),v1=Math.max(...vs),um=(u0+u1)/2,vm=(v0+v1)/2;
 const x=um*c-vm*ss,z=um*ss+vm*c,y=this.height(x,z),h=.003+rand()*.0025,roofH=Math.min(.005,(v1-v0)*.44);
 const vertex=(u:number,v:number,h:number)=>[u*c-v*ss,y+h,u*ss+v*c];
 const base=[[u0,v0],[u1,v0],[u1,v1],[u0,v1]],wall=new T.Color(rand()<.55?'#e2d6b6':'#aa7964'),roof=new T.Color(rand()<.54?'#795d47':'#7b4b3e');
 for(let k=0;k<4;k++){const a=base[k],b=base[(k+1)%4],p=vertex(a[0],a[1],-.0008),q=vertex(b[0],b[1],-.0008),r=vertex(a[0],a[1],h),t=vertex(b[0],b[1],h);tri(p,r,q,wall);tri(q,r,t,wall);}
 const corners=base.map(([u,v])=>vertex(u,v,h)),ra=vertex(u0+.17*(u1-u0),vm,h+roofH),rb=vertex(u1-.17*(u1-u0),vm,h+roofH);
 tri(corners[0],ra,corners[3],roof);tri(corners[1],corners[2],rb,roof);tri(corners[0],corners[1],rb,roof);tri(corners[0],rb,ra,roof);tri(corners[3],ra,rb,roof);tri(corners[3],rb,corners[2],roof);
 for(let k=0;k<4;k++){const tx=x+(rand()-.5)*.06,tz=z+(rand()-.5)*.058;if(inside(tx,tz,this.coast))trees.push({x:tx,z:tz,y:this.height(tx,tz),h:.003+rand()*.005});}
 }
 const bg=new T.BufferGeometry();bg.setAttribute('position',new T.Float32BufferAttribute(vertices,3));bg.setAttribute('color',new T.Float32BufferAttribute(colors,3));bg.computeVertexNormals();const houses=new T.Mesh(bg,new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:1}));houses.castShadow=true;houses.receiveShadow=true;this.buildings.add(houses);
 const dummy=new T.Object3D();const crowns=new T.InstancedMesh(new T.IcosahedronGeometry(1,this.style==='A'?1:0),new T.MeshStandardMaterial({roughness:1,flatShading:this.style==='B'}),trees.length);
 trees.forEach((t,i)=>{dummy.position.set(t.x,t.y+t.h*.6,t.z);dummy.scale.set(t.h*.45,t.h*.65,t.h*.42);dummy.rotation.y=i*2;dummy.updateMatrix();crowns.setMatrixAt(i,dummy.matrix);crowns.setColorAt(i,new T.Color().setHSL(.21+rand()*.06,.17+rand()*.13,.25+rand()*.12));});crowns.castShadow=true;this.buildings.add(crowns);
 }
 update(lat:number,lon:number,d:number,now:number){const close=Math.abs(lat-HOOGE.lat)<1.4 && Math.abs(lon-HOOGE.lon)<2.5;
 if(close && d<1400 && !this.loading)void this.load();this.weight.value=1-smooth((d-10)/125);
 this.group.visible=this.ready&&close&&d<135;this.buildings.visible=d<12;this.time.value=now/1700;}
}

