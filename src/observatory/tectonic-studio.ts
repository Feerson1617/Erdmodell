import { earthFeatures, processFeatures, type Feature } from "./process-labels";
import * as T from "three";
import { PlateSection, type Analysis } from "./plate-section";
import { EarthClassification, layersFor, type Division } from "./earth-classification";
import {
  processes,
  explanations,
  wilsonStages,
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
  paths: false,
  vectors: false,
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
  private panelsKey = "";
  private pins: { button: HTMLButtonElement; index: number; cell: number }[] = [];
  private side?: HTMLElement;
  constructor(
    private gl: T.WebGLRenderer,
    initial?: Partial<StudioState>,
    private atlas = () => {},
    private region: (id: string) => void = () => {},
  ) {
    this.state = { ...defaults(), ...structuredClone(initial ?? {}) };
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
  private build() {
    for (const row of this.rows) row.body.dispose();
    const s = this.state;
    if (s.view === "wedge" && !s.models.some(subducts)) s.view = "block";
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
    const analogues: Partial<Record<ProcessId, [string, string]>> = {
      ridge: ["2308", "Gakkelrücken"],
      rift: ["rift", "Ostafrika"],
      subduction: ["japan", "Japan"],
      arc: ["1510", "Tonga"],
      collision: ["himalaya", "Himalaya"],
      transform: ["san", "Parkfield"],
      hotspot: ["hawaii", "Hawaii"],
    };
    const analogue = analogues[k];
    side.innerHTML =
      '<p class="g-kicker">Plattentektonik</p><h1>' +
      (s.interior ? "Erdinneres" : s.models.length > 1 ? "Prozessvergleich" : "Prozessmodell") +
      '</h1><div class="g-stack studio-tools">' +
      field("Modell", "studio-model", models, s.interior ? "earth" : k) +
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
          field(
            "Ansicht",
            "studio-view",
            Object.fromEntries(
              Object.entries(views).filter(([key]) => key !== "wedge" || s.models.some(subducts)),
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
              ...(s.models.includes("ridge")
                ? { age: "Ozeanbodenalter", magnet: "Magnetische Polarität" }
                : {}),
            },
            s.analysis,
          ) +
          check("studio-paths", "Schmelzbildung und Aufstieg", s.paths) +
          check("studio-vectors", "Relativbewegung verdeutlichen", s.vectors) +
          (s.models.includes("ridge")
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
          (analogue ? '<button id="studio-region">Referenzraum ' + analogue[1] + " öffnen</button>" : "") +
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
        redraw(true);
      });
      bind("studio-label-" + i, () => {
        s.labels[i] = !s.labels[i];
      });
    });
    bind("studio-view", (v) => {
      s.view = v as View;
      [s.yaw, s.pitch] =
        v === "top"
          ? [0, 1.54]
          : v === "section"
            ? [0, 0.055]
            : v === "seabed"
              ? [0.64, 0.15]
              : [0.36, 0.42];
    });
    bind("studio-analysis", (v) => {
      s.analysis = v as Analysis;
    });
    bind("studio-paths", () => {
      s.paths = !s.paths;
    });
    bind("studio-vectors", () => {
      s.vectors = !s.vectors;
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
    if (analogue) click("studio-region", () => this.region(analogue[0]));
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
  private panels(ids: number[]) {
    const s = this.state,
      observing = document.body.classList.contains("observing");
    beginCandidates();
    const names = ids.map((i) => !s.interior && allowsLabel("studio-" + i) && (observing || s.labels[i]));
    const choosing = document.body.hasAttribute("data-choose-object");
    const features = ids.map((i) =>
      s.interior ? earthFeatures(s.division, s.expanded) : processFeatures(s.models[i], s.time),
    );
    const entries = features.map((list, n) =>
      list.map((feature, j) => {
        const id = "studio-feature-" + ids[n] + "-" + j;
        const allowed = allowsLabel(id) && (observing || (s.interior ? s.layer === j : s.labels[ids[n]]));
        return { id, j, feature, show: allowed || choosing, anonymous: !allowed };
      }),
    );
    const stage = Math.min(8, Math.floor(s.time * 8 + 0.0001)),
      sig = [
        ids,
        names,
        s.interior,
        s.models,
        s.focus,
        stage,
        observing,
        s.analysis,
        s.division,
        s.expanded,
        entries.map((list) =>
          list.map((e) => (e.show ? (e.anonymous ? "dot" : e.feature.name) : "")).join(","),
        ),
      ].join("/");
    if (this.panelsKey === sig) return;
    this.panelsKey = sig;
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
            this.prior = "";
            if (this.side) this.mount(this.side);
          }
        };
        slot.append(b);
      }
      if (!s.interior && names[n] && s.models[i] === "wilson") {
        const p = document.createElement("span");
        p.textContent = wilsonStages[stage][0] + " · heutige Analogie: " + wilsonStages[stage][2];
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
      for (const e of entries[n]) {
        if (!e.show) continue;
        const tag = document.createElement("button");
        tag.className = "studio-object";
        tag.textContent = e.anonymous ? "•" : e.feature.name;
        tag.setAttribute("aria-label", e.anonymous ? "Objekt auswählen" : e.feature.name);
        tag.onclick = () => {
          if (claimObject(e.id, e.feature.explanation)) return;
          const info = this.side?.querySelector<HTMLElement>("#studio-info");
          if (info) {
            info.hidden = false;
            info.textContent = e.feature.name + " · " + e.feature.explanation;
          }
        };
        slot.append(tag);
        this.pins.push({ button: tag, index: e.j, cell: n });
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
      graphics.revision,
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
        ((s.interior ? 11.9 : seabed ? 6.4 : 14.2) * Math.max(1, (s.interior ? 1.03 : 1.68) / cam.aspect)) /
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
      if (marks.length) {
        const features: Feature[] = s.interior
          ? earthFeatures(s.division, s.expanded)
          : processFeatures(s.models[id], s.time);
        const used: { x: number; y: number; w: number; h: number }[] = [];
        for (const pin of marks) {
          const pt = features[pin.index].point.project(cam),
            tag = pin.button;
          const tw = tag.offsetWidth,
            th = tag.offsetHeight;
          let px = clamp(((pt.x + 1) * cw) / 2 - tw / 2, 4, Math.max(4, cw - tw - 4)),
            py = clamp(((1 - pt.y) * ch) / 2 - th, 44, Math.max(44, ch - th - 30));
          for (const prior of used)
            if (
              px < prior.x + prior.w + 3 &&
              px + tw + 3 > prior.x &&
              py < prior.y + prior.h + 3 &&
              py + th + 3 > prior.y
            )
              py = prior.y + prior.h + 4;
          tag.style.visibility =
            py + th > ch - 12 || Math.abs(pt.x) > 1 || Math.abs(pt.y) > 1 ? "hidden" : "visible";
          tag.style.left = Math.round(px) + "px";
          tag.style.top = Math.round(py) + "px";
          used.push({ x: px, y: py, w: tw, h: th });
        }
      }
    }
    gl.setScissorTest(false);
    gl.setViewport(0, 0, w, h);
    return true;
  }
  dispose() {
    this.events.abort();
    this.overlay.remove();
    for (const row of this.rows) row.body.dispose();
    this.rows = [];
  }
}
