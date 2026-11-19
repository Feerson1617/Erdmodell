"""Build reproducible ZIPs from the production build and the current browser run."""

import hashlib, json, zipfile, subprocess
from statistics import median
from pathlib import Path
from tempfile import TemporaryDirectory
from xml.etree import ElementTree as ET

root = Path(__file__).resolve().parents[1]
dist = root / "dist"
out = root / "artifacts"
out.mkdir(exist_ok=True)


def files(folder):
    return {
        p.relative_to(folder).as_posix(): p.read_bytes()
        for p in sorted(folder.rglob("*"))
        if p.is_file()
    }


def archive(folder, name, entries):
    dest = folder / ("GeoRisiko-G4.2.2-" + name + ".zip")
    with zipfile.ZipFile(dest, "w") as z:
        for key, value in sorted(entries.items()):
            entry = zipfile.ZipInfo(key, date_time=(2026, 1, 1, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.create_system = 3
            entry.external_attr = (0o755 if key.endswith(".command") else 0o644) << 16
            z.writestr(entry, value)
    with zipfile.ZipFile(dest) as z:
        assert z.testzip() is None
    return dest


commit = subprocess.check_output(
    ["git", "rev-parse", "HEAD"], cwd=root, text=True
).strip()
nyos_docs = (
    "nyos-geodaten.md",
    "nyos-geowissenschaften.md",
    "nyos-design.md",
    "nyos-technik.md",
    "nyos-unterrichtsverwendung.md",
    "nyos-abnahme.md",
)
web = files(dist)
web["Pruefstand.txt"] = f"GeoRisiko 3D · G4.2.2 · Freitag, 20. November 2026\nGeprüfter Git-Commit: {commit}\n".encode()
assert "index.html" in web
source = (root / "docs/data-sources-and-licenses.md").read_bytes()
web["Quellen.md"] = source
web["g1.1-data.md"] = (root / "docs/g1.1-data.md").read_bytes()
web["data-sources-and-licenses.md"] = source
for name in (*nyos_docs, "g2.1-daten.md", "g2.1-prozessmodelle.md", "grundlagen-g4.2.md", "qualitaet-g4.2.1.md", "freitag-20-11-2026.md"):
    web[name] = (root / "docs" / name).read_bytes()
sco = dict(web)
sco["scorm.js"] = (root / "scripts/scorm.js").read_bytes()
sco["index.html"] = sco["index.html"].replace(
    b"</head>", b'<script src="./scorm.js"></script></head>'
)
ns = "http://www.imsproject.org/xsd/imscp_rootv1p1p2"
adl = "http://www.adlnet.org/xsd/adlcp_rootv1p2"
ET.register_namespace("", ns)
ET.register_namespace("adlcp", adl)


def tag(s):
    return "{" + ns + "}" + s


def add(el, name, value=None, **attrs):
    child = ET.SubElement(el, tag(name), attrs)
    child.text = value
    return child


xsi = "http://www.w3.org/2001/XMLSchema-instance"
ET.register_namespace("xsi", xsi)
m = ET.Element(tag("manifest"), identifier="GEORISIKO-G4-2-2", version="1.2")
m.set(
    "{" + xsi + "}schemaLocation",
    ns + " imscp_rootv1p1p2.xsd " + adl + " adlcp_rootv1p2.xsd",
)
meta = add(m, "metadata")
add(meta, "schema", "ADL SCORM")
add(meta, "schemaversion", "1.2")
os = add(m, "organizations", default="ATLAS")
org = add(os, "organization", identifier="ATLAS")
add(org, "title", "GeoRisiko 3D · Erdaufbau und Plattentektonik")
item = add(org, "item", identifier="OBSERVATORIUM", identifierref="SCO", parameters="?unterricht=schalenbau")
add(item, "title", "Der Schalenbau der Erde")
rs = add(m, "resources")
r = add(rs, "resource", identifier="SCO", type="webcontent", href="index.html")
r.set("{" + adl + "}scormtype", "sco")
for name in sorted(sco):
    add(r, "file", href=name)
ET.indent(m)
sco["imsmanifest.xml"] = ET.tostring(m, encoding="utf-8", xml_declaration=True)
assert all(
    f.attrib["href"] in sco
    for f in ET.fromstring(sco["imsmanifest.xml"]).iter(tag("file"))
)
sco.update(files(root / "scripts/scorm12"))
results_dir = root / "test-results"
checks = {name: (results_dir / name).read_bytes() for name in ("results.json", "architecture-gate.json")}
# Keep each suite's media separate, including runs of the older model views.
suites = (
    ("unterricht", "unterricht-g131", 10),
    ("tektonik", "g2.1", 10),
    ("nyos", "nyos", 12),
    ("grundlagen", "g4.2.2", 12),
    ("freitag", "freitag", 8),
)
for section, directory, expected_count in suites:
    assets = files(results_dir / directory)
    shots = [content for name, content in assets.items() if name.endswith(".jpg")]
    assert len(shots) == len(set(shots)) == expected_count, (
        f"{section}: {expected_count} unterschiedliche Ansichten erwartet"
    )
    assert assets["bedienung.webm"], f"{section}: Bedienfilm fehlt"
    if section != "unterricht":
        assert assets["Messbericht.md"], f"{section}: Messbericht fehlt"
    checks.update({section + "/" + name: content for name, content in assets.items()})

reports = ["results.json", *(section + "/pruefung.json" for section, _, _ in suites)]
for name in reports:
    result = json.loads(checks[name])
    assert result["commit"] == commit, f"{name} gehört zu einem anderen Commit"
    assert not result.get("failure") and {r["engine"] for r in result["runs"]} == {
        "chromium",
        "webkit",
    }, f"{name}: erfolgreiche Prüfungen in beiden Browsern erforderlich"
    if name in {"nyos/pruefung.json", "grundlagen/pruefung.json", "freitag/pruefung.json"}:
        suite = name.split("/")[0]
        images = next(r["images"] for r in result["runs"] if r["engine"] == "chromium")
        expected = {f"{suite}/{image['name']}.jpg": image["hash"] for image in images}
        actual = {key: hashlib.sha256(content).hexdigest() for key, content in checks.items()
                  if key.startswith(suite + "/") and key.endswith(".jpg")}
        assert actual == expected, f"Die Bilder der Suite {suite} müssen exakt zum Browserprotokoll gehören"
comparison = files(results_dir / "vergleich")
baseline = "441f1480b6fc1d65faf5ef5b06882ccdc6775656"
timings = json.loads(comparison["leistung.json"])
assert timings["baseline"] == baseline and timings["candidate"] == commit
assert {(r["engine"],r["version"]) for r in timings["runs"]} == {
    (e,v) for e in ("chromium","webkit") for v in ("G4.2","G4.2.2")}
assert all(len(r["samples"]) == 7 and all(s["fps"] > 0 for s in r["samples"]) for r in timings["runs"])
assert comparison["Leistungsvergleich.md"]
before = json.loads(comparison["g4.2/pruefung.json"])
assert before["commit"] == baseline and not before.get("failure")
images = before["runs"][0]["images"]
after_names = {key.split("/")[-1] for key in checks if key.startswith("grundlagen/") and key.endswith(".jpg")}
assert {img["name"]+".jpg" for img in images} == after_names
for img in images:
    assert hashlib.sha256(comparison["g4.2/"+img["name"]+".jpg"]).hexdigest() == img["hash"]
checks.update({"vergleich/"+name:content for name,content in comparison.items()})
lesson = dict(web)
lesson.update(
    {
        name: (root / "scripts" / name).read_bytes()
        for name in ("start_lokal.py", "START.command")
    }
)
for name in ("unterricht-15-12.md", "unterricht-20-11.md", "geoscience-validation.md", "roadmap.md"):
    lesson[name] = (root / "docs" / name).read_bytes()
friday = json.loads(checks["freitag/pruefung.json"])
assert all(len(run["steps"]) == 15 and len(run["performance"]) == 10 and len(run["viewports"]) == 4
           and not run["externalRequests"] and not run["errors"] for run in friday["runs"])
visual = json.loads(checks["freitag/bildvergleich/vergleich.json"])
assert visual["candidate"] == commit and visual["baseline"] == "1caab5e3578cff1c92814ccb781f3069f9be3dbd"
assert len(visual["results"]) == 7 and all(row["fraction"] < .001 for row in visual["results"])
for image in ("01-globus", "02-anonym", "04-namen"):
    lesson["Offline-Bilder/" + image + ".jpg"] = checks["freitag/" + image + ".jpg"]
lesson["START.txt"] = """Schalenbau der Erde · Freitag, 20. November 2026

Das ZIP vollständig entpacken und auf dem Mac START.command öffnen.
Python 3 und ein Browser mit WebGL 2 werden für das interaktive Modell benötigt.
Die vollständige lokale Adresse im Terminal führt zur Freitagsstunde.
Bei gesperrtem Finder-Start im Terminal aus dem entpackten Ordner python3 start_lokal.py aufrufen.
Die Stunde beginnt am anonymen Globus. Präsentieren wählen und anschließend Schalenschnitt öffnen.
Der Kreispfeil unten rechts stellt den anonymen Globus wieder her.
Das Terminal offen lassen. Ctrl+C beendet den Server.

Unterrichtsfolge, Geräteprobe und Rückfall sind in freitag-20-11-2026.md beschrieben.
Rückfallversion: GeoRisiko-G1.3.1-Unterricht.zip. Vor der Stunde lokal bereitlegen.
Bei fehlendem Python oder WebGL die drei Bilder im Ordner Offline-Bilder öffnen.
""".encode()
review = dict(lesson)
review["START.txt"] += (
    "\nFür die Geräteprobe auf dem Mac und Smartboard den lokalen Starter öffnen. "
    "Im Browser hinter dem letzten Schrägstrich der Startadresse Pruefung/geraeteprobe.html eingeben. "
    "Im eingebetteten Modell die Ansicht wählen, die Messung starten und das JSON-Protokoll speichern.\n"
).encode()
review["Pruefung/geraeteprobe.html"] = (root / "scripts/nyos-geraeteprobe.html").read_bytes()
review.update({"Pruefung/" + name: content for name, content in checks.items()})
for name in ("qualitaet-g4.2.1", "grundlagen-g4.2", "g2.1-bericht", "g2.1-daten", "g2.1-prozessmodelle", "unterricht-15-12", "geoscience-validation", "roadmap"):
    review["Pruefung/" + name + ".md"] = (root / f"docs/{name}.md").read_bytes()
measured = ["# Messbericht zum Schalenmodell im G4.2.2-Build", "", f"Produktionsbuild `{commit}`", "",
            "14 Bedienfolgen pro Engine. Bildzeiten stammen aus einer separaten ruhenden Schalenansicht bei 1920 × 1080. Die Auflösung gilt für das Modell neben der Bedienleiste.", ""]
for run in json.loads(checks["unterricht/pruefung.json"])["runs"]:
    cadence = run["cadence"]
    res = cadence["resolution"]
    cycles = run["resources"]
    warm = cycles[3:]
    heap = [c["heapBytes"] for c in warm if c["heapBytes"] is not None]
    measured += [f"## {run['engine']} {run['version']}", "",
                 cadence["renderer"], "",
                 f"- Anteil der Modellfläche am Bildschirm bei 1920 × 1080: Globus {run['globeArea']:.0%}, Schalenschnitt im Präsentationsmodus {run['smartboardArea']:.0%}.",
                 f"- {cadence['fps']:.1f} FPS. Median {median(cadence['gaps']):.1f} ms, P95 {cadence['p95Ms']:.1f} ms, Maximum {cadence['maxMs']:.1f} ms.",
                 f"- Puffer {res['width']} × {res['height']}. Faktor {cadence['ratio']:.2f}, Start {res['initial']:.2f}, Minimum {res['minimum']:.2f}, Maximum {res['maximum']:.2f}. Absenkungen {res['reductions']}, Anhebungen {res['recoveries']}.",
                 f"- Warme Geometrien, Texturen und Programme zu Beginn → Ende: {warm[0]['geometries']} → {warm[-1]['geometries']}, {warm[0]['textures']} → {warm[-1]['textures']}, {warm[0]['programs']} → {warm[-1]['programs']}.",
                 f"- Bedienfolge bis zur Bildausgabe im Median {median(c['interactionMs'] for c in cycles):.0f} ms, maximal {max(c['interactionMs'] for c in cycles)} ms.",
                 f"- JS-Heap in den warmen Zyklen: {min(heap)/1048576:.1f}–{max(heap)/1048576:.1f} MiB." if heap else "- JS-Heap vom Browser nicht ausgewiesen.", ""]
review["Pruefung/Messbericht.md"] = "\n".join(measured).encode()
with TemporaryDirectory(dir=out) as temporary:
    packages = (("SCORM-1.2", sco), ("Freitag-Unterricht", lesson), ("Sichtpruefung", review))
    verified = [archive(Path(temporary), name, entries) for name, entries in packages]
    for package in verified:
        destination = package.replace(out / package.name)
        print(destination.name, destination.stat().st_size)
