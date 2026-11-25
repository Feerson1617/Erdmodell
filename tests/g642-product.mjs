import { integrity } from "./g642-integrity.mjs";
import assert from "node:assert/strict";
import { chromium, _electron } from "playwright";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { exercise, metrics } from "./g641-classroom.mjs";
const native = process.argv.includes("--installed"),
  group = process.env.G642_GROUP || "all";
const out = resolve(process.env.G642_OUT || "test-results/G642/" + (native ? "App" : "HTML") + "/" + group);
await mkdir(out, { recursive: true });
const time = performance.now(),
  launch = process.env.G6_NATIVE_GPU
    ? { headless: false }
    : { args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] };
const app = native
  ? await _electron.launch({
      executablePath: (await readFile("test-results/mac/executable-path.txt", "utf8")).trim(),
      args: ["--force-device-scale-factor=1", "--user-data-dir=" + join(out, "Profil")],
      timeout: 90000,
    })
  : null;
const browser = native ? null : await chromium.launch(launch);
try {
  const ctx = native
    ? app.context()
    : await browser.newContext({
        viewport: process.platform === "linux" ? { width: 1024, height: 640 } : { width: 1366, height: 768 },
        deviceScaleFactor: 1,
      });
  const network = [];
  await ctx.route(/^https?:\/\//, (route) => {
    network.push(route.request().url());
    return route.abort();
  });
  const page = native ? await app.firstWindow() : await ctx.newPage();
  if (!native) await page.goto(pathToFileURL(resolve("artifacts/GeoRisiko-G6.4.2-Web-Test.html")).href);
  if (native) {
    assert.match(page.url(), /^georisiko:/);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1366, 768));
  }
  await page.waitForFunction(() => window.geoObservatory?.().ready, null, { timeout: 65000 });
  const meta = {
    commit:
      process.env.TEST_COMMIT || execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    run: process.env.GITHUB_RUN_ID,
    platform: process.platform,
    arch: process.arch,
    product: native ? "Installierte App" : "Offline-HTML",
    startMs: performance.now() - time,
    network,
  };
  if (group !== "integritaet")
    await exercise(page, out, {
      group,
      film: process.env.G642_FILM === "1",
      board: !native && group !== "raum",
    });
  if (group === "all" || group === "integritaet")
    await integrity(page, out, { native, app, film: process.env.G642_FILM === "1" });
  if (process.argv.includes("--long")) {
    const start = performance.now(),
      rows = [];
    const set = async (k) => {
      await page.selectOption("#geo-topic", "process-" + k);
      await page.waitForFunction((k) => window.geoObservatory().observatory.studio?.models[0] === k, k);
    };
    const cycle = ["arc", "ridge", "collision", "wilson", "hotspot", "rift", "oblique"];
    for (let i = 0; performance.now() - start < 900000; i++) {
      const change = performance.now();
      if (i % 4 === 0) {
        await page.selectOption("#geo-place", i % 8 === 0 ? "country-de" : "hawaii");
        await page.waitForFunction(
          () =>
            document.querySelector("#geo-crumb").dataset.settled === "true" &&
            !window.geoObservatory().flying,
        );
      }
      await set(cycle[i % cycle.length]);
      const changeMs = performance.now() - change;
      await page.click("#geo-play");
      const sample = await page.evaluate(() => window.geoDeviceProbe(17000));
      await page.click("#geo-play");
      const idle = await page.evaluate(() => window.geoDeviceProbe(1500));
      const rss = await app.evaluate(({ app }) =>
        app.getAppMetrics().map((p) => ({ type: p.type, workingKiB: p.memory.workingSetSize })),
      );
      assert.ok(sample.renderedFrames > 5);
      rows.push({
        process: cycle[i % cycle.length],
        changeMs,
        animatedFps: sample.renderedFps,
        frameP95: sample.p95,
        idleRendered: idle.renderedFrames,
        rss,
        resources: idle.states.at(-1),
      });
      await writeFile(
        join(out, "Dauerlauf.json"),
        JSON.stringify({ minutes: (performance.now() - start) / 60000, rows }, null, 2),
      );
    }
    meta.minutes = (performance.now() - start) / 60000;
    assert.ok(meta.minutes >= 15);
  }
  assert.deepEqual(network, []);
  meta.viewport = await metrics(page);
  await writeFile(join(out, "Produkt.json"), JSON.stringify(meta, null, 2));
} finally {
  await app?.close();
  await browser?.close();
}
