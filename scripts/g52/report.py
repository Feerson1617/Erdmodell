"""Release evidence from the mounted product, its offline counterpart and verified baseline images."""
from html import escape
from pathlib import Path
import hashlib
import json
import statistics

def evidence(root, out, raw):
    app, web = raw["runs"]
    lesson = app["g52"]
    for row in (app, web):
        test = row["g52"]
        assert len(test["steps"]) == 13 and test["marker"]["end"] > test["marker"]["start"]
        assert test["coast"]["peak"]["newlyWet"] > test["coast"]["ebb"]["newlyWet"]
        assert test["coverage"] == dict(gesamt=5819, Subduktion=1127, komplex=43, schraeg=435, unsichereHoehe=246)
    assert len(lesson["movies"]) == 2 and len(lesson["pictures"]) >= 17
    for movie in lesson["movies"]:
        assert movie["frames"] >= 5 and (out/"G52"/(movie["name"]+".mp4")).is_file()
    for name in lesson["pictures"]:
        assert (out/"G52"/(name+".jpg")).stat().st_size > 1000
    resources=json.loads((out/"G52/Ressourcen.json").read_text())
    assert resources["resources"]==len(resources["sha256"])>=348
    previous = root/"docs/g52-bildvergleich"
    files = {"Vergleich/G5.1/"+p.relative_to(previous).as_posix():p for p in previous.rglob("*") if p.is_file()}
    pairs = []
    for name in lesson["pictures"][2:6]:
        pairs.append(("Oben/"+name,"G52/"+name,"Eigene Kamera auf identischer Position, G5.1 aus der veröffentlichten HTML."))
    for name in ["02-Parkfield-Schnitt","04-Elastische-Verformung","06-Wellenfronten","08-Miyagi-Plattenkontakt","10-Wassersaeule","11-Ausbreitung","17-Vulkanbogen","20-Ascheausbruch","24-Ereigniskarte","29-Beobachten","30-Smartboard"]:
        pairs.append((name,"G51/"+name,"Gleiche Bedienfolge und Modellzeit, beide Aufnahmen aus der installierten App."))
    pairs += [("12-Kueste","G52/13-Kueste-Ueberflutung","G5.1 Japanprofil und G5.2 separates synthetisches Küstenprofil. Unterschiedliche Landschaften."),
              ("25-Tiefenquerschnitt","G52/15-Tiefenschnitt-Messpunkte","Seitenleiste und großformatige Analyse."),
              ("21-Kontinentalbewegung","G52/17-Zeitreise-Beobachten","Rekonstruktion mit unterschiedlicher Zeit und Bedienoberfläche."),
              ("24-Ereigniskarte","G52/01-Karte-ohne-Grenzen","Datenebenen im Beobachtungsmodus."),
              ("11-Ausbreitung","G52/11-Offenes-Meer","Geologischer Schnitt und gezielte Perspektive auf das offene Meer.")]
    gallery=['<!doctype html><html lang="de"><meta charset="utf-8"><title>Bildvergleich GeoRisiko</title><style>body{max-width:1600px;margin:auto;font:18px system-ui;background:#15231f;color:#e9eee6}section{padding:1rem}figure{margin:0;width:49%}img{width:100%}.pair{display:flex;gap:1%}h2{font-size:1.25rem}</style><h1>GeoRisiko · Bildvergleich</h1>']
    for left,right,note in pairs:
        assert (previous/(left+".jpg")).is_file() and (out/(right+".jpg")).is_file()
        gallery.append('<section><h2>'+escape(right.split("/")[-1].replace("-"," "))+'</h2><p>'+escape(note)+'</p><div class="pair">')
        for label,src in [("G5.1","Vergleich/G5.1/"+left+".jpg"),("G5.2",right+".jpg")]:
            gallery.append(f'<figure><figcaption>{label}</figcaption><a href="{src}"><img loading="lazy" src="{src}" alt="{label}"></a></figure>')
        gallery.append("</div></section>")
    (out/"Bildvergleich.html").write_text("\n".join(gallery)+"</html>")
    files["Bildvergleich.html"]=out/"Bildvergleich.html"
    marker=lesson["marker"];coast=lesson["coast"]
    long=app["classroom"];samples=long["samples"];homes=long["home"]
    report=["# GeoRisiko G5.2 · Unterrichts- und Freigabeprüfung","",
            f"Geprüfter Commit `{raw['commit']}`. [macOS-Lauf](https://github.com/Feerson1617/Erdmodell/actions/runs/{raw['run']})","",
            "Die aus dem ausgeworfenen DMG kopierte ARM64-App und die eigenständig geöffnete HTML wurden offline bedient. Die Rohdaten stehen in Pruefung.json und G52. Der Vergleich mit G5.1 lässt sich über Bildvergleich.html offline öffnen.","",
            "## Unterrichtsfolge für Klasse 9","","Leitfrage der 45-Minuten-Stunde: Warum bebt die Erde plötzlich, obwohl sich die Erdplatten nur sehr langsam bewegen? Die technische Probe fährt die Bedienfolge komprimiert ab. Eine Beobachtung von Lernenden liegt nicht vor.","",
            "|Schritt|Bedienhandlungen|Zeit bis zum stabilen Bild inkl. Bedienung|Ansicht|","|---|---|---:|---|"]
    report.insert(5,f"App und HTML enthalten {resources['resources']} bytegleiche eingebettete Ressourcen. Auch Renderer und Stylesheet stimmen nach der für die Einzeldatei nötigen URL-Einbettung überein.")
    for step in lesson["steps"]:
        report.append(f"|{step['label']}|{', '.join(step['actions']) or 'Beobachtung'}|{step['ms']} ms|{step.get('view') or step['mode'] or 'Globus'}|")
    report.extend(["","Kamera, Wiedergabe, Ereigniszeit und offene Antworten sind pro Schritt protokolliert. Die Kameravorgaben wechseln bei ausdrücklicher Ansichts- oder Regionswahl. Die acht Vorbereitungsszenen bleiben frei wählbar.","",
        "## Was war zu beobachten?","",
        f"Die Enden desselben schematischen Wegs liegen anfangs zusammen. Ihr seitlicher Abstand beträgt bei Spannungsaufbau {marker['strain']:.3f}, beim aufgerufenen Bruch {marker['rupture']:.3f} und danach {marker['end']:.3f} Modelleinheiten. Der bleibende Versatz ist am selben Weg in derselben Perspektive vergleichbar. An acht Ereigniszeiten beträgt die maximale Abweichung der gezeichneten Stirnflächen von der Schnittebene {max(x[1] for x in lesson['cut']):.2g}.",
        "","Aus der Abfolge lassen sich langsame Relativbewegung, elastische Verformung und plötzliches Gleiten unterscheiden. P- und S-Wellen laufen unterschiedlich schnell. Die Gesteinspunkte schwingen lokal. Die Wellenfrontbilder und der Film halten den zeitlichen Zusammenhang mit der Oberflächenerschütterung fest.","",
        f"Im gesonderten schematischen Küstenmodell werden {coast['peak']['newlyWet']} ursprünglich trockene Zellen nass, beim Rückzug sind noch {coast['ebb']['newlyWet']} nass. Das sind Flachwasserergebnisse bei identischem Schwellenwert 0,001 in Modelllängeneinheiten. Die Ufermarkierung bleibt am Ausgangsufer. G52/Unterricht-App.json enthält die ganze Zeitreihe. Die Überflutung gehört nicht zum realen Japanprofil.",
        "","Die gleichphasigen Ereignisse A, B und C trennen Seitenversatz, Überschiebung mit Bodenhebung und tieferen Bruch. Nur das gewählte Hebungsbeispiel treibt die Wasserrechnung an. Daraus kann die Klasse begründen, weshalb nicht jedes Seebeben einen Tsunami auslöst.","",
        "Der Tiefenschnitt zeigt zunächst alle 176 projizierten Katalogbeben. Eine Lehrkraft kann die Linie durch die 13 unabhängigen Tiefenstützpunkte und ein Tiefenraster getrennt hinzufügen. Streuung und Beben außerhalb der Kontaktstruktur bleiben erhalten.","",
        "Alle 5.819 Grenzabschnitte wurden klassifiziert. Die 1.127 Polungen folgen dem gerichteten Datensatz. 43 komplexe Abschnitte erhalten keinen lokalen Herd. Bei 246 unsicheren Höhenlagen bleibt die Ereignisbezeichnung neutral. An 435 Subduktionsabschnitten erreicht die seitliche Komponente mindestens die Hälfte des Betrags. Die Pfeile unterscheiden Gesamtbewegung, Längs- und Querkomponente.","",
        "## Belastung, Grenzen und gefundene Probleme","",
        f"Der virtuelle Apple-Silicon-Lauf dauerte {long['elapsedMs']/60000:.2f} Minuten und umfasst {len(samples)} Messfenster an drei Renderauflösungen. Die längste Einzelpause war {max(s['max'] for s in samples):.1f} ms. Erster Seitenaufbau bis Bereitschaft: App {app['initialPageReadyMs']:.0f} ms, HTML {web['initialPageReadyMs']:.0f} ms. Das ist ein Start im jeweiligen Prüfprozess.",
        "","Die Rückkehrmessungen erfassen den Prozessbaum und die GPU-Ressourcen im gleichen Globusmodul nach wiederholten Modulwechseln. Viewport und Caches beeinflussen RSS. Ein kurzer Anstieg allein belegt kein Leck. Die vollständigen Messfenster einschließlich Zukunftsvergleich, Ladezeiten und Speicher stehen in Pruefung.json.","",
        "|Gerenderter Viewport|Rückkehrmessungen|RSS früh / spät (MiB)|Geometrien früh / spät|Texturen früh / spät|","|---|---:|---:|---:|---:|"])
    for width in sorted(set(v["width"] for v in homes)):
        vs=[v for v in homes if v["width"]==width];a,b=vs[0],vs[-1]
        report.append(f"|{width}×{a['height']}|{len(vs)}|{a['rssMiB']:.0f} / {b['rssMiB']:.0f}|{a['geometries']} / {b['geometries']}|{a['textures']} / {b['textures']}|")
    report.extend(["","G5.1 erreichte im kurzen nativen Tsunamifenster 34,3 FPS, einzelne Pausen bis 368,1 ms und ungefähr 924 bis 1.084 MiB im Langzeittest. Die aktuellen Rohwerte stehen zusätzlich im Bestandsprüfbericht. Messzeit, Cachefüllung und Runnerzustand begrenzen die Vergleichbarkeit.","",
         "Während der Entwicklung zeichnete die erste Küstenfassung zu wenig Überflutungsbreite. Die Profilprobe prüfte Anstieg und Rückzug getrennt. Der aktuelle Test liest berechnete Wassertiefen und vergleicht zusätzlich die gerenderte Küste mit der anfänglichen Uferlinie. Der Schnitt durch die bewegten Parkfield-Blöcke wird an einer festen Ebene neu abgetastet.","",
         "Der physische Mac-Test entfiel auf ausdrücklichen Wunsch. Thermische Dauerlast am lüfterlosen M1, Blickabstand im Klassenraum und ein angeschlossenes Smartboard bleiben ungemessen. Der lokale Gerätetest ist weiter verfügbar. Gatekeeper kann die ad hoc signierte, nicht notarisierte App nach einem Download zurückweisen. Installation und tatsächliche Runnerbewertung stehen in Dokumentation/mac-installation.md und installation.log.","",
         "Die wissenschaftlichen Daten und ihre Grenzen stehen im Quellenkatalog. Schematische Bewegungen, Zeitraffung und Höhenüberhöhung erlauben weder eine örtliche Bruchvorhersage noch eine Berechnung realer Überflutungsflächen. Begründungen, Kontroversen und Lernfortschritte erfordern den Unterricht.","",
         "## Lieferung","","Die Artefakte des verlinkten Laufs enthalten DMG, App-ZIP, Offline-HTML und dieses Sichtprüfungspaket. SHA256-Produkte.txt enthält die drei Produktprüfsummen. SHA256-Inhalt.txt weist alle übrigen Paketbestandteile einzeln aus."])
    report_file=out/"G5.2-Abnahmebericht.md";report_file.write_text("\n".join(report)+"\n")
    files[report_file.name]=report_file
    return files
