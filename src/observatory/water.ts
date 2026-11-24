import type {Fault} from "./fault";
import {onset} from "./fault";

// One-dimensional depth-averaged shallow water. Hydrostatic reconstruction preserves
// still water over a sloping bed. Time, horizontal distance and relief are model units.
export class WaterSection{
  readonly cells=121;readonly frames=241;readonly dx=12/(this.cells-1);
  readonly surfaces=new Float32Array(this.cells*this.frames);
  readonly depths=new Float32Array(this.cells*this.frames);
  constructor(fault:Fault){
    const n=this.cells,dx=this.dx,g=620;
    const z=new Float64Array(n),h=new Float64Array(n),q=new Float64Array(n),floor=new Float64Array(n);
    const mass=new Float64Array(n+1),rightFlux=new Float64Array(n+1),leftFlux=new Float64Array(n+1);
    const end=new Float64Array(n),delay=new Float64Array(n);
    for(let i=0;i<n;i++){
      const x=-6+i*dx;floor[i]=fault.height(x,0);z[i]=floor[i];h[i]=Math.max(0,-z[i]);
      end[i]=fault.uplift(x,1);delay[i]=onset+Math.hypot(x-fault.hx,floor[i]-fault.hy)/16;
    }
    const steps=6,dt=1/(this.frames-1)/steps;
    for(let frame=0;frame<this.frames;frame++){
      for(let i=0;i<n;i++){this.surfaces[frame*n+i]=z[i]+h[i];this.depths[frame*n+i]=h[i];}
      for(let k=1;k<=steps&&frame<this.frames-1;k++){
        const t=(frame+k/steps)/(this.frames-1);
        for(let i=0;i<n;i++){
          const v=Math.max(0,Math.min(1,(t-delay[i])/.07));z[i]=floor[i]+end[i]*v*v*(3-2*v);
        }
        for(let face=0;face<=n;face++){
          const l=Math.max(0,face-1),r=Math.min(n-1,face),crest=Math.max(z[l],z[r]);
          const hl=Math.max(0,z[l]+h[l]-crest),hr=Math.max(0,z[r]+h[r]-crest);
          const ul=h[l]>.0001?q[l]/h[l]:0,ur=h[r]>.0001?q[r]/h[r]:0;
          const a=Math.max(Math.abs(ul)+Math.sqrt(g*hl),Math.abs(ur)+Math.sqrt(g*hr));
          mass[face]=(hl*ul+hr*ur-a*(hr-hl))*.5;
          const flux=(hl*ul*ul+hr*ur*ur+.5*g*(hl*hl+hr*hr)-a*(hr*ur-hl*ul))*.5;
          leftFlux[face]=flux+.5*g*(h[l]*h[l]-hl*hl);
          rightFlux[face]=flux+.5*g*(h[r]*h[r]-hr*hr);
        }
        for(let i=0;i<n;i++){
          h[i]=Math.max(0,h[i]-dt/dx*(mass[i+1]-mass[i]));
          q[i]=h[i]<.0001?0:(q[i]-dt/dx*(leftFlux[i+1]-rightFlux[i]))/(1+dt*.10);
        }
      }
    }
  }
  sample(x:number,t:number,depth=false){
    const a=Math.min(this.cells-1,Math.max(0,(x+6)/this.dx)),b=Math.max(0,Math.min(1,t))*(this.frames-1);
    const i=Math.min(this.cells-2,Math.floor(a)),j=Math.min(this.frames-2,Math.floor(b)),u=a-i,v=b-j,buf=depth?this.depths:this.surfaces,k=j*this.cells+i;
    return (1-v)*((1-u)*buf[k]+u*buf[k+1])+v*((1-u)*buf[k+this.cells]+u*buf[k+this.cells+1]);
  }
}

