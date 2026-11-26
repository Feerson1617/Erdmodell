import {selectControl} from "./lesson-navigation.mjs";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { geometry, sizes } from "./g651-visual.mjs";
import { screencast } from "./g5-abnahme.mjs";
import {
  chooseRelated,
  switchPresentation,
  compareLake,
} from "./geographic-controls.mjs";

export function frameLayout() {
  const visible = (el) =>
    el.offsetWidth &&
    el.offsetHeight &&
    getComputedStyle(el).visibility !== "hidden";
  const cv = document.querySelector("#earth").getBoundingClientRect();
  const model = window.geoObservatory().observatory;
  const bounds = model.sampleGeometry?.chart;
  const diagram = bounds
    ? {
        left: cv.x + bounds[0][0] * cv.width,
        right: cv.x + bounds[1][0] * cv.width,
        top: cv.y + bounds[1][1] * cv.height,
        bottom: cv.y + bounds[0][1] * cv.height,
      }
    : undefined;
  const elements = [
    ...document.querySelectorAll(
      "#geo-title,#geo-crumb,#geo-clock,#geo-legend,#geo-model-limit,.seismic-label,.seismic-caption,.column-legend,.lake-evidence",
    ),
  ]
    .filter(visible)
    .map((e) => {
      const b = e.getBoundingClientRect();
      return {
        id: e.id || e.className,
        text: e.textContent.trim(),
        font: parseFloat(getComputedStyle(e).fontSize),
        left: b.left,
        top: b.top,
        right: b.right,
        bottom: b.bottom,
      };
    });
  const controls = [
    ...document.querySelectorAll(
      "header :is(button,select,summary),#geo-dock :is(button,input,select),#geo-presentation-tools :is(button,select),#geo-advanced-playback button,.lake-evidence select",
    ),
  ]
    .filter(visible)
    .map((e) => {
      const r = e.getBoundingClientRect();
      return {
        id: e.id,
        clipped:
          r.left < -1 ||
          r.top < -1 ||
          r.right > innerWidth + 1 ||
          r.bottom > innerHeight + 1,
      };
    });
  return {
    view: model.lessonView,
    width: innerWidth,
    height: innerHeight,
    area: (cv.width * cv.height) / (innerWidth * innerHeight),
    controls,
    elements,
    diagram,
    brand: !![...document.querySelectorAll(".brand")].find(visible),
    storage: !!document.querySelector("#geo-presentation-tools:not([hidden])"),
    scroll: document.documentElement.scrollHeight - innerHeight,
  };
}

