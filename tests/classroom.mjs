import assert from "node:assert/strict";
import { mkdir, writeFile, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { preview } from "vite";
import { chromium, webkit } from "playwright";
import { PNG } from "pngjs";

const dest = "test-results/unterricht-g131";
await mkdir(dest, { recursive: true });
const server = await preview({
  configFile: false,
  base: "/Erdmodell/",
  preview: { host: "127.0.0.1", port: 0 },
  logLevel: "error",
});
const url =
  "http://127.0.0.1:" + server.httpServer.address().port + "/Erdmodell/";
const names = ["Erdkruste", "Erdmantel", "Äußerer Erdkern", "Innerer Erdkern"];
const read = (p) => p.evaluate(() => window.geoObservatory());
const wait = (p) =>
  p.waitForFunction(
    () =>
      window.geoObservatory?.().frames > 2 && !window.geoObservatory().flying,
  );
const painted = (p) =>
  p.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );
const pose = (w) => [w.lat, w.lon, w.d, w.bearing, w.tilt];
const report = {
  testedAt: new Date().toISOString(),
  commit: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  runs: [],
};
async function anonymous(p) {
  assert.doesNotMatch(
    await p.locator("body").innerText(),
    /Erdkruste|Erdmantel|Erdkern|Lithosphäre/i,
  );
  const hints = await p.locator("[title]:visible,[aria-label]:visible").evaluateAll(nodes =>
    nodes.map(el => [el.title, el.getAttribute("aria-label")].join(" ")).join(" "));
  assert.doesNotMatch(hints, /kruste|mantel|erdkern|lithosphäre/i);
  assert.doesNotMatch(
    await p.locator("#sidebar").ariaSnapshot(),
    /Erdkruste|Erdmantel|Erdkern|Lithosphäre/i,
  );
}
async function exercise(browser, engine) {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  const p = await context.newPage(),
    errors = [],
    run = { engine, version: browser.version(), checks: [], resources: [] };
  report.runs.push(run);
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  p.on("response", (r) => {
    if (r.status() >= 400) errors.push(r.url());
  });
  const pass = (msg) => {
    run.checks.push(msg);
    console.log(engine, msg);
  };
  const snap = async (name) => {
    await painted(p);
    if (engine === "chromium")
      await p.screenshot({ path: join(dest, name + ".jpg"), quality: 88 });
  };
  try {
    await p.goto(url);
    await wait(p);
    assert.equal((await read(p)).style, "A");
    const area = async () => {
      const box = await p.locator("#earth").boundingBox();
      return box.width * box.height / (1920 * 1080);
    };
    run.globeArea = await area();
    assert.ok(run.globeArea >= 0.91 && await p.locator("#sidebar").isHidden());
    await snap("01-globus-a");
    await p.tap("#present");
    await p.tap("#nav-inside");
    await wait(p);
    await anonymous(p);
    run.smartboardArea = await area();
    assert.ok(run.smartboardArea >= 0.74);
    assert.ok(await p.locator("#isolate").isDisabled());
    assert.equal(await p.locator("#pins span:visible").count(), 0);
    await snap("02-anonym");
    await p.tap("[data-layer='2']");
    await p.tap("#isolate");
    await anonymous(p);
    assert.deepEqual((await read(p)).shell.visible, [
      false,
      false,
      true,
      false,
    ]);
    await p.tap("#evidence");
    await anonymous(p);
    assert.ok(await p.locator("#content svg").isVisible());
    assert.equal(await p.locator(".inference").count(), 0);
    await p.tap("#closeDialog");
    await p.tap("#info");
    await anonymous(p);
    await p.tap("#closeDialog");
    await p.tap("#scale");
    await anonymous(p);
    await p.tap("#scale");
    await p.tap("#restoreLayers");
    pass(
      "Geschlossener A-Globus und anonyme Entdeckung einschließlich Auswahl, Wellenbild, Modellhinweisen, Isolation und Überhöhung",
    );
    await p.tap("#labels");
    for (const [i, n] of names.entries())
      assert.match(
        await p.locator("[data-layer='" + i + "']").innerText(),
        new RegExp(n),
      );
    assert.ok(await p.locator("#pins span:visible").count() > 0);
    await snap("03-beschriftung");
    const ref = await read(p);
    assert.deepEqual(ref.shell.radii, [6371, 6336, 3481, 1221, 0]);
    await p.tap("[data-layer='0']");
    await snap("04-massstab");
    await p.tap("#scale");
    const wide = await read(p);
    assert.deepEqual(pose(ref), pose(wide));
    assert.deepEqual(wide.shell.radii, [6371, 6371 * 0.935, 3481, 1221, 0]);
    assert.match(await p.locator("#modelnote").innerText(), /überhöht/);
    await snap("05-ueberhoeht");
    await p.tap("#scale");
    pass(
      "Schichtfolge und beide Radienfolgen; identische Kamera im Maßstabsvergleich",
    );
    for (let i = 0; i < 4; i++) {
      await p.tap("[data-layer='" + i + "']");
      await p.tap("#explainLayer");
      const text = await p.locator("#layerText").innerText();
      assert.match(text, [/festem Gestein/, /festem Gestein/, /flüssigem Metall/, /festem Metall/][i]);
      assert.ok(text.length < 155);
      await p.tap("#isolate");
      assert.deepEqual(
        (await read(p)).shell.visible,
        names.map((_, j) => i === j),
      );
      await p.locator("#opacity").fill("40");
      assert.equal((await read(p)).shell.opacity[i], 0.4);
      await p.tap("[data-eye='" + i + "']");
      assert.equal((await read(p)).shell.visible[i], false);
      await p.tap("[data-eye='" + i + "']");
      await p.tap("#restoreLayers");
      assert.deepEqual((await read(p)).shell.opacity, [1, 1, 1, 1]);
    }
    await p.tap("[data-layer='1']");
    await p.tap("#subdue");
    await p.locator("#opacity").fill("80");
    await snap("06-hervorgehoben");
    assert.equal((await read(p)).shell.selected, 1);
    assert.ok((await read(p)).shell.subdued);
    const shot = PNG.sync.read(await p.locator("#earth").screenshot());
    await p.tap("#restoreLayers");
    await painted(p);
    const plain = PNG.sync.read(await p.locator("#earth").screenshot());
    let n = 0;
    for (let i = 0; i < plain.data.length; i += 32)
      if (
        Math.abs(plain.data[i] - shot.data[i]) +
          Math.abs(plain.data[i + 1] - shot.data[i + 1]) >
        16
      )
        n++;
    assert.ok(
      n > plain.width * plain.height * 0.002,
      "Hervorhebung im Renderbild fehlt",
    );
    pass(
      "Einzelauswahl, Isolation, Transparenz, Hervorhebung, Sichtbarkeit und Rückkehr für die vier Schalen",
    );
    const view = await p.locator("#earth").boundingBox(),
      side = await p.locator("#sidebar").boundingBox();
    assert.ok(side.x + side.width <= view.x + 1);
    for (const sel of [
      "#nav-globe",
      "#nav-inside",
      "#labels",
      "[data-layer='1']",
      "#present",
      "#evidence",
      "#restoreLayers",
    ]) {
      const b = await p.locator(sel).boundingBox();
      assert.ok(
        b.height >= 60 && b.y >= 0 && b.y + b.height <= 1080,
        sel + " Smartboard-Touchziel",
      );
    }
    await p.tap("#cut");
    await snap("07-smartboard");
    await p.tap("#cut");
    await p.tap("[data-layer='1']");
    await p.tap("#explainLayer");
    await snap("08-schalentext");
    await p.tap("#evidence");
    const wave = await p.locator("#content").innerText();
    for (const re of [/Vereinfachtes Modell/, /Flüssigkeiten breiten sie sich nicht aus/, /Muster.*vieler Erdbeben/])
      assert.match(wave, re);
    assert.doesNotMatch(wave, /UTC|Station|Messwert/);
    assert.equal(await p.locator("#content table,#content input,#content details").count(), 0);
    await snap("09-wellen");
    await p.tap("#closeDialog");
    await p.tap("#info");
    assert.match(await p.locator("#content").innerText(), /35 km/);
    await p.tap("#closeDialog");
    await p.tap("#labels");
    await anonymous(p);
    assert.equal(await p.locator("#layerText,#pins span:visible").count(), 0);
    await p.tap("#labels");
    pass("Modellhinweise, knappe Schalentexte, Wellenmodell mit Schluss aus vielen Erdbeben und erneutes Verbergen");
    await p.tap("#nav-globe");
    await wait(p);
    await p.tap("#nav-inside");
    await wait(p);
    for (let cycle = 0; cycle < 14; cycle++) {
      const begin = performance.now();
      await p.evaluate(() => {
        document.querySelector("#cut").click();
        document.querySelector("#scale").click();
        document.querySelector("[data-layer='2']").click();
        document.querySelector("#isolate").click();
        document.querySelector("#restoreLayers").click();
      });
      await painted(p);
      const { shell, geometries, textures, programs } = await read(p);
      const heapBytes = await p.evaluate(() => performance.memory?.usedJSHeapSize ?? null);
      run.resources.push({
        cycle,
        interactionMs: Math.round(performance.now() - begin),
        heapBytes, builds: shell.builds,
        geometries,
        textures,
        programs,
      });
    }
    const start = run.resources[3],
      end = run.resources.at(-1);
    assert.equal(end.builds, start.builds);
    assert.equal(end.geometries, start.geometries);
    assert.equal(end.textures, start.textures);
    assert.equal(end.programs, start.programs);
    run.cadence = await p.evaluate(async () => {
      const gaps = [];
      const start = performance.now();
      let last = start;
      while (performance.now() - start < 4500) {
        const now = await new Promise(requestAnimationFrame);
        if (now > last) gaps.push(now - last);
        last = now;
      }
      const w = window.geoObservatory();
      const sorted = [...gaps].sort((a, b) => a - b);
      const gl = document.querySelector("#earth").getContext("webgl2");
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      return { fps: 1000 * gaps.length / gaps.reduce((a,b) => a+b,0), gaps,
        p95Ms: sorted[Math.floor(sorted.length * 0.95)], maxMs: sorted.at(-1),
        renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        ratio: w.pixelRatio, resolution: w.resolution };
    });
    const rotate = await read(p);
    await p.locator("#earth").focus();
    await p.keyboard.press("ArrowRight");
    await p.waitForFunction(
      (l) => Math.abs(window.geoObservatory().lon - l) > 0.05,
      rotate.lon,
    );
    for (let i = 0; i < 3; i++) {
      await p.tap("#home");
      await wait(p);
      const w = await read(p);
      assert.equal(w.mode, "globe");
      assert.equal(w.style, "A");
      assert.equal(w.shell.selected, null);
      assert.ok(!w.shell.expanded && !w.shell.subdued && w.shell.cut);
      assert.deepEqual(w.shell.opacity, [1, 1, 1, 1]);
      await p.tap("#nav-inside");
      await wait(p);
      await anonymous(p);
    }
    pass(
      "Schalenrotation, wiederholtes Rücksetzen und stabile warme Ressourcen bei Schnitt- und Maßstabswechseln",
    );
    await p.tap("#present");
    await p.setViewportSize({ width: 768, height: 1024 });
    await p.tap("#labels");
    await p.evaluate(() => window.scrollTo(0, 0));
    const tabletView = await p.locator("#earth").boundingBox();
    assert.ok(tabletView.height >= 440);
    await snap("10-tablet");
    assert.ok(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    assert.deepEqual(errors, []);
    pass(
      "Touchbedienung und Hochformat ohne horizontales Überlaufen oder Browserfehler",
    );
  } catch (err) {
    console.error(
      engine,
      p.url(),
      errors,
      await p
        .locator("body")
        .innerText()
        .catch(() => ""),
      await read(p).catch(() => null),
    );
    throw err;
  } finally {
    await context.close();
  }
}
async function video(browser) {
  const temp = await mkdtemp(join(tmpdir(), "freitag-video-"));
  const c = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: temp, size: { width: 1152, height: 720 } },
    reducedMotion: "reduce",
  });
  try {
    const p = await c.newPage();
    const video = p.video();
    await p.goto(url);
    await wait(p);
    for (const selector of [
      "#present",
      "#nav-inside",
      "#labels",
      "[data-layer='0']",
      "#scale",
      "#isolate",
      "#restoreLayers",
      "#evidence",
      "#closeDialog",
      "#home",
    ]) {
      await p.click(selector);
      await p.waitForTimeout(800);
    }
    await c.close();
    await video.saveAs(join(dest, "bedienung.webm"));
  } finally {
    await c.close();
    await rm(temp, { recursive: true, force: true });
  }
}
try {
  for (const engine of (process.env.TEST_ENGINES ?? "chromium,webkit").split(
    ",",
  )) {
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
      if (engine === "chromium") await video(browser);
    } finally {
      await browser.close();
    }
  }
} catch (e) {
  report.failure = String(e.stack ?? e);
  process.exitCode = 1;
  console.error(e);
} finally {
  await writeFile(join(dest, "pruefung.json"), JSON.stringify(report, null, 2));
  await server.close();
}
