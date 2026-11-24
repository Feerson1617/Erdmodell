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
function material(kind:Rock,r:RegionalScene){
  const m=new T.MeshStandardMaterial({color:palette[kind][0],roughness:kind==="basalt"?.79:.94,side:T.DoubleSide});
  m.customProgramCacheKey=()=>"g52-"+kind;
  m.onBeforeCompile=shader=>{
    shader.uniforms.stressPhase=r.stressSignals.phase;shader.uniforms.showStress=r.stressSignals.show;shader.uniforms.ceiling={value:r.rockCeiling};
    shader.vertexShader="attribute vec2 coupling;attribute vec3 geologyCoord;varying vec2 lock;varying vec3 stone;varying float sectionZ;\n"+shader.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nstone=geologyCoord;sectionZ=position.z;lock=coupling;");
    const noise="float hashRock(vec3 p){p=fract(p*.31831+vec3(.17,.43,.71));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));} float mineral(vec3 p){vec3 a=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hashRock(a),hashRock(a+vec3(1,0,0)),f.x),mix(hashRock(a+vec3(0,1,0)),hashRock(a+vec3(1,1,0)),f.x),f.y),mix(mix(hashRock(a+vec3(0,0,1)),hashRock(a+vec3(1,0,1)),f.x),mix(hashRock(a+vec3(0,1,1)),hashRock(a+vec3(1,1,1)),f.x),f.y),f.z);}";
    const structure=kind==="sediment"?"sin(stone.y*38.+a*3.)*.11":kind==="continental"?"smoothstep(.48,.88,b)*.22-smoothstep(.64,.85,a)*.19":kind==="basalt"?"smoothstep(.72,.83,b)*.19-a*.13":kind==="mantle"?"sin(stone.y*11.+a*4.)*.043+b*.10":kind==="wedge"?"mineral(stone*vec3(7.,2.,8.))*.22-a*.10":kind==="warm"?"sin(stone.y*4.+a*5.)*.08+b*.06":"a*.12-b*.09";
    shader.fragmentShader="uniform highp sampler2D ceiling;varying vec3 stone;varying float sectionZ;varying vec2 lock;uniform float showStress,stressPhase;"+noise+"\n"+shader.fragmentShader.replace("#include <color_fragment>","#include <color_fragment>\nvec2 cell=clamp((stone.xz+vec2(6.,4.5))*16.,vec2(0.),vec2(191.999,143.999));ivec2 at=ivec2(cell);vec2 u=fract(cell);float h=mix(mix(texelFetch(ceiling,at,0).r,texelFetch(ceiling,at+ivec2(1,0),0).r,u.x),mix(texelFetch(ceiling,at+ivec2(0,1),0).r,texelFetch(ceiling,at+ivec2(1,1),0).r,u.x),u.y);if(abs(sectionZ)>.002&&stone.y>h-.015)discard;float a=mineral(stone*4.7),b=mineral(stone*29.+a*2.);diffuseColor.rgb*=.94+.12*(b-.5)+("+structure+");float band=mineral(stone*vec3(15.,32.,13.));diffuseColor.rgb*=.91+.14*band+.06*smoothstep(-4.,.2,stone.y);float strain=lock.x*smoothstep(0.,.36,stressPhase)*(1.-smoothstep(lock.y,lock.y+.07,stressPhase));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.70,.22,.068),.72*showStress*strain);");
  };return m;
}
// A closed solid, with separately shaded cap, base, exposed cross-section and side faces.
function solid(r:RegionalScene,kind:Rock,side:number,point:(u:number,v:number,z:number)=>[number,number],label?:string){
  const pos:number[]=[],indices:number[]=[],parameters:number[]=[];
  function face(nx:number,ny:number,coord:(u:number,v:number)=>[number,number,number],reverse=false){
    const start=pos.length/3;
    for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
      const [u,v,z]=coord(i/nx,j/ny),[x,y]=point(u,v,z);pos.push(x,y,z);parameters.push(u,v);
      if(i<nx&&j<ny){const k=start+j*(nx+1)+i,l=k+nx+1;indices.push(...(reverse?[k,l,k+1,l,l+1,k+1]:[k,k+1,l,k+1,l+1,l]));}
    }
  }
  face(54,4,(u,v)=>[u,v,0],true);face(54,2,(u,v)=>[u,v,-4.5]);
  face(54,10,(u,w)=>[u,0,-4.5*w]);face(54,3,(u,w)=>[u,1,-4.5*w],true);
  face(4,6,(v,w)=>[0,v,-4.5*w]);face(4,6,(v,w)=>[1,v,-4.5*w],true);
  const g=new T.BufferGeometry();g.setIndex(indices);g.setAttribute("position",new T.Float32BufferAttribute(pos,3));g.computeVertexNormals();
  g.setAttribute("geologyCoord",g.attributes.position.clone());
  const m=new T.Mesh(g,material(kind,r));m.name=label??palette[kind][1];m.userData.explanation={name:m.name,answer:palette[kind][2]};r.section.add(m);
  r.bindRock(g,side,(i,z)=>point(parameters[i*2],parameters[i*2+1],z)[1]);return m;
}
export function geologySolids(r:RegionalScene){
  const f=r.faultModel,p=r.spec.process;const floor=-5.8;
  if(f.kind==="interface"){
    const slabTop=(x:number,z:number)=>((x-f.trace)*f.dipSign>0?Math.min(r.height(x,z)-.012,f.interfaceY(x)):r.height(x,z)-.012);
    const across=(u:number)=>-6+12*u;
    for(const [kind,a,b] of [["basalt",0,.24],["mantle",.24,.85],["warm",.85,7]] as const)
      solid(r,kind,-f.dipSign,(u,v,z)=>{const x=across(u);return [x,slabTop(x,z)-T.MathUtils.lerp(a,b,v)];});
    const end=6*f.dipSign;
    for(const [kind,a,b] of [["sediment",0,.10],[p==="arc"?"basalt":"continental",.10,.65],["wedge",.65,1]] as const)
      solid(r,kind,f.dipSign,(u,v,z)=>{const x=T.MathUtils.lerp(f.trace,end,u),surface=r.height(x,z),bottom=Math.min(surface,slabTop(x,z)),thickness=surface-bottom;
        const edge=(k:number)=>k===1?bottom:surface-Math.min(k,thickness*k/.65);
        return [x,T.MathUtils.lerp(edge(a),edge(b),v)];});
    return;
  }
  const ocean=["ridge","oceanTransform"].includes(p);
  for(const side of (p==="rift"?[-1,0,1]:[-1,1])){
    const layers:[Rock,number,number][]=[["sediment",0,.045],[ocean?"basalt":"continental",.045,ocean?.14:.33],["mantle",ocean?.14:.33,.60],["warm",.60,1]];
    for(const [kind,a,b] of layers)solid(r,kind,side,(u,v,z)=>{
      const depth=T.MathUtils.lerp(a,b,v),yAtTrace=T.MathUtils.lerp(f.top,floor,depth);
      const [seam,outer]=f.blockRange(side,yAtTrace);
      const x=T.MathUtils.lerp(seam,outer,u),h=r.height(x,z);
      const root=p==="collision"?1.18*Math.exp(-x*x*.23)*Math.sin(depth*Math.PI):0;
      const thinning=p==="rift"?.52*Math.exp(-x*x*.28)*Math.sin(depth*Math.PI):0;
      const blend=side===0?Math.sin(u*Math.PI):Math.min(1,u*7);
      const y=T.MathUtils.lerp(yAtTrace,T.MathUtils.lerp(h,floor,depth),blend);
      return [x,y-.008-root*blend+thinning*blend];
    });
  }
}

