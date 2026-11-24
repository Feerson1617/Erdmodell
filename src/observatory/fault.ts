import * as T from "three";
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
    this.profile=spec.site==="japan"&&this.kind==="interface"?sampled:[];
    this.trace=this.profile.length?this.profile[0][0]:this.kind==="normal"&&p==="rift"?-1.45:0;
    this.top=height(this.trace,0);
    this.hy=this.top-(this.kind==="interface"?.64:1.06);this.hx=this.xAt(this.hy);
    this.slipSign=this.kind==="normal"?-1:1;
    this.waterEvent=spec.theme==="earthquake"&&this.kind==="interface"&&this.top<0;
  }
  // Slab2 active-source transect, relative to its shallowest constraint.
  xAt(y:number){
    const depth=this.top-y;
    if(this.profile.length){
      const km=this.profile[0][1]+depth*320/(12*2.4);
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
      return this.top-(km-this.profile[0][1])*12*2.4/320;
    }
    return this.top-(x-this.trace)*this.dipSign*Math.tan(this.dip*Math.PI/180);
  }
  point(y:number,z=0){return new T.Vector3(this.xAt(y),y,z);}
  release(t:number,x:number,y:number,z:number){return smooth((t-onset-Math.hypot(x-this.hx,y-this.hy,z)/16)/.07);}
  shaking(t:number,x:number,y:number,z:number){
    const d=Math.hypot(x-this.hx,y-this.hy,z),a=t-onset-d/pSpeed,b=t-onset-d/sSpeed;
    const pulse=(v:number)=>v>0&&v<.35?Math.sin(v*117)*Math.exp(-v*15)*smooth(v/.018)*(1-smooth((v-.22)/.13)):0;
    return (.035*pulse(a)+.069*pulse(b))/(1+.18*d);
  }
  offset(target:T.Vector3,x:number,y:number,z:number,side:number,t:number,theme=this.spec.theme){
    target.set(0,0,0);if(t===0||this.kind==="unknown")return target;
    const quake=theme==="earthquake"||theme==="risk",slow=theme==="process"||theme==="magnet"||theme==="forces";
    if(!quake&&!slow)return target;
    const lock=Math.exp(-Math.abs(x-this.xAt(y))*.94-z*z*.029);
    const strain=quake?smooth(t/onset)*(1-lock+lock*this.release(t,x,y,z)):t;
    const taper=quake&&this.waterEvent?Math.exp(-Math.pow((x-this.hx)/2.4,2)):1;
    const slip=side*.38*strain*taper;
    if(this.kind==="strike")target.z=this.sense*slip;
    else if(this.kind==="interface"||this.kind==="thrust"||this.kind==="normal"){
      const dy=slip*this.slipSign*this.dipSign*Math.sin(this.dip*Math.PI/180);
      target.set(this.xAt(y+dy)-this.xAt(y),dy,0);
      // The nascent plate at a spreading axis and the hinterland separate over geologic time.
      if(slow&&this.spec.process==="ridge")target.set(side*.65*t,0,0);
    }
    if(quake)target.y+=this.shaking(t,x,y,z);
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

