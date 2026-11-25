import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
const [file, folder] = process.argv.slice(2);
await mkdir(folder, { recursive: true });
const b = await chromium.launch(
  process.env.G6_NATIVE_GPU
    ? { headless: false }
    : { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
);
try {
  const p = await b.newPage({
    viewport: { width: 1366, height: 768 },
    reducedMotion: "reduce",
  });
  await p.goto(pathToFileURL(resolve(file)).href);
  await p.waitForFunction(() => window.geoObservatory?.().ready);
  const samples = [];
  for (const id of ["volcano", "seismic-vt", "nyos"]) {
    await p.selectOption("#geo-topic", id);
    await p.waitForFunction(
      (id) =>
        document.querySelector("#geo-crumb").dataset.settled === "true" &&
        (id === "nyos"
          ? window.geoObservatory().mode === "nyos"
          : id === "volcano"
            ? window.geoObservatory().observatory.theme === "volcano"
            : window.geoObservatory().observatory.lessonView === "vt"),
      id,
    );
    await p.screenshot({
      path: join(folder, id + ".jpg"),
      type: "jpeg",
      quality: 84,
    });
    if (id !== "nyos") await p.click("#geo-play");
    samples.push({
      id,
      ...(await p.evaluate(() => window.geoDeviceProbe(1600))),
    });
  }
  await writeFile(
    join(folder, "Messung.json"),
    JSON.stringify(samples, null, 2),
  );
} finally {
  await b.close();
}
