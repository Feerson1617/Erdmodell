import {claimObject} from "./reveal";
import * as T from "three";
import {AnnotationLayer,project,type Annotation} from "../annotations";
import type {RegionalScene} from "./regional";

type Info={name:string;answer:string};
const vocabulary:Record<string,[string,string]>={
 Hypozentrum:["Erdbebenherd","Hier beginnt der Bruch. Von hier breiten sich seismische Wellen aus."],Epizentrum:["Epizentrum","Der Punkt an der Erdoberfläche senkrecht über dem Erdbebenherd."],
 Störungsfläche:["Störungsfläche","An dieser Fläche können Gesteinsbereiche gegeneinander gleiten."],Bruchfront:["Bruchfront","Der Bruch breitet sich vom Herd über die Störungsfläche aus."],
 "Verdrängte Wassersäule":["Verdrängte Wassersäule","Bewegt sich der Meeresboden nach oben oder unten, kann er das Wasser darüber verdrängen."],
 "Wassersäule im Schnitt":["Wassersäule","Zwischen Meeresboden und Oberfläche liegt Wasser. Die beiden Grenzen bestimmen seine Tiefe."],
 Wasseroberfläche:["Wasseroberfläche","Die Wasserhöhe im regionalen Ereignismodell stammt aus der Flachwasserberechnung."],
 "Ursprüngliche Uferlinie":["Ursprüngliche Uferlinie","Hier traf das ruhende Wasser vor dem Modellbeben auf das Land."],
 "Druckwelle im Wasser":["P-Welle im Wasser","Druck kann sich in Wasser ausbreiten. Direkte S-Wellen brauchen einen festen Stoff."],
 "P-Gesteinspunkte":["Gesteinspunkte · P-Welle","Sie schwingen längs zur Ausbreitungsrichtung."],"S-Gesteinspunkte":["Gesteinspunkte · S-Welle","Sie schwingen quer zur Ausbreitungsrichtung."],
 "Geländemarker":["Geländemarker","Die beiden hellen Markierungen lagen auf gleicher Höhe. Beim Bruch verschieben sie sich seitlich."],
 "Nahgelände":["Gelände im Nahmodell","Der Ausschnitt zeigt ein Gelände in Metern. Einzelne Pflanzen und Steine veranschaulichen typische Formen."],
 "Uferwasser":["Ruhige Nahbucht","Dieses Wasser zeigt die ruhige Oberfläche an einer beispielhaften Küste."],
 "Basaltspalte":["Basaltische Spalte","Hier ist der Boden aufgerissen. Bei einem effusiven Ausbruch kann Lava austreten."],
 Lavafluss:["Lavafluss","An der Oberfläche heißt die austretende Gesteinsschmelze Lava. Sie folgt dem Gefälle."],
 "Vulkanisches Gas":["Vulkanisches Gas","Gas entweicht auch dann, wenn Lava ruhig ausfließt."],
 "Warnsystem":["Warnsystem","Eine erreichbare Warnung und geübte Abläufe können Betroffenen Zeit verschaffen."],
 "Gefährdete Menschen":["Gefährdete Menschen","Wer sich im betroffenen Gebiet aufhält, ist der Naturgefahr ausgesetzt."],
 "Vergleichsweg":["Vergleichsweg","An diesem Weg lässt sich die Bewegung der beiden Seiten ablesen."]
};
const preferred=["Überfluteter Bereich","Wasserwelle","Hebung des Meeresbodens","Senkung des Meeresbodens","Erdbebenherd","Epizentrum","P-Wellenfront","S-Wellenfront","Lavafluss","Basaltische Spalte","Geländemarker","Ruhige Nahbucht","Verdrängte Wassersäule","Ursprüngliche Uferlinie","Magmareservoir","Asche und Gas","Versetzte Geländelinie","Mantelkeil","Gebäude","Evakuierungsweg","Zug der absinkenden Platte","Starrer oberster Mantel","Blockierter Kontakt","Abtauchende ozeanische Kruste","Relative Bewegungsrichtung","Elastisch verformtes Gestein"];
function description(o:T.Object3D):Info|undefined{
 if(o.userData.explanation)return o.userData.explanation;
 const v=vocabulary[o.name];if(v)return {name:v[0],answer:v[1]};
 if(o.parent?.userData.explanation)return o.parent.userData.explanation;
}
function drawn(o:T.Object3D){for(let p:T.Object3D|null=o;p;p=p.parent)if(!p.visible)return false;return true;}
const vec=new T.Vector3(),matrix=new T.Matrix4();
function anchor(mesh:T.Mesh){
 if(mesh.userData.lessonAnchor){const point=mesh.userData.lessonAnchor();return point?mesh.localToWorld(point.clone()):undefined;}
 const geo=mesh.geometry,pos=geo?.attributes.position;if(!pos)return;
 const total=Math.min(geo.drawRange.count,(geo.index??pos).count-geo.drawRange.start);if(total<1)return;
 const offset=geo.drawRange.start+Math.min(total-1,Math.floor(total*(geo.hasAttribute("geologyCoord")?.052:.46)));
 const i=geo.index?.getX(offset)??offset;
 if(geo.attributes.depthWet&&geo.attributes.depthWet.getX(i)<=.002)return;
 const point=new T.Vector3().fromBufferAttribute(pos,i);
 if(mesh instanceof T.InstancedMesh){if(!mesh.count)return;mesh.getMatrixAt(Math.floor(mesh.count*.35),matrix);if(Math.abs(matrix.determinant())<1e-9)return;point.applyMatrix4(matrix);}
 return mesh.localToWorld(point);
}
function hitVisible(r:RegionalScene,h:T.Intersection){
 if(!drawn(h.object)||!r.isGeologyVisible(h))return false;
 const mesh=h.object as T.Mesh,wet=mesh.geometry?.attributes.depthWet;
 if(wet&&h.face&&h.barycoord){const {a,b,c}=h.face,v=h.barycoord;if(wet.getX(a)*v.x+wet.getX(b)*v.y+wet.getX(c)*v.z<=.002)return false;}
 if(mesh.name==="Gelände"&&h.point.z>4.52*(1-r.opening))return false;
 const mat=mesh.material as T.Material|undefined;
 return mat?.side!==T.BackSide&&!(mat?.transparent&&!description(mesh));
}
function terrainBlocks(r:RegionalScene,point:T.Vector3){
 const eye=r.camera.position;
 for(let i=1;i<20;i++){
   vec.lerpVectors(eye,point,i/20);
   if(r.localActive){if(vec.y+.012<r.local!.surface(vec.x*10,vec.z*10)*.1)return true;}
   else if((!r.cut||vec.z<-.002)&&Math.abs(vec.x)<6&&Math.abs(vec.z)<4.5&&vec.y<r.height(vec.x,vec.z)-.055)return true;
 }
 return false;
}
export class ObjectLabels{
 private layer:AnnotationLayer;private selected="";private key="";private last=0;private rev=0;
 private scene?:T.Scene;private objects:T.Mesh[]=[];private signals:HTMLElement[];
 private ro:ResizeObserver;private targets=new Map<string,T.Mesh>();private object?:T.Mesh;private picked?:T.Vector3;
 constructor(private host:HTMLElement){
   host.classList.add("annotations");this.layer=new AnnotationLayer(host,a=>this.select(a.id));
   this.signals=[".tools","#obswitch","#observation-controls",".orientation","#water-profile"].flatMap(s=>Array.from(document.querySelectorAll<HTMLElement>(s)));
   this.ro=new ResizeObserver(()=>{this.rev++;this.key="";});this.ro.observe(host);for(const el of this.signals)this.ro.observe(el);
 }
 clear(){this.scene=undefined;this.object=undefined;this.selected="";this.picked=undefined;this.key="";this.targets.clear();this.layer.clear();this.rev++;}
 private select(id:string,object=this.targets.get(id),point?:T.Vector3){
   if(!object)return;
   const info=description(object);claimObject(id,info?info.name+" · "+info.answer:"");this.selected=id;this.object=object;this.picked=point?object.worldToLocal(point.clone()):undefined;this.key="";
   const field=document.getElementById("g-object");
   if(info&&field){field.dataset.selection=id;field.textContent=info.name+" · "+info.answer;field.hidden=false;}
 }
 pick(r:RegionalScene,x:number,y:number){
   const rect=this.host.getBoundingClientRect(),ray=new T.Raycaster();ray.params.Line.threshold=.045;
   ray.setFromCamera(new T.Vector2(2*(x-rect.left)/rect.width-1,1-2*(y-rect.top)/rect.height),r.camera);
   const hit=ray.intersectObjects(r.renderScene.children,true).find(h=>hitVisible(r,h));
   if(hit&&description(hit.object))this.select(hit.object.uuid,hit.object as T.Mesh,hit.point);
 }
 draw(r:RegionalScene,key:string,allowed:(id:string,index:number)=>boolean){
   if(this.scene!==r.renderScene){this.clear();this.scene=r.renderScene;}
   const observing=document.body.classList.contains("observing"),show=r.names||observing;
   const state=[key,this.rev,this.selected,show,r.moreNames,document.body.dataset.reveal].join("|");
   const now=performance.now();if(this.key===state||this.key&&now-this.last<110&&(r.playing||!r.viewSettled))return;
   this.last=now;this.key=state;
   this.objects=[];r.renderScene.traverseVisible(o=>{if((o as T.Mesh).geometry&&description(o))this.objects.push(o as T.Mesh);});
   this.objects.sort((a,b)=>this.rank(a)-this.rank(b));
   // The cut face exposes the front rocks. A nearer opaque rock may cover a deeper label.
   const rocks=this.objects.filter(o=>o.geometry?.hasAttribute("geologyCoord")&&r.section.visible);
   const sight=new T.Raycaster(),direction=new T.Vector3(),eye=r.camera.position;
   const model=r.spec.site??r.spec.process,source=r.localActive?"Geländeausschnitt · Quellen im Katalog G6.1":r.spec.geology?.source??"Regionale Modellgeometrie · Quellenkatalog G5/G6";
   const phase=document.getElementById("learn-phase")?.textContent||r.view;
   const out:Annotation[]=[],used=new Set<string>();this.targets.clear();const rect=this.host.getBoundingClientRect();
   for(const mesh of this.objects){
     const info=description(mesh)!;if(used.has(info.name))continue;
     if(!show&&this.object!==mesh)continue;
     const p=this.picked&&mesh===this.object?mesh.localToWorld(this.picked.clone()):anchor(mesh);if(!p)continue;
     if(mesh.name==="Gelände"&&p.z>4.52*(1-r.opening))continue;
     const xy=project(p,r.camera,rect.width,rect.height);if(!xy||terrainBlocks(r,p))continue;
     // Front faces of a cut are visible only from the open half-space.
     if(mesh.geometry.hasAttribute("geologyCoord")&&p.z>=-.005&&r.camera.position.z<0)continue;
     if(rocks.length&&p.y<0&&mesh.geometry.hasAttribute("geologyCoord")){
       direction.subVectors(p,eye);sight.far=direction.length()-.045;sight.set(eye,direction.normalize());
       if(sight.intersectObjects(rocks,false).some(hit=>hit.object!==mesh&&hitVisible(r,hit)))continue;
     }
     used.add(info.name);if(!allowed(mesh.uuid,used.size-1))continue;this.targets.set(mesh.uuid,mesh);out.push({id:mesh.uuid,name:info.name,text:info.answer,phase,source,model,...xy});
     if(out.length>=(r.moreNames?8:4))break;
   }
   this.layer.draw(out,this.signals,this.rev);for(const button of this.host.querySelectorAll<HTMLButtonElement>("button"))button.setAttribute("aria-pressed",String(button.dataset.object===this.selected));
   if(this.selected&&!this.targets.has(this.selected)){this.object=undefined;this.selected="";this.picked=undefined;const field=document.getElementById("g-object");if(field)field.textContent="";}
 }
 private rank(m:T.Mesh){if(this.object===m)return -1;const i=preferred.indexOf(description(m)!.name);return i<0?100:i;}
}
