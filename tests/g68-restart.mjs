import assert from "node:assert/strict";
import { chromium, _electron } from "playwright";
import { readFile, writeFile, mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { geometry } from "./g651-visual.mjs";
const native = process.argv.includes("--installed"),
  out = resolve(process.env.G65_OUT || "test-results/G65/HTML");
await mkdir(out, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), "georisiko-neustart-"));
const file = pathToFileURL(
  resolve("artifacts/GeoRisiko-G6.8.1-Web-Test.html"),
).href;
const savedName = "G6.8.1 Wassersäule";
let first, restored, mask;
for (let i = 0; i < 2; i++) {
  const app = native
    ? await _electron.launch({
        executablePath: (
          await readFile("test-results/mac/executable-path.txt", "utf8")
        ).trim(),
        args: ["--georisiko-window-test", "--user-data-dir=" + profile],
      })
    : null;
  const ctx = app
    ? app.context()
    : await chromium.launchPersistentContext(profile, {
        headless: !process.env.G6_NATIVE_GPU,
        args: process.env.G6_NATIVE_GPU
          ? []
          : ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
        viewport: { width: 1366, height: 768 },
      });
  try {
    await ctx.route(/^https?:/, (route) => route.abort());
    const page = app ? await app.firstWindow() : ctx.pages()[0];
    if (!app) await page.goto(file);
    await page.waitForFunction(() => window.geoObservatory?.().ready);
    if (!i) {
      await page.selectOption("#geo-topic", "seismic-waterColumn");
      await page.waitForFunction(
        () => window.geoObservatory().observatory.lessonView === "waterColumn",
      );
      await page.locator("#geo-time").fill("0.71");
      first = await page.evaluate(
        () => window.geoObservatory().observatory.study,
      );
      await page.click("#saved-views");
      await page.fill("#view-name", savedName);
      await page.click("#view-save");
      await page.click("#view-close");
    } else {
      await page.click("#saved-views");
      await page.selectOption("#saved-list", { label: savedName });
      await page.click("#view-apply");
      await page.waitForFunction(
        () =>
          window.geoObservatory().observatory.lessonView === "waterColumn" &&
          Math.abs(window.geoObservatory().observatory.study.time - 0.71) <
            0.001,
      );
      restored = await page.evaluate(
        () => window.geoObservatory().observatory.study,
      );
      assert.equal(restored.playing, first.playing);
      assert.ok(
        restored.eye.every((x, i) => Math.abs(x - first.eye[i]) < 0.01),
      );
      mask = await geometry(page);
    }
  } finally {
    if (app) await app.close();
    else await ctx.close();
  }
}
await writeFile(
  join(out, "Neustart.json"),
  JSON.stringify({ native, first, restored, mask }, null, 2),
);
