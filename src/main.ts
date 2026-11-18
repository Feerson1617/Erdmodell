import { regions, firstRegion } from "./regions";
import "@fontsource-variable/dm-sans/wght.css";
import "./style.css";
import {
  createIcons,
  Globe2,
  Layers3,
  MapPin,
  Maximize,
  Info,
  ChevronRight,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Minus,
  RotateCcw,
  MousePointer2,
  Focus,
  Orbit,
  Compass,
  Check,
  X,
  Scan,
  Eye,
  EyeOff,
  Move,
  SlidersHorizontal,
  Map as MapIcon,
  PanelLeftClose,
  Mountain,
  Sun,
  Keyboard,
  Navigation2,
  ChevronDown,
} from "lucide";
import { Investigation } from "./investigation";
import { World } from "./world";

import { layers, type Style } from "./model";
import { modelLimits, evidence } from "./knowledge";
const icons = {
  Globe2,
  Layers3,
  MapPin,
  Maximize,
  Info,
  ChevronRight,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Minus,
  RotateCcw,
  MousePointer2,
  Focus,
  Orbit,
  Compass,
  Check,
  X,
  Scan,
  Eye,
  EyeOff,
  Move,
  SlidersHorizontal,
  Map: MapIcon,
  PanelLeftClose,
  Mountain,
  Sun,
  Keyboard,
  Navigation2,
  ChevronDown,
};
const icon = (n: string) => `<i data-lucide="${n}" aria-hidden="true"></i>`;
const paint = () => createIcons({ icons, attrs: { "stroke-width": 1.65 } });
const button = (id: string, label: string, glyph: string) =>
  `<button type="button" id="${id}" aria-label="${label}" title="${label}">${icon(glyph)}</button>`;
const brand = `<svg class="brandmark" width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true"><defs><clipPath id="disc"><circle cx="20" cy="20" r="16"/></clipPath></defs><circle cx="20" cy="20" r="16" fill="currentColor"/><g clip-path="url(#disc)" stroke="#17251f" stroke-width="2.4"><path d="M-5 19Q6 30 18 12T45 5M-5 26Q7 37 22 17T46 13M-4 33Q10 44 26 23T48 20M0 39Q13 50 30 29T49 28"/></g></svg>`;
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
$("app").innerHTML =
  `<header><div class="brand">${brand}<span>GeoRisiko <b>3D</b></span></div><nav aria-label="Hauptansichten">${[
    ["globe", "Globus", "globe-2"],
    ["inside", "Erdinneres", "layers-3"],
    ["place", "Orte entdecken", "map-pin"],
  ]
    .map(
      ([id, s, i]) =>
        `<button id="nav-${id}">${icon(i)}<span>${s}</span></button>`,
    )
    .join(
      "",
    )}</nav><div class="headTools">${button("info", "Informationen", "info")}<button id="present" title="Präsentationsmodus">${icon("maximize")}<span>Präsentieren</span></button></div></header>
<main id="desk"><div class="stars" aria-hidden="true"></div><div class="mast"><span class="live"></span> ERDOBSERVATORIUM <span class="slash">/</span> <span id="section">GLOBALE ANSICHT</span></div>
<div id="boardBar" hidden><div class="boardBrand">${brand}<span>Unterrichtsansicht</span></div><div class="boardViews"><button id="boardGlobe">${icon("globe-2")} Globus</button><button id="boardInside">${icon("layers-3")} Erdinneres</button></div><button id="exitPresent">${icon("panel-left-close")} Menü zeigen</button></div><aside id="sidebar"></aside>
<section class="view" aria-label="Interaktive 3D-Ansicht"><div id="reticle" aria-hidden="true"><span>N</span><span>S</span><i></i><i></i></div><canvas id="earth" tabindex="0" aria-label="Drehbares Erdmodell. Pfeiltasten drehen, Plus und Minus zoomen."></canvas><div id="marker"><button title="Hallig Hooge besuchen">Hallig Hooge ${icon("arrow-up-right")}</button></div><div class="orientation" title="Geografischer Norden">${icon("navigation-2")} N</div>
<div class="tools">${button("in", "Vergrößern", "plus")}${button("out", "Verkleinern", "minus")}${button("tilt", "Neigung ändern", "compass")}${button("home", "Startansicht", "rotate-ccw")}</div>
<div id="pins" aria-hidden="true">${layers.map((l, i) => `<span style="--rock:#${l.color.toString(16)}" hidden>${i + 1}</span>`).join("")}</div><div id="modelnote" hidden></div></section>
<section class="bottom" aria-label="Darstellung und Bedienung"><div class="stylePicker"><span class="caption">GRAFIKSTIL</span><div class="switch"><button id="designA"><b>A</b> Realistisch</button><button id="designB">Vergleich · B</button></div></div><div class="hint">${icon("mouse-pointer-2")} Ziehen zum Drehen <em></em> Scrollen zum Zoomen</div></section>
</main><footer><span><i class="live"></i><span id="status" role="status">Erdmodell wird geladen …</span></span><span class="readings"><span class="cross">⌖</span> <span id="coords"></span><em></em><span id="distance"></span></span></footer>
<dialog id="dialog"><div class="dialogHead"><span class="caption">GEO<span class="green">RISIKO</span> 3D</span>${button("closeDialog", "Schließen", "x")}</div><div id="content"></div></dialog>`;
const desk = $("desk"),
  side = $("sidebar"),
  dialog = $<HTMLDialogElement>("dialog"),
  content = $("content"),
  status = $("status");
