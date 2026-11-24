import type {WaterSection} from "./water";
import type {RegionalScene} from "./regional";

const wet=.001;
export class WaterProfile{
  readonly element=document.createElement("section");
  private previous=-1;private source?:WaterSection;
  private initialWaterline=0;private maxWave=0;private minBed=0;private maxBed=0;private shore=0;
  private crest=0;private ebb=1;
  private paths:Record<string,SVGPathElement>={};
  constructor(parent:HTMLElement){
    const box=this.element;box.id="water-profile";box.hidden=true;box.setAttribute("aria-label","Tsunami im Profil");
    box.innerHTML='<div class="profile-heading"><strong>Wasser im Profil</strong><span data-site></span><button id="profile-close" aria-label="Profil schließen">Schließen</button></div>'+
      '<svg viewBox="0 0 1000 380" role="img" aria-label="Zwei gekoppelte Ansichten der berechneten Wasserstände"><text x="26" y="32">Wasserstand gegenüber der Ruhelage · Höhe vergrößert</text><path d="M32 104H968" class="profile-reference"/><path data-line="wave" class="wave"/><text x="32" y="174">Landseite</text><text x="968" y="174" text-anchor="end">Meerseite</text><text x="26" y="213" data-section></text><path data-line="rock" class="rock"/><path data-line="water" class="water"/><path data-line="inland" class="inland"/><path data-line="still" class="profile-reference"/><path data-line="edge" class="edge"/><path data-line="depth" class="depth"/><path data-line="original-shore" class="original-shore"/><path data-line="advance" class="advance"/></svg>'+
      '<div class="profile-actions"><span>Gestrichelt · Ruhewasser<br>Gelb · Wassertiefe</span><span data-key></span><button id="profile-before">Vorher</button><button id="profile-peak">Welle</button><button id="profile-ebb">Später</button></div>';
    box.querySelectorAll<SVGPathElement>("[data-line]").forEach(p=>this.paths[p.dataset.line!]=p);parent.append(box);
  }
  // First wet/dry crossing on the coast profile, with the same interpolation as the filled polygons.
  private waterline(w:WaterSection,t:number){
    let previous=w.sample(-6,t,true);
    if(previous>wet)return -6;
    for(let i=1;i<w.cells;i++){
      const x=-6+i*w.dx,depth=w.sample(x,t,true);
      if(depth>wet)return x-w.dx+w.dx*(wet-previous)/(depth-previous);
      previous=depth;
    }
    return 6;
  }
  hide(){this.element.hidden=true;this.source=undefined;this.previous=-1;}
  show(r:RegionalScene,close:()=>void){
    const w=r.water;if(!w||!r.analysis){if(!this.element.hidden)this.hide();return;}
    this.element.hidden=false;
    if(this.source!==w){
      this.source=w;this.previous=-1;this.maxWave=.0001;this.minBed=0;this.maxBed=.015;this.shore=w.extent(0).shore;this.initialWaterline=this.waterline(w,0);
      let peak=-1;
      for(let j=0;j<w.frames;j++){
        const t=j/(w.frames-1);let signal=0;
        for(let i=0;i<w.cells;i++){const k=j*w.cells+i,x=-6+i*w.dx;
          if(w.depths[k]>wet&&w.depths[i]>wet)this.maxWave=Math.max(this.maxWave,Math.abs(w.surfaces[k]-w.surfaces[i]));
          if(!r.spec.coastLesson||x>=this.shore-.85&&x<=this.shore+1.45){this.minBed=Math.min(this.minBed,w.surfaces[k]-w.depths[k]);this.maxBed=Math.max(this.maxBed,w.surfaces[k]);}
          if(r.spec.coastLesson&&w.depths[i]<=wet)signal+=w.depths[k];else if(!r.spec.coastLesson&&Math.abs(x-r.faultModel.hx)>1.3&&w.depths[i]>wet)signal+=Math.abs(w.surfaces[k]-w.surfaces[i]);
        }
        if(signal>peak){peak=signal;this.crest=t;}
      }
      this.ebb=1;if(r.spec.coastLesson){let min=Infinity;for(let j=Math.ceil(this.crest*(w.frames-1));j<w.frames;j++){const t=j/(w.frames-1),e=w.extent(t),v=e.newlyWet+e.deepest;if(v<min){min=v;this.ebb=t;}}}
      const label=(key:string,s:string)=>this.element.querySelector(key)!.textContent=s;
      label("[data-site]",r.spec.coastLesson?"Schematisches Küstenprofil":"Japan · Tōhoku-Profil");
      label("[data-section]",r.spec.coastLesson?"Ausschnitt am ursprünglichen Ufer":"Wasser und bewegter Meeresboden");
      label("[data-key]",r.spec.coastLesson?"Senkrechte · ursprüngliches Ufer | Türkis · neu benetzte Strecke":"Eindimensionales Flachwassermodell");
      for(const [id,t] of [["before",0],["peak",this.crest],["ebb",this.ebb]] as const)this.element.querySelector<HTMLButtonElement>("#profile-"+id)!.onclick=()=>{r.playing=false;r.progress=t;};
      this.element.querySelector<HTMLButtonElement>("#profile-close")!.onclick=close;
    }
    if(this.previous===r.progress)return;this.previous=r.progress;
    const t=r.progress,lo=r.spec.coastLesson?this.shore-.85:-6,hi=r.spec.coastLesson?this.shore+1.45:6;
    const X=(x:number)=>32+936*(x-lo)/(hi-lo),Y=(h:number)=>354-115*(h-this.minBed)/(this.maxBed-this.minBed);
    const point=(x:number,y:number)=>x.toFixed(2)+" "+y.toFixed(2);
    let wave="",rock="",water="",inland="",edge="",pen=false;
    const path=(name:string,d:string)=>this.paths[name].setAttribute("d",d);
    for(let i=0;i<w.cells;i++){
      const x=-6+i*w.dx,h=w.sample(x,t,true),eta=w.sample(x,t);
      if(h>wet&&w.depths[i]>wet){wave+=(pen?"L":"M")+point(32+936*i/(w.cells-1),104-54*(eta-w.surfaces[i])/this.maxWave);pen=true;}else pen=false;
    }
    // Draw only the wet portion of each segment, intersected at the solver's wet/dry threshold.
    const nodes=[lo,...Array.from({length:w.cells},(_,i)=>-6+i*w.dx).filter(x=>x>lo&&x<hi),hi];
    for(let i=0;i<nodes.length;i++){const x=nodes[i],D=w.sample(x,t,true),bed=w.bed(x,t);rock+=(i?"L":"M")+point(X(x),Y(bed));
      if(!i)continue;const a=nodes[i-1],A=w.sample(a,t,true);
      if(A<=wet&&D<=wet)continue;
      const cut=Math.abs(D-A)>1e-10?a+(x-a)*(wet-A)/(D-A):a;
      const left=A>wet?a:cut,right=D>wet?x:cut;
      const poly=(l:number,h:number)=>"M"+point(X(l),Y(w.sample(l,t)))+"L"+point(X(h),Y(w.sample(h,t)))+"L"+point(X(h),Y(w.bed(h,t)))+"L"+point(X(l),Y(w.bed(l,t)))+"Z";
      water+=poly(left,right);edge+="M"+point(X(left),Y(w.sample(left,t)))+"L"+point(X(right),Y(w.sample(right,t)));
      const A0=w.sample(left,0,true),D0=w.sample(right,0,true);
      if(A0<=wet||D0<=wet){const at=A0===D0?left:left+(right-left)*(wet-A0)/(D0-A0);inland+=poly(A0<=wet?left:at,D0<=wet?right:at);}
    }
    const probe=r.spec.coastLesson?this.shore+.44:2.4;
    path("rock",rock+"L968 362H32Z");path("wave",wave);path("water",water);path("inland",inland);path("edge",edge);
    let origin="",advance="";
    if(r.spec.coastLesson){
      const start=X(this.initialWaterline),front=X(this.waterline(w,t));
      origin="M"+point(start,231)+"V355";
      if(front<start-.25)advance="M"+point(front,235)+"H"+start;
    }
    path("original-shore",origin);path("advance",advance);
    path("still","M32 "+Y(0)+"H968");path("depth","M"+point(X(probe),Y(w.bed(probe,t)))+"V"+Y(w.sample(probe,t)));
  }
}
