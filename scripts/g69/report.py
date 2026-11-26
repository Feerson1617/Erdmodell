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
models = {"waterColumn","maar","profiles","inventory"}

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
for name in ["g69-abnahme.md","g682-oberflaeche.md","g681-korrekturen.md","g681-geraetecheck.md","g68-fachpruefung.md","g68-datengrundlage.md","g68-lehrkraft.md","ulmener-maar-nyos.md","vulkanismus.md","curriculum-coverage.md","mac-installation.md","g651-korrektur.md"]:
    shutil.copyfile(Path("docs")/name,docs/name)
shutil.copytree("public/licenses",root/"public/licenses",dirs_exist_ok=True)
shutil.copyfile("src/seismology/nyos-profiles.json",docs/"Nyos-Tabellenwerte.json")
shutil.copyfile("src/seismology/nyos-inventory.json",docs/"Nyos-CO2-Gesamtvorrat-Tabelle-4.json")
shutil.copyfile("scripts/g681/region.py",docs/"region.py")
lines=[
    "# GeoRisiko G6.9 · Produktabnahme", "",
    f"Geprüfter Commit `{commit}`. Ausgangsstand G6.8.2 `d49322677c91979a9cf6b5cfe1bc7117182cafc0`.", "",
    "## Bedienabläufe", "",
    "A prüft das Präsentieren mit Wiedergabe, Zeitregler, Reset und Prozesswechsel. B prüft die Informationszustände und das gezielte Freigeben von Fachbegriffen. C verfolgt die räumliche Orientierung von Europa und Ulmen bis Nyos. D prüft Legenden, Diagrammachsen und den See­vergleich. E stellt gespeicherte Ansichten wieder her. F besteht aus den Aufgaben zur fachlichen, geographischen und technischen Bestandsprüfung.", "",
]
for folder in [web,native]:
    meta,p=read(folder/"Produkt.json"),read(folder/"G682.json")
    assert meta["commit"]==commit and not meta["network"] and not p["errors"] and set(p["routes"])==set("ABCDE")
    assert p["routes"]["A"]["presentation"]==4 and p["routes"]["E"]["restored"]
    assert len(p["windows"])==24 and {(r["w"],r["h"]) for r in p["windows"]}==sizes
    assert {r["id"] for r in p["windows"]}==models
    assert all(r["rendered"]["foreground"]>.008 and not any(c["clipped"] for c in r["layout"]["controls"]) for r in p["windows"])
    assert all(r["rendered"]["foreground"]>.008 for r in p["frames"])
    for source in ["Seismische-Integritaet","Seismologie","Geographische-Abnahme","Bedienpruefung"]:
        result=read(folder/(source+".json"))
        assert result["complete"] and not result["errors"]
    baseline=read(folder/"G68.json")
    assert not baseline["errors"] and set(baseline["routes"])==set("ABCDEFGH") and len(baseline["windows"])==36
    assert not read(folder/"G67.json")["errors"] and not read(folder/"G681.json")["errors"]
    assert read(folder/"Neustart.json")["mask"]["foreground"]>.008
    scenes=[r for r in p["frames"] if r["name"] in ("A-Praesentation","A-Prozesswechsel","D-Achsen","D-Inventar")]
    lines+= [f"### {meta['product']} auf {meta['platform']} ({meta['arch']})","",
        f"{len(p['windows'])} gezielte Fenster-/Szenenkombinationen plus {len(baseline['windows'])} aus der G6.8-Bestandsprüfung und 30 aus der G6.8.2-Prüfung. Korrigierte Achsen liegen in allen geprüften Fenstergrößen außerhalb der Erklärungskästen. Die vollständige Wiederherstellung nach Neustart ist im Neustartprotokoll belegt.","",
        "| Szene | Sichtbare Steuerung | Zeichenfläche | Titelschrift |","|---|---:|---:|---:|"]
    for r in scenes:
        l=r["layout"]
        title=next((e["font"] for e in l["elements"] if e["id"]=="geo-title"),0)
        lines.append(f"| {r['name']} | {len(l['controls'])} | {l['area']:.1%} | {title:.1f} CSS-Pixel |")
    lines.append("")
