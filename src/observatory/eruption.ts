import {libraryGLSL} from "./graphics";
import {lavaTongue} from "./lava-flow";
import * as T from "three";
import type {RegionalScene} from "./regional";
const material=(color:number)=>new T.MeshStandardMaterial({color,roughness:.9});

function ashMaterial(){
  const canvas=document.createElement("canvas");canvas.width=canvas.height=96;
  const ctx=canvas.getContext("2d")!,img=ctx.createImageData(96,96);
  const hash=(x:number,y:number)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
  const noise=(x:number,y:number)=>{const ix=Math.floor(x),iy=Math.floor(y),a=T.MathUtils.smoothstep(x-ix,0,1),b=T.MathUtils.smoothstep(y-iy,0,1);
    return T.MathUtils.lerp(T.MathUtils.lerp(hash(ix,iy),hash(ix+1,iy),a),T.MathUtils.lerp(hash(ix,iy+1),hash(ix+1,iy+1),a),b);};
  for(let j=0;j<96;j++)for(let i=0;i<96;i++){const x=i/47.5-1,y=j/47.5-1;
    const n=.58*noise(x*3.4+4,y*3.4+5)+.29*noise(x*8+11,y*8)+.13*noise(x*19,y*19);
    const density=T.MathUtils.smoothstep(1-Math.hypot(x,y)*1.2+(n-.55)*.82,0,.75);
    const edgeLight=Math.pow(1-density,1.4)*53;const value=47+85*n+20*(1-y)+15*(1-x)+edgeLight,k=4*(j*96+i);
    img.data.set([value+5,value+2,value,222*density],k);
  }
  ctx.putImageData(img,0,0);const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;
  return new T.MeshBasicMaterial({map,transparent:true,depthWrite:false,side:T.DoubleSide});
}

