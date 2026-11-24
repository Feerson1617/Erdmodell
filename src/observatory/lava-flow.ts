import * as T from "three";
export type Elevation=(x:number,z:number)=>number;
type Sample={x:number;z:number;h:number};
// Search a full fan. A closed depression stops the flow. Sample the interior
// of each segment as well as its ends on the current (possibly growing) edifice.
export function downhill(x:number,z:number,angle:number,step:number,rows:number,surface:Elevation,branch:number){
  const track:Sample[]=[{x,z,h:surface(x,z)}];
  for(let i=0;i<rows;i++){
    const last=track[i];let best=Infinity,next:Sample|undefined,direction=angle;
    for(let j=0;j<24;j++){
      const turn=(j%2?-1:1)*Math.ceil(j/2)*Math.PI/12,a=angle+turn;
      const dx=Math.cos(a)*step,dz=Math.sin(a)*step,h=surface(last.x+dx,last.z+dz);
      const mid=surface(last.x+dx*.5,last.z+dz*.5),q=surface(last.x+dx*.25,last.z+dz*.25),s=surface(last.x+dx*.75,last.z+dz*.75);
      if(q>last.h+1e-7||mid>q+1e-7||s>mid+1e-7||h>s+1e-7||h>=last.h-1e-8)continue;
      const bend=branch&&i>5?.30*Math.sin(i*.17+.8):0;
      const score=h+step*(.14*Math.abs(turn-bend)+.012*Math.cos(a*2+i*.17));
      if(score<best){best=score;direction=a;next={x:last.x+dx,z:last.z+dz,h};}
    }
    if(!next)break;track.push(next);angle=direction;
  }
  return track;
}
const veins=`
float grainHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.545);}
float flowNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(grainHash(i),grainHash(i+vec2(1,0)),f.x),mix(grainHash(i+vec2(0,1)),grainHash(i+1.),f.x),f.y);}
float cooled(vec2 p){
 vec2 i=floor(p),f=fract(p);float a=9.,b=9.;
 for(int j=-1;j<=1;j++)for(int k=-1;k<=1;k++){vec2 d=vec2(j,k);vec2 delta=d+.13+.74*vec2(grainHash(i+d),grainHash(i+d+31.9))-f;float r=dot(delta,delta);if(r<a){b=a;a=r;}else b=min(b,r);}
 return sqrt(b)-sqrt(a);
}`;
export function lavaTongue(width:number){
  const rows=64,cols=8,p=new T.Float32BufferAttribute(new Float32Array((rows+1)*(cols+1)*3),3),uv=[],idx=[];
  for(let i=0;i<=rows;i++)for(let j=0;j<=cols;j++){uv.push(i/rows,j/cols);if(i<rows&&j<cols){const k=i*(cols+1)+j;idx.push(k,k+1,k+cols+1,k+1,k+cols+2,k+cols+1);}}
  const g=new T.BufferGeometry();g.setAttribute("position",p);g.setAttribute("uv",new T.Float32BufferAttribute(uv,2));g.setIndex(idx);
  const front={value:0},m=new T.MeshStandardMaterial({side:T.DoubleSide,roughness:.91});
  m.onBeforeCompile=s=>{s.uniforms.front=front;s.vertexShader="varying vec2 tongue;\n"+s.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\ntongue=uv;");
    s.fragmentShader="varying vec2 tongue;uniform float front;\n"+veins+s.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
      float age=max(0.,front-tongue.x);vec2 pos=vec2(tongue.x*16.,tongue.y*2.5);
      pos+=.55*vec2(flowNoise(pos*1.7),flowNoise(pos*1.3+3.9));float blocks=cooled(pos);
      float edge=smoothstep(0.,.19,min(tongue.y,1.-tongue.y));
      float crust=flowNoise(pos*5.9);float heat=edge*(1.-smoothstep(.018,.135,blocks))*(.45+.55*crust)*(1.-.70*smoothstep(.18,.81,age));
      heat=max(heat,(1.-smoothstep(.006,.068,age))*edge*(.22+.52*crust));
      diffuseColor.rgb=mix(vec3(.032,.030,.033)+vec3(.074,.056,.047)*crust,vec3(.91,.17,.019),heat);
    `).replace("#include <emissivemap_fragment>","#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vec3(1.36,.235,.013)*heat;");};
  const mesh=new T.Mesh(g,m);mesh.name="Lavafluss";mesh.frustumCulled=false;mesh.visible=false;mesh.receiveShadow=true;
  let route:Sample[]=[];
  return {mesh,build(x:number,z:number,a:number,length:number,branch:number,surface:Elevation){
    route=downhill(x,z,a,length/rows,rows,surface,branch);
    for(let i=0;i<route.length;i++){
      const prev=route[Math.max(0,i-1)],pt=route[i],next=route[Math.min(i+1,route.length-1)];
      const dx=next.x-prev.x,dz=next.z-prev.z,n=Math.hypot(dx,dz)||1,u=i/rows;
      for(let j=0;j<=cols;j++){const v=j/cols,w=(v-.5)*width*(.48+.44*Math.sin(u*7+.4)**2+.34*Math.sin(u*19+.9)**2)*(1-.51*u);
        const xx=pt.x-dz/n*w,zz=pt.z+dx/n*w;p.setXYZ(i*(cols+1)+j,xx,surface(xx,zz)+width*(.018+.135*Math.sin(Math.PI*v)),zz);}
    }
    p.needsUpdate=true;g.setDrawRange(0,Math.max(0,route.length-1)*cols*6);g.computeVertexNormals();
    mesh.userData.track=route.map(v=>[v.x,v.h,v.z]);
  },phase(t:number){front.value=t;g.setDrawRange(0,Math.max(0,Math.floor((route.length-1)*t))*cols*6);mesh.visible=t>0&&route.length>1;}};
}
