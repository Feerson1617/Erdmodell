import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { preview } from "vite";
import { PNG } from "pngjs";
import { chromium } from "playwright";

const root = "test-results/freitag/bildvergleich";
await mkdir(root, { recursive: true });
const baseline = "1caab5e3578cff1c92814ccb781f3069f9be3dbd";
const candidate = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
async function capture(directory, version) {
  const server = await preview({
    configFile: false,
    base: "/",
    build: { outDir: directory },
    preview: { host: "127.0.0.1", port: 0 },
    logLevel: "error",
  });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 0.75,
    reducedMotion: "reduce",
  });
  try {
    const p = await context.newPage();
    await p.goto("http://127.0.0.1:" + server.httpServer.address().port);
    await p.waitForFunction(() => window.geoObservatory?.().ready);
    await p.click("#nav-inside");
    await p.waitForFunction(
      () =>
        !window.geoObservatory().flying &&
        window.geoObservatory().shell.builds > 0,
    );
    await p.addStyleTag({
      content:
        ".tools,.orientation,#modelnote,.annotations {visibility:hidden}",
    });
    const pictures = {};
    const shot = async (name) => {
      await p.evaluate(
        () =>
          new Promise((done) =>
            requestAnimationFrame(() => requestAnimationFrame(done)),
          ),
      );
      const data = await p.locator("#earth").screenshot();
      const stats = await p.evaluate(() => {
        const w = window.geoObservatory();
        return {
          draws: w.draws,
          triangles: w.triangles,
          pose: [w.lat, w.lon, w.d, w.tilt, w.bearing],
          buffer: [w.resolution.width, w.resolution.height],
        };
      });
      await writeFile(root + "/" + version + "-" + name + ".png", data);
      pictures[name] = { image: PNG.sync.read(data), stats };
    };
    await shot("referenz");
    await p.click("#scale");
    await shot("ueberhoeht");
    await p.click("#scale");
    await p.click("[data-layer='1']");
    await shot("hervorgehoben");
    await p.locator("#opacity").fill("45");
    await shot("durchscheinend");
    await p.click("[data-eye='0']");
    await shot("ohne-aussenschale");
    await p.click("#isolate");
    await shot("einzeln");
    await p.click("#restoreLayers");
    await p.click("#cut");
    await shot("geschlossen");
    return pictures;
  } finally {
    await context.close();
    await server.close();
  }
}
try {
  const old = await capture(
    process.env.SHELL_REFERENCE || ".scratch/g422-reference/dist",
    "G4.2.1",
  );
  const current = await capture("dist", "G4.2.2");
  const results = [];
  for (const [name, { image: b, stats: after }] of Object.entries(current)) {
    const { image: a, stats: before } = old[name];
    assert.deepEqual(before.pose, after.pose);
    assert.deepEqual(before.buffer, after.buffer);
    assert.ok(a.width === b.width && a.height === b.height);
    let differences = 0;
    for (let i = 0; i < a.data.length; i += 4)
      if ([0, 1, 2].some((c) => Math.abs(a.data[i + c] - b.data[i + c]) > 8))
        differences++;
    const fraction = differences / (a.width * a.height);
    results.push({ name, before, after, differences, fraction });
    console.log(name, fraction, before.triangles, after.triangles);
  }
  await writeFile(
    root + "/vergleich.json",
    JSON.stringify({ baseline, candidate, results }, null, 2),
  );
  assert.ok(
    results.every((r) => r.fraction < 0.001),
    "Farbabweichung von mehr als 8/255 in mindestens 0,1 % der Pixel",
  );
  assert.ok(results[0].after.triangles < results[0].before.triangles);
} finally {
  await browser.close();
}
