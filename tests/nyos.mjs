import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, webkit } from "playwright";
import { PNG } from "pngjs";
import { preview } from "vite";

const gate = process.env.NYOS_GATE ?? "E";
assert.ok(
  "ABCDE".includes(gate) && gate.length === 1,
  "NYOS_GATE muss A, B, C, D oder E sein",
);
const dest =
  process.env.NYOS_OUT ??
  (gate === "E" ? "test-results/nyos" : "test-results/nyos-gates/" + gate);
await mkdir(dest, { recursive: true });
const report = {
  commit: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  sourceModified: Boolean(
    execFileSync(
      "git",
      [
        "status",
        "--porcelain",
        "--untracked-files=all",
        "--",
        "src",
        "public",
        "index.html",
        "vite.config.ts",
      ],
      { encoding: "utf8" },
    ).trim(),
  ),
  indexSha256: createHash("sha256")
    .update(
      await readFile(join(process.env.TEST_BUILD ?? "dist", "index.html")),
    )
    .digest("hex"),
  testedAt: new Date().toISOString(),
  gate,
  runs: [],
};
const server = await preview({
  configFile: false,
  base: "/unterricht/kamerun/",
  build: { outDir: process.env.TEST_BUILD ?? "dist" },
  preview: { host: "127.0.0.1", port: 0 },
  logLevel: "error",
});
const url =
  "http://127.0.0.1:" +
  server.httpServer.address().port +
  "/unterricht/kamerun/";
const diag = (p) => p.evaluate(() => window.geoObservatory());
const painted = (p) =>
  p.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
const settled = (p) =>
  p.waitForFunction(
    () =>
      window.geoObservatory?.().frames > 2 && !window.geoObservatory().flying,
  );
const angular = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const sorted = (values) => [...values].sort((a, b) => a - b);
const q = (sequence, p) =>
  sequence[Math.min(sequence.length - 1, Math.ceil(sequence.length * p) - 1)];
const mb = (n) =>
  n === null ? "nicht verfügbar" : (n / 1048576).toFixed(1) + " MiB";

