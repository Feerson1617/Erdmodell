import { chromium, webkit } from "playwright";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { PNG } from "pngjs";
import { execFileSync } from "node:child_process";
import { cpus } from "node:os";

const root = resolve("dist"),
  out = resolve("test-results");
await mkdir(out, { recursive: true });
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".webp": "image/webp",
  ".png": "image/png",
  ".woff2": "font/woff2",
};
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (!url.pathname.startsWith("/Erdmodell/")) throw Error();
    const path = resolve(
      root,
      "." +
        url.pathname.slice("/Erdmodell".length).replace(/\/$/, "/index.html"),
    );
    if (!path.startsWith(root + sep)) throw Error();
    res.setHeader(
      "Content-Type",
      mime[extname(path)] ?? "application/octet-stream",
    );
    res.end(await readFile(path));
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = "http://127.0.0.1:" + server.address().port + "/Erdmodell/";
const report = {
  date: new Date().toISOString(),
  commit: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  cpu: cpus()[0]?.model,
  platform: process.platform,
  scope: "Linux cloud browsers. Tablet is an emulation.",
  runs: [],
};
const diag = (p) => p.evaluate(() => window.geoObservatory());
const settled = (p) =>
  p.waitForFunction(
    () =>
      window.geoObservatory &&
      !window.geoObservatory().flying &&
      window.geoObservatory().frames > 2,
    {},
    { timeout: 45000 },
  );