assert meta["platform"]=="darwin" and meta["arch"]=="arm64"
science=read(native/"G681-Fachpruefung.json")
assert 25<science["distanceKm"]<26 and len(science["inventory"])==11
lines+=["## Wissenschaftliche Referenz","",f"Die Bestandsprüfung bestätigt die elf Schätzwerte für Nyos und {science['distanceKm']:.2f} km Luftlinie zwischen den Ortsmitten. Der Anfangskurs beträgt rund 195 Grad von Nord im Uhrzeigersinn. Die Richtung ist Südsüdwest. Daten und Modellgrenzen sind in den Fachprotokollen dokumentiert.",""]
long=read(native/"Dauerlauf.json")
assert long["minutes"]>=45 and all(min(r[k]["foreground"] for k in ("visible","animatedVisible"))>.008 for r in long["rows"])
rss=[sum(p["workingKiB"] for p in r["rss"])/1024 for r in long["rows"]]
fps=[r["animatedFps"] for r in long["rows"]]
presented=sum(r["presentationMs"] for r in long["rows"])/60000
assert presented>=15 and {r["info"] for r in long["rows"] if r["presentation"]}=={"observe","terms","explain","neutral"}
lines+=["## Virtueller Apple-Silicon-Dauerlauf","",f"{long['minutes']:.2f} Minuten, {len(rss)} Abschnitte, davon {presented:.2f} Minuten eigentliche Messzeit im Vollbild über alle vier Informationszustände. {min(fps):.1f}–{max(fps):.1f} gerenderte Bilder/s, Median {statistics.median(fps):.1f}. Summierte Prozess-Working-Sets {min(rss):.0f}–{max(rss):.0f} MiB. Gemeinsam genutzte Seiten können mehrfach enthalten sein. Die Probe umfasst laufende und pausierte Phasen.","","## G6.8.2 und G6.9 unter gleichen Bedingungen","","Die Einzel-HTML liefen im selben Chromium bei 1920 × 1080, mit denselben Modellzuständen und derselben Geräteskalierung. Geometriefläche und Schriftgrößen stehen pro Bild in Messung.json. Das P95 beschreibt Browser-Bildintervalle. Die belegte Breite der Geometrie ist aus den mittleren 98 Prozent heller Modellpixel abgeleitet.","","| Version | Ansicht | Steuerungen Arbeit/Vollbild | Zeichenfläche | Gerenderte Bilder/s | P95 | Modellwechsel | JS-Heap | DOM-Änderungen |","|---|---|---:|---:|---:|---:|---:|---:|---:|"]
for version in ["G6.8.2","G6.9"]:
    compare=read(root/"Vergleich"/version/"Messung.json")
    assert len(compare["landscapes"])==5
    assert len(compare["samples"])==19 and len(compare["resources"])==2 and not compare["errors"]
    if version=="G6.9":assert compare["favoriteMigrated"] and compare["commit"]==commit
    for r in compare["samples"]:
        lines.append(f"| {version} | {r['name']} | {len(r['work']['controls'])}/{len(r['presentation']['controls'])} | {r['presentation']['area']:.1%} | {r['fps']:.1f} | {r['p95']:.1f} ms | {r['changeMs']:.0f} ms | {r['heap']/1048576:.1f} MiB | {r['changes']} |")
    before,after=compare["resources"]["before"],compare["resources"]["after"]
    lines.append(f"| {version} | Start {compare['startMs']/1000:.2f} s. Wiederholte Wechsel, Texturen {before['textures']} → {after['textures']}, Geometrien {before['geometries']} → {after['geometries']}. | | | | | | | |")
lines+=["","## Abschlussurteil","","Die geprüften Sprach-, Geometrie- und Bedienkorrekturen sind im Release Candidate umgesetzt. Die Präsentation zeigt statische Szenen mit einer dauerhaft sichtbaren Steuerung. Bei animierten Szenen ergänzen Wiedergabe, Zeitregler und Zurücksetzen den Zugang. Im Beobachtungsmodus entfallen Prozessphasen und Erklärungen. Die neutrale Ansicht blendet auch die Verortung aus.","","Die physische Prüfung auf dem MacBook Air M1 und am Schul-Smartboard steht aus. Aussagen zu Wärmeentwicklung, Touchbedienung und Lesbarkeit aus dem tatsächlichen Sitzabstand erfordern das Zielgerät. Die App ist ad hoc signiert. Das Installationsprotokoll enthält die Gatekeeper-Bewertung der Quarantänekopie.","","## Originalfilme",""]
films=read(web/"G682.json")["movies"]+read(web/"G69.json")["movies"]
assert len(films)==3 and all(f["frames"]>=15 and f["seconds"]>=8 for f in films)
for f in films:
    assert (web/(f["name"]+".mp4")).is_file()
    lines.append(f"- {f['name']} · {f['seconds']:.1f} Sekunden, {f['frames']} Originalbilder")
for folder in (web,native):
    geo=read(folder/"G69.json")
    assert len(geo["views"])>=65 and len(geo["screens"])>=17
    lines.append(f"{folder.name}: {len(geo['views'])} tatsächlich geöffnete Hilfen. Das zugehörige G69.json enthält die Beschriftungen und verfügbaren Erklärungen pro Ansicht.")