async function checkGeography() {
  const dir = join(process.env.TEST_BUILD ?? "dist", "data", "nyos"),
    meta = JSON.parse(await readFile(join(dir, "landscape.json"), "utf8"));
  const {
    bounds: [west, south, east, north],
    width,
    height,
    shoreline,
    anchor,
    waterLevelM,
  } = meta;
  // Published geodetic lake location to two decimals, independent of camera target data.
  assert.ok(
    Math.abs(anchor.lat - 6.44) < 0.03 && angular(anchor.lon, 10.3) < 0.03,
  );
  assert.ok(
    west < anchor.lon &&
      anchor.lon < east &&
      south < anchor.lat &&
      anchor.lat < north,
  );
  assert.ok(width > 120 && height > 120 && width * height < 3e6);
  const bytes = await readFile(join(dir, meta.heightFile));
  assert.equal(bytes.length, width * height * 2);
  const elevations = Array.from({ length: width * height }, (_, i) =>
    bytes.readInt16LE(i * 2),
  );
  const values = sorted(elevations);
  assert.ok(
    values[0] > 0 && values.at(-1) < 4000,
    "Unerwartete Geländehöhen oder NoData im lokalen Gitter",
  );
  assert.ok(
    values.at(-1) - values[0] > 200,
    "Höhenraster enthält kein ausgeprägtes Relief",
  );
  assert.ok(waterLevelM > 1020 && waterLevelM < 1160);
  assert.ok(shoreline.length >= 15);
  assert.ok(meta.vicinity.bounds[0] < west && meta.vicinity.bounds[2] > east);
  const xKm = 111.2 * Math.cos((anchor.lat * Math.PI) / 180),
    yKm = 111.2;
  const xy = shoreline.map(([lon, lat]) => {
    assert.ok(lon >= west && lon <= east && lat >= south && lat <= north);
    return [(lon - anchor.lon) * xKm, (lat - anchor.lat) * yKm];
  });
  const area = Math.abs(
    xy.reduce((v, [x, y], i) => {
      const [nx, ny] = xy[(i + 1) % xy.length];
      return v + x * ny - y * nx;
    }, 0) / 2,
  );
  const delta = (values) => Math.max(...values) - Math.min(...values);
  const eastWest = delta(xy.map((p) => p[0])),
    northSouth = delta(xy.map((p) => p[1]));
  assert.ok(
    area > 0.9 && area < 2.8 && northSouth > eastWest,
    "Reale längliche Seeform und Flächengrößenordnung",
  );
  const col = Math.round(((anchor.lon - west) / (east - west)) * (width - 1));
  const row = Math.round(
    ((north - anchor.lat) / (north - south)) * (height - 1),
  );
  const centerHeight = elevations[row * width + col];
  assert.ok(
    Math.abs(centerHeight - waterLevelM) < 50,
    "Raster und Ufer/Wasserspiegel gegeneinander verschoben",
  );
  assert.ok(
    Math.min(...elevations.slice(0, width * 3)) < waterLevelM,
    "Nördlicher Kartenrand erreicht kein tieferes Abflussgebiet",
  );
  assert.ok(values.at(-1) > waterLevelM + 100);
  // Sentinel shoreline and Copernicus control elevations at the east flank and northern outlet.
  const controls = [
    [10.307, 6.439, 1190],
    [10.29, 6.456, 1023],
    [10.283, 6.465, 898],
  ].map(([lon, lat, expected]) => {
    const x = Math.round(((lon - west) / (east - west)) * (width - 1)),
      y = Math.round(((north - lat) / (north - south)) * (height - 1));
    const z = elevations[y * width + x];
    assert.ok(
      Math.abs(z - expected) <= 6,
      "DEM-Lage oder Zeilenrichtung an " + lon + "," + lat,
    );
    return { lon, lat, heightM: z };
  });
  const texture = await readFile(join(dir, meta.surfaceFile)),
    regional = await readFile(join(dir, meta.regional.file));
  for (const data of [texture, regional]) {
    assert.ok(
      data.subarray(0, 4).equals(Buffer.from("RIFF")) &&
        data.subarray(8, 12).equals(Buffer.from("WEBP")),
    );
    assert.ok(data.length > 5000);
  }
  const vicinity = await readFile(join(dir, meta.vicinity.file));
  assert.ok(
    vicinity.subarray(8, 12).toString() === "WEBP" &&
      !texture.equals(regional) &&
      !texture.equals(vicinity),
  );
  return {
    anchor,
    bounds: meta.bounds,
    width,
    height,
    shoreVertices: shoreline.length,
    areaKm2: area,
    northSouthKm: northSouth,
    eastWestKm: eastWest,
    waterLevelM,
    centerHeightM: centerHeight,
    lowM: values[0],
    highM: values.at(-1),
    nodata: 0,
    controlElevations: controls,
    demSha256: createHash("sha256").update(bytes).digest("hex"),
  };
}
function errorsOn(page, errors) {
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/^https?:/.test(r.url()) && !r.url().startsWith(url))
      errors.push(r.url());
  });
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(r.status() + " " + r.url());
  });
}
async function raster(page) {
  const encoded = await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => {
          const source = document.getElementById("earth"),
            copy = document.createElement("canvas");
          copy.width = 480;
          copy.height = Math.round(
            (480 * source.clientHeight) / source.clientWidth,
          );
          copy
            .getContext("2d")
            .drawImage(source, 0, 0, copy.width, copy.height);
          resolve(copy.toDataURL());
        }),
      ),
  );
  return PNG.sync.read(Buffer.from(encoded.split(",")[1], "base64"));
}
function pictureStats(pic) {
  const colors = new Set();
  let covered = 0,
    dark = 0;
  for (let y = Math.floor(pic.height * 0.18); y < pic.height * 0.87; y += 2)
    for (let x = Math.floor(pic.width * 0.18); x < pic.width * 0.86; x += 2) {
      const i = (y * pic.width + x) * 4;
      if (pic.data[i + 3] < 100) continue;
      covered++;
      const [r, g, b] = pic.data.subarray(i, i + 3);
      if (r + g + b < 26) dark++;
      colors.add((r >> 4) * 256 + (g >> 4) * 16 + (b >> 4));
    }
  assert.ok(
    covered > 1000 && colors.size >= 12 && dark < covered * 0.95,
    "Detailansicht zeigt keine differenzierte gerenderte Landschaft",
  );
  return { covered, colors: colors.size, dark };
}
function difference(a, b) {
  assert.equal(a.width, b.width);
  assert.equal(a.height, b.height);
  let n = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    if (
      Math.abs(a.data[i] - b.data[i]) +
        Math.abs(a.data[i + 1] - b.data[i + 1]) +
        Math.abs(a.data[i + 2] - b.data[i + 2]) >
      32
    )
      n++;
  }
  return n / (a.width * a.height);
}
async function flightTrace(page, enabled) {
  return page.evaluate((on) => {
    if (!on) {
      window.nyosRecording = false;
      return window.nyosFlight;
    }
    window.nyosFlight = [];
    window.nyosRecording = true;
    const start = performance.now(),
      canvas = document.getElementById("earth");
    const frame = (t) => {
      if (!window.nyosRecording) return;
      const w = window.geoObservatory(),
        n = w.nyos;
      window.nyosFlight.push({
        t: Math.round(t - start),
        d: w.d,
        lat: w.lat,
        lon: w.lon,
        bearing: w.bearing,
        tilt: w.tilt,
        flying: w.flying,
        mode: w.mode,
        tiles: w.tiles,
        regional: n?.regionalWeight ?? 0,
        local: n?.localWeight ?? 0,
        groundKm: n?.groundKm ?? null,
        clearance: n?.cameraClearanceKm ?? null,
        canvas: canvas === document.getElementById("earth"),
        draws: w.draws,
      });
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, enabled);
}
async function measureCadence(page) {
  const data = await page.evaluate(async () => {
    const past = performance.now(),
      times = [];
    let prev = past;
    while (prev - past < 3200 || times.length < 4) {
      const now = await new Promise(requestAnimationFrame);
      if (now > prev) times.push(now - prev);
      prev = now;
    }
    const w = window.geoObservatory(),
      gl = document.getElementById("earth").getContext("webgl2");
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      times,
      ratio: w.pixelRatio,
      resolution: w.resolution,
      draws: w.draws,
      triangles: w.triangles,
      geometries: w.geometries,
      textures: w.textures,
      programs: w.programs,
      heap: performance.memory?.usedJSHeapSize ?? null,
      renderer: ext
        ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER),
    };
  });
  const ordered = sorted(data.times);
  return {
    ...data,
    fps: (data.times.length * 1000) / data.times.reduce((a, b) => a + b),
    medianMs: q(ordered, 0.5),
    p95Ms: q(ordered, 0.95),
    maxMs: ordered.at(-1),
    gaps250: data.times.filter((t) => t > 250).length,
  };
}
function auditFlight(samples) {
  const start = samples.findIndex((s) => s.flying),
    first = samples[0],
    last = samples.at(-1);
  assert.ok(
    start >= 0 && first.d > 8000 && last.d < 20,
    "Der Kaltflug muss von der Erde bis zum See führen",
  );
  const moving = samples.slice(Math.max(0, start - 1));
  assert.ok(
    moving.every((s) => s.canvas && s.draws > 0) &&
      moving.filter((s) => s.flying).length >= 6,
  );
  assert.ok(
    moving.some((s) => s.d > 1000 && s.d < 9000),
    "Afrika fehlt im Anflug",
  );
  assert.ok(
    moving.some((s) => s.d > 20 && s.d < 900 && s.regional > 0.02),
    "Regionales Gelände fehlt während der Fahrt",
  );
  assert.ok(
    moving.some((s) => s.flying && s.local > 0.05) && last.local > 0.8,
    "Detailgelände wird erst nach der Landung sichtbar",
  );
  const gaps = moving.slice(1).map((s, i) => s.t - moving[i].t);
  const jumps = moving
    .slice(1)
    .map((s, i) => Math.abs(Math.log(s.d / moving[i].d)));
  assert.ok(
    jumps.every((d) => d < 1.0),
    "Harter Sprung über mehr als eine Zoomstufe",
  );
  assert.ok(
    moving.every((s) => s.clearance === null || s.clearance > 0),
    "Kamera durch das Gelände",
  );
  return {
    ms: last.t - moving[0].t,
    frames: moving.length,
    maxGapMs: Math.max(...gaps),
    gaps250: gaps.filter((t) => t > 250).length,
    maxLogDistanceStep: Math.max(...jumps),
    samples: moving,
  };
}
function reportText() {
  const rows = [
    "# Browser-Messbericht Nyos-See",
    "",
    "Git-Stand `" +
      report.commit +
      "`" +
      (report.sourceModified
        ? " mit lokalen Änderungen an der Anwendung."
        : ".") +
      " SHA-256 der gebauten Startdatei `" +
      report.indexSha256 +
      "`.",
    "",
    "Die unabhängigen Prüfungen laufen unter Linux. Die Werte für eine lokale Ansicht werden während tatsächlich gerenderter Browserbilder erfasst. Das Bedienvideo entsteht in einem eigenen Durchgang.",
    "",
  ];
  for (const r of report.runs) {
    rows.push("## " + r.engine + " " + r.version, "");
    if (r.flight)
      rows.push(
        "Der gemessene Anflug umfasst " +
          r.flight.frames +
          " Bildproben über " +
          (r.flight.ms / 1000).toFixed(1) +
          " s. Der größte Bildabstand beträgt " +
          r.flight.maxGapMs +
          " ms, " +
          r.flight.gaps250 +
          " Abstände lagen über 250 ms.",
        "",
      );
    if (r.cadence) {
      rows.push(
        "| Ansicht | FPS | Median | P95 | Maximum | >250 ms | Renderpuffer | Geometrien / Texturen / Programme | JS-Heap |",
        "|---|---:|---:|---:|---:|---:|---|---|---|",
      );
      for (const [name, m] of Object.entries(r.cadence))
        rows.push(
          "| " +
            [
              name,
              m.fps.toFixed(1),
              m.medianMs.toFixed(0) + " ms",
              m.p95Ms.toFixed(0) + " ms",
              m.maxMs.toFixed(0) + " ms",
              m.gaps250,
              m.resolution.width + " × " + m.resolution.height,
              [m.geometries, m.textures, m.programs].join(" / "),
              mb(m.heap),
            ].join(" | ") +
            " |",
        );
      const renderer = Object.values(r.cadence)[0]?.renderer;
      if (renderer)
        rows.push(
          "",
          "Der Browser meldet den WebGL-Renderer „" + renderer + "“.",
          "",
        );
    }
    if (r.resources?.length) {
      rows.push(
        "| Wechselrunde | Geometrien | Texturen | Shaderprogramme | Hochgeladene Geländekacheln | JS-Heap |",
        "|---|---:|---:|---:|---:|---|",
      );
      r.resources.forEach((s, i) =>
        rows.push(
          "| " +
            [
              i + 1,
              s.geometries,
              s.textures,
              s.programs,
              s.uploadedTiles,
              mb(s.heapBytes),
            ].join(" | ") +
            " |",
        ),
      );
      rows.push("");
    }
    for (const key of ["Smartboard", "iPad"]) {
      const d = r[key];
      if (d)
        rows.push(
          "Das emulierte " +
            key +
            "-Profil wurde bei " +
            d.viewport.w +
            " × " +
            d.viewport.h +
            " CSS-Pixeln bedient. " +
            "Die freie Modellfläche betrug " +
            Math.round(d.unobstructed * 100) +
            " %.",
          "",
        );
    }
    if (r.failureRecovery)
      rows.push(
        "Bei absichtlich beschädigtem Höhenraster blieb die regionale Orientierung sichtbar. Nach dem erneuten Aufruf erreichte dieselbe Sitzung wieder das örtliche Gelände.",
        "",
      );
    if (r.errors?.length)
      rows.push(
        "Beobachtete Browserfehler",
        "",
        ...r.errors.map((e) => "- " + e),
        "",
      );
    if (r.checks?.length)
      rows.push(
        "### Abgeschlossene Prüfungen",
        "",
        ...r.checks.map((s) => "- " + s),
        "",
      );
    if (r.video)
      rows.push(
        "Die zusammenhängende Bedienaufzeichnung in `bedienung.webm` dauert " +
          r.video.seconds.toFixed(1) +
          " s. Der mittlere Farbkanalabstand zwischen dem dekodierten Schlussbild und der aufgenommenen Globusreferenz beträgt " +
          r.video.lastFrameMeanChannelError.toFixed(2) +
          " auf einer Skala bis 255.",
        "",
      );
    if (report.failure) {
      rows.push(
        "Der Durchgang enthält einen Prüffehler. Den Fehlertext und den zuletzt beobachteten Zustand enthält das JSON-Protokoll.",
        "",
      );
    }
  }
  return rows.join("\n") + "\n";
}
async function still(page) {
  await page.evaluate(async () => {
    let previous,
      stable = 0;
    const start = performance.now();
    while (performance.now() - start < 24000) {
      await new Promise(requestAnimationFrame);
      const w = window.geoObservatory(),
        values = [
          w.lat,
          w.lon,
          w.d,
          w.tilt,
          w.bearing,
          w.nyos.focusHeightKm ?? 0,
        ];
      if (
        !w.flying &&
        previous &&
        values.every((v, i) => Math.abs(v - previous[i]) < 0.0006)
      )
        stable++;
      else stable = 0;
      if (stable >= 2) return;
      previous = values;
    }
    throw Error("Kamera findet keine stabile Vergleichspose");
  });
}
async function overlayCycle(page, selector, visibleField) {
  // Consecutive frames from the same render buffer. Exclude UI and camera motion.
  const comparisons = [];
  for (let attempt = 0; attempt < 4; attempt++) {
    const frames = await page.evaluate(
      async ({ selector, visibleField }) => {
        const canvas = document.getElementById("earth"),
          copy = document.createElement("canvas");
        copy.width = 720;
        copy.height = Math.round(
          (copy.width * canvas.clientHeight) / canvas.clientWidth,
        );
        const ctx = copy.getContext("2d"),
          captures = [];
        for (let i = 0; i < 4; i++) {
          if (i >= 2) document.querySelector(selector).click();
          const frame = await new Promise((resolve) =>
            requestAnimationFrame(() => {
              const w = window.geoObservatory();
              ctx.drawImage(canvas, 0, 0, copy.width, copy.height);
              resolve({
                width: canvas.width,
                height: canvas.height,
                png: copy.toDataURL(),
                visible: visibleField
                  .split(".")
                  .reduce((obj, k) => obj?.[k], w.nyos),
                mode: w.nyos.view,
              });
            }),
          );
          captures.push(frame);
        }
        return captures;
      },
      { selector, visibleField },
    );
    if (
      !frames.every(
        (s) => s.width === frames[0].width && s.height === frames[0].height,
      )
    )
      continue;
    assert.deepEqual(
      frames.map((s) => s.visible),
      [false, false, true, false],
    );
    const [previous, off, on, restored] = frames.map((s) =>
      PNG.sync.read(Buffer.from(s.png.split(",")[1], "base64")),
    );
    const added = difference(off, on),
      removed = difference(on, restored),
      drift = difference(off, restored),
      baselineDrift = difference(previous, off);
    comparisons.push({ added, removed, drift, baselineDrift });
    // A section can finish uploading terrain, or update its below-surface focus,
    // after the geographic camera has arrived. Compare again on that settled scene.
    if (
      drift >= Math.min(added, removed) * 0.65 ||
      baselineDrift >= Math.min(added, removed) * 0.4
    ) {
      await still(page);
      continue;
    }
    assert.ok(
      added > 0.00045 && removed > 0.00045,
      "Overlay bleibt beim Schalten unsichtbar: " +
        selector +
        " " +
        JSON.stringify(comparisons),
    );
    return {
      added,
      removed,
      drift,
      baselineDrift,
      width: frames[0].width,
      height: frames[0].height,
    };
  }
  throw Error(
    "Keine stabile reversible Pixel-Gegenprobe für " +
      selector +
      " " +
      JSON.stringify(comparisons),
  );
}
async function checkSection(p, run, snap) {
  const surface = await raster(p);
  await p.tap("#nyos-section");
  await p.waitForFunction(() => {
    const w = window.geoObservatory();
    return w.nyos.view === "section" && w.nyos.sectionVisible && !w.flying;
  });
  await still(p);
  assert.equal((await diag(p)).nyos.dissolvedVisible, false);
  assert.match(await p.locator("body").innerText(), /schematisch|vereinfacht/i);
  const exposed = await raster(p);
  assert.ok(difference(surface, exposed) > 0.015);
  await snap("05-seequerschnitt");
  const b = await p.locator("#earth").boundingBox(),
    start = await diag(p);
  await p.mouse.move(b.x + b.width * 0.62, b.y + b.height * 0.5);
  await p.mouse.down({ button: "right" });
  await p.mouse.move(b.x + b.width * 0.68, b.y + b.height * 0.53, { steps: 5 });
  await p.mouse.up({ button: "right" });
  await p.waitForFunction(
    (previous) => Math.abs(window.geoObservatory().bearing - previous) > 3,
    start.bearing,
  );
  await p.tap("#in");
  await still(p);
  await snap("06-wasserschichtung");
  run.sectionOverlay = await overlayCycle(
    p,
    "#nyos-dissolved",
    "dissolvedVisible",
  );
  await p.tap("#nyos-dissolved");
  await painted(p);
  const text = await p.locator("body").innerText();
  assert.match(text, /gelöst/i);
  assert.match(text, /Farbe|Färbung|Analyse|Einfärbung/i);
  await snap("07-geloestes-co2");
  const w = await diag(p);
  assert.ok(
    w.nyos.sectionVisible &&
      w.nyos.dissolvedVisible &&
      w.nyos.supplyVisible &&
      !w.flying,
  );
  assert.ok(
    w.nyos.depthM >= 207 &&
      w.nyos.depthM <= 211 &&
      w.nyos.profileSpanKm > 0.8 &&
      w.nyos.profileSpanKm < 2.8,
  );
  assert.equal(w.nyos.playing, false);
  run.section = {
    depthM: w.nyos.depthM,
    spanKm: w.nyos.profileSpanKm,
    frameChange: difference(surface, exposed),
  };

  await p.tap("#nyos-lake");
  await settled(p);
  assert.equal((await diag(p)).nyos.sectionVisible, false);
}

