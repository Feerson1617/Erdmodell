# GeoRisiko für Mac

GeoRisiko ist ein offline nutzbares 3D-Erdobservatorium für den Geographieunterricht. Die Lehrkraft zeigt am Globus Erdschalen, Plattengrenzen, regionale Prozesse und den Nyos-See. Die Mac-App und die einzelne Test-HTML verwenden denselben Three.js-Kern.

## Auf dem Mac starten

Voraussetzung ist ein Mac mit Apple Silicon und macOS 13 Ventura oder neuer.

Das Artefakt **GeoRisiko-G5-macOS-arm64.dmg** aus dem erfolgreichen macOS-Lauf laden, öffnen und **GeoRisiko** auf **Programme** ziehen. Das Volume auswerfen und die App in Programme doppelklicken. Die private Entwicklungsfassung ist ad hoc signiert. Beim ersten Öffnen kann macOS eine Bestätigung verlangen. Das App-ZIP ist eine alternative Auslieferung für Apple Silicon. [Installation, macOS-Freigabe und Geräteprüfung](docs/mac-installation.md) · [Mac-Builds](https://github.com/Feerson1617/Erdmodell/actions/workflows/macos.yml)

„Präsentieren“ und **⌃⌘F** wechseln ins Vollbild. Zum Prüfen des eigenen Geräts die gewünschte Szene öffnen und im Menü **Hilfe → Geräteprüfung starten** wählen. Das Ergebnis lässt sich als JSON sichern.

## Earth Observatory G5

Zeitreise, weltweite Grenzmodelle, Erdbebenkatalog, Seebeben, Vulkanismus und Siedlungsvergleiche nutzen denselben lokalen Renderer. Unterrichtsbedienung, Fachcurriculum und Datenrechte stehen in [Unterricht](docs/g5-unterricht.md), [Abdeckungsmatrix](docs/curriculum-coverage.md) und [Quellenkatalog](docs/g5-quellen.md). Die vorherige Mac-Fassung ist unter [PR #11](https://github.com/Feerson1617/Erdmodell/pull/11) gesichert.

## Entwicklung

Auf einem Apple-Silicon-Mac mit Node 24, npm, Python 3 und Xcode Command Line Tools:

```sh
npm ci
npm run mac:build
```

Die App, das DMG und das alternative App-ZIP liegen unter `artifacts/macos/`. `artifacts/GeoRisiko-G5-Web-Test.html` startet auch einzeln per Doppelklick. Zur Entwicklung dienen `npm run dev` und `npm run build`. [Architektur, Funktionsbestand und weitere Phasen](docs/mac-architektur.md) · [Fachanhang zum Plattenatlas](docs/plattenatlas-g4.3.1.md)

Die frühere G4.3.1-Unterrichtsausgabe mit ihren vollständigen Buildwegen liegt im gesicherten Ausgangscommit. [Archivstand](https://github.com/Feerson1617/Erdmodell/tree/0e74d47e683fe8eccbc9563d51999b696a1ef180)
