import {selectControl} from "./lesson-navigation.mjs";
import { chooseRelated, compareLake, switchPresentation } from "./geographic-controls.mjs";
import utils from "playwright-core/lib/utilsBundle";
const { jpegjs } = utils;
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { geometry, sizes } from "./g651-visual.mjs";
import { screencast } from "./g5-abnahme.mjs";

export async function ubProduct(page, out, { app, film = false } = {}) {
  const report = {
    routes: {},
    windows: [],
    frames: [],
    movies: [],
    errors: [],
  };
  const onerror = (e) => report.errors.push(String(e));
  page.on("pageerror", onerror);
  const select = (id, value) => selectControl(page, "#" + id, value);
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
  const study = async (id, child = false) => {
    await select(
      child ? "geo-preset" : "geo-topic",
      child ? id : "seismic-" + id,
    );
    await arrived(id);
  };
  const related = async (id) => {
    await chooseRelated(page);
    await arrived(id);
  };
  const time = (t) => page.locator("#geo-time").fill(String(t));
  const shot = async (name) => {
    const mask = await geometry(page, { textured: name === "G-Landschaften" });
    const screenshot = await page.screenshot({
      path: join(out, "G68-" + name + ".jpg"),
      type: "jpeg",
      quality: 84,
    });
    if(name==="E-Ausbreitung"){
      // Inspect the delivered, unmasked frame as well as the separate WebGL exposure.
      const {data,width,height}=jpegjs.decode(screenshot,{useTArray:true});
      let lit=0, sampled=0;
      for(let y=Math.floor(height*.24);y<height*.75;y+=4)for(let x=Math.floor(width*.13);x<width*.87;x+=4){
        const k=4*(y*width+x);
        if(data[k]>85&&data[k+1]>58&&data[k]>data[k+2]*1.12)lit++;
        sampled++;
      }
      mask.terrainFraction=lit/sampled;
      assert.ok(mask.terrainFraction>.08,"Im Originalbild fehlt das Nyos-Tal: "+mask.terrainFraction);
    }
    report.frames.push({ name, ...mask });
  };
  const geo = async () =>
    page.evaluate(() => {
      const w = window.geoObservatory();
      return {
        location: document.querySelector("#geo-crumb").innerText,
        lat: w.lat,
        lon: w.lon,
        globe: w.rendered.globe,
        nyos: w.rendered.nyos,
        study: w.observatory.lessonView,
      };
    });
  const world = async (id) => {
    await select("geo-topic", id);
    await settled();
  };
  const place = async (id) => {
    await select("geo-place", id);
    await settled();
  };
  const resize = async (w, h) => {
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
  };
  const diagram = async () =>
    page.evaluate(() => {
      const r = document.querySelector("#earth").getBoundingClientRect();
      const visible = [
        ...document.querySelectorAll(
          "#geo-dock button,#geo-dock input,#geo-dock select,.geo-selector select,.lake-evidence select",
        ),
      ].filter((e) => e.offsetWidth && e.offsetHeight);
      const clipped = visible
        .filter((e) => {
          const b = e.getBoundingClientRect();
          return (
            b.left < -1 ||
            b.top < -1 ||
            b.right > innerWidth + 1 ||
            b.bottom > innerHeight + 1
          );
        })
        .map((e) => e.id || e.className);
      const fonts = [
        ...document.querySelectorAll(
          "#geo-crumb,.seismic-label,.seismic-caption,.lake-evidence span,#geo-dock select",
        ),
      ]
        .filter((e) => e.offsetWidth && e.offsetHeight)
        .map((e) => ({
          element: e.className || e.id,
          px: parseFloat(getComputedStyle(e).fontSize),
        }));
      return {
        canvasArea: (r.width * r.height) / (innerWidth * innerHeight),
        clipped,
        fonts,
        scroll: document.documentElement.scrollHeight - innerHeight,
      };
    });
  await select("geo-info", "explain");
  await world("globe");
  const a = [await geo()];
  for (const id of ["space-Europa", "country-de"]) {
    await place(id);
    a.push(await geo());
  }
  assert.ok(
    a.at(-1).globe &&
      Math.abs(a.at(-1).lat - 51.1) < 0.3 &&
      Math.abs(a.at(-1).lon - 10.3) < 0.3,
  );
  await select("geo-place", "eifel");
  await arrived("eifel");
  a.push(await geo());
  await shot("A-Vulkaneifel");
  await related("ulmen");
  a.push(await geo());
  await shot("A-Ulmen");
  await study("aerial", true);
  await shot("A-Jungferweiher");
  report.routes.A = a;
  await related("lakeCut");
  await related("maar");
  await time(0);
  await shot("B-Ausgangsgelaende");
  await study("contactDetail", true);
  await time(0.56);
  await shot("B-Porenkontakt");
  await related("maar");
  for (const [name, t] of [
    ["Auswurf", 0.48],
    ["Diatrem", 0.73],
    ["Wasserfuellung", 1],
  ]) {
    await time(t);
    await shot("B-" + name);
  }
  report.routes.B = [
    "Seeschnitt",
    "Ausgangsgelände",
    "Porenraum",
    "Auswurf",
    "Diatrem",
    "Ufer",
  ];
  await study("mixing");
  await study("turnover", true);
  await time(0.5);
  await related("mixing");
  await study("mixCompare", true);
  await time(0.51);
  await shot("C-Zirkulation");
  report.routes.C = [
    "Vollzirkulation",
    "Meromixis",
    "gleichzeitiger Vergleich",
  ];
  await related("dissolved");
  await time(0.78);
  await shot("D-Geloest");
  await study("waterColumn", true);
  for (const [name, t] of [
    ["Druck", 0.37],
    ["Auftrieb", 0.71],
    ["Freisetzung", 0.91],
  ]) {
    await time(t);
    await shot("D-" + name);
  }
  await study("unsaturated", true);
  await time(0.79);
  await shot("D-Untersaettigt");
  report.routes.D = ["gelöst", "entlastet", "Blasen", "Gegenbeispiel"];
  await study("ulmen");
  await world("globe");
  await place("space-Afrika");
  await place("country-cm");
  const cm = await geo();
  assert.ok(cm.globe && Math.abs(cm.lat - 6) < 0.3);
  await world("nyos-section");
  await page.waitForFunction(() => window.geoObservatory().rendered.nyos);
  const n = await geo();
  assert.ok(Math.abs(n.lat - 6.438) < 0.25 && Math.abs(n.lon - 10.299) < 0.25);
  await select("geo-preset", "seismic-waterColumn");
  await arrived("waterColumn");
  await time(0.68);
  await chooseRelated(page);
  await settled();
  await time(0.89);
  await page.waitForFunction(()=>{const w=window.geoObservatory();return !w.flying&&w.rendered.nyos&&w.nyos.eventVisual.reliefAnalysis&&Math.abs(w.d-4.25)<.1;});
  await shot("E-Ausbreitung");
  report.routes.E = [cm, n, await geo()];
  await world("nyos-pipe");
  await time(0.7);
  await shot("F-Nyos-Rohr");
  await select("geo-preset", "seismic-pipeCut");
  await arrived("pipeCut");
  await time(0.74);
  await shot("F-Rohrschnitt");
  await related("profiles");
  await shot("F-CO2-Profile");
  await study("conductivity", true);
  await shot("F-Leitwert");
  report.routes.F = [
    "Tiefeneinlass",
    "Gas-Wasser-Gemisch",
    "Auslass",
    "Profile 1993 und 2006",
  ];
  await study("landCompare");
  await shot("G-Landschaften");
  report.globeOrigins=[];
  for(const [name,lat,lon] of [["Ulmen verorten",50.2106,6.9828],["Nyos verorten",6.43834,10.298663]]){
    await selectControl(page, "#geo-preset",{label:name});await settled();
    await page.waitForFunction(()=>window.geoObservatory().rendered.globe&&document.querySelector("#geo-crumb").textContent.includes("Verortung"));
    const center=await geo();assert.ok(Math.abs(center.lat-lat)<.05&&Math.abs(center.lon-lon)<.05&&center.globe);
    report.globeOrigins.push(center);await page.click("#geo-back");await arrived("landCompare");
  }
  await related("lakeCompare");
  await shot("G-Massstab");
  for (const i of ["0", "1", "2"]) {
    await compareLake(page, i);
    const value = await page.locator(".lake-evidence").innerText();
    if (i === "1")
      assert.match(
        value,
        /Für diese Darstellung liegen keine belastbaren Messdaten vor/,
      );
    if (i === "2") assert.match(value, /Belüftung/);
    (report.routes.G ??= []).push(value);
  }
  await study("waterColumn");
  await select("geo-info", "neutral");
  await time(0.7);
  await page.locator("#geo-crumb").waitFor({ state: "hidden" });
  await page.click("#geo-release");
  await page.locator('.seismic-pick[data-term="Gelöstes CO₂"]').click();
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".seismic-label")].some(
      (e) => !e.hidden && e.dataset.term === "Gelöstes CO₂",
    ),
  );
  await page.click("#geo-clear");
  await select("geo-info", "explain");
  await page.click("#geo-play");
  await page.waitForFunction(
    () => window.geoObservatory().observatory.study.playing,
  );
  await page.click("#geo-play");
  await time(0.63);
  const box = await page.locator("#earth").boundingBox();
  await page.mouse.move(box.x + box.width * 0.53, box.y + box.height * 0.46);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.58, box.y + box.height * 0.49, {
    steps: 12,
  });
  await page.mouse.up();
  await study("pipeCut");
  await page.click("#geo-back");
  await arrived("waterColumn");
  const saved = await page.evaluate(
    () => window.geoObservatory().observatory.study,
  );
  await page.click("#saved-views");
  await page.fill("#view-name", "UB G6.8 Wassersäule");
  await page.click("#view-save");
  await page.click("#view-close");
  await page.reload();
  await page.waitForFunction(() => window.geoObservatory?.().ready);
  await page.click("#saved-views");
  await selectControl(page, "#saved-list", { label: "UB G6.8 Wassersäule" });
  await page.click("#view-apply");
  await arrived("waterColumn");
  const restored = await page.evaluate(
    () => window.geoObservatory().observatory.study,
  );
  assert.equal(restored.playing, false);
  assert.ok(Math.abs(restored.time - saved.time) < 0.001);
  assert.ok(restored.eye.every((v, i) => Math.abs(v - saved.eye[i]) < 0.01));
  report.routes.H = { saved, restored };
  await select("geo-info", "explain");
  await study("forms");
  await time(0.75);
  await shot("Vulkanformen");
  for (const [w, h] of sizes) {
    await resize(w, h);
    for (const id of [
      "ulmen",
      "mixCompare",
      "waterColumn",
      "pipeCut",
      "profiles",
      "lakeCompare",
    ]) {
      await study(id);
      if (["mixCompare", "waterColumn", "pipeCut"].includes(id))
        await time(0.69);
      const pixels = await geometry(page),
        layout = await diagram();
      assert.deepEqual(layout.clipped, [], id + " " + w);
      assert.ok(layout.scroll <= 1);
      report.windows.push({ view: id, w, h, ...pixels, ...layout });
    }
    if (w === 740 || w === 1920) await shot("G-Fenster-" + w);
  }
  await resize(1366, 768);
  await switchPresentation(page);
  await page.waitForFunction(() => document.body.classList.contains("present"));
  report.presentation = await diagram();
  await geometry(page);
  await switchPresentation(page);
  await page.waitForFunction(
    () => !document.body.classList.contains("present"),
  );
  if (film) {
    const play = async (seconds) => {
      await time(0);
      await page.click("#geo-play");
      await page.waitForTimeout(seconds * 1000);
    };
    for (const [name, run] of [
      [
        "Maar-und-Landschaft",
        async () => {
          await study("ulmen");
          await page.waitForTimeout(1400);
          await related("lakeCut");
          await related("maar");
          await play(23);
          await study("contactDetail", true);
          await play(13);
        },
      ],
      [
        "Schichtung-und-Gas",
        async () => {
          await study("mixCompare");
          await play(17);
          await related("dissolved");
          await play(6);
          await study("waterColumn", true);
          await play(23);
          await chooseRelated(page);
          await settled();
          await play(15);
        },
      ],
      [
        "Entgasung-und-Vergleich",
        async () => {
          await world("nyos-pipe");
          await play(9);
          await select("geo-preset", "seismic-pipeCut");
          await arrived("pipeCut");
          await play(23);
          await related("profiles");
          await page.waitForTimeout(2200);
          await study("landCompare");
          await related("lakeCompare");
          await compareLake(page, "1");
          await page.waitForTimeout(2500);
        },
      ],
    ]) {
      const m = await screencast(page, out, "G68-" + name, run, {
        fixedFrame: true,
      });
      assert.ok(m.frames >= 35 && m.seconds >= 18);
      report.movies.push(m);
    }
  }
  assert.deepEqual(report.errors, []);
  page.off("pageerror", onerror);
  await writeFile(join(out, "G68.json"), JSON.stringify(report, null, 2));
}
