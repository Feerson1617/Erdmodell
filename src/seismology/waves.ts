import * as T from "three";
import { Stage, colors, vec } from "./stage";
import {
  speed,
  displacement,
  stationTrace,
  arrival,
  groundMotion,
  volcanicTrace,
  type Wave,
} from "./physics";
import { localAsset } from "../assets";
import rays from "./iasp91.json";
import recording from "./tohoku-anmo.json";

type Track = {
  label: string;
  color: string;
  sample: (sec: number) => number;
  km?: number;
};
function chart(s: Stage, tracks: Track[], seconds: number, header: string) {
  const paper = document.createElement("canvas");
  let cached = "";
  s.chart((c, w, h, t) => {
    const left = Math.min(155, w * 0.19),
      right = w - 28,
      top = 27,
      bottom = h - 24;
    const lane = (bottom - top) / tracks.length,
      axis = (sec: number) => left + ((right - left) * sec) / seconds;
    // The entire reference trace uses one fixed gain. Reveal only elapsed model time.
    const scale = c.getTransform().a,
      key = [w, h, scale].join("/");
    if (cached !== key) {
      cached = key;
      paper.width = Math.round(w * scale);
      paper.height = Math.round(h * scale);
      const ink = paper.getContext("2d")!;
      ink.scale(scale, scale);
      tracks.forEach((tr, i) => {
        const y = top + (i + 0.5) * lane;
        ink.strokeStyle = tr.color;
        ink.lineWidth = 1.8;
        ink.beginPath();
        for (let px = 0; px <= right - left; px++) {
          const v = tr.sample((px * seconds) / (right - left)),
            yy = y - v * lane * 0.44;
          if (px) ink.lineTo(left + px, yy);
          else ink.moveTo(left, yy);
        }
        ink.stroke();
      });
    }
    c.clearRect(0, 0, w, h);
    c.font = "600 " + Math.max(12, Math.min(18, h * 0.13)) + "px system-ui";
    c.fillStyle = "#ecf4ef";
    c.fillText(header, 12, 18);
    for (let sec = 0; sec <= seconds; sec += 5) {
      const x = axis(sec);
      c.strokeStyle = "#49625f";
      c.beginPath();
      c.moveTo(x, top);
      c.lineTo(x, bottom);
      c.stroke();
      c.fillStyle = "#c2d8ce";
      c.font = "13px system-ui";
      c.fillText(sec + " s", x - 6, h - 5);
    }
    tracks.forEach((tr, i) => {
      const y = top + (i + 0.5) * lane;
      c.strokeStyle = "#617974";
      c.beginPath();
      c.moveTo(left, y);
      c.lineTo(right, y);
      c.stroke();
      c.fillStyle = tr.color;
      c.font = "600 " + Math.max(12, Math.min(17, lane * 0.5)) + "px system-ui";
      c.fillText(tr.label, 12, y + 5);
      if (tr.km !== undefined)
        for (const wave of ["p", "s"] as const) {
          const sec = arrival(tr.km, wave),
            x = axis(sec);
          c.fillStyle = wave === "p" ? "#ffd58b" : "#78e2db";
          c.fillRect(x - 1, y - lane * 0.45, 2, lane * 0.8);
          c.font = "bold 12px system-ui";
          c.fillText(
            wave.toUpperCase() +
              " " +
              sec.toLocaleString("de-DE", { maximumFractionDigits: 2 }),
            x + 3,
            y - lane * 0.16,
          );
        }
    });
    const cursor = axis(t * seconds);
    c.save();
    c.beginPath();
    c.rect(left, top, cursor - left, bottom - top);
    c.clip();
    c.drawImage(paper, 0, 0, w, h);
    c.restore();
    c.strokeStyle = "#fff0bc";
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(cursor, top);
    c.lineTo(cursor, bottom);
    c.stroke();
  });
}
const V = vec;
export function waveField(s: Stage) {
  const surface = s.view === "surface",
    motion: Wave[] = surface ? ["rayleigh", "love"] : ["p", "s"];
  const stations = ["stations", "sites", "distance"].includes(s.view);
  if (stations) {
    stationField(s);
    return;
  }
  s.look(1.5, 3.3, 15);
  s.halfHeight = 3.25;
  s.halfWidth = 6.7;
  s.duration = 28;
  const colorsUsed = [colors.p, colors.s],
    dummy = new T.Object3D(),
    labels = surface
      ? ["Rayleigh · elliptisch", "Love · horizontal quer"]
      : ["P · längs", "S · quer"];
  for (const [row, mode] of motion.entries()) {
    const y = 1.5 - row * 1.85;
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
    mesh.frustumCulled = false;
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
  s.explain(() =>
    surface
      ? "Rayleigh-Wellen bewegen Teilchen auf Ellipsen. Love-Wellen schwingen horizontal quer zur Ausbreitung."
      : "Die Front wandert nach rechts. Die markierten Gesteinsteilchen schwingen um ihre feste Ruhelage.",
  );
}
function stationField(s: Stage) {
  const sites = s.view === "sites",
    distances = sites ? [45, 45] : [30, 60],
    seconds = 28;
  s.duration = seconds;
  s.halfWidth = 6.45;
  s.halfHeight = 3.1;
  s.look(0.8, 5.4, 15, -0.9);
  const xs = (km: number) => -5.35 + (km * 10.7) / 72;
  if (!sites) {
    s.box(0, 0.31, -0.23, 11.15, 0.7, 1.75, 0x687d79, "Gesteinsprofil");
    s.box(0, -0.17, -0.23, 11.15, 0.25, 1.75, 0x887463, "Schichtgrenze");
    const origin = V(xs(0), 0.91, 0.14);
    s.dot(origin, colors.hot, 0.2, "Gemeinsamer Herd");
    s.label(origin, "Quelle");
    for (const wave of ["p", "s"] as const) {
      const front = s.mesh(
        new T.PlaneGeometry(1.65, 1.16),
        wave === "p" ? colors.p : colors.s,
        "Front " + wave.toUpperCase(),
        true,
      );
      front.rotation.y = Math.PI / 2;
      front.material.transparent = true;
      front.material.opacity = 0.47;
      front.material.depthWrite = false;
      const rim = s.mesh(
        new T.TubeGeometry(
          new T.CatmullRomCurve3([
            V(0, -0.05, -1.05),
            V(0, 0.56, -0.85),
            V(0, 0.83, -0.22),
            V(0, 0.56, 0.49),
            V(0, -0.05, 0.72),
          ]),
          24,
          0.046,
          8,
          false,
        ),
        wave === "p" ? colors.p : colors.s,
        "Wellenfront im Profil",
        true,
      );
      const tip = s.dot(
        V(),
        wave === "p" ? colors.p : colors.s,
        0.12,
        "Frontspitze " + wave.toUpperCase(),
      );
      const anchor = V();
      s.label(
        anchor,
        wave === "p" ? "P-Front" : "S-Front",
        "",
        (t) => speed[wave] * t * seconds <= 72,
      );
      s.animate((t) => {
        const km = speed[wave] * t * seconds;
        rim.visible = front.visible = tip.visible = km <= 72;
        rim.position.set(xs(km), 0.84, 0);
        front.position.set(xs(km), 1.07, -0.24);
        tip.position.set(xs(km), 1.4, 0.57);
        anchor.copy(tip.position);
      });
    }
    const particles = new T.InstancedMesh(
      new T.SphereGeometry(0.084, 12, 8),
      new T.MeshStandardMaterial({ color: 0xf4d295 }),
      73 * 4,
    );
    particles.name = "Gesteinsteilchen";
    particles.frustumCulled = false;
    s.scene.add(particles);
    const dummy = new T.Object3D();
    for (let km = 0; km <= 72; km += 6)
      s.line(
        [V(xs(km), 0.68, 0.55), V(xs(km), 0.77, 0.55)],
        0xfff4cc,
        "Ruhelage",
      );
    s.animate((t) => {
      for (let km = 0; km <= 72; km++) {
        const m = groundMotion(km, t * seconds);
        for (let j = 0; j < 4; j++) {
          dummy.position.set(
            xs(km) + m.longitudinal * 0.48,
            0.86 + m.transverse * 0.48,
            0.42 - j * 0.45,
          );
          dummy.updateMatrix();
          particles.setMatrixAt(4 * km + j, dummy.matrix);
        }
      }
      particles.instanceMatrix.needsUpdate = true;
    });
  } else {
    const source = V(0, -0.25, 0);
    s.dot(source, colors.hot, 0.18, "Gemeinsame Quelle");
    s.label(source, "Gleiche Quelle");
    for (const sign of [-1, 1])
      s.line([source, V(sign * 2.65, 0.35, 0)], 0xecb177, "Gleiche Entfernung");
  }
  const labels = sites
    ? ["Fels · 45 km", "Sediment · 45 km"]
    : ["Station A · 30 km", "Station B · 60 km"];
  distances.forEach((km, i) => {
    const x = sites ? (i ? 2.95 : -2.95) : xs(km);
    const rock = sites && !i,
      z = sites ? 0 : -0.05,
      y = sites ? 0.79 : 0.84;
    if (sites) {
      for (let j = 0; j < 3; j++)
        s.box(
          x,
          -0.38 + j * 0.43,
          z,
          4.5,
          0.42,
          1.96,
          rock
            ? [0x685e56, 0x88796e, 0x817767][j]
            : [0x705f4d, 0xb89161, 0xd2b17b][j],
          "Untergrund",
        );
    }
    const top = sites
      ? s.box(
          x,
          y,
          z,
          4.5,
          0.22,
          1.99,
          rock ? 0x929480 : 0xcab284,
          "Bewegte Oberfläche",
        )
      : undefined;
    const marker = s.box(
      x,
      y + 0.33,
      z,
      0.52,
      0.55,
      0.48,
      0xe1e3cf,
      "Sensor " + i,
    );
    const roof = s.box(
      x,
      y + 0.63,
      z,
      0.63,
      0.08,
      0.56,
      0xa59ec3,
      "Sensorkopf " + i,
    );
    const anchor = V(x, y + 0.69, z);
    s.label(anchor, labels[i]);
    const rest = s.line(
      [V(x - 0.83, y + 0.06, z + 0.56), V(x + 0.83, y + 0.06, z + 0.56)],
      0xf6e7c2,
      "Unbewegter Höhenbezug",
    );
    rest.name = "Ruhelage " + i;
    s.animate((t) => {
      const m = groundMotion(km, t * seconds, sites && i === 1),
        gain = sites ? 0.66 : 0.48;
      const dx = m.longitudinal * gain,
        dy = m.transverse * gain;
      marker.position.set(x + dx, y + 0.33 + dy, z);
      roof.position.set(x + dx, y + 0.63 + dy, z);
      anchor.set(x + dx, y + 0.69 + dy, z);
      if (top) top.position.set(x + dx, y + dy, z);
    });
  });
  chart(
    s,
    distances.map((km, i) => ({
      km,
      label: labels[i],
      color: "#f1eede",
      sample: (sec) => stationTrace(km, sec, sites && i === 1),
    })),
    seconds,
    "Modellseismogramme · geneigte Messachse · gleiche relative Skala",
  );
  s.explain(() =>
    sites
      ? "Beide Standorte liegen 45 km vom selben Herd entfernt. In diesem Schichtmodell schwingt das Sediment länger und bei tieferen Frequenzen."
      : "Dieselbe P-Front und dieselbe S-Front passieren beide Stationen. Die Kurven zeigen die Bodenbewegung entlang derselben geneigten Messachse.",
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
    [(6371 - 35) * scale, 0x937158, -0.08, "Mantel"],
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
    if (s.view === "rays" && !["P", "S", "PKP"].includes(p.phase)) continue;
    if (s.view === "conversion" && p.phase !== "SKS" && p.phase !== "S")
      continue;
    const side = i % 2 ? 1 : -1;
    if (p.phase === "SKS" && s.view === "rays") continue;
    const pts = p.points.map(([, theta, d]) =>
      V(
        side * Math.sin(theta) * (6371 - d) * scale,
        Math.cos(theta) * (6371 - d) * scale,
        0.1,
      ),
    );
    if (p.phase === "P" && p.angle === 93)
      s.label(pts[Math.floor(pts.length / 3)], "P · Druckwelle");
    if (p.phase === "S")
      s.label(pts[Math.floor(pts.length / 3)], "S · Scherwelle");
    if (p.phase === "SKS")
      s.label(pts[Math.floor(pts.length / 2)], "K · Druckwelle im Kern");
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
    for (const [i, clock] of [
      "05:55",
      "06:02",
      "06:09",
      "06:16 UTC",
    ].entries()) {
      const x = l + (i * (right - l)) / 3;
      c.fillStyle = "#afcfc6";
      c.fillRect(x, h * 0.72, 1, 6);
      c.font = "13px system-ui";
      c.fillText(clock, Math.min(right - 69, Math.max(l, x - 18)), h - 20);
    }
    c.fillStyle = "#ccded9";
    c.fillText(
      "Vertikal · 1.260 Sekundenintervalle · Minimum und Maximum der digitalen Zählwerte",
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
