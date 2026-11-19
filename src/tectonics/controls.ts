import type { World } from "../world";
import { siteCatalog } from "../regions";
import { names } from "./atlas";



const sites = {
  island: { kind: "divergent", direction: "Auseinander", text: "Beim Aufsteigen schmilzt ein Teil des festen Gesteins durch sinkenden Druck. Kühlt die Schmelze ab, entsteht neuer Ozeanboden." },
  japan: { kind: "convergent", direction: "Aufeinander zu", text: "Am Graben taucht die Pazifische Platte ab. Wasser aus ihr begünstigt das Schmelzen im Mantel darüber." },
  san: { kind: "transform", direction: "Aneinander vorbei", text: "Bei Parkfield bewegen sich beide Seiten seitlich aneinander vorbei. Verhakt sich die Störung, kann sich die Spannung ruckartig in einem Erdbeben lösen." },
} as const;

type SiteKey = keyof typeof sites;
export function isProcessSite(id: string): id is SiteKey {
  return Object.hasOwn(sites, id);
}

const movement = { divergent:"Zwei Platten bewegen sich voneinander weg.", convergent:"Zwei Platten bewegen sich aufeinander zu. An manchen Grenzen taucht eine Platte unter die andere ab.", transform:"Zwei Platten bewegen sich seitlich aneinander vorbei." };
const swatches = { divergent: "Auseinander", convergent: "Aufeinander zu", transform: "Aneinander vorbei" };
const sortedPlates = Object.entries(names).sort((a, b) => a[1].localeCompare(b[1], "de"));
const check = (id: string, label: string, on: boolean) =>
  `<label class="plateCheck"><input type="checkbox" id="${id}" ${on ? "checked" : ""}>${label}</label>`;

export function plateControls(world: World) {
  const options = world.plateOptions;
  const site = world.processSite;
  const picker = `<label class="siteSelect">Region erkunden<select id="tectonicSite"><option value="">Weltkarte</option>${siteCatalog.filter(s => isProcessSite(s.id)).map(s =>
    `<option value="${s.id}" ${s.id === site ? "selected" : ""}>${s.name}</option>`).join("")}</select></label>`;
  if (site) {
    const info = sites[site];
    return `<h1>${info.direction}</h1>${picker}
      <div class="regionScale" role="group" aria-label="Blick auf die Region"><button id="regionalOverview" aria-pressed="${!world.processDetail}">Region</button><button id="localProcess" aria-pressed="${world.processDetail}">Prozessmodell</button></div>
      ${world.processDetail ? `${check("plateNames","Objektnamen zeigen",options.names)}
        <div class="playback"><button id="playProcess" class="playButton" aria-pressed="${world.processPlaying}"></button><button id="resetProcess" aria-label="Bewegung zurücksetzen" title="Bewegung zurücksetzen"><i data-lucide="rotate-ccw" aria-hidden="true"></i></button></div>
        <div class="playSettings">${check("slowProcess","Zeitlupe",world.processSlow)}${check("loopProcess","Wiederholen",world.processLoop)}</div>
        ${options.names ? `<details id="processText"><summary>Was geschieht?</summary><p>${info.text}</p></details>` : ""}` : ""}
      <button id="plateOverview" class="atlasReturn"><i data-lucide="globe-2" aria-hidden="true"></i> Zur Plattenkarte</button>`;
  }
  const filter = `<fieldset id="kindFilter"><legend>Grenztyp hervorheben</legend>
    ${(["all","divergent","convergent","transform"] as const).map(id => `<label><input type="radio" name="kindFilter" value="${id}" ${options.category === id ? "checked" : ""}><span>${id === "all" ? "" : `<i class="swatchDot ${id}"></i>`}${id === "all" ? "Alle" : swatches[id]}</span></label>`).join("")}</fieldset>`;
  const boundary = world.selectedBoundary;
  return `<h1>Plattentektonik</h1>
    <div class="plateChecks">${check("boundaries","Plattengrenzen zeigen",options.boundaries)}
    ${options.boundaries ? check("plateNames","Plattennamen zeigen",options.names) + check("boundaryTypes","Grenztypen unterscheiden",options.types) : ""}</div>
    ${options.boundaries && options.types ? filter : ""}
    ${options.boundaries && options.names ? `<label class="siteSelect">Platte hervorheben<select id="plateSelect"><option value="">Keine</option>${sortedPlates.map(([code,name]) => `<option value="${code}" ${code === options.plate ? "selected" : ""}>${name}</option>`).join("")}</select></label>` : ""}
    ${picker}
    ${options.boundaries ? `<p class="boundaryHint" aria-live="polite">${boundary ? `<strong>${swatches[boundary.kind]}</strong><br>${movement[boundary.kind]}${options.names ? "<br>"+boundary.plates.join(" · ") : ""}` : "Eine Grenze auf dem Globus antippen."}</p>` : ""}`;
}

export function bindPlateControls(side: HTMLElement, world: World, render: () => void) {
  const refresh = (id: string) => { render(); document.getElementById(id)?.focus({preventScroll:true}); };
  const bindCheck = (id: string, fn: (on: boolean) => void) => {
    const input = side.querySelector<HTMLInputElement>("#" + id);
    if (input) input.onchange = () => fn(input.checked);
  };
  for (const [id, key] of [["boundaries","boundaries"],["plateNames","names"],["boundaryTypes","types"]] as const)
    bindCheck(id, on => { world.setPlateOptions({[key]:on}); refresh(id); });
  for (const radio of side.querySelectorAll<HTMLInputElement>("#kindFilter input"))
    radio.onchange = () => {
      const selected = world.selectedBoundary;
      world.setPlateOptions({category:radio.value as typeof world.plateOptions.category});
      if (selected && !world.selectedBoundary) {
        render();
        side.querySelector<HTMLInputElement>("#kindFilter input:checked")?.focus({preventScroll:true});
      }
    };
  const select = side.querySelector<HTMLSelectElement>("#plateSelect");
  if (select) select.onchange = () => world.setPlateOptions({plate:select.value});
  const region = side.querySelector<HTMLSelectElement>("#tectonicSite")!;
  region.onchange = () => {
    if (isProcessSite(region.value)) world.visit(region.value);
    else world.plateOverview();
    refresh("tectonicSite");
  };
  const click = (id: string, fn: () => void) => side.querySelector("#" + id)?.addEventListener("click", fn);
  click("regionalOverview", () => { world.visit(world.processSite!, true); refresh("regionalOverview"); });
  click("localProcess", () => { world.visit(world.processSite!); refresh("localProcess"); });
  click("plateOverview", () => { world.plateOverview(); refresh("tectonicSite"); });
  click("playProcess", () => { world.toggleProcess(); syncPlayback(world); });
  click("resetProcess", () => { world.resetProcess(); syncPlayback(world); });
  bindCheck("slowProcess", on => { world.processSlow = on; });
  bindCheck("loopProcess", on => { world.processLoop = on; });
  syncPlayback(world);
}

export function syncPlayback(world: World) {
  const button = document.getElementById("playProcess");
  if (!button) return;
  const text = world.processPlaying ? "Pausieren" : world.processProgress >= 1 ? "Erneut abspielen" : world.processProgress > 0 ? "Fortsetzen" : "Abspielen";
  if (button.textContent !== text) {
    button.textContent = text;
    button.setAttribute("aria-pressed", String(world.processPlaying));
  }
}
