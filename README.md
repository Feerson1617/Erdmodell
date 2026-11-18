# GeoRisiko 3D · Erdobservatorium

GeoRisiko 3D zeigt den Erdaufbau im Geographieunterricht der Jahrgangsstufe 9. G2.1 öffnet einen drehbaren Globus im Grafikstil **Scientific Stylized Realism (A)**. **Schalenschnitt** gibt den Blick auf vier zunächst anonyme Schalen frei. Unter **Plattentektonik** lassen sich PB2002-Grenzen auf demselben Globus einblenden. Drei regional verankerte Schnittmodelle zeigen Divergenz bei Reykjanes, Subduktion am Japangraben und seitlichen Versatz bei Parkfield. Der gemeinsame Ortskatalog enthält außerdem die Hanswarft auf Hallig Hooge und Helgoland.

## Im Unterricht

Das Unterrichts-ZIP vollständig entpacken und mit installiertem Python 3 `START.command` auf macOS oder `python3 start_lokal.py` im entpackten Ordner starten. Dann die vom Starter angezeigte lokale Adresse öffnen. Beim direkten Doppelklick auf die HTML-Datei erscheint eine Starthilfe. Alle Laufzeitdaten liegen lokal bei. Für die 3D-Darstellung benötigt der Browser WebGL 2.

| Bedienung | Wirkung |
| --- | --- |
| Ziehen oder Pfeiltasten | Modell drehen. Zwei Finger, Mausrad oder + / − verändern den Zoom. |
| Schale im Schnitt oder in der Liste wählen | Schale hervorheben. Augen, Deckkraft und „Einzeln zeigen“ steuern ihre Sichtbarkeit. |
| Namen zeigen | Die Lehrkraft gibt die Namen und die nummerierte Zuordnung frei. Die Auswahl einer Schale zeigt einen kurzen Text. |
| Außenschale verbreitern | Die didaktische Überhöhung wird am Modell gekennzeichnet. Erneutes Antippen stellt die Referenzgröße wieder her. |
| P- und S-Wellen | Eine Modellzeichnung zeigt die Ausbreitung an der Grenze zu einer Flüssigkeit. |
| Plattengrenzen zeigen | In der Plattenansicht Grenzverläufe, Namen und Typen zuschalten. Eine Linie antippen oder eine Platte hervorheben. |
| Region erkunden | Der Flug führt zum lokalen Erklärschnitt. „Region“ zeigt den größeren geografischen Zusammenhang. |
| Abspielen | Die Bewegung läuft bis zur Endlage. Pause, Zeitlupe, Wiederholen und Rücksetzen stehen neben dem Modell. |
| Präsentieren | Vergrößert die Bedienelemente und nutzt Vollbild, soweit der Browser dies erlaubt. |
| Rücksetzpfeil oder Pos1 | Zum anonymen Globus und zur ursprünglichen Kamera zurückkehren. |

Unterrichtsanleitung, Modellgrenzen und fachliche Quellen stehen der Lehrkraft zur Vorbereitung zur Verfügung. [Unterricht am 15. Dezember](docs/unterricht-15-12.md) · [Schalenmodell am 20. November](docs/unterricht-20-11.md) · [Fachanhang Plattentektonik](docs/g2.1-daten.md)

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

Im erfolgreichen GitHub-Actions-Lauf stehen die drei G2.1-ZIPs einzeln unter **Artifacts** zum Download. Sie liegen beim lokalen Build unter `artifacts/`.

- **Unterricht** enthält die ausführbare Offline-Anwendung, den lokalen Starter und die Unterrichtsanleitung.
- **SCORM-1.2** wird als ZIP in das LMS importiert. Das Paket meldet Sitzungsstart und -ende.
- **Sichtpruefung** enthält die ausführbare Anwendung, zwanzig Bildschirmaufnahmen, zwei Bedienvideos und die Prüfberichte.

Der gesicherte Ausgangsstand G1.3.1 liegt bei `c806a1b`. Der Abschlussbericht ordnet Daten, Erklärmodelle und Messergebnisse ein. [Abnahmebericht G2.1](docs/g2.1-bericht.md) · [Originalpakete G1.3.1](https://github.com/Feerson1617/Erdmodell/tree/096e7fc278307d128cdc46fa934ba5d495c5cc05/sicherung) · [Roadmap](docs/roadmap.md)
