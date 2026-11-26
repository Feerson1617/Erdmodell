import {selectControl} from "./lesson-navigation.mjs";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PNG } from "pngjs";
import { screencast } from "./g5-abnahme.mjs";
import { waitForNyosLake, metrics } from "./g641-classroom.mjs";

function thumbnail(buf) {
  const im = PNG.sync.read(buf),
    out = [];
  for (let j = 1; j <= 12; j++)
    for (let i = 1; i <= 20; i++) {
      const p = (Math.floor((im.height * j) / 13) * im.width + Math.floor((im.width * i) / 21)) * 4;
      out.push(...im.data.subarray(p, p + 3));
    }
  return out;
}
const distance = (a, b) => a.reduce((n, v, i) => n + Math.abs(v - b[i]), 0) / a.length;
export async function integrity(page, out, { native, app, film }) {
  const matrix = [],
    screens = [],
    errors = [];
  const error = (e) => errors.push(e.message);
  page.on("pageerror", error);
  const select = (id, v) => selectControl(page, "#" + id, v),
    click = (id) => page.click("#" + id);
  const settle = async () => {
    await page.waitForFunction(
      () =>
        document.querySelector("#geo-crumb")?.dataset.settled === "true" && !window.geoObservatory().flying,
    );
    await page.evaluate(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))));
  };
  const topic = async (v) => {
      await select("geo-topic", v);
      await settle();
    },
    place = async (v) => {
      await select("geo-place", v);
      await settle();
    };
  const drawer = async (open) => {
    if (((await page.locator("#geo-tools").getAttribute("aria-expanded")) === "true") !== open)
      await click("geo-tools");
  };
  const shot = async (name) => {
    await page.screenshot({
      path: join(out, "Ort-" + name + ".jpg"),
      type: "jpeg",
      quality: 87,
      timeout: 180000,
    });
    screens.push(name);
  };
  const sample = async () =>
    thumbnail(await page.locator("#earth").screenshot({ type: "png", timeout: 180000 }));
  const routes = {
    "Nyos": ["Erde", "Nyos-See · Ereignismodell"],
    "Nyos-nach-Deutschland": ["Nyos-See", "Deutschland"],
    "Deutschland-nach-Helgoland": ["Deutschland", "Helgoland"],
    "Zurueck-Deutschland": ["Helgoland", "Deutschland"],
    "Deutschland-nach-Tonga": ["Deutschland", "Tongagraben"],
    "Tonga-Relief": ["Tongagraben · Globus", "Tongagraben · Relief"],
    "Tonga-nach-Hawaii": ["Tongagraben · Relief", "Hawaii · Relief"],
    "Hawaii-nach-Himalaya": ["Hawaii · Relief", "Himalaya · Relief"],
    "Himalaya-nach-Globus": ["Himalaya · Relief", "Erde"],
    "Schnellwechsel-Hawaii": ["Erde, laufende Fahrten über Tonga und Himalaya", "Hawaii"],
    "Laden-unterbrochen": ["Tongagraben · Geländeaufbau", "Hawaii"],
    "Gespeichertes-Deutschland": ["Hawaii", "Gespeicherte Deutschlandansicht"],
    "Freie-Kamera-nach-Deutschland": ["Gespeicherte Deutschlandansicht", "Freie Globusansicht"],
    "Mehrfach-zurueck-Hawaii": ["Himalaya", "Hawaii"],
    "Mehrfach-zurueck-Tonga": ["Hawaii", "Tongagraben"],
    "Atlas-1510-Schnitt": ["Forschungsatlas · Grenzabschnitt 1510", "Prozessschnitt · Inselbogen"],
    "Schnitt-zum-Atlas": ["Prozessschnitt · Inselbogen", "Ausgangskarte · Grenzabschnitt 1510"],
    "Wilson-zur-Analogie": ["Wilson-Zyklus · Phase 0,375", "Heutige Analogie · Mittelatlantischer Rücken"],
    "Analogie-zum-Wilsonstadium": ["Mittelatlantischer Rücken", "Gespeicherte Wilson-Modellphase"],
  };
  const row = async (name, match, lat, lon, kind, check = () => {}) => {
    await settle();
    const w = await page.evaluate(() => {
      const w = window.geoObservatory(),
        o = w.observatory;
      return {
        information: document.querySelector("#geo-info").value,
        legend: document.querySelector("#geo-legend").innerText,
        modelClock: document.querySelector("#geo-clock").innerText,
        mode: w.mode,
        obs: o.mode,
        pose: [w.lat, w.lon, w.d],
        eye: w.rendered.camera,
        path: document.querySelector("#geo-crumb").textContent,
        title: document.querySelector("#geo-title").innerText,
        rendered: w.rendered,
        regional: o.renderScene,
        objects: o.drawnObjects,
        painted: o.painted,
        models: o.studio?.models,
        modelTime: o.studio?.time,
        sideCamera: o.camera,
        site: o.site,
        terrain: w.region,
        atlas: o.atlas,
        selected: o.selected,
        nyosWeight: w.nyos.localWeight,
      };
    });
    assert.match(w.path, match, name + " " + w.path);
    assert.ok(w.painted);
    if (lat != null) {
      assert.ok(
        Math.abs(w.pose[0] - lat) < 0.25 && Math.abs(((w.pose[1] - lon + 540) % 360) - 180) < 0.25,
        name + JSON.stringify(w.pose),
      );
    }
    if (kind === "map") {
      assert.ok(w.rendered.worldDrawn && w.rendered.globe && !w.rendered.nyos);
      assert.equal(w.rendered.terrains.length, 0);
      const [x, y, z] = w.eye,
        rad = Math.hypot(x, y, z);
      if (lat != null) {
        assert.ok(Math.abs((Math.asin(y / rad) * 180) / Math.PI - lat) < 0.35);
        assert.ok(Math.abs((((Math.atan2(x, z) * 180) / Math.PI - lon + 540) % 360) - 180) < 0.35);
      }
    }
    if (kind === "regional") {
      assert.ok(!w.rendered.worldDrawn && w.regional && w.objects.length);
    }
    if (kind === "studio") assert.ok(!w.rendered.worldDrawn && w.models?.length);
    check(w);
    const image = await sample();
    assert.ok(new Set(image).size > 28, name + " leeres Bild");
    await shot(name);
    const [from, requested] = routes[name];
    matrix.push({ route: name, from, requested, kind, ...w, imageColors: new Set(image).size, image: "Ort-" + name + ".jpg" });
    return image;
  };
  const navigate = async () => {
    await topic("nyos");
    await drawer(true);
    await click("nyos-event");
    await drawer(false);
    await waitForNyosLake(page);
    const nyos = await row("Nyos", /Nyos/, 6.438, 10.299, "world", (w) => assert.ok(w.rendered.nyos));
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await select("geo-place", "country-de");
    await page.waitForFunction(() => window.geoObservatory().flying);
    assert.doesNotMatch(await page.locator("#geo-crumb").innerText(), /National/);
    await shot("Nyos-nach-Deutschland-Fahrt");
    const de = await row("Nyos-nach-Deutschland", /Deutschland.*National/, 51.1, 10.3, "map");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await place("local-helgoland");
    await row("Deutschland-nach-Helgoland", /Helgoland/i, null, null, "world", (w) =>
      assert.ok(w.rendered.terrains.includes("helgoland") && !w.rendered.nyos),
    );
    await click("geo-back");
    const returned = await row("Zurueck-Deutschland", /Deutschland.*National/, 51.1, 10.3, "map");
    const relative = { deutschland: distance(returned, de), nyos: distance(returned, nyos) };
    assert.ok(relative.deutschland + 5 < relative.nyos, JSON.stringify(relative));
    matrix.at(-1).pixelvergleich = relative;
    await click("saved-views");
    await page.fill("#view-name", "Deutschland · G6.4.2");
    await click("view-save");
    await click("view-close");
    await place("tonga");
    await row("Deutschland-nach-Tonga", /Tongagraben/, -20.395, -173.3105, "map");
    await click("geo-land");
    await row("Tonga-Relief", /regionales Relief/, null, null, "regional", (w) => {
      assert.ok(w.objects.includes("Gelände"));
      assert.ok(!w.objects.includes("Wasseroberfläche"));
    });
    await place("hawaii");
    await click("geo-land");
    await row("Tonga-nach-Hawaii", /Hawaii/, null, null, "regional", (w) => assert.equal(w.site, "hawaii"));
    await place("himalaya");
    await click("geo-land");
    await row("Hawaii-nach-Himalaya", /Himalaya/, null, null, "regional", (w) =>
      assert.equal(w.site, "himalaya"),
    );
    await topic("globe");
    await row("Himalaya-nach-Globus", /Global/, null, null, "map", (w) => assert.equal(w.obs, ""));
    await page.emulateMedia({ reducedMotion: "no-preference" });
    for (const id of ["tonga", "himalaya", "hawaii"]) await select("geo-place", id);
    await page.waitForSelector("#geo-skip:visible");
    await click("geo-skip");
    await row("Schnellwechsel-Hawaii", /Hawaii/, 20.6, -156.3, "map");
    await select("geo-place", "tonga");
    await page.waitForFunction(() => window.geoObservatory().flying);
    await page.locator("#earth").click({ position: { x: 34, y: 65 } });
    await settle();
    assert.doesNotMatch(await page.locator("#geo-crumb").innerText(), /Tongagraben/);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await place("tonga");
    await click("geo-land");
    await select("geo-place", "hawaii");
    await row("Laden-unterbrochen", /Hawaii/, 20.6, -156.3, "map");
    await click("saved-views");
    await page.locator("#saved-list").selectOption({ label: "Deutschland · G6.4.2" });
    await click("view-apply");
    await row("Gespeichertes-Deutschland", /Deutschland.*National/, 51.1, 10.3, "map");
    // A restored marker must also lose its national label when the actual camera leaves Germany.
    const globe = await page.locator("#earth").boundingBox();
    await page.mouse.move(globe.x + globe.width * 0.8, globe.y + globe.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(globe.x + globe.width * 0.2, globe.y + globe.height * 0.5, { steps: 8 });
    await page.mouse.up();
    await page.waitForFunction(() => !document.querySelector("#geo-crumb")?.innerText.includes("Deutschland"));
    await row("Freie-Kamera-nach-Deutschland", /Global|Kontinental|National|Regional/, null, null, "map", (w) =>
      assert.ok(w.pose[1] < 5.8 || w.pose[1] > 15.2));
    for (const id of ["tonga", "hawaii", "himalaya"]) await place(id);
    await click("geo-back");
    await row("Mehrfach-zurueck-Hawaii", /Hawaii/, 20.6, -156.3, "map");
    await click("geo-back");
    await row("Mehrfach-zurueck-Tonga", /Tongagraben/, -20.395, -173.3105, "map");
    await topic("research");
    await drawer(true);
    await select("research-projection", "map");
    await select("research-base", "bathy");
    const details = page.locator("#research-options");
    if (!(await details.evaluate((e) => e.open))) await details.locator("summary").click();
    for (const layer of ["age", "magnetic", "gnss"])
      await page.locator('#research-layers input[value="' + layer + '"]').check();
    await drawer(false);
    await page.waitForFunction(() => document.querySelector("#geo-legend")?.innerText.includes("IGS14"));
    await shot("Datenlegende");
    const b = await page.locator(".research-map-plane canvas").boundingBox();
    await page.mouse.click(b.x + (b.width * (180 - 173.3105)) / 360, b.y + (b.height * (90 + 20.395)) / 180);
    await drawer(true);
    await click("research-process");
    await row("Atlas-1510-Schnitt", /1510/, null, null, "studio", (w) => assert.equal(w.models[0], "arc"));
    await click("geo-back");
    await page.waitForSelector("#research-process:visible");
    await drawer(false);
    await row("Schnitt-zum-Atlas", /Forschungsatlas/, null, null, "flat", (w) => {
      assert.ok(w.atlas.flat && w.atlas.layers.includes("age") && w.atlas.profile !== null);
      assert.match(JSON.stringify(w.atlas.selected), /173/);
    });
    await topic("process-wilson");
    await page.locator("#geo-time").fill("0.375");
    await page.getByRole("button", { name: "Analogie auf der Erde" }).click();
    await row("Wilson-zur-Analogie", /Mittelatlantischer/, 25, -45, "map");
    await click("geo-back");
    await row("Analogie-zum-Wilsonstadium", /Analogie/, null, null, "studio", (w) =>
      assert.equal(w.modelTime, 0.375),
    );
  };
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    if (film) await screencast(page, out, "G-Navigation-und-Rueckweg", navigate);
    else await navigate();
    await topic("past");
    await page.locator("#geo-time").fill("-65");
    await page.waitForFunction(() => document.querySelector("#geo-clock")?.innerText.includes("65"));
    await shot("Zeit-vor-65-Millionen-Jahren");
    await click("geo-play");
    await page.waitForFunction(() => {
      const clock = document.querySelector("#geo-clock");
      return !clock.hidden && /^Vor (?!65 )\d+ Millionen Jahren$/.test(clock.textContent);
    });
    await click("geo-play");
    await settle();
    await page.waitForTimeout(160);
    const paused = await page.locator("#geo-clock").innerText();
    await page.waitForTimeout(240);
    assert.equal(await page.locator("#geo-clock").innerText(), paused);
    await page.locator("#geo-time").fill("0");
    await page.waitForFunction(() => document.querySelector("#geo-clock")?.innerText === "Heute");
    await topic("future");
    await page.locator("#geo-time").fill("100");
    await drawer(true);
    await page.locator("#g-compare").check();
    await drawer(false);
    await page.waitForFunction(() =>
      /Hypothetisch.*Aurica.*\/.*100/.test(document.querySelector("#geo-clock")?.innerText),
    );
    await shot("Zwei-Zukunftsszenarien");
    await topic("process-arc");
    await select("geo-info", "observe");
    assert.match(await page.locator("#geo-crumb").innerText(), /Tongagraben/);
    await shot("Beobachten-mit-Ort");
    await select("geo-info", "neutral");
    await page.waitForSelector("#geo-crumb", { state: "hidden" });
    await select("geo-info", "explain");
    const phases = [];
    for (const model of ["arc", "ridge", "collision"]) {
      await topic("process-" + model);
      for (const time of [0.15, 0.55, 0.85]) {
        await page.locator("#geo-time").fill(String(time));
        await page.waitForFunction((t) => window.geoObservatory().observatory.studio.time === t, time);
        await page.waitForTimeout(180);
        const label = await page.locator(".reading-focus").first().innerText();
        phases.push({ model, time, label });
        await shot(model + "-" + time);
      }
      assert.ok(new Set(phases.filter((p) => p.model === model).map((p) => p.label)).size >= 3);
    }
    await topic("process-arc");
    const sizes = [];
    for (const [width, height] of [
      [740, 530],
      [900, 600],
      [1280, 720],
      [1366, 768],
      [1920, 1080],
      [2560, 1440],
    ]) {
      if (native)
        await app.evaluate(
          ({ BrowserWindow }, dims) => BrowserWindow.getAllWindows()[0].setContentSize(...dims),
          [width, height],
        );
      else await page.setViewportSize({ width, height });
      await page.waitForFunction(([w, h]) => innerWidth === w && innerHeight === h, [width, height]);
      const nativeWindow = native ? await app.evaluate(({ BrowserWindow, screen }) => ({
        content: BrowserWindow.getAllWindows()[0].getContentSize(),
        display: screen.getPrimaryDisplay().size,
      })) : undefined;
      if (native) assert.deepEqual(nativeWindow.content, [width, height], "Native Fenstermaße");
      await page.waitForTimeout(230);
      const ui = await page.evaluate(() => {
        const box = (e) => e.getBoundingClientRect(),
          inside = (r) => r.x >= -1 && r.y >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
        const controls = [
          ...document.querySelectorAll("#geo-dock :is(button,input,select),#geo-topic,#geo-place"),
        ].filter((e) => !e.hidden && e.offsetWidth);
        const cards = [...document.querySelectorAll(".studio-object")].filter(
          (e) => getComputedStyle(e).visibility === "visible",
        );
        const pts = cards.map((e) => {
          const [x, y] = e.dataset.anchor.split(",").map(Number),
            r = box(e.parentElement);
          return [x + r.x, y + r.y];
        });
        return {
          width: innerWidth,
          height: innerHeight,
          clipped: controls.filter((e) => !inside(box(e))).map((e) => e.id),
          covered: cards.filter((e) => {
            const r = box(e);
            return pts.some(([x, y]) => r.x <= x && r.right >= x && r.y <= y && r.bottom >= y);
          }).length,
          cards: cards.length,
          scroll: document.documentElement.scrollHeight - innerHeight,
        };
      });
      assert.deepEqual(ui.clipped, [], JSON.stringify(ui));
      assert.equal(ui.covered, 0);
      assert.ok(ui.cards >= 1 && ui.scroll <= 1, JSON.stringify(ui));
      const im = PNG.sync.read(await page.locator("#earth").screenshot({ timeout: 180000 }));
      let solid = 0,
        total = 0;
      for (let y = 0; y < im.height; y += 5)
        for (let x = 0; x < im.width; x += 5) {
          const i = (y * im.width + x) * 4;
          total++;
          if (Math.abs(im.data[i] - 22) + Math.abs(im.data[i + 1] - 45) + Math.abs(im.data[i + 2] - 55) > 40)
            solid++;
        }
      sizes.push({ ...ui, nativeWindow, foreground: solid / total, modelArea: (await metrics(page)).usable });
      await shot("Fenster-" + width);
    }
    assert.deepEqual(errors, []);
    await writeFile(
      join(out, "Geographische-Abnahme.json"),
      JSON.stringify({ matrix, screens, phases, sizes, errors, complete: true }, null, 2),
    );
  } finally {
    page.off("pageerror", error);
    await writeFile(join(out, "Navigationsmatrix.json"), JSON.stringify(matrix, null, 2));
  }
}
