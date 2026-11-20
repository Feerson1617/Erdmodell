import * as T from "three";
import {basis, clamp, position, R, RAD} from "../geo";
import {project} from "../annotations";
import {center, names, type Step} from "./atlas";
import {rockBody, rockTexture, wave} from "./process-geometry";

export function poleVector(pole:number[]) {
  return position(pole[0],pole[1]).normalize().multiplyScalar(pole[2]*RAD);
}

/** Two pieces of lithosphere at one observed boundary, in a symmetric local reference frame. */
export class BoundaryComparison {
  readonly group = new T.Group();
  readonly site;
  readonly heading:number;
  readonly span:number;
  readonly bodies:T.Mesh[];
  private readonly axis:T.Vector3;
  private readonly angle:number;
  private readonly right:T.Vector3;
  private readonly centres:T.Vector3[]=[];
  private readonly samples:T.Vector3[][]=[];
  private readonly texture=rockTexture();
  private progress=0;

  constructor(readonly step:Step, poles:number[][], tones:T.Color[]) {
    this.site=center(step);
    const {up,east,north}=basis(this.site.lat,this.site.lon);
    const forward=position(step[6],step[5]).sub(position(step[4],step[3])).normalize();
    this.right=forward.clone().cross(up).normalize();
    const along=up.clone().cross(this.right);
    this.heading=-Math.atan2(along.dot(east),along.dot(north))/RAD+12;
    const relative=poleVector(poles[0]).sub(poleVector(poles[1]));
    this.axis=relative.clone().normalize();
    const direction=relative.clone().cross(up).normalize();
    const lever=this.axis.clone().cross(up).length()*R;
    // Keep the samples small compared with their distance from the relative rotation pole.
    const unit=clamp(lever/450,.7,9);
    this.span=unit*22;
    this.angle=Math.min(.12,unit*12/lever);
    const travel=this.angle*lever/unit;
    const gap=2.5+Math.max(0,direction.dot(this.right))*travel;
    const codes=[step[1].slice(0,2),step[1].slice(-2)];
    const globePoint=(x:number,y:number,z:number) => up.clone().multiplyScalar(R)
      .addScaledVector(this.right,x*unit).addScaledVector(along,-z*unit)
      .setLength(R+unit*y);

    // A neutral viewing field sits on the map. Its colour never codes new crust.
    const vertices:number[]=[],indices:number[]=[],fieldColors:number[]=[];
    for(let ring=0;ring<=12;ring++)for(let i=0;i<=96;i++){
      const phi=2*Math.PI*i/96, radius=ring/12;
      vertices.push(...globePoint(29*radius*Math.cos(phi),.4,23*radius*Math.sin(phi)).toArray());
      const tint=new T.Color(0x555047);
      tint.multiplyScalar(1+.08*wave(18*radius*Math.cos(phi),15*radius*Math.sin(phi)));
      fieldColors.push(tint.r,tint.g,tint.b,1-T.MathUtils.smoothstep(radius,.66,1));
      if(ring && i){const k=ring*97+i;indices.push(k-98,k-1,k,k-98,k,k-97);}
    }
    const field=new T.BufferGeometry();
    field.setAttribute("position",new T.Float32BufferAttribute(vertices,3));field.setAttribute("color",new T.Float32BufferAttribute(fieldColors,4));field.setIndex(indices);field.computeVertexNormals();
    this.group.add(new T.Mesh(field,new T.MeshStandardMaterial({vertexColors:true,transparent:true,depthWrite:false,roughness:1,side:T.DoubleSide})));

    this.bodies=codes.map((code,i)=>{
      const middle=(i===0?-1:1)*(gap/2+5.7);
      const mat=new T.MeshStandardMaterial({map:this.texture,vertexColors:true,roughness:.94});
      const tone=tones[i];
      const vein=(x:number,z:number)=>z-(3+.12*x+.32*Math.sin(.65*x));
      const roof=(x:number,z:number)=>3.7+.42*wave(x*.7,z*.9)+.2*Math.exp(-(vein(x,z)**2));
      const pale=new T.Color(0xf4e2bd), dark=new T.Color(0x51483e);
      const paint=(x:number,z:number)=>{
        const band=vein(x,z);
        return tone.clone().multiplyScalar(.7+.22*wave(x*.8,z*.6))
          .lerp(dark,.62*Math.exp(-((band+.95)**2)/.36))
          .lerp(pale,.89*Math.exp(-(band**2)/.72));
      };
      const bevel=(z:number)=>Math.max(0,Math.abs(z)-7.2)*.38;
      const edge=(z:number)=>.37*Math.sin(z*.47)+.16*Math.sin(z*1.23);
      const body=rockBody(this.group,code,mat,z=>middle-5.7+bevel(z)+edge(z),z=>middle+5.7-bevel(z)+edge(z),
        roof,()=>.32,tone.clone().lerp(dark,.68),paint,26);
      const coords=body.geometry.getAttribute("position");
      for(let j=0;j<coords.count;j++){
        const v=globePoint(coords.getX(j),coords.getY(j),coords.getZ(j));
        coords.setXYZ(j,v.x,v.y,v.z);
      }
      body.geometry.computeVertexNormals();body.geometry.computeBoundingSphere();
      this.centres.push(globePoint(middle+(i===0?-1:1)*2.8,4,-6.7));
      this.samples.push([0,18,12*19+9,24*19,25*19].map(j=>new T.Vector3().fromBufferAttribute(coords,j)));
      return body;
    });
  }
  setTime(progress:number) {
    this.progress=progress;
    this.bodies.forEach((b,i)=>b.quaternion.setFromAxisAngle(this.axis,(i===0?.5:-.5)*progress*this.angle));
    this.group.updateMatrixWorld(true);
  }
  labels(camera:T.Camera,width:number,height:number) {
    return this.bodies.flatMap((body,i)=>{
      const p=body.localToWorld(this.centres[i].clone());
      const xy=project(p,camera,width,height);
      return xy && p.dot(camera.position.clone().sub(p))>0 ? [{code:body.name,name:names[body.name],...xy}] : [];
    });
  }
  diagnostics(camera:T.Camera,width:number,height:number) {
    return {step:this.step[0],progress:this.progress,site:this.site,angle:this.angle,
      right:this.right.toArray(),axis:this.axis.toArray(),labels:this.labels(camera,width,height),
      bodies:this.bodies.map((b,i)=>({code:b.name,quaternion:b.quaternion.toArray(),
        points:this.samples[i].map(v=>b.localToWorld(v.clone()).toArray())}))};
  }
  fadeOut(opacity:number) {
    for(const object of this.group.children) if(object instanceof T.Mesh) {
      object.material.transparent=true;
      object.material.opacity=opacity;
      object.material.depthWrite=false;
    }
  }
  dispose() {
    this.group.removeFromParent();
    this.group.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();o.material.dispose();}});
    this.texture.dispose();
  }
}
