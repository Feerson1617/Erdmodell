"""Package content-addressed browser evidence, camera checks and the measured comparison."""
import hashlib
import json
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
out = root / "artifacts"
evidence = root / "test-results/plattenatlas"
html = "GeoRisiko-Erdmodell-G4.3.1.html"
archive_name = "GeoRisiko-G4.3.1-Sichtpruefung.zip"
def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

entries = {}
def data(name):
    entries[name] = (evidence/name).read_bytes()
    return json.loads(entries[name])

report = data("pruefung.json")
geometry = data("geometrie.json")
performance = data("leistungsvergleich.json")
assert report["htmlSHA256"] == digest(out/html)
assert report["fallbackSHA256"] == digest(root/"ausgabe/GeoRisiko-Erdmodell-G4.3.html")
runs = report["runs"]
assert {r["engine"] for r in runs} == {"chromium","webkit"}
assert len(geometry["plates"])==52 and geometry["phases"]==32
assert len(performance)==4 and all(len(r["stages"])==4 for r in performance)
camera = {}
for run in runs:
    assert len(run["plates"])==52 and len(run["shells"])==4 and set(run["sites"])=={"island","japan","san"}
    assert not run["requests"] and not run["errors"] and run["files"]==[html]
    assert len(run["viewports"])==4 and run["relativePixels"]>32
    camera[run["engine"]]={"platten":run["plates"],"bildschirme":run["viewports"]}
    for image in run["images"]:
        name=image["name"]+".jpg"
        assert image["sha256"]==digest(evidence/name)
        entries[name]=(evidence/name).read_bytes()
    if "videoSHA256" in run:
        assert run["videoSHA256"]==digest(evidence/"bedienung.webm")
        entries["bedienung.webm"]=(evidence/"bedienung.webm").read_bytes()

entries["kamerapruefung.json"]=json.dumps(camera,indent=2,ensure_ascii=False).encode()
entries["Fachanhang.md"]=(root/"docs/plattenatlas-g4.3.1.md").read_bytes()
assert len([name for name in entries if name.endswith(".jpg")])==18 and "bedienung.webm" in entries
pairs=list(geometry["pairs"].values())
brief=[
"# GeoRisiko G4.3.1 · Abschlussbericht", "", "Geprüfte Einzeldatei, SHA-256 `"+report["htmlSHA256"]+"`.", "",
"1. Im heutigen Weltatlas sind die Grenzpunkte ortsfest. Die frühere ortsabhängige Verformung im Bewegungsmodus wurde vollständig entfernt.",
f"2. Alle {len(pairs)} Vergleichspaare verwenden starre Drehungen. Maximal gemessene Distanzabweichung innerhalb eines Körpers: {max(p['maxError'] for p in pairs):.2g} km. Die Orthogonalität der Körpermatrizen sichert die Distanzen für alle Meshpunkte.",
"3. Zwei Gesteinsausschnitte zeigen horizontale Relativbewegung an einem namentlich bekannten PB2002-Segment. Die ursprünglichen vertiefenden Prozesse bei Island, Japan und Kalifornien bleiben erhalten.",
f"4. Die Ausgangsdaten sind pazifikfest. Der örtliche Vergleich teilt den Differenzvektor beider Winkelgeschwindigkeiten symmetrisch auf die Körper auf. Größte Abweichung von der gerundeten, veröffentlichten Segmentrichtung: {max(p['bearingError'] for p in pairs):.2f}°.",
f"5. Dicke, Anfangsabstand und Zeit sind schematisch. Keine historische Rekonstruktion. Die geprüfte kontinuierliche Untergrenze des Abstands der beiden Körper beträgt über alle Paare {min(p['continuousGap'] for p in pairs):.2f} Modellkilometer. Beim Auseinanderrücken wird eine neutrale Zeichenfläche sichtbar.",
"6. Der helle Gesteinsstreifen zeigt den Versatz. Im Kalifornien-Vergleich verschoben sich die projizierten Punkte der beiden Körper relativ zueinander um "+' / '.join(f"{r['relativePixels']:.0f} px ({r['engine']})" for r in runs)+". Start, Zwischenstand, Endstand und Reset sind echte Browseraufnahmen. Eine Unterrichtserprobung mit Lernenden steht aus.",
"7. Der Kameraabstand hängt von Umriss, Blickfeld und freiem Bildschirmraum ab. Die Tabelle unten zeigt die besonders geprüften Platten.",
"8. Beide Browser trafen alle 52 Platten mit Maus oder Touch auf dem gerenderten Körper. Nach dem Zentrieren waren jeweils weitere Platten sichtbar. Anschließende Rotation und Rückkehr zur Weltansicht wurden ausgeführt.",
"9. Alle Steckbriefe verwenden fest ausgewählte, verortete Beispiele. Die Himmelsrichtung bezieht sich auf die ausdrücklich benannte Nachbarplatte. Der Fachanhang erklärt die Auswahl.",
"10. Im Smartboard-Bild bei 1920 × 1080 sind der vollständige Plattenname, die drei kurzen Abschnitte und der Schließen-Knopf nebeneinander mit dem Globus lesbar. Im Tablet-Hochformat steht der Steckbrief unter dem Globus. Auch bei 1366 × 768 und 1024 × 768 wurde geprüft, dass der Steckbrief oben beginnt, der Titel sauber umbricht und das Schließziel mindestens 44 CSS-Pixel hoch ist. Die Lesbarkeit aus der letzten Reihe hängt vom realen Gerät und Raum ab.",
"11. Der Schalenschnitt öffnete sich anonym. Beide Browser gaben die vier Namen frei und öffneten und schlossen alle acht Antworten. Krustenmaßstab und Lithosphärenvergleich gehören zusätzlich zur Schalenregression.",
"12. Chromium und WebKit öffneten die Einzeldatei unter file:// bei gesperrtem HTTP(S). Es gab keine weiteren Dateianforderungen und keine Browserfehler.",
"13. Die Browserprotokolle belegen Flächentreffer, Kamera, Auswahl, Wiedergabe, Pause, Reset, Schalen, drei Regionen und Rückkehr. Die weiteren Testjobs im Pull Request prüfen auch Nyos, Navigation, Schulstunde und das entpackte SCORM-Paket.",
"14. Die folgenden Tabellen vergleichen dieselben Cloud-Browser, Auflösungen und Eingabefolgen. Die beiden Bewegungsansichten haben unterschiedliche Bildausschnitte. CPU-Prozent beziehen sich auf einen logischen Kern. Geometrien, Texturen und Programme sind Ressourcenindikatoren. GPU-Speicher in Bytes wurde nicht gemessen.",
"15. Die Werte betreffen Linux-Rendering. MacBook Air M1, iPad, physisches Smartboard und der Import ins produktive itslearning wurden nicht an Originalgeräten geprüft. Ein regionaler Schnitt kann auch Biegung oder Materialtransport erklären. Der Starrheitstest bezieht sich auf die beiden Körper jedes neuen Grenzvergleichs.",
f"16. Die drei fertigen Dateien stehen im Ordner ausgabe des Entwicklungsbranches und als einzelne Artefakte des erfolgreichen Prüflaufs im Pull Request. Die gesicherte G4.3-Einzeldatei steht im selben Ordner. [Einzeldatei und ZIPs](https://github.com/Feerson1617/Erdmodell/tree/feature/georisiko-g4-3-1-plattenkorrektur/ausgabe) · [Prüfläufe](https://github.com/Feerson1617/Erdmodell/pull/10/checks)", "",
"## Kameraprüfung", "", "Stichprobe aus dem vollständigen Chromium-Flächentest. Die Spannweite ist aus einem Raster auf der frei sichtbaren Modellfläche bestimmt.", "",
"| Platte | Kameraabstand (km) | erfasste Spannweite (px) | weitere sichtbare Platten |","|---|---:|---:|---:|"]
plates=next(r for r in runs if r["engine"]=="chromium")["plates"]
for code in ["PA","NA","EU","AF","AU","NZ","GP","FT"]:
    p=plates[code]
    brief.append(f"| {p['name']} | {p['pose'][2]:.0f} | {p['span']:.0f} | {len(set(p['coverage'])-{code,''})} |")
