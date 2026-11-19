import { AnnotationLayer, type Annotation } from "./annotations";
import { siteCatalog, firstRegion } from "./regions";
import "@fontsource-variable/dm-sans/wght.css";
import "./style.css";
import { createIcons, Globe2, Layers3, MapPin, Maximize, Minimize, Info, Plus, Minus, RotateCcw, Waypoints, Orbit, Compass, X, Eye, EyeOff, Navigation2, Waves } from "lucide";
import { World } from "./world";
import { layers } from "./model";
import { waveModel } from "./knowledge";
import { nyosContext } from "./nyos/context";
import { nyosControls, bindNyosControls, syncNyos } from "./nyos/controls";
import { plateControls, bindPlateControls, syncPlayback } from "./tectonics/controls";

const icons = { Globe2, Layers3, MapPin, Maximize, Minimize, Info, Plus, Minus, RotateCcw, Waypoints, Orbit, Compass, X, Eye, EyeOff, Navigation2, Waves };
const icon = (n: string) => `<i data-lucide="${n}" aria-hidden="true"></i>`;
const paint = () => createIcons({ icons, attrs: { "stroke-width": 1.65 } });
const button = (id: string, label: string, glyph: string) =>
  `<button type="button" id="${id}" aria-label="${label}" title="${label}">${icon(glyph)}</button>`;
const brand = `<svg class="brandmark" width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true"><defs><clipPath id="disc"><circle cx="20" cy="20" r="16"/></clipPath></defs><circle cx="20" cy="20" r="16" fill="currentColor"/><g clip-path="url(#disc)" stroke="#17251f" stroke-width="2.4"><path d="M-5 19Q6 30 18 12T45 5M-5 26Q7 37 22 17T46 13M-4 33Q10 44 26 23T48 20M0 39Q13 50 30 29T49 28"/></g></svg>`;
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
$("app").innerHTML =
  `<header><div class="brand">${brand}<span>GeoRisiko <b>3D</b></span></div>
  <nav aria-label="Modellansicht">${[["globe","Globus","globe-2"],["inside","Schalenschnitt","layers-3"],["plates","Plattentektonik","waypoints"],["nyos","Nyos-See","waves"],["place","Orte","map-pin"]].map(([id,label,glyph]) => `<button id="nav-${id}">${icon(glyph)}<span>${label}</span></button>`).join("")}</nav>
  <div class="headTools">${button("info","Modellhinweise und Quellen","info")}<button id="present" aria-label="Präsentieren" aria-pressed="false">${icon("maximize")}<span>Präsentieren</span></button></div></header>
  <main id="desk" data-mode="globe"><aside id="sidebar" hidden aria-label="Modellsteuerung"></aside>
  <section class="view" aria-label="Interaktive 3D-Ansicht"><canvas id="earth" tabindex="0" aria-label="Drehbares Erdmodell. Pfeiltasten drehen, Plus und Minus zoomen."></canvas>
  <div class="orientation" title="Geografischer Norden">${icon("navigation-2")} N</div>
  <div class="tools"><button id="orbitProcess" hidden aria-label="Prozessmodell drehen" title="Prozessmodell drehen">${icon("orbit")}</button>${button("in","Vergrößern","plus")}${button("out","Verkleinern","minus")}${button("tilt","Neigung ändern","compass")}${button("home","Zur Startansicht zurücksetzen","rotate-ccw")}</div>
  <div id="pins" class="annotations"></div>
  <span id="nyosPin" hidden aria-hidden="true">Nyos-See</span><div id="platePins" class="annotations"></div>
  <div id="nyosRelief" hidden aria-hidden="true"><span id="nyos-Talboden" hidden>Talboden</span><span id="nyos-Hang" hidden>Hang</span></div>
  <div id="modelnote" hidden></div><div class="hint">Ziehen zum Drehen · Mit zwei Fingern oder Mausrad zoomen</div></section></main>
  <div id="status" role="status">Erdmodell wird geladen …</div>
  <dialog id="dialog" aria-labelledby="dialogTitle">${button("closeDialog","Schließen","x")}<div id="content"></div></dialog>`;
