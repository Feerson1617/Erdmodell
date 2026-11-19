import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { preview } from "vite";
import { chromium, webkit } from "playwright";

const dest = "test-results/vergleich",
  baseline = "441f1480b6fc1d65faf5ef5b06882ccdc6775656";
const candidate = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
await mkdir(dest, { recursive: true });
const stages = [
  "Schalen anonym",
  "Schalen mit Namen",
  "Japan ohne Namen",
  "Japan mit Namen",
  "Schnelle Drehung",
  "Prozessmodell wechseln",
  "Definition öffnen und schließen",
];
const hz = Number(execFileSync("getconf", ["CLK_TCK"], { encoding: "utf8" }));
async function processTicks(root) {
  const stats = new Map();
  for (const id of await readdir("/proc")) {
    if (!/^\d+$/.test(id)) continue;
    try {
      const raw = await readFile("/proc/" + id + "/stat", "utf8");
      const fields = raw.slice(raw.lastIndexOf(")") + 2).split(" ");
      stats.set(+id, { ppid: +fields[1], ticks: +fields[11] + +fields[12] });
    } catch {
      /* A helper may exit during enumeration. */
    }
  }
  const family = new Set([root]);
  for (const pid of family)
    for (const [id, s] of stats) if (s.ppid === pid) family.add(id);
  return new Map(
    [...family]
      .filter((id) => stats.has(id))
      .map((id) => [id, stats.get(id).ticks]),
  );
}
const delta = (before, after) =>
  Object.fromEntries(
    Object.entries(after ?? {}).map(([k, v]) => [k, v - (before?.[k] ?? 0)]),
  );
const selectMetrics = async (session) => {
  if (!session) return null;
  const { metrics } = await session.send("Performance.getMetrics");
  return Object.fromEntries(
    metrics
      .filter((m) =>
        [
          "LayoutCount",
          "RecalcStyleCount",
          "ScriptDuration",
          "LayoutDuration",
          "TaskDuration",
        ].includes(m.name),
      )
      .map((m) => [m.name, m.value]),
  );
};
function gpuProbe() {
  let gl,
    ext,
    busy = false,
    last = -1;
  let pending = [],
    times = [];
  const original = requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (callback) =>
    original((t) => {
      if (!busy || !gl || !ext || t === last) return callback(t);
      last = t;
      const q = gl.createQuery();
      gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
      try {
        return callback(t);
      } finally {
        gl.endQuery(ext.TIME_ELAPSED_EXT);
        pending.push(q);
      }
    });
  window.startGpuProbe = () => {
    gl = document.querySelector("#earth").getContext("webgl2");
    ext = gl.getExtension("EXT_disjoint_timer_query_webgl2");
    busy = !!ext;
    times = [];
    return !!ext;
  };
  window.stopGpuProbe = async () => {
    busy = false;
    if (!ext) return null;
    for (let i = 0; i < 5 && pending.length; i++) {
      await new Promise(original);
      if (gl.getParameter(ext.GPU_DISJOINT_EXT)) {
        times = [];
        break;
      }
      pending = pending.filter((q) => {
        if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) return true;
        times.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
        gl.deleteQuery(q);
        return false;
      });
    }
    for (const q of pending) gl.deleteQuery(q);
    pending = [];
    return times;
  };
}
const state = (p) => p.evaluate(() => window.geoObservatory());
const waitModel = (p, id) =>
  p.waitForFunction((id) => {
    const w = window.geoObservatory?.();
    return (
      w?.ready &&
      !w.flying &&
      (!id || (w.tectonics.site === id && w.tectonics.reveal > 0.99))
    );
  }, id);
