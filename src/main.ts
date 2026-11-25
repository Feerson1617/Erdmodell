import {nyosLabels} from "./nyos/labels";
import {beginCandidates,allowsLabel,claimObject} from "./observatory/reveal";
import {installProfiles} from "./observatory/graphics";
import {classroomViews} from "./observatory/classroom-views";
import {fields,lessonKeys} from "./observatory/saved-state";
import { GeographicExperience } from "./observatory/geographic-experience";
import {Observation} from "./observatory/observation";
import { Observatory } from "./observatory/panel";
import { reference } from "./observatory/regional";
import { deviceProbe } from "./device-probe";
declare global {
  interface Window {
    geoPresentation?: { toggle: () => Promise<void>; onChange: (listener: (state: boolean) => void) => void };
  }
}
import {localAsset} from "./assets";
import { AnnotationLayer, type Annotation } from "./annotations";
import { siteCatalog, firstRegion } from "./regions";
import "@fontsource-variable/dm-sans/wght.css";
import "./style.css";
import "./observatory/experience.css";
import { createIcons, Globe2, Layers3, MapPin, Maximize, Minimize, Info, Plus, Minus, RotateCcw, Waypoints, Orbit, Compass, X, Eye, EyeOff, Navigation2, Waves, Bookmark } from "lucide";
import { World } from "./world";
import { layers } from "./model";
import { waveModel } from "./knowledge";
import { nyosContext } from "./nyos/context";
import { nyosControls, bindNyosControls, syncNyos } from "./nyos/controls";
import { plateControls, bindPlateControls, syncPlayback } from "./tectonics/controls";

const icons = { Globe2, Layers3, MapPin, Maximize, Minimize, Info, Plus, Minus, RotateCcw, Waypoints, Orbit, Compass, X, Eye, EyeOff, Navigation2, Waves, Bookmark };
const icon = (n: string) => `<i data-lucide="${n}" aria-hidden="true"></i>`;
const paint = () => createIcons({ icons, attrs: { "stroke-width": 1.65 } });
const button = (id: string, label: string, glyph: string) =>
  `<button type="button" id="${id}" aria-label="${label}" title="${label}">${icon(glyph)}</button>`;
