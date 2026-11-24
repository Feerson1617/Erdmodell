import * as T from "three";
import { R,position } from "../geo";
import { localAsset } from "../assets";

export const scenarios={past:{label:"Rekonstruktion",end:250},ultima:{label:"Pangaea Ultima",end:250},novo:{label:"Novopangaea",end:200},aurica:{label:"Aurica",end:250},amasia:{label:"Amasia",end:200}} as const;
export type Scenario=keyof typeof scenarios;
type Evidence={name:string;kind:string;coords:[number,number][]};
const fragment=`
uniform sampler2D first,second;uniform float blend,future;varying vec2 coord;varying vec3 norm;
void main(){
 vec3 a=texture2D(first,coord).rgb,b=texture2D(second,coord).rgb;
 float land=mix(a.x,b.x,blend),boundary=mix(a.y,b.y,blend);
 float lat=abs(coord.y-.5)*2.;float light=clamp(dot(normalize(norm),normalize(vec3(-.4,.6,1.))),0.,1.);
 vec3 sea=mix(vec3(.048,.17,.22),vec3(.11,.27,.32),light);
 vec3 earth=mix(vec3(.57,.53,.355),vec3(.68,.72,.52),lat*.57+light*.36);
 earth=mix(earth,earth*vec3(1.10,.91,.78),future);
 vec3 col=mix(sea,earth,land*(1.-future));col=mix(col,vec3(.66,.48,.33),mix(a.b,b.b,blend)*.23*(1.-future));col=mix(col,vec3(.89,.74,.51),boundary*.88);
 float rim=pow(1.-abs(normalize(norm).z),4.);
 gl_FragColor=vec4(col*(.72+.32*light)+vec3(.11,.21,.24)*rim,1.);
}`;
function globe(){
 const material=new T.ShaderMaterial({uniforms:{first:{value:null},second:{value:null},blend:{value:0},future:{value:0}},vertexShader:"varying vec2 coord;varying vec3 norm;void main(){coord=uv;norm=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",fragmentShader:fragment});
 const geometry=new T.SphereGeometry(R,144,88).rotateY(-Math.PI/2);const sphere=new T.Mesh(geometry,material);sphere.visible=false;
 const scene=new T.Scene();scene.add(sphere);return {scene,sphere,material};
}
export class TimeGlobe {
  primary=globe();other=globe();markers=new T.Group();private evidence:Evidence[]=[];
  private cache=new Map<string,{used:number;promise:Promise<T.Texture>;texture?:T.Texture}>();private stamp=0;private disposed=false;
  private channels=["",""];private displayed=["",""];private previousMarks="";
  year=-250;scenario:Scenario="past";compare=false;direction=1;speed=7;playing=false;layer="";error="";ready=false;
  constructor(){this.primary.scene.add(this.markers);void fetch(localAsset("data/g5/evidence.json")).then(r=>r.json()).then(data=>{this.evidence=data;this.previousMarks="";}).catch(()=>{this.error="Belegorte konnten nicht geladen werden.";});}
  private rotating?:Promise<void>;private models?:Record<string,number[][][]>;private continents=[new T.Group(),new T.Group()];
  private async buildContinents(){
    const [data,angles]=await Promise.all([fetch(localAsset("data/g5/time/future.i16")),fetch(localAsset("data/g5/time/future-rotations.json"))]);
    if(!data.ok||!angles.ok)throw Error("Kontinentdaten fehlen");
    const coords=new Int16Array(await data.arrayBuffer()),def=await angles.json() as {index:{start:number;count:number}[];models:Record<string,number[][][]>};
    if(this.disposed)return;this.models=def.models;
    const mat=new T.ShaderMaterial({side:T.DoubleSide,vertexShader:"varying vec3 n;void main(){n=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",fragmentShader:"varying vec3 n;void main(){float light=clamp(dot(normalize(n),normalize(vec3(-.4,.6,1.))),0.,1.);gl_FragColor=vec4(vec3(.70,.59,.40)*(.74+.33*light),1.);}"});
    for(const entry of def.index){const a=[],ns=[];for(let i=entry.start;i<entry.start+entry.count;i++){
      const v=position(coords[2*i+1]/100,coords[i*2]/100,27);a.push(v.x,v.y,v.z);v.normalize();ns.push(v.x,v.y,v.z);}
      const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(a,3));g.setAttribute("normal",new T.Float32BufferAttribute(ns,3));
      for(const group of this.continents)group.add(new T.Mesh(g,mat));
    }
    this.primary.scene.add(this.continents[0]);this.other.scene.add(this.continents[1]);
  }
  private rotate(model:Scenario,idx:number){
    this.continents[idx].visible=model!=="past";if(model==="past")return;
    this.rotating??=this.buildContinents().catch(()=>{this.error="Die Rotationen konnten nicht geladen werden.";});
    if(!this.models)return;
    const seq=this.models[model],year=Math.min(this.year,seq.length-1),a=Math.floor(year),b=Math.min(a+1,seq.length-1);
    const q=new T.Quaternion();this.continents[idx].children.forEach((m,i)=>m.quaternion.fromArray(seq[a][i]).slerp(q.fromArray(seq[b][i]),year-a));
  }
  private load(key:string){
    const existing=this.cache.get(key);if(existing){existing.used=++this.stamp;return existing.promise;}
    const entry={used:++this.stamp,promise:new T.TextureLoader().loadAsync(localAsset("data/g5/time/"+key+".webp")),texture:undefined as T.Texture|undefined};
    this.cache.set(key,entry);entry.promise.then(texture=>{entry.texture=texture;if(this.disposed)texture.dispose();else{texture.colorSpace=T.NoColorSpace;texture.wrapS=T.RepeatWrapping;texture.generateMipmaps=false;texture.minFilter=T.LinearFilter;}}).catch(()=>{this.cache.delete(key);});return entry.promise;
  }
  private prepare(model:Scenario,idx:number){
    const year=Math.min(Math.abs(this.year),scenarios[model].end),lo=Math.floor(year/5)*5,hi=Math.min(scenarios[model].end,lo+5),key=model+"-"+lo+":"+model+"-"+hi;
    const view=idx?this.other:this.primary;
    if(this.displayed[idx]===key){this.channels[idx]=key;view.material.uniforms.blend.value=(year-lo)/5;return;}
    if(this.channels[idx]===key)return;this.channels[idx]=key;
    void Promise.all([this.load(model+"-"+lo),this.load(model+"-"+hi)]).then(([a,b])=>{
      if(this.disposed||this.channels[idx]!==key)return;
      Object.assign(view.material.uniforms.first,{value:a});view.material.uniforms.second.value=b;view.material.uniforms.future.value=+(model!=="past");
      view.material.uniforms.blend.value=T.MathUtils.clamp((Math.abs(this.year)-lo)/5,0,1);view.sphere.visible=true;this.displayed[idx]=key;this.ready=true;
      const retain=new Set([...this.displayed,...this.channels].flatMap(s=>s.split(":")));
      for(const [k,e] of [...this.cache].sort((a,b)=>a[1].used-b[1].used)){if(this.cache.size<=8)break;if(!retain.has(k)&&e.texture){e.texture.dispose();this.cache.delete(k);}}
      const ahead=lo+5*(this.year<0?-this.direction:this.direction);if(ahead>=0&&ahead<=scenarios[model].end)void this.load(model+"-"+ahead).catch(()=>{});
    }).catch(()=>{if(this.channels[idx]===key){this.error="Dieser Zeitschnitt fehlt. Bitte eine andere Zeit wählen.";this.playing=false;}});
  }
  setYear(y:number){const max=this.scenario==="past"?0:scenarios[this.scenario].end;this.year=T.MathUtils.clamp(y,-250,max);if(this.year<=0)this.compare=false;}
  get model():Scenario{return this.year<=0?"past":this.scenario;}
  get second():Scenario{return this.scenario==="novo"?"ultima":"novo";}
  private updateMarkers(){
    const slice=Math.round(Math.abs(this.year)/5),key=[this.layer,this.year>0,slice,this.evidence.length].join("/");
    if(key===this.previousMarks)return;this.previousMarks=key;this.markers.clear();
    if(!this.layer||this.year>0)return;
    for(const e of this.evidence.filter(v=>v.kind===this.layer)){
      const [lat,lon]=e.coords[slice];const m=new T.Mesh(this.pinGeo,this.pinMat);m.position.copy(position(lat,lon,72));m.name=e.name;this.markers.add(m);}
  }
  private pinGeo=new T.SphereGeometry(93,12,8);private pinMat=new T.MeshBasicMaterial({color:0xffae62});
  render(dt:number,gl:T.WebGLRenderer,camera:T.PerspectiveCamera){
    if(this.playing){const max=this.scenario==="past"?0:scenarios[this.scenario].end;this.setYear(this.year+dt*this.speed*this.direction);if(this.year===max||this.year===-250)this.playing=false;}
    this.rotate(this.model,0);this.prepare(this.model,0);this.updateMarkers();
    if(this.compare&&this.year>0){if(this.year>scenarios[this.second].end){this.setYear(scenarios[this.second].end);this.playing=false;}
      this.rotate(this.second,1);this.prepare(this.second,1);const w=gl.domElement.clientWidth,h=gl.domElement.clientHeight,aspect=camera.aspect,fov=camera.fov;
      const split=Math.floor(w/2);gl.setScissorTest(true);camera.aspect=split/h;camera.fov=fov/Math.min(1,camera.aspect*.91);camera.updateProjectionMatrix();
      for(const [i,view] of [this.primary,this.other].entries()){const width=i?w-split:split;gl.setViewport(i*split,0,width,h);gl.setScissor(i*split,0,width,h);gl.render(view.scene,camera);}
      gl.setScissorTest(false);gl.setViewport(0,0,w,h);camera.aspect=aspect;camera.fov=fov;camera.updateProjectionMatrix();
    }else gl.render(this.primary.scene,camera);
  }
  pick(ray:T.Raycaster){return ray.intersectObjects(this.markers.children)[0]?.object.name;}
  dispose(){this.disposed=true;for(const entry of this.cache.values())entry.texture?.dispose();this.cache.clear();
    for(const m of this.continents[0].children as T.Mesh[]){m.geometry.dispose();(m.material as T.Material).dispose();}
    for(const v of [this.primary,this.other]){v.sphere.geometry.dispose();v.material.dispose();}this.pinGeo.dispose();this.pinMat.dispose();}
}