inputs=read(root/"Vergleich/Orte-und-Eingabe.json")
assert len(inputs["places"])>=39 and len(inputs["inputs"])==6 and len(inputs["ventInputs"])==2
lines+=["",f"Das Ortsverzeichnis enthält {len(inputs['places'])} einzeln aufgerufene Hilfen. In sechs Fenstergrößen wurden jeweils alle vier Schalen per simuliertem Touch geöffnet, das Mantelmaterial direkt mit der Maus ausgewählt und die Hilfe per Tastatur geöffnet. Die Erklärungen beider Vulkanschnitte reagierten ebenfalls auf die simulierte Berührung. Die Einzelprotokolle stehen in Vergleich/Orte-und-Eingabe.json."]
sizes=read(root/"Nativ/G65/Dateigroessen.json")
lines+=["","## Dateigrößen","", "| Offline-Produkt | G6.8.2 | G6.9 |","|---|---:|---:|"]
for suffix,old in [("macOS-arm64.dmg",167271813),("macOS-arm64-app.zip",161748953),("Web-Test.html",60779431)]:
    new=sizes["products"]["GeoRisiko-G6.9-"+suffix]
    lines.append(f"| {suffix} | {old/1048576:.1f} MiB | {new/1048576:.1f} MiB |")
lines+=[f"Installierter Bundle-Inhalt ohne symbolische Verweise: {sizes['installed']/1048576:.1f} MiB. Weltweite Grundraster: {sizes['data']['global']/1048576:.1f} MiB. Nordwesteuropa und die regionalen G6.9-Dateien: {sizes['data']['regionalG69']/1048576:.1f} MiB.","",Path("docs/g69-abnahme.md").read_text()]
(root/"Abnahmebericht.md").write_text("\n".join(lines)+"\n")
gallery=['<!doctype html><html lang="de"><meta charset="utf-8"><title>GeoRisiko G6.9 · Sichtprüfung</title><meta name="viewport" content="width=device-width"><style>body{max-width:1280px;margin:auto;padding:2rem 1rem;font:16px/1.55 system-ui;background:#15272b;color:#f2f0e3}a{color:#a6ded8}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(310px,100%),1fr));gap:1em}img,video{width:100%;height:auto}figure{margin:0}pre{white-space:pre-wrap}</style><h1>GeoRisiko G6.9 · Sichtprüfung</h1><p><a href="Dokumentation/g68-lehrkraft.md">Bedienübersicht</a> · <a href="Dokumentation/g68-datengrundlage.md">Ulmen und Nyos</a> · <a href="Dokumentation/g682-oberflaeche.md">Oberfläche und Sprache</a> · <a href="Dokumentation/g681-geraetecheck.md">Gerätecheck</a> · <a href="Abnahmebericht.md">Prüfbericht</a></p><details><summary>Abnahmebericht lesen</summary><pre>'+html.escape("\n".join(lines))+'</pre></details>']
for f in films:
    gallery.append(f'<h2>{f["name"]}</h2><video controls preload="metadata" src="{relative(web/(f["name"]+".mp4"))}"></video>')
selected=set()
for p in sorted((root/"Vergleich/G6.8.2").glob("*.jpg")):
    after=root/"Vergleich/G6.9"/p.name
    assert after.is_file()
    selected.update([p,after])
    gallery.extend([f"<h2>{p.stem} · G6.8.2 und G6.9</h2><section>",image(p),image(after),"</section>"])
for label,folder in [("Offline-HTML",web),("Installierte ARM64-App",native)]:
    picks=sorted([*folder.glob("G682-*.jpg"),*folder.glob("G69-*.jpg")]);selected.update(picks)
    gallery+=["<h2>"+label+"</h2><section>",*[image(p) for p in picks],"</section>"]
files=sorted(p for p in root.rglob("*") if p.is_file() and (p.suffix!=".jpg" or p in selected) and p.name!="Sichtpruefung.html" and p!=root/"SHA256.txt")
gallery+=["<h2>Protokolle und Quellen</h2><ul>",*[f'<li><a href="{html.escape(relative(p),quote=True)}">{html.escape(relative(p))}</a></li>' for p in files if p.suffix in {".md",".json",".log",".txt",".py",".pdf"}],"</ul></html>"]
index=root/"Sichtpruefung.html";index.write_text("\n".join(gallery));files.append(index)
manifest=root/"SHA256.txt";manifest.write_text("".join(f"{checksum(p)}  {relative(p)}\n" for p in sorted(files)))
out=Path("artifacts/GeoRisiko-G6.9-Sichtpruefung.zip");out.parent.mkdir(exist_ok=True)
with ZipFile(out,"w",ZIP_DEFLATED,compresslevel=5) as archive:
    for p in [*files,manifest]:archive.write(p,relative(p))
with ZipFile(out) as archive:assert archive.testzip() is None
