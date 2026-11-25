// Exercise the locally packed atlas, checking coordinates against separately published site values.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
const out = process.env.G64_OUT || "test-results/g64";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
const report = { errors: [], network: [], shots: [], places: {}, engine: browser.version() };
page.setDefaultTimeout(45000);
page.on("pageerror", (e) => report.errors.push(e.message));
await page.route(/^https?:/, (r) => {
  report.network.push(r.request().url());
  return r.abort();
});
async function shot(name) {
  await page.screenshot({ path: join(out, name + ".jpg"), type: "jpeg", quality: 87 });
  report.shots.push(name);
}
async function place(lat, lon) {
  const canvas = page.locator(".research-map-plane canvas"),
    b = await canvas.boundingBox();
  await canvas.click({ position: { x: ((180 + lon) / 360) * b.width, y: ((90 - lat) / 180) * b.height } });
  return page.locator("#research-reading").innerText();
}
try {
  await page.goto(pathToFileURL(resolve(process.argv[2])).href);
  await page.waitForFunction(() => window.geoObservatory?.().ready);
  await page.click("#nav-plates");
  await page.click("#g-boundaries");
  await page.click("#research-open");
  await page.waitForFunction(() =>
    document.querySelector("#research-reading")?.textContent.includes("Klick"),
  );
  await page.locator("#research-layers input[value=age]").check();
  await shot("01-Globus-Ozeanbodenalter");
  await page.selectOption("#research-projection", "map");
  const toggle = (key) => page.locator('#research-layers input[value="' + key + '"]');
  const values = await page.locator("#research-layers input").evaluateAll((es) => es.map((n) => n.value));
  for (const id of values) {
    await toggle(id).setChecked(false);
    await toggle(id).setChecked(true);
    await toggle(id).setChecked(false);
  }
  await toggle("bounds").check();
  report.places.Japan = await place(38.25, 144);
  assert.match(report.places.Japan, /PB2002 #/);
  await toggle("bounds").uncheck();
  await toggle("age").check();
  for (const [n, lat, lon] of [
    ["Ridge", -25, -13],
    ["Flank", -25, -30],
    ["Sahara", 24, 10],
  ])
    report.places[n] = await place(lat, lon);
  const age = (txt) => Number(txt.match(/Ozeanbodens · ([\d,]+)/)?.[1].replace(",", "."));
  assert.ok(age(report.places.Ridge) < age(report.places.Flank));
  assert.match(report.places.Sahara, /ohne Daten/);
  await toggle("magnetic").check();
  await toggle("volcano").check();
  report.places.Eifel = await place(50.17, 6.85);
  assert.match(report.places.Eifel, /Eifel/);
  await shot("02-Weltkarte-Raster-und-Vulkane");
  await toggle("quakes").check();
  await toggle("depth").check();
  await page.getByLabel("Mindestmagnitude").selectOption("8");
  await page.getByLabel("Herdtiefe bis (km)").selectOption("70");
  await toggle("volcano").uncheck();
  await toggle("gnss").check();
  report.places.HOFN = await place(64.267, -15.198);
  assert.match(report.places.HOFN, /HOFN.*20,?4|HOFN.*20\.4/s);
  await page.locator("#research-profile summary").click();
  await page.click("#profile-start");
  await place(0, 0);
  await place(0, 10);
  const equator = await page.locator("#profile-measured").innerText();
  const norm = equator.match(/Strecke ([\d.]+) km/);
  assert.ok(norm);
  assert.ok(Math.abs(Number(norm[1].replaceAll(".", "")) - 1111.95) < 60);
  await page.click("#profile-start");
  await place(-25, -13);
  await place(-25, -30);
  report.profile = await page.locator("#profile-measured").innerText();
  assert.match(report.profile, /Altersunterschied/);
  await page.locator("#research-profile").scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Ozeanbodenprofil groß zeigen" }).click();
  assert.ok(await page.getByRole("dialog", { name: "Ozeanbodenprofil" }).isVisible());
  await shot("04-Profil-Atlantik");
  await page.keyboard.press("Escape");
  await page.locator("#research-rates summary").click();
  const rate = page.locator("#research-rates");
  assert.match(await rate.innerText(), /18,9 mm\/Jahr/);
  assert.match(await rate.innerText(), /92 mm\/Jahr/);
  await page.getByLabel("Geschwindigkeit", { exact: true }).selectOption("cm");
  assert.match(await rate.innerText(), /9,2 cm\/Jahr/);
  await page.getByLabel("Weg bei konstanter Relativbewegung").selectOption("100000");
  assert.match(await rate.innerText(), /Weg 9,2 km/);
  await page.getByLabel("Zweite Grenze").selectOption("2877");
  assert.match(await rate.innerText(), /4,56 cm\/Jahr/);
  await rate.scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Geschwindigkeitsvergleich groß zeigen" }).click();
  await shot("03-PB2002-Geschwindigkeiten");
  await page.keyboard.press("Escape");
  await page.click("#saved-views");
  await page.fill("#view-name", "Atlas mit Stationsmessungen");
  await page.click("#view-save");
  await page.click("#view-close");
  await page.click("#research-back");
  await page.waitForSelector("#g-example");
  assert.equal(await page.locator(".research-map-plane").count(), 0);
  await page.click("#saved-views");
  await page.selectOption("#saved-list", { label: "Atlas mit Stationsmessungen" });
  await page.click("#view-apply");
  await page.waitForFunction(() =>
    document.querySelector("#research-reading")?.textContent.includes("Klick"),
  );
  assert.equal(await page.locator("#research-projection").inputValue(), "map");
  assert.equal(await page.getByLabel("Mindestmagnitude").inputValue(), "8");
  assert.equal(await page.getByLabel("Zweite Grenze").inputValue(), "2877");
  assert.ok(await toggle("gnss").isChecked());
  assert.equal(await page.locator("#profile-measured").innerText(), report.profile);
  report.favoriteRestored = true;
  await page.click("#research-back");
  await page.waitForSelector("#g-example");
  assert.equal(await page.locator(".research-map-plane").count(), 0);
  await page.click("#nav-nyos");
  await page.waitForFunction(() => window.geoObservatory().mode === "nyos");
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.network, []);
  report.complete = true;
} finally {
  await writeFile(join(out, "Atlas-Browser.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
