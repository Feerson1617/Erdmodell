import { enlargeFigure } from "./research-figure";
import { Vector3 } from "three";
import { R, RAD, position } from "../geo";
import { gridValue } from "./research-data";

export type GeoPoint = { lat: number; lon: number };
type Sample = GeoPoint & { km: number; age?: number; magnetic?: number };
const fmt = (v: number, n = 1) => v.toLocaleString("de-DE", { maximumFractionDigits: n });
const pointName = (p: GeoPoint) =>
  fmt(Math.abs(p.lat)) +
  "° " +
  (p.lat < 0 ? "S" : "N") +
  " · " +
  fmt(Math.abs(p.lon)) +
  "° " +
  (p.lon < 0 ? "W" : "O");

export function greatCircleProfile(
  a: GeoPoint,
  b: GeoPoint,
  age: Int16Array,
  magnetic: Int16Array,
): Sample[] {
  const start = position(a.lat, a.lon).normalize(),
    end = position(b.lat, b.lon).normalize();
  const angle = start.angleTo(end);
  if (angle < 1e-7 || Math.PI - angle < 1e-7) return [];
  const points: Sample[] = [],
    tangent = new Vector3().copy(end).addScaledVector(start, -Math.cos(angle)).normalize();
  const count = Math.max(2, Math.ceil((angle / RAD) * 2));
  for (let i = 0; i <= count; i++) {
    const dist = (angle * i) / count;
    const dir = start.clone().multiplyScalar(Math.cos(dist)).addScaledVector(tangent, Math.sin(dist));
    const lat = Math.asin(Math.max(-1, Math.min(1, dir.y))) / RAD,
      lon = Math.atan2(dir.x, dir.z) / RAD;
    points.push({
      lat,
      lon,
      km: R * dist,
      age: gridValue(age, lat, lon, 0.01, 100),
      magnetic: gridValue(magnetic, lat, lon, 0.2, 800),
    });
  }
  return points;
}

