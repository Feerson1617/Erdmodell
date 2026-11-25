import {geology, type Process} from "../observatory/boundaries";
import locations from "../observatory/geographic-examples.json";
import references from "../observatory/reference-steps.json";
import examples from "./examples.json";
import {names,type Step} from "./atlas";

type Account={term:string;motion:string;watch:string;cause:string;effects:string;detail:string};
export const accounts:Record<Process,Account>={
 ridge:{term:"Divergenz",motion:"Zwei Erdplatten bewegen sich voneinander weg.",watch:"Der Abstand der Gesteinsausschnitte wächst.",cause:"Heißes, festes Mantelgestein steigt am Rücken auf. Der Druck sinkt. Ein Teil des Gesteins schmilzt.",effects:"Neue ozeanische Kruste, Vulkanismus und flache Erdbeben.",detail:"Die Schmelze steigt in Spalten auf. Beim Abkühlen erstarrt sie."},
 rift:{term:"Divergenz im kontinentalen Graben",motion:"Zwei Bereiche eines Kontinents driften auseinander.",watch:"Die beiden Seiten entfernen sich voneinander.",cause:"Die Bewegung dehnt die Kruste. Entlang schräger Störungen können Gesteinsblöcke absinken.",effects:"Gräben, Erdbeben und örtlich Vulkanismus.",detail:"Die Dehnung kann wieder enden. Nur aus manchen Gräben entwickelt sich ein Ozean."},
 subduction:{term:"Konvergenz und Subduktion",motion:"Zwei Platten bewegen sich aufeinander zu.",watch:"Die Gesteinsausschnitte nähern sich.",cause:"Dichte ozeanische Lithosphäre kann in den Mantel sinken und die Platte nachziehen.",effects:"Tiefseegräben, Erdbeben und Vulkanismus. Eine starke Wasserverlagerung kann einen Tsunami auslösen.",detail:"Wasserhaltige Stoffe aus der abtauchenden Platte erleichtern das teilweise Schmelzen des Mantels darüber. An einem blockierten Kontakt kann sich Spannung aufbauen."},
 arc:{term:"Konvergenz am Inselbogen",motion:"Zwei ozeanische Platten nähern sich.",watch:"Der Abstand zwischen den beiden Ausschnitten schrumpft.",cause:"Eine Platte sinkt ab. Freigesetztes Wasser erleichtert das Schmelzen im Mantel darüber.",effects:"Tiefseegraben, Vulkaninseln, Erd- und Seebeben.",detail:"Vulkane können über lange Zeit über die Meeresoberfläche hinauswachsen. So entsteht ein Inselbogen."},
 collision:{term:"Kontinentkollision",motion:"Zwei Kontinentalbereiche bewegen sich aufeinander zu.",watch:"Die beiden starren Ausschnitte rücken zusammen.",cause:"Kontinentales Gestein ist relativ leicht. Bei der Annäherung schieben sich Gesteinspakete übereinander.",effects:"Die Kruste kann dicker werden. Gebirge wachsen, Erdbeben sind möglich.",detail:"Die Hebung und die Abtragung wirken über Millionen Jahre. Der starre Vergleich zeigt nur die Annäherung."},
 convergence:{term:"Konvergenz",motion:"Die beiden Platten bewegen sich aufeinander zu.",watch:"Der Abstand quer zur Grenze wird kleiner.",cause:"Die Plattenbewegung drückt Gestein zusammen. Die Verformung kann sich auf mehrere Störungen verteilen.",effects:"Verkürzung der Kruste und Erdbeben.",detail:"Aus den globalen Bewegungsdaten allein lässt sich hier keine abtauchende Platte bestimmen."},
 transform:{term:"Transformbewegung",motion:"Zwei Platten gleiten seitlich aneinander vorbei.",watch:"Der helle Gesteinsstreifen verschiebt sich auf den beiden Seiten.",cause:"Ein Störungsabschnitt kann festhalten, während sich die Platten weiterbewegen. Das Gestein verformt sich.",effects:"Löst sich die Verhakung, kann ein Erdbeben entstehen.",detail:"An einer idealen Transformgrenze bleibt die Lithosphäre erhalten."},
 oceanTransform:{term:"Transformbewegung am Meeresboden",motion:"Gestein am Meeresboden verschiebt sich überwiegend seitlich.",watch:"Der helle Streifen wird entlang der Grenze versetzt.",cause:"Beide Platten bewegen sich entlang einer Störung. Zeitweise können Abschnitte festhalten.",effects:"Seebeben. Ohne erhebliche Wasserverlagerung entsteht meist kein großer Tsunami.",detail:"Eine durch ein Beben ausgelöste untermeerische Rutschung kann zusätzlich Wasser verdrängen."},
 complex:{term:"Komplexe Plattengrenze",motion:"Mehrere Bewegungsrichtungen wirken zusammen.",watch:"Die beiden starren Ausschnitte folgen der regionalen Relativbewegung.",cause:"Die Bewegung verteilt sich auf eine breite Zone mit mehreren Störungen.",effects:"Gestein kann sich verformen, Erdbeben sind möglich.",detail:"Die genaue örtliche Störung lässt sich aus den globalen Daten allein nicht bestimmen."},
 hotspot:{term:"Hotspot",motion:"Eine Platte wandert über eine länger beständige Schmelzquelle.",watch:"Jüngere und ältere Vulkane liegen nebeneinander.",cause:"Aufsteigendes heißes Mantelgestein schmilzt bei sinkendem Druck teilweise.",effects:"Über lange Zeit kann eine Vulkankette entstehen.",detail:"Hawaii liegt im Inneren der Pazifischen Platte."}
};
export const teachingSteps:Record<number,string>={4209:"Island · Rücken",4155:"Andamanen · schräge Annäherung",5505:"Ostafrika · Graben",2629:"Japan · Subduktion",2093:"Himalaya · Kollision",2877:"Kalifornien · Transformstörung",1510:"Tonga · Inselbogen",668:"Romanche · Meeresboden",3986:"Molukkensee",4349:"Macquarie-Rücken"};
export function boundaryLesson(step:Step){
 const g=geology(step),a=accounts[g.model];
 const example=Object.values(examples).find(v=>v.step===g.id);
 const place=(locations as Record<string,string>)[g.id]??example?.where??teachingSteps[g.id]??('Grenzabschnitt bei '+Math.abs(g.lat).toFixed(1)+'° '+(g.lat<0?'S':'N')+' und '+Math.abs(g.lon).toFixed(1)+'° '+(g.lon<0?'W':'O'));
 const polarity=g.descending&&g.overriding?'Die '+names[g.descending]+' taucht ab. Darüber liegt die '+names[g.overriding]+'.':'';
 const motion=g.oblique?"Die Platten bewegen sich schräg aufeinander zu. Ein Teil ihrer Bewegung verläuft seitlich entlang der Grenze.":a.motion;
 const site=g.coastalUncertainty?"Die Lage am Übergang zwischen Land und Meer ist im Höhenraster unsicher.":g.surface+".";
 return {...a,motion,place,plates:[names[g.left],names[g.right]],polarity,detail:a.detail+(step[0]===references.island[0]?' Auf Island liefert zusätzlich ein Hotspot besonders viel Schmelze.':''),limit:"Zwei starre Ausschnitte bewegen sich relativ zueinander. Der helle Streifen ist ein Vergleichsmarker. Die gestrichelte Linie markiert die ursprüngliche Grenzrichtung. Abstände, Dicke und Zeit sind überhöht."+(g.oblique?" Der geologische Schnitt vereinfacht die schräge Bewegung zu einer Überschiebung.":"")+(g.model==="complex"?" Der örtliche Bruchmechanismus ist unbekannt. Die Ausschnitte zeigen keine örtliche Verformung.":""),site};
}
export function comparisonLesson(step:Step){
 const a=boundaryLesson(step);
 const row=(question:string,answer:string,channel:string)=>'<div data-teach="'+channel+'"><dt>'+question+'</dt><dd>'+answer+'</dd></div>';
 return '<article class="boundary-lesson"><h1 data-teach="terms">'+a.term+'</h1><p data-teach="labels">'+a.plates.join(' · ')+'</p><dl>'+
 row("Wie bewegen sich die Platten?",'<span class="lesson-lead">'+a.motion+'</span> '+a.watch,"phase")+
 row("Was geschieht an der Grenze?",a.cause+' '+a.polarity,"cause")+
 row("Warum bewegen sich Erdplatten?","Die Schwerkraft wirkt auf unterschiedlich warme und dichte Platten. Besonders der Zug kalter, absinkender Lithosphäre kann eine Platte mitziehen. Am erhöhten Rücken wirkt eine Kraft vom Rücken weg.", "cause")+
 row("Welche Folgen sind möglich?",a.effects,"effects")+row("Wo gibt es das?",a.place+' · '+a.site,"labels")+
 '</dl><button id="pair-process">Geologischen Vorgang ansehen</button><details><summary>Was zeigt dieses Modell?</summary><p>'+a.limit+'</p><p>'+a.detail+'</p><button id="pair-forces">Plattenantrieb ansehen</button></details></article>';
}
