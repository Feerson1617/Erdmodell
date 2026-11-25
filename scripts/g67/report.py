"""Assemble separately measured desktop and HTML products into an offline review gallery."""
from pathlib import Path
import hashlib
import html
import json
import os
import shutil
from zipfile import ZipFile, ZIP_DEFLATED

root = Path("test-results/Abnahme")
web, native = root/"HTML", root/"Nativ/G65/App"
commit = os.environ["TEST_COMMIT"]
sizes = {(740,530),(900,600),(1280,720),(1366,768),(1920,1080),(2560,1440)}
def read(path):
    return json.loads(path.read_text())
def link(path):
    return html.escape(path.relative_to(root).as_posix(), quote=True)
def image(path):
    return f'<figure><a href="{link(path)}"><img loading="lazy" alt="{html.escape(path.stem)}" src="{link(path)}"></a><figcaption>{html.escape(path.stem)}</figcaption></figure>'
def checksum(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

docs = root/"Dokumentation"
docs.mkdir(exist_ok=True)
for name in ["vulkanismus.md","g66-zwischenabnahme.json","ulmener-maar-nyos.md","curriculum-coverage.md","mac-installation.md","nyos-unterrichtsverwendung.md","g651-korrektur.md","g65-erdbeben.md"]:
    shutil.copyfile(Path("docs")/name,docs/name)
shutil.copytree("public/licenses",docs/"Lizenzen",dirs_exist_ok=True)
shutil.copyfile("scripts/g67/landschaft.py",docs/"landschaft.py")
lines = ["# GeoRisiko G6.7 · Produktabnahme","",f"Geprüfter Commit `{commit}`. Gesicherter Ausgangsstand G6.5.1 `1e760ba0dd153b8ce98e61cf4ec13fd34c256210`. G6.6-Zwischenabnahme `e20755691c37b36de3330b6760d76fdbc50cc5da`.","","## Unterrichtswege in beiden Produkten",""]
for folder in (web,native):
    meta, product = read(folder/"Produkt.json"),read(folder/"G67.json")
    assert meta["commit"] == commit and not meta["network"]
    assert not product["errors"] and set(map(tuple,product["windows"])) == sizes
    assert len(product["frames"]) >= 29 and all(f["foreground"]>.008 for f in product["frames"])
    for source in ["Seismische-Integritaet","Seismologie","Geographische-Abnahme","Bedienpruefung"]:
        test=read(folder/(source+".json"))
        assert test["complete"] and not test["errors"]
    lines.append(f"- {meta['product']} auf {meta['platform']} ({meta['arch']}). {len(product['frames'])} auf sichtbare Geometrie geprüfte Vulkan- und Seenansichten. Niedrigster gemessener Vordergrundanteil {min(f['foreground'] for f in product['frames']):.1%}. Sechs Fenstergrößen von 740 × 530 bis 2560 × 1440.")
assert meta["arch"]=="arm64" and meta["platform"]=="darwin"
films=read(web/"G67.json")["movies"]
assert len(films)==3 and all(f["seconds"]>=18 and f["frames"]>=35 for f in films)
long=read(native/"Dauerlauf.json")
assert long["minutes"]>=15 and all(min(r[k]["foreground"] for k in ("animatedVisible","visible"))>.008 for r in long["rows"])
rss=[sum(p["workingKiB"] for p in row["rss"])/1024 for row in long["rows"]]
lines += ["","## Dauerlauf und Vergleich","",f"{long['minutes']:.2f} Minuten in der installierten App, {len(long['rows'])} Messabschnitte. Summierte Prozess-Working-Sets {min(rss):.0f} bis {max(rss):.0f} MiB. Geteilte Seiten können mehrfach enthalten sein. Die Einzelmessungen enthalten animierte und pausierte Geometrie, Renderbildrate, Bildabstände, Wechselzeiten und GPU-Ressourcenzähler.","","| Version | Bestandsszene | Gerenderte Bilder/s | P95 Bildabstand |","|---|---|---:|---:|"]
for version in ("G6.5.1","G6.7"):
    samples=read(root/"Vergleich"/version/"Messung.json")
    assert [s["id"] for s in samples]==["volcano","seismic-vt","nyos"]
    for s in samples:
        lines.append(f"| {version} | {s['id']} | {s['renderedFps']:.1f} | {s['p95']:.1f} ms |")
lines += ["","Beide Versionen liefen auf demselben macOS-Runner bei 1366 × 768. In ruhenden Ansichten setzt der bedarfsgesteuerte Renderer aus. Die P95-Werte beziehen sich auf Browser-Bildintervalle. Thermik, Akkubetrieb und Touch-Latenz eines physischen Schulgeräts wurden nicht gemessen.","","## Fachliche Grenzen","","Der Vulkanuntergrund, die Maarbildung, das Ulmener Unterwasserbecken und die Zirkulation sind qualitative Modelle. Orthofoto und Oberflächenhöhen sind georeferenziert. Die Quelldaten zu Tiefe und Seenchemie stehen in Dokumentation/ulmener-maar-nyos.md. Für Ulmen fehlen eine belastbare lokale Gassättigungsreihe und vermessene Unterwassergeometrie. Die historische Gasfreisetzung und die kontrollierte Entgasung beziehen sich auf Nyos.","","## Originalfilme",""]
for f in films:
    assert (web/(f["name"]+".mp4")).is_file()
    lines.append(f"- {f['name']} · {f['seconds']:.1f} Sekunden, {f['frames']} erfasste Bilder")
(root/"Abnahmebericht.md").write_text("\n".join(lines)+"\n")
gallery=['<!doctype html><html lang="de"><meta charset="utf-8"><title>GeoRisiko G6.7 · Sichtprüfung</title><meta name="viewport" content="width=device-width"><style>body{margin:2rem auto;max-width:1250px;padding:0 1rem;font:16px/1.5 system-ui;color:#edf3e8;background:#14282a}a{color:#b5dfbf}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(290px,100%),1fr));gap:1rem}figure{margin:0}img,video{max-width:100%;height:auto}pre{white-space:pre-wrap}</style><h1>GeoRisiko G6.7 · Sichtprüfung</h1><a href="Abnahmebericht.md">Prüfbericht</a> · <a href="Dokumentation/ulmener-maar-nyos.md">Ulmen und Nyos</a> · <a href="Dokumentation/curriculum-coverage.md">Curriculum</a><details><summary>Prüfbericht lesen</summary><pre>'+html.escape("\n".join(lines))+"</pre></details>"]
for f in films:
    gallery.append(f'<h2>{html.escape(f["name"])}</h2><video controls preload="metadata" src="{link(web/(f["name"]+".mp4"))}"></video>')
for label,folder in [("G6.5.1 · Ausgangsstand",root/"Vergleich/G6.5.1"),("G6.7 · gleiche Ansichten",root/"Vergleich/G6.7"),("Offline-HTML",web),("Installierte ARM64-App",native)]:
    gallery += ["<h2>"+label+"</h2><section>",*[image(p) for p in sorted(folder.glob("*.jpg"))],"</section>"]
gallery.append("<h2>Messprotokolle, Quellen und Rechte</h2><ul>")
for p in sorted(root.rglob("*")):
    if p.is_file() and p.suffix in {".log",".md",".json",".pdf",".py",".txt"}:
        gallery.append(f'<li><a href="{link(p)}">{link(p)}</a></li>')
(root/"Sichtpruefung.html").write_text("\n".join(gallery)+"</ul></html>")
files=sorted(p for p in root.rglob("*") if p.is_file() and p!=root/"SHA256.txt")
manifest=root/"SHA256.txt"
manifest.write_text("".join(f"{checksum(p)}  {p.relative_to(root)}\n" for p in files))
out=Path("artifacts/GeoRisiko-G6.7-Sichtpruefung.zip")
out.parent.mkdir(exist_ok=True)
with ZipFile(out,"w",ZIP_DEFLATED,compresslevel=5) as archive:
    for p in [*files,manifest]: archive.write(p,p.relative_to(root))
with ZipFile(out) as archive: assert archive.testzip() is None
