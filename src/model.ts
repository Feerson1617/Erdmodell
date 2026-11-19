import { regions, type Region } from "./regions";
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
    text: "Die dünne Außenschicht der Erde. Sie besteht aus festem Gestein.",
  },
  {
    name: "Erdmantel",
    outer: 6336,
    inner: 3481,
    color: 0xbe7650,
    text: "Er besteht überwiegend aus festem Gestein. Dieses kann sich über sehr lange Zeit langsam verformen.",
  },
  {
    name: "Äußerer Erdkern",
    outer: 3481,
    inner: 1221,
    color: 0xe9ae65,
    text: "Er besteht hauptsächlich aus flüssigem Metall.",
  },
  {
    name: "Innerer Erdkern",
    outer: 1221,
    inner: 0,
    color: 0xffdb97,
    text: "Er besteht hauptsächlich aus festem Metall.",
  },
];
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