const investigation = new Investigation();
let world: World,
  choice = 1,
  alertText = "",
  present = false,
  previous = "",
  labels = false;
const format = (n: number) =>
  new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(n);
function warn(s: string) {
  alertText = s;
  status.textContent = s;
}
function infoPage() {
  content.innerHTML = `<h2>Das Erdobservatorium</h2><p>Erkunde die Oberfläche, öffne das Erdinnere oder folge dem Globus bis zur Hallig Hooge.</p><h3>Navigation</h3><p>Ziehen oder Pfeiltasten drehen die Erde. Mausrad, zwei Finger oder + / − zoomen. Umschalt + Ziehen neigt die Kamera. Eine eigene Bewegung unterbricht den Flug. Pos1 führt zurück.</p><h3>Daten & Modellgrenzen</h3><p>Regionale Landbedeckung: ESA WorldCover 2021 (CC BY 4.0). Helgoländer Höhen: Copernicus DEM GLO-30. Luftbilder: © GeoBasis-DE/LVermGeo SH/CC BY 4.0. NASA Blue Marble, NOAA ETOPO1, Natural Earth und <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap-Mitwirkende (ODbL)</a>. Alle Karten liegen lokal vor. Bildfarben, Wasserbewegung und Beleuchtung sind stilisiert. <a href="${import.meta.env.BASE_URL}licenses/Geodaten.txt" target="_blank" rel="noopener">Quellen und Lizenzen</a></p><p>Globale Höhen sind geglättet. Für Hooge stammen Küste, Grundrisse und Warftlagen aus der Karte. Höhen, Dächer und Bäume sind modelliert. Der Wasserstand zeigt keine bestimmte Tide.</p><h3>Für den Unterricht</h3><p>Vorhersagen, betrachten, vergleichen. Welche Schicht nimmt den größten Raum ein? Prüft eure Vermutung mit dem Schnitt und wechselt zwischen den beiden Maßstäben.</p>`;
  openDialog();
}
function openDialog() {
  if (!dialog.open) dialog.showModal();
  $("closeDialog").focus();
}
function layerName(i: number) {
  return labels ? layers[i].name : `Schale ${i + 1}`;
}
function layerInfo() {
  if (!labels) {
    content.innerHTML =
      '<span class="caption">ENTDECKEN UND VERMUTEN</span><h2>Wie sieht es innen aus?</h2><p>Skizziert eure Vorstellung auf Papier. Welche Bereiche könnten fest sein, welche flüssig? Nennt einen Grund für eure Vermutung.</p>';
    openDialog();
    return;
  }
  const l = layers[choice];
  content.innerHTML = `<span class="caption">GRUNDWISSEN · STOFFLICHE GLIEDERUNG</span><h2>${l.name}</h2><p>${l.text}</p><dl><dt>Tiefe im Referenzmodell</dt><dd>${l.range.replace("¹", "")}</dd><dt>${choice === 3 ? "Radius" : "Mächtigkeit"}</dt><dd>${l.thickness.replace("Radius ", "")}</dd></dl><details><summary>Fachwissen vertiefen</summary><p>${l.deep}</p><p>Die stoffliche Gliederung beschreibt, woraus die Erde besteht. Bei der mechanischen Gliederung fragen wir, wie sich Material verformt. Die Lithosphäre umfasst die Kruste und den starren obersten Mantel. Ihre Platten bewegen sich über lange Zeiträume.</p></details><div class="lessonNav"><button id="prevLayer" aria-label="Vorherige Schicht">←</button><span>${choice + 1} von 4</span><button id="nextLayer" aria-label="Nächste Schicht">→</button></div>`;
  for (const [id, delta] of [
    ["prevLayer", 3],
    ["nextLayer", 1],
  ] as const)
    $(id).onclick = () => {
      select((choice + delta) % 4);
      layerInfo();
      $(id).focus();
    };
  openDialog();
}
function showEvidence() {
  content.innerHTML = evidence(labels);
  openDialog();
}
function showLimits() {
  content.innerHTML = `<span class="caption">MODELLKRITIK</span><h2>Was vereinfacht das Modell?</h2><p>${labels ? modelLimits : "Farben unterscheiden die Bereiche. Sie sind keine Fotografien aus der Tiefe. Die glatten Grenzen sind vereinfacht. Die Dicke der äußeren Schale variiert in der Natur."}</p><p>Ein Keil legt die gedachten Schnittflächen frei. Beim Verbreitern der äußeren Schale verschiebt sich nur ihre untere Grenze. Die Tiefenangaben beziehen sich auf das Referenzmodell.</p><p>Seismische Signale, Dichtemessungen und Experimente liefern unterschiedliche Belege. Forschende vergleichen die Modellannahmen mit diesen Beobachtungen.</p>`;
  openDialog();
}
function renderShellControls() {
  const shell = world.shell;
  return `<div class="eyebrow"><i></i> SCHALENMODELL</div><h1>${labels ? "Untersuchen" : "Entdecken"}<span>.</span></h1>
  <button id="labels" class="reveal" aria-pressed="${labels}">${icon(labels ? "eye-off" : "eye")}${labels ? "Namen verbergen" : "Namen einblenden"}</button>
  <div class="layerlist">${layers.map((l, i) => `<div class="layer ${shell.selected === i ? "chosen" : ""}" style="--rock:#${l.color.toString(16)}"><button data-layer="${i}" aria-pressed="${shell.selected === i}"><span class="rockNumber">${i + 1}</span>${layerName(i)}</button><button class="eye" data-eye="${i}" aria-label="${layerName(i)} ${shell.visible[i] ? "ausblenden" : "einblenden"}" aria-pressed="${shell.visible[i]}">${icon(shell.visible[i] ? "eye" : "eye-off")}</button></div>`).join("")}</div>
  <div class="shellActions"><button id="isolate">${icon("focus")} Isolieren</button><button id="subdue" aria-pressed="${shell.subdued}" ${shell.selected === null ? "disabled" : ""}>Umfeld dämpfen</button><button id="restoreLayers">${icon("rotate-ccw")} Alle zeigen</button></div>
  <div class="range"><label for="opacity">Deckkraft · ${layerName(choice)}</label><input id="opacity" type="range" min="15" max="100" value="${shell.opacity[choice] * 100}"></div>
  <div class="options"><label><input id="cut" type="checkbox" ${shell.cut ? "checked" : ""}> Keilschnitt</label><label><input id="scale" type="checkbox" ${shell.expanded ? "checked" : ""}> ${labels ? "Kruste" : "Außenschale"} verbreitern</label></div>
  <div class="readingActions"><button class="action primary" id="layerInfo">${icon("info")}${labels ? "Grundwissen" : "Impulsfrage"}</button><button class="action secondary" id="evidence">Woher wissen wir das?</button><button id="investigate" class="action secondary">Hinweise aus dem Erdinneren</button><button id="limits">Modellgrenzen</button></div>`;
}
function siteInfo() {
  const r = world.region;
  content.innerHTML = `<h2>${r.name}</h2><div class="siteCard"><img src="${import.meta.env.BASE_URL}data/locator.webp" alt="Weltkarte mit markiertem Untersuchungsort"><i style="left:${(r.target.lon + 180) / 3.6}%;top:${(90 - r.target.lat) / 1.8}%"></i><span>${Math.abs(r.target.lat).toFixed(2)}° ${r.target.lat >= 0 ? "N" : "S"} · ${Math.abs(r.target.lon).toFixed(2)}° ${r.target.lon >= 0 ? "O" : "W"}</span></div><p>${r.limits}</p><h3>Detailstufen</h3><p>Globale Höhen liegen auf einem 0,5°-Raster. In der Deutschen Bucht zeigt die regionale Karte Landbedeckung in etwa 75-m-Feldern. Das regionale Wattenmeer-Luftbild zeigt rund 20 m pro Bildpunkt. Erst im Untersuchungsgebiet werden lokale Luftbilder und Gelände sichtbar.</p><p>${r.sources.join("<br>")}</p><p><a href="${import.meta.env.BASE_URL}licenses/Geodaten.txt" target="_blank" rel="noopener">Quellen und Nutzungsrechte</a></p>`;
  openDialog();
}

