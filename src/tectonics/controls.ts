import type { World } from "../world";

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

const movement = {
  divergent: "Zwei Platten bewegen sich voneinander weg.",
  convergent:
    "Zwei Platten bewegen sich aufeinander zu. An manchen Grenzen taucht eine Platte unter die andere ab.",
  transform: "Zwei Platten bewegen sich seitlich aneinander vorbei.",
};
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
  const card = profile ? `<section class="scienceCard" id="plateProfile" aria-live="polite">
    <div class="plateCardHead"><h2>${names[world.profileCode]}</h2><button id="atlasAll" title="Schließen" aria-label="Schließen">×</button></div><dl><dt>Lage</dt><dd>${profile.place}</dd>
    <dt>Bewegung</dt><dd>${profile.motion}</dd><dt>An der Grenze</dt><dd>${profile.boundary}</dd></dl>
    <button id="atlasLocate">Zentrieren</button><button id="atlasWorld">Weltansicht</button></section>` : "";
  return `<h1>Plattentektonik</h1>
    <div class="playback"><button id="atlasPlay" class="playButton" ${world.mosaic?"":"disabled"}>Platten bewegen</button>
    <button id="atlasReset" aria-label="Bewegung zurücksetzen" title="Bewegung zurücksetzen"><i data-lucide="rotate-ccw" aria-hidden="true"></i></button></div>
    ${check("atlasSlow", "Langsamer", world.mosaic?.slow ?? false)}
    ${card}
    <div class="plateChecks">${check("boundaries", "Plattengrenzen zeigen", options.boundaries)}
    ${check("plateNames", "Namen zeigen", options.names || world.singlePlateName)}</div>
    ${picker}
    ${options.boundaries && !options.names && options.plate ? check("onePlateName", "Gewählten Namen zeigen", world.singlePlateName) : ""}
    <details id="plateSettings"><summary>Weitere Einstellungen</summary>
    ${check("boundaryTypes", "Grenztypen unterscheiden", options.types)}
    ${options.types ? filter : ""}
    ${options.names ? check("smallPlates", "Auch kleinere Platten im Fernblick benennen", world.smallPlateNames) : ""}
    ${`<label class="siteSelect">Platte auswählen<select id="plateSelect"><option value="">Keine</option></select></label>`}
    </details>
    ${options.boundaries ? `<p class="boundaryHint" aria-live="polite">${boundary ? `<strong>${swatches[boundary.kind]}</strong><br>${movement[boundary.kind]}${options.names ? "<br>" + boundary.plates.join(" · ") : ""}` : "Eine Fläche oder Grenze auf dem Globus antippen."}</p>` : ""}`;
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
  const region = side.querySelector<HTMLSelectElement>("#tectonicSite")!;
  region.onchange = () => {
    if (isProcessSite(region.value)) world.visit(region.value);
    else world.plateOverview();
    refresh("tectonicSite");
  };
  const click = (id: string, fn: () => void) =>
    side.querySelector("#" + id)?.addEventListener("click", fn);
  click("atlasPlay", () => { world.mosaic?.play(); syncPlayback(world); });
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
