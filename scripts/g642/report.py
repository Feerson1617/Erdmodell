"""Build the offline gallery from accepted artifacts of this commit."""

import hashlib
import html
import json
import os
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

root = Path("test-results/Abnahme")
read = lambda p: json.loads(p.read_text())
mac = root / "Nativ/G642/App"
web = root / "HTML"
old = root / "Vergleich/G6.4.1"
new = root / "Vergleich/G6.4.2"
commit = os.environ["TEST_COMMIT"]
products = [read(d / "Produkt.json") for d in (mac, web)]
assert all(p["commit"] == commit and not p["network"] for p in products)
assert products[0]["platform"] == "darwin" and products[0]["arch"] == "arm64"
qa = read(web / "Bedienpruefung.json")
native = read(mac / "Bedienpruefung.json")
a, b = read(old / "Vergleich.json"), read(new / "Vergleich.json")
long = read(mac / "Dauerlauf.json")
assert b["historicalFavorite"] and len(b["flights"]) == len(a["flights"]) == 2
assert (
    qa["complete"]
    and native["complete"]
    and a["complete"]
    and b["complete"]
    and b["commit"] == commit
)
assert (
    len(qa["movies"]) == 6
    and len(qa["stages"]) == 9
    and len(qa["boards"]) == 4
    and long["minutes"] >= 15
)
assert min(s["usable"] for s in qa["boards"]) >= 0.85
navigation = [read(d / "Geographische-Abnahme.json") for d in (web, mac)]
assert a["commit"] == "81b4794fa7b1abcbe1d4b781904bcdb5281cb09a"
for result in navigation:
    assert result["complete"] and not result["errors"] and len(result["matrix"]) >= 14
    back = next(r for r in result["matrix"] if r["route"]=="Zurueck-Deutschland")
    assert back["rendered"]["globe"] and not back["rendered"]["nyos"]
    assert back["pixelvergleich"]["deutschland"] < back["pixelvergleich"]["nyos"]
    assert {(s["width"], s["height"]) for s in result["sizes"]} == {
        (740,530),(900,600),(1280,720),(1366,768),(1920,1080),(2560,1440)
    }
    assert all(not s["clipped"] and not s["covered"] for s in result["sizes"])
assert all(s["nativeWindow"]["content"] == [s["width"], s["height"]] for s in navigation[1]["sizes"])
assert (web / "G-Navigation-und-Rueckweg.mp4").is_file()
docs = root / "Dokumentation"
docs.mkdir(exist_ok=True)
for filename in [
    "g641-entwicklung.md",
    "g642-entwicklung.md",
    "curriculum-coverage.md",
    "roadmap.md",
    "g64-forschungsatlas.md",
    "g64-plattentektonik.md",
    "g51-quellen.md",
    "g5-quellen.md",
    "g6-quellen.md",
    "mac-installation.md",
]:
    (docs / filename).write_bytes((Path("docs") / filename).read_bytes())
report = [
    "# GeoRisiko G6.4.2 · Produktabnahme",
    "",
    f"Commit `{commit}`. G6.4.1-Vergleichsbasis `{a['commit']}`. Beide Einzeldateien liefen im selben Chromium {a['engine']}.",
    "",
    f"Installierte ARM64-App und Offline-HTML absolvierten die zusammenhängenden Abläufe A bis F. Der native Dauerlauf dauerte {long['minutes']:.2f} Minuten, mit {len(long['rows'])} Modellwechseln. Bei Start und Nutzung wurden keine externen HTTP-Anfragen beobachtet. Die Installationsdatei wurde nach Prüfung des DMG in ein eigenes Verzeichnis kopiert und nach Auswerfen des Volumens gestartet.",
    "",
    "## Steuerung der Unterrichtsansichten",
    "",
    "Gezählt wurden per Hit-Test erreichbare Buttons, Eingaben, Auswahlmenüs und Zusammenfassungen. Anker im Modell werden separat protokolliert. Die Flächenangabe zieht einen überlagernden Einstellbereich von der Canvasfläche ab.",
    "",
    "| Szene | G6.4.1 | G6.4.2 |",
    "|---|---:|---:|",
]
for name in a["scenes"]:
    report.append(
        f"| {name} | {len(a['scenes'][name]['controls'])} | {len(b['scenes'][name]['controls'])} |"
    )
