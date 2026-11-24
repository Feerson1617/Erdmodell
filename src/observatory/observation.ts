const el=(id:string)=>document.getElementById(id);
const neutral=["Erde","Inneres","Karte","Ereignis","Berg","Siedlung","See","Orte"];
const actions:Record<string,string>={
  "g-cut":"Ansicht wechseln","g-play":"Abspielen","g-step":"Einzelschritt","g-reset":"Zurücksetzen",
  "g-time-play":"Abspielen","g-today":"Heute","g-time":"Zeit wählen","g-boundaries":"Linien wählen",
  "g-segment":"Öffnen","g-map":"Zur Karte","cut":"Ansicht wechseln","scale":"Größe vergleichen",
  "nyos-play":"Abspielen","nyos-reset":"Zurücksetzen","atlasPlay":"Abspielen","playProcess":"Abspielen"};
export class Observation{
  readonly toggle:HTMLButtonElement;private controls:HTMLElement;private key="";
  private original:string[]=[];active=false;
  constructor(){
    this.toggle=document.createElement("button");this.toggle.id="obswitch";this.toggle.textContent="Beobachten";this.toggle.setAttribute("aria-pressed","false");
    this.controls=document.createElement("section");this.controls.id="observation-controls";this.controls.hidden=true;this.controls.setAttribute("aria-label","Beobachtungssteuerung");
    document.querySelector(".view")!.append(this.toggle,this.controls);
    const nav=[...document.querySelectorAll("header nav button span")];this.original=nav.map(s=>s.textContent!);
    this.toggle.onclick=()=>{
      this.active=!this.active;document.body.classList.toggle("observing",this.active);this.controls.hidden=!this.active;
      this.toggle.setAttribute("aria-pressed",String(this.active));this.toggle.textContent=this.active?"Zum Erklären":"Beobachten";this.key="";
      nav.forEach((s,i)=>{s.textContent=this.active?neutral[i]:this.original[i];});(el("sidebar") as HTMLElement).inert=this.active;
      this.update();
    };
    this.controls.onclick=e=>{const b=(e.target as HTMLElement).closest<HTMLButtonElement>("button[data-from]");if(b)el(b.dataset.from!)?.click();};
  }
  update(){
    if(!this.active)return;
    const nav=el("desk")?.dataset.mode,mode=document.body.dataset.observatory,area=(el("g-site") as HTMLSelectElement)?.value??"";
    const candidates=Object.keys(actions).filter(id=>el(id));const range=el("g-progress") as HTMLInputElement??el("g-year") as HTMLInputElement;
    const key=[nav,mode,area,...candidates,range?.id].join("/");
    if(key!==this.key){
      this.key=key;this.controls.replaceChildren();
      if(mode==="map"&&el("g-launch")){
        const select=(el("g-launch") as HTMLSelectElement).cloneNode(true) as HTMLSelectElement;select.id="observe-region";select.setAttribute("aria-label","Ort wählen");
        select.onchange=()=>{const source=el("g-launch") as HTMLSelectElement;source.value=select.value;source.dispatchEvent(new Event("change"));};this.controls.append(select);
      }
      for(const id of candidates){const b=document.createElement("button");b.dataset.from=id;b.textContent=actions[id];this.controls.append(b);}
      if(range){const s=range.cloneNode() as HTMLInputElement;s.id="observe-progress";s.setAttribute("aria-label","Modellzeit");s.oninput=()=>{const input=el(range.id) as HTMLInputElement;input.value=s.value;input.dispatchEvent(new Event("input"));};this.controls.append(s);}
      const note=document.createElement("small");note.id="observe-note";this.controls.append(note);
    }
    for(const id of ["g-play","g-time-play","nyos-play","atlasPlay","playProcess"]){const b=this.controls.querySelector('[data-from="'+id+'"]');if(b)b.textContent=/Pause|Anhalten/.test(el(id)?.textContent??"")?"Pause":"Abspielen";}
    const slider=el("observe-progress") as HTMLInputElement;if(slider&&range&&document.activeElement!==slider)slider.value=range.value;
    const note=el("observe-note");if(note)note.textContent=mode==="time"?(el("g-certainty")?.textContent??""):mode==="regional"?"Gelände und schematischer Untergrund · Modellzeit verkürzt":nav==="inside"?((el("scale") as HTMLInputElement)?.checked?"Äußere Schicht überhöht":"Radien im Referenzmaßstab"):mode==="map"?"Dokumentierte Beobachtungen · USGS, 2019–2023":nav==="nyos"?"Geländedaten · schematischer Ablauf":"";
  }
}

