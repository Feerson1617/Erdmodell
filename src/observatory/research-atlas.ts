import * as T from "three";
import { R, RAD, position } from "../geo";
import { localAsset } from "../assets";
import areasUrl from "../tectonics/plates.png";
import { names, type Step, typeOf } from "../tectonics/atlas";
import fields from "./pb-fields.json";
import { type MapLayers } from "./globe";
import {
  atlasLayers,
  degree,
  gridValue,
  kinematics,
  loadResearch,
  pointColor,
  type AtlasPoint,
  type Layer,
} from "./research-data";

import { OceanProfile, type GeoPoint } from "./ocean-profile";

type AtlasData = Awaited<ReturnType<typeof loadResearch>>;
export type ResearchState = {
  layers: Layer[];
  flat: boolean;
  magnitude: number;
  depth: number;
  year?: number;
  base?: "earth" | "relief" | "bathy";
  profile?: GeoPoint[];
  selected?: GeoPoint;
};
const w = 1440,
  h = 720,
  codes = Object.keys(names).sort();
const layerLegend: Record<Layer, string> = {
  plates: "Transparente Flächen · PB2002 · 52 modellierte Platten, vereinfachte Grenzen",
  bounds: "Türkis · Divergenz, Orange · Konvergenz, Violett · Transformstörung",
  vectors:
    "Gelbe Pfeile · modellierte Bewegung der linken relativ zur rechten Platte nach PB2002. Räumlich ausgedünnte Auswahl realer Abschnitte.",
  quakes: "USGS · 697 Erdbeben ab Magnitude 6, 2019–2023",
  depth: "Gelb <70 km · Orange 70 bis <300 km · Violett ab 300 km",
  magnitude: "Größere Kreise kennzeichnen größere Katalogmagnituden",
  volcano: "Korallenrot · 1.609 Vulkanstandorte im NOAA-Katalog",
  hotspot: "Gold · Hawaii und Island, regionale Auswahl",
  ridge: "Türkis · ozeanische Spreizungsgrenzen nach PB2002",
  trench: "Hellorange · Subduktionsfronten nach PB2002, angenäherter Grabenverlauf",
  mountain: "Sandfarben · Grenzabschnitte in breiten Deformationsgürteln nach Bird",
  age: "Rekonstruiertes Meeresbodenalter (EarthByte) in Millionen Jahren · <10 Rot, <40 Orange, <80 Ocker, <120 Grün, <160 Türkis, ab 160 Blau. Globales 1°-Raster, beim Zoomen unverändert. Ohne Modellwert transparent.",
  magnetic:
    "NOAA EMAG2v3 · aus Messungen abgeleitete magnetische Anomalie auf Meeresniveau. Rot positiv, Blau negativ, Deckkraft nach Betrag. Globale 1°-Rasterzellen, Einzelwerte per Klick. Lokale Magnetstreifen sind bei dieser Auflösung nicht auflösbar.",
  gnss: "Mintgrün · horizontale GNSS-Geschwindigkeiten, NGL MIDAS im globalen Rahmen IGS14",
  ice: "Eisblau · drei Becken mit glazialen Sedimenten des späten Paläozoikums, heutige Lage",
  fossil: "Hellgrün · zwei Mesosaurus-Fundregionen",
  rock: "Rosa · Appalachen und Highlands, Vergleichsregionen",
};
const imageFrom = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(Error("Kartentextur fehlt"));
    i.src = url;
  });
const xy = (lat: number, lon: number): [number, number] => [((lon + 180) * w) / 360, ((90 - lat) * h) / 180];
const decimal = (v: number, n = 1) => v.toLocaleString("de-DE", { maximumFractionDigits: n });
const colors = ["#ec716d", "#f0a76a", "#e5cc83", "#abd39b", "#54b4b8", "#5d8fc6"];
const makeCanvas = (width: number, height: number) => {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return c;
};

