import type { World } from "../world";

import {comparisonLesson,teachingSteps,boundaryLesson} from "./learning";
import { names } from "./atlas";

const sites = {
  island: {
    kind: "divergent",
    direction: "Auseinander",
    text: "Beim Aufsteigen schmilzt ein Teil des festen Gesteins durch sinkenden Druck. Kühlt die Schmelze ab, entsteht neuer Ozeanboden.",
  },
  japan: {
    kind: "convergent",
    direction: "Aufeinander zu",
    text: "Hier taucht die Pazifische Platte ab. An anderen Grenzen können zwei Kontinente zusammenstoßen.",
  },
  san: {
    kind: "transform",
    direction: "Aneinander vorbei",
    text: "Bei Parkfield bewegen sich beide Seiten seitlich aneinander vorbei. Verhakt sich die Störung, kann sich die Spannung ruckartig in einem Erdbeben lösen.",
  },
} as const;

type SiteKey = keyof typeof sites;
export function isProcessSite(id: string): id is SiteKey {
  return Object.hasOwn(sites, id);
}

const swatches = {
  divergent: "Auseinander",
  convergent: "Aufeinander zu",
  transform: "Aneinander vorbei",
};
const sortedPlates = Object.entries(names).sort((a, b) =>
  a[1].localeCompare(b[1], "de"),
);
const check = (id: string, label: string, on: boolean) =>
  `<label class="plateCheck"><input type="checkbox" id="${id}" ${on ? "checked" : ""}>${label}</label>`;

