import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import utils from "playwright-core/lib/utilsBundle";
import { geometry, sizes } from "./g651-visual.mjs";
import { screencast } from "./g5-abnahme.mjs";
const { jpegjs } = utils;

export function columnPixels(screenshot) {
  const { data, width, height } = jpegjs.decode(screenshot, {
    useTArray: true,
  });
  let violet = 0,
    yellow = 0,
    cyan = 0,
    area = 0;
  for (let y = Math.round(height * 0.24); y < height * 0.73; y += 2)
    for (let x = Math.round(width * 0.18); x < width * 0.82; x += 2) {
      const k = 4 * (y * width + x),
        r = data[k],
        g = data[k + 1],
        b = data[k + 2];
      if (r > 80 && r > g * 1.12 && b > r * 1.065 && b < 210) violet++;
      if (r > 189 && g > 155 && b < g * 0.94 && r > g * 1.025) yellow++;
      if (g > 211 && b > 196 && r < 0.8 * g) cyan++;
      area++;
    }
  return { violet: violet / area, yellow: yellow / area, cyan: cyan / area };
}

export async function correctionProduct(page, out, { app, film = false } = {}) {
  const report = {
    routes: {},
    frames: [],
    windows: [],
    movies: [],
    errors: [],
  };
  page.on("pageerror", onerror);
  function onerror(e) {
    report.errors.push(String(e));
  }
  const select = (id, value) => page.selectOption("#" + id, value);
  const geometryReady = () =>
    page.waitForFunction(
      () =>
        document.querySelector("#geo-crumb").dataset.settled === "true" &&
        !window.geoObservatory().flying,
    );
  const arrived = (id) =>
    page.waitForFunction(
      (id) =>
        window.geoObservatory().observatory.lessonView === id &&
        document.querySelector("#geo-crumb").dataset.settled === "true",
      id,
    );
  const open = async (id) => {
    await select("geo-topic", "seismic-" + id);
    await arrived(id);
  };
  const related = async (id) => {
    await page.click("#geo-related");
    await arrived(id);
  };
  const place = async (id) => {
    await select("geo-place", id);
    await geometryReady();
  };
  const located = async (id) => {
    await select("geo-place", id);
    await arrived(id);
  };
  const nyos = async (id) => {
    await select("geo-topic", "nyos-" + id);
    await page.waitForFunction(
      (id) =>
        window.geoObservatory().rendered.nyos &&
        window.geoObservatory().nyos.view === id &&
        !window.geoObservatory().flying,
      id === "pipe" ? "protection" : id,
    );
  };
  const t = async (value) => {
    await page.locator("#geo-time").fill(String(value));
    await page.evaluate(
      () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        ),
    );
  };
  const shot = async (name) => {
    const g = await geometry(page, { textured: name.startsWith("C-") }),
      buffer = await page.screenshot({
        path: join(out, "G681-" + name + ".jpg"),
        type: "jpeg",
        quality: 87,
      });
    const pixel = columnPixels(buffer);
    report.frames.push({ name, ...g, pixel });
    return pixel;
  };
  const swap = async (weak) => {
    await page.locator(".column-legend button").click();
    await arrived(weak ? "unsaturated" : "waterColumn");
  };
  const geo = () =>
    page.evaluate(() => {
      const w = window.geoObservatory();
      return {
        label: document.querySelector("#geo-crumb").innerText,
        lat: w.lat,
        lon: w.lon,
        model: w.observatory.lessonView,
        painted: w.observatory.painted,
        study: w.observatory.study,
        projected: w.observatory.projected,
      };
    });
  await select("geo-info", "explain");
  await open("dissolved");
  await t(0.65);
  await shot("A-Geloest");
  await select("geo-preset", "waterColumn");
  await arrived("waterColumn");
  await t(0);
  const rich = await shot("B-Gasreich-Start"),
    cmpCamera = (await geo()).study;
  await swap(true);
  const weak = await shot("B-Untersaettigt-Start"),
    weakCamera = (await geo()).study;
  assert.deepEqual(weakCamera.eye, cmpCamera.eye);
  assert.equal(weakCamera.time, 0);
  assert.ok(
    rich.violet > 0.025 && rich.violet > weak.violet + 0.018,
    JSON.stringify({ rich, weak }),
  );
  await t(0.69);
  const lateWeak = await shot("B-Gegenbeispiel");
  await swap(false);
  assert.ok(Math.abs((await geo()).study.time - 0.69) < 0.001);
  const late = await shot("A-Rueckkopplung");
  assert.ok(
    late.yellow > lateWeak.yellow + 0.00035 && late.cyan > 0.0006,
    JSON.stringify({ late, lateWeak }),
  );
  await t(0.29);
  await shot("A-Anhebung");
  await t(0.46);
  await shot("A-Erste-Blasen");
  await t(0.93);
  await shot("A-Luft");
  report.routes.B = {
    rich,
    weak,
    late,
    lateWeak,
    matchedCamera: true,
    matchedPhase: true,
  };
  await page.click("#geo-related");
  await page.waitForFunction(
    () =>
      window.geoObservatory().rendered.nyos && !window.geoObservatory().flying,
  );
  await t(0.89);
  await page.waitForFunction(() => {
    const w = window.geoObservatory();
    return (
      w.rendered.nyos &&
      w.nyos.eventVisual.reliefAnalysis &&
      !w.flying &&
      w.d > 4
    );
  });
  const health = page.locator('button[data-object="nyos-valley"]');
  await health.waitFor();
  assert.match(
    await health.innerText(),
    /beeinträchtigen die Atmung.*Sauerstoffanteil/s,
  );
  await shot("A-Wirkung-im-Tal");
  report.routes.A = { event: "Nyos 1986", health: await health.innerText() };

  await select("geo-topic", "globe");
  await geometryReady();
  await place("space-Europa");
  await place("country-de");
  const de = await geo();
  assert.ok(Math.abs(de.lat - 51.1) < 0.25);
  await located("eifel");
  await related("ulmen");
  await located("towns");
  const region = await geo();
  assert.match(region.label, /Eifel und Wittlicher Senke/);
  assert.ok(region.painted && Math.abs(region.lat - 50.09665) < 0.03);
  const names = region.projected.map((p) => p.name);
  for (const n of [
    "Ulmen",
    "Ulmener Maar",
    "Wittlich",
    "Rund 26 km Luftlinie",
    "5 km",
  ])
    assert.ok(names.includes(n), n);
  await shot("C-Ulmen-Wittlich");
  await located("wittlich");
  const target = await geo();
  assert.match(target.label, /Wittlicher Senke › Wittlich/);
  assert.ok(
    Math.abs(target.lat - 49.9850353) < 0.03 &&
      Math.abs(target.lon - 6.88844) < 0.03,
  );
  await shot("C-Wittlich");
  await page.click("#geo-back");
  await arrived("towns");
  assert.deepEqual((await geo()).study, region.study);
  await page.click("#geo-back");
  await arrived("ulmen");
  await shot("C-Rueckkehr-Ulmen");
  report.routes.C = [de, region, target, await geo()];

  await nyos("pipe");
  await select("geo-preset", "seismic-pipeCut");
  await arrived("pipeCut");
  await related("profiles");
  await shot("D-Tiefenprofile");
  await related("inventory");
  assert.match(
    await page.locator("#geo-model-limit").innerText(),
    /Kusakabe.*Tabelle 4/,
  );
  await shot("D-Gesamtvorrat");
  report.routes.D = ["Nyos", "Rohrschnitt", "Tiefenprofile", "Gesamtvorrat"];

  await open("waterColumn");
  await select("geo-info", "neutral");
  await page.locator("#geo-crumb").waitFor({ state: "hidden" });
  await page.click("#geo-release");
  await page.locator('.seismic-pick[data-term="Gelöstes CO₂"]').click();
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".seismic-label")].some(
      (e) => !e.hidden && e.dataset.term === "Gelöstes CO₂",
    ),
  );
  await page.click("#geo-clear");
  await select("geo-info", "explain");
  await page.click("#geo-play");
  await page.waitForFunction(
    () => window.geoObservatory().observatory.study.playing,
  );
  await page.click("#geo-play");
  await t(0.64);
  const box = await page.locator("#earth").boundingBox(),
    before = (await geo()).study;
  await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.45);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.48, {
    steps: 12,
  });
  await page.mouse.up();
  const saved = (await geo()).study;
  assert.notDeepEqual(saved.eye, before.eye);
  await page.click("#saved-views");
  await page.fill("#view-name", "G6.8.1 Rückkopplung");
  await page.click("#view-save");
  await page.reload();
  await page.waitForFunction(() => window.geoObservatory?.().ready);
  await page.click("#saved-views");
  await page.selectOption("#saved-list", { label: "G6.8.1 Rückkopplung" });
  await page.click("#view-apply");
  await arrived("waterColumn");
  const restored = (await geo()).study;
  assert.equal(restored.playing, false);
  assert.equal(restored.time, saved.time);
  assert.ok(restored.eye.every((v, i) => Math.abs(v - saved.eye[i]) < 0.02));
  report.routes.E = { saved, restored };

  async function resize(w, h) {
    if (app)
      await app.evaluate(
        ({ BrowserWindow }, size) =>
          BrowserWindow.getAllWindows()[0].setContentSize(...size),
        [w, h],
      );
    else await page.setViewportSize({ width: w, height: h });
    await page.waitForFunction(
      ([w, h]) => innerWidth === w && innerHeight === h,
      [w, h],
    );
  }
  await select("geo-info", "explain");
  for (const [w, h] of sizes) {
    await resize(w, h);
    for (const id of [
      "waterColumn",
      "unsaturated",
      "towns",
      "wittlich",
      "inventory",
    ]) {
      if (id === "towns" || id === "wittlich") await located(id);
      else if (id === "inventory") {
        await open("profiles");
        await related(id);
      } else if (id === "waterColumn") {
        await open(id);
        await t(0.66);
      } else await swap(true);
      const model = await geometry(page, {
        textured: id === "towns" || id === "wittlich",
      });
      const layout = await page.evaluate(() => {
        const nodes = [
          ...document.querySelectorAll(
            "#geo-dock button,#geo-dock input,#geo-dock select,#geo-place,#geo-topic,.column-legend button",
          ),
        ].filter((e) => e.offsetWidth && e.offsetHeight);
        const clipped = nodes
          .filter((e) => {
            const r = e.getBoundingClientRect();
            return (
              r.left < -1 ||
              r.right > innerWidth + 1 ||
              r.top < -1 ||
              r.bottom > innerHeight + 1
            );
          })
          .map((e) => e.id || e.textContent);
        const box = document.querySelector("#earth").getBoundingClientRect();
        const fonts = [
          ...document.querySelectorAll(
            ".seismic-label,.seismic-caption,.column-legend",
          ),
        ]
          .filter((e) => e.offsetWidth && e.offsetHeight)
          .map((e) => parseFloat(getComputedStyle(e).fontSize));
        return {
          clipped,
          area: (box.width * box.height) / (innerWidth * innerHeight),
          fonts,
          scroll: document.documentElement.scrollHeight - innerHeight,
        };
      });
      assert.deepEqual(layout.clipped, []);
      assert.ok(layout.scroll <= 1);
      report.windows.push({ view: id, w, h, ...layout, model });
    }
    if (w === 740 || w === 1920) await shot("D-Fenster-" + w);
  }
  await resize(1366, 768);
  await page.click("#present");
  await page.waitForFunction(() => document.body.classList.contains("present"));
  await shot("D-Vollbild");
  report.presentation = await page.evaluate(() => {
    const r = document.querySelector("#earth").getBoundingClientRect();
    return (r.width * r.height) / (innerWidth * innerHeight);
  });
  await page.click("#present");
  await page.waitForFunction(
    () => !document.body.classList.contains("present"),
  );
  if (film) {
    async function play(ms) {
      await page.click("#geo-play");
      await page.waitForTimeout(ms);
    }
    for (const [name, path] of [
      [
        "Wassersaeulen",
        async () => {
          await open("waterColumn");
          await page.waitForTimeout(1200);
          await play(18400);
          await swap(true);
          await t(0);
          await page.waitForTimeout(1000);
          await play(18400);
          await swap(false);
          await t(0.64);
          await page.waitForTimeout(1400);
        },
      ],
      [
        "Orte-und-Nyos-Daten",
        async () => {
          await select("geo-topic", "globe");
          await geometryReady();
          await place("space-Europa");
          await place("country-de");
          await located("towns");
          await page.waitForTimeout(2200);
          await located("wittlich");
          await page.waitForTimeout(1200);
          await page.click("#geo-back");
          await arrived("towns");
          await related("ulmen");
          await page.waitForTimeout(1000);
          await nyos("pipe");
          await select("geo-preset", "seismic-pipeCut");
          await arrived("pipeCut");
          await play(3500);
          await related("profiles");
          await page.waitForTimeout(1900);
          await related("inventory");
          await page.waitForTimeout(3600);
        },
      ],
    ]) {
      const result = await screencast(page, out, "G681-" + name, path, {
        fixedFrame: true,
      });
      assert.ok(result.frames >= 35 && result.seconds >= 18);
      report.movies.push(result);
    }
  }
  page.off("pageerror", onerror);
  assert.deepEqual(report.errors, []);
  await writeFile(join(out, "G681.json"), JSON.stringify(report, null, 2));
}
