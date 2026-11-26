import {termInfo} from "./exploration-menu";
import { places, referenceFor, wilsonPlaces } from "./process-places";
import { earthFeatures, processFeatures, readingOrder, type Feature } from "./process-labels";
import * as T from "three";
import { PlateSection, type Analysis } from "./plate-section";
import { EarthClassification, layersFor, type Division } from "./earth-classification";
import {
  processes,
  explanations,
  wilsonStages,
  wilsonMotion,
  subducts,
  spreading,
  clamp,
  type ProcessId,
} from "./tectonic-process";
import { allowsLabel, beginCandidates, claimObject } from "./reveal";
import { graphics } from "./graphics";

const views = {
  block: "Räumlicher Schnitt",
  surface: "Landschaft",
  top: "Von oben",
  section: "Frontalschnitt",
  seabed: "Über dem Meeresboden",
  wedge: "Mantelkeil räumlich freilegen",
};
type View = keyof typeof views;
const options = (entries: Record<string, string>, active: string) =>
  Object.entries(entries)
    .map(
      ([v, label]) =>
        '<option value="' + v + '" ' + (active === v ? "selected" : "") + ">" + label + "</option>",
    )
    .join("");
const field = (title: string, id: string, entries: Record<string, string>, active: string) =>
  "<label>" + title + '<select id="' + id + '">' + options(entries, active) + "</select></label>";
const check = (id: string, label: string, on: boolean) =>
  '<label><input id="' + id + '" type="checkbox" ' + (on ? "checked" : "") + ">" + label + "</label>";
