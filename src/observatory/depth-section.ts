import events from "./japan-events.json";
import miyagi from "./miyagi.json";

export function depthSection(){
  const left=-480,right=160,bottom=160;
  const X=(km:number)=>44+(km-left)/(right-left)*420,Y=(km:number)=>18+km/bottom*220;
  const dots=events.map(row=>'<circle cx="'+X(Number(row[1])).toFixed(2)+'" cy="'+Y(Number(row[2])).toFixed(2)+'" r="2.7" fill="#ffd599"><title>'+row[5]+' · '+row[2]+' km · '+row[0]+'</title></circle>').join("");
  const line=miyagi.map(([x,z])=>X(x*320/12).toFixed(1)+','+Y(z).toFixed(1)).join(' ');
  const depths=[0,40,80,120,160].map(k=>'<path d="M44 '+Y(k)+'h420" stroke="#49615e"/><text x="38" y="'+(Y(k)+5)+'" text-anchor="end">'+k+'</text>').join("");
  return '<details id="g-depth-section"><summary>Gemessene Beben im Tiefenschnitt</summary><figure><svg viewBox="0 0 480 267" role="img" aria-label="Japan. Gefüllte Punkte sind gemessene Erdbeben. Nach Westen liegen viele Herde tiefer." fill="#e1e8db" font-size="13">'+depths+dots+'<polyline points="'+line+'" stroke="#76d5c6" stroke-width="2.5" fill="none"/><text x="44" y="258">Landseite · West</text><text x="464" y="258" text-anchor="end">Meer · Ost</text></svg><figcaption>Tiefe in km. Punkte sind gemessene Erdbeben. Die türkise Linie folgt einem seismischen Profil. Blick quer zum Graben.</figcaption></figure><small>USGS · 2019–2023 · Magnitude ab 4,5. '+events.length+' Herde aus einem 200 km breiten Streifen sind auf eine Ebene projiziert.</small></details>';
}
