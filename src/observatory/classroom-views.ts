import {readableView} from "./validate-view";
import type {Observatory} from "./panel";
import type {Observation} from "./observation";

const examples=["Erdbeben der Erde","Erdbeben und Plattengrenzen","Kalifornien von oben","Blockierte Störung","Plötzlicher Versatz","Wellenausbreitung","Subduktion vor Japan","Seebeben und Tsunami"];
const key="georisiko.unterrichtsansichten.v1";
export function classroomViews<Base>(observatory:Observatory,observation:Observation,base:()=>Base,restoreBase:(b:Base)=>Promise<void>){
  type Entry={name:string;scene:ReturnType<Observatory["snapshot"]>;observing:boolean;base:Base};
  const trigger=document.getElementById("saved-views")!;
  const dialog=document.createElement("dialog");dialog.className="classroom-views";dialog.setAttribute("aria-labelledby","views-title");
  dialog.innerHTML='<h2 id="views-title">Unterrichtsansichten</h2><label>Ansicht auswählen<select id="saved-list" size="8"></select></label><div class="g-buttons"><button id="view-apply">Ansicht öffnen</button><button id="view-remove">Löschen</button></div><label>Aktuelle Ansicht speichern<input id="view-name" maxlength="64" placeholder="Eigener Name"></label><div class="g-buttons"><button id="view-save">Lokal speichern</button><button id="view-close">Schließen</button></div><small role="status"></small>';
  document.body.append(dialog);
  const get=<E extends HTMLElement>(id:string)=>dialog.querySelector<E>("#"+id)!;
  const list=get<HTMLSelectElement>("saved-list"),name=get<HTMLInputElement>("view-name"),status=dialog.querySelector("small")!;
  let entries:Entry[]=[];
  const render=(selected="p0")=>{
    list.replaceChildren();examples.forEach((label,i)=>list.add(new Option(label,"p"+i)));entries.forEach((e,i)=>list.add(new Option(e.name,"s"+i)));
    list.value=selected;get<HTMLButtonElement>("view-remove").disabled=!selected.startsWith("s");
  };
  const persist=(next:Entry[])=>{try{localStorage.setItem(key,JSON.stringify(next));entries=next;return true;}catch{status.textContent="Der lokale Speicher ist für diese Datei nicht verfügbar oder voll.";return false;}};
  trigger.onclick=()=>{
    status.textContent="Eigene Ansichten bleiben auf diesem Gerät.";entries=[];
    try{const stored=JSON.parse(localStorage.getItem(key)??"[]");if(!Array.isArray(stored))throw Error();entries=stored.filter(readableView);if(entries.length<stored.length)status.textContent="Einzelne gespeicherte Ansichten waren beschädigt oder stammen aus einer unbekannten Version.";}
    catch{status.textContent="Gespeicherte Ansichten konnten nicht gelesen werden.";}
    name.value="";render();dialog.showModal();
  };
  list.onchange=()=>{get<HTMLButtonElement>("view-remove").disabled=!list.value.startsWith("s");};
  get("view-close").onclick=()=>dialog.close();
  get("view-save").onclick=()=>{
    const label=name.value.trim();if(!label){name.focus();return;}
    const entry={format:1,name:label,scene:observatory.snapshot(),observing:observation.active,base:base()};
    if(entry.scene.mode==="regional"&&!entry.scene.region){status.textContent="Das Gelände wird noch geladen.";return;}
    if(persist([...entries,entry])){render("s"+(entries.length-1));status.textContent="Ansicht gespeichert.";name.value="";}
  };
  get("view-remove").onclick=()=>{const index=Number(list.value.slice(1));if(list.value.startsWith("s")&&persist(entries.filter((_,i)=>i!==index)))render();};
  get("view-apply").onclick=async()=>{
    const select=list.value,i=Number(select.slice(1));dialog.inert=true;
    try{
      if(select.startsWith("p")){await observatory.preset(i);observation.set(true);}
      else{const entry=entries[i];if(!entry.scene.mode)await restoreBase(entry.base);await observatory.restore(entry.scene);observation.set(entry.observing);}
      dialog.close();
    }catch{status.textContent="Die gespeicherte Ansicht konnte nicht geöffnet werden.";}
    finally{dialog.inert=false;}
  };
  list.ondblclick=()=>get("view-apply").click();
}
