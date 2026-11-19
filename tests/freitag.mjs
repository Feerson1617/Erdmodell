import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import { mkdir, cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createInterface } from "node:readline";
import { createHash } from "node:crypto";
import { chromium, webkit } from "playwright";
import { PNG } from "pngjs";

const dest = "test-results/freitag";
const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const names = ["Erdkruste", "Erdmantel", "Äußerer Erdkern", "Innerer Erdkern"];
const definitions = [
  "Die dünne Außenschicht der Erde. Sie besteht aus festem Gestein.",
  "Er besteht überwiegend aus festem Gestein. Dieses kann sich über sehr lange Zeit langsam verformen.",
  "Er besteht hauptsächlich aus flüssigem Metall.",
  "Er besteht hauptsächlich aus festem Metall.",
];
const preview = await mkdtemp(join(tmpdir(), "Freitag Unterricht "));
await mkdir(dest, { recursive: true });
await cp("dist", preview, { recursive: true });
for (const f of ["START.command", "start_lokal.py"])
  await cp("scripts/" + f, join(preview, f));
const child = spawn(join(preview, "START.command"), [], {
  cwd: tmpdir(),
  env: { ...process.env, BROWSER: "true" },
  stdio: ["ignore", "pipe", "ignore"],
});
const stopped = once(child, "exit");
const output = createInterface({ input: child.stdout });
const report = { commit, runs: [] };
const state = (p) => p.evaluate(() => window.geoObservatory());
const settle = (p) =>
  p.waitForFunction(() => {
    const w = window.geoObservatory?.();
    return w?.ready && !w.flying && w.draws > 0;
  });
const frame = (p) =>
  p.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );
