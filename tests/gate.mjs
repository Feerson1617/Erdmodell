import { build, preview } from "vite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import assert from "node:assert/strict";
const outDir = await mkdtemp(join(tmpdir(), "GeoRisiko-Architektur-"));
await build({
  configFile: false,
  publicDir: false,
  build: { outDir, rollupOptions: { input: "tests/gate.html" } },
  logLevel: "error",
});
const server = await preview({
  configFile: false,
  build: { outDir },
  preview: { host: "127.0.0.1", port: 0 },
  logLevel: "error",
});
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage();
  await page.goto(
    new URL("tests/gate.html", server.resolvedUrls.local[0]).href,
  );
  await page.waitForFunction(() => !!window.sample);
  const ref = JSON.parse(
    await readFile("docs/evidence/architecture-gate.json"),
  );
  const pixels = await page.evaluate(
    (ds) => ds.map((d) => window.sample(d).slice(0, 3)),
    ref.distanceKm,
  );
  assert.ok(
    pixels.every((rgb, i) =>
      rgb.every((c, j) => Math.abs(c - ref.centerPixelRGB[i][j]) <= 1),
    ),
  );
  await mkdir("test-results", { recursive: true });
  console.log("Architekturnachweis", JSON.stringify(pixels));
  await writeFile(
    "test-results/architecture-gate.json",
    JSON.stringify({
      browser: browser.version(),
      distanceKm: ref.distanceKm,
      pixels,
    }),
  );
} finally {
  await browser.close();
  await server.close();
  await rm(outDir, { recursive: true, force: true });
}
