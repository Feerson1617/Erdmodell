"""Package original product evidence after separate desktop and file:// acceptance."""
from pathlib import Path
import hashlib
import html
import json
import os
import shutil
import statistics
from zipfile import ZIP_DEFLATED, ZipFile

root = Path("test-results/Abnahme")
web, native = root/"HTML", root/"Nativ/G65/App"
commit = os.environ["TEST_COMMIT"]
sizes = {(740,530),(900,600),(1280,720),(1366,768),(1920,1080),(2560,1440)}
models = {"ulmen","mixCompare","waterColumn","pipeCut","profiles","lakeCompare"}

def read(path):
    return json.loads(path.read_text())

def relative(path):
    return path.relative_to(root).as_posix()

def checksum(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def image(path):
    url = html.escape(relative(path), quote=True)
    return f'<figure><a href="{url}"><img loading="lazy" alt="{html.escape(path.stem)}" src="{url}"></a><figcaption>{html.escape(path.stem)}</figcaption></figure>'

docs = root/"Dokumentation"
docs.mkdir(exist_ok=True)
for name in ["g68-fachpruefung.md","g68-datengrundlage.md","g68-lehrkraft.md","ulmener-maar-nyos.md","vulkanismus.md","curriculum-coverage.md","mac-installation.md","g651-korrektur.md"]:
    shutil.copyfile(Path("docs")/name,docs/name)
shutil.copytree("public/licenses",root/"public/licenses",dirs_exist_ok=True)
shutil.copyfile("src/seismology/nyos-profiles.json",docs/"Nyos-Tabellenwerte.json")
for name in ["umfeld.py","nyos-ausschnitt.py"]:
    shutil.copyfile(Path("scripts/g68")/name,docs/name)
lines=["# GeoRisiko G6.8 · Produktabnahme","",f"Geprüfter Commit `{commit}`. Ausgangsstand G6.7 `63648c1ece2a28ee4e236436ef2e00df23cdc4c0`.","","## Unterrichtsabläufe in beiden Produkten","",
"A führt von der Erde bis zum Ulmener Maar. B zeigt Kontakt, Auswurf und Kraterentwicklung. C vergleicht die Wasserbewegung. D trennt gelöstes Gas, freie Blasen und das untersättigte Gegenbeispiel. E führt aus Ulmen zum historischen Nyos-Ereignis. F verbindet Rohrschnitt und Profile. G wechselt von Landschaften zum gleichen Profilmaßstab. H prüft Einzelfreigabe, Kamera, Rückkehr und Favoriten. I umfasst die bestehende geographische, seismologische und allgemeine Modellabnahme.",""]
for folder in [web,native]:
    meta,p=read(folder/"Produkt.json"),read(folder/"G68.json")
    assert meta["commit"]==commit and not meta["network"] and not p["errors"] and set(p["routes"])==set("ABCDEFGH")
    assert len(p["windows"])==36 and {(r["w"],r["h"]) for r in p["windows"]}==sizes
    assert {r["view"] for r in p["windows"]}==models
    assert all(r["foreground"]>.008 and not r["clipped"] and r["scroll"]<=1 for r in p["windows"])
    for source in ["Seismische-Integritaet","Seismologie","Geographische-Abnahme","Bedienpruefung"]:
        result=read(folder/(source+".json"))
        assert result["complete"] and not result["errors"]
    assert not read(folder/"G67.json")["errors"]
    assert read(folder/"Neustart.json")["mask"]["foreground"]>.008
    rows=p["windows"]
    fonts=[font["px"] for row in rows for font in row["fonts"]]
    areas=[r["canvasArea"] for r in rows]
    lines+= [f"### {meta['product']} auf {meta['platform']} ({meta['arch']})","",
             f"Start bis zum ersten betriebsbereiten Modell {meta['startMs']/1000:.2f} s. {len(p['frames'])} zusätzliche Originalzustände mit sichtbarer WebGL-Geometrie. {len(rows)} Fenster-/Modellkombinationen. Neustart des vollständigen Prozesses und Wiederherstellung der gespeicherten Kamera, Modellzeit und Pause geprüft.","",
             f"Gemessene Schriftgrößen im Fenster {min(fonts):.1f}–{max(fonts):.1f} CSS-Pixel. Zeichenfläche {min(areas):.1%}–{max(areas):.1%} des Fensters, im geprüften Präsentationszustand {p['presentation']['canvasArea']:.1%}. Die Zeichenfläche schließt Hintergrund und schwebende Beschriftungen ein. Die Tabelle nennt den Anteil heller Geometriepixel ohne HTML sowie die horizontale Ausdehnung der mittleren 98 % dieser Pixel. Beide Größen hängen von Material, Szene und Perspektive ab.","",
             "| Ansicht | Helle Geometrie (alle Größen) | Horizontale Ausdehnung |","|---|---:|---:|"]
    for model in sorted(models):
        entries=[r for r in rows if r["view"]==model]
        widths=[(r["central98"]["x"][1]-r["central98"]["x"][0])/r["width"] for r in entries]
        masks=[r["foreground"] for r in entries]
        lines.append(f"| {model} | {min(masks):.1%}–{max(masks):.1%} | {min(widths):.1%}–{max(widths):.1%} |")
    lines.append("")
assert meta["platform"]=="darwin" and meta["arch"]=="arm64"
science=read(native/"G68-Fachpruefung.json")
assert science["shoreError"]<.0001 and science["deepestUpper"]<.49<science["shallowestDeep"]
long=read(native/"Dauerlauf.json")
assert long["minutes"]>=45 and all(min(r[k]["foreground"] for k in ("visible","animatedVisible"))>.008 for r in long["rows"])
rss=[sum(p["workingKiB"] for p in r["rss"])/1024 for r in long["rows"]]
fps=[r["animatedFps"] for r in long["rows"]]
lines+=["## Virtueller Apple-Silicon-Dauerlauf","",f"{long['minutes']:.2f} Minuten, {len(rss)} Abschnitte, {min(fps):.1f}–{max(fps):.1f} tatsächlich gerenderte Bilder/s während der Animation, Median {statistics.median(fps):.1f}. Summierte Prozess-Working-Sets {min(rss):.0f}–{max(rss):.0f} MiB. Gemeinsam genutzte Seiten können mehrfach gezählt werden. Dauerlauf.json enthält Einzelmessungen bei laufender und pausierter Szene einschließlich Texturen, Geometrien und Programmen.","","## G6.7 und G6.8 unter gleichen Bedingungen","","Beide Einzel-HTML liefen im selben Chromium bei 1366 × 768 und gleicher Geräteskalierung. Für Detailvergrößerungen ist in G6.7 die zugehörige Ausgangsszene angegeben. Das P95 beschreibt die Intervalle des Browser-Bildtakts. Bei ruhenden Modellen zeichnet der Renderer nach Bedarf.","","| Version | Ansicht | Gerenderte Bilder/s | P95 | Modellwechsel | JS-Heap |","|---|---|---:|---:|---:|---:|"]
for version in ["G6.7","G6.8"]:
    compare=read(root/"Vergleich"/version/"Messung.json")
    assert len(compare["samples"])==10
    if version=="G6.8":assert compare["favoriteMigrated"] and compare["commit"]==commit
    for r in compare["samples"]:
        lines.append(f"| {version} | {r['name']} ({r['id']}) | {r['renderedFps']:.1f} | {r['p95']:.1f} ms | {r['changeMs']:.0f} ms | {r['heap']/1048576:.1f} MiB |")
lines+=["","## Abschlussentscheidung","","| Qualitätsziel | Urteil | Grundlage und Grenze |","|---|---|---|","| Fachwissenschaftliche Richtigkeit | Erfüllt | Trennung von Modell, räumlicher Beobachtung und historischem Messdatum. |","| Wissenschaftliche Datenqualität | Teilweise erfüllt | Historische Nyos-Profile und datierte Ulmener Protokolle verfügbar. Für Ulmen fehlen vergleichbare CO₂-Tiefenreihen im Material. |","| Grafische Qualität | Erfüllt | Originalaufnahmen dokumentieren Relief, Porenraum, Ablagerung, gemeinsame Achsen und lesbare Analysefarben. |","| Anschaulichkeit | Erfüllt | Die Rückkopplung, das Gegenbeispiel und die zwei Zirkulationstypen lassen sich anhalten und vergleichen. |","| Räumliche Orientierung | Erfüllt | Geländereferenzen, Kamerakoordinaten, faire Profilmaßstäbe und Rücknavigation überprüft. |","| Benutzerfreundlichkeit | Erfüllt | Kurze, freie Modellwege, direkte Favoriten und getrennte Lehrerübersicht praktisch durchlaufen. |","| Ergebnisoffenheit | Erfüllt | Lokale Datenlücken explizit. Beobachtung und gezielte Begriffsfreigabe getrennt. |","| Technische Stabilität | Erfüllt | Virtueller ARM64-Mac und Offline-HTML mit installierten Produkten, Regressionen und Dauerlauf. |","| Unterrichtspraktische Nutzbarkeit | Teilweise erfüllt | Demonstrationswege und Fenster erprobt. Physische Projektion, Sitzabstand und Einsatz mit der Lerngruppe bleiben offen. |","","**In der verfügbaren Umgebung nicht überprüfbar:** Thermik und Akkubetrieb des lüfterlosen MacBook Air M1 von 2020, Touchbedienung und Lesbarkeit auf dem Schul-Smartboard. Die App ist ad hoc signiert. Die Gatekeeper-Bewertung der quarantänisierten Testkopie steht im Installationsprotokoll.","","Fachprüfung, einzelner Datenbezug, Korrekturliste, Lehrkraftübersicht und curriculare Zuordnung stehen im Ordner Dokumentation.",""]
films=read(web/"G68.json")["movies"]
assert len(films)==3 and all(f["frames"]>=35 and f["seconds"]>=18 for f in films)
for f in films:
    assert (web/(f["name"]+".mp4")).is_file()
    lines.append(f"- {f['name']} · {f['seconds']:.1f} Sekunden, {f['frames']} Originalbilder")
(root/"Abnahmebericht.md").write_text("\n".join(lines)+"\n")
gallery=['<!doctype html><html lang="de"><meta charset="utf-8"><title>GeoRisiko G6.8 · Sichtprüfung</title><meta name="viewport" content="width=device-width"><style>body{max-width:1280px;margin:auto;padding:2rem 1rem;font:16px/1.55 system-ui;background:#15272b;color:#f2f0e3}a{color:#a6ded8}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(310px,100%),1fr));gap:1em}img,video{width:100%;height:auto}figure{margin:0}pre{white-space:pre-wrap}</style><h1>GeoRisiko G6.8 · Sichtprüfung</h1><p><a href="Dokumentation/g68-lehrkraft.md">Bedienübersicht</a> · <a href="Dokumentation/g68-datengrundlage.md">Ulmen und Nyos</a> · <a href="Dokumentation/g68-fachpruefung.md">Korrekturen und Modellgrenzen</a> · <a href="Abnahmebericht.md">Prüfbericht</a></p><details><summary>Abnahmebericht lesen</summary><pre>'+html.escape("\n".join(lines))+'</pre></details>']
for f in films:
    gallery.append(f'<h2>{f["name"]}</h2><video controls preload="metadata" src="{relative(web/(f["name"]+".mp4"))}"></video>')
selected=set()
for p in sorted((root/"Vergleich/G6.7").glob("*.jpg")):
    after=root/"Vergleich/G6.8"/p.name
    assert after.is_file()
    selected.update([p,after])
    gallery.extend([f"<h2>{p.stem} · G6.7 und G6.8</h2><section>",image(p),image(after),"</section>"])
for label,folder in [("Offline-HTML",web),("Installierte ARM64-App",native)]:
    picks=sorted(folder.glob("G68-*.jpg"));selected.update(picks)
    gallery+=["<h2>"+label+"</h2><section>",*[image(p) for p in picks],"</section>"]
files=sorted(p for p in root.rglob("*") if p.is_file() and (p.suffix!=".jpg" or p in selected) and p.name!="Sichtpruefung.html" and p!=root/"SHA256.txt")
gallery+=["<h2>Protokolle und Quellen</h2><ul>",*[f'<li><a href="{html.escape(relative(p),quote=True)}">{html.escape(relative(p))}</a></li>' for p in files if p.suffix in {".md",".json",".log",".txt",".py",".pdf"}],"</ul></html>"]
index=root/"Sichtpruefung.html";index.write_text("\n".join(gallery));files.append(index)
manifest=root/"SHA256.txt";manifest.write_text("".join(f"{checksum(p)}  {relative(p)}\n" for p in sorted(files)))
out=Path("artifacts/GeoRisiko-G6.8-Sichtpruefung.zip");out.parent.mkdir(exist_ok=True)
with ZipFile(out,"w",ZIP_DEFLATED,compresslevel=5) as archive:
    for p in [*files,manifest]:archive.write(p,relative(p))
with ZipFile(out) as archive:assert archive.testzip() is None
