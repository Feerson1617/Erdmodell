import * as T from "three";
import type { World } from "../world";
import { R } from "../geo";
import {center, type Step} from "../tectonics/atlas";
import {classify,localStrike,processNames,sites,type Site} from "./boundaries";
import {TimeGlobe,scenarios,type Scenario} from "./time";
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
  private timeline?:TimeGlobe;
  openTime(){
    this.base();this.mode="time";this.timeline=new TimeGlobe();this.mark();
    this.world.nav.fly({lat:12,lon:4,d:15700,tilt:0,bearing:0});this.draw();
  }
  private pickTime(x:number,y:number){
    const b=$("earth").getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((x-b.x)/b.width*2-1,1-(y-b.y)/b.height*2),this.world.nav.camera);
    const name=this.timeline?.pick(ray);if(name)$("g-evidence-name").textContent=name;
  }
  private closeTime(){this.timeline?.dispose();this.timeline=undefined;$("g-split-caption")?.remove();}
  private drawTime(){
    const t=this.timeline;if(!t)return;
    const labels={past:"Vergangenheit bis heute",ultima:"Pangaea Ultima",novo:"Novopangaea",aurica:"Aurica",amasia:"Amasia"};
    this.side.innerHTML='<p class="g-kicker">Plattentektonik</p><h1>Zeitreise</h1><div class="g-stack"><h2 id="g-age"></h2><small id="g-certainty"></small>'+
      '<label>Zeit wählen<input type="range" min="-250" max="'+(t.scenario==="past"?0:scenarios[t.scenario].end)+'" step=".1" id="g-year" value="'+t.year+'"></label>'+
      '<div class="g-buttons">'+button("g-reverse","Rückwärts")+button("g-time-play","Abspielen")+button("g-today","Heute")+'</div>'+
      '<label>Station<select id="g-station">'+opts({"-250":"Pangäa","-200":"Beginnende Aufspaltung","-150":"Weitere Trennung","-100":"Atlantik öffnet sich","-50":"Indien nähert sich Eurasien","0":"Gegenwart"},String(t.year))+'</select></label>'+
      '<label>Zeitmodell<select id="g-scenario">'+opts(labels,t.scenario)+'</select></label>'+
      (t.scenario!=="past"?'<label><input id="g-compare" type="checkbox" '+(t.compare?"checked":"")+'> Zwei Möglichkeiten vergleichen</label>':'')+
      '<label>Tempo<select id="g-speed">'+opts({"3":"Langsam","7":"Normal","14":"Schnell"},String(t.speed))+'</select></label>'+
      '<details id="g-evidence"><summary>Belege ansehen</summary><label>Hinweis im Globus<select id="g-evidence-kind">'+opts({"":"Ausblenden",margin:"Kontinentalränder",fossil:"Mesosaurus-Fundregionen",rock:"Alte Gebirgsgürtel",india:"Weg Indiens",australia:"Weg Australiens"},t.layer)+'</select></label><p id="g-evidence-name"></p><p id="g-evidence-info"></p>'+
      button("g-magnet","Magnetstreifen am Rücken")+button("g-motion","Heutige Bewegung")+button("g-real-events","Beobachtete Erdbeben")+'</details>'+
      item("Was zeigt das Modell?","Die hellen Flächen sind Kontinentalbereiche, auch unter flachem Meer. Die Linien zeigen rekonstruierte Plattengrenzen. Zwischen zwei berechneten Zeitpunkten werden beide Ansichten kurz überblendet.")+
      item("Wie sicher ist die Zukunft?","Die vier Modelle nehmen unterschiedliche künftige Plattengrenzen an. Sie zeigen Möglichkeiten. Wo Küsten, Gebirge und Städte liegen werden, lässt sich daraus nicht ablesen.")+
      button("g-to-atlas","Zum heutigen Plattenatlas")+button("g-world","Zum Globus")+'</div>';
    const age=$<HTMLInputElement>("g-year");age.oninput=()=>{t.playing=false;t.setYear(Number(age.value));};
    this.action("g-reverse",()=>{if(t.year<=-250)t.setYear(0);t.direction=-1;t.playing=true;});
    this.action("g-time-play",()=>{if(t.playing){t.playing=false;return;}t.direction=1;if(t.year===(t.scenario==="past"?0:scenarios[t.scenario].end))t.setYear(t.scenario==="past"?-250:0);t.playing=true;});
    this.action("g-today",()=>{t.playing=false;t.setYear(0);this.draw();});
    this.change("g-speed",v=>{t.speed=Number(v);});
    this.change("g-station",v=>{t.playing=false;t.setYear(Number(v));this.draw();});
    this.change("g-scenario",v=>{t.playing=false;t.scenario=v as Scenario;t.setYear(v==="past"?Math.min(0,t.year):Math.min(Math.max(5,t.year),scenarios[t.scenario].end));this.draw();});
    this.change("g-compare",()=>{if(t.year<=0)t.setYear(5);t.compare=!t.compare;this.draw();});
    const text:Record<string,string>={margin:"Die Ränder Südamerikas und Afrikas liegen in der Rekonstruktion näher beieinander. Auch überflutete Teile gehören zum Kontinent.",fossil:"Reste des Süßwasserreptils Mesosaurus finden sich im Paraná- und im Karoo-Becken. Die Punkte markieren Fundregionen. Die Tiere lebten vor der hier gezeigten Zeit.",rock:"In den Appalachen und im kaledonischen Gebirgsgürtel finden sich Spuren einer gemeinsamen alten Gebirgsbildung. Die Punkte markieren Untersuchungsregionen.",india:"Indien wandert im Modell nach Norden.",australia:"Australien trennt sich von der Antarktis."};
    this.change("g-evidence-kind",v=>{t.layer=v;if(t.year>0)t.setYear(0);$("g-evidence-info").textContent=text[v]||"";$("g-evidence-name").textContent="";});
    $("g-evidence-info").textContent=text[t.layer]||"";
    this.action("g-magnet",()=>void this.openRegion(reference("island","magnet")));this.action("g-real-events",()=>void this.openMap());
    this.action("g-motion",()=>this.navigateBase("plates"));this.action("g-to-atlas",()=>this.navigateBase("plates"));
    if(!$("g-split-caption")){const el=document.createElement("div");el.id="g-split-caption";$("earth").parentElement!.append(el);}
  }
  private frameTime(dt:number){
    const t=this.timeline;if(!t)return false;t.render(dt,this.world.gl,this.world.nav.camera);
    const year=Math.round(t.year);$("g-age").textContent=year<0?"Vor "+(-year)+" Mio. Jahren":year>0?"In "+year+" Mio. Jahren":"Heute";
    $("g-certainty").textContent=t.error||(year>0?"Mögliche Zukunft – keine sichere Vorhersage":year<0?"Wissenschaftliche Rekonstruktion":"Heutige Kontinentalflächen im Rekonstruktionsmodell");
    $("g-time-play").textContent=t.playing?"Pause":"Abspielen";$<HTMLInputElement>("g-year").value=String(t.year);
    const caption=$("g-split-caption");if(caption){caption.hidden=!t.compare;caption.textContent=t.compare?scenarios[t.scenario].label+"　 /　 "+scenarios[t.second].label:"";}
    return true;
  }
  private timeDiagnostics(){const t=this.timeline;return t?{year:t.year,scenario:t.scenario,compare:t.compare,timeReady:t.ready,timeError:t.error}:{};}
}
