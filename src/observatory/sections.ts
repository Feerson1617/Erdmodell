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
function material(kind:Rock){
  const m=new T.MeshStandardMaterial({color:palette[kind][0],roughness:kind==="basalt"?.79:.94,side:T.DoubleSide});
  m.customProgramCacheKey=()=>"g51-"+kind;
  m.onBeforeCompile=shader=>{
    shader.vertexShader="varying vec3 stone;\n"+shader.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nstone=position;");
    const structure=kind==="sediment"?"sin(rock.y*48.+2.*a+.65*sin(rock.x*2.))":kind==="continental"?"cos(rock.x*5.+rock.y*8.+3.*a)*b":kind==="basalt"?"sin(rock.x*21.+a*3.)*sin(rock.y*17.+b)":"sin(rock.x*5.-rock.y*6.+a)*.42";
    shader.fragmentShader="varying vec3 stone;\n"+shader.fragmentShader.replace("#include <color_fragment>","#include <color_fragment>\nvec3 rock=stone;float a=sin(rock.x*4.9+rock.y*3.2)*cos(rock.z*3.8+rock.y*7.6);float b=sin(dot(rock,vec3(31.,45.,13.))+a*5.);diffuseColor.rgb*=.95+.09*b+.14*("+structure+");");
  };return m;
}
// A closed solid, with separately shaded cap, base, exposed cross-section and side faces.
function solid(r:RegionalScene,kind:Rock,side:number,point:(u:number,v:number,z:number)=>[number,number],label?:string){
  const pos:number[]=[],indices:number[]=[];
  function face(nx:number,ny:number,coord:(u:number,v:number)=>[number,number,number],reverse=false){
    const start=pos.length/3;
    for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
      const [u,v,z]=coord(i/nx,j/ny),[x,y]=point(u,v,z);pos.push(x,y,z);
      if(i<nx&&j<ny){const k=start+j*(nx+1)+i,l=k+nx+1;indices.push(...(reverse?[k,l,k+1,l,l+1,k+1]:[k,k+1,l,k+1,l+1,l]));}
    }
  }
  face(54,4,(u,v)=>[u,v,0],true);face(54,2,(u,v)=>[u,v,-4.5]);
  face(54,10,(u,w)=>[u,0,-4.5*w]);face(54,3,(u,w)=>[u,1,-4.5*w],true);
  face(4,6,(v,w)=>[0,v,-4.5*w]);face(4,6,(v,w)=>[1,v,-4.5*w],true);
  const g=new T.BufferGeometry();g.setIndex(indices);g.setAttribute("position",new T.Float32BufferAttribute(pos,3));g.computeVertexNormals();
  const m=new T.Mesh(g,material(kind));m.name=label??palette[kind][1];m.userData.explanation={name:m.name,answer:palette[kind][2]};r.section.add(m);
  r.bindRock(g,side);return m;
}
export function geologySolids(r:RegionalScene){
  const f=r.faultModel,p=r.spec.process;const floor=-5.8;
  if(f.kind==="interface"){
    const slabTop=(x:number,z:number)=>((x-f.trace)*f.dipSign>0?Math.min(r.height(x,z)-.012,f.interfaceY(x)):r.height(x,z)-.012);
    const across=(u:number)=>-6+12*u;
    for(const [kind,a,b] of [["basalt",0,.24],["mantle",.24,.85],["warm",.85,7]] as const)
      solid(r,kind,-f.dipSign,(u,v,z)=>{const x=across(u);return [x,slabTop(x,z)-T.MathUtils.lerp(a,b,v)];});
    const end=6*f.dipSign;
    for(const [kind,a,b] of [["sediment",0,.10],["continental",.10,.65],["wedge",.65,1]] as const)
      solid(r,kind,f.dipSign,(u,v,z)=>{const x=T.MathUtils.lerp(f.trace,end,u),surface=r.height(x,z),bottom=Math.min(surface,slabTop(x,z)),thickness=surface-bottom;
        const edge=(k:number)=>k===1?bottom:surface-Math.min(k,thickness*k/.65);
        return [x,T.MathUtils.lerp(edge(a),edge(b),v)];});
    return;
  }
  const ocean=["ridge","oceanTransform"].includes(p);
  for(const side of [-1,1]){
    const outer=side*6;
    const layers:[Rock,number,number][]=[["sediment",0,.045],[ocean?"basalt":"continental",.045,ocean?.14:.33],["mantle",ocean?.14:.33,.60],["warm",.60,1]];
    for(const [kind,a,b] of layers)solid(r,kind,side,(u,v,z)=>{
      const depth=T.MathUtils.lerp(a,b,v),yAtTrace=T.MathUtils.lerp(f.top,floor,depth),seam=T.MathUtils.clamp(f.xAt(yAtTrace),-5.98,5.98);
      const x=T.MathUtils.lerp(seam,outer,u),h=r.height(x,z);
      const root=p==="collision"?1.18*Math.exp(-x*x*.23)*Math.sin(depth*Math.PI):0;
      const thinning=p==="rift"?.52*Math.exp(-x*x*.28)*Math.sin(depth*Math.PI):0;
      const y=T.MathUtils.lerp(yAtTrace,T.MathUtils.lerp(h,floor,depth),Math.min(1,u*7));
      return [x,y-.008-root*u+thinning*u];
    });
  }
}

