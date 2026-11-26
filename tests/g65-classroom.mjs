import { chooseRelated } from "./geographic-controls.mjs";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PNG } from "pngjs";
import { screencast } from "./g5-abnahme.mjs";
import { metrics } from "./g641-classroom.mjs";

export async function seismicClassroom(page, out, { app, film = false } = {}) {
  page.setDefaultTimeout(55000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const proof = {
    routes: [],
    movies: [],
    frames: [],
    windows: [],
    errors: [],
    loads: [],
  };
  const onError = (e) => proof.errors.push(e.message);
  page.on("pageerror", onError);
  const select = (id, v) => page.selectOption("#" + id, v),
    click = (id) => page.click("#" + id);
  const settled = () =>
    page.waitForFunction(
      () =>
        document.querySelector("#geo-crumb")?.dataset.settled === "true" &&
        !window.geoObservatory().flying,
    );
  async function arrive(id, start) {
    await page.waitForFunction(
      (id) =>
        window.geoObservatory().observatory.lessonView === id &&
        document.querySelector("#geo-crumb").dataset.settled === "true" &&
        !window.geoObservatory().flying,
      id,
    );
    const state = await page.evaluate(() => {
      const w = window.geoObservatory(),
        o = w.observatory;
      return {
        id: o.lessonView,
        path: document.querySelector("#geo-crumb").textContent,
        title: document.querySelector("#geo-title").textContent,
        mode: o.mode,
        scene: o.renderScene,
        site: o.site,
        layers: o.atlas?.layers,
        worldDrawn: w.rendered.worldDrawn,
        eye: o.study?.eye ?? o.camera ?? w.rendered.camera,
        objects: o.studyObjects ?? o.drawnObjects,
        painted: o.painted,
      };
    });
    assert.ok(state.painted && state.title && state.path);
    if (state.mode === "regional") assert.ok(state.scene && !state.worldDrawn);
    if (state.mode === "seismic")
      assert.ok(
        !state.worldDrawn && state.objects.length && state.eye.length === 3,
      );
    proof.loads.push({ id, ms: performance.now() - start });
    proof.routes.push(state);
  }
  const topic = async (id) => {
    const t = performance.now();
    await select("geo-topic", "seismic-" + id);
    await arrive(id, t);
  };
  const preset = async (id) => {
    const t = performance.now();
    await select("geo-preset", id);
    await arrive(id, t);
  };
  const link = async (id) => {
    const t = performance.now();
    await chooseRelated(page);
    await arrive(id, t);
  };
  const phase = async (t) => {
    await page.locator("#geo-time").fill(String(t));
    await page.waitForTimeout(140);
  };
  async function photo(id) {
    await page.screenshot({
      path: join(out, "Beben-" + id + ".jpg"),
      quality: 86,
      type: "jpeg",
      timeout: 150000,
    });
    proof.frames.push(id);
  }
  const flow = async (name, perform) => {
    if (film)
      proof.movies.push(await screencast(page, out, "G65-" + name, perform));
    else await perform();
  };
  try {
    await select("geo-info", "explain");
    await flow("A-Globale-Verteilung", async () => {
      await topic("distribution");
      await photo("Welt");
      await link("boundaries");
      await preset("depthMap");
      assert.equal(await page.locator("#geo-legend .quake-key").count(), 3);
      await photo("Herdtiefen");
      await link("observed");
      await link("slab");
      await link("tohoku");
      await photo("Regionaler-Schnitt");
      await select("geo-topic", "globe");
      await settled();
      assert.equal(
        await page.evaluate(() => window.geoObservatory().observatory.mode),
        "",
      );
    });
    await flow("B-Bruch-und-Versatz", async () => {
      await topic("park");
      await phase(0.12);
      await photo("Parkfield-Beginn");
      await preset("strain");
      await photo("Elastische-Verformung");
      await link("break");
      await phase(0.46);
      await photo("Bruchausbreitung");
      await phase(0.99);
      await photo("Bleibender-Versatz");
      await link("strike");
      for (const id of [
        "normal",
        "reverse",
        "oblique",
        "megathrust",
        "thrust",
      ]) {
        await preset(id);
        await phase(0.72);
        await photo("Mechanismus-" + id);
      }
      await link("nepal");
      assert.equal(proof.routes.at(-1).site, "himalaya");
    });
    await flow("C-Wellen-und-Seismogramm", async () => {
      await topic("park");
      await preset("focus");
      await photo("Hypozentrum-Epizentrum");
      await link("particles");
      await phase(0.27);
      await photo("Teilchen");
      await click("geo-play");
      await page.waitForFunction(
        () => window.geoObservatory().observatory.study.time > 0.31,
      );
      await click("geo-play");
      await preset("surface");
      await phase(0.42);
      await photo("Oberflaechenwellen");
      await preset("stations");
      await phase(0.67);
      await photo("Zwei-Stationen");
      await preset("record");
      await photo("Originalmessung");
    });
    await flow("D-Erdinneres", async () => {
      await topic("rays");
      await phase(0.56);
      await photo("Schattenzonen");
      await preset("conversion");
      await phase(0.61);
      await photo("SKS");
      await chooseRelated(page);
      await settled();
      assert.equal(
        await page.evaluate(() => window.geoObservatory().mode),
        "inside",
      );
    });
    await flow("E-Magnitude-und-Intensitaet", async () => {
      await topic("moment");
      await phase(0.88);
      await photo("Momentenvergleich");
      await link("sites");
      await phase(0.87);
      await photo("Untergrund");
      await link("distance");
      await phase(0.72);
      await photo("Entfernung");
    });
    await flow("F-Japan-und-Vulkanbogen", async () => {
      await topic("distribution");
      await preset("sizeMap");
      await photo("Magnitudenkarte");
      await preset("trenches");
      await photo("Subduktionsfronten");
      await preset("volcanoMap");
      await photo("Beben-und-Vulkane");
      await link("observed");
      await preset("shallowDeep");
      await photo("Flacher-tiefer-Herd");
      await preset("slab");
      await photo("Japan-Herdprofil");
      await link("tohoku");
      await link("zao");
      await photo("Zaozan-Mantelkeil");
    });
    await flow("G-Magmatisches-System", async () => {
      await topic("vt");
      for (const id of [
        "tectonic",
        "vt",
        "fluid",
        "tremor",
        "quiet",
        "monitor",
      ]) {
        await preset(id);
        await phase(0.75);
        await photo("Signale-" + id);
      }
      await select("geo-info", "observe");
      await page.waitForFunction(
        () =>
          ![...document.querySelectorAll(".seismic-label")].some(
            (e) => e.offsetWidth,
          ),
      );
      assert.ok(await page.locator("#geo-crumb").isVisible());
      await select("geo-info", "neutral");
      await page.waitForSelector("#geo-crumb", { state: "hidden" });
      await select("geo-info", "explain");
      await phase(0.61);
      await click("saved-views");
      await page.fill("#view-name", "G6.5 · Monitoring");
      await click("view-save");
      await click("view-close");
      await topic("moment");
      await click("saved-views");
      await page
        .locator("#saved-list")
        .selectOption({ label: "G6.5 · Monitoring" });
      await click("view-apply");
      await arrive("monitor", performance.now());
      assert.equal(
        await page.evaluate(
          () => window.geoObservatory().observatory.study.time,
        ),
        0.61,
      );
    });
    await topic("particles");
    await preset("stations");
    for (const [width, height] of [
      [740, 530],
      [900, 600],
      [1280, 720],
      [1366, 768],
      [1920, 1080],
      [2560, 1440],
    ]) {
      if (app)
        await app.evaluate(
          ({ BrowserWindow }, xy) =>
            BrowserWindow.getAllWindows()[0].setContentSize(...xy),
          [width, height],
        );
      else await page.setViewportSize({ width, height });
      await page.waitForFunction(
        ([w, h]) => innerWidth === w && innerHeight === h,
        [width, height],
      );
      await page.waitForTimeout(200);
      const ui = await page.evaluate(() => {
        const controls = [
          ...document.querySelectorAll(
            "#geo-dock :is(button,select,input),#geo-place,#geo-topic",
          ),
        ].filter((e) => e.offsetWidth && !e.hidden);
        const bad = controls
          .filter((e) => {
            const b = e.getBoundingClientRect();
            return (
              b.x < 0 || b.right > innerWidth + 1 || b.bottom > innerHeight + 1
            );
          })
          .map((e) => e.id);
        const fig = document
            .querySelector(".seismic-figure")
            .getBoundingClientRect(),
          chart = document
            .querySelector(".seismic-chart")
            .getBoundingClientRect();
        return {
          bad,
          scroll: document.documentElement.scrollHeight - innerHeight,
          chartFraction: chart.height / fig.height,
        };
      });
      assert.deepEqual(ui.bad, []);
      assert.ok(
        ui.scroll <= 1 && ui.chartFraction < 0.35 && ui.chartFraction > 0.1,
        JSON.stringify(ui),
      );
      const png = PNG.sync.read(
        await page.locator("#earth").screenshot({ timeout: 120000 }),
      );
      let occupied = 0,
        total = 0;
      for (let y = 0; y < png.height; y += 5)
        for (let x = 0; x < png.width; x += 5) {
          const i = (y * png.width + x) * 4;
          total++;
          if (
            Math.abs(png.data[i] - 24) +
              Math.abs(png.data[i + 1] - 42) +
              Math.abs(png.data[i + 2] - 50) >
            45
          )
            occupied++;
        }
      const nativeWindow = app
        ? await app.evaluate(({ BrowserWindow }) =>
            BrowserWindow.getAllWindows()[0].getContentSize(),
          )
        : undefined;
      if (app) assert.deepEqual(nativeWindow, [width, height]);
      proof.windows.push({
        width,
        height,
        ...ui,
        nativeWindow,
        usable: (await metrics(page)).usable,
        foreground: occupied / total,
      });
      await photo("Fenster-" + width);
    }
    assert.deepEqual(proof.errors, []);
    proof.complete = true;
  } finally {
    page.off("pageerror", onError);
    await writeFile(
      join(out, "Seismologie.json"),
      JSON.stringify(proof, null, 2),
    );
  }
}
