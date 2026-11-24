import * as T from "three";
import {localAsset} from "../assets";
import {libraryGLSL,type Library} from "./graphics";
import {scannedSpecimen} from "./local-specimens";
import {randomSequence,specimen} from "./local-plants";
import measured from "./parkfield-relief.json";
import type {Site} from "./boundaries";

const mix=T.MathUtils.lerp,clamp=T.MathUtils.clamp;
export const localView=(view:string)=>view==="local"||view==="ground";
const positions=["local","ground"] as const;
function hash(x:number,z:number){const n=Math.sin(x*127.1+z*311.7)*43758.5453;return n-Math.floor(n);}
function noise(x:number,z:number){
  const i=Math.floor(x),j=Math.floor(z),u=T.MathUtils.smoothstep(x-i,0,1),v=T.MathUtils.smoothstep(z-j,0,1);
  return mix(mix(hash(i,j),hash(i+1,j),u),mix(hash(i,j+1),hash(i+1,j+1),u),v);
}
const relief=(x:number,z:number)=>{
  const u=clamp((x+900)*96/1800,0,95.9999),v=clamp((z+900)*96/1800,0,95.9999),i=Math.floor(u),j=Math.floor(v),k=97*j+i;
  return .1*mix(mix(measured[k],measured[k+1],u-i),mix(measured[k+97],measured[k+98],u-i),v-j);
};
// A shared nonuniform mesh resolves roots and scree in metres near the observer,
// then samples the wider landscape at progressively longer intervals.
const axis=Array.from({length:177},(_,i)=>{const n=i-88,k=Math.abs(n);return Math.sign(n)*(k<=58?k*1.15:66.7+Math.expm1((k-58)*.148)*16);});
function interval(x:number){let a=0,b=axis.length-1;while(b-a>1){const m=(a+b)>>1;if(axis[m]<=x)a=m;else b=m;}return a;}

