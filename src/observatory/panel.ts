import { createSeismic, mountStudy } from "../seismology";
import { atlasViews, familyOf, regionViews, isView } from "../seismology/catalog";
import type { Stage, SeismicState } from "../seismology/stage";
import {TectonicStudio,type StudioState} from "./tectonic-studio";
import { ResearchAtlas, type ResearchState } from "./research-atlas";
import { PlateRates } from "./plate-rates";
import {meltingExplanation} from "./melting";
import {boundaryLesson} from "../tectonics/learning";
import {assumptions,learningFields,regionalReading,timeReading,setReading} from "./lesson";
import {project,AnnotationLayer} from "../annotations";
import {ObjectLabels} from "./object-labels";
import {beginCandidates,allowsLabel,claimObject} from "./reveal";
import {graphics,quality,materials} from "./graphics";
import {WaterProfile} from "./water-profile";
import {fields, regionKeys, timeKeys} from "./saved-state";
import {tracks} from "./reconstruction";
import geographicExamples from "./geographic-examples.json";
import gnss from "./gnss.json";
import { depthSection,openDepthSection } from "./depth-section";
import underwater from "./transform-sea.json";
import * as T from "three";
import { addTeachingModels,topicNames,explanations } from "./teaching-models";
import type { World } from "../world";
import { R,position } from "../geo";
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
  mode:""|"map"|"regional"|"time"|"studio"|"seismic"="";readonly maps=new MapLayers();region?:RegionalScene;
  theme:Theme="earthquake";private revision=0;private message="";private lastUI="";private labels:HTMLElement;private objectLabels:ObjectLabels;private timePins:AnnotationLayer;private timeKey="";private timeLayout=0;
  private readonly profile=new WaterProfile($("earth").parentElement!);
  private spare?:RegionalScene;private switching=false;private resumePlayback=false;private profileWanted=false;
  private mapPurpose:"events"|"boundaries"="events";
  private research?:ResearchAtlas;
  private studio?:TectonicStudio;
  openStudio(state?:Partial<StudioState>){
    this.base(true);this.mode="studio";this.world.nav.enabled=false;this.mark();
    this.studio=new TectonicStudio(this.world.gl,state,()=>void this.openResearch({flat:true,layers:["bounds","age"],magnitude:6,depth:750}),
      id=>this.visitPlace?.(id), model=>this.visitModel?.(model));
    this.draw();
  }
  study?:Stage;
  lessonView?:string;
  visitStudy?:(view:string)=>void;
  async openStudy(id:string,state?:SeismicState){
    if(!isView(id))return;
    if(atlasViews[id]){
      const next=this.revision+1;
      await this.openResearch({flat:id!=="trenches",layers:[...atlasViews[id].layers],magnitude:6,depth:750});
      if(this.revision!==next)return;
      if(id==="trenches")this.world.nav.fly({lat:35,lon:143,d:8500,tilt:0,bearing:0},true);
    }else if(regionViews[id]){
      const preset=regionViews[id],next=this.revision+1;
      await this.openRegion(reference(preset.site,id==="zao"||preset.eruption?"volcano":"earthquake"));
      if(this.revision!==next||!this.region?.ready)return;
      const r=this.region;if(preset.eruption)r.eruption=preset.eruption;r.ruptureAnalysis=!preset.eruption;r.progress=preset.progress;r.playing=false;r.stress=id==="strain"||id==="park";
      r.showP=r.showS=id==="parkWaves"||id==="park";r.detail=id==="parkWaves";
      r.cameraView(preset.camera);r.update(0);
    }else{
      this.base(true);this.mode="seismic";this.world.nav.enabled=false;this.mark();
      this.study=createSeismic(this.world.gl,id,state);
    }
    this.lessonView=id;this.draw();
  }
  visitPlace?: (id:string)=>void;
  visitModel?: (id:import("./tectonic-process").ProcessId)=>void;
  visitBoundary?: (step:Step)=>void;
  get studioState(){return this.studio?.state;}
  get atlasState(){return this.research?.state;}
  get timeState(){return this.timeline;}
  private readonly rates=new PlateRates();
  async openResearch(state?:ResearchState){
    const opened=this.openMap("boundaries"),revision=this.revision;
    await opened;
    if(this.revision!==revision||this.mode!=="map"||this.mapPurpose!=="boundaries"||!this.maps.steps.length)return;
    this.research?.dispose();
    const atlas=new ResearchAtlas(this.maps,$("earth").parentElement!,step=>this.rates.allowCurrent(step),p=>this.world.nav.fly({...this.world.nav.pose,...p},true),step=>this.visitBoundary?.(step),id=>this.visitStudy?.(id));
    if(state)atlas.state={...state,layers:[...state.layers]};
    this.research=atlas;this.maps.group.visible=false;this.world.scene.add(atlas.globe);
    this.draw();
    try{await atlas.init();}catch{
      if(this.research===atlas){const hint=$("research-reading");if(hint)hint.textContent="Die lokalen Forschungsdaten konnten nicht geöffnet werden.";}
    }
  }
  constructor(private world:World,private side:HTMLElement,private navigateBase:(mode:"globe"|"plates")=>void){
    world.scene.add(this.maps.group);this.maps.group.visible=false;
    this.labels=document.createElement("div");this.labels.id="observatory-labels";$("earth").parentElement!.append(this.labels);
    this.objectLabels=new ObjectLabels(this.labels);this.timePins=new AnnotationLayer(this.labels,a=>setReading("g-evidence-name",a.name+" · "+a.text));
    const resizeTime=new ResizeObserver(()=>{this.timeLayout++;this.timeKey="";});
    [this.labels,$("obswitch"),$("observation-controls")].forEach(el=>resizeTime.observe(el));
    let down=[0,0];const canvas=$("earth");
    canvas.addEventListener("pointerdown",e=>{down=[e.clientX,e.clientY];});
    canvas.addEventListener("pointerup",e=>{if(this.mode==="regional"&&Math.hypot(e.clientX-down[0],e.clientY-down[1])<5)this.pickRegion(e.clientX,e.clientY);});
    world.customPick=(x,y)=>this.pick(x,y);
    world.customRender=(dt)=>this.frame(dt);
  }
  get paintedRegion(){return !!this.region && this.lastScene===this.region && !this.world.worldDrawn;}
  get painted(){if(this.study)return this.study.painted&&this.study.pendingTextures===0&&!this.world.worldDrawn;if(this.research&&!this.research.ready)return false;return this.mode==="regional"?this.paintedRegion:this.mode==="studio"?!!this.studio?.painted&&!this.world.worldDrawn:this.mode==="time"?!!this.timeline?.ready&&!this.world.worldDrawn:this.mode==="map"?this.research?.state.flat?!!this.research.ready:this.world.worldDrawn&&this.maps.steps.length>0:true;}
  private parkfield?:RegionalScene;
  private parkDefaults?:ReturnType<typeof fields<RegionalScene,typeof regionKeys[number]>>;
  close(){
    this.lessonView=undefined;this.study?.dispose();this.study=undefined;
    this.studio?.dispose();this.studio=undefined;
    this.research?.dispose();this.research=undefined;
    this.profile.hide();this.profileWanted=false;this.switching=false;this.spare?.dispose();this.spare=undefined;this.revision++;
    const r=this.region;
    if(r?.ready&&r.spec.site==="san"&&r.spec.theme==="earthquake"&&!r.spec.comparison&&!r.spec.event){
      this.parkfield?.dispose();r.playing=false;r.orbit.enabled=false;this.parkfield=r;
    }else r?.dispose();
    this.region=undefined;this.maps.group.visible=false;this.mode="";this.readingState="";
    this.world.nav.enabled=true;this.world.nav.minimumDistance=.06;this.objectLabels.clear();this.timeKey="";this.labels.replaceChildren();this.message="";this.lastUI="";
    this.closeTime();delete document.body.dataset.observatory;
    document.querySelectorAll(".obsNav").forEach(b=>b.removeAttribute("aria-current"));
  }
  private base(keepCamera=false){
    const nav=this.world.nav,pose={...nav.pose};this.close();this.world.globe(true);nav.minimumDistance=2300;
    if(keepCamera){nav.stop();nav.pose={...pose};nav.goal={...pose};}
  }
  private mark(){
    document.body.dataset.observatory=this.mode;$("desk").dataset.mode="observatory";this.side.hidden=false;
    document.querySelectorAll("nav button").forEach(b=>b.removeAttribute("aria-current"));
    $(this.mode==="studio"||this.mode==="time"||this.mapPurpose==="boundaries"&&this.mode==="map"?"nav-plates":this.theme==="volcano"?"nav-volcano":this.theme==="risk"?"nav-risk":"nav-earthquake")?.setAttribute("aria-current","page");
    for(const id of ["modelnote","orbitProcess","nyosPin","nyosRelief"])$(id).hidden=true;
    $("pins").replaceChildren();$("platePins").replaceChildren();
  }
  async openMap(purpose:"events"|"boundaries"="events",keepCamera=false){
    this.base(keepCamera);this.mode="map";this.mapPurpose=purpose;this.theme="earthquake";this.mark();
    if(!keepCamera)this.world.nav.fly({lat:purpose==="events"?12:15,lon:purpose==="events"?-146:-20,d:15300,tilt:0,bearing:0},true);
    void materials().then(lib=>{if(this.mode==="map"){this.world.gl.initTexture(lib.color);this.world.gl.initTexture(lib.relief);}}).catch(()=>{});
    this.world.nav.minimumDistance=150;this.maps.group.visible=true;this.maps.events.visible=purpose==="events";this.maps.boundaries.visible=true;
    this.maps.event=undefined;this.maps.selectStep(undefined);this.draw();
    const rev=this.revision;
    try{await this.maps.init();if(rev===this.revision)this.draw();}catch{if(rev===this.revision){this.message="Kartendaten konnten nicht geöffnet werden.";this.draw();}}
  }
  async openRegion(spec:RegionSpec){
    if(spec.process==="complex"&&spec.theme==="earthquake")spec={...spec,theme:"process"};
    this.base();this.mode="regional";this.theme=spec.theme;this.mark();
    this.world.nav.minimumDistance=.06;this.world.nav.fly({lat:spec.lat,lon:spec.lon,d:Math.max(3600,(spec.site?sites[spec.site].width:110)*3.2),tilt:12,bearing:0},true,1150);
    const cached=spec.site==="san"&&spec.theme==="earthquake"&&!spec.comparison&&!spec.event?this.parkfield:undefined;
    if(cached)this.parkfield=undefined;
    const reg=cached??new RegionalScene(spec,$("earth") as HTMLCanvasElement);this.region=reg;reg.orbit.enabled=false;
    if(cached){
      Object.assign(reg,this.parkDefaults);reg.restoreCamera("land",false,[3.4,4.5,7.4],[0,0,-.5]);reg.update(0);reg.timings.reused=1;this.draw();return;
    }
    if(spec.site==="san"&&spec.theme==="earthquake")this.parkDefaults=fields(reg,regionKeys);
    this.enrich(reg);const rev=this.revision;this.draw();
    try{
      await reg.init();if(rev!==this.revision)return;
      reg.ready=false;const start=performance.now();reg.prepareRender(this.world.gl);await reg.warmShaders(this.world.gl);
      if(rev!==this.revision)return;reg.timings.warmShaderMs=performance.now()-start;reg.ready=true;this.draw();
    }
    catch{if(rev===this.revision){reg.error="Das lokale Gelände konnte nicht geladen werden.";this.draw();}}
  }
  private horizontalSeabed():RegionSpec{
    const g=geology(underwater as Step);
    return {lat:g.lat,lon:g.lon,name:"Untermeerische Transformstörung",event:"strike",process:g.model,geology:g,strike:g.strike,theme:"earthquake"};
  }
  openConcept(theme:"forces"|"lithosphere"){
    void this.openRegion({name:topicNames[theme],lat:0,lon:-24,strike:0,process:theme==="forces"?"subduction":"convergence",theme});
  }
  private boundarySpec(step:Step,theme:Theme){
    const g=geology(step),site=g.regionalDEM?sites[g.regionalDEM]:undefined;
    const distance=site?111.2*Math.hypot(g.lat-site.lat,(g.lon-site.lon)*Math.cos(site.lat*Math.PI/180)):Infinity;
    const details=g.regionalDEM&&site&&distance<=site.width/2?reference(g.regionalDEM,theme):undefined;
    const spec:RegionSpec=details??{lat:g.lat,lon:g.lon,name:boundaryLesson(step).place,strike:g.strike,process:g.model,theme};
    spec.geology=g;spec.azimuth=g.relativeAzimuth;return spec;
  }
  openBoundary(step:Step,theme:Theme="earthquake"){return this.openRegion(this.boundarySpec(step,theme));}
  private pick(x:number,y:number){
    if(!this.mode)return false;
    if(this.mode==="regional"){this.pickRegion(x,y);return true;}
    if(this.mode==="time"){this.pickTime(x,y);return true;}
    const b=$("earth").getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((x-b.x)/b.width*2-1,1-(y-b.y)/b.height*2),this.world.nav.camera);
    const hit=ray.ray.intersectSphere(new T.Sphere(new T.Vector3(),R+35),new T.Vector3());if(hit){
      if(this.research){hit.normalize();this.research.pickAt(Math.asin(hit.y)*180/Math.PI,Math.atan2(hit.x,hit.z)*180/Math.PI,Math.max(.35,this.world.nav.pose.d/R*1.2));return true;}
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
    if(this.study){mountStudy(this.study,this.side);return;}
    if(this.mode==="studio"){this.studio?.mount(this.side);return;}
    const back=button("g-world","Zum Globus"),selectRegions=(theme:Theme,id:string)=>'<label>Region<select id="g-site">'+opts(Object.fromEntries(Object.entries(sites).filter(([k])=>theme!=="volcano"||["island","japan","hawaii"].includes(k)).map(([k,s])=>[k,s.name])),id)+'</select></label>';
    if(this.mode==="map"&&this.research){
      this.research.mount(this.side);
      this.rates.mount(this.side.querySelector(".g-stack")!,this.maps.steps,this.maps.selectedStep);
      this.action("research-back",()=>void this.openMap("boundaries"));
      return;
    }
    if(this.mode==="map"){
      const m=this.maps,s=m.selectedStep,ev=m.event;
      this.side.innerHTML='<p class="g-kicker">Beobachtungen · heute</p><h1>'+(this.mapPurpose==="events"?"Erdbeben der Erde":"Plattengrenzen")+'</h1>'+
        '<div class="g-stack"><label><input id="g-quakes" type="checkbox" '+(m.events.visible?"checked":"")+'> Erdbeben zeigen</label><label><input id="g-lines" type="checkbox" '+(m.boundaries.visible?"checked":"")+'> Plattengrenzen zeigen</label>'+
        (m.events.visible?'<label><input id="g-depth" type="checkbox" '+(m.depth?"checked":"")+'> Tiefe unterscheiden</label><small>USGS · 2019–2023 · Magnitude ab 6</small>'+(m.depth?'<div class="g-legend"><span>Flach</span><span>Mitteltief</span><span>Tief</span></div>':''):'')+
        (ev?'<h2>Beobachtetes Erdbeben</h2><p>'+ev[1]+' · Magnitude '+ev[5]+' ('+ev[6]+') · '+Math.round(ev[4])+' km tief · Bruchmechanismus hier offen.</p>'+button("quake-general","Allgemeines Bruchmodell"):'')+
        (s?'<h2>'+m.pair+'</h2><p>'+explain[classify(s)]+'</p><small>Dieses Modell erklärt einen möglichen Vorgang an dieser Plattengrenze.</small>'+button("g-segment","Prozess ansehen")+(geology(s).localQuake?button("g-quake-explain",geology(s).marine?"Seebeben erklären":"Erdbeben erklären"):'<small>Die genaue Störung ist hier nicht ausreichend bekannt.</small>')+(["ridge","subduction","arc"].includes(classify(s))?button("g-segment-volcano","Vulkanismus ansehen"):''):'')+
        (this.mapPurpose==="boundaries"?'<label>Grenzbeispiele<select id="g-example" '+(m.steps.length?"":"disabled")+'><option value="">Ort auf dem Globus finden …</option>'+opts(this.examples(),"")+'<optgroup label="Weitere Regionen">'+opts(Object.fromEntries(Object.entries(geographicExamples).filter(([id])=>!this.examplesCache[id])),"")+'</optgroup></select></label>':'')+
        '<label>Referenzregion<select id="g-launch"><option value="">Region wählen …</option>'+opts(Object.fromEntries(Object.entries(sites).filter(([k])=>k!=="hawaii").map(([k,v])=>[k,v.name])),"")+'</select></label>'+
        button("g-map-overview","Weltübersicht")+item("Woher wissen wir das?","Seismometer zeichnen Erschütterungen auf. Aus vielen Aufzeichnungen bestimmen Forschende Ort und Tiefe. Ein Kartenpunkt allein verrät die Bruchrichtung nicht. Ort, Zeit und Stärke eines künftigen Bebens lassen sich nicht exakt vorhersagen.")+back+'</div>';
      if(this.mapPurpose==="boundaries"){
        const open=document.createElement("button");open.id="research-open";open.textContent="Forschungsatlas öffnen";open.onclick=()=>void this.openResearch();
        this.side.querySelector("h1")?.after(open);
      }
      this.change("g-quakes",()=>{m.events.visible=!m.events.visible;m.event=undefined;this.draw();});this.change("g-lines",()=>{m.boundaries.visible=!m.boundaries.visible;m.selectStep(undefined);this.draw();});
      this.change("g-depth",()=>{m.depth=!m.depth;m.recolor();this.draw();});this.change("g-launch",v=>{if(v)void this.openRegion(reference(v as Site,"earthquake"));});
      this.change("g-example",id=>{const st=m.steps[Number(id)-1];if(!st)return;this.maps.selectStep(undefined);
        this.world.nav.fly({...center(st),d:4100,tilt:0,bearing:0},true);this.draw();});
      this.action("quake-general",()=>this.visitStudy?.("strike"));
      this.action("g-map-overview",()=>this.world.nav.fly({lat:12,lon:-146,d:15300,tilt:0,bearing:0},true));
      if(s){this.action("g-quake-explain",()=>this.openBoundary(s));this.action("g-segment",()=>this.openBoundary(s,"process"));this.action("g-segment-volcano",()=>this.openBoundary(s,"volcano"));}
    }else if(this.mode==="regional"&&this.region){
      const r=this.region,sp=r.spec;
      this.side.innerHTML='<p class="g-kicker">'+(sp.site?topicNames[sp.theme]:sp.theme==='forces'||sp.theme==='lithosphere'?'Schematisch vergrößerter Schnitt':'Vereinfachtes Modell dieser Grenzart')+'</p><h1>'+sp.name+'</h1>'+learningFields+'<div id="g-object" aria-live="polite"></div><div class="g-stack">'+(sp.site?selectRegions(sp.theme,sp.site):'')+
        (sp.geology?'<small>'+names[sp.geology.left]+' · '+names[sp.geology.right]+' · '+processNames[sp.geology.model]+'</small>':'')+'<small id="g-model-note">'+(r.localActive?'Lokales Anschauungsmodell · Größen in Metern · Einzelobjekte illustrativ':sp.site?(sp.site==='san'&&sp.theme==='earthquake'?'Gelände aus Geodaten · Vergleichsweg und Untergrund schematisch':'Höhen aus Geodaten · Untergrund schematisch'):(sp.geology&&[1510,2308].includes(sp.geology.id)?'Meeresboden aus SRTM15+ · 15 Bogensekunden · Höhen 2,4-fach überhöht · Untergrund schematisch':sp.coastLesson?'Schematischer Küstenraum · helle Linie: ursprüngliches Ufer':sp.theme==='forces'||sp.theme==='lithosphere'?'Prozessdetail · schematische Größen und Tiefen':'Lage und Grenzrichtung aus PB2002 · Untergrund schematisch'))+(r.localActive?'':' · Höhen überhöht, Modellzeit verkürzt')+'</small>'+
        (!r.ready?'<p role="status">'+(r.error||'Gelände wird geladen …')+'</p>':
        button("g-cut",r.cut?"An die Oberfläche":"Untergrund öffnen")+'<label>Ansicht<select id="g-view">'+opts({land:"Regionalübersicht",...(sp.site==="japan"&&!sp.arcTransect?{local:"Küstenausschnitt · Nahansicht",ground:"Am Ufer · ruhendes Wasser"}:sp.site==="island"?{local:"Vulkanische Spalte · Nahansicht",ground:"Lavafeld · bodennah"}:sp.site&&!sp.arcTransect?{local:"Lokaler Landschaftsausschnitt",ground:"Bodennahe Perspektive"}:{}),...(sp.geology?{overhead:"Plattenbewegung von oben"}:{}),cut:"Geologischer Schnitt",...(["earthquake","process"].includes(sp.theme)&&sp.process!=="complex"?{fault:"Störungsdetail"}:{}),...(sp.theme==="earthquake"?{focus:"Erdbebenherd",waves:"Wellenausbreitung"}:{}),...(sp.theme==="volcano"?{vent:"Vulkan und Ausbruch",mouth:"Vulkanöffnung · Nahblick"}:{}),...(r.water?{water:"Entstehung am Meeresboden",ocean:"Ausbreitung im offenen Meer",coast:"Küstenwirkung · Modell"}:{})},r.view)+'</select></label>'+
        (sp.theme==='lithosphere'?'':'<label class="g-range"><span id="g-phase"></span><input id="g-progress" type="range" min="0" max="1" step=".001" value="'+r.progress+'"></label>'+
        '<div class="g-buttons">'+button("g-play","Abspielen")+button("g-step","Einzelschritt")+button("g-reset","Zurücksetzen")+'</div>')+
        '<label><input type="checkbox" id="g-names" '+(r.names?"checked":"")+'> Namen zeigen</label>'+
        (sp.theme==="earthquake"&&(sp.comparison||sp.event||sp.coastLesson)?'<label>Meeresereignisse vergleichen<select id="g-sea">'+opts({vertical:sp.coastLesson?"B · Hebung im Küstenmodell":"B · Überschiebung in Japan",flat:"A · Untermeerischer Seitenversatz",buried:"C · Tiefer Bruch ohne starke Bodenhebung"},sp.event==="buried"?"buried":r.vertical?"vertical":"flat")+'</select></label>':'')+
        (sp.geology?'<label><input type="checkbox" id="g-vectors" '+(r.vectors?"checked":"")+'> Plattenbewegung zeigen</label>'+(r.vectors?'<small>Gold · gesamte Relativbewegung der linken gegenüber der rechten Platte. Türkis · längs der Grenze. Violett · quer zur Grenze. PB2002.</small>':''):'')+
        (r.water?'<label><input type="checkbox" id="g-water-profile" '+(r.analysis?"checked":"")+'> Wasser im Profil untersuchen</label>':"")+this.extraControls(r)+(sp.site==="japan"&&!sp.arcTransect?depthSection():"")+
         '<details><summary>Modell steuern</summary>'+(sp.site&&!r.localActive?'<label><input type="checkbox" id="g-relief-only" '+(r.reliefOnly?'checked':'')+'>Relief aus Höhendaten schummern</label>':'')+'<label><input type="checkbox" id="g-more-labels" '+(r.moreNames?'checked':'')+'> Weitere Fachbegriffe</label>'+(r.cut?'<label><input id="g-facies" type="checkbox" '+(r.facies?"checked":"")+'> Analysefarben im Schnitt</label><small>Modellfarben zur Unterscheidung der Gesteinskörper.</small>':'')+'<label><input type="checkbox" id="g-phases" '+(r.phasesShown?"checked":"")+'> Phasen benennen</label><label><input type="checkbox" id="g-slow" '+(r.slow?"checked":"")+'> Zeitlupe</label><label><input type="checkbox" id="g-stress" '+(r.stress?"checked":"")+'> Spannung im Modell</label></details>'+
        item("Was geschieht hier?",explain[sp.process])+
        (sp.geology?item("Was ist an diesem Ort belegt?",this.regionText(sp.geology)):"")+this.extraInfo(r))+
        button("g-map","Zur Weltkarte")+back+'</div>';
      if(r.localActive){
        const link=document.createElement("button");link.id="g-local-process";
        link.textContent=sp.site==="japan"?"Zum regionalen Wasser- und Küstenmodell":sp.theme==="volcano"?"Zum regionalen Vulkan":"Zum regionalen Prozess";
        $("g-object").before(link);link.onclick=async()=>{
          if(sp.site==="japan"&&sp.theme!=="earthquake"){await this.openRegion(reference("japan","earthquake"));this.region?.cameraView("water");}
          else r.cameraView(sp.site==="japan"?"water":sp.theme==="volcano"?"vent":"cut");this.draw();
        };
        if(r.localStill)for(const id of ["g-play","g-step","g-progress","g-reset","g-before","g-after","g-stage"]){const el=$(id) as HTMLButtonElement|null;if(el)el.disabled=true;}
      }
      if(sp.geology&&sp.geology.id===this.returnPairId&&this.returnPair){const back=document.createElement("button");back.id="g-return-pair";back.textContent="Zurück zum Grenzvergleich";this.side.querySelector("h1")?.after(back);back.onclick=this.returnPair;}
      this.change("g-site",v=>{if(v)void this.openRegion(reference(v as Site,sp.theme));});
      this.action("g-cut",()=>{r.reframe(!r.cut);this.draw();});this.action("g-play",()=>{if(r.progress>=1)r.progress=0;r.playing=!r.playing;});
      this.action("g-step",()=>r.step());this.action("g-reset",()=>{r.progress=0;r.playing=false;});
      if($("g-progress"))$<HTMLInputElement>("g-progress").oninput=e=>{r.playing=false;r.progress=Number((e.target as HTMLInputElement).value);};
      this.change("g-sea",v=>{
        const next=v==="flat"?this.horizontalSeabed():reference("japan","earthquake");
        if(v==="buried")next.event="buried";
        next.comparison={...sp,comparison:undefined};void this.switchEvent(r,next,r.view);

      });this.change("g-facies",()=>{r.facies=!r.facies;});this.change("g-names",()=>{r.names=!r.names;});this.change("g-more-labels",()=>{r.moreNames=!r.moreNames;});
      this.change("g-phases",()=>{r.phasesShown=!r.phasesShown;this.draw();});this.change("g-slow",()=>{r.slow=!r.slow;});this.change("g-stress",()=>{r.stress=!r.stress;});this.action("g-map",()=>void this.openMap());this.bindExtra(r);
    }else this.drawTime();
    if(this.mode==="regional" || this.mode==="time"){
      const focus=document.createElement("button");
      focus.id="focus-reading";
      const showMode=()=>{
        const wide=document.body.classList.contains("reading-focus");
        focus.textContent=wide?"Kompakte Modellsteuerung":"Erklärung im Fokus";
        focus.setAttribute("aria-pressed",String(wide));
      };
      focus.onclick=()=>{document.body.classList.toggle("reading-focus");showMode();};
      showMode();
      this.side.querySelector("h1")?.after(focus);
    }
    this.action("g-world",()=>this.navigateBase("globe"));if(this.message){const p=document.createElement("p");p.textContent=this.message;this.side.append(p);}
  }
  returnPairId?:number;
  returnPair?:()=>void;
  private lastLabelsRendered=false;
  get subject(){
    if(this.lessonView)return "seismology/"+this.lessonView;
    if(this.mode==="regional"){const s=this.region?.spec;return [s?.theme,s?.site,s?.geology?.id,s?.process,s?.event,s?.coastLesson].join("/");}
    if(this.studio){const s=this.studio.state;return s.interior?"studio/earth/"+s.division:"studio/"+s.models.join("/");}
    if(this.mode==="time")return "time/"+this.timeline?.model;
    return this.mode==="map"?"map/"+this.mapPurpose:[this.world.mode,this.world.mosaic?.pair?.step[0],this.world.processSite,this.world.mode==="nyos"?this.world.nyosLesson.view:""].join("/");
  }
  private lastScene?:RegionalScene;
  private drawnState="";private readingState="";
  private frame(dt:number){
    if(this.study)return this.study.frame(dt);
    if(this.studio)return this.studio.frame(dt);
    if(this.research?.state.flat){graphics.idle=true;graphics.scope="world";graphics.activity="cached";return true;}
    graphics.idle=false;
    if(this.lastScene!==this.region||this.world.nav.flight||this.mode!=="regional"){this.lastScene=undefined;this.drawnState="";}

    if(!this.mode)return false;
    if(this.mode==="time")return this.frameTime(dt);
    const r=this.region;
    if(this.mode==="regional"&&(!r?.ready||this.switching||this.world.nav.flight)){if(this.lastLabelsRendered){this.objectLabels.clear();this.lastLabelsRendered=false;}graphics.scope="loading";graphics.activity="load";return false;}
    if(!r||!r.ready||this.world.nav.flight)return false;
    r.orbit.enabled=true;this.world.nav.enabled=false;const canvas=this.world.gl.domElement;r.camera.aspect=canvas.clientWidth/canvas.clientHeight;r.camera.updateProjectionMatrix();
    r.update(dt);
    const state=[r.view,r.cut,r.opening.toFixed(4),r.vertical,r.coastal,r.front.visible,r.labels.visible,
      canvas.width,canvas.height,graphics.surfaceRevision,r.local?.revision,graphics.revision,...r.camera.position.toArray().map(v=>v.toFixed(7)),...r.orbit.target.toArray().map(v=>v.toFixed(7)),...regionKeys.map(key=>r[key])].join("|");
    const start=r.timings.firstDrawMs===undefined?performance.now():0;
    graphics.idle=this.lastScene===r&&state===this.drawnState&&!r.playing&&r.viewSettled;
    graphics.scope=[r.spec.site??r.spec.process,r.spec.theme,r.localActive?"local":"regional"].join("/");
    graphics.activity=r.localActive&&r.local!.pending?"load":graphics.idle?"cached":r.playing?"animation":this.lastScene===r?"camera":"still";
    if(!graphics.idle){
      r.prepareRender(this.world.gl);this.world.gl.render(r.renderScene,r.camera);this.lastScene=r;this.drawnState=state;
    }
    if(start)r.timings.firstDrawMs=performance.now()-start;
    this.profile.show(r,()=>{r.analysis=false;this.draw();});
    const cut=$("g-cut"),view=$<HTMLSelectElement>("g-view");
    if(cut){const label=r.cut?"An die Oberfläche":"Untergrund öffnen";if(cut.textContent!==label)cut.textContent=label;}
    if(view&&view.value!==r.view)view.value=r.view;
    if(this.readingState!==state||!$("learn-term")?.textContent){this.readingState=state;
    const [term,phase,cause,effects]=regionalReading(r);
    setReading("learn-term",term);setReading("learn-phase",r.phasesShown?phase:"");setReading("learn-cause",cause);setReading("learn-effects",effects);}
    const play=$("g-play");
    if(play){setReading("g-play",r.playing?"Pause":"Abspielen");setReading("g-phase","Modellzeit");const range=$<HTMLInputElement>("g-progress");if(document.activeElement!==range&&+range.value!==r.progress)range.value=String(r.progress);}
    const stage=$<HTMLSelectElement>("g-stage");if(stage&&document.activeElement!==stage){stage.value=["0",".30",".49",".53","1"].reduce((a,b)=>Math.abs(+a-r.progress)<Math.abs(+b-r.progress)?a:b);}
    this.objectLabels.draw(r,state,allowsLabel);this.lastLabelsRendered=true;return true;
  }
  private regionText(g:ReturnType<typeof geology>){
    const card=(a:number)=>["Norden","Nordosten","Osten","Südosten","Süden","Südwesten","Westen","Nordwesten"][Math.round(a/45)%8];
    const surface=g.coastalUncertainty?"Die Höhendaten erlauben hier keine sichere Zuordnung zu Land oder Meer.":g.marine?"Der Abschnitt liegt unter dem Meer.":"Der Abschnitt liegt an Land.";
    const move=names[g.left]+" bewegt sich gegenüber "+names[g.right]+" nach "+card(g.relativeAzimuth)+". ";
    const contact=g.descending&&g.overriding?names[g.descending]+" taucht unter "+names[g.overriding]+". ":g.model==="complex"?"Die genaue Störung ist hier nicht ausreichend bekannt. ":"";
    return contact+move+surface+(g.oblique?" Ein großer Teil der Relativbewegung verläuft längs der Grenze. Der vereinfachte Bruch zeigt nur die Überschiebung.":"");

  }
  snapshot(){
    const r=this.region,t=this.timeline,m=this.maps;
    return {mode:this.mode,lessonView:this.lessonView,study:this.study?.snapshot(),studio:this.studio?structuredClone(this.studio.state):undefined,pose:{...this.world.nav.pose},map:{research:this.research?.state,rates:this.research?{ids:[...this.rates.ids],years:this.rates.years,unit:this.rates.unit,opened:this.rates.opened}:undefined,purpose:this.mapPurpose,events:m.events.visible,lines:m.boundaries.visible,depth:m.depth,step:m.selectedStep?.[0],event:m.event?.[0]},
      region:r?.ready?{site:r.spec.site,theme:r.spec.theme,boundary:r.spec.geology?.id,coast:r.spec.coastLesson,event:r.spec.event,
        settings:fields(r,regionKeys),view:r.view,cut:r.cut,position:r.camera.position.toArray(),target:r.orbit.target.toArray()}:undefined,
      time:t?fields(t,timeKeys):undefined};
  }
  async restore(s:ReturnType<Observatory["snapshot"]>){
    const m=this.maps,initial=this.revision;
    if(s.mode==="seismic"&&s.study&&familyOf(s.study.view))await this.openStudy(s.study.view,s.study);
    else if(s.mode==="studio"&&s.studio)this.openStudio(s.studio);
    else if(s.mode==="map"){
      if(s.map.research){const rates=s.map.rates;if(rates){this.rates.ids=[...rates.ids];this.rates.years=rates.years;this.rates.unit=rates.unit;this.rates.opened=rates.opened;}await this.openResearch(s.map.research);}
      else await this.openMap(s.map.purpose);
      if(this.revision!==initial+1)return;
      m.events.visible=s.map.events;m.boundaries.visible=s.map.lines;m.depth=s.map.depth;m.recolor();
      m.selectStep(m.steps.find(step=>step[0]===s.map.step));m.event=m.rows.find(row=>row[0]===s.map.event);
    }else if(s.mode==="time"&&s.time){
      this.openTime();const t=this.timeline!;Object.assign(t,fields(s.time,timeKeys));t.overview=s.time.overview!==false;t.setYear(s.time.year);
    }else if(s.mode==="regional"&&s.region){
      const v=s.region;
      let spec:RegionSpec;
      if(v.coast)spec={name:"Küstenwirkung · schematisches Profil",lat:38,lon:142,strike:0,process:"subduction",theme:v.theme,coastLesson:true,event:v.event};
      else if(v.event==="strike")spec=this.horizontalSeabed();
      else if(v.site&&Object.hasOwn(sites,v.site))spec=reference(v.site,v.theme);
      else if(v.boundary){await m.init();if(this.revision!==initial)return;const step=m.steps.find(step=>step[0]===v.boundary);if(!step)throw Error();spec=this.boundarySpec(step,v.theme);}
      else if(v.theme==="forces"||v.theme==="lithosphere")spec={name:topicNames[v.theme],lat:0,lon:-24,strike:0,process:v.theme==="forces"?"subduction":"convergence",theme:v.theme};
      else throw Error("Region fehlt");
      spec.event=v.event;await this.openRegion(spec);if(this.revision!==initial+1)return;
      const r=this.region;if(!r?.ready)throw Error("Gelände fehlt");
      Object.assign(r,fields(v.settings,regionKeys));r.moreNames=Boolean(v.settings.moreNames);r.analysis=Boolean(r.analysis&&r.water);r.progress=T.MathUtils.clamp(r.progress,0,1);r.restoreCamera(v.view,v.cut,v.position,v.target);
    }
    this.lessonView=isView(s.lessonView)?s.lessonView:undefined;
    this.world.nav.stop();this.world.nav.pose={...s.pose};this.world.nav.goal={...s.pose};this.draw();
  }
  async preset(i:number){
    if(i<2){await this.openMap();this.maps.events.visible=true;this.maps.boundaries.visible=i===1;this.maps.depth=false;this.maps.recolor();}
    else{await this.openRegion(reference(i<6?"san":"japan","earthquake"));const r=this.region;if(!r?.ready)throw Error();
      r.cameraView(i<5?"overhead":i===5?"waves":i===6?"cut":"water");r.progress=[0,0,0,.30,.49,.53,0,.48][i];r.stress=i===3;}
    this.draw();
  }
  private drawnObjects(r:RegionalScene){
    const names=new Set<string>();r.renderScene.traverseVisible(object=>{if((object as T.Mesh).isMesh && object.name)names.add(object.name);});
    return [...names];
  }
  diagnostics(){const r=this.region;return {sampleGeometry:this.study?.samplingGeometry(),projected:this.study?.projectedPoints(),study:this.study?.snapshot(),studyObjects:this.study?.scene.children.map(o=>o.name).filter(Boolean),lessonView:this.lessonView,painted:this.painted,overlay:this.maps.group.visible,renderScene:this.paintedRegion?r?.renderScene.uuid:undefined,drawnObjects:this.paintedRegion&&r?this.drawnObjects(r):undefined,atlas:this.research?.state,studio:this.studio?.state,materialMotion:this.studio?.motionSample(),selection:this.objectLabels.audit,graphics:{profile:graphics.profile,grade:quality()},mode:this.mode,purpose:this.mapPurpose,mapLayers:{events:this.maps.events.visible,lines:this.maps.boundaries.visible,depth:this.maps.depth},camera:r?.ready?{position:r.camera.position.toArray(),target:r.orbit.target.toArray()}:undefined,settings:r?fields(r,regionKeys):undefined,timings:r?.timings,switching:this.switching,analysis:r?.analysis,view:r?.view,event:r?.spec.event,playing:r?.playing,vectors:r?.vectors,coastLesson:r?.spec.coastLesson,site:r?.spec.site,geology:r?.spec.geology,physics:r?.ready?r.physicalState():undefined,process:r?.spec.process,theme:this.theme,ready:this.study?this.study.painted&&this.study.pendingTextures===0:!!this.studio||!this.switching&&(r?.ready??(this.maps.steps.length>0)),progress:r?.progress,cut:r?.cut,viewSettled:r?.viewSettled,focus:r?.faultModel?.kind==="unknown"?undefined:r?.focus,epicenter:r?.faultModel?.kind==="unknown"?undefined:r?.epicenter,events:this.maps.rows.length,steps:this.maps.steps.length,selected:this.maps.selectedStep?.[0],...this.timeDiagnostics()};}
  private enrich(r:RegionalScene){addTeachingModels(r);}
  private extraControls(r:RegionalScene){
    if(r.spec.theme==="forces")return '<details><summary>Antrieb einzeln zeigen</summary>'+["Wärmetransport","Kraft am Rücken","Zug der abtauchenden Platte","Mantelbewegung","Kopplung von Mantel und Platte"].map((label,i)=>'<label><input id="force-'+i+'" type="checkbox" '+(((r.forceLayers??31)&(1<<i))?'checked':'')+'>'+label+'</label>').join("")+'<small>Pfeile geben Richtung und Ort qualitativ an. Ihre Länge misst keine Kraft.</small></details>';
    if(r.spec.theme==="volcano")return '<label>Modellausbruch<select id="g-eruption">'+opts({effusive:"Lava fließt aus",explosive:"Asche und Gase steigen auf"},r.eruption)+'</select></label>';
    if(r.spec.theme==="risk")return (r.spec.coastLesson?"":'<label>Standort bei gleicher Quelle<select id="g-risk-site">'+opts({near:"Standort A",far:"Standort B · versetzt"},r.riskSite)+'</select></label>')+'<label>Ereignis<select id="g-risk-kind">'+opts({land:"Beben an Land",coast:"Tsunamivorsorge an der Küste"},r.spec.coastLesson?"coast":"land")+'</select></label><label>Untergrund<select id="g-soil">'+opts({rock:"Fester Fels",loose:"Lockere Ablagerungen"},r.soil)+'</select></label><label>Raumnutzung<select id="g-exposure">'+opts({empty:"Unbesiedelt",sparse:"Einzelne Häuser",dense:"Dichte Siedlung"},r.exposure)+'</select></label><label><input type="checkbox" id="g-protect" '+(r.protection?"checked":"")+'> Bauweise verstärken</label><details><summary>Weitere Schutzmaßnahmen</summary><label><input type="checkbox" id="g-route" '+(r.safeRoute?"checked":"")+'> Fluchtweg markieren</label><label><input type="checkbox" id="g-warning" '+(r.warning?"checked":"")+'> Warnung und Evakuierung üben</label><label><input type="checkbox" id="g-relocate" '+(r.relocate?"checked":"")+'> Siedlung auf höheres Gelände verlagern</label></details>';
    if(r.spec.theme==="process")return r.spec.process==="complex"?"<p>Die genaue Störung ist hier nicht ausreichend bekannt.</p>":button("g-quake-from-process",r.spec.geology?.marine?"Seebeben erklären":"Erdbeben erklären");
    if(r.spec.theme==="earthquake"){
      const phases=r.phasesShown?["Ausgangszustand","Spannungsaufbau","Bruch und Versatz","Wellenausbreitung","Nach dem Beben"]:["Zustand 1","Zustand 2","Zustand 3","Zustand 4","Zustand 5"];
      const values=["0",".30",".49",".53","1"],closest=values.reduce((a,b)=>Math.abs(+a-r.progress)<Math.abs(+b-r.progress)?a:b);
      return '<label>Zustand<select id="g-stage">'+values.map((v,i)=>'<option value="'+v+'" '+(v===closest?'selected':'')+'>'+phases[i]+'</option>').join("")+'</select></label><div class="g-buttons">'+button("g-before","Vorher")+button("g-after","Nachher")+'</div>'+
        (r.spec.site==="san"?'<small>Schematischer Vergleichsweg · Versatz überhöht</small>':'')+
        (r.spec.process==="subduction"||r.spec.process==="arc"?'<small>Das Beispiel zeigt einen vereinfachten Bruch am geneigten Kontakt. Die Platten können sich zusätzlich seitlich bewegen.</small>':'')+
        (r.spec.event||r.spec.coastLesson?'<small>Nicht jedes Seebeben löst einen Tsunami aus.</small>':'')+
        '<div class="wave-key" aria-label="Idealisierte Wellen"><label><input id="g-p" type="checkbox" '+(r.showP?"checked":"")+'> <i></i>P · längs</label><label><input id="g-s" type="checkbox" '+(r.showS?"checked":"")+'> <i></i>S · quer</label></div>'+
        '<details id="g-analysis"><summary>Vorgang untersuchen</summary><label><input id="g-detail" type="checkbox" '+(r.detail?"checked":"")+'> Gesteinspunkte vergrößern</label><small>Die Punkte schwingen um ihren Ort. Die Welle läuft weiter.</small></details>'+button("g-risk","Folgen am Standort vergleichen");
    }
    return "";
  }
  private extraInfo(r:RegionalScene){
    if(r.spec.theme==="lithosphere")return item("Was gehört zusammen?","Die Kruste und der starre oberste Mantel bilden die Lithosphäre. Eine Platte kann sowohl Kontinente als auch Ozeanboden tragen. Der Mantel darunter ist überwiegend fest und über lange Zeit verformbar.");
    if(r.spec.theme==="forces")return item("Warum bewegen sich Platten?","Heißes Gestein kann sich über lange Zeit bewegen. Kalte Plattenteile können absinken und ziehen. Vom erhöhten Rücken wirkt auch die Schwerkraft. Der bewegte Mantel und die Platten üben wechselseitig Kräfte aufeinander aus. Ihre Anteile unterscheiden sich regional.");
    if(r.spec.theme==="magnet")return item("Woher wissen wir das?",explanations.stripe.answer);
    if(r.spec.theme==="volcano")return (r.spec.arcTransect?item("Wo liegt dieser Vulkan?","Zaozan liegt auf der japanischen Hauptinsel. Der Schnitt verläuft von dort zum Japangraben. Der Magmaweg und der Ausbruch sind schematisch."):"")+item("Wie entsteht Schmelze?",meltingExplanation(r.spec.process,r.spec.site))+item("Was ist Magma?",explanations.melt.answer)+item("Was tritt aus?",explanations.lava.answer)+item("Warum verlaufen Ausbrüche verschieden?","Dünnflüssige Schmelze lässt Gas oft leichter entweichen. In zäher Schmelze kann sich Gas stauen. Auch die Gasmenge spielt eine Rolle. Gasemissionen oder Unruhe allein erlauben keine sichere Vorhersage eines Ausbruchs.")+(r.spec.site==="island"?item("Was ist auf Island besonders?","Island liegt auf einem Rücken. Zusätzlich steigt hier besonders heißes Mantelmaterial unter der Platte auf."):"");
    if(r.spec.theme==="risk")return item("Verwundbarkeit und Resilienz","Anfällige Gebäude können stärker beschädigt werden. Wer Wege und Hilfe vorbereitet, kann die Versorgung schneller wieder aufnehmen. Die grüne Versorgungsstelle zeigt die Wiederherstellung im Modell.")+item("Magnitude und Intensität","Die Magnitude beschreibt die Größe des Bebens an der Quelle. Die Intensität beschreibt, wie stark die Erschütterung an einem Ort erlebt wird. Bei gleichem Beben kann lockerer Boden die Schwingung am selben Standort verstärken.")+item("Was bedeutet Momenten-Magnitude?","Forschende schätzen die Größe des Bebens aus der gebrochenen Fläche, dem Versatz und der Steifigkeit des Gesteins. Das Modell berechnet keinen Zahlenwert.")+item("Wie können wir vorsorgen?","Bauweise, erreichbare Fluchtwege und geübte Abläufe können die Folgen mindern. Warnungen müssen die Menschen auch erreichen.")+item("Was ist abzuwägen?","Umbau kostet Geld. Freie Fluchtwege benötigen Platz. Betroffene Menschen können mitentscheiden, wo gebaut und wie der Wiederaufbau vorbereitet wird.");
    return r.spec.theme==="earthquake"?item("Was sind P- und S-Wellen?","Goldene Punkte schwingen vor und zurück. Das zeigt die schnellere P-Welle. Türkise Punkte schwingen quer zur Laufrichtung. Diese S-Welle läuft nur durch festes Material.")+item("Was zeigen die zwei Orte?","Der Bruch beginnt im Erdbebenherd. Direkt darüber liegt an der Oberfläche das Epizentrum.")+item("Wann entsteht ein Tsunami?","Nicht jedes Seebeben löst einen Tsunami aus. Hebt oder senkt sich ein großer Teil des Meeresbodens, bewegt er die Wassersäule. Lange Wasserwellen laufen zur Küste und können dort höher werden."):"";}
  private async switchEvent(old:RegionalScene,spec:RegionSpec,view:string){
    const token=++this.revision,start=performance.now(),playing=this.switching?this.resumePlayback:old.playing;this.resumePlayback=playing;
    const settings=fields(old,regionKeys);if(old.water)this.profileWanted=old.analysis;old.playing=false;this.switching=true;
    const match=(a:RegionSpec,b:RegionSpec)=>a.event===b.event&&a.site===b.site&&Boolean(a.coastLesson)===Boolean(b.coastLesson)&&a.theme===b.theme;
    const cached=this.spare&&match(this.spare.spec,spec)?this.spare:undefined;
    if(cached)this.spare=undefined;
    const next=cached??new RegionalScene(spec,$("earth") as HTMLCanvasElement);next.orbit.enabled=false;
    const message=$("g-object");if(message)message.textContent="Modellereignis wird vorbereitet …";
    try{
      if(!cached){this.enrich(next);await next.init();}
      if(this.revision!==token){next.dispose();return;}
      Object.assign(next,settings);next.playing=playing;next.analysis=Boolean(this.profileWanted&&next.water);
      next.cameraView(!next.water&&["water","ocean","coast"].includes(view)?"cut":view);next.update(0);
      if(!cached){const compiling=performance.now();await next.warmShaders(this.world.gl);next.timings.warmShaderMs=performance.now()-compiling;}
      if(this.revision!==token){next.dispose();return;}
      this.spare?.dispose();this.spare=old;old.orbit.enabled=false;this.region=next;this.switching=false;
      next.timings.localSwitchMs=performance.now()-start;next.timings.reused=Number(Boolean(cached));this.draw();
    }catch{next.dispose();if(this.revision===token){this.switching=false;old.playing=playing;if(message)message.textContent="Das Modellereignis konnte nicht geladen werden.";}}

  }
  private bindExtra(r:RegionalScene){
    this.change("g-relief-only",()=>{r.reliefOnly=!r.reliefOnly;});
    if(r.spec.theme==="forces")for(let i=0;i<5;i++)this.change("force-"+i,()=>{r.forceLayers=(r.forceLayers??31)^(1<<i);});
    this.change("g-eruption",v=>{r.eruption=v;if(r.localActive){if(r.localStill)r.playing=false;this.draw();}});this.change("g-soil",v=>{r.soil=v;});
    this.change("g-risk-kind",v=>{const next:RegionSpec=v==="coast"?{name:"Küstenraum · Modell",lat:38,lon:142,strike:0,process:"subduction",theme:"risk",coastLesson:true}:reference("san","risk");void this.openRegion(next);});
    if($("g-relocate")&&!r.spec.coastLesson)$("g-relocate").closest("label")!.hidden=true;
    this.change("g-view",v=>{
      if(v==="coast"&&!r.spec.coastLesson){void this.switchEvent(r,{name:"Küstenwirkung · schematisches Profil",lat:38,lon:142,strike:0,process:"subduction",theme:"earthquake",coastLesson:true,event:"uplift"},"coast");return;}
      if(r.spec.coastLesson&&r.spec.theme==="earthquake"&&["water","ocean"].includes(v)){void this.switchEvent(r,reference("japan","earthquake"),v);return;}
      r.cameraView(v);this.draw();
    });
    this.change("g-stage",v=>{r.playing=false;r.progress=Number(v);});
    this.action("g-before",()=>{r.playing=false;r.progress=0;});this.action("g-after",()=>{r.playing=false;r.progress=1;});
    this.action("g-depth-open",()=>openDepthSection(()=>{r.cameraView("cut");this.draw();}));
    this.change("g-vectors",()=>{r.vectors=!r.vectors;if(r.vectors)r.cameraView("overhead");this.draw();});
    this.change("g-water-profile",()=>{r.analysis=!r.analysis;});
    this.change("g-risk-site",v=>{r.riskSite=v;});
    this.change("g-p",()=>{r.showP=!r.showP;});this.change("g-s",()=>{r.showS=!r.showS;});
    this.change("g-detail",()=>{r.detail=!r.detail;if(r.detail){r.cameraView("waves");}});

    this.change("g-route",()=>{r.safeRoute=!r.safeRoute;});this.change("g-warning",()=>{r.warning=!r.warning;});this.change("g-relocate",()=>{r.relocate=!r.relocate;});
    this.change("g-exposure",v=>{r.exposure=v;});this.change("g-protect",()=>{r.protection=!r.protection;});
    this.action("g-quake-from-process",()=>void this.openRegion({...r.spec,theme:"earthquake"}));
    this.action("g-risk",()=>void this.openRegion({...r.spec,theme:"risk"}));
  }
  private pickRegion(x:number,y:number){
    const r=this.region;if(!r?.ready)return;
    if(document.body.classList.contains("observing")&&!document.body.hasAttribute("data-choose-object"))return;
    this.objectLabels.pick(r,x,y);

  }
  private timeline?:TimeGlobe;
  openTime(){
    this.base();this.mode="time";this.timeline=new TimeGlobe();this.mark();
    this.focusTime();this.draw();
  }
  private pickTime(x:number,y:number){
    const b=$("earth").getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((x-b.x)/b.width*2-1,1-(y-b.y)/b.height*2),this.world.nav.camera);
    const name=this.timeline?.pick(ray);if(name){
      claimObject(name,name+" · "+($("g-evidence-info")?.textContent||"Belegregion in der Rekonstruktion."));
      setReading("g-evidence-name",name);
    }
  }
  private focusTime(){
    const t=this.timeline;if(!t)return;
    if(t.compare&&t.overview){const centre=t.align();if(centre){this.world.nav.fly({...centre,d:17400,tilt:0,bearing:0},true);return;}}
    const [lat,lon]=viewCentres[t.model][Math.round(Math.abs(t.year)/5)];
    // Look across the assembly so both the continental margins and the ocean are visible.
    this.world.nav.fly({lat:lat*.6+12,lon:lon+32,d:17900,tilt:0,bearing:0},true);
  }
  private closeTime(){this.timePins.clear();this.timeline?.dispose();this.timeline=undefined;$("g-split-caption")?.remove();}
  private drawTime(){
    const t=this.timeline;if(!t)return;
    const labels={past:"Vergangenheit bis heute",ultima:"Pangaea Ultima",novo:"Novopangaea",aurica:"Aurica",amasia:"Amasia"};
    this.side.innerHTML='<p class="g-kicker">Plattentektonik</p><h1>Zeitreise</h1><div class="g-stack"><h2 id="g-age"></h2><small id="g-certainty"></small><section class="process-reading"><h2 id="learn-station" data-teach="phase"></h2><p id="learn-history" data-teach="cause"></p></section>'+
      '<label>Zeit wählen<input type="range" min="-250" max="'+(t.scenario==="past"?0:scenarios[t.scenario].end)+'" step=".1" id="g-year" value="'+t.year+'"></label>'+
      '<div class="g-buttons">'+button("g-reverse","Rückwärts")+button("g-time-play","Abspielen")+button("g-today","Heute")+button("g-time-focus","Flächen zentrieren")+'</div>'+
      '<label>Station<select id="g-station">'+opts({"-250":"Pangäa","-200":"Beginnende Aufspaltung","-150":"Weitere Trennung","-100":"Atlantik öffnet sich","-50":"Indien nähert sich Eurasien","0":"Gegenwart"},String(t.year))+'</select></label>'+
      '<details><summary>Wie entstand die Theorie?</summary><p>Wegener verband passende Kontinentalränder, Fossilfunde, Gesteine und Klimaspuren. Ein tragfähiger Antrieb fehlte seiner Hypothese. Später belegten Alter und Magnetisierung des Ozeanbodens dessen Neubildung. Erdbeben zeigen abtauchende Platten. GNSS misst heutige Bewegung in einem angegebenen Bezugssystem.</p></details><label>Zeitmodell<select id="g-scenario">'+opts(labels,t.scenario)+'</select></label>'+
      (t.scenario==="past"?'<details id="g-tracking" open><summary>Kontinent verfolgen</summary><label>Kontinentalbereich<select id="g-track">'+opts({"":"Ausblenden",...Object.fromEntries(Object.entries(tracks).map(([k,v])=>[k,v[0]]))},t.tracking)+'</select></label><label><input id="g-trail" type="checkbox" '+(t.trail?"checked":"")+'> Bewegungsspur</label><label><input id="g-follow" type="checkbox" '+(t.follow?"checked":"")+'> Kamera folgt</label></details>':
      '<label><input id="g-compare" type="checkbox" '+(t.compare?"checked":"")+'> Zwei Möglichkeiten vergleichen</label>'+
      (t.compare?'<label>Zweites Modell<select id="g-second">'+opts(Object.fromEntries(Object.entries(labels).filter(([k])=>k!=="past"&&k!==t.scenario)),t.second)+'</select></label><label>Perspektive<select id="g-compare-camera">'+opts({overview:"Kontinentalanordnungen im Überblick",same:"Gleiche Perspektive"},t.overview?"overview":"same")+'</select></label><small>Gemeinsamer Zeitraum bis +'+Math.min(scenarios[t.scenario].end,scenarios[t.second].end)+' Mio. Jahre. '+assumptions[t.second]+'</small>':'')+
      '<label><input type="checkbox" id="g-future-lines" '+(t.showBoundaries?"checked":"")+'> Modellgrenzen zeigen</label><small>'+assumptions[t.scenario]+'</small>')+
      '<label>Tempo<select id="g-speed">'+opts({"3":"Langsam","7":"Normal","14":"Schnell"},String(t.speed))+'</select></label>'+
      '<details id="g-evidence"><summary>Belege ansehen</summary><label>Hinweis im Globus<select id="g-evidence-kind">'+opts({"":"Ausblenden",margin:"Kontinentalränder",fossil:"Mesosaurus-Fundregionen",rock:"Alte Gebirgsgürtel",ice:"Spuren früherer Vereisung",india:"Weg Indiens",australia:"Weg Australiens"},t.layer)+'</select></label><p id="g-evidence-name"></p><p id="g-evidence-info"></p>'+
      '<p><strong>Wegeners Kontinentalverschiebung, ab 1912</strong> · Zusammenpassende Kontinentalränder, verwandte Fossilien, alte Gebirgsgürtel und Spuren früherer Vereisungen stützten die frühere Verbindung der Kontinente.</p><p><strong>Moderne Plattentektonik, seit den 1960er-Jahren</strong> · Ozeanbodenalter, magnetische Anomalien und Erdbebenverteilung belegen Bildung, Bewegung und Recycling ganzer Lithosphärenplatten. Heutige GNSS-Stationen messen Bewegungen direkt.</p>'+button("g-evidence-atlas","Heutige Messungen und Ozeanbodenalter")+button("g-magnet","Magnetstreifen am Rücken")+button("g-motion","Heutige Bewegung")+button("g-real-events","Beobachtete Erdbeben")+'</details>'+
      '<details id="g-gnss"><summary>Heute mit Satelliten messen</summary><label>Messstation<select id="g-station-gnss">'+opts(Object.fromEntries(gnss.map(s=>[s.id,s.id])),gnss[0].id)+'</select></label><p id="g-gnss-text"></p><small>GNSS · Nevada Geodetic Laboratory · Bezugsrahmen IGS14</small></details>'+
      item("Was zeigt das Modell?","Die hellen Flächen sind Kontinentalbereiche, auch unter flachem Meer. In der Vergangenheit zeigen Linien rekonstruierte Plattengrenzen. Die starren Blöcke drehen sich. Grenzen und verformte Zonen stammen aus Zeitschnitten im Abstand von fünf Millionen Jahren. In der Zukunft unterscheiden die Farbtöne bewegliche Kontinentalblöcke.")+
      item("Wie sicher ist die Zukunft?","Die vier Modelle nehmen unterschiedliche künftige Plattengrenzen an. Sie zeigen Möglichkeiten. Wo Küsten, Gebirge und Städte liegen werden, lässt sich daraus nicht ablesen.")+
      button("g-to-atlas","Zum heutigen Plattenatlas")+button("g-world","Zum Globus")+'</div>';
    this.change("g-track",v=>{t.tracking=v;const point=t.reconstruction.at(Math.abs(t.year),v);if(point)this.world.nav.fly({...point,d:16800,tilt:0,bearing:0},true);});
    this.change("g-trail",()=>{t.trail=!t.trail;});this.change("g-follow",()=>{t.follow=!t.follow;});
    this.change("g-second",v=>{t.comparison=v as Scenario;t.setYear(t.year);if(t.overview)this.focusTime();this.draw();});
    this.change("g-compare-camera",v=>{t.overview=v==="overview";if(t.overview)this.focusTime();this.timeKey="";});
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
    this.action("g-today",()=>{t.playing=false;t.compare=false;t.scenario="past";t.setYear(0);this.draw();});
    this.change("g-speed",v=>{t.speed=Number(v);});
    this.change("g-station",v=>{t.playing=false;t.setYear(Number(v));this.draw();});
    this.change("g-scenario",v=>{t.playing=false;t.scenario=v as Scenario;t.setYear(v==="past"?Math.min(0,t.year):Math.min(Math.max(5,t.year),scenarios[t.scenario].end));this.draw();});
    this.change("g-compare",()=>{if(t.year<=0)t.setYear(5);t.compare=!t.compare;if(t.compare&&t.overview)this.focusTime();this.draw();});
    const text:Record<string,string>={ice:"Eiszeitliche Ablagerungen im Paraná-, Karoo- und Talchir-Becken zeugen von der spätpaläozoischen Vereisung Gondwanas. Beckenmarker, keine Eisgrenzen. Die Vereisung liegt vor dem ältesten Zeitschnitt.",margin:"Die Ränder Südamerikas und Afrikas liegen in der Rekonstruktion näher beieinander. Auch überflutete Teile gehören zum Kontinent.",fossil:"Reste des Süßwasserreptils Mesosaurus finden sich im Paraná- und im Karoo-Becken. Die Punkte markieren Fundregionen. Die Tiere lebten vor der hier gezeigten Zeit.",rock:"In den Appalachen und im kaledonischen Gebirgsgürtel finden sich Spuren einer gemeinsamen alten Gebirgsbildung. Die Punkte markieren Untersuchungsregionen.",india:"Indien wandert im Modell nach Norden.",australia:"Australien trennt sich von der Antarktis."};
    this.change("g-evidence-kind",v=>{t.layer=v;if(t.year>0)t.setYear(0);const point=t.evidenceCentre();if(point)this.world.nav.fly({...point,d:16700,tilt:0,bearing:0},true);$("g-evidence-info").textContent=text[v]||"";$("g-evidence-name").textContent="";});
    $("g-evidence-info").textContent=text[t.layer]||"";
    this.action("g-magnet",()=>void this.openRegion(reference("island","magnet")));this.action("g-real-events",()=>void this.openMap());
    this.action("g-evidence-atlas",()=>void this.openResearch({layers:["age","bounds","gnss"],flat:false,magnitude:6,depth:750}));
    this.action("g-motion",()=>this.navigateBase("plates"));this.action("g-to-atlas",()=>this.navigateBase("plates"));
    if(!$("g-split-caption")){const el=document.createElement("div");el.id="g-split-caption";$("earth").parentElement!.append(el);}
  }
  private frameTime(dt:number){
    graphics.scope="time";graphics.activity=this.timeline?.playing?"animation":"still";
    const t=this.timeline;if(!t)return false;const rendered=t.render(dt,this.world.gl,this.world.nav.camera);if(t.cached){graphics.idle=true;graphics.activity="cached";}
    if(t.follow&&t.tracking&&t.year<=0&&!this.world.nav.flight){
      const v=t.reconstruction.at(Math.abs(t.year),t.tracking);if(v){this.world.nav.goal.lat=v.lat;this.world.nav.goal.lon=v.lon;}
    }
    const [name,meaning]=timeReading(t);setReading("learn-station",name);setReading("learn-history",meaning);
    const camera=this.world.nav.camera,canvas=this.world.gl.domElement;
    const key=[t.ready,t.reconstruction.ready,t.overview,t.scenario,t.second,Math.round(t.year*10),t.layer,t.gnss,t.tracking,t.compare,t.markers.children.length,canvas.clientWidth,canvas.clientHeight,document.body.dataset.reveal,...camera.matrixWorld.elements].join("/");
    if(key!==this.timeKey){this.timeKey=key;beginCandidates();
      const points=t.markers.children.filter(o=>o.name).map(o=>({name:o.name,p:o.position}));
      if(t.year<=0&&!t.gnss&&!t.layer){
        const order=[...new Set([t.tracking,"701","201","501","101","801"].filter(Boolean))];
        if(t.year===0)points.push({name:"Atlantischer Ozean",p:position(4,-29,28)});
        if(t.year<=-230){const [lat,lon]=viewCentres.past[Math.round(-t.year/5)];points.push({name:"Panthalassa",p:position(-lat,lon+180,28)});}
        for(const code of order){
          const at=t.reconstruction.at(Math.abs(t.year),code);
          const age=-t.year;
          const place=code==="701"&&age>=175?(age>=220?"Afrika · Pangäa":"Afrika · Gondwana"):code==="101"&&age>=175&&age<220?"Nordamerika · Laurasia":tracks[code][0];
          if(at)points.push({name:place,p:at.v.clone().normalize().multiplyScalar(R+29)});
        }
      }
      const labels=points.flatMap(({name,p},i)=>{const xy=project(p,camera,canvas.clientWidth,canvas.clientHeight);
        return xy&&p.dot(camera.position.clone().sub(p))>0&&allowsLabel(name,i)?[{id:name,name,text:t.gnss?"Satellitenmessungen zeigen die heutige Bewegung.":meaning,...xy}]:[];}).slice(0,4);
      if(t.compare){
        labels.length=0;const half=Math.floor(canvas.clientWidth/2);
        for(const side of [0,1]){const eye=t.splitCameras[side];
          for(const {name,p} of t.futureLabels(side)){if(p.dot(eye.position.clone().sub(p))<=0)continue;
            const xy=project(p,eye,half,canvas.clientHeight),id=(side?"rechts-":"links-")+name;
            if(xy&&allowsLabel(id)&&labels.filter(v=>v.id.startsWith(side?"rechts":"links")).length<2)labels.push({id,name,text:assumptions[side?t.second:t.scenario],x:xy.x+side*half,y:xy.y});
          }
        }
      }
      this.timePins.draw(labels,[$("obswitch"),$("observation-controls")],this.timeLayout);
    }
    const station=$<HTMLSelectElement>("g-station"),year=Math.round(t.year);
    const stationValue=Number.isInteger(t.year)?String(t.year):"";
    if(station&&station.value!==stationValue)station.value=stationValue;
    setReading("g-age",year<0?"Vor "+(-year)+" Mio. Jahren":year>0?"In "+year+" Mio. Jahren":"Heute");
    setReading("g-certainty",t.error||(!rendered?"Rekonstruktion wird geladen …":year>0?"Mögliche Zukunft – keine sichere Vorhersage":year<0?"Wissenschaftliche Rekonstruktion":"Heutige Kontinentalflächen im Rekonstruktionsmodell"));
    setReading("g-time-play",t.playing?"Pause":"Abspielen");
    const slider=$<HTMLInputElement>("g-year");const tenth=Math.round(t.year*10)/10;
    if(slider.valueAsNumber!==tenth)slider.value=String(tenth);
    const caption=$("g-split-caption");if(caption){caption.hidden=!t.compare;if(t.compare){const key=[t.scenario,t.second,t.overview].join("/");
      if(caption.dataset.pair!==key){caption.dataset.pair=key;caption.replaceChildren(...[t.scenario,t.second].map(id=>{const block=document.createElement("div"),name=document.createElement("strong"),info=document.createElement("span");
      name.textContent=scenarios[id].label;info.textContent=assumptions[id];block.append(name,info);return block;}));caption.dataset.camera=t.overview?"Je Globus auf seine Kontinente ausgerichtet":"Gleiche geografische Perspektive";}}}
    return rendered;
  }
  private timeDiagnostics(){const t=this.timeline;return t?{year:t.year,scenario:t.scenario,overview:t.overview,cameras:t.compare?t.splitCameras.map(c=>c.position.toArray()):undefined,compare:t.compare,futureLines:t.showBoundaries,timeReady:t.ready,timeError:t.error,rigid:t.reconstruction.ready,tracking:t.tracking,tracked:t.reconstruction.at(Math.abs(t.year),t.tracking)?.v.toArray(),second:t.second}:{};}
}
