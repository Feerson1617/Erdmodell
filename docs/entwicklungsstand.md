# Entwicklungsstand und nächste Abnahmestufen

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
