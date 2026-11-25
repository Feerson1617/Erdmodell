import {chosenReading,channels,disclosed,nextLabel,resetReveals,reveal,revealAll,type Channel} from "./reveal";
const el=(id:string)=>document.getElementById(id);
const neutral=["Erde","Inneres","Karte","Ereignis","Berg","Siedlung","See","Orte"];
const buttons:Record<string,string>={
  "nyos-lake":"See","nyos-section":"Seeschnitt","nyos-event":"Ereignis","nyos-protection":"Vorsorge","atlasReset":"Zurücksetzen","atlasWorld":"Zur Weltansicht","pair-step":"Einzelschritt","pair-process":"Prozessmodell","g-return-pair":"Zurück zum Vergleich","g-local-process":"Regionalmodell öffnen","g-play":"Abspielen","g-step":"Schritt","g-before":"Vorher","g-after":"Nachher","g-reset":"Zurücksetzen",
  "g-time-play":"Abspielen","g-reverse":"Rückwärts","g-today":"Heute","g-time":"Zeit wählen","g-boundaries":"Linien wählen",
  "g-quake-explain":"Ereignis öffnen","g-quake-from-process":"Ereignis öffnen","g-cut":"Untergrund","g-segment":"Modell öffnen","g-map":"Zur Karte","g-map-overview":"Weltübersicht","g-depth-open":"Messpunkte im Schnitt",
  "cut":"Ansicht wechseln","scale":"Größe vergleichen","nyos-play":"Abspielen","nyos-reset":"Zurücksetzen","atlasPlay":"Abspielen","playProcess":"Abspielen"};
