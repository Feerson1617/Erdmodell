import {seaMaterial,waterSection,seabed} from "./sea-material";
import {LocalLandscape,localView} from "./local-landscape";
import {loadTexture,materials,decorateTerrain,quality,graphics,type Library} from "./graphics";
import {coastalSand,coastalGrass} from "./coast-appearance";
import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import zao from "./zao.json";
import traces from "./traces.json";
import { localAsset } from "../assets";
import { sites, referenceGeology, type Geology, type Process, type Site } from "./boundaries";

import { WaterSection } from "./water";
import { waveAnalysis } from "./wavefronts";
import { Fault, onset, pSpeed, sSpeed } from "./fault";
import { geologySolids } from "./sections";
let globalWindows:Promise<Int16Array>|undefined;
export type Theme="process"|"earthquake"|"volcano"|"risk"|"forces"|"lithosphere"|"magnet";
export type RegionSpec={site?:Site; name:string; process:Process; lat:number;lon:number; strike:number; azimuth?:number; geology?:Geology; comparison?:RegionSpec;event?:"uplift"|"strike"|"buried";coastLesson?:boolean;arcTransect?:boolean;width?:number; theme:Theme};
export const reference=(site:Site,theme:Theme):RegionSpec=>({...sites[site],...(site==="japan"&&theme==="volcano"?{...zao,arcTransect:true}:{}),site,event:site==="japan"&&theme==="earthquake"?"uplift":undefined,geology:referenceGeology(site),process:sites[site].process as Process,theme});
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
export class RegionalScene {
  local?:LocalLandscape;
  get localActive(){return localView(this.view)&&!!this.local;}
  get renderScene(){return this.localActive?this.local!.scene:this.scene;}
  lib?:Library;readonly grade={value:quality()};private relief?:T.Texture;
  private sunlight=new T.DirectionalLight(0xffe9d0,2.17);private shadowState="";private terrainLOD:((distance:number,grade:number)=>void)[]=[];
  prepareRender(renderer:T.WebGLRenderer){
    if(!this.lib)return;
    const q=this.grade.value=quality();
    if(this.localActive){this.local!.update(this.camera,this.progress,q);renderer.shadowMap.needsUpdate=true;return;}
    this.sunlight.castShadow=q>0;const size=[512,1024,2048][q],shadow=this.sunlight.shadow;
    const samples=4;for(const tex of [this.lib.color,this.lib.relief,this.colorMap,this.relief,this.contextMap]){
      if(tex&&tex.anisotropy!==samples){tex.anisotropy=samples;tex.needsUpdate=true;}
    }
    if(shadow.mapSize.x!==size){shadow.map?.dispose();shadow.map=null;shadow.mapSize.set(size,size);}
    this.terrainLOD.forEach(fn=>fn(this.orbit.getDistance(),q));
    const key=[graphics.revision,Math.floor(this.progress*10),this.cut,this.viewSettled].join("-");
    if(key!==this.shadowState){renderer.shadowMap.needsUpdate=true;this.shadowState=key;}
  }
  readonly scene=new T.Scene();
  readonly camera=new T.PerspectiveCamera(38,1,.02,120);
  readonly orbit:OrbitControls;
  readonly front=new T.Group();readonly section=new T.Group();readonly labels=new T.Group();
  readonly witnesses=new T.Group();readonly settlement=new T.Group();readonly mechanisms=new T.Group();
  private ui={t:{value:0},kind:{value:0},focus:{value:-1},vertical:{value:1},clock:{value:0},stress:{value:0},sense:{value:1},opening:{value:0}};
  private contextHeights?:Int16Array;private groundData?:Int16Array;private colorMap?:T.Texture;private normalMap?:T.Texture;private roughMap?:T.Texture;private sky:T.CanvasTexture;private contextMap?:T.Texture;private reveal=0;private transition?:{from:T.Vector3;to:T.Vector3;look:T.Vector3;goal:T.Vector3;fraction:number};
  faultModel!:Fault;private windows?:Int16Array;
  private solids:{g:T.BufferGeometry;base:Float32Array;side:number;waterSkin?:Float32Array;shear?:Float32Array;motionData:Float32Array;slice?:((index:number,z:number)=>number)}[]=[];private lastT=-1;private lastSection=false;
  readonly stressSignals={phase:{value:0},show:{value:0}};
  readonly deformed=new T.Vector3();
  bindRock(g:T.BufferGeometry,side:number,slice?:(index:number,z:number)=>number){
    const f=this.faultModel,coords=g.attributes.position,values=new Float32Array(coords.count*2),motionData=new Float32Array(coords.count*2);
    for(let i=0;i<coords.count;i++){const x=coords.getX(i),y=coords.getY(i),z=coords.getZ(i);
      values[i*2]=Math.exp(-Math.abs(x-f.xAt(y))*1.4-z*z*.09);
      motionData[2*i]=Math.hypot(x-f.hx,y-f.hy,z);motionData[2*i+1]=Math.exp(-Math.abs(x-f.xAt(y))*.94-z*z*.029);
      values[i*2+1]=onset+motionData[2*i]/16;}
    let waterSkin:Float32Array|undefined;
    if(this.water){waterSkin=new Float32Array(coords.count*2);for(let i=0;i<coords.count;i++){
      const x=coords.getX(i),depth=this.height(x,coords.getZ(i))-coords.getY(i);
      waterSkin[2*i]=1-T.MathUtils.smoothstep(depth,0,1.4);waterSkin[2*i+1]=this.height(x,0);
    }}
    // Slip is distributed through a narrow shear zone. Adjacent lithologies
    // therefore carry the same displacement at their shared contact.
    const shear=f.distributedSlip?Float32Array.from({length:coords.count},(_,i)=>
      T.MathUtils.smoothstep(Math.abs(coords.getY(i)-f.interfaceY(coords.getX(i))),0,.65)):undefined;
    g.setAttribute("coupling",new T.BufferAttribute(values,2));this.solids.push({g,side,slice,waterSkin,shear,motionData,base:new Float32Array(g.attributes.position.array)});(g.attributes.position as T.BufferAttribute).setUsage(T.DynamicDrawUsage);}
  physicalState(){
    const f=this.faultModel;if(!f)return {};
    const sample=this.solids.find(s=>s.side===1),i=sample?Math.floor(sample.base.length/6)*3:0;
    const coords=this.rupture.geometry.attributes.position;
    let maxPlaneError=0;if(this.rupture.visible)for(let j=0;j<coords.count;j++)maxPlaneError=Math.max(maxPlaneError,Math.abs(coords.getX(j)-f.xAt(coords.getY(j))));
    const distance=Math.hypot(this.epicenter[1]-f.hy,this.epicenter[0]-f.hx);
    const vertices=this.solids.map(({g,base,side})=>{
      const k=Math.floor(base.length/6)*3,a=Array.from(base.slice(k,k+3)),b=Array.from(g.attributes.position.array.slice(k,k+3));
      return {side,materialSide:f.distributedSlip?(a[1]>f.interfaceY(a[0])?f.dipSign:-f.dipSign):side,rest:a,drawn:b};
    });
    const cutFaces=this.solids.filter(s=>s.slice&&f.kind==="strike");
    let cutPlaneError=0;for(const s of cutFaces){const p=s.g.attributes.position;for(let i=0;i<p.count;i++)if(s.base[3*i+2]===0)cutPlaneError=Math.max(cutPlaneError,Math.abs(p.getZ(i)));}
    return {floodHistory:this.water?.shorelineHistory,waterProfile:this.water?Array.from({length:this.water.cells},(_,i)=>{const x=-6+i*this.water!.dx,t=this.progress;
      return {x,bed:this.water!.bed(x,t),eta:this.water!.sample(x,t),depth:this.water!.sample(x,t,true)};}):undefined,cutPlaneError,markerEnds:this.markerEnds,flood:this.water?.extent(this.progress),vertices,profilePoints:f.profile.map(([x,km])=>({x,km,y:f.interfaceY(x)})),sense:f.sense,maxPlaneError,focusError:Math.abs(f.hx-f.xAt(f.hy)),pArrival:onset+distance/pSpeed,sArrival:onset+distance/sSpeed,
      earlyShake:f.shaking(onset+distance/pSpeed-.002,f.hx,this.epicenter[1],0),lateShake:f.shaking(1,f.hx,this.epicenter[1],0),fault:f.kind,trace:f.trace,dipSign:f.dipSign,profile:f.profile.length,waterEvent:f.waterEvent,waterSurface:this.water?.sample(f.hx,this.progress)??0,waterSignals:this.water?[0,.48,.58,.72,.88,1].map(t=>[t,this.water!.sample(f.hx,t),this.water!.sample(-4,t)]):[],
      rupture:this.rupture.visible?Array.from(this.rupture.geometry.attributes.position.array):[],waveFronts:this.waves.map(w=>w.visible),
      vertex:sample?{rest:Array.from(sample.base.slice(i,i+3)),drawn:Array.from(sample.g.attributes.position.array.slice(i,i+3)),side:sample.side}:null};
  }
  facies=false;readonly sectionColor={value:0};
  analysis=false;readonly timings:Record<string,number>={};
  view="land";vectors=false;riskSite="near";markerEnds:number[][]=[];
  showP=true;showS=true;detail=false;phasesShown=false;water?:WaterSection;private waves:T.Mesh[]=[];private fault!:T.Line;private rupture!:T.Line;
  private waterColumn?:T.Mesh; private nearSurface=0;private rockMaterial:T.Material[]=[];
  private people:T.Mesh[]=[];private route?:T.Line;private motion:((t:number)=>void)[]=[];
  progress=0;playing=false;slow=false;cut=false;names=false;vertical=true;stress=false;
  soil="rock";eruption="effusive";coastal=false;protection=false;safeRoute=false;warning=false;relocate=false;exposure="dense";ready=false;error="";private disposed=false;private age=0;
  constructor(readonly spec:RegionSpec,canvas:HTMLCanvasElement){
    this.orbit=new OrbitControls(this.camera,canvas);this.orbit.target.set(0,0,0);
    this.orbit.addEventListener("start",()=>{this.transition=undefined;});this.orbit.enablePan=false;this.orbit.minDistance=4;this.orbit.maxDistance=22;this.orbit.maxPolarAngle=1.49;
    const sky=document.createElement("canvas");sky.width=2;sky.height=256;
    const ctx=sky.getContext("2d")!,grad=ctx.createLinearGradient(0,0,0,256);
    grad.addColorStop(0,"#48769c");grad.addColorStop(.43,"#b6d1da");grad.addColorStop(.64,"#d8d7be");grad.addColorStop(1,"#829b9b");ctx.fillStyle=grad;ctx.fillRect(0,0,2,256);
    this.sky=new T.CanvasTexture(sky);this.sky.colorSpace=T.SRGBColorSpace;this.scene.background=this.sky;this.scene.fog=new T.FogExp2(0xacc5cb,.026);
    this.scene.add(new T.HemisphereLight(0xf0f5ff,0xa69a83,1.79));
    const sun=this.sunlight;sun.position.set(-7,6,3);Object.assign(sun.shadow.camera,{left:-8,right:8,top:7,bottom:-7,near:.1,far:26});sun.shadow.camera.updateProjectionMatrix();sun.shadow.normalBias=.008;sun.shadow.bias=-.0003;this.scene.add(sun,this.front,this.section,this.witnesses,this.settlement,this.mechanisms);
    if(spec.azimuth!==undefined)this.ui.sense.value=Math.cos((spec.azimuth-spec.strike)*Math.PI/180)>=0?1:-1;
    this.vertical=["arc","subduction"].includes(spec.process);this.reframe(false);
  }
  private envelope?:T.DataTexture;
  get rockCeiling(){
    if(!this.envelope){
      const cols=193,rows=145,values=new Float32Array(cols*rows);
      for(let j=0;j<rows;j++)for(let i=0;i<cols;i++)values[j*cols+i]=this.height(i/16-6,j/16-4.5);
      this.envelope=new T.DataTexture(values,cols,rows,T.RedFormat,T.FloatType);
      this.envelope.needsUpdate=true;
    }
    return this.envelope;
  }
  isGeologyVisible(hit:T.Intersection){
    const obj=hit.object as T.Mesh,rest=obj.geometry?.getAttribute("geologyCoord"),face=hit.face,b=hit.barycoord;
    if(!rest||!face||!b||obj.geometry.hasAttribute("sectionU"))return true;
    const at=(axis:"getX"|"getY"|"getZ")=>rest[axis](face.a)*b.x+rest[axis](face.b)*b.y+rest[axis](face.c)*b.z;
    const z=at("getZ");
    return Math.abs(z)<.002 || at("getY")<=this.height(at("getX"),z)-.015;
  }
  get opening(){return this.reveal;}
  get viewSettled(){return !this.transition && Math.abs(this.reveal-Number(this.cut))<.012;}
  reframe(cut:boolean){this.orbit.minDistance=4;this.orbit.maxDistance=22;this.camera.far=120;this.view=cut?"cut":"land";this.cut=cut;this.camera.position.set(cut?1.3:3.4,cut?2.1:4.5,cut?8.4:7.4);
    const goal=new T.Vector3(0,cut?-.68:0,cut?-.6:-.5),to=this.camera.position.clone();
    if(this.ready&&!matchMedia("(prefers-reduced-motion: reduce)").matches){this.camera.position.copy(this.lastCamera);this.transition={from:this.lastCamera.clone(),to,look:this.orbit.target.clone(),goal,fraction:0};}
    else this.orbit.target.copy(goal);this.orbit.update();}
  private lastCamera=new T.Vector3(3.4,4.5,7.4);
  height(x:number,z:number){
    if(this.groundData){
      const u=clamp((x/12+.5)*192,0,192),v=clamp((z/9+.5)*144,0,144);
      const i=Math.min(191,Math.floor(u)),j=Math.min(143,Math.floor(v)),f=u-i,g=v-j,h=this.groundData;
      const m=(1-g)*((1-f)*h[j*193+i]+f*h[j*193+i+1])+g*((1-f)*h[(j+1)*193+i]+f*h[(j+1)*193+i+1]);
      const edge=T.MathUtils.smoothstep(Math.max(Math.abs(x)/6,Math.abs(z)/4.5),.78,1);
      let blended=m;
      if(edge>0&&this.contextHeights){const cx=(x/48+.5)*144,cy=(z/36+.5)*108,a=Math.floor(cx),b=Math.floor(cy),u=cx-a,v=cy-b,hh=this.contextHeights,j=b*145+a;
        const far=(1-v)*((1-u)*hh[j]+u*hh[j+1])+v*((1-u)*hh[j+145]+u*hh[j+146]);blended=T.MathUtils.lerp(m,far,edge);}
      return blended/1000/((this.spec.width??sites[this.spec.site!].width)/12)*(this.spec.site==="japan"?4.7:2.4);
    }
    if(this.spec.coastLesson){
      const slope=-.48-.95*Math.tanh((x+2.45)*.85);
      return (slope>0?.26*slope:slope)+.42*Math.exp(-((x+4.95)**2)*1.3);
    }
    if(this.windows && this.spec.geology){
      const u=clamp((x/12+.5)*6,0,6),v=clamp((z/9+.5)*6,0,6),i=Math.min(5,Math.floor(u)),j=Math.min(5,Math.floor(v)),dx=u-i,dy=v-j;
      const h=this.windows,k=i+j*7;return .00024*((1-dy)*((1-dx)*h[k]+dx*h[k+1])+dy*((1-dx)*h[k+7]+dx*h[k+8]));
    }
    if(this.spec.theme==="forces")return .14+.52*Math.exp(-((x+3.8)**2)*1.2)-.43*Math.exp(-x*x*2);
    return .12+.08*Math.cos(x+z*.2);
  }
  async init(){
    const start=performance.now();
    if(this.spec.site){
      const base="data/g5/terrain/"+this.spec.site;
      const asset=(suffix:string)=>localAsset(this.spec.arcTransect?"data/g51/zao/"+(suffix===".i16"?"terrain.i16":suffix.slice(1)):base+suffix);
      const photo=["san","japan","island"].includes(this.spec.site)&&!this.spec.arcTransect;
      const region=this.spec.arcTransect?"zao":this.spec.site;
      const [response,tex,normal,rough,farHeight,farImage,lib,relief]=await Promise.all([fetch(asset(".i16")),photo?loadTexture(region+"-surface.webp",true):new T.TextureLoader().loadAsync(asset("-surface.webp")),new T.TextureLoader().loadAsync(asset("-normal.webp")),new T.TextureLoader().loadAsync(asset("-rough.webp")),fetch(asset("-context.i16")),photo?loadTexture(region+"-context.webp",true):new T.TextureLoader().loadAsync(asset("-context.webp")),materials(),loadTexture(region+"-relief.webp")]);
      if(this.disposed){tex.dispose();normal.dispose();rough.dispose();farImage.dispose();relief?.dispose();return;}
      if(!response.ok)throw Error("Höhendaten fehlen");
      const [heightBytes,contextBytes]=await Promise.all([response.arrayBuffer(),farHeight.arrayBuffer()]);const heights=new Int16Array(heightBytes);if(heights.length!==193*145)throw Error("Höhenraster unvollständig");
      if(this.disposed){tex.dispose();normal.dispose();rough.dispose();farImage.dispose();relief?.dispose();return;}this.lib=lib;this.relief=relief;this.sunlight.castShadow=!!lib;this.groundData=heights;this.colorMap=tex;this.normalMap=normal;this.roughMap=rough;normal.anisotropy=4;tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;this.contextMap=farImage;farImage.colorSpace=T.SRGBColorSpace;this.surround(new Int16Array(contextBytes),farImage);
    }
    if(!this.spec.site && this.spec.geology){
      globalWindows??=fetch(localAsset("data/g51/regional-relief.i16")).then(r=>{if(!r.ok)throw Error("Regionalraster fehlt");return r.arrayBuffer();}).then(b=>new Int16Array(b)).catch(e=>{globalWindows=undefined;throw e;});
      const heights=await globalWindows;if(this.disposed)return;
      const index=(this.spec.geology.id-1)*49;this.windows=heights.subarray(index,index+49);
    }
    if(!this.spec.site){this.lib=await materials();if(this.disposed)return;this.sunlight.castShadow=true;}
    this.timings.dataMs=performance.now()-start;const build=performance.now();
    this.faultModel=new Fault(this.spec,(x,z)=>this.height(x,z));if(this.faultModel.waterEvent)this.water=new WaterSection(this.faultModel);this.timings.solverMs=performance.now()-build;
    this.nearSurface=this.height(this.faultModel.hx,0);this.ui.focus.value=this.faultModel.hy;
    this.buildSurface();this.addVectors();this.addTrace();if(!this.spec.site)this.groundDetails();this.buildQuake();this.buildExtras();this.ready=true;this.update(0);this.timings.geometryMs=performance.now()-build-this.timings.solverMs;
  }
  get surfaceImage(){return this.colorMap;}
  private get metresPerUnit(){
    return this.spec.site?(this.spec.width??sites[this.spec.site].width)*1000/(12*(this.spec.site==="japan"?4.7:2.4)):36;
  }
  private surround(h:Int16Array,image:T.Texture){
    this.contextHeights=h;
    if(h.length!==145*109)throw Error("Das Landschaftsumfeld fehlt.");
    const gain=(this.spec.site==="japan"?4.7:2.4)*.012/(this.spec.width??sites[this.spec.site!].width);
    const terrain=new T.MeshStandardMaterial({map:image,roughness:.94,side:T.DoubleSide});
    seabed(terrain,this.metresPerUnit);
    const water=seaMaterial(this.ui.t,this.metresPerUnit);
    for(const front of [false,true])for(const [x0,x1,z0,z1] of [[-24,-6,0,18],[6,24,0,18],[-6,6,4.5,18]]){
      const parent=front?this.front:this.scene,cols=Math.ceil((x1-x0)*3),rows=Math.ceil((z1-z0)*4);
      const geometry=()=>indexed(rows,cols,(i,j)=>{
        const x=x0+i/cols*(x1-x0),z=(front?1:-1)*(z0+j/rows*(z1-z0)),u=x/48+.5,v=z/36+.5;
        const fx=u*144,fy=v*108,a=Math.min(143,Math.floor(fx)),b=Math.min(107,Math.floor(fy)),dx=fx-a,dy=fy-b;
        let y=gain*((1-dy)*((1-dx)*h[b*145+a]+dx*h[b*145+a+1])+dy*((1-dx)*h[(b+1)*145+a]+dx*h[(b+1)*145+a+1]));
        if(Math.abs(x)<=6.001&&Math.abs(z)<=4.501)y=this.height(x,z);
        return [x,y,z,u,1-v];
      },!front);
      const geom=geometry(),land=mesh(geom,terrain,"Landschaftsumfeld");land.receiveShadow=true;parent.add(land);
      if(this.lib){
        const make=(step:number)=>{const idx:number[]=[];
          for(let j=0;j<rows;j+=step)for(let i=0;i<cols;i+=step){
            const y=Math.min(rows,j+step),x=Math.min(cols,i+step),ring:number[]=[];
            const edge=(i0:number,j0:number,i1:number,j1:number,divide:boolean)=>{
              const n=divide?Math.max(Math.abs(i1-i0),Math.abs(j1-j0)):1;
              for(let k=0;k<n;k++)ring.push((j0+(j1-j0)*k/n)*(cols+1)+i0+(i1-i0)*k/n);
            };
            edge(i,j,i,y,i===0);edge(i,y,x,y,y===rows);edge(x,y,x,j,x===cols);edge(x,j,i,j,j===0);
            if(ring.length===4){const [a,b,c,d]=ring;if(front)idx.push(a,b,d,b,c,d);else idx.push(a,d,b,b,d,c);}
            else {const center=Math.floor((j+y)/2)*(cols+1)+Math.floor((i+x)/2);
              for(let k=0;k<ring.length;k++){const a=ring[k],b=ring[(k+1)%ring.length];if(front)idx.push(a,b,center);else idx.push(b,a,center);}
            }
          }return new T.Uint16BufferAttribute(idx,1);};
        const indices=[geom.index!,make(2),make(3)];let level=0;this.terrainLOD.push((distance,grade)=>{
          const next=grade===2||distance<6?0:distance>12?2:distance>7?1:level;
          if(level!==next){geom.setIndex(indices[next]);level=next;}
        });
      }
      if(["japan","hawaii","island"].includes(this.spec.site!)){
        const sea=geom.clone(),p=sea.attributes.position as T.BufferAttribute,d=new Float32Array(p.count);
        for(let i=0;i<p.count;i++){d[i]=-p.getY(i);p.setY(i,.002);}
        sea.setAttribute("depthWet",new T.BufferAttribute(d,1));sea.computeVertexNormals();parent.add(mesh(sea,water,"Offenes Meer"));
      }
    }
  }
  private buildSurface(){
    const f=this.faultModel;
    if(this.spec.coastLesson){
      this.colorMap=coastalSand();
      for(const front of [false,true])(front?this.front:this.scene).add(coastalGrass((x,z)=>this.height(x,z),front));
    }
    for(const side of (this.water?[1]:this.spec.process==="rift"?[-1,0,1]:[-1,1])){
      const terrain=new T.MeshStandardMaterial({color:this.colorMap?0xffffff:0x93866b,roughness:.86,map:this.colorMap??null,normalMap:this.lib?null:this.normalMap??null,normalScale:new T.Vector2(.75,.75),roughnessMap:this.lib?null:this.roughMap??null,side:T.DoubleSide});
      terrain.onBeforeCompile=s=>{s.uniforms.opening=this.ui.opening;s.vertexShader="varying float restZ;\n"+s.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nrestZ=position.z;");s.fragmentShader="uniform float opening;varying float restZ;\n"+s.fragmentShader.replace("#include <color_fragment>","#include <color_fragment>\nif(restZ>4.52*(1.-opening))discard;");};
      if(this.spec.site==="san"&&this.spec.theme==="earthquake"){
        const prepare=terrain.onBeforeCompile.bind(terrain);
        terrain.onBeforeCompile=(s,renderer)=>{prepare(s,renderer);s.uniforms.phase=this.stressSignals.phase;s.uniforms.showStress=this.stressSignals.show;
          s.vertexShader="attribute vec2 coupling;varying vec2 locking;varying vec2 groundPos;\n"+s.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nlocking=coupling;groundPos=position.xz;");
          s.fragmentShader="uniform float phase,showStress;varying vec2 locking;varying vec2 groundPos;\n"+s.fragmentShader.replace("#include <color_fragment>","#include <color_fragment>\nfloat load=showStress*locking.x*smoothstep(0.,.36,phase)*(1.-smoothstep(locking.y,locking.y+.07,phase));float rings=.5+.5*cos(17.*length(groundPos*vec2(.95,.54)));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.48,.13,.27),load*(.55+.36*rings));");};
      }
      if(this.contextMap){
        const prepare=terrain.onBeforeCompile.bind(terrain);
        terrain.onBeforeCompile=(shader,renderer)=>{prepare(shader,renderer);shader.uniforms.contextImage={value:this.contextMap};
          shader.vertexShader="varying vec2 landscapeXY;\n"+shader.vertexShader.replace("restZ=position.z;","restZ=position.z;landscapeXY=position.xz;");
          shader.fragmentShader="uniform sampler2D contextImage;varying vec2 landscapeXY;\n"+shader.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\nfloat border=smoothstep(.78,1.,max(abs(landscapeXY.x)/6.,abs(landscapeXY.y)/4.5));diffuseColor.rgb=mix(diffuseColor.rgb,texture2D(contextImage,vec2(.5+landscapeXY.x/48.,.5-landscapeXY.y/36.)).rgb,border);");};
      }
      if(this.lib)decorateTerrain(terrain,this.lib,this.relief,this.spec.site==="island"||this.spec.site==="hawaii"?2:this.spec.site==="japan"?1:this.spec.site==="himalaya"?3:this.spec.site==="rift"?4:0,this.grade,this.spec.theme);
      if(this.spec.site&&["japan","island","hawaii"].includes(this.spec.site))seabed(terrain,this.metresPerUnit);
      for(const front of [false,true]){
        const bounds=new Map<number,[number,number]>();
        const columns=this.water?120:64;const g=indexed(36,columns,(i,j)=>{const z=(front?0:-4.5)+j/8;
          let range=bounds.get(j);if(!range){range=this.water?[-6,6]:f.horizonRange(side,x=>this.height(x,z));bounds.set(j,range);}
          const x=T.MathUtils.lerp(range[0],range[1],i/columns);return [x,this.height(x,z),z,x/12+.5,.5-z/9];});
        this.bindRock(g,side);g.userData.surface=true;g.userData.front=front;const land=mesh(g,terrain,"Gelände");land.receiveShadow=true;this.scene.add(land);
      }
    }
    geologySolids(this);
    if(!["forces","lithosphere"].includes(this.spec.theme)&&(this.spec.coastLesson||this.groundData?.some(h=>h<0)||this.windows?.some(h=>h<0))){
      for(const front of [false,true]){
        const g=indexed(42,120,(i,j)=>{const x=-6+12*i/120,z=(front?0:-4.5)+4.5*j/42;return [x,0,z,i/120,j/42];});
        const water=seaMaterial(this.ui.t,this.metresPerUnit);
        const pos=g.attributes.position as T.BufferAttribute,wet=new T.Float32BufferAttribute(new Float32Array(pos.count),1);g.setAttribute("depthWet",wet);
        const levels=new Float32Array(121),depths=new Float32Array(121),terrain=Float32Array.from({length:pos.count},(_,i)=>this.height(pos.getX(i),pos.getZ(i)));
        const crossRelief=Float32Array.from(terrain,(h,i)=>h-this.height(pos.getX(i),0));
        let previous=-1;this.onAnimate(t=>{if(t===previous||(!this.water&&previous>=0))return;previous=t;
          for(let j=0;j<121;j++){const x=-6+j*12/120;levels[j]=this.water?.sample(x,t)??0;depths[j]=this.water?.sample(x,t,true)??0;}
          for(let i=0;i<pos.count;i++){const j=i%121,top=levels[j];pos.setY(i,top+.002);
            wet.setX(i,this.water?depths[j]-crossRelief[i]:top-terrain[i]);}
          pos.needsUpdate=wet.needsUpdate=true;
          const normals=g.attributes.normal as T.BufferAttribute;
          for(let j=0;j<=120;j++){const a=Math.max(0,j-1),b=Math.min(120,j+1),slope=(levels[b]-levels[a])/((b-a)*.1),inv=1/Math.hypot(1,slope);
            for(let i=j;i<pos.count;i+=121)normals.setXYZ(i,-slope*inv,inv,0);}
          normals.needsUpdate=true;});
        (front?this.front:this.scene).add(mesh(g,water,"Wasseroberfläche"));
      }
      const curtain=indexed(1,120,(i,j)=>{const x=-6+i*.1;return [x,j?0:Math.min(0,this.height(x,0)),.011,i/120,j];});
      const glass=waterSection();
      this.section.add(mesh(curtain,glass,"Wassersäule im Schnitt"));
      if(this.spec.coastLesson&&this.water){
        const water=this.water,cell=Math.round((water.extent(0).shore+6)/water.dx),x0=-6+(cell-1)*water.dx;
        const a=this.height(x0,0),b=this.height(x0+water.dx,0),shore=x0+water.dx*a/(a-b);
        const line=path([new T.Vector3(shore,0,-4.5),new T.Vector3(shore,0,0)],0xefdb9d,"Ursprüngliche Uferlinie");
        const foreground=path([new T.Vector3(shore,0,0),new T.Vector3(shore,0,4.5)],0xefdb9d,"Ursprüngliche Uferlinie");
        this.front.add(foreground);this.scene.add(line);this.onAnimate(t=>{line.position.y=foreground.position.y=water.sample(shore,t)-water.sample(shore,t,true)+.016;});
      }
      let previous=-1;this.onAnimate(t=>{if(t===previous)return;previous=t;const pos=curtain.attributes.position as T.BufferAttribute;
        for(let i=0;i<=120;i++){const x=-6+i*.1,y=this.height(x,0),top=this.waterHeight(x,t),d=f.offset(this.deformed,x,y,0,x>=f.trace?1:-1,t);
          const bed=this.water?top-this.water.sample(x,t,true):y+d.y;pos.setY(i,Math.min(top,bed));pos.setY(i+121,top);}pos.needsUpdate=true;});
      this.waterColumn=mesh(new T.CylinderGeometry(.22,.22,1,24),new T.MeshBasicMaterial({color:0x66dacf,transparent:true,opacity:.36}),"Verdrängte Wassersäule");this.section.add(this.waterColumn);
    }
  }
  waterHeight(x:number,t:number){if(!this.water)return 0;return this.water.sample(x,t);}
  cameraView(view:string){
    const wasLocal=this.localActive;
    const origin=this.camera.position.clone(),look=this.orbit.target.clone();
    this.setCameraView(view);
    if(wasLocal!==this.localActive||this.transition||!this.ready||matchMedia("(prefers-reduced-motion: reduce)").matches)return;
    const to=this.camera.position.clone(),goal=this.orbit.target.clone();
    if(origin.distanceToSquared(to)<.002)return;
    this.camera.position.copy(origin);this.orbit.target.copy(look);this.orbit.update();
    this.transition={from:origin,to,look,goal,fraction:0};
  }
  private setCameraView(view:string){
    if(localView(view)&&this.spec.site&&this.lib){
      this.local??=new LocalLandscape(this.spec.site,this.lib,this.grade,(x,z)=>{const unit=(this.spec.width??sites[this.spec.site!].width)*1000/12;return (this.height(x/unit,z/unit)-this.height(0,0))*unit/(this.spec.site==="japan"?4.7:2.4);},this.spec.theme==="volcano");
      this.view=view;this.cut=false;this.transition=undefined;this.camera.far=240;this.orbit.minDistance=.23;this.orbit.maxDistance=12;
      const pose=this.local.pose(view);this.orbit.target.copy(pose.target);this.camera.position.copy(pose.position);this.orbit.update();return;
    }
    this.orbit.minDistance=view==="coast"?2.1:4;
    if(view==="coast"&&this.spec.coastLesson){
      this.reframe(false);this.orbit.minDistance=2.1;this.view=view;this.transition=undefined;
      this.orbit.target.set(-3.05,.012,-.35);this.camera.position.copy(this.orbit.target).add(new T.Vector3(-.76,1.76,2.05));this.orbit.update();return;
    }
    if(view==="land"||view==="overhead"){
      this.reframe(false);this.view=view;
      if(view==="overhead"){this.transition=undefined;this.orbit.target.set(0,this.height(0,-.35),-.35);this.camera.position.copy(this.orbit.target).add(new T.Vector3(1.7,6.2,3.2));this.orbit.update();}return;
    }
    this.reframe(true);this.view=view;if(view==="cut")return;
    if(view==="vent"){
      const x=this.spec.arcTransect?zao.vent:0,y=this.height(x,-.08),goal=new T.Vector3(x,y+.48,-.12);
      this.transition=undefined;this.camera.position.copy(goal).add(new T.Vector3(1,1.05,5.5));this.orbit.target.copy(goal);this.orbit.update();return;
    }
    const f=this.faultModel,x=view==="coast"?(this.spec.coastLesson?-2.98:-4.65):view==="ocean"?0:view==="water"?f.hx:Math.max(-3.9,Math.min(3.9,f.hx));
    const y=view==="waves"||view==="focus"?f.hy:view==="coast"||view==="water"||view==="ocean"?0:f.top-.35;
    const goal=new T.Vector3(x,y,-.18),to=goal.clone().add(new T.Vector3(view==="water"?2:view==="coast"?-.6:.25,view==="water"?2.3:view==="coast"?1.48:.54,view==="ocean"?9:view==="waves"?6.4:view==="coast"?2.5:4.5));
    this.transition=undefined;this.camera.position.copy(to);this.orbit.target.copy(goal);this.orbit.update();
  }
  restoreCamera(view:string,cut:boolean,position:number[],target:number[]){
    this.setCameraView(view);this.cut=cut;this.transition=undefined;
    this.camera.position.fromArray(position);this.orbit.target.fromArray(target);this.orbit.update();
  }
  private addVectors(){
    const g=this.spec.geology;if(!g)return;
    const group=new T.Group();this.scene.add(group);
    const to=(azimuth:number)=>new T.Vector3(Math.sin((azimuth-this.spec.strike)*Math.PI/180),0,-Math.cos((azimuth-this.spec.strike)*Math.PI/180));
    const total=to(g.relativeAzimuth);const left=to(g.strike-90).multiplyScalar(2);const source=left.setY(this.height(left.x,left.z)+.32);
    const along=to(g.strike),cross=to(g.strike+90);
    // PB2002 describes the left plate relative to the right, in directed line coordinates.
    const add=(vec:T.Vector3,start:T.Vector3,color:number)=>{const len=vec.length();if(len>.035)group.add(new T.ArrowHelper(vec.clone().normalize(),start,len,color,Math.min(.24,len*.3),.14));};
    const v=total.multiplyScalar(2),a=along.multiplyScalar(v.dot(along)),b=cross.multiplyScalar(v.dot(cross));
    add(v,source,0xffdd88);add(a,source.clone().add(new T.Vector3(0,.035,0)),0x86e8df);add(b,source.clone().add(a),0xbfb5ff);
    this.onAnimate(()=>{group.visible=this.vectors&&!this.cut;});
  }
  private addTrace(){
    const site=this.spec.site;if(this.spec.arcTransect||site!=="san"&&site!=="japan")return;
    const s=sites[site],angle=s.strike*Math.PI/180,trace=traces[site],points:T.Vector3[]=[];
    const rows=trace.points;
    for(let i=1;i<rows.length;i++){const a=rows[i-1],b=rows[i];
      for(let j=0;j<=20;j++){const f=j/20,lon=a[0]+f*(b[0]-a[0]),lat=a[1]+f*(b[1]-a[1]);
        const east=(lon-s.lon)*111.195*Math.cos(s.lat*Math.PI/180)*12/s.width,north=(lat-s.lat)*111.195*12/s.width;
        const x=east*Math.cos(angle)-north*Math.sin(angle),z=-east*Math.sin(angle)-north*Math.cos(angle);
        if(Math.abs(x)<6&&Math.abs(z)<4.5)points.push(new T.Vector3(x,this.height(x,z)+.034,z));}}
    if(points.length<2)return;
    const m=path(points,site==="san"?0xe7c38e:0x88d6ce,trace.name);m.userData.explanation={name:trace.name,answer:site==="san"?"Die Linie folgt dem kartierten Parkfield-Abschnitt der San-Andreas-Störung.":"Die Linie folgt der Lage des Japangrabens im USGS-Datensatz. Die tiefere Bruchfläche bleibt ein Modell."};
    this.scene.add(m);this.onAnimate(()=>{m.visible=this.names&&!this.cut;});
  }
  private groundDetails(){
    if(!this.colorMap||!this.spec.site)return;
    const c=document.createElement("canvas");c.width=96;c.height=72;const ctx=c.getContext("2d",{willReadFrequently:true})!;
    ctx.drawImage(this.colorMap.image,0,0,96,72);const pixels=ctx.getImageData(0,0,96,72).data;
    let state=72417;const rand=()=>((state=(1664525*state+1013904223)>>>0)/4294967296);
    for(const vegetation of [true,false]){
      const transforms:T.Matrix4[]=[],dummy=new T.Object3D();
      for(let i=0;i<580;i++){
        const x=(rand()-.5)*11.9,z=-rand()*4.45,alt=this.height(x,z),j=(Math.min(71,Math.floor((z/9+.5)*72))*96+Math.floor((x/12+.5)*96))*4;
        const [r,g,b]=pixels.subarray(j,j+3);
        if(alt<=.012||r<22||vegetation&&(g<r*1.04||g<b||this.spec.site==="island"))continue;
        dummy.position.set(x,alt+.008,z);const k=.014+rand()*.027;dummy.scale.set(k*(1+rand()),vegetation?k*2.2:k*.62,k);dummy.rotation.y=rand()*Math.PI;dummy.updateMatrix();transforms.push(dummy.matrix.clone());
      }
      const m=new T.InstancedMesh(new T.IcosahedronGeometry(1,vegetation?1:0),new T.MeshStandardMaterial({color:vegetation?0x526c4b:0x9a9584,roughness:.95}),transforms.length);
      transforms.forEach((v,i)=>{m.setMatrixAt(i,v);m.setColorAt(i,new T.Color().setRGB(.73+.25*rand(),.77+.21*rand(),.69+.25*rand()));});
      let last=-1;const matrix=new T.Matrix4();this.onAnimate(t=>{
        if(last===t||this.spec.theme==="volcano")return;last=t;
        transforms.forEach((v,i)=>{const x=v.elements[12],y=v.elements[13],z=v.elements[14],f=this.faultModel,h=this.height(x,z),shear=f.distributedSlip,side=shear?(h>f.interfaceY(x)?f.dipSign:-f.dipSign):f.sideAt(x,h),d=f.offset(this.deformed,x,h,z,side,t);
          if(shear){const w=T.MathUtils.smoothstep(Math.abs(h-f.interfaceY(x)),0,.65),shake=this.spec.theme==="earthquake"||this.spec.theme==="risk"?f.shaking(t,x,h,z):0;d.x*=w;d.y=T.MathUtils.lerp(shake,d.y,w);}
          matrix.copy(v);if(this.water)matrix.setPosition(x,y+this.water.bed(x,t)-this.height(x,0),z);else matrix.setPosition(x+d.x,y+d.y,z+d.z);m.setMatrixAt(i,matrix);});m.instanceMatrix.needsUpdate=true;
      });m.name=vegetation?"Symbolische Vegetationsgruppen":"Gestein an der Oberfläche";this.scene.add(m);
    }
  }
  private buildQuake(){
    const focus=this.ui.focus.value;
    const origin=this.faultModel.point(focus),epic=new T.Vector3(origin.x,this.nearSurface,0);
    this.section.add(this.labels);this.labels.add(path([origin,epic],0xe7dfb5,"Lot"));
    for(const [p,color,name] of [[origin,0xff975e,"Hypozentrum"],[epic,0xffedbd,"Epizentrum"]] as const){
      const pin=mesh(new T.SphereGeometry(.095,16,12),new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.2}),name);pin.position.copy(p);this.labels.add(pin);}
    const f=this.faultModel;
    const points=Array.from({length:64},(_,i)=>f.point(f.top-i*.075,.018));
    this.fault=path(points,0x463e36,"Störungsfläche");this.section.add(this.fault);
    this.rupture=path(Array.from({length:49},()=>origin.clone()),0xffcf89,"Bruchfront");this.section.add(this.rupture);
    this.waves=waveAnalysis(this);
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
    const t=this.progress;this.sectionColor.value=+!!this.facies;this.stressSignals.phase.value=t;this.stressSignals.show.value=+(this.stress&&this.spec.theme==="earthquake");this.ui.t.value=t;this.ui.clock.value=this.age;this.ui.stress.value=+this.stress;
    this.ui.vertical.value=+this.vertical;
    const motion=matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.reveal=motion?+this.cut:T.MathUtils.damp(this.reveal,+this.cut,9,dt);
    this.ui.opening.value=this.reveal;this.front.visible=this.reveal<.992;this.section.visible=this.reveal>.05;
    if(this.transition){
      const tr=this.transition;tr.fraction=Math.min(1,tr.fraction+dt*1.55);const v=T.MathUtils.smoothstep(tr.fraction,0,1);
      this.camera.position.lerpVectors(tr.from,tr.to,v);this.orbit.target.lerpVectors(tr.look,tr.goal,v);if(tr.fraction===1)this.transition=undefined;
    }
    this.labels.visible=this.names && this.spec.theme==="earthquake"&&this.faultModel.kind!=="unknown"&&!document.body.classList.contains("observing");
    const quake=(this.spec.theme==="earthquake"||this.spec.theme==="risk")&&this.faultModel.kind!=="unknown"&&this.view!=="coast"&&this.view!=="ocean";this.fault.visible=quake;
    const f=this.faultModel;
    if((t!==this.lastT||this.lastSection!==this.section.visible) && (this.lastT<0||!["volcano","lithosphere"].includes(this.spec.theme))){
      const water=this.water,bed=water?Float32Array.from({length:water.cells},(_,j)=>water.bed(-6+j*water.dx,t)):undefined;
      for(const {g,base,side,slice,waterSkin,shear,motionData} of this.solids){
        // Initialize every mesh at the solver reference before deferring hidden frames.
        if(slice&&!this.section.visible&&this.lastT>=0)continue;
        const pos=g.attributes.position as T.BufferAttribute;
        for(let i=0;i<pos.count;i++){const x=base[3*i],y=base[3*i+1],z=base[3*i+2],d=this.deformed;
          if(waterSkin&&waterSkin[2*i]===1)d.set(0,0,0);else {
            f.offset(d,x,y,z,shear?(y>f.interfaceY(x)?f.dipSign:-f.dipSign):side,t,this.spec.theme,motionData[i*2],motionData[i*2+1]);
            if(shear&&shear[i]<1){
              const shake=(this.spec.theme==="earthquake"||this.spec.theme==="risk")?f.shakingAt(t,motionData[i*2]):0;d.x*=shear[i];d.y=T.MathUtils.lerp(shake,d.y,shear[i]);
            }
          }
          if(slice&&z===0&&f.kind==="strike"){
            // Intersect the advected block with the fixed section z=0. Texture samples
            // follow the incoming material as the two faces slide past one another.
            let materialZ=-d.z,yy=y;
            for(let j=0;j<4;j++){yy=slice(i,materialZ);f.offset(this.deformed,x,yy,materialZ,side,t);if(Math.abs(materialZ+this.deformed.z)<.00001)break;materialZ=-this.deformed.z;}
            pos.setXYZ(i,x,yy+this.deformed.y,0);(g.attributes.geologyCoord as T.BufferAttribute).setXYZ(i,x,yy,materialZ);
          }else if(waterSkin&&water&&bed&&waterSkin[2*i]>0){
            const w=waterSkin[2*i],col=T.MathUtils.clamp((x+6)/water.dx,0,water.cells-1),j=Math.min(water.cells-2,Math.floor(col)),bottom=T.MathUtils.lerp(bed[j],bed[j+1],col-j)-waterSkin[2*i+1];
            pos.setXYZ(i,x+d.x*(1-w),y+T.MathUtils.lerp(d.y,bottom,w),z+d.z*(1-w));
          }else pos.setXYZ(i,x+d.x,y+d.y,z+d.z);}
        pos.needsUpdate=true;if(slice)g.attributes.geologyCoord.needsUpdate=true;
      }
      this.lastT=t;this.lastSection=this.section.visible;
    }
    this.rupture.visible=quake&&f.kind!=="unknown"&&t>onset&&t<.72;
    if(this.rupture.visible){
      const pos=this.rupture.geometry.attributes.position as T.BufferAttribute;
      for(let i=0;i<pos.count;i++){const a=2*Math.PI*i/(pos.count-1),radius=Math.min(1.45,(t-onset)*16),y=Math.min(f.top-.02,f.hy+radius*.7*Math.cos(a)),v=f.point(y,-Math.abs(radius*Math.sin(a)));pos.setXYZ(i,v.x,v.y,v.z);}
      pos.needsUpdate=true;this.rupture.frustumCulled=false;
    }
    if(this.waterColumn){const x=f.hx,h=this.height(x,0),top=this.waterHeight(x,t);this.waterColumn.visible=f.waterEvent&&t>=onset&&t<.67&&this.view!=="coast"&&this.view!=="ocean";
      const bed=this.water?.bed(x,t)??h;this.waterColumn.scale.y=Math.max(.001,top-bed);this.waterColumn.position.set(x,bed+this.waterColumn.scale.y/2,.065);}
    for(const fn of this.motion)fn(t);this.orbit.update();this.lastCamera.copy(this.camera.position);
  }
  get focus(){return [this.faultModel?.hx??0,this.ui.focus.value,0];}
  get epicenter(){return [this.faultModel?.hx??0,this.nearSurface,0];}
  dispose(){
    this.disposed=true;this.local?.dispose();this.orbit.dispose();const gs=new Set<T.BufferGeometry>(),ms=new Set<T.Material>();
    this.scene.traverse(o=>{const m=o as T.Mesh;if(m instanceof T.InstancedMesh)m.dispose();if(m.geometry)gs.add(m.geometry);if(m.material)for(const a of Array.isArray(m.material)?m.material:[m.material])ms.add(a);});
    for(const g of gs)g.dispose();for(const m of ms)m.dispose();this.colorMap?.dispose();this.normalMap?.dispose();this.roughMap?.dispose();this.sky.dispose();this.contextMap?.dispose();this.envelope?.dispose();this.relief?.dispose();this.sunlight.shadow.dispose();
  }
}
