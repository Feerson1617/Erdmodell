import assert from "node:assert/strict";
import { PNG } from "pngjs";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { screencast } from "./g5-abnahme.mjs";

export const sizes = [
  [740, 530],
  [900, 600],
  [1280, 720],
  [1366, 768],
  [1920, 1080],
  [2560, 1440],
];
// Screenshot the composited WebGL canvas, with HTML siblings masked only for this exposure.
export async function geometry(page, { enforce = true } = {}) {
  const projected = await page.evaluate(
    () => window.geoObservatory().observatory.projected ?? [],
  );
  const buf = await page.locator("#earth").screenshot({
    timeout: 120000,
    style:
      ".view > :not(#earth){visibility:hidden!important}.view,#earth{background:#000!important}",
  });
  const im = PNG.sync.read(buf),
    { width: w, height: h, data } = im;
  const signal = (x, y) => {
    const k = (y * w + x) * 4;
    return Math.max(data[k], data[k + 1], data[k + 2]) > 98;
  };
  let count = 0,
    n = 0,
    amber = 0,
    green = 0;
  for (let y = 0; y < h; y += 3)
    for (let x = 0; x < w; x += 3) {
      n++;
      if (signal(x, y)) count++;
      const k = (y * w + x) * 4,
        r = data[k],
        g = data[k + 1],
        b = data[k + 2];
      if (r > 115 && r > 1.15 * b && g > b + 12) amber++;
      if (g > 115 && g > r + 12 && b > r + 12) green++;
    }
  const anchors = projected
    .filter(
      (p) =>
        p.depth >= -1 &&
        p.depth <= 1 &&
        p.x > 0 &&
        p.x < 1 &&
        p.y > 0 &&
        p.y < 1,
    )
    .map((p) => {
      const cx = Math.round(p.x * w),
        cy = Math.round(p.y * h),
        r = Math.max(5, Math.round(h * 0.034));
      let lit = 0,
        total = 0;
      for (let y = Math.max(0, cy - r); y < Math.min(h, cy + r); y += 2)
        for (let x = Math.max(0, cx - r); x < Math.min(w, cx + r); x += 2) {
          total++;
          if (signal(x, y)) lit++;
        }
      return { name: p.name, x: p.x, y: p.y, covered: lit / total };
    });
  const row = {
    width: w,
    height: h,
    foreground: count / n,
    amber: amber / n,
    green: green / n,
    anchors,
  };
  if (enforce) {
    assert.ok(
      count / n > 0.008,
      "WebGL-Geometrie fehlt " + JSON.stringify(row),
    );
    if (anchors.length)
      assert.ok(
        anchors.some((p) => p.covered > 0.035),
        "Kein projizierter Anker trifft sichtbare Geometrie",
      );
  }
  return row;
}
export async function corrections(page, out, { app, film = false } = {}) {
  const results = {
    frames: [],
    screens: [],
    sizes: [],
    stations: [],
    faults: [],
    movies: [],
    errors: [],
  };
  const error = (e) => results.errors.push(String(e));
  page.on("pageerror", error);
  const select = (id, v) => page.selectOption("#" + id, v),
    click = (id) => page.click("#" + id);
  const wait = () =>
    page.evaluate(
      () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        ),
    );
  const arrived = (id) =>
    page.waitForFunction(
      (id) =>
        window.geoObservatory().observatory.lessonView === id &&
        document.querySelector("#geo-crumb").dataset.settled === "true",
      id,
    );
  const topic = async (id) => {
    await select("geo-topic", "seismic-" + id);
    await arrived(id);
  };
  const preset = async (id) => {
    await select("geo-preset", id);
    await arrived(id);
  };
  const phase = async (t) => {
    await page.locator("#geo-time").fill(String(t));
    await wait();
  };
  const show = async (id) => {
    await page.screenshot({
      path: join(out, "G651-" + id + ".jpg"),
      type: "jpeg",
      quality: 87,
      timeout: 120000,
    });
    results.screens.push(id);
  };
  const check = async (id, save = false) => {
    const row = await geometry(page);
    results.frames.push({ id, ...row });
    if (save) await show(id);
    return row;
  };
  const resize = async (w, h) => {
    if (app)
      await app.evaluate(
        ({ BrowserWindow }, [w, h]) =>
          BrowserWindow.getAllWindows()[0].setContentSize(w, h),
        [w, h],
      );
    else await page.setViewportSize({ width: w, height: h });
    await page.waitForFunction(
      ([w, h]) => innerWidth === w && innerHeight === h,
      [w, h],
    );
    await wait();
  };
  const drag = async () => {
    const b = await page.locator("#earth").boundingBox(),
      x = b.x + b.width * 0.55,
      y = b.y + b.height * 0.35;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 42, y + 12, { steps: 9 });
    await page.mouse.up();
    await wait();
  };
  const sample = () =>
    page.evaluate(() => window.geoObservatory().observatory.sampleGeometry);
  const named = () =>
    page
      .locator(".seismic-label:visible")
      .evaluateAll((es) => es.map((e) => e.dataset.term).sort());
  const release = async (name) => {
    await click("geo-release");
    await page.locator('.seismic-pick[data-term="' + name + '"]').click();
    await wait();
  };
  const playThrough = async (model, minTime = 0.98) => {
    await phase(0);
    await click("geo-play");
    await page.waitForFunction(
      ([model, t]) => {
        const o = window.geoObservatory().observatory;
        return (model === "park" ? o.progress : o.study.time) >= t;
      },
      [model, minTime],
      { timeout: 100000 },
    );
    if (minTime < 0.98) await click("geo-play");
  };
  try {
    await select("geo-info", "explain");
    await topic("particles");
    await check("Teilchen");
    await preset("stations");
    await phase(0.28);
    await check("Stationen-regulaer", true);
    for (const [w, h] of sizes) {
      await resize(w, h);
      const row = await check("Fenster-" + w, true);
      for (const prefix of ["Quelle", "Station A", "Station B"])
        assert.ok(
          row.anchors.some(
            (a) => a.name.startsWith(prefix) && a.covered > 0.02,
          ),
          prefix + " fehlt bei " + w,
        );
      assert.ok(row.amber > 0.004 && row.green > 0.0002);
      const ui = await page.evaluate(() => {
        const els = [
          ...document.querySelectorAll(
            "#geo-dock :is(button,input,select),#geo-place,#geo-topic",
          ),
        ].filter((e) => e.offsetWidth && !e.hidden);
        const clipped = els
          .filter((e) => {
            const b = e.getBoundingClientRect();
            return (
              b.left < 0 ||
              b.right > innerWidth + 1 ||
              b.bottom > innerHeight + 1
            );
          })
          .map((e) => e.id);
        const fig = document.querySelector("#earth").getBoundingClientRect(),
          chart = document
            .querySelector(".seismic-chart")
            .getBoundingClientRect();
        const anchors = window
          .geoObservatory()
          .observatory.projected.filter(
            (p) => p.name.startsWith("Station") || p.name === "Quelle",
          );
        const covered = anchors
          .filter((p) => fig.top + p.y * fig.height >= chart.top)
          .map((p) => p.name);
        return {
          clipped,
          covered,
          chartHeight: chart.height,
          scroll: document.documentElement.scrollHeight - innerHeight,
        };
      });
      assert.deepEqual(ui.clipped, []);
      assert.deepEqual(ui.covered, []);
      assert.ok(ui.scroll <= 1 && ui.chartHeight >= 115);
      results.sizes.push({ w, h, ...row, ...ui });
    }
    await resize(1280, 720);
    await click("geo-play");
    await resize(900, 600);
    await check("Laufende-Groessenaenderung");
    await click("geo-play");
    await click("present");
    await page.waitForFunction(() =>
      document.body.classList.contains("present"),
    );
    if (app)
      assert.ok(
        await app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].isFullScreen(),
        ),
      );
    else assert.ok(await page.evaluate(() => !!document.fullscreenElement));
    await check("Vollbild");
    await click("present");
    await page.waitForFunction(
      () => !document.body.classList.contains("present"),
    );
    await resize(1366, 768);
    await check("Fensterrueckkehr");
    await drag();
    await check("Kamerabewegung");
    await topic("park");
    await check("Parkfield");
    await click("geo-back");
    await arrived("stations");
    await check("Rueckkehr-Stationen");
    for (const info of ["observe", "terms", "neutral", "explain"]) {
      await select("geo-info", info);
      await wait();
      await check("Information-" + info);
    }
    for (const [km, p, s] of [
      [30, 5, 8.57142857],
      [60, 10, 17.14285714],
    ]) {
      for (const [index, t] of [p, s].entries()) {
        await phase(Math.round((t / 28) * 1000) / 1000);
        const state = await sample(),
          sensor = state.sensors[km === 30 ? 0 : 1],
          front = state.fronts[index];
        assert.ok(
          Math.abs(front[0] - sensor[0]) < 0.065,
          JSON.stringify({ km, t, front, sensor }),
        );
        results.stations.push({
          km,
          wave: ["P", "S"][index],
          expectedSeconds: t,
          dx: front[0] - sensor[0],
        });
        await check("Ankunft-" + km + "-" + index, true);
      }
    }
    // Project measured 3D sensor excursions onto the recording axis and find the corresponding ink in the displayed chart.
    await phase(0);
    const rests = (await sample()).sensors;
    const projections = [];
    for (const [i, fraction] of [
      [0, 0.19],
      [0, 0.326],
      [1, 0.369],
      [1, 0.628],
    ]) {
      await phase(fraction);
      const v = (await sample()).sensors[i],
        base = rests[i];
      projections.push({
        i,
        sec: 28 * fraction,
        amplitude: ((v[0] - base[0] + (v[1] - base[1])) * Math.SQRT1_2) / 0.48,
      });
    }
    await phase(0.94);
    results.chartMatches = await page.evaluate((points) => {
      const cv = document.querySelector(".seismic-chart"),
        ctx = cv.getContext("2d"),
        w = cv.clientWidth,
        h = cv.clientHeight;
      const left = Math.min(155, w * 0.19),
        right = w - 28,
        lane = (h - 24 - 27) / 2,
        sx = cv.width / w,
        sy = cv.height / h;
      return points.map((p) => {
        const x = Math.round((left + ((right - left) * p.sec) / 28) * sx),
          y = Math.round(
            (27 + (p.i + 0.5) * lane - p.amplitude * lane * 0.44) * sy,
          );
        const pix = ctx.getImageData(x - 3, y - 3, 7, 7).data;
        let hits = 0;
        for (let j = 0; j < pix.length; j += 4)
          if (
            pix[j] > 209 &&
            pix[j + 2] > 188 &&
            Math.abs(pix[j] - pix[j + 2]) < 29
          )
            hits++;
        return { ...p, hits };
      });
    }, projections);
    assert.ok(
      results.chartMatches.every((q) => q.hits > 0),
      JSON.stringify(results.chartMatches),
    );
    await topic("moment");
    await preset("sites");
    await phase(0);
    const rest = (await sample()).surface;
    await phase(0.49);
    const moving = (await sample()).surface;
    results.soil = moving.map((v, i) => v[1] - rest[i][1]);
    assert.ok(Math.abs(results.soil[0] - results.soil[1]) > 0.035);
    await check("Untergrundreaktion", true);
    await preset("distance");
    await click("geo-related");
    await page.waitForFunction(
      () => window.geoObservatory().observatory.theme === "risk",
    );
    await topic("strike");
    await select("geo-info", "observe");
    await wait();
    assert.deepEqual(await named(), []);
    await release("Hypozentrum");
    assert.deepEqual(await named(), ["Hypozentrum"]);
    await release("Epizentrum");
    await drag();
    await phase(0.58);
    assert.deepEqual(await named(), ["Epizentrum", "Hypozentrum"]);
    await check("Zwei-Einzelfreigaben", true);
    await click("saved-views");
    await page.fill("#view-name", "G651 Begriffe");
    await click("view-save");
    await click("view-close");
    await click("geo-clear");
    await wait();
    assert.deepEqual(await named(), []);
    await topic("particles");
    await click("saved-views");
    await page.selectOption("#saved-list", { label: "G651 Begriffe" });
    await click("view-apply");
    await arrived("strike");
    await wait();
    assert.deepEqual(await named(), ["Epizentrum", "Hypozentrum"]);
    await release("Störungsfläche");
    assert.ok((await named()).includes("Störungsfläche"));
    await click("geo-clear");
    await wait();
    assert.deepEqual(await named(), []);
    await select("geo-info", "explain");
    for (const id of [
      "strike",
      "normal",
      "reverse",
      "thrust",
      "oblique",
      "megathrust",
    ]) {
      await preset(id);
      const roads = [],
        markers = [];
      for (const [i, t] of [0, 0.33, 0.47, 1].entries()) {
        await phase(t);
        const g = await sample();
        roads.push(g.road);
        markers.push(g.markers);
        await check(id + "-" + i, i === 3 || id === "strike");
      }
      assert.notDeepEqual(roads[0], roads[1]);
      assert.notDeepEqual(roads[1], roads[2]);
      assert.notDeepEqual(roads[0], roads[3]);
      const delta = markers[3][1].map(
        (v, j) => v - markers[0][1][j] - (markers[3][0][j] - markers[0][0][j]),
      );
      if (id === "strike") {
        assert.ok(delta[2] > 0.5);
        assert.ok(Math.abs(delta[1]) < 0.001);
      } else if (id === "normal") {
        assert.ok(delta[1] < -0.25 && delta[0] > 0.15);
      } else {
        assert.ok(delta[1] > 0.12 && delta[0] < -0.1);
        if (id === "oblique") assert.ok(delta[2] > 0.2);
      }
      results.faults.push({ id, roads, delta });
    }
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
      await phase(0.68);
      await check("Magmatisch-" + id, id === "monitor");
    }
    await resize(900, 600);
    await check("Monitoring-nach-Resize", true);
    await resize(1366, 768);
    await click("saved-views");
    await page.fill("#view-name", "G651 Vulkanmonitor");
    await click("view-save");
    await click("view-close");
    await topic("park");
    await click("saved-views");
    await page.selectOption("#saved-list", { label: "G651 Vulkanmonitor" });
    await click("view-apply");
    await arrived("monitor");
    await check("Monitoring-wiederhergestellt", true);
    await page.evaluate(() => {
      for (const v of ["seismic-park", "seismic-vt", "seismic-particles"]) {
        const e = document.querySelector("#geo-topic");
        e.value = v;
        e.dispatchEvent(new Event("change"));
      }
    });
    await arrived("particles");
    await check("Schnellwechsel");
    if (film) {
      const movie = async (name, perform) => {
        const v = await screencast(page, out, "G651-" + name, perform, {
          fixedFrame: true,
        });
        assert.ok(v.seconds >= 18 && v.frames >= 35, JSON.stringify(v));
        results.movies.push(v);
      };
      await movie("Parkfield-und-Bruch", async () => {
        await topic("park");
        await playThrough("park");
        await preset("break");
        await click("geo-related");
        await arrived("strike");
        await playThrough("strike");
      });
      await movie("Wellen-und-Standorte", async () => {
        await topic("particles");
        await preset("stations");
        await playThrough("stations");
        await topic("moment");
        await preset("sites");
        await playThrough("sites");
      });
      await movie("Fenster-und-Einzelfreigabe", async () => {
        await topic("particles");
        await preset("stations");
        await phase(0.22);
        await page.waitForTimeout(2200);
        await resize(900, 600);
        await page.waitForTimeout(2200);
        await resize(1366, 768);
        await drag();
        await page.waitForTimeout(1600);
        await topic("strike");
        await select("geo-info", "observe");
        await page.waitForTimeout(1500);
        await release("Hypozentrum");
        await page.waitForTimeout(2200);
        await release("Epizentrum");
        await drag();
        await page.waitForTimeout(2000);
        await release("Störungsfläche");
        await phase(0.39);
        await click("geo-play");
        await page.waitForTimeout(4500);
        await phase(0.6);
        await page.waitForTimeout(2400);
        await click("geo-clear");
        await page.waitForTimeout(2300);
      });
      await select("geo-info", "explain");
      await movie("Japan-zur-Ueberwachung", async () => {
        await topic("distribution");
        await preset("volcanoMap");
        await page.waitForTimeout(2600);
        for (const id of [
          "observed",
          "slab",
          "tohoku",
          "zao",
          "vt",
          "monitor",
        ]) {
          await click("geo-related");
          await arrived(id);
          await page.waitForTimeout(1700);
        }
        await playThrough("monitor");
      });
    }
    assert.deepEqual(results.errors, []);
    results.complete = true;
  } finally {
    page.off("pageerror", error);
    await writeFile(
      join(out, "Seismische-Integritaet.json"),
      JSON.stringify(results, null, 2),
    );
  }
}
