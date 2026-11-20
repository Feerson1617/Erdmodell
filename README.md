# GeoRisiko 3D · Unterricht am 20. November 2026

Das Freitags-Paket startet am geschlossenen Globus. „Schalenschnitt“ öffnet die vier anonymen Schalen. [Unterrichtseinstieg, Geräteprobe und Rückfall](docs/freitag-20-11-2026.md)


GeoRisiko 3D zeigt den Erdaufbau im Geographieunterricht der Jahrgangsstufe 9. Die Anwendung öffnet einen drehbaren Globus im Grafikstil **Scientific Stylized Realism (A)**. **Schalenschnitt** gibt den Blick auf vier zunächst anonyme Schalen frei. Unter **Plattentektonik** lassen sich PB2002-Grenzen auf demselben Globus einblenden. Drei regional verankerte Schnittmodelle zeigen Divergenz bei Reykjanes, Subduktion am Japangraben und seitlichen Versatz bei Parkfield. Der gemeinsame Ortskatalog verbindet diese Regionen mit Hallig Hooge, Helgoland und dem Nyos-See in Kamerun.

**Nyos-See** führt vom Globus zu einer Landschaft aus Höhenraster und Satellitenbild. Seequerschnitt, historisch orientierte Erklärung der limnischen Gasfreisetzung von 1986 und spätere Risikominderung sind getrennt anwählbar. [Nyos im Unterricht](docs/nyos-unterrichtsverwendung.md) · [Fachliche Grundlagen](docs/nyos-geowissenschaften.md)

## Im Unterricht

Das Unterrichts-ZIP vollständig entpacken und mit installiertem Python 3 `START.command` auf macOS oder `python3 start_lokal.py` im entpackten Ordner starten. Dann die vom Starter angezeigte lokale Adresse öffnen. Beim direkten Doppelklick auf die HTML-Datei erscheint eine Starthilfe. Alle Laufzeitdaten liegen lokal bei. Für die 3D-Darstellung benötigt der Browser WebGL 2.

| Bedienung | Wirkung |
| --- | --- |
| Ziehen oder Pfeiltasten | Modell drehen. Zwei Finger, Mausrad oder + / − verändern den Zoom. |
| Schale im Schnitt oder in der Liste wählen | Schale hervorheben. Augen, Deckkraft und „Einzeln zeigen“ steuern ihre Sichtbarkeit. |
| Namen zeigen | Die Lehrkraft gibt die Namen frei. Ein Tipp auf einen Namen am Modell öffnet die Erklärung. |
| Außenschale verbreitern | Die didaktische Überhöhung wird am Modell gekennzeichnet. Erneutes Antippen stellt die Referenzgröße wieder her. |
| P- und S-Wellen | Eine Modellzeichnung zeigt die Ausbreitung an der Grenze zu einer Flüssigkeit. |
| Plattengrenzen zeigen | In der Plattenansicht Grenzverläufe, Namen und Typen zuschalten. Eine Linie antippen oder eine Platte hervorheben. |
| Region erkunden | Der Flug führt zum lokalen Erklärschnitt. „Region“ zeigt den größeren geografischen Zusammenhang. |
| Abspielen | Die Bewegung läuft bis zur Endlage. Pause, Zeitlupe, Wiederholen und Rücksetzen stehen neben dem Modell. |
| Nyos-See | Die Landschaft betrachten. Über „Im See“ Schichtung und gelöstes CO₂ erkunden. „CO₂-Freisetzung“ und „Schutz“ öffnen die zeitlich getrennten Erklärungen. |
| Präsentieren | Vergrößert die Bedienelemente und nutzt Vollbild, soweit der Browser dies erlaubt. |
| Rücksetzpfeil oder Pos1 | Zum anonymen Globus und zur ursprünglichen Kamera zurückkehren. |

