"""Build reproducible ZIPs from the production build and the current browser run."""

import json, zipfile, subprocess
from statistics import median
from pathlib import Path
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


def archive(name, entries):
    dest = out / ("GeoRisiko-G2.1-" + name + ".zip")
    with zipfile.ZipFile(dest, "w") as z:
        for key, value in sorted(entries.items()):
            entry = zipfile.ZipInfo(key, date_time=(2026, 1, 1, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.create_system = 3
            entry.external_attr = (0o755 if key.endswith(".command") else 0o644) << 16
            z.writestr(entry, value)
    with zipfile.ZipFile(dest) as z:
        assert z.testzip() is None
    print(dest.name, dest.stat().st_size)


web = files(dist)
assert "index.html" in web
source = (root / "docs/data-sources-and-licenses.md").read_bytes()
web["Quellen.md"] = source
web["g1.1-data.md"] = (root / "docs/g1.1-data.md").read_bytes()
web["data-sources-and-licenses.md"] = source
for name in ("g2.1-daten.md", "g2.1-prozessmodelle.md"):
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
m = ET.Element(tag("manifest"), identifier="GEORISIKO-G21", version="1.2")
m.set(
    "{" + xsi + "}schemaLocation",
    ns + " imscp_rootv1p1p2.xsd " + adl + " adlcp_rootv1p2.xsd",
)
meta = add(m, "metadata")
add(meta, "schema", "ADL SCORM")
add(meta, "schemaversion", "1.2")
os = add(m, "organizations", default="ATLAS")
org = add(os, "organization", identifier="ATLAS")
add(org, "title", "GeoRisiko 3D")
item = add(org, "item", identifier="OBSERVATORIUM", identifierref="SCO")
add(item, "title", "Erdobservatorium")
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
lesson_checks = {"unterricht/" + name: value for name, value in files(results_dir / "unterricht-g131").items()}
tectonic_checks = {"tektonik/" + name: value for name, value in files(results_dir / "g2.1").items()}
checks.update(lesson_checks)
checks.update(tectonic_checks)
commit = subprocess.check_output(
    ["git", "rev-parse", "HEAD"], cwd=root, text=True
).strip()
for name in ("results.json", "unterricht/pruefung.json", "tektonik/pruefung.json"):
    result = json.loads(checks[name])
    assert result["commit"] == commit, f"{name} gehört zu einem anderen Commit"
    assert not result.get("failure") and {r["engine"] for r in result["runs"]} == {
        "chromium",
        "webkit",
    }
for section, evidence in (("unterricht", lesson_checks), ("tektonik", tectonic_checks)):
    shots = [content for name, content in evidence.items() if name.endswith(".jpg")]
    assert len(shots) == 10 and len(set(shots)) == 10, f"{section}: zehn unterschiedliche Ansichten erwartet"
    assert len(evidence[f"{section}/bedienung.webm"]) > 0, f"{section}: Bedienfilm fehlt"
assert tectonic_checks["tektonik/Messbericht.md"], "G2.1-Messbericht fehlt"
version = ("GeoRisiko 3D · G2.1\nGeprüfter Git-Commit: " + commit + "\n").encode()
# The SCO contains only the application and the files declared in its manifest.
archive("SCORM-1.2", sco)
lesson = dict(web)
lesson.update(
    {
        name: (root / "scripts" / name).read_bytes()
        for name in ("start_lokal.py", "START.command")
    }
)
lesson["Pruefstand.txt"] = version
for name in ("unterricht-15-12.md", "unterricht-20-11.md", "geoscience-validation.md", "roadmap.md"):
    lesson[name] = (root / "docs" / name).read_bytes()
lesson["START.txt"] = """GeoRisiko 3D · Globus, Schalenschnitt und Plattentektonik

1. Das ZIP vollständig in einen eigenen Ordner entpacken.
2. Auf dem Mac mit installiertem Python 3 START.command doppelklicken.
   Der Browser öffnet das Modell. Falls macOS den Start über den Finder
   einschränkt, Terminal öffnen, „cd “ tippen, den entpackten Ordner
   hineinziehen und die Eingabetaste drücken. Dann ausführen:
     python3 start_lokal.py
   Unter Windows in diesem Ordner ein Terminal öffnen:
     py -3 start_lokal.py
3. Falls kein Browser aufgeht, die im Terminal angezeigte lokale Adresse
   mit 127.0.0.1 in den Browser kopieren. Das Terminal während der Stunde
   offen lassen. Ctrl+C beendet den Server.

Der Server lauscht ausschließlich auf dem eigenen Rechner und wählt
automatisch einen freien Port. Für die Darstellung ist WebGL 2 erforderlich.
Alternativ kann die Schule den Ordner auf einem statischen Webserver
bereitstellen oder das SCORM-Paket ins LMS importieren.

Unterrichtsvorbereitung: unterricht-15-12.md
Fachliche Quellen und Modellgrenzen: g2.1-daten.md
""".encode()
archive("Unterricht", lesson)
review = dict(lesson)
for evidence in (lesson_checks, tectonic_checks):
    review.update({"Pruefung/" + name: value for name, value in evidence.items()})
for key in ("results.json", "architecture-gate.json"):
    review["Pruefung/" + key] = checks[key]
for name in ("g2.1-bericht", "g2.1-daten", "g2.1-prozessmodelle", "unterricht-15-12", "geoscience-validation", "roadmap"):
    review["Pruefung/" + name + ".md"] = (root / f"docs/{name}.md").read_bytes()
measured = ["# Messbericht zum Schalenmodell im G2.1-Build", "", f"Produktionsbuild `{commit}`", "",
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
archive("Sichtpruefung", review)
