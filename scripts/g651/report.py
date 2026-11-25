"""Package the measured products, the original comparative captures and the offline gallery."""
import hashlib
import html
import json
import os
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path("test-results/Abnahme")
web, mac = root / "HTML", root / "Nativ/G65/App"
source = Path("docs")
commit = os.environ["TEST_COMMIT"]
base = "8c023e83c6996dd58f0e28d16a52c8766136ef88"
def read(path):
    return json.loads(path.read_text())
def link(path):
    return html.escape(path.relative_to(root).as_posix(),quote=True)
def gallery_image(path,label):
    return f'<figure><a href="{link(path)}"><img loading="lazy" src="{link(path)}" alt="{html.escape(label)}"></a><figcaption>{html.escape(label)}</figcaption></figure>'
def md_table(head,rows):
    return ["| "+" | ".join(head)+" |","|"+"|".join("---" for _ in head)+"|",*["| "+" | ".join(map(str,r))+" |" for r in rows]]
docs=root/"Dokumentation"
docs.mkdir(exist_ok=True)
for path in [source/name for name in ("g651-korrektur.md","g651-renderdiagnose.json","g65-erdbeben.md","curriculum-coverage.md","roadmap.md","g51-quellen.md","g64-forschungsatlas.md","mac-installation.md")]:
    (docs/path.name).write_bytes(path.read_bytes())
for path in [Path("scripts/g65/reference.py"),*Path("public/licenses").glob("*")]:
    target=root/path
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_bytes(path.read_bytes())
proofs=[]
sizes={(740,530),(900,600),(1280,720),(1366,768),(1920,1080),(2560,1440)}
for path in [web,mac]:
    p=read(path/"Produkt.json")
    assert p["commit"]==commit and not p["network"]
    proof=read(path/"Seismische-Integritaet.json")
    old=read(path/"Seismologie.json")
    nav=read(path/"Geographische-Abnahme.json")
    scope=read(path/"Bedienpruefung.json")
    assert all(d["complete"] and not d["errors"] for d in (proof,old,nav,scope))
    assert len(nav["matrix"])>=19 and len(old["routes"])>=47
    assert len(proof["faults"])==6 and len(proof["stations"])==4 and len(proof["frames"])>=50
    assert all(r["foreground"]>.008 for r in proof["frames"])
    assert {(r["w"],r["h"]) for r in proof["sizes"]}==sizes
    assert all(not r["clipped"] and not r["covered"] and r["scroll"]<=1 for r in proof["sizes"])
    proofs.append(proof)
assert p["platform"]=="darwin" and p["arch"]=="arm64"
films=proofs[0]["movies"]
assert len(films)==4 and all(f["seconds"]>=18 and f["frames"]>=35 for f in films)
long=read(mac/"Dauerlauf.json")
assert long["minutes"]>=15 and all(min(r[k]["foreground"] for k in ("animatedVisible","visible"))>.008 for r in long["rows"])
versions=["G6.5","G6.5.1"]
pairs=[root/"Vergleich"/v for v in versions]
comparisons=[read(p/"Vergleich.json") for p in pairs]
a,b=comparisons
assert a["complete"] and b["complete"] and (a["commit"],b["commit"])==(base,commit)
assert b["historicalFavorite"]
assert a["engine"]==b["engine"] and len(b["sizes"])==6 and min(r["foreground"] for r in b["sizes"])>.008
assert read(mac/"Fachpruefung.json")["originalSamples"]==25200
lines=["# GeoRisiko G6.5.1 · Produktabnahme","",f"Commit `{commit}` auf G6.5 `{base}`. Die ausgelieferte Einzel-HTML und die nach Auswerfen des DMG gestartete ARM64-App liefen offline. Beide durchliefen die neuen Korrekturprüfungen sowie die Unterrichts- und Navigationsregressionen aus G6.5 und G6.4.2.","","## Sichtbarkeit der WebGL-Geometrie","","Nur Pixel des freigestellten WebGL-Canvas zählen. Der Schwellenwert trennt beleuchtete Geometrie vom dunklen Modellhintergrund. Die JSON-Dateien enthalten zusätzlich Farbanteile, projizierte Anker und lokale Pixeltreffer. Die Originalbilder zeigen die vollständige Oberfläche.",""]
rows=[]
for i,row in enumerate(b["sizes"]):
    rows.append([f"{row['w']} × {row['h']}",f"{a['sizes'][i]['foreground']:.1%}",f"{row['foreground']:.1%}",f"{proofs[1]['sizes'][i]['foreground']:.1%}"])
