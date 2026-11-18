# GeoRisiko 3D · Erdobservatorium

Ein deutschsprachiges 3D-Werkzeug für den Geographieunterricht der Jahrgangsstufe 9. Von der ganzen Erde führt ein unterbrechbarer Flug auf die Hanswarft der Hallig Hooge. Am selben Globus lässt sich ein Keil öffnen, um Kruste, Mantel und beide Kerne räumlich zu vergleichen.

In G1.1 lässt sich im Ortsmenü auch Helgoland erkunden. Der Korrekturbericht enthält die Messergebnisse, die Vergleichsbilder und die noch offenen Punkte für den Schuleinsatz. [Prüfbericht G1.1](docs/g1.1-pruefbericht.md)

G1.2 startet im Stil A. Der Unterricht beginnt mit der geschlossenen Erde und anonymen Schalen. **Namen einblenden** gibt die fachliche Erklärung gezielt frei. [Unterricht am 20. November](docs/unterricht-20-11.md) · [Prüfbericht G1.2](docs/g1.2-pruefbericht.md)

## In der Schule starten

**GeoRisiko-G1.2-Unterricht.zip** entpacken. Auf macOS mit Python 3 die Datei **START.command** öffnen. Alternativ im entpackten Ordner `python3 start_lokal.py` aufrufen. Die Ausgabe enthält Karten, Luftbilder, Schrift und 3D-Programm. Der Browser benötigt WebGL 2 für das räumliche Modell. Bei fehlendem WebGL erscheint eine beschriftete lokale Weltkarte.

| Ziel | Bedienung |
| --- | --- |
| Globus erkunden | Oberfläche ziehen, Mausrad oder zwei Finger zum Zoomen. Pfeiltasten und + / − funktionieren ebenfalls. |
| Um einen Ort blicken | Umschalt + Ziehen oder rechte Maustaste verändert Blickrichtung und Neigung. Die Kompasstaste wechselt die Neigung. |
| Warft betrachten | „Hallig Hooge besuchen“. Jede eigene Kamerabewegung unterbricht den Flug. „Zur globalen Ansicht“ startet den Rückflug. |
| Erdaufbau vergleichen | „Erdinneres“. Schicht in der Liste oder Schnittfläche anklicken, Auge für Sichtbarkeit, Regler für Deckkraft. „Namen einblenden“ gibt die Fachbegriffe frei. „Grundwissen“ öffnet Grundtext und Vertiefung. |
| Größenverhältnisse prüfen | Der Keil zeigt zunächst eine einheitliche Kruste von 35 km im richtigen Modellmaßstab. „Kruste verbreitern“ kennzeichnet die Überhöhung direkt an der Ansicht. |
| Designs vergleichen | A oder B wählen. Ausschnitt, Navigation, Warftlage und Schichtgrenzen bleiben vergleichbar. |
| Präsentieren | „Präsentieren“ blendet die Menüs aus und fordert Vollbild an. Die Steuerleiste wechselt zwischen Globus und Erdinnerem. Die Modellwerkzeuge bleiben seitlich erreichbar. „Menü zeigen“ kehrt zurück. Esc schließt einen Info-Dialog. Pos1 oder die Rücksetztaste stellen den Ausgangszustand der Ansicht wieder her. |

In einem itslearning-Kurs die Datei **GeoRisiko-G1.2-SCORM-1.2.zip** als SCORM-Lernpaket importieren. Diese Version meldet nur Start und Ende einer Sitzung. Die tatsächliche Verarbeitung im Schulmandanten ist noch zu erproben.

## Entwickeln und prüfen

Node 22.12+ oder Node 24, npm und Python 3.10+ für die Paketierung. Im Repository ausführen:

```sh
npm ci
npm run dev
```

Produktionsbuild und vollständiger Prüflauf:

```sh
npm run build
npx playwright install --with-deps chromium webkit
node tests/gate.mjs
npm test
npm run audit
python3 scripts/compare_views.py
npm run package
node tests/packages.mjs
```

`npm run preview` startet die gebaute App. Für vorhandene Testbrowser lassen sich `CHROMIUM_PATH` und `WEBKIT_PATH` setzen. `TEST_ENGINES=chromium npm test` ist ein Teillauf. Das Sichtprüfungs-ZIP setzt Ergebnisse beider Engines voraus. Für die MP4-Aufzeichnungen wird FFmpeg mit libx264 benötigt. Der Pakettest startet beide extrahierten ZIPs in einem verschachtelten HTTP-Unterpfad und besucht beide Orte.

## GitHub Pages und Übergabe

Der Workflow „GeoRisiko G1.2“ baut und prüft Pull Requests. Unter **Actions → Workflow-Lauf → Artifacts** stehen bei erfolgreichem Lauf die drei ZIPs als „GeoRisiko-G1.2-Pakete“ sowie „Browsertests“ bereit. Lokal liegen dieselben Dateien unter `artifacts/` und `test-results/`.

Für eine spätere Freigabe nach dem Merge auf `main` in **Settings → Pages → Source** „GitHub Actions“ wählen und den Workflow auf `main` mit `publish_pages` starten. Erst der explizite Veröffentlichungsauftrag löst das Deployment aus. Zielpfad ist `/Erdmodell/`. Relative Assetpfade erlauben andere statische Installationsorte und den SCORM-Unterordner.

## Dokumentation

- [Architekturentscheidung und technischer Nachweis](docs/architecture-decision.md)
- [Gestaltungsvarianten und Bedienung](docs/design-system.md)
- [Fachliche Validierung und Didaktik](docs/geoscience-validation.md)
- [Datenquellen, Lizenzen und Nachbau](docs/data-sources-and-licenses.md)
- [Neue Geodaten und Auflösungsgrenzen](docs/g1.1-data.md)
- [Historischer G1-Qualitätsbericht und Vergleichsbilder](docs/quality-report.md)
- [Roadmap G2–G7](docs/roadmap.md)