export class ResearchAtlas {
  readonly canvas = makeCanvas(w, h);
  readonly plane = document.createElement("div");
  private readonly overlay = makeCanvas(w, h);
  private readonly texture = new T.CanvasTexture(this.overlay);
  readonly globe = new T.Mesh(
    new T.SphereGeometry(R + 18, 160, 96).rotateY(-Math.PI / 2),
    new T.MeshBasicMaterial({ map: this.texture, transparent: true, depthWrite: false, toneMapped: false }),
  );
  state: ResearchState = { layers: ["bounds"], flat: false, magnitude: 6, depth: 750 };
  private plateColor = makeCanvas(w, h);
  private plateIds?: Uint8ClampedArray;
  private basemaps?: Record<"earth" | "relief" | "bathy", HTMLImageElement>;
  private background?: HTMLImageElement;
  private data?: AtlasData;
  private profile = new OceanProfile(() => {
    this.state.profile = this.profile.endpoints;
    this.render();
  });
  private tolerance=5;
  private reading?: HTMLElement;
  private rendering = false;
  constructor(
    private maps: MapLayers,
    view: HTMLElement,
    private selectStep: (step: Step) => void,
    private orient: (p:GeoPoint) => void,
    private openProcess: (step:Step) => void,
  ) {
    this.texture.colorSpace = T.SRGBColorSpace;
    this.globe.renderOrder = 4;
    this.globe.name = "Wissenschaftlicher Atlas";
    this.plane.className = "research-map-plane";
    this.plane.hidden = true;
    this.canvas.setAttribute(
      "aria-label",
      "Weltkarte in geografischen Koordinaten. Ein Klick liest die sichtbaren Datenebenen aus.",
    );
    this.plane.append(this.canvas);
    view.append(this.plane);
    this.canvas.onclick = (e) => {
      const b = this.canvas.getBoundingClientRect();
      this.pickAt(90 - ((e.clientY - b.y) * 180) / b.height, ((e.clientX - b.x) * 360) / b.width - 180, 5);
    };
  }
  async init() {
    const [data, basemap, index, relief, bathy] = await Promise.all([
      loadResearch(this.maps),
      imageFrom(localAsset("data/earth-atlas.webp")),
      imageFrom(areasUrl),
      imageFrom(localAsset("data/g64/relief.webp")),
      imageFrom(localAsset("data/g64/bathy.webp")),
    ]);
    if (!this.plane.isConnected) return;
    this.data = data;
    this.basemaps = {earth: basemap, relief, bathy};
    this.background = basemap;
    this.profile.setData(data);
    if (this.state.profile) this.profile.restore(this.state.profile);
    const c = this.plateColor.getContext("2d", { willReadFrequently: true })!;
    c.imageSmoothingEnabled = false;
    c.drawImage(index, 0, 0, w, h);
    const rgba = c.getImageData(0, 0, w, h);
    this.plateIds = rgba.data.slice();
    const palette = codes.map((_, i) =>
      new T.Color().setHSL((i * 0.618) % 1, 0.55, 0.55, T.SRGBColorSpace).getHex(),
    );
    for (let i = 0; i < rgba.data.length; i += 4) {
      const v = rgba.data[i],
        rgb = palette[v - 1] ?? 0;
      rgba.data[i] = rgb >> 16;
      rgba.data[i + 1] = (rgb >> 8) & 255;
      rgba.data[i + 2] = rgb & 255;
      rgba.data[i + 3] = v ? 112 : 0;
    }
    c.putImageData(rgba, 0, 0);
    this.render();
  }
  dispose() {
    this.plane.parentElement?.classList.remove("research-flat");
    this.plane.remove();
    this.globe.removeFromParent();
    this.globe.geometry.dispose();
    this.globe.material.dispose();
    this.texture.dispose();
  }
  private visible(point: AtlasPoint) {
    return (
      (this.state.layers.includes(point.layer) ||
        (point.layer === "quakes" && this.state.layers.some((id) => id === "depth" || id === "magnitude"))) &&
      (point.layer !== "quakes" ||
        (point.magnitude! >= this.state.magnitude && point.depth! <= this.state.depth && (!this.state.year || this.state.year === point.year)))
    );
  }
  private features(step: Step) {
    const l = this.state.layers;
    return l.includes("ridge") && step[2] === "OSR"
      ? "#80f5e1"
      : l.includes("trench") && step[2] === "SUB"
        ? "#ffe0b0"
        : l.includes("mountain") && fields[step[0] - 1][5]
          ? "#ffdb92"
          : l.includes("bounds")
            ? ({ divergent: "#7edbce", convergent: "#ee976d", transform: "#c09be8" } as const)[
                typeOf(step[2])
              ]
            : undefined;
  }
  mount(parent: HTMLElement) {
    this.rendering = true;
    parent.innerHTML =
      '<p class="g-kicker">Plattentektonik</p><h1>Forschungsatlas</h1><div class="g-stack"><label>Darstellung<select id="research-projection"><option value="globe">Globus</option><option value="map">Weltkarte · 2D</option></select></label><label>Grundkarte<select id="research-base"><option value="earth">Satellitenbild</option><option value="relief">Physisches Relief</option><option value="bathy">Meerestiefe</option></select></label><details id="research-options"><summary>Datenebenen</summary><div id="research-layers"></div></details><div id="research-filter"></div><div id="research-reading" aria-live="polite"></div><details><summary>Legende und Herkunft</summary><div id="research-legend"></div></details><button id="research-back">Zur Grenzübersicht</button></div>';
    const projection = parent.querySelector<HTMLSelectElement>("#research-projection")!;
    projection.value = this.state.flat ? "map" : "globe";
    projection.onchange = () => {
      this.state.flat = projection.value === "map";
      if (!this.state.flat && this.state.selected) this.orient(this.state.selected);
      this.render();
    };
    const base = parent.querySelector<HTMLSelectElement>("#research-base")!;
    base.value = this.state.base ?? "earth";
    base.onchange = () => { this.state.base = base.value as ResearchState["base"]; legendAndFilters(); this.render(); };
    const layers = parent.querySelector("#research-layers")!,
      legend = parent.querySelector("#research-legend")!,
      filter = parent.querySelector("#research-filter")!;
    this.reading = parent.querySelector("#research-reading")!;
    const legendAndFilters = () => {
      legend.replaceChildren();
      filter.replaceChildren();
      for (const layer of this.state.layers) {
        const p = document.createElement("p");
        p.textContent = layerLegend[layer];
        legend.append(p);
      }
      const baseKey = this.state.base ?? "earth";
      if (baseKey !== "earth") {
        const key = document.createElement("p");
        key.textContent = baseKey === "bathy" ? "Helle Küstenschelfe · Petrol bis 1 km, Blau bis 3,5 km, Dunkelblau ab 6 km Tiefe. Georeferenziertes Relief, 0,5°." : "Grüne Tiefländer, ockerfarbene Hochlagen und helle Gipfel. Tiefen und Höhen aus dem globalen 0,5°-Raster.";
        legend.prepend(key);
      }
      const source = document.createElement("a");
      source.href = localAsset("licenses/G6.4-Forschungsatlas.txt");
      source.target = "_blank";
      source.rel = "noopener";
      source.textContent = "Datenquellen und Nutzungshinweise (offline)";
      legend.append(source);
      if (this.state.layers.includes("vectors") || this.state.layers.includes("gnss")) {
        const p = document.createElement("p");
        p.textContent =
          "Gleiche Geschwindigkeit ergibt gleiche geodätische Pfeillänge. 50 mm/Jahr entsprechen zur Darstellung 400 km auf der Karte. Die Kartenprojektion dehnt Strecken polwärts.";
        legend.append(p);
      }
      if (this.state.layers.some((id) => id === "quakes" || id === "depth" || id === "magnitude"))
        for (const [key, label, values] of [
          ["year", "Katalogjahr", [0, 2019, 2020, 2021, 2022, 2023]],
          ["magnitude", "Mindestmagnitude", [6, 7, 8]],
          ["depth", "Herdtiefe bis (km)", [70, 300, 750]],
        ] as const) {
          const box = document.createElement("label"),
            select = document.createElement("select");
          box.textContent = label;
          select.setAttribute("aria-label", label);
          for (const value of values) select.add(new Option(value ? String(value) : "Alle Jahre", String(value)));
          select.value = String(this.state[key] ?? 0);
          select.onchange = () => {
            this.state[key] = Number(select.value);
            this.render();
          };
          box.append(select);
          filter.append(box);
        }
    };
    const groups: [string, Layer[]][] = [
      ["Platten und Bewegung", ["plates","bounds","vectors","gnss"]],
      ["Erdbeben und Vulkanismus", ["quakes","depth","magnitude","volcano","hotspot"]],
      ["Relief und Ozeanboden", ["ridge","trench","mountain","age","magnetic"]],
      ["Kontinentaldrift", ["fossil","rock","ice"]],
    ];
    for (const [name, ids] of groups) {
      const group = document.createElement("fieldset");
      const title = document.createElement("legend");
      title.textContent = name; group.append(title); layers.append(group);
      for (const id of ids) {
      const label = atlasLayers[id];
      const layer = id as Layer,
        box = document.createElement("label"),
        input = document.createElement("input");
      input.type = "checkbox";
      input.value = id;
      input.checked = this.state.layers.includes(layer);
      input.onchange = () => {
        this.state.layers = this.state.layers.filter((v) => v !== layer);
        if (input.checked) this.state.layers.push(layer);
        legendAndFilters();
        this.render();
      };
      box.append(input, document.createTextNode(" " + label));
      group.append(box);
      }
    }
    this.profile.mount(parent.querySelector(".g-stack")!);
    legendAndFilters();
    this.render();
  }
  private render() {
    if (!this.rendering) return;
    this.globe.visible = !this.state.flat;
    this.plane.hidden = !this.state.flat;
    this.plane.parentElement?.classList.toggle("research-flat", this.state.flat);
    const d = this.data,
      c = this.overlay.getContext("2d")!;
    c.clearRect(0, 0, w, h);
    if (!d || !this.background) {
      if (this.reading) this.reading.textContent = "Lokale Daten werden geladen …";
      return;
    }
    const layers = new Set(this.state.layers);
    if (this.state.base && this.state.base !== "earth") c.drawImage(this.basemaps![this.state.base], 0, 0, w, h);
    if (layers.has("plates")) c.drawImage(this.plateColor, 0, 0);
    if (layers.has("age")) {
      c.globalAlpha = 0.73;
      for (let i = 0; i < d.age.length; i++) {
        if (d.age[i] === -32768) continue;
        const age = d.age[i] * 0.01 + 100;
        const x = (i % 360) * 4 - 2,
          y = Math.floor(i / 360) * 4 - 2;
        c.fillStyle = colors[age < 10 ? 0 : age < 40 ? 1 : age < 80 ? 2 : age < 120 ? 3 : age < 160 ? 4 : 5];
        c.fillRect(x, y, 4, 4);
        if (x < 0) c.fillRect(x + w, y, 4, 4);
      }
      c.globalAlpha = 1;
    }
    if (layers.has("magnetic"))
      for (let lat = -89; lat <= 89; lat++)
        for (let lon = -180; lon < 180; lon++) {
          const mag = gridValue(d.magnetic, lat, lon, 0.2, 800);
          if (mag === undefined || Math.abs(mag) < 0.1) continue;
          const [x, y] = xy(lat, lon);
          c.fillStyle = mag > 0 ? "#ff8375" : "#8bbaff";
          c.globalAlpha = Math.min(.85,.14+Math.sqrt(Math.abs(mag))*.055);
          c.fillRect(x-2,y-2,4,4);
          c.globalAlpha=1;
        }
    const line = (x: number, y: number, dx: number, dy: number) => {
      for (const off of [0, dx > 0 ? -w : w]) {
        c.beginPath();
        c.moveTo(x + off, y);
        c.lineTo(x + off + dx, y + dy);
        c.stroke();
      }
    };
    for (const s of this.maps.steps) {
      const col = this.features(s);
      if (!col) continue;
      c.strokeStyle = col;
      c.lineWidth = 2.5;
      const [x, y] = xy(s[4], s[3]);
      line(x, y, (((s[5] - s[3] + 540) % 360) - 180) * 4, (s[4] - s[6]) * 4);
    }
    for (const p of d.points) {
      if (!this.visible(p)) continue;
      const [x, y] = xy(p.lat, p.lon);
      c.fillStyle = pointColor(p, layers.has("depth"));
      c.strokeStyle = "#1c2d34";
      c.lineWidth = 0.85;
      c.beginPath();
      c.arc(
        x,
        y,
        p.layer === "quakes" && layers.has("magnitude")
          ? 2 + (p.magnitude! - 6) * 2.2
          : p.layer === "volcano"
            ? 2.1
            : 3.2,
        0,
        2 * Math.PI,
      );
      c.fill();
      c.stroke();
      if (p.azimuth === undefined || p.speed === undefined) continue;
      const a = p.azimuth * RAD,
        dist = (p.speed * 8) / R,
        lat = p.lat * RAD;
      const end = Math.asin(Math.sin(lat) * Math.cos(dist) + Math.cos(lat) * Math.sin(dist) * Math.cos(a));
      const dx =
          (Math.atan2(
            Math.sin(a) * Math.sin(dist) * Math.cos(lat),
            Math.cos(dist) - Math.sin(lat) * Math.sin(end),
          ) /
            RAD) *
          4,
        dy = (p.lat - end / RAD) * 4;
      c.strokeStyle = c.fillStyle;
      c.lineWidth = 2;
      line(x, y, dx, dy);
      const heading = Math.atan2(dy, dx),
        head = Math.min(6, Math.hypot(dx, dy) * 0.42);
      for (const sign of [-1, 1])
        line(
          x + dx,
          y + dy,
          -head * Math.cos(heading + sign * 0.48),
          -head * Math.sin(heading + sign * 0.48),
        );
    }
    const samples = this.profile.samples;
    c.strokeStyle = "#ffffff";
    c.lineWidth = 3;
    c.setLineDash([8, 4]);
    for (let i = 1; i < samples.length; i++) {
      const previous = samples[i - 1],
        next = samples[i],
        [x, y] = xy(previous.lat, previous.lon);
      line(x, y, (((next.lon - previous.lon + 540) % 360) - 180) * 4, (previous.lat - next.lat) * 4);
    }
    c.setLineDash([]);
    c.font = "bold 19px system-ui";
    c.lineWidth = 3;
    this.profile.endpoints.forEach((p, i) => {
      const [x, y] = xy(p.lat, p.lon);
      c.strokeStyle = "#132825";
      c.fillStyle = "#fff";
      c.beginPath();
      c.arc(x, y, 5, 0, 2 * Math.PI);
      c.fill();
      c.stroke();
      c.strokeText(i ? "B" : "A", x + 6, y - 6);
      c.fillText(i ? "B" : "A", x + 6, y - 6);
    });
    if(this.state.selected){
      const [sx,sy]=xy(this.state.selected.lat,this.state.selected.lon);
      for(const off of [-w,0,w]){
        c.beginPath();c.arc(sx+off,sy,8,0,2*Math.PI);
        c.lineWidth=4;c.strokeStyle="#233439";c.stroke();c.lineWidth=1.5;c.strokeStyle="#fff";c.stroke();
      }
    }
    this.texture.needsUpdate = true;
    if (this.state.flat) {
      const flat = this.canvas.getContext("2d")!;
      flat.drawImage(this.background, 0, 0, w, h);
      flat.drawImage(this.overlay, 0, 0);
    }
    if (this.state.selected) this.inspect(this.state.selected.lat, this.state.selected.lon, this.tolerance);
    else if (this.reading)
      this.reading.textContent = "Ein Klick auf die Karte zeigt die verfügbaren Werte am Ort.";
  }
  pickAt(lat: number, lon: number, tolerance: number) {
    if (!this.profile.take({ lat, lon })) {this.state.selected={lat,lon};this.tolerance=tolerance;this.render();}
  }
  private inspect(lat: number, lon: number, tolerance: number) {
    const d = this.data;
    if (!d || !this.reading) return;

    let selected: Step | undefined;
    const l = new Set(this.state.layers),
      parts = [
        `${decimal(Math.abs(lat))}° ${lat < 0 ? "S" : "N"} · ${decimal(Math.abs(lon))}° ${lon < 0 ? "W" : "O"}`,
      ];
    if (l.has("plates") && this.plateIds) {
      const [x, y] = xy(lat, lon),
        id =
          this.plateIds[
            (Math.min(h - 1, Math.max(0, Math.floor(y))) * w + (((Math.floor(x) % w) + w) % w)) * 4
          ];
      if (id) parts.push(names[codes[id - 1]]);
    }
    for (const [key, unit, scale, offset] of [
      ["age", "Mio. Jahre", 0.01, 100],
      ["magnetic", "nT", 0.2, 800],
    ] as const) {
      if (!l.has(key)) continue;
      const val = gridValue(d[key], lat, lon, scale, offset);
      parts.push(atlasLayers[key] + " · 1°-Raster · " + (val === undefined ? "ohne Daten" : decimal(val) + " " + unit));
    }
    if (["bounds", "ridge", "trench", "mountain"].some((k) => l.has(k as Layer))) {
      const step = this.maps.nearestStep(
        position(lat, lon).normalize(),
        2 * Math.sin((Math.min(2, tolerance) * RAD) / 2),
        (s) => Boolean(this.features(s)),
      );
      if (step) {
        const k = kinematics(step, 1);
        parts.push(
          "PB2002 #" + step[0] + " · " + k.pair + " · " + decimal(k.speed) + " mm/Jahr · " + k.azimuth + "°",
        );
        this.selectStep(step); selected=step;
      }
    }
    const nearby = d.points
      .filter((p) => this.visible(p))
      .map((p) => ({
        p,
        dist: Math.hypot(lat - p.lat, (degree(lon - p.lon + 180) - 180) * Math.cos(lat * RAD)),
      }))
      .filter((r) => r.dist <= tolerance)
      .sort((a, b) => a.dist - b.dist);
    for (const { p } of nearby.slice(0, 3)) parts.push(p.title + " · " + p.detail);
    this.reading.replaceChildren(
      ...parts.map((v) => {
        const p = document.createElement("p");
        p.textContent = v;
        return p;
      }),
    );
    if (selected) {
      const step=selected, button=document.createElement("button");
      button.id="research-process";button.textContent="Prozess dieses Grenzabschnitts öffnen";
      button.onclick=()=>this.openProcess(step); this.reading.append(button);
    }
  }
}