const canMelt = (k: ProcessId) => subducts(k) || k === "ridge" || k === "hotspot" || k === "wilson";
const underwater = (k: ProcessId) => ["ridge", "arc", "oceanTransform", "hotspot"].includes(k);
function startingAngles(k: ProcessId): [number, number] {
  if (k === "transform" || k === "oceanTransform") return [0.27, 0.89];
  if (k === "collision" || k === "complex") return [0.32, 0.31];
  if (subducts(k)) return [0.29, 0.33];
  if (k === "ridge") return [0.28, 0.39];
  return [0.36, 0.42];
}
const defaults = () => ({
  interior: false,
  division: "composition" as Division,
  expanded: false,
  layer: -1,
  models: ["ridge"] as ProcessId[],
  focus: -1,
  view: "block" as View,
  time: 0,
  playing: false,
  analysis: "natural" as Analysis,
  paths: true,
  vectors: true,
  rate: 25,
  km: 80,
  measure: false,
  labels: [false, false, false, false],
  yaw: 0.36,
  pitch: 0.42,
  zoom: 1,
});
export type StudioState = ReturnType<typeof defaults>;
export function validStudio(x: unknown): x is StudioState {
  if (!x || typeof x !== "object") return false;
  const v = x as StudioState;
  const num = (n: number, l: number, h: number) => Number.isFinite(n) && n >= l && n <= h;
  return (
    ["interior", "expanded", "playing", "paths", "vectors", "measure"].every(
      (k) => typeof v[k as keyof StudioState] === "boolean",
    ) &&
    ["composition", "mechanics"].includes(v.division) &&
    Number.isInteger(v.layer) &&
    num(v.layer, -1, 4) &&
    Array.isArray(v.models) &&
    v.models.length >= 1 &&
    v.models.length <= 4 &&
    v.models.every((k) => Object.hasOwn(processes, k)) &&
    Number.isInteger(v.focus) &&
    num(v.focus, -1, v.models.length - 1) &&
    Object.hasOwn(views, v.view) &&
    num(v.time, 0, 1) &&
    ["natural", "materials", "age", "magnet"].includes(v.analysis) &&
    [15, 25, 50].includes(v.rate) &&
    num(v.km, -180, 180) &&
    Array.isArray(v.labels) &&
    v.labels.length === 4 &&
    v.labels.every((b) => typeof b === "boolean") &&
    num(v.pitch, 0.04, 1.55) &&
    num(v.yaw, -1e7, 1e7) &&
    num(v.zoom, 0.56, 2.3)
  );
}
function scene() {
  const s = new T.Scene();
  s.background = new T.Color(0x162d37);
  s.add(new T.HemisphereLight(0xf2f7ff, 0xb39781, 1.66));
  const sun = new T.DirectionalLight(0xffe6c6, 2.22);
  sun.position.set(-4, 8, 5);
  s.add(sun);
  const edge = new T.DirectionalLight(0xbde6ef, 0.92);
  edge.position.set(5, 2, -5);
  s.add(edge);
  return s;
}
export class TectonicStudio {
  readonly state: StudioState;
  private rows: { scene: T.Scene; body: PlateSection | EarthClassification }[] = [];
  private camera = new T.PerspectiveCamera(32, 1, 0.1, 120);
  private overlay = document.createElement("div");
  private events = new AbortController();
  private textureRevision = 0;
  private sampleEnd = 0;
  private sampleStart = 0;
  private sampleConfig = "";
  private prior = "";
  private lastGeometry = "";
  private nextLabelLayout = 0;
  private labelLayoutKey = "";
  private panelsKey = "";
  private labelResize = new ResizeObserver(() => {
    this.prior = "";
  });
  private pins: { button: HTMLButtonElement; leader: HTMLElement; index: number; cell: number }[] = [];
  private side?: HTMLElement;
  constructor(
    private gl: T.WebGLRenderer,
    initial?: Partial<StudioState>,
    private atlas = () => {},
    private region: (id: string) => void = () => {},
    private locate?: (model: ProcessId) => void,
  ) {
    this.state = { ...defaults(), ...structuredClone(initial ?? {}) };
    if (!this.state.interior && initial?.yaw === undefined)
      [this.state.yaw, this.state.pitch] = startingAngles(this.state.models[0]);
    this.overlay.className = "studio-overlay";
    const canvas = gl.domElement;
    canvas.parentElement!.append(this.overlay);
    const signal = this.events.signal;
    let drag: { id: number; x: number; y: number } | undefined;
    canvas.addEventListener(
      "pointerdown",
      (e) => {
        if (e.button !== 0) return;
        drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
        canvas.setPointerCapture(e.pointerId);
      },
      { signal },
    );
    canvas.addEventListener(
      "pointermove",
      (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        this.state.yaw -= (e.clientX - drag.x) * 0.008;
        this.state.pitch = clamp(this.state.pitch + (e.clientY - drag.y) * 0.007, 0.04, 1.55);
        drag.x = e.clientX;
        drag.y = e.clientY;
      },
      { signal },
    );
    canvas.addEventListener(
      "pointerup",
      () => {
        drag = undefined;
      },
      { signal },
    );
    canvas.addEventListener(
      "pointercancel",
      () => {
        drag = undefined;
      },
      { signal },
    );
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.state.zoom = clamp(this.state.zoom * Math.exp(-e.deltaY * 0.001), 0.56, 2.3);
      },
      { signal, passive: false },
    );
    this.build();
  }
  private normalizeContext() {
    const s = this.state;
    const active = s.focus < 0 ? s.models : [s.models[s.focus]];
    if ((s.view === "wedge" && !active.every(subducts)) || (s.view === "seabed" && !active.every(underwater)))
      s.view = "block";
    if (!active.every((id) => id === "ridge")) {
      if (s.analysis === "age" || s.analysis === "magnet") s.analysis = "natural";
      s.measure = false;
    }
    if (!active.some(canMelt)) s.paths = false;
  }
  private build() {
    for (const row of this.rows) row.body.dispose();
    this.normalizeContext();
    const s = this.state;
    s.playing = false;
    const repaint = () => {
      this.textureRevision++;
    };
    this.rows = (s.interior ? (["earth"] as const) : s.models).map((k) => {
      const body =
        k === "earth"
          ? new EarthClassification(s.division, s.expanded, s.layer, repaint)
          : new PlateSection(k, repaint);
      const world = scene();
      world.add(body.group);
      return { scene: world, body };
    });
    this.lastGeometry = this.prior = this.panelsKey = this.sampleConfig = "";
  }
  mount(side: HTMLElement) {
    const detailsOpen = side.querySelector<HTMLDetailsElement>("#studio-details")?.open;
    this.side = side;
    const s = this.state,
      k = s.models[Math.max(0, s.focus)],
      g = s.interior ? layersFor(s.division) : [];
    const models = { ...processes, earth: "Erdinneres" };
    const active = s.focus < 0 ? s.models : [k];
    const sharing = active.every((id) => id === k);
    const hasMelt = active.some(canMelt);
    const hasMeltPreset = sharing && canMelt(k) && k !== "wilson";
    const preset = (() => {
      if (s.analysis !== "natural") return s.vectors && !s.paths ? s.analysis : "custom";
      if (!s.vectors) return s.paths && hasMeltPreset ? "melt" : "custom";
      return hasMelt && !s.paths ? "movement" : "full";
    })();
    const place =
      k === "wilson" ? wilsonPlaces[Math.min(8, Math.floor(s.time * 8 + 0.0001))] : referenceFor[k];
    const analogue = places[place];
    side.innerHTML =
      '<p class="g-kicker">Plattentektonik</p><h1>' +
      (s.interior ? "Erdinneres" : s.models.length > 1 ? "Prozessvergleich" : "Prozessmodell") +
      '</h1><div class="g-stack studio-tools">' +
      field("Modell", "studio-model", models, s.interior ? "earth" : k) +
      (!s.interior
        ? field(
            "Zeigen",
            "studio-preset",
            {
              full: "Vollständiger Prozess",
              ...(hasMelt ? { movement: "Plattenbewegung" } : {}),
              materials: "Materialgrenzen",
              ...(hasMeltPreset ? { melt: k === "ridge" ? "Krustenbildung" : "Magmenbildung" } : {}),
              ...(sharing && k === "ridge" ? { age: "Meeresbodenalter", magnet: "Magnetstreifen" } : {}),
              ...(preset === "custom" ? { custom: "Eigene Ansicht" } : {}),
            },
            preset,
          )
        : "") +
      (s.interior
        ? field(
            "Gliederung",
            "studio-division",
            { composition: "Stofflicher Aufbau", mechanics: "Mechanisches Verhalten" },
            s.division,
          ) +
          field(
            "Schicht aufdecken",
            "studio-layer",
            Object.fromEntries([["-1", "Anonym"], ...g.map((_, i) => [String(i), "Schicht " + (i + 1)])]),
            String(s.layer),
          ) +
          check("studio-expand", "Äußerste Schicht überhöhen", s.expanded) +
          '<small id="studio-scale">' +
          (s.expanded
            ? "Äußerste Schicht radial überhöht · übrige innere Grenzradien unverändert"
            : "Referenzradien · mittlerer Erdradius 6.371 km") +
          "</small>" +
          (s.layer < 0
            ? ""
            : '<article><h2 data-teach="terms">' +
              g[s.layer][0] +
              "</h2><p>" +
              g[s.layer][2] +
              " · " +
              (s.layer === 0 ? 0 : g[s.layer - 1][1]) +
              "–" +
              g[s.layer][1] +
              ' km Tiefe.</p><p data-teach="cause">' +
              g[s.layer][3] +
              "</p><details><summary>Physikalische Größen</summary><p>" +
              g[s.layer].slice(4, 7).join(" · ") +
              "</p><small>Gerundete Bereiche eines eindimensionalen Erdmodells. Temperaturen sind stärker modellabhängig als Dichte und Druck.</small></details></article>")
        : "<label>" +
          (s.models.length > 1 ? "Gemeinsame Entwicklungsphase" : "Modellzeit") +
          '<input type="range" id="g-progress" min="0" max="1" step=".001" value="' +
          s.time +
          '"></label><div class="g-buttons"><button id="g-play">Abspielen</button><button id="g-step">Schritt</button><button id="g-reset">Zurücksetzen</button></div>' +
          '<button id="studio-home">Standardperspektive</button>' +
          field(
            "Ansicht",
            "studio-view",
            Object.fromEntries(
              Object.entries(views).filter(
                ([key]) =>
                  (key !== "wedge" || active.every(subducts)) &&
                  (key !== "seabed" || active.every(underwater)),
              ),
            ),
            s.view,
          ) +
          (s.models.length > 1
            ? "<small>Gleiche Modellphase · natürliche Prozesse dauern unterschiedlich lange.</small>"
            : "") +
          '<details id="studio-details"><summary>Untersuchen und vergleichen</summary>' +
          field(
            "Felder",
            "studio-count",
            { "1": "Ein Modell", "2": "Zwei Modelle", "3": "Drei Modelle", "4": "Vier Modelle" },
            String(s.models.length),
          ) +
          s.models
            .map(
              (id, i) =>
                '<div class="studio-row">' +
                field("Modell " + (i + 1), "studio-slot-" + i, processes, id) +
                check("studio-label-" + i, "Name zeigen", s.labels[i]) +
                "</div>",
            )
            .join("") +
          field(
            "Darstellung",
            "studio-analysis",
            {
              natural: "Gesteinsansicht",
              materials: "Materialgrenzen",
              ...(active.every((id) => id === "ridge")
                ? { age: "Ozeanbodenalter", magnet: "Magnetische Polarität" }
                : {}),
            },
            s.analysis,
          ) +
          (active.some((id) => canMelt(id) && id !== "wilson") && !["surface", "seabed"].includes(s.view)
            ? check("studio-paths", "Schmelzbildung und Aufstieg", s.paths)
            : "") +
          check("studio-vectors", "Relativbewegung verdeutlichen", s.vectors) +
          (active.every((id) => id === "ridge")
            ? check("studio-measure", "Am Rücken messen", s.measure) +
              (s.measure
                ? field(
                    "Halbseitige Spreizungsrate",
                    "studio-rate",
                    { "15": "15 mm/Jahr", "25": "25 mm/Jahr", "50": "50 mm/Jahr" },
                    String(s.rate),
                  ) +
                  '<label>Ort quer zur Achse (km)<input id="studio-km" type="range" min="-180" max="180" step="1" value="' +
                  s.km +
                  '"></label><output id="studio-reading"></output>'
                : "")
            : "") +
          (analogue ? '<button id="studio-region">Referenzraum ' + analogue.name + " öffnen</button>" : "") +
          '</details><details><summary>Was zeigt das Modell?</summary><p data-teach="cause">' +
          explanations[k] +
          '</p><p id="studio-stage" data-teach="phase"></p><small>Idealisiertes Prozessmodell. Höhen und Zeiten sind überhöht. Die Materialbewegung ist qualitativ. Bei der Spreizung entspricht der Ablauf 1,2 Millionen Modelljahren. Die ungleich breiten Polaritätsintervalle sind idealisiert.</small></details>') +
      '<p id="studio-info" hidden aria-live="polite" data-teach="cause"></p><button id="studio-atlas">Im Forschungsatlas untersuchen</button></div>';
    if (detailsOpen && side.querySelector("details#studio-details"))
      side.querySelector<HTMLDetailsElement>("#studio-details")!.open = true;
    const element = <E extends HTMLElement>(id: string) => side.querySelector<E>("#" + id);
    const bind = (id: string, fn: (value: string) => void) => {
      const el = element<HTMLSelectElement>(id);
      if (el) el.onchange = () => fn(el.value);
    };
    const click = (id: string, fn: () => void) => {
      const el = element(id);
      if (el) el.onclick = fn;
    };
    const redraw = (rebuild = false) => {
      const opened = element<HTMLDetailsElement>("studio-details")?.open;
      if (rebuild) this.build();
      this.mount(side);
      if (opened && element("studio-details")) element<HTMLDetailsElement>("studio-details")!.open = true;
    };
    bind("studio-model", (v) => {
      if (v !== "earth" && s.models.length === 1 && this.locate) {
        this.locate(v as ProcessId);
        return;
      }
      s.interior = v === "earth";
      if (!s.interior) s.models[Math.max(0, s.focus)] = v as ProcessId;
      s.playing = false;
      redraw(true);
    });
    bind("studio-division", (v) => {
      s.division = v as Division;
      s.layer = -1;
      redraw(true);
    });
    bind("studio-layer", (v) => {
      s.layer = Number(v);
      redraw(true);
    });
    bind("studio-expand", () => {
      s.expanded = !s.expanded;
      redraw(true);
    });
    bind("studio-count", (v) => {
      const preferred: ProcessId[] = ["ridge", "subduction", "collision", "transform", "rift"];
      while (s.models.length < Number(v)) s.models.push(preferred.find((key) => !s.models.includes(key))!);
      s.models.length = Number(v);
      s.focus = -1;
      redraw(true);
    });
    s.models.forEach((_, i) => {
      bind("studio-slot-" + i, (v) => {
        s.models[i] = v as ProcessId;
        s.view = "block";
        s.analysis = "natural";
        s.paths = canMelt(v as ProcessId);
        redraw(true);
      });
      bind("studio-label-" + i, () => {
        s.labels[i] = !s.labels[i];
      });
    });
    click("studio-home", () => {
      s.view = "block";
      s.zoom = 1;
      [s.yaw, s.pitch] = startingAngles(k);
      redraw();
    });
    bind("studio-view", (v) => {
      s.view = v as View;
      [s.yaw, s.pitch] =
        v === "top" ? [0, 1.54] : v === "section" ? [0, 0.055] : v === "seabed" ? [0.64, 0.15] : [0.36, 0.42];
      redraw();
    });
    bind("studio-preset", (v) => {
      if (v === "custom") return;
      s.analysis = v === "age" || v === "magnet" || v === "materials" ? v : "natural";
      s.paths = active.some(canMelt) && !["movement", "materials", "age", "magnet"].includes(v);
      s.vectors = v !== "melt";
      if (v === "melt" && active.every(subducts)) {
        s.view = "wedge";
        s.yaw = 0.32;
        s.pitch = 0.26;
      } else if (s.view === "wedge") {
        s.view = "block";
        s.yaw = 0.36;
        s.pitch = 0.42;
      }
      redraw();
    });
    bind("studio-analysis", (v) => {
      s.analysis = v as Analysis;
      redraw();
    });
    bind("studio-paths", () => {
      s.paths = !s.paths;
      redraw();
    });
    bind("studio-vectors", () => {
      s.vectors = !s.vectors;
      redraw();
    });
    bind("studio-measure", () => {
      s.measure = !s.measure;
      redraw();
    });
    bind("studio-rate", (v) => {
      s.rate = Number(v);
      this.read();
    });
    const distance = element<HTMLInputElement>("studio-km");
    if (distance)
      distance.oninput = () => {
        s.km = Number(distance.value);
        this.read();
      };
    click("g-play", () => {
      if (s.time >= 1) s.time = 0;
      s.playing = !s.playing;
    });
    click("g-step", () => {
      s.time = Math.min(1, s.time + (s.models.includes("wilson") ? 0.125 : 0.05));
      s.playing = false;
    });
    click("g-reset", () => {
      s.time = 0;
      s.playing = false;
    });
    const time = element<HTMLInputElement>("g-progress");
    if (time)
      time.oninput = () => {
        s.time = Number(time.value);
        s.playing = false;
      };
    click("studio-atlas", this.atlas);
    if (analogue)
      click("studio-region", () =>
        this.region(k === "wilson" ? wilsonPlaces[Math.min(8, Math.floor(s.time * 8 + 0.0001))] : place),
      );
    this.read();
    this.panelsKey = "";
  }
  private read() {
    const s = this.state,
      r = this.side?.querySelector("output");
    if (!r) return;
    const m = spreading(s.km, s.rate);
    r.textContent =
      Math.abs(s.km) +
      " km von der Achse · " +
      m.age.toLocaleString("de-DE", { maximumFractionDigits: 2 }) +
      " Ma · " +
      s.rate +
      " mm/Jahr je Flanke · " +
      m.full +
      " mm/Jahr Gesamtöffnung.";
  }
  get painted() {
    return !!this.prior;
  }
  motionSample() {
    return this.rows.map((r) => (r.body instanceof PlateSection ? r.body.motionSample() : undefined));
  }
  private panels(ids: number[]) {
    const s = this.state,
      observing = document.body.classList.contains("observing");
    const info = document.body.dataset.infoDepth,
      choosing = document.body.hasAttribute("data-choose-object");
    const priorities = ids.map((i) => (!s.interior ? readingOrder(s.models[i], s.time) : []));
    const stage = Math.min(8, Math.floor(s.time * 8 + 0.0001));
    const sig = [
      ids,
      s.models,
      s.labels,
      s.layer,
      s.focus,
      s.interior,
      s.division,
      s.expanded,
      s.analysis,
      s.view,
      s.paths,
      s.models.includes("wilson") ? stage : "",
      priorities,
      info,
      observing,
      choosing,
      document.body.dataset.reveal,
      s.models.includes("wilson") ? wilsonMotion(s.time).reading : "",
    ].join("/");
    if (this.panelsKey === sig) return;
    this.panelsKey = sig;
    beginCandidates();
    const names = ids.map((i) => !s.interior && allowsLabel("studio-" + i) && (observing || s.labels[i]));
    const entries = ids.map((i) =>
      (s.interior ? earthFeatures(s.division, s.expanded) : processFeatures(s.models[i], s.time)).map(
        (feature, j) => {
          const id = "studio-feature-" + i + "-" + j;
          const allowed =
            allowsLabel(id) &&
            (observing ||
              (s.interior ? s.layer === j : s.labels[i] || info === "terms" || info === "explain"));
          const shownStructure =
            s.interior ||
            !["Fluidweg", "Magmaaufstieg", "Schmelzregion", "Druckentlastung"].includes(feature.name) ||
            (s.paths && !["surface", "seabed"].includes(s.view));
          return { id, j, feature, show: shownStructure && (allowed || choosing), anonymous: !allowed };
        },
      ),
    );
    this.labelResize.disconnect();
    this.overlay.replaceChildren();
    this.pins = [];
    this.overlay.style.gridTemplateColumns = "repeat(" + Math.min(2, ids.length) + ",1fr)";
    for (const [n, i] of ids.entries()) {
      const slot = document.createElement("div");
      slot.className = "studio-cell";
      if (!s.interior && (s.models.length > 1 || names[n])) {
        const b = document.createElement("button");
        b.textContent =
          (names[n] ? processes[s.models[i]] : "Modell " + (i + 1)) +
          (s.models.length > 1 ? (s.focus < 0 ? " · Vergrößern" : " · Alle zeigen") : "");
        b.onclick = () => {
          if (claimObject("studio-" + i)) return;
          if (s.models.length > 1) {
            s.focus = s.focus === i ? -1 : i;
            this.normalizeContext();
            this.prior = "";
            if (this.side) this.mount(this.side);
          }
        };
        slot.append(b);
      }
      if (!s.interior && (names[n] || !observing) && s.models[i] === "wilson") {
        const p = document.createElement("span");
        p.textContent = wilsonStages[stage][0] + " · heutige Analogie: " + wilsonStages[stage][2];
        const b = document.createElement("button");
        b.textContent = "Analogie auf der Erde";
        b.onclick = () => this.region(wilsonPlaces[stage]);
        slot.append(b);
        slot.append(p);
      }
      if (!observing && !s.interior && s.models[i] === "ridge" && ["age", "magnet"].includes(s.analysis)) {
        const p = document.createElement("span");
        p.textContent =
          s.analysis === "age"
            ? "Alter · Rot <1,5 · Ocker <3 · Sand <4,5 · Grün <6 · Blau ≥6 Ma"
            : "Magnetisierung · warm normal · kühl invers · idealisierte Intervalle";
        slot.append(p);
      }
      const order = priorities[n];
      const ranked = entries[n]
        .filter((e) => e.show)
        .sort((a, b) => (order.length ? order.indexOf(a.j) - order.indexOf(b.j) : a.j - b.j));
      for (const [rank, e] of ranked.entries()) {
        if (!e.show || (!choosing && !observing && rank >= (ids.length > 1 ? 2 : 3))) continue;
        const tag = document.createElement("button");
        tag.className = "studio-object";
        if (rank === 0 && !observing && info === "explain") tag.classList.add("reading-focus");
        tag.textContent = e.anonymous ? "•" : e.feature.name;
        if (!e.anonymous && info === "explain" && !observing && rank === 0) {
          const line = document.createElement("small");
          line.textContent = e.feature.explanation;
          tag.append(line);
        }
        tag.setAttribute("aria-label", e.anonymous ? "Objekt auswählen" : e.feature.name);
        tag.onclick = () => {
          if (claimObject(e.id, e.feature.explanation)) return;
          if (!this.side?.offsetWidth && !e.anonymous) {
            termInfo(e.feature.name,e.feature.explanation);
          }
          const info = this.side?.querySelector<HTMLElement>("#studio-info");
          if (info) {
            info.hidden = false;
            info.textContent = e.feature.name + " · " + e.feature.explanation;
            let extra = tag.querySelector("small");
            if (!extra) {
              extra = document.createElement("small");
              tag.append(extra);
            }
            extra.textContent = e.feature.explanation;
            this.prior = "";
          }
        };
        const leader = document.createElement("i");
        leader.className = "studio-leader";
        slot.append(leader, tag);
        this.labelResize.observe(tag);
        this.pins.push({ button: tag, leader, index: e.j, cell: n });
      }
      this.overlay.append(slot);
    }
    const phase = this.side?.querySelector("#studio-stage");
    if (phase)
      phase.textContent = s.models.includes("wilson")
        ? wilsonStages[stage][0] +
          ". " +
          wilsonStages[stage][1] +
          " Heutige Analogie: " +
          wilsonStages[stage][2] +
          "."
        : "";
  }
  frame(dt: number) {
    const s = this.state;
    if (!s.interior && s.playing) {
      s.time = clamp(s.time + dt / 32);
      if (s.time >= 1) s.playing = false;
    }
    const ids = s.interior ? [0] : s.focus < 0 ? s.models.map((_, i) => i) : [s.focus];
    this.panels(ids);
    const input = this.side?.querySelector<HTMLInputElement>("#g-progress"),
      play = this.side?.querySelector("#g-play");
    if (input && Math.abs(Number(input.value) - s.time) > 0.0001) input.value = String(s.time);
    if (play) {
      const t = s.playing ? "Pause" : "Abspielen";
      if (play.textContent !== t) play.textContent = t;
    }
    const gl = this.gl,
      w = gl.domElement.clientWidth,
      h = gl.domElement.clientHeight;
    // The GPU interpolates positions between close analytic samples. Paused/scrubbed states are exact.
    const tick = s.playing ? Math.min(1, Math.ceil(s.time * 400) / 400) : s.time;
    const config = [s.analysis, s.view, s.paths, s.vectors, s.rate, s.km, s.measure, ids].join("|");
    const geometry = [tick, config].join("|");
    const signature = [
      geometry,
      this.panelsKey,
      s.time,
      s.yaw,
      s.pitch,
      s.zoom,
      w,
      h,
      gl.domElement.width,
      ids,
      this.textureRevision,
      graphics.surfaceRevision, graphics.revision,
    ].join("/");
    graphics.scope = "tectonic-studio";
    graphics.idle = signature === this.prior;
    graphics.activity = graphics.idle ? "cached" : s.playing ? "animation" : "camera";
    if (graphics.idle) return true;
    if (this.lastGeometry !== geometry) {
      const continuous =
        s.playing &&
        this.sampleConfig === config &&
        tick >= this.sampleEnd &&
        tick - this.sampleEnd <= 0.002501;
      this.sampleStart = continuous ? this.sampleEnd : tick;
      this.sampleEnd = tick;
      this.sampleConfig = config;
      for (const id of ids) {
        const row = this.rows[id];
        if (row.body instanceof PlateSection)
          row.body.update(
            tick,
            s.analysis === "age" || s.analysis === "magnet"
              ? row.body.kind === "ridge"
                ? s.analysis
                : "natural"
              : s.analysis,
            s.view !== "surface" && s.view !== "seabed",
            s.paths,
            s.vectors,
            s.rate,
            s.km,
            s.measure,
            s.view === "wedge",
          );
      }
      this.lastGeometry = geometry;
    }
    const fraction =
      s.playing && this.sampleEnd > this.sampleStart
        ? clamp((s.time - this.sampleStart) / (this.sampleEnd - this.sampleStart))
        : 1;
    for (const id of ids) {
      const row = this.rows[id];
      if (row.body instanceof PlateSection) row.body.fraction.value = fraction;
    }
    this.prior = signature;
    const cols = Math.min(2, ids.length),
      rows = Math.ceil(ids.length / cols);
    gl.setScissorTest(true);
    // Clear the fourth, empty cell of a three-model comparison as well.
    gl.setViewport(0, 0, w, h);
    gl.setScissor(0, 0, w, h);
    const bg = gl.getClearColor(new T.Color()),
      alpha = gl.getClearAlpha();
    gl.setClearColor(0x142a34);
    gl.clear();
    gl.setClearColor(bg, alpha);
    const layoutKey = [this.panelsKey, s.yaw, s.pitch, s.zoom, w, h].join("|");
    const now = performance.now();
    const layout = !s.playing || layoutKey !== this.labelLayoutKey || now >= this.nextLabelLayout;
    if (layout) {
      this.labelLayoutKey = layoutKey;
      this.nextLabelLayout = now + 80;
    }
    for (const [n, id] of ids.entries()) {
      const x = Math.round(((n % cols) * w) / cols),
        y = Math.round(((rows - 1 - Math.floor(n / cols)) * h) / rows),
        cw = Math.round((((n % cols) + 1) * w) / cols) - x,
        ch = Math.round(((rows - Math.floor(n / cols)) * h) / rows) - y;
      gl.setViewport(x, y, cw, ch);
      gl.setScissor(x, y, cw, ch);
      const cam = this.camera;
      cam.aspect = cw / ch;
      const seabed = !s.interior && s.view === "seabed";
      const dist =
        ((s.interior ? 11.9 : seabed ? 7.9 : 12.6) * Math.max(1, (s.interior ? 1.03 : 1.76) / cam.aspect)) /
        s.zoom;
      const target = s.interior ? 0 : seabed ? 0.02 : -0.52;
      cam.position.set(
        dist * Math.sin(s.yaw) * Math.cos(s.pitch),
        target + dist * Math.sin(s.pitch),
        dist * Math.cos(s.yaw) * Math.cos(s.pitch),
      );
      cam.lookAt(0, target, 0);
      cam.updateProjectionMatrix();
      gl.render(this.rows[id].scene, cam);
      const marks = this.pins.filter((p) => p.cell === n);
      if (marks.length && layout) {
        const features: Feature[] = s.interior
          ? earthFeatures(s.division, s.expanded)
          : processFeatures(s.models[id], s.time);
        const used: { x: number; y: number; w: number; h: number }[] = [];
        const cell = (marks[0].button.parentElement as HTMLElement).getBoundingClientRect();
        const protectedPoints = features.map((f) => {
          const p = f.point.clone().project(cam);
          return { x: ((1 + p.x) * cw) / 2, y: ((1 - p.y) * ch) / 2 };
        });
        const pad = Math.max(12, Math.min(cw, ch) * 0.052);
        const obstructions = [
          ...marks[0].button.parentElement!.querySelectorAll<HTMLElement>(
            ":scope > button:not(.studio-object), :scope > span",
          ),
          ...document.querySelectorAll<HTMLElement>(
            "#geo-clock:not([hidden]),#geo-model-limit:not([hidden]),#sidebar",
          ),
        ]
          .map((el) => el.getBoundingClientRect())
          .filter((b) => b.width && b.height)
          .map((b) => ({ x: b.left - cell.left, y: b.top - cell.top, w: b.width, h: b.height }));
        const rendered: DOMRect[] = [];
        for (const pin of marks) {
          const pt = features[pin.index].point.clone().project(cam),
            tag = pin.button;
          const tw = tag.offsetWidth,
            th = tag.offsetHeight;
          const ax = ((pt.x + 1) * cw) / 2,
            ay = ((1 - pt.y) * ch) / 2;
          const covered =
            !s.interior &&
            (Math.cos(s.yaw) < -0.12 ||
              ((s.view === "surface" || s.view === "seabed") && features[pin.index].point.y < -0.5));
          const offsets = [
            [-tw - 24, -th - 14],
            [24, -th - 14],
            [24, 18],
            [-tw - 24, 18],
            [-tw / 2, -th - 36],
            [-tw / 2, 38],
            [-tw - 25, -2 * th - 22],
            [25, th + 28],
            [25, -2 * th - 22],
            [-tw - 25, th + 28],
          ];
          offsets.push(
            [6 - ax, ay < ch / 2 ? 18 : -th - 20],
            [cw - tw - 6 - ax, -th / 2],
            [-tw / 2, 48 - ay],
            [-tw / 2, ch - th - 30 - ay],
            [6 - ax, ch * 0.28 - ay],
            [cw - tw - 6 - ax, ch * 0.28 - ay],
            [6 - ax, ch * 0.7 - ay],
            [cw - tw - 6 - ax, ch * 0.7 - ay],
          );
          // Prefer the open space just beyond the rock silhouette. The protected
          // feature discs remain a hard exclusion, including the other labels' anchors.
          const deck = new T.Vector3(0, s.interior ? 2.9 : 1.1, 0).project(cam);
          const ceiling = ((1 - deck.y) * ch) / 2;
          offsets.unshift(
            [-tw / 2, ceiling - th - 18 - ay],
            [-tw - 16, ceiling - th - 16 - ay],
            [18, ceiling - th - 16 - ay],
          );
          const xy = offsets
            .map(([dx, dy]) => ({ x: clamp(ax + dx, 6, Math.max(6, cw - tw - 6)), y: ay + dy }))
            .find(
              ({ x, y }) =>
                y > 40 &&
                y + th < ch - 12 &&
                !protectedPoints.some(
                  (p) => p.x + pad > x && p.x - pad < x + tw && p.y + pad > y && p.y - pad < y + th,
                ) &&
                ![...used, ...obstructions].some(
                  (b) => x < b.x + b.w + 4 && x + tw + 4 > b.x && y < b.y + b.h + 4 && y + th + 4 > b.y,
                ),
            );
          const visible = !!xy && !covered && Math.abs(pt.x) < 1 && Math.abs(pt.y) < 1 && Math.abs(pt.z) < 1;
          tag.style.visibility = pin.leader.style.visibility = visible ? "visible" : "hidden";
          if (!visible || !xy) continue;
          const { x, y } = xy,
            tx = clamp(ax, x, x + tw),
            ty = clamp(ay, y, y + th);
          const coordinates = [ax.toFixed(1), ay.toFixed(1)].join(",");
          if (tag.dataset.anchor !== coordinates) tag.dataset.anchor = coordinates;
          tag.style.left = Math.round(x) + "px";
          tag.style.top = Math.round(y) + "px";
          pin.leader.style.left = Math.round(ax) + "px";
          pin.leader.style.top = Math.round(ay) + "px";
          pin.leader.style.width = Math.hypot(tx - ax, ty - ay) + "px";
          pin.leader.style.transform = "rotate(" + Math.atan2(ty - ay, tx - ax) + "rad)";
          const bounds = tag.getBoundingClientRect();
          if (
            rendered.some(
              (b) =>
                bounds.left < b.right + 2 &&
                bounds.right + 2 > b.left &&
                bounds.top < b.bottom + 2 &&
                bounds.bottom + 2 > b.top,
            )
          ) {
            tag.style.visibility = pin.leader.style.visibility = "hidden";
            continue;
          }
          rendered.push(bounds);
          used.push({
            x: bounds.left - cell.left,
            y: bounds.top - cell.top,
            w: bounds.width,
            h: bounds.height,
          });
        }
      }
    }
    gl.setScissorTest(false);
    gl.setViewport(0, 0, w, h);
    return true;
  }
  dispose() {
    this.labelResize.disconnect();
    this.events.abort();
    this.overlay.remove();
    for (const row of this.rows) row.body.dispose();
    this.rows = [];
  }
}
