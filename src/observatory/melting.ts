import type {Process, Site} from "./boundaries";

const settings = {
  arc: "Aus der abtauchenden Platte gelangen wasserreiche Fluide in den heißen Mantelkeil. Sie senken die Temperatur, bei der das Mantelgestein zu schmelzen beginnt. Ein Teil des Mantelgesteins schmilzt.",
  ridge: "Am mittelozeanischen Rücken steigt überwiegend festes Mantelgestein auf. Beim Aufstieg sinkt der Druck. Ein Teil des heißen Gesteins schmilzt und kann neue ozeanische Kruste bilden.",
  island: "Unter Island steigt heißes Mantelgestein am Mittelatlantischen Rücken auf. Bei sinkendem Druck schmilzt ein Teil. Der Hotspot trägt dort zur besonders großen Schmelzmenge bei.",
  hotspot: "Am Hotspot steigt heißes Mantelgestein unter der ozeanischen Lithosphäre auf. Der Druck sinkt beim Aufstieg, sodass ein Teil des Gesteins schmilzt. Die Platte trägt ältere Vulkane von der Quelle fort.",
  rift: "In einem kontinentalen Graben kann die Lithosphäre dünner werden. Aufsteigendes Mantelgestein kann bei sinkendem Druck teilweise schmelzen. Wo Schmelze entsteht, hängt von den örtlichen Bedingungen ab.",
  uncertain: "Aus der Lage und Bewegungsrichtung dieser Grenze allein lässt sich keine örtliche Schmelzquelle ableiten."
};
export function meltingSetting(process:Process, site?:Site):keyof typeof settings {
  if(process==="arc" || process==="subduction") return "arc";
  if(process==="ridge") return site==="island" ? "island" : "ridge";
  if(process==="hotspot") return "hotspot";
  if(process==="rift") return "rift";
  return "uncertain";
}
export function meltingExplanation(process:Process, site?:Site) {
  return settings[meltingSetting(process,site)];
}
