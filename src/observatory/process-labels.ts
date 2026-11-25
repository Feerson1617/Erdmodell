import * as T from "three";
import { layersFor, type Division } from "./earth-classification";
import { wilsonMotion, basin, geologyAt, type ProcessId } from "./tectonic-process";

export type Feature = { name: string; point: T.Vector3; explanation: string };
// The phase selects a reading focus within simultaneous processes. Indices are
// stable so that an individual disclosure remains attached to its structure.
export function readingOrder(k: ProcessId, t: number) {
  if (k === "subduction" || k === "arc" || k === "oblique")
    return t < 0.25 ? [1, 0, 2, 3] : t < 0.5 ? [2, 0, 1, 3] : t < 0.75 ? [0, 3, 2, 1] : [3, 0, 2, 1];
  if (k === "ridge") return t < 0.34 ? [0, 1, 2] : t < 0.68 ? [1, 0, 2] : [2, 1, 0];
  if (k === "collision") return t < 0.34 ? [1, 2, 0] : t < 0.68 ? [2, 0, 1] : [0, 2, 1];
  return [];
}
export function earthFeatures(division: Division, expanded: boolean): Feature[] {
  const layers = layersFor(division);
  let outer = 3.2;
  return layers.map(([name, bottom, , explanation], i) => {
    const inner = Math.min(((6371 - bottom) * 3.2) / 6371, i === 0 && expanded ? 3.2 * 0.945 : Infinity);
    const radius = (outer + inner) * 0.5,
      angle = 0.22 + i * 0.14;
    const point = new T.Vector3(-radius * Math.cos(angle), radius * Math.sin(angle), 0).applyAxisAngle(
      new T.Vector3(0, 1, 0),
      1.03,
    );
    outer = inner;
    return { name, point, explanation };
  });
}
export function processFeatures(k: ProcessId, t: number): Feature[] {
  const z = 2.5,
    top = (x: number) => geologyAt(k, x, z, t).top;
  const at = (name: string, x: number, y: number, explanation: string) => ({
    name,
    point: new T.Vector3(x, y, z + 0.025),
    explanation,
  });
  switch (k) {
    case "ridge":
      return [
        at(
          "Druckentlastung",
          0.18,
          -1.03,
          "Überwiegend fester Mantel steigt auf. Sinkender Druck ermöglicht Teilschmelze.",
        ),
        at("Rückenachse", 0, top(0), "Magma erstarrt. Neue Kruste wächst auf beiden Flanken."),
        at(
          "Ozeanische Lithosphäre",
          2,
          top(2) - 0.48,
          "Die Platte bewegt sich von der Achse fort. Beim Abkühlen wird die starre Lithosphäre dicker.",
        ),
      ];
    case "rift":
      return [at("Grabensohle", 0, top(0), "Der gedehnte Zentralbereich sinkt zwischen Abschiebungen ein.")];
    case "collision":
      return [
        at(
          "Krustenwurzel",
          0,
          top(0) - geologyAt(k, 0, z, t).crust,
          "Unter dem wachsenden Gebirge reicht die verdickte Kruste tiefer.",
        ),
        at(
          "Annäherung",
          -2.1,
          top(-2.1),
          "Die Kontinente bewegen sich aufeinander zu. Die Kruste wird kürzer.",
        ),
        at(
          "Faltung und Überschiebung",
          -0.45,
          top(-0.45) - 0.3,
          "Gestein faltet sich und schiebt sich übereinander. Die Kruste verdickt sich.",
        ),
      ];
    case "arc":
    case "subduction":
    case "oblique": {
      const x = 1.2,
        g = geologyAt(k, x, z, t),
        slab = top(0) - 0.05 - 0.54 * x - 0.19 * x * x;
      return [
        at(
          "Mantelkeil",
          x,
          (slab + g.top - g.crust) * 0.5,
          "Freigesetzte Fluide erleichtern die Teilschmelze im festen Mantel.",
        ),
        at(
          "Unterplatte",
          x + 0.4,
          top(0) - 0.2 - 0.54 * (x + 0.4) - 0.19 * (x + 0.4) ** 2,
          "Die ozeanische Lithosphäre taucht in den Mantel ein.",
        ),
        at("Fluidweg", 1.05, slab + 0.15, "Wasserhaltige Minerale der Unterplatte geben Fluide ab."),
        at("Magmaaufstieg", 1.46, top(1.46) - 0.24, "Ein Teil der Schmelze steigt durch die Oberplatte auf."),
      ];
    }
    case "transform":
      return [at("Störung", 0, top(0), "Die beiden Seiten bewegen sich längs der Störung.")];
    case "oceanTransform":
      return [
        {
          name: "Aktive Transformstörung",
          point: new T.Vector3(0, geologyAt(k, 0, 0, t).top, 0),
          explanation: "Die aktive Störung verbindet zwei versetzte Rückenabschnitte.",
        },
      ];
    case "complex":
      return [
        at(
          "Deformationsgürtel",
          0.35,
          top(0.35),
          "Verformung verteilt sich hier über einen breiten Bereich.",
        ),
      ];
    case "hotspot":
      return [
        {
          name: "Aktiver Vulkan",
          point: new T.Vector3(-1.55, geologyAt(k, -1.55, 0, t).top, 0),
          explanation: "Neue Vulkanbauten entstehen über der länger bestehenden Quelle.",
        },
        {
          name: "Schmelzregion",
          point: new T.Vector3(-1.55, -1.18, 0.08),
          explanation: "Heißer Mantel steigt auf und schmilzt bei sinkendem Druck teilweise.",
        },
        {
          name: "Älterer Vulkanbau",
          point: new T.Vector3(-1.55 + (2 + t) * 1.05, geologyAt(k, -1.55 + (2 + t) * 1.05, 0, t).top, 0),
          explanation: "Die bewegte Platte trägt diesen Bau von der Schmelzregion fort.",
        },
      ];
    case "wilson":
      return [
        at(
          t < 0.19 ? "Graben" : t < 0.79 ? "Ozeanbecken" : "Kollisionszone",
          basin(t) * 0.65,
          top(basin(t) * 0.65),
          wilsonMotion(t).reading,
        ),
      ];
  }
}
