import {libraryGLSL} from "./graphics";
import * as T from "three";
import type {RegionalScene} from "./regional";

type Rock="sediment"|"continental"|"basalt"|"mantle"|"warm"|"wedge"|"fault";
const palette:Record<Rock,[number,string,string]>={
  sediment:[0xbd9e76,"Sedimente","Körner lagern sich ab. Unter Druck können daraus Gesteinsschichten werden."],
  continental:[0x967968,"Kontinentale Kruste","Dieses Gestein gehört zur Kruste eines Kontinents."],
  basalt:[0x445d65,"Ozeanische Kruste","Am Rücken kühlt Schmelze ab. So entsteht neue ozeanische Kruste."],
  mantle:[0x526353,"Lithosphärischer Mantel","Der kalte oberste Mantel gehört zur starren Platte."],
  warm:[0xa07050,"Verformbarer Mantel","Heißes Mantelgestein ist überwiegend fest. Über lange Zeit kann es sich verformen."],
  wedge:[0x899265,"Mantelkeil","Hier liegt Mantelgestein über der absinkenden Platte."],
  fault:[0x876550,"Störungszone","Hier grenzt bewegtes Gestein an den benachbarten Gesteinskörper."]};
function material(kind:Rock,r:RegionalScene,accreted=false){
  const m=new T.MeshStandardMaterial({color:palette[kind][0],roughness:kind==="basalt"?.79:.94,side:T.DoubleSide});
  m.customProgramCacheKey=()=>"g6-"+kind+accreted+Boolean(r.lib);
  m.onBeforeCompile=shader=>{
    shader.uniforms.analysisColor=r.sectionColor;shader.uniforms.stressPhase=r.stressSignals.phase;shader.uniforms.showStress=r.stressSignals.show;shader.uniforms.ceiling={value:r.rockCeiling};
    shader.vertexShader="attribute float bedFraction;varying float bedContact;attribute vec2 coupling;attribute vec3 geologyCoord;varying vec2 lock;varying vec3 stone;varying float sectionZ;\n"+shader.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nbedContact=bedFraction;stone=geologyCoord;sectionZ=position.z;lock=coupling;");
    const noise="float hashRock(vec3 p){p=fract(p*.31831+vec3(.17,.43,.71));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));} float mineral(vec3 p){vec3 a=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hashRock(a),hashRock(a+vec3(1,0,0)),f.x),mix(hashRock(a+vec3(0,1,0)),hashRock(a+vec3(1,1,0)),f.x),f.y),mix(mix(hashRock(a+vec3(0,0,1)),hashRock(a+vec3(1,0,1)),f.x),mix(hashRock(a+vec3(0,1,1)),hashRock(a+vec3(1,1,1)),f.x),f.y),f.z);}";
    const structure=kind==="sediment"?"sin(stone.y*38.+a*3.)*.11":kind==="continental"?"smoothstep(.48,.88,b)*.22-smoothstep(.64,.85,a)*.19":kind==="basalt"?"smoothstep(.72,.83,b)*.19-a*.13":kind==="mantle"?"sin(stone.y*11.+a*4.)*.043+b*.10":kind==="wedge"?"mineral(stone*vec3(7.,2.,8.))*.22-a*.10":kind==="warm"?"sin(stone.y*4.+a*5.)*.08+b*.06":"a*.12-b*.09";
    shader.fragmentShader="varying float bedContact;uniform float analysisColor;uniform highp sampler2D ceiling;varying vec3 stone;varying float sectionZ;varying vec2 lock;uniform float showStress,stressPhase;"+noise+"\n"+shader.fragmentShader.replace("#include <color_fragment>","#include <color_fragment>\nvec2 cell=clamp((stone.xz+vec2(6.,4.5))*16.,vec2(0.),vec2(191.999,143.999));ivec2 at=ivec2(cell);vec2 u=fract(cell);float h=mix(mix(texelFetch(ceiling,at,0).r,texelFetch(ceiling,at+ivec2(1,0),0).r,u.x),mix(texelFetch(ceiling,at+ivec2(0,1),0).r,texelFetch(ceiling,at+ivec2(1,1),0).r,u.x),u.y);"+(accreted?"":"if(abs(sectionZ)>.002&&stone.y>h-.015)discard;")+"float a=mineral(stone*4.7),b=mineral(stone*29.+a*2.);diffuseColor.rgb*=.94+.12*(b-.5)+("+structure+");float band=mineral(stone*vec3(15.,32.,13.));diffuseColor.rgb*=.91+.14*band+.06*smoothstep(-4.,.2,stone.y);float strain=lock.x*smoothstep(0.,.36,stressPhase)*(1.-smoothstep(lock.y,lock.y+.07,stressPhase));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.70,.22,.068),.72*showStress*strain);");
    if(r.lib){
      const tile={sediment:5,continental:4,basalt:3,mantle:2,warm:1,wedge:7,fault:6}[kind];
      const scales={sediment:[.95,2.3],continental:[1.75,1.65],basalt:[2.4,2.6],mantle:[2.1,1.5],warm:[1.3,.9],wedge:[2.4,2.1],fault:[2.9,2.8]}[kind];
      Object.assign(shader.uniforms,{faciesColor:{value:r.lib.color},faciesRelief:{value:r.lib.relief},detailGrade:r.grade});
      shader.fragmentShader=libraryGLSL+shader.fragmentShader.replace("#include <roughnessmap_fragment>",`#include <roughnessmap_fragment>
        vec3 axis=abs(cross(dFdx(stone),dFdy(stone)))+vec3(.000001);axis=normalize(axis);axis=pow(axis,vec3(4.));axis/=axis.x+axis.y+axis.z;
        vec2 scale=vec2(${scales[0]},${scales[1]});
        vec2 section=stone.xy*scale+vec2(.13*stone.z,.21*sin(stone.x*1.4)+.18*a);
        vec3 photo=fieldSample(faciesColor,section,${tile}.).rgb;
        if(detailGrade>1.5&&axis.z<.97)photo=photo*axis.z+fieldSample(faciesColor,stone.yz*scale,${tile}.).rgb*axis.x+fieldSample(faciesColor,stone.xz*scale,${tile}.).rgb*axis.y;
        vec3 micro=detailGrade<.5?vec3(.5,.5,.87):fieldSample(faciesRelief,section,${tile}.).rgb;
        float coarse=detailGrade<.5?photo.g:fieldSample(faciesColor,section*.29+vec2(.24,.8),${tile}.).g;
        float exposure=clamp(.34+2.4*sqrt(luma6(photo)+.004),.46,1.86);
        diffuseColor.rgb*=mix(.78,1.13,smoothstep(.015,.45,coarse))*exposure;
        diffuseColor.rgb=mix(diffuseColor.rgb,photo*vec3(1.12,1.01,.92),.14);
        float broken=smoothstep(.63,.99,lock.x)*smoothstep(.58,.85,mineral(stone*vec3(9.,4.,11.)));
        diffuseColor.rgb*=1.-.25*broken;
        float seam=min(bedContact,1.-bedContact);
        float contact=mix(.65,1.04,smoothstep(.0,.083,seam+.012*(coarse-.35)));
        float joint=${kind==="basalt"||kind==="fault"?"1.-smoothstep(.025,.115,abs(sin(stone.x*21.+2.4*a+stone.y*.71)))":kind==="sediment"?"1.-smoothstep(.035,.17,abs(sin(stone.y*31.+a*2.1)))":"smoothstep(.63,.90,b)*.6"};
        diffuseColor.rgb*=contact*(1.-joint*.18);
        vec3 keyColor=vec3(${{sediment:".68,.53,.28",continental:".59,.29,.26",basalt:".16,.42,.58",mantle:".26,.46,.30",warm:".72,.34,.13",wedge:".52,.56,.22",fault:".49,.30,.52"}[kind]});
        diffuseColor.rgb=mix(diffuseColor.rgb,keyColor*(.50+.47*exposure)*contact,analysisColor*.72);
        roughnessFactor=clamp(mix(roughnessFactor,micro.b,.65)+joint*.08,.48,1.);
      `).replace("#include <normal_fragment_maps>","#include <normal_fragment_maps>\n normal=normalize(normal+mat3(viewMatrix)*vec3(micro.r-.5,micro.g-.5,0.)*.81);");
    }
  };return m;
}
// A closed solid, with separately shaded cap, base, exposed cross-section and side faces.
function solid(r:RegionalScene,kind:Rock,side:number,point:(u:number,v:number,z:number)=>[number,number],label?:string,columns=64){
  const pos:number[]=[],indices:number[]=[],parameters:number[]=[];
  function face(nx:number,ny:number,coord:(u:number,v:number)=>[number,number,number],reverse=false){
    const start=pos.length/3;
    for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
      const [u,v,z]=coord(i/nx,j/ny),[x,y]=point(u,v,z);pos.push(x,y,z);parameters.push(u,v);
      if(i<nx&&j<ny){const k=start+j*(nx+1)+i,l=k+nx+1;indices.push(...(reverse?[k,l,k+1,l,l+1,k+1]:[k,k+1,l,k+1,l+1,l]));}
    }
  }
  face(columns,8,(u,v)=>[u,v,0],true);face(columns,8,(u,v)=>[u,v,-4.5]);
  face(columns,12,(u,w)=>[u,0,-4.5*w]);face(columns,12,(u,w)=>[u,1,-4.5*w],true);
  face(8,12,(v,w)=>[0,v,-4.5*w]);face(8,12,(v,w)=>[1,v,-4.5*w],true);
  const g=new T.BufferGeometry();g.setIndex(indices);g.setAttribute("position",new T.Float32BufferAttribute(pos,3));g.computeVertexNormals();
  g.setAttribute("bedFraction",new T.Float32BufferAttribute(parameters.filter((_,i)=>i%2===1),1));
  g.setAttribute("geologyCoord",g.attributes.position.clone());
  const m=new T.Mesh(g,material(kind,r,Boolean(label)));m.name=label??(kind==="basalt"&&r.faultModel.kind==="interface"&&side===-r.faultModel.dipSign?"Abtauchende ozeanische Kruste":r.faultModel.kind==="interface"&&side===r.faultModel.dipSign&&["basalt","continental"].includes(kind)?"Kruste der Oberplatte":palette[kind][1]);m.userData.explanation={name:m.name,answer:palette[kind][2]};r.section.add(m);
  if(label&&r.spec.process==="ridge"){g.setAttribute("sectionU",new T.Float32BufferAttribute(parameters.filter((_,i)=>i%2===0),1));g.setAttribute("coupling",new T.Float32BufferAttribute(new Float32Array(pos.length/3*2),2));m.frustumCulled=false;}
  else r.bindRock(g,side,(i,z)=>point(parameters[i*2],parameters[i*2+1],z)[1]);
  return m;
}
export function geologySolids(r:RegionalScene){
  const f=r.faultModel,p=r.spec.process;const floor=-5.8;
  if(f.distributedSlip){
    const thrust=f.kind==="thrust";
    const contact=(x:number,z:number)=>Math.min(r.height(x,z),f.interfaceY(x));
    const lower: [Rock,number,number][]=thrust?[["continental",0,1.25],["mantle",1.25,2.8],["warm",2.8,7]]:[["basalt",0,.24],["mantle",.24,.85],["warm",.85,7]];
    for(const end of [-6,6]){
      // Match every solver column, including the extra node at the exact trench.
      const grid=r.water?[f.trace,...Array.from({length:r.water.cells},(_,i)=>-6+i*r.water!.dx)
        .filter(x=>(x-f.trace)*Math.sign(end-f.trace)>1e-7).sort((a,b)=>(a-b)*Math.sign(end-f.trace))]:undefined;
      const columns=grid?grid.length-1:64;
      if(columns<1)continue;
      const at=(u:number)=>grid?grid[Math.round(u*columns)]:T.MathUtils.lerp(f.trace,end,u);
      const exposed=Array.from({length:columns+1},(_,i)=>at(i/columns)).some(x=>
        Array.from({length:13},(_,j)=>-4.5*j/12).some(z=>r.height(x,z)>f.interfaceY(x)+1e-7));
      for(const [kind,a,b] of lower)solid(r,kind,-f.dipSign,(u,v,z)=>{
        const x=at(u);return [x,contact(x,z)-T.MathUtils.lerp(a,b,v)];},undefined,columns);
      if(!exposed)continue;
      for(const [kind,a,b] of [["sediment",0,.10],[p==="arc"||p==="ridge"?"basalt":"continental",.10,.65],[thrust?"mantle":"wedge",.65,1]] as const)
        solid(r,kind,f.dipSign,(u,v,z)=>{
          const x=at(u),surface=r.height(x,z),bottom=contact(x,z),thickness=surface-bottom;
          const edge=(k:number)=>k===1?bottom:surface-Math.min(k,thickness*k/.65);
          return [x,T.MathUtils.lerp(edge(a),edge(b),v)];},undefined,columns);
    }
    return;
  }
  const ocean=(["ridge","oceanTransform"].includes(p)||p==="hotspot"&&r.spec.site==="hawaii"),root=T.MathUtils.clamp((f.top-f.riftRoot)/(f.top-floor),.05,.95);
  const horizon=(x:number,z:number,d:number)=>{
    const h=r.height(x,z);
    if(p==="rift")return d<=root?T.MathUtils.lerp(h,f.riftRoot,d/root):T.MathUtils.lerp(f.riftRoot,floor,(d-root)/(1-root));
    return T.MathUtils.lerp(h,floor,d)-(p==="collision"?1.18*Math.exp(-x*x*.23)*Math.sin(d*Math.PI):0);
  };
  const layers:[Rock,number,number][]=[["sediment",0,.045],[ocean?"basalt":"continental",.045,ocean?.14:.33],["mantle",ocean?.14:.33,.60],["warm",.60,1]];
  for(const [kind,a,b] of layers){
    const breaks=p==="rift"&&a<root&&root<b?[a,root,b]:[a,b];
    for(let j=1;j<breaks.length;j++){
      const low=breaks[j-1],high=breaks[j],deep=p==="rift"&&low>=root;
      for(const side of (deep?[0]:p==="rift"?[-1,0,1]:[-1,1])){
        const cache=new Map<string,[number,number]>();
        solid(r,kind,side,(u,v,z)=>{
          const d=T.MathUtils.lerp(low,high,v),key=d+"/"+z;
          if(f.kind==="strike"){const x=side<0?-6+u*(6+f.trace):f.trace+u*(6-f.trace);return [x,horizon(x,z,d)];}
          let bounds=cache.get(key);
          if(!bounds){bounds=deep?[-6,6]:f.horizonRange(side,x=>horizon(x,z,d));cache.set(key,bounds);}
          const x=T.MathUtils.lerp(bounds[0],bounds[1],u);return [x,horizon(x,z,d)];
        });
      }
    }
  }
  if(p==="ridge"&&["process","magnet"].includes(r.spec.theme)){
    // This material is born at the axis. Its two outer faces follow the old plates.
    for(const [kind,a,b] of layers){
      const m=solid(r,kind==="sediment"?"basalt":kind,0,(_u,v,z)=>[0,horizon(0,z,T.MathUtils.lerp(a,b,v))],a<.14?"Neu gebildete ozeanische Kruste":"Aufsteigender Mantel");
      const g=m.geometry,pos=g.attributes.position,uv=g.getAttribute("sectionU");
      r.onAnimate(t=>{if(m.userData.phase===t)return;m.userData.phase=t;m.visible=t>0;
        for(let i=0;i<pos.count;i++)pos.setX(i,(2*uv.getX(i)-1)*f.ridgeWidth(pos.getY(i),t));
        pos.needsUpdate=true;g.computeVertexNormals();});
    }
  }
}
