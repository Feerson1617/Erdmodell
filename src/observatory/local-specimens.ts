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
    pending=new GLTFLoader().loadAsync(localAsset("data/g61/"+ref[0]+".glb")).then(({scene})=>{
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
