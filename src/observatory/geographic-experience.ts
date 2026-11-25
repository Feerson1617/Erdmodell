import { disclosure, restoreDisclosure, nextLabel, resetReveals } from "./reveal";
import { regions as landscapes } from "../regions";
import { position, R } from "../geo";
import { project } from "../annotations";
import type { World } from "../world";
import { classify } from "./boundaries";
import { reference } from "./regional";
import {
  places,
  regions,
  isContinent,
  referenceFor,
  wilsonPlaces,
  type ProcessPlace,
} from "./process-places";
import { processes, subducts, type ProcessId } from "./tectonic-process";
import type { Observatory } from "./panel";
import type { Observation } from "./observation";
import type { Step } from "../tectonics/atlas";

type MapFocus = {
  place?: string;
  space?: string;
  overview?: boolean;
  country?: "Deutschland";
  boundary?: number;
};
type Location = {
  scene: ReturnType<Observatory["snapshot"]>;
  focus: MapFocus;
  mode: World["mode"];
  depth: string;
  reveals: ReturnType<typeof disclosure>;
  restoreBase?: () => Promise<void>;
};
const el = <E extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as E;
const text = (node: HTMLElement, value: string) => {
  if (node.textContent !== value) node.textContent = value;
};
const optional = (id: string) => document.getElementById(id) as HTMLButtonElement | null;
const option = (select: HTMLSelectElement | HTMLOptGroupElement, id: string, title: string) =>
  select.append(new Option(title, id));
const groups = (select: HTMLSelectElement, title: string) => {
  const group = document.createElement("optgroup");
  group.label = title;
  select.append(group);
  return group;
};

