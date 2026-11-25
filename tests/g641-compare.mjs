import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { metrics, waitForNyosLake } from "./g641-classroom.mjs";
const root = process.env.G641_OUT || "test-results/G641/Vergleich";
const browser = await chromium.launch(
  process.env.G6_NATIVE_GPU
    ? { headless: false }
    : { args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] },
);
let historicalFavorite;
try {
  for (const [index, file] of process.argv.slice(2).entries()) {
    const old = index === 0,
      out = join(root, old ? "G6.4" : "G6.4.1");
    await mkdir(out, { recursive: true });
    const ctx = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
    });
    await ctx.addInitScript(() => localStorage.setItem("georisiko.graphics.g6", "classroom"));
    if (!old && historicalFavorite)
      await ctx.addInitScript(
        (value) => localStorage.setItem("georisiko.unterrichtsansichten.v1", value),
        historicalFavorite,
      );
    const page = await ctx.newPage(),
      started = performance.now();
    const report = {
      file,
      engine: browser.version(),
      commit: old ? "95de9c09546e6fca83c7d1af0875818ae2f07e39" : process.env.TEST_COMMIT,
      scenes: {},
      samples: [],
      loads: [],
      profile: "classroom",
    };
    try {
      await page.goto(pathToFileURL(resolve(file)).href);
      await page.waitForFunction(() => window.geoObservatory?.().ready);
      report.startMs = performance.now() - started;
      const click = (s) => page.click("#" + s),
        select = (s, v) => page.selectOption("#" + s, v);
      const ready = () =>
        page.waitForFunction(
          () => !window.geoObservatory().flying && window.geoObservatory().observatory.ready,
        );
      const settle = () =>
        page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const shot = async (name) => {
        await settle();
        report.scenes[name] = await metrics(page);
        await page.screenshot({ path: join(out, name + ".jpg"), type: "jpeg", quality: 90 });
      };
      const open = async (id) => {
        const start = performance.now();
        if (old) {
          await click("nav-plates");
          await click("g-studio");
          await select("studio-model", id);
        } else {
          await select("geo-topic", "process-" + id);
          await page.waitForFunction(
            (id) => window.geoObservatory().observatory.studio?.models[0] === id,
            id,
          );
        }
        await settle();
        report.loads.push({ id, ms: performance.now() - start });
      };
      const more = async () => {
        if (!old && (await page.locator("#geo-tools").getAttribute("aria-expanded")) !== "true")
          await click("geo-tools");
        if (!(await page.locator("#studio-details").evaluate((e) => e.open)))
          await page.locator("#studio-details summary").click();
      };
      const hide = async () => {
        if (!old && (await page.locator("#geo-tools").getAttribute("aria-expanded")) === "true")
          await click("geo-tools");
      };
      for (const [id, name] of [
        ["arc", "Tonga"],
        ["ridge", "Ruecken"],
        ["rift", "Grabenbruch"],
        ["collision", "Kollision"],
        ["wilson", "Wilson"],
        ["hotspot", "Hotspot"],
      ]) {
        await open(id);
        await page.locator(old ? "#g-progress" : "#geo-time").fill("0.6");
        if (old) {
          await more();
          await page.check("#studio-vectors");
          if (await page.locator("#studio-paths").count()) await page.check("#studio-paths");
          await page.check("#studio-label-0");
          await page.locator("#studio-details summary").click();
        } else await select("geo-info", "explain");
        await shot(name);
        if (id === "arc") {
          if (old) await select("studio-view", "wedge");
          else await select("geo-preset", "melt");
          await shot("Mantelkeil");
        }
      }
      for (const [v, name] of [
        ["research", "Forschungsatlas"],
        ["past", "Kontinentaldrift"],
        ["quake", "Parkfield"],
        ["sea", "Tsunami"],
        ["nyos", "Nyos"],
      ]) {
        if (old) {
          if (v === "research" || v === "past") {
            await click("nav-plates");
            await click(v === "research" ? "g-atlas" : "g-time");
          } else if (v === "nyos") {
            await click("nav-nyos");
            await click("nyos-event");
          } else {
            await click("nav-earthquake");
            await select("g-launch", v === "sea" ? "japan" : "san");
            await ready();
            if (v === "sea") await select("g-view", "water");
          }
        } else {
          await select("geo-topic", v);
          if (v === "nyos") {
            await click("geo-tools");
            await click("nyos-event");
            await click("geo-tools");
          }
          if (v === "research") {
            await page.waitForSelector("#research-projection:visible");
            await click("geo-tools");
          }
        }
        if (v === "nyos") await waitForNyosLake(page);
        if (v === "quake" || v === "sea") await ready();
        await page.waitForTimeout(650);
        await shot(name);
      }
      if (old) {
        await open("collision");
        await page.locator("#g-progress").fill("0.6");
        await click("saved-views");
        await page.locator("#view-name").fill("G6.4 · Kollision");
        await click("view-save");
        await click("view-close");
        historicalFavorite = await page.evaluate(() =>
          localStorage.getItem("georisiko.unterrichtsansichten.v1"),
        );
        assert.ok(historicalFavorite);
      } else {
        await click("saved-views");
        await select("saved-list", "s0");
        await click("view-apply");
        await page.waitForFunction(
          () =>
            window.geoObservatory().observatory.studio?.models[0] === "collision" &&
            window.geoObservatory().observatory.studio.time === 0.6,
        );
        report.historicalFavorite = true;
      }
      await page.emulateMedia({ reducedMotion: "no-preference" });
      if (old) await click("nav-plates");
      else {
        await select("geo-topic", "plates");
        await click("geo-tools");
      }
      await click("g-boundaries");
      await page.waitForFunction(() => document.querySelector('#g-example option[value="1510"]'));
      report.flights = [];
      for (const id of ["1510", "2308"]) {
        const start = performance.now();
        await select("g-example", id);
        const sample = await page.evaluate(() =>
          window.geoDeviceProbe(800, () => !window.geoObservatory().flying),
        );
        report.flights.push({
          id,
          elapsedMs: performance.now() - start,
          renderedFps: sample.renderedFps,
          p95: sample.p95,
          frames: sample.renderedFrames,
        });
      }
      await page.emulateMedia({ reducedMotion: "reduce" });
      // Match the canvas dimensions for renderer timing. All screenshots above use the delivery UI.
      await open("ridge");
      await page.addStyleTag({
        content:
          "#desk .view {position:fixed!important;left:0!important;right:auto!important;top:54px!important;width:1000px!important;height:570px!important;pointer-events:none!important} #sidebar,#geo-dock,header {z-index:15!important}",
      });
      for (const n of [1, 4]) {
        await more();
        await select("studio-count", String(n));
        await hide();
        // Keep the model camera and playing/paused sampling windows identical.
        const play = old ? "g-play" : "geo-play";
        await page.locator(old ? "#g-progress" : "#geo-time").fill("0.3");
        await click(play);
        await page.waitForTimeout(600);
        for (const animated of [true, false]) {
          if (!animated) {
            await click(play);
            await page.waitForTimeout(450);
          }
          const row = await page.evaluate(async () => {
            const p = await window.geoDeviceProbe(3000);
            return {
              rendered: p.renderedFrames,
              renderedFps: p.renderedFps,
              rafFps: p.fps,
              p95: p.p95,
              median: p.median,
              max: p.max,
              resources: p.states.at(-1),
            };
          });
          if (animated) assert.ok(row.rendered > 0);
          report.samples.push({ n, animated, ...row });
        }
      }
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.addStyleTag({ content: "#desk .view {width:1600px!important;height:900px!important}" });
      await settle();
      await click(old ? "g-play" : "geo-play");
      report.largeCanvas = await page.evaluate(async () => {
        const p = await window.geoDeviceProbe(4000);
        return {
          renderedFps: p.renderedFps,
          p95: p.p95,
          rendered: p.renderedFrames,
          resources: p.states.at(-1),
        };
      });
      await click(old ? "g-play" : "geo-play");
      if (old) await click("nav-globe");
      else await select("geo-topic", "globe");
      await settle();
      report.afterExit = await page.evaluate(() => {
        const w = window.geoObservatory();
        return { textures: w.textures, geometries: w.geometries, programs: w.programs };
      });
      report.complete = true;
    } finally {
      await writeFile(join(out, "Vergleich.json"), JSON.stringify(report, null, 2));
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
