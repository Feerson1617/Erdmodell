import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { localAsset } from "../assets";
import { sites, type Process, type Site } from "./boundaries";

export type Theme="earthquake"|"volcano"|"risk"|"forces"|"lithosphere"|"magnet";
export type RegionSpec={site?:Site; name:string; process:Process; lat:number;lon:number; strike:number; azimuth?:number; theme:Theme};
export const reference=(site:Site,theme:Theme):RegionSpec=>({...sites[site],site,process:sites[site].process as Process,theme});
export const phases=[0,.34,.49,.68,1];
const clamp=T.MathUtils.clamp;
function ramp(a:number,b:number,x:number){return T.MathUtils.smoothstep(x,a,b);}
function mesh(geometry:T.BufferGeometry,material:T.Material,name:string){
  const object=new T.Mesh(geometry,material);object.name=name;return object;
}
function path(points:T.Vector3[],color:number,name:string){
  const line=new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color}));line.name=name;return line;
}
function indexed(rows:number,cols:number,vertex:(i:number,j:number)=>number[],reverse=false) {
  const pos=[],uv=[],index=[];
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
    const [x,y,z,u,v]=vertex(i,j);pos.push(x,y,z);uv.push(u,v);
    if(i<cols && j<rows){const a=j*(cols+1)+i,b=a+cols+1;
      if(reverse)index.push(a,a+1,b,a+1,b+1,b);else index.push(a,b,a+1,a+1,b,b+1);}
  }
  const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(pos,3));
  g.setAttribute("uv",new T.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();return g;
}
const numberTypes:Record<Process,number>={transform:0,oceanTransform:0,subduction:1,arc:1,ridge:2,rift:3,collision:4,convergence:4,complex:0,hotspot:5};
const rockShader=`
float grain(vec3 p){return sin(p.x*9.3+sin(p.z*3.2)+p.y*3.)*.5+sin(p.x*26.+p.y*14.+p.z*13.)*.22+sin(p.z*57.+p.x*43.)*.08;}
float slipped(vec3 p){float front=smoothstep(0.,.105,t-.35-.022*length(p-vec3(0.,focus,0.)));return front;}
vec3 offsetRock(vec3 p,float side){
 float load=smoothstep(0.,.35,t);
 float release=slipped(p);float nearFault=exp(-abs(p.x)*.85);
 float drift=side*.33*load*(1.-nearFault+nearFault*release);
 float d=length(p-vec3(0.,focus,0.));float age=(t-.43)*19.-d;
 float shake=age>0.?sin(age*10.)*exp(-age*1.5)*.055/(1.+.14*d):0.;
 vec3 offset=vec3(0.,shake,0.);
 if(kind<.5)offset.z+=sense*drift;
 else if(kind<1.5){offset.x-=drift*.55;offset.y+=vertical*release*.44*exp(-pow((p.x+.65)*.91,2.));}
 else if(kind<3.5){offset.x+=drift*.68;offset.y-=load*.21*exp(-p.x*p.x*2.);}
 else if(kind<4.5){offset.x-=drift*.68;offset.y+=load*.34*exp(-p.x*p.x*.45);}
 return offset;
}
`;
export class RegionalScene {
  readonly scene=new T.Scene();
  readonly camera=new T.PerspectiveCamera(38,1,.02,120);
  readonly orbit:OrbitControls;
  readonly front=new T.Group();readonly section=new T.Group();readonly labels=new T.Group();
  readonly witnesses=new T.Group();readonly settlement=new T.Group();readonly mechanisms=new T.Group();
  private ui={t:{value:0},kind:{value:0},focus:{value:-1},vertical:{value:1},clock:{value:0},stress:{value:0},sense:{value:1}};
  private groundData?:Int16Array;private colorMap?:T.Texture;
  private waves:T.Line[]=[];private particles:T.InstancedMesh[]=[];private fault!:T.Line;private rupture!:T.Line;
  private waterColumn?:T.Mesh; private nearSurface=0;private rockMaterial:T.Material[]=[];
  private people:T.Mesh[]=[];private route?:T.Line;private motion:((t:number)=>void)[]=[];
  progress=0;playing=false;slow=false;cut=false;names=false;vertical=true;stress=false;
  protection=false;exposure="dense";ready=false;error="";private disposed=false;private age=0;
  constructor(readonly spec:RegionSpec,canvas:HTMLCanvasElement){
    this.orbit=new OrbitControls(this.camera,canvas);this.orbit.target.set(0,0,0);
    this.orbit.enablePan=false;this.orbit.minDistance=4;this.orbit.maxDistance=22;this.orbit.maxPolarAngle=1.49;
    this.scene.background=new T.Color(0xa4c0c5);this.scene.fog=new T.FogExp2(0xa4c0c5,.029);
    this.scene.add(new T.HemisphereLight(0xfff6dd,0x8b9da2,2.05));
    const sun=new T.DirectionalLight(0xffdda9,2.5);sun.position.set(-6,9,5);this.scene.add(sun,this.front,this.section,this.witnesses,this.settlement,this.mechanisms);
    if(spec.azimuth!==undefined)this.ui.sense.value=Math.cos((spec.azimuth-spec.strike)*Math.PI/180)>=0?1:-1;
    this.vertical=spec.process!=="oceanTransform";this.ui.kind.value=numberTypes[spec.process];this.reframe(false);
  }
  reframe(cut:boolean){this.cut=cut;this.camera.position.set(cut?1.3:3.4,cut?2.1:4.5,cut?8.4:7.4);
    this.orbit.target.set(0,cut?-.68:0,cut?-.6:-.5);this.orbit.update();}
  height(x:number,z:number){
    if(this.groundData){
      const u=clamp((x/12+.5)*192,0,192),v=clamp((z/9+.5)*144,0,144);
      const i=Math.min(191,Math.floor(u)),j=Math.min(143,Math.floor(v)),f=u-i,g=v-j,h=this.groundData;
      const m=(1-g)*((1-f)*h[j*193+i]+f*h[j*193+i+1])+g*((1-f)*h[(j+1)*193+i]+f*h[(j+1)*193+i+1]);
      return m/1000/(sites[this.spec.site!].width/12)*(this.spec.site==="japan"?4.7:2.4);
    }
    const k=this.spec.process,terrain=.09*Math.sin(x*2+z*.8)*Math.cos(z*1.4);
    if(k==="ridge"||k==="oceanTransform")return -.8+(k==="ridge"?.5*Math.exp(-x*x):0)+terrain;
    if(k==="subduction"||k==="arc")return -.45-.42*Math.exp(-x*x)+.88*Math.exp(-Math.pow((x+3)*.8,2))+terrain;
    return .15+terrain+(k==="collision"?.7*Math.exp(-x*x*.45):k==="rift"?-.3*Math.exp(-x*x):0);
  }
  async init(){
    if(this.spec.site){
      const base="data/g5/terrain/"+this.spec.site;
      const [response,tex]=await Promise.all([fetch(localAsset(base+".i16")),new T.TextureLoader().loadAsync(localAsset(base+".webp"))]);
      if(this.disposed){tex.dispose();return;}
      if(!response.ok)throw Error("Höhendaten fehlen");
      const heights=new Int16Array(await response.arrayBuffer());if(heights.length!==193*145)throw Error("Höhenraster unvollständig");
      if(this.disposed){tex.dispose();return;}this.groundData=heights;this.colorMap=tex;tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;
    }
    this.nearSurface=this.height(0,0);this.ui.focus.value=this.nearSurface-1.18;
    this.buildSurface();this.buildQuake();this.buildExtras();this.ready=true;this.update(0);
  }
  private rock(surface:boolean,side:number){
    const mat=new T.MeshStandardMaterial({color:surface?(this.colorMap?0xffffff:0x87936e):0xcb9873,
      roughness:surface?.81:.96,metalness:0,map:surface?this.colorMap:undefined,side:T.DoubleSide});
    mat.customProgramCacheKey=()=>String(surface)+String(side);
    mat.onBeforeCompile=s=>{
      Object.assign(s.uniforms,this.ui);s.uniforms.sideOfFault={value:side};
      s.vertexShader="uniform float t,kind,focus,vertical,sense,sideOfFault; varying vec3 rockPos;"+rockShader+s.vertexShader;
      s.vertexShader=s.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nrockPos=position;transformed+=offsetRock(position,sideOfFault);");
      s.fragmentShader="uniform float t,kind,stress,vertical,sense,focus; varying vec3 rockPos;"+rockShader+s.fragmentShader;
      const pigment=surface?`diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.37,.32,.19),.075);diffuseColor.rgb*=1.+.055*grain(rockPos);`:
        `float x=rockPos.x,y=rockPos.y;
        float fold=.13*sin(x*1.8)+.07*sin(x*3.1);
        if(kind>3.5 && kind<4.5)fold+=.36*cos(x*2.)*exp(-x*x*.23);
        float rockgrain=grain(rockPos*1.7);float stratum=sin((y+fold)*17.+sin(x*.8)+.34*rockgrain);
        vec3 bed=mix(vec3(.21,.145,.115),vec3(.55,.36,.23),.5+.5*stratum);
        bed=mix(bed,vec3(.28,.32,.30),smoothstep(.7,.94,sin((y+fold)*7.3)));
        if(kind>.5 && kind<1.5){float slab=abs(y-(focus+x*.64));bed=mix(bed,vec3(.12,.22,.24),1.-smoothstep(.08,.18,slab));}
        diffuseColor.rgb=bed*(1.+.11*grain(rockPos));`;
      s.fragmentShader=s.fragmentShader.replace("#include <map_fragment>","#include <map_fragment>\n"+pigment+
        "diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.82,.33,.11),stress*.47*smoothstep(0.,.34,t)*(1.-slipped(rockPos))*exp(-abs(rockPos.x)));");
    };
    this.rockMaterial.push(mat);return mat;
  }
  private buildSurface(){
    for(const side of [-1,1]){
      const terrain=this.rock(true,side),section=this.rock(false,side);
      for(const front of [false,true]){
        const g=indexed(72,96,(i,j)=>{const x=(side<0?-6:0)+i/16,z=(front?0:-4.5)+j/16;return [x,this.height(x,z),z,x/12+.5,.5-z/9];});
        (front?this.front:this.scene).add(mesh(g,terrain,"Gelände"));
      }
      const wall=indexed(36,96,(i,j)=>{const x=(side<0?-6:0)+i/16,y=T.MathUtils.lerp(-7.5,this.height(x,0),j/36);
        return [x,y,0,i/96,j/36];},true);
      this.section.add(mesh(wall,section,"Geologischer Schnitt"));
    }
    if(this.spec.site==="japan"||this.spec.site==="hawaii"||this.spec.site==="island"||["oceanTransform","subduction","arc","ridge"].includes(this.spec.process)){
      for(const front of [false,true]){
        const g=indexed(42,112,(i,j)=>{const x=-6+12*i/112,z=(front?0:-4.5)+4.5*j/42;return [x,0,z,i/112,j/42];});
        const water=new T.MeshStandardMaterial({color:0x287a88,roughness:.29,metalness:.16,transparent:true,opacity:.78,side:T.DoubleSide,depthWrite:false});
        water.onBeforeCompile=s=>{Object.assign(s.uniforms,this.ui);
          s.vertexShader="uniform float t,clock,vertical,kind;varying float crest;\n"+s.vertexShader;
          s.vertexShader=s.vertexShader.replace("#include <begin_vertex>",`#include <begin_vertex>
          float d=abs(position.x+.55);float passage=(t-.48)*15.-d;
          float longwave=exp(-pow(passage*1.2,2.))-.46*exp(-pow((passage-.95)*1.15,2.));
          float start=smoothstep(.41,.49,t);float uplift=exp(-pow((position.x+.55)*1.25,2.))*(1.-smoothstep(.48,.58,t));
          crest=vertical*step(.5,kind)*(1.-step(1.5,kind))*start*(uplift+longwave)*(.14+.10*smoothstep(2.,4.,-position.x));
          transformed.y+=crest+.009*sin(position.x*5.+position.z*2.+clock)*cos(position.z*3.4-clock*.7);`);
          s.fragmentShader="varying float crest;\n"+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace("#include <color_fragment>","#include <color_fragment>\ndiffuseColor.rgb+=vec3(.24,.28,.2)*max(0.,crest)*2.;");};
        (front?this.front:this.scene).add(mesh(g,water,"Wasseroberfläche"));
      }
      this.waterColumn=mesh(new T.CylinderGeometry(.22,.22,1,24),new T.MeshBasicMaterial({color:0x66dacf,transparent:true,opacity:.36}),"Verdrängte Wassersäule");this.section.add(this.waterColumn);
    }
  }
  private buildQuake(){
    const focus=this.ui.focus.value;
    const origin=new T.Vector3(0,focus,.055),epic=new T.Vector3(0,this.nearSurface+.015,.055);
    this.section.add(this.labels);this.labels.add(path([origin,epic],0xe7dfb5,"Lot"));
    for(const [p,color,name] of [[origin,0xff975e,"Hypozentrum"],[epic,0xffedbd,"Epizentrum"]] as const){
      const pin=mesh(new T.SphereGeometry(.095,16,12),new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.2}),name);pin.position.copy(p);this.labels.add(pin);}
    const dip=this.ui.kind.value===1?.64:(this.ui.kind.value===3?-1.3:0);
    const x=dip?-1.4/dip:0;const emergence=dip?new T.Vector3(1.18/dip,this.nearSurface,.055):epic;
    this.fault=path([new T.Vector3(x,focus-1.4,.03),origin,emergence],0x342f2e,"Störungsfläche");this.section.add(this.fault);
    this.rupture=path([new T.Vector3(),new T.Vector3()],0xffcf89,"Bruchfront");this.section.add(this.rupture);
    for(const [index,color] of [0xe7b96d,0x5bc4cb].entries()){
      const line=path(Array.from({length:121},()=>new T.Vector3()),color,index?"S-Welle":"P-Welle");this.waves.push(line);this.section.add(line);
      const beads=new T.InstancedMesh(new T.SphereGeometry(.035,6,5),new T.MeshBasicMaterial({color}),32);beads.frustumCulled=false;this.particles.push(beads);this.section.add(beads);
    }
  }
  private buildExtras(){
    this.extraBuilder?.(this);
  }
  extraBuilder?: (region:RegionalScene)=>void;
  onAnimate(fn:(progress:number)=>void){this.motion.push(fn);}
  step(direction=1){this.playing=false;this.progress=direction>0?(phases.find(v=>v>this.progress+.002)??1):([...phases].reverse().find(v=>v<this.progress-.002)??0);}
  update(dt:number){
    this.age+=dt;if(this.playing){this.progress=Math.min(1,this.progress+dt/(this.slow?32:14));if(this.progress===1)this.playing=false;}
    if(!this.ready)return;
    const t=this.progress;this.ui.t.value=t;this.ui.clock.value=this.age;this.ui.stress.value=+this.stress;
    this.ui.vertical.value=+this.vertical;
    this.ui.kind.value=this.spec.theme==="earthquake"&&["subduction","arc","oceanTransform"].includes(this.spec.process)?(this.vertical?1:0):numberTypes[this.spec.process];this.front.visible=!this.cut;this.section.visible=this.cut;
    this.labels.visible=this.names && this.spec.theme==="earthquake";
    const quake=this.spec.theme==="earthquake"||this.spec.theme==="risk";this.fault.visible=quake;
    this.rupture.visible=quake&&t>.35&&t<.53;
    const faultX=this.ui.kind.value===1?-1:0;
    const u=ramp(.35,.47,t);
    this.rupture.geometry.setFromPoints([new T.Vector3(0,this.ui.focus.value,.07),new T.Vector3(faultX*u,this.ui.focus.value-1.2*u,.07)]);
    for(let n=0;n<2;n++){
      const speed=n?12:19,rad=Math.max(0,(t-.45)*speed),line=this.waves[n],beads=this.particles[n];
      line.visible=beads.visible=quake&&t>.45&&t<.94;const arr=line.geometry.attributes.position as T.BufferAttribute;
      for(let i=0;i<arr.count;i++){
        const a=i/(arr.count-1)*Math.PI*2,x=rad*Math.cos(a),y=this.ui.focus.value+rad*Math.sin(a);
        arr.setXYZ(i,x,Math.min(this.height(x,0)-.018,y),.081+n*.012);
      }arr.needsUpdate=true;line.frustumCulled=false;
      const dummy=new T.Object3D();for(let i=0;i<32;i++){const along=.14+i*.14,phase=along-rad;
        const v=.09*Math.sin(phase*12)*Math.exp(-phase*phase*5);dummy.position.set(along+(n?0:v),this.ui.focus.value-.28*n+(n?v:0),.095);dummy.updateMatrix();beads.setMatrixAt(i,dummy.matrix);}
      beads.instanceMatrix.needsUpdate=true;
    }
    if(this.waterColumn){const x=-.55,h=this.height(x,0);this.waterColumn.visible=quake&&this.vertical&&this.ui.kind.value===1&&h<-.05&&t>.38&&t<.62;
      this.waterColumn.scale.y=Math.max(.03,-h+.19*ramp(.4,.5,t));this.waterColumn.position.set(x,h+this.waterColumn.scale.y/2,.05);}
    for(const fn of this.motion)fn(t);this.orbit.update();
  }
  get focus(){return [0,this.ui.focus.value,0];}
  get epicenter(){return [0,this.nearSurface,0];}
  dispose(){
    this.disposed=true;this.orbit.dispose();const gs=new Set<T.BufferGeometry>(),ms=new Set<T.Material>();
    this.scene.traverse(o=>{const m=o as T.Mesh;if(m.geometry)gs.add(m.geometry);if(m.material)for(const a of Array.isArray(m.material)?m.material:[m.material])ms.add(a);});
    for(const g of gs)g.dispose();for(const m of ms)m.dispose();this.colorMap?.dispose();
  }
}
