import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

export async function visitStudio(page, out, extensive = false) {
  await mkdir(out, { recursive: true });
  const report = {
    films: [],
    shots: [],
    models: [],
    smartboards: [],
    changes: [],
    states: [],
    complete: false,
  };
  const state = () => page.evaluate(() => window.geoObservatory().observatory.studio);
  const click = (id) => page.locator("#" + id).click(),
    select = (id, value) => page.selectOption("#" + id, value);
  const rest = () =>
    page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const shot = async (name) => {
    await rest();
    await page.screenshot({ path: join(out, name + ".jpg"), type: "jpeg", quality: 83 });
    report.shots.push(name);
  };
  const phase = async (n) => {
    await page.locator("#g-progress").fill(String(n));
    await rest();
  };
  try {
    await click("nav-inside");
    await click("g-earth-structure");
    assert.equal((await state()).layer, -1);
    await select("studio-layer", "2");
    await shot("01-Stofflicher-Aufbau");
    await select("studio-division", "mechanics");
    assert.equal((await state()).layer, -1);
    await select("studio-layer", "0");
    await click("studio-expand");
    await shot("02-Mechanische-Schichten");
    await click("nav-plates");
    await click("g-studio");
    if (!(await page.locator("#studio-details").evaluate((x) => x.open)))
      await page.locator("#studio-details summary").click();
    await page.check("#studio-measure");
    await select("studio-rate", "25");
    await page.locator("#studio-km").fill("100");
    assert.match(await page.locator("#studio-reading").textContent(), /4 Ma.*50 mm/);
    await select("studio-analysis", "magnet");
    await select("studio-view", "top");
    await shot("03-Magnetstreifen-und-Messung");
    await select("studio-analysis", "age");
    await shot("04-Alter-der-Flanken");
    await select("studio-analysis", "natural");
    await select("studio-view", "block");
    await select("studio-count", "4");
    await phase(0.54);
    await shot("05-Vier-Prozesse");
    await page.locator(".studio-cell button").nth(1).click();
    assert.equal((await state()).focus, 1);
    await page.check("#studio-paths");
    await page.check("#studio-label-1");
    await shot("06-Subduktion-Mantelkeil");
    await page.locator(".studio-cell button").first().click();
    assert.equal((await state()).time, 0.54);
    if (extensive && process.env.G64_FILM) {
      const { screencast } = await import("./g5-abnahme.mjs");
      const comparison = await screencast(page, out, "Vergleich-und-Mantelkeil", async () => {
        await phase(0.12);
        await click("g-play");
        await page.waitForTimeout(3900);
        await click("g-play");
        await page.locator(".studio-cell button").nth(1).click();
        await page.waitForTimeout(1800);
        await phase(0.72);
        await page.waitForTimeout(1600);
        await page.locator(".studio-cell button").first().click();
        await page.waitForTimeout(1100);
      });
      report.films.push(comparison);
    }
    await select("studio-count", "1");
    await select("studio-model", "wilson");
    await page.check("#studio-label-0");
    for (const t of extensive ? [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1] : [0, 0.5, 1]) {
      await phase(t);
      await shot("07-Wilson-" + String(Math.round(t * 8) + 1));
      report.states.push({ phase: t, caption: await page.locator(".studio-cell span").textContent() });
    }
    if (extensive && process.env.G64_FILM) {
      const { screencast } = await import("./g5-abnahme.mjs");
      report.films.push(
        await screencast(page, out, "Wilson-Zyklus", async () => {
          await phase(0);
          await click("g-play");
          await page.waitForFunction(() => window.geoObservatory().observatory.studio.time >= 1, null, {timeout: 100000});
          await page.waitForTimeout(650);
        }),
      );
    }
    if (extensive) {
      for (const v of await page
        .locator("#studio-model option")
        .evaluateAll((os) => os.map((o) => o.value).filter((k) => !["earth", "wilson"].includes(k)))) {
        await select("studio-model", v);
        await phase(0.12);
        const start = await page.locator("#earth").screenshot();
        await phase(0.88);
        const finish = await page.locator("#earth").screenshot();
        assert.notEqual(
          createHash("sha256").update(start).digest("hex"),
          createHash("sha256").update(finish).digest("hex"),
          v,
        );
        report.models.push(v);
        await shot("08-" + v);
      }
    }
    await select("studio-model", "collision");
    await phase(0.32);
    await click("g-play");
    await page.waitForFunction(() => window.geoObservatory().observatory.studio.time > 0.33);
    await click("g-play");
    const stopped = (await state()).time;
    await click("g-step");
    assert.ok((await state()).time > stopped);
    await click("obswitch");
    await page.waitForFunction(() => !document.querySelector(".studio-cell button"));
    await page.locator("#observe-release summary").click();
    await page.locator('[data-release="one"]').click();
    await page.waitForFunction(() =>
      document.querySelector(".studio-cell button")?.textContent.includes("Kontinentkollision"),
    );
    await page.locator('[data-release="none"]').click();
    await page.locator("#observe-release summary").click();
    if (extensive) {
      await click("present");
      await page.waitForFunction(() => document.body.classList.contains("present"));
    }
    if (extensive)
      for (const [width, height] of [
        [1280, 720],
        [1366, 768],
        [1920, 1080],
        [2560, 1440],
      ]) {
        await page.setViewportSize({ width, height });
        await rest();
        const bounds = await page.locator("#earth").boundingBox();
        const ratio = (bounds.width * bounds.height) / (width * height);
        assert.ok(ratio >= 0.85, "Präsentationsfläche " + ratio);
        report.smartboards.push({ width, height, ratio });
        await shot("09-Praesentation-" + width);
      }
    if (extensive) await click("present");
    await click("obswitch");
    if (extensive) {
      await page.setViewportSize({ width: 1366, height: 768 });
      if (!(await page.locator("#studio-details").evaluate((el) => el.open)))
        await page.locator("#studio-details summary").click();
      const prior = await state();
      await click("studio-region");
      await page.waitForSelector("#studio-return");
      await page.selectOption("#g-view", "land");
      await page.getByText("Modell steuern", { exact: true }).click();
      await page.check("#g-relief-only");
      await shot("11-Himalaya-Relief");
      await click("studio-return");
      assert.deepEqual(await state(), prior);

      await click("saved-views");
      await page.fill("#view-name", "G64 Vergleich");
      await click("view-save");
      await click("view-close");
      const saved = await state();
      await click("nav-globe");
      await click("saved-views");
      await page.selectOption("#saved-list", { label: "G64 Vergleich" });
      await click("view-apply");
      await page.waitForSelector("#studio-model");
      assert.deepEqual(await state(), saved);
      report.favorite = true;
    }
    await click("studio-atlas");
    await page.waitForSelector("#research-projection");
    await select("research-base", "bathy");
    await page.waitForFunction(() =>
      document.querySelector("#research-reading")?.textContent.includes("Klick"),
    );
    await shot("10-Bathymetrie");
    await click("nav-globe");
    await page.waitForFunction(() => !document.querySelector(".studio-overlay,.research-map-plane"));
    report.complete = true;
    return report;
  } finally {
    await writeFile(join(out, "Prozesspruefung.json"), JSON.stringify(report, null, 2));
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch(
    process.env.G6_NATIVE_GPU
      ? { headless: false }
      : { args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] },
  );
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, reducedMotion: "reduce" });
  page.setDefaultTimeout(45000);
  const errors = [],
    external = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route(/^https?:/, (r) => {
    external.push(r.request().url());
    return r.abort();
  });
  try {
    await page.goto(pathToFileURL(resolve(process.argv[2])).href);
    await page.waitForFunction(() => window.geoObservatory?.().ready);
    await visitStudio(page, process.env.G64_OUT || "test-results/g64", true);
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
  } finally {
    await browser.close();
  }
}
