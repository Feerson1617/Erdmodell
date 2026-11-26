import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { geometry } from "./g651-visual.mjs";
import { frameLayout } from "./g682-product.mjs";
import { switchPresentation } from "./geographic-controls.mjs";

const files = process.argv.slice(2);
assert.equal(files.length, 2);
const browser = await chromium.launch(
  process.env.G6_NATIVE_GPU
    ? { headless: false }
    : { args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] },
);
const routes = [
  ["01-Globus", "globe"],
  ["02-Erdinneres", "inside"],
  ["03-Kontinentaldrift", "past", -150],
  ["04-Forschungsatlas", "research"],
  ["05-Subduktion", "process-subduction", 0.56],
  ["06-Wilson", "process-wilson", 0.62],
  ["07-Erdbeben", "seismic-park", 0.48],
  ["08-Erdbebenwellen", "seismic-particles", 0.56],
  ["09-Vulkanformen", "seismic-forms", 0.55],
  ["10-Maar", "seismic-maar", 0.49],
  ["11-Ulmener-Maar", "seismic-ulmen"],
  ["12-Ulmen-Wittlich", "towns"],
  ["13-Seeschichtung", "seismic-mixCompare", 0.62],
  ["14-Gasreiche-Wassersaeule", "seismic-waterColumn", 0.68],
  ["15-Limnische-Eruption", "nyos-event", 0.89],
  ["16-Entgasungsrohr", "seismic-pipeCut", 0.71],
  ["17-Tiefenprofile", "seismic-profiles"],
  ["18-Inventar", "seismic-profiles", null, "inventory"],
  ["19-Seenvergleich", "seismic-lakeCompare"],
];
let favorite;
try {
  for (const [i, file] of files.entries()) {
    const version = i ? "G6.8.2" : "G6.8.1";
    const dir = join(
      process.env.G65_OUT || "test-results/G65/Vergleich",
      version,
    );
    await mkdir(dir, { recursive: true });
    const ctx = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
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
    page.setDefaultTimeout(75000);
    await cdp.send("Performance.enable");
    const start = performance.now();
    await page.goto(pathToFileURL(resolve(file)).href);
    await page.waitForFunction(() => window.geoObservatory?.().ready);
    const report = {
      version,
      engine: browser.version(),
      startMs: performance.now() - start,
      commit: i
        ? process.env.TEST_COMMIT
        : "cb63276b9a97c79a87671f8d132199180e035497",
      samples: [],
      errors: [],
    };
    page.on("pageerror", (error) => report.errors.push(String(error)));
    const select = (id, v) => page.selectOption("#" + id, v);
    const waitReady = () =>
      page.waitForFunction(
        () =>
          document.querySelector("#geo-crumb").dataset.settled === "true" &&
          !window.geoObservatory().flying,
      );
    const lesson = (id) =>
      page.waitForFunction(
        (id) => window.geoObservatory().observatory.lessonView === id,
        id,
      );
    const topic = async (id) => {
      await select("geo-topic", id);
      await waitReady();
      if (id.startsWith("seismic-")) await lesson(id.slice(8));
    };
    const frame = () =>
      page.evaluate(
        () =>
          new Promise((r) =>
            requestAnimationFrame(() => requestAnimationFrame(r)),
          ),
      );
    const run = async (active) => {
      await switchPresentation(page);
      await page.waitForFunction(
        (active) => document.body.classList.contains("present") === active,
        active,
      );
      await frame();
    };
    if (i) {
      await page.click("#saved-views");
      await page.selectOption("#saved-list", { label: "G6.8.1 GeoRisiko" });
      await page.click("#view-apply");
      await lesson("waterColumn");
      assert.ok(
        Math.abs(
          (await page.evaluate(
            () => window.geoObservatory().observatory.study.time,
          )) - 0.63,
        ) < 0.001,
      );
      report.favoriteMigrated = true;
    } else {
      await topic("seismic-waterColumn");
      await page.locator("#geo-time").fill("0.63");
      await page.click("#saved-views");
      await page.fill("#view-name", "G6.8.1 GeoRisiko");
      await page.click("#view-save");
      await page.click("#view-close");
      favorite = await page.evaluate(() =>
        localStorage.getItem("georisiko.unterrichtsansichten.v1"),
      );
      assert.ok(favorite);
    }
    await select("geo-info", "explain");
    for (const [name, entry, time, variant] of routes) {
      const change = performance.now();
      if (entry === "towns") {
        await select("geo-place", entry);
        await lesson(entry);
        await waitReady();
      } else await topic(entry);
      if (variant) {
        await select("geo-preset", variant);
        await lesson(variant);
        await waitReady();
      }
      if (entry === "nyos-event")
        await page.waitForFunction(() => window.geoObservatory().rendered.nyos);
      if (
        entry === "research" &&
        (await page.locator("#geo-tools").getAttribute("aria-expanded")) ===
          "true"
      )
        await page.click("#geo-tools");
      if (time !== undefined && time !== null)
        await page.locator("#geo-time").fill(String(time));
      await waitReady();
      await frame();
      const changeMs = performance.now() - change;
      const work = await page.evaluate(frameLayout);
      if (["01-Globus", "10-Maar", "17-Tiefenprofile"].includes(name))
        await page.screenshot({
          path: join(dir, name + "-Arbeit.jpg"),
          type: "jpeg",
          quality: 86, timeout: 120000,
        });
      await run(true);
      const presentation = await page.evaluate(frameLayout);
      const pixels = await geometry(page, { enforce: false });
      assert.ok(pixels.foreground > 0.008, name);
      await page.screenshot({
        path: join(dir, name + ".jpg"),
        type: "jpeg",
        quality: 86, timeout: 120000,
      });
      const animated = [
        "10-Maar",
        "14-Gasreiche-Wassersaeule",
        "16-Entgasungsrohr",
        "08-Erdbebenwellen",
      ].includes(name);
      if (animated) await page.click("#geo-play");
      const stats = await page.evaluate(async () => {
        let changes = 0;
        const watcher = new MutationObserver((e) => (changes += e.length));
        watcher.observe(document.querySelector("#desk"), {
          attributes: true,
          childList: true,
          subtree: true,
        });
        const p = await window.geoDeviceProbe(1250);
        watcher.disconnect();
        return {
          fps: p.renderedFps,
          p95: p.p95,
          changes,
          resources: p.states.at(-1),
        };
      });
      if (animated) assert.ok(stats.fps > 5, name);
      const heap = (await cdp.send("Performance.getMetrics")).metrics.find(
        (m) => m.name === "JSHeapUsedSize",
      ).value;
      report.samples.push({
        name,
        changeMs,
        work,
        presentation,
        pixels,
        heap,
        ...stats,
      });
      await run(false);
    }
    await topic("seismic-maar");
    await page.locator("#geo-time").fill("0.69");
    for (const info of ["observe", "terms", "explain", "neutral"]) {
      await select("geo-info", info);
      await run(true);
      await page.screenshot({
        path: join(dir, "10-Maar-" + info + ".jpg"),
        type: "jpeg",
        quality: 87, timeout: 120000,
      });
      await run(false);
    }
    await select("geo-info", "terms");
    const exit = async () => {
      await topic("globe");
      return (await page.evaluate(() => window.geoDeviceProbe(500))).states.at(
        -1,
      );
    };
    report.resources = { before: await exit() };
    for (let repeat = 0; repeat < 3; repeat++) {
      await topic("seismic-waterColumn");
      await topic("seismic-profiles");
      await topic("seismic-maar");
    }
    report.resources.after = await exit();
    assert.deepEqual(report.errors, []);
    await writeFile(join(dir, "Messung.json"), JSON.stringify(report, null, 2));
    await ctx.close();
  }
} finally {
  await browser.close();
}