const desk = $("desk"),
  side = $("sidebar"),
  dialog = $<HTMLDialogElement>("dialog"),
  content = $("content"),
  status = $("status");
let world: World,
  labels = false,
  present = false,
  alertText = "";
const released = new Set<number>();
let annotationKey = "";
let layoutRevision = 0;
function showDefinition(item: Pick<Annotation,"name"|"text">) {
  const area = $("definition");
  if (!area) return;
  const opener = document.activeElement;
  const title = document.createElement("strong"), text = document.createElement("p"), close = document.createElement("button");
  title.textContent = item.name;
  text.id = "layerText";
  text.textContent = item.text;
  close.textContent = "Schließen";
  close.onclick = () => { area.replaceChildren(); area.hidden = true; annotationKey = ""; if (opener instanceof HTMLElement && opener.isConnected) opener.focus({preventScroll:true}); };
  area.replaceChildren(title,text,close);
  area.hidden = false;
  side.scrollTop = 0;
  close.focus({preventScroll:true});
  annotationKey = "";
}
const shellPins = new AnnotationLayer($("pins"),showDefinition);
const tectonicPins = new AnnotationLayer($("platePins"),showDefinition);
function warn(s: string) {
  alertText = s;
  status.textContent = s;
}
function infoPage() {
  if (world?.mode === "nyos") {
    content.innerHTML = nyosContext;
    openDialog();
    return;
  }
  if (world?.mode === "plates") {
    content.innerHTML = `<h2 id="dialogTitle">Über die Plattenmodelle</h2><p>Die Linien folgen dem globalen Plattenmodell PB2002. In der Natur kann sich die Verformung über eine breite Zone verteilen. ${world.plateOptions.names ? "Eine Platte umfasst die Kruste und den starren obersten Teil des Mantels." : ""}</p><p>Das regionale Satellitenbild zeigt die Landschaft. Der vergrößerte Schnitt darüber erklärt den Prozess schematisch. Pfeillängen, Schichtdicken und Spielzeit haben keinen gemeinsamen Maßstab.</p><p><a href="${import.meta.env.BASE_URL}licenses/Geodaten.txt" target="_blank" rel="noopener">Quellen und Nutzungsrechte</a></p>`;
    openDialog();
    return;
  }
  content.innerHTML = `<h2 id="dialogTitle">Über das Modell</h2><p>Farben unterscheiden die Schalen. Der Keil macht ihr Inneres sichtbar.</p><p>${labels ? "Die Kruste ist im Referenzmodell überall 35 km dick. In der Natur variiert ihre Dicke." : "Die äußerste Schale hat im Referenzmodell überall dieselbe Dicke. In der Natur ist sie unterschiedlich dick."} Beim Verbreitern der Außenschale bleiben der Erdradius und die tieferen Grenzen gleich.</p><p><a href="${import.meta.env.BASE_URL}licenses/Geodaten.txt" target="_blank" rel="noopener">Geodaten und Bildquellen</a></p>`;
  openDialog();
}
function openDialog() {
  if (!dialog.open) dialog.showModal();
  $("closeDialog").focus();
}
function layerName(i: number) {
  return labels || released.has(i) ? layers[i].name : `Schale ${i + 1}`;
}
function renderShellControls() {
  const shell = world.shell;
  const selected = shell.selected;
  const disabled = selected === null ? "disabled" : "";
  const anyNames = labels || released.size>0;
  return `<div class="panelHead"><h1>Schalen</h1><button id="labels" title="Beschriftungen durch die Lehrkraft umschalten" aria-pressed="${labels ? "true" : anyNames ? "mixed" : "false"}">${icon(anyNames ? "eye-off" : "eye")}${anyNames ? "Namen verbergen" : "Namen zeigen"}</button></div>
  <div class="layerlist">${layers.map((l,i) => `<div class="layer ${selected === i ? "chosen" : ""}" style="--rock:#${l.color.toString(16)}"><button data-layer="${i}" aria-pressed="${selected === i}"><span class="swatch" aria-hidden="true">${labels ? i+1 : ""}</span>${layerName(i)}</button><button class="eye" data-eye="${i}" aria-label="${layerName(i)} ${shell.visible[i] ? "ausblenden" : "einblenden"}" aria-pressed="${shell.visible[i]}">${icon(shell.visible[i] ? "eye" : "eye-off")}</button></div>`).join("")}</div>
  ${selected === null ? "" : labels || released.has(selected) ? '<button id="explainLayer">Erklärung öffnen</button>' : '<button id="revealOne">Einzelnen Namen zeigen</button>'}
  ${!labels && released.size ? '<button id="allNames">Alle Namen zeigen</button>' : ""}
  <div class="shellActions"><button id="isolate" ${disabled}>Einzeln zeigen</button><button id="subdue" aria-pressed="${shell.subdued}" ${disabled}>Umfeld dimmen</button><button id="restoreLayers">${icon("rotate-ccw")} Alle zeigen</button></div>
  <label class="range" for="opacity">Deckkraft<input id="opacity" type="range" min="15" max="100" ${disabled} value="${selected === null ? 100 : shell.opacity[selected]*100}" aria-label="Deckkraft der gewählten Schale"></label>
  <div class="options"><label><input id="cut" type="checkbox" ${shell.cut ? "checked" : ""}> Keilschnitt</label><label><input id="scale" type="checkbox" ${shell.expanded ? "checked" : ""}> ${labels ? "Kruste" : "Außenschale"} verbreitern</label><label><input id="lithosphere" type="checkbox" ${shell.lithosphere ? "checked" : ""} ${shell.cut && shell.visible[0] && shell.visible[1] ? "" : "disabled"}> ${labels ? "Lithosphäre vergleichen" : "Starren Außenbereich vergleichen"}</label></div>
  <button id="evidence">${icon("waves")} P- und S-Wellen</button>`;
}
function siteInfo() {
  const r = world.region;
  content.innerHTML = `<h2 id="dialogTitle">${r.name}</h2><div class="siteCard"><img src="${import.meta.env.BASE_URL}data/locator.webp" alt="Weltkarte mit markiertem Untersuchungsort"><i style="left:${(r.target.lon + 180) / 3.6}%;top:${(90 - r.target.lat) / 1.8}%"></i><span>${Math.abs(r.target.lat).toFixed(2)}° ${r.target.lat >= 0 ? "N" : "S"} · ${Math.abs(r.target.lon).toFixed(2)}° ${r.target.lon >= 0 ? "O" : "W"}</span></div><p>${r.limits}</p><h3>Detailstufen</h3><p>Globale Höhen liegen auf einem 0,5°-Raster. In der Deutschen Bucht zeigt die regionale Karte Landbedeckung in etwa 75-m-Feldern. Das regionale Wattenmeer-Luftbild zeigt rund 20 m pro Bildpunkt. Erst im Untersuchungsgebiet werden lokale Luftbilder und Gelände sichtbar.</p><p>${r.sources.join("<br>")}</p><p><a href="${import.meta.env.BASE_URL}licenses/Geodaten.txt" target="_blank" rel="noopener">Quellen und Nutzungsrechte</a></p>`;
  openDialog();
}

