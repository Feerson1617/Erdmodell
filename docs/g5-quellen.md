# Datenkatalog des Erdobservatoriums

Alle Karten werden während der Entwicklung offline aufbereitet. Die installierte App öffnet ausschließlich mitgelieferte Daten. Im Quellpaket und in den Binärausgaben gelten die folgenden ressourcenspezifischen Nutzungsbedingungen.

| Ressource | Version, Umfang und Verarbeitung | Herkunft, Rechte und Grenzen |
|---|---|---|
| Heutige Platten | PB2002, 52 Platten, 5.819 kurze Großkreisbögen. Kennungen, Plattenpaar, Grenzkategorie, Azimut und heutige Relativbewegung aus dem Bestand. | Peter Bird (2003), doi:10.1029/2001GC000252. Attribution und Nutzungsbedingungen im Bestandskatalog. Vereinfachte Linien in breiten Deformationszonen. |
| Beobachtete Erdbeben | ComCat, 2019–2023, weltweit, Magnitude ≥ 6, nur earthquake. 697 überprüfte Ereignisse. ID, UTC-Tag, Ort, Tiefe und Katalogmagnitude. Abfragetext und SHA-256 der CSV in comcat.json. | US Geological Survey, FDSN Event Service, US-Regierungswerk. Katalogstände können nachträglich revidiert werden. Die Auswahl erlaubt keine Aussage über alle kleinen Beben oder den Herdmechanismus. [Abfrage](https://earthquake.usgs.gov/fdsnws/event/1/) |
| Historische Erde | Müller et al. (2019), Archivversion 3.0, Zenodo 11601026. Kontinentpolygone mit Gültigkeitsintervallen, CombinedRotations, PlateBoundaries_DeformingNetworks. pyGPlates löst die geschlossenen Plattengrenzen für jeden Zeitschritt mit Ankerplatte 0. Kontinentfragmente werden mit ihren endlichen Rotationen versetzt. 0–250 Ma, alle 5 Ma. Datumsgrenze und Pole werden vor der Rasterung auf der Kugel geschnitten. 1024 × 512, SHA-256 für jeden Zeitschnitt. | CC BY 4.0. Die Flächen zeigen rekonstruierte kontinentale Lithosphäre, keine historische Küstenlinie. Rigid gerenderte Kontinentfragmente vereinfachen intrakontinentale Deformation. Kein Relief oder Klima rekonstruiert. [Publikation](https://doi.org/10.1029/2018TC005462) · [Daten](https://doi.org/10.5281/zenodo.11601026) |
| Mögliche Zukunft | Davies, Green und Duarte (2018), Mendeley Data V1. Jede Rotationsdatei separat mit den zugehörigen Matthews-Polygonen rekonstruiert. Zukunftsjahr = 300 minus GPlates-Modellzeit. Filmreihen mit 251 bzw. 201 Einzelzuständen in 1-Ma-Schritten bestätigen das jeweilige Ende. Ultima/Aurica bis +250, Novo/Amasia bis +200 Ma. | Bearbeitete, attribuierte Daten für nichtkommerzielle Bildung, CC BY-NC 3.0. Wer die Anwendung kommerziell vertreibt, benötigt eine andere Erlaubnis für diese Ressourcen. Die Szenarien liefern alternative Anordnungen kontinentaler Lithosphäre. [Daten](https://doi.org/10.17632/342zcbtvw9.1) · [Publikation](https://doi.org/10.1016/j.gloplacha.2018.07.015) · [Lizenz](https://creativecommons.org/licenses/by-nc/3.0/) |
| Sechs regionale Gelände- und Meeresbodenraster | Mapzen Terrain Tiles, Terrarium, Zoom 7–10. 193 × 145 reale Höhen in Metern und geodätische Tangentialausschnitte. Blue Marble Shaded Relief and Bathymetry, NASA GIBS, EPSG:4326, Matrix 6. Farbausschnitte 768 × 576. Die Quelldateien und SHA-256 je Kachel stehen in terrain/provenance.json. | Mapzen/AWS Open Data, Quellnachweise einschließlich USGS, SRTM und Meeresbodendaten nach Kachelgebiet. NASA Blue Marble (NASA Visible Earth, Reto Stöckli u. a.). Modellfarben am Untergrund sind interpretativ. Die effektive Genauigkeit ist ortsabhängig. [Quellen und Attribution](https://github.com/tilezen/joerd/blob/master/docs/attribution.md) · [NASA](https://earthobservatory.nasa.gov/features/BlueMarble) |
| Geologie und Risikovergleich | USGS This Dynamic Earth, Earthquake Hazards Program, Volcano Hazards Program. NOAA Tsunami Education; UNDRR Terminology. Mechanismen, Herd, Wellen, Schmelze und Siedlungen sind erzeugte Anschauungsmodelle. | Keine Vorhersage für einen Ort. Slab2 (Hayes et al., 2018) zeigt die regional veränderliche Plattengeometrie. GEM Global Active Faults ist eine Sammlung kartierter Störungen. Keines der beiden Werke wird hier als vermessene Bruchfläche eines Modellbebens ausgegeben. [Slab2](https://doi.org/10.5066/F7PV6JNV) · [GEM](https://github.com/GEMScienceTools/gem-global-active-faults) · [USGS](https://pubs.usgs.gov/gip/dynamic/dynamic.html) · [NOAA](https://www.noaa.gov/education/resource-collections/ocean-coasts/tsunamis) · [UNDRR](https://www.undrr.org/terminology) |
| Bestandsdaten | Globus, Hooge, Helgoland, Schalen, historische Messungen und Nyos mit den unveränderten Originalnachweisen. | Siehe public/licenses/Geodaten.txt, public/data/BASEMAP-LICENSE.txt, public/data/nyos/NOTICE.txt und docs/ im gesicherten Basiscommit. |

## Reproduktion

Python mit NumPy, SciPy, Pillow und pyGPlates 1.x installieren. Die folgenden Befehle laufen nur im Entwicklungsprojekt.

```sh
python scripts/g5/sources.py /tmp/georisiko-modelle
for modell in past ultima novo aurica amasia
do
  python scripts/g5/time.py /tmp/georisiko-modelle "$modell"
done
python scripts/g5/catalog.py
python scripts/g5/terrain.py
```
