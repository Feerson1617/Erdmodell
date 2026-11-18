import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { preview } from "vite";
import { chromium, webkit } from "playwright";
const root = resolve(process.argv[2] ?? "dist-g2a");
const dest = "test-results/g2a";
await mkdir(dest, { recursive: true });
const server = await preview({
  configFile: false,
  base: "/schule/g2a/",
  build: { outDir: root },
  preview: { port: 0, host: "127.0.0.1" },
  logLevel: "error",
});
const url =
  "http://127.0.0.1:" + server.httpServer.address().port + "/schule/g2a/";
const report = {
  commit: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  runs: [],
};
try {
  for (const [engine, driver] of [
    ["chromium", chromium],
    ["webkit", webkit],
  ]) {
    const browser = await driver.launch({
      executablePath:
        process.env[engine === "chromium" ? "CHROMIUM_PATH" : "WEBKIT_PATH"] ||
        undefined,
      args:
        engine === "chromium"
          ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
          : [],
    });
    try {
      const page = await browser.newPage({
        viewport: { width: 1920, height: 1080 },
        reducedMotion: "reduce",
        hasTouch: true,
      });
      const errors = [],
        hashes = new Set(),
        run = { engine, version: browser.version(), regions: [] };
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("response", (r) => {
        if (r.status() >= 400) errors.push(r.url());
      });
      page.on("request", (r) => {
        if (!r.url().startsWith(url)) errors.push(r.url());
      });
      const wait = () =>
        page.waitForFunction(
          () =>
            window.tectonicsAtlas?.().frames > 3 &&
            !window.tectonicsAtlas().flying,
        );
      const snap = async (name) => {
        await page.evaluate(
          () =>
            new Promise((done) =>
              requestAnimationFrame(() => requestAnimationFrame(done)),
            ),
        );
        if (engine === "chromium") {
          const shot = await page.screenshot({
            path: join(dest, name + ".jpg"),
            quality: 88,
          });
          const hash = createHash("sha256").update(shot).digest("hex");
          assert.ok(!hashes.has(hash));
          hashes.add(hash);
        }
      };
      await page.goto(url);
      await wait();
      assert.equal(
        await page.evaluate(() => window.tectonicsAtlas().count),
        5819,
      );
      assert.ok((await page.locator("#placeLabels span:visible").count()) > 1);
      await snap("01-weltkarte");
      await page.tap("#layer");
      assert.ok(await page.locator("#areas").isDisabled());
      assert.equal(await page.locator("#placeLabels").isVisible(), false);
      await page.tap("#layer");
      await page.tap("#areas");
      await page.tap("#names");
      await snap("02-grenztypen");
      await page.tap("#bounds");
      assert.equal(await page.locator("#key").isVisible(), false);
      await page.tap("#bounds");
      await page.tap("#names");
      await page.tap("#areas");
      for (const [site, id, phrase, azimuth] of [
        ["island", 4209, "18,9", 103],
        ["japan", 2629, "92,0", 295],
        ["san", 2877, "45,6", 144],
      ]) {
        await page.tap('[data-site="' + site + '"]');
        await wait();
        const w = await page.evaluate(() => window.tectonicsAtlas());
        assert.equal(w.selected, id);
        const localNames = await page
          .locator("#placeLabels span:visible")
          .allTextContents();
        const pair =
          site === "san"
            ? ["Nordamerikanische Platte", "Pazifische Platte"]
            : site === "japan"
              ? ["Ochotskplatte", "Pazifische Platte"]
              : ["Nordamerikanische Platte", "Eurasische Platte"];
        for (const name of pair) assert.ok(localNames.includes(name), name);
        assert.ok(
          await page
            .locator("#region")
            .innerText()
            .then((t) => t.includes(phrase)),
        );
        assert.equal(await page.locator("#vector").isVisible(), true);
        await page.waitForFunction((expected) => {
          const match = document
            .querySelector("#vector g")
            .getAttribute("transform")
            ?.match(/rotate\(([-.\d]+)\)/);
          return (
            match &&
            Math.abs(((Number(match[1]) - (expected - 90) + 540) % 360) - 180) <
              1.5
          );
        }, azimuth);
        await snap(
          { island: "03-island", japan: "04-tohoku", san: "05-san-andreas" }[
            site
          ],
        );
        run.regions.push({
          site,
          id,
          latitude: w.lat,
          longitude: ((w.lon + 540) % 360) - 180,
          fps: w.fps,
          geometries: w.geometries,
          programs: w.programs,
        });
      }
      await page.tap("#motion");
      assert.equal(await page.locator("#vector").isVisible(), false);
      await page.tap("#motion");
      const box = await page.locator("#earth").boundingBox();
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      assert.match(await page.locator("#region h2").innerText(), /Platte/);
      await page.tap('[data-site="world"]');
      await wait();
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.tap('[data-site="japan"]');
      await wait();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      assert.deepEqual(errors, []);
      report.runs.push(run);
    } finally {
      await browser.close();
    }
  }
} finally {
  await writeFile(join(dest, "pruefung.json"), JSON.stringify(report, null, 2));
  await server.close();
}
