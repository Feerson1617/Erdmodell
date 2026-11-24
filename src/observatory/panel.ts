import {tracks} from "./reconstruction";
import geographicExamples from "./geographic-examples.json";
import gnss from "./gnss.json";
import { depthSection } from "./depth-section";
import underwater from "./transform-sea.json";
import * as T from "three";
import { addTeachingModels,topicNames,explanations } from "./teaching-models";
import type { World } from "../world";
import { R } from "../geo";
import {center, names, type Step} from "../tectonics/atlas";
import {geology,classify,localStrike,processNames,sites,type Site} from "./boundaries";
import viewCentres from "./time-focus.json";
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
    let down=[0,0];const canvas=$("earth");
    canvas.addEventListener("pointerdown",e=>{down=[e.clientX,e.clientY];});
    canvas.addEventListener("pointerup",e=>{if(this.mode==="regional"&&Math.hypot(e.clientX-down[0],e.clientY-down[1])<5)this.pickRegion(e.clientX,e.clientY);});
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
    this.world.nav.fly({lat:purpose==="events"?12:15,lon:purpose==="events"?-146:-20,d:15300,tilt:0,bearing:0},true);
    this.world.nav.minimumDistance=150;this.maps.group.visible=true;this.maps.events.visible=purpose==="events";this.maps.boundaries.visible=true;
    this.maps.event=undefined;this.maps.selectedStep=undefined;this.draw();
    const rev=this.revision;
    try{await this.maps.init();if(rev===this.revision)this.draw();}catch{if(rev===this.revision){this.message="Kartendaten konnten nicht geöffnet werden.";this.draw();}}
  }
  async openRegion(spec:RegionSpec){
    this.base();this.mode="regional";this.theme=spec.theme;this.mark();
    this.world.nav.minimumDistance=.06;this.world.nav.fly({lat:spec.lat,lon:spec.lon,d:Math.max(3600,(spec.site?sites[spec.site].width:110)*3.2),tilt:12,bearing:0},true,1150);
    const reg=new RegionalScene(spec,$("earth") as HTMLCanvasElement);this.region=reg;reg.orbit.enabled=false;
    this.enrich(reg);const rev=this.revision;this.draw();
    try{await reg.init();if(rev===this.revision)this.draw();}
    catch{if(rev===this.revision){reg.error="Das lokale Gelände konnte nicht geladen werden.";this.draw();}}
  }
  private horizontalSeabed():RegionSpec{
    const g=geology(underwater as Step);
    return {lat:g.lat,lon:g.lon,name:"Untermeerische Transformstörung",process:g.model,geology:g,strike:g.strike,theme:"earthquake"};
  }
  openConcept(theme:"forces"|"lithosphere"){
    void this.openRegion({name:topicNames[theme],lat:0,lon:-24,strike:0,process:theme==="forces"?"subduction":"convergence",theme});
  }
  openBoundary(step:Step,theme:Theme="earthquake"){
    const g=geology(step),details=g.regionalDEM?reference(g.regionalDEM,theme):undefined;
    const spec:RegionSpec=details??{lat:g.lat,lon:g.lon,name:(geographicExamples as Record<string,string>)[g.id]??(names[g.left]+" · "+names[g.right]),strike:g.strike,process:g.model,theme};
    spec.geology=g;spec.azimuth=g.relativeAzimuth;void this.openRegion(spec);
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
  private examplesCache:Record<string,string>={};
  private examples(){
    if(Object.keys(this.examplesCache).length)return this.examplesCache;
    const distances:Record<string,[number,number]>={ridge:[-28,-13],transform:[36,-120],oceanTransform:[-55,0],subduction:[38,143],arc:[19,145],collision:[28,85],rift:[-3,36],convergence:[-2,137],complex:[34,70]};
    const result:Record<string,string>={};
    for(const [kind,[lat,lon]] of Object.entries(distances)){
      let d=Infinity,nearest:Step|undefined;
      for(const s of this.maps.steps){if(classify(s)!==kind)continue;const c=center(s),dl=(c.lon-lon+540)%360-180,dd=(c.lat-lat)**2+(dl*Math.cos(lat*Math.PI/180))**2;if(dd<d){d=dd;nearest=s;}}
      if(nearest)result[nearest[0]]=processNames[kind as keyof typeof processNames];
    }
    for(const [label,test] of [
      ["Grenze an der Datumsgrenze",(s:Step)=>Math.abs(s[3]-s[5])>300],
      ["Kleine Manusplatte",(s:Step)=>s[1].includes("MN")],
      ["Schräger Grenzverlauf",(s:Step)=>s[2]==="SUB"&&Math.abs(Math.cos((localStrike(s)-s[8])*Math.PI/180))>.52]
    ] as const){
      const s=this.maps.steps.filter(s=>test(s)&&!result[s[0]]).sort((a,b)=>Math.hypot(b[6]-b[4],((b[5]-b[3]+540)%360)-180)-Math.hypot(a[6]-a[4],((a[5]-a[3]+540)%360)-180))[0];
      if(s)result[s[0]]=label;
    }
    this.examplesCache=result;return result;
  }
  coverage(){
    return this.maps.steps.map(geology);
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
        (ev?'<h2>Beobachtetes Erdbeben</h2><p>'+ev[1]+' · Magnitude '+ev[5]+' ('+ev[6]+') · '+Math.round(ev[4])+' km tief</p>':'')+
        (s?'<h2>'+m.pair+'</h2><p>'+explain[classify(s)]+'</p><small>Dieses Modell erklärt einen möglichen Vorgang an dieser Plattengrenze.</small>'+button("g-segment","Prozess ansehen")+button("g-quake-explain",["subduction","arc","oceanTransform"].includes(classify(s))?"Seebeben erklären":"Erdbeben erklären")+(["ridge","subduction","arc"].includes(classify(s))?button("g-segment-volcano","Vulkanismus ansehen"):''):'')+
        (this.mapPurpose==="boundaries"?'<label>Grenzbeispiele<select id="g-example"><option value="">Ort auf dem Globus finden …</option>'+opts(this.examples(),"")+'<optgroup label="Weitere Regionen">'+opts(Object.fromEntries(Object.entries(geographicExamples).filter(([id])=>!this.examplesCache[id])),"")+'</optgroup></select></label>':'')+
        '<label>Referenzregion<select id="g-launch"><option value="">Region wählen …</option>'+opts(Object.fromEntries(Object.entries(sites).filter(([k])=>k!=="hawaii").map(([k,v])=>[k,v.name])),"")+'</select></label>'+
        item("Woher wissen wir das?","Seismometer zeichnen Erschütterungen auf. Aus vielen Aufzeichnungen bestimmen Forschende Ort und Tiefe. Ein Kartenpunkt allein verrät die Bruchrichtung nicht.")+back+'</div>';
      this.change("g-quakes",()=>{m.events.visible=!m.events.visible;m.event=undefined;this.draw();});this.change("g-lines",()=>{m.boundaries.visible=!m.boundaries.visible;m.selectedStep=undefined;this.draw();});
      this.change("g-depth",()=>{m.depth=!m.depth;m.recolor();this.draw();});this.change("g-launch",v=>{if(v)void this.openRegion(reference(v as Site,"earthquake"));});
      this.change("g-example",id=>{const st=m.steps[Number(id)-1];if(!st)return;this.maps.selectedStep=undefined;
        this.world.nav.fly({...center(st),d:4100,tilt:0,bearing:0},true);this.draw();});
      if(s){this.action("g-quake-explain",()=>this.openBoundary(s));this.action("g-segment",()=>this.openBoundary(s,"process"));this.action("g-segment-volcano",()=>this.openBoundary(s,"volcano"));}
    }else if(this.mode==="regional"&&this.region){
      const r=this.region,sp=r.spec;
      this.side.innerHTML='<p class="g-kicker">'+(sp.site?topicNames[sp.theme]:sp.theme==='forces'||sp.theme==='lithosphere'?'Schematisch vergrößerter Schnitt':'Vereinfachtes Modell dieser Grenzart')+'</p><h1>'+sp.name+'</h1><div class="g-stack">'+(sp.site?selectRegions(sp.theme,sp.site):'')+
        (sp.geology?'<small>'+names[sp.geology.left]+' · '+names[sp.geology.right]+' · '+processNames[sp.geology.model]+'</small>':'')+'<small>'+(sp.site?'Höhen aus Geodaten · Untergrund schematisch':(sp.coastLesson?'Schematischer Küstenraum · keine Gefahrenkarte':sp.theme==='forces'||sp.theme==='lithosphere'?'Schematische Größen und Tiefen':'Lage und Grenzrichtung aus PB2002 · Untergrund schematisch'))+'</small>'+
        (!r.ready?'<p role="status">'+(r.error||'Gelände wird geladen …')+'</p>':
        button("g-cut",r.cut?"An die Oberfläche":"Untergrund öffnen")+'<label>Ansicht<select id="g-view">'+opts({land:"Geländeübersicht",cut:"Geologischer Schnitt",...(["earthquake","process"].includes(sp.theme)?{fault:"Störungsdetail"}:{}),...(sp.theme==="earthquake"?{focus:"Erdbebenherd",waves:"Wellenausbreitung"}:{}),...(sp.theme==="volcano"?{vent:"Vulkan und Ausbruch"}:{}),...(r.water?{water:"Wasseroberfläche",coast:"Küste"}:{})},r.cut?"cut":"land")+'</select></label>'+
        (sp.theme==='lithosphere'?'':'<label class="g-range"><span id="g-phase"></span><input id="g-progress" type="range" min="0" max="1" step=".001" value="'+r.progress+'"></label>'+
        '<div class="g-buttons">'+button("g-play","Abspielen")+button("g-step","Einzelschritt")+button("g-reset","Zurücksetzen")+'</div>')+
        '<label><input type="checkbox" id="g-names" '+(r.names?"checked":"")+'> Namen zeigen</label>'+
        (sp.theme==="earthquake"&&(sp.comparison||r.faultModel.waterEvent||sp.process==="oceanTransform"&&sp.geology?.elevation!<0)?'<label>Zwei Modellereignisse vergleichen<select id="g-sea">'+opts({vertical:"B · Überschiebung in Japan",flat:"A · Untermeerischer Seitenversatz"},r.vertical?"vertical":"flat")+'</select></label>':'')+
        this.extraControls(r)+(sp.site==="japan"&&!sp.arcTransect?depthSection():"")+'<div id="g-object" aria-live="polite"></div>'+
        '<details><summary>Modell steuern</summary><label><input type="checkbox" id="g-phases" '+(r.phasesShown?"checked":"")+'> Phasen benennen</label><label><input type="checkbox" id="g-slow" '+(r.slow?"checked":"")+'> Zeitlupe</label><label><input type="checkbox" id="g-stress" '+(r.stress?"checked":"")+'> Spannung im Modell</label></details>'+
        item("Was geschieht hier?",explain[sp.process])+
        (sp.geology?item("Was ist an diesem Ort belegt?",this.regionText(sp.geology)):"")+this.extraInfo(r))+
        button("g-map","Zur Weltkarte")+back+'</div>';
      this.change("g-site",v=>{if(v)void this.openRegion(reference(v as Site,sp.theme));});
      this.action("g-cut",()=>{r.reframe(!r.cut);this.draw();});this.action("g-play",()=>{if(r.progress>=1)r.progress=0;r.playing=!r.playing;});
      this.action("g-step",()=>r.step());this.action("g-reset",()=>{r.progress=0;r.playing=false;});
      if($("g-progress"))$<HTMLInputElement>("g-progress").oninput=e=>{r.playing=false;r.progress=Number((e.target as HTMLInputElement).value);};
      this.change("g-sea",v=>{
        const openCut=r.cut;
        const next=v==="vertical"?reference("japan","earthquake"):this.horizontalSeabed();
        next.comparison=sp.comparison??{...sp,comparison:undefined};
        void this.openRegion(next).then(()=>{if(this.region?.spec===next && openCut){this.region.reframe(true);this.draw();}});
      });this.change("g-names",()=>{r.names=!r.names;});
      this.change("g-phases",()=>{r.phasesShown=!r.phasesShown;});this.change("g-slow",()=>{r.slow=!r.slow;});this.change("g-stress",()=>{r.stress=!r.stress;});this.action("g-map",()=>void this.openMap());this.bindExtra(r);
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
    if(play){play.textContent=r.playing?"Pause":"Abspielen";$("g-phase").textContent=r.phasesShown?phase:"Modellzeit";if(document.activeElement!==$("g-progress"))$<HTMLInputElement>("g-progress").value=String(r.progress);}
    this.updateLabels(r);return true;
  }
  private regionText(g:ReturnType<typeof geology>){
    const card=(a:number)=>["Norden","Nordosten","Osten","Südosten","Süden","Südwesten","Westen","Nordwesten"][Math.round(a/45)%8];
    if(g.descending&&g.overriding&&g.dipAzimuth!=null)return names[g.descending]+" taucht unter die Platte „"+names[g.overriding]+"“. Der Kontakt fällt nach "+card(g.dipAzimuth)+". Die Bruchfläche des Modellbebens ist vereinfacht.";
    return "Im globalen Höhenraster liegt der Abschnitt "+(g.elevation<0?"unter Wasser.":"an Land.")+" "+(g.coastalUncertainty?"Der genaue Küstenverlauf bleibt offen.":"")+" "+names[g.left]+" bewegt sich gegenüber der Platte „"+names[g.right]+"“ nach "+card(g.relativeAzimuth)+".";
  }
  private phaseText(r:RegionalScene){
    const byTheme:Partial<Record<Theme,string[]>>={process:["Ausgangszustand","Langsame Plattenbewegung","Gestein verformt sich","Grenzbereich verändert sich","Zustände vergleichen"],volcano:["Ausgangszustand","Material steigt auf","Gestein schmilzt teilweise","Magma steigt auf","Vulkanbildung"],magnet:["Rücken","Neuer Boden entsteht","Gestein kühlt ab","Magnetfeld wird aufgezeichnet","Älterer Boden wandert nach außen"],forces:["Wärme im Inneren","Mantelgestein bewegt sich","Dichte Lithosphäre sinkt","Zug an der Platte","Kräfte wirken zusammen"],risk:["Gleiches Modellbeben","Spannung steigt","Bruch am Herd","Erschütterung am Standort","Folgen vergleichen"]};
    if(byTheme[r.spec.theme])return byTheme[r.spec.theme]![Math.min(4,Math.floor(r.progress*5))];return r.progress<.05?"Ausgangszustand":r.progress<.35?"Spannung baut sich auf":r.progress<.47?"Bruch und Versatz":r.progress<.85?"Wellen breiten sich aus":"Nach dem Ereignis";}
  private updateLabels(r:RegionalScene){
    if(!r.names){if(this.labels.childElementCount)this.labels.replaceChildren();return;}
    const positions:{name:string;p:T.Vector3}[]=[];
    if(r.cut&&r.spec.theme==="earthquake"){
      for(const [name,coords] of [["Erdbebenherd",r.focus],["Epizentrum",r.epicenter]] as const)positions.push({name,p:new T.Vector3(coords[0],coords[1],.085)});
    }else{
      const ids:Partial<Record<Theme,string[]>>={forces:["Wärme aus dem Erdinneren","Kraft am Rücken","Zug der absinkenden Platte"],lithosphere:["Erdkruste","Starrer oberster Mantel","Langsam verformbarer Mantel"],volcano:["Magmareservoir","Lava und Eruption"],risk:["Gebäude","Evakuierungsweg"],magnet:["Magnetstreifen"]};
      for(const name of ids[r.spec.theme]??[]){
        let match:T.Object3D|undefined;r.scene.traverseVisible(o=>{if(!match&&o.userData.explanation?.name===name)match=o;});
        if(!match)continue;const box=new T.Box3().setFromObject(match),v=box.getCenter(new T.Vector3());if(!box.isEmpty())positions.push({name,p:v});
      }
    }
    const b=$("earth").getBoundingClientRect(),key=positions.map(v=>v.name).join("|");
    if(this.labels.dataset.key!==key||this.labels.childElementCount!==positions.length){this.labels.dataset.key=key;this.labels.replaceChildren();for(const a of positions){const el=document.createElement("span");el.textContent=a.name;this.labels.append(el);}}
    positions.forEach(({p},i)=>{const v=p.project(r.camera),el=this.labels.children[i] as HTMLElement;el.style.left=((1+v.x)*b.width/2)+"px";el.style.top=((1-v.y)*b.height/2)+"px";});
  }
  diagnostics(){const r=this.region;return {mode:this.mode,site:r?.spec.site,geology:r?.spec.geology,physics:r?.ready?r.physicalState():undefined,process:r?.spec.process,theme:this.theme,ready:r?.ready??(this.maps.steps.length>0),progress:r?.progress,cut:r?.cut,viewSettled:r?.viewSettled,focus:r?.focus,epicenter:r?.epicenter,events:this.maps.rows.length,steps:this.maps.steps.length,selected:this.maps.selectedStep?.[0],...this.timeDiagnostics()};}
  private enrich(r:RegionalScene){addTeachingModels(r);}
  private extraControls(r:RegionalScene){
    if(r.spec.theme==="volcano")return '<label>Modellausbruch<select id="g-eruption">'+opts({effusive:"Lava fließt aus",explosive:"Asche und Gase steigen auf"},r.eruption)+'</select></label>';
    if(r.spec.theme==="risk")return '<label>Ereignis<select id="g-risk-kind">'+opts({land:"Beben an Land",coast:"Tsunamivorsorge an der Küste"},r.spec.coastLesson?"coast":"land")+'</select></label><label>Untergrund<select id="g-soil">'+opts({rock:"Fester Fels",loose:"Lockere Ablagerungen"},r.soil)+'</select></label><label>Raumnutzung<select id="g-exposure">'+opts({empty:"Unbesiedelt",sparse:"Einzelne Häuser",dense:"Dichte Siedlung"},r.exposure)+'</select></label><label><input type="checkbox" id="g-protect" '+(r.protection?"checked":"")+'> Bauweise verstärken</label><details><summary>Weitere Schutzmaßnahmen</summary><label><input type="checkbox" id="g-route" '+(r.safeRoute?"checked":"")+'> Fluchtweg markieren</label><label><input type="checkbox" id="g-warning" '+(r.warning?"checked":"")+'> Warnung und Evakuierung üben</label><label><input type="checkbox" id="g-relocate" '+(r.relocate?"checked":"")+'> Siedlung auf höheres Gelände verlagern</label></details>';
    if(r.spec.theme==="process")return button("g-quake-from-process","Erdbeben erklären");
    if(r.spec.theme==="earthquake")return '<details id="g-analysis"><summary>Vorgang untersuchen</summary><label>Zustand<select id="g-stage">'+opts({"0":"Ausgangszustand",".30":"Spannung aufbauen",".42":"Erdbeben auslösen",".53":"Wellen untersuchen","1":"Nach dem Beben"},"")+'</select></label><label><input id="g-p" type="checkbox" '+(r.showP?"checked":"")+'> P-Welle · Gold</label><label><input id="g-s" type="checkbox" '+(r.showS?"checked":"")+'> S-Welle · Türkis</label><label><input id="g-detail" type="checkbox" '+(r.detail?"checked":"")+'> Gesteinspunkte vergrößern</label></details>'+button("g-risk","Folgen am Standort vergleichen");
    return "";
  }
  private extraInfo(r:RegionalScene){
    if(r.spec.theme==="lithosphere")return item("Was gehört zusammen?","Die Kruste und der starre oberste Mantel bilden die Lithosphäre. Der Mantel darunter ist überwiegend fest und über lange Zeit verformbar.");
    if(r.spec.theme==="forces")return item("Warum bewegen sich Platten?","Heißes Gestein kann sich über lange Zeit bewegen. Kalte Plattenteile können absinken und ziehen. Vom erhöhten Rücken wirkt auch die Schwerkraft. Die Kräfte sind örtlich unterschiedlich stark.");
    if(r.spec.theme==="magnet")return item("Woher wissen wir das?",explanations.stripe.answer);
    if(r.spec.theme==="volcano")return (r.spec.arcTransect?item("Wo liegt dieser Vulkan?","Zaozan liegt auf der japanischen Hauptinsel. Der Schnitt verläuft von dort zum Japangraben. Der Magmaweg und der Ausbruch sind schematisch."):"")+item("Wie entsteht Schmelze?",r.spec.process==="subduction"?explanations.fluid.answer:"Heißes Mantelgestein steigt auf. Der Druck sinkt und ein Teil des Gesteins schmilzt.")+item("Was ist Magma?",explanations.melt.answer)+item("Was tritt aus?",explanations.lava.answer)+item("Warum verlaufen Ausbrüche verschieden?","Dünnflüssige Schmelze lässt Gas oft leichter entweichen. In zäher Schmelze kann sich Gas stauen. Auch die Gasmenge spielt eine Rolle.")+(r.spec.site==="island"?item("Was ist auf Island besonders?","Island liegt auf einem Rücken. Zusätzlich steigt hier besonders heißes Mantelmaterial unter der Platte auf."):"");
    if(r.spec.theme==="risk")return item("Verwundbarkeit und Resilienz","Anfällige Gebäude können stärker beschädigt werden. Wer Wege und Hilfe vorbereitet, kann sich schneller erholen. Die grüne Versorgungsstelle zeigt die Wiederherstellung im Modell.")+item("Magnitude und Intensität","Die Magnitude beschreibt die Größe des Bebens an der Quelle. Die Intensität beschreibt, wie stark die Erschütterung an einem Ort erlebt wird. Bei gleichem Beben kann lockerer Boden die Schwingung am selben Standort verstärken.")+item("Was bedeutet Momenten-Magnitude?","Forschende schätzen die Größe des Bebens aus der gebrochenen Fläche, dem Versatz und der Steifigkeit des Gesteins. Das Modell berechnet keinen Zahlenwert.")+item("Wie können wir vorsorgen?","Bauweise, erreichbare Fluchtwege und geübte Abläufe können die Folgen mindern. Warnungen müssen die Menschen auch erreichen.")+item("Was ist abzuwägen?","Umbau kostet Geld. Freie Fluchtwege benötigen Platz. Betroffene Menschen können mitentscheiden, wo gebaut und wie der Wiederaufbau vorbereitet wird.");
    return r.spec.theme==="earthquake"?item("Was sind P- und S-Wellen?","Goldene Punkte schwingen vor und zurück. Das zeigt die schnellere P-Welle. Türkise Punkte schwingen quer zur Laufrichtung. Diese S-Welle läuft nur durch festes Material.")+item("Was zeigen die zwei Orte?","Der Bruch beginnt im Erdbebenherd. Direkt darüber liegt an der Oberfläche das Epizentrum.")+item("Wann entsteht ein Tsunami?","Wenn sich ein großer Teil des Meeresbodens hebt oder senkt, bewegt er die Wassersäule. Lange Wasserwellen laufen zur Küste und können dort höher werden."):"";}
  private bindExtra(r:RegionalScene){
    this.change("g-eruption",v=>{r.eruption=v;});this.change("g-soil",v=>{r.soil=v;});
    this.change("g-risk-kind",v=>{const next:RegionSpec=v==="coast"?{name:"Küstenraum · Modell",lat:38,lon:142,strike:0,process:"subduction",theme:"risk",coastLesson:true}:reference("san","risk");void this.openRegion(next);});
    if($("g-relocate")&&!r.spec.coastLesson)$("g-relocate").closest("label")!.hidden=true;
    this.change("g-view",v=>r.cameraView(v));this.change("g-stage",v=>{r.playing=false;r.progress=Number(v);r.reframe(true);});
    this.change("g-p",()=>{r.showP=!r.showP;});this.change("g-s",()=>{r.showS=!r.showS;});
    this.change("g-detail",()=>{r.detail=!r.detail;if(r.detail){r.cameraView("waves");r.progress=.49;r.playing=false;}});

    this.change("g-route",()=>{r.safeRoute=!r.safeRoute;});this.change("g-warning",()=>{r.warning=!r.warning;});this.change("g-relocate",()=>{r.relocate=!r.relocate;});
    this.change("g-exposure",v=>{r.exposure=v;});this.change("g-protect",()=>{r.protection=!r.protection;});
    this.action("g-quake-from-process",()=>void this.openRegion({...r.spec,theme:"earthquake"}));
    this.action("g-risk",()=>void this.openRegion({...r.spec,theme:"risk"}));
  }
  private pickRegion(x:number,y:number){
    const r=this.region;if(!r?.ready||document.body.classList.contains("observing"))return;
    const rect=$("earth").getBoundingClientRect(),ray=new T.Raycaster();ray.params.Line.threshold=.09;
    ray.setFromCamera(new T.Vector2(2*(x-rect.x)/rect.width-1,1-2*(y-rect.y)/rect.height),r.camera);
    const hit=ray.intersectObjects(r.scene.children,true).find(h=>{
      if(!r.isGeologyVisible(h))return false;
      if(h.object.name==="Gelände"&&r.cut&&h.point.z>0)return false;
      const mat=(h.object as T.Mesh).material as T.Material|undefined;
      if(mat?.transparent && !h.object.userData.explanation)return false;
      let o:T.Object3D|null=h.object;while(o){if(!o.visible)return false;o=o.parent;}return true;});
    const info=hit?.object.userData.explanation;
    if(info&&$("g-object"))$("g-object").textContent=(r.names?info.name+" · ":"")+info.answer;
  }
  private timeline?:TimeGlobe;
  openTime(){
    this.base();this.mode="time";this.timeline=new TimeGlobe();this.mark();
    this.focusTime();this.draw();
  }
  private pickTime(x:number,y:number){
    const b=$("earth").getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((x-b.x)/b.width*2-1,1-(y-b.y)/b.height*2),this.world.nav.camera);
    const name=this.timeline?.pick(ray);if(name)$("g-evidence-name").textContent=name;
  }
  private focusTime(){
    const t=this.timeline;if(!t)return;
    const [lat,lon]=viewCentres[t.model][Math.round(Math.abs(t.year)/5)];
    // Look across the assembly so both the continental margins and the ocean are visible.
    this.world.nav.fly({lat:lat*.6+12,lon:lon+32,d:17900,tilt:0,bearing:0},true);
  }
  private closeTime(){this.timeline?.dispose();this.timeline=undefined;$("g-split-caption")?.remove();}
  private drawTime(){
    const t=this.timeline;if(!t)return;
    const assumptions:Record<Scenario,string>={past:"",ultima:"Der Atlantik schließt sich wieder.",novo:"Der Pazifik schließt sich. Der Atlantik bleibt offen.",aurica:"Atlantik und Pazifik schließen sich. Ein neuer Ozean öffnet sich.",amasia:"Kontinentalbereiche sammeln sich im Norden."};
    const labels={past:"Vergangenheit bis heute",ultima:"Pangaea Ultima",novo:"Novopangaea",aurica:"Aurica",amasia:"Amasia"};
    this.side.innerHTML='<p class="g-kicker">Plattentektonik</p><h1>Zeitreise</h1><div class="g-stack"><h2 id="g-age"></h2><small id="g-certainty"></small>'+
      '<label>Zeit wählen<input type="range" min="-250" max="'+(t.scenario==="past"?0:scenarios[t.scenario].end)+'" step=".1" id="g-year" value="'+t.year+'"></label>'+
      '<div class="g-buttons">'+button("g-reverse","Rückwärts")+button("g-time-play","Abspielen")+button("g-today","Heute")+button("g-time-focus","Flächen zentrieren")+'</div>'+
      '<label>Station<select id="g-station">'+opts({"-250":"Pangäa","-200":"Beginnende Aufspaltung","-150":"Weitere Trennung","-100":"Atlantik öffnet sich","-50":"Indien nähert sich Eurasien","0":"Gegenwart"},String(t.year))+'</select></label>'+
      '<label>Zeitmodell<select id="g-scenario">'+opts(labels,t.scenario)+'</select></label>'+
      (t.scenario==="past"?'<details id="g-tracking"><summary>Kontinent verfolgen</summary><label>Kontinentalbereich<select id="g-track">'+opts({"":"Ausblenden",...Object.fromEntries(Object.entries(tracks).map(([k,v])=>[k,v[0]]))},t.tracking)+'</select></label><label><input id="g-trail" type="checkbox" '+(t.trail?"checked":"")+'> Bewegungsspur</label><label><input id="g-follow" type="checkbox" '+(t.follow?"checked":"")+'> Kamera folgt</label></details>':
      '<label><input id="g-compare" type="checkbox" '+(t.compare?"checked":"")+'> Zwei Möglichkeiten vergleichen</label>'+
      (t.compare?'<label>Zweites Modell<select id="g-second">'+opts(Object.fromEntries(Object.entries(labels).filter(([k])=>k!=="past"&&k!==t.scenario)),t.second)+'</select></label><small>Gemeinsamer Zeitraum bis +'+Math.min(scenarios[t.scenario].end,scenarios[t.second].end)+' Mio. Jahre. '+assumptions[t.second]+'</small>':'')+
      '<label><input type="checkbox" id="g-future-lines" '+(t.showBoundaries?"checked":"")+'> Modellgrenzen zeigen</label><small>'+assumptions[t.scenario]+'</small>')+
      '<label>Tempo<select id="g-speed">'+opts({"3":"Langsam","7":"Normal","14":"Schnell"},String(t.speed))+'</select></label>'+
      '<details id="g-evidence"><summary>Belege ansehen</summary><label>Hinweis im Globus<select id="g-evidence-kind">'+opts({"":"Ausblenden",margin:"Kontinentalränder",fossil:"Mesosaurus-Fundregionen",rock:"Alte Gebirgsgürtel",india:"Weg Indiens",australia:"Weg Australiens"},t.layer)+'</select></label><p id="g-evidence-name"></p><p id="g-evidence-info"></p>'+
      button("g-magnet","Magnetstreifen am Rücken")+button("g-motion","Heutige Bewegung")+button("g-real-events","Beobachtete Erdbeben")+'</details>'+
      '<details id="g-gnss"><summary>Heute mit Satelliten messen</summary><label>Messstation<select id="g-station-gnss">'+opts(Object.fromEntries(gnss.map(s=>[s.id,s.id])),gnss[0].id)+'</select></label><p id="g-gnss-text"></p><small>GNSS · Nevada Geodetic Laboratory · Bezugsrahmen IGS14</small></details>'+
      item("Was zeigt das Modell?","Die hellen Flächen sind Kontinentalbereiche, auch unter flachem Meer. In der Vergangenheit zeigen Linien rekonstruierte Plattengrenzen. Die starren Blöcke drehen sich. Grenzen und verformte Zonen stammen aus Zeitschnitten im Abstand von fünf Millionen Jahren. In der Zukunft unterscheiden die Farbtöne bewegliche Kontinentalblöcke.")+
      item("Wie sicher ist die Zukunft?","Die vier Modelle nehmen unterschiedliche künftige Plattengrenzen an. Sie zeigen Möglichkeiten. Wo Küsten, Gebirge und Städte liegen werden, lässt sich daraus nicht ablesen.")+
      button("g-to-atlas","Zum heutigen Plattenatlas")+button("g-world","Zum Globus")+'</div>';
    this.change("g-track",v=>{t.tracking=v;const point=t.reconstruction.at(Math.abs(t.year),v);if(point)this.world.nav.fly({...point,d:16800,tilt:0,bearing:0},true);});
    this.change("g-trail",()=>{t.trail=!t.trail;});this.change("g-follow",()=>{t.follow=!t.follow;});
    this.change("g-second",v=>{t.comparison=v as Scenario;t.setYear(t.year);this.draw();});
    this.change("g-future-lines",()=>{t.showBoundaries=!t.showBoundaries;});
    const gnssInfo=(id:string)=>{const station=gnss.find(s=>s.id===id)!;
      const az=(Math.atan2(station.east,station.north)*180/Math.PI+360)%360;
      const label=["Norden","Nordosten","Osten","Südosten","Süden","Südwesten","Westen","Nordwesten"][Math.round(az/45)%8];
      $("g-gnss-text").textContent="Die Station bewegt sich im globalen Bezugsrahmen nach "+label+".";
      return station;};
    gnssInfo(gnss[0].id);this.change("g-station-gnss",id=>{const station=gnssInfo(id);t.playing=false;t.setYear(0);t.layer="";t.tracking="";this.world.nav.fly({lat:station.lat,lon:station.lon,d:14400,tilt:0,bearing:0});t.gnss=station.id;});
    $("g-gnss").ontoggle=()=>{if(($("g-gnss") as HTMLDetailsElement).open)$<HTMLSelectElement>("g-station-gnss").dispatchEvent(new Event("change"));else t.gnss="";};
    const age=$<HTMLInputElement>("g-year");age.oninput=()=>{t.playing=false;t.setYear(Number(age.value));};
    this.action("g-reverse",()=>{if(t.year<=-250)t.setYear(0);t.direction=-1;t.playing=true;});
    this.action("g-time-play",()=>{if(t.playing){t.playing=false;return;}t.direction=1;if(t.year===(t.scenario==="past"?0:scenarios[t.scenario].end))t.setYear(t.scenario==="past"?-250:0);t.playing=true;});
    this.action("g-time-focus",()=>this.focusTime());
    this.action("g-today",()=>{t.playing=false;t.setYear(0);this.draw();});
    this.change("g-speed",v=>{t.speed=Number(v);});
    this.change("g-station",v=>{t.playing=false;t.setYear(Number(v));this.focusTime();this.draw();});
    this.change("g-scenario",v=>{t.playing=false;t.scenario=v as Scenario;t.setYear(v==="past"?Math.min(0,t.year):Math.min(Math.max(5,t.year),scenarios[t.scenario].end));this.focusTime();this.draw();});
    this.change("g-compare",()=>{if(t.year<=0)t.setYear(5);t.compare=!t.compare;this.draw();});
    const text:Record<string,string>={margin:"Die Ränder Südamerikas und Afrikas liegen in der Rekonstruktion näher beieinander. Auch überflutete Teile gehören zum Kontinent.",fossil:"Reste des Süßwasserreptils Mesosaurus finden sich im Paraná- und im Karoo-Becken. Die Punkte markieren Fundregionen. Die Tiere lebten vor der hier gezeigten Zeit.",rock:"In den Appalachen und im kaledonischen Gebirgsgürtel finden sich Spuren einer gemeinsamen alten Gebirgsbildung. Die Punkte markieren Untersuchungsregionen.",india:"Indien wandert im Modell nach Norden.",australia:"Australien trennt sich von der Antarktis."};
    this.change("g-evidence-kind",v=>{t.layer=v;if(t.year>0)t.setYear(0);const point=t.evidenceCentre();if(point)this.world.nav.fly({...point,d:16700,tilt:0,bearing:0},true);$("g-evidence-info").textContent=text[v]||"";$("g-evidence-name").textContent="";});
    $("g-evidence-info").textContent=text[t.layer]||"";
    this.action("g-magnet",()=>void this.openRegion(reference("island","magnet")));this.action("g-real-events",()=>void this.openMap());
    this.action("g-motion",()=>this.navigateBase("plates"));this.action("g-to-atlas",()=>this.navigateBase("plates"));
    if(!$("g-split-caption")){const el=document.createElement("div");el.id="g-split-caption";$("earth").parentElement!.append(el);}
  }
  private frameTime(dt:number){
    const t=this.timeline;if(!t)return false;const rendered=t.render(dt,this.world.gl,this.world.nav.camera);
    if(t.follow&&t.tracking&&t.year<=0&&!this.world.nav.flight){
      const v=t.reconstruction.at(Math.abs(t.year),t.tracking);if(v){this.world.nav.goal.lat=v.lat;this.world.nav.goal.lon=v.lon;}
    }
    const year=Math.round(t.year);$("g-age").textContent=year<0?"Vor "+(-year)+" Mio. Jahren":year>0?"In "+year+" Mio. Jahren":"Heute";
    $("g-certainty").textContent=t.error||(!rendered?"Rekonstruktion wird geladen …":year>0?"Mögliche Zukunft – keine sichere Vorhersage":year<0?"Wissenschaftliche Rekonstruktion":"Heutige Kontinentalflächen im Rekonstruktionsmodell");
    $("g-time-play").textContent=t.playing?"Pause":"Abspielen";$<HTMLInputElement>("g-year").value=String(t.year);
    const caption=$("g-split-caption");if(caption){caption.hidden=!t.compare;caption.textContent=t.compare?scenarios[t.scenario].label+"　 /　 "+scenarios[t.second].label:"";}
    return rendered;
  }
  private timeDiagnostics(){const t=this.timeline;return t?{year:t.year,scenario:t.scenario,compare:t.compare,timeReady:t.ready,timeError:t.error,rigid:t.reconstruction.ready,tracking:t.tracking,tracked:t.reconstruction.at(Math.abs(t.year),t.tracking)?.v.toArray(),second:t.second}:{};}
}
