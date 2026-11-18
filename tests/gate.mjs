import { createServer } from "vite";
import { chromium } from "playwright";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const server = await createServer({
  server: { host: "127.0.0.1", port: 0 },
  logLevel: "error",
});
await server.listen();
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
}
