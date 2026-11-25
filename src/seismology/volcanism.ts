import * as T from "three";
import {Stage,vec} from "./stage";
import {intrusion} from "./geology";

export const ramp=(x:number,a:number,b:number)=>T.MathUtils.smoothstep(x,a,b);

export function plumbing(s:Stage){
  intrusion(s);
  s.duration=22;
  if(s.view==="storage"){
    s.label(vec(-1.4,-2.2,.3),"Kristallreicher Bereich");
    s.explain(t=>t<.45?"Ein Teil des Gesteins schmilzt. Kristalle und Schmelze liegen nebeneinander.":"Dichteunterschiede und Überdruck begünstigen den Aufstieg durch Gänge. Magma kann im Gestein erstarren.");
    return;
  }
  const wet=s.view==="contact";
  const knots=wet?[vec(3,-.53,.21),vec(1.65,-.48,.21),vec(.25,-.39,.21)]:[vec(-.35,-1.6,.25),vec(.18,-.78,.25),vec(.64,-.51,.25),vec(.73,.46,.25),vec(1.12,1.45,.25)];
  const path=new T.CatmullRomCurve3(knots);
  if(wet)s.box(1.65,-.55,.10,2.85,.19,.15,0x508ea1,"Grundwasserleiter");
  else s.line(knots,0xa9aca0,"Kluft");
  const bubbles=Array.from({length:27},()=>s.dot(vec(),wet?0xb5ddeb:0xe4d2b2,.065,wet?"Porenwasser":"Gas · Analysefarbe"));
  const fragments=Array.from({length:38},(_,i)=>s.mesh(new T.DodecahedronGeometry(.035+(i%5)*.014),i%3?0xb59a7b:0x655b54,"Fragment"));
  s.animate(t=>{
    bubbles.forEach((o,i)=>{const a=(t*1.7+i/27)%1;path.getPointAt(a,o.position);o.position.x+=Math.sin(i*3.1)*.045;o.visible=t>.10;o.scale.setScalar(.5+a);});
    fragments.forEach((o,i)=>{const a=(t-.48)*2.5-i%4*.035;o.visible=wet&&a>0&&a<1;o.position.set(.25+Math.cos(i*2.4)*a*2,-.38+6*a*(1-a),.3+Math.sin(i)*a*.4);});
  });
  s.label(knots[0],wet?"Wasserführende Schicht":"Gasführende Schmelze");
  s.label(knots[knots.length-1],wet?"Kontaktzone":"Gasaustritt",wet?"Wärmeübertragung und mögliche Fragmentierung":"Analysefarbe für unsichtbare Gase");
  s.explain(t=>wet?(t<.48?"Externes Grundwasser nähert sich dem aufsteigenden Magma.":"Bei engem Kontakt kann Wasser rasch verdampfen. Expansion kann Magma und Nebengestein zerbrechen."):
   "Bei sinkendem Druck können H₂O, CO₂ und SO₂ aus der Schmelze austreten. Gase wandern auch in Ruhephasen durch Klüfte. CO₂ ist unsichtbar; die Punkte markieren seinen Weg.");
}