function renderSide() {
  const mode = world.mode;
  desk.dataset.mode = mode;
  for (const id of ["globe", "inside", "place"]) {
    $("nav-" + id).setAttribute("aria-current", mode === id ? "page" : "false");
  }
  $("section").textContent = {
    globe: "GLOBALE ANSICHT",
    inside: "SCHALENMODELL",
    place: "LOKALE ANSICHT",
  }[mode];
  if (mode === "globe")
    side.innerHTML = `<div class="eyebrow"><i></i> GLOBALER ATLAS</div><h1>Planet Erde<span>.</span></h1><p class="intro">Erkunde unseren Planeten von der Oberfläche bis in die Tiefe.</p><div class="facts"><div><b>6.371 <small>km</small></b><span>Mittlerer Radius</span></div><div><b>71 <small>%</small></b><span>Wasseroberfläche</span></div></div><button class="action primary" id="openInside">${icon("layers-3")} Erdinneres erkunden ${icon("arrow-right")}</button><button class="action secondary" id="visit">${icon("map-pin")} Hallig Hooge besuchen ${icon("arrow-up-right")}</button>`;
  if (mode === "place") {
    const r = world.region;
    side.innerHTML = `<div class="eyebrow"><i></i>${r.context}</div><h1>${r.name}<span>.</span></h1><p class="intro">${r.description}</p><label class="siteSelect">Untersuchungsort <select id="siteSelect">${[...regions.values()].map((site) => `<option value="${site.id}" ${site === r ? "selected" : ""}>${site.name}</option>`).join("")}</select></label><div class="siteActions"><button id="overview" class="action secondary">${icon("compass")} Inselübersicht</button><button id="nearby" class="action secondary">${icon("map-pin")} Nahansicht</button></div><button id="siteInfo" class="action primary">${icon("info")} Daten & Landschaft</button><button id="return" class="action secondary">${icon("globe-2")} Zur globalen Ansicht</button>`;
    $<HTMLSelectElement>("siteSelect").onchange = (e) => {
      world.visit((e.target as HTMLSelectElement).value);
      renderSide();
      $("siteSelect").focus();
    };
    $("overview").onclick = () => world.visit(r.id, true);
    $("nearby").onclick = () => world.visit(r.id);
  }
  if (mode === "inside") {
    side.innerHTML = investigation.active ? investigation.render(labels) : renderShellControls();
    if (investigation.active) investigation.bind(side, renderSide);
  }
  $("investigate")?.addEventListener("click", () => {
    investigation.active = true;
    renderSide();
    $("investTitle").focus();
  });
  if (mode === "globe" && present)
    side.innerHTML = `<div class="eyebrow"><i></i> ENTDECKEN UND VERMUTEN</div><h1>Planet Erde<span>.</span></h1><p class="intro">Wie könnte unsere Erde im Inneren aufgebaut sein?</p><button class="action primary" id="openInside">${icon("layers-3")} Schnitt öffnen</button>`;
  $("boardGlobe").setAttribute("aria-pressed", String(mode === "globe"));
  $("boardInside").setAttribute("aria-pressed", String(mode === "inside"));
  $("labels")?.addEventListener("click", () => {
    labels = !labels;
    if (!labels) investigation.reset();
    renderSide();
    $("labels").focus();
  });
  $("isolate")?.addEventListener("click", () => {
    world.shell.selected = choice;
    world.shell.visible = layers.map((_, i) => i === choice);
    updateShell("isolate");
  });
  $("restoreLayers")?.addEventListener("click", () => {
    world.shell.restore();
    updateShell("restoreLayers");
  });
  $("subdue")?.addEventListener("click", () => {
    world.shell.subdued = !world.shell.subdued;
    updateShell("subdue");
  });
  $("evidence")?.addEventListener("click", showEvidence);
  $("limits")?.addEventListener("click", showLimits);
  $("openInside")?.addEventListener("click", () => navigate("inside"));
  $("visit")?.addEventListener("click", () => navigate("place"));
  $("return")?.addEventListener("click", () => navigate("globe"));
  $("layerInfo")?.addEventListener("click", layerInfo);
  $("siteInfo")?.addEventListener("click", siteInfo);
  side
    .querySelectorAll<HTMLButtonElement>("[data-layer]")
    .forEach((b) => (b.onclick = () => select(+b.dataset.layer!)));
  side.querySelectorAll<HTMLButtonElement>("[data-eye]").forEach(
    (b) =>
      (b.onclick = () => {
        const i = +b.dataset.eye!;
        world.shell.visible[i] = !world.shell.visible[i];
        world.shell.rebuild();
        renderSide();
        side
          .querySelector<HTMLButtonElement>('[data-eye="' + i + '"]')
          ?.focus();
      }),
  );
  const range = $<HTMLInputElement>("opacity");
  if (range)
    range.oninput = () => {
      world.shell.opacity[choice] = +range.value / 100;
      world.shell.rebuild();
    };
  if ($("cut"))
    $<HTMLInputElement>("cut").onchange = (e) => {
      world.shell.cut = (e.target as HTMLInputElement).checked;
      world.shell.rebuild();
      updatePins();
    };
  if ($("scale"))
    $<HTMLInputElement>("scale").onchange = (e) => {
      world.shell.expanded = (e.target as HTMLInputElement).checked;
      world.shell.rebuild();
      updateNote();
      updatePins();
    };
  updateNote();
  updatePins();
  paint();
}
function updateShell(focus: string) {
  world.shell.rebuild();
  renderSide();
  $(focus)?.focus();
}
function select(i: number) {
  choice = i;
  world.shell.selected = i;
  world.shell.visible[i] = true;
  world.shell.rebuild();
  renderSide();
  side.querySelector<HTMLButtonElement>('[data-layer="' + i + '"]')?.focus();
}
function updateNote() {
  const note = $("modelnote");
  note.hidden = world.mode === "globe";
  note.classList.toggle(
    "exaggerated",
    world.mode === "inside" && world.shell.expanded,
  );
  note.textContent =
    world.mode === "inside"
      ? world.shell.expanded
        ? `Didaktisch überhöht – ${labels ? "Erdkruste" : "äußere Schale"} zur Veranschaulichung verbreitert`
        : labels
          ? "Maßstabsgetreues Referenzmodell – vereinfachte Krustendicke"
          : "Maßstabsgetreues Referenzmodell – vereinfachte Dicke der Außenschale"
      : world.region.label;
}
function navigate(mode: World["mode"]) {
  if (mode === "inside") world.inside();
  else if (mode === "place") world.visit();
  else world.globe();
  renderSide();
}
function reset() {
  investigation.reset();
  choice = 1;
  labels = false;
  world.region = firstRegion;
  world.shell.restore();
  world.shell.cut = true;
  world.shell.expanded = false;
  if (world.style !== "A") style("A");
  navigate("globe");
}
function style(s: Style) {
  world.setStyle(s);
  for (const a of ["A", "B"])
    $("design" + a).setAttribute("aria-pressed", String(a === s));
}
function flipPresent(value: boolean) {
  present = value;
  document.body.classList.toggle("present", value);
  $("boardBar").hidden = !value;
  const home = $("home");
  if (value) {
    $("boardBar").insertBefore(home, $("exitPresent"));
    home.insertAdjacentHTML("beforeend", "<span>Startansicht</span>");
  } else {
    home.querySelector("span")?.remove();
    document.querySelector(".tools")!.append(home);
  }
  renderSide();
  requestAnimationFrame(() => {
    world.resize();
    (value ? $("boardGlobe") : $("present")).focus({ preventScroll: true });
  });
}
$("boardGlobe").onclick = () => navigate("globe");
$("boardInside").onclick = () => navigate("inside");
function updatePins() {
  const pins = $("pins").children;
  const points = labels && world.mode === "inside" ? world.layerMarkers() : [];
  for (let i = 0; i < pins.length; i++) {
    const el = pins[i] as HTMLElement,
      p = points[i];
    el.hidden = !p;
    if (p) {
      el.style.left = p.x + "%";
      el.style.top = p.y + "%";
    }
  }
}
$("info").onclick = infoPage;
$("closeDialog").onclick = () => dialog.close();
dialog.onclick = (e) => {
  if (e.target === dialog) dialog.close();
};
$("present").onclick = async () => {
  flipPresent(true);
  try {
    await document.documentElement.requestFullscreen?.();
  } catch {
    /* Inline presentation remains available in an LMS iframe. */
  }
};
$("exitPresent").onclick = () => {
  flipPresent(false);
  if (document.fullscreenElement) void document.exitFullscreen();
};
document.onfullscreenchange = () => {
  if (!document.fullscreenElement) flipPresent(false);
};
const canvas = $<HTMLCanvasElement>("earth");
paint();
async function boot() {
  try {
    world = new World(canvas, warn);
  } catch {
    side.innerHTML = `<div class="eyebrow">ERSATZANSICHT</div><h1>Weltkarte</h1><p class="intro">WebGL 2 ist auf diesem Gerät nicht verfügbar. Die lokale Erdkarte zeigt die Kontinente zur Orientierung.</p>`;
    canvas.parentElement!.classList.add("fallback");
    document
      .querySelectorAll<HTMLButtonElement>(
        "nav button,.tools button,.switch button,#marker button,#present",
      )
      .forEach((b) => (b.disabled = true));
    warn("Ersatzansicht · lokale Weltkarte");
    return;
  }
  renderSide();
  world.onLayer = select;
  for (const m of ["globe", "inside", "place"] as const)
    $("nav-" + m).onclick = () => navigate(m);
  $("marker").querySelector("button")!.onclick = () => navigate("place");
  $("in").onclick = () => world.nav.zoom(0.68);
  $("out").onclick = () => world.nav.zoom(1 / 0.68);
  $("home").onclick = reset;
  $("tilt").onclick = () => {
    world.nav.stop();
    world.nav.goal.tilt =
      world.nav.goal.tilt > 55 ? 0 : world.nav.goal.tilt + 30;
  };
  $("designA").onclick = () => style("A");
  $("designB").onclick = () => style("B");
  $("designA").setAttribute("aria-pressed", "true");
  $("designB").setAttribute("aria-pressed", "false");
  document.addEventListener("keydown", (e) => {
    if (
      dialog.open ||
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLSelectElement ||
      e.altKey ||
      e.ctrlKey ||
      e.metaKey
    )
      return;
    const n = world.nav;
    if (e.key === "Home") reset();
    else if (["+", "=", "-"].includes(e.key))
      n.zoom(e.key === "-" ? 1.35 : 0.74);
    else if (e.key.startsWith("Arrow"))
      n.pan(
        e.key === "ArrowLeft" ? 42 : e.key === "ArrowRight" ? -42 : 0,
        e.key === "ArrowUp" ? 42 : e.key === "ArrowDown" ? -42 : 0,
      );
    else if (e.key === "Escape" && present) flipPresent(false);
    else return;
    e.preventDefault();
  });
  let lastHud = 0;
  let previousPose = "";
  world.onFrame = () => {
    const now = performance.now();
    if (now - lastHud < 55) return;
    lastHud = now;
    const { lat, lon, d } = world.nav.pose;
    document.querySelector<SVGElement>(".orientation svg")!.style.transform =
      "rotate(" + world.nav.pose.bearing + "deg)";
    const lonN = ((lon + 540) % 360) - 180;
    const poseKey = [
      lat.toFixed(4),
      lonN.toFixed(4),
      d.toPrecision(6),
      world.nav.pose.tilt.toFixed(3),
      world.nav.pose.bearing.toFixed(3),
      world.mode,
      canvas.clientHeight,
      canvas.clientWidth,
    ].join("/");
    if (poseKey !== previousPose) {
      previousPose = poseKey;
      updatePins();
      $("coords").textContent =
        Math.abs(lat).toFixed(2) +
        "° " +
        (lat >= 0 ? "N" : "S") +
        "  /  " +
        Math.abs(lonN).toFixed(2) +
        "° " +
        (lonN >= 0 ? "O" : "W");
      $("distance").textContent =
        (d < 1 ? format(d * 1000) + " m" : format(d) + " km") + " Distanz";
      const m = world.markerPosition(),
        marker = $("marker");
      marker.hidden = !m.visible;
      marker.style.left = m.x + "%";
      marker.style.top = m.y + "%";
      const r = $("reticle");
      r.hidden = d < 8500 || world.mode === "place";
      const h = canvas.clientHeight,
        rad =
          ((h / 2 / Math.tan((world.nav.camera.fov * Math.PI) / 360)) * 6371) /
          Math.sqrt((6371 + d) ** 2 - 6371 ** 2);
      if (!r.hidden) r.style.width = r.style.height = rad * 2 + 35 + "px";
    }
    const s =
      (world.mode === "place" && world.local.warning) ||
      alertText ||
      (world.nav.flight
        ? "Kameraflug aktiv"
        : world.mode === "place" && world.local.ready
          ? world.region.name + " · lokale Geodaten"
          : "Lokale Geodaten");
    if (s !== previous) {
      status.textContent = s;
      previous = s;
    }
  };
  await world.init();
  Object.defineProperty(window, "geoObservatory", {
    value: () => world.diagnostics(),
  });
}
void boot().catch(() =>
  warn("Das Erdmodell konnte nicht geladen werden. Bitte die Seite neu laden."),
);
