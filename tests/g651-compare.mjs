import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { geometry, sizes } from "./g651-visual.mjs";
const browser = await chromium.launch(
  process.env.G6_NATIVE_GPU
    ? { headless: false }
    : { args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] },
);
let historicalFavorite;
try {
  for (const [i, file] of process.argv.slice(2).entries()) {
    const version = i ? "G6.5.1" : "G6.5",
      out = join(process.env.G65_OUT || "test-results/G65/Vergleich", version);
    await mkdir(out, { recursive: true });
    const ctx = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      reducedMotion: "reduce",
      deviceScaleFactor: 1,
    });
    await ctx.addInitScript(() => {
      localStorage.setItem("georisiko.graphics.g6", "classroom");
      window.chartSamples = { count: 0, ms: 0 };
      const p = CanvasRenderingContext2D.prototype;
      for (const name of ["stroke", "drawImage", "fillText", "clearRect"]) {
        const fn = p[name];
        p[name] = function (...args) {
          if (!this.canvas.classList.contains("seismic-chart"))
            return fn.apply(this, args);
          const t = performance.now();
          const result = fn.apply(this, args);
          window.chartSamples.count++;
          window.chartSamples.ms += performance.now() - t;
          return result;
        };
      }
    });
    if (i)
      await ctx.addInitScript(
        (value) =>
          localStorage.setItem("georisiko.unterrichtsansichten.v1", value),
        historicalFavorite,
      );
    const page = await ctx.newPage(),
      cdp = await ctx.newCDPSession(page);
    await cdp.send("Performance.enable");
    const result = {
      version,
      commit: i
        ? process.env.TEST_COMMIT
        : "8c023e83c6996dd58f0e28d16a52c8766136ef88",
      engine: browser.version(),
      screens: [],
      sizes: [],
      loads: [],
      timing: [],
    };
    const start = performance.now();
    await page.goto(pathToFileURL(resolve(file)).href);
    await page.waitForFunction(() => window.geoObservatory?.().ready);
    result.startMs = performance.now() - start;
    const select = (id, value) => page.selectOption("#" + id, value),
      topic = async (id) => {
        const t = performance.now();
        await select("geo-topic", "seismic-" + id);
        await page.waitForFunction(
          (id) => window.geoObservatory().observatory.lessonView === id,
          id,
        );
        result.loads.push({ id, ms: performance.now() - t });
      };
    const shot = async (name) => {
      await page.screenshot({
        type: "jpeg",
        quality: 85,
        path: join(out, name + ".jpg"),
        timeout: 150000,
      });
      result.screens.push(name);
    };
    const phase = (t) => page.locator("#geo-time").fill(String(t));
    if (i) {
      await page.click("#saved-views");
      await page.selectOption("#saved-list", { label: "G6.5 Bruchmodell" });
      await page.click("#view-apply");
      await page.waitForFunction(
        () =>
          window.geoObservatory().observatory.lessonView === "strike" &&
          Math.abs(window.geoObservatory().observatory.study.time - 0.63) <
            0.001,
      );
      result.historicalFavorite = true;
    } else {
      await topic("strike");
      await phase(0.63);
      await page.click("#saved-views");
      await page.fill("#view-name", "G6.5 Bruchmodell");
      await page.click("#view-save");
      await page.click("#view-close");
      historicalFavorite = await page.evaluate(() =>
        localStorage.getItem("georisiko.unterrichtsansichten.v1"),
      );
      assert.ok(historicalFavorite);
    }
    await select("geo-info", "explain");
    await topic("particles");
    await select("geo-preset", "stations");
    await phase(0.41);
    await shot("Stationen");
    for (const [w, h] of sizes) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(280);
      const mask = await geometry(page, { enforce: Boolean(i) });
      result.sizes.push({ w, h, ...mask });
      await shot("Fenster-" + w);
    }
    await page.setViewportSize({ width: 1366, height: 768 });
    for (const [id, preset, name] of [
      ["particles", "stations", "Stationsvergleich"],
      ["moment", "sites", "Fels-Sediment"],
      ["strike", "normal", "Abschiebung"],
      ["vt", "monitor", "Ueberwachung"],
    ]) {
      await topic(id);
      await select("geo-preset", preset);
      await phase(0.46);
      await shot(name);
      await phase(0.2);
      await page.click("#geo-play");
      const visible = await geometry(page);
      const stats = await page.evaluate(async () => {
        const labels = document.querySelector(".seismic-figure");
        let mutations = 0;
        const observer = new MutationObserver((es) => (mutations += es.length));
        observer.observe(labels, {
          subtree: true,
          attributes: true,
          childList: true,
        });
        window.chartSamples = { count: 0, ms: 0 };
        const p = await window.geoDeviceProbe(2000);
        observer.disconnect();
        return {
          fps: p.renderedFps,
          p95: p.p95,
          frameCount: p.renderedFrames,
          labels: mutations,
          chart: { ...window.chartSamples },
          resources: p.states.at(-1),
        };
      });
      assert.ok(stats.frameCount > 0);
      await phase(0.7);
      await page.waitForTimeout(200);
      const idle = await page.evaluate(() => window.geoDeviceProbe(850));
      const heap = (await cdp.send("Performance.getMetrics")).metrics.find(
        (m) => m.name === "JSHeapUsedSize",
      ).value;
      result.timing.push({
        name,
        visible,
        heap,
        idleFps: idle.renderedFps,
        ...stats,
      });
    }
    await select("geo-topic", "globe");
    await page.waitForFunction(
      () =>
        !window.geoObservatory().observatory.mode &&
        !window.geoObservatory().flying,
    );
    result.afterExit = await page.evaluate(() => {
      const w = window.geoObservatory();
      return {
        textures: w.textures,
        geometries: w.geometries,
        programs: w.programs,
      };
    });
    result.complete = true;
    await writeFile(
      join(out, "Vergleich.json"),
      JSON.stringify(result, null, 2),
    );
    await ctx.close();
  }
} finally {
  await browser.close();
}
