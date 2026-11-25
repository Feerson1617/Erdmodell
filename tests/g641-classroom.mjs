import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { screencast } from "./g5-abnahme.mjs";

export async function metrics(page) {
  return page.evaluate(() => {
    const rect = document.querySelector("#earth").getBoundingClientRect(),
      side = document.querySelector("#sidebar").getBoundingClientRect();
    const visible = [...document.querySelectorAll("button,input,select,summary")].filter((el) => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || getComputedStyle(el).visibility === "hidden") return false;
      const x = r.x + r.width / 2,
        y = r.y + r.height / 2;
      return el.contains(document.elementFromPoint(x, y));
    });
    const overlap =
      Math.max(0, Math.min(rect.right, side.right) - Math.max(rect.left, side.left)) *
      Math.max(0, Math.min(rect.bottom, side.bottom) - Math.max(rect.top, side.top));
    return {
      width: innerWidth,
      height: innerHeight,
      canvas: [rect.width, rect.height],
      usable: (rect.width * rect.height - overlap) / (innerWidth * innerHeight),
      controls: visible
        .filter((e) => !e.closest(".annotations,.studio-overlay,#geo-markers"))
        .map((e) => e.id || e.innerText),
      labels: visible.filter((e) => e.closest(".annotations,.studio-overlay,#geo-markers")).length,
      sideVisible: side.width > 0,
      scroll: document.documentElement.scrollHeight - innerHeight,
    };
  });
}
export const waitForNyosLake = (page) =>
  page.waitForFunction(() => {
    const w = window.geoObservatory();
    return (
      w.mode === "nyos" && w.nyos.view === "event" && w.nyos.ready && w.nyos.localWeight > 0.9 && !w.flying
    );
  });