function footprint(w) {
  return {
    geometries: w.geometries,
    textures: w.textures,
    programs: w.programs,
    models: w.tectonics.models,
    drawCalls: w.draws,
    sceneTriangles: w.triangles,
    pixelRatio: w.pixelRatio,
    resolution: w.resolution,
  };
}
async function sample(p, stage, cdp, pid) {
  const start = await state(p),
    counters = await selectMetrics(cdp),
    cpu = await processTicks(pid);
  const t0 = performance.now();
  const data = await p.evaluate(async (stage) => {
    const host = document.querySelector("#desk");
    const dom = {
      labelInsertions: 0,
      labelRemovals: 0,
      labelAttributeWrites: 0,
    };
    const observer = new MutationObserver((rs) => {
      for (const r of rs) {
        if (!r.target.closest?.(".annotations")) continue;
        if (r.type === "attributes") dom.labelAttributeWrites++;
        else {
          dom.labelInsertions += r.addedNodes.length;
          dom.labelRemovals += r.removedNodes.length;
        }
      }
    });
    observer.observe(host, {
      subtree: true,
      attributes: true,
      childList: true,
    });
    const gpuAvailable = window.startGpuProbe();
    const raf = () => new Promise(requestAnimationFrame);
    let last = await raf(),
      opened = 0;
    const gaps = [];
    for (let i = 0; i < 36; i++) {
      if (stage === 4 && i % 2 === 0)
        document.querySelector("#orbitProcess").click();
      if (stage === 5 && i % 6 === 0) {
        const pick = document.querySelector("#tectonicSite");
        pick.value = ["island", "japan", "san", "japan", "island", "japan"][
          i / 6
        ];
        pick.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (stage === 6 && i % 3 === 0) {
        const def = document.querySelector("#definition");
        if (def.hidden) {
          const button = document.querySelector("#platePins button");
          if (button) {
            button.click();
            opened++;
          }
        } else def.querySelector("button").click();
      }
      const now = await raf();
      gaps.push(now - last);
      last = now;
    }
    observer.disconnect();
    return { gaps, dom, gpuAvailable, opened };
  }, stage);
  const elapsed = performance.now() - t0,
    endCpu = await processTicks(pid),
    end = await state(p),
    endCounters = await selectMetrics(cdp);
  const gpuMs = await p.evaluate(() => window.stopGpuProbe());
  const sorted = [...data.gaps].sort((a, b) => a - b);
  const ticks = [...endCpu].reduce(
    (sum, [id, v]) => sum + (cpu.has(id) ? Math.max(0, v - cpu.get(id)) : 0),
    0,
  );
  if (stage === 6) assert.ok(data.opened >= 4);
  const actualWork =
    !!start.tectonics.model?.work && !!end.tectonics.model?.work && stage !== 5;
  return {
    stage: stages[stage],
    ...data,
    fps: (1000 * sorted.length) / sorted.reduce((a, b) => a + b),
    medianMs: sorted[Math.floor(sorted.length / 2)],
    p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
    cpuPercent: (ticks / hz / (elapsed / 1000)) * 100,
    gpuMs,
    browserWork: cdp ? delta(counters, endCounters) : null,
    rockWork: actualWork
      ? delta(start.tectonics.model.work, end.tectonics.model.work)
      : null,
    domWork: start.annotationDom
      ? delta(start.annotationDom, end.annotationDom)
      : null,
    start: footprint(start),
    end: footprint(end),
  };
}
async function measure(engine, version, dir) {
  const server = await preview({
    configFile: false,
    base: "/vergleich/",
    build: { outDir: dir },
    preview: { host: "127.0.0.1", port: 0 },
    logLevel: "error",
  });
  const type = { chromium, webkit }[engine];
  const bs = await type.launchServer({
    executablePath:
      process.env[engine === "chromium" ? "CHROMIUM_PATH" : "WEBKIT_PATH"] ||
      undefined,
    args:
      engine === "chromium"
        ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
        : [],
  });
  try {
    const browser = await type.connect(bs.wsEndpoint());
    const context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
    });
    await context.addInitScript(gpuProbe);
    const p = await context.newPage(),
      cdp = engine === "chromium" ? await context.newCDPSession(p) : null;
    if (cdp) await cdp.send("Performance.enable");
    await p.goto(
      "http://127.0.0.1:" + server.httpServer.address().port + "/vergleich/",
    );
    await waitModel(p);
    const renderer = await p.evaluate(() => {
      const gl = document.querySelector("#earth").getContext("webgl2"),
        ext = gl.getExtension("WEBGL_debug_renderer_info");
      return gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
    });
    const run = {
      engine,
      version,
      browser: browser.version(),
      renderer,
      samples: [],
    };
    const take = async (n) => {
      run.samples.push(await sample(p, n, cdp, bs.process().pid));
    };
    await p.click("#nav-inside");
    await waitModel(p);
    await p.waitForTimeout(7000);
    await take(0);
    await p.click("#labels");
    await take(1);
    await p.click("#nav-plates");
    for (const site of ["island", "san", "japan"]) {
      await p.selectOption("#tectonicSite", site);
      await waitModel(p, site);
    }
    await p.check("#loopProcess");
    for (const n of [2, 3]) {
      if (n === 3) await p.check("#plateNames");
      await p.click("#playProcess");
      await p.waitForFunction(
        () => window.geoObservatory().tectonics.progress > 0.025,
      );
      await take(n);
      await p.click("#resetProcess");
    }
    await take(4);
    await take(5);
    await waitModel(p, "japan");
    await p.waitForSelector("#platePins button");
    await take(6);
    await context.close();
    return run;
  } finally {
    await bs.close();
    await server.close();
  }
}
const report = { baseline, candidate, runs: [] };
for (const engine of (process.env.TEST_ENGINES ?? "chromium,webkit").split(
  ",",
)) {
  const order = engine === "chromium" ? ["G4.2", "G4.2.1"] : ["G4.2.1", "G4.2"];
  for (const name of order) {
    const r = await measure(
      engine,
      name,
      name === "G4.2" ? ".scratch/g421-reference/dist" : "dist",
    );
    report.runs.push(r);
    console.log(
      engine,
      name,
      r.samples.map((s) => s.fps.toFixed(1)),
    );
    await writeFile(
      join(dest, "leistung.json"),
      JSON.stringify(report, null, 2),
    );
  }
}
const rows = [
  "# Leistungsvergleich G4.2 und G4.2.1",
  "",
  `Referenz \`${baseline}\`, Kandidat \`${candidate}\`.`,
  "",
  "Beide Produktionsbuilds liefen nacheinander auf demselben Linux-Runner je Browser. Bei 1366 × 768, DPR 1, identischer Kamera und regulärer dynamischer Auflösung wurden je 36 aufeinanderfolgende Bildintervalle erfasst. Die Geometrie wurde vor den Ortswechseln aufgewärmt. Diese kurzen Stichproben schwanken. CPU-Prozent beziehen sich auf einen logischen Kern und den Browserprozessbaum. GPU-Zeiten sind nur bei verfügbarem WebGL-Zeitgeber ausgewiesen. Die Auslastung einer physischen GPU war nicht messbar.",
  "",
];
for (const engine of new Set(report.runs.map((r) => r.engine))) {
  const runs = report.runs
    .filter((r) => r.engine === engine)
    .sort((a, b) => a.version.localeCompare(b.version));
  rows.push(
    "## " + engine + " " + runs[0].browser,
    "",
    runs[0].renderer,
    "",
    "| Szenario | G4.2 FPS | G4.2.1 FPS | G4.2 P95 ms | G4.2.1 P95 ms | CPU alt / neu % |",
    "|---|---:|---:|---:|---:|---:|",
  );
  for (let i = 0; i < stages.length; i++) {
    const [a, b] = runs.map((r) => r.samples[i]);
    rows.push(
      `| ${stages[i]} | ${a.fps.toFixed(1)} | ${b.fps.toFixed(1)} | ${a.p95Ms.toFixed(0)} | ${b.p95Ms.toFixed(0)} | ${a.cpuPercent.toFixed(0)} / ${b.cpuPercent.toFixed(0)} |`,
    );
  }
  const [switchOld, switchNew] = runs.map((r) => r.samples[5]);
  const resources = (s) =>
    [s.geometries, s.textures, s.programs, s.models].join(" / ");
  rows.push(
    "",
    "Ressourcen vor und nach sechs Ortswechseln (Geometrien / Texturen / Programme / regionale Modelle).",
    "",
    "| Stand | Vorher | Nachher |",
    "|---|---|---|",
    `| G4.2 | ${resources(switchOld.start)} | ${resources(switchOld.end)} |`,
    `| G4.2.1 | ${resources(switchNew.start)} | ${resources(switchNew.end)} |`,
  );
  const [a, b] = runs.map((r) => r.samples[3]);
  rows.push(
    "",
    `Japan mit Namen. Attributänderungen im Label-DOM ${a.dom.labelAttributeWrites} → ${b.dom.labelAttributeWrites}. ${b.rockWork.rays} Sichtstrahlen, ${b.rockWork.triangles} Dreieckstests und ${b.rockWork.reused} wiederverwendete Sichtentscheidungen über ${b.gaps.length} Bildintervalle. Die Referenz enthält keine internen Zähler für Sichtstrahlen. Puffer ${a.end.resolution.width} × ${a.end.resolution.height} und ${b.end.resolution.width} × ${b.end.resolution.height}.\n`,
  );
  rows.push(
    `Zugriffe bei laufender Japan-Animation mit Namen. Der Kandidat maß ${b.domWork.measures} Schildgrößen und erstellte ${b.domWork.creates} neue Schilder. Bei gleicher Sicht werden unveränderte Projektionen und Sichtentscheidungen wiederverwendet. Bewegte Anker und veränderte Oberflächen lösen neue Prüfungen aus.`,
  );
  if (b.browserWork)
    rows.push(
      `Chromium meldete für das gesamte Dokument ${a.browserWork.LayoutCount} → ${b.browserWork.LayoutCount} Layouts und ${a.browserWork.RecalcStyleCount} → ${b.browserWork.RecalcStyleCount} Stilneuberechnungen. Diese Werte umfassen auch die Wiedergabeanzeige.`,
    );
  if (!b.gpuMs?.length)
    rows.push(
      "Für dieses Szenario lieferte der WebGL-Zeitgeber keine verwertbare GPU-Messung.",
    );
  rows.push("");
}
rows.push(
  "Die JSON-Datei enthält Einzelintervalle, Ressourcenstände, CPU-Zeiten, verfügbare GPU-Zeiten sowie Chromium-Layout- und Skriptmetriken. Die WebKit-Rendererkennung eines Linux-Runners ist kein Nachweis für Apple-Silicon-Hardware.",
);
await writeFile(join(dest, "Leistungsvergleich.md"), rows.join("\n") + "\n");
