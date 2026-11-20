import { regions, type Region } from "./regions";
export type Style = "A" | "B";
export const styles = {
  A: { name: "Realistisch", segments: 24, sun: 2.05, sky: 1.55 },
  B: { name: "Soft-Low-Poly", segments: 12, sun: 2.45, sky: 1.4 },
};
export const layers = [
  {
    name: "Erdkruste",
    material: "Die Erdkruste besteht aus festem Gestein. Unter Ozeanen ist es meist dichter als unter Kontinenten.",
    origin: "Kruste entstand aus abgekühlter Gesteinsschmelze. Bis heute bildet sich neue Kruste, und ältere Kruste verändert sich.",
    outer: 6371,
    inner: 6336,
    color: 0x8c9f86,
    text: "Die dünne Außenschicht der Erde. Sie besteht aus festem Gestein.",
  },
  {
    name: "Erdmantel",
    material: "Der Mantel besteht größtenteils aus heißem, festem Gestein. Über sehr lange Zeit kann es sich langsam verformen.",
    origin: "In der jungen Erde trennten sich schweres Metall und Gestein. Das Metall sank zum Kern. Der größte Teil des Gesteins bildete den Mantel.",
    outer: 6336,
    inner: 3481,
    color: 0xbe7650,
    text: "Er besteht überwiegend aus festem Gestein. Dieses kann sich über sehr lange Zeit langsam verformen.",
  },
  {
    name: "Äußerer Erdkern",
    material: "Er besteht hauptsächlich aus flüssigem Eisen. Es enthält auch Nickel und leichtere Stoffe.",
    origin: "Als die junge Erde sehr heiß war, sank schweres Metall nach innen. Der äußere Teil des Kerns ist bis heute flüssig.",
    outer: 3481,
    inner: 1221,
    color: 0xe9ae65,
    text: "Er besteht hauptsächlich aus flüssigem Metall.",
  },
  {
    name: "Innerer Erdkern",
    material: "Er besteht hauptsächlich aus festem Eisen. Der hohe Druck hält es trotz der großen Hitze fest.",
    origin: "Als die Erde langsam abkühlte, begann Metall in ihrem Zentrum zu erstarren. Daraus wuchs der innere Erdkern.",
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