const inputs:Record<string,string>={"pair-arrows":"Bewegungspfeile","nyos-dissolved":"Farbe im Wasser","nyos-air":"Farbe in der Luft","g-water-profile":"Wasserprofil","g-detail":"Teilchen","g-compare":"Vergleich","g-future-lines":"Modellgrenzen","g-protect":"Bauweise","g-route":"Fluchtweg","g-warning":"Warnung","g-relocate":"Höherer Standort","g-quakes":"Ereignispunkte","g-lines":"Grenzlinien","g-depth":"Tiefe","g-stress":"Spannung","g-vectors":"Bewegungspfeile","g-p":"P · gold","g-s":"S · türkis","g-follow":"Kamera folgt","g-trail":"Spur"};
const selects:Record<string,string>={"g-compare-camera":"Perspektive","nyos-measure":"Maßnahme","pair-examples":"Grenzvergleich","g-example":"Grenzabschnitt","g-second":"Zweites Zeitmodell","g-risk-kind":"Gefahr","g-risk-site":"Standort","g-soil":"Baugrund","g-exposure":"Besiedlung","g-launch":"Ort","g-site":"Region","g-view":"Ansicht","g-stage":"Zustand","g-sea":"Meeresereignis","g-scenario":"Zeitmodell","g-station":"Zeitsprung","g-track":"Bereich verfolgen"};
const views:Record<string,string>={land:"Regionalübersicht",local:"Nahmodell",ground:"Bodennah",overhead:"Von oben",cut:"Untergrund",fault:"Kontakt",focus:"Ausgangspunkt",waves:"Ausbreitung",water:"Meeresboden",ocean:"Offenes Meer",coast:"Küste · Modell",vent:"Detail",mouth:"Öffnung"};
type Field=HTMLButtonElement|HTMLSelectElement|HTMLInputElement;
export class Observation{
  readonly toggle=document.createElement("button");private controls=document.createElement("section");active=false;
  private readRoot:Node|null=null;private bindings:{source:Field;control:Field}[]=[];private root:Node|null=null;private readonly nav=[...document.querySelectorAll("header nav button span")];
  private readonly original=this.nav.map(s=>s.textContent!);
  private currentSubject="";private retain=false;
  constructor(private subject:()=>string){
    this.toggle.id="obswitch";this.toggle.textContent="Beobachten";this.toggle.setAttribute("aria-pressed","false");
    this.controls.id="observation-controls";this.controls.hidden=true;this.controls.setAttribute("aria-label","Beobachtungssteuerung");
    document.querySelector(".view")!.append(this.toggle,this.controls);this.toggle.onclick=()=>this.set(!this.active);
  }
  set(value:boolean){
    this.currentSubject=this.subject();resetReveals();this.active=value;document.body.classList.toggle("observing",value);this.controls.hidden=!value;
    this.toggle.setAttribute("aria-pressed",String(value));this.toggle.textContent=value?"Zum Erklären":"Beobachten";
    this.nav.forEach((s,i)=>{s.textContent=value?neutral[i]:this.original[i];});el("sidebar")!.inert=value;this.root=null;this.update();
  }
  private build(){
    this.bindings=[];this.controls.replaceChildren();
    for(const id of [...Object.keys(selects),...Object.keys(inputs),...Object.keys(buttons),"g-progress","g-year"]){
      const source=el(id) as Field|null;if(!source||source.disabled||source.closest("[hidden]")&&id==="g-relocate")continue;
      if(id==="g-reset"&&el("g-before"))continue;
      let control:Field;
      if(source instanceof HTMLSelectElement){
        const s=document.createElement("select");s.setAttribute("aria-label",selects[id]);
        [...source.options].forEach((o,i)=>{const label=id==="pair-examples"&&o.value?o.text.split(" · ")[0]:id==="g-example"&&o.value&&!(o.parentElement instanceof HTMLOptGroupElement)?"Abschnitt "+o.value:id==="g-view"?views[o.value]:id==="g-stage"?"Zustand "+(i+1):id==="g-sea"?"Ereignis "+["B","A","C"][i]:o.text;
          s.add(new Option(label??o.text,o.value));});
        s.onchange=()=>{source.value=s.value;source.dispatchEvent(new Event("change"));};control=s;
      }else if(source instanceof HTMLInputElement&&source.type==="range"){
        const input=document.createElement("input");input.type="range";input.min=source.min;input.max=source.max;input.step=source.step;input.setAttribute("aria-label",id==="g-year"?"Geologische Zeit":"Modellzeit");
        input.oninput=()=>{source.value=input.value;source.dispatchEvent(new Event("input"));};control=input;
      }else{
        const b=document.createElement("button");b.textContent=inputs[id]??buttons[id];b.onclick=()=>{source.click();this.update();};control=b;
      }
      control.id=id==="g-launch"?"observe-region":id==="g-year"||id==="g-progress"?"observe-progress":"observe-"+id.slice(id.startsWith("g-")?2:0);
      control.dataset.from=id;this.controls.append(control);this.bindings.push({source,control});
    }
    const tools=document.createElement("details");tools.id="observe-release";
    tools.innerHTML='<summary>Informationen freigeben</summary><div class="reveal-actions">'+Object.entries(channels).map(([key,label])=>'<button data-channel="'+key+'">'+label+'</button>').join("")+'<button data-release="one">Ein Name mehr</button><button data-release="pick">Objekt antippen</button><button data-release="all">Alles zeigen</button><button data-release="none">Alles verbergen</button></div>';
    tools.onclick=e=>{const b=(e.target as Element).closest("button");if(!b)return;
      if(b.dataset.channel)reveal(b.dataset.channel as Channel);
      else if(b.dataset.release==="one")nextLabel();
      else if(b.dataset.release==="pick")document.body.setAttribute("data-choose-object","");
      else if(b.dataset.release==="all")revealAll();else resetReveals();this.update();};
    const insight=document.createElement("div");insight.id="observe-insight";this.controls.append(tools,insight);
    const keep=document.createElement("label"),box=document.createElement("input");box.type="checkbox";box.checked=this.retain;box.onchange=()=>this.retain=box.checked;keep.append(box," Freigaben beim Themenwechsel behalten");tools.append(keep);
    const note=document.createElement("small");note.id="observe-note";this.controls.append(note);
  }
  update(){
    if(!this.active)return;
    const subject=this.subject();if(subject!==this.currentSubject){if(!this.retain)resetReveals();this.currentSubject=subject;}
    const sidebar=el("sidebar")!,root=sidebar.firstChild;if(root!==this.root||!this.controls.childElementCount){this.root=root;this.build();}
    for(const {source,control} of this.bindings){
      if(source.id==="nyos-air")control.hidden=Boolean(source.closest("[hidden]"));
      if(control.disabled!==source.disabled)control.disabled=source.disabled;
      if(source instanceof HTMLInputElement&&source.type==="checkbox")control.setAttribute("aria-pressed",String(source.checked));
      else if(control instanceof HTMLSelectElement||control instanceof HTMLInputElement){if(control.value!==source.value)control.value=source.value;}
      else if(source.id==="g-cut")control.textContent=source.textContent;
      else if(source.id.endsWith("play")||source.id==="atlasPlay"||source.id==="playProcess")control.textContent=/Pause|Anhalten/.test(source.textContent??"")?"Pause":"Abspielen";
    }
    const mode=document.body.dataset.observatory,nav=el("desk")?.dataset.mode;
    const text=mode==="time"?[el("g-age")?.textContent,el("g-certainty")?.textContent].join(" · "):mode==="regional"?el("g-model-note")?.textContent??"Schematisches Modell · Modellzeit verkürzt":mode==="map"?(el("g-depth")?"Beobachtete Erdbeben · USGS 2019–2023":"Plattengrenzen · PB2002"):nav==="inside"?((el("scale") as HTMLInputElement)?.checked?"Äußere Schicht überhöht":"Radien im Referenzmaßstab"):nav==="nyos"?"Geländedaten · schematischer Ablauf":el("pair-process")?"Starre Ausschnitte · Bewegung und Zeit schematisch":"";
    for(const btn of this.controls.querySelectorAll<HTMLButtonElement>("[data-channel]")){const on=String(disclosed(btn.dataset.channel as Channel));if(btn.getAttribute("aria-pressed")!==on)btn.setAttribute("aria-pressed",on);}
    const readings=this.controls.dataset.lastReading===document.body.dataset.reveal&&!["regional","time"].includes(mode??"")&&this.readRoot===root&&nav!=="nyos"?undefined:Array.from(sidebar.querySelectorAll<HTMLElement>("[data-teach]")).filter(e=>disclosed(e.dataset.teach as Channel)).map(e=>e.textContent?.trim()).filter(Boolean);
    const chosen=chosenReading();
    if(readings&&chosen?.text&&document.querySelector('.annotations button[data-object="'+CSS.escape(chosen.id)+'"]'))readings.push(chosen.text);
    if(readings){const insight=el("observe-insight"),reading=readings.join(" · ");if(insight&&insight.textContent!==reading)insight.textContent=reading;this.readRoot=root;this.controls.dataset.lastReading=document.body.dataset.reveal;}
    const note=el("observe-note");if(note&&note.textContent!==text)note.textContent=text;
  }
}
