import * as T from "three";
import {position,R} from "../geo";
import {localAsset} from "../assets";
export const tracks:Record<string,[string,number,number]>={"201":["Südamerika",-16,-53],"701":["Afrika",0,21],"501":["Indien",21,78],"801":["Australien",-25,134],"802":["Ostantarktika",-78,82],"101":["Nordamerika",48,-102],"301":["Eurasischer Kernbereich",54,57]};
type Index={pids:number[];features:[number,number,number,number,number][]};
type Row=[number,number,number,[number,number][]];
type Textures=Record<string,T.IUniform>;
async function file(path:string){const r=await fetch(localAsset("data/g51/"+path));if(!r.ok)throw Error(path);return r;}
export class Reconstructions{
  readonly land=new T.Group();readonly lines=[new T.Group(),new T.Group()];readonly track=new T.Group();
  private lineData?:Record<string,Row[]>;private publishedLines=["",""];private rotation?:Float32Array;private index?:Index;
  private mesh?:T.Mesh<T.BufferGeometry,T.ShaderMaterial>;private atlas?:T.DataTexture;
  private last=NaN;private disposed=false;private lastTrail="";private readonly q=new T.Quaternion();private readonly q2=new T.Quaternion();
  constructor(private textures:Textures){}
  async load(){
    const [index,vertices,angles,lines]=await Promise.all([file("historic.json").then(r=>r.json()),file("historic.i16").then(r=>r.arrayBuffer()),file("historic-rotations.f32").then(r=>r.arrayBuffer()),file("future-lines.json").then(r=>r.json())]);
    if(this.disposed)return;
    this.index=index;this.rotation=new Float32Array(angles);this.lineData=lines;
    const count=index.pids.length;this.atlas=new T.DataTexture(new Float32Array(count*4),count,1,T.RGBAFormat,T.FloatType);
    this.atlas.minFilter=this.atlas.magFilter=T.NearestFilter;
    const values=new Int16Array(vertices),xyz=new Float32Array(values.length/2*3),metadata=new Float32Array(xyz.length);
    for(const [start,n,pid,end,begin] of (index as Index).features)for(let i=start;i<start+n;i++){
      position(values[2*i+1]/100,values[2*i]/100,29).toArray(xyz,3*i);
      metadata[3*i]=pid;metadata[3*i+1]=end;metadata[3*i+2]=begin;
    }
    const g=new T.BufferGeometry();g.setAttribute("position",new T.BufferAttribute(xyz,3));g.setAttribute("temporal",new T.BufferAttribute(metadata,3));
    const m=new T.ShaderMaterial({side:T.DoubleSide,depthWrite:false,uniforms:{...this.textures,rot:{value:this.atlas},count:{value:count},age:{value:0},selected:{value:-1}},
      vertexShader:`attribute vec3 temporal;uniform sampler2D rot;uniform float count,age,selected;varying vec3 globe,n;varying float mark,valid;
      void main(){vec4 q=texture2D(rot,vec2((temporal.x+.5)/count,.5));vec3 v=position+2.*cross(q.xyz,cross(q.xyz,position)+q.w*position);
      globe=normalize(v);n=normalMatrix*globe;valid=step(temporal.y,age)*step(age,temporal.z);mark=1.-step(.1,abs(temporal.x-selected));gl_Position=projectionMatrix*modelViewMatrix*vec4(v,1.);}`,
      fragmentShader:`uniform sampler2D first,second;uniform float blend;varying vec3 globe,n;varying float mark,valid;
      void main(){if(valid<.5)discard;vec3 v=normalize(globe);vec2 uv=vec2(.5+atan(v.x,v.z)/6.2831853,.5+asin(v.y)/3.14159265);
      vec3 masks=mix(texture2D(first,uv).rgb,texture2D(second,uv).rgb,blend);float light=clamp(dot(normalize(n),normalize(vec3(-.4,.6,1.))),0.,1.);
      vec3 c=mix(vec3(.64,.63,.44),vec3(.91,.60,.35),mark);c=mix(c,vec3(.64,.46,.35),masks.b*.36);c=mix(c,vec3(.92,.80,.60),masks.g*.94);gl_FragColor=vec4(c*(.72+.32*light),1.);}`});
    this.mesh=new T.Mesh(g,m);this.mesh.renderOrder=1;this.mesh.frustumCulled=false;this.land.add(this.mesh);
  }
  get ready(){return Boolean(this.mesh);}
  private quat(age:number,pid:number,out:T.Quaternion){
    const n=this.index!.pids.length,a=Math.floor(age),b=Math.min(250,a+1),rot=this.rotation!;
    out.fromArray(rot,4*(a*n+pid));return out.slerp(this.q2.fromArray(rot,4*(b*n+pid)),age-a).normalize();
  }
  at(age:number,id:string){
    if(!this.index||!tracks[id])return;const [,lat,lon]=tracks[id],pid=this.index.pids.indexOf(Number(id));
    const v=position(lat,lon,90).applyQuaternion(this.quat(age,pid,this.q));
    return {lat:T.MathUtils.radToDeg(Math.asin(v.y/v.length())),lon:T.MathUtils.radToDeg(Math.atan2(v.x,v.z)),v};
  }
  draw(age:number,active:boolean,id:string,trail:boolean){
    this.land.visible=active;this.track.visible=active&&trail&&Boolean(id);
    if(!this.mesh||!this.atlas||!this.index||!active)return;
    this.mesh.material.uniforms.selected.value=id?this.index.pids.indexOf(Number(id)):-1;
    this.mesh.material.uniforms.age.value=age;
    if(age!==this.last){
      const dst=this.atlas.image.data as Float32Array;this.index.pids.forEach((_,i)=>this.quat(age,i,this.q).toArray(dst,i*4));this.atlas.needsUpdate=true;this.last=age;
    }
    const key=id+"/"+Math.floor(age);if(!this.track.visible||key===this.lastTrail)return;this.lastTrail=key;
    this.clear(this.track);const coords=[];for(let a=250;a>=age;a-=2)coords.push(this.at(a,id)!.v);coords.push(this.at(age,id)!.v);
    this.track.add(new T.Line(new T.BufferGeometry().setFromPoints(coords),new T.LineBasicMaterial({color:0xf5bb73})));
  }
  boundaries(model:string,year:number,slot:number,enabled:boolean){
    const group=this.lines[slot];group.visible=enabled&&year>0;
    if(!group.visible||!this.lineData)return;
    const rows=this.lineData[model];if(!rows)return;const active=rows.filter(([a,b])=>year>=a&&year<=b);
    const key=model+"/"+active.map(r=>rows.indexOf(r)).join(".");if(this.publishedLines[slot]===key)return;
    this.publishedLines[slot]=key;this.clear(group);
    for(const kind of [0,1]){
      const pts:T.Vector3[]=[];for(const row of active)if(row[2]===kind){const line=row[3].map(([lat,lon])=>position(lat,lon,60));for(let j=1;j<line.length;j++)pts.push(line[j-1],line[j]);}
      const l=new T.LineSegments(new T.BufferGeometry().setFromPoints(pts),new T.LineBasicMaterial({color:kind?0xf0a17f:0x65d7c8}));l.renderOrder=18;group.add(l);
    }
  }
  private clear(g:T.Group){for(const o of [...g.children]){const m=o as T.Mesh<T.BufferGeometry,T.Material>;m.geometry.dispose();m.material.dispose();g.remove(o);}}
  dispose(){this.disposed=true;this.clear(this.land);this.clear(this.track);this.lines.forEach(g=>this.clear(g));this.atlas?.dispose();}
}