async function anonymous(p) {
  const all = await p.evaluate(() =>
    [
      document.body.textContent,
      ...Array.from(
        document.querySelectorAll("[title],[aria-label],[alt]"),
        (e) =>
          [e.title, e.getAttribute("aria-label"), e.getAttribute("alt")].join(
            " ",
          ),
      ),
    ].join(" "),
  );
  assert.doesNotMatch(all, /Erdkruste|Erdmantel|Erdkern|Lithosphäre/i);
  assert.doesNotMatch(
    await p.locator("#desk").ariaSnapshot(),
    /Erdkruste|Erdmantel|Erdkern|Lithosphäre/i,
  );
  assert.equal(await p.locator("#pins button,#layerText").count(), 0);
}
async function rendered(p) {
  return PNG.sync.read(await p.locator("#earth").screenshot());
}
function change(a, b) {
  assert.deepEqual([a.width, a.height], [b.width, b.height]);
  let different = 0;
  for (let i = 0; i < a.data.length; i += 4)
    if (
      Math.abs(a.data[i] - b.data[i]) +
        Math.abs(a.data[i + 1] - b.data[i + 1]) +
        Math.abs(a.data[i + 2] - b.data[i + 2]) >
      30
    )
      different++;
  return different / (a.width * a.height);
}
async function sample(p, title, action) {
  return p.evaluate(
    async ({ title, action }) => {
      const before = window.geoObservatory(),
        gaps = [];
      let prev = await new Promise(requestAnimationFrame);
      for (let i = 0; i < 20; i++) {
        if (action === "rotate")
          document.dispatchEvent(
            new KeyboardEvent("keydown", {
              key: i < 10 ? "ArrowRight" : "ArrowLeft",
              bubbles: true,
            }),
          );
        if (action === "switch" && i % 5 === 0)
          document
            .querySelector(i % 10 === 0 ? "#nav-globe" : "#nav-inside")
            .click();
        if (action === "present" && (i === 2 || i === 12))
          document.querySelector("#present").click();
        const time = await new Promise(requestAnimationFrame);
        gaps.push(time - prev);
        prev = time;
      }
      const w = window.geoObservatory(),
        sorted = [...gaps].sort((a, b) => a - b);
      const resources = (v) => ({
        geometries: v.geometries,
        textures: v.textures,
        programs: v.programs,
        draws: v.draws,
        triangles: v.triangles,
        renderbuffer: v.resolution,
        transparentParts: v.shell.transparentParts,
        shadowPass: v.shell.shadowPass,
        labels: v.shellAnnotationDom,
        heap: performance.memory?.usedJSHeapSize ?? null,
      });
      return {
        title,
        gaps,
        fps: (1000 * gaps.length) / gaps.reduce((a, b) => a + b),
        p95Ms: sorted[Math.ceil(0.95 * sorted.length) - 1],
        maxMs: sorted.at(-1),
        over250: gaps.filter((x) => x > 250).length,
        before: resources(before),
        after: resources(w),
      };
    },
    { title, action },
  );
}
async function film(browser, url) {
  const ctx = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    hasTouch: true,
    reducedMotion: "reduce",
    recordVideo: { dir: preview, size: { width: 1092, height: 614 } },
  });
  const p = await ctx.newPage(),
    video = p.video();
  try {
    await p.goto(url);
    await settle(p);
    await p.waitForTimeout(650);
    for (const selector of [
      "#present",
      "#nav-inside",
      '[data-layer="1"]',
      "#revealOne",
      "#allNames",
      '[data-object="shell-1"]',
      "#definition button",
      "#scale",
      "#scale",
      "#home",
    ]) {
      await p.tap(selector);
      await frame(p);
      if (selector === "#nav-inside") {
        await settle(p);
        const earth = await p.locator("#earth").boundingBox();
        await p.mouse.move(
          earth.x + earth.width * 0.6,
          earth.y + earth.height * 0.46,
        );
        await p.mouse.down();
        await p.mouse.move(
          earth.x + earth.width * 0.63,
          earth.y + earth.height * 0.46,
          { steps: 8 },
        );
        await p.mouse.up();
      }
      await p.waitForTimeout(650);
    }
  } finally {
    await ctx.close();
    await video.saveAs(join(dest, "bedienung.webm"));
  }
}
async function run(type, engine, url) {
  const browser = await type.launch({
    executablePath:
      process.env[engine === "chromium" ? "CHROMIUM_PATH" : "WEBKIT_PATH"] ||
      undefined,
    args:
      engine === "chromium"
        ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
        : [],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    hasTouch: true,
    reducedMotion: "reduce",
    deviceScaleFactor: 1,
  });
  const p = await ctx.newPage();
  const errors = [],
    external = [],
    r = {
      engine,
      version: browser.version(),
      steps: [],
      images: [],
      performance: [],
      viewports: [],
      pixelChanges: {},
    };
  report.runs.push(r);
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("response", (res) => {
    if (res.status() >= 400) errors.push(res.url());
  });
  await ctx.route(/^https?:/, (route) => {
    if (new URL(route.request().url()).origin === new URL(url).origin)
      return route.continue();
    external.push(route.request().url());
    return route.abort();
  });
  const step = (t) => r.steps.push(t);
  const shot = async (name) => {
    await frame(p);
    if (engine === "chromium") {
      const data = await p.screenshot({
        path: join(dest, name + ".jpg"),
        quality: 87,
      });
      r.images.push({
        name,
        hash: createHash("sha256").update(data).digest("hex"),
      });
    }
  };
  // Exercise the classroom layout with fullscreen denied as in an LMS.
  await p.addInitScript(() => {
    Element.prototype.requestFullscreen = () =>
      Promise.reject(new DOMException("Vollbild gesperrt", "NotAllowedError"));
  });
  const click = (id) => p.tap("#" + id);
  const sampleHere = async (title, action) =>
    r.performance.push(await sample(p, title, action));
  try {
    await p.goto(url);
    await settle(p);
    step("START.command öffnet die lokale Unterrichtsadresse");
    assert.match(p.url(), /unterricht=schalenbau/);
    assert.deepEqual(await p.locator("nav button:visible").allTextContents(), [
      "Globus",
      "Schalenschnitt",
    ]);
    assert.equal((await state(p)).mode, "globe");
    await anonymous(p);
    step("Geschlossener Globus im Stil A");
    await shot("01-globus");
    await sampleHere("Globus in Ruhe");
    await click("present");
    assert.equal(
      await p.locator("#present").getAttribute("aria-pressed"),
      "true",
    );
    step("Präsentieren bei verweigertem Vollbild");
    await click("nav-inside");
    await settle(p);
    await anonymous(p);
    assert.ok(!(await p.locator("#shellOptions").evaluate((d) => d.open)));
    await shot("02-anonym");
    step("Anonymer Schalenschnitt");
    await sampleHere("Schalen anonym");
    const original = await rendered(p),
      area = await p.locator("#earth").boundingBox();
    const startLon = (await state(p)).lon;
    await p.mouse.move(area.x + area.width * 0.6, area.y + area.height * 0.6);
    await p.mouse.down();
    await p.mouse.move(area.x + area.width * 0.64, area.y + area.height * 0.6, {
      steps: 6,
    });
    await p.mouse.up();
    await p.waitForFunction(
      (start) => Math.abs(window.geoObservatory().lon - start) > 1,
      startLon,
    );
    const turned = await rendered(p);
    r.pixelChanges.rotation = change(original, turned);
    assert.ok(r.pixelChanges.rotation > 0.012);
    step("Erde drehen");
    await click("nav-inside");
    await settle(p);
    assert.deepEqual((await state(p)).shell.radii, [6371, 6336, 3481, 1221, 0]);
    step("Vier Schalen im Referenzmaßstab vergleichen");
    const plain = await rendered(p);
    await p.tap('[data-layer="1"]');
    await frame(p);
    r.pixelChanges.highlight = change(plain, await rendered(p));
    assert.ok(r.pixelChanges.highlight > 0.01);
    await anonymous(p);
    await shot("03-hervorgehoben");
    step("Eine Schale hervorheben");
    await sampleHere("Schale hervorgehoben");
    await click("revealOne");
    assert.deepEqual(await p.locator("#pins button").allTextContents(), [
      names[1],
    ]);
    await p.tap('[data-layer="2"]');
    await click("revealOne");
    await click("hideOne");
    assert.deepEqual(await p.locator("#pins button").allTextContents(), [
      names[1],
    ]);
    step("Namen einzeln aufdecken und wieder verbergen");
    await click("allNames");
    assert.deepEqual(
      (await p.locator("#pins button").allTextContents()).sort(),
      [...names].sort(),
    );
    await shot("04-namen");
    step("Alle Namen anzeigen");
    await sampleHere("Vier Namen");
    await click("hideOne");
    assert.equal(await p.locator("#pins button").count(), 3);
    await click("allNames");
    for (const [i, name] of names.entries()) {
      await p.locator("#pins button").getByText(name, { exact: true }).tap();
      assert.equal(await p.locator("#layerText").innerText(), definitions[i]);
      if (i === 1) await shot("05-definition");
      await p.keyboard.press("Escape");
      assert.equal(await p.locator("#layerText").count(), 0);
    }
    step("Jede Definition am Namen öffnen");
    step("Definition schließen");
    const ref = await state(p);
    step("Referenzdarstellung betrachten");
    const refImage = await rendered(p);
    await click("scale");
    await frame(p);
    const wide = await state(p);
    assert.match(
      await p.locator("#modelnote").innerText(),
      /Didaktisch überhöht/,
    );
    assert.ok(wide.shell.expanded && !wide.shell.lithosphere);
    for (const k of ["lon", "lat", "d", "tilt", "bearing"])
      assert.equal(wide[k], ref[k]);
    r.pixelChanges.scale = change(refImage, await rendered(p));
    assert.ok(r.pixelChanges.scale > 0.003);
    await shot("06-ueberhoehung");
    step("Kruste didaktisch verbreitern");
    await sampleHere("Kruste verbreitert");
    await click("scale");
    assert.deepEqual((await state(p)).shell.radii, ref.shell.radii);
    step("Referenzdarstellung wiederherstellen");
    await sampleHere("Zurück im Referenzmaßstab");
    await click("home");
    await settle(p);
    await anonymous(p);
    assert.equal((await state(p)).mode, "globe");
    step("Mit einer Aktion zum anonymen Globus");
    await click("nav-inside");
    await settle(p);
    await click("labels");
    await sampleHere("Kontinuierlich drehen", "rotate");
    await click("nav-inside");
    await settle(p);
    await p.tap('[data-layer="1"]');
    await p.tap("#shellOptions summary");
    await p.locator("#opacity").fill("45");
    assert.equal((await state(p)).shell.opacity[1], 0.45);
    await sampleHere("Transparenter Mantel");
    await click("restoreLayers");
    await click("lithosphere");
    await click("scale");
    assert.ok(!(await state(p)).shell.lithosphere);
    await click("lithosphere");
    assert.ok(!(await state(p)).shell.expanded);
    await click("home");
    await settle(p);
    await click("nav-inside");
    await settle(p);
    await sampleHere("Wiederholter Ansichtswechsel", "switch");
    await settle(p);
    await sampleHere("Präsentationswechsel", "present");
    for (const [width, height] of [
      [1920, 1080],
      [1366, 768],
      [1024, 768],
      [768, 1024],
    ]) {
      await p.setViewportSize({ width, height });
      await click("home");
      await settle(p);
      await click("nav-inside");
      await settle(p);
      await click("labels");
      await frame(p);
      const boxes = await p.evaluate(() => {
        const rect = (e) => {
          const b = e.getBoundingClientRect();
          return [b.x, b.y, b.right, b.bottom];
        };
        return {
          pins: Array.from(document.querySelectorAll("#pins button"), rect),
          font: parseFloat(
            getComputedStyle(document.querySelector("#pins button")).fontSize,
          ),
          model: rect(document.querySelector("#earth")),
          sidebar: rect(document.querySelector("#sidebar")),
          controls: ["#home", "#nav-inside", "#labels", "#present"].map((id) =>
            rect(document.querySelector(id)),
          ),
          scroll: [
            scrollX,
            scrollY,
            document.documentElement.scrollWidth,
            document.documentElement.scrollHeight,
          ],
        };
      });
      assert.ok(boxes.font >= 28 && boxes.pins.length > 0);
      if (width === 1920) assert.equal(boxes.pins.length, 4);
      assert.deepEqual(boxes.scroll, [0, 0, width, height]);
      const overlap = (a, b) =>
        a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
      for (const [i, b] of boxes.pins.entries())
        assert.ok(!boxes.pins.slice(i + 1).some((c) => overlap(b, c)));
      assert.ok(!overlap(boxes.model, boxes.sidebar));
      for (const b of [...boxes.pins, ...boxes.controls])
        assert.ok(
          b[3] - b[1] >= 59.9 &&
            b[0] >= -1 &&
            b[1] >= -1 &&
            b[2] <= width + 1 &&
            b[3] <= height + 1,
          JSON.stringify({ width, height, b }),
        );
      r.viewports.push({ width, height, ...boxes });
      if (width === 1920) await shot("07-smartboard");
      if (width === 768) await shot("08-hochformat");
    }
    await click("home");
    await settle(p);
    await anonymous(p);
    assert.equal(r.steps.length, 15);
    assert.equal(r.performance.length, 10);
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    r.externalRequests = external;
    r.errors = errors;
    if (engine === "chromium") await film(browser, url);
  } finally {
    await ctx.close();
    await browser.close();
  }
}
try {
  const [line] = await once(output, "line", {
    signal: AbortSignal.timeout(12000),
  });
  const url = line.match(
    /http:\/\/127\.0\.0\.1:\d+\/\?unterricht=schalenbau/,
  )[0];
  for (const engine of (process.env.TEST_ENGINES || "chromium,webkit").split(
    ",",
  ))
    await run({ chromium, webkit }[engine], engine, url);
} catch (e) {
  report.failure = String(e);
  throw e;
} finally {
  output.close();
  child.kill();
  await stopped;
  await rm(preview, { recursive: true, force: true });
  await writeFile(join(dest, "pruefung.json"), JSON.stringify(report, null, 2));
}
const md = [
  "# Unterrichtsprobe · Freitag, 20. November 2026",
  "",
  `Produktionsbuild \`${commit}\`. Je Szenario 20 aufeinanderfolgende Bildintervalle bei 1366 × 768. Linux-Software-Rendering. Rohwerte, Gerätefenster, Renderpuffer, Schatten, Transparenz, Programme, Texturen, Bildänderungen und die 15 Bedienhandlungen stehen in pruefung.json.`,
];
for (const r of report.runs) {
  md.push(
    "",
    "## " + r.engine + " " + r.version,
    "",
    "| Bedienung | Bilder/s | P95 ms | längstes Intervall ms | Intervalle über 250 ms |",
    "|---|---:|---:|---:|---:|",
  );
  for (const s of r.performance)
    md.push(
      `| ${s.title} | ${s.fps.toFixed(1)} | ${s.p95Ms.toFixed(0)} | ${s.maxMs.toFixed(0)} | ${s.over250} |`,
    );
}
await writeFile(join(dest, "Messbericht.md"), md.join("\n") + "\n");
