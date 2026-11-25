import { scenarios } from "./time";
import type { Observatory } from "./panel";
import type { World } from "../world";
import type { ProcessId } from "./tectonic-process";
import type { Layer } from "./research-data";

const titles: Record<ProcessId, string> = {
  ridge: "Mittelozeanischer Rücken – Bildung neuer ozeanischer Kruste",
  rift: "Grabenbruch – Dehnung eines Kontinents",
  arc: "Subduktion – Entstehung eines Vulkanbogens",
  subduction: "Subduktion am Kontinentalrand",
  oblique: "Schräge Subduktion am Plattenrand",
  collision: "Kontinentkollision – Gebirgsbildung",
  complex: "Verformung eines breiten Gebirgsgürtels",
  transform: "Transformstörung – seitlicher Versatz",
  oceanTransform: "Transformstörung zwischen Rückenachsen",
  hotspot: "Hotspot – Entstehung einer Vulkaninselkette",
  wilson: "Wilson-Zyklus – Entwicklung eines Ozeanbeckens",
};
export function modelTitle(o: Observatory, w: World) {
  const s = o.studioState,
    r = o.region,
    t = o.timeState;
  if (s)
    return s.interior
      ? s.division === "composition"
        ? "Struktur der Erde – stofflicher Aufbau"
        : "Struktur der Erde – mechanische Gliederung"
      : s.focus < 0 && s.models.length > 1
        ? "Plattenprozesse im direkten Vergleich"
        : titles[s.models[Math.max(0, s.focus)]];
  if (t)
    return (t.displayedTime?.scenario ?? t.model) === "past"
      ? "Kontinentaldrift – Veränderung der Kontinentalanordnung"
      : "Zukünftige Kontinentalanordnungen";
  if (o.mode === "map")
    return o.atlasState
      ? "Forschungsatlas der Erde"
      : o.maps.events.visible
        ? "Erdbeben und Plattengrenzen"
        : "Die heutigen Plattengrenzen";
  if (r) {
    if (r.spec.theme === "process")
      return r.spec.geology && [1510, 2308].includes(r.spec.geology.id)
        ? "Relief des Meeresbodens"
        : "Tektonische Strukturen im regionalen Relief";
    return {
      earthquake:
        r.spec.site === "japan" || r.spec.coastLesson
          ? "Seebeben und Tsunami"
          : "Erdbeben – Bruch und Wellenausbreitung",
      volcano: "Vulkanismus – Magma und Eruption",
      risk: "Naturgefahren und Schutzmaßnahmen",
      forces: "Ursachen der Plattenbewegung",
      lithosphere: "Aufbau der Lithosphäre",
      magnet: "Magnetstreifen des Ozeanbodens",
    }[r.spec.theme];
  }
  return {
    globe: "Die Erde im Überblick",
    inside: "Struktur der Erde",
    plates: "Struktur und Bewegung der Erdplatten",
    nyos: "Nyos-See – Schichtung und Gasfreisetzung",
    place: "Lokale Landschaftsstruktur",
  }[w.mode];
}
export function timeCaption(o: Observatory, w: World) {
  if(o.study){const id=o.study.view,t=o.study.time;
    if(id==="record")return "11. März 2011 · "+new Date(Date.UTC(2011,2,11,5,55)+Math.min(1259,t*1260)*1000).toISOString().slice(11,19)+" UTC";
    if(["observed","slab","shallowDeep"].includes(id))return "Katalogzeitraum 2019–2023";
    if(["rays","conversion"].includes(id))return "Laufzeit im Referenzmodell · "+Math.round(t*1600)+" s";
    if(["particles","surface","stations","sites","distance"].includes(id))return "Modellzeit · "+(t*28).toFixed(1).replace(".",",")+" s";
    return "Modellphase · "+Math.round(t*100)+" %";
  }
  const t = o.timeState,
    s = o.studioState;
  if (t) {
    const frame = t.displayedTime;
    if (!frame) return "";
    const n = Math.round(Math.abs(frame.year)),
      age =
        frame.year < 0
          ? "Vor " + n + " Millionen Jahren"
          : frame.year > 0
            ? "In " + n + " Millionen Jahren"
            : "Heute";
    return frame.scenario === "past"
      ? age
      : "Hypothetisch · " +
          scenarios[frame.scenario].label +
          (frame.second ? " / " + scenarios[frame.second].label : "") +
          " · " +
          age;
  }
  if (s && !s.interior)
    return s.models.length === 1 && s.models[0] === "ridge"
      ? Math.round(s.time * 1200000).toLocaleString("de-DE") + " Modelljahre · beschleunigt"
      : "Modellphase " + Math.round(s.time * 100) + " % · geologische Entwicklung, beschleunigt";
  if (o.region?.spec.theme === "earthquake" || (w.mode === "nyos" && w.nyosLesson.view === "event"))
    return "Kurzes Ereignis · Modellzeit";
  return "";
}
const keys: Record<Layer, string> = {
  plates: "Farbflächen · Plattenmodell PB2002",
  bounds: "Türkis divergent · Orange konvergent · Violett transform",
  quakes: "Gelbe Punkte · USGS-Erdbeben",
  depth: "Herdtiefe in km · Gelb <70 · Orange 70 bis <300 · Violett ≥300",
  magnitude: "Größerer Kreis = größere Magnitude",
  volcano: "Korallenrote Punkte · katalogisierte Vulkane",
  hotspot: "Gold · ausgewählte Hotspotregionen",
  vectors: "Gelbe Pfeile · relative Plattenbewegung (PB2002, mm/Jahr)",
  gnss: "Mintpfeile · gemessene Bewegung (GNSS, IGS14, mm/Jahr)",
  age: "Alter (Ma) · Rot <10 · Orange <40 · Ocker <80 · Grün <120 · Türkis <160 · Blau ≥160 · Modell, 1°",
  magnetic: "Magnetanomalie (nT) · Rot positiv · Blau negativ · Messraster, 1°",
  ridge: "Türkis · Spreizungsgrenzen",
  trench: "Hellorange · Subduktionsfronten",
  mountain: "Sand · Deformationsgürtel",
  fossil: "Hellgrün · Fossilfundregionen",
  rock: "Rosa · verwandte Gesteinsregionen",
  ice: "Eisblau · glaziale Sedimente",
};
export function mapLegend(o: Observatory, w: World) {
  if (o.mode === "map") {
    const a = o.atlasState;
    if (a) {
      const rows = a.layers.map((k) =>
        k === "quakes" && a.layers.includes("depth") ? "Punkte · USGS-Erdbeben" : keys[k],
      );
      if (a.layers.some((k) => ["depth", "quakes", "magnitude"].includes(k)))
        rows.push("Katalog · M ≥" + a.magnitude + " · bis " + a.depth + " km" + (a.year ? " · " + a.year : ""));
      if (a.layers.includes("gnss") || a.layers.includes("vectors")) rows.push("Pfeillänge · 400 km auf der Karte entsprechen 50 mm/Jahr");
      if (a.base === "bathy")
        rows.unshift("Tiefe · Petrol bis 1 km · Blau bis 3,5 km · Dunkelblau ab 6 km · 0,5°");
      if (a.base === "relief") rows.unshift("Relief · Grün Tiefland · Ocker Hochland · Hell Gebirge · 0,5°");
      return rows.join("　|　");
    }
    return [
      o.maps.boundaries.visible ? keys.bounds : "",
      o.maps.events.visible ? (o.maps.depth ? keys.depth : keys.quakes) : "",
    ]
      .filter(Boolean)
      .join("　|　");
  }
  if (!o.mode && w.mode === "plates" && !w.processSite && !w.mosaic?.pair)
    return w.plateOptions.boundaries && w.plateOptions.category !== "all"
      ? { divergent: "Türkis · divergente Grenzen", convergent: "Orange · konvergente Grenzen", transform: "Violett · Transformgrenzen" }[w.plateOptions.category]
      : w.plateOptions.boundaries
      ? w.plateOptions.types
        ? keys.bounds
        : "Linien · modellierte Plattengrenzen (PB2002)"
      : "";
  return "";
}