export function plateControls(world: World) {
  const options = world.plateOptions;
  const site = world.processSite;
  const picker = `<label class="siteSelect">Bewegungen ansehen<select id="tectonicSite"><option value="">Weltkarte</option>${Object.entries(
    {
      island: "Island – auseinander",
      japan: "Japan – aufeinander zu",
      san: "Kalifornien – aneinander vorbei",
    },
  )
    .map(
      ([id, name]) =>
        `<option value="${id}" ${id === site ? "selected" : ""}>${name}</option>`,
    )
    .join("")}</select></label>`;
  if (site) {
    const info = sites[site];
    return `<h1>${info.direction}</h1>${picker}
      <div class="regionScale" role="group" aria-label="Blick auf die Region"><button id="regionalOverview" aria-pressed="${!world.processDetail}">Region</button><button id="localProcess" aria-pressed="${world.processDetail}">Prozessmodell</button></div>
      ${check("plateNames", "Namen zeigen", options.names)}
      ${
        world.processDetail
          ? `
        <div class="playback"><button id="playProcess" class="playButton" aria-pressed="${world.processPlaying}"></button><button id="resetProcess" aria-label="Bewegung zurücksetzen" title="Bewegung zurücksetzen"><i data-lucide="rotate-ccw" aria-hidden="true"></i></button></div>
        <div class="playSettings">${check("slowProcess", "Zeitlupe", world.processSlow)}${check("loopProcess", "Wiederholen", world.processLoop)}</div>
        ${
          options.names
            ? `<details id="processText"><summary>Weitere Einstellungen</summary><label class="siteSelect">Begriff hervorheben<select id="objectChoice"><option value="">Grundauswahl</option>${world
                .processObjects()
                .map(
                  (a) =>
                    `<option value="${a.id}" ${world.processChoice === a.id ? "selected" : ""}>${a.name}</option>`,
                )
                .join("")}</select></label><p>${info.text}</p></details>`
            : ""
        }`
          : ""
      }
      <button id="plateOverview" class="atlasReturn"><i data-lucide="globe-2" aria-hidden="true"></i> Zur Plattenkarte</button>`;
  }
  const filter = `<fieldset id="kindFilter"><legend>Grenztyp hervorheben</legend>
    ${(["all", "divergent", "convergent", "transform"] as const).map((id) => `<label><input type="radio" name="kindFilter" value="${id}" ${options.category === id ? "checked" : ""}><span>${id === "all" ? "" : `<i class="swatchDot ${id}"></i>`}${id === "all" ? "Alle" : swatches[id]}</span></label>`).join("")}</fieldset>`;
  const boundary = world.selectedBoundary;
  const profile = world.profiles[world.profileCode];
  const playback=`<div class="playback"><button id="atlasPlay" class="playButton" ${world.mosaic?"":"disabled"}>Platten bewegen</button>
    <button id="atlasReset" aria-label="Bewegung zurücksetzen" title="Bewegung zurücksetzen"><i data-lucide="rotate-ccw" aria-hidden="true"></i></button></div>
    ${check("atlasSlow","Langsamer",world.mosaic?.slow ?? false)}`;
  const pair=world.mosaic?.pair;
  if (pair && profile) {
    return `<div class="pair-navigation"><label>Grenzvergleich<select id="pair-examples">${Object.entries({...teachingSteps,[pair.step[0]]:boundaryLesson(pair.step).place}).map(([id,text])=>`<option value="${id}" ${Number(id)===pair.step[0]?"selected":""}>${text}</option>`).join("")}</select></label>${playback}</div>${comparisonLesson(pair.step)}<div id="pair-object" hidden></div><button id="atlasWorld" class="atlasReturn">Zur Weltansicht</button><div hidden>${picker}</div>`;

  }
  const title=profile ? `<div class="panelHead"><h1 data-teach="terms">Plattentektonik</h1><button id="atlasAll" aria-label="Steckbrief schließen" title="Schließen">×</button></div>` : '<h1 data-teach="terms">Plattentektonik</h1>';
  const card = profile ? `<section class="scienceCard" id="plateProfile" aria-live="polite">
    <h2>${names[world.profileCode]}</h2><dl><dt>Lage</dt><dd>${profile.place}</dd>
    <dt>Bewegung</dt><dd data-teach="phase">${profile.motion}</dd><dt>Beispiel an einer Plattengrenze</dt><dd data-teach="effects">${profile.boundary}</dd></dl>
    <details><summary>Nachbarplatten</summary><p>${profile.neighbours}</p></details><div class="profileActions"><button id="atlasLocate">Zentrieren</button><button id="atlasCompare">Grenze ansehen</button><button id="atlasWorld">Weltansicht</button></div></section>` : "";
  const note=boundary?boundaryLesson(boundary.step):undefined;
  const selected=note&&boundary?`<section class="scienceCard boundaryHint" aria-live="polite"><h2 data-teach="terms">${note.term}</h2><small>${note.place}</small><p data-teach="phase">${note.motion}</p>${options.names?`<p data-teach="labels">${note.plates.join(" · ")}</p>`:""}<p data-teach="cause">${note.cause} ${options.names?note.polarity:""}</p><button id="compare-selected">Bewegung dieser Grenze ansehen</button></section>`:"";
  const start=`<label class="siteSelect">Grenzvergleich auswählen<select id="pair-examples"><option value="">Grenze wählen</option>${Object.entries(teachingSteps).map(([id,text])=>`<option value="${id}">${text}</option>`).join("")}</select></label><div class="playback"><button id="atlasPlay" class="playButton" ${world.mosaic?"":"disabled"}>Platten bewegen</button></div>`;
  return `${title}${selected}${start}${card}
    <div class="plateChecks">${check("boundaries", "Plattengrenzen zeigen", options.boundaries)}
    ${check("plateNames", "Namen zeigen", options.names || world.singlePlateName)}</div>
    ${options.types?'<p class="boundary-legend"><span><i class="swatchDot divergent"></i>Divergenz</span><span><i class="swatchDot convergent"></i>Konvergenz</span><span><i class="swatchDot transform"></i>Transformbewegung</span></p>':""}
    ${picker}
    ${options.boundaries && !options.names && options.plate ? check("onePlateName", "Gewählten Namen zeigen", world.singlePlateName) : ""}
    <details id="plateSettings"><summary>Weitere Einstellungen</summary>
    ${check("boundaryTypes", "Grenztypen unterscheiden", options.types)}
    ${options.types ? filter : ""}
    ${options.names ? check("smallPlates", "Auch kleinere Platten im Fernblick benennen", world.smallPlateNames) : ""}
    ${`<label class="siteSelect">Platte auswählen<select id="plateSelect"><option value="">Keine</option></select></label>`}
    </details>
    ${!boundary&&options.boundaries ? `<p class="boundaryHint" aria-live="polite">Eine Fläche oder Grenze auf dem Globus antippen.</p>` : ""}`;
}

