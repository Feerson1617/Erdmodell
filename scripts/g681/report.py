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
models = {"waterColumn","unsaturated","towns","wittlich","inventory"}

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
for name in ["g681-korrekturen.md","g681-geraetecheck.md","g68-fachpruefung.md","g68-datengrundlage.md","g68-lehrkraft.md","ulmener-maar-nyos.md","vulkanismus.md","curriculum-coverage.md","mac-installation.md","g651-korrektur.md"]:
    shutil.copyfile(Path("docs")/name,docs/name)
shutil.copytree("public/licenses",root/"public/licenses",dirs_exist_ok=True)
shutil.copyfile("src/seismology/nyos-profiles.json",docs/"Nyos-Tabellenwerte.json")
shutil.copyfile("src/seismology/nyos-inventory.json",docs/"Nyos-CO2-Gesamtvorrat-Tabelle-4.json")
shutil.copyfile("scripts/g681/region.py",docs/"region.py")
lines=[
    "# GeoRisiko G6.8.1 · Produktabnahme", "",
    f"Geprüfter Commit `{commit}`. Ausgangsstand G6.8 `02700cdbc363195b8c5b798c6f0b4ce97c3cab2c`.", "",
    "## Unterrichtsabläufe in beiden Produkten", "",
    "A verfolgt die limnische Rückkopplung bis zum Tal und prüft die Erklärung zur Atmung. B vergleicht die Ausgangsfärbung und die Bewegung bei gleicher Modellzeit. C führt über Europa, Deutschland und die Vulkaneifel zu Ulmen und Wittlich. D verknüpft den Rohrschnitt, Tiefenprofile und die historische Schätzung des Gesamtvorrats. E prüft Begriffsfreigabe, Pause, Zeitsprung, Kamera und Favoriten inklusive Neustart. F umfasst die bestehende geographische, seismologische und allgemeine Produktabnahme.", "",
]
for folder in [web,native]:
    meta,p=read(folder/"Produkt.json"),read(folder/"G681.json")
    assert meta["commit"]==commit and not meta["network"] and not p["errors"] and set(p["routes"])==set("ABCDE")
    comparison=p["routes"]["B"]
    assert comparison["matchedCamera"] and comparison["matchedPhase"]
    assert comparison["rich"]["violet"] > comparison["weak"]["violet"]+.018
    assert len(p["routes"]["C"])==4
    assert len(p["windows"])==30 and {(r["w"],r["h"]) for r in p["windows"]}==sizes
    assert {r["view"] for r in p["windows"]}==models
    assert all(r["model"]["foreground"]>.008 and not r["clipped"] and r["scroll"]<=1 for r in p["windows"])
    for source in ["Seismische-Integritaet","Seismologie","Geographische-Abnahme","Bedienpruefung"]:
        result=read(folder/(source+".json"))
        assert result["complete"] and not result["errors"]
    baseline=read(folder/"G68.json")
    assert not baseline["errors"] and set(baseline["routes"])==set("ABCDEFGH") and len(baseline["windows"])==36
    assert not read(folder/"G67.json")["errors"]
    assert read(folder/"Neustart.json")["mask"]["foreground"]>.008
    rows=p["windows"]
    fonts=[font for row in rows for font in row["fonts"]]
    areas=[r["area"] for r in rows]
    lines+= [f"### {meta['product']} auf {meta['platform']} ({meta['arch']})","",
             f"Start bis zum betriebsbereiten Modell {meta['startMs']/1000:.2f} s. {len(p['frames'])} Korrekturansichten mit sichtbarer Geometrie, {len(rows)} neue Fenster-/Modellkombinationen und {len(baseline['windows'])} Bestandskombinationen. Ein vollständiger Neustart hat den Favoriten wiederhergestellt.","",
             f"Gemessene Schriftgrößen der Modellbeschriftungen und Legenden {min(fonts):.1f}–{max(fonts):.1f} CSS-Pixel. Zeichenfläche {min(areas):.1%}–{max(areas):.1%}, im geprüften Vollbild {p['presentation']:.1%}. Die Zeichenfläche umfasst Modell, Hintergrund und überlagerte Beschriftungen.","",
             "| Ansicht | Helle Geometriepixel | Horizontale Ausdehnung der mittleren 98 % dieser Pixel |","|---|---:|---:|"]
    for model in sorted(models):
        entries=[r["model"] for r in rows if r["view"]==model]
        widths=[(r["central98"]["x"][1]-r["central98"]["x"][0])/r["width"] for r in entries]
        masks=[r["foreground"] for r in entries]
        lines.append(f"| {model} | {min(masks):.1%}–{max(masks):.1%} | {min(widths):.1%}–{max(widths):.1%} |")
    lines.append("")
