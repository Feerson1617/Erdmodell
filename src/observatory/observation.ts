const el=(id:string)=>document.getElementById(id);
const neutral=["Erde","Inneres","Karte","Ereignis","Berg","Siedlung","See","Orte"];
const buttons:Record<string,string>={
  "g-play":"Abspielen","g-step":"Schritt","g-before":"Vorher","g-after":"Nachher","g-reset":"Zurücksetzen",
  "g-time-play":"Abspielen","g-reverse":"Rückwärts","g-today":"Heute","g-time":"Zeit wählen","g-boundaries":"Linien wählen",
  "g-quake-explain":"Ereignis öffnen","g-quake-from-process":"Ereignis öffnen","g-cut":"Untergrund","g-segment":"Modell öffnen","g-map":"Zur Karte","g-map-overview":"Weltübersicht","g-depth-open":"Messpunkte im Schnitt",
  "cut":"Ansicht wechseln","scale":"Größe vergleichen","nyos-play":"Abspielen","nyos-reset":"Zurücksetzen","atlasPlay":"Abspielen","playProcess":"Abspielen"};
const inputs:Record<string,string>={"g-water-profile":"Wasserprofil","g-detail":"Teilchen","g-compare":"Vergleich","g-future-lines":"Modellgrenzen","g-protect":"Bauweise","g-route":"Fluchtweg","g-warning":"Warnung","g-relocate":"Höherer Standort","g-quakes":"Ereignispunkte","g-lines":"Grenzlinien","g-depth":"Tiefe","g-stress":"Spannung","g-vectors":"Bewegungspfeile","g-p":"P · gold","g-s":"S · türkis","g-follow":"Kamera folgt","g-trail":"Spur"};
const selects:Record<string,string>={"g-example":"Grenzabschnitt","g-second":"Zweites Zeitmodell","g-risk-kind":"Gefahr","g-risk-site":"Standort","g-soil":"Baugrund","g-exposure":"Besiedlung","g-launch":"Ort","g-site":"Region","g-view":"Ansicht","g-stage":"Zustand","g-sea":"Meeresereignis","g-scenario":"Zeitmodell","g-station":"Zeitsprung","g-track":"Bereich verfolgen"};
const views:Record<string,string>={land:"Regionalübersicht",local:"Nahmodell",ground:"Bodennah",overhead:"Von oben",cut:"Untergrund",fault:"Kontakt",focus:"Ausgangspunkt",waves:"Ausbreitung",water:"Meeresboden",ocean:"Offenes Meer",coast:"Küste · Modell",vent:"Detail"};
type Field=HTMLButtonElement|HTMLSelectElement|HTMLInputElement;
export class Observation{
  readonly toggle=document.createElement("button");private controls=document.createElement("section");active=false;
  private bindings:{source:Field;control:Field}[]=[];private root:Node|null=null;private readonly nav=[...document.querySelectorAll("header nav button span")];
  private readonly original=this.nav.map(s=>s.textContent!);
  constructor(){
    this.toggle.id="obswitch";this.toggle.textContent="Beobachten";this.toggle.setAttribute("aria-pressed","false");
    this.controls.id="observation-controls";this.controls.hidden=true;this.controls.setAttribute("aria-label","Beobachtungssteuerung");
    document.querySelector(".view")!.append(this.toggle,this.controls);this.toggle.onclick=()=>this.set(!this.active);
  }
  set(value:boolean){
    this.active=value;document.body.classList.toggle("observing",value);this.controls.hidden=!value;
    this.toggle.setAttribute("aria-pressed",String(value));this.toggle.textContent=value?"Zum Erklären":"Beobachten";
    this.nav.forEach((s,i)=>{s.textContent=value?neutral[i]:this.original[i];});el("sidebar")!.inert=value;this.root=null;this.update();
  }
  private build(){
    this.bindings=[];this.controls.replaceChildren();
    for(const id of [...Object.keys(selects),...Object.keys(inputs),...Object.keys(buttons),"g-progress","g-year"]){
      const source=el(id) as Field|null;if(!source||source.closest("[hidden]")&&id==="g-relocate")continue;
      if(id==="g-reset"&&el("g-before"))continue;
      let control:Field;
      if(source instanceof HTMLSelectElement){
        const s=document.createElement("select");s.setAttribute("aria-label",selects[id]);
        [...source.options].forEach((o,i)=>{const label=id==="g-example"&&o.value&&!(o.parentElement instanceof HTMLOptGroupElement)?"Abschnitt "+o.value:id==="g-view"?views[o.value]:id==="g-stage"?"Zustand "+(i+1):id==="g-sea"?"Ereignis "+["B","A","C"][i]:o.text;
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
    const note=document.createElement("small");note.id="observe-note";this.controls.append(note);
  }
  update(){
    if(!this.active)return;
    const sidebar=el("sidebar")!,root=sidebar.firstChild;if(root!==this.root||!this.controls.childElementCount){this.root=root;this.build();}
    for(const {source,control} of this.bindings){
      if(source instanceof HTMLInputElement&&source.type==="checkbox")control.setAttribute("aria-pressed",String(source.checked));
      else if(control instanceof HTMLSelectElement||control instanceof HTMLInputElement){if(control.value!==source.value)control.value=source.value;}
      else if(source.id==="g-cut")control.textContent=source.textContent;
      else if(source.id.endsWith("play")||source.id==="atlasPlay"||source.id==="playProcess")control.textContent=/Pause|Anhalten/.test(source.textContent??"")?"Pause":"Abspielen";
    }
    const mode=document.body.dataset.observatory,nav=el("desk")?.dataset.mode;
    const text=mode==="time"?[el("g-age")?.textContent,el("g-certainty")?.textContent].join(" · "):mode==="regional"?el("g-model-note")?.textContent??"Schematisches Modell · Modellzeit verkürzt":mode==="map"?(el("g-depth")?"Beobachtete Erdbeben · USGS 2019–2023":"Plattengrenzen · PB2002"):nav==="inside"?((el("scale") as HTMLInputElement)?.checked?"Äußere Schicht überhöht":"Radien im Referenzmaßstab"):nav==="nyos"?"Geländedaten · schematischer Ablauf":"";
    const note=el("observe-note");if(note&&note.textContent!==text)note.textContent=text;
  }
}