export function bindPlateControls(
  side: HTMLElement,
  world: World,
  render: () => void,
) {
  const refresh = (id: string) => {
    render();
    document.getElementById(id)?.focus({ preventScroll: true });
  };
  const bindCheck = (id: string, fn: (on: boolean) => void) => {
    const input = side.querySelector<HTMLInputElement>("#" + id);
    if (input) input.onchange = () => fn(input.checked);
  };
  for (const [id, key] of [
    ["boundaries", "boundaries"],
    ["plateNames", "names"],
    ["boundaryTypes", "types"],
  ] as const)
    bindCheck(id, (on) => {
      if (key === "names" && !on && !world.processSite) world.inspectPlate("");
      world.setPlateOptions(
        key === "types" && on
          ? { types: true, boundaries: true }
          : { [key]: on },
      );
      refresh(id);
    });
  bindCheck("smallPlates", (on) => {
    world.smallPlateNames = on;
    refresh("smallPlates");
  });
  const choice = side.querySelector<HTMLSelectElement>("#objectChoice");
  if (choice)
    choice.onchange = () => {
      world.processChoice = choice.value;
    };
  bindCheck("onePlateName", (on) => {
    world.singlePlateName = on;
    refresh("onePlateName");
  });
  for (const radio of side.querySelectorAll<HTMLInputElement>(
    "#kindFilter input",
  ))
    radio.onchange = () => {
      const selected = world.selectedBoundary;
      world.setPlateOptions({
        category: radio.value as typeof world.plateOptions.category,
      });
      if (selected && !world.selectedBoundary) {
        render();
        side
          .querySelector<HTMLInputElement>("#kindFilter input:checked")
          ?.focus({ preventScroll: true });
      }
    };
  const select = side.querySelector<HTMLSelectElement>("#plateSelect");
  const settings = side.querySelector<HTMLDetailsElement>("#plateSettings");
  if (select && settings) {
    const populate = () => {
      if (!settings.open && !world.plateOptions.names) { select.length=1; return; }
      if (select.length===1) {
        for (const [code,name] of sortedPlates) select.add(new Option(name,code));
        select.value=world.plateOptions.plate;
      }
    };
    settings.ontoggle=populate;
    populate();
  }
  if (select)
    select.onchange = () => {
      world.inspectPlate(select.value);
      refresh("plateSelect");
    };
  const pairs = side.querySelector<HTMLSelectElement>("#pair-examples");
  if(pairs)pairs.onchange=()=>{if(pairs.value){world.comparePlates(false,Number(pairs.value));refresh("pair-examples");}};
  const region = side.querySelector<HTMLSelectElement>("#tectonicSite")!;
  region.onchange = () => {
    if (isProcessSite(region.value)) world.visit(region.value);
    else world.plateOverview();
    refresh("tectonicSite");
  };
  const click = (id: string, fn: () => void) =>
    side.querySelector("#" + id)?.addEventListener("click", fn);
  click("atlasPlay", () => {
    const wasOpen=!!world.mosaic?.pair;
    world.comparePlates(true);
    if (!wasOpen) refresh("atlasPlay");
    syncPlayback(world);
  });
  click("compare-selected",()=>{const step=world.selectedBoundary?.step;if(step){world.comparePlates(false,step[0]);refresh("atlasPlay");}});
  click("atlasCompare", () => { world.comparePlates(false); refresh("atlasPlay"); });
  click("atlasReset", () => { world.mosaic?.reset(); syncPlayback(world); });
  click("atlasAll", () => { world.inspectPlate(""); refresh("atlasPlay"); });
  click("atlasWorld", () => { world.atlasWorld(); refresh("atlasPlay"); });
  click("atlasLocate", () => world.locatePlate());
  bindCheck("atlasSlow", on => { if (world.mosaic) world.mosaic.slow=on; });
  click("regionalOverview", () => {
    world.visit(world.processSite!, true);
    refresh("regionalOverview");
  });
  click("localProcess", () => {
    world.visit(world.processSite!);
    refresh("localProcess");
  });
  click("plateOverview", () => {
    world.plateOverview();
    refresh("tectonicSite");
  });
  click("playProcess", () => {
    world.toggleProcess();
    syncPlayback(world);
  });
  click("resetProcess", () => {
    world.resetProcess();
    syncPlayback(world);
  });
  bindCheck("slowProcess", (on) => {
    world.processSlow = on;
  });
  bindCheck("loopProcess", (on) => {
    world.processLoop = on;
  });
  syncPlayback(world);
}

export function syncPlayback(world: World) {
  const atlasButton = document.getElementById("atlasPlay");
  if (atlasButton && world.mosaic) {
    const {playing,progress} = world.mosaic;
    const title = playing ? "Pause" : progress >= 1 ? "Erneut bewegen" : progress > 0 ? "Fortsetzen" : "Platten bewegen";
    if (atlasButton.textContent !== title) atlasButton.textContent = title;
    atlasButton.setAttribute("aria-pressed",String(playing));
  }
  const button = document.getElementById("playProcess");
  if (!button) return;
  const text = world.processPlaying
    ? "Pausieren"
    : world.processProgress >= 1
      ? "Erneut abspielen"
      : world.processProgress > 0
        ? "Fortsetzen"
        : "Abspielen";
  if (button.textContent !== text) {
    button.textContent = text;
    button.setAttribute("aria-pressed", String(world.processPlaying));
  }
}
