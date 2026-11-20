import * as T from "three";
import centres from "./labels.json";
import {BoundaryComparison} from "./comparison";
import type {Step} from "./atlas";
import { position, R, RAD, clamp, smooth } from "../geo";

export type SurfaceData = Record<string,{pole:number[];vertices:number[];triangles:number[];rim:number[]}>;
const palette = [0xa8b99a,0xc5a385,0x84acb0,0xbbad83,0x899db3,0xb7959d,0x9dae85,0x96b3a8,0xb5a1b6,0xc2b18e];
export class PlateMosaic {
  readonly group = new T.Group();
  readonly surfaces:T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>[]=[];
  readonly extents=new Map<string,number>();
  private readonly colors:Record<string,number>={};
  private readonly poles=new Map<string,number[]>();
  private toneKey?:string;
  pair?:BoundaryComparison;
  private leaving?:BoundaryComparison;
  private fade=0;
  private readonly cover:T.Mesh<T.SphereGeometry,T.MeshStandardMaterial>;
  private readonly reveal={value:0};
  private readonly axis={value:new T.Vector3()};
  opening=0;
  progress=0;
  playing=false;
  slow=false;
  selected="";
  constructor(data:SurfaceData, map:T.Texture, neighbours:Map<string,Set<string>>) {
    const colors=this.colors;
    // Neighbouring polygons must remain distinguishable even around microplates.
    for(const code of Object.keys(data).sort((a,b)=>(neighbours.get(b)?.size??0)-(neighbours.get(a)?.size??0))){
      const used=new Set([...neighbours.get(code)??[]].map(n=>colors[n]));
      const hash=code.charCodeAt(0)*11+code.charCodeAt(1);
      colors[code]=palette.map((_,i)=>palette[(i+hash)%palette.length]).find(c=>!used.has(c))??palette[0];
    }
    for (const [code,plate] of Object.entries(data)){
      this.poles.set(code,plate.pole);
      const [lon0,lat0]=centres[code as keyof typeof centres];
      const centre=position(lat0,lon0).normalize();
      let radius=0;
      const xyz:number[]=[],normals:number[]=[],uv:number[]=[],tones:number[]=[],indices=[...plate.triangles];
      const base=new T.Color(colors[code]), rock=new T.Color(),v=new T.Vector3();
      for(let i=0;i<plate.vertices.length;i+=3){
        const lon=plate.vertices[i]/1e5,lat=plate.vertices[i+1]/1e5,dist=plate.vertices[i+2]/1e4;
        v.copy(position(lat,lon)).normalize();normals.push(v.x,v.y,v.z);
        radius=Math.max(radius,centre.angleTo(v));
        const surfaceRadius=R-4;
        xyz.push(v.x*surfaceRadius,v.y*surfaceRadius,v.z*surfaceRadius);
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
            v.fromArray(xyz,3*id).multiplyScalar(1-depth);xyz.push(v.x,v.y,v.z);
            normals.push(n.x,n.y,n.z);uv.push(uv[2*id],uv[2*id+1]);rock.copy(base).multiplyScalar(shade);tones.push(rock.r,rock.g,rock.b);
          }
        }
        for(let j=0;j<3;j++){const k=start+2*j;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
      }
      const geom=new T.BufferGeometry();
      for(const [name,array,size] of [["position",xyz,3],["normal",normals,3],["uv",uv,2],["color",tones,3]] as const)
        geom.setAttribute(name,new T.Float32BufferAttribute(array,size));
      geom.setIndex(indices);
      const mat=new T.MeshStandardMaterial({map,vertexColors:true,roughness:.92,side:T.DoubleSide});
      mat.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace("#include <map_fragment>",`
        vec3 relief = texture2D(map, vMapUv).rgb;
        float tone = dot(relief, vec3(0.21,0.72,0.07));
        diffuseColor.rgb *= (0.53 + 1.08 * sqrt(tone));
      `);};
      const mesh=new T.Mesh(geom,mat);mesh.name=code;this.surfaces.push(mesh);this.group.add(mesh);this.extents.set(code,radius);
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
  close(){
    this.clearAnchor();this.endPair();this.leaving?.dispose();this.leaving=undefined;this.group.visible=false;this.slow=false;this.selected="";
  }
  beginPair(step:Step) {
    this.endPair();
    const codes=[step[1].slice(0,2),step[1].slice(-2)];
    this.pair=new BoundaryComparison(step,codes.map(c=>this.poles.get(c)!),codes.map(c=>new T.Color(this.colors[c])));
    this.group.add(this.pair.group);
    this.reset();
    return this.pair;
  }
  endPair(transition=false){
    if(this.pair){
      this.leaving?.dispose();this.leaving=undefined;
      if(transition){this.leaving=this.pair;this.fade=1;}else this.pair.dispose();
    }
    this.pair=undefined;this.progress=0;this.playing=false;
  }
  reset(){this.progress=0;this.playing=false;this.pair?.setTime(0);}
  play(){if(!this.pair)return;if(this.progress>=1)this.reset();this.playing=!this.playing;}
  tick(dt:number,reduced:boolean,travelling:boolean){
    if(!this.group.visible)return;
    if(this.leaving){
      this.fade=reduced?0:Math.max(0,this.fade-dt/.35);
      this.leaving.fadeOut(this.fade);
      if(!this.fade){this.leaving.dispose();this.leaving=undefined;}
    }
    if(this.opening<1){
      this.opening=reduced?1:Math.min(1,this.opening+dt/1.65);
      this.reveal.value=smooth(this.opening);this.cover.visible=this.opening<1;
    }
    if(this.playing && !travelling){this.progress=clamp(this.progress+dt/(this.slow?26:9),0,1);
      if(this.progress===1)this.playing=false;
      this.pair?.setTime(this.progress);
    }
    const toneKey=this.selected+"/"+(this.pair?.step[0]??"");
    if(this.toneKey===toneKey)return;
    this.toneKey=toneKey;
    for(const m of this.surfaces){
      const active=this.pair ? this.pair.bodies.some(body=>body.name===m.name) : m.name===this.selected;
      m.material.color.setScalar(!this.selected && !this.pair ? 1 : active ? 1.15 : .67);
    }
  }
  pick(ray:T.Raycaster){return ray.intersectObjects(this.surfaces,false)[0];}
  private tracked?: {mesh: T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>; face:T.Face; weights:T.Vector3};
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
  get annotationPose() { return this.progress; }
  anchor() {
    if (!this.tracked || this.tracked.mesh.name!==this.selected) return undefined;
    const {mesh,face,weights}=this.tracked;
    const point=mesh.getVertexPosition(face.a,new T.Vector3()).multiplyScalar(weights.x);
    point.addScaledVector(mesh.getVertexPosition(face.b,new T.Vector3()),weights.y);
    point.addScaledVector(mesh.getVertexPosition(face.c,new T.Vector3()),weights.z);
    return mesh.localToWorld(point);
  }
  diagnostics(camera:T.Camera,width:number,height:number){
    return {opening:this.opening,progress:this.progress,playing:this.playing,visible:this.group.visible,
      pair:this.pair?.diagnostics(camera,width,height) ?? null};
  }
}
