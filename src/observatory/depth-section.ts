import events from "./japan-events.json";
import miyagi from "./miyagi.json";

function diagram(profile:boolean,depths:boolean){
  const X=(km:number)=>54+(km+410)/560*836,Y=(km:number)=>34+km*2.5;
  const grid=depths?[0,40,80,120,160].map(k=>'<path d="M54 '+Y(k)+'h836" stroke="#425858"/><text x="44" y="'+(Y(k)+5)+'" text-anchor="end">'+k+'</text>').join(""):"";
  const dots=events.map(r=>'<circle cx="'+X(Number(r[1])).toFixed(2)+'" cy="'+Y(Number(r[2])).toFixed(2)+'" r="4.8" fill="#ffd17b" stroke="#65492b" stroke-width=".8"><title>'+r[5]+' · '+r[2]+' km</title></circle>').join("");
  const line=profile?'<polyline fill="none" stroke="#6edacf" stroke-width="4" points="'+miyagi.map(([x,km])=>X(x*320/12).toFixed(1)+','+Y(km).toFixed(1)).join(' ')+'"/>':"";
  return '<svg viewBox="0 0 930 486" role="img" aria-label="Gemessene Erdbeben im Tiefenschnitt von West nach Ost" fill="#e4ece2" font-size="20">'+grid+dots+line+'<text x="54" y="473">West · Honshū</text><text x="890" y="473" text-anchor="end">Ost · Pazifik</text></svg>';
}
export function depthSection(){
  return '<button id="g-depth-open">Tiefenschnitt groß zeigen</button><details id="g-depth-section"><summary>Gemessene Beben im Tiefenschnitt</summary><figure>'+diagram(false,false)+'<figcaption>Jeder Punkt steht für ein gemessenes Beben.</figcaption></figure></details>';
}
export function openDepthSection(compare:()=>void){
  const dialog=document.createElement("dialog");dialog.className="depth-analysis";dialog.setAttribute("aria-label","Erdbeben vor Japan");
  dialog.innerHTML='<header><div><small>Messdaten · Tōhoku</small><h2>Erdbeben vor Japan</h2></div><button id="depth-close" aria-label="Schließen">Schließen</button></header><div class="depth-plot"></div><div class="depth-key"><span>● Katalogbeben</span><label><input id="depth-line" type="checkbox"> Seismisches Profil</label><label><input id="depth-values" type="checkbox"> Tiefe in km</label><button id="depth-model">Zum 3D-Schnitt</button></div><p>176 USGS-Katalogbeben aus den Jahren 2019–2023, auf einen 200 km breiten Streifen projiziert. Die zuschaltbare Linie verbindet 13 unabhängige Tiefenmessungen aus dem Miyagi-Profil.</p>';
  document.body.append(dialog);
  const plot=()=>{dialog.querySelector(".depth-plot")!.innerHTML=diagram(dialog.querySelector<HTMLInputElement>("#depth-line")!.checked,dialog.querySelector<HTMLInputElement>("#depth-values")!.checked);};
  dialog.onchange=plot;dialog.querySelector<HTMLButtonElement>("#depth-close")!.onclick=()=>dialog.close();
  dialog.querySelector<HTMLButtonElement>("#depth-model")!.onclick=()=>{dialog.close();compare();};
  dialog.onclose=()=>dialog.remove();plot();dialog.showModal();
}
