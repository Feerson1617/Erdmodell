import * as T from "three";
import { position, R } from "../geo";
import { names, type Step } from "../tectonics/atlas";
import stepsUrl from "../tectonics/steps.json?url";
import { localAsset } from "../assets";

type EventRow=[string,string,number,number,number,number,string];
const categories:Record<string,number>={OSR:0x6dd4c0,CRB:0x6dd4c0,SUB:0xf19e69,CCB:0xf19e69,OCB:0xf19e69,CTF:0xc4a0ed,OTF:0xc4a0ed};
export class MapLayers {
  readonly group=new T.Group();readonly events=new T.Group();readonly boundaries=new T.Group();
  steps:Step[]=[];rows:EventRow[]=[];private centers:T.Vector3[]=[];private arcs:{a:T.Vector3;b:T.Vector3}[]=[];
  depth=true;selectedStep?:Step;event?:EventRow;private dots?:T.Points;private active?:T.Line;
  private loaded?:Promise<void>;
  constructor(){this.group.add(this.boundaries,this.events);}
  init(){
    return this.loaded??=(async()=>{
      const [steps,cat]=await Promise.all([fetch(stepsUrl),fetch(localAsset("data/g5/comcat.json"))]);
      if(!steps.ok||!cat.ok)throw Error("Die lokalen Kartendaten fehlen.");
      this.steps=await steps.json();this.rows=(await cat.json()).events;
      const vertices:number[]=[],colors:number[]=[],c=new T.Color();
      for(const s of this.steps){const a=position(s[4],s[3],29),b=position(s[6],s[5],29);vertices.push(...a.toArray(),...b.toArray());c.setHex(categories[s[2]]);colors.push(...c.toArray(),...c.toArray());this.arcs.push({a:a.normalize(),b:b.normalize()});}
      const geo=new T.BufferGeometry();geo.setAttribute("position",new T.Float32BufferAttribute(vertices,3));geo.setAttribute("color",new T.Float32BufferAttribute(colors,3));
      this.boundaries.add(new T.LineSegments(geo,new T.LineBasicMaterial({vertexColors:true})));
      const points:number[]=[];for(const r of this.rows){const v=position(r[3],r[2],52);points.push(...v.toArray());this.centers.push(v.normalize());}
      const dots=new T.BufferGeometry();dots.setAttribute("position",new T.Float32BufferAttribute(points,3));
      this.dots=new T.Points(dots,new T.ShaderMaterial({uniforms:{},vertexShader:"attribute vec3 color;varying vec3 vColor;void main(){vColor=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(6.*16000./gl_Position.w,4.,11.);}",fragmentShader:"varying vec3 vColor;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(mix(vColor,vec3(.13,.13,.1),smoothstep(.32,.5,d)*.65),1.);}"}));
      this.events.add(this.dots);this.recolor();
    })().catch(e=>{this.loaded=undefined;throw e;});
  }
  recolor(){const colors:number[]=[];for(const r of this.rows){const h=this.depth?(r[4]>=300?0xc1a3ff:r[4]>=70?0xffa461:0xffde80):0xffde80;colors.push(...new T.Color(h).toArray());}
    this.dots?.geometry.setAttribute("color",new T.Float32BufferAttribute(colors,3));}
  pick(dir:T.Vector3,tol:number,preferEvents:boolean){
    this.event=undefined;this.selectedStep=undefined;
    this.selectStep(undefined);
    if(preferEvents && this.events.visible){let best=tol*tol;this.centers.forEach((p,i)=>{const d=p.distanceToSquared(dir);if(d<best){best=d;this.event=this.rows[i];}});if(this.event)return;}
    if(!this.boundaries.visible)return;
    this.selectStep(this.nearestStep(dir,tol));
  }
  nearestStep(dir:T.Vector3,tol:number,include?:(s:Step)=>boolean){
    let best=tol*tol,step:Step|undefined;
    const p=new T.Vector3(),v=new T.Vector3();
    this.arcs.forEach(({a,b},i)=>{
      if(include&&!include(this.steps[i]))return;
      v.subVectors(b,a);p.subVectors(dir,a);
      const t=T.MathUtils.clamp(p.dot(v)/v.lengthSq(),0,1);
      p.copy(a).addScaledVector(v,t).normalize();
      const d=p.distanceToSquared(dir);
      if(d<best){best=d;step=this.steps[i];}
    });
    return step;
  }
  selectStep(step?:Step){
    if(this.active){this.boundaries.remove(this.active);this.active.geometry.dispose();(this.active.material as T.Material).dispose();this.active=undefined;}
    this.selectedStep=step;
    if(step){const s=step;this.active=new T.Line(new T.BufferGeometry().setFromPoints([position(s[4],s[3],60),position(s[6],s[5],60)]),new T.LineBasicMaterial({color:0xffffff}));this.boundaries.add(this.active);}
  }
  get pair(){const ids=this.selectedStep?.[1].match(/[A-Z]{2}/g)??[];return ids.map(id=>names[id]).join(" und ");}
}