async function pauseAt(p, target) {
  // Use the public playback button. Stopping on the frame crossing the target keeps
  // the short surface-release phase reproducible on both fast and slow renderers.
  await p.tap("#nyos-play");
  const stopped = await p.evaluate(
    (target) =>
      new Promise((resolve, reject) => {
        const start = performance.now();
        function step() {
          const n = window.geoObservatory().nyos;
          if (n.progress >= target) {
            if (n.playing) document.getElementById("nyos-play").click();
            resolve(window.geoObservatory().nyos.progress);
            return;
          }
          if (performance.now() - start > 110000) {
            reject(Error("Ereignisphase nicht erreicht: " + target));
            return;
          }
          requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      }),
    target,
  );
  await painted(p);
  assert.equal((await diag(p)).nyos.playing, false);
  assert.equal((await diag(p)).nyos.progress, stopped);
  return stopped;
}
async function checkEvent(p, run, snap) {
  await p.tap("#nyos-event");
  await p.waitForFunction(() => {
    const w = window.geoObservatory();
    return w.nyos.view === "event" && !w.flying;
  });
  let n = (await diag(p)).nyos;
  assert.equal(n.progress, 0);
  assert.equal(n.playing, false);
  assert.equal(n.air, false);
  assert.ok(
    !n.eventVisual.risingWater &&
      n.eventVisual.freeBubbles === 0 &&
      !n.eventVisual.surfaceRelease &&
      !n.eventVisual.reliefAnalysis,
  );
  assert.match(await p.locator("body").innerText(), /1986/);
  await p.tap("#nyos-slow");
  assert.ok((await diag(p)).nyos.slow);
  await pauseAt(p, 0.19);
  n = (await diag(p)).nyos;
  assert.ok(n.eventVisual.risingWater && n.eventVisual.freeBubbles === 0);
  await p.tap("#nyos-slow");
  assert.equal((await diag(p)).nyos.slow, false);
  await pauseAt(p, 0.42);
  n = (await diag(p)).nyos;
  assert.ok(
    n.eventVisual.risingWater &&
      n.eventVisual.freeBubbles > 0 &&
      !n.eventVisual.surfaceRelease,
  );
  const first = await raster(p);
  await snap("08-beginn-der-freisetzung");
  await pauseAt(p, 0.585);
  n = (await diag(p)).nyos;
  assert.ok(
    n.eventVisual.surfaceRelease &&
      n.eventVisual.freeBubbles > 0 &&
      !n.eventVisual.reliefAnalysis,
  );
  const atSurface = await raster(p);
  assert.ok(
    difference(first, atSurface) > 0.0002,
    "Oberflächenaustritt verändert das Modellbild nicht",
  );
  await snap("09-austritt-am-see");
  await pauseAt(p, 0.81);
  n = (await diag(p)).nyos;
  assert.ok(
    !n.eventVisual.risingWater &&
      !n.eventVisual.surfaceRelease &&
      n.eventVisual.freeBubbles === 0 &&
      !n.eventVisual.reliefAnalysis,
  );
  await still(p);
  run.airOverlay = await overlayCycle(
    p,
    "#nyos-air",
    "eventVisual.reliefAnalysis",
  );
  await p.tap("#nyos-air");
  await painted(p);
  const text = await p.locator("body").innerText();
  assert.match(text, /Analys|schematis/i);
  assert.match(text, /farblos|unsichtbar/i);
  assert.doesNotMatch(text, /ppm|Vol\.?-?%|Gefahrengrenze bei|tödlich ab/i);
  await snap("10-ausbreitung-im-tal");
  await p.tap("#nyos-play");
  run.cadence.Freisetzung = await measureCadence(p);
  await p.waitForFunction(
    () => {
      const n = window.geoObservatory().nyos;
      return n.progress === 1 && !n.playing;
    },
    null,
    { timeout: 65000 },
  );
  const history = p.locator("#nyos-historic-places");
  await history.locator("summary").focus();
  await p.keyboard.press("Enter");
  assert.equal(await history.evaluate((el) => el.open), true);
  const places = await history.innerText();
  for (const name of ["Nyos", "Cha", "Subum"])
    assert.match(places, new RegExp(name, "i"));
  await p.keyboard.press("Enter");
  await p.tap("#nyos-reset");
  await settled(p);
  const reset = (await diag(p)).nyos;
  assert.equal(reset.progress, 0);
  assert.equal(reset.playing, false);
  assert.equal(reset.eventVisual.freeBubbles, 0);
  assert.equal(reset.eventVisual.reliefAnalysis, false);
  assert.ok(reset.sectionVisible);
}
async function checkProtection(p, run, snap) {
  await p.tap("#nyos-protection");
  await p.waitForFunction(() => {
    const w = window.geoObservatory();
    return !w.flying && w.nyos.view === "protection" && w.nyos.pipeVisible;
  });
  assert.equal(await p.inputValue("#nyos-measure"), "pipe");
  let n = (await diag(p)).nyos;
  assert.ok(
    n.protectionVisible && n.sectionVisible && n.progress === 0 && !n.playing,
  );
  assert.ok(
    !n.pipeFlowVisible &&
      !n.controlledVentVisible &&
      !n.monitorVisible &&
      !n.settlementVisible,
  );
  const initial = n.remainingDissolved;
  assert.ok(initial > 0);
  assert.match(
    await p.locator("#sidebar").innerText(),
    /nach 1986|später|2001/i,
  );
  assert.equal(await p.locator("#nyos-dissolved").isChecked(), false);
  assert.equal(n.dissolvedVisible, false);
  await still(p);
  run.pipeOverlay = await overlayCycle(
    p,
    "#nyos-dissolved",
    "dissolvedVisible",
  );
  await p.locator("#nyos-dissolved").check();
  await painted(p);
  const resting = await raster(p);
  await pauseAt(p, 0.12);
  n = (await diag(p)).nyos;
  assert.ok(n.pipeFlowVisible && !n.controlledVentVisible);
  await pauseAt(p, 0.65);
  n = (await diag(p)).nyos;
  assert.ok(
    n.pipeVisible &&
      n.pipeFlowVisible &&
      n.controlledVentVisible &&
      n.dissolvedVisible,
  );
  assert.ok(
    n.remainingDissolved < initial &&
      n.remainingDissolved > 0 &&
      !n.eventVisual.reliefAnalysis,
  );
  const changed = difference(resting, await raster(p));
  assert.ok(
    changed > 0.0002,
    "Kontrollierte Entgasung erzeugt kein sichtbares Modellbild",
  );
  await snap("11-kontrollierte-entgasung");
  await p.tap("#nyos-play");
  run.cadence.Entgasung = await measureCadence(p);
  await p.tap("#nyos-reset");
  await settled(p);
  await painted(p);
  n = (await diag(p)).nyos;
  assert.ok(
    n.progress === 0 &&
      n.remainingDissolved === initial &&
      !n.pipeFlowVisible &&
      !n.controlledVentVisible,
  );
  const alternatives = {};
  for (const measure of ["monitor", "settlements"]) {
    await p.selectOption("#nyos-measure", measure);
    await p.waitForFunction((choice) => {
      const w = window.geoObservatory(),
        n = w.nyos;
      return (
        !w.flying &&
        n.view === "protection" &&
        n.measure === choice &&
        (choice === "monitor" ? n.monitorVisible : n.settlementVisible)
      );
    }, measure);
    const state = (await diag(p)).nyos;
    assert.ok(
      !state.pipeVisible &&
        !state.pipeFlowVisible &&
        !state.controlledVentVisible &&
        !state.eventVisual.reliefAnalysis,
    );
    assert.equal(state.monitorVisible, measure === "monitor");
    assert.equal(state.settlementVisible, measure === "settlements");
    assert.equal(await p.locator("#nyos-play:visible").count(), 0);
    const caption = await p.locator("#sidebar").innerText();
    assert.doesNotMatch(
      caption,
      /beste Maßnahme|richtige Antwort|Sieger|Punktestand/i,
    );
    if (measure === "settlements") {
      const pins = p.locator("#nyosRelief span:visible");
      await p.waitForFunction(() =>
        ["nyos-Talboden", "nyos-Hang"].every((id) => {
          const el = document.getElementById(id);
          return el && !el.hidden && el.getClientRects().length > 0;
        }),
      );
      const names = await pins.allTextContents();
      assert.deepEqual(names.map((s) => s.trim()).sort(), ["Hang", "Talboden"]);
    }
    alternatives[measure] = { caption, image: pictureStats(await raster(p)) };
  }
  run.protection = { change: changed, alternatives };
  await p.tap("#nyos-event");
  await settled(p);
  await painted(p);
  n = (await diag(p)).nyos;
  assert.ok(
    n.progress === 0 &&
      !n.protectionVisible &&
      !n.pipeVisible &&
      !n.monitorVisible &&
      !n.settlementVisible,
  );
  assert.equal(n.remainingDissolved, null);
}

async function checkRevisits(p, run, snap) {
  for (let cycle = 0; cycle < 4; cycle++) {
    for (const state of ["lake", "section", "event", "protection"]) {
      await p.tap("#nyos-" + state);
      await p.waitForFunction((expected) => {
        const w = window.geoObservatory();
        return w.mode === "nyos" && w.nyos.view === expected && !w.flying;
      }, state);
    }
    await painted(p);
    const w = await diag(p);
    run.resources.push({
      geometries: w.geometries,
      textures: w.textures,
      programs: w.programs,
      uploadedTiles: w.uploadedTiles,
      heapBytes: await p.evaluate(
        () => performance.memory?.usedJSHeapSize ?? null,
      ),
    });
  }
  const warm = run.resources.slice(1),
    base = warm[0];
  assert.ok(
    warm.every(
      (s) =>
        s.geometries - s.uploadedTiles <=
          base.geometries - base.uploadedTiles + 8 &&
        s.textures <= base.textures + 2 &&
        s.programs <= base.programs + 1,
    ),
    "Zusätzliche GPU-Objekte nach warmen Wiederholungen",
  );
  await p.tap("#nav-inside");
  await settled(p);
  assert.equal((await diag(p)).mode, "inside");
  assert.doesNotMatch(
    await p.locator("#sidebar").innerText(),
    /Erdkern|Erdkruste|Erdmantel/i,
  );
  await p.tap("#labels");
  assert.match(await p.locator("#sidebar").innerText(), /Kern|Kruste|Mantel/i);
  await p.tap("#labels");
  await p.tap("#nav-plates");
  await settled(p);
  await p.locator("#boundaries").check();
  await p.waitForFunction(() => {
    const w = window.geoObservatory();
    return w.mode === "plates" && w.tectonics.ready && w.tectonics.boundaries;
  });
  await p.locator("#boundaries").uncheck();
  await p.tap("#nav-place");
  await settled(p);
  const choices = await p
    .locator("#siteSelect option")
    .evaluateAll((options) => options.map((o) => o.value));
  for (const id of ["hooge", "helgoland", "island", "japan", "san", "nyos"])
    assert.ok(choices.includes(id), id);
  await p.selectOption("#siteSelect", "nyos");
  await settled(p);
  assert.equal((await diag(p)).mode, "nyos");
  await p.tap("#nav-globe");
  await settled(p);
  await painted(p);
  const earth = await diag(p);
  assert.ok(
    earth.mode === "globe" &&
      earth.d > 8000 &&
      !earth.nyos.terrainVisible &&
      !earth.nyos.sectionVisible,
  );
  assert.ok((await p.locator("#nyos-event").count()) === 0);
  await snap("12-rueckkehr-zur-erde");
}

async function deviceProfile(browser, type) {
  const board = type === "Smartboard",
    viewport = board
      ? { width: 1920, height: 1080 }
      : { width: 820, height: 1180 };
  const ctx = await browser.newContext({
    viewport,
    hasTouch: true,
    isMobile: !board,
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const p = await ctx.newPage();
  p.setDefaultTimeout(60000);
  const errors = [];
  errorsOn(p, errors);
  try {
    await p.addInitScript(() => {
      window.nyosTouch = { starts: 0, pointers: 0 };
      addEventListener(
        "touchstart",
        (event) => {
          if (event.isTrusted) window.nyosTouch.starts++;
        },
        true,
      );
      addEventListener(
        "pointerdown",
        (event) => {
          if (event.isTrusted && event.pointerType === "touch")
            window.nyosTouch.pointers++;
        },
        true,
      );
    });
    await p.goto(url);
    await settled(p);
    if (board) await p.tap("#present");
    await p.tap("#nav-nyos");
    await p.waitForFunction(() => {
      const w = window.geoObservatory();
      return w.nyos.ready && w.nyos.localWeight > 0.9 && !w.flying;
    });
    await p.tap("#nyos-section");
    await settled(p);
    await p.tap("#nyos-dissolved");
    await painted(p);
    assert.ok((await diag(p)).nyos.dissolvedVisible);
    const layout = await p.evaluate(() => {
      const viewport = { w: innerWidth, h: innerHeight },
        canvas = document.getElementById("earth").getBoundingClientRect();
      const panel = document.getElementById("sidebar").getBoundingClientRect();
      const overlap =
        Math.max(
          0,
          Math.min(canvas.right, panel.right) -
            Math.max(canvas.left, panel.left),
        ) *
        Math.max(
          0,
          Math.min(canvas.bottom, panel.bottom) -
            Math.max(canvas.top, panel.top),
        );
      const controls = [
        "nyos-section",
        "nyos-lake",
        "nyos-event",
        "nyos-protection",
      ].map((id) => {
        const b = document.getElementById(id).getBoundingClientRect();
        return { id, x: b.x, y: b.y, width: b.width, height: b.height };
      });
      return {
        viewport,
        controls,
        scrollWidth: document.documentElement.scrollWidth,
        canvasHeight: canvas.height,
        unobstructed:
          (canvas.width * canvas.height - overlap) / (innerWidth * innerHeight),
        touchPoints: navigator.maxTouchPoints,
        events: window.nyosTouch,
        fullscreenMode: document
          .getElementById("present")
          .getAttribute("aria-pressed"),
      };
    });
    assert.ok(
      layout.events.starts + layout.events.pointers >= 1,
      type +
        " hat keine vertrauenswürdigen Touch-Ereignisse empfangen: " +
        JSON.stringify(layout),
    );
    assert.deepEqual(
      layout.viewport,
      { w: viewport.width, h: viewport.height },
      type + " erreicht den vorgegebenen Browserausschnitt nicht",
    );
    assert.ok(
      layout.scrollWidth <= layout.viewport.w + 1,
      type + " hat horizontalen Überlauf: " + JSON.stringify(layout),
    );
    assert.ok(
      layout.unobstructed > (board ? 0.7 : 0.34),
      "Modellfläche " + type,
    );
    if (board) {
      assert.equal(layout.fullscreenMode, "true");
      assert.ok(
        layout.controls.every(
          (c) =>
            c.height >= 59 &&
            c.width >= 50 &&
            c.y >= 0 &&
            c.y + c.height <= viewport.height,
        ),
      );
    } else {
      assert.ok(layout.controls.every((c) => c.width >= 44 && c.height >= 44));
      await p.tap("#nyos-lake");
      await p.tap("#nyos-section");
      await p.tap("#nyos-dissolved");
    }
    assert.deepEqual(errors, []);
    return layout;
  } finally {
    await ctx.close();
  }
}
async function missingDem(browser, run) {
  const ctx = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    hasTouch: true,
    reducedMotion: "reduce",
  });
  const p = await ctx.newPage();
  p.setDefaultTimeout(45000);
  try {
    await p.route("**/nyos/elevation.i16", (route) =>
      route.fulfill({ status: 200, body: Buffer.from([10, 0, 11]) }),
    );
    await p.goto(url);
    await settled(p);
    await p.tap("#nav-nyos");
    await p.waitForFunction(() => {
      const w = window.geoObservatory();
      return (
        w.mode === "nyos" &&
        !!w.nyos.error &&
        !w.flying &&
        w.d > 50 &&
        w.d < 6500
      );
    });
    const fallback = await diag(p);
    assert.ok(!fallback.nyos.ready && !fallback.nyos.terrainVisible);
    await p.locator("#status").filter({ hasText: /Nyos.*fehl|Nyos.*Ersatz/i }).waitFor({ state: "visible" });
    await painted(p);
    pictureStats(await raster(p));
    await p.unroute("**/nyos/elevation.i16");
    assert.match(await p.locator("#nyos-near").innerText(), /erneut/i);
    await p.tap("#nyos-near");
    await p.waitForFunction(() => {
      const w = window.geoObservatory();
      return w.nyos.ready && w.nyos.localWeight > 0.8 && !w.flying;
    });
    const recovery = await diag(p);
    assert.ok(recovery.nyos.terrainVisible && recovery.d < 20);
    await p.tap("#nav-globe");
    await settled(p);
    assert.equal((await diag(p)).mode, "globe");
    run.failureRecovery = { fallbackKm: fallback.d, recoveredKm: recovery.d };
  } finally {
    await ctx.close();
  }
}
async function recordDemo(browser) {
  const storage = await mkdtemp(join(tmpdir(), "georisiko-nyos-film-"));
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    hasTouch: true,
    recordVideo: { dir: storage, size: { width: 1024, height: 640 } },
  });
  try {
    const p = await ctx.newPage(),
      video = p.video();
    p.setDefaultTimeout(80000);
    await p.goto(url);
    await settled(p);
    await painted(p);
    await p.tap("#nav-nyos");
    await p.waitForFunction(() => {
      const w = window.geoObservatory();
      return w.nyos.ready && !w.flying && w.nyos.localWeight > 0.8;
    });
    await p.emulateMedia({ reducedMotion: "reduce" });
    await p.tap("#nyos-overview");
    await settled(p);
    await p.waitForTimeout(900);
    await p.tap("#nyos-section");
    await settled(p);
    await p.waitForTimeout(900);
    await p.tap("#nyos-dissolved");
    await painted(p);
    await p.waitForTimeout(900);
    await p.tap("#nyos-event");
    await settled(p);
    await p.tap("#nyos-play");
    await p.waitForFunction(
      () => window.geoObservatory().nyos.progress >= 0.57,
    );
    await p.tap("#nyos-air");
    await p.waitForFunction(
      () => window.geoObservatory().nyos.progress >= 0.89,
    );
    await p.tap("#nyos-play");
    await painted(p);
    await p.waitForTimeout(1100);
    await p.tap("#nyos-protection");
    await settled(p);
    await p.tap("#nyos-dissolved");
    await pauseAt(p, 0.44);
    await p.waitForTimeout(900);
    await p.selectOption("#nyos-measure", "monitor");
    await settled(p);
    await p.waitForTimeout(900);
    await p.selectOption("#nyos-measure", "settlements");
    await p.waitForFunction(
      () =>
        window.geoObservatory().nyos.settlementVisible &&
        !window.geoObservatory().flying,
    );
    await painted(p);
    await p.waitForTimeout(1200);
    await p.tap("#nav-globe");
    await p.waitForFunction(() => {
      const view = window.geoObservatory();
      return view.mode === "globe" && view.d > 8000 && !view.flying;
    });
    // Let Chromium present the final globe to both the compositor and video encoder.
    const finalFrame = await p.screenshot({ type: "png" });
    await p.evaluate(async () => {
      const started = performance.now();
      let count = 0;
      while (performance.now() - started < 4000 || count < 12) {
        await new Promise(requestAnimationFrame);
        count++;
      }
    });
    await ctx.close();
    await video.saveAs(join(dest, "bedienung.webm"));
    const videoBytes = await readFile(join(dest, "bedienung.webm"));
    assert.ok(
      videoBytes.length > 30000 &&
        videoBytes.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163])),
      "Eigenständige WebM-Bedienaufzeichnung",
    );
    const viewer = await browser.newPage();
    let comparison;
    try {
      comparison = await viewer.evaluate(
        async ({ film, reference }) => {
          const photo = new Image();
          photo.src = "data:image/png;base64," + reference;
          await photo.decode();
          const video = document.createElement("video");
          video.src = "data:video/webm;base64," + film;
          await new Promise((resolve, reject) => {
            video.onloadedmetadata = resolve;
            video.onerror = () =>
              reject(Error("WebM enthält keine lesbaren Videometadaten"));
          });
          const duration = video.duration;
          if (!Number.isFinite(duration) || duration < 2)
            throw Error("Ungültige Filmdauer " + duration);
          const sought = new Promise((resolve, reject) => {
            video.onseeked = resolve;
            video.onerror = reject;
          });
          video.currentTime = duration - 0.16;
          await sought;
          const canvas = document.createElement("canvas");
          canvas.width = 160;
          canvas.height = 100;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          const pixels = (source) => {
            ctx.drawImage(source, 0, 0, 160, 100);
            return ctx.getImageData(0, 0, 160, 100).data;
          };
          const first = pixels(photo),
            last = pixels(video);
          let error = 0;
          for (let i = 0; i < last.length; i++)
            if (i % 4 !== 3) error += Math.abs(first[i] - last[i]);
          return {
            seconds: duration,
            lastFrameMeanChannelError: error / (160 * 100 * 3),
          };
        },
        {
          film: videoBytes.toString("base64"),
          reference: finalFrame.toString("base64"),
        },
      );
      assert.ok(
        comparison.lastFrameMeanChannelError < 12,
        "Das letzte Videobild zeigt die zurückgekehrte Erde nicht: " +
          JSON.stringify(comparison),
      );
    } finally {
      await viewer.close();
    }
    return {
      ...comparison,
      bytes: videoBytes.length,
      sha256: createHash("sha256").update(videoBytes).digest("hex"),
    };
  } finally {
    await ctx.close();
    await rm(storage, { recursive: true, force: true });
  }
}

