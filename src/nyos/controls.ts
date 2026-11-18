import type { World } from "../world";
import type { NyosView } from "./state";

const views: ReadonlyArray<readonly [NyosView, string]> = [
  ["lake", "See"], ["section", "Im See"],
];

function check(id: string, label: string, enabled: boolean) {
  return `<label class="nyosCheck"><input id="nyos-${id}" type="checkbox" ${enabled ? "checked" : ""}>${label}</label>`;
}

export function nyosControls(world: World) {
  const state = world.nyosLesson;
  if (world.nyos.error) {
    return `<h1>Nyos-See</h1><p class="nyosCaption">Die Übersicht zeigt die Lage in Kamerun.</p>
      <button id="nyos-near">Geländedaten erneut laden</button>`;
  }
  const tabs = views.map(([id,label]) =>
    `<button id="nyos-${id}" aria-pressed="${state.view === id}">${label}</button>`
  ).join("");
  const detail = state.view === "lake" ?
    `<div class="regionScale" role="group" aria-label="Kartenausschnitt">
      <button id="nyos-overview" aria-pressed="${!world.nyosDetail}">Region</button>
      <button id="nyos-near" aria-pressed="${world.nyosDetail}">Zum See</button>
    </div>` :
    `<p class="nyosCaption">Leichteres Wasser liegt oben. Das dichtere Tiefenwasser mischt sich nur wenig mit ihm.</p>
      ${check("dissolved", "Gelöstes CO₂ zeigen", state.dissolved)}
      <p id="nyos-key" class="nyosKey" ${state.dissolved ? "" : "hidden"}>Analysefarbe · CO₂ aus dem Untergrund reichert sich im Tiefenwasser an.</p>`;
  return `<h1>Nyos-See</h1><p class="nyosLocation">Kamerun</p>
    <div class="nyosViews" role="group" aria-label="Ansicht am Nyos-See">${tabs}</div>
    <div class="nyosDetail">${detail}</div>`;
}

export function bindNyosControls(side: HTMLElement, world: World, render: () => void) {
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
  side.querySelector<HTMLInputElement>("#nyos-dissolved")?.addEventListener("change", (e) => {
    world.nyosLesson.dissolved = (e.currentTarget as HTMLInputElement).checked;
    const key = document.getElementById("nyos-key");
    if (key) key.hidden = !world.nyosLesson.dissolved;
  });
  for (const [id, overview] of [["nyos-overview", true], ["nyos-near", false]] as const) {
    side.querySelector("#" + id)?.addEventListener("click", () => {
      world.visit("nyos", overview);
      refresh(id);
    });
  }
}

export function syncNyos(world: World) {
  const p = world.nyosPin(), pin = document.getElementById("nyosPin")!;
  pin.hidden = !p;
  if (p) {
    pin.style.left = p.x + "px";
    pin.style.top = p.y + "px";
  }
  const note = document.getElementById("modelnote")!;
  const d = world.nav.pose.d;
  const label = world.nyosLesson.view === "section" ? "Seequerschnitt · Beckenform schematisch" :
    d > 3800 ? "Afrika" : d > 900 ? "Kamerun" : d > 105 ? "Kamerun-Vulkanlinie" : d > 12 ? "Region um den Nyos-See" : "";
  note.classList.remove("exaggerated");
  note.hidden = !label;
  if (note.textContent !== label) note.textContent = label;
}
