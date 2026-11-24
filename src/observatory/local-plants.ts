import * as T from "three";

export function randomSequence(seed:number){
  return ()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
}
type Shape="oak"|"shrub"|"grass"|"rock"|"conifer"|"moss"|"palm";
// Templates are in metres. Individual shoots, branch collars and fractured faces
// share one indexed geometry per species variant, then use GPU instancing.
export function specimen(shape:Shape,seed:number,simple=false){
  const random=randomSequence(seed),pos:number[]=[],col:number[]=[],index:number[]=[];
  const vec=(x:number,y:number,z:number)=>new T.Vector3(x,y,z);
  const vertex=(v:T.Vector3,c:T.Color,light=1)=>{
    pos.push(v.x,v.y,v.z);col.push(c.r*light,c.g*light,c.b*light);return pos.length/3-1;
  };
  function tube(a:T.Vector3,b:T.Vector3,r:number,tip:number,c:T.Color){
    const axis=b.clone().sub(a).normalize(),u=axis.clone().cross(Math.abs(axis.y)<.9?vec(0,1,0):vec(1,0,0)).normalize(),v=axis.clone().cross(u);
    const start=pos.length/3,n=simple?4:7;
    for(const [p,s] of [[a,r],[b,tip]] as const)for(let j=0;j<n;j++){
      const t=j*2*Math.PI/n;
      vertex(p.clone().addScaledVector(u,s*Math.cos(t)).addScaledVector(v,s*Math.sin(t)),c,.80+.20*Math.cos(t-.5));
    }
    for(let j=0;j<n;j++){const k=start+j,l=start+(j+1)%n;index.push(k,l,k+n,l,l+n,k+n);}
  }
  const bark=new T.Color(0x625342),foliage=new T.Color();
  function spray(at:T.Vector3,size:number,shade:number){
    // Folded sprays form a discontinuous, light-permeable crown; no textured planes.
    const n=simple?12:56;
    for(let i=0;i<n;i++){
      const a=random()*Math.PI*2,r=size*Math.sqrt(random()),h=(random()-.45)*size*.85;
      const p=at.clone().add(vec(r*Math.cos(a),h,r*Math.sin(a)));
      const ang=random()*6.28,len=size*(simple?.57:.32)*(.6+random()),dx=Math.cos(ang)*len,dz=Math.sin(ang)*len;
      foliage.setHSL(.17+random()*.055,.18+random()*.20,shade+.07*random()+.025*h/size,T.SRGBColorSpace);
      const k=vertex(p,foliage,.67);
      vertex(p.clone().add(vec(dx*.4-dz*.46,.22*len,dz*.4+dx*.46)),foliage);
      vertex(p.clone().add(vec(dx,.35*len,dz)),foliage,1.12);
      vertex(p.clone().add(vec(dx*.4+dz*.46,-.13*len,dz*.4-dx*.46)),foliage,.91);
      index.push(k,k+1,k+2,k,k+2,k+3);
    }
  }
  function limb(a:T.Vector3,d:T.Vector3,len:number,r:number,depth:number){
    const b=a.clone().addScaledVector(d,len);tube(a,b,r,r*.65,bark);
    if(depth===0){spray(b,shape==="shrub"?.30:1.20,shape==="shrub"?.31:.255);return;}
    const rot=random()*6.28,n=depth===3?4:3;
    for(let j=0;j<n;j++){
      const t=rot+j*6.28/n+(random()-.5)*.7;
      const dir=vec(d.x*.48+Math.cos(t)*.82,.23+.56*random()+.19*d.y,d.z*.48+Math.sin(t)*.82).normalize();
      limb(b,dir,len*(.56+random()*.23),r*.59,depth-1);
    }
  }
  if(shape==="oak"||shape==="shrub"){
    limb(vec(0,-.04,0),vec(.06,1,.045).normalize(),shape==="oak"?2.55:.43,shape==="oak"?.42:.075,shape==="oak"?3:2);
  }else if(shape==="conifer"||shape==="palm"){
    const pine=shape==="conifer",h=pine?10:7; tube(vec(0,-.06,0),vec(.2,h,0),.24,.05,bark);
    for(let j=0;j<(pine?68:24);j++){
      const f=j/(pine?68:24),a=j*2.399,level=pine?(.16+.81*f)*h:h,reach=pine?2.65*(1-f)+.2:2.5+random();
      const stem=vec(.16,level,0),end=vec(Math.cos(a)*reach,level+(pine?-.35:-.85),Math.sin(a)*reach);
      tube(stem,end,.065,.015,bark);for(let k=1;k<=3;k++)spray(stem.clone().lerp(end,k/3),pine?.66:.49,pine?.236:.31);
    }
  }else if(shape==="grass"){
    const n=simple?8:32;
    for(let j=0;j<n;j++){
      const a=random()*6.28,dx=Math.cos(a),dz=Math.sin(a),h=.19+.56*random(),r=.16*random(),w=.012+.018*random();
      const c=new T.Color().setHSL(.116+.018*random(),.30+.26*random(),.43+.24*random(),T.SRGBColorSpace);
      const p=vec(dx*r,-.015,dz*r),k=vertex(p.clone().add(vec(-dz*w,0,dx*w)),c,.42);
      vertex(p.clone().add(vec(dz*w,0,-dx*w)),c,.5);
      vertex(p.clone().add(vec(dx*h*.23-dz*w,h*.68,dz*h*.23+dx*w)),c);
      vertex(p.clone().add(vec(dx*h*.23+dz*w,h*.62,dz*h*.23-dx*w)),c,.82);
      vertex(p.clone().add(vec(dx*h*.63,h,dz*h*.63)),c,1.1);
      index.push(k,k+1,k+2,k+1,k+3,k+2,k+2,k+3,k+4);
    }
  }else{
    const moss=shape==="moss",n=6+seed%6,radii=Array.from({length:n},()=>.69+.41*random()),a0=random()*2;
    const c=new T.Color(moss?0x8b9163:seed%3===0?0x968675:0x777675),thickness=moss?.20:.36+.55*random();
    for(let ring=0;ring<3;ring++)for(let j=0;j<n;j++){
      const a=a0+j*6.28/n,r=radii[j]*[.83,1,.64][ring];
      vertex(vec(Math.cos(a)*r+ring*.08,[-.30,.18,.78][ring]*thickness+random()*.14*thickness,Math.sin(a)*r*.77),c,.73+.22*ring+.12*random());
    }
    for(let j=0;j<n;j++){const l=(j+1)%n;for(let r=0;r<2;r++){const k=r*n;index.push(k+j,k+n+j,k+l,k+l,k+n+j,k+n+l);}if(j>0&&j<n-1)index.push(2*n,2*n+j+1,2*n+j);}
  }
  const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(pos,3));g.setAttribute("color",new T.Float32BufferAttribute(col,3));g.setIndex(index);g.computeVertexNormals();return g;
}
