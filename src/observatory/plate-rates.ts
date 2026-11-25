import { enlargeFigure } from "./research-figure";
import type { Step } from "../tectonics/atlas";
import regions from "./geographic-examples.json";
import { kinematics } from "./research-data";

const regionsById: Record<number, string> = {
  ...regions,
  4209: "Island · Reykjanes",
  2629: "Japan · Tōhoku",
  2877: "Kalifornien · Parkfield",
  2093: "Nepal · Himalaya",
  5505: "Ostafrika · Albertgraben",
};
const number = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 });
const fmt = (v: number) => number.format(v);

export class PlateRates {
  ids = [4209, 2629];
  years = 1000000;
  unit = "mm";
  opened = false;

  allowCurrent(step: Step) {
    const selectors = document.querySelectorAll<HTMLSelectElement>("#research-rates select[data-place]");
    for (const select of selectors) {
      if (!Array.from(select.options).some((option) => option.value === String(step[0])))
        select.add(new Option("Grenzabschnitt " + step[0], String(step[0])));
    }
  }
  mount(parent: HTMLElement, steps: Step[], selected?: Step) {
    if (!steps.length) return;
    const section = document.createElement("details");
    section.id = "research-rates";
    section.open = this.opened;
    section.ontoggle = () => {
      this.opened = section.open;
    };
    section.innerHTML = '<summary>Geschwindigkeiten vergleichen</summary><div class="g-stack"></div>';
    parent.append(section);
    const box = section.querySelector("div")!;
    const places = { ...regionsById };
    for (const id of [...this.ids, selected?.[0]]) if (id && !places[id]) places[id] = "Grenzabschnitt " + id;
    const select = (
      label: string,
      values: [string, string][],
      value: string,
      change: (v: string) => void,
    ) => {
      const element = document.createElement("label");
      element.textContent = label;
      const input = document.createElement("select");
      input.setAttribute("aria-label", label);
      for (const [key, name] of values) input.add(new Option(name, key));
      input.value = value;
      input.onchange = () => {
        change(input.value);
        render();
      };
      element.append(input);
      box.append(element);
      return input;
    };
    const options = Object.entries(places).sort((a, b) => a[1].localeCompare(b[1], "de"));
    this.ids.forEach(
      (id, index) =>
        (select(index === 0 ? "Erste Grenze" : "Zweite Grenze", options, String(id), (v) => {
          this.ids[index] = Number(v);
        }).dataset.place = "true"),
    );
    select(
      "Geschwindigkeit",
      [
        ["mm", "Millimeter pro Jahr"],
        ["cm", "Zentimeter pro Jahr"],
      ],
      this.unit,
      (v) => {
        this.unit = v;
      },
    );
    select(
      "Weg bei konstanter Relativbewegung",
      [
        ["1000", "1.000 Jahre"],
        ["100000", "100.000 Jahre"],
        ["1000000", "1 Million Jahre"],
      ],
      String(this.years),
      (v) => {
        this.years = Number(v);
      },
    );
    const chart = document.createElement("canvas");
    chart.width = 640;
    chart.height = 300;
    chart.className = "research-rate-chart";
    chart.setAttribute("role", "img");
    chart.setAttribute("aria-label", "Relative Bewegung beider Plattenpaare im selben Maßstab, Norden oben");
    const result = document.createElement("div");
    result.setAttribute("aria-live", "polite");
    box.append(chart, enlargeFigure("Geschwindigkeitsvergleich", chart, result), result);
    const explanation = document.createElement("small");
    explanation.textContent =
      "PB2002 · Heutige Modellgeschwindigkeit der zuerst genannten Platte gegenüber der zweiten. Der hochgerechnete Weg setzt über die gewählte Zeit konstante Geschwindigkeit und Richtung voraus.";
    box.append(explanation);
    const render = () => {
      const pairs = this.ids.map((id) => kinematics(steps[id - 1], this.years));
      const c = chart.getContext("2d")!,
        scale = 110 / Math.max(100, ...pairs.map((p) => p.speed));
      c.clearRect(0, 0, 640, 300);
      c.font = "20px system-ui";
      c.textAlign = "center";
      const colors = ["#82e1d3", "#ffc279"];
      result.replaceChildren();
      pairs.forEach((p, i) => {
        const cx = i * 300 + 170,
          cy = 139,
          angle = (p.azimuth * Math.PI) / 180;
        c.strokeStyle = "#648278";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(cx - 105, cy);
        c.lineTo(cx + 105, cy);
        c.moveTo(cx, cy - 99);
        c.lineTo(cx, cy + 100);
        c.stroke();
        c.fillStyle = "#edf6f1";
        c.fillText("N", cx, 24);
        const len = p.speed * scale,
          dx = Math.sin(angle),
          dy = -Math.cos(angle),
          x = cx + len * dx,
          y = cy + len * dy;
        c.strokeStyle = colors[i];
        c.fillStyle = colors[i];
        c.lineWidth = 5;
        c.beginPath();
        c.moveTo(cx, cy);
        c.lineTo(x, y);
        c.stroke();
        const h = Math.min(13, len * 0.35);
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x - h * dx + h * dy * 0.55, y - h * dy - h * dx * 0.55);
        c.lineTo(x - h * dx - h * dy * 0.55, y - h * dy + h * dx * 0.55);
        c.closePath();
        c.fill();
        c.fillText(
          i + 1 + " · " + fmt(p.speed / (this.unit === "cm" ? 10 : 1)) + " " + this.unit + "/Jahr",
          cx,
          264,
        );
        const title = document.createElement("strong");
        title.textContent = i + 1 + " · " + p.pair;
        const el = document.createElement("p"),
          factor = this.unit === "cm" ? 10 : 1;
        el.textContent = `${fmt(p.speed / factor)} ${this.unit}/Jahr nach ${p.azimuth}° (ab Nord). Quer ${fmt(Math.abs(p.normal) / factor)} ${this.unit}/Jahr ${p.normal >= 0 ? "auseinander" : "aufeinander zu"}, längs ${fmt(Math.abs(p.parallel) / factor)} ${this.unit}/Jahr ${p.parallel >= 0 ? "rechtsseitig" : "linksseitig"}. Relativer Weg ${fmt(p.distanceKm)} km.`;
        result.append(title, el);
      });
      c.strokeStyle = "#edf6f1";
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(30, 287);
      c.lineTo(30 + 50 * scale, 287);
      c.stroke();
      c.fillStyle = c.strokeStyle;
      c.textAlign = "left";
      c.fillText(this.unit === "cm" ? "5 cm/Jahr" : "50 mm/Jahr", 40 + 50 * scale, 294);
    };
    render();
  }
}
