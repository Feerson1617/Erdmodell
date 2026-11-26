import {focusProduct} from "./g682-product.mjs";
import {correctionProduct} from "./g681-product.mjs";
import { ubProduct } from "./g68-product.mjs";
import { corrections, geometry } from "./g651-visual.mjs";
import { seismicClassroom } from "./g65-classroom.mjs";
import { integrity } from "./g642-integrity.mjs";
import {volcanicProduct} from "./volcanic-product.mjs";
import assert from "node:assert/strict";
import { chromium, _electron } from "playwright";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { exercise, metrics } from "./g641-classroom.mjs";
import { switchPresentation } from "./geographic-controls.mjs";
const native = process.argv.includes("--installed"),
  group = process.env.G65_GROUP || "all";
const out = resolve(
  process.env.G65_OUT ||
    "test-results/G65/" + (native ? "App" : "HTML") + "/" + group,
);
await mkdir(out, { recursive: true });
const time = performance.now(),
  launch = process.env.G6_NATIVE_GPU
    ? { headless: false }
    : { args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] };
const app = native
  ? await _electron.launch({
      executablePath: (
        await readFile("test-results/mac/executable-path.txt", "utf8")
      ).trim(),
      args: [
        "--georisiko-window-test",
        "--force-device-scale-factor=1",
        "--user-data-dir=" + join(out, "Profil"),
      ],
      timeout: 90000,
    })
  : null;