lines+=md_table(["Fenster","G6.5 HTML","G6.5.1 HTML","G6.5.1 App"],rows)
lines+=["","Die sechs Größen, laufende und pausierte Größenwechsel, Vollbild und Rückkehr, freie Kamera, schnelle Modellwechsel, Rücknavigation, Diagramme und gespeicherte Ansichten wurden bedient. Die nativen Fenstergrößen wurden am BrowserWindow eingestellt und im Renderer kontrolliert.","","## Fachliche Prüfungen","","Die vier Frontankünfte wurden an den Koordinaten der tatsächlich bewegten Fronten und Sensoren geprüft. Bei allen sechs Bruchtypen wurden die Bewegungsrichtungen der beiden Materialmarker gemessen. Für den Standortvergleich protokollieren die Produkttests die unterschiedliche Auslenkung der modellierten Oberflächen. Die Fachprüfung enthält unabhängige Rechenwerte, Toleranzen und Quellenbezüge.",""]
lines+=md_table(["Station","Wellentyp","Referenzzeit","Differenz Front–Sensor in Modelleinheiten"],[[f"{r['km']} km",r["wave"],f"{r['expectedSeconds']:.2f} s",f"{r['dx']:.4f}"] for r in proofs[1]["stations"]])
lines+=["","## Bewegte Szenen unter identischen Bedingungen","",f"Chromium {a['engine']}, Unterrichtsprofil, 1.366 × 768. Die Aufnahme der aktiven WebGL-Fläche bestätigt vor jeder Leistungsmessung die sichtbare Geometrie. Die Protokolle enthalten Ladezeiten, JS-Heap, GPU-Ressourcenzähler, DOM-Aktualisierungen und Aufwand der instrumentierten Diagrammbefehle.",""]
rows=[]
for ver,r in zip(versions,comparisons):
    for t in r["timing"]:
        rows.append([ver,t["name"],f"{t['fps']:.1f}",f"{t['p95']:.1f} ms",f"{t['visible']['foreground']:.1%}",t["labels"],f"{t['chart']['ms']:.1f} ms"])
lines+=md_table(["Version","Ansicht","Bilder/s","P95","Geometrieanteil","DOM-Änderungen","Diagrammbefehle"],rows)
lines+=["","### Starten, Wechseln und Freigeben",""]
lines+=md_table(["Version","Start der Einzeldatei","Modellwechsel (Min.–Max.)","JS-Heap in Bewegung (Min.–Max.)","Nach Rückkehr zum Globus (Texturen / Geometrien / Programme)"],[
    [v,f"{r['startMs']/1000:.2f} s",f"{min(x['ms'] for x in r['loads']):.0f}–{max(x['ms'] for x in r['loads']):.0f} ms",
     f"{min(x['heap'] for x in r['timing'])/1048576:.1f}–{max(x['heap'] for x in r['timing'])/1048576:.1f} MiB",
     " / ".join(str(r['afterExit'][k]) for k in ("textures","geometries","programs"))] for v,r in zip(versions,comparisons)])
