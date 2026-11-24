import * as T from "three";
import type { World } from "../world";
import { R } from "../geo";
import {center, type Step} from "../tectonics/atlas";
import {classify,localStrike,processNames,sites,type Site} from "./boundaries";
import { MapLayers } from "./globe";
import { RegionalScene, reference, type RegionSpec, type Theme } from "./regional";
const $=<E extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as E;
function button(id:string,text:string){return '<button id="'+id+'">'+text+'</button>';}
function opts(values:Record<string,string>,sel:string){return Object.entries(values).map(([key,label])=>'<option value="'+key+'" '+(key===sel?'selected':'')+'>'+label+'</option>').join("");}
function item(question:string,answer:string){return '<details><summary>'+question+'</summary><p>'+answer+'</p></details>';}
const explain:Record<string,string>={
  transform:"Die Seiten gleiten aneinander vorbei. Wo die Störung festhält, verformt sich das Gestein. Beim Bruch bleibt ein seitlicher Versatz zurück.",
  oceanTransform:"Der Meeresboden verschiebt sich vor allem seitwärts. Hier wird im Modell wenig Wasser angehoben. Auch untermeerische Rutschungen können Wasser verdrängen.",
  subduction:"Eine ozeanische Platte taucht ab. An der Kontaktfläche kann Gestein festhängen und plötzlich brechen.",
  arc:"Eine ozeanische Platte taucht unter eine andere ab. Über ihr kann eine Kette von Vulkaninseln wachsen.",
  collision:"Zwei Kontinentalbereiche stoßen zusammen. Gestein wird zusammengeschoben, die Kruste dicker und ein Gebirge wächst.",
  convergence:"Zwei Platten nähern sich. Wie die Störungen hier in die Tiefe verlaufen, lässt sich aus der Grenzlinie allein nicht bestimmen.",
  complex:"Die Bewegung verteilt sich auf mehrere Störungen. Die genaue Bruchfläche ist hier offen.",
  ridge:"Die Seiten driften auseinander. Mantelgestein steigt auf und schmilzt bei sinkendem Druck teilweise. Neue ozeanische Kruste entsteht.",
  rift:"Die Kruste wird gedehnt. Entlang schräger Brüche sinkt ein Teil ab. So entsteht ein Graben.",
  hotspot:"Die Platte bewegt sich über einer länger beständigen Schmelzquelle. Nacheinander entstehen Vulkane."
};
export class Observatory {
  mode:""|"map"|"regional"|"time"="";readonly maps=new MapLayers();region?:RegionalScene;
  theme:Theme="earthquake";private revision=0;private message="";private lastUI="";private labels:HTMLElement;
  private mapPurpose:"events"|"boundaries"="events";
  constructor(private world:World,private side:HTMLElement,private navigateBase:(mode:"globe"|"plates")=>void){
    world.scene.add(this.maps.group);this.maps.group.visible=false;
    this.labels=document.createElement("div");this.labels.id="observatory-labels";$("earth").parentElement!.append(this.labels);
    world.customPick=(x,y)=>this.pick(x,y);
    world.customRender=(dt)=>this.frame(dt);
  }
  close(){
    this.revision++;this.region?.dispose();this.region=undefined;this.maps.group.visible=false;this.mode="";
    this.world.nav.enabled=true;this.world.nav.minimumDistance=.06;this.labels.replaceChildren();this.message="";this.lastUI="";
    this.closeTime();delete document.body.dataset.observatory;
    document.querySelectorAll(".obsNav").forEach(b=>b.removeAttribute("aria-current"));
  }
  private base(){this.close();this.world.globe(true);this.world.nav.minimumDistance=2300;}
  private mark(){
    document.body.dataset.observatory=this.mode;$("desk").dataset.mode="observatory";this.side.hidden=false;
    document.querySelectorAll("nav button").forEach(b=>b.removeAttribute("aria-current"));
    $(this.mode==="time"||this.mapPurpose==="boundaries"&&this.mode==="map"?"nav-plates":this.theme==="volcano"?"nav-volcano":this.theme==="risk"?"nav-risk":"nav-earthquake")?.setAttribute("aria-current","page");
    for(const id of ["modelnote","orbitProcess","nyosPin","nyosRelief"])$(id).hidden=true;
    $("pins").replaceChildren();$("platePins").replaceChildren();
  }
  async openMap(purpose:"events"|"boundaries"="events"){
    this.base();this.mode="map";this.mapPurpose=purpose;this.theme="earthquake";this.mark();
    this.maps.group.visible=true;this.maps.events.visible=purpose==="events";this.maps.boundaries.visible=true;
    this.maps.event=undefined;this.maps.selectedStep=undefined;this.draw();
    const rev=this.revision;
    try{await this.maps.init();if(rev===this.revision)this.draw();}catch{if(rev===this.revision){this.message="Kartendaten konnten nicht geöffnet werden.";this.draw();}}
  }
  async openRegion(spec:RegionSpec){
    this.base();this.mode="regional";this.theme=spec.theme;this.mark();
    this.world.nav.minimumDistance=.06;this.world.nav.fly({lat:spec.lat,lon:spec.lon,d:Math.max(140,(spec.site?sites[spec.site].width:110)*2.4),tilt:12,bearing:0},true,1150);
    const reg=new RegionalScene(spec,$("earth") as HTMLCanvasElement);this.region=reg;reg.orbit.enabled=false;
    this.enrich(reg);const rev=this.revision;this.draw();
    try{await reg.init();if(rev===this.revision)this.draw();}
    catch{if(rev===this.revision){reg.error="Das lokale Gelände konnte nicht geladen werden.";this.draw();}}
  }
  openBoundary(step:Step,theme:Theme="earthquake"){
    const {lat,lon}=center(step),process=classify(step);
    const spec:RegionSpec={lat,lon,name:processNames[process],strike:localStrike(step),process,theme};
    for(const key of Object.keys(sites) as Site[]){const s=sites[key];if(s.process===process && Math.hypot(lat-s.lat,(lon-s.lon)*Math.cos(lat*Math.PI/180))<.7){void this.openRegion(reference(key,theme));return;}}
    void this.openRegion(spec);
  }
  private pick(x:number,y:number){
    if(!this.mode)return false;
    if(this.mode==="regional"){this.pickRegion(x,y);return true;}
    if(this.mode==="time"){this.pickTime(x,y);return true;}
    const b=$("earth").getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((x-b.x)/b.width*2-1,1-(y-b.y)/b.height*2),this.world.nav.camera);
    const hit=ray.ray.intersectSphere(new T.Sphere(new T.Vector3(),R+35),new T.Vector3());if(hit){
      this.maps.pick(hit.normalize(),(this.world.nav.pose.d/R)*.018,this.mapPurpose==="events");this.draw();}
    return true;
  }
  private action(id:string,fn:()=>void){const b=$(id);if(b)b.onclick=fn;}
  private change(id:string,fn:(value:string)=>void){const b=$<HTMLSelectElement>(id);if(b)b.onchange=()=>fn(b.value);}
  draw(){
    if(!this.mode)return;this.mark();
    const back=button("g-world","Zum Globus"),selectRegions=(theme:Theme,id:string)=>'<label>Region<select id="g-site">'+opts(Object.fromEntries(Object.entries(sites).filter(([k])=>theme!=="volcano"||["island","japan","hawaii"].includes(k)).map(([k,s])=>[k,s.name])),id)+'</select></label>';
    if(this.mode==="map"){
      const m=this.maps,s=m.selectedStep,ev=m.event;
      this.side.innerHTML='<p class="g-kicker">Beobachtungen · heute</p><h1>'+(this.mapPurpose==="events"?"Erdbeben der Erde":"Plattengrenzen")+'</h1>'+
        '<div class="g-stack"><label><input id="g-quakes" type="checkbox" '+(m.events.visible?"checked":"")+'> Erdbeben zeigen</label><label><input id="g-lines" type="checkbox" '+(m.boundaries.visible?"checked":"")+'> Plattengrenzen zeigen</label>'+
        (m.events.visible?'<label><input id="g-depth" type="checkbox" '+(m.depth?"checked":"")+'> Tiefe unterscheiden</label><small>USGS · 2019–2023 · Magnitude ab 6</small>'+(m.depth?'<div class="g-legend"><span>Flach</span><span>Mitteltief</span><span>Tief</span></div>':''):'')+
        (ev?'<h2>Beobachtetes Erdbeben</h2><p>'+ev[1]+' · Magnitude '+ev[5]+' · '+Math.round(ev[4])+' km tief</p>':'')+
        (s?'<h2>'+m.pair+'</h2><p>'+explain[classify(s)]+'</p>'+button("g-segment","Prozess ansehen")+(["ridge","subduction","arc"].includes(classify(s))?button("g-segment-volcano","Vulkanismus ansehen"):''):'')+
        '<label>Referenzregion<select id="g-launch"><option value="">Region wählen …</option>'+opts(Object.fromEntries(Object.entries(sites).filter(([k])=>k!=="hawaii").map(([k,v])=>[k,v.name])),"")+'</select></label>'+
        item("Woher wissen wir das?","Seismometer zeichnen Erschütterungen auf. Aus vielen Aufzeichnungen bestimmen Forschende Ort und Tiefe. Ein Kartenpunkt allein verrät die Bruchrichtung nicht.")+back+'</div>';
      this.change("g-quakes",()=>{m.events.visible=!m.events.visible;m.event=undefined;this.draw();});this.change("g-lines",()=>{m.boundaries.visible=!m.boundaries.visible;m.selectedStep=undefined;this.draw();});
      this.change("g-depth",()=>{m.depth=!m.depth;m.recolor();this.draw();});this.change("g-launch",v=>{if(v)void this.openRegion(reference(v as Site,"earthquake"));});
      if(s){this.action("g-segment",()=>this.openBoundary(s));this.action("g-segment-volcano",()=>this.openBoundary(s,"volcano"));}
    }else if(this.mode==="regional"&&this.region){
      const r=this.region,sp=r.spec;
      this.side.innerHTML='<p class="g-kicker">'+(sp.site?'Regionales Gelände':'Vereinfachtes Modell dieser Grenzart')+'</p><h1>'+sp.name+'</h1><div class="g-stack">'+selectRegions(sp.theme,sp.site||"")+
        '<small>'+(sp.site?'Höhen aus Geodaten · Untergrund schematisch':'Lage und Grenzrichtung aus PB2002 · Untergrund schematisch')+'</small>'+
        (!r.ready?'<p role="status">'+(r.error||'Gelände wird geladen …')+'</p>':
        button("g-cut",r.cut?"An die Oberfläche":"Untergrund öffnen")+
        '<label class="g-range"><span id="g-phase"></span><input id="g-progress" type="range" min="0" max="1" step=".001" value="'+r.progress+'"></label>'+
        '<div class="g-buttons">'+button("g-play","Abspielen")+button("g-step","Einzelschritt")+button("g-reset","Zurücksetzen")+'</div>'+
        '<label><input type="checkbox" id="g-names" '+(r.names?"checked":"")+'> Namen zeigen</label>'+
        (sp.theme==="earthquake"&&(sp.process==="subduction"||sp.process==="oceanTransform"||sp.process==="arc")?'<label>Seebeben vergleichen<select id="g-sea">'+opts({vertical:"Meeresboden hebt sich",flat:"Seitlicher Versatz"},r.vertical?"vertical":"flat")+'</select></label>':'')+
        this.extraControls(r)+
        '<details><summary>Modell steuern</summary><label><input type="checkbox" id="g-slow" '+(r.slow?"checked":"")+'> Zeitlupe</label><label><input type="checkbox" id="g-stress" '+(r.stress?"checked":"")+'> Spannung im Modell</label></details>'+
        item("Was geschieht hier?",explain[sp.process])+this.extraInfo(r))+
        button("g-map","Zur Weltkarte")+back+'</div>';
      this.change("g-site",v=>{if(v)void this.openRegion(reference(v as Site,sp.theme));});
      this.action("g-cut",()=>{r.reframe(!r.cut);this.draw();});this.action("g-play",()=>{if(r.progress>=1)r.progress=0;r.playing=!r.playing;});
      this.action("g-step",()=>r.step());this.action("g-reset",()=>{r.progress=0;r.playing=false;});
      if($("g-progress"))$<HTMLInputElement>("g-progress").oninput=e=>{r.playing=false;r.progress=Number((e.target as HTMLInputElement).value);};
      this.change("g-sea",v=>{r.vertical=v==="vertical";r.progress=0;r.playing=false;});this.change("g-names",()=>{r.names=!r.names;});
      this.change("g-slow",()=>{r.slow=!r.slow;});this.change("g-stress",()=>{r.stress=!r.stress;});this.action("g-map",()=>void this.openMap());this.bindExtra(r);
    }else this.drawTime();
    this.action("g-world",()=>this.navigateBase("globe"));if(this.message){const p=document.createElement("p");p.textContent=this.message;this.side.append(p);}
  }
  private frame(dt:number){
    if(!this.mode)return false;
    if(this.mode==="time")return this.frameTime(dt);
    const r=this.region;if(!r||!r.ready||this.world.nav.flight)return false;
    r.orbit.enabled=true;this.world.nav.enabled=false;const canvas=this.world.gl.domElement;r.camera.aspect=canvas.clientWidth/canvas.clientHeight;r.camera.updateProjectionMatrix();
    r.update(dt);this.world.gl.render(r.scene,r.camera);
    const phase=this.phaseText(r),play=$("g-play");
    if(play){play.textContent=r.playing?"Pause":"Abspielen";$("g-phase").textContent=phase;if(document.activeElement!==$("g-progress"))$<HTMLInputElement>("g-progress").value=String(r.progress);}
    this.updateLabels(r);return true;
  }
  private phaseText(r:RegionalScene){return r.progress<.05?"Ausgangszustand":r.progress<.35?"Spannung baut sich auf":r.progress<.47?"Bruch und Versatz":r.progress<.85?"Wellen breiten sich aus":"Nach dem Ereignis";}
  private updateLabels(r:RegionalScene){
    const visible=r.names&&r.cut&&r.spec.theme==="earthquake";
    if(!visible){if(this.labels.childElementCount)this.labels.replaceChildren();return;}
    const b=$("earth").getBoundingClientRect();
    if(!this.labels.childElementCount){for(const name of ["Erdbebenherd","Epizentrum"]) {const el=document.createElement("span");el.textContent=name;this.labels.append(el);}}
    [r.focus,r.epicenter].forEach((a,i)=>{const v=new T.Vector3(a[0],a[1],.085).project(r.camera),el=this.labels.children[i] as HTMLElement;el.style.left=((1+v.x)*b.width/2)+"px";el.style.top=((1-v.y)*b.height/2)+"px";});
  }
  diagnostics(){const r=this.region;return {mode:this.mode,site:r?.spec.site,process:r?.spec.process,theme:this.theme,ready:r?.ready??(this.maps.steps.length>0),progress:r?.progress,cut:r?.cut,focus:r?.focus,epicenter:r?.epicenter,events:this.maps.rows.length,steps:this.maps.steps.length,selected:this.maps.selectedStep?.[0],...this.timeDiagnostics()};}
  private enrich(_r:RegionalScene){}
  private extraControls(_r:RegionalScene){return "";}
  private extraInfo(r:RegionalScene){return r.spec.theme==="earthquake"?item("Was sind P- und S-Wellen?","Goldene Punkte schwingen vor und zurück. Das zeigt die schnellere P-Welle. Türkise Punkte schwingen quer zur Laufrichtung. Diese S-Welle läuft nur durch festes Material.")+item("Was zeigen die zwei Orte?","Der Bruch beginnt im Erdbebenherd. Direkt darüber liegt an der Oberfläche das Epizentrum.")+item("Wann entsteht ein Tsunami?","Wenn sich ein großer Teil des Meeresbodens hebt oder senkt, bewegt er die Wassersäule. Lange Wasserwellen laufen zur Küste und können dort höher werden."):"";}
  private bindExtra(_r:RegionalScene){}
  private pickRegion(_x:number,_y:number){}
  private pickTime(_x:number,_y:number){}
  private closeTime(){}
  private drawTime(){}
  private frameTime(_dt:number){return false;}
  private timeDiagnostics(){return {};}
}
