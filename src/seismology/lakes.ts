import * as T from "three";
import {Stage,vec} from "./stage";
import {localAsset} from "../assets";
import local from "./ulmen-dsm.json";
import regional from "./eifel-dsm.json";
import {ramp} from "./volcanism";

export function eifelTerrain(s:Stage){
 const wide=s.view==="eifel",vertical=s.view==="aerial",d=wide?regional:local;
 const width=10, depth=width*d.depth/d.width, min=Math.min(...d.values), relief=wide?4:1.6;
 const at=(i:number,j:number)=>width*(d.values[j*d.n+i]-min)*relief/d.width;
 const g=new T.PlaneGeometry(width,depth,d.n-1,d.n-1);g.rotateX(-Math.PI/2);
 const pos=g.attributes.position;for(let j=0;j<d.n;j++)for(let i=0;i<d.n;i++)pos.setY(j*d.n+i,at(i,j));
 g.computeVertexNormals();const m=s.mesh(g,0xffffff,"Georeferenziertes Oberflächenmodell"),mat=m.material as T.MeshStandardMaterial;
 const texture=new T.TextureLoader().load(localAsset("data/vulkaneifel/"+(wide?"eifel":"ulmen")+".webp"),()=>{if(!s.disposed)s.refresh()});
 texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;mat.map=texture;mat.roughness=.94;
 const pin=(lon:number,lat:number,name:string)=>{const [w,south,e,n]=d.box,u=(lon-w)/(e-w),v=(n-lat)/(n-south);s.label(vec((u-.5)*width,at(Math.round(u*(d.n-1)),Math.round(v*(d.n-1)))+.08,(v-.5)*depth),name);};
 if(wide){pin(6.9828,50.2106,"Ulmener Maar");pin(6.835,50.167,"Gemündener Maar");pin(6.861,50.157,"Schalkenmehrener Maar");pin(7.27,50.412,"Laacher See · Caldera");}
 else {pin(6.9828,50.2106,"Ulmener Maar");pin(6.9794,50.2097,"Ulmen · Ortskern");pin(6.9816,50.2090,"Burgberg");}
 s.look(vertical?0:2.4,vertical?14:8,vertical?.01:9,.30);s.halfWidth=5.8;s.halfHeight=4;
 s.explain(()=>wide?"Vulkanfelder innerhalb der Eurasischen Platte. Mantelanomalien und tiefe Beben liefern Hinweise auf magmatische Prozesse. Die genaue Ursache bleibt Gegenstand der Forschung.":"Amtliches Orthofoto auf Copernicus-Oberflächenmodell. Ufer, Bebauung und Wald sind georeferenziert. Die Uferlinie folgt dem Luftbild.");
}
const depths={ulmen:38,nyos:208};
export const lakeEvidence=[
 ["Lage","Ulmen · Deutschland, 50,21° N","Nyos · Kamerun, 6,44° N"],
 ["Klima","Gemäßigt; jahreszeitliche Erwärmung und Abkühlung","Tropisches Hochland; Regen- und Trockenzeit"],
 ["Entstehung","Phreatomagmatisches Maar, rund 10.900 Jahre","Vulkanischer Kratersee der Kamerunlinie"],
 ["Tiefe","38 m laut LfU-Stammdaten; weitere Angaben 35 und 39 m","Rund 208 m"],
 ["Schichtung","LfU: meromiktisch. Wind erreicht das Tiefenwasser nur begrenzt.","Stabile Dichteunterschiede begünstigten die Gasspeicherung."],
 ["Wasserchemie","LfU beschreibt starke Eutrophierung.","Gelöste Stoffe und CO₂ beeinflussen die Dichte."],
 ["CO₂-Zufuhr","Lokale CO₂-Zufuhr ins Tiefenwasser: Keine belastbaren Daten verfügbar","Tiefes CO₂ gelangt über Zuflüsse ins Becken."],
 ["Gasgehalt und Sättigung","Keine belastbaren Daten verfügbar","Historische Tiefenprofile belegen gelöstes CO₂. Zeit und Tiefe sind entscheidend."],
 ["Beobachtung","Angeln und Trinkwassergewinnung durch Uferfiltration","Limnische Eruption am 21. August 1986"],
 ["Gelände und Siedlungen","Siedlung Ulmen am Kraterrand","Täler unterhalb des Sees mit betroffenen Siedlungen"],
 ["Überwachung","LfU-Seenmessstelle; keine lokale CO₂-Zeitreihe im Modell","Tiefenprofile und kontrollierte Entgasung seit 2001"]
];
function basin(s:Stage,cx:number,width:number,depth:number,top:number,c:number,name:string){
 const shape=new T.Shape();shape.moveTo(-width/2,0);
 for(let i=0;i<=72;i++){const x=i/36-1;shape.lineTo(x*width/2,-depth*Math.max(0,1-x*x)**.69);}
 shape.lineTo(width/2,0);shape.closePath();
 const o=s.mesh(new T.ExtrudeGeometry(shape,{depth:.74,bevelEnabled:false}),c,name);
 o.position.set(cx,top,-.45);return o;
}
export function lakeSection(s:Stage){
 const compare=s.view==="lakeCompare",mix=["mixing","turnover"].includes(s.view),gas=s.view==="dissolved";
 s.look(.7,2.1,14,-.14);s.halfWidth=5.9;s.halfHeight=2.55;
 if(compare){
  const scale=.0043;
  for(const [cx,w,dep,name] of [[-4.25,340,depths.ulmen,"Ulmener Maar"],[1.05,1800,depths.nyos,"Nyos"]] as const){
   basin(s,cx,w*scale,dep*scale,.6,0x458c99,name);s.label(vec(cx,.6,.34),name,dep+" m");
   s.line([vec(cx,.59,.35),vec(cx,.6-dep*scale,.35)],0xe7d49a,"Tiefe");
  }
  s.line([vec(-4.55,-.95,.35),vec(-4.55+100*scale,-.95,.35)],0xffd998,"100 m");
  s.label(vec(-4.35,-.95,.35),"100 m","Gemeinsamer Horizontal- und Tiefenmaßstab");
  const panel=document.createElement("section");panel.className="lake-evidence";
  const field=document.createElement("select");field.setAttribute("aria-label","Vergleichsmerkmal");
  lakeEvidence.forEach(([label],i)=>field.add(new Option(label,String(i))));
  const columns=["Ulmener Maar","Nyos"].map(name=>{const article=document.createElement("div"),heading=document.createElement("strong"),value=document.createElement("span");heading.textContent=name;article.append(heading,value);return {article,value};});
  panel.append(field,...columns.map(c=>c.article));s.root.append(panel);
  field.onchange=()=>{s.playing=false;s.time=(Number(field.value)+.25)/lakeEvidence.length;s.refresh();};
  let previous=-1;s.animate(t=>{const i=Math.min(lakeEvidence.length-1,Math.floor(t*lakeEvidence.length));if(i===previous)return;previous=i;field.value=String(i);columns.forEach((c,j)=>c.value.textContent=lakeEvidence[i][j+1]);});
  s.duration=55;return;
 }
 const dep=2.35,w=8.65,top=1.08;
 if(s.view==="lakeCut"){
  // Horizons terminate at the lake floor. Their geometry is explicitly conceptual.
  const bed=(x:number)=>Math.abs(x)<=w/2?top-dep*Math.max(0,1-(2*x/w)**2)**.69:top+.35*Math.sin((Math.abs(x)-w/2)*3);
  for(let j=0;j<5;j++){
   const rock=new T.Shape();
   for(let i=0;i<=100;i++){const x=i*.106-5.3,y=bed(x)-j*.23;i?rock.lineTo(x,y):rock.moveTo(x,y);}
   for(let i=100;i>=0;i--){const x=i*.106-5.3;rock.lineTo(x,bed(x)-(j+1)*.23);}
   rock.closePath();const layer=s.mesh(new T.ExtrudeGeometry(rock,{depth:.9,bevelEnabled:false}),[0x907754,0xb19d7b,0x766e5e,0x8e7663,0x67574e][j],"Idealisierter Untergrund");layer.position.z=-.52;
  }
  s.label(vec(4.64,1.35,.38),"Kraterrand","Gesteinsschichten schematisch");
 }
 basin(s,0,w,dep,top,0x296375,"Idealisiertes Becken");
 const layer=(level:number,thickness:number,color:number,name:string)=>{
  const shape=new T.Shape();for(let k=0;k<2;k++){for(let i=0;i<=48;i++){
   const d=level+thickness*(k?1-i/48:i/48),x=(k?1:-1)*w/2*Math.sqrt(Math.max(0,1-d**(1/.69)));
   if(!i&&!k)shape.moveTo(x,top-dep*d);else shape.lineTo(x,top-dep*d);}}
  shape.closePath();return s.mesh(new T.ShapeGeometry(shape),color,name);
 };
 for(let i=0;i<16;i++){const band=layer(i/16,1/16,new T.Color().setHSL(.51+i*.002,.35,.52-i*.016).getHex(),"Wasserschicht");band.position.z=.31;}
 s.label(vec(-2.6,.93,.37),"Oberflächenwasser");s.label(vec(.25,-.94,.37),"Tiefenwasser","dichter und schwach durchmischt");
 if(mix||gas){
 const tracers=Array.from({length:56},(_,i)=>s.dot(vec(),gas?0xc7a8d7:0xd8e8bb,.034,gas?"Gelöstes CO₂ · Konzentrationsmarker":"Wasserbewegung"));
 s.animate(t=>tracers.forEach((o,i)=>{const a=i*2.4+t*6.28;
  if(gas){o.visible=i<8+t*48;o.position.set(Math.cos(i*3.7)*(1.1+.95*Math.sin(i)**2),-.35-.57*Math.sin(i*1.8)**2,.38);}
  else {const autumn=.5-.5*Math.cos(t*6.28);const deep=s.view==="turnover"?autumn:0;
    o.position.set(Math.cos(a)*(1.4+i%4*.40),.76-deep*.78+Math.sin(a)*(.12+.18*autumn+.58*deep),.38);}
 }));
 }
 if(s.view==="turnover")s.explain(t=>t>.28&&t<.74?"Mit ähnlichen Dichten kann Wind Wasser bis in die Tiefe mischen. Pfeilfreie Spuren markieren Wasserteilchen.":"Süßwasser ist nahe 4 °C am dichtesten. Im Sommer liegt warmes, leichteres Wasser über kühlerem Wasser.");
 else s.explain(t=>mix?"Die obere Wasserschicht kann sich jahreszeitlich durchmischen. Gelöste Stoffe können das Tiefenwasser dauerhaft dichter halten. Stabile Schichtung allein belegt keine CO₂-Anreicherung.":gas?"Die Analysepunkte stehen für im Wasser gelöstes CO₂. Druck begünstigt die Lösung. Das qualitative Beispiel enthält keine Ulmener Konzentrationsmessungen.":"Ulmener Maar · idealisierter Schnitt an der tiefsten Stelle. LfU-Stammdaten: 38 m. Profil und vertikale Überhöhung dienen der Anschauung.");
}
