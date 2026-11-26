import {PerspectiveCamera, Raycaster, Sphere, Vector2, Vector3} from "three";
import polygons from "./land-extents.json";
import {R} from "../geo";
type Land = [string,string,number[],number[][]];
const lands = polygons as Land[];
const sphere=new Sphere(new Vector3(),R), ray=new Raycaster(), hit=new Vector3();
const continents: Record<string,string>={Europe:"Europa",Asia:"Asien",Africa:"Afrika","North America":"Nordamerika","South America":"Südamerika",Oceania:"Ozeanien",Antarctica:"Antarktis"};
export const viewpoints: Record<string,[string,number,number,number]> = {
  sylt:["Sylt und Wattenmeer",54.89,8.38,85], schleswig:["Schleswig-Holstein",54.35,9.78,270],
  denmark:["Dänemark",56,10,560], alps:["Alpen",46.6,10.2,460],
  maunaloa:["Mauna Loa · Hawaii",19.475,-155.608,88], zaozan:["Zaōzan · Japan",38.144,140.440,49],
};
function landAt(lon:number,lat:number) {
  return lands.find(([, , [w,s,e,n], ring])=>{
    if(lon<w||lon>e||lat<s||lat>n)return false;
    let inside=false;
    for(let i=0,j=ring.length-1;i<ring.length;j=i++){
      const [a,b]=ring[i],[c,d]=ring[j];
      if((b>lat)!==(d>lat)&&lon<(c-a)*(lat-b)/(d-b)+a)inside=!inside;
    }
    return inside;
  });
}
export class FreeOrientation {
  private key="";
  private last="Erde · Global";
  describe(camera:PerspectiveCamera) {
    ray.setFromCamera(new Vector2(),camera);
    if(!ray.ray.intersectSphere(sphere,hit))return "Erde · Global";
    const center=hit.clone(), lat=Math.asin(center.y/R)*180/Math.PI,lon=Math.atan2(center.x,center.z)*180/Math.PI;
    const points=[center]; let horizon=false;
    for(const x of [-.9,0,.9])for(const y of [-.9,0,.9]){
      if(x===0 && y===0)continue;
      ray.setFromCamera(new Vector2(x,y),camera);
      if(ray.ray.intersectSphere(sphere,hit))points.push(hit.clone());else horizon=true;
    }
    const span=2*Math.max(...points.map(p=>p.angleTo(center)*R));
    if(horizon||span>9000)return "Erde · Global";
    const key=[Math.round(lat*8),Math.round(lon*8),Math.round(Math.log2(Math.max(1,span))*8)].join("/");
    if(key===this.key)return this.last;
    this.key=key;
    const countries=points.map(p=>landAt(Math.atan2(p.x,p.z)*180/Math.PI,Math.asin(p.y/R)*180/Math.PI));
    const known=countries.filter(l=>!!l);
    let name="Erde";
    if(known.length && known.every(l=>l[1]===known[0][1]))name=continents[known[0][1]]||name;
    if(span<1600 && countries.every(l=>l && l[0]===countries[0]?.[0]))name=countries[0]![0];
    for(const [place,a,b,dist] of Object.values(viewpoints)){
      if(span<dist*1.8 && Math.hypot(lat-a,(lon-b)*Math.cos(lat*Math.PI/180))*111<dist*.35){name=place;break;}
    }
    this.last=name+" · "+(span>2000?"Kontinental":span>600?"National":span>35?"Regional":"Lokal");
    return this.last;
  }
}
