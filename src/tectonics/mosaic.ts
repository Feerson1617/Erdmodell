import * as T from "three";
import { position, R, RAD, clamp, smooth } from "../geo";

export type SurfaceData = Record<string,{pole:number[];vertices:number[];triangles:number[];rim:number[]}>;
const palette = [0xa8b99a,0xc5a385,0x84acb0,0xbbad83,0x899db3,0xb7959d,0x9dae85,0x96b3a8,0xb5a1b6,0xc2b18e];
export const timeWindowMa = 2;
/** Each body turns about its published Euler axis. The schematic edge zone
 * cancels part of that rotation so adjacent plates keep a common closed rim. */
class PlateSurface extends T.Mesh<T.BufferGeometry,T.MeshStandardMaterial> {
  readonly turn={value:0};
  constructor(geometry:T.BufferGeometry, material:T.MeshStandardMaterial,
      readonly axis:T.Vector3, readonly radians:number) {
    super(geometry,material);
    geometry.computeBoundingSphere();
    // Include positions swept by the edge zone in the local-space raycast bounds.
    geometry.boundingSphere!.radius += 2*R*Math.sin(Math.min(Math.PI,radians)/2);
    const previous=material.onBeforeCompile;
    material.onBeforeCompile=(shader,renderer)=>{
      previous.call(material,shader,renderer);
      shader.uniforms.plateTurn=this.turn;
      shader.uniforms.plateAxis={value:axis};
      shader.vertexShader=`uniform float plateTurn;
        uniform vec3 plateAxis;
        attribute float rotationWeight;
        vec3 edgeRotation(vec3 v) {
          float angle=plateTurn*(rotationWeight-1.);
          return v*cos(angle)+cross(plateAxis,v)*sin(angle)+plateAxis*dot(plateAxis,v)*(1.-cos(angle));
        }
      `+shader.vertexShader.replace("#include <begin_vertex>","vec3 transformed=edgeRotation(position);")
          .replace("#include <beginnormal_vertex>","vec3 objectNormal=edgeRotation(normal);");
    };
  }
  setTime(progress:number) {
    this.turn.value=progress*this.radians;
    this.quaternion.setFromAxisAngle(this.axis,this.turn.value);
  }
  override getVertexPosition(index:number, target:T.Vector3) {
    super.getVertexPosition(index,target);
    return target.applyAxisAngle(this.axis,this.turn.value*(this.geometry.getAttribute("rotationWeight").getX(index)-1));
  }
}

