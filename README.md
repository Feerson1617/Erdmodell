# GeoRisiko 3D · Erdobservatorium

GeoRisiko 3D zeigt den Erdaufbau im Geographieunterricht der Jahrgangsstufe 9. G1.3.1 öffnet einen drehbaren Globus im Grafikstil **Scientific Stylized Realism (A)**. **Schalenschnitt** gibt den Blick auf vier zunächst anonyme Schalen frei. Über **Orte** bleiben die Hanswarft auf Hallig Hooge und Helgoland erreichbar.

## Im Unterricht

Das Unterrichts-ZIP vollständig entpacken und mit installiertem Python 3 `START.command` auf macOS oder `python3 start_lokal.py` im entpackten Ordner starten. Alle Laufzeitdaten liegen lokal bei. Für die 3D-Darstellung benötigt der Browser WebGL 2.

| Bedienung | Wirkung |
| --- | --- |
| Ziehen oder Pfeiltasten | Modell drehen. Zwei Finger, Mausrad oder + / − verändern den Zoom. |
| Schale im Schnitt oder in der Liste wählen | Schale hervorheben. Augen, Deckkraft und „Einzeln zeigen“ steuern ihre Sichtbarkeit. |
| Namen zeigen | Die Lehrkraft gibt die Namen und die nummerierte Zuordnung frei. Die Auswahl einer Schale zeigt einen kurzen Text. |
| Außenschale verbreitern | Die didaktische Überhöhung wird am Modell gekennzeichnet. Erneutes Antippen stellt die Referenzgröße wieder her. |
| P- und S-Wellen | Eine Modellzeichnung zeigt die Ausbreitung an der Grenze zu einer Flüssigkeit. |
| Präsentieren | Vergrößert die Bedienelemente und nutzt Vollbild, soweit der Browser dies erlaubt. |
| Rücksetzpfeil oder Pos1 | Zum anonymen Globus und zur ursprünglichen Kamera zurückkehren. |

Unterrichtsanleitung, Modellgrenzen und fachliche Quellen stehen der Lehrkraft zur Vorbereitung zur Verfügung. [Unterricht am 20. November](docs/unterricht-20-11.md) · [Fachlicher Hintergrund](docs/geoscience-validation.md)

## Entwicklung und Prüfung

Node 22.12+ oder Node 24, npm, Python 3.10+ und FFmpeg mit libx264 werden für den vollständigen Prüflauf benötigt.

```sh
npm ci
npm run dev
```

```sh
npm run build
npx playwright install --with-deps chromium webkit
node tests/gate.mjs
npm test
npm run audit
npm run package
node tests/packages.mjs
```

`npm run preview` startet den Produktionsbuild. `CHROMIUM_PATH` und `WEBKIT_PATH` wählen vorhandene Browser. Die Paketierung gleicht Unterrichts- und Regressionstests beider Browser mit dem aktuellen Git-Commit ab.

## Pakete und Nachweise

Im erfolgreichen GitHub-Actions-Lauf stehen die drei ZIPs einzeln unter **Artifacts** zum Download. Sie liegen beim lokalen Build unter `artifacts/`.

- **Unterricht** enthält die ausführbare Offline-Anwendung, den lokalen Starter und die Unterrichtsanleitung.
- **SCORM-1.2** wird als ZIP in das LMS importiert. Das Paket meldet Sitzungsstart und -ende.
- **Sichtpruefung** enthält die ausführbare Anwendung, zehn Bildschirmaufnahmen, ein Bedienvideo und die Prüfberichte.

Der gesicherte Ausgangsstand ist G1.3 auf `release/g1.3-unterricht-2026-11-20` bei `7cc7d86`. [Prüfbericht G1.3.1](docs/g1.3.1-pruefbericht.md) · [Geodaten und Lizenzen](docs/data-sources-and-licenses.md) · [Architektur](docs/architecture-decision.md)
