import * as T from "three";
import "@fontsource-variable/dm-sans/wght.css";
import "./preview.css";
import { HOME } from "../camera";
import { position, R } from "../geo";
import { World } from "../world";
import {
  arrowPoints,
  center,
  kindName,
  loadAtlas,
  names,
  regions,
  typeOf,
  type Step,
} from "./atlas";
import { regionalImagery } from "./imagery";
import sites from "./labels.json";
import sourcesUrl from "../../docs/g2a-platten.md?url";
(document.querySelector("#sources") as HTMLAnchorElement).href = sourcesUrl;

const el = <K extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as K;
const checked = (id: string) => el<HTMLInputElement>(id).checked;
const front = (point: T.Vector3, camera: T.Camera) =>
  point.dot(camera.position) > point.lengthSq();
const decimal = (n: number, digits: number) =>
  n.toLocaleString("de-DE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
const major = [
  "PA",
  "EU",
  "NA",
  "SA",
  "AF",
  "AN",
  "AU",
  "IN",
  "NZ",
  "AR",
  "SO",
  "PS",
  "CA",
  "CO",
  "OK",
];
type Region = keyof typeof regions;
// For regional scales the worldwide label sites often fall outside the view.
// Each replacement lies within the corresponding PB2002 polygon.
const regionalLabels: Record<Region, Record<string, T.Vector3>> = {
  island: { EU: position(63.88, -18.65, 18), NA: position(64.55, -24.7, 18) },
  japan: { PA: position(38.18, 146.15, 18), OK: position(38.7, 141.55, 18) },
  san: { NA: position(36.5, -118.75, 18), PA: position(35.3, -122, 18) },
};
async function boot() {
  const canvas = el<HTMLCanvasElement>("earth");
  const world = new World(
    canvas,
    (message) => (el("state").textContent = message),
  );
  const [atlas, imagery] = await Promise.all([
    loadAtlas(),
    regionalImagery(),
    world.init(),
  ]);
  world.scene.add(imagery, atlas.areas, atlas.lines);
  const points = atlas.steps.map((step) => {
    const { lat, lon } = center(step);
    return position(lat, lon).normalize();
  });
  let active: Step | undefined;
  let region: Region | undefined;
  let projectedArrow: T.Vector3[] = [];
  const layer = el("layer") as HTMLInputElement;
  const buttons = document.querySelectorAll<HTMLButtonElement>("[data-site]");
  const vector = document.getElementById("vector")!;
  const vectorGroup = vector.querySelector("g")!;
  const labelLayer = el("placeLabels");
  const labels = Object.entries(sites)
    .sort(([a], [b]) => {
      const rank = (code: string) =>
        major.includes(code) ? major.indexOf(code) : 100;
      return rank(a) - rank(b);
    })
    .map(([code, [lon, lat]]) => {
      const label = document.createElement("span");
      label.textContent = names[code];
      label.hidden = true;
      labelLayer.append(label);
      return { code, label, p: position(lat, lon, 18) };
    });

  function controls() {
    el<HTMLFieldSetElement>("controls").disabled = !layer.checked;
    atlas.areas.visible = layer.checked && checked("areas");
    atlas.lines.visible = layer.checked && checked("bounds");
    labelLayer.hidden = !layer.checked || !checked("names");
    el("key").hidden = !atlas.lines.visible;
    for (const button of buttons)
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.site === (region ?? (active ? "" : "world"))),
      );
    const card = el("region");
    if (!layer.checked) {
      card.innerHTML =
        "<h2>Erdoberfläche</h2><p>Vergleiche die Lage von Küsten und Ozeanbecken mit der Plattenkarte.</p>";
    } else if (!active) {
      card.innerHTML =
        "<h2>Grenze untersuchen</h2><p>Tippe eine Grenze auf dem Globus an oder wähle einen der drei Orte. Welche Bewegung erwartest du hier?</p>";
    } else {
      const [id, pair, kind] = active;
      const { lat, lon } = center(active);
      const left = names[pair.slice(0, 2)],
        right = names[pair.slice(3)];
      const site = region && regions[region];
      card.innerHTML = `<p class="coords">${decimal(Math.abs(lat), 2)}° ${lat >= 0 ? "N" : "S"} · ${decimal(Math.abs(lon), 2)}° ${lon >= 0 ? "O" : "W"}</p><h2>${site ? site.title : left + " / " + right}</h2><p class="kind ${typeOf(kind)}">${kindName[typeOf(kind)]} · ${kind}</p>
       ${checked("motion") ? `<p class="speed"><b>${decimal(active[7], 1)} mm/Jahr</b> · ${active[8]}°</p><p>${left} relativ zur festen Referenz <strong>${right}</strong>. Azimut ab geografisch Nord im Uhrzeigersinn.</p>` : ""}
       ${site ? `<p>${site.text}</p>` : ""}<small>PB2002 · Abschnitt ${id}. Lokaler Modellvektor. Pfeillänge symbolisch.</small>`;
    }
  }

  function select(step?: Step, site?: Region) {
    active = step;
    region = site;
    projectedArrow = step ? arrowPoints(step) : [];
    controls();
    paintOverlay();
  }

  function paintOverlay() {
    world.nav.goal.d = Math.max(650, world.nav.goal.d);
    const camera = world.nav.camera;
    const w = canvas.clientWidth,
      h = canvas.clientHeight;
    const project = (p: T.Vector3) => {
      const v = p.clone().project(camera);
      return { x: ((v.x + 1) * w) / 2, y: ((1 - v.y) * h) / 2 };
    };
    const showArrow =
      layer.checked &&
      checked("motion") &&
      projectedArrow.length &&
      front(projectedArrow[0], camera);
    vector.style.display = showArrow ? "block" : "none";
    if (showArrow) {
      const [a, b] = projectedArrow.map(project);
      vectorGroup.setAttribute(
        "transform",
        `translate(${a.x} ${a.y}) rotate(${(Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI})`,
      );
    }
    if (labelLayer.hidden) return;
    const used: { x: number; y: number; width: number }[] = [];
    for (const { code, label, p: globalPoint } of labels) {
      const p =
        (region && world.nav.pose.d < 4000 && regionalLabels[region][code]) ||
        globalPoint;
      let visible =
        front(p, camera) && (major.includes(code) || world.nav.pose.d < 5000);
      const { x, y } = project(p);
      const width = names[code].length * 4.8 + 12;
      visible &&=
        x >= width &&
        x <= w - width &&
        y > 22 &&
        y < h - 65 &&
        !used.some(
          (other) =>
            Math.abs(other.y - y) < 27 &&
            Math.abs(other.x - x) < other.width + width,
        );
      label.hidden = !visible;
      if (visible) {
        label.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`;
        used.push({ x, y, width });
      }
    }
  }
  let lastPose = "";
  function redraw() {
    controls();
    lastPose = "";
    paintOverlay();
  }
  for (const id of ["layer", "areas", "bounds", "names", "motion"])
    el(id).onchange = redraw;
  for (const button of buttons)
    button.onclick = () => {
      const site = button.dataset.site as Region | "world";
      if (site === "world") {
        select();
        world.nav.fly(HOME);
        return;
      }
      const preset = regions[site],
        step = atlas.steps[preset.id - 1];
      select(step, site);
      world.nav.fly({ ...HOME, ...center(step), d: preset.distance });
    };
  world.nav.onPick = (x, y) => {
    if (!layer.checked || !atlas.lines.visible) return;
    const box = canvas.getBoundingClientRect();
    const ray = new T.Raycaster();
    ray.setFromCamera(
      new T.Vector2(
        ((x - box.x) / box.width) * 2 - 1,
        1 - ((y - box.y) / box.height) * 2,
      ),
      world.nav.camera,
    );
    const p = ray.ray.intersectSphere(
      new T.Sphere(new T.Vector3(), R + 15),
      new T.Vector3(),
    );
    if (!p) return;
    p.normalize();
    let best = -1,
      score = -1;
    points.forEach((v, i) => {
      const s = v.dot(p);
      if (s > score) {
        score = s;
        best = i;
      }
    });
    // Zoom-dependent tap target around each digitized step midpoint.
    if (
      best >= 0 &&
      Math.acos(Math.min(1, score)) * R < Math.max(55, world.nav.pose.d * 0.026)
    )
      select(atlas.steps[best]);
  };
  el("plus").onclick = () => world.nav.zoom(0.7);
  el("minus").onclick = () => world.nav.zoom(1 / 0.7);
  canvas.onkeydown = (event) => {
    if (event.key === "+" || event.key === "-")
      world.nav.zoom(event.key === "+" ? 0.7 : 1 / 0.7);
    else if (event.key.startsWith("Arrow"))
      world.nav.pan(
        event.key === "ArrowLeft" ? 50 : event.key === "ArrowRight" ? -50 : 0,
        event.key === "ArrowUp" ? 50 : event.key === "ArrowDown" ? -50 : 0,
      );
    else return;
    event.preventDefault();
  };
  el("full").onclick = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        el("state").textContent = "Präsentation im Browserfenster";
      }
  };
  document.onfullscreenchange = () => {
    el("full").textContent = document.fullscreenElement
      ? "Vollbild beenden"
      : "Präsentieren";
  };
  world.onFrame = () => {
    const q = world.nav.pose;
    const key = [
      q.lat,
      q.lon,
      q.d,
      q.bearing,
      q.tilt,
      canvas.clientWidth,
      canvas.clientHeight,
    ].join("/");
    if (lastPose !== key) {
      paintOverlay();
      lastPose = key;
    }
  };
  el("state").textContent = "52 Platten · 5.819 Grenzabschnitte";
  select();
  Object.defineProperty(window, "tectonicsAtlas", {
    value: () => ({
      ...world.diagnostics(),
      count: atlas.steps.length,
      selected: active?.[0],
      layer: layer.checked,
    }),
  });
}
void boot().catch(() => {
  el("state").textContent =
    "Die Vorschau benötigt WebGL 2 und die mitgelieferten Kartendaten. Bitte über START.command öffnen.";
  el<HTMLFieldSetElement>("controls").disabled = true;
});
