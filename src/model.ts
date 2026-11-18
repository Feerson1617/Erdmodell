export type Style = "A" | "B";
export const styles = {
  A: { name: "Realistisch", segments: 24, sun: 2.05, sky: 1.55 },
  B: { name: "Soft-Low-Poly", segments: 12, sun: 2.45, sky: 1.4 },
};
export const layers = [
  {
    name: "Erdkruste",
    outer: 6371,
    inner: 6336,
    color: 0x8c9f86,
    range: "0–35 km¹",
    thickness: "meist 5–70 km",
    text: "Eine dünne Haut aus festem Gestein. Unter Ozeanen ist sie meist dünner als unter Kontinenten.",
    deep: "Ozeanische Kruste enthält vor allem basaltisches Gestein, kontinentale Kruste unter anderem Granit. Lithosphäre nennt man die Kruste und den starren obersten Mantel zusammen.",
  },
  {
    name: "Erdmantel",
    outer: 6336,
    inner: 3481,
    color: 0xbe7650,
    range: "35–2.890 km¹",
    thickness: "rund 2.855 km",
    text: "Der Mantel besteht überwiegend aus festem Gestein. Über Millionen Jahre kann es sich langsam verformen.",
    deep: "Magnesium- und eisenreiche Silikate prägen den Mantel. Langsame Konvektion transportiert Wärme. Nur örtlich schmilzt ein Teil des Gesteins.",
  },
  {
    name: "Äußerer Erdkern",
    outer: 3481,
    inner: 1221,
    color: 0xe9ae65,
    range: "2.890–5.150 km",
    thickness: "rund 2.260 km",
    text: "Hier bilden vor allem Eisen und etwas Nickel eine flüssige Schicht. Strömungen tragen zur Entstehung des Erdmagnetfeldes bei.",
    deep: "Seismische Scherwellen durchqueren den flüssigen äußeren Kern nicht. Das hilft der Forschung, seinen Zustand zu bestimmen.",
  },
  {
    name: "Innerer Erdkern",
    outer: 1221,
    inner: 0,
    color: 0xffdb97,
    range: "5.150–6.371 km",
    thickness: "Radius rund 1.221 km",
    text: "Das Zentrum der Erde besteht überwiegend aus Eisen. Trotz der hohen Temperatur hält der große Druck das Metall fest.",
    deep: "Die Grenze bei etwa 5.150 km Tiefe trennt festes und flüssiges Kernmaterial. Die Temperaturen im Modell sind nicht durch Farben messbar.",
  },
];
export interface Region {
  id: string;
  name: string;
  lat: number;
  lon: number;
  validatedHazards: readonly string[];
}
export const regions: ReadonlyMap<string, Region> = new Map([
  [
    "hooge",
    {
      id: "hooge",
      name: "Hallig Hooge",
      lat: 54.5660014,
      lon: 8.5504131,
      validatedHazards: [],
    },
  ],
]);
export interface SimulationParameterSet {
  regionId: string;
  source: string;
  units: Readonly<Record<string, string>>;
  values: Readonly<Record<string, number>>;
}
export interface HazardModule {
  id: string;
  validate: (p: SimulationParameterSet) => boolean;
  start: (r: Region, p: SimulationParameterSet) => () => void;
}
export class EventController {
  constructor(
    private modules: ReadonlyMap<string, HazardModule>,
    private registry = regions,
  ) {}
  start(id: string, p: SimulationParameterSet) {
    const r = this.registry.get(p.regionId),
      m = this.modules.get(id);
    if (
      !r ||
      !m ||
      !r.validatedHazards.includes(id) ||
      !p.source ||
      !m.validate(p)
    )
      throw new Error(
        "Für diesen Ort ist kein fachlich geprüftes Ereignis freigegeben.",
      );
    return m.start(r, p);
  }
}
export interface EducationalOverlay {
  title: string;
  basic: string;
  detail?: string;
}
