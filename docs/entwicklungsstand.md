# Entwicklungsstand und nächste Abnahmestufen

## G6.5.1 · Seismische Integrität

Die Produktprüfung misst direkt im WebGL-Bild die Sichtbarkeit der Modelle beim Fensterwechsel. Beide Stationen zeigen die Ankunft der gleichen Wellen. [Korrekturbericht](g651-korrektur.md)

## G6.5 · Erdbeben und Vulkanismus

Der neue Entwicklungszweig baut auf dem gesicherten G6.4.2-Commit aus PR #23 auf. [Bestand, Fachprüfung und Modellgrenzen](g65-erdbeben.md)

## G6.4.2 · Geographische Integrität

Grundlage ist PR #22. Der [Entwicklungsbericht](g642-entwicklung.md) beschreibt den Deutschland-Nyos-Fehler, die neue Darstellungslogik und die Produktprüfung.

## G6.4.1 · Geographische Prozessmodelle

Der Entwicklungszweig setzt auf G6.4 aus PR #21 auf. Gemeinsame Raumreferenzen, Rücknavigation, kontextabhängige Darstellung und Wiedergabe bilden die Grundlage für G6.5 bis G6.8. Wissenschaft, Quellen, Unterrichtsbedienung und verbleibende Modellgrenzen stehen im [Entwicklungsbericht G6.4.1](g641-entwicklung.md).

## G6.3.1 · Scientific Correction

Grundlage ist G6.3 aus PR 19, Commit `55cbefc87e07b501fb8745212f534f0967988d9f`. Der Branch und seine vier geprüften Produkte sind als Rückfallstand gesichert. Die Korrektur betrifft die Entstehung von Schmelze, ihre räumliche Darstellung und die reine Präsentationsoberfläche. Fachbegriffe, Beobachtungsmodus, Erklärfokus und Favoriten bleiben bedienbar. Die Zeitreise aktualisiert wiederkehrende Beschriftungen nur bei einer Änderung. In den vier Zukunftsszenarien erzeugen die publizierten Rotationen die Kontinentalblöcke und die gesonderten Vektordaten die Grenzen. Die Zukunftsansicht spart das Dekodieren und Übertragen redundanter Raster ein. Bei schnellem Szenenwechsel gibt die App regionales Grafikmaterial nach Abschluss der Shader-Vorbereitung frei. Ein gezielter Wechseltest prüft auch die anschließende Speicherfreigabe. Vier fotografische Vergleiche in gleichen Modellzuständen prüfen das Ergebnis.

Die tatsächlichen Aufnahmen und Messwerte der jeweiligen Version stehen im Sichtprüfungspaket. Die Galerie lässt sich nach dem Entpacken über `Sichtpruefung.html` öffnen. [Fachprüfung und Modellgrenzen](g631-fachpruefung.md)

## Weitere Abnahmestufen

| Phase | Bereits nutzbare Grundlage | Eigenständig zu entwickelnder und abzunehmender Umfang |
|---|---|---|
| G6.4.2 · Geographic Integrity & Classroom Polish | Plattentektonik und durchgehender Raumbezug | Prüfung der Ortswechsel, fachlichen Orientierung und Präsentation. |
| G6.5 · Erdbeben und Übergang zum Vulkanismus | Karten, Referenzräume und Erdbebendynamik | Produktabnahme mit gemessenen und synthetischen Seismogrammen. |
| G6.6 · Vulkanismus | Island, Hawaii und Japan | Vertiefung der vulkanischen Prozesse und Eruptionsformen. |
| G6.7 · Maare, Vulkaneifel, Ulmener Maar und limnische Eruptionen | Nyos und geologische Prozessmodelle | Eigenständige regionale Modelle, Rechteprüfung und Fachabnahme. |
| G6.8 · Classroom & Visual Polish | Gemeinsame Navigation und Modellsteuerung | Abschließende Prüfung der Unterrichtsbedienung und visuellen Qualität. |

Jede Stufe benötigt eine eigene fachliche und visuelle Prüfung, die installierte App, die Offline-Datei, eine kontrollierte Vergleichsmessung und einen Dauerlauf. Das physische Zielgerät muss in der Cloud nicht verfügbar sein.

Die eigenständige Tsunamivertiefung folgt nach G6.8. [Reihenfolge](roadmap.md)

## G6.6 und G6.7

Ausgangspunkt ist G6.5.1 (`1e760ba0`). G6.6 (`e2075569`) wurde im Offline-Browser anhand von sieben Vulkanszenen auf sichtbare Geometrie geprüft. G6.7 ergänzt das georeferenzierte Relief der Vulkaneifel, Ulmen, Maarbildung und vergleichende Seenkunde. Die Sichtprüfung des jeweiligen Produktlaufs enthält getrennte Protokolle für HTML und installierte App. [Fachstand Ulmen und Nyos](ulmener-maar-nyos.md) · [G6.6-Zwischenabnahme](g66-zwischenabnahme.json)

## G6.8 · Unterrichtsbesuch am 15. Dezember 2026

Gesicherte Grundlage ist G6.7, Commit `63648c1ece2a28ee4e236436ef2e00df23cdc4c0`. Für die Unterrichtsmodelle dokumentiert der produktspezifische Prüfbericht die tatsächlich durchlaufenen Räume, Bildgrößen, Originalbilder, historischen Vergleichsmessungen und die Messwerte des virtuellen ARM64-Mac. Der reale M1 und das Smartboard stehen für die abschließende örtliche Geräteprüfung aus. [Fachprüfung](g68-fachpruefung.md)