export class PlateMosaic {
  readonly group = new T.Group();
  readonly surfaces:PlateSurface[]=[];
  private readonly lifts = new Map<string,number>();
  private readonly probes=new Map<string,number>();
  private readonly cover:T.Mesh<T.SphereGeometry,T.MeshStandardMaterial>;
  private readonly reveal={value:0};
  private readonly axis={value:new T.Vector3()};
  opening=0;
  progress=0;
  playing=false;
  slow=false;
  selected="";
  constructor(data:SurfaceData, map:T.Texture, neighbours:Map<string,Set<string>>) {
    const colors:Record<string,number>={};
    // Neighbouring polygons must remain distinguishable even around microplates.
    for(const code of Object.keys(data).sort((a,b)=>(neighbours.get(b)?.size??0)-(neighbours.get(a)?.size??0))){
      const used=new Set([...neighbours.get(code)??[]].map(n=>colors[n]));
      const hash=code.charCodeAt(0)*11+code.charCodeAt(1);
      colors[code]=palette.map((_,i)=>palette[(i+hash)%palette.length]).find(c=>!used.has(c))??palette[0];
    }
    for (const [code,plate] of Object.entries(data)){
      const axis=position(plate.pole[0],plate.pole[1]).normalize(),angle=plate.pole[2]*RAD*timeWindowMa;
      const xyz:number[]=[],weights:number[]=[], normals:number[]=[],uv:number[]=[],tones:number[]=[],indices=[...plate.triangles];
      const base=new T.Color(colors[code]), rock=new T.Color(),v=new T.Vector3(),end=new T.Vector3();
      let largest=-1,probe=0;
      for(let i=0;i<plate.vertices.length;i+=3){
        const lon=plate.vertices[i]/1e5,lat=plate.vertices[i+1]/1e5,dist=plate.vertices[i+2]/1e4;
        v.copy(position(lat,lon)).normalize();normals.push(v.x,v.y,v.z);
        const speed=Math.sqrt(Math.max(0,1-v.dot(axis)**2))*angle;
        // Today's rim stays closed. Only the buffer near that rim attenuates the Euler motion.
        const fraction=speed>0?Math.min(1,.30*dist*RAD/speed):0;
        end.copy(v).applyAxisAngle(axis,angle*fraction);
        if(end.distanceToSquared(v)>largest){largest=end.distanceToSquared(v);probe=i/3;}
        const radius=R-4;
        xyz.push(v.x*radius,v.y*radius,v.z*radius);weights.push(fraction);
        uv.push((lon+180)/360,(lat+90)/180);
        rock.copy(base).multiplyScalar(.78+.22*Math.min(1,dist/.45));
        tones.push(rock.r,rock.g,rock.b);
      }
      for(let i=0;i<plate.rim.length;i+=2){
        const a=plate.rim[i],b=plate.rim[i+1],start=xyz.length/3;
        const n=new T.Vector3().fromArray(xyz,3*b).sub(new T.Vector3().fromArray(xyz,3*a)).cross(v.fromArray(normals,3*a)).normalize();
        // Three bands are lighting on one schematic cut edge.
        for(const [depth,shade] of [[0,.72],[.0035,.7],[.004,.48],[.026,.40]]){
          for(const id of [a,b]){
            v.fromArray(xyz,3*id).multiplyScalar(1-depth);xyz.push(v.x,v.y,v.z);weights.push(0);
            normals.push(n.x,n.y,n.z);uv.push(uv[2*id],uv[2*id+1]);rock.copy(base).multiplyScalar(shade);tones.push(rock.r,rock.g,rock.b);
          }
        }
        for(let j=0;j<3;j++){const k=start+2*j;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
      }
      const geom=new T.BufferGeometry();
      for(const [name,array,size] of [["position",xyz,3],["normal",normals,3],["uv",uv,2],["color",tones,3],["rotationWeight",weights,1]] as const)
        geom.setAttribute(name,new T.Float32BufferAttribute(array,size));
      geom.setIndex(indices);
      const mat=new T.MeshStandardMaterial({map,vertexColors:true,roughness:.92,side:T.DoubleSide});
      mat.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace("#include <map_fragment>",`
        vec3 relief = texture2D(map, vMapUv).rgb;
        float tone = dot(relief, vec3(0.21,0.72,0.07));
        diffuseColor.rgb *= (0.53 + 1.08 * sqrt(tone));
      `);};
      const mesh=new PlateSurface(geom,mat,axis,angle);mesh.name=code;this.surfaces.push(mesh);this.group.add(mesh);this.probes.set(code,probe);
    }
    const base=new T.Mesh(new T.SphereGeometry(R*.969,100,64),new T.MeshStandardMaterial({color:0x726759,roughness:1}));
    this.group.add(base);
    const material=new T.MeshStandardMaterial({map,roughness:.94});
    material.onBeforeCompile=s=>{
      s.uniforms.reveal=this.reveal;s.uniforms.sweepAxis=this.axis;
      s.vertexShader="uniform float reveal; uniform vec3 sweepAxis; varying float edge;\n"+s.vertexShader.replace("#include <begin_vertex>",`
        vec3 dir=normalize(position); edge=dot(dir,sweepAxis) - (1.01-2.02*reveal);
        float lift=1.-smoothstep(0.,.17,abs(edge));
        vec3 transformed=position+dir*(4.+140.*lift*sin(3.14159*reveal));
      `);
      s.fragmentShader="varying float edge;\n"+s.fragmentShader.replace("#include <clipping_planes_fragment>","#include <clipping_planes_fragment>\nif(edge>0.) discard;");
    };
    this.cover=new T.Mesh(new T.SphereGeometry(R+4,144,96).rotateY(-Math.PI/2),material);
    this.group.add(this.cover);this.group.visible=false;
  }
  open(eye:T.Vector3,reduced:boolean){
    this.axis.value.copy(eye).normalize();this.opening=this.reveal.value=reduced?1:0;
    this.cover.visible=!reduced;this.group.visible=true;
  }
  close(){this.clearAnchor();this.group.visible=false;this.reset();this.slow=false;this.selected="";
    for(const m of this.surfaces){m.scale.setScalar(1);m.material.color.setScalar(1);}
    this.lifts.clear();
  }
  reset(){this.playing=false;this.progress=0;for(const m of this.surfaces)m.setTime(0);}
  play(){if(this.progress>=1)this.reset();this.playing=!this.playing;}
  tick(dt:number,reduced:boolean){
    if(!this.group.visible)return;
    if(this.opening<1){
      this.opening=reduced?1:Math.min(1,this.opening+dt/1.65);
      this.reveal.value=smooth(this.opening);this.cover.visible=this.opening<1;
    }
    if(this.playing){this.progress=clamp(this.progress+dt/(this.slow?26:9),0,1);
      if(this.progress===1)this.playing=false;
      for(const m of this.surfaces)m.setTime(this.progress);
    }
    for(const m of this.surfaces){
      const selected=m.name===this.selected,goal=selected?1:0,old=this.lifts.get(m.name)??0;
      const lift=reduced?goal:old+Math.sign(goal-old)*Math.min(Math.abs(goal-old),dt*3);
      if(lift!==old){this.lifts.set(m.name,lift);m.scale.setScalar(1+.014*lift);}
      m.material.color.setScalar(!this.selected?1:selected?1.18:.64);
    }
  }
  pick(ray:T.Raycaster){return ray.intersectObjects(this.surfaces,false)[0];}
  private tracked?: {mesh: PlateSurface; face:T.Face; weights:T.Vector3};
  clearAnchor() { this.tracked=undefined; }
  track(hit:T.Intersection) {
    if (!hit.face) return;
    const mesh=this.surfaces.find(m=>m===hit.object);
    if (!mesh) return;
    const {a,b,c}=hit.face, weights=new T.Vector3();
    T.Triangle.getBarycoord(mesh.worldToLocal(hit.point.clone()),mesh.getVertexPosition(a,new T.Vector3()),
      mesh.getVertexPosition(b,new T.Vector3()),mesh.getVertexPosition(c,new T.Vector3()),weights);
    this.tracked={mesh,face:hit.face,weights};
  }
  get annotationPose() { return this.selected ? this.progress+(this.lifts.get(this.selected)??0)*2 : 0; }
  anchor() {
    if (!this.tracked || this.tracked.mesh.name!==this.selected) return undefined;
    const {mesh,face,weights}=this.tracked;
    const point=mesh.getVertexPosition(face.a,new T.Vector3()).multiplyScalar(weights.x);
    point.addScaledVector(mesh.getVertexPosition(face.b,new T.Vector3()),weights.y);
    point.addScaledVector(mesh.getVertexPosition(face.c,new T.Vector3()),weights.z);
    return mesh.localToWorld(point);
  }
  diagnostics(){
    const anchors:Record<string,number[]>={}, rotations:Record<string,number>={};
    for(const m of this.surfaces){
      rotations[m.name]=m.turn.value;
      const v=m.getVertexPosition(this.probes.get(m.name)!,new T.Vector3());anchors[m.name]=v.applyQuaternion(m.quaternion).toArray();
    }
    return {opening:this.opening,progress:this.progress,playing:this.playing,visible:this.group.visible,anchors,rotations,
      // Screen probes use the displayed material, including the lifted plate.
      selectedScale:this.surfaces.find(m=>m.name===this.selected)?.scale.x??1};
  }
}