export class GeographicExperience {
  private history: Location[] = [];
  private baseHistory?: () => () => Promise<void>;
  bindBaseHistory<T>(capture: () => T, restore: (value: T) => Promise<void>) {
    this.baseHistory = () => {
      const saved = capture();
      return () => restore(saved);
    };
  }
  private focus: MapFocus = {};
  private epoch = 0;
  private flight?: () => void;
  private toolbar = document.createElement("footer");
  private pins = document.createElement("div");
  private markers: { id: string; button: HTMLButtonElement; place: ProcessPlace }[] = [];
  private root?: ChildNode | null;
  private signature = "";
  private pinKey = "";
  private lastTick = 0;
  private depth = "terms";
  private play?: HTMLButtonElement;
  private source?: HTMLInputElement;
  private step?: HTMLButtonElement;
  private reset?: HTMLButtonElement;
  constructor(
    private world: World,
    private obs: Observatory,
    private observation: Observation,
    private navigate: (mode: World["mode"]) => void,
  ) {
    document.body.classList.add("geo-experience");
    document.body.dataset.infoDepth = this.depth;
    const header = document.querySelector("header")!;
    const nav = document.createElement("div");
    nav.className = "geo-selector";
    nav.innerHTML =
      '<select id="geo-topic" aria-label="Thema oder Prozess"></select><select id="geo-place" aria-label="Raum oder Ort"></select><span id="geo-crumb" aria-live="polite"></span>';
    header.insertBefore(nav, header.querySelector("nav"));
    const topics = el<HTMLSelectElement>("geo-topic");
    option(topics, "", "Thema wählen");
    const earth = groups(topics, "Erde und Platten");
    for (const [id, name] of Object.entries({
      globe: "Erde",
      global: "Globale Plattenprozesse",
      inside: "Schalenschnitt",
      layers: "Innerer Aufbau",
      plates: "Plattenatlas",
      forces: "Plattenantrieb",
      research: "Forschungsatlas",
      past: "Kontinentaldrift",
      future: "Zukunftsszenarien",
    }))
      option(earth, id, name);
    const models = groups(topics, "Plattentektonik");
    for (const [id, name] of Object.entries(processes)) option(models, "process-" + id, name);
    const hazard = groups(topics, "Naturgefahren und Orte");
    for (const [id, name] of Object.entries({
      events: "Erdbeben der Erde",
      quake: "Parkfield · Erdbeben",
      sea: "Tōhoku · Seebeben und Tsunami",
      volcano: "Hawaii · Vulkanismus",
      risk: "Schutzmaßnahmen",
      nyos: "Nyos-See",
      place: "Landschaften und Orte",
    }))
      option(hazard, id, name);
    topics.onchange = () => {
      const value = topics.value;
      topics.selectedIndex = 0;
      if (value) void this.topic(value);
    };
    const list = el<HTMLSelectElement>("geo-place");
    option(list, "", "Ort wählen");
    option(list, "*", "Alle Plattenprozesse");
    for (const space of Object.keys(regions)) {
      const group = groups(list, space);
      option(group, "space-" + space, space + " im Überblick");
      for (const [id, p] of Object.entries(places)) if (p.space === space) option(group, id, p.name);
    }
    const germany = groups(list, "Europa › Deutschland");
    option(germany, "country-de", "Deutschland im Überblick");
    for (const [id, p] of landscapes) option(germany, "local-" + id, p.name);
    list.onchange = () => {
      const value = list.value;
      list.selectedIndex = 0;
      if (value) void this.map(value);
    };
    this.toolbar.id = "geo-dock";
    this.toolbar.innerHTML =
      '<button id="geo-back" hidden>Zurück</button><button id="geo-skip" hidden>Fahrt beenden</button><button id="geo-land" hidden>Regionales Relief</button><button id="geo-section" hidden>Schnitt öffnen</button><button id="geo-return" hidden>Auf der Erde zeigen</button><button id="geo-play" hidden>Abspielen</button><input id="geo-time" aria-label="Modellzeit" type="range" hidden><button id="geo-step" hidden>Schritt</button><button id="geo-reset" hidden>Zurücksetzen</button><select id="geo-preset" aria-label="Prozessdarstellung" hidden></select><select id="geo-info" aria-label="Informationstiefe"><option value="observe">Beobachten</option><option value="terms" selected>Fachbegriffe</option><option value="explain">Erklären</option></select><button id="geo-release" hidden>Begriff freigeben</button><button id="geo-clear" hidden>Freigabe löschen</button><button id="geo-tools" aria-expanded="false">Ansicht</button>';
    el("app").append(this.toolbar);
    this.pins.id = "geo-markers";
    document.querySelector(".view")!.append(this.pins);
    const limit = document.createElement("div");
    limit.id = "geo-model-limit";
    limit.hidden = true;
    this.pins.after(limit);
    for (const [id, place] of Object.entries(places)) {
      const button = document.createElement("button");
      button.dataset.place = id;
      button.hidden = true;
      button.innerHTML = "<i aria-hidden='true'></i><span></span>";
      button.lastElementChild!.textContent = place.name;
      button.onclick = () => void this.map(id);
      this.pins.append(button);
      this.markers.push({ id, place, button });
    }
    el("geo-back").onclick = () => void this.back();
    el("geo-skip").onclick = () => this.skip();
    el("geo-land").onclick = () => void this.relief();
    el("geo-section").onclick = () => {
      const p = this.currentPlace();
      if (p) this.openSection(p.model);
    };
    el("geo-return").onclick = () => {
      if (this.focus.boundary && this.history.at(-1)?.scene.map.research) {
        void this.back();
        return;
      }
      const s = obs.studioState;
      if (s)
        void this.map(
          s.models[0] === "wilson"
            ? wilsonPlaces[Math.min(8, Math.floor(s.time * 8 + 0.0001))]
            : this.focus.place || referenceFor[s.models[0]],
        );
      else if (obs.region?.spec) {
        const sp = obs.region.spec;
        const p = Object.entries(places).find(([, p]) =>
          sp.geology ? p.step === sp.geology.id : p.site && p.site === sp.site,
        );
        if (p) void this.map(p[0]);
        else {
          this.remember();
          this.focus = { boundary: sp.geology?.id };
          void obs.openMap("boundaries", true).then(() => {
            this.world.nav.fly({ lat: sp.lat, lon: sp.lon, d: 4500, tilt: 0, bearing: 0 });
            if (sp.geology) obs.maps.selectStep(obs.maps.steps[sp.geology.id - 1]);
            obs.draw();
          });
        }
      } else void this.map("*");
    };
    el("geo-play").onclick = () => this.play?.click();
    el("geo-step").onclick = () => (this.step ? this.step.click() : this.scrub(true));
    el("geo-reset").onclick = () => (this.reset ? this.reset.click() : this.scrub(false));
    el<HTMLInputElement>("geo-time").oninput = () => this.setTime(+el<HTMLInputElement>("geo-time").value);
    el<HTMLSelectElement>("geo-info").onchange = (e) => this.setDepth((e.target as HTMLSelectElement).value);
    el("geo-release").onclick = () => {
      if (this.obs.studioState || this.obs.region) document.body.toggleAttribute("data-choose-object");
      else nextLabel();
    };
    el("geo-clear").onclick = () => resetReveals();
    el<HTMLSelectElement>("geo-preset").onchange = (e) => {
      const original = el<HTMLSelectElement>("studio-preset");
      if (original) {
        original.value = (e.target as HTMLSelectElement).value;
        original.dispatchEvent(new Event("change"));
      }
    };
    el("geo-tools").onclick = () => this.drawer(!document.body.classList.contains("geo-tools-open"));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.drawer(false);
    });
    obs.visitModel = (id) => void this.topic("process-" + id);
    obs.visitPlace = (id) => void this.map(id);
    obs.visitBoundary = (step) => void this.boundary(step);
  }
  private drawer(open: boolean) {
    document.body.classList.toggle("geo-tools-open", open);
    el("geo-tools").setAttribute("aria-expanded", String(open));
  }
  private setDepth(value: string) {
    this.depth = value;
    this.observation.set(value === "observe");
    document.body.dataset.infoDepth = value;
    if (value === "observe") this.drawer(false);
    this.signature = "";
    this.pinKey = "";
  }
  capture() {
    return { focus: { ...this.focus }, depth: this.depth };
  }
  restore(saved?: { focus?: MapFocus; depth?: string }) {
    this.epoch++;
    this.flight = undefined;
    this.history = [];
    this.focus = {};
    if (saved?.focus) {
      const f = saved.focus;
      this.focus = {
        place: f.place && Object.hasOwn(places, f.place) ? f.place : undefined,
        space: f.space && Object.hasOwn(regions, f.space) ? f.space : undefined,
        overview: f.overview === true,
        country: f.country === "Deutschland" ? f.country : undefined,
        boundary:
          Number.isInteger(f.boundary) && f.boundary! > 0 && f.boundary! <= 5819 ? f.boundary : undefined,
      };
    }
    this.depth = this.observation.active ? "observe" : saved?.depth === "explain" ? "explain" : "terms";
    document.body.dataset.infoDepth = this.depth;
    this.signature = this.pinKey = "";
    this.drawer(false);
  }
  private remember() {
    const scene = structuredClone(this.obs.snapshot());
    if (scene.studio) scene.studio.playing = false;
    if (scene.time) scene.time.playing = false;
    if (scene.region) scene.region.settings.playing = false;
    this.history.push({
      scene,
      focus: { ...this.focus },
      mode: this.world.mode,
      depth: this.depth,
      reveals: disclosure(),
      restoreBase: scene.mode ? undefined : this.baseHistory?.(),
    });
    if (this.history.length > 24) this.history.shift();
    this.epoch++;
    this.flight = undefined;
    this.drawer(false);
    this.signature = "";
  }
  private currentPlace() {
    return this.focus.place ? places[this.focus.place] : undefined;
  }
  private skip() {
    const nav = this.world.nav;
    if (nav.flight) {
      const target = { ...nav.flight.to };
      nav.stop();
      nav.goal = { ...target };
      nav.pose = { ...target };
    }
    const done = this.flight;
    this.flight = undefined;
    done?.();
  }
  private async journey(id: string, after?: () => void) {
    const space = id.startsWith("space-") ? id.slice(6) : undefined,
      p = places[id];
    this.focus = { space: p?.space ?? space, place: p ? id : undefined, overview: true };
    const epoch = this.epoch;
    await this.obs.openMap("boundaries", true);
    if (epoch !== this.epoch) return;
    const coord = space ? regions[space] : undefined;
    const dest = {
      lat: p?.lat ?? coord?.[0] ?? 12,
      lon: p?.lon ?? coord?.[1] ?? -146,
      d: p ? 3400 : space ? 9400 : 16100,
      tilt: 0,
      bearing: 0,
    };
    this.world.nav.fly(dest, false, 700);
    this.flight = () => {
      if (this.epoch === epoch) after?.();
    };
    this.pinKey = "";
  }
  private async map(id: string) {
    this.remember();
    if (id === "country-de") {
      this.focus = { country: "Deutschland", overview: true };
      const epoch = this.epoch;
      await this.obs.openMap("boundaries", true);
      if (epoch !== this.epoch) return;
      this.world.nav.fly({ lat: 51.1, lon: 10.3, d: 2350, tilt: 0, bearing: 0 }, false);
      return;
    }
    if (id.startsWith("local-") && landscapes.has(id.slice(6))) {
      this.focus = {};
      this.navigate("place");
      this.world.visit(id.slice(6));
      return;
    }
    await this.journey(id);
  }
  private openSection(id: ProcessId, save = true) {
    if (save) this.remember();
    this.focus.overview = false;
    this.obs.openStudio({
      models: [id],
      playing: false,
      time: 0,
      view: "block",
      paths: subducts(id) || ["ridge", "hotspot", "wilson"].includes(id),
      vectors: true,
    });
  }
  private async relief() {
    const p = this.currentPlace();
    if (!p) return;
    this.remember();
    const epoch = this.epoch;
    this.focus.overview = false;
    if (p.site) await this.obs.openRegion(reference(p.site, "process"));
    else if (p.bathy && p.step) await this.obs.openBoundary(this.obs.maps.steps[p.step - 1], "process");
    if (this.epoch === epoch && this.obs.region) {
      this.obs.region.cameraView("overhead");
      this.obs.region.names = false;
      this.obs.draw();
    }
  }
  private async boundary(step: Step) {
    this.remember();
    const known = Object.entries(places).find(([, p]) => p.step === step[0]);
    this.focus = { place: known?.[0], space: known?.[1].space, boundary: step[0] };
    const type = classify(step);
    if (known) this.openSection(known[1].model, false);
    else if (["ridge", "rift", "transform", "oceanTransform"].includes(type))
      this.openSection(type as ProcessId, false);
    else await this.obs.openBoundary(step, "process");
  }
  private async topic(value: string) {
    this.remember();
    this.focus = {};
    if (value.startsWith("process-")) {
      const model = value.slice(8) as ProcessId;
      await this.journey(referenceFor[model], () => this.openSection(model, false));
      return;
    }
    if (value === "global") await this.journey("*");
    else if (value === "layers") this.obs.openStudio({ interior: true });
    else if (value === "forces") this.obs.openConcept("forces");
    else if (value === "research") {
      await this.obs.openResearch();
      this.drawer(true);
    } else if (value === "events") await this.obs.openMap();
    else if (value === "past" || value === "future") {
      this.obs.openTime();
      if (value === "future") {
        const s = el<HTMLSelectElement>("g-scenario");
        s.value = "aurica";
        s.dispatchEvent(new Event("change"));
      }
    } else if (["quake", "sea", "volcano", "risk"].includes(value)) {
      const id = value === "sea" ? "japan" : value === "volcano" ? "hawaii" : "san";
      await this.obs.openRegion(
        reference(id, value === "volcano" ? "volcano" : value === "risk" ? "risk" : "earthquake"),
      );
      if (value === "sea" && this.obs.region) {
        this.obs.region.cameraView("water");
        this.obs.draw();
      }
    } else this.navigate(value as World["mode"]);
  }
  private async back() {
    const item = this.history.pop();
    if (!item) return;
    this.epoch++;
    this.flight = undefined;
    this.drawer(false);
    this.focus = item.focus;
    if (!item.scene.mode) {
      if (item.restoreBase) await item.restoreBase();
      else this.navigate(item.mode);
    }
    await this.obs.restore(item.scene);
    this.setDepth(item.depth);
    if (item.depth === "observe") restoreDisclosure(item.reveals);
    if (item.scene.map.research) this.drawer(true);
    this.signature = "";
    this.pinKey = "";
  }
  private setTime(value: number) {
    if (this.source) {
      this.source.value = String(value);
      this.source.dispatchEvent(new Event("input"));
    } else if (this.world.mode === "nyos") {
      this.world.nyosLesson.progress = value;
      this.world.nyosLesson.playing = false;
    } else if (this.world.mosaic?.pair) {
      this.world.mosaic.playing = false;
      this.world.mosaic.progress = value;
      this.world.mosaic.pair.setTime(value);
    }
  }
  private scrub(step: boolean) {
    const bar = el<HTMLInputElement>("geo-time"),
      jump = this.source?.id === "g-year" ? 5 : 0.05;
    this.setTime(step ? Math.min(+bar.max, +bar.value + jump) : +bar.min);
  }
  private orient() {
    const region = this.obs.region,
      s = this.obs.studioState;
    if (this.focus.boundary)
      return "Regional · PB2002 #" + this.focus.boundary + (s ? " › Anschauungsmodell" : "");
    const stored = this.currentPlace();
    const p =
      (region &&
      stored &&
      !(
        (stored.step && stored.step === region.spec.geology?.id) ||
        (stored.site && stored.site === region.spec.site)
      )
        ? undefined
        : stored) ?? (s && !s.interior ? places[referenceFor[s.models[0]]] : undefined);
    const path = p
      ? "Erde › " + p.space + " › " + p.name
      : "Erde" + (this.focus.space ? " › " + this.focus.space : "");
    if (s && s.models[0] === "wilson" && !s.interior) {
      const a = places[wilsonPlaces[Math.min(8, Math.floor(s.time * 8 + 0.0001))]];
      return "Erde › " + a.space + " › " + a.name + " · heutige Analogie";
    }
    if (s) return s.interior ? "Global · Struktur des Erdinneren" : path + " · idealisierter Schnitt";
    if (region) {
      if (region.spec.theme === "forces" || region.spec.theme === "lithosphere")
        return "Erde · allgemeines Anschauungsmodell";
      const name = p ? path : "Erde › " + region.spec.name;
      return (
        name +
        " · " +
        (region.localActive
          ? "lokaler Ausschnitt"
          : p?.bathy || region.spec.site
            ? "regionales Relief"
            : "idealisierter Schnitt")
      );
    }
    if (this.focus.country && this.focus.overview) return "Erde › Europa › Deutschland · National";
    if (this.focus.overview)
      return (
        path +
        " · " +
        (p
          ? "Regional"
          : this.focus.space
            ? isContinent(this.focus.space)
              ? "Kontinental"
              : "Großraum"
            : "Global")
      );
    if (this.obs.mode === "time")
      return (
        "Erde · Global · " + (this.obs.timeState?.model === "past" ? "Rekonstruktion" : "Zukunftsszenario")
      );
    if (this.world.mode === "nyos") return "Afrika › Kamerun › Nyos-See · Lokal";
    if (this.world.mode === "place") return "Erde › Deutschland › " + this.world.region.name + " · Lokal";
    return this.obs.atlasState ? "Erde · Global · Forschungsatlas" : "Erde · Global";
  }
  private drawMarkers() {
    const show = this.focus.overview && this.obs.mode === "map" && !this.obs.atlasState,
      nav = this.world.nav,
      canvas = el("earth");
    const key = [
      show,
      this.focus.space,
      this.focus.country,
      this.depth,
      canvas.clientWidth,
      canvas.clientHeight,
      ...nav.camera.matrixWorld.elements,
    ].join("|");
    if (key === this.pinKey) return;
    this.pinKey = key;
    const used: { x: number; y: number }[] = [];
    for (const { place: p, id, button: b } of this.markers) {
      const point = position(p.lat, p.lon, 40),
        screen = show ? project(point, nav.camera, canvas.clientWidth, canvas.clientHeight) : null;
      const visible =
        !this.focus.country &&
        screen &&
        point.dot(nav.camera.position) > R * R &&
        (!this.focus.space || this.focus.space === p.space) &&
        !used.some((q) => Math.abs(q.x - screen.x) < 110 && Math.abs(q.y - screen.y) < 38);
      b.hidden = !visible;
      if (!visible || !screen) continue;
      used.push(screen);
      b.style.left = screen.x + "px";
      b.style.top = screen.y + "px";
      const arrow = b.firstElementChild as HTMLElement,
        step = p.step && this.obs.maps.steps[p.step - 1];
      const named = this.depth !== "observe";
      text(
        b.lastElementChild as HTMLElement,
        named ? (nav.pose.d > 6500 ? processes[p.model] : p.name) : "Ort",
      );
      b.title = named ? p.name : "Ort";
      b.setAttribute("aria-label", b.title);
      if (step) {
        const az = (step[8] * Math.PI) / 180,
          target = position(
            p.lat + 0.1 * Math.cos(az),
            p.lon + (0.1 * Math.sin(az)) / Math.max(0.03, Math.cos((p.lat * Math.PI) / 180)),
            40,
          );
        const to = project(target, nav.camera, canvas.clientWidth, canvas.clientHeight);
        if (to) {
          arrow.style.transform = "rotate(" + Math.atan2(to.y - screen.y, to.x - screen.x) + "rad)";
        }
      }
      arrow.hidden = !step || this.depth === "observe";
      b.classList.toggle("selected", this.focus.place === id);
    }
  }
  update(now: number) {
    if (this.flight && !this.world.nav.flight) {
      const done = this.flight;
      this.flight = undefined;
      done();
    }
    if (now - this.lastTick < 70) return;
    this.lastTick = now;
    if (this.observation.active !== (this.depth === "observe")) {
      this.depth = this.observation.active ? "observe" : "terms";
      document.body.dataset.infoDepth = this.depth;
    }
    this.drawMarkers();
    const side = el("sidebar"),
      r = this.obs.region;
    const state = [
      this.obs.subject,
      this.depth,
      this.history.length,
      !!this.flight,
      this.focus.place,
      this.focus.space,
      this.focus.country,
      !!this.obs.atlasState,
      r?.ready,
      r?.localStill,
      document.body.dataset.reveal,
    ].join("/");
    if (this.signature !== state || this.root !== side.firstChild) {
      this.signature = state;
      this.root = side.firstChild;
      const first = (ids: string[]) => ids.map(optional).find((b) => b && !b.disabled) ?? undefined;
      this.play = first(["g-play", "g-time-play", "nyos-play", "atlasPlay", "playProcess"]);
      this.source = first(["g-progress", "g-year"]) as unknown as HTMLInputElement | undefined;
      this.step = first(["g-step", "pair-step"]);
      this.reset = first(["g-reset", "nyos-reset"]);
      const seek =
        !!this.source || (!!this.play && (this.world.mode === "nyos" || !!this.world.mosaic?.pair));
      const p = this.currentPlace(),
        s = this.obs.studioState;
      for (const [id, show] of Object.entries({
        play: !!this.play,
        step: !!this.step || seek,
        time: seek,
        reset: !!this.reset || seek,
        back: this.history.length > 0,
        skip: !!this.flight,
        land: !!p && (p.bathy || p.site) && this.focus.overview,
        section: !!p && !s && !this.flight,
        return:
          (!!s && !s.interior) ||
          (!!r && r.spec.theme !== "forces" && r.spec.theme !== "lithosphere" && !this.currentPlace()),
        release:
          this.depth === "observe" &&
          (!!s ||
            !!r ||
            this.world.mode === "inside" ||
            this.world.mode === "nyos" ||
            this.obs.mode === "time"),
        clear: this.depth === "observe" && document.body.classList.contains("show-some-labels"),
        tools: !side.hidden && this.depth !== "observe",
        preset: !!el("studio-preset") && this.depth !== "observe",
      }))
        el("geo-" + id).hidden = !show;
      const bar = el<HTMLInputElement>("geo-time");
      bar.min = this.source?.min || "0";
      bar.max = this.source?.max || "1";
      bar.step = this.source?.step || ".001";
      el<HTMLSelectElement>("geo-info").value = this.depth;
      const src = el<HTMLSelectElement>("studio-preset"),
        preset = el<HTMLSelectElement>("geo-preset");
      if (src) {
        preset.replaceChildren(...Array.from(src.options, (o) => o.cloneNode(true)));
        preset.value = src.value;
      }
      if (this.obs.mode === "map" && this.focus.overview && !this.obs.atlasState)
        el("geo-tools").hidden = true;
    }
    const orientation = this.orient();
    text(
      el("geo-crumb"),
      this.depth === "observe"
        ? this.currentPlace()
          ? "Erde › " + this.currentPlace()!.space
          : "Erde"
        : orientation,
    );
    const note = el("geo-model-limit");
    const limit =
      this.focus.overview && !this.focus.country && this.obs.mode === "map" && !this.obs.atlasState
        ? "Heute gleichzeitig · Pfeile: relative Bewegungsrichtung nach PB2002 · unterschiedliche natürliche Geschwindigkeiten"
        : this.obs.atlasState?.layers.some((k) => k === "age" || k === "magnetic")
          ? "Ozeanbodenalter und Magnetik · globales 1°-Raster · räumliche Auflösung bleibt beim Zoomen gleich"
          : this.obs.studioState?.models.includes("hotspot")
            ? "Modellannahme · Lage und Tiefe der langlebigen Quelle sind nur indirekt erschlossen."
            : this.obs.studioState && this.obs.studioState.models.length > 1
              ? "Gemeinsame Modellphase · natürliche Prozessdauern unterscheiden sich."
              : "";
    note.hidden = !limit || this.depth === "observe";
    if (!note.hidden) text(note, limit);
    if (this.play) {
      const paused = !/Pause|Anhalten/.test(this.play.textContent || "");
      text(el("geo-play"), paused ? "Abspielen" : "Pause");
    }
    const bar = el<HTMLInputElement>("geo-time");
    if (!bar.hidden && bar !== document.activeElement) {
      const value =
        this.source?.value ??
        String(
          this.world.mode === "nyos" ? this.world.nyosLesson.progress : (this.world.mosaic?.progress ?? 0),
        );
      if (bar.value !== value) bar.value = value;
    }
  }
}
