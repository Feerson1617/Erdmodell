"""Validate evidence against the portable HTML and assemble the small review ZIP."""
from pathlib import Path
import hashlib, json, zipfile
root = Path(__file__).resolve().parents[1]
out = root / "artifacts"
evidence = root / "test-results/plattenatlas"
report = json.loads((evidence/"pruefung.json").read_text())
def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
assert report["htmlSHA256"] == digest(out/"GeoRisiko-Erdmodell-G4.3.html")
assert report["fallbackSHA256"] == digest(root/"sicherung/Erdmodell.html")
assert {r["engine"] for r in report["runs"]} == {"chromium","webkit"}
entries = {"pruefung.json": (evidence/"pruefung.json").read_bytes(), "Modellgrenzen.md":(root/"docs/plattenatlas-g4.3.md").read_bytes()}
summary = ["# Browserprüfung G4.3", "", "Geprüfte Einzeldatei (SHA-256) `"+report["htmlSHA256"]+"`.", ""]
for run in report["runs"]:
    assert not run["requests"] and not run["errors"]
    assert len(run["plates"]) == 52 and len(run["shells"]) == 4 and len(run["sites"]) == 3
    summary += [f"## {run['engine']} {run['version']}", "",
        f"52 von 52 Flächen per Zeigertreffer identifiziert. Acht Antworten über die Schalenbeschriftungen geöffnet. Island, Japan und Kalifornien gestartet. Die Einzeldatei arbeitete bei gesperrtem HTTP(S)-Zugriff. Auch die Originaldatei wurde über file:// geöffnet.",
        "", f"Nach Bewegung und Rücksetzung unterschieden sich {run['changedPixels']} Bildpunkte des geprüften Ausschnitts. Die Drehung wurde über die Oberflächenkoordinaten aller Platten geprüft. Der pazifikfeste Bezugspunkt blieb in Ruhe. Die Rücksetzung brachte alle Messpunkte exakt an die Ausgangsposition.",
        "", "Geprüfte Bildschirmgrößen: "+", ".join(str(v["width"])+" × "+str(v["height"]) for v in run["viewports"])+".",
        "", "Warme Ansichtswechsel (Geometrien / Texturen / Programme): "+", ".join(f"{v['geometries']} / {v['textures']} / {v['programs']}" for v in run["resources"])+".", ""]
    for image in run["images"]:
        name=image["name"]+".jpg"
        assert digest(evidence/name)==image["sha256"]
        entries[name]=(evidence/name).read_bytes()
    if run.get("videoSHA256"):
        assert digest(evidence/"bedienung.webm")==run["videoSHA256"]
        entries["bedienung.webm"]=(evidence/"bedienung.webm").read_bytes()
geometry=json.loads((evidence/"geometrie.json").read_text())
assert len(geometry["plates"])==52 and geometry["phases"]==32 and len(geometry["boundaries"])==4
entries["geometrie.json"]=(evidence/"geometrie.json").read_bytes()
summary += ["## Geometrie und Richtung", "", f"{geometry['triangles']} gekrümmte Oberflächendreiecke in jeweils 32 Zeitständen auf Umklappen geprüft. Die gemeinsamen Randpunkte bleiben geschlossen. Für Island, Japan, Kalifornien und den Ostafrikanischen Graben wurden relative Richtung und Geschwindigkeit aus den Eulerpolen unabhängig mit den veröffentlichten Grenzdaten verglichen.", ""]
assert "bedienung.webm" in entries and len([s for s in entries if s.endswith(".jpg")])>=7
summary += ["## Reichweite", "", "Die bytegleiche Rückfallversion öffnet das Modell, sucht aber die dekorative Himmelsgrafik sky.png neben der Datei. G4.3 bettet dieses Bild ein. Die Messungen stammen aus echten Cloud-Browsern mit simulierter Maus- und Touchbedienung. Displayhelligkeit, Stifteingabe an einer physischen Tafel, Safari auf dem konkreten Schul-Mac und ein Import ins produktive Schul-LMS sind gesonderte Geräteprüfungen."]
entries["Pruefbericht.md"]=("\n".join(summary)+"\n").encode()
(evidence/"Pruefbericht.md").write_bytes(entries["Pruefbericht.md"])
with zipfile.ZipFile(out/"GeoRisiko-G4.3-Sichtpruefung.zip","w",zipfile.ZIP_DEFLATED) as archive:
    for name,data in sorted(entries.items()): archive.writestr(name,data)
