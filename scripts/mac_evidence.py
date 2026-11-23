"""Produce a self-contained record only after both products rendered successfully."""
import json
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from hashlib import sha256

root = Path(__file__).resolve().parents[1]
out = root / "test-results/mac"
r = json.loads((out/"Pruefung.json").read_text())
assert r["arch"] == "arm64" and r["electron"]["packaged"] and r["windowReopened"]
native, web = r["runs"]
assert len(native["pairs"]) == 52 and len({p["step"] for p in native["pairs"]}) == 48
assert len(native['scenes']) == len(web['scenes']) == 11
assert not any(run["errors"] or run["network"] for run in r["runs"])
assert "LaunchServices-Start" in (out/"installation.log").read_text()
url = "https://github.com/Feerson1617/Erdmodell/actions/runs/" + str(r.get("run",""))
brief = ["# GeoRisiko für Mac · Abnahme", "", f"Commit `{r['commit']}`. [Mac-Build und Downloads]({url})", "",
"1. Die installierte GeoRisiko.app startete über LaunchServices und erneut für die automatisierte Bedienprüfung.",
"2. Alle geprüften Szenen nutzten lokale Daten. Beide Ausgaben absolvierten ihre Prüfsequenz bei blockierten externen Webanfragen.",
"3. Die App lädt den gemeinsamen Three.js-/Vite-Build aus app.asar. Die Einzeldatei bettet denselben Produktionsstand ein.",
"4. lipo bestätigte ARM64 am Hauptprogramm beider Bundles. codesign prüfte die verschachtelten Signaturen.",
"5. Der LaunchServices-Start öffnete das Programm wie beim Finder-Start. Alle Laufzeitbestandteile befinden sich im Bundle.",
"6. electron-builder erzeugte DMG und App-ZIP. hdiutil verifizierte das Image.",
"7. Das DMG wurde schreibgeschützt gemountet, die App in einen leeren Testordner außerhalb des Volumes kopiert und das Volume ausgeworfen. Die Kopie startete und wurde regulär beendet. Der nächste Start dieser Kopie lieferte die 3D-Nachweise.",
"8. Ad-hoc-Signatur, Renderer-Sandbox, Kontextisolation, webSecurity, deaktivierte Node-Integration, CSP und lokaler Ressourcen-Katalog sind eingerichtet. Für die private Fassung kann Gatekeeper eine Einzelbestätigung verlangen.",
"9. Beide Ausgaben zeigten die regionalen Prozesse, Schalen und Nyos. In der installierten App wurden zusätzlich alle 52 Plattenflächen ausgewählt und die zugeordneten 48 unterschiedlichen Grenzvergleiche tatsächlich abgespielt und zurückgesetzt.",
"10. Die HTML startete unter file:// in Chrome auf demselben Mac. Eine eigene Linux-Browserregression führt die fachlichen und visuellen Bestandstests aus.",
"11. Die folgenden Tabellen vergleichen die Bildzeiten, Prozesslast und die tatsächlich benutzten Puffer. Angaben zur Auflösung stehen bei jedem Szenenpaar.",
f"12. Der macOS-Runner meldete {r['hardware']['cpu']}, {r['hardware']['cores']} logische Kerne und macOS {r['hardware']['macOS']} ({r['arch']}). Die GPU-Angaben sind Rendererkennungen des virtuellen Systems.",
"13. Ein Messlauf auf dem persönlichen MacBook Air 2020 mit externem Smartboard steht aus. Die integrierte Geräteprüfung kann dort zehn Sekunden einer frei gewählten Szene als JSON erfassen.",
"14. Die aktiven Workflows liefern die Mac-Produkte und den HTML-Test aus. Die frühere SCORM-Auslieferung ist archiviert.",
"15. Regionale DEM-Kacheln, PBR, Normal- und Roughness-Maps, Instancing, LOD, Schatten und shaderbasierte Wellen können im bestehenden Renderer entwickelt werden. Konkrete Ansatzpunkte stehen im Architekturdokument.",
"16. Die App ist privat ad hoc signiert und nicht notarisiert. Cloud-GPU, Display-Skalierung und Geteiltspeicher begrenzen die Übertragbarkeit der Messungen. Mehrjährige geologische Rekonstruktionen und G4.4 gehören zu späteren Phasen.",
"17. Der verlinkte Mac-Lauf stellt GeoRisiko-macOS-arm64.dmg, GeoRisiko-macOS-arm64-app.zip, GeoRisiko-Web-Test.html und GeoRisiko-Mac-Abnahme.zip einzeln bereit.","",
"## Leistung", "",
f"Electron {r['electron']['version']} mit Chromium {r['electron']['chrome']}. Browserfassung in Chrome {r['chrome']}. CSS-Fenster und Pixeldichte: {native['viewport']} / {web['viewport']}.",
f"Das native Testfenster hatte {r['windowContent']['width']}×{r['windowContent']['height']} CSS-Pixel. Für den gemeinsamen 1920×1080-Test wurde "+("der Render-Viewport über das Testprotokoll eingestellt." if r['viewportOverride'] else "die tatsächliche Fenstergröße verwendet."),
"", "| Szene und Produkt | Bild/s | Median / P95 / Maximum (ms) | CPU %¹ | RSS MiB Start → Ende | Renderpuffer (px) | Geometrien / Texturen / Programme / Draw Calls² |",
"|---|---:|---|---:|---|---|---|"]
for a,b in zip(native["scenes"],web["scenes"]):
    assert a["scene"]==b["scene"]
    for label,s in [("App",a),("HTML",b)]:
        end=s["states"][-1]
        sizes=sorted({(x["resolution"]["width"],x["resolution"]["height"]) for x in s["states"]})
        buffers=", ".join(f"{w}×{h}" for w,h in sizes)
        resources=" / ".join(str(end[k]) for k in ["geometries","textures","programs","draws"])
        brief.append(f"| {s['scene']} · {label} | {s['fps']:.1f} | {s['median']:.1f} / {s['p95']:.1f} / {s['max']:.1f} | {s['cpuPercent']:.0f} | {s['rssBeforeMiB']:.0f} → {s['rssAfterMiB']:.0f} | {buffers} | {resources} |")