report += [
    "",
    "## Erklärbetrieb auf vier Präsentationsflächen",
    "",
    "| Fenster | Nutzbare Modellfläche | Seite scrollbar |",
    "|---|---:|---:|",
]
for s in qa["boards"]:
    report.append(
        f"| {s['width']} × {s['height']} | {100*s['usable']:.1f} % | {s['scroll']} px |"
    )
report += [
    "",
    "## Zeit- und Ressourcenmessung",
    "",
    "Der direkte Vergleich nutzt 1.000 × 570 CSS-Pixel für beide Renderflächen und dasselbe Grafikprofil. Die Originalbilder im Vergleich verwenden die normale Oberfläche. Die JSON-Protokolle enthalten Bildintervalle, Framebuffer, Geometrien, Texturen und Szenenwechsel.",
    "",
    "| Produkt | Modelle | Zustand | neu gerenderte Bilder/s | P95 Bildintervall |",
    "|---|---:|---|---:|---:|",
]
for label, r in [("G6.4.1", a), ("G6.4.2", b)]:
    for s in r["samples"]:
        report.append(
            f"| {label} | {s['n']} | {'animiert' if s['animated'] else 'pausiert'} | {s['renderedFps']:.1f} | {s['p95']:.1f} ms |"
        )
report += [
    "",
    f"Im Vierfachvergleich bei 1.600 × 900 CSS-Pixeln wurden {a['largeCanvas']['renderedFps']:.1f} und {b['largeCanvas']['renderedFps']:.1f} neue Bilder/s gemessen. Die Protokolle weisen für beide Versionen die Ressourcen nach Verlassen der Szene aus.",
    "",
    "| Kamerafahrt | G6.4.1 | G6.4.2 |",
    "|---|---:|---:|",
]
for prev, cur in zip(a["flights"], b["flights"]):
    report.append(
        f"| PB2002 #{cur['id']} | {prev['elapsedMs']:.0f} ms | {cur['elapsedMs']:.0f} ms |"
    )
report += [
    "",
    "Eine im echten G6.4.1 gespeicherte Kollisionsansicht wurde im neuen Produkt mit derselben Modellzeit wieder geöffnet.",
    "",
    f"Start bis bereit im Direktvergleich {a['startMs']:.0f} ms und {b['startMs']:.0f} ms. Zeiten hängen vom virtuellen Runner und den Caches ab. Der Dauerlauf erfasst den nativen Prozessspeicher pro Prozessfamilie, Grafikressourcen und ruhende Phasen. Es gab keine physische Prüfung am Schul-Smartboard.",
    "",
    "## Fachliche Abnahme",
    "",
    "Die neun Wilson-Stichproben protokollieren die Orientierung der gerenderten Rand- und Rückenpfeile und den tatsächlich eingeblendeten Erklärungstext. Die Prozessbilder und Filme zeigen Modellzeit, Materialansicht, Anker und geografischen Rückweg. Datenherkunft, fachliche Grenzen und verbleibende Vereinfachungen sind im Entwicklungsbericht erläutert.",
    "",
    "Die JSON-Dateien dokumentieren die ausgeführten Prüfschritte und die sichtbaren Steuerelemente pro Vergleichsszene. Modell und Sichtprüfung werden getrennt ausgeliefert.",
]
report += ["", "## Geographische Integrität", "",
           "Bei jeder bestätigten Ankunft wurden Szene, Kamera und Originalbild kontrolliert. Für Deutschland wurde zusätzlich ein rasterbasierter Bildvergleich mit dem Zielbild und der zuvor gerenderten Nyos-Landschaft ausgewertet.", "",
           "| Ausgangsraum | Angefordertes Ziel | Gerenderter Raum | Kamerafokus in Grad |", "|---|---|---|---|"]
for row in navigation[0]["matrix"]:
    report.append(f"| {row['from']} | {row['requested']} | {row['path']} | {row['pose'][0]:.2f}, {row['pose'][1]:.2f} |")
