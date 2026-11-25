import type { Layer } from "../observatory/research-data";
import type { Site } from "../observatory/boundaries";

export const atlasViews: Record<string, { name: string; layers: Layer[] }> = {
  distribution: { name: "Erdbeben weltweit", layers: ["quakes"] },
  boundaries: {
    name: "Erdbeben und Plattengrenzen",
    layers: ["bounds", "quakes"],
  },
  depthMap: { name: "Globale Herdtiefen", layers: ["quakes", "depth"] },
  sizeMap: { name: "Globale Magnituden", layers: ["quakes", "magnitude"] },
  trenches: {
    name: "Beben und Subduktionsfronten",
    layers: ["trench", "quakes", "depth"],
  },
  volcanoMap: {
    name: "Erdbeben und Vulkanstandorte",
    layers: ["quakes", "volcano", "bounds"],
  },
};
export const regionViews: Record<
  string,
  {
    name: string;
    site: Site;
    eruption?: "effusive" | "explosive";
    camera: "vent" | "land" | "cut" | "overhead" | "fault" | "focus" | "waves";
    progress: number;
  }
> = {
  shield: { name:"Hawaii · Schildvulkan",site:"hawaii",camera:"land",progress:0,eruption:"effusive" },
  lava: { name:"Hawaii · effusive Eruption",site:"hawaii",camera:"vent",progress:0.42,eruption:"effusive" },
  cone: { name:"Japan · Schichtvulkan",site:"japan",camera:"land",progress:0,eruption:"explosive" },
  plume: { name:"Japan · explosive Eruption",site:"japan",camera:"vent",progress:0.42,eruption:"explosive" },
  park: {
    name: "Parkfield · Erdbebenentstehung",
    site: "san",
    camera: "cut",
    progress: 0,
  },
  strain: {
    name: "Parkfield · Spannungsaufbau",
    site: "san",
    camera: "overhead",
    progress: 0.31,
  },
  break: {
    name: "Parkfield · Bruch und Versatz",
    site: "san",
    camera: "fault",
    progress: 0.44,
  },
  focus: {
    name: "Hypozentrum und Epizentrum",
    site: "san",
    camera: "focus",
    progress: 0.38,
  },
  parkWaves: {
    name: "Parkfield · Wellenfronten",
    site: "san",
    camera: "waves",
    progress: 0.49,
  },
  nepal: {
    name: "Himalaya · Überschiebung",
    site: "himalaya",
    camera: "cut",
    progress: 0.48,
  },
  tohoku: {
    name: "Tōhoku · Plattenkontakt",
    site: "japan",
    camera: "cut",
    progress: 0.48,
  },
  zao: {
    name: "Zaozan · Fluid und Magmenbildung",
    site: "japan",
    camera: "cut",
    progress: 0.54,
  },
};
export const families = {
  maars:{title:"Maarentstehung",variants:{maar:"Maarentstehung · mit See",dryMaar:"Trockenmaar",contactDetail:"Kontakt im Porenraum"}},
  eifel:{title:"Vulkaneifel",variants:{eifel:"Vulkaneifel · Übersicht",ulmen:"Ulmener Maar · Landschaft",aerial:"Ulmen · Draufsicht",lakeCut:"Idealisierter Seeschnitt"}},
  lakes:{title:"Seen und Gase",variants:{mixing:"Chemisch stabile Tiefenschicht",turnover:"Jahreszeitliche Vollzirkulation",mixCompare:"Zwei Seetypen im Vergleich",dissolved:"Gelöstes Kohlendioxid",waterColumn:"Nyos · Rückkopplung in der Wassersäule",unsaturated:"Gegenbeispiel · untersättigt",pipeCut:"Nyos · Entgasungsrohr im Schnitt",profiles:"Nyos · historische CO₂-Profile",conductivity:"Nyos · historische Leitfähigkeit",landCompare:"Ulmen und Nyos · Landschaften",lakeCompare:"Ulmener Maar und Nyos"}},
  plumbing: {title:"Magmatische Prozesse",variants:{storage:"Schmelze im festen Gestein",degassing:"Vulkanische Gase",contact:"Magma trifft Grundwasser",forms:"Schild- und Schichtvulkan"}},
  faults: {
    title: "Bruchmechanismen",
    variants: {
      strike: "Seitenverschiebung",
      normal: "Abschiebung",
      reverse: "Aufschiebung",
      thrust: "Überschiebung",
      oblique: "Schräger Bruch",
      megathrust: "Subduktionsbeben",
    },
  },
  waves: {
    title: "Seismische Wellen",
    variants: {
      particles: "P- und S-Wellen",
      surface: "Rayleigh- und Love-Wellen",
      stations: "Zwei Messstationen",
      record: "Tōhoku 2011 · Originalaufzeichnung",
    },
  },
  core: {
    title: "Seismische Wege durch die Erde",
    variants: {
      rays: "P- und S-Schattenzonen",
      conversion: "Wellenumwandlung · SKS",
      allRays: "Alle berechneten Laufwege",
    },
  },
  source: {
    title: "Magnitude und örtliche Erschütterung",
    variants: {
      moment: "Magnitude 6 und 7",
      sites: "Gleiche Quelle · zwei Standorte",
      distance: "Gleiche Quelle · zwei Entfernungen",
    },
  },
  section: {
    title: "Erdbebenherde unter Tōhoku",
    variants: {
      observed: "Gemessene Herdtiefen",
      slab: "Wadati-Benioff-Zone",
      shallowDeep: "Flacher und tiefer Herd",
    },
  },
  magma: {
    title: "Seismizität im magmatischen System",
    variants: {
      tectonic: "Tektonischer Bruch",
      vt: "Vulkanotektonischer Bruch",
      fluid: "Bewegte Fluide",
      tremor: "Vulkanischer Tremor",
      quiet: "Intrusion mit geringer Seismizität",
      monitor: "Wissenschaftliche Überwachung",
    },
  },
} as const;
export type Family = keyof typeof families;
export function familyOf(id: string): Family | undefined {
  return (Object.keys(families) as Family[]).find((f) =>
    Object.hasOwn(families[f].variants, id),
  );
}
export function isView(id: unknown): id is string {
  return (
    typeof id === "string" &&
    (Object.hasOwn(atlasViews, id) ||
      Object.hasOwn(regionViews, id) ||
      !!familyOf(id))
  );
}
export function titleFor(id: string) {
  return (
    atlasViews[id]?.name ??
    regionViews[id]?.name ??
    (Object.entries(families[familyOf(id)!]?.variants ?? {}).find(
      ([k]) => k === id,
    )?.[1] ||
      "")
  );
}
export function viewOptions(id: string): [string, string][] {
  if (atlasViews[id])
    return Object.entries(atlasViews).map(([k, v]) => [k, v.name]);
  if (regionViews[id]?.eruption) return Object.entries(regionViews).filter(([,v])=>v.eruption).map(([k,v])=>[k,v.name]);
  if (regionViews[id])
    return Object.entries(regionViews).map(([k, v]) => [k, v.name]);
  return Object.entries(families[familyOf(id)!].variants);
}
// The link is a reversible change of scale or model, accessible alongside free navigation.
export const connections: Record<string, [string, string]> = {
  contactDetail:["maar","Zum ganzen Maar"],mixCompare:["dissolved","Gaslösung"],waterColumn:["nyos-event","Zur Ausbreitung im Tal"],unsaturated:["waterColumn","Mit Rückkopplung vergleichen"],pipeCut:["profiles","Historische Tiefenprofile"],profiles:["lakeCompare","Seen vergleichen"],conductivity:["profiles","CO₂ zeigen"],landCompare:["lakeCompare","Gemeinsamer Maßstab"],forms:["shield","Hawaii auf der Erde"],
  shield:["lava","Lavafluss zeigen"], lava:["cone","Mit Japan vergleichen"],cone:["plume","Eruption zeigen"],plume:["storage","Magmatischer Untergrund"],
  storage:["degassing","Gastransport"],degassing:["monitor","Zur Überwachung"],contact:["maar","Zur Maarentstehung"],
  eifel:["ulmen","Nach Ulmen"],ulmen:["lakeCut","See im Schnitt"],aerial:["lakeCut","See im Schnitt"],lakeCut:["maar","Entstehung zeigen"],maar:["ulmen","Zum heutigen Maar"],dryMaar:["eifel","Zur Vulkaneifel"],
  turnover:["mixing","Mit stabilem Tiefenwasser vergleichen"],mixing:["dissolved","Gelöstes Gas"],dissolved:["nyos-event","Nyos 1986"],lakeCompare:["ulmen","Nach Ulmen"],
  distribution: ["boundaries", "Grenzen zeigen"],
  boundaries: ["park", "Parkfield öffnen"],
  depthMap: ["observed", "Japan im Schnitt"],
  sizeMap: ["moment", "Quellen vergleichen"],
  trenches: ["observed", "Japan im Schnitt"],
  volcanoMap: ["observed", "Japan im Schnitt"],
  park: ["strike", "Bruch vergleichen"],
  strain: ["break", "Zum Bruch"],
  break: ["strike", "Bruch vergleichen"],
  focus: ["particles", "Wellen vergleichen"],
  parkWaves: ["particles", "Teilchen betrachten"],
  nepal: ["thrust", "Bruch vergleichen"],
  tohoku: ["zao", "Zum Mantelkeil"],
  zao: ["vt", "Magmatisches System"],
  strike: ["park", "Parkfield öffnen"],
  normal: ["process-rift", "Zur Riftzone"],
  reverse: ["process-collision", "Zur Kollision"],
  thrust: ["nepal", "Himalaya öffnen"],
  oblique: ["process-oblique", "Zur Plattengrenze"],
  megathrust: ["tohoku", "Japan öffnen"],
  observed: ["slab", "Profil einblenden"],
  slab: ["tohoku", "Zum Plattenkontakt"],
  shallowDeep: ["focus", "Zum Bruchmodell"],
  particles: ["stations", "Zu den Stationen"],
  surface: ["stations", "Zu den Stationen"],
  stations: ["rays", "Ins Erdinnere"],
  record: ["observed", "Herde in Japan"],
  rays: ["inside", "Zum Schalenmodell"],
  conversion: ["inside", "Zum Schalenmodell"],
  allRays: ["inside", "Zum Schalenmodell"],
  moment: ["sites", "Örtliche Wirkung"],
  sites: ["distance", "Entfernung vergleichen"],
  distance: ["risk", "Bebauung und Untergrund"],
  tectonic: ["vt", "Vulkanischer Raum"],
  vt: ["monitor", "Zur Überwachung"],
  fluid: ["monitor", "Zur Überwachung"],
  tremor: ["monitor", "Zur Überwachung"],
  quiet: ["monitor", "Zur Überwachung"],
  monitor: ["volcanoMap", "Auf der Erde zeigen"],
};
