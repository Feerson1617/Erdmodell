import * as T from 'three';
import {R,position} from './geo';
import {layers,type Style} from './model';
/** Closed spherical shells with two meridional cut faces and an inner surface. */
export class Shells {
 group=new T.Group(); cut=true; expanded=false; visible=[true,true,true,true]; opacity=[1,1,1,1];style:Style='A';map?:T.Texture;
 rebuild(){this.group.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();o.material.dispose();}});this.group.clear();
   const radii=[R,this.expanded?R*.935:6336,3481,1221,0];
   layers.forEach((l,i)=>{
     if(!this.visible[i])return;
     const start=this.cut?65:-180,end=this.cut?335:180,n=this.style==='A'?120:64,m=n/2, hi=radii[i],lo=radii[i+1];
     const shell=new T.Group();this.group.add(shell);
     const surface=(rad:number,inner:boolean)=>{
       if(rad<=0)return;
       const pos=[],norm=[],uv=[],indices=[];
       for(let j=0;j<=m;j++)for(let k=0;k<=n;k++){const lat=-90+180*j/m,lon=start+(end-start)*k/n,p=position(lat,lon).normalize();
         norm.push(...p.clone().multiplyScalar(inner?-1:1).toArray());pos.push(...p.multiplyScalar(rad).toArray());uv.push((lon+180)/360,(lat+90)/180);}
       for(let j=0;j<m;j++)for(let k=0;k<n;k++){const a=j*(n+1)+k,b=a+n+1;indices.push(a,a+1,b,a+1,b+1,b);}
       const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(norm,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);
       const mat=new T.MeshStandardMaterial({color:i===0&&!inner?0xffffff:l.color,map:i===0&&!inner?this.map:null,roughness:.9,flatShading:this.style==='B',side:T.DoubleSide});
       add(g,mat);
     };
     const add=(g:T.BufferGeometry,mat:T.MeshStandardMaterial)=>{mat.transparent=this.opacity[i]<1;mat.opacity=this.opacity[i];mat.depthWrite=!mat.transparent;
       const mesh=new T.Mesh(g,mat);mesh.userData.layer=i;mesh.renderOrder=4-i;shell.add(mesh);};
     surface(hi,false);if(lo>0 && (!this.visible[i+1]||this.opacity[i+1]<1))surface(lo+.002,true);
     if(!this.cut)return;
     for(const lon of [start,end]){const pos=[],colors=[],idx=[],steps=this.style==='A'?28:12;
       for(let j=0;j<=m;j++)for(let k=0;k<=steps;k++){
         const lat=-90+180*j/m,rad=lo+(hi-lo)*k/steps;pos.push(...position(lat,lon,rad-R).toArray());
         const band=.89+.085*Math.cos(k/steps*14+Math.sin(lat/24)*.7)+.025*Math.cos(j*1.6+k);
         const c=new T.Color(l.color).multiplyScalar(band);colors.push(c.r,c.g,c.b);}
       for(let j=0;j<m;j++)for(let k=0;k<steps;k++){const a=j*(steps+1)+k,b=a+steps+1;idx.push(a,b,a+1,a+1,b,b+1);}
       const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(idx);g.computeVertexNormals();
       add(g,new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.91}));
     }
   });
 }
}

