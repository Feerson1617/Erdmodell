import {accounts} from "../tectonics/learning";
import {onset,pSpeed,sSpeed} from "./fault";
import type {RegionalScene} from "./regional";
import {scenarios,type TimeGlobe} from "./time";
import {tracks} from "./reconstruction";

export const assumptions={past:"",ultima:"Der Atlantik schließt sich wieder.",novo:"Der Pazifik schließt sich. Der Atlantik bleibt offen.",aurica:"Atlantik und Pazifik schließen sich. Ein neuer Ozean öffnet sich.",amasia:"Kontinentalbereiche sammeln sich im Norden."};
export function timeReading(t:TimeGlobe){
 if(t.year>0)return [scenarios[t.scenario].label,assumptions[t.scenario]+(t.compare?' '+scenarios[t.second].label+' im Vergleich: '+assumptions[t.second]:'')];
 const age=-t.year;
 const station=age>=220?["Pangäa","Die meisten heutigen Kontinentalbereiche bilden eine zusammenhängende Landmasse."]:age>=175?["Beginnende Aufspaltung","Im Inneren Pangäas dehnt sich die Kruste. Zwischen den nördlichen und südlichen Landmassen beginnt sich der Zentralatlantik zu öffnen."]:age>=125?["Laurasia und Gondwana","Zwischen den großen Landmassen wächst der Zentralatlantik. Gondwana zerfällt in kleinere Kontinentalbereiche."]:age>=65?["Der Atlantik wächst","Südamerika und Afrika entfernen sich. Der indische Kontinentalbereich bewegt sich nach Norden."]:age>=35?["Annäherung an Eurasien","Indien nähert sich Eurasien und kollidiert mit ihm. Australien löst sich weiter von der Antarktis."]:age>0?["Auf dem Weg zur Gegenwart","Der Atlantik wird breiter. Australien bewegt sich nach Norden."]:["Gegenwart","Die rekonstruierten Kontinentalflächen erreichen ihre heutige Lage."];
 return [station[0],station[1]+(tracks[t.tracking]?' Verfolgt wird der Kontinentalbereich '+tracks[t.tracking][0]+'.':'')];
}
export const learningFields='<section class="process-reading"><h2 id="learn-term" data-teach="terms"></h2><strong id="learn-phase" data-teach="phase"></strong><p id="learn-cause" data-teach="cause"></p><p id="learn-effects" data-teach="effects"></p></section>';
export function setReading(id:string,text:string){const el=document.getElementById(id);if(el&&el.textContent!==text)el.textContent=text;}
export function regionalReading(r:RegionalScene):string[]{
 const {theme,process,site}=r.spec,t=r.progress,a=accounts[process],f=r.faultModel;
 if(r.localActive){
   if(site==="japan")return ["Küstenausschnitt","Ruhige Nahbucht","Dieses Nahmodell zeigt einen typischen Küstenausschnitt. Die Tsunami-Bewegung untersuchst du im regionalen Wasser- und Küstenmodell.",""];
   if(site==="island"&&theme==="volcano")return ["Basaltische Spalte",t>.53&&r.eruption==="effusive"?"Lava fließt aus":"Blick auf die Spalte","Hier tritt dünnflüssige Lava aus einer Spalte aus. Sie folgt dem Gelände und kann in einer Senke zum Stillstand kommen.","Lokales Beispiel eines effusiven Ausbruchs."];
   if(site!=="san"||theme!=="earthquake")return ["Landschaft im Nahmodell","Gelände in Metern","Gestein und Bewuchs zeigen typische Formen. Die Einzelobjekte sind beispielhaft gesetzt.","Geologische Bewegungen lassen sich im regionalen Prozessmodell untersuchen."];
 }
 if(theme==="forces")return ["Plattenantrieb","Kräfte an Rücken und Tiefseegraben","Am erhöhten Rücken wirkt die Schwerkraft. Kalte, absinkende Lithosphäre kann den Rest der Platte nachziehen.","Der heiße Mantel darunter ist überwiegend fest und über lange Zeit verformbar."];
 if(theme==="lithosphere")return ["Lithosphäre","Starre Außenhülle","Kruste und starrer oberster Mantel bewegen sich als Platte gemeinsam.","Unter der Lithosphäre kann sich das heiße Mantelgestein über lange Zeit verformen."];
 if(theme==="magnet")return ["Magnetstreifen",t===0?"Ausgangszustand":"Ozeanboden wandert nach außen","Abkühlende Minerale speichern die Richtung des damaligen Magnetfelds.","Auf beiden Seiten des Rückens lässt sich eine ähnliche Abfolge vergleichen."];
 if(theme==="process")return [a.term,t===0?"Ausgangszustand":t===1?"Endzustand im Modell":({ridge:"Neue Kruste entsteht am Rücken",rift:"Die Kruste wird gedehnt",collision:"Kruste wird zusammengeschoben",subduction:"Die Platten nähern sich",arc:"Annäherung am Inselbogen",transform:"Seitlicher Versatz",oceanTransform:"Versatz am Meeresboden",convergence:"Annäherung",complex:"Verteilte Bewegung",hotspot:"Die Platte bewegt sich"})[process],a.cause,"Mögliche Folgen: "+a.effects];
 if(theme==="volcano"){
   const source=site==="hawaii"?"Über einer länger beständigen Schmelzquelle entstehen nacheinander Schildvulkane. Die Platte trägt ältere Vulkane fort.":process==="arc"||process==="subduction"?"Wasserhaltige Stoffe aus der abtauchenden Platte begünstigen das teilweise Schmelzen im Mantelkeil.":"Am Rücken steigt heißes Mantelgestein auf. Sinkender Druck lässt einen Teil schmelzen."+(site==="island"?" Auf Island verstärkt ein Hotspot die Schmelzbildung.":"");
   const explosive=r.eruption==="explosive";
   return ["Vulkanismus",t> (explosive?.54:.53)?explosive?"Asche und Gas steigen auf":"Lava fließt aus":t>.12?"Magma steigt im Modell auf":"Schmelzbereich im Untergrund",source,explosive?"Bei diesem Vergleichsausbruch zerreißt Gas die Schmelze.":"An der Oberfläche heißt die austretende Schmelze Lava."];
 }
 if(theme==="risk")return ["Naturgefahr und Risiko",r.exposure==="empty"?"Unbesiedelter Standort":t<onset?"Exposition vor dem Ereignis":t<.49?"Erschütterung am Standort":t>(r.warning&&r.safeRoute?.77:.94)?"Versorgung wiederhergestellt":"Unterbrochene Versorgung",
 r.exposure==="empty"?"Hier stehen keine Modellhäuser. Die Naturgefahr besteht auch an einem unbesiedelten Standort.":"Menschen und Gebäude sind der Gefahr ausgesetzt. Die Anfälligkeit heißt Verwundbarkeit. Entscheidend sind unter anderem Bauweise und Untergrund.",
 "Resilienz bedeutet, mit den Folgen umzugehen und wichtige Funktionen wiederherzustellen. Maßnahmen können Risiken mindern."];
 if(!f||f.kind==="unknown")return [a.term,"Grenzzone",a.cause,a.detail];
 if(r.water&&["coast","ocean","water"].includes(r.view)){
   const w=r.water;
   let phase="Wasser im Ruhezustand",message="Der Meeresboden trägt die Wassersäule.";
   if(t>onset&&f.waterEvent){
     const movement=w.extent(t),earlier=w.extent(Math.max(0,t-.018));
     if(r.spec.coastLesson&&movement.newlyWet>0){const retreat=movement.newlyWet<earlier.newlyWet||movement.newlyWet===earlier.newlyWet&&movement.deepest<earlier.deepest-.00001;phase=retreat?"Wasser zieht sich zurück":"Küste überflutet";message=retreat?"Die berechnete Wasserbedeckung nimmt ab. Teile des zuvor trockenen Landes können noch unter Wasser stehen.":"Wasser bedeckt Zellen, die vor der Welle trocken waren.";}
     else if(r.view==="water"&&t<.67){phase="Verlagerung des Meeresbodens";message="Hebung und Senkung verdrängen Wasser. Die langsame Wasserwelle unterscheidet sich von den schnelleren seismischen Wellen.";}
     else{phase="Wasserwelle";message="Die Störung der Wasseroberfläche läuft weiter. Im flacheren Wasser ändern sich Geschwindigkeit und Wellenhöhe.";}
   }else if(t>onset){phase="Modellbeben ohne starke Wasserverlagerung";message="Die überwiegend seitliche oder tiefe Bewegung hebt hier kein großes Stück Meeresboden an.";}
   return ["Seebeben und Tsunami",phase,message,"Nicht jedes Seebeben löst einen Tsunami aus."];
 }
 const distance=Math.hypot(r.epicenter[0]-f.hx,r.epicenter[1]-f.hy);
 const ta=onset+distance/pSpeed,tb=onset+distance/sSpeed;
 let phase="Ausgangszustand",message="Die Platten grenzen aneinander. Ein Teil des Kontakts kann festhalten.";
 if(t>0&&t<onset){phase=r.stress||t>=onset*.5?"Spannungsaufbau":"Langsame Bewegung und Verhakung";message="Die Platten bewegen sich weiter. Am blockierten Kontakt verformt sich das Gestein elastisch.";}
 if(t>=onset){phase=t===1?"Nach dem Beben":t<ta?"Bruchbeginn und erste Wellen":t<tb?"P-Welle erreicht das Epizentrum":t<.72?"Bruch und Wellenausbreitung":"Abklingende Erschütterung";message=t<ta?"Am Herd löst sich die Verhakung. Schon während der Bruch wächst, laufen die ersten Wellen los.":t<tb?"Die schnellere P-Welle drückt Gestein zusammen und dehnt es. Die S-Welle ist noch unterwegs.":t<.72?"Die langsamere S-Welle bewegt das Gestein quer zur Ausbreitungsrichtung. Direkte S-Wellen laufen nur durch feste Stoffe.":"Die Erschütterung klingt ab. Ein bleibender Versatz ist möglich.";}
 if(r.localActive)message="Der lokale Geländemarker zeigt den vereinfachten Seitenversatz am selben Modellereignis.";
 return [r.localActive?"Lokaler Seitenversatz":"Erdbeben",phase,message,r.localActive?"Maßstäblich vergrößerter Anschauungsversatz.":t>=onset&&r.view==="waves"?"P-Wellen laufen durch feste Stoffe und Flüssigkeiten.":"Langsame Bewegung kann zu einer plötzlichen Erschütterung führen."];
}
