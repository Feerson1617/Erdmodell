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
  const rim=.18+.036*Math.sin(3*a),flank=u<rim?.41+.59*T.MathUtils.smoothstep(u,.012,rim):Math.pow((1-u)/(1-rim),shield?1.68:1.35);
  const gully=1+.13*Math.sin(8*a+u*4)+.042*Math.sin(19*a-u*6);
  return (shield?.48:.64)*flank*gully;
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
  if(r.lib){const atlas=r.lib.color;rock.onBeforeCompile=s=>{
    s.uniforms.scree={value:atlas};s.vertexShader="varying vec3 flank;\n"+s.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nflank=position;");
    s.fragmentShader="varying vec3 flank;uniform sampler2D scree;\n"+s.fragmentShader.replace("#include <color_fragment>","#include <color_fragment>\nvec2 p=flank.xz*3.+flank.y*.43;vec3 rock=textureGrad(scree,(vec2(3.,1.)+.004+.992*fract(p))/vec2(4.,2.),dFdx(p)/vec2(4.,2.),dFdy(p)/vec2(4.,2.)).rgb;diffuseColor.rgb*=.53+2.8*sqrt(rock);");};}
  rock.side=T.DoubleSide;
  if(r.surfaceImage){
    const previous=rock.onBeforeCompile.bind(rock);rock.onBeforeCompile=(s,gl)=>{previous(s,gl);
      s.uniforms.groundImage={value:r.surfaceImage};s.vertexShader="attribute float apron;varying vec3 footprintUV;\n"+s.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nvec3 foot=(modelMatrix*vec4(position,1.)).xyz;footprintUV=vec3(foot.x/12.+.5,.5-foot.z/9.,apron);");
      s.fragmentShader="uniform sampler2D groundImage;varying vec3 footprintUV;\n"+s.fragmentShader.replace("#include <roughnessmap_fragment>","#include <roughnessmap_fragment>\nfloat toe=smoothstep(.5,.99,footprintUV.z)*smoothstep(.0,.015,originalBed);diffuseColor.rgb=mix(diffuseColor.rgb,texture2D(groundImage,footprintUV.xy).rgb,toe);");};
  }
  rock.customProgramCacheKey=()=>"g6-volcanic-flanks-"+Boolean(r.lib)+"-"+Boolean(r.surfaceImage);
  conformFlanks(rock,r);
  const depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking});conformFlanks(depth,r);
  rock.addEventListener("dispose",()=>depth.dispose());
  for(let i=0;i<(hotspot?5:1);i++){
    const m=new T.Mesh(shape,rock);m.userData.explanation={name:"Vulkanbau",answer:"Viele Ausbrüche können einen Vulkan aufbauen. Über der Quelle entsteht ein neuer Vulkan."};
    m.customDepthMaterial=depth;m.castShadow=m.receiveShadow=true;centres.push(m);r.scene.add(m);
  }
  }
  const channels=[0,1].map(branch=>{
    const rows=58,cols=6,positions=new Float32Array((rows+1)*(cols+1)*3),uv=[],indices=[];
    for(let i=0;i<=rows;i++)for(let j=0;j<=cols;j++){
      uv.push(i/rows,j/cols);
      if(i<rows&&j<cols){const k=i*(cols+1)+j;indices.push(k,k+1,k+cols+1,k+1,k+cols+2,k+cols+1);}
    }
    const g=new T.BufferGeometry();g.setAttribute("position",new T.BufferAttribute(positions,3));g.setAttribute("uv",new T.Float32BufferAttribute(uv,2));g.setIndex(indices);
    const progress={value:0},hot=new T.MeshStandardMaterial({color:0xffffff,emissive:0x210a03,roughness:.79,side:T.DoubleSide});
    hot.onBeforeCompile=s=>{s.uniforms.front=progress;s.vertexShader="varying vec2 channel;\n"+s.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nchannel=uv;");
      s.fragmentShader="varying vec2 channel;uniform float front;\n"+s.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
        float u=channel.x,v=channel.y,age=max(0.,front-u);
        vec2 p=vec2(u*33.,v*3.+sin(u*19.));
        float cracks=abs(sin(p.x+.7*sin(p.y*3.1))*cos(p.y*2.+p.x*.29));
        float molten=max(.32*(1.-smoothstep(.02,.13,age)),1.-smoothstep(.05,.32,cracks))*(1.-.57*smoothstep(.08,.84,age));
        float edge=smoothstep(0.,.17,min(v,1.-v));
        vec3 crust=mix(vec3(.066,.042,.034),vec3(.16,.093,.063),.5+.5*sin(p.x*2.3+p.y));
        diffuseColor.rgb=mix(crust,vec3(1.,.28,.032),molten*edge);
      `).replace("#include <emissivemap_fragment>","#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vec3(.63,.108,.009)*molten*edge;");};
    const lava=new T.Mesh(g,hot);lava.name="Lavafluss";lava.frustumCulled=false;lava.userData.explanation={name:"Lavafluss",answer:"Lava folgt dem Gefälle. Ihre Oberfläche kühlt ab und bildet eine dunkle Kruste. Der Fließweg ist ein Modell."};r.scene.add(lava);
    const path:{x:number;z:number}[]=[],length=branch?1.31:1.62;
    let px=x,pz=z,prev=0;
    const surface=(xx:number,zz:number)=>Math.max(r.height(xx,zz),...centres.filter(m=>m.visible).map(m=>r.height(xx,zz)-.002+mountain(hotspot,(xx-m.position.x)/m.scale.x,(zz-m.position.z)/m.scale.z)*m.scale.y));
    // Begin at a low notch of the crater rim, then trace a downhill channel.
    let head=0,min=Infinity;for(let j=3;j<=10;j++){const a=j*.08,xx=x+.22*Math.cos(a),zz=z+.155*Math.sin(a),h=mountain(hotspot,xx-x,zz-z)+r.height(xx,zz);if(h<min){head=a;min=h;}}
    for(let i=0;i<=rows;i++){
      const u=i/rows;
      if(i===0){px=x+(r.spec.arcTransect?0:.22)*Math.cos(head);pz=z+(r.spec.arcTransect?0:.155)*Math.sin(head);prev=head;}
      path.push({x:px,z:pz});let angle=.015,best=Infinity,step=length/rows;
      for(let k=-3;k<=3;k++){const a=T.MathUtils.clamp(prev+k*.18,-.20,.38),xx=px+step*Math.cos(a),zz=pz+step*Math.sin(a);
        if(!r.spec.arcTransect&&zz>-.075)continue;
        const h=r.height(xx,zz)+(r.spec.arcTransect?0:mountain(hotspot,xx-x,zz-z))+.009*Math.abs(k)+.006*Math.abs(a-head-(branch&&u>.26?.66:0)-.24*Math.sin(u*12.));if(h<best){angle=a;best=h;}}
      prev=angle+(branch&&i===16?.62:0);px+=step*Math.cos(angle);pz+=step*Math.sin(angle);
    }
    let last=-1;
    return (t:number)=>{const f=T.MathUtils.smoothstep(t,branch?.66:.55,.96);lava.visible=r.eruption==="effusive"&&f>0;
      if(!lava.visible||last===t)return;last=t;progress.value=f;const p=g.attributes.position as T.BufferAttribute;
      for(let i=0;i<=rows;i++){const a=path[i],b=path[Math.min(rows,i+1)],c=path[Math.max(0,i-1)],dx=b.x-c.x,dz=b.z-c.z,n=Math.hypot(dx,dz)||1;
        for(let j=0;j<=cols;j++){const v=j/cols,w=(v-.5)*(branch?.079:.155)*(.85+.16*Math.sin(i*.49)),xx=a.x-w*dz/n,zz=a.z+w*dx/n;
          p.setXYZ(i*(cols+1)+j,xx,surface(xx,zz)+.013+.018*Math.sin(v*Math.PI),zz);}}
      p.needsUpdate=true;g.computeVertexNormals();g.setDrawRange(0,Math.floor(rows*f)*cols*6);
    };
  });
  const ash=new T.InstancedMesh(new T.PlaneGeometry(2,2),ashMaterial(),64);
  const clasts=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),material(0x564138),26);ash.frustumCulled=clasts.frustumCulled=false;ash.material.addEventListener("dispose",()=>ash.material.map?.dispose());
  ash.userData.explanation={name:"Asche und Gas",answer:"Aufsteigendes Gas dehnt sich aus. Es kann zähe Schmelze zerreißen."};clasts.userData.explanation=ash.userData.explanation;r.scene.add(ash,clasts);
  const dummy=new T.Object3D();
  r.onAnimate(t=>{
    centres.forEach((m,i)=>{const age=hotspot?t*4+.92-i:1;const growth=T.MathUtils.clamp(age*1.6,.02,1);
      m.visible=age>0;const travel=hotspot?Math.max(0,age-1)*.92:0;
      const px=x-.64*travel,pz=z-.59*travel;m.position.set(px,r.height(px,pz)-.018,pz);m.scale.set(growth,growth*(1-.045*travel),growth);});
    channels.forEach(draw=>draw(t));
    ash.visible=clasts.visible=r.eruption==="explosive"&&t>.54;
    if(ash.visible)for(const [group,count] of [[ash,64],[clasts,26]] as const){
      for(let i=0;i<count;i++){
        const age=(t-.54)*2.85-i/count*.58,a=i*2.399;let radius=0;
        if(age>=0&&age<1){const plume=group===ash;
          const spread=plume?.065+.63*age*age:age*1.4;
          const rise=plume?2.65*age:2.9*age-3.9*age*age;
          dummy.position.set(x+Math.cos(a)*spread+(plume?.74*age*age:0),top+(r.spec.arcTransect?.02:hotspot?.46:.57)+rise,z+Math.sin(a)*spread);
          radius=plume?.12+.45*age:.035*(1-age);
        }
        if(group===ash){dummy.quaternion.copy(r.camera.quaternion);dummy.rotateZ(i*2.399);}else dummy.quaternion.identity();
        dummy.scale.setScalar(radius);dummy.updateMatrix();group.setMatrixAt(i,dummy.matrix);
      }group.instanceMatrix.needsUpdate=true;
    }
  });
}

