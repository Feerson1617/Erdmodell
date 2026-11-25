import * as T from "three";
import { Stage, colors, vec } from "./stage";
import {
  speed,
  displacement,
  stationTrace,
  volcanicTrace,
  type Wave,
} from "./physics";
import { localAsset } from "../assets";
import rays from "./iasp91.json";
import recording from "./tohoku-anmo.json";

type Track = { label: string; color: string; sample: (sec: number) => number };
function chart(s: Stage, tracks: Track[], seconds: number, header: string) {
  s.chart((c, w, h, t) => {
    c.clearRect(0, 0, w, h);
    c.font = "600 " + Math.max(11, Math.min(17, h * 0.14)) + "px system-ui";
    c.fillStyle = "#e0ece9";
    c.fillText(header, 12, 18);
    const left = Math.min(150, w * 0.21),
      right = w - 22,
      top = 27,
      dh = (h - top - 14) / tracks.length;
    for (let j = 0; j <= 4; j++) {
      const x = left + ((right - left) * j) / 4;
      c.strokeStyle = "#49615d";
      c.beginPath();
      c.moveTo(x, top);
      c.lineTo(x, h - 14);
      c.stroke();
      c.fillStyle = "#a4bcb4";
      c.font = "11px system-ui";
      c.fillText(Math.round((seconds * j) / 4) + " s", x - 8, h - 2);
    }
    tracks.forEach((track, i) => {
      const y = top + (i + 0.5) * dh;
      c.strokeStyle = "#52675e";
      c.beginPath();
      c.moveTo(left, y);
      c.lineTo(right, y);
      c.stroke();
      c.fillStyle = track.color;
      c.font = "600 " + Math.max(11, Math.min(15, dh * 0.55)) + "px system-ui";
      c.fillText(track.label, 12, y + 4);
      c.strokeStyle = track.color;
      c.lineWidth = 1.6;
      c.beginPath();
      const n = Math.ceil((right - left) * t);
      for (let j = 0; j <= n; j++) {
        const xx = j / (right - left);
        const v = track.sample(xx * seconds),
          yy = y - Math.max(-1.25, Math.min(1.25, v)) * dh * 0.39;
        if (!j) c.moveTo(left, yy);
        else c.lineTo(left + j, yy);
      }
      c.stroke();
    });
    const x = left + (right - left) * t;
    c.strokeStyle = "#fff3c6";
    c.beginPath();
    c.moveTo(x, top - 3);
    c.lineTo(x, h - 13);
    c.stroke();
  });
}
const V = vec;
export function waveField(s: Stage) {
  const surface = s.view === "surface",
    motion: Wave[] = surface ? ["rayleigh", "love"] : ["p", "s"];
  const stations = ["stations", "sites", "distance"].includes(s.view);
  s.look(1.5, 3.3, 15, stations ? -1 : 0);
  s.halfHeight = 3.25;
  s.halfWidth = 6.7;
  s.duration = 28;
  const colorsUsed = [colors.p, colors.s],
    dummy = new T.Object3D(),
    labels = surface
      ? ["Rayleigh · elliptisch", "Love · horizontal quer"]
      : ["P · längs", "S · quer"];
  for (const [row, mode] of motion.entries()) {
    const y = (stations ? 1.35 : 1.5) - row * 1.85;
    s.box(
      0,
      y - (surface ? 0.65 : 0.41),
      -0.45,
      10.9,
      0.13,
      1.85,
      0x536b69,
      "Gesteinsausschnitt",
    );
    const mesh = new T.InstancedMesh(
      new T.SphereGeometry(0.068, 12, 8),
      new T.MeshStandardMaterial({ color: colorsUsed[row] }),
      49 * 3,
    );
    mesh.name = labels[row];
    s.scene.add(mesh);
    const front = s.line(
      [V(0, y - 0.25, 0.4), V(0, y + 0.36, 0.4)],
      colorsUsed[row],
      "Wellenfront",
    );
    for (let j = 0; j < 49; j += 4)
      s.line(
        [
          V(-5.25 + (j * 10.5) / 48, y - 0.19, 0.39),
          V(-5.25 + (j * 10.5) / 48, y - 0.11, 0.39),
        ],
        0x97ada5,
        "Ruhelage",
      );
    s.label(V(-4.9, y, 0.28), labels[row]);
    s.animate((t) => {
      const sec = t * 28,
        kmFront = speed[mode] * sec;
      front.visible = kmFront <= 84;
      front.position.x = -5.25 + kmFront / 8;
      for (let i = 0; i < 49; i++)
        for (let j = 0; j < 3; j++) {
          const km = (i * 84) / 48,
            z = 0.27 - j * 0.54,
            depth = surface ? j : 0,
            q = displacement(mode, km, sec, depth);
          dummy.position.set(
            -5.25 + km / 8 + q[0] * 0.25,
            y - depth * 0.21 + q[1] * 0.28,
            z + q[2] * 0.42,
          );
          dummy.updateMatrix();
          mesh.setMatrixAt(i * 3 + j, dummy.matrix);
        }
      mesh.instanceMatrix.needsUpdate = true;
    });
  }
  if (stations) {
    const distances = s.view === "sites" ? [45, 45] : [30, 60];
    for (const [i, km] of distances.entries()) {
      const x = -5.25 + km / 8,
        y = 1.7 - i * 1.85;
      s.box(x, y, 0.05, 0.17, 0.24, 0.16, colorsUsed[i], "Messstation");
      s.label(
        V(x, y + 0.13, 0.05),
        s.view === "sites" ? (i ? "Sediment" : "Fels") : km + " km",
      );
    }
    chart(
      s,
      distances.map((km, i) => ({
        label:
          s.view === "sites" ? (i ? "Sediment" : "Fels") : "Station " + (i + 1),
        color: i ? "#76ded7" : "#ffcf79",
        sample: (sec) => stationTrace(km, sec, s.view === "sites" && i === 1),
      })),
      28,
      "Modellseismogramme · gleiche Quelle · relative Amplitude",
    );
  }
  s.explain(() =>
    s.view === "sites"
      ? "Bei gleicher Quelle und Entfernung verändert hier eine Sedimentschicht Amplitude und Frequenz. Ihre Wirkung hängt vom Schichtaufbau ab."
      : s.view === "distance"
        ? "Mit größerer Entfernung wachsen die Laufzeiten und der Abstand zwischen den P- und S-Ankünften. Die örtliche Erschütterung kann abweichen."
        : stations
          ? "Beide Stationen empfangen zuerst die schnellere P-Welle. Die Spuren entstehen synchron zur Modellzeit."
          : surface
            ? "Rayleigh-Wellen bewegen Teilchen im vereinfachten Modell auf Ellipsen. Love-Wellen schwingen horizontal quer zur Ausbreitung."
            : "Die Front läuft von links nach rechts. Markierte Ruhelagen bleiben fest, während die Teilchen um sie schwingen.",
  );
}
export function earthPaths(s: Stage) {
  s.look(0, 0, 16);
  s.halfWidth = 4.6;
  s.halfHeight = 3.72;
  s.duration = 25;
  const R = 2.98,
    scale = R / 6371,
    C = (deg: number, r = R) =>
      V(
        Math.sin((deg * Math.PI) / 180) * r,
        Math.cos((deg * Math.PI) / 180) * r,
        0.07,
      );
  for (const [r, c, z, name] of [
    [R, 0x799d9a, -0.09, "Kruste"],
    [R * 0.986, 0x937158, -0.08, "Mantel"],
    [(6371 - 2891) * scale, 0xe2a459, -0.06, "Flüssiger äußerer Kern"],
    [1217 * scale, 0xf6d08a, -0.04, "Innerer Kern"],
  ] as const) {
    const m = s.mesh(new T.CircleGeometry(r, 144), c, name);
    m.position.z = z;
  }
  const arc = (a: number, b: number, r: number, c: number) =>
    s.line(
      Array.from({ length: 75 }, (_, i) => C(a + ((b - a) * i) / 74, r)),
      c,
      "Schattenzone",
    );
  for (const sign of [-1, 1]) {
    arc(sign * 103, sign * 142, R + 0.07, colors.p);
    arc(sign * 103, sign * 180, R + 0.15, colors.s);
  }
  for (const [i, p] of rays.entries()) {
    if (s.view === "conversion" && p.phase !== "SKS" && p.phase !== "S")
      continue;
    const side = i % 2 ? 1 : -1;
    if (p.phase === "SKS" && s.view !== "conversion") continue;
    const pts = p.points.map(([, theta, d]) =>
      V(
        side * Math.sin(theta) * (6371 - d) * scale,
        Math.cos(theta) * (6371 - d) * scale,
        0.1,
      ),
    );
    const c = p.phase.startsWith("S") ? colors.s : colors.p;
    if (p.phase === "SKS") {
      let start = 0;
      for (let j = 1; j < pts.length; j++) {
        const was = p.points[start][2] >= 2891,
          now = p.points[j][2] >= 2891;
        if (was !== now || j === pts.length - 1) {
          s.line(pts.slice(start, j + 1), was ? colors.p : colors.s, p.phase);
          start = j;
        }
      }
    } else s.line(pts, c, p.phase, 0.88);
    const dot = s.dot(pts[0], c, 0.064, p.phase + " · Wellenpaket");
    s.animate((t) => {
      const sec = t * 1600;
      dot.visible = sec <= p.seconds;
      if (!dot.visible) return;
      let k = 1;
      while (k < p.points.length - 1 && p.points[k][0] < sec) k++;
      const a = p.points[k - 1][0],
        b = p.points[k][0];
      dot.position.lerpVectors(
        pts[k - 1],
        pts[k],
        b === a ? 0 : (sec - a) / (b - a),
      );
      if (p.phase === "SKS")
        (dot.material as T.MeshStandardMaterial).color.setHex(
          p.points[k][2] > 2891 ? colors.p : colors.s,
        );
    });
  }
  s.label(C(0), "Quelle");
  s.label(V(0.55, -0.5, 0.12), "Äußerer Kern · flüssig");
  s.label(C(121, R + 0.06), "P-Schattenzone");
  s.label(C(-147, R + 0.16), "Direkte S fehlen");
  s.explain(() =>
    s.view === "conversion"
      ? "SKS wird an der Kern-Mantel-Grenze zur Druckwelle K und beim Austritt wieder zur S-Welle. Umgewandelte Signale erreichen auch den S-Schatten."
      : "Ein Laufwegmodell verbindet viele Beobachtungen. Die Brechung von P und das Fehlen direkter S-Wellen jenseits von etwa 103° stützen den Schluss auf den flüssigen äußeren Kern.",
  );
}
export function realRecord(s: Stage) {
  s.look(0, 0, 16, -0.65);
  s.halfWidth = 6.5;
  s.halfHeight = 2.9;
  s.duration = 22;
  const globe = s.mesh(
    new T.SphereGeometry(1.82, 72, 40),
    0x497775,
    "Erde · Großkreis",
  );
  const point = (lat: number, lon: number) =>
    V(
      Math.cos((lat * Math.PI) / 180) * Math.sin((lon * Math.PI) / 180),
      Math.sin((lat * Math.PI) / 180),
      Math.cos((lat * Math.PI) / 180) * Math.cos((lon * Math.PI) / 180),
    ).multiplyScalar(1.87);
  const from = point(38.297, 142.373),
    to = point(34.9459, -106.4572),
    mid = from.clone().add(to).normalize();
  const q = new T.Quaternion().setFromUnitVectors(mid, V(0, 0, 1));
  globe.rotation.y = -Math.PI / 2;
  globe.quaternion.premultiply(q);
  new T.TextureLoader().load(localAsset("data/earth-atlas.webp"), (tex) => {
    if (s.disposed) {
      tex.dispose();
      return;
    }
    tex.colorSpace = T.SRGBColorSpace;
    const mat = globe.material as T.MeshStandardMaterial;
    mat.map = tex;
    mat.color.setHex(0xffffff);
    mat.needsUpdate = true;
    s.refresh();
  });
  from.applyQuaternion(q);
  to.applyQuaternion(q);
  const base = globe.position;
  base.y = 0.28;
  const p = from.clone().add(base),
    u = to.clone().add(base);
  s.line(
    Array.from({ length: 90 }, (_, i) =>
      from
        .clone()
        .lerp(to, i / 89)
        .normalize()
        .multiplyScalar(1.875)
        .add(base),
    ),
    colors.p,
    "Großkreis",
  );
  s.dot(p, colors.hot, 0.09);
  s.dot(u, colors.s, 0.09);
  s.label(p, "Tōhoku · Erdbeben");
  s.label(u, "Albuquerque · ANMO");
  const span = recording.envelope.length,
    max = Math.max(
      ...recording.envelope.flatMap(([a, b]) => [
        Math.abs(a - recording.mean),
        Math.abs(b - recording.mean),
      ]),
    );
  s.chart((c, w, h, t) => {
    c.clearRect(0, 0, w, h);
    const l = 12,
      right = w - 14,
      mid = h * 0.55,
      amp = h * 0.32;
    c.fillStyle = "#c3dcd3";
    c.font = "bold 13px system-ui";
    c.fillText(
      "Messung · IU.ANMO.00.BHZ · 11.03.2011 · 05:55–06:16 UTC",
      l,
      18,
    );
    c.strokeStyle = "#48605b";
    c.beginPath();
    c.moveTo(l, mid);
    c.lineTo(right, mid);
    c.stroke();
    c.strokeStyle = "#9ddfd3";
    c.beginPath();
    for (let i = 0; i < span * t; i++) {
      const [a, b] = recording.envelope[i],
        x = l + (i / span) * (right - l);
      c.moveTo(x, mid - ((a - recording.mean) / max) * amp);
      c.lineTo(x, mid - ((b - recording.mean) / max) * amp);
    }
    c.stroke();
    c.fillStyle = "#acc5be";
    c.fillText(
      "Vertikalkomponente · digitale Zählwerte · je Sekunde Minimum und Maximum",
      l,
      h - 5,
    );
  });
  s.explain(
    () =>
      "Die Bodenbewegung am Messort ist als instrumentelle Aufzeichnung zu sehen. Die Linie auf der Erde verbindet Ereignis und Station auf dem Großkreis.",
  );
}
export function magmaChart(s: Stage) {
  chart(
    s,
    [
      {
        label: "Modellstation",
        color: "#a5d9cb",
        sample: (sec) => volcanicTrace(s.view, sec),
      },
    ],
    28,
    "Schematische Seismizität · möglicher Signalverlauf",
  );
}