brief += ["","## Performancevergleich","", "| Engine | Version | Ansicht | FPS | P95 / längste Pause (ms) | Bilder >150 ms | CPU % | Geom. / Text. / Programme am Ende |","|---|---|---|---:|---:|---:|---:|---|"]
for row in performance:
    for s in row["stages"]:
        end=s["states"][-1]
        brief.append(f"| {row['engine']} | {row['version']} | {s['stage']} | {s['fps']:.1f} | {s['p95']:.0f} / {s['max']:.0f} | {s['over150']} | {s['cpuPercent']:.0f} | {end['geometries']} / {end['textures']} / {end['programs']} |")
brief += ["", "### Einordnung für den Unterricht", ""]
for engine in ("chromium", "webkit"):
    movement = {r["version"]: next(s for s in r["stages"] if s["stage"]=="Bewegung")
                for r in performance if r["engine"]==engine}
    old, new = movement["G4.3"], movement["G4.3.1"]
    name = "WebKit" if engine=="webkit" else "Chromium"
    brief.append(f"- {name} erreichte in der Bewegung {old['fps']:.1f} Bilder/s mit G4.3 und {new['fps']:.1f} mit G4.3.1. Die längste Bildpause betrug {old['max']:.0f} bzw. {new['max']:.0f} ms.")
brief += ["", "Am hellen Streifen lässt sich beim Anhalten erkennen, welche Seite sich wie weit verschoben hat. Die Beschriftungen ordnen beide Ausschnitte ihren Platten zu. Der globale Vergleich zeigt eine horizontale Bewegung. Für das Abtauchen eignet sich der Japan-Schnitt. Die gemessenen Bildpausen begrenzen die Flüssigkeit auf Software-Renderern.", "",
          "Vom Browser gemeldete Renderer", "", *["- "+r["engine"]+" — "+r["renderer"] for r in performance if r["version"]=="G4.3.1"], "",
          "Beide Browser liefen im Linux-Container. WebKit kann die verallgemeinerte WebGL-Kennung „Apple GPU“ melden. Für die Einordnung der Messwerte gilt die tatsächliche Testumgebung.", ""]
entries["Pruefbericht.md"]="\n".join(brief).encode()
(evidence/"Pruefbericht.md").write_bytes(entries["Pruefbericht.md"])
with zipfile.ZipFile(out/archive_name,"w",zipfile.ZIP_DEFLATED) as z:
    for name,contents in sorted(entries.items()):z.writestr(name,contents)
with zipfile.ZipFile(out/archive_name) as z:
    assert z.testzip() is None and all(z.read(name)==value for name,value in entries.items())
print(out/archive_name)
