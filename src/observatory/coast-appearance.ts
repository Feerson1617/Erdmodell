import * as T from "three";

// Ground cover on the explicitly synthetic transect. Only the solver sets water heights.
export function coastalSand(){
  const width=768,height=512,pixels=new Uint8Array(width*height*4);
  let seed=71;const random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
  const values=Float32Array.from({length:128*128},random);
  const noise=(x:number,z:number)=>{
    const a=Math.floor(x),b=Math.floor(z),u=x-a,v=z-b,i=(dx:number,dz:number)=>values[((b+dz)&127)*128+((a+dx)&127)];
    return T.MathUtils.lerp(T.MathUtils.lerp(i(0,0),i(1,0),u),T.MathUtils.lerp(i(0,1),i(1,1),u),v);
  };
  for(let j=0;j<height;j++)for(let i=0;i<width;i++){
    const x=(i/width-.5)*12,z=(j/height-.5)*9;
    const patch=noise(x*4,z*2.7),fine=noise(x*46,z*43),grain=random();
    const dune=T.MathUtils.smoothstep(-x+patch*.19,3.56,4.04);
    const covered=dune*T.MathUtils.smoothstep(.68*patch+.32*noise(x*13,z*10),.25,.8);
    const band=Math.sin(x*100+z*.9+8*noise(x*3.2,z*2.6));
    const brightness=.82+.12*patch+.08*fine+.07*grain+.025*band;
    const k=4*(j*width+i);
    pixels[k]=brightness*(204-79*covered);pixels[k+1]=brightness*(185-55*covered);pixels[k+2]=brightness*(146-58*covered);pixels[k+3]=255;
  }
  const map=new T.DataTexture(pixels,width,height,T.RGBAFormat);map.colorSpace=T.SRGBColorSpace;map.flipY=true;
  map.magFilter=T.LinearFilter;map.minFilter=T.LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;return map;
}

export function coastalGrass(surface:(x:number,z:number)=>number,front:boolean){
  const stems:number[]=[];
  for(let i=0;i<7;i++){const a=i*2.4,dx=Math.cos(a),dz=Math.sin(a),h=.035+.009*(i%4);
    stems.push(-dz*.011,0,dx*.011,dz*.011,0,-dx*.011,dx*.026,h,dz*.026);}
  const geo=new T.BufferGeometry();geo.setAttribute("position",new T.Float32BufferAttribute(stems,3));geo.computeVertexNormals();
  const plants=new T.InstancedMesh(geo,new T.MeshStandardMaterial({color:0x989365,roughness:.94,side:T.DoubleSide}),180);
  let seed=front?8079:8617;const random=()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296);
  const stem=new T.Object3D();
  for(let i=0;i<plants.count;){const x=-3.62-random()*1.8,z=(front?1:-1)*random()*4.35;
    if(Math.sin(z*3+x*15)+Math.sin(z*8+x*5)<-.4)continue;
    stem.position.set(x,surface(x,z),z);stem.rotation.y=random()*Math.PI*2;stem.scale.setScalar(.55+random()*1.25);stem.updateMatrix();
    plants.setMatrixAt(i,stem.matrix);plants.setColorAt(i,new T.Color().setRGB(.74+.24*random(),.8+.18*random(),.65+.22*random()));i++;}
  plants.name="Schematische Küstenvegetation oberhalb der Überflutung";return plants;
}
