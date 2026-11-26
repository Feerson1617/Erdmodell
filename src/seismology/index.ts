import { Stage, type SeismicState } from "./stage";
import { familyOf, titleFor, viewOptions } from "./catalog";
import { faultStudy, intrusion, japan, sources } from "./geology";
import {maar} from "./maar";
import {lakeSection} from "./lakes";
import {lakeAtlas, regionalTowns} from "./lake-atlas";
import {gasColumn,mixingSection} from "./water-column";
import {contactDetail} from "./contact-detail";
import {compareBasins,historicalProfiles,historicalInventory} from "./lake-comparison";
import {volcanoForms} from "./volcano-forms";
import { plumbing } from "./volcanism";
import { earthPaths, magmaChart, realRecord, waveField } from "./waves";
import type { WebGLRenderer } from "three";
import "./figure.css";
export function createSeismic(
  gl: WebGLRenderer,
  id: string,
  state?: SeismicState,
) {
  const stage = new Stage(gl, id),
    f = familyOf(id);
  if(id==="contactDetail")contactDetail(stage);
  else if(["forms","maunaCut","zaoCut"].includes(id))volcanoForms(stage);
  else if(id==="lakeCompare")compareBasins(stage);
  else if(id==="inventory")historicalInventory(stage);
  else if(id==="profiles"||id==="conductivity")historicalProfiles(stage);
  else if(id==="towns"||id==="wittlich")regionalTowns(stage);
  else if(id==="landCompare"||f==="eifel"&&id!=="lakeCut")lakeAtlas(stage);
  else if(["mixCompare","mixing","turnover"].includes(id))mixingSection(stage);
  else if(f==="lakes")gasColumn(stage);
  else if(f==="maars")maar(stage);
  else if(id==="lakeCut")lakeSection(stage);
  else if(f==="plumbing")plumbing(stage);
  else if (f === "faults") faultStudy(stage);
  else if (f === "core") earthPaths(stage);
  else if (f === "section") japan(stage);
  else if (f === "magma") {
    intrusion(stage);
    magmaChart(stage);
  } else if (id === "moment") sources(stage);
  else if (id === "record") realRecord(stage);
  else waveField(stage);
  stage.time =
    ["maars","eifel","lakes","plumbing"].includes(f??"") ? 0 : f === "faults" ? 0.23 : f === "section" ? 0 : id === "record" ? 1 : 0.36;
  if (state) stage.restore(state);
  return stage;
}
export function validSeismic(s: unknown): s is SeismicState {
  if (!s || typeof s !== "object") return false;
  const v = s as SeismicState;
  const xyz = (a: unknown) =>
    Array.isArray(a) &&
    a.length === 3 &&
    a.every((x) => Number.isFinite(x) && Math.abs(x) < 200);
  return (
    !!familyOf(v.view) &&
    Number.isFinite(v.time) &&
    v.time >= 0 &&
    v.time <= 1 &&
    typeof v.playing === "boolean" &&
    xyz(v.eye) &&
    xyz(v.target) &&
    Number.isFinite(v.zoom) &&
    v.zoom >= 0.7 &&
    v.zoom <= 2.4
  );
}
export function mountStudy(stage: Stage, side: HTMLElement) {
  side.innerHTML =
    '<h1></h1><p id="quake-source-note"></p><button id="g-play">Abspielen</button><label>Modellzeit<input id="g-progress" type="range" min="0" max="1" step=".001"></label><button id="g-reset">Zurücksetzen</button>';
  side.querySelector("h1")!.textContent = titleFor(stage.view);
  const f = familyOf(stage.view);
  side.querySelector("p")!.textContent =
    f === "core"
      ? "Laufwege aus IASP91 · 15 km Quelltiefe · kugelsymmetrisches Referenzmodell."
      : stage.view === "record"
        ? "Global Seismographic Network · EarthScope/USGS · 25.200 Abtastungen bei 20 Hz. Gespeichert sind 1.260 Sekundenintervalle mit Minimum und Maximum. Zählwerte sind digitale Instrumenteneinheiten."
        : f === "section"
          ? "USGS ComCat · 2019–2023 · M ≥ 4,5. Miyagi-Profil aus dem Slab2-Eingangsdatensatz."
          : stage.view === "moment"
            ? "M₀ = μ · A · D. Hier gilt μ = 30 GPa. Mw = ⅔ (log₁₀ M₀ − 9,1), M₀ in Nm. Die abgestrahlte Energie ist ereignisabhängig."
            : "Qualitatives Anschauungsmodell. Bewegungen und Zeiten sind für die räumliche Beobachtung vereinfacht.";
  const play = side.querySelector<HTMLButtonElement>("#g-play")!,
    bar = side.querySelector<HTMLInputElement>("#g-progress")!;
  const sync = () => {
    play.textContent = stage.playing ? "Pause" : "Abspielen";
    if (bar !== document.activeElement) bar.value = String(stage.time);
  };
  play.onclick = () => {
    if (stage.time >= 1) stage.time = 0;
    stage.playing = !stage.playing;
    sync();
  };
  bar.oninput = () => {
    stage.playing = false;
    stage.time = Number(bar.value);
    sync();
  };
  side.querySelector<HTMLButtonElement>("#g-reset")!.onclick = () => {
    stage.time = 0;
    stage.playing = false;
    sync();
  };
  stage.syncUI = sync;
  sync();
}
export function presetOptions(select: HTMLSelectElement, id: string, related?: readonly string[]) {
  const variants = viewOptions(id).filter(([value]) => value !== id);
  select.replaceChildren(new Option("Darstellungen", ""));
  if (variants.length) {
    const group = document.createElement("optgroup");
    group.label = "Ansichten zu diesem Thema";
    group.append(...variants.map(([value, title]) => new Option(title, value)));
    select.append(group);
  }
  if (related && !variants.some(([value]) => value === related[0])) {
    const group = document.createElement("optgroup");
    group.label = "Fachlicher Zusammenhang";
    group.append(new Option(related[1], "related:" + related[0]));
    select.append(group);
  }
  select.dataset.seismic = id;
  select.dataset.related = related ? (variants.some(([value]) => value === related[0]) ? related[0] : "related:" + related[0]) : "";
}