Die Lehrkraft kann einzelne Schalennamen nach der Auswahl freigeben. Ein Tipp auf einen freigegebenen Namen öffnet seine kurze Definition neben dem Modell. Die optionale Schraffur zeigt die Lithosphäre im Referenzmaßstab. Wer die Kruste verbreitert, schaltet die Schraffur aus. Die regionalen Prozessmodelle verwenden dieselben antippbaren Namen. [Unterrichtshinweise und Qualitätsprüfung G4.2.1](docs/qualitaet-g4.2.1.md)

Unterrichtsanleitung, Modellgrenzen und fachliche Quellen stehen der Lehrkraft zur Vorbereitung zur Verfügung. [Nyos-Unterrichtsbesuch am 15. Dezember](docs/nyos-unterrichtsverwendung.md) · [Bisheriger Unterrichtsvorschlag zur Plattentektonik](docs/unterricht-15-12.md) · [Schalenmodell am 20. November](docs/unterricht-20-11.md) · [Fachanhang Plattentektonik](docs/g2.1-daten.md)

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
mkdir -p .scratch/g421-reference
git archive 441f1480b6fc1d65faf5ef5b06882ccdc6775656 | tar -x -C .scratch/g421-reference
npm --prefix .scratch/g421-reference run build
npm run test:vergleich
REFERENCE_BUILD=.scratch/g421-reference/dist TEST_ENGINES=chromium npm run test:grundlagen
mkdir -p .scratch/g422-reference
git archive 1caab5e3578cff1c92814ccb781f3069f9be3dbd | tar -x -C .scratch/g422-reference
npm --prefix .scratch/g422-reference run build
npm run test:freitag
npm run package
node tests/packages.mjs
```

`npm run preview` startet den Produktionsbuild. `CHROMIUM_PATH` und `WEBKIT_PATH` wählen vorhandene Browser. Die Paketierung gleicht Unterrichts- und Regressionstests beider Browser mit dem aktuellen Git-Commit ab.

## Pakete und Nachweise

Im erfolgreichen GitHub-Actions-Lauf stehen die drei G4.2.2-ZIPs einzeln unter **Artifacts** zum Download. Sie liegen beim lokalen Build unter `artifacts/`.

- **Unterricht** enthält die ausführbare Offline-Anwendung, den lokalen Starter und die Unterrichtsanleitung.
- **SCORM-1.2** wird als ZIP in das LMS importiert. Das Paket meldet Sitzungsstart und -ende.
- **Sichtpruefung** enthält die ausführbare Anwendung, 52 aktuelle Bildschirmaufnahmen, zwölf Vergleichsbilder aus G4.2, sieben Bildpaare des Schalenvergleichs mit G4.2.1, fünf Bedienvideos und die Prüfberichte.

Der gesicherte Ausgangsstand G1.3.1 liegt bei `c806a1b`. Der Abschlussbericht ordnet Daten, Erklärmodelle und Messergebnisse ein. [Abnahmebericht G2.1](docs/g2.1-bericht.md) · [Originalpakete G1.3.1](https://github.com/Feerson1617/Erdmodell/tree/096e7fc278307d128cdc46fa934ba5d495c5cc05/sicherung) · [Roadmap](docs/roadmap.md)

G4 basiert auf dem geprüften G2.1-Commit `3eb1487`. [Abnahme Nyos](docs/nyos-abnahme.md) · [Geodaten](docs/nyos-geodaten.md) · [Architektur](docs/nyos-technik.md) · [Gestaltung](docs/nyos-design.md)

## G4.3 · Interaktiver Plattenatlas

Die neue Offline-Einzeldatei startet per Doppelklick. Der Atlas zeigt die 52 PB2002-Platten, ihre relative Bewegung und drei regionale Prozesse. Freigegebene Erdschalen bieten kurze Antworten zu Material und Entstehung. Die Bedienung, Quellen und fachlichen Grenzen stehen im [Begleittext](docs/plattenatlas-g4.3.md). Die [hochgeladene Einzeldatei](sicherung/Erdmodell.html) ist als Rückfallversion gesichert.