function renderSide() {
  annotationKey = "";
  layoutRevision++;
  const mode = world.mode;
  desk.dataset.mode = mode;
  for (const id of ["globe", "inside", "plates", "nyos", "place"]) {
    $("nav-" + id).setAttribute("aria-current", mode === id ? "page" : "false");
  }
  side.hidden = mode === "globe";
  if (side.hidden) side.replaceChildren();
  $("orbitProcess").hidden = !(mode === "plates" && world.processDetail);
  if (mode === "plates") {
    const advancedOpen = !!side.querySelector<HTMLDetailsElement>("#plateSettings[open]");
    side.innerHTML = plateControls(world);
    if (advancedOpen && $("plateSettings")) $<HTMLDetailsElement>("plateSettings").open = true;
    bindPlateControls(side, world, renderSide);
  }
  $("nyosPin").hidden = true;
  $("nyosRelief").hidden = true;
  if (mode === "nyos") {
    side.dataset.nyosError = String(!!world.nyos.error);
    side.innerHTML = nyosControls(world);
    bindNyosControls(side, world, renderSide);
  }
  if (mode === "place") {
    const r = world.region;
    side.innerHTML = `<h1>Orte</h1><label class="siteSelect">Ort wählen <select id="siteSelect">${siteCatalog.map((site) => `<option value="${site.id}" ${site.id === r.id ? "selected" : ""}>${site.name}</option>`).join("")}</select></label><div class="siteActions"><button id="overview" class="action secondary">${icon("compass")} Inselübersicht</button><button id="nearby" class="action secondary">${icon("map-pin")} Nahansicht</button></div><button id="siteInfo" class="action primary">${icon("info")} Ort und Quellen</button><button id="return" class="action secondary">${icon("globe-2")} Zur globalen Ansicht</button>`;
    $<HTMLSelectElement>("siteSelect").onchange = (e) => {
      world.visit((e.target as HTMLSelectElement).value);
      renderSide();
      ($("siteSelect") || $("tectonicSite") || $("nyos-near"))?.focus();
    };
    $("overview").onclick = () => world.visit(r.id, true);
    $("nearby").onclick = () => world.visit(r.id);
  }
  if (mode === "inside") side.innerHTML = renderShellControls();
  if (mode === "inside" || mode === "plates") {
    const area = document.createElement("section");
    area.id = "definition"; area.hidden = true; area.setAttribute("aria-live","polite");
    (side.querySelector(".panelHead") ?? side.querySelector("h1"))?.after(area);
  }
  $("explainLayer")?.addEventListener("click", () => showDefinition(layers[world.shell.selected!]));
  $("revealOne")?.addEventListener("click", () => { released.add(world.shell.selected!); renderSide(); $("explainLayer")?.focus(); });
  $("lithosphere")?.addEventListener("change", () => {
    world.shell.setComparison($<HTMLInputElement>("lithosphere").checked ? "lithosphere" : "reference");
    updateShell("lithosphere");
  });
  $("labels")?.addEventListener("click", () => {
    labels = !labels && released.size===0;
    released.clear();
    renderSide();
    $("labels").focus();
  });
  $("allNames")?.addEventListener("click",()=>{labels=true;released.clear();renderSide();$("labels").focus();});
  $("isolate")?.addEventListener("click", () => {
    world.shell.visible = layers.map((_, i) => i === world.shell.selected);
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
  $("evidence")?.addEventListener("click", () => {
    content.innerHTML = waveModel(labels);
    openDialog();
  });
  $("return")?.addEventListener("click", () => navigate("globe"));
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
      if (world.shell.selected === null) return;
      world.shell.opacity[world.shell.selected] = +range.value / 100;
      world.shell.rebuild();
    };
  if ($("cut"))
    $<HTMLInputElement>("cut").onchange = (e) => {
      world.shell.cut = (e.target as HTMLInputElement).checked;
      world.shell.rebuild();
      renderSide();
      $("cut").focus();
    };
  if ($("scale"))
    $<HTMLInputElement>("scale").onchange = (e) => {
      world.shell.setComparison((e.target as HTMLInputElement).checked ? "expanded" : "reference");
      updateShell("scale");
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
  world.shell.selected = i;
  world.shell.visible[i] = true;
  world.shell.rebuild();
  renderSide();
  side.querySelector<HTMLButtonElement>('[data-layer="' + i + '"]')?.focus();
}
function updateNote() {
  if (world.mode === "nyos") { syncNyos(world); return; }
  const note = $("modelnote");
  note.hidden = world.mode === "globe" || (world.mode === "plates" && !world.processSite);
  note.classList.toggle(
    "exaggerated",
    world.mode === "inside" && world.shell.expanded,
  );
  note.textContent =
    world.mode === "inside"
      ? world.shell.expanded
        ? `Didaktisch überhöht · ${labels ? "Kruste" : "Außenschale"} verbreitert`
        : labels
          ? "Maßstabsgetreu · vereinfachte Krustendicke"
          : "Maßstabsgetreu · vereinfachte Dicke der Außenschale"
      : world.mode === "plates"
        ? world.processDetail
          ? "Schematischer Schnitt · Zeit stark überhöht"
          : "Regionale Ansicht"
        : world.region.label;
  if (world.mode === "inside" && world.shell.cut && world.shell.lithosphere && world.shell.visible[0] && world.shell.visible[1]) {
    note.textContent = labels ? "Lithosphäre: Erdkruste und starrer oberster Mantel. Untergrenze schematisch." : "Referenzmaßstab · Schraffur für den starren Außenbereich. Untergrenze schematisch.";
  }
}
function navigate(mode: World["mode"]) {
  if (mode === "inside") world.inside();
  else if (mode === "nyos") world.visit("nyos");
  else if (mode === "plates") world.plates();
  else if (mode === "place") world.visit();
  else world.globe();
  renderSide();
}
function reset() {
  labels = false;
  released.clear();
  world.shell.setComparison("reference");
  world.region = firstRegion;
  world.shell.restore();
  world.shell.cut = true;
  world.smallPlateNames = false;
  world.globe(true);
  world.setPlateOptions({ boundaries:false, names:false, types:false, category:"all", plate:"" });
  renderSide();
}
function setPresentation(value: boolean) {
  annotationKey = "";
  layoutRevision++;
  present = value;
  document.body.classList.toggle("present", value);
  const toggle = $("present");
  toggle.setAttribute("aria-pressed", String(value));
  const label = value ? "Präsentation beenden" : "Präsentieren";
  toggle.setAttribute("aria-label", label);
  toggle.innerHTML = icon(value ? "minimize" : "maximize") + `<span>${label}</span>`;
  paint();
}
const pinObstacles = [document.querySelector<HTMLElement>(".tools")!, $("modelnote"),document.querySelector<HTMLElement>(".orientation")!];
const layoutObserver = new ResizeObserver(()=>{layoutRevision++;});
for (const el of [...pinObstacles, side,$("earth")]) layoutObserver.observe(el);
document.fonts.addEventListener("loadingdone",()=>{layoutRevision++;});
function updatePins() {
  // Stationary models need no projection, ray tests, or layout work between interactions.
  const p = world.nav.pose, s = world.shell, o = world.plateOptions;
  const dimensions = $("earth");
  const key = [world.mode,p.lat,p.lon,p.d,p.tilt,p.bearing,dimensions.clientWidth,dimensions.clientHeight,
    labels,released.size,s.cut,s.expanded,s.lithosphere,s.group.visible,s.visible.join(),o.boundaries,o.names,o.plate,world.singlePlateName,
    world.processDetail,world.processSite,world.processChoice,world.smallPlateNames,world.atlasReady,world.processProgress,world.annotationTransition,present,layoutRevision].join("/");
  if (annotationKey === key) return;
  annotationKey = key;
  const obstacles = pinObstacles;
  shellPins.draw(world.mode === "inside" && (labels || released.size) ? world.layerMarkers(released,labels) : [],obstacles,layoutRevision);
  const plates = world.mode === "plates" && (o.names || world.singlePlateName)
    ? world.processDetail ? world.processLabels() : world.plateLabels().map(p => ({
      ...p,id:p.code,text:"Zu dieser Platte gehören die Erdkruste und der starre oberste Erdmantel. Sie bewegt sich langsam gegenüber anderen Platten."
    })) : [];
  tectonicPins.draw(plates,[...obstacles,side],layoutRevision);
}
$("info").onclick = infoPage;
dialog.onclose = () => content.replaceChildren();
$("closeDialog").onclick = () => dialog.close();
dialog.onclick = (e) => {
  if (e.target === dialog) dialog.close();
};
$("present").onclick = async () => {
  setPresentation(!present);
  try {
    if (present) await document.documentElement.requestFullscreen?.();
    else if (document.fullscreenElement) await document.exitFullscreen();
  } catch {
    // Embedded LMS players may only allow the inline presentation.
  }
};
document.onfullscreenchange = () => {
  if (!document.fullscreenElement) setPresentation(false);
};
const canvas = $<HTMLCanvasElement>("earth");
paint();
async function boot() {
  try {
    world = new World(canvas, warn);
  } catch {
    desk.dataset.mode = "fallback";
    side.hidden = false;
    side.innerHTML = `<h1>Weltkarte</h1><p class="intro">WebGL 2 ist auf diesem Gerät nicht verfügbar. Die lokale Erdkarte zeigt die Kontinente zur Orientierung.</p>`;
    canvas.parentElement!.classList.add("fallback");
    document
      .querySelectorAll<HTMLButtonElement>(
        "nav button,.tools button,#present",
      )
      .forEach((b) => (b.disabled = true));
    warn("Ersatzansicht · lokale Weltkarte");
    return;
  }
  renderSide();
  world.onLayer = select;
  world.onBoundary = () => { if (world.mode === "plates") renderSide(); };
  for (const m of ["globe", "inside", "plates", "nyos", "place"] as const)
    $("nav-" + m).onclick = () => navigate(m);
  $("in").onclick = () => world.nav.zoom(0.68);
  $("out").onclick = () => world.nav.zoom(1 / 0.68);
  $("home").onclick = reset;
  $("orbitProcess").onclick = () => {
    world.nav.stop();
    world.nav.goal.bearing += 35;
  };
  $("tilt").onclick = () => {
    world.nav.stop();
    world.nav.goal.tilt =
      world.nav.goal.tilt > 55 ? 0 : world.nav.goal.tilt + 30;
  };
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !dialog.open && $("definition") && !$("definition").hidden) {
      $("definition").querySelector("button")?.click();
      return;
    }
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
    else if (e.key === "Escape" && present) {
      setPresentation(false);
      if (document.fullscreenElement) void document.exitFullscreen();
    }
    else return;
    e.preventDefault();
  });
  let lastHud = 0;
  world.onFrame = () => {
    if ((world.mode==="inside" && (labels || released.size)) || (world.mode==="plates" && (world.plateOptions.names || world.singlePlateName))) updatePins();
    const now = performance.now();
    if (now - lastHud < 55) return;
    lastHud = now;
    document.querySelector<SVGElement>(".orientation svg")!.style.transform =
      `rotate(${world.nav.pose.bearing}deg)`;

    if (world.mode === "plates") { syncPlayback(world); }
    if (world.mode === "nyos") {
      if (side.dataset.nyosError !== String(!!world.nyos.error)) renderSide();
      syncNyos(world);
    }
    const message = world.nyosWarning || (world.mode === "place" && world.local.warning) || alertText || "";
    if (status.textContent !== message) status.textContent = message;
  };
  await world.init();
  Object.defineProperty(window, "geoObservatory", {
    value: () => ({...world.diagnostics(), annotationDom:{...tectonicPins.work}}),
  });
}
void boot().catch(() =>
  warn("Das Erdmodell konnte nicht geladen werden. Bitte die Seite neu laden."),
);
