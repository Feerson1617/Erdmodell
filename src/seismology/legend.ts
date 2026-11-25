import type { ResearchState } from "../observatory/research-atlas";
export function seismicLegend(el: HTMLElement, a: ResearchState) {
  const token = [...a.layers, a.year, a.depth, a.magnitude, a.base].join("/");
  if (el.dataset.keys === token) return;
  el.dataset.keys = token;
  el.replaceChildren();
  const add = (symbol: string, label: string, shape = "") => {
    const span = document.createElement("span");
    span.className = "quake-key";
    const icon = document.createElement("i");
    icon.style.setProperty("--symbol", symbol);
    icon.className = shape;
    span.append(icon, label);
    el.append(span);
  };
  if (a.layers.includes("bounds")) {
    add("#6dd4c0", "divergent", "line");
    add("#f19e69", "konvergent", "line");
    add("#c4a0ed", "Transform", "line");
  }
  if (a.layers.includes("trench")) add("#ffba87", "Subduktionsfront", "line");
  if (a.layers.includes("quakes")) {
    if (a.layers.includes("depth")) {
      add("#ffe78d", "< 70 km");
      add("#ffae68", "70–< 300 km");
      add("#ae9cff", "≥ 300 km");
    } else add("#ffe78d", "Katalogbeben");
    if (a.layers.includes("magnitude")) {
      add("#ffe78d", "M 6");
      add("#ffe78d", "M 8", "large");
    }
  }
  if (a.layers.includes("volcano")) add("#ff906e", "Vulkan", "volcano");
  el.append(
    "USGS · " +
      (a.year || "2019–2023") +
      " · M ≥ " +
      a.magnitude +
      " · bis " +
      a.depth +
      " km",
  );
}
