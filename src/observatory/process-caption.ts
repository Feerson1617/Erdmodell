import { familyOf } from "../seismology/catalog";
import { bursts } from "../seismology/maar-profile";
import { gasParcel } from "../seismology/lake-physics";
import { onset } from "./fault";
import { wilsonMotion, type ProcessId } from "./tectonic-process";

export function faultCaption(time: number, regional = false) {
  if (time < 0.17) return "Spannungsaufbau";
  if (time < (regional ? onset : 0.34)) return "Elastische Verformung";
  if (time < (regional ? 0.48 : 0.4)) return "Bruchbeginn";
  if (time < (regional ? 0.7 : 0.65)) return "Bruchausbreitung";
  if (time < (regional ? 0.91 : 0.79)) return "Wellen breiten sich aus";
  return "Bleibender Versatz";
}

export function studyCaption(id: string, t: number): string {
  switch (id) {
    case "maar":
    case "dryMaar":
    case "lakeMaar":
      if (t >= 0.78)
        return id === "dryMaar"
          ? "Später · Trockenmaar"
          : "Später · Wasser sammelt sich";
      if (t >= 0.65) return "Einbruch und Ablagerung";
      if (t >= bursts[0]) return "Phreatomagmatische Explosionen";
      return t >= 0.2 ? "Magma trifft Grundwasser" : "Ursprüngliche Landschaft";
    case "contactDetail":
      return t < 0.4
        ? "Magma steigt auf"
        : t < 0.55
          ? "Wasser verdampft"
          : "Gestein und Magma zerbrechen";
    case "dissolved":
      return t < 0.36
        ? "CO₂ gelangt ins Tiefenwasser"
        : "CO₂ ist im Wasser gelöst";
    case "waterColumn":
    case "unsaturated":
      if (t < 0.14) return "Gelöstes Kohlendioxid";
      if (t < 0.27) return "Wasser steigt auf";
      if (t < 0.375) return "Der Druck nimmt ab";
      if (id === "unsaturated") return "Das Wasser bleibt untersättigt";
      if (t >= 0.82) return "CO₂ gelangt in die Luft";
      return gasParcel(t, 0, "rich").free < 0.25
        ? "Gasblasen entstehen"
        : "Verstärkter Auftrieb";
    case "pipeCut":
      return pipeCaption(t);
    case "mixCompare":
    case "mixing":
    case "turnover":
      return t < 0.22 || t > 0.8
        ? "Warmes Oberflächenwasser"
        : t < 0.38
          ? "Die Oberfläche kühlt ab"
          : "Wasserschichten mischen sich";
    case "forms":
      return t < 0.24 ? "Form der Vulkanbauten" : "Lava und Auswurfmaterial";
    case "storage":
      return "Schmelze und Kristalle im Gestein";
    case "degassing":
      return t < 0.48 ? "Gas ist im Magma gelöst" : "Gas steigt auf";
    case "contact":
      return t < 0.48
        ? "Magma nähert sich Grundwasser"
        : "Wärme gelangt ins Wasser";
    default:
      return familyOf(id) === "faults" ? faultCaption(t) : "";
  }
}
export function pipeCaption(t: number) {
  if (t < 0.24) return "Strömung wird angestoßen";
  if (t < 0.47) return "Tiefenwasser steigt im Rohr auf";
  if (t < 0.82) return "Gasblasen treiben Wasser nach oben";
  return "Gas entweicht am Auslass";
}
export function nyosEventCaption(t: number) {
  if (t < 0.17) return "Gelöstes CO₂ im Tiefenwasser";
  if (t < 0.33) return "Druck nimmt beim Aufstieg ab";
  if (t < 0.53) return "Gasblasen verstärken den Aufstieg";
  if (t < 0.68) return "Gas entweicht an der Oberfläche";
  return "CO₂-reiche Luft im Tal";
}
const processFocus: Record<ProcessId, string> = {
  ridge: "Neue Kruste am Rücken",
  rift: "Dehnung der Erdkruste",
  arc: "Abtauchen und Magmenbildung",
  subduction: "Abtauchen der ozeanischen Platte",
  oblique: "Abtauchen und seitlicher Versatz",
  collision: "Verdickung der Erdkruste",
  complex: "Verformung der Plattengrenze",
  transform: "Seitliche Verschiebung",
  oceanTransform: "Versatz zwischen Rückenabschnitten",
  hotspot: "Platte wandert über die Magmaquelle",
  wilson: "Entwicklung des Ozeanbeckens",
};
export function tectonicCaption(model: ProcessId, time: number) {
  if (model !== "wilson") return processFocus[model];
  const phase = wilsonMotion(time);
  if (time >= 0.89) return "Kontinente stoßen zusammen";
  if (phase.spreadingRidge && phase.subduction)
    return "Spreizung und Subduktion zugleich";
  if (phase.outward < 0) return "Das Ozeanbecken schrumpft";
  if (phase.spreadingRidge) return "Das Ozeanbecken wächst";
  return "Der Kontinent dehnt sich";
}
