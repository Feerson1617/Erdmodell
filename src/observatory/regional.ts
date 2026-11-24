import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import traces from "./traces.json";
import { localAsset } from "../assets";
import { sites, referenceGeology, type Geology, type Process, type Site } from "./boundaries";

import { WaterSection } from "./water";
import { waveAnalysis } from "./wavefronts";
import { Fault, onset, pSpeed, sSpeed } from "./fault";
import { geologySolids } from "./sections";
let globalWindows:Promise<Int16Array>|undefined;
export type Theme="process"|"earthquake"|"volcano"|"risk"|"forces"|"lithosphere"|"magnet";
export type RegionSpec={site?:Site; name:string; process:Process; lat:number;lon:number; strike:number; azimuth?:number; geology?:Geology; comparison?:RegionSpec;coastLesson?:boolean; theme:Theme};
export const reference=(site:Site,theme:Theme):RegionSpec=>({...sites[site],site,geology:referenceGeology(site),process:sites[site].process as Process,theme});
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
  readonly scene=new T.Scene();
  readonly camera=new T.PerspectiveCamera(38,1,.02,120);
  readonly orbit:OrbitControls;
  readonly front=new T.Group();readonly section=new T.Group();readonly labels=new T.Group();
  readonly witnesses=new T.Group();readonly settlement=new T.Group();readonly mechanisms=new T.Group();
  private ui={t:{value:0},kind:{value:0},focus:{value:-1},vertical:{value:1},clock:{value:0},stress:{value:0},sense:{value:1},opening:{value:0}};
  private contextHeights?:Int16Array;private groundData?:Int16Array;private colorMap?:T.Texture;private normalMap?:T.Texture;private roughMap?:T.Texture;private sky:T.CanvasTexture;private contextMap?:T.Texture;private reveal=0;private transition?:{from:T.Vector3;to:T.Vector3;look:T.Vector3;goal:T.Vector3;fraction:number};
  faultModel!:Fault;private windows?:Int16Array;
  private solids:{g:T.BufferGeometry;base:Float32Array;side:number}[]=[];private lastT=-1;
  readonly stressSignals={phase:{value:0},show:{value:0}};
  readonly deformed=new T.Vector3();
  bindRock(g:T.BufferGeometry,side:number){
    const f=this.faultModel,coords=g.attributes.position,values=new Float32Array(coords.count*2);
    for(let i=0;i<coords.count;i++){const x=coords.getX(i),y=coords.getY(i),z=coords.getZ(i);
      values[i*2]=Math.exp(-Math.abs(x-f.xAt(y))*1.4-z*z*.09);
      values[i*2+1]=onset+Math.hypot(x-f.hx,y-f.hy,z)/16;}
    g.setAttribute("coupling",new T.BufferAttribute(values,2));this.solids.push({g,side,base:new Float32Array(g.attributes.position.array)});(g.attributes.position as T.BufferAttribute).setUsage(T.DynamicDrawUsage);}
  physicalState(){
    const f=this.faultModel;if(!f)return {};
    const sample=this.solids.find(s=>s.side===1),i=sample?Math.floor(sample.base.length/6)*3:0;
    const coords=this.rupture.geometry.attributes.position;
    let maxPlaneError=0;if(this.rupture.visible)for(let j=0;j<coords.count;j++)maxPlaneError=Math.max(maxPlaneError,Math.abs(coords.getX(j)-f.xAt(coords.getY(j))));
    const distance=Math.hypot(this.epicenter[1]-f.hy,this.epicenter[0]-f.hx);
    const vertices=this.solids.map(({g,base,side})=>{
      const k=Math.floor(base.length/6)*3,a=Array.from(base.slice(k,k+3)),b=Array.from(g.attributes.position.array.slice(k,k+3));
      return {side,rest:a,drawn:b};
    });
    return {vertices,profilePoints:f.profile.map(([x,km])=>({x,km,y:f.interfaceY(x)})),sense:f.sense,maxPlaneError,focusError:Math.abs(f.hx-f.xAt(f.hy)),pArrival:onset+distance/pSpeed,sArrival:onset+distance/sSpeed,
      earlyShake:f.shaking(onset+distance/pSpeed-.002,f.hx,this.epicenter[1],0),lateShake:f.shaking(1,f.hx,this.epicenter[1],0),fault:f.kind,trace:f.trace,dipSign:f.dipSign,profile:f.profile.length,waterEvent:f.waterEvent,waterSurface:this.water?.sample(f.hx,this.progress)??0,waterSignals:this.water?[0,.48,.58,.72,.88,1].map(t=>[t,this.water!.sample(f.hx,t),this.water!.sample(-4,t)]):[],
      rupture:this.rupture.visible?Array.from(this.rupture.geometry.attributes.position.array):[],waveFronts:this.waves.map(w=>w.visible),
      vertex:sample?{rest:Array.from(sample.base.slice(i,i+3)),drawn:Array.from(sample.g.attributes.position.array.slice(i,i+3)),side:sample.side}:null};
  }
  showP=true;showS=true;detail=false;phasesShown=false;water?:WaterSection;private waves:T.Mesh[]=[];private fault!:T.Line;private rupture!:T.Line;
  private waterColumn?:T.Mesh; private nearSurface=0;private rockMaterial:T.Material[]=[];
  private people:T.Mesh[]=[];private route?:T.Line;private motion:((t:number)=>void)[]=[];
  progress=0;playing=false;slow=false;cut=false;names=false;vertical=true;stress=false;
  soil="rock";eruption="effusive";coastal=false;protection=false;safeRoute=false;warning=false;relocate=false;exposure="dense";ready=false;error="";private disposed=false;private age=0;
  constructor(readonly spec:RegionSpec,canvas:HTMLCanvasElement){
    this.orbit=new OrbitControls(this.camera,canvas);this.orbit.target.set(0,0,0);
    this.orbit.enablePan=false;this.orbit.minDistance=4;this.orbit.maxDistance=22;this.orbit.maxPolarAngle=1.49;
    const sky=document.createElement("canvas");sky.width=2;sky.height=256;
    const ctx=sky.getContext("2d")!,grad=ctx.createLinearGradient(0,0,0,256);
    grad.addColorStop(0,"#648ca6");grad.addColorStop(.43,"#c8d8d6");grad.addColorStop(.64,"#c8ccc0");grad.addColorStop(1,"#829b9b");ctx.fillStyle=grad;ctx.fillRect(0,0,2,256);
    this.sky=new T.CanvasTexture(sky);this.sky.colorSpace=T.SRGBColorSpace;this.scene.background=this.sky;this.scene.fog=new T.FogExp2(0xacc5cb,.026);
    this.scene.add(new T.HemisphereLight(0xfff6dd,0x8b9da2,2.05));
    const sun=new T.DirectionalLight(0xffdda9,2.5);sun.position.set(-6,9,5);this.scene.add(sun,this.front,this.section,this.witnesses,this.settlement,this.mechanisms);
    if(spec.azimuth!==undefined)this.ui.sense.value=Math.cos((spec.azimuth-spec.strike)*Math.PI/180)>=0?1:-1;
    this.vertical=["arc","subduction"].includes(spec.process);this.reframe(false);
  }
  get viewSettled(){return !this.transition && Math.abs(this.reveal-Number(this.cut))<.012;}
  reframe(cut:boolean){this.cut=cut;this.camera.position.set(cut?1.3:3.4,cut?2.1:4.5,cut?8.4:7.4);
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
      return blended/1000/(sites[this.spec.site!].width/12)*(this.spec.site==="japan"?4.7:2.4);
    }
    if(this.spec.coastLesson)return -.48-.95*Math.tanh((x+2.45)*.85)+.42*Math.exp(-((x+4.95)**2)*1.3)+.035*Math.cos(z);
    if(this.windows && this.spec.geology){
      const u=clamp((x/12+.5)*6,0,6),v=clamp((z/9+.5)*6,0,6),i=Math.min(5,Math.floor(u)),j=Math.min(5,Math.floor(v)),dx=u-i,dy=v-j;
      const h=this.windows,k=i+j*7;return .00024*((1-dy)*((1-dx)*h[k]+dx*h[k+1])+dy*((1-dx)*h[k+7]+dx*h[k+8]));
    }
    if(this.spec.theme==="forces")return .14+.52*Math.exp(-((x+3.8)**2)*1.2)-.43*Math.exp(-x*x*2);
    return .12+.08*Math.cos(x+z*.2);
  }
  async init(){
    if(this.spec.site){
      const base="data/g5/terrain/"+this.spec.site;
      const [response,tex,normal,rough,farHeight,farImage]=await Promise.all([fetch(localAsset(base+".i16")),new T.TextureLoader().loadAsync(localAsset(base+"-surface.webp")),new T.TextureLoader().loadAsync(localAsset(base+"-normal.webp")),new T.TextureLoader().loadAsync(localAsset(base+"-rough.webp")),fetch(localAsset(base+"-context.i16")),new T.TextureLoader().loadAsync(localAsset(base+"-context.webp"))]);
      if(this.disposed){tex.dispose();normal.dispose();rough.dispose();farImage.dispose();return;}
      if(!response.ok)throw Error("Höhendaten fehlen");
      const [heightBytes,contextBytes]=await Promise.all([response.arrayBuffer(),farHeight.arrayBuffer()]);const heights=new Int16Array(heightBytes);if(heights.length!==193*145)throw Error("Höhenraster unvollständig");
      if(this.disposed){tex.dispose();normal.dispose();rough.dispose();farImage.dispose();return;}this.groundData=heights;this.colorMap=tex;this.normalMap=normal;this.roughMap=rough;normal.anisotropy=4;tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;this.contextMap=farImage;farImage.colorSpace=T.SRGBColorSpace;this.surround(new Int16Array(contextBytes),farImage);
    }
    if(!this.spec.site && this.spec.geology){
      globalWindows??=fetch(localAsset("data/g51/regional-relief.i16")).then(r=>{if(!r.ok)throw Error("Regionalraster fehlt");return r.arrayBuffer();}).then(b=>new Int16Array(b)).catch(e=>{globalWindows=undefined;throw e;});
      const heights=await globalWindows;if(this.disposed)return;
      const index=(this.spec.geology.id-1)*49;this.windows=heights.subarray(index,index+49);
    }
    this.faultModel=new Fault(this.spec,(x,z)=>this.height(x,z));if(this.faultModel.waterEvent)this.water=new WaterSection(this.faultModel);
    this.nearSurface=this.height(this.faultModel.hx,0);this.ui.focus.value=this.faultModel.hy;
    this.buildSurface();this.addTrace();this.groundDetails();this.buildQuake();this.buildExtras();this.ready=true;this.update(0);
  }
  private surround(h:Int16Array,image:T.Texture){
    this.contextHeights=h;
    if(h.length!==145*109)throw Error("Das Landschaftsumfeld fehlt.");
    const gain=(this.spec.site==="japan"?4.7:2.4)*.012/sites[this.spec.site!].width;
    const terrain=new T.MeshStandardMaterial({map:image,roughness:.94,side:T.DoubleSide});
    const water=new T.MeshStandardMaterial({color:0x39818a,roughness:.33,metalness:.12,transparent:true,opacity:.72,side:T.DoubleSide});
    for(const front of [false,true])for(const [x0,x1,z0,z1] of [[-24,-6,0,18],[6,24,0,18],[-6,6,4.5,18]]){
      const parent=front?this.front:this.scene,cols=Math.ceil((x1-x0)*3),rows=Math.ceil((z1-z0)*4);
      const geometry=(sea:boolean)=>indexed(rows,cols,(i,j)=>{
        const x=x0+i/cols*(x1-x0),z=(front?1:-1)*(z0+j/rows*(z1-z0)),u=x/48+.5,v=z/36+.5;
        const fx=u*144,fy=v*108,a=Math.min(143,Math.floor(fx)),b=Math.min(107,Math.floor(fy)),dx=fx-a,dy=fy-b;
        let y=gain*((1-dy)*((1-dx)*h[b*145+a]+dx*h[b*145+a+1])+dy*((1-dx)*h[(b+1)*145+a]+dx*h[(b+1)*145+a+1]));
        if(Math.abs(x)<=6.001&&Math.abs(z)<=4.501)y=this.height(x,z);
        return [x,sea?-.006:y,z,u,1-v];
      },!front);
      parent.add(mesh(geometry(false),terrain,"Landschaftsumfeld"));if(["japan","hawaii","island"].includes(this.spec.site!))parent.add(mesh(geometry(true),water,"Offenes Meer"));
    }
  }
  private buildSurface(){
    const f=this.faultModel;
    for(const side of (this.spec.process==="rift"?[-1,0,1]:[-1,1])){
      const terrain=new T.MeshStandardMaterial({color:this.colorMap?0xffffff:0x93866b,roughness:.86,map:this.colorMap??null,normalMap:this.normalMap??null,normalScale:new T.Vector2(.75,.75),roughnessMap:this.roughMap??null,side:T.DoubleSide});
      terrain.onBeforeCompile=s=>{s.uniforms.opening=this.ui.opening;s.vertexShader="varying float restZ;\n"+s.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nrestZ=position.z;");s.fragmentShader="uniform float opening;varying float restZ;\n"+s.fragmentShader.replace("#include <color_fragment>","#include <color_fragment>\nif(restZ>4.52*(1.-opening))discard;");};
      if(this.contextMap){
        const prepare=terrain.onBeforeCompile.bind(terrain);
        terrain.onBeforeCompile=(shader,renderer)=>{prepare(shader,renderer);shader.uniforms.contextImage={value:this.contextMap};
          shader.vertexShader="varying vec2 landscapeXY;\n"+shader.vertexShader.replace("restZ=position.z;","restZ=position.z;landscapeXY=position.xz;");
          shader.fragmentShader="uniform sampler2D contextImage;varying vec2 landscapeXY;\n"+shader.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\nfloat border=smoothstep(.78,1.,max(abs(landscapeXY.x)/6.,abs(landscapeXY.y)/4.5));diffuseColor.rgb=mix(diffuseColor.rgb,texture2D(contextImage,vec2(.5+landscapeXY.x/48.,.5-landscapeXY.y/36.)).rgb,border);");};
      }
      for(const front of [false,true]){
        const g=indexed(36,64,(i,j)=>{const [a,b]=f.blockRange(side,f.top),x=T.MathUtils.lerp(Math.min(a,b),Math.max(a,b),i/64),z=(front?0:-4.5)+j/8;return [x,this.height(x,z)+.009,z,x/12+.5,.5-z/9];});
        this.bindRock(g,side);(front?this.front:this.scene).add(mesh(g,terrain,"Gelände"));
      }
    }
    geologySolids(this);
    if(!["forces","lithosphere"].includes(this.spec.theme)&&(this.spec.coastLesson||this.groundData?.some(h=>h<0)||this.windows?.some(h=>h<0))){
      for(const front of [false,true]){
        const g=indexed(42,112,(i,j)=>{const x=-6+12*i/112,z=(front?0:-4.5)+4.5*j/42;return [x,0,z,i/112,j/42];});
        const water=new T.MeshStandardMaterial({color:0x287a88,roughness:.29,metalness:.16,transparent:true,opacity:.78,side:T.DoubleSide,depthWrite:false});
        const pos=g.attributes.position as T.BufferAttribute,levels=new Float32Array(113);
        let previous=-1;this.onAnimate(t=>{if(t===previous)return;previous=t;for(let j=0;j<113;j++)levels[j]=this.waterHeight(-6+j*12/112,t);for(let i=0;i<pos.count;i++)pos.setY(i,levels[i%113]);pos.needsUpdate=true;});
        (front?this.front:this.scene).add(mesh(g,water,"Wasseroberfläche"));
      }
      const curtain=indexed(1,120,(i,j)=>{const x=-6+i*.1;return [x,j?0:Math.min(0,this.height(x,0)),.011,i/120,j];});
      const glass=new T.MeshBasicMaterial({color:0x438f99,transparent:true,opacity:.28,depthWrite:false,side:T.DoubleSide});
      this.section.add(mesh(curtain,glass,"Wassersäule im Schnitt"));
      let previous=-1;this.onAnimate(t=>{if(t===previous)return;previous=t;const pos=curtain.attributes.position as T.BufferAttribute;
        for(let i=0;i<=120;i++){const x=-6+i*.1,y=this.height(x,0),top=this.waterHeight(x,t),d=f.offset(this.deformed,x,y,0,x>=f.trace?1:-1,t);
          pos.setY(i,Math.min(top,y+d.y));pos.setY(i+121,top);}pos.needsUpdate=true;});
      this.waterColumn=mesh(new T.CylinderGeometry(.22,.22,1,24),new T.MeshBasicMaterial({color:0x66dacf,transparent:true,opacity:.36}),"Verdrängte Wassersäule");this.section.add(this.waterColumn);
    }
  }
  waterHeight(x:number,t:number){if(!this.water)return 0;return this.water.sample(x,t)-(this.water.sample(x,t,true)<.002?.06:0);}
  cameraView(view:string){
    if(view==="land"){this.reframe(false);return;}
    this.reframe(true);if(view==="cut")return;
    const f=this.faultModel,x=view==="coast"?-4.65:view==="water"?f.hx:Math.max(-3.9,Math.min(3.9,f.hx));
    const y=view==="waves"||view==="focus"?f.hy:view==="coast"||view==="water"?this.height(x,0):f.top-.35;
    const goal=new T.Vector3(x,y,-.18),to=goal.clone().add(new T.Vector3(view==="water"?2:.25,view==="water"?2.3:.54,view==="waves"?6.4:4.5));
    this.transition=undefined;this.camera.position.copy(to);this.orbit.target.copy(goal);this.orbit.update();
  }
  private addTrace(){
    const site=this.spec.site;if(site!=="san"&&site!=="japan")return;
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
    const c=document.createElement("canvas");c.width=96;c.height=72;const ctx=c.getContext("2d")!;
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
      const m=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),new T.MeshStandardMaterial({color:vegetation?0x526c4b:0x9a9584,roughness:.95}),transforms.length);
      transforms.forEach((v,i)=>m.setMatrixAt(i,v));m.name=vegetation?"Symbolische Vegetationsgruppen":"Gestein an der Oberfläche";this.scene.add(m);
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
    const t=this.progress;this.stressSignals.phase.value=t;this.stressSignals.show.value=+(this.stress&&this.spec.theme==="earthquake");this.ui.t.value=t;this.ui.clock.value=this.age;this.ui.stress.value=+this.stress;
    this.ui.vertical.value=+this.vertical;
    const motion=matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.reveal=motion?+this.cut:T.MathUtils.damp(this.reveal,+this.cut,9,dt);
    this.ui.opening.value=this.reveal;this.front.visible=this.reveal<.992;this.section.visible=this.reveal>.05;
    if(this.transition){
      const tr=this.transition;tr.fraction=Math.min(1,tr.fraction+dt*1.55);const v=T.MathUtils.smoothstep(tr.fraction,0,1);
      this.camera.position.lerpVectors(tr.from,tr.to,v);this.orbit.target.lerpVectors(tr.look,tr.goal,v);if(tr.fraction===1)this.transition=undefined;
    }
    this.labels.visible=this.names && this.spec.theme==="earthquake";
    const quake=this.spec.theme==="earthquake"||this.spec.theme==="risk";this.fault.visible=quake;
    const f=this.faultModel;
    if(t!==this.lastT){
      for(const {g,base,side} of this.solids){
        const pos=g.attributes.position as T.BufferAttribute;
        for(let i=0;i<pos.count;i++){const x=base[3*i],y=base[3*i+1],z=base[3*i+2],d=f.offset(this.deformed,x,y,z,side,t);pos.setXYZ(i,x+d.x,y+d.y,z+d.z);}
        pos.needsUpdate=true;
      }
      this.lastT=t;
    }
    this.rupture.visible=quake&&f.kind!=="unknown"&&t>onset&&t<.72;
    if(this.rupture.visible){
      const pos=this.rupture.geometry.attributes.position as T.BufferAttribute;
      for(let i=0;i<pos.count;i++){const a=2*Math.PI*i/(pos.count-1),radius=Math.min(1.45,(t-onset)*16),y=Math.min(f.top-.02,f.hy+radius*.7*Math.cos(a)),v=f.point(y,-Math.abs(radius*Math.sin(a)));pos.setXYZ(i,v.x,v.y,v.z);}
      pos.needsUpdate=true;this.rupture.frustumCulled=false;
    }
    if(this.waterColumn){const x=f.hx,h=this.height(x,0),top=this.waterHeight(x,t);this.waterColumn.visible=f.waterEvent&&t>=onset&&t<.67;
      const dy=f.offset(this.deformed,x,h,0,x>=f.trace?1:-1,t).y;this.waterColumn.scale.y=Math.max(.03,top-h-dy);this.waterColumn.position.set(x,h+dy+this.waterColumn.scale.y/2,.065);}
    for(const fn of this.motion)fn(t);this.orbit.update();this.lastCamera.copy(this.camera.position);
  }
  get focus(){return [this.faultModel?.hx??0,this.ui.focus.value,0];}
  get epicenter(){return [this.faultModel?.hx??0,this.nearSurface,0];}
  dispose(){
    this.disposed=true;this.orbit.dispose();const gs=new Set<T.BufferGeometry>(),ms=new Set<T.Material>();
    this.scene.traverse(o=>{const m=o as T.Mesh;if(m.geometry)gs.add(m.geometry);if(m.material)for(const a of Array.isArray(m.material)?m.material:[m.material])ms.add(a);});
    for(const g of gs)g.dispose();for(const m of ms)m.dispose();this.colorMap?.dispose();this.normalMap?.dispose();this.roughMap?.dispose();this.sky.dispose();this.contextMap?.dispose();
  }
}
