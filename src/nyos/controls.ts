import type { World } from "../world";

export function nyosControls(world: World) {
  return `<h1>Nyos-See</h1><p class="nyosLocation">Kamerun</p>
    <div class="regionScale" role="group" aria-label="Kartenausschnitt">
      <button id="nyos-overview" aria-pressed="${!world.nyosDetail}">Region</button>
      <button id="nyos-near" aria-pressed="${world.nyosDetail}">Zum See</button>
    </div>`;
}
export function bindNyosControls(side: HTMLElement, world: World, render: () => void) {
  for (const [id, overview] of [["nyos-overview", true], ["nyos-near", false]] as const) {
    side.querySelector("#" + id)?.addEventListener("click", () => {
      world.visit("nyos", overview);
      render();
      document.getElementById(id)?.focus({preventScroll:true});
    });
  }
}
export function syncNyos(world: World) {
  const p = world.nyosPin(), pin = document.getElementById("nyosPin")!;
  pin.hidden = !p;
  if (p) {
    pin.style.left = p.x + "px";
    pin.style.top = p.y + "px";
  }
  const note = document.getElementById("modelnote")!;
  const d = world.nav.pose.d;
  const label = d > 3800 ? "Afrika" : d > 900 ? "Kamerun" : d > 105 ? "Kamerun-Vulkanlinie" : d > 12 ? "Region um den Nyos-See" : "";
  note.hidden = !label;
  if (note.textContent !== label) note.textContent = label;
}
