import type { World } from "../world";
import type { NyosLessonState, NyosView } from "./state";
import { historicPlaces } from "./places";

const views: ReadonlyArray<readonly [NyosView, string]> = [
  ["lake", "See"], ["section", "Im See"], ["event", "CO₂-Freisetzung"],
];

function check(id: string, label: string, enabled: boolean) {
  return `<label class="nyosCheck"><input id="nyos-${id}" type="checkbox" ${enabled ? "checked" : ""}>${label}</label>`;
}

function dissolvedControl(state: NyosLessonState) {
  return `<div id="nyos-water-control">${check("dissolved", "Gelöstes CO₂ zeigen", state.dissolved)}
    <p id="nyos-key" class="nyosKey dissolvedKey" ${state.dissolved ? "" : "hidden"}>Analysefarbe Violett · CO₂ aus dem Untergrund reichert sich im Tiefenwasser an.</p></div>`;
}

function playback(state: NyosLessonState) {
  return `<div class="regionScale"><button class="playButton" id="nyos-play">Start</button>
      <button id="nyos-reset">Zurücksetzen</button></div>
    ${check("slow", "Zeitlupe", state.slow)}`;
}

function eventCaption(p: number) {
  if (p < .17) return "Unter der ruhigen Oberfläche ist CO₂ im Tiefenwasser gelöst. Was den ersten Aufstieg auslöste, ist ungeklärt.";
  if (p < .33) return "Steigt Tiefenwasser auf, nimmt der Druck ab.";
  if (p < .53) return "CO₂ tritt aus der Lösung aus. Die Blasen verstärken den Auftrieb und reißen weiteres Wasser mit.";
  if (p < .68) return "An der Oberfläche entweicht das Gas. In der Luft ist CO₂ unsichtbar.";
  if (p < .87) return "CO₂-reiche Luft kann in tieferes Gelände fließen. Wind und Durchmischung verändern ihren Weg und verdünnen sie.";
  return "In tieferen Talräumen waren Menschen besonders gefährdet. Unter anderem waren Nyos, Cha und Subum betroffen.";
}

function details(world: World) {
  const state = world.nyosLesson;
  if (state.view === "lake") return `<div class="regionScale" role="group" aria-label="Kartenausschnitt">
    <button id="nyos-overview" aria-pressed="${!world.nyosDetail}">Region</button>
    <button id="nyos-near" aria-pressed="${world.nyosDetail}">Zum See</button></div>`;
  if (state.view === "event") return `<p id="nyos-phase" class="nyosCaption" aria-live="polite">${eventCaption(state.progress)}</p>
    ${playback(state)}${dissolvedControl(state)}
    <div id="nyos-air-control" hidden>${check("air", "Gas in der Luft zeigen", state.air)}
      <p id="nyos-air-key" class="nyosKey dissolvedKey" hidden>CO₂ ist farblos. Die Analysefarbe zeigt eine mögliche Ausbreitung im Relief. Verlauf und Reichweite sind schematisch.</p></div>
    <div id="nyos-places" hidden>${historicPlaces}</div>`;
  return `<p class="nyosCaption">Leichteres Wasser liegt oben. Das dichtere Tiefenwasser mischt sich nur wenig mit ihm.</p>
    ${dissolvedControl(state)}`;
}

export function nyosControls(world: World) {
  if (world.nyos.error) return `<h1>Nyos-See</h1><p class="nyosCaption">Die Übersicht zeigt die Lage in Kamerun.</p>
    <button id="nyos-near">Geländedaten erneut laden</button>`;
  const tabs = views.map(([id,label]) =>
    `<button id="nyos-${id}" aria-pressed="${world.nyosLesson.view === id}">${label}</button>`
  ).join("");
  return `<h1>Nyos-See</h1><p class="nyosLocation">Kamerun</p>
    <div class="nyosViews" role="group" aria-label="Ansicht am Nyos-See">${tabs}</div>
    <div class="nyosDetail">${details(world)}</div>`;
}

export function bindNyosControls(side: HTMLElement, world: World, render: () => void) {
  const state = world.nyosLesson;
  const refresh = (id: string) => {
    render();
    document.getElementById(id)?.focus({ preventScroll: true });
  };
  for (const [id] of views) {
    side.querySelector("#nyos-" + id)?.addEventListener("click", () => {
      world.showNyos(id);
      refresh("nyos-" + id);
    });
  }
  for (const id of ["dissolved", "slow", "air"] as const) {
    const input = side.querySelector<HTMLInputElement>("#nyos-" + id);
    input?.addEventListener("change", () => {
      state[id] = input.checked;
      syncNyos(world);
    });
  }
  const restart = () => {
    const { dissolved, air } = state;
    world.showNyos(state.view);
    state.dissolved = dissolved;
    state.air = air;
  };
  side.querySelector("#nyos-play")?.addEventListener("click", () => {
    if (state.progress >= 1) {
      const slow = state.slow;
      restart();
      state.slow = slow;
    }
    state.togglePlayback();
    syncNyos(world);
  });
  side.querySelector("#nyos-reset")?.addEventListener("click", () => {
    restart();
    refresh("nyos-reset");
  });
  for (const [id, overview] of [["nyos-overview", true], ["nyos-near", false]] as const) {
    side.querySelector("#" + id)?.addEventListener("click", () => {
      world.visit("nyos", overview);
      refresh(id);
    });
  }
}

function setText(id: string, text: string) {
  const element = document.getElementById(id);
  if (element && element.textContent !== text) element.textContent = text;
}
function show(id: string, on: boolean) {
  const element = document.getElementById(id);
  if (element && element.hidden === on) element.hidden = !on;
}

export function syncNyos(world: World) {
  const p = world.nyosPin(), pin = document.getElementById("nyosPin")!;
  pin.hidden = !p;
  if (p) {
    pin.style.left = p.x + "px";
    pin.style.top = p.y + "px";
  }
  const state = world.nyosLesson;
  show("nyos-key", state.dissolved);
  if (state.view === "event") {
    setText("nyos-phase", eventCaption(state.progress));
    setText("nyos-play", state.playing ? "Pause" : state.progress >= 1 ? "Wiederholen" : state.progress > 0 ? "Fortsetzen" : "Start");
    show("nyos-water-control", state.progress < .53);
    show("nyos-air-control", state.progress >= .50);
    show("nyos-air-key", state.air);
    show("nyos-places", state.progress >= .87);
  }
  const d = world.nav.pose.d;
  const label = state.view === "event" ? "1986 · Historisches Erklärungsmodell" :
    state.view === "section" ? "Seequerschnitt · Beckenform schematisch" :
    d > 3800 ? "Afrika" : d > 900 ? "Kamerun" : d > 105 ? "Kamerun-Vulkanlinie" : d > 12 ? "Region um den Nyos-See" : "";
  const note = document.getElementById("modelnote")!;
  note.classList.remove("exaggerated");
  note.hidden = !label;
  setText("modelnote", label);
}
