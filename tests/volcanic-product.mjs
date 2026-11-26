import { chooseRelated, compareLake } from "./geographic-controls.mjs";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { geometry, sizes } from "./g651-visual.mjs";
import { screencast } from "./g5-abnahme.mjs";
export async function volcanicProduct(
  page,
  out,
  { app, phase = "G66", film = false } = {},
) {
  await mkdir(out, { recursive: true });
  const report = {
    routes: [],
    phase,
    frames: [],
    movies: [],
    windows: [],
    errors: [],
  };
  const errors = (e) => report.errors.push(String(e));
  page.on("pageerror", errors);
  const select = (id, v) => page.selectOption("#" + id, v);
  const arrived = (id) =>
    page.waitForFunction(
      (id) =>
        window.geoObservatory().observatory.lessonView === id &&
        document.querySelector("#geo-crumb").dataset.settled === "true",
      id,
    );
  const open = async (id, child = false) => {
    await select(
      child ? "geo-preset" : "geo-topic",
      child ? id : "seismic-" + id,
    );
    await arrived(id);
  };
  const time = async (t) => {
    await page.locator("#geo-time").fill(String(t));
    await page.evaluate(
      () =>
        new Promise((ok) =>
          requestAnimationFrame(() => requestAnimationFrame(ok)),
        ),
    );
  };
  const check = async (id) => {
    const g = await geometry(page);
    report.frames.push({ id, foreground: g.foreground });
    await page.screenshot({
      path: join(out, id + ".jpg"),
      type: "jpeg",
      quality: 84,
    });
  };
  await select("geo-info", "explain");
  for (const [id, child] of [
    ["shield", false],
    ["lava", true],
    ["cone", false],
    ["plume", true],
    ["storage", false],
    ["degassing", false],
    ["contact", false],
  ]) {
    await open(id, child);
    await time(0.68);
    await check(id);
  }
  if (phase === "G67") await lakes();
  async function lakes() {
    const relate = async (id) => {
      await chooseRelated(page);
      await arrived(id);
    };
    const nyos = async (id) => {
      await select("geo-topic", "nyos-" + id);
      await page.waitForFunction(
        () =>
          window.geoObservatory().mode === "nyos" &&
          document.querySelector("#geo-crumb").dataset.settled === "true",
      );
    };
    const settle = () =>
      page.waitForFunction(
        () => document.querySelector("#geo-crumb").dataset.settled === "true",
      );
    const place = async (id) => {
      await select("geo-place", id);
      await settle();
    };
    const topic = async (id) => {
      await select("geo-topic", id);
      await settle();
    };
    await topic("globe");
    await topic("process-subduction");
    await open("zao");
    await check("Subduktion-Magmenbildung");
    await open("cone");
    await relate("plume");
    report.routes.push("A");
    await place("hawaii");
    await open("shield");
    await relate("lava");
    await relate("cone");
    report.routes.push("B");
    await open("storage");
    await relate("degassing");
    await time(0.2);
    await check("Exsolution");
    await time(0.96);
    await check("Gasaustritt");
    report.routes.push("C");
    await topic("globe");
    await place("space-Europa");
    await select("geo-place", "country-de");
    await page.waitForFunction(
      () => document.querySelector("#geo-crumb").dataset.settled === "true",
    );
    await select("geo-place", "eifel");
    await arrived("eifel");
    await check("Vulkaneifel");
    await relate("ulmen");
    await check("Ulmen");
    await open("aerial", true);
    await check("Uferlinie");
    await relate("lakeCut");
    await check("Seeschnitt");
    report.routes.push("E");
    await relate("maar");
    for (const [i, t] of [0, 0.27, 0.49, 0.72, 1].entries()) {
      await time(t);
      await check("Maar-" + i);
    }
    for (const [w, h] of sizes) {
      if (app)
        await app.evaluate(
          ({ BrowserWindow }, wh) =>
            BrowserWindow.getAllWindows()[0].setContentSize(...wh),
          [w, h],
        );
      else await page.setViewportSize({ width: w, height: h });
      await page.waitForFunction(
        ([w, h]) => innerWidth === w && innerHeight === h,
        [w, h],
      );
      await check("Maar-Fenster-" + w);
      const scroll = await page.evaluate(
        () => document.documentElement.scrollHeight - innerHeight,
      );
      assert.ok(scroll <= 1);
      const clipped = await page.evaluate(() => [...document.querySelectorAll(
        "#geo-dock button,#geo-dock select,#geo-dock input,#geo-place,#geo-topic"
      )].filter(el=>el.offsetWidth && !el.hidden).filter(el=>{
        const box=el.getBoundingClientRect();
        return box.left < -1 || box.top < -1 || box.right > innerWidth+1 || box.bottom > innerHeight+1;
      }).map(el=>el.id));
      assert.deepEqual(clipped,[]);
      report.windows.push([w, h]);
    }
    if (app)
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].setContentSize(1366, 768),
      );
    else await page.setViewportSize({ width: 1366, height: 768 });
    await select("geo-info", "observe");
    await page.click("#geo-release");
    await page.locator('.seismic-pick[data-term="Tuffwall"]').click();
    await page.waitForFunction(() =>
      [...document.querySelectorAll(".seismic-label")]
        .filter((e) => !e.hidden)
        .some((e) => e.dataset.term === "Tuffwall"),
    );
    await check("Begriffsfreigabe");
    await page.click("#geo-clear");
    await select("geo-info", "explain");
    await open("dryMaar", true);
    await time(1);
    await check("Trockenmaar");
    report.routes.push("D");
    await open("mixing");
    await time(0.53);
    await check("Schichtung");
    await open("turnover", true);
    await time(0.5);
    await check("Vollzirkulation");
    await open("dissolved");
    await time(0.74);
    await check("Loesung");
    await nyos("event");
    await time(0.58);
    await check("Nyos-Freisetzung");
    report.routes.push("F");
    await open("ulmen");
    await topic("globe");
    await place("space-Afrika");
    await place("country-cm");
    await nyos("pipe");
    await time(0.82);
    await check("Nyos-Entgasung");
    await chooseRelated(page);
    await arrived("lakeCompare");
    await compareLake(page, "0");
    await check("Seenvergleich");
    await compareLake(page, "1");
    assert.match(
      await page.locator(".lake-evidence").innerText(),
      /Für diese Darstellung liegen keine belastbaren Messdaten vor/,
    );
    await compareLake(page, "1");
    assert.match(await page.locator(".lake-evidence").innerText(), /15,6 bar/);
    report.routes.push("G");
    if (film) {
      const playback = async (seconds) => {
        await time(0);
        await page.click("#geo-play");
        await page.waitForTimeout(seconds * 1000);
      };
      const movie = async (name, fn) => {
        const m = await screencast(page, out, name, fn, { fixedFrame: true });
        assert.ok(m.seconds >= 18 && m.frames >= 35);
        report.movies.push(m);
      };
      await movie("G67-Vulkanische-Prozesse", async () => {
        await open("storage");
        await playback(23);
        await open("degassing");
        await playback(23);
        await open("shield");
        await open("lava", true);
        await playback(15);
        await open("plume", true);
        await playback(15);
      });
      await movie("G67-Maarentstehung", async () => {
        await open("contact");
        await playback(23);
        await relate("maar");
        await playback(28);
        await relate("ulmen");
        await page.waitForTimeout(2000);
      });
      await movie("G67-Seen-und-Entgasung", async () => {
        await open("ulmen");
        await relate("lakeCut");
        await open("mixing");
        await playback(6);
        await open("dissolved");
        await playback(7);
        await nyos("event");
        await playback(25);
        await nyos("pipe");
        await playback(13);
        await chooseRelated(page);
        await arrived("lakeCompare");
        await compareLake(page, "1");
        await page.waitForTimeout(2000);
      });
    }
  }
  assert.deepEqual(report.errors, []);
  page.off("pageerror", errors);
  await writeFile(join(out, phase + ".json"), JSON.stringify(report, null, 2));
}