const browser = native ? null : await chromium.launch(launch);
try {
  const ctx = native
    ? app.context()
    : await browser.newContext({
        viewport:
          process.platform === "linux"
            ? { width: 1024, height: 640 }
            : { width: 1366, height: 768 },
        deviceScaleFactor: 1,
      });
  const network = [];
  await ctx.route(/^https?:\/\//, (route) => {
    network.push(route.request().url());
    return route.abort();
  });
  const page = native ? await app.firstWindow() : await ctx.newPage();
  if (!native)
    await page.goto(
      pathToFileURL(resolve("artifacts/GeoRisiko-G6.8.2-Web-Test.html")).href,
    );
  if (native) {
    assert.match(page.url(), /^georisiko:/);
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setContentSize(1366, 768),
    );
  }
  await page.waitForFunction(() => window.geoObservatory?.().ready, null, {
    timeout: 65000,
  });
  const meta = {
    commit:
      process.env.TEST_COMMIT ||
      execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    run: process.env.GITHUB_RUN_ID,
    platform: process.platform,
    arch: process.arch,
    product: native ? "Installierte App" : "Offline-HTML",
    startMs: performance.now() - time,
    network,
  };
  if (!["integritaet", "seismologie", "korrektur","vulkaneifel","ub","rc","focus"].includes(group))
    await exercise(page, out, {
      group,
      film: false,
      board: !native && group !== "raum",
    });
  if (group === "all" || group === "integritaet")
    await integrity(page, out, {
      native,
      app,
      film: false,
    });
  if (group === "all" || group === "seismologie")
    await seismicClassroom(page, out, {
      app,
      film: false,
    });
  if (group === "all" || group === "korrektur")
    await corrections(page, out, { app, film: false });
  if(group==="all"||group==="vulkaneifel")await volcanicProduct(page,out,{app,phase:"G67",film:false});
  if (group==="all" || group==="ub") await ubProduct(page,out,{app,film:false});
  if (group==="all" || group==="rc") await correctionProduct(page,out,{app,film:false});
  if (group==="all" || group==="focus") await focusProduct(page,out,{app,film:process.env.G65_FILM==="1"});
  const targetMinutes=Number(process.env.G68_SOAK_MINUTES||15);
  if (process.argv.includes("--long")) {
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setContentSize(1366, 768),
    );
    await page.waitForFunction(
      () => innerWidth === 1366 && innerHeight === 768,
    );
    const start = performance.now(),
      rows = [];
    const present = async (active) => {
      if ((await page.locator("body.present").count()) === Number(active)) return;
      await switchPresentation(page);
      await page.waitForFunction(
        (active) => document.body.classList.contains("present") === active,
        active,
      );
      if (!active)
        await app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].setContentSize(1366, 768),
        );
    };
    const set = async (k) => {
      const topic =
        { stations: "particles", sites: "moment", monitor: "vt", unsaturated: "waterColumn" }[k] || k;
      await page.selectOption("#geo-topic", "seismic-" + topic);
      if (topic !== k) {
        await page.waitForFunction(
          (id) => window.geoObservatory().observatory.lessonView === id,
          topic,
        );
        const info = await page.locator("#geo-info").inputValue();
        // Choose the variant with names enabled, then resume observing it.
        if (info === "observe" || info === "neutral")
          await page.selectOption("#geo-info", "terms");
        await page.selectOption("#geo-preset", k);
        if (info === "observe" || info === "neutral")
          await page.selectOption("#geo-info", info);
      }
      await page.waitForFunction(
        (k) =>
          window.geoObservatory().observatory.lessonView === k &&
          document.querySelector("#geo-crumb").dataset.settled === "true",
        k,
      );
    };
    const cycle = [
      "strike",
      "park",
      "maar",
      "mixCompare",
      "waterColumn",
      "unsaturated",
      "pipeCut",
      "rays",
      "degassing",
      "dissolved",
    ];
    for (let i = 0; performance.now() - start < targetMinutes*60000; i++) {
      const change = performance.now();
      await present(false);
      if (i % 4 === 0) {
        await page.selectOption(
          "#geo-place",
          i % 8 === 0 ? "country-de" : "hawaii",
        );
        await page.waitForFunction(
          () =>
            document.querySelector("#geo-crumb").dataset.settled === "true" &&
            !window.geoObservatory().flying,
        );
      }
      await set(cycle[i % cycle.length]);
      const info = ["observe", "terms", "explain", "neutral"][Math.floor(i / 2) % 4];
      const presentation = i % 3 !== 2;
      if (presentation) {
        await present(true);
        await page.click("#geo-controls");
      }
      await page.selectOption("#geo-info", info);
      if (presentation) await page.click("#geo-controls");
      const changeMs = performance.now() - change;
      await page.locator("#geo-time").fill("0.05");
      await page.click("#geo-play");
      const animatedVisible = await geometry(page);
      const sample = await page.evaluate(() => window.geoDeviceProbe(17000));
      await page.locator("#geo-time").fill("0.63");
      const visible = await geometry(page);
      const idle = await page.evaluate(() => window.geoDeviceProbe(1500));
      const rss = await app.evaluate(({ app }) =>
        app
          .getAppMetrics()
          .map((p) => ({ type: p.type, workingKiB: p.memory.workingSetSize })),
      );
      assert.ok(sample.renderedFrames > 5);
      rows.push({
        process: cycle[i % cycle.length],
        presentation,
        info,
        presentationMs: presentation ? sample.elapsedMs + idle.elapsedMs : 0,
        changeMs,
        animatedVisible,
        visible,
        animatedFps: sample.renderedFps,
        frameP95: sample.p95,
        idleRendered: idle.renderedFrames,
        rss,
        resources: idle.states.at(-1),
      });
      await writeFile(
        join(out, "Dauerlauf.json"),
        JSON.stringify(
          { minutes: (performance.now() - start) / 60000, rows },
          null,
          2,
        ),
      );
    }
    meta.minutes = (performance.now() - start) / 60000;
    assert.ok(meta.minutes >= targetMinutes);
    if (targetMinutes >= 45)
      assert.ok(rows.reduce((sum, row) => sum + row.presentationMs, 0) >= 15 * 60000);
  }
  assert.deepEqual(network, []);
  meta.viewport = await metrics(page);
  await writeFile(join(out, "Produkt.json"), JSON.stringify(meta, null, 2));
} finally {
  await app?.close();
  await browser?.close();
}
