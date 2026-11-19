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
  readonly work = { draws: 0, layouts: 0, measures: 0, creates: 0, writes: 0 };
  private nodes = new Map<
    string,
    {
      button: HTMLButtonElement;
      line: HTMLElement;
      buttonPose?: string;
      linePose?: string;
      length?: string;
    }
  >();
  private sizes = new Map<string, { width: number; height: number }>();
  private frame?: DOMRect;
  private obstacles: Box[] = [];
  private revision = -1;
  constructor(
    private host: HTMLElement,
    private explain: (label: Annotation) => void,
  ) {}

  draw(labels: Annotation[], obstacles: HTMLElement[], revision: number) {
    if (!labels.length) {
      if (this.host.childElementCount) this.host.replaceChildren();
      return;
    }
    this.work.draws++;
    if (!this.frame || revision !== this.revision) {
      this.revision = revision;
      const frame = (this.frame = this.host.getBoundingClientRect());
      this.obstacles = obstacles
        .filter((el) => el && el.offsetWidth)
        .map((el) => {
          const b = el.getBoundingClientRect();
          return {
            left: b.left - frame.left,
            right: b.right - frame.left,
            top: b.top - frame.top,
            bottom: b.bottom - frame.top,
          };
        });
      this.sizes.clear();
      this.work.layouts++;
    }
    const frame = this.frame,
      boxes = [...this.obstacles];
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
        this.work.creates++;
        this.nodes.set(label.id, (node = { button, line }));
      }
      const { button, line } = node;
      let size = this.sizes.get(label.name);
      if (!size) {
        if (!button.isConnected) this.host.append(line, button);
        this.work.measures++;
        size = { width: button.offsetWidth, height: button.offsetHeight };
        this.sizes.set(label.name, size);
      }
      const w = size.width,
        h = size.height,
        dx = w / 2 + 12,
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
        if (!button.isConnected) this.host.append(line, button);
        active.add(label.id);
        boxes.push(box);
        const target = `translate(${box.left.toFixed(1)}px, ${box.top.toFixed(1)}px)`;
        const endX = Math.min(box.right, Math.max(box.left, label.x));
        const endY = Math.min(box.bottom, Math.max(box.top, label.y));
        const connector = `translate(${label.x.toFixed(1)}px, ${label.y.toFixed(1)}px) rotate(${Math.atan2(endY - label.y, endX - label.x).toFixed(5)}rad)`;
        const length =
          Math.hypot(endX - label.x, endY - label.y).toFixed(1) + "px";
        if (node.buttonPose !== target) {
          button.style.transform = node.buttonPose = target;
          this.work.writes++;
        }
        if (node.linePose !== connector) {
          line.style.transform = node.linePose = connector;
          this.work.writes++;
        }
        if (node.length !== length) {
          line.style.width = node.length = length;
          this.work.writes++;
        }
        break;
      }
    }
    for (const [id, node] of this.nodes)
      if (node.button.isConnected && !active.has(id)) {
        node.button.remove();
        node.line.remove();
      }
  }
}
