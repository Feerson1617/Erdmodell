import * as T from "three";

// Model depth controls optical thickness. The analytic ripples change the normal only.
export function seaMaterial(phase:{value:number},metresPerUnit:number,attenuationMetres=28){
  const m=new T.MeshStandardMaterial({color:0xffffff,roughness:.34,metalness:0,transparent:true,opacity:.92,depthWrite:false,side:T.DoubleSide});
  m.onBeforeCompile=shader=>{
    shader.uniforms.modelPhase=phase;shader.uniforms.opticalScale={value:metresPerUnit/attenuationMetres};
    shader.vertexShader="attribute float depthWet;varying float depthAt;varying vec3 seaPos;\n"+shader.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\ndepthAt=depthWet;seaPos=(modelMatrix*vec4(position,1.)).xyz;");
    shader.fragmentShader=`varying float depthAt;varying vec3 seaPos;uniform float modelPhase,opticalScale;
      float seaHash(vec2 i){vec3 p=fract(i.xyx*vec3(.1031,.1030,.0973));p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
      vec2 slopeNoise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f),du=6.*f*(1.-f);
        float a=seaHash(i),b=seaHash(i+vec2(1.,0.)),c=seaHash(i+vec2(0.,1.)),d=seaHash(i+1.);
        return du*vec2(mix(b-a,d-c,u.y),mix(c-a,d-b,u.x));}
      
`+shader.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
      if(depthAt<=.001)discard;
      vec2 g=seaPos.xz;float t=modelPhase*11.;
      mat2 wind=mat2(.84,.54,-.54,.84);vec2 drift=vec2(.061,-.034)*t;
      vec2 coast=slopeNoise(g*.61);vec2 p=wind*g+coast*.27;
      vec2 broad=slopeNoise(p*vec2(3.2,5.3)+drift);
      vec2 grains=wind*slopeNoise(wind*p*vec2(9.6,17.)-drift*1.7+3.8);
      float footprint=max(length(dFdx(g)),length(dFdy(g)));
      vec2 caps=slopeNoise(p*vec2(25.,38.)+broad*.38+drift*2.2)*(1.-smoothstep(.009,.05,footprint));
      vec2 tilt=.056*broad+.033*grains+.021*caps;
      vec3 waveN=normalize(vec3(tilt.x,1.,tilt.y));
      vec3 eye=normalize(cameraPosition-seaPos);float fres=.027+.61*pow(1.-max(0.,dot(eye,waveN)),4.);
      float thickness=max(0.,depthAt)*opticalScale;vec3 absorption=exp(-vec3(3.2,1.6,1.1)*thickness);
      vec3 water=mix(vec3(.013,.081,.124),vec3(.12,.42,.365),absorption);
      vec3 reflected=reflect(-eye,waveN),sky=mix(vec3(.59,.69,.66),vec3(.17,.37,.49),smoothstep(0.,.8,reflected.y));
      float glint=pow(max(0.,dot(reflected,normalize(vec3(-7.,6.,3.)))),92.);
      diffuseColor.rgb=mix(water,sky,fres)+vec3(.83,.67,.44)*glint*.21;
      diffuseColor.a=clamp(.18+.77*(1.-exp(-thickness*3.))+.13*fres,.18,.97);
    `).replace("#include <normal_fragment_maps>","#include <normal_fragment_maps>\n normal=normalize(normal+mat3(viewMatrix)*vec3(waveN.x,0.,waveN.z));");
  };return m;
}
export function waterSection(){
  const m=new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.57,depthWrite:false,side:T.DoubleSide});
  m.onBeforeCompile=s=>{s.vertexShader="varying vec2 sectionDepth;\n"+s.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nsectionDepth=vec2(position.y,uv.y);");
    s.fragmentShader="varying vec2 sectionDepth;\n"+s.fragmentShader.replace("#include <color_fragment>","#include <color_fragment>\nfloat light=exp(-1.8*max(0.,-sectionDepth.x));diffuseColor.rgb=mix(vec3(.025,.15,.20),vec3(.18,.54,.51),light);diffuseColor.a=.26+.21*(1.-light)+.23*smoothstep(.97,1.,sectionDepth.y);");};return m;
}

// Satellite sea colour includes reflected sky. Under a rendered water column,
// use one depth-dependent substrate across both geographic texture windows.
export function seabed(material:T.MeshStandardMaterial,metresPerUnit:number){
  const previous=material.onBeforeCompile.bind(material);
  const id=material.customProgramCacheKey();material.customProgramCacheKey=()=>id+"-seabed";
  material.onBeforeCompile=(s,gl)=>{previous(s,gl);s.uniforms.bedScale={value:metresPerUnit};
    s.vertexShader="varying vec3 bedPosition;\n"+s.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nbedPosition=position;");
    s.fragmentShader="varying vec3 bedPosition;uniform float bedScale;\n"+s.fragmentShader.replace("#include <roughnessmap_fragment>",`#include <roughnessmap_fragment>
      float below=max(0.,-bedPosition.y*bedScale);
      vec3 substrate=mix(vec3(.22,.245,.19),vec3(.065,.112,.125),smoothstep(4.,85.,below));
      diffuseColor.rgb=mix(diffuseColor.rgb,substrate,smoothstep(.35,8.,below));
    `);
  };
}
