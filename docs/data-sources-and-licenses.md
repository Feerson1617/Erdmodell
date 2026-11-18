# Daten, Urheber und Lizenzen

Alle ausgelieferten Bild- und Geometriedaten werden unter derselben Herkunft wie die Anwendung geladen. Pages und die SCORM-Version benötigen zur Laufzeit ausschließlich die eigenen Paketdateien. Die folgenden Netzquellen dienten der Datenaufbereitung. Daher ist externes CORS keine Voraussetzung für den Unterricht. Abruf für G1 am 18. November 2026. Ein Abrufdatum ist kein Aufnahmedatum.

Die zusätzlichen G1.1-Daten, geographischen Grenzen und Änderungen an Variante B sind im [Nachweis G1.1](g1.1-data.md) dokumentiert.

| Bestandteil | Herkunft und Nutzung | Auflösung, Bearbeitung und Grenzen |
| --- | --- | --- |
| `earth*.webp` | NASA Blue Marble Next Generation aus `basemap-data 2.0.0`, Datei `bmng.jpg`. MIT-Hinweis des Datenpakets unter `data/BASEMAP-LICENSE.txt`. [Basemap-Daten](https://pypi.org/project/basemap-data/2.0.0/) · [NASA Blue Marble](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/) | Historisches Komposit. Quelle im Paket 5.400 × 2.700 Pixel; A 4.096 × 2.048, B 1.536 × 768 mit reduzierter Palette, Basiskarte 512 × 256. Ozean- und Landfarben bearbeitet. Keine Live-Satellitenaufnahme. |
| `relief.i16` | NOAA NGDC, Amante & Eakins (2009), ETOPO1 Ice Surface. Kostenfreie Nutzung und Weitergabe laut Attribut `license` des ERDDAP-Datensatzes; ohne Gewähr, nicht für rechtliche Zwecke. [NOAA ETOPO1](https://doi.org/10.7289/V5C8276M) · [ERDDAP etopo180](https://coastwatch.pfeg.noaa.gov/erddap/griddap/etopo180.html) | 1 Bogenminute Ausgangsdaten. Jeder 30. Stützpunkt in beiden Richtungen, 721 × 361 vorzeichenbehaftete Meterwerte, little endian. Bilinear interpoliert, Meer bei Null im Globus. ETOPO1 ist ein älteres globales Modell. |
| `locator.webp`, `region.webp` | Natural Earth Land, Maßstab 1:10 Mio., Public Domain. [Nutzungsbedingungen](https://www.naturalearthdata.com/about/terms-of-use/) · [Vektordaten](https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_10m_land.geojson) | Rasterisierte Übersicht und Karte von 4°–13° O, 51°–59° N. Generalisierte Küsten; kleine Halligen benötigen eine eigene Kartierung. |
| `hooge.json`, `hooge.webp`, kartografischer Anteil von `hooge-soft.webp` | © OpenStreetMap-Mitwirkende. Datenbank und abgeleitete Datenbank unter ODbL 1.0. Vereinfachte Datenbank im Paket, Verfahren in `scripts/prepare_data.py`. [Attribution](https://www.openstreetmap.org/copyright) · [ODbL](https://opendatacommons.org/licenses/odbl/1-0/) | WGS84-Längen und -Breiten. Geschlossene Hooge-Küste, Warft-Punkte, Gebäudegrundrisse; Wege, Gräben und Flächen für die Kartentextur. Kartierung ist heterogen und zeitlich veränderlich. Gebäudehüllen im Renderer weiter generalisiert. |
| `hooge-air.webp`, `hanswarft.webp`, Luftbildanteil von `hooge-soft.webp` | **© GeoBasis-DE/LVermGeo SH/CC BY 4.0.** Amtliche Digitale Orthophotos DOP20 RGB. WMS-Layer `sh_dop20_rgb`. [Dienstbeschreibung und Quellenvermerk](https://dienste.gdi-sh.de/WMS_SH_DOP20col_OpenGBD?SERVICE=WMS&REQUEST=GetCapabilities) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Original-Bodenauflösung 20 cm. Export der Hallig mit ca. 2,6 m/Pixel, Detail um Hanswarft ca. 0,85 m/Pixel. Farbkorrektur, Randausblendung fehlender Bildbereiche und Generalisierung für B. Zeitpunkt der Einzelbefliegung aus dem WMS-Ausschnitt nicht bestimmt. Schatten und Wasserstand gehören zum Bild. |
| Atmosphäre, Sterne, lokale Netze und Wasserbewegung | Eigene prozedurale Gestaltung in diesem Projekt | Keine Sternkarte, Windmessung, Tide oder physikalische Simulation. Warftprofile, Bäume, Dächer und Licht sind modelliert. |
| Bibliotheken und Schrift | Three.js (MIT), Lucide (ISC mit enthaltenen Feather-Lizenzhinweisen), DM Sans (SIL OFL 1.1). Volltexte in `public/licenses/`. | Keine Laufzeitkonten, externen Schriftserver oder API-Schlüssel. Vite (MIT), TypeScript (Apache-2.0), Playwright (Apache-2.0), pngjs (MIT) sind Entwicklungswerkzeuge. |

NASA GIBS ist für zeitlich referenzierte Bildserien interessant. Für eine Unterrichtseinheit ohne Internetverbindung wären zeitliche Auswahl, Kachelcache, produktspezifische Attribution und mögliche Ausfälle zusätzlich zu beherrschen. G1 nutzt ein festes historisches Bild. OSM-API und Landes-WMS lieferten die benötigten Ausschnitte ohne Anmeldung. Massenabrufe oder Verfügbarkeit im Unterricht werden daraus nicht abgeleitet.

## Daten nachbauen

Der normale Build verwendet die versionierten Assets. Für einen neuen Datenstand werden Python 3 mit Pillow und NumPy sowie GDAL benötigt:

1. MIT-Datenwheel mit `python3 -m pip download --no-deps basemap-data==2.0.0` beziehen.
2. Natural Earth GeoJSON aus dem oben verlinkten Stand und [OSM-Ausschnitt](https://api.openstreetmap.org/api/0.6/map.json?bbox=8.46,54.54,8.61,54.61) laden. OSM-API-Antworten können sich ändern.
3. [ETOPO1-Teilgitter](https://coastwatch.pfeg.noaa.gov/erddap/griddap/etopo180.nc?altitude%5B(90):30:(-90)%5D%5B(-180):30:(180)%5D) als NetCDF speichern.
4. `python3 scripts/prepare_data.py --wheel DATEI.whl --land land.json --osm osm.json --relief etopo.nc` im Repository ausführen.
5. WMS-GetMap mit `SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=sh_dop20_rgb&STYLES=&SRS=EPSG:4326&FORMAT=image/jpeg`. Hallig: BBOX `8.48,54.54,8.604,54.60`, WIDTH=3072, HEIGHT=2496. Hanswarft: BBOX `8.5404131,54.5600014,8.5604131,54.5720014`, WIDTH=1536, HEIGHT=1536. `python3 scripts/prepare_imagery.py hallig.jpg hanswarft.jpg` verarbeitet beide Ausgaben.

SHA-256 der verwendeten Eingaben:

```text
56103a0dfa411c77bec1888b232bb70e7ceb089f83679531fbb4bb6efafa5035  basemap-data wheel
1ac90796408bc6ad6911d69448485d3c4dbf2190370080368a09976e1c9f7416  Natural Earth Land
b93579434290c650ca15969d37aaffe338a72b8a8b51d8381947e617854a9c74  OSM-Ausschnitt
38590ba65dbe003201cedc63aca7959e51fbc0efb1df99ec69974e8f5e0fe6de  ETOPO1-Teilgitter
39b6dc4fcd48e372ef9aafc9467ea9933dc5bdeffb9631837131b7e8d09386c2  DOP Hallig
c91468cb111f4dc04f13d4eb4cfc953d028fc7ca9a79ebe13dce884fd8ddf753  DOP Hanswarft
```


Die vier unveränderten SCORM-1.2-Kontrollschemata (IMS, ADL und XML-Namespace) liegen im Lernpaket neben dem Manifest. Herkunft ist das frei bereitgestellte [SCORM-1.2-Referenzpaket von Rustici Software](https://scorm.com/wp-content/assets/golf_examples/PIFS/RuntimeBasicCalls_SCORM12.zip). Die Copyright-Hinweise stehen in den jeweiligen Schemas. Beispielkurs, Inhalte und Laufzeitprogramm dieses Pakets werden nicht verwendet.