async function visual(p, name, save) {
  const canvas = p.locator("#earth"),
    buf = await canvas.screenshot({ timeout: 30000 }),
    pic = PNG.sync.read(buf);
  const buckets = new Set();
  for (let y = Math.floor(pic.height * 0.27); y < pic.height * 0.7; y += 5)
    for (let x = Math.floor(pic.width * 0.37); x < pic.width * 0.63; x += 5) {
      const k = (y * pic.width + x) * 4;
      buckets.add([0, 1, 2].map((i) => pic.data[k + i] >> 3).join(","));
    }
  assert.ok(buckets.size > 15, "Rendered picture lacks colour detail: " + name);
  if (save)
    await p.screenshot({
      path: out + "/" + name + ".jpg",
      type: "jpeg",
      quality: 88,
      fullPage: true,
    });
  return pic;
}
function difference(a, b) {
  assert.equal(a.width, b.width);
  assert.equal(a.height, b.height);
  let different = 0;
  for (let i = 0; i < a.data.length; i += 16)
    if (
      Math.abs(a.data[i] - b.data[i]) +
        Math.abs(a.data[i + 1] - b.data[i + 1]) +
        Math.abs(a.data[i + 2] - b.data[i + 2]) >
      16
    )
      different++;
  return different / (a.data.length / 16);
}
async function run(engine) {
  const isChrome = engine === "chromium",
    impl = isChrome ? chromium : webkit;
  const browser = await impl.launch({
    executablePath:
      process.env[isChrome ? "CHROMIUM_PATH" : "WEBKIT_PATH"] || undefined,
    args: isChrome
      ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
      : [],
  });
  const run = {
    engine,
    version: browser.version(),
    checks: [],
    errors: [],
    console: [],
    loads: [],
    flights: [],
    metrics: [],
  };
  report.runs.push(run);
  const pass = (s) => {
    run.checks.push(s);
    console.log(engine, s);
  };
  try {
    const context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      deviceScaleFactor: 1,
    });
    const p = await context.newPage();
    p.setDefaultTimeout(20000);
    p.on("pageerror", (e) => run.errors.push(e.message));
    p.on("console", (m) => {
      if (["error", "warning"].includes(m.type()))
        run.console.push(m.type() + ": " + m.text().slice(0, 500));
    });
    p.on("response", (r) =>
      run.loads.push({ path: new URL(r.url()).pathname, status: r.status() }),
    );
    const start = Date.now();
    await p.goto(base);
    await settled(p);
    run.firstRenderMs = Date.now() - start;
    const initial = await diag(p);
    assert.ok(initial.draws > 0 && initial.triangles > 1000);
    run.renderer = await p.evaluate(() => {
      const gl = document.querySelector("canvas").getContext("webgl2"),
        e = gl.getExtension("WEBGL_debug_renderer_info");
      return e
        ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER);
    });
    await visual(p, "01-globus-a", isChrome);
    pass("Produktionsstart unter /Erdmodell/ und gerenderte Erdoberfläche");
    assert.equal(initial.style, "A");
    const box = await p.locator("#earth").boundingBox();
    const cx = box.x + box.width / 2,
      cy = box.y + box.height / 2;
    await p.mouse.move(cx, cy);
    await p.mouse.down();
    await p.mouse.move(cx + 80, cy + 22, { steps: 5 });
    await p.mouse.up();
    await p.waitForFunction(
      (lon) => Math.abs(window.geoObservatory().lon - lon) > 1,
      initial.lon,
    );
    await p.mouse.wheel(0, -300);
    await p.waitForFunction(
      (d) => window.geoObservatory().d < d * 0.95,
      initial.d,
    );
    await p.keyboard.press("Home");
    await settled(p);
    assert.ok(Math.abs((await diag(p)).d - initial.d) < 0.001);
    pass("Mausrotation, Radzoom und Zurücksetzen");
    await p.click("#nav-inside");
    await settled(p);
    await visual(p, "03-erdinneres-a", isChrome);
    await p.click('[data-layer="1"]');
    await p.click('[data-eye="1"]');
    const absent = await visual(p, "hidden", false);
    await p.click('[data-eye="1"]');
    const visible = await visual(p, "visible", false);
    assert.ok(difference(absent, visible) > 0.015);
    await p.locator("#opacity").fill("35");
    const trans = await visual(p, "transparent", false);
    assert.ok(difference(trans, visible) > 0.004);
    await p.locator("#opacity").fill("100");
    assert.ok(
      difference(trans, absent) > 0.004,
      "Teiltransparenz hat denselben Effekt wie Ausblenden",
    );
    const restored = await visual(p, "restored", false);
    assert.ok(
      difference(restored, visible) < difference(absent, visible) * 0.35,
      "Nach 100 % fehlt Schichtfläche",
    );
    await p.click("#scale");
    assert.match(await p.locator("#modelnote").innerText(), /überhöht/);
    await p.click("#cut");
    let closed = await visual(p, "closed", false);
    assert.ok(difference(closed, visible) > 0.04);
    await p.click("#cut");
    await p.click("#scale");
    pass(
      "Schichtauswahl, Sichtbarkeit, Transparenz, Keilschnitt und gekennzeichneter Maßstab",
    );
    await p.click("#labels");
    await p.click('[data-layer="2"]');
    assert.match(await p.locator("#layerText").innerText(), /flüssiges Metall/);
    await p.click("#evidence");
    if (isChrome) {
      await p.setViewportSize({ width: 1920, height: 1080 });
      await p.screenshot({
        path: out + "/08-smartboard-info.jpg",
        quality: 88,
      });
    }
    await p.keyboard.press("Escape");
    await p.setViewportSize({ width: 1366, height: 768 });
    await p.click("#home");
    await settled(p);
    await p.evaluate(() => {
      window.flightLog = [];
      function record(t) {
        const w = window.geoObservatory();
        window.flightLog.push({
          t,
          d: w.d,
          lat: w.lat,
          lon: w.lon,
          tiles: w.tiles,
        });
        if (
          window.flightLog.length < 900 &&
          (!window.flightLog.some((x) => x.d < 10000) || w.flying)
        )
          requestAnimationFrame(record);
      }
      requestAnimationFrame(record);
    });
    await p.click("#nav-place");
    await p.waitForFunction(() => window.geoObservatory().d < 4000);
    if (isChrome)
      await p.screenshot({ path: out + "/07-kameraflug.jpg", quality: 88 });
    await settled(p);
    await p.waitForFunction(
      () =>
        window.geoObservatory().localReady &&
        window.geoObservatory().localVisible,
    );
    const samples = await p.evaluate(() => window.flightLog);
    assert.ok(samples.filter((v) => v.d > 1 && v.d < 13000).length >= 3);
    assert.ok(
      samples.every((v, i) => i === 0 || v.d <= samples[i - 1].d + 0.00001),
    );
    const local = await diag(p);
    assert.ok(local.d < 1 && Math.abs(local.lat - 54.566) < 0.0001);
    run.flights.push({ style: local.style, samples });
    await visual(p, "05-hooge-a", isChrome);
    run.metrics.push({
      view: "Hooge A",
      viewport: p.viewportSize(),
      ...local,
    });
    await p.click("#return");
    await settled(p);
    assert.ok(Math.abs((await diag(p)).d - initial.d) < 0.001);
    pass(
      "Vollständiger Hin- und Rückflug mit kontinuierlichen Distanzproben",
    );
    await p.click("#nav-place");
    await p.waitForFunction(() => window.geoObservatory().d < 8000);
    await p.click("#in");
    assert.equal((await diag(p)).flying, false);
    pass("Unterbrechbarer Flug");
    await p.click("#home");
    await settled(p);
    await visual(p, "wiederholung", false);
    run.metrics.push({
      view: "Globus",
      viewport: p.viewportSize(),
      ...(await diag(p)),
    });
    await p.click("#present");
    assert.equal(await p.locator("#present").getAttribute("aria-pressed"), "true");
    await p.click("#present");
    pass("Präsentationsansicht ein- und ausgeschaltet");
    await p.emulateMedia({ reducedMotion: "reduce" });
    await p.click("#nav-inside");
    await settled(p);
    await p.click("#scale");
    await p.setViewportSize({ width: 1920, height: 1080 });
    await p.click("#present");
    await p.click("#labels");
    await p.click('[data-layer="2"]');
    assert.match(await p.locator("#layerText").innerText(), /flüssiges Metall/);
    await p.click('[data-layer="3"]');
    assert.match(await p.locator("#layerText").innerText(), /Druck/);
    assert.match(
      await p.locator("#modelnote").innerText(),
      /didaktisch überhöht/i,
    );
    for (const selector of ["#evidence", "#labels", "#present"]) {
      const box = await p.locator(selector).boundingBox();
      assert.ok(box.height >= 60 && box.width >= 60);
    }
    if (isChrome)
      await p.screenshot({ path: out + "/11-unterricht.jpg", quality: 88 });
    await p.click("#present");
    await p.click("#scale");
    pass(
      "Unterrichtsansicht 1920 × 1080: Lerntext, Schichtwechsel, Touchziele und Überhöhung",
    );
    await p.setViewportSize({ width: 1366, height: 768 });
    await p.click("#nav-place");
    await settled(p);
    run.soak = [];
    const started = Date.now();
    let cycle = 0;
    do {
      for (const id of ["helgoland", "hooge"]) {
        await p.selectOption("#siteSelect", id);
        await p.waitForFunction((id) => {
          const w = window.geoObservatory();
          return w.region === id && !w.flying && w.localReady && w.localVisible;
        }, id);
        if (id === "helgoland")
          assert.ok(Math.abs((await diag(p)).lon - 7.879) < 0.0001);
        assert.equal((await diag(p)).style, "A");
        await p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        if (cycle === 0 && id === "helgoland")
          await visual(p, "12-helgoland-A", isChrome);
      }
      const w = await diag(p);
      run.soak.push({
        ms: Date.now() - started,
        uploadedTiles: w.uploadedTiles, cachedTiles: w.cachedTiles,
        fixedGeometries: w.geometries - w.uploadedTiles,
        geometries: w.geometries,
        textures: w.textures,
        programs: w.programs,
        heap: await p.evaluate(
          () => performance.memory?.usedJSHeapSize ?? null,
        ),
      });
      cycle++;
    } while (cycle < 6 || Date.now() - started < 120000);
    const warm = run.soak.slice(2),
      firstWarm = warm[0];
    assert.ok(
      warm.every(s => s.textures <= firstWarm.textures + 2 && s.programs <= firstWarm.programs + 2 &&
        s.fixedGeometries >= 0 && s.fixedGeometries <= firstWarm.fixedGeometries + 12 &&
        s.uploadedTiles <= s.cachedTiles && s.cachedTiles <= 2 * (260 + 64)),
      "Ressourcen wachsen nach wiederholten Rundreisen",
    );
    pass(
      "Zwei eigenständige Standortmodelle; " +
        cycle * 2 +
        " Ortswechsel und " +
        Math.round((Date.now() - started) / 1000) +
        " s Ressourcenbeobachtung",
    );
    assert.deepEqual(run.errors, []);
    assert.ok(!run.console.some((m) => m.startsWith("error:")));
    assert.ok(run.loads.every((r) => r.status < 400));
    pass("Standardlauf ohne Konsolen- oder Ladefehler");
    await context.close();
    const mobile = await browser.newContext({
      viewport: { width: 1024, height: 768 },
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
    });
    const tab = await mobile.newPage();
    if (isChrome) {
      const cdp = await mobile.newCDPSession(tab);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 3 });
    }
    await tab.goto(base);
    await settled(tab);
    await visual(tab, "09-tablet", isChrome);
    if (isChrome) {
      const cdp = await mobile.newCDPSession(tab),
        b = await tab.locator("#earth").boundingBox(),
        x = b.x + b.width / 2,
        y = b.y + b.height / 2;
      for (const [type, delta] of [
        ["touchStart", 22],
        ["touchMove", 55],
        ["touchMove", 72],
        ["touchEnd", 0],
      ])
        await cdp.send("Input.dispatchTouchEvent", {
          type,
          touchPoints: delta
            ? [
                { x: x - delta, y, id: 1 },
                { x: x + delta, y, id: 2 },
              ]
            : [],
        });
      await tab.waitForFunction(
        (d) => window.geoObservatory().d < d * 0.85,
        initial.d,
      );
      pass("Zwei-Finger-Zoom über Chromium-Touch-Ereignisse");
    }
    await tab.locator("#nav-place").tap();
    await settled(tab);
    await tab.waitForFunction(() => window.geoObservatory().localVisible);
    run.metrics.push({
      view: "Tablet Hooge",
      viewport: tab.viewportSize(),
      cpuThrottle: isChrome ? 3 : 1,
      ...(await diag(tab)),
    });
    await tab.setViewportSize({ width: 768, height: 1024 });
    assert.ok(
      await tab.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await visual(tab, "10-hochformat", isChrome);
    pass("Tablet quer, Hochformat, Touch-Navigation, reduzierte Bewegung");
    await mobile.close();
    const f = await browser.newPage();
    await f.route("**/earth.webp", (r) => r.abort());
    await f.goto(base);
    await settled(f);
    assert.match(await f.locator("#status").innerText(), /Vereinfachte/);
    await visual(f, "ersatz", false);
    await f.emulateMedia({ reducedMotion: "reduce" });
    await f.route("**/hooge.json", (r) => r.abort());
    await f.click("#nav-place");
    await settled(f);
    await f.waitForFunction(() =>
      document
        .querySelector("#status")
        .textContent.includes("Hallig-Detaildaten fehlen"),
    );
    await f.waitForFunction(
      () => Math.abs(window.geoObservatory().d - 140) < 0.001,
    );
    await visual(f, "regionale-ersatzkarte", false);
    await f.click("#home");
    await settled(f);
    pass(
      "Ausfall der Halligdaten wird gemeldet und der Rückweg bleibt bedienbar",
    );
    await f.click("#nav-place");
    await settled(f);
    await f.route("**/helgoland-air.webp", (r) => r.abort());
    await f.selectOption("#siteSelect", "helgoland");
    await settled(f);
    await f.waitForFunction(() => window.geoObservatory().localVisible);
    assert.match(
      await f.locator("#status").innerText(),
      /Luftbild unvollständig/,
    );
    await visual(f, "helgoland-ersatz", false);
    await f.unroute("**/hooge.json");
    await f.route("**/hooge-surface.bin", (r) =>
      r.fulfill({ body: Buffer.alloc(16) }),
    );
    await f.reload();
    await settled(f);
    await f.click("#nav-place");
    await f.waitForFunction(
      () =>
        !window.geoObservatory().flying &&
        Math.abs(window.geoObservatory().d - 140) < 0.001,
    );
    assert.equal((await diag(f)).localReady, false);
    pass(
      "Fehlendes Standortfoto mit Ersatztextur, beschädigtes Geländenetz mit regionalem Rückfall",
    );
    await f.close();
    pass("Ausfall des Detailbilds mit gerenderter lokaler Ersatzkarte");
  } finally {
    await browser.close();
  }
}
try {
  for (const engine of (process.env.TEST_ENGINES ?? "chromium,webkit").split(
    ",",
  ))
    await run(engine);
} catch (e) {
  report.failure = String(e.stack ?? e);
  process.exitCode = 1;
  console.error(e);
} finally {
  await writeFile(
    out + "/flights.json",
    JSON.stringify(
      report.runs.map((r) => ({ engine: r.engine, flights: r.flights })),
    ),
  );
  for (const r of report.runs)
    r.flights = r.flights.map((f) => {
      const active = f.samples.filter((v) => v.d < 14449 && v.d > 0.291);
      return {
        style: f.style,
        intermediateFrames: active.length,
        startKm: f.samples[0].d,
        endKm: f.samples.at(-1).d,
        ms: Math.round(active.at(-1).t - active[0].t),
        maxFrameGapMs: Math.round(
          Math.max(...active.slice(1).map((v, i) => v.t - active[i].t)),
        ),
      };
    });
  await writeFile(out + "/results.json", JSON.stringify(report, null, 2));
  server.close();
}