export async function exercise(page, out, { group = "all", film = false, board = false } = {}) {
  await mkdir(out, { recursive: true });
  const log = {
    actions: [],
    scenes: {},
    frames: [],
    stages: [],
    boards: [],
    errors: [],
    movies: [],
    complete: false,
  };
  const errors = (e) => log.errors.push(e.message);
  page.on("pageerror", errors);
  page.setDefaultTimeout(50000);
  const click = async (id) => {
    await page.locator("#" + id).click();
    log.actions.push(id);
  };
  const select = async (id, value) => {
    await page.selectOption("#" + id, value);
    log.actions.push(id + " = " + value);
  };
  const topic = (v) => select("geo-topic", v);
  const waitStudio = (id) =>
    page.waitForFunction((k) => window.geoObservatory().observatory.studio?.models[0] === k && document.querySelector("#geo-crumb").dataset.settled !== "false", id);
  const region = () =>
    page.waitForFunction(() => {
      const w = window.geoObservatory();
      return (
        !w.flying && w.observatory.mode === "regional" && w.observatory.ready && w.observatory.viewSettled
      );
    });
  const ticks = () =>
    page.evaluate(
      () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))),
        ),
    );
  const shot = async (id, count = false) => {
    await ticks();
    await page.screenshot({
      path: join(out, id + ".jpg"),
      type: "jpeg",
      quality: 87,
      timeout: process.platform === "linux" ? 180000 : 50000,
    });
    log.frames.push(id);
    if (count) log.scenes[id] = await metrics(page);
  };
  const phase = async (n) => {
    await page.locator("#geo-time").fill(String(n));
    log.actions.push("Modellzeit " + n);
    await ticks();
  };
  const tools = async (open) => {
    if (((await page.locator("#geo-tools").getAttribute("aria-expanded")) === "true") !== open)
      await click("geo-tools");
  };
  const action = async (name, fn) => {
    console.log("Bedienablauf", name);
    if (film) log.movies.push(await screencast(page, out, name, fn));
    else await fn();
  };
  const part = (k) => group === "all" || group === k;
  try {
    await page.waitForFunction(() => window.geoObservatory?.().ready);
    if (part("raum")) {
      await action("A-Erde-Pazifik-Tonga", async () => {
        await topic("global");
        await page.waitForSelector("#geo-markers button:visible");
        await shot("Globale-Prozesse");
        await select("geo-place", "space-Pazifik");
        await page.waitForFunction(
          () =>
            !window.geoObservatory().flying &&
            document.querySelector("#geo-crumb").textContent.includes("Pazifik"),
        );
        await page.locator("#geo-markers [data-place=tonga]").click();
        await page.waitForSelector("#geo-land:visible");
        await shot("Tonga-Globus");
        await click("geo-land");
        await region();
        await page.waitForFunction(
          () =>
            window.geoObservatory().observatory.view === "overhead" &&
            !window.geoObservatory().observatory.cut,
        );
        await shot("Tonga-Relief");
        await click("geo-section");
        await waitStudio("arc");
        await click("geo-play");
        await page.waitForFunction(() => window.geoObservatory().observatory.studio.time > 0.025);
        await select("geo-info", "terms");
        await select("geo-info", "explain");
        await click("geo-play");
        await phase(0.6);
        await shot("Tonga", true);
        await select("geo-preset", "melt");
        await shot("Mantelkeil");
        assert.equal(
          await page.evaluate(() => window.geoObservatory().observatory.materialMotion[0].fluids),
          true,
        );
        await click("geo-back");
        await region();
        await click("geo-back");
        await page.waitForSelector("#geo-land:visible");
        await click("geo-back");
        await click("geo-back");
        await shot("Erde-Rueckkehr");
      });
      // Start restoring a real region, then choose a new subject while its resources load.
      await topic("sea");
      await region();
      await topic("process-ridge");
      await waitStudio("ridge");
      await click("geo-back");
      await topic("process-hotspot");
      await waitStudio("hotspot");
      await ticks();
      assert.match(await page.locator("#geo-crumb").innerText(), /Hawaii/);
      await action("B-Kollision", async () => {
        await topic("process-collision");
        await waitStudio("collision");
        assert.match(await page.locator("#geo-crumb").innerText(), /Himalaya/);
        await click("geo-play");
        await page.waitForTimeout(500);
        await click("geo-play");
        await phase(0.6);
        await shot("Kollision", true);
        const read = () =>
          page.evaluate(() => {
            const s = window.geoObservatory().observatory.studio;
            return [s.time, s.yaw, s.pitch, s.zoom];
          });
        const before = await read();
        await select("geo-preset", "materials");
        assert.deepEqual(await read(), before);
        await shot("Kollision-Analyse");
        await click("geo-return");
        await page.waitForSelector("#geo-land:visible");
      });
    }
    if (part("atlas")) {
      await action("C-Atlas-Grenzabschnitt", async () => {
        await topic("research");
        await page.waitForSelector("#research-projection:visible");
        await select("research-projection", "map");
        await select("research-base", "bathy");
        await page.locator("#research-options summary").click();
        await page.locator("#research-layers input[value=age]").check();
        await page.locator("#research-options summary").click();
        await tools(false);
        const map = page.locator(".research-map-plane canvas");
        await map.waitFor();
        const b = await map.boundingBox();
        await page.mouse.click(
          b.x + (b.width * (180 - 173.3105)) / 360,
          b.y + (b.height * (90 + 20.395)) / 180,
        );
        await tools(true);
        await page.waitForSelector("#research-process");
        const reading = await page.locator("#research-reading").innerText();
        assert.match(reading, /PB2002 #1510/);
        await tools(false);
        await shot("Forschungsatlas", true);
        await tools(true);
        await click("research-process");
        await waitStudio("arc");
        await click("geo-step");
        await click("geo-back");
        await page.waitForSelector("#research-process:visible");
        assert.equal(await page.locator("#research-projection").inputValue(), "map");
        assert.equal(await page.locator("#research-base").inputValue(), "bathy");
        assert.equal(await page.locator("#research-layers input[value=age]").isChecked(), true);
        assert.match(await page.locator("#research-reading").innerText(), /PB2002 #1510/);
      });
    }
    if (part("modelle")) {
      await action("D-Wilson-und-Raumanalogie", async () => {
        await topic("process-wilson");
        await waitStudio("wilson");
        await select("geo-info", "explain");
        await click("geo-play");
        if (film)
          await page.waitForFunction(() => window.geoObservatory().observatory.studio.time === 1, null, {
            timeout: 105000,
          });
        else {
          await page.waitForTimeout(500);
          await click("geo-play");
        }
        for (const n of [0, 0.125, 0.25, 0.375, 0.54, 0.64, 0.76, 0.875, 1]) {
          await phase(n);
          const row = await page.evaluate(() => {
            const s = window.geoObservatory().observatory;
            return {
              t: s.studio.time,
              geometry: s.materialMotion[0],
              explanation: document.querySelector(".studio-object")?.innerText,
            };
          });
          const direction = n < 0.53 ? 1 : n <= 0.61 ? 0 : -1;
          assert.equal(row.geometry.margins.length, direction ? 2 : 0);
          if (direction) {
            assert.equal(Math.sign(row.geometry.margins[0].dir[0]), -direction);
            assert.equal(Math.sign(row.geometry.margins[1].dir[0]), direction);
          }
          assert.equal(row.geometry.ridge.length, n >= 0.3 && n < 0.74 ? 2 : 0);
          assert.match(
            row.explanation,
            direction === 1 ? /entfernen/ : direction === 0 ? /kaum/ : /nähern|verkürzt/,
          );
          log.stages.push(row);
          await shot("Wilson-" + String(n).replace(".", "-"), n === 0.64);
        }
        await phase(0.375);
        await page.getByRole("button", { name: "Analogie auf der Erde" }).click();
        await page.waitForSelector("#geo-section:visible");
        await click("geo-back");
        await waitStudio("wilson");
        assert.equal(await page.evaluate(() => window.geoObservatory().observatory.studio.time), 0.375);
      });
      await action("E-Freigabe-und-Kamera", async () => {
        await topic("process-ridge");
        await waitStudio("ridge");
        await select("geo-info", "observe");
        await ticks();
        assert.equal(await page.locator(".studio-object:visible").count(), 0);
        await shot("Beobachten");
        await click("geo-release");
        await page.locator(".studio-object:visible").first().click();
        await ticks();
        assert.equal(await page.locator(".studio-object:visible").count(), 1);
        await shot("Einzelfreigabe");
        await select("geo-info", "terms");
        await shot("Fachbegriffe");
        await select("geo-info", "explain");
        await phase(0.6);
        await shot("Ruecken", true);
        const canvas = await page.locator("#earth").boundingBox();
        await page.mouse.move(canvas.x + canvas.width * 0.68, canvas.y + canvas.height * 0.45);
        await page.mouse.down();
        await page.mouse.move(canvas.x + canvas.width * 0.75, canvas.y + canvas.height * 0.49, { steps: 8 });
        await page.mouse.up();
        await page.mouse.wheel(0, -85);
        await shot("Erklaeren-gedreht");
        await select("geo-preset", "magnet");
        await shot("Magnetstreifen");
        await select("geo-info", "observe");
        await ticks();
        assert.equal(await page.locator(".studio-object:visible").count(), 0);
        await select("geo-info", "explain");
      });
      for (const id of [
        "rift",
        "hotspot",
        "oblique",
        "oceanTransform",
        "complex",
        "transform",
        "subduction",
      ]) {
        await topic("process-" + id);
        await waitStudio(id);
        await phase(0.6);
        await shot(id);
      }
      await tools(true);
      await page.locator("#studio-details summary").click();
      await select("studio-count", "4");
      await tools(false);
      await shot("Vier-Modelle");
      const ridgeIndex = await page.evaluate(() =>
        window.geoObservatory().observatory.studio.models.indexOf("ridge"),
      );
      assert.ok(ridgeIndex >= 0);
      await page.locator(".studio-cell").nth(ridgeIndex).locator(":scope > button").first().click();
      await select("geo-preset", "magnet");
      await page.waitForFunction(() => window.geoObservatory().observatory.studio.analysis === "magnet");
      await page.getByRole("button", { name: /Alle zeigen/ }).click();
      await page.waitForFunction(() => {
        const state = window.geoObservatory().observatory.studio;
        const preset = document.querySelector("#geo-preset");
        return (
          state.focus === -1 &&
          state.analysis === "natural" &&
          preset.value === "movement" &&
          !preset.querySelector('[value="magnet"]') &&
          !document.querySelector(".studio-cell > span")?.textContent.includes("Magnetisierung")
        );
      });
      log.actions.push(
        "Magnetstreifen am einzelnen Rücken geöffnet und zum gemeinsamen Plattenvergleich zurückgekehrt",
      );
    }
    if (part("bestand")) {
      await action("F-Unterrichtsmodelle", async () => {
        for (const [id, name] of [
          ["layers", "Erdinneres"],
          ["forces", "Plattenantrieb"],
          ["past", "Kontinentaldrift"],
          ["future", "Zukunft"],
          ["quake", "Parkfield"],
          ["sea", "Tsunami"],
          ["volcano", "Vulkanismus"],
          ["risk", "Schutz"],
          ["nyos", "Nyos"],
        ]) {
          await topic(id);
          if (["forces", "quake", "sea", "volcano", "risk"].includes(id)) await region();
          if (id === "past" || id === "future")
            await page.waitForFunction(() => window.geoObservatory().observatory.timeReady);
          if (id === "past") {
            await tools(true);
            await page.locator("#g-evidence summary").click();
            await select("g-evidence-kind", "ice");
            await tools(false);
            await ticks();
          }
          if (id === "nyos") {
            await tools(true);
            await click("nyos-event");
            await tools(false);
            await waitForNyosLake(page);
            const note = page.locator("#modelnote");
            await note.waitFor({ state: "visible" });
            const rect = await note.boundingBox();
            assert.ok(rect.height < 64, "Der einzeilige Modellhinweis lässt das Seeprofil frei");
          }
          if (id === "layers") {
            await tools(true);
            await select("studio-layer", "1");
            await tools(false);
          }
          if (await page.locator("#geo-step").isVisible()) await click("geo-step");
          await shot(name, true);
        }
      });
      await select("geo-place", "country-de");
      await page.waitForFunction(() => document.querySelector("#geo-crumb").textContent.includes("National"));
      await select("geo-place", "local-helgoland");
      await page.waitForFunction(
        () => window.geoObservatory().region === "helgoland" && !window.geoObservatory().flying,
      );
      await shot("Deutschland-Helgoland");
      await click("geo-back");
      await page.waitForFunction(() => document.querySelector("#geo-crumb").textContent.includes("National"));
      await shot("Deutschland");
      if (board) {
        await topic("process-arc");
        await waitStudio("arc");
        await select("geo-info", "explain");
        await phase(0.6);
        for (const [width, height] of [
          [1280, 720],
          [1366, 768],
          [1920, 1080],
          [2560, 1440],
        ]) {
          await page.setViewportSize({ width, height });
          if (!(await page.evaluate(() => Boolean(document.fullscreenElement)))) await click("present");
          await page.waitForFunction(
            () => Boolean(document.fullscreenElement) && document.body.classList.contains("present"),
          );
          await ticks();
          const m = await metrics(page);
          assert.equal(m.width, width);
          assert.equal(m.height, height);
          assert.ok(m.usable >= 0.85, JSON.stringify(m));
          assert.equal(m.sideVisible, false);
          assert.ok(m.scroll <= 1);
          const boxes = await page
            .locator(".studio-object:visible")
            .evaluateAll((es) =>
              es
                .filter((e) => getComputedStyle(e).visibility !== "hidden")
                .map((e) => e.getBoundingClientRect().toJSON()),
            );
          assert.ok(boxes.length >= 2, "Mindestens zwei verankerte Fachbegriffe");
          for (let i = 0; i < boxes.length; i++)
            for (const b of boxes.slice(i + 1)) {
              const a = boxes[i];
              assert.ok(
                a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top,
                JSON.stringify({ width, height, a, b }),
              );
            }
          log.boards.push(m);
          await shot("Smartboard-" + width);
          await click("present");
          await page.waitForFunction(() => !document.fullscreenElement);
        }
      }
    }
    assert.deepEqual(log.errors, []);
    log.complete = true;
  } finally {
    page.off("pageerror", errors);
    await writeFile(join(out, "Bedienpruefung.json"), JSON.stringify(log, null, 2));
  }
  return log;
}