export class LocalLandscape{
  readonly scene=new T.Scene();
  private readonly root=new T.Group();
  private readonly halves=[new T.Group(),new T.Group()];
  private readonly sun=new T.DirectionalLight(0xffe7c6,2.15);
  private terrain:number[][]=[];
  private photo?:T.Texture;
  private disposed=false;
  revision=0;
  private sets:{group:T.InstancedMesh;near:T.BufferGeometry;mid:T.BufferGeometry;matrices:T.Matrix4[];middle:T.InstancedMesh;scans:T.InstancedMesh[];type:string}[]=[];
  private lastZone="";
  constructor(readonly site:Site,private lib:Library,private grade:{value:number}){
    this.scene.background=new T.Color(0xb8cfda);this.scene.fog=new T.FogExp2(0xb9cbd1,.010);
    this.scene.add(new T.HemisphereLight(0xe9f2ff,0xab9978,1.68),this.sun,this.sun.target,this.root);
    this.root.scale.setScalar(.1);this.root.add(...this.halves);this.sun.position.set(-12,17,8);
    this.sun.castShadow=true;Object.assign(this.sun.shadow.camera,{left:-5,right:5,top:5,bottom:-5,near:.1,far:45});this.sun.shadow.camera.updateProjectionMatrix();
    this.sun.shadow.mapSize.set(1024,1024);this.sun.shadow.bias=-.00022;this.sun.shadow.normalBias=.008;
    const sky=new T.Mesh(new T.SphereGeometry(200,32,20),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,
      vertexShader:"varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader:`varying vec3 direction;void main(){vec3 d=normalize(direction);float y=max(0.,d.y);vec3 col=mix(vec3(.69,.77,.78),vec3(.16,.38,.63),pow(y,.53));col+=vec3(.12,.07,.025)*pow(max(0.,dot(d,normalize(vec3(-.62,.55,.29)))),14.);gl_FragColor=vec4(col,1.);
      #include <colorspace_fragment>
      }`}));
    this.scene.add(sky);
    for(const z of axis)this.terrain.push(axis.map(x=>this.height(x,z)));
    const ground=this.groundMaterial();
    for(let half=0;half<2;half++){
      const p:number[]=[],idx:number[]=[],n=89;
      for(let j=0;j<axis.length;j++)for(let i=0;i<n;i++){
        const col=i+half*88;p.push(axis[col],this.terrain[j][col],axis[j]);
        const k=j*n+i;if(j+1<axis.length&&i+1<n)idx.push(k,k+n,k+1,k+1,k+n,k+n+1);
      }
      const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();
      const mesh=new T.Mesh(g,ground);mesh.receiveShadow=true;this.halves[half].add(mesh);
    }
    this.plant();
  }
  private height(x:number,z:number){
    const broad=noise(x*.023,z*.023),fine=noise(x*.41,z*.41),grain=noise(x*.12,z*.12);
    const gully=Math.exp(-((x-7-3*Math.sin(z*.065))**2)/7);
    const outside=Math.max(0,Math.hypot(x,z)-400);
    return relief(x-90,z-155)-relief(-90,-155)+.62*(broad-.5)+.31*(grain-.5)+.12*(fine-.5)-.44*gully+
      outside*.115*noise(x*.003,z*.003);
  }
  // Exact barycentric height in the same two triangles submitted to the GPU.
  surface(x:number,z:number){
    const i=interval(x),j=interval(z),u=(x-axis[i])/(axis[i+1]-axis[i]),v=(z-axis[j])/(axis[j+1]-axis[j]);
    const a=this.terrain[j],b=this.terrain[j+1];
    return u+v<=1?a[i]*(1-u-v)+a[i+1]*u+b[i]*v:a[i+1]*(1-v)+b[i]*(1-u)+b[i+1]*(u+v-1);
  }
  private groundMaterial(){
    const m=new T.MeshStandardMaterial({color:0xffffff,roughness:.92});
    const imagery={value:this.lib.color},hasPhoto={value:0};
    if(this.site==="san")new T.TextureLoader().load(localAsset("data/g61/parkfield.webp"),tex=>{
      if(this.disposed){tex.dispose();return;}this.photo=tex;tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;imagery.value=tex;hasPhoto.value=1;this.revision++;
    });
    m.onBeforeCompile=s=>{
      Object.assign(s.uniforms,{faciesColor:{value:this.lib.color},faciesRelief:{value:this.lib.relief},detailGrade:this.grade,ortho:imagery,hasPhoto});
      s.vertexShader="varying vec3 metres;varying float incline;\n"+s.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nmetres=position;incline=1.-normal.y;");
      s.fragmentShader=libraryGLSL+"varying vec3 metres;varying float incline;uniform sampler2D ortho;uniform float hasPhoto;\n"+s.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
        vec2 p=metres.xz;vec2 warp=vec2(sin(p.y*.082+p.x*.035),cos(p.x*.103-p.y*.027))*.10;
        vec2 first=p*.22+warp,second=mat2(.83,.55,-.55,.83)*p*.41+.27;
        vec3 soil=fieldSample(faciesColor,first,0.).rgb,grit=fieldSample(faciesColor,second,1.).rgb;
        float soilMix=smoothstep(-.65,.69,sin(p.x*.16+sin(p.y*.24))*.61+cos(p.y*.19+p.x*.15)*.42+incline*2.);
        vec3 grain=mix(soil,grit,soilMix*.73);vec3 micro=fieldSample(faciesRelief,first,0.).rgb;
        vec3 geo=texture2D(ortho,clamp(vec2(.5+(p.x-90.)/1800.,.5-(p.y-155.)/1800.),.001,.999)).rgb;
        float distanceM=length(vViewPosition)*10.;
        vec3 dryBase=mix(vec3(.28,.198,.102),vec3(.40,.31,.16),soilMix);
        vec3 base=mix(dryBase,geo,hasPhoto*mix(.26,.91,smoothstep(28.,155.,distanceM)));
        diffuseColor.rgb=mix(base*clamp(.30+2.5*luma6(grain),.33,1.65),grain*vec3(1.04,.85,.62),.73*(1.-smoothstep(22.,110.,distanceM)));
      `).replace("#include <normal_fragment_maps>","#include <normal_fragment_maps>\nnormal=normalize(normal+mat3(viewMatrix)*vec3(micro.r-.5,0.,micro.g-.5)*.61);")
      .replace("#include <roughnessmap_fragment>","#include <roughnessmap_fragment>\nroughnessFactor=clamp(.65+.29*micro.b,.64,.99);");
    };return m;
  }
  private plant(){
    const rng=randomSequence(64119),mat=new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.91});
    type Kind=Parameters<typeof specimen>[0];const batches=new Map<string,T.Matrix4[]>(),o=new T.Object3D();
    const place=(kind:Kind,x:number,z:number,size:number)=>{
      const side=+(x>=0),variant=Math.floor(rng()*3),key=[kind,side,variant].join("/");
      o.position.set(x,this.surface(x,z)-(kind==="rock"?.12*size:0),z);o.rotation.set(0,rng()*Math.PI*2,0);o.scale.set(size*(.87+.26*rng()),size,size*(.87+.25*rng()));o.updateMatrix();
      if(!batches.has(key))batches.set(key,[]);batches.get(key)!.push(o.matrix.clone());
    };
    for(let i=0;i<14600;i++){
      const span=i%3===0?58:154,x=(rng()-.5)*span,z=(rng()-.53)*span,moist=noise(x*.068,z*.068);
      const outcrop=1-Math.min(1,Math.abs(x-6-4*Math.sin(z*.084))/5);
      if(rng()<.24*outcrop+.025*moist)place("rock",x,z,.10+(rng()**3)*1.12);
      else if(rng()<.24+.59*moist&&outcrop<.8)place("grass",x,z,.52+.82*rng());
      if(i<135&&moist>.45)place("shrub",x,z,.56+1.1*rng());
    }
    for(let j=0;j<254;j++){
      const x=(rng()-.5)*410,z=(rng()-.6)*360;
      if(Math.hypot(x,z)>18&&noise(x*.018,z*.018)>.52)place("oak",x,z,.68+.67*rng());
    }
    place("oak",-8,-12,1.16);place("oak",12,-25,.86);place("shrub",5,-1,1);
    place("rock",2,0,1.32);place("rock",3,.8,.64);
    for(const [key,matrices] of batches){
      const [kind,side,variant]=key.split("/"),near=specimen(kind as Kind,29+Number(variant)*31),mid=specimen(kind as Kind,29+Number(variant)*31,true);
      const group=new T.InstancedMesh(near,mat,matrices.length);
      matrices.forEach((m,i)=>group.setMatrixAt(i,m));group.castShadow=kind!=="grass";group.receiveShadow=true;group.name=kind;
      const middle=new T.InstancedMesh(mid,mat,matrices.length);middle.castShadow=kind==="oak";middle.receiveShadow=true;
      this.halves[Number(side)].add(group,middle);const scans:T.InstancedMesh[]=[];this.sets.push({group,near,mid,matrices,middle,scans,type:kind});
      scannedSpecimen(kind)?.then(parts=>{
        if(this.disposed)return;
        for(const part of parts){const model=new T.InstancedMesh(part.geometry,part.material,matrices.length);
          model.count=0;model.frustumCulled=false;model.userData.sharedSpecimen=true;model.castShadow=kind!=="grass";model.receiveShadow=true;
          this.halves[Number(side)].add(model);scans.push(model);}
        this.lastZone="";this.revision++;
      }).catch(e=>console.error("Nahdetail konnte nicht geladen werden",kind,e));
    }
  }
  pose(view:string){
    const [x,z,tx,tz,eye]=view===positions[0]?[22,37,0,-10,9]:[5,9,0,-7,1.9];
    return {position:new T.Vector3(x,this.surface(x,z)+eye,z).multiplyScalar(.1),target:new T.Vector3(tx,this.surface(tx,tz)+2.4,tz).multiplyScalar(.1)};
  }
  update(camera:T.PerspectiveCamera,t:number,grade:number){
    const slip=this.site==="san"?T.MathUtils.smoothstep(t,.35,.51)*.35:0;
    this.halves[0].position.z=-slip;this.halves[1].position.z=slip;
    const cx=camera.position.x*10,cz=camera.position.z*10,key=[Math.round(cx/3),Math.round(cz/3),grade].join("/");
    if(key===this.lastZone)return;this.lastZone=key;this.sun.castShadow=grade>0;
    for(const set of this.sets){
      const max=set.type==="grass"?[22,38,50][grade]:set.type==="rock"?[53,85,110][grade]:set.type==="shrub"?[50,84,110][grade]:220;
      let near=0,mid=0;
      const high=set.type==="grass"?[7,12,17][grade]:set.type==="oak"||set.type==="conifer"?[38,60,85][grade]:[14,27,38][grade];
      for(const m of set.matrices){
        const distance=Math.hypot(m.elements[12]-cx,m.elements[14]-cz);
        if(distance<high){for(const scan of set.scans)scan.setMatrixAt(near,m);set.group.setMatrixAt(near++,m);}else if(distance<max)set.middle.setMatrixAt(mid++,m);
      }
      set.group.count=set.scans.length?0:near;set.middle.count=mid;for(const scan of set.scans){scan.count=near;scan.instanceMatrix.needsUpdate=true;}
      for(const mesh of [set.group,set.middle]){mesh.instanceMatrix.needsUpdate=true;mesh.frustumCulled=false;}
    }
  }
  dispose(){
    this.disposed=true;const gs=new Set<T.BufferGeometry>(),ms=new Set<T.Material>();this.scene.traverse(obj=>{const m=obj as T.Mesh;if(m.userData.sharedSpecimen){(m as T.InstancedMesh).dispose();return;}if(m.geometry)gs.add(m.geometry);if(m.material)for(const mat of Array.isArray(m.material)?m.material:[m.material])ms.add(mat);if(m instanceof T.InstancedMesh)m.dispose();});
    for(const set of this.sets){gs.add(set.near);gs.add(set.mid);}gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());this.photo?.dispose();this.sun.shadow.dispose();
  }
}