async function exercise(browser, engine) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    hasTouch: true,
  });
  const p = await ctx.newPage();
  p.setDefaultTimeout(65000);
  const run = {
    engine,
    version: browser.version(),
    checks: [],
    errors: [],
    images: [],
    cadence: {},
    resources: [],
  };
  report.runs.push(run);
  errorsOn(p, run.errors);
  const pass = (s) => {
    run.checks.push(s);
    console.log(engine, s);
  };
  const snap = async (name) => {
    if (engine !== "chromium") return;
    const shot = await p.screenshot({
      path: join(dest, name + ".jpg"),
      type: "jpeg",
      quality: 88,
    });
    const hash = createHash("sha256").update(shot).digest("hex");
    assert.ok(
      !run.images.some((s) => s.hash === hash),
      name + " zeigt denselben Zustand",
    );
    const w = await diag(p);
    run.images.push({ name, hash, mode: w.mode, d: w.d, nyos: w.nyos });
  };
  try {
    await p.goto(url);
    await settled(p);
    assert.equal((await diag(p)).style, "A");
    await flightTrace(p, true);
    await p.tap("#nav-nyos");
    await snap("01-nyos-auf-dem-globus");
    await p.waitForFunction(() => {
      const w = window.geoObservatory();
      return w.flying && w.d < 2200 && w.d > 300;
    });
    await snap("02-anflug-kamerun");
    await p.waitForFunction(
      () => {
        const w = window.geoObservatory();
        return (
          !w.flying &&
          w.mode === "nyos" &&
          w.nyos.ready &&
          w.nyos.localWeight > 0.8
        );
      },
      null,
      { timeout: 100000 },
    );
    await painted(p);
    run.flight = auditFlight(await flightTrace(p, false));
    const w = await diag(p);
    assert.ok(Math.abs(w.lat - 6.44) < 0.04 && angular(w.lon, 10.3) < 0.04);
    assert.ok(w.d < 20 && w.nyos.cameraClearanceKm > 0 && w.triangles > 1000);
    run.landscape = pictureStats(await raster(p));
    await p.emulateMedia({ reducedMotion: "reduce" });
    await p.tap("#nyos-overview");
    await settled(p);
    const regional = await diag(p);
    assert.ok(regional.d > w.d * 1.5);
    await snap("03-regionale-landschaft");
    await p.tap("#nyos-near");
    await settled(p);
    await snap("04-nyos-see");
    run.cadence.See = await measureCadence(p);
    assert.deepEqual(run.errors, []);
    pass(
      "Gate A · Kamerafahrt vom Globus zum geographisch verankerten See, regionales Bild und lokales 3D-Relief",
    );
    if (gate === "A") return;
    await checkSection(p, run, snap);
    pass(
      "Gate B · räumlicher schematischer Seequerschnitt, Kameradrehung und reversible Färbung des gelösten CO₂",
    );
    if (gate === "B") return;
    await checkEvent(p, run, snap);
    assert.deepEqual(run.errors, []);
    pass(
      "Gate C · aufsteigendes Wasser, Entlösung, Oberflächenaustritt und zuschaltbare qualitative Talansicht; Pause, Zeitlupe und Reset",
    );
    if (gate === "C") return;
    await checkProtection(p, run, snap);
    assert.deepEqual(run.errors, []);
    pass(
      "Gate D · spätere Schutzsituation, kontrollierte Rohrströmung, Überwachung und räumliche Vorsorge",
    );
    if (gate === "D") return;
    await checkRevisits(p, run, snap);
    assert.deepEqual(run.errors, []);
    pass(
      "Gate E · wiederholte Ansichtswechsel und Ressourcen, anonymer Schalenschnitt, Plattenatlas und Rückweg zum Globus",
    );
  } catch (error) {
    console.error(
      engine,
      "Letzte Ansicht",
      JSON.stringify(await diag(p).catch(() => null)),
      await p
        .locator("#status")
        .innerText()
        .catch(() => ""),
    );
    throw error;
  } finally {
    await ctx.close();
  }
}
try {
  report.geography = await checkGeography();
  for (const engine of (process.env.TEST_ENGINES ?? "chromium,webkit").split(
    ",",
  )) {
    assert.ok(["webkit", "chromium"].includes(engine));
    const browser = await (engine === "chromium" ? chromium : webkit).launch({
      executablePath:
        process.env[engine === "chromium" ? "CHROMIUM_PATH" : "WEBKIT_PATH"] ||
        undefined,
      args:
        engine === "chromium"
          ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
          : [],
    });
    try {
      await exercise(browser, engine);
      if (gate === "E") {
        const run = report.runs.at(-1);
        await missingDem(browser, run);
        run.Smartboard = await deviceProfile(browser, "Smartboard");
        run.iPad = await deviceProfile(browser, "iPad");
        if (engine === "chromium") run.video = await recordDemo(browser);
      }
    } finally {
      await browser.close();
    }
  }
} catch (error) {
  report.failure = String(error.stack ?? error);
  console.error(error);
  process.exitCode = 1;
} finally {
  await writeFile(join(dest, "pruefung.json"), JSON.stringify(report, null, 2));
  await writeFile(join(dest, "Messbericht.md"), reportText());
  await server.close();
}
