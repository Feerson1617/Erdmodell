// Compare real frame submissions, including the paused views, at a fixed scale.
import { chromium } from "playwright";
import { writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const out = process.env.G64_OUT || "test-results/g64";
await mkdir(out, { recursive: true });
const browser = await chromium.launch(
  process.env.G6_NATIVE_GPU
    ? { headless: false }
    : { args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] },
);
const report = { engine: browser.version(), samples: [] };
try {
  for (const file of process.argv.slice(2)) {
    const page = await browser.newPage({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
    });
    await page.addInitScript(() => localStorage.setItem("georisiko.graphics.g6", "classroom"));
    await page.goto(pathToFileURL(resolve(file)).href);
    await page.waitForFunction(() => window.geoObservatory?.().ready);
    await page.click("#nav-plates");
    await page.click("#g-studio");
    await page.locator("#studio-details summary").click();
    for (const n of [1, 4]) {
      await page.selectOption("#studio-count", String(n));
      await page.locator("#g-progress").fill("0.3");
      await page.click("#g-play");
      await page.waitForTimeout(1500);
      for (const running of [true, false]) {
        if (!running) {
          await page.click("#g-play");
          await page.waitForTimeout(500);
        }
        const row = await page.evaluate(async () => {
          const v = await window.geoDeviceProbe(4000);
          return {
            renderedFps: v.renderedFps,
            frames: v.renderedFrames,
            fps: v.fps,
            p95Ms: v.p95,
            maxMs: v.max,
            resolution: v.states[0].resolution,
          };
        });
        console.log(file, n, running, row);
        report.samples.push({ file, n, running, ...row });
        if (running) assert.ok(row.frames > 0);
        else assert.ok(row.frames <= 2);
      }
    }
    await page.close();
  }
} finally {
  await writeFile(join(out, "Prozessleistung.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
