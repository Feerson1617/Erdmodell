# Architekturentscheidung G1

**Entscheidung:** Three.js mit TypeScript, Vite und einer sphärischen geographischen Referenz. Die Schlüsselfrage war, ob eine Perspektivkamera sowohl eine 6.371-km-Kugel schneiden als auch einzelne Häuser auf einer Warft zeigen kann. Vor dem Produktaufbau hat der WebGL-Nachweis in `tests/gate.html` eine offene Kugel, Kerngeometrie und einen lokalen Testkegel in derselben Szene gerendert. Vier im Browser ausgelesene Mittelpixel belegen die unterschiedlichen sichtbaren Oberflächen. Der spätere Produkttest prüft den vollständigen Weg und die zurückgelegten Distanzen. [Messprotokoll](evidence/architecture-gate.json)

## Abwägung

Konzeptioneller Vergleich. Nur der gewählte Three.js-Pfad wurde für G1 tatsächlich implementiert und gemessen.

| Kriterium | CesiumJS | Three.js | Gemeinsamer Einsatz |
| --- | --- | --- | --- |
| Globaler Globus | Fertiger Ellipsoid und Kachelbaum | Parametrische Kugel und eigener Kachelbaum | Doppelte Zuständigkeiten |
| Oberflächengestaltung | Gute geographische Basis | Direkter Zugriff auf Normalen, Netze und Shader | Zwei Materialsysteme |
| Zoom ins Gelände | Ausgereifter Terrain-Pfad, passender Provider nötig | Mehr Eigenarbeit, ein Projektionspfad bis zur Warft | Abstimmung beider Kameras nötig |
| Koordinaten | WGS84 und Projektionen eingebaut | Geodätische Eingaben auf dokumentierter mittlerer Kugel | Zusätzliche Transformationen |
| Erdinneres | Benutzerdefinierte Primitives | Frei modellierbare Schalen | Zusätzliche Tiefenabstimmung |
| Schnitt und Transparenz | Clipping plus selbst gebaute Füllflächen | Geschlossene Teilkugeln und geformte Schnittflächen | Sortierprobleme zwischen Renderern |
| Ereignisse | Eigene Animationen möglich | Instanzierung und freie lokale Netze | Zwei Lebenszyklen |
| Beleuchtung | Szenen- und Globusbeleuchtung abstimmen | Licht und Farbraum gemeinsam steuerbar | Schwerer reproduzierbare Übergänge |
| Geräte | Browserfähig, Kosten datenabhängig | Begrenzte Daten und variable Zeichenauflösung | Zusätzlicher Speicherbedarf zu erwarten |
| Freie Nutzung | Bibliothek frei, eigene Daten ohne ion möglich | Bibliothek frei, lokale Daten | Zwei freie Bibliotheken |
| Wartung | Weniger globaler Terraincode, komplexere Sondergeometrie | Eigener LOD-Code, einfache Sondergeometrie | Größter Integrationsaufwand |
| Pages / SCORM | Möglich mit statischen Ressourcen und Worker-Konfiguration | Statisches Verzeichnis mit relativen Pfaden | Größeres Paket |

Die Entscheidung ist für eine kleine Zahl detaillierter Unterrichtsregionen getroffen. Bei weltweiten amtlichen 3D-Tiles, komplexen Projektionen oder einer Anforderung an vermessungstechnische Genauigkeit muss sie neu bewertet werden.

## Koordinaten und Rendering

`src/geo.ts` überführt Breite und Ostlänge in ein rechtshändiges System, Y zeigt zum Nordpol. Entfernungen sind Kilometer. Pro Kachel werden Positionen relativ zu einem lokalen Ursprung gespeichert. Three berechnet die Kamera-Matrix des Objekts vor der Übergabe an die GPU. Hooge verwendet Ost/Hoch/Süd am geographischen Anker und eine lokale Krümmungskorrektur. Fehler der Kugelnäherung begrenzen die Nutzung als Messinstrument.

`CameraController` verwaltet geographischen Fokus, logarithmische Entfernung, Neigung und Azimut. Bei der Anreise richtet er den Fokus früh auf das Ziel, bei der Abreise steigt er zunächst auf. Interpolation, Eingabedämpfung und dynamische Nahgrenze erfolgen in einer einzigen Kamera. Die Einstellung „Bewegung reduzieren“ verkürzt die automatische Fahrt auf den Zielzustand. Die Entfernung im Statusfeld ist der Abstand zum Fokus.

