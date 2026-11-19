import * as T from "three";

export type Annotation = {
  id: string;
  name: string;
  text: string;
  x: number;
  y: number;
};
export function project(
  point: T.Vector3,
  camera: T.Camera,
  width: number,
  height: number,
) {
  const p = point.clone().project(camera);
  if (Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z)) > 1) return null;
  return { x: ((1 + p.x) * width) / 2, y: ((1 - p.y) * height) / 2 };
}

type Box = { left: number; right: number; top: number; bottom: number };
const intersects = (a: Box, b: Box) =>
  a.left < b.right + 3 &&
  a.right > b.left - 3 &&
  a.top < b.bottom + 3 &&
  a.bottom > b.top - 3;

/** The DOM contains only released and visible object names. Leaders terminate at the projected surface. */
export class AnnotationLayer {
  private nodes = new Map<
    string,
    { button: HTMLButtonElement; line: HTMLElement }
  >();
  constructor(
    private host: HTMLElement,
    private explain: (label: Annotation) => void,
  ) {}

  draw(labels: Annotation[], obstacles: HTMLElement[]) {
    if (!labels.length && !this.nodes.size) return;
    const frame = this.host.getBoundingClientRect();
    const boxes: Box[] = obstacles
      .filter((el) => el && el.offsetWidth)
      .map((el) => {
        const b = el.getBoundingClientRect();
        return {
          left: b.left - frame.left,
          top: b.top - frame.top,
          right: b.right - frame.left,
          bottom: b.bottom - frame.top,
        };
      });
    const active = new Set<string>();
    for (const label of labels) {
      let node = this.nodes.get(label.id);
      if (!node) {
        const button = document.createElement("button"),
          line = document.createElement("i");
        const name = document.createElement("span");
        name.textContent = label.name;
        button.append(name);
        button.dataset.object = label.id;
        button.onclick = () => this.explain(label);
        this.host.append(line, button);
        this.nodes.set(label.id, (node = { button, line }));
      }
      const { button, line } = node;
      const w = button.offsetWidth,
        h = button.offsetHeight;
      const dx = w / 2 + 12,
        dy = h / 2 + 10;
      const placements = [
        [0, -dy],
        [0, dy],
        [dx, 0],
        [-dx, 0],
        [dx, -dy],
        [-dx, -dy],
        [dx, dy],
        [-dx, dy],
        [0, -dy - h],
        [0, dy + h],
        [-dx, -dy - h],
        [dx, dy + h],
      ];
      for (const [ox, oy] of placements) {
        const x = label.x + ox,
          y = label.y + oy;
        const box = {
          left: x - w / 2,
          right: x + w / 2,
          top: y - h / 2,
          bottom: y + h / 2,
        };
        if (
          box.left < 3 ||
          box.right > frame.width - 3 ||
          box.top < 3 ||
          box.bottom > frame.height - 3 ||
          boxes.some((b) => intersects(box, b))
        )
          continue;
        active.add(label.id);
        boxes.push(box);
        button.style.transform = `translate(${box.left.toFixed(1)}px,${box.top.toFixed(1)}px)`;
        const endX = Math.min(box.right, Math.max(box.left, label.x));
        const endY = Math.min(box.bottom, Math.max(box.top, label.y));
        line.style.transform = `translate(${label.x.toFixed(1)}px,${label.y.toFixed(1)}px) rotate(${Math.atan2(endY - label.y, endX - label.x)}rad)`;
        line.style.width = Math.hypot(endX - label.x, endY - label.y) + "px";
        break;
      }
    }
    for (const [id, node] of this.nodes)
      if (!active.has(id)) {
        node.button.remove();
        node.line.remove();
        this.nodes.delete(id);
      }
  }
}