assert meta["platform"]=="darwin" and meta["arch"]=="arm64"
science=read(native/"G681-Fachpruefung.json")
assert 25<science["distanceKm"]<26 and len(science["inventory"])==11
lines+=["## Quellenabgleich","",f"Analytisch bestätigte Großkreisentfernung {science['distanceKm']:.2f} km. Übernommen sind elf publizierte Gesamtinventar-Schätzungen nach Kusakabe et al. 2008, Tabelle 4, einschließlich der Unsicherheiten. Beim gasreichen Fall steigt der Anteil violetter Pixel in derselben Bildregion gegenüber dem untersättigten Start deutlich. Die protokollierten Farbmesswerte sind Darstellungsmaße.",""]
long=read(native/"Dauerlauf.json")
assert long["minutes"]>=45 and all(min(r[k]["foreground"] for k in ("visible","animatedVisible"))>.008 for r in long["rows"])
rss=[sum(p["workingKiB"] for p in r["rss"])/1024 for r in long["rows"]]
fps=[r["animatedFps"] for r in long["rows"]]
lines+=["## Virtueller Apple-Silicon-Dauerlauf","",f"{long['minutes']:.2f} Minuten, {len(rss)} Abschnitte, {min(fps):.1f}–{max(fps):.1f} tatsächlich gerenderte Bilder/s während der Animation, Median {statistics.median(fps):.1f}. Summierte Prozess-Working-Sets {min(rss):.0f}–{max(rss):.0f} MiB. Gemeinsam genutzte Seiten können mehrfach gezählt werden. Dauerlauf.json enthält Einzelmessungen bei laufender und pausierter Szene einschließlich Texturen, Geometrien und Programmen.","","## G6.8 und G6.8.1 unter gleichen Bedingungen","","Beide Einzel-HTML liefen im selben Chromium bei 1366 × 768 und gleicher Geräteskalierung. Regionalansicht und Inventar werden mit der bisherigen Eifel- und der Profilansicht verglichen. Die Wassersäulen, das Rohr und das Maar laufen bei denselben Phasen. Das P95 beschreibt die Intervalle des Browser-Bildtakts. Bei ruhenden Modellen zeichnet der Renderer nach Bedarf.","","| Version | Ansicht | Gerenderte Bilder/s | P95 | Modellwechsel | JS-Heap |","|---|---|---:|---:|---:|---:|"]
for version in ["G6.8","G6.8.1"]:
    compare=read(root/"Vergleich"/version/"Messung.json")
    assert len(compare["samples"])==8 and len(compare["resources"])==3
    if version=="G6.8.1":assert compare["favoriteMigrated"] and compare["commit"]==commit
    for r in compare["samples"]:
        lines.append(f"| {version} | {r['name']} ({r['id']}) | {r['renderedFps']:.1f} | {r['p95']:.1f} ms | {r['changeMs']:.0f} ms | {r['heap']/1048576:.1f} MiB |")
    stats=compare["resources"]
    before,after=stats["before"],stats["afterRepeats"]
    lines.append(f"| {version} | Start {compare['startMs']/1000:.2f} s. Wiederholte Wechsel, Texturen {before['textures']} → {after['textures']}, Geometrien {before['geometries']} → {after['geometries']}. | | | | |")
