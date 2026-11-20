import examples from "./examples.json";
import type { Step } from "./atlas";

export const locations: Record<string, string> = {
  AF:"Sie trägt große Teile Afrikas und angrenzenden Meeresboden.",
  AM:"Sie liegt im Osten Asiens, unter anderem unter Teilen Nordostchinas.",
  AN:"Sie trägt die Antarktis und den Meeresboden rings um den Kontinent.",
  AP:"Sie liegt unter einem Teil des Hochlands der zentralen Anden.",
  AR:"Sie trägt die Arabische Halbinsel und Teile des angrenzenden Meeresbodens.",
  AS:"Sie liegt im Raum der Ägäis zwischen Griechenland und der Türkei.",
  AT:"Sie liegt unter einem großen Teil der Türkei.",
  AU:"Sie trägt Australien und weite Teile des umliegenden Meeresbodens.",
  BH:"Sie liegt am westlichen Ende Neuguineas, bei der Vogelkop-Halbinsel.",
  BR:"Sie liegt im südwestlichen Pazifik westlich von Fidschi.",
  BS:"Sie liegt im Osten Indonesiens im Bereich der Bandasee.",
  BU:"Sie liegt an der Ostseite des Golfs von Bengalen, vor Myanmar und Sumatra.",
  CA:"Sie liegt unter einem großen Teil des Karibischen Meeres.",
  CL:"Sie liegt im westlichen Pazifik im Gebiet der Karolinen.",
  CO:"Sie liegt im Pazifik vor der Westküste Mittelamerikas.",
  CR:"Sie liegt im südwestlichen Pazifik beim Conway-Riff.",
  EA:"Sie liegt am Ostpazifischen Rücken im Gebiet der Osterinsel.",
  EU:"Sie trägt große Teile Europas und Asiens sowie angrenzenden Meeresboden.",
  FT:"Sie liegt im südwestlichen Pazifik im Gebiet von Futuna.",
  GP:"Sie liegt an einem Rücken im östlichen Pazifik westlich der Galápagosinseln.",
  IN:"Sie trägt Indien und einen Teil des nördlichen Indischen Ozeans.",
  JF:"Sie liegt vor der Westküste Nordamerikas bei Oregon und Washington.",
  JZ:"Sie liegt an einem Rücken im südöstlichen Pazifik weit vor Chile.",
  KE:"Sie liegt im südwestlichen Pazifik bei den Kermadecinseln.",
  MA:"Sie liegt im westlichen Pazifik bei den Marianen.",
  MN:"Sie liegt im Bismarckmeer nordöstlich von Neuguinea.",
  MO:"Sie liegt im Inneren des westlichen Neuguinea.",
  MS:"Sie liegt in der Molukkensee im Osten Indonesiens.",
  NA:"Sie trägt große Teile Nordamerikas und reicht bis in den Atlantik.",
  NB:"Sie liegt nördlich von Neubritannien im Bismarckmeer.",
  ND:"Sie liegt am nordwestlichen Rand Südamerikas im Bereich der Anden.",
  NH:"Sie liegt im südwestlichen Pazifik bei Vanuatu.",
  NI:"Sie liegt im südwestlichen Pazifik bei der Insel Niuafo’ou.",
  NZ:"Sie liegt im östlichen Pazifik vor der Westküste Südamerikas.",
  OK:"Sie liegt im Gebiet des Ochotskischen Meeres und reicht bis nach Japan.",
  ON:"Sie liegt im Gebiet der Ryūkyū-Inseln südwestlich der japanischen Hauptinseln.",
  PA:"Sie liegt unter einem großen Teil des Pazifischen Ozeans.",
  PM:"Sie liegt bei Panama zwischen Mittel- und Südamerika.",
  PS:"Sie liegt unter der Philippinensee östlich der Philippinen.",
  RI:"Sie liegt vor der Westküste Mexikos.",
  SA:"Sie trägt große Teile Südamerikas und reicht bis in den Atlantik.",
  SB:"Sie liegt zwischen der Nordküste Neuguineas und Neubritannien.",
  SC:"Sie liegt zwischen der Südspitze Südamerikas und der Antarktis.",
  SL:"Sie liegt bei den Südlichen Shetlandinseln vor der Antarktischen Halbinsel.",
  SO:"Sie trägt Teile Ostafrikas und angrenzenden Meeresboden im Indischen Ozean.",
  SS:"Sie liegt in der Salomonensee östlich von Neuguinea.",
  SU:"Sie liegt in Südostasien und trägt Teile des Festlands und der Inselwelt.",
  SW:"Sie liegt im Südatlantik bei den Südlichen Sandwichinseln.",
  TI:"Sie liegt im Gebiet von Timor am Rand Indonesiens.",
  TO:"Sie liegt im südwestlichen Pazifik bei Tonga.",
  WL:"Sie liegt im Gebiet des Woodlark-Beckens östlich von Neuguinea.",
  YA:"Sie liegt unter Teilen des östlichen und südlichen Chinas.",
};
const directions=["Norden","Nordosten","Osten","Südosten","Süden","Südwesten","Westen","Nordwesten"];
const processes:Record<string,string>={
  OSR:"Hier weichen beide Seiten auseinander. Aus aufsteigender Schmelze entsteht neuer Ozeanboden.",
  CRB:"Hier wird die Erdkruste gedehnt. Dabei können Gräben entstehen.",
  SUB:"Hier taucht eine Platte unter die andere ab. Dabei können starke Erdbeben entstehen.",
  OCB:"Hier kommen die Platten unter dem Meer aufeinander zu. Dabei wird Gestein zusammengeschoben.",
  CCB:"Hier wird Gestein auf dem Kontinent zusammengeschoben. Dadurch kann sich das Land heben.",
  OTF:"Hier gleiten die Platten am Meeresboden seitlich aneinander vorbei. Dabei können Erdbeben entstehen.",
  CTF:"Hier gleiten die Platten an Land seitlich aneinander vorbei. Dabei können Erdbeben entstehen.",
};
const landmarks:Record<number,string> = {
  2092:"Hier stoßen zwei Kontinente zusammen. Dabei hebt sich der Himalaya.",
  3080:"Hier taucht die Nazca-Platte unter Südamerika ab. Dabei können starke Erdbeben entstehen.",
  2629:"Hier taucht die Pazifische Platte unter die Ochotskplatte ab. Dabei können starke Erdbeben entstehen.",
  4209:"Hier rücken die Platten auseinander. Aufsteigende Schmelze kühlt ab und bildet neue Kruste.",
  2877:"An der San-Andreas-Verwerfung gleiten die Seiten aneinander vorbei. Wenn sie sich ruckartig lösen, bebt die Erde.",
  1439:"An der Alpenverwerfung gleiten die Seiten schräg aneinander vorbei. Dabei werden die Südalpen angehoben.",
  5502:"Hier wird die Erdkruste gedehnt. Entlang von Brüchen sinken Teile des Bodens ab.",
};
export function buildProfiles(steps:Step[], names:Record<string,string>) {
  return Object.fromEntries(Object.entries(examples).map(([code,example]) => {
    const segment=steps[example.step-1];
    const left=segment[1].slice(0,2), right=segment[1].slice(-2);
    if (code!==left && code!==right) throw Error("Ungültige Zuordnung für "+code);
    const neighbour=left===code?right:left;
    const peer=names[neighbour].replace(/e (Platte|Seeplatte)$/,"en $1");
    const direction=directions[Math.round((segment[8]+(left===code?0:180))/45)%8];
    return [code,{...example,neighbour,place:locations[code],
      motion:`${example.where} bewegt sie sich gegenüber der ${peer} nach ${direction}.`,
      boundary:landmarks[example.step] ?? processes[segment[2]]}];
  }));
}
