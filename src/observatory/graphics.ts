import {RenderCadence,type Activity} from "./render-cadence";
import * as T from "three";
import {localAsset} from "../assets";

export type Profile="auto"|"classroom"|"maximum";
const key="georisiko.graphics.g6";
export const cadence=new RenderCadence();
export const graphics={profile:"auto" as Profile,adaptive:1,revision:0,idle:false,activity:"world" as Activity,scope:"world"};
try{const saved=localStorage.getItem(key);if(saved==="maximum"||saved==="classroom")graphics.profile=saved;}catch{/* private file session */}
export function quality(){return graphics.profile==="maximum"?2:graphics.profile==="classroom"?1:graphics.adaptive;}
export function observeFrame(now:number){
  const sample=cadence.frame(now,graphics.activity,graphics.scope,graphics.profile==="auto");
  if(graphics.adaptive!==cadence.grade){graphics.adaptive=cadence.grade;if(graphics.profile==="auto")graphics.revision++;}
  return sample;
}
export function installProfiles(parent:HTMLElement){
  const details=document.createElement("details");details.id="g6-quality-menu";
  details.innerHTML='<summary aria-label="Grafikqualität" title="Grafikqualität"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 7h8m4 0h6M3 17h3m4 0h11"/><circle cx="13" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg></summary><label>Grafikqualität<select id="graphics-profile"><option value="auto">Automatisch</option><option value="classroom">Unterricht</option><option value="maximum">Maximal</option></select></label>';
  parent.prepend(details);const select=details.querySelector("select")!;select.value=graphics.profile;
  select.onchange=()=>{graphics.profile=select.value as Profile;graphics.revision++;cadence.restart();try{localStorage.setItem(key,select.value);}catch{}details.open=false;};
  document.addEventListener("pointerdown",e=>{if(!details.contains(e.target as Node))details.open=false;});
}
export async function loadTexture(file:string,srgb=false){
  const texture=await new T.TextureLoader().loadAsync(localAsset("data/g6/"+file));texture.colorSpace=srgb?T.SRGBColorSpace:T.NoColorSpace;
  texture.anisotropy=1;return texture;
}
let library:Promise<{color:T.Texture;relief:T.Texture}>|undefined;
export function materials(){
  // The fixed library is shared by the active region and the single warm comparison scene.
  return library??=Promise.all([loadTexture("facies.webp",true),loadTexture("facies-relief.webp")])
    .then(([color,relief])=>({color,relief})).catch(error=>{library=undefined;throw error;});
}
export type Library=Awaited<ReturnType<typeof materials>>;
export const libraryGLSL=`
uniform sampler2D faciesColor,faciesRelief;
uniform float detailGrade;
vec4 fieldSample(sampler2D atlas,vec2 p,float id){
 vec2 grid=vec2(4.,2.),tile=vec2(mod(id,4.),1.-floor(id/4.));
 vec2 uv=(tile+(fract(p)*.9921875+.00390625))/grid;
 float bias=exp2(.6*(1.-detailGrade));
 return textureGrad(atlas,uv,dFdx(p)*bias/grid,dFdy(p)*bias/grid);
}
float luma6(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
`;
export function decorateTerrain(m:T.MeshStandardMaterial,lib:Library,relief:T.Texture|undefined,style:number,grade:{value:number},theme:string,reliefOnly:{value:number}){
  const previous=m.onBeforeCompile.bind(m);m.customProgramCacheKey=()=>"g6-terrain-"+style+"-"+theme+"-"+Boolean(relief);
  m.onBeforeCompile=(s,gl)=>{previous(s,gl);
    Object.assign(s.uniforms,{faciesColor:{value:lib.color},faciesRelief:{value:lib.relief},detailGrade:grade,landRelief:{value:relief??lib.relief},reliefOnly});
    s.vertexShader="varying vec3 ground6;\n"+s.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nground6=position;");
    const profile=style===2?[3,2]:style===1?[7,4]:style===3?[4,1]:style===4?[6,1]:[0,1];
    s.fragmentShader="varying vec3 ground6;uniform sampler2D landRelief;uniform float reliefOnly;\n"+libraryGLSL+s.fragmentShader;
    s.fragmentShader=s.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
      vec2 landUV=vec2(.5+ground6.x/12.,.5-ground6.z/9.);
      vec3 dem=${relief?"texture2D(landRelief,landUV).rgb":"vec3(.5,.5,.94)"};
      vec2 sl=dem.rg*2.-1.;float slope=length(sl);
      float rock=smoothstep(.14,.64,slope+.10*sin(ground6.x*2.7+.8*ground6.z));
      vec2 face=ground6.xz+vec2(.31*ground6.y,-.57*ground6.y);
      vec2 cliff=abs(sl.x)>abs(sl.y)?ground6.zy:ground6.xy;
      vec3 soil=fieldSample(faciesColor,face*1.8,${profile[0]}.).rgb;
      vec3 gravel=detailGrade<.5?soil:fieldSample(faciesColor,face*2.9+.31,${profile[1]}.).rgb;
      vec3 roughTex=detailGrade<.5?vec3(.5,.5,.89):fieldSample(faciesRelief,face*1.8,${profile[0]}.).rgb;
      if(detailGrade>1.5)gravel=mix(gravel,fieldSample(faciesColor,cliff*2.6,${profile[1]}.).rgb,smoothstep(.34,.77,slope));
      vec3 nearColor=mix(soil,gravel,rock);
      float contrast=clamp(pow(luma6(nearColor)+.03,.6)*2.50,.50,1.54);
      float local=1.-smoothstep(.72,1.,max(abs(ground6.x)/6.,abs(ground6.z)/4.5));
      float light=clamp(.97+.42*dot(sl,vec2(-.82,.43)),.64,1.30)*mix(.72,1.,dem.b);
      diffuseColor.rgb*=mix(1.,light*mix(1.,contrast,.50),local);
      diffuseColor.rgb=mix(diffuseColor.rgb,nearColor*(.15+luma6(diffuseColor.rgb))/.42,.10*local);
      float illumination=clamp(.82+.64*dot(sl,vec2(-.83,.56)),.31,1.28);
      vec3 shaded=mix(vec3(.18,.29,.29),vec3(.58,.56,.47),clamp(dem.b,0.,1.))*illumination;
      diffuseColor.rgb=mix(diffuseColor.rgb,shaded,reliefOnly);
      `);
    s.fragmentShader=s.fragmentShader.replace("#include <normal_fragment_maps>","#include <normal_fragment_maps>\n normal=normalize(normal+mat3(viewMatrix)*vec3(sl.x+.29*(roughTex.r-.5),0.,-sl.y+.29*(roughTex.g-.5))*local*.48);");
    s.fragmentShader=s.fragmentShader.replace("#include <roughnessmap_fragment>","#include <roughnessmap_fragment>\n roughnessFactor=clamp(mix(roughnessFactor,roughTex.b,.38),.46,.99);");
  };
}
