import type { Observatory } from "./panel";

const tasks:Record<string,string[]>={
  pair:["Beschreibe die Bewegung der beiden Platten anhand des hellen Streifens.","Vergleiche die Bewegungsrichtungen an drei Grenzen. Welche Landschaftsformen vermutest du?"],
  map:["Beschreibe die räumliche Verteilung der Erdbeben.","Vermute den Verlauf der Plattengrenzen. Prüfe deine Vermutung durch Einblenden der Grenzen."],
  earthquake:["Vergleiche den Weg vor und nach dem Beben.","Warum bebt die Erde plötzlich, obwohl die Platten sich langsam bewegen?"],
  sea:["Vergleiche die Bewegungen des Meeresbodens.","Vermute, bei welchem Ereignis eine Wasserwelle entsteht. Prüfe das Modell."],
  time:["Verfolge Indien über mehrere Zeitstationen. Beschreibe seine Bewegung.","Vergleiche zwei mögliche Kontinentalanordnungen. Welche Annahmen unterscheiden sich?"],
  risk:["Vergleiche zwei Standorte beim gleichen Modellbeben.","Welche Maßnahme empfiehlst du? Begründe und bedenke Kosten, Erreichbarkeit und Platzbedarf."],
  volcano:["Beobachte den Weg der Schmelze. Wo ändert sich ihre Bewegung?"],
  nyos:["Beschreibe, was sich im See und anschließend im Tal verändert.","Vergleiche die drei Vorsorgemaßnahmen. Wen können sie wie erreichen?"],
  inside:["Vergleiche Lage und Ausdehnung der sichtbaren Bereiche."],
  plates:["Untersuche zwei benachbarte Platten. Wo würdest du eine Grenze vermuten?"]
};
export function discussion(obs:Observatory){
 const bar=document.createElement("section");bar.id="discussion";bar.setAttribute("aria-label","Unterricht");
 bar.innerHTML='<button id="think" aria-expanded="false">Denkauftrag anzeigen</button><p id="think-text" hidden></p><button id="think-next" hidden>Weiterer Auftrag</button><button id="focus-reading" hidden>Erklärung im Fokus</button>';
 document.getElementById("desk")!.after(bar);
 const [toggle,next,focus]=bar.querySelectorAll("button"),line=bar.querySelector("p")!;
 let last="",index=0,open=false;
 const display=()=>{line.hidden=!open;line.textContent=open?tasks[last][index]:"";next.hidden=!open||tasks[last].length<2;
   toggle.textContent=open?"Denkauftrag verbergen":"Denkauftrag anzeigen";toggle.setAttribute("aria-expanded",String(open));};
 toggle.onclick=()=>{open=!open;display();};next.onclick=()=>{index=(index+1)%tasks[last].length;display();};
 focus.onclick=()=>{const on=document.body.classList.toggle("reading-focus");focus.textContent=on?"Kompakte Modellsteuerung":"Erklärung im Fokus";focus.setAttribute("aria-pressed",String(on));};
 return ()=>{
   const r=obs.region,s=obs.subject;
   const key=obs.mode==="time"?"time":obs.mode==="map"?"map":obs.mode==="regional"?r?.spec.coastLesson||r?.spec.event?"sea":obs.theme==="process"?"pair":obs.theme:document.querySelector("#pair-process")?"pair":document.getElementById("desk")!.dataset.mode??"";
   const available=Object.hasOwn(tasks,key);
   if(bar.hidden===available)bar.hidden=!available;
   if(last!==key||bar.dataset.subject!==s){last=key;bar.dataset.subject=s;open=false;index=0;if(available)display();}
   focus.hidden=!["regional","time"].includes(obs.mode)||document.body.classList.contains("observing");
 };
}