lines+=["","## Abschlussurteil","","Der Release Candidate erfüllt die geprüften fachlichen, geographischen und technischen Anforderungen der Korrekturrunde. Die Standortansichten bieten Ortsbezug, Luftlinie und Relief. Die Modelle lassen die Beurteilung durch die Lerngruppe offen.","","Die Geräteabnahme am physischen MacBook Air M1 und am Schul-Smartboard steht aus. Virtuelle Messungen belegen weder thermisches Verhalten noch Touchreaktion oder Lesbarkeit aus einem konkreten Sitzabstand. Die App ist ad hoc signiert. Die Bewertung der Quarantänekopie steht im Installationsprotokoll.","","## Originalfilme",""]
films=read(web/"G681.json")["movies"]
assert len(films)==2 and all(f["frames"]>=35 and f["seconds"]>=18 for f in films)
for f in films:
    assert (web/(f["name"]+".mp4")).is_file()
    lines.append(f"- {f['name']} · {f['seconds']:.1f} Sekunden, {f['frames']} Originalbilder")
(root/"Abnahmebericht.md").write_text("\n".join(lines)+"\n")
gallery=['<!doctype html><html lang="de"><meta charset="utf-8"><title>GeoRisiko G6.8.1 · Sichtprüfung</title><meta name="viewport" content="width=device-width"><style>body{max-width:1280px;margin:auto;padding:2rem 1rem;font:16px/1.55 system-ui;background:#15272b;color:#f2f0e3}a{color:#a6ded8}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(310px,100%),1fr));gap:1em}img,video{width:100%;height:auto}figure{margin:0}pre{white-space:pre-wrap}</style><h1>GeoRisiko G6.8.1 · Sichtprüfung</h1><p><a href="Dokumentation/g68-lehrkraft.md">Bedienübersicht</a> · <a href="Dokumentation/g68-datengrundlage.md">Ulmen und Nyos</a> · <a href="Dokumentation/g681-korrekturen.md">Korrekturen und Modellgrenzen</a> · <a href="Dokumentation/g681-geraetecheck.md">Gerätecheck</a> · <a href="Abnahmebericht.md">Prüfbericht</a></p><details><summary>Abnahmebericht lesen</summary><pre>'+html.escape("\n".join(lines))+'</pre></details>']
for f in films:
    gallery.append(f'<h2>{f["name"]}</h2><video controls preload="metadata" src="{relative(web/(f["name"]+".mp4"))}"></video>')
selected=set()
for p in sorted((root/"Vergleich/G6.8").glob("*.jpg")):
    after=root/"Vergleich/G6.8.1"/p.name
    assert after.is_file()
    selected.update([p,after])
    gallery.extend([f"<h2>{p.stem} · G6.8 und G6.8.1</h2><section>",image(p),image(after),"</section>"])
for label,folder in [("Offline-HTML",web),("Installierte ARM64-App",native)]:
    picks=sorted(folder.glob("G681-*.jpg"));selected.update(picks)
    gallery+=["<h2>"+label+"</h2><section>",*[image(p) for p in picks],"</section>"]
files=sorted(p for p in root.rglob("*") if p.is_file() and (p.suffix!=".jpg" or p in selected) and p.name!="Sichtpruefung.html" and p!=root/"SHA256.txt")
gallery+=["<h2>Protokolle und Quellen</h2><ul>",*[f'<li><a href="{html.escape(relative(p),quote=True)}">{html.escape(relative(p))}</a></li>' for p in files if p.suffix in {".md",".json",".log",".txt",".py",".pdf"}],"</ul></html>"]
index=root/"Sichtpruefung.html";index.write_text("\n".join(gallery));files.append(index)
manifest=root/"SHA256.txt";manifest.write_text("".join(f"{checksum(p)}  {relative(p)}\n" for p in sorted(files)))
out=Path("artifacts/GeoRisiko-G6.8.1-Sichtpruefung.zip");out.parent.mkdir(exist_ok=True)
with ZipFile(out,"w",ZIP_DEFLATED,compresslevel=5) as archive:
    for p in [*files,manifest]:archive.write(p,relative(p))
with ZipFile(out) as archive:assert archive.testzip() is None
