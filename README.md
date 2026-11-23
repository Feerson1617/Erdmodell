# GeoRisiko für Mac

GeoRisiko ist ein offline nutzbares 3D-Erdobservatorium für den Geographieunterricht. Die Lehrkraft zeigt am Globus Erdschalen, Plattengrenzen, regionale Prozesse und den Nyos-See. Die Mac-App und die einzelne Test-HTML verwenden denselben Three.js-Kern.

## Auf dem Mac starten

Das Artefakt **GeoRisiko-macOS-arm64.dmg** aus dem erfolgreichen macOS-Lauf laden, öffnen und **GeoRisiko** auf **Programme** ziehen. Das Volume auswerfen und die App in Programme doppelklicken. Die private Entwicklungsfassung ist ad hoc signiert. Beim ersten Öffnen kann macOS eine Bestätigung verlangen. Das App-ZIP ist eine alternative Auslieferung für Apple Silicon. [Installation, macOS-Freigabe und Geräteprüfung](docs/mac-installation.md) · [Mac-Builds](https://github.com/Feerson1617/Erdmodell/actions/workflows/macos.yml)

„Präsentieren“ und **⌃⌘F** wechseln ins Vollbild. Zum Prüfen des eigenen Geräts die gewünschte Szene öffnen und im Menü **Hilfe → Geräteprüfung starten** wählen. Das Ergebnis lässt sich als JSON sichern.

## Entwicklung

Auf einem Apple-Silicon-Mac mit Node 24, npm, Python 3 und Xcode Command Line Tools:

```sh
npm ci
npm run mac:build
```

Die App, das DMG und das alternative App-ZIP liegen unter `artifacts/macos/`. `artifacts/GeoRisiko-Web-Test.html` startet auch einzeln per Doppelklick. Zur Entwicklung dienen `npm run dev` und `npm run build`. [Architektur, Funktionsbestand und weitere Phasen](docs/mac-architektur.md) · [Fachanhang zum Plattenatlas](docs/plattenatlas-g4.3.1.md)

Die frühere G4.3.1-Unterrichtsausgabe mit ihren vollständigen Buildwegen liegt im gesicherten Ausgangscommit. [Archivstand](https://github.com/Feerson1617/Erdmodell/tree/0e74d47e683fe8eccbc9563d51999b696a1ef180)
