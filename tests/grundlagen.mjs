import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, webkit } from "playwright";
import { preview } from "vite";

const dest = "test-results/g4.2";
await mkdir(dest, { recursive: true });
const server = await preview({
  configFile: false,
  base: "/schule/grundlagen/",
  build: { outDir: "dist" },
  preview: { host: "127.0.0.1", port: 0 },
  logLevel: "error",
});
const url =
  "http://127.0.0.1:" +
  server.httpServer.address().port +
  "/schule/grundlagen/";
const report = {
  commit: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  runs: [],
};
const read = (p) => p.evaluate(() => window.geoObservatory());
const settle = (p) =>
  p.waitForFunction(
    () =>
      window.geoObservatory?.().frames > 3 && !window.geoObservatory().flying,
  );
const names = ["Erdkruste", "Erdmantel", "Äußerer Erdkern", "Innerer Erdkern"];
const temp = await mkdtemp(join(tmpdir(), "g42-video-"));
async function cadence(p) {
  return p.evaluate(async () => {
    const gl = document.getElementById("earth").getContext("webgl2"),
      ext = gl.getExtension("WEBGL_debug_renderer_info");
    const gaps = [];
    await new Promise((resolve) => {
      let last = 0;
      function tick(t) {
        if (last) gaps.push(t - last);
        last = t;
        if (gaps.length === 24) resolve();
        else requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
    gaps.sort((a, b) => a - b);
    return {
      renderer: ext
        ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER),
      fps: (1000 * gaps.length) / gaps.reduce((a, b) => a + b, 0),
      medianMs: gaps[12],
      p95Ms: gaps[22],
      resolution: window.geoObservatory().resolution,
    };
  });
}
async function exercise(browser, engine) {
  const realVideo = engine === "chromium";
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  const p = await ctx.newPage(),
    errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  const run = {
    engine,
    version: browser.version(),
    images: [],
    sites: {},
    checks: [],
  };
  const shot = async (name) => {
    if (!realVideo) return;
    const bytes = await p.screenshot({
      path: join(dest, name + ".jpg"),
      type: "jpeg",
      quality: 88,
    });
    run.images.push({
      name,
      hash: createHash("sha256").update(bytes).digest("hex"),
    });
  };
  const click = (id) => p.tap("#" + id);
  const pins = (selector) => p.locator(selector + " button[data-object]");
  const texts = () =>
    p.evaluate(() =>
      [
        document.body.textContent,
        ...Array.from(
          document.querySelectorAll("[title],[aria-label]"),
          (n) => (n.title || "") + " " + (n.getAttribute("aria-label") || ""),
        ),
      ].join(" "),
    );
  const verifyLayout = async (loc) => {
    const boxes = await loc.evaluateAll((nodes) =>
      nodes.map((n) => {
        const { x, y, width, height } = n.getBoundingClientRect();
        return { x, y, width, height };
      }),
    );
    for (const [i, a] of boxes.entries()) {
      assert.ok(
        Math.round(a.width) >= 44 && Math.round(a.height) >= 44,
        JSON.stringify(a),
      );
      assert.ok(
        boxes
          .slice(i + 1)
          .every(
            (b) =>
              a.x + a.width <= b.x ||
              b.x + b.width <= a.x ||
              a.y + a.height <= b.y ||
              b.y + b.height <= a.y,
          ),
        "Überschneidung von Objektbeschriftungen",
      );
    }
  };
  try {
    await p.goto(url);
    await settle(p);
    assert.equal((await read(p)).style, "A");
    await shot("01-globus");
    await click("nav-inside");
    await settle(p);
    assert.doesNotMatch(
      await texts(),
      /Erdkruste|Erdmantel|Erdkern|Lithosphäre/i,
    );
    await shot("02-anonym");
    await p.tap('[data-layer="1"]');
    await click("revealOne");
    assert.deepEqual(await pins("#pins").allTextContents(), ["Erdmantel"]);
    assert.doesNotMatch(await texts(), /Erdkruste|Erdkern|Lithosphäre/i);
    await click("labels");
    await p.waitForFunction(
      () => document.querySelectorAll("#pins button").length === 4,
    );
    assert.deepEqual(
      (await pins("#pins").allTextContents()).sort(),
      [...names].sort(),
    );
    await verifyLayout(pins("#pins"));
    await shot("03-namen");
    assert.equal(await p.locator("#layerText").count(), 0);
    const start = Date.now();
    await p.tap('[data-object="shell-1"]');
    await p.waitForSelector("#layerText:visible");
    run.openMs = Date.now() - start;
    assert.match(
      await p.locator("#layerText").innerText(),
      /überwiegend aus festem Gestein/,
    );
    await shot("04-definition");
    await p.tap("#definition button");
    await click("scale");
    await click("lithosphere");
    await p.tap('[data-object="lithosphere"]');
    assert.match(
      await p.locator("#layerText").innerText(),
      /Erdkruste und der starre oberste Erdmantel/,
    );
    await shot("05-lithosphaere");
    await p.tap("#definition button");
    await click("lithosphere");
    await click("scale");
    const anchor = await p.locator('[data-object="shell-1"]').boundingBox();
    await click("in");
    await p.waitForFunction(
      (x) =>
        Math.abs(
          document
            .querySelector('[data-object="shell-1"]')
            ?.getBoundingClientRect().x - x,
        ) > 2,
      anchor.x,
    );
    await click("cut");
    assert.equal(await pins("#pins").count(), 0);
    await click("cut");
    await click("home");
    await click("nav-inside");
    await settle(p);
    run.withoutLabels = await cadence(p);
    await click("labels");
    run.withLabels = await cadence(p);
    for (let i = 0; i < 4; i++) {
      await p.tap('[data-layer="' + i + '"]');
      await click("isolate");
      await p.locator("#opacity").fill("45");
      const s = (await read(p)).shell;
      assert.equal(s.visible.filter(Boolean).length, 1);
      assert.equal(s.opacity[i], 0.45);
      await click("restoreLayers");
    }
    await click("labels");
    assert.doesNotMatch(
      await texts(),
      /Erdkruste|Erdmantel|Erdkern|Lithosphäre/i,
    );
    run.checks.push("A · Schalen und mechanischer Vergleich");
    await click("home");
    await settle(p);
    await click("nav-plates");
    await click("boundaries");
    assert.doesNotMatch(await texts(), /Pazifische Platte|Eurasische Platte/);
    await shot("06-grenzen");
    await click("plateNames");
    await p.waitForSelector("#platePins button");
    await p.selectOption("#plateSelect", "AF");
    await click("boundaryTypes");
    for (const kind of ["divergent", "convergent", "transform", "all"])
      await p.check('[name="kindFilter"][value="' + kind + '"]');
    await shot("07-platte");
    await verifyLayout(pins("#platePins"));
    await pins("#platePins").first().tap();
    assert.match(
      await p.locator("#layerText").innerText(),
      /oberste Erdmantel/,
    );
    await p.tap("#definition button");
    run.checks.push("B · Globus und Grenzen");
    for (const [i, id] of ["island", "japan", "san"].entries()) {
      await p.selectOption("#tectonicSite", id);
      await p.waitForFunction((id) => {
        const w = window.geoObservatory();
        return (
          w.tectonics.site === id && w.tectonics.reveal > 0.99 && !w.flying
        );
      }, id);
      await p.waitForSelector("#platePins button");
      run.sites[id] = await pins("#platePins").allTextContents();
      assert.ok(
        run.sites[id].length >= 2,
        id + " hat zu wenige Objektbeschriftungen",
      );
      assert.ok(
        run.sites[id].includes(
          { island: "Magma", japan: "Tiefseegraben", san: "Störung" }[id],
        ),
      );
      if (id === "san") assert.doesNotMatch(run.sites[id].join(" "), /Magma/);
      await verifyLayout(pins("#platePins"));
      await shot(["08-island", "09-japan", "10-kalifornien"][i]);
      await pins("#platePins").first().tap();
      assert.ok((await p.locator("#layerText").innerText()).length < 180);
      await p.tap("#definition button");
      if (id === "japan") {
        run.regionWithLabels = await cadence(p);
        await click("plateNames");
        run.regionWithoutLabels = await cadence(p);
        assert.doesNotMatch(await texts(), /Ochotskplatte|Tiefseegraben|Magma/);
        await click("plateNames");
      }
      await click("slowProcess");
      await click("playProcess");
      await p.waitForFunction(
        () => window.geoObservatory().tectonics.progress > 0.035,
      );
      await click("playProcess");
      await click("resetProcess");
      assert.equal((await read(p)).tectonics.progress, 0);
      await click("orbitProcess");
      await click("plateOverview");
      await settle(p);
    }
    run.checks.push("C · Drei animierte Räume");
    await click("home");
    await click("nav-inside");
    await settle(p);
    await p.setViewportSize({ width: 1920, height: 1080 });
    await click("present");
    await click("labels");
    await p.waitForSelector('[data-object="shell-0"]');
    run.board = await p
      .locator('[data-object="shell-0"]')
      .evaluate((b) => ({
        width: innerWidth,
        height: innerHeight,
        fontPx: parseFloat(getComputedStyle(b).fontSize),
        hitPx: b.offsetHeight,
      }));
    assert.equal(run.board.width, 1920);
    assert.equal(run.board.height, 1080);
    assert.ok(run.board.fontPx >= 20 && run.board.hitPx >= 60);
    await verifyLayout(pins("#pins"));
    await shot("11-smartboard");
    await click("present");
    await p.setViewportSize({ width: 768, height: 1024 });
    await p.waitForSelector('[data-object="shell-1"]');
    await p.tap('[data-object="shell-1"]');
    await shot("12-tablet");
    await verifyLayout(pins("#pins"));
    assert.ok(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await click("home");
    await settle(p);
    await click("nav-inside");
    await settle(p);
    assert.equal((await read(p)).shell.lithosphere, false);
    assert.equal(await pins("#pins").count(), 0);
    assert.deepEqual(errors, []);
    run.checks.push("D · Smartboard, Tablet und Rückkehr");
    report.runs.push(run);
    console.log(engine, run.checks, run.sites);
  } finally {
    await ctx.close();
  }
}
async function recordDemo(browser) {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    reducedMotion: "reduce",
    hasTouch: true,
    recordVideo: { dir: temp, size: { width: 960, height: 600 } },
  });
  const p = await ctx.newPage(),
    video = p.video();
  try {
    await p.goto(url);
    await settle(p);
    await p.tap("#nav-inside");
    await settle(p);
    await p.tap("#labels");
    await p.tap('[data-object="shell-1"]');
    await p.waitForTimeout(650);
    await p.tap("#definition button");
    await p.tap("#scale");
    await p.tap("#lithosphere");
    await p.waitForTimeout(650);
    await p.tap("#nav-plates");
    await p.tap("#boundaries");
    await p.tap("#plateNames");
    await p.selectOption("#tectonicSite", "japan");
    await settle(p);
    await p.waitForSelector('[data-object="trench"]');
    await p.tap("#playProcess");
    await p.waitForFunction(
      () => window.geoObservatory().tectonics.progress > 0.14,
    );
    await p.tap("#playProcess");
    await p.tap('[data-object="trench"]');
    await p.waitForTimeout(750);
  } finally {
    await ctx.close();
  }
  await video.saveAs(join(dest, "bedienung.webm"));
}
try {
  for (const engine of (process.env.TEST_ENGINES ?? "chromium,webkit").split(
    ",",
  )) {
    const browser = await { chromium, webkit }[engine].launch({
      executablePath:
        process.env[engine === "chromium" ? "CHROMIUM_PATH" : "WEBKIT_PATH"] ||
        undefined,
      args:
        engine === "chromium"
          ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
          : [],
    });
    try {
      await exercise(browser, engine);
      if (engine === "chromium") await recordDemo(browser);
    } finally {
      await browser.close();
    }
  }
} catch (e) {
  report.failure = String(e.stack ?? e);
  console.error(e);
  process.exitCode = 1;
} finally {
  await server.close();
  await rm(temp, { recursive: true, force: true });
  await writeFile(join(dest, "pruefung.json"), JSON.stringify(report, null, 2));
  const rows = [
    "# G4.2 · Browserprüfung",
    "",
    "Geprüfter Commit `" + report.commit + "`.",
    "",
    "Je 24 aufeinanderfolgende Browser-Bildintervalle am ruhenden Schalenschnitt und am Japangraben. Die Testfolge verwendet Touch-Eingaben. Unterschiede zwischen den kurzen Stichproben erlauben keine isolierte Aussage über GPU-Kosten.",
  ];
  for (const r of report.runs) {
    rows.push(
      "",
      "## " + r.engine + " " + r.version,
      "",
      r.withLabels.renderer,
      "",
      "| Ansicht | FPS | Median (ms) | P95 (ms) |",
      "|---|---:|---:|---:|",
    );
    for (const [n, c] of [
      ["Anonym", r.withoutLabels],
      ["Vier Namen", r.withLabels],
      ["Japan ohne Namen", r.regionWithoutLabels],
      ["Japan mit Namen", r.regionWithLabels],
    ])
      rows.push(
        `| ${n} | ${c.fps.toFixed(1)} | ${c.medianMs.toFixed(0)} | ${c.p95Ms.toFixed(0)} |`,
      );
    rows.push(
      "",
      `Definition per Touch geöffnet nach ${r.openMs} ms einschließlich Browserautomatisierung. Bei 1920 × 1080 betrug die Schriftgröße ${r.board.fontPx} CSS-Pixel, die Zielfläche war ${r.board.hitPx} Pixel hoch.`,
    );
  }
  await writeFile(join(dest, "Messbericht.md"), rows.join("\n") + "\n");
}