rss=[sum(proc['workingKiB'] for proc in row['rss'])/1024 for row in long['rows']]
lines+=["",f"Die summierten Working Sets der Electron-Prozesse lagen zwischen {min(rss):.0f} und {max(rss):.0f} MiB. Gemeinsam genutzte Speicherseiten können in dieser Summe mehrfach enthalten sein. Die vollständigen Messreihen liegen in Dauerlauf.json und den beiden Vergleich.json-Dateien.","",f"Der native Dauerlauf dauerte {long['minutes']:.2f} Minuten. {len(long['rows'])} Abschnitte enthalten Bildrate, Pausenmessung, Prozessspeicher, Texturen, Geometrien und eine eigenständige Sichtbarkeitsprüfung. Ein virtueller Apple-Silicon-Runner erlaubt Aussagen über dieses Testsystem. Thermik des MacBook Air M1 und Touchbedienung am Schulgerät wurden nicht gemessen.","","## Bedienfilme",""]
lines+=md_table(["Durchgängige Originalaufnahme","Dauer","Erfasste Bilder"],[[f["name"],f"{f['seconds']:.1f} s",f["frames"]] for f in films])
(root/"Abnahmebericht.md").write_text("\n".join(lines)+"\n")
gallery=['<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>GeoRisiko G6.5.1 · Sichtprüfung</title><style>body{margin:2rem auto;max-width:1320px;padding:0 1rem;background:#14272a;color:#f0f4ef;font:16px/1.5 system-ui}a{color:#b6e1c5}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,310px),1fr));gap:1rem}figure{margin:0}img,video{max-width:100%;height:auto}pre{white-space:pre-wrap}</style><h1>GeoRisiko G6.5.1 · Sichtprüfung</h1><a href="Abnahmebericht.md">Abnahmebericht</a> · <a href="Dokumentation/g651-korrektur.md">Fehlerursache und Fachbericht</a> · <a href="Dokumentation/curriculum-coverage.md">Curriculare Zuordnung</a><details><summary>Abnahmebericht lesen</summary><pre>'+html.escape("\n".join(lines))+'</pre></details><h2>Vergleich der Produkte</h2>']
for name in b["screens"]:
    gallery+=["<h3>"+html.escape(name)+"</h3><section>"]+[gallery_image(d/(name+".jpg"),v) for d,v in zip(pairs,versions)]+["</section>"]
gallery.append("<h2>Bedienfilme</h2>")
for f in films:
    movie=web/(f["name"]+".mp4");assert movie.is_file()
    gallery.append(f'<h3>{html.escape(f["name"])}</h3><video controls preload="metadata" src="{link(movie)}"></video>')
for label,folder in [("Offline-HTML",web),("Installierte App",mac)]:
    gallery+=["<h2>"+label+"</h2><section>"]+[gallery_image(p,p.stem) for p in sorted(folder.glob("*.jpg"))]+["</section>"]
gallery.append("<h2>Messprotokolle und Quellen</h2><ul>")
for p in sorted(root.rglob("*")):
    if p.is_file() and p.suffix in {".log",".md",".json",".pdf",".py",".txt"}:gallery.append(f'<li><a href="{link(p)}">{link(p)}</a></li>')
(root/"Sichtpruefung.html").write_text("\n".join(gallery)+"</ul></html>")
files=sorted(p for p in root.rglob("*") if p.is_file() and p!=root/"SHA256.txt")
(root/"SHA256.txt").write_text("".join(hashlib.sha256(p.read_bytes()).hexdigest()+"  "+str(p.relative_to(root))+"\n" for p in files))
dest=Path("artifacts/GeoRisiko-G6.5.1-Sichtpruefung.zip");dest.parent.mkdir(exist_ok=True)
with ZipFile(dest,"w",ZIP_DEFLATED,compresslevel=5) as archive:
    for p in [*files,root/"SHA256.txt"]:archive.write(p,p.relative_to(root))
with ZipFile(dest) as archive:assert archive.testzip() is None
print(dest, len(files)+1,"Dateien")
