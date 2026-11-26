import * as T from "three";
import {project,type Annotation} from "../annotations";
import type {World} from "../world";

/** Points use the same lake section, instanced bubbles, pipe and valley mesh as the lesson. */
export function nyosLabels(world:World,width:number,height:number):Annotation[]{
  const lake=world.nyos,lesson=world.nyosLesson,section=lake.section,cam=world.nav.camera;
  if(!section||!lake.group.visible||lake.localWeight<.98||world.nav.flight)return [];
  const out:Annotation[]=[],eye=lake.group.worldToLocal(cam.position.clone());
  const mark=(id:string,name:string,text:string,o:T.Object3D,p:T.Vector3)=>{
    for(let parent:T.Object3D|null=o;parent;parent=parent.parent)if(!parent.visible)return;
    const xy=project(o.localToWorld(p),cam,width,height);
    if(xy)out.push({id:"nyos-"+id,name,text,model:"Nyos",source:"Nyos · Geländedaten und historisches Erklärungsmodell",phase:lesson.view,...xy});
  };
  if(eye.x>.006&&section.group.visible){
    const z=T.MathUtils.lerp(section.start,section.end,.48),h=section.depthAt(z);
    mark("deep","Tiefenwasser","Dichtes Tiefenwasser mischt sich hier nur wenig mit dem leichteren Oberflächenwasser.",section.group,new T.Vector3(0,-h*.68,z));
    if(lesson.dissolved){
      const z2=T.MathUtils.lerp(section.start,section.end,.66);
      mark("dissolved","Gelöstes Kohlendioxid","CO₂ kann unter Druck im Tiefenwasser gelöst bleiben. Die Analysefarbe zeigt den gelösten Gasvorrat.",section.group,new T.Vector3(0,-section.depthAt(z2)*.86,z2));
    }
  }
  lake.group.traverseVisible(o=>{
    if(o.name==="Nyos-Entgasungsrohr"&&eye.x>.006)mark("pipe","Entgasungsrohr","Im Rohr steigt gasreiches Wasser auf. Oben kann das Gas kontrolliert entweichen.",o,new T.Vector3());
    if(o.name==="Nyos-Gasblasen"&&o instanceof T.InstancedMesh&&o.count&&eye.x>.006){
      const m=new T.Matrix4();o.getMatrixAt(Math.floor(o.count/2),m);
      mark("bubbles","Gasfreisetzung","Beim Aufstieg sinkt der Druck. Gelöstes Kohlendioxid bildet Gasblasen.",o,new T.Vector3().setFromMatrixPosition(m));
    }
    if(o.name==="Nyos-Gasstrom"&&o instanceof T.Mesh){
      const row=Math.round(48*(.06+.32*T.MathUtils.smoothstep(lesson.progress,.68,.92)));
      mark("valley","Bodennaher Gasstrom","Hohe CO₂-Konzentrationen beeinträchtigen die Atmung und können lebensgefährlich sein, zugleich kann der Sauerstoffanteil sinken. CO₂ ist farblos. CO₂-reiche Luft kann sich in Mulden sammeln. Gelände, Wind und Durchmischung beeinflussen ihre Ausbreitung. Die Ockerfarbe zeigt den Vorgang schematisch.",o,new T.Vector3().fromBufferAttribute(o.geometry.attributes.position,row*21+10));
    }
  });
  return out;
}

/** Test the geometry at the pointer; the open half of the lake cut exposes the water face. */
export function pickNyos(world:World,ray:T.Raycaster):string|undefined{
  if(!world.nyos.group.visible||world.nyos.localWeight<.98)return;
  const eye=world.nyos.group.worldToLocal(world.nav.camera.position.clone());
  const hits=ray.intersectObject(world.nyos.group,true);
  for(const hit of hits){
    let visible=true;
    for(let p:T.Object3D|null=hit.object;p;p=p.parent)if(!p.visible){visible=false;break;}
    if(!visible)continue;
    const name=hit.object.name;
    if(name==="Nyos-Gasstrom")return "nyos-valley";
    if(eye.x<=.006)continue;
    if(name==="Nyos-Entgasungsrohr")return "nyos-pipe";
    if(name==="Nyos-Gasblasen")return "nyos-bubbles";
    if(name==="Geschichtetes Wasser auf der geöffneten Schnittfläche"){
      const point=hit.object.worldToLocal(hit.point.clone());
      if(point.y<-.035)return world.nyosLesson.dissolved&&point.y<-.12?"nyos-dissolved":"nyos-deep";
    }
  }
}