report += ["", "## Modellgröße und kleine Fenster", "",
           "Die Stichprobe misst den vom Hintergrund abweichenden Anteil im sichtbaren Prozessbild einschließlich seiner Beschriftungen. Sie ergänzt die Messung der verfügbaren Canvasfläche.", "",
           "Breite und Höhe wurden am Renderer kontrolliert, in der installierten App zusätzlich am nativen Fenster. Für die große Präsentationsfläche durfte das Testfenster über den virtuellen Bildschirm hinausreichen. Der anschließende Dauerlauf nutzte 1366 × 768 Pixel.", "",
           "| Produkt | Fenster | Modellfläche | Vordergrundanteil im Bild | sichtbare Fachbegriffe |", "|---|---|---:|---:|---:|"]
for product, measurements in zip(["Offline-HTML", "Native App"], navigation):
  for item in measurements["sizes"]:
    report.append(f"| {product} | {item['width']} × {item['height']} | {100*item['modelArea']:.1f} % | {100*item['foreground']:.1f} % | {item['cards']} |")
report += ["", "## Aktualisierung der Beschriftung", "", "Beobachtete DOM-Mutationen am Modell in dreisekündigen Messfenstern, einschließlich Positions- und Sichtbarkeitsänderungen.", "", "| Version | Modelle | animiert | Änderungen |", "|---|---:|---|---:|"]
for label, run in [("G6.4.1", a), ("G6.4.2", b)]:
    for item in run["samples"]:
        report.append(f"| {label} | {item['n']} | {item['animated']} | {item['labelUpdates']} |")
(root / "Abnahmebericht.md").write_text("\n".join(report) + "\n")
parts = [
    '<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>GeoRisiko G6.4.2 · Sichtprüfung</title><style>body{max-width:1280px;margin:auto;padding:2rem;background:#17241f;color:#eef4eb;font:16px/1.45 system-ui}a{color:#c5eaa4}img,video{max-width:100%;height:auto;border-radius:6px}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem}figure{margin:0}pre{white-space:pre-wrap}details{margin:1em 0}</style><h1>GeoRisiko G6.4.2 · Sichtprüfung</h1><p><a href="Abnahmebericht.md">Prüfbericht</a> · <a href="Dokumentation/g642-entwicklung.md">Quellen und Modellgrenzen</a> · <a href="Dokumentation/curriculum-coverage.md">Curriculare Abdeckung</a></p><details><summary>Prüfbericht lesen</summary><pre>'
    + html.escape("\n".join(report))
    + "</pre></details><h2>G6.4.1 und G6.4.2</h2>"
]


def picture(p, title):
    path = p.relative_to(root).as_posix()
    return f'<figure><a href="{path}"><img loading="lazy" src="{path}" alt="{html.escape(title)}"></a><figcaption>{html.escape(title)}</figcaption></figure>'


for k in a["scenes"]:
    parts += [
        "<h3>" + html.escape(k) + "</h3><section>",
        picture(old / (k + ".jpg"), "G6.4.1"),
        picture(new / (k + ".jpg"), "G6.4.2"),
        "</section>",
    ]
parts.append("<h2>Zusammenhängende Bedienabläufe</h2>")
for movie in sorted(web.glob("*.mp4")):
    parts.append(
        f'<h3>{movie.stem}</h3><video controls preload="none" src="HTML/{movie.name}"></video>'
    )
parts.append("<h2>Einzelbilder und Smartboardansichten</h2><section>")
parts.extend(picture(p, p.stem) for p in sorted(web.glob("*.jpg")))
parts.append("</section><h2>Protokolle</h2><ul>")
for p in sorted(root.rglob("*")):
    if p.suffix in {".json", ".log", ".md"}:
        parts.append(
            f'<li><a href="{p.relative_to(root).as_posix()}">{p.relative_to(root).as_posix()}</a></li>'
        )
(root / "Sichtpruefung.html").write_text("\n".join(parts) + "</ul></html>")
files = sorted(p for p in root.rglob("*") if p.is_file() and p != root / "SHA256.txt")
(root / "SHA256.txt").write_text(
    "".join(
        f"{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.relative_to(root).as_posix()}\n"
        for p in files
    )
)
dest = Path("artifacts/GeoRisiko-G6.4.2-Sichtpruefung.zip")
dest.parent.mkdir(exist_ok=True)
with ZipFile(dest, "w", compression=ZIP_DEFLATED, compresslevel=5) as z:
    for p in files + [root / "SHA256.txt"]:
        z.write(p, p.relative_to(root))
with ZipFile(dest) as z:
    assert z.testzip() is None
print(dest, len(files) + 1, "Dateien")
