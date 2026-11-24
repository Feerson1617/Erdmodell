import * as T from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {localAsset} from "../assets";
const assets:Record<string,[string,number]>={oak:["tree_small_02",7.7],conifer:["pine_tree_01",10],grass:["grass_medium_01",.62],shrub:["shrub_02",1.25],rock:["rock_07",1.34]};
type Part={geometry:T.BufferGeometry;material:T.MeshStandardMaterial};
const cache=new Map<string,Promise<Part[]>>();
export function scannedSpecimen(kind:string){
  const ref=assets[kind];if(!ref)return;
  let pending=cache.get(kind);
  if(!pending){
    const loader=new GLTFLoader();
    loader.register(parser=>{parser.textureLoader=new T.TextureLoader(parser.options.manager);return {name:"GeoRisikoEmbeddedImages"};});
    pending=loader.loadAsync(localAsset("data/g61/"+ref[0]+".glb")).then(({scene})=>{
      const box=new T.Box3().setFromObject(scene),size=box.getSize(new T.Vector3());
      const factor=ref[1]/(kind==="rock"?Math.max(size.x,size.z):size.y);
      const origin=box.getCenter(new T.Vector3());origin.y=box.min.y;const parts:Part[]=[];
      scene.traverse(child=>{if(!(child instanceof T.Mesh))return;
        const geometry=child.geometry as T.BufferGeometry,material=child.material as T.MeshStandardMaterial;
        geometry.applyMatrix4(child.matrixWorld);geometry.translate(-origin.x,-origin.y,-origin.z);geometry.scale(factor,factor,factor);
        material.roughness=.93;if(kind==="grass")material.color.setRGB(1.10,.89,.58);
        if(material.map)material.map.anisotropy=4;parts.push({geometry,material});
      });return parts;
    }).catch(error=>{cache.delete(kind);throw error;});
    cache.set(kind,pending);
  }
  return pending;
}

const distantRows:Record<string,[number,number]>={oak:[0,7.7],conifer:[2,10],shrub:[4,1.25],grass:[6,.62]};
let atlas:T.Texture|undefined;
export function distantSpecimen(kind:string,onReady:()=>void){
  const row=distantRows[kind];if(!row)return;
  atlas??=new T.TextureLoader().load(localAsset("data/g61/mitte.webp"),onReady);
  atlas.colorSpace=T.SRGBColorSpace;
  const [tile,height]=row,p:number[]=[],uv:number[]=[],idx:number[]=[];
  for(let i=0;i<2;i++){
    const k=tile+i,col=k%4,top=Math.floor(k/4),w=height*.56;
    for(const y of [0,height])for(const side of [-1,1]){
      p.push(i===0?w*side:0,y,i===1?w*side:0);uv.push((col+(side<0?.005:.995))/4,1-(top+(y===0?.984:.012))/3);
    }
    const a=i*4;idx.push(a,a+1,a+2,a+2,a+1,a+3);
  }
  const geom=new T.BufferGeometry();geom.setAttribute("position",new T.Float32BufferAttribute(p,3));geom.setAttribute("uv",new T.Float32BufferAttribute(uv,2));geom.setIndex(idx);
  const material=new T.MeshBasicMaterial({map:atlas,side:T.DoubleSide,alphaTest:.39});
  return {geom,material};
}