// Two stacked axes preserve the units and show data gaps along one great-circle transect.
export class OceanProfile {
  private capture = false;
  private start?: GeoPoint;
  private end?: GeoPoint;
  private panel?: HTMLDetailsElement;
  private message?: HTMLElement;
  private plot?: HTMLCanvasElement;
  private enlarge?: HTMLButtonElement;
  private pick?: HTMLButtonElement;
  private clear?: HTMLButtonElement;
  private data?: { age: Int16Array; magnetic: Int16Array };
  samples: Sample[] = [];
  get endpoints() {
    return [this.start, this.end].filter((p): p is GeoPoint => p !== undefined);
  }
  constructor(private changed: () => void) {}
  setData(data: { age: Int16Array; magnetic: Int16Array }) {
    this.data = data;
    this.update();
  }
  restore(points: GeoPoint[]) {
    [this.start, this.end] = points;
    this.capture = Boolean(this.start && !this.end);
    if (this.panel && this.start) this.panel.open = true;
    this.update();
  }
  mount(parent: HTMLElement) {
    const panel = document.createElement("details");
    this.panel = panel;
    panel.id = "research-profile";
    panel.innerHTML =
      "<summary>Ozeanbodenprofil messen</summary><p>Die Strecke folgt dem kürzeren Großkreisbogen. Alter und magnetische Anomalie stammen aus den lokalen GMT-Rastern.</p>";
    this.pick = document.createElement("button");
    this.clear = document.createElement("button");
    this.pick.id = "profile-start";
    this.clear.id = "profile-clear";
    this.clear.textContent = "Profil löschen";
    this.pick.onclick = () => {
      this.capture = true;
      this.start = undefined;
      this.end = undefined;
      this.update();
      this.changed();
    };
    this.clear.onclick = () => {
      this.capture = false;
      this.start = undefined;
      this.end = undefined;
      this.update();
      this.changed();
    };
    this.message = document.createElement("p");
    this.message.id = "profile-measured";
    this.message.setAttribute("aria-live", "polite");
    this.plot = document.createElement("canvas");
    this.plot.width = 680;
    this.plot.height = 330;
    this.plot.className = "research-rate-chart";
    this.plot.setAttribute("role", "img");
    this.plot.setAttribute("aria-label", "Alter und magnetische Anomalie entlang derselben Profilstrecke");
    this.enlarge = enlargeFigure("Ozeanbodenprofil", this.plot, this.message);
    panel.append(this.pick, this.clear, this.message, this.plot, this.enlarge);
    parent.append(panel);
    if (this.start) panel.open = true;
    this.update();
  }
  take(p: GeoPoint) {
    if (!this.capture || !this.data) return false;
    if (!this.start) this.start = p;
    else {
      this.end = p;
      this.capture = false;
    }
    this.update();
    this.changed();
    return true;
  }
  private update() {
    this.samples =
      this.start && this.end && this.data
        ? greatCircleProfile(this.start, this.end, this.data.age, this.data.magnetic)
        : [];
    if (!this.message || !this.plot || !this.pick || !this.clear) return;
    this.pick.disabled = !this.data;
    this.pick.textContent = this.start || this.capture ? "Profil neu wählen" : "Profilpunkte wählen";
    this.clear.hidden = !this.start && !this.capture;
    this.plot.hidden = !this.samples.length;
    if (this.enlarge) this.enlarge.hidden = this.plot.hidden;
    if (!this.start) {
      this.message.textContent = this.capture ? "Ersten Punkt auf dem Globus oder der Weltkarte wählen." : "";
      return;
    }
    if (!this.end) {
      this.message.textContent = "A · " + pointName(this.start) + ". Zweiten Punkt wählen.";
      return;
    }
    if (!this.samples.length) {
      this.message.textContent = "Für diese Punkte ist kein eindeutiger Profilbogen bestimmbar.";
      return;
    }
    const first = this.samples[0],
      last = this.samples[this.samples.length - 1];
    const lines = [
      "A · " + pointName(first) + " → B · " + pointName(last),
      "Strecke " + fmt(last.km, 0) + " km",
    ];
    for (const [label, s] of [
      ["A", first],
      ["B", last],
    ] as const)
      lines.push(
        label + " · " + (s.age === undefined ? "ohne modelliertes Krustenalter" : fmt(s.age) + " Mio. Jahre"),
      );
    if (
      first.age !== undefined &&
      last.age !== undefined &&
      Math.abs(last.age - first.age) >= 1 &&
      this.samples.every((s) => s.age !== undefined)
    ) {
      const elapsed = Math.abs(last.age - first.age),
        ratio = last.km / elapsed;
      const sign = Math.sign(last.age - first.age);
      const oneFlank = this.samples.every(
        (s, i) => i === 0 || sign * (s.age! - this.samples[i - 1].age!) >= -1,
      );
      lines.push("Altersunterschied " + fmt(elapsed) + " Mio. Jahre");
      if (oneFlank)
        lines.push(
          "Weg / Altersunterschied ≈ " +
            fmt(ratio) +
            " mm/Jahr. Als mittlere Halbspreizungsrate nur bei einem Profil auf derselben Rückenflanke, senkrecht zu den Isochronen, interpretierbar.",
        );
      else
        lines.push(
          "Das Altersprofil kehrt seine Richtung um. Über diese Strecke lässt sich keine einzelne Halbspreizungsrate ableiten.",
        );
    }
    this.message.textContent = lines.join(" · ");
    const c = this.plot.getContext("2d")!,
      w = this.plot.width,
      x0 = 72,
      x1 = w - 18,
      pane = 85;
    c.clearRect(0, 0, w, this.plot.height);
    c.font = "18px system-ui";
    c.textBaseline = "middle";
    c.textAlign = "left";
    for (const [j, key, title, color] of [
      [0, "age", "Krustenalter · Mio. Jahre", "#ffce85"],
      [1, "magnetic", "Magnetische Anomalie · nT", "#8adce1"],
    ] as const) {
      const values = this.samples.flatMap((s) => (s[key] === undefined ? [] : [s[key]!])),
        hi = Math.max(1, ...values.map(Math.abs)),
        lo = key === "age" ? 0 : -hi,
        top = 30 + j * 144;
      c.fillStyle = "#e9f2ec";
      c.fillText(title, x0, top - 14);
      c.strokeStyle = "#718c84";
      c.lineWidth = 1;
      c.strokeRect(x0, top, x1 - x0, pane);
      c.fillText(fmt(hi, 0), 4, top + 8);
      c.fillText(fmt(lo, 0), 4, top + pane - 6);
      if (lo < 0) {
        c.beginPath();
        c.moveTo(x0, top + pane / 2);
        c.lineTo(x1, top + pane / 2);
        c.stroke();
      }
      c.beginPath();
      c.lineWidth = 3;
      c.strokeStyle = color;
      let pen = false;
      for (const sample of this.samples) {
        const v = sample[key];
        if (v === undefined) {
          pen = false;
          continue;
        }
        const x = x0 + (sample.km / last.km) * (x1 - x0),
          y = top + pane * (1 - (v - lo) / (hi - lo));
        if (pen) c.lineTo(x, y);
        else c.moveTo(x, y);
        pen = true;
      }
      c.stroke();
    }
    c.fillStyle = "#eff3ed";
    c.fillText("A · 0 km", x0, 297);
    c.textAlign = "right";
    c.fillText("B · " + fmt(last.km, 0) + " km", x1, 297);
  }
}