export async function focusProduct(page, out, { app, film = false } = {}) {
  const report = {
    routes: {},
    windows: [],
    frames: [],
    movies: [],
    errors: [],
  };
  const err = (e) => report.errors.push(String(e));
  page.on("pageerror", err);
  const settled = () =>
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
  const click = (id) => page.click("#" + id);
  const select = (id, v) => selectControl(page, "#" + id, v);
  const wait = () =>
    page.evaluate(
      () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        ),
    );
  const tray = async () => {
    if (
      (await page.locator("#geo-controls").isVisible()) &&
      (await page.locator("#geo-controls").getAttribute("aria-expanded")) ===
        "false"
    )
      await click("geo-controls");
  };
  const mode = async (value) => {
    await tray();
    await select("geo-info", value);
    await wait();
  };
  const close = async () => {
    if (
      (await page.locator("#geo-controls").getAttribute("aria-expanded")) ===
      "true"
    )
      await click("geo-controls");
  };
  const topic = async (value) => {
    await tray();
    await select("geo-topic", value);
    await settled();
  };
  const study = async (id) => {
    await topic("seismic-" + id);
    await arrived(id);
  };
  const place = async (id, view) => {
    await tray();
    await select("geo-place", id);
    if (view) await arrived(view);
    else await settled();
  };
  const related = async (id) => {
    await tray();
    await chooseRelated(page);
    await arrived(id);
  };
  const variant = async (id, view = id) => {
    await tray();
    await select("geo-preset", id);
    await arrived(view);
  };
  const seek = async (t) => {
    await page.locator("#geo-time").fill(String(t));
    await wait();
  };
  const present = async () => {
    await switchPresentation(page);
    await page.waitForFunction(() =>
      document.body.classList.contains("present"),
    );
  };
  const end = async () => {
    await switchPresentation(page);
    await page.waitForFunction(
      () => !document.body.classList.contains("present"),
    );
  };
  const shot = async (name, test = true) => {
    await wait();
    const layout = await page.evaluate(frameLayout),
      rendered = await geometry(page, { enforce: test, textured: true });
    assert.ok(
      rendered.foreground > 0.008,
      name + " · sichtbare Modellgeometrie",
    );
    await page.screenshot({
      path: join(out, "G682-" + name + ".jpg"),
      type: "jpeg",
      quality: 86,
    });
    report.frames.push({ name, layout, rendered });
    return layout;
  };
  function noChrome(layout, animated) {
    assert.equal(layout.brand, false);
    assert.equal(layout.storage, false);
    const ids = layout.controls.map((x) => x.id);
    assert.deepEqual(
      [...ids].sort(),
      animated
        ? ["geo-controls", "geo-play", "geo-reset", "geo-time"]
        : ["geo-controls"],
    );
    assert.ok(
      layout.area >= 0.85 &&
        !layout.controls.some((x) => x.clipped) &&
        layout.scroll <= 1,
      JSON.stringify(layout),
    );
  }
  function axes(l) {
    assert.ok(l.diagram);
    const { top, bottom, left, right } = l.diagram;
    assert.ok(top > 0 && left >= 0 && bottom < l.height && right <= l.width);
    assert.deepEqual(
      l.elements.filter(
        (e) =>
          (e.id === "geo-model-limit" ||
            e.id === "geo-clock" ||
            e.id === "geo-legend" ||
            e.id === "seismic-caption") &&
          e.left < right &&
          e.right > left &&
          e.top < bottom &&
          e.bottom > top,
      ),
      [],
    );
  }
  await mode("explain");
  await study("maar");
  await seek(0.49);
  const work = await shot("A-Arbeitsansicht");
  await present();
  await page
    .locator("#geo-clock")
    .filter({ hasText: "Phreatomagmatische Explosionen" })
    .waitFor();
  const focused = await shot("A-Praesentation");
  noChrome(focused, true);
  await click("geo-play");
  await page.waitForFunction(
    () => window.geoObservatory().observatory.study.playing,
  );
  await click("geo-play");
  await seek(0.85);
  await page
    .locator("#geo-clock")
    .filter({ hasText: "Wasser sammelt" })
    .waitFor();
  await click("geo-reset");
  await page.waitForFunction(
    () => window.geoObservatory().observatory.study.time === 0,
  );
  await tray();
  await page.locator("#geo-step").waitFor();
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () => !document.querySelector("#geo-presentation-tools:not([hidden])"),
  );
  if (!(await page.locator("body.present").count())) await present();
  await study("waterColumn");
  noChrome(await shot("A-Prozesswechsel"), true);
  await end();
  report.routes.A = {
    work: work.controls.length,
    presentation: focused.controls.length,
    animation: true,
    reset: true,
  };

  await study("maar");
  await seek(0.68);
  await mode("observe");
  await present();
  const observed = await shot("B-Beobachten");
  assert.ok(
    !observed.elements.some((e) =>
      /geo-title|geo-clock|seismic-caption/.test(e.id),
    ),
  );
  await tray();
  await click("geo-release");
  for (const name of ["Tuffwall", "Grundwasserleiter"]) {
    if (!(await page.locator("body[data-choose-object]").count())) {
      await tray();
      await click("geo-release");
    }
    await page.locator('.seismic-pick[data-term="' + name + '"]').click();
    await page.waitForFunction(
      (name) =>
        [...document.querySelectorAll(".seismic-label:not([hidden])")].some(
          (e) => e.dataset.term === name,
        ),
      name,
    );
  }
  await shot("B-Freigabe");
  await mode("terms");
  await close();
  await shot("B-Fachbegriffe");
  await mode("explain");
  await close();
  await shot("B-Erklaeren");
  const box = await page.locator("#earth").boundingBox();
  await page.mouse.move(box.x + box.width * 0.53, box.y + box.height * 0.53);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.58, box.y + box.height * 0.49, {
    steps: 8,
  });
  await page.mouse.up();
  await seek(0.72);
  await mode("neutral");
  await close();
  const neutral = await shot("B-Ohne-Ort");
  assert.ok(
    !neutral.elements.some((e) =>
      /geo-crumb|geo-title|geo-clock|seismic-caption/.test(e.id),
    ),
  );
  await end();
  report.routes.B = [
    "Beobachten",
    "Einzelfreigabe",
    "Fachbegriffe",
    "Erklären",
    "Kamera und Phase",
    "Ohne Ort",
  ];

  await mode("explain");
  await topic("globe");
  await present();
  await place("space-Europa");
  await place("country-de");
  await place("eifel", "eifel");
  await related("ulmen");
  await shot("C-Ulmener-Maar");
  await related("lakeCut");
  await tray();
  await click("geo-back");
  await arrived("ulmen");
  await topic("nyos-event");
  await page.waitForFunction(
    () =>
      window.geoObservatory().rendered.nyos && !window.geoObservatory().flying,
  );
  await seek(0.89);
  await page.waitForFunction(
    () =>
      window.geoObservatory().nyos.eventVisual.reliefAnalysis &&
      !window.geoObservatory().flying,
  );
  const nyos = await shot("C-Nyos-Tal");
  await page
    .locator('button[data-object="nyos-valley"]')
    .filter({ hasText: "lebensgefährlich" })
    .waitFor();
  report.routes.C = {
    path: nyos.elements.find((e) => e.id === "geo-crumb").text,
    nyos: true,
  };

  await topic("research");
  await tray();
  await click("geo-tools");
  const depth = page.locator('#research-layers input[value="depth"]');
  if (!(await depth.isVisible()))
    await page.locator("details:has(#research-layers) > summary").click();
  await depth.check();
  await page.waitForFunction(() =>
    document.querySelector("#geo-legend").textContent.includes("300"),
  );
  await click("geo-controls");
  await close();
  await shot("D-Atlas");
  await study("profiles");
  const profile = await shot("D-Achsen");
  axes(profile);
  noChrome(profile, false);
  await related("inventory");
  axes(await shot("D-Inventar"));
  await study("lakeCompare");
  await tray();
  await compareLake(page, "1");
  await close();
  const lake = await shot("D-Seenvergleich");
  assert.ok(
    lake.elements.some((e) => e.text.includes("keine belastbaren Messdaten")),
  );
  report.routes.D = [
    "Datenebene und Legende",
    "Tiefenachsen",
    "Gesamtvorrat",
    "Seenvergleich",
  ];

  await study("waterColumn");
  await seek(0.63);
  await tray();
  await click("saved-views");
  await page.fill("#view-name", "G6.8.2 · Präsentation");
  await click("view-save");
  await click("view-close");
  await end();
  await page.reload();
  await page.waitForFunction(() => window.geoObservatory?.().ready);
  await click("saved-views");
  await selectControl(page, "#saved-list", { label: "G6.8.2 · Präsentation" });
  await click("view-apply");
  await arrived("waterColumn");
  assert.ok(
    Math.abs(
      (await page.evaluate(
        () => window.geoObservatory().observatory.study.time,
      )) - 0.63,
    ) < 0.001,
  );
  await present();
  noChrome(await shot("E-Favorit"), true);
  await end();
  report.routes.E = { time: 0.63, restored: true };

  async function resize(w, h) {
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
  }
  for (const [w, h] of sizes) {
    await resize(w, h);
    await study("profiles");
    if (!app) await present();
    for (const id of ["profiles", "inventory", "maar", "waterColumn"]) {
      if (id === "inventory") await related(id);
      else if (id !== "profiles") await study(id);
      if (id === "maar" || id === "waterColumn") await seek(0.69);
      const layout = await page.evaluate(frameLayout);
      if ("profiles inventory".includes(id)) axes(layout);
      assert.ok(!layout.controls.some((c) => c.clipped) && layout.scroll <= 1);
      if (!app) noChrome(layout, id === "maar" || id === "waterColumn");
      const rendered = await geometry(page, { enforce: false });
      assert.ok(rendered.foreground > 0.008);
      report.windows.push({ w, h, id, layout, rendered });
    }
    if (!app) await end();
  }
  await resize(1366, 768);
  if (film) {
    for (const [name, perform] of [
      [
        "Praesentieren-und-Beobachten",
        async () => {
          await study("maar");
          await present();
          await click("geo-play");
          await page.waitForTimeout(8000);
          await click("geo-play");
          await seek(0.68);
          await mode("observe");
          await tray();
          await click("geo-release");
          await page.locator('.seismic-pick[data-term="Tuffwall"]').click();
          await page.waitForTimeout(4500);
          await mode("explain");
          await close();
          await page.waitForTimeout(6000);
          await study("waterColumn");
          await click("geo-play");
          await page.waitForTimeout(12500);
          await end();
        },
      ],
      [
        "Vom-Relief-zu-den-Messdaten",
        async () => {
          await present();
          await place("towns", "towns");
          await page.waitForTimeout(4500);
          await related("ulmen");
          await page.waitForTimeout(2700);
          await study("pipeCut");
          await click("geo-play");
          await page.waitForTimeout(11000);
          await related("profiles");
          await page.waitForTimeout(4500);
          await related("inventory");
          await page.waitForTimeout(4500);
          await end();
        },
      ],
    ]) {
      const movie = await screencast(page, out, "G682-" + name, perform, {
        fixedFrame: true,
        resizeFilm: true,
      });
      assert.ok(
        movie.seconds >= 18 && movie.frames >= 35,
        JSON.stringify(movie),
      );
      report.movies.push(movie);
    }
  }
  page.off("pageerror", err);
  assert.deepEqual(report.errors, []);
  await writeFile(join(out, "G682.json"), JSON.stringify(report, null, 2));
}