brief.extend(["","¹ Summe der CPU-Zeit des Prozessbaums je verstrichener Sekunde; 100 % entspricht einem logischen Kern. RSS summiert Prozessanzeigen einschließlich gemeinsam genutzter Seiten.",
"² Letzte Stichprobe der Szene. Alle Zwischenwerte, fünf Wechselzyklen, Pixelverhältnisse und Bildabstände stehen in Pruefung.json. Bei verschiedenen Renderpuffern erlauben die FPS keine direkte Aussage über den Aufwand desselben Bildes.",
"",f"WebGL-Renderer: App {native['gpu']}; HTML {web['gpu']}.",""])
(out/"Abnahmebericht.md").write_text("\n".join(brief))
files={p.name:p for p in out.iterdir() if p.is_file() and p.suffix in (".png",".mp4",".log",".json",".md") and p.name!="executable-path.txt"}
files["SHA256.txt"]=out/"SHA256.txt"
for filename in ("mac-architektur.md","mac-installation.md","plattenatlas-g4.3.1.md"):
    files[filename]=root/"docs"/filename
files["Bauanleitung.md"]=root/"README.md"
assert len([n for n in files if n.endswith(".png")])>=20 and files["Bedienfilm.mp4"].stat().st_size>10000
dest=root/"artifacts/GeoRisiko-Mac-Abnahme.zip"
with ZipFile(dest,"w",ZIP_DEFLATED) as z:
    for name,path in sorted(files.items()):z.write(path,name)
with ZipFile(dest) as z:
    assert z.testzip() is None
print(dest.name,sha256(dest.read_bytes()).hexdigest())