function outline(a:number){return 1+.112*Math.sin(a*3+.8)+.073*Math.cos(a*5-.7)+.035*Math.sin(a*11);}
function mountain(shield:boolean,dx:number,dz:number){
  const sx=shield?1.75:1.40,sz=shield?1.27:.50,a=Math.atan2(dz/sz,dx/sx),u=Math.hypot(dx/sx,dz/sz)/outline(a);
  if(u>=1)return 0;
  if(!shield){
    const strike=dx+.16*Math.sin(dz*3.),across=dz-.05*Math.sin(dx*4.);
    const ridge=Math.exp(-across*across*28)*Math.exp(-strike*strike*.9);
    const seam=Math.exp(-across*across*950)*Math.exp(-strike*strike*1.8);
    return (.21*ridge-.07*seam)*T.MathUtils.smoothstep(1-u,0,.29)*(.86+.14*Math.cos(dx*11.+dz*6.));
  }
  const rim=.18+.036*Math.sin(3*a),flank=u<rim?.41+.59*T.MathUtils.smoothstep(u,.012,rim):Math.pow((1-u)/(1-rim),shield?1.68:1.35);
  const gully=1+.13*Math.sin(8*a+u*4)+.042*Math.sin(19*a-u*6);
  return (shield?.32:.24)*flank*gully;
}
function edifice(shield:boolean){
  const p:number[]=[],colors:number[]=[],apron:number[]=[],indices:number[]=[],rings=36,sectors=84;
  for(let j=0;j<=rings;j++)for(let i=0;i<=sectors;i++){
    const a=2*Math.PI*i/sectors,u=j/rings,r=u*outline(a),x=r*(shield?1.75:1.40)*Math.cos(a),z=r*(shield?1.27:.50)*Math.sin(a);
    p.push(x,mountain(shield,x,z),z);apron.push(u);
    const scoria=.48+.21*Math.cos(a*13+u*9)*Math.sin(a*9-u*21)+.075*Math.sin(23*u+2.8*Math.cos(a*3))+ .058*Math.sin(71*x+24*z)*Math.cos(37*z),edge=T.MathUtils.smoothstep(u,.08,.23);
    colors.push(scoria*(.75+.35*edge),scoria*(.59+.45*edge),scoria*(.54+.46*edge));
    if(j<rings&&i<sectors){const k=j*(sectors+1)+i,l=k+sectors+1;indices.push(k,k+1,l,k+1,l+1,l);}
  }
  const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(p,3));g.setAttribute("color",new T.Float32BufferAttribute(colors,3));g.setAttribute("apron",new T.Float32BufferAttribute(apron,1));g.setIndex(indices);g.computeVertexNormals();return g;
}
function conformFlanks(mat:T.Material,r:RegionalScene){
  const previous=mat.onBeforeCompile.bind(mat);mat.onBeforeCompile=(shader,gl)=>{
    previous(shader,gl);shader.uniforms.rockTop={value:r.rockCeiling};
    shader.fragmentShader="varying float originalBed;\n"+shader.fragmentShader;
    shader.vertexShader="varying float originalBed;uniform highp sampler2D rockTop;\n"+shader.vertexShader.replace("#include <begin_vertex>",`#include <begin_vertex>
      vec3 footprint=(modelMatrix*vec4(position,1.)).xyz;
      vec2 grid=clamp((footprint.xz+vec2(6.,4.5))*16.,vec2(0.),vec2(191.999,143.999));ivec2 at=ivec2(grid);vec2 uvCell=fract(grid);
      float bed=mix(mix(texelFetch(rockTop,at,0).r,texelFetch(rockTop,at+ivec2(1,0),0).r,uvCell.x),
                    mix(texelFetch(rockTop,at+ivec2(0,1),0).r,texelFetch(rockTop,at+ivec2(1,1),0).r,uvCell.x),uvCell.y);
      originalBed=bed;transformed.y+=(bed-modelMatrix[3].y-.002)/max(.001,length(modelMatrix[1].xyz));
    `);
  };
}
export function eruption(r:RegionalScene,x:number,top:number){
  const hotspot=r.spec.process==="hotspot",z=r.spec.arcTransect?0:-.33;const centres:T.Mesh[]=[];
  if(!r.spec.arcTransect){
  const shape=edifice(hotspot),rock=material(0x817c77);rock.vertexColors=true;
  if(r.lib){const lib=r.lib;rock.onBeforeCompile=s=>{
    Object.assign(s.uniforms,{faciesColor:{value:lib.color},faciesRelief:{value:lib.relief},detailGrade:r.grade});
    s.vertexShader="varying vec3 flank;\n"+s.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nflank=position;");
    s.fragmentShader="varying vec3 flank;\n"+libraryGLSL+s.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
      vec2 p=flank.xz*6.6+flank.y*vec2(.47,.91);
      vec2 gravelUV=mat2(.78,.625,-.625,.78)*p*2.3+.16;
      vec3 basalt=fieldSample(faciesColor,p,3.).rgb;
      vec3 grains=fieldSample(faciesColor,gravelUV,2.).rgb;
      vec3 relief=fieldSample(faciesRelief,p,3.).rgb;
      float scree=smoothstep(.22,.72,relief.b+.16*sin(flank.x*16.+flank.z*9.));
      vec3 surfaceRock=mix(basalt,grains*vec3(.64,.61,.62),.36*scree);
      diffuseColor.rgb=mix(diffuseColor.rgb,surfaceRock,.81)*(.72+.52*relief.b);
    `).replace("#include <normal_fragment_maps>","#include <normal_fragment_maps>\nnormal=normalize(normal+mat3(viewMatrix)*vec3(relief.r-.5,0.,relief.g-.5)*.66);");};}
  rock.side=T.DoubleSide;
  if(r.surfaceImage){
    const previous=rock.onBeforeCompile.bind(rock);rock.onBeforeCompile=(s,gl)=>{previous(s,gl);
      s.uniforms.groundImage={value:r.surfaceImage};s.vertexShader="attribute float apron;varying vec3 footprintUV;\n"+s.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nvec3 foot=(modelMatrix*vec4(position,1.)).xyz;footprintUV=vec3(foot.x/12.+.5,.5-foot.z/9.,apron);");
      s.fragmentShader="uniform sampler2D groundImage;varying vec3 footprintUV;\n"+s.fragmentShader.replace("#include <roughnessmap_fragment>","#include <roughnessmap_fragment>\nfloat toe=smoothstep(.28,.94,footprintUV.z)*smoothstep(.0,.015,originalBed);diffuseColor.rgb=mix(diffuseColor.rgb,texture2D(groundImage,footprintUV.xy).rgb,toe);");};
  }
  rock.customProgramCacheKey=()=>"g61-volcanic-flanks-"+Boolean(r.lib)+"-"+Boolean(r.surfaceImage);
  conformFlanks(rock,r);
  const depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking});conformFlanks(depth,r);
  rock.addEventListener("dispose",()=>depth.dispose());
  for(let i=0;i<(hotspot?5:1);i++){
    const m=new T.Mesh(shape,rock);m.userData.explanation={name:"Vulkanbau",answer:"Viele Ausbrüche können einen Vulkan aufbauen. Über der Quelle entsteht ein neuer Vulkan."};
    // Match the vertex shader for picking. The proxy is evaluated only on an actual pick.
    let picking:T.Mesh|undefined,pose="";
    const bed=(xx:number,zz:number)=>{const u=T.MathUtils.clamp((xx+6)*16,0,191.999),v=T.MathUtils.clamp((zz+4.5)*16,0,143.999),a=Math.floor(u),b=Math.floor(v),h=r.rockCeiling.image.data as Float32Array;
      return T.MathUtils.lerp(T.MathUtils.lerp(h[b*193+a],h[b*193+a+1],u-a),T.MathUtils.lerp(h[(b+1)*193+a],h[(b+1)*193+a+1],u-a),v-b);};
    m.userData.lessonAnchor=()=>new T.Vector3(.03,mountain(hotspot,.03,0)+(bed(m.position.x+.03*m.scale.x,m.position.z)-m.position.y-.002)/m.scale.y,0);
    m.raycast=(ray,hits)=>{
      picking??=new T.Mesh(shape.clone(),rock);const next=m.matrixWorld.elements.join(",");
      if(next!==pose){pose=next;const drawn=picking.geometry.attributes.position,rest=shape.attributes.position;
        for(let k=0;k<rest.count;k++){const xx=m.position.x+rest.getX(k)*m.scale.x,zz=m.position.z+rest.getZ(k)*m.scale.z;drawn.setY(k,rest.getY(k)+(bed(xx,zz)-m.position.y-.002)/m.scale.y);}
        picking.geometry.computeBoundingSphere();picking.matrixWorld.copy(m.matrixWorld);}
      const found:T.Intersection[]=[];picking.raycast(ray,found);for(const h of found){h.object=m;hits.push(h);}
    };
    rock.addEventListener("dispose",()=>picking?.geometry.dispose());
    m.customDepthMaterial=depth;m.castShadow=m.receiveShadow=true;centres.push(m);r.scene.add(m);
  }
  }
  const surface=(xx:number,zz:number)=>Math.max(r.height(xx,zz),...centres.filter(m=>m.visible).map(m=>r.height(xx,zz)-.002+mountain(hotspot,(xx-m.position.x)/m.scale.x,(zz-m.position.z)/m.scale.z)*m.scale.y));
  const channels=[0,1].map(branch=>{
    const tongue=lavaTongue((branch?.117:.21)*(r.spec.site==="island"?1.32:1));r.scene.add(tongue.mesh);tongue.mesh.userData.explanation={name:"Lavafluss",answer:"Das Gefälle bestimmt den Weg. An einer Senke endet diese modellierte Lavazunge."};
    let last=-1;
    return (t:number)=>{
      const phase=T.MathUtils.smoothstep(t,branch?.65:.53,.96);
      if(phase>0&&last<0){
        const active=centres.filter(m=>m.visible).at(-1),cx=active?.position.x??x,cz=active?.position.z??z;
        const scale=active?.scale.x??1,xx=cx+(r.spec.arcTransect?0:hotspot?.31:branch?.22:-.12)*scale,zz=cz+(r.spec.arcTransect?0:hotspot?.09:-.071)*scale;
        tongue.build(xx,zz,hotspot?.26:-1.2,branch?1.13:1.64,branch,surface);last=t;
      }
      tongue.phase(r.eruption==="effusive"?phase:0);
    };
  });
  const ash=new T.InstancedMesh(new T.PlaneGeometry(2,2),ashMaterial(),64);
  const clasts=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),material(0x564138),26);ash.frustumCulled=clasts.frustumCulled=false;ash.material.addEventListener("dispose",()=>ash.material.map?.dispose());
  ash.userData.explanation={name:"Asche und Gas",answer:"Aufsteigendes Gas dehnt sich aus. Es kann zähe Schmelze zerreißen."};clasts.userData.explanation=ash.userData.explanation;r.scene.add(ash,clasts);
  const gasMaterial=ash.material.clone();gasMaterial.color.set(0xc7d2d2);gasMaterial.opacity=.19;
  const gas=new T.InstancedMesh(ash.geometry,gasMaterial,26);gas.frustumCulled=false;gas.name="Vulkanisches Gas";r.scene.add(gas);
  const tint=new T.Color();
  const dummy=new T.Object3D();
  r.onAnimate(t=>{
    centres.forEach((m,i)=>{const age=hotspot?T.MathUtils.smoothstep(t,0,.53)*4+.92-i:1;const growth=T.MathUtils.clamp(age*1.6,.02,1);
      m.visible=age>0;const travel=hotspot?Math.max(0,age-1)*.92:0;
      const px=x-.64*travel,pz=z-.59*travel;m.position.set(px,r.height(px,pz)-.018,pz);m.scale.set(growth,growth*(1-.045*travel),growth);});
    channels.forEach(draw=>draw(t));
    gas.visible=r.eruption==="effusive"&&t>.52;
    if(gas.visible){
      for(let i=0;i<gas.count;i++){
        const age=Math.max(0,(t-.52)*2.6-i*.027)%1,a=i*2.399;
        const slit=r.spec.site==="island"?.32*Math.sin(a):0;
        dummy.position.set(x+slit+.49*age*age+.075*Math.sin(a+5*age),top+(hotspot?.22:r.spec.arcTransect?.015:.14)+.95*age,z+.09*Math.cos(a+age*4));
        dummy.quaternion.copy(r.camera.quaternion);dummy.rotateZ(a+age*.6);
        dummy.scale.setScalar(.21*Math.sin(Math.PI*age)*(.46+age));
        dummy.updateMatrix();gas.setMatrixAt(i,dummy.matrix);
      }gas.instanceMatrix.needsUpdate=true;
    }
    ash.visible=clasts.visible=r.eruption==="explosive"&&t>.54;
    if(ash.visible)for(const [group,count] of [[ash,64],[clasts,26]] as const){
      for(let i=0;i<count;i++){
        const age=(t-.54)*2.85-i/count*.58,a=i*2.399;let radius=0;
        if(age>=0&&age<1){const plume=group===ash;
          const spread=plume?(.075+.63*age*age)*(.76+.24*Math.sin(a*3.1+age*12)):age*1.4;
          const rise=plume?2.65*age:2.9*age-3.9*age*age;
          dummy.position.set(x+Math.cos(a+age*4)*spread+(plume?.74*age*age+.09*Math.sin(age*15):0),top+(r.spec.arcTransect?.02:hotspot?.32:.143)+rise,z+Math.sin(a+age*4)*spread);
          radius=plume?(.13+.49*age)*(.76+.24*Math.cos(a+age*8)):.035*(1-age);
        }
        if(group===ash){const sunward=.5+.5*Math.cos(a+.4);
          tint.setRGB(.50+.34*age+.13*sunward,.47+.35*age+.13*sunward,.45+.38*age+.12*sunward);
          ash.setColorAt(i,tint);dummy.quaternion.copy(r.camera.quaternion);dummy.rotateZ(i*2.399);}else dummy.quaternion.identity();
        dummy.scale.setScalar(radius);dummy.updateMatrix();group.setMatrixAt(i,dummy.matrix);
      }group.instanceMatrix.needsUpdate=true;if(group.instanceColor)group.instanceColor.needsUpdate=true;
    }
  });
}

