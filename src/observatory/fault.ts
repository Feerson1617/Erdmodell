import * as T from "three";
import zao from "./zao.json";
import sampled from "./miyagi.json";
import type { RegionSpec } from "./regional";

export const onset=.36, pSpeed=19, sSpeed=11;
const smooth=(x:number)=>{const u=Math.max(0,Math.min(1,x));return u*u*(3-2*u);};
export type FaultKind="strike"|"normal"|"thrust"|"interface"|"unknown";
export class Fault {
  readonly kind:FaultKind;readonly dip:number;readonly dipSign:number;readonly sense:number;
  readonly trace:number;readonly top:number;readonly hy:number;readonly hx:number;
  readonly profile:number[][];readonly slipSign:number;readonly waterEvent:boolean;
  constructor(readonly spec:RegionSpec,readonly height:(x:number,z:number)=>number){
    const p=spec.process,g=spec.geology;
    this.kind=["subduction","arc"].includes(p)?"interface":["rift","ridge"].includes(p)?"normal":["collision","convergence"].includes(p)?"thrust":p.includes("ransform")?"strike":"unknown";
    this.dipSign=g?.dipAzimuth!=null?(Math.cos((g.dipAzimuth-spec.strike-90)*Math.PI/180)>=0?1:-1):spec.site==="japan"?-1:1;
    this.dip=this.kind==="normal"?58:this.kind==="thrust"?27:this.kind==="interface"?25:90;
    this.sense=(g?.dextral??1)>=0?1:-1;
    this.profile=spec.site==="japan"&&!spec.arcTransect&&this.kind==="interface"?sampled:[];
    this.trace=spec.arcTransect?zao.trench:this.profile.length?this.profile[0][0]:this.kind==="normal"&&p==="rift"?-1.45:0;
    this.top=this.profile.length?-this.profile[0][1]*12*4.7/320:height(this.trace,0);
    this.hy=this.top-(spec.event==="buried"?1.6:this.kind==="interface"?.64:1.06);this.hx=this.xAt(this.hy);
    this.slipSign=this.kind==="normal"?-1:1;
    this.waterEvent=(spec.event==="uplift"||Boolean(spec.coastLesson))&&this.kind==="interface"&&this.top<0;
  }
  // Slab2 profile depths below sea level; same vertical exaggeration as the Japan DEM.
  xAt(y:number){
    const depth=this.top-y;
    if(this.profile.length){
      const km=-y*320/(12*4.7);
      let i=1;while(i<this.profile.length-1 && this.profile[i][1]<km)i++;
      const a=this.profile[i-1],b=this.profile[i];
      return a[0]+(b[0]-a[0])*(km-a[1])/(b[1]-a[1]);
    }
    return this.trace+this.dipSign*depth/Math.tan(this.dip*Math.PI/180);
  }
  interfaceY(x:number){
    if(this.profile.length){
      let i=1;while(i<this.profile.length-1&&this.profile[i][0]>x)i++;
      const a=this.profile[i-1],b=this.profile[i],km=a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);
      return -km*12*4.7/320;
    }
    return this.top-(x-this.trace)*this.dipSign*Math.tan(this.dip*Math.PI/180);
  }
  blockRange(side:number,y:number):[number,number]{
    const seam=T.MathUtils.clamp(this.xAt(y),-5.98,5.98);
    if(this.spec.process==="rift"){
      const left=Math.min(0,seam),right=-left;
      return side<0?[left,-6]:side>0?[right,6]:[left,right];
    }
    return side<0?[seam,-6]:[seam,6];
  }
  get riftRoot(){return this.top+this.trace*Math.tan(this.dip*Math.PI/180);}
  sideAt(x:number,y:number){
    if(this.spec.process==="rift"){const half=Math.max(0,-this.xAt(y));return x< -half?-1:x>half?1:0;}
    if(this.spec.process==="ridge")return Math.sign(x);
    return x>=this.trace?1:-1;
  }
  // Solve the intersection with the actual topographic/layer horizon at this slice.
  horizonRange(side:number,horizon:(x:number)=>number):[number,number]{
    const rift=this.spec.process==="rift";
    if(this.spec.process==="ridge"&&["process","magnet","forces"].includes(this.spec.theme)||this.kind==="strike"||this.kind==="unknown"||this.kind==="interface"||this.kind==="thrust")return side<0?[-6,this.trace]:[this.trace,6];
    const root=(sign:number)=>{
      let a=-6,b=6;
      for(let i=0;i<22;i++){const x=(a+b)*.5,seam=this.xAt(horizon(x));if(x<(rift?sign*Math.max(0,-seam):seam))a=x;else b=x;}
      return (a+b)*.5;
    };
    if(side<0)return [-6,root(-1)];
    if(side>0)return [root(1),6];
    return [root(-1),root(1)];
  }
  ridgeWidth(y:number,t:number){return .65*t*smooth((y-this.top+2.5)/1.65);}
  point(y:number,z=0){return new T.Vector3(this.xAt(y),y,z);}
  release(t:number,x:number,y:number,z:number){return smooth((t-onset-Math.hypot(x-this.hx,y-this.hy,z)/16)/.07);}
  shaking(t:number,x:number,y:number,z:number){
    return this.shakingAt(t,Math.hypot(x-this.hx,y-this.hy,z));
  }
  shakingAt(t:number,d:number){
    const a=t-onset-d/pSpeed,b=t-onset-d/sSpeed;
    const pulse=(v:number)=>v>0&&v<.35?Math.sin(v*117)*Math.exp(-v*15)*smooth(v/.018)*(1-smooth((v-.22)/.13)):0;
    return (.035*pulse(a)+.069*pulse(b))*(1-smooth((t-.88)/.12))/(1+.18*d);
  }
  offset(target:T.Vector3,x:number,y:number,z:number,side:number,t:number,theme=this.spec.theme,distance?:number,locking?:number){
    target.set(0,0,0);if(t===0||this.kind==="unknown")return target;
    const quake=theme==="earthquake"||theme==="risk",slow=theme==="process"||theme==="magnet"||theme==="forces";
    if(!quake&&!slow)return target;
    const lock=locking??Math.exp(-Math.abs(x-this.xAt(y))*.94-z*z*.029);
    const strain=quake?smooth(t/onset)*(1-lock+lock*smooth((t-onset-(distance??Math.hypot(x-this.hx,y-this.hy,z))/16)/.07)):t;
    const taper=quake&&this.waterEvent?Math.exp(-Math.pow((x-this.hx)/2.4,2)):1;
    const buried=this.spec.event==="buried"?smooth((this.top-y)/1.6):1;
    const slip=side*.38*strain*taper*buried;
    if(this.kind==="strike")target.z=this.sense*slip;
    else if(this.kind==="interface"||this.kind==="thrust"||this.kind==="normal"){
      const dy=slip*this.slipSign*this.dipSign*Math.sin(this.dip*Math.PI/180);
      target.set(this.xAt(y+dy)-this.xAt(y),dy,0);
      // The nascent plate at a spreading axis and the hinterland separate over geologic time.
      if(slow&&this.spec.process==="ridge"){
        const width=this.ridgeWidth(y,t),creep=Math.tanh(x/2);
        target.set(side*width+(.65*t-width)*creep,0,0);
      }
    }
    if(this.spec.process==="rift"){
      // Slip dies out at the root. At the same final elevation the outer face
      // and the lowered central face have exactly the same horizontal position.
      const phase=(quake?this.release(t,this.hx,this.hy,0):t)*smooth(4.5-Math.abs(z))*smooth(6-Math.abs(x)),angle=this.dip*Math.PI/180;
      const h=y-this.riftRoot,taperDepth=1.4,k=.46*Math.sin(angle)*phase/taperDepth;
      if(h<=0)target.set(.17*phase*x*smooth(-h/1.25),0,0);
      else if(side===0)target.set(0,-k*Math.min(h,taperDepth),0);
      else target.set(side*k*Math.min(h/(1-k),taperDepth)/Math.tan(angle),0,0);
    }
    if(slow&&this.spec.process==="collision"){
      const h=Math.tanh((x+target.x)/2.3),jacobian=1-.32*t*(1-h*h);
      target.x-=.736*t*h;target.y+=(y+target.y+.85)*(1/jacobian-1);
    }
    if(quake)target.y+=this.spec.process==="rift"?this.shaking(t,x+target.x,y+target.y,z):this.shakingAt(t,distance??Math.hypot(x-this.hx,y-this.hy,z));
    // The regional block meets a stationary geographic context at its far edges.
    if(this.kind==="strike"&&Math.abs(z)>3.5)target.multiplyScalar(smooth(4.5-Math.abs(z)));
    return target;
  }
  uplift(x:number,t:number){
    if(!this.waterEvent)return 0;
    const y=this.height(x,0),side=x>=this.trace?1:-1;
    // The local hanging-wall response is tapered away from the slipping patch.
    const staticSlip=this.offset(new T.Vector3(),x,y,0,side,t).y-this.shaking(t,x,y,0);
    const pre=this.offset(new T.Vector3(),x,y,0,side,onset).y;
    return t>onset?staticSlip-pre:0;
  }
}