`TerrainLODManager` beginnt mit 8 × 4 geographischen Kacheln. Im Umfeld des Fokus teilt er Kacheln rekursiv in vier Kinder, bis höchstens Stufe 10. GPU-Frustum-Culling und Randstreifen begrenzen Zeichenarbeit und verdecken Spalten. Texturen nutzen Mipmaps. Globale Farbbilder und das kleine Höhengitter werden einmal geladen. Die lokalen Netze und Bilder werden beim Anflug vorbereitet, Regionenkarte und Halligmaterial über Entfernung und Randgewicht eingeblendet. Das ist lokales, gestuftes Streaming aus dem statischen Paket. Mehr Kachelgeometrie erzeugt keine feineren Messdaten.

Je Standort wird dieselbe Ladeoperation bei wiederholtem Aufruf geteilt. Der Kachelcache entfernt veraltete Netze samt GPU-Geometrie; beide Stile teilen die geladenen Bilder und die Kamera. Häufig niedrige Bildraten senken die Zeichenauflösung bis auf Faktor 0,75. Instanzierte Bäume, zusammengefasste Gebäude und nur lokal berechnete Schatten reduzieren Zeichenaufrufe.

## Erweiterung

Das Regionsregister in `src/regions.ts` sowie `SimulationParameterSet`, `HazardModule` und `EventController` in `src/model.ts` trennen Ort, Parameter mit Einheiten/Quelle und Ereignismodell. Der Start prüft Registrierungen, regionale Freigabe und Modulvalidierung und gibt eine Aufräumfunktion zurück. G1 enthält keine freigegebenen Ereignismodule. Die Datenzugriffe in `planet.ts` und `local.ts` haben unterschiedliche Auflösung und Herkunft. Lerntexte und Vertiefungen stehen getrennt vom Renderer. Neue Regionen benötigen einen dokumentierten Datensatz und dieselben Georeferenzierungs- und Browsertests.

### Einen Standort registrieren

1. In `src/sites.json` ID, Grenzen in West/Süd/Ost/Nord, Zielpose, Übersicht, Quellen, Modellgrenzen, Abstände der Detailstufen und zulässige Ereignisse hinterlegen. Entfernungen und Höhen in der Kamera sind Kilometer. Zu Beginn bleibt die Liste freigegebener Ereignisse leer.
2. Lokale Grundkarte, beide Stilbilder und optional Detailrechteck sowie Gebäudedaten bereitstellen. Beim Höhentyp `dsm` benennt `inputs` die GeoTIFF- und Orthofoto-Eingaben und die Rastergröße. Hooge verwendet das parametrisierte Warftprofil. Der kleine Teststandort Helgoland nutzt dasselbe Rendering ohne Gebäudedaten.
3. Das Offline-Skript baut das Netz aus UV, Höhe in km und Landmaske. Indizes sind 16 Bit, aufsteigende V verlaufen nach Süden. Die Kamera nutzt dasselbe Höhenmodell. Ein lokaler Rahmen bindet den Ausschnitt an den Globus. Fernbildquellen mit eigenem größeren Abdeckungsgebiet werden im Planet-Renderer eingehängt.
4. Netz, Innenkanten und Abdeckung mit `node tests/site-data.mjs` prüfen. Für neue Regionen zusätzlich die Georeferenz mit unabhängigen Landmarken, Bodenauflösung, Meereshöhe und Übergänge an den Rändern kontrollieren. Bei Hochgebirgen, großen Flächen oder antimeridianüberschreitenden Regionen sind die lokale Tangentialebene und die jetzige Randangleichung eigens zu prüfen.

G1.1 begrenzt den Aufbau neuer Kachelquartette auf ein Zeitbudget von 3 ms je Frame. Ein begonnenes Netz kann dieses Budget überschreiten. Eltern bleiben sichtbar, bis alle vier Kinder bereit sind. Ein konservativer Horizonttest sortiert verdeckte Kacheln aus. Je Stil werden alte Kacheln ab einer Zielgröße von 260 schrittweise freigegeben. Bereits besuchte Standorte halten ihre zwei Darstellungen und gemeinsamen Texturen für den nächsten Wechsel. Bei einer Erweiterung auf viele hochaufgelöste Regionen ist ein Entladebudget für Standortdaten erforderlich.
