import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { geometry } from "./g651-visual.mjs";
const browser = await chromium.launch(
  process.env.G6_NATIVE_GPU
    ? { headless: false }
    : { args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] },
);
let favorite;
try {
  for (const [i, file] of process.argv.slice(2).entries()) {
    const version = i ? "G6.8.1" : "G6.8",
      dir = join(process.env.G65_OUT || "test-results/G65/Vergleich", version);
    await mkdir(dir, { recursive: true });
    const ctx = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
    });
    await ctx.route(/^https?:/, (route) => route.abort());
    if (i)
      await ctx.addInitScript(
        (value) =>
          localStorage.setItem("georisiko.unterrichtsansichten.v1", value),
        favorite,
      );
    const page = await ctx.newPage(),
      cdp = await ctx.newCDPSession(page);
    await cdp.send("Performance.enable");
    const started = performance.now();
    await page.goto(pathToFileURL(resolve(file)).href);
    await page.waitForFunction(() => window.geoObservatory?.().ready);
    const report = {
      version,
      engine: browser.version(),
      startMs: performance.now() - started,
      commit: i
        ? process.env.TEST_COMMIT
        : "02700cdbc363195b8c5b798c6f0b4ce97c3cab2c",
      samples: [],
    };
    const open = async (id) => {
      await page.selectOption("#geo-topic", id);
      await page.waitForFunction(
        (id) =>
          document.querySelector("#geo-crumb").dataset.settled === "true" &&
          (id.startsWith("nyos-")
            ? window.geoObservatory().rendered.nyos
            : window.geoObservatory().observatory.lessonView === id.slice(8)),
        id,
      );
    };
    if (i) {
      await page.click("#saved-views");
      await page.selectOption("#saved-list", { label: "G6.8 Seenvergleich" });
      await page.click("#view-apply");
      await page.waitForFunction(
        () =>
          window.geoObservatory().observatory.lessonView === "lakeCompare" &&
          Math.abs(window.geoObservatory().observatory.study.time - 0.62) <
            0.001,
      );
      assert.equal(
        await page.locator(".lake-evidence select").inputValue(),
        "1",
      );
      report.favoriteMigrated = true;
    } else {
      await open("seismic-lakeCompare");
      await page.selectOption("#geo-info", "explain");
      await page.selectOption(".lake-evidence select", "1");
      await page.click("#saved-views");
      await page.fill("#view-name", "G6.8 Seenvergleich");
      await page.click("#view-save");
      await page.click("#view-close");
      favorite = await page.evaluate(() =>
        localStorage.getItem("georisiko.unterrichtsansichten.v1"),
      );
      assert.ok(favorite);
    }
    await page.selectOption("#geo-info", "explain");
    const base = [
      ["Gasreich-Start", "waterColumn", "waterColumn", 0],
      ["Untersaettigt-Start", "unsaturated", "unsaturated", 0],
      ["Gasreich-Anstieg", "waterColumn", "waterColumn", 0.68],
      ["Untersaettigt-Anstieg", "unsaturated", "unsaturated", 0.68],
      ["Eifel", "eifel", "towns"],
      ["Nyos-Daten", "profiles", "inventory"],
      ["Rohrschnitt", "pipeCut", "pipeCut", 0.74],
      ["Maar", "maar", "maar", 0.49],
    ];
    const openingResources = await page.evaluate(() =>
      window.geoDeviceProbe(350),
    );
    for (const [name, oldView, newView, t] of base) {
      const id = i ? newView : oldView,
        change = performance.now();
      if (id === "towns") {
        await page.selectOption("#geo-place", "towns");
        await page.waitForFunction(
          () =>
            window.geoObservatory().observatory.lessonView === "towns" &&
            document.querySelector("#geo-crumb").dataset.settled === "true",
        );
      } else if (id === "unsaturated" || id === "inventory") {
        await open(
          id === "unsaturated" ? "seismic-waterColumn" : "seismic-profiles",
        );
        await page.selectOption("#geo-preset", id);
        await page.waitForFunction(
          (id) =>
            window.geoObservatory().observatory.lessonView === id &&
            document.querySelector("#geo-crumb").dataset.settled === "true",
          id,
        );
      } else await open("seismic-" + id);
      const changeMs = performance.now() - change;
      if (t !== undefined) await page.locator("#geo-time").fill(String(t));
      const visible = await geometry(page, { textured: id === "towns" });
      await page.screenshot({
        path: join(dir, name + ".jpg"),
        type: "jpeg",
        quality: 86,
      });
      const animated = t !== undefined;
      if (animated) {
        await page
          .locator("#geo-time")
          .fill(String(Math.round(Math.max(0.24, (t ?? 0) - 0.07) * 1000) / 1000));
        await page.click("#geo-play");
      }
      const sample = await page.evaluate(async () => {
        let changes = 0;
        const watch = new MutationObserver((e) => (changes += e.length));
        watch.observe(document.querySelector(".view"), {
          attributes: true,
          childList: true,
          subtree: true,
        });
        const p = await window.geoDeviceProbe(1900);
        watch.disconnect();
        return {
          renderedFps: p.renderedFps,
          p95: p.p95,
          median: p.median,
          renderedFrames: p.renderedFrames,
          resources: p.states.at(-1),
          changes,
        };
      });
      if (animated) assert.ok(sample.renderedFrames > 0, id);
      const heap = (await cdp.send("Performance.getMetrics")).metrics.find(
        (m) => m.name === "JSHeapUsedSize",
      ).value;
      report.samples.push({
        name,
        id,
        animated,
        changeMs,
        heap,
        ...sample,
        visible,
      });
    }
    const exit = async () => {
      await page.selectOption("#geo-topic", "globe");
      await page.waitForFunction(
        () =>
          window.geoObservatory().rendered.globe &&
          !window.geoObservatory().observatory.lessonView &&
          !window.geoObservatory().flying,
      );
      return (await page.evaluate(() => window.geoDeviceProbe(550))).states.at(
        -1,
      );
    };
    report.resources = {
      before: openingResources.states.at(-1),
      afterFirst: await exit(),
    };
    for (let repeat = 0; repeat < 3; repeat++) {
      await open("seismic-waterColumn");
      await open("seismic-profiles");
      await open("seismic-eifel");
    }
    report.resources.afterRepeats = await exit();
    await writeFile(join(dir, "Messung.json"), JSON.stringify(report, null, 2));
    await ctx.close();
  }
} finally {
  await browser.close();
}