const brand = `<svg class="brandmark" width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true"><defs><clipPath id="disc"><circle cx="20" cy="20" r="16"/></clipPath></defs><circle cx="20" cy="20" r="16" fill="currentColor"/><g clip-path="url(#disc)" stroke="#17251f" stroke-width="2.4"><path d="M-5 19Q6 30 18 12T45 5M-5 26Q7 37 22 17T46 13M-4 33Q10 44 26 23T48 20M0 39Q13 50 30 29T49 28"/></g></svg>`;
const friday = new URLSearchParams(location.search).get("unterricht") === "schalenbau";
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
$("app").innerHTML =
  `<header><div class="brand">${brand}<span>GeoRisiko <b>3D</b></span></div>
  <nav aria-label="Modellansicht">${[["globe","Globus","globe-2"],["inside","Schalenschnitt","layers-3"],["plates","Plattentektonik","waypoints"],["earthquake","Erdbeben","navigation-2"],["volcano","Vulkanismus","compass"],["risk","Schutz","eye"],["nyos","Nyos-See","waves"],["place","Orte","map-pin"]].map(([id,label,glyph]) => `<button id="nav-${id}">${icon(glyph)}<span>${label}</span></button>`).join("")}</nav>
  <div class="headTools">${button("saved-views","Unterrichtsansichten","bookmark")}${button("info","Modellhinweise und Quellen","info")}<button id="present" aria-label="Präsentieren" aria-pressed="false">${icon("maximize")}<span>Präsentieren</span></button></div></header>
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
if (friday) {
  for (const id of ["plates", "earthquake","volcano","risk","nyos", "place"]) $("nav-" + id).hidden = true;
}
const desk = $("desk"),
  side = $("sidebar"),
  dialog = $<HTMLDialogElement>("dialog"),
  content = $("content"),
  status = $("status");
let observatory: Observatory;
let world: World,
  labels = !friday,
  present = false,
  alertText = "";
const released = new Set<number>();
let annotationKey = "";
let layoutRevision = 0;
function showDefinition(item: Pick<Annotation,"name"|"text">) {
  const shellIndex = world.mode === "inside" ? layers.findIndex(l => l.name === item.name) : -1;
  if (shellIndex >= 0 && !(labels || released.has(shellIndex))) return;
  const opener = document.activeElement;
  if (shellIndex >= 0 && world.shell.selected !== shellIndex) select(shellIndex);
  const area = $("definition");
  if (!area) return;
  const title = document.createElement("strong"), text = document.createElement("p"), close = document.createElement("button");
  title.textContent = item.name;
  text.id = "layerText";
  text.textContent = item.text;
  close.textContent = "Schließen";
  close.onclick = () => { area.replaceChildren(); area.hidden = true; annotationKey = ""; if (opener instanceof HTMLElement && opener.isConnected) opener.focus({preventScroll:true}); };
  area.replaceChildren(title,text,close);
  if (shellIndex >= 0) {
    const layer = layers[shellIndex], pronoun = shellIndex === 0 ? "sie" : "er";
    const questions = document.createElement("div"), answer = document.createElement("p");
    questions.className = "shellQuestions";
    answer.hidden = true;
    answer.id = "shellAnswer";
    for (const [label, detail] of [["Was ist das?",layer.text],["Welche besondere Eigenschaft hat diese Schale?",["Die Kruste ist unter Kontinenten meist dicker als unter dem Ozean.","Über sehr lange Zeit kann sich das feste Gestein verformen.","Direkte S-Wellen können diese flüssige Schale nicht durchlaufen.","Der große Druck hält den inneren Kern fest."][shellIndex]],["Woher wissen wir das?",["Gesteinsproben und seismische Messungen zeigen den Aufbau der Kruste.","Der Verlauf von Erdbebenwellen gibt Hinweise auf das Gestein im Mantel.","Das Muster vieler Erdbebenaufzeichnungen zeigt einen flüssigen äußeren Kern.","Veränderte Wege von Erdbebenwellen weisen auf einen festen inneren Kern hin."][shellIndex]],[`Woraus besteht ${pronoun}?`,layer.material],[`Wie ist ${pronoun} entstanden?`,layer.origin]]) {
      const question = document.createElement("button");
      question.textContent = label;
      question.setAttribute("aria-expanded","false");
      question.setAttribute("aria-controls",answer.id);
      question.onclick = () => {
        const open = question.getAttribute("aria-expanded") === "false";
        for (const b of questions.querySelectorAll("button")) b.setAttribute("aria-expanded","false");
        question.setAttribute("aria-expanded",String(open));
        answer.textContent = open ? detail : "";
        answer.hidden = !open;
      };
      questions.append(question);
    }
    area.insertBefore(questions,close);
    area.insertBefore(answer,close);
  }
  area.hidden = false;
  side.scrollTop = 0;
  close.focus({preventScroll:true});
  annotationKey = "";
}
const shellPins = new AnnotationLayer($("pins"),showDefinition);
const tectonicPins = new AnnotationLayer($("platePins"), item => {
  if (world.processSite) showDefinition(item);
  else if(world.mosaic?.pair)world.selectPairBody(item.id);
  else {world.inspectPlate(item.id);renderSide();}
});
function warn(s: string) {
  alertText = s;
  status.textContent = s;
}
function infoPage() {
  if(observatory?.mode){
    content.innerHTML=`<h2 id="dialogTitle">Daten und Modellgrenzen</h2><p>Die Ereignispunkte sind Beobachtungen. Historische Flächen sind Rekonstruktionen. Die Zukunftsmodelle zeigen mögliche Entwicklungen. Bruch, Wasserwellen und Siedlungen erklären Prozesse in vereinfachter Form.</p><p>Regionale Bilder: EOxCloudless 2024 by EOX, mit modifizierten Copernicus-Sentinel-Daten (CC BY-NC-SA 4.0). Das Profil vor Japan nutzt 13 seismische Tiefen aus USGS Slab2. Die Punkte im Tiefenschnitt sind 176 dokumentierte Erdbeben. GNSS-Stationen liefern Bewegungsraten im globalen Bezugssystem IGS14. Weitere Quellen und Rechte stehen im Katalog.</p><a href="${localAsset("licenses/G5-Daten.md")}">Wissenschaftlicher Daten- und Quellenkatalog</a>`;
    openDialog();return;
  }
  if (world?.mode === "nyos") {
    content.innerHTML = nyosContext;
    openDialog();
    return;
  }
  if (world?.mode === "plates") {
    content.innerHTML = `<h2 id="dialogTitle">Über die Plattenmodelle</h2><p>Nur das Kartenbild öffnet sich. Jede Platte umfasst die Kruste und den starren obersten Mantel. Darunter liegt überwiegend festes, langsam verformbares Gestein. Die Farben und die überhöhte Plattendicke helfen bei der Unterscheidung.</p><p>Der Atlas zeigt die heutigen Plattengrenzen. Im Grenzvergleich bewegen sich zwei starre Gesteinsausschnitte relativ zueinander. Ihre Richtung folgt den Rotationspolen von PB2002. Deren Ausgangsdaten beziehen sich auf die Pazifische Platte. Im Vergleich ist die Bewegung auf beide Seiten verteilt. Zeit, Abstand und Dicke sind schematisch. Der neutrale Untergrund dient als Zeichenfläche. Die Linien folgen dem globalen Plattenmodell PB2002. In der Natur kann sich die Verformung über eine breite Zone verteilen.</p><p>Das regionale Satellitenbild zeigt die Landschaft. Der vergrößerte Schnitt darüber erklärt den Prozess schematisch. Pfeillängen, Schichtdicken und Spielzeit haben keinen gemeinsamen Maßstab.</p><p><a href="${localAsset("licenses/Geodaten.txt")}" target="_blank" rel="noopener">Quellen und Nutzungsrechte</a></p>`;
    openDialog();
    return;
  }
  content.innerHTML = `<h2 id="dialogTitle">Über das Modell</h2><p>Die Farben sind Modellfarben. Der Keil macht die Schalen im Inneren sichtbar.</p><p>${labels ? "Die Kruste ist im Referenzmodell überall 35 km dick. In der Natur variiert ihre Dicke." : "Die äußerste Schale hat im Referenzmodell überall dieselbe Dicke. In der Natur ist sie unterschiedlich dick."} Beim Verbreitern der Außenschale bleiben der Erdradius und die tieferen Grenzen gleich.</p><p><a href="${localAsset("licenses/Geodaten.txt")}" target="_blank" rel="noopener">Geodaten und Bildquellen</a></p>${friday ? '<p><a href="?">Gesamtanwendung öffnen</a></p>' : ""}`;
  openDialog();
}
function openDialog() {
  if(content.querySelector("#dialogTitle")?.textContent?.match(/Modell|Quellen/i)&&!content.querySelector("[data-g6-credit]")){
    const p=document.createElement("p");p.dataset.g6Credit="";p.textContent="Geländefarben stammen aus Satellitenbildern. Einzelne Pflanzen, Gesteinsoberflächen und Lavawege zeigen typische Formen. ";
    const link=document.createElement("a");link.href=localAsset("licenses/G6-Bildquellen.txt");link.target="_blank";link.rel="noopener";link.textContent="Bildquellen und Lizenzen";p.append(link);content.append(p);
  }
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
  const actions = `<div class="shellActions"><button id="isolate" ${disabled}>Einzeln zeigen</button><button id="subdue" aria-pressed="${shell.subdued}" ${disabled}>Umfeld dimmen</button><button id="restoreLayers">${icon("rotate-ccw")} Alle zeigen</button></div>
  <label class="range" for="opacity">Deckkraft<input id="opacity" type="range" min="15" max="100" ${disabled} value="${selected === null ? 100 : shell.opacity[selected]*100}" aria-label="Deckkraft der gewählten Schale"></label>`;
  const cut = `<label><input id="cut" type="checkbox" ${shell.cut ? "checked" : ""}> Keilschnitt</label>`, scale = `<label><input id="scale" type="checkbox" ${shell.expanded ? "checked" : ""}> ${labels ? "Kruste" : "Außenschale"} verbreitern</label>`, lithosphere = `<label><input id="lithosphere" type="checkbox" ${shell.lithosphere ? "checked" : ""} ${shell.cut && shell.visible[0] && shell.visible[1] ? "" : "disabled"}> ${labels ? "Lithosphäre vergleichen" : "Starren Außenbereich vergleichen"}</label>`;
  const waves = `<button id="evidence">${icon("waves")} P- und S-Wellen</button>`;
  return `<div class="panelHead"><h1 data-teach="terms">Schalenbau</h1><button id="labels" title="Beschriftungen durch die Lehrkraft umschalten" aria-pressed="${labels ? "true" : anyNames ? "mixed" : "false"}">${icon(anyNames ? "eye-off" : "eye")}${anyNames ? "Namen verbergen" : "Namen zeigen"}</button></div>
  <div class="layerlist">${layers.map((l,i) => `<div class="layer ${selected === i ? "chosen" : ""}" style="--rock:#${l.color.toString(16)}"><button data-layer="${i}" aria-pressed="${selected === i}"><span class="swatch" aria-hidden="true">${labels ? i+1 : ""}</span>${layerName(i)}</button><button class="eye" data-eye="${i}" aria-label="${layerName(i)} ${shell.visible[i] ? "ausblenden" : "einblenden"}" aria-pressed="${shell.visible[i]}">${icon(shell.visible[i] ? "eye" : "eye-off")}</button></div>`).join("")}</div>
  ${selected === null ? "" : labels || released.has(selected) ? '<div class="nameActions"><button id="explainLayer">Erklärung öffnen</button><button id="hideOne">Diesen Namen verbergen</button></div>' : '<button id="revealOne">Einzelnen Namen zeigen</button>'}
  ${!labels && released.size ? '<button id="allNames">Alle Namen zeigen</button>' : ""}
  ${friday
    ? `<div class="options">${scale}</div><details id="shellOptions"><summary>Weitere Modelloptionen</summary>${(labels||released.has(selected??-1))&&selected!==null?"<p>"+layers[selected].text+"</p>":""}${actions}<div class="options">${cut}${lithosphere}</div>${waves}</details>`
    : `${(labels||released.has(selected??-1))&&selected!==null?"<p>"+layers[selected].text+"</p>":""}${actions}<div class="options">${cut}${scale}${lithosphere}</div>${waves}`}`;
}
function siteInfo() {
  const r = world.region;
  content.innerHTML = `<h2 id="dialogTitle">${r.name}</h2><div class="siteCard"><img src="${localAsset("data/locator.webp")}" alt="Weltkarte mit markiertem Untersuchungsort"><i style="left:${(r.target.lon + 180) / 3.6}%;top:${(90 - r.target.lat) / 1.8}%"></i><span>${Math.abs(r.target.lat).toFixed(2)}° ${r.target.lat >= 0 ? "N" : "S"} · ${Math.abs(r.target.lon).toFixed(2)}° ${r.target.lon >= 0 ? "O" : "W"}</span></div><p>${r.limits}</p><h3>Detailstufen</h3><p>Globale Höhen liegen auf einem 0,5°-Raster. In der Deutschen Bucht zeigt die regionale Karte Landbedeckung in etwa 75-m-Feldern. Das regionale Wattenmeer-Luftbild zeigt rund 20 m pro Bildpunkt. Erst im Untersuchungsgebiet werden lokale Luftbilder und Gelände sichtbar.</p><p>${r.sources.join("<br>")}</p><p><a href="${localAsset("licenses/Geodaten.txt")}" target="_blank" rel="noopener">Quellen und Nutzungsrechte</a></p>`;
  openDialog();
}

function renderSide() {
  annotationKey = "";
  layoutRevision++;
  const mode = world.mode;
  desk.dataset.mode = mode;
  desk.classList.toggle("pair-layout",mode==="plates"&&!!world.mosaic?.pair);
  for (const id of ["globe", "inside", "plates", "nyos", "place"]) {
    $("nav-" + id).setAttribute("aria-current", mode === id ? "page" : "false");
  }
  side.hidden = mode === "globe";
  if (side.hidden) side.replaceChildren();
  $("orbitProcess").hidden = !(mode === "plates" && world.processDetail);
  if (mode === "plates") {
    const advancedOpen = !!side.querySelector<HTMLDetailsElement>("#plateSettings[open]");
    const oldCode=side.dataset.profile;
    side.innerHTML = plateControls(world);
    side.dataset.profile=world.profileCode+(world.mosaic?.pair ? "-pair":"");
    if(oldCode!==side.dataset.profile)side.scrollTop=0;
    if (advancedOpen && $("plateSettings")) $<HTMLDetailsElement>("plateSettings").open = true;
    bindPlateControls(side, world, renderSide);
    const extra=document.createElement("div");extra.className="g-atlas-tools";
    extra.innerHTML='<button id="g-studio">Prozessmodelle</button><button id="g-atlas">Forschungsatlas</button><button id="g-time">Zeitreise</button><button id="g-forces">Plattenantrieb</button><button id="g-boundaries">Grenze untersuchen</button>'+(world.selectedBoundary?'<button id="g-selected">Prozess ansehen</button>':'');
    if(world.mosaic?.pair){extra.hidden=true;side.append(extra);}else side.querySelector("h1")?.after(extra);
    if($("pair-process"))$("pair-process").onclick=()=>{
      const m=world.mosaic!,step=m.pair!.step,pose={...world.nav.pose},time=m.progress,arrows=m.pair!.vectors.visible;
      observatory.returnPairId=step[0];observatory.returnPair=()=>{navigate("plates");world.comparePlates(false,step[0]);m.progress=time;m.pair!.setTime(time);m.pair!.vectors.visible=arrows;world.nav.fly(pose,true);renderSide();};
      void observatory.openBoundary(step,"process");
    };
    if($("pair-forces"))$("pair-forces").onclick=()=>observatory.openConcept("forces");
    $("g-forces").onclick=()=>observatory.openConcept("forces");
    $("g-studio").onclick=()=>observatory.openStudio();
    $("g-atlas").onclick=()=>void observatory.openResearch();
    $("g-time").onclick=()=>observatory.openTime();
    $("g-boundaries").onclick=()=>void observatory.openMap("boundaries");
    if($("g-selected"))$("g-selected").onclick=()=>observatory.openBoundary(world.selectedBoundary!.step);
  }
  $("nyosPin").hidden = true;
  $("nyosRelief").hidden = true;
  if (mode === "nyos") {
    side.dataset.nyosError = String(!!world.nyos.error);
    side.innerHTML = nyosControls(world);
    const nyosHeading=side.querySelector("h1");if(nyosHeading)nyosHeading.dataset.teach="terms";
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
  if (mode === "inside") {
    const optionsOpen = !!side.querySelector("#shellOptions[open]");
    side.innerHTML = renderShellControls();
    const classification=document.createElement("button");classification.id="g-earth-structure";classification.textContent="Stoffe und mechanische Schichten";classification.onclick=()=>observatory.openStudio({interior:true});side.querySelector("h1")?.after(classification);
    const detail=document.createElement("button");detail.id="g-litho";detail.textContent="Außenschichten vergrößern";
    ($("shellOptions")??side).append(detail);detail.onclick=()=>observatory.openConcept("lithosphere");
    if (optionsOpen) $<HTMLDetailsElement>("shellOptions").open = true;
  }
  if (mode === "inside" || mode === "plates" || mode === "nyos") {
    const area = document.createElement("section");
    area.id = "definition"; area.hidden = true; area.setAttribute("aria-live","polite");
    (side.querySelector(".panelHead") ?? side.querySelector("h1"))?.after(area);
  }
  $("explainLayer")?.addEventListener("click", () => showDefinition(layers[world.shell.selected!]));
  $("revealOne")?.addEventListener("click", () => { released.add(world.shell.selected!);
    if (released.size === layers.length) { labels = true; released.clear(); }
    renderSide(); $("explainLayer")?.focus(); });
  $("hideOne")?.addEventListener("click", () => {
    const selected = world.shell.selected!;
    if (labels) layers.forEach((_, i) => released.add(i));
    labels = false;
    released.delete(selected);
    renderSide();
    $("revealOne").focus({preventScroll:true});
  });
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
  note.hidden = world.mode === "globe";
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
          : world.processSite ? "Regionale Ansicht" : world.mosaic?.pair ? "Zwei starre Ausschnitte · Abstand und Zeit schematisch" : "Heutige Platten · grafische Abdeckung · Dicke überhöht"
        : world.region.label;
  if (world.mode === "inside" && world.shell.cut && world.shell.lithosphere && world.shell.visible[0] && world.shell.visible[1]) {
    note.textContent = labels ? "Lithosphäre: Erdkruste und starrer oberster Mantel. Untergrenze schematisch." : "Referenzmaßstab · Schraffur für den starren Außenbereich. Untergrenze schematisch.";
  }
}
function navigate(mode: World["mode"]) {
  const leavingRegional=Boolean(observatory?.mode);
  observatory?.close();
  if(leavingRegional&&(mode==="plates"||mode==="globe"))world.nav.fly({lat:15,lon:-20,d:16000,tilt:0,bearing:0},true);
  if (mode === "inside") world.inside();
  else if (mode === "nyos") world.visit("nyos");
  else if (mode === "plates") world.plates();
  else if (mode === "place") world.visit();
  else world.globe();
  renderSide();
}
function reset() {
  observatory?.close();
  labels = !friday;
  released.clear();
  world.shell.setComparison("reference");
  world.region = firstRegion;
  world.shell.restore();
  world.shell.cut = true;
  world.smallPlateNames = false;
  world.globe(true);
  world.setPlateOptions({ boundaries:!friday, names:!friday, types:!friday, category:"all", plate:"" });
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
    world.mode==="nyos"?[world.nyos.localWeight,world.nyosLesson.view,world.nyosLesson.measure,world.nyosLesson.dissolved,world.nyosLesson.air,Math.round(world.nyosLesson.progress*100)].join():null,document.body.dataset.reveal,world.processDetail,world.processSite,world.processChoice,world.smallPlateNames,world.atlasReady,world.processProgress,world.annotationTransition,present,layoutRevision].join("/");
  if (annotationKey === key) return;
  annotationKey = key;
  const obstacles = pinObstacles;
  if(!observatory.mode)beginCandidates();
  const inLesson=document.body.classList.contains("observing")&&!friday;
  shellPins.draw(world.mode==="nyos"?nyosLabels(world,dimensions.clientWidth,dimensions.clientHeight).filter((a,i)=>allowsLabel(a.id,i)):world.mode === "inside" && (labels || released.size || inLesson) ? world.layerMarkers(released,labels||inLesson).filter((a,i)=>allowsLabel(a.id,i)) : [],obstacles,layoutRevision);
  const plates = world.mode === "plates" && (o.names || inLesson || world.singlePlateName || world.mosaic?.pair)
    ? world.processDetail ? world.processLabels() : world.plateLabels(inLesson).map(p => ({
      ...p,id:p.code,text:"Zu dieser Platte gehören die Erdkruste und der starre oberste Erdmantel. Sie bewegt sich langsam gegenüber anderen Platten."
    })) : [];
  tectonicPins.draw(plates.filter((a,i)=>allowsLabel(a.id,i)),[...obstacles,side],layoutRevision);
}
$("info").onclick = infoPage;
// Keep local source notices readable inside the packaged window.
if (location.protocol === "georisiko:") content.addEventListener("click", async event => {
  const link = event.target instanceof Element ? event.target.closest("a") : null;
  if (!link) return;
  event.preventDefault();
  const url = new URL(link.href);
  const localNotice = url.pathname.startsWith("/licenses/") || /^\/assets\/[^/]+\.md$/.test(url.pathname);
  if (url.protocol !== "georisiko:" || url.host !== "modell" || !localNotice) return;
  const response = await fetch(url);
  if (response.ok) {
    const heading = document.createElement("h2"), notice = document.createElement("p");
    heading.id = "dialogTitle"; heading.textContent = link.textContent;
    notice.style.whiteSpace = "pre-wrap"; notice.textContent = await response.text(); content.replaceChildren(heading, notice);
  }
});
dialog.onclose = () => content.replaceChildren();
$("closeDialog").onclick = () => dialog.close();
dialog.onclick = (e) => {
  if (e.target === dialog) dialog.close();
};
window.geoPresentation?.onChange(setPresentation);
$("present").onclick = async () => {
  if (window.geoPresentation) { await window.geoPresentation.toggle(); return; }
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
  installProfiles(document.querySelector(".headTools")!);
  try {
    world = new World(canvas, warn);
    world.setPlateOptions({names:!friday,boundaries:!friday,types:!friday});
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
  const observation=new Observation(()=>observatory.subject);
  observatory=new Observatory(world,side,navigate);
  const experience = friday ? undefined : new GeographicExperience(world,observatory,observation,navigate);
  const baseView=()=>({
    mode:world.mode,site:world.region.id,style:world.style,labels,released:[...released],
    shell:{...fields(world.shell,["cut","selected","subdued"]),visible:[...world.shell.visible],opacity:[...world.shell.opacity],comparison:world.shell.expanded?"expanded" as const:world.shell.lithosphere?"lithosphere" as const:"reference" as const},
    plates:{...world.plateOptions},profile:world.profileCode,pair:Boolean(world.mosaic?.pair),pairStep:world.mosaic?.pair?.step[0],arrows:world.mosaic?.pair?.vectors.visible,pairTime:world.mosaic?.progress??0,pairPlaying:world.mosaic?.playing??false,
    process:fields(world,["processDetail","processSite","processProgress","processPlaying","processLoop","processSlow","singlePlateName","smallPlateNames"]),
    nyos:fields(world.nyosLesson,lessonKeys),nyosDetail:world.nyosDetail
  });
  classroomViews(observatory,observation,baseView,async b=>{
    if(b.mode==="nyos")await world.nyos.load();
    navigate(b.mode);world.setStyle(b.style);
    if(b.mode==="inside"){world.shell.cut=b.shell.cut;world.shell.visible=[...b.shell.visible];world.shell.opacity=[...b.shell.opacity];world.shell.selected=b.shell.selected;world.shell.subdued=b.shell.subdued;world.shell.setComparison(b.shell.comparison);labels=b.labels;released.clear();b.released.forEach(i=>released.add(i));}
    if(b.mode==="place"&&siteCatalog.some(site=>site.id===b.site))world.visit(b.site);
    if(b.mode==="nyos"){if(b.nyos.view==="protection")world.showNyosMeasure(b.nyos.measure);else world.showNyos(b.nyos.view);Object.assign(world.nyosLesson,fields(b.nyos,lessonKeys));world.nyosDetail=b.nyosDetail;}
    if(b.mode==="plates"){
      await world.loadClassroomAtlas(Boolean(b.process.processSite));world.setPlateOptions(b.plates);
      if(b.process.processSite)world.visit(b.process.processSite,!b.process.processDetail);
      else if(b.profile&&world.profiles[b.profile]){world.inspectPlate(b.profile);if(b.pair){world.comparePlates(false,b.pairStep);if(world.mosaic){world.mosaic.progress=b.pairTime;world.mosaic.pair?.setTime(b.pairTime);if(world.mosaic.pair)world.mosaic.pair.vectors.visible=b.arrows!==false;world.mosaic.playing=b.pairPlaying;}}}
      Object.assign(world,fields(b.process,["processProgress","processPlaying","processLoop","processSlow","singlePlateName","smallPlateNames"]));
    }
    renderSide();
  },experience);
  for(const [id,run] of [["earthquake",()=>observatory.openMap()],["volcano",()=>observatory.openRegion(reference("hawaii","volcano"))],["risk",()=>observatory.openRegion(reference("san","risk"))]] as const){
    $("nav-"+id).classList.add("obsNav");$("nav-"+id).onclick=run;
  }
  renderSide();
  world.onNyosObject=label=>{
    if(observation.active)claimObject(label.id,label.name+" · "+label.text);
    else showDefinition(label);
  };
  world.onLayer = i => {
    if(observation.active&&claimObject("shell-"+i,layers[i].name+" · "+layers[i].text)){annotationKey="";return;}
    if (!observation.active && (labels || released.has(i))) showDefinition(layers[i]);
    else select(i);
  };
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
      $("definition").querySelector<HTMLButtonElement>(":scope > button")?.click();
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
      if (window.geoPresentation) { void window.geoPresentation.toggle(); return; }
      setPresentation(false);
      if (document.fullscreenElement) void document.exitFullscreen();
    }
    else return;
    e.preventDefault();
  });
  let lastHud = 0;
  let lastBearing = NaN;
  world.onFrame = () => {
    observation.update(); experience?.update(performance.now());
    if(observatory.mode){if(status.textContent)status.textContent="";return;}
    if (world.mode==="inside"||world.mode==="plates") updatePins();
    const now = performance.now();
    if (now - lastHud < 55) return;
    lastHud = now;
    if (lastBearing !== world.nav.pose.bearing) {
      lastBearing = world.nav.pose.bearing;
      document.querySelector<SVGElement>(".orientation svg")!.style.transform = `rotate(${lastBearing}deg)`;
    }

    if (world.mode === "plates") { syncPlayback(world); }
    if (world.mode === "nyos") {
      if (side.dataset.nyosError !== String(!!world.nyos.error)) renderSide();
      syncNyos(world);updatePins();
    }
    const message = world.nyosWarning || (world.mode === "place" && world.local.warning) || alertText || "";
    if (status.textContent !== message) status.textContent = message;
  };
  await world.init();
  Object.defineProperty(window, "geoDeviceProbe", {value: deviceProbe});
  Object.defineProperty(window,"geoBoundaryModels",{value:()=>observatory.coverage()});
  Object.defineProperty(window,"geoAtlasCoverage",{value:()=>world.atlasCoverage()});
  Object.defineProperty(window, "geoObservatory", {
    value: () => ({...world.diagnostics(), observatory:observatory.diagnostics(), annotationDom:{...tectonicPins.work}, shellAnnotationDom:{...shellPins.work}}),
  });
}
void boot().catch(() =>
  warn("Das Erdmodell konnte nicht geladen werden. Bitte die Seite neu laden."),
);
