# Nyos-See im gemeinsamen Erdmodell

## Vom Globus bis zum See

Der Ort ist einmal im gemeinsamen Ortskatalog registriert. Globus und Ortsmenü rufen dieselbe Methode `World.visit("nyos")` auf. Sie lädt die eingebetteten Geodaten, prüft deren Lesbarkeit und startet die Kamerafahrt zum Anker aus den Metadaten. Bei fehlenden Pflichtdaten führt die Kamera auf die globale Basiskarte über Kamerun und die Anwendung meldet den Ausfall.

`World`, `CameraController`, Beleuchtung und WebGL-Zeichenfläche begleiten den gesamten Weg. Aus der Ferne erreicht die Kamera zuerst die geografische Richtung des Sees und nähert sich dann mit logarithmisch interpoliertem Abstand. Ein langsames Ausgabegerät darf pro tatsächlich gerendertem Bild höchstens 125 ms der Flugzeit fortschalten. Der Flug dauert dadurch auf schwacher Hardware länger. Bei aktivierter Bewegungseinschränkung des Betriebssystems stellt die Kamera die gewählte Sicht direkt ein. Eine Berührung des Modells unterbricht den Flug.

| Maßstab | Farbbild und Gelände |
| --- | --- |
| Kontinent und Land | Globale Reliefkacheln. Das Kamerun-Mosaik wird zwischen rund 1990 und 490 km Kameraabstand auf dieselbe Oberfläche geblendet. |
| Vulkanisches Hochland | Zwischen rund 173 und 48 km erscheint der mittlere Sentinel-Ausschnitt. Geografisch überlappende Bilder benutzen denselben Längen- und Breitengrad. |
| Tal und See | Zwischen 42 und 16 km übernimmt das lokale Höhenmodell mit der lokalen Satellitenaufnahme. Die regionale Taste zeigt den 15-km-Ausschnitt. |
| Nahansicht | Der Zielpunkt liegt auf dem Wasserspiegel. In der Ausgangsansicht lässt sich der See mit beiden Ufern erkennen. Ziehen dreht um den Ort, Mausrad oder Zwei-Finger-Geste zoomen. |

## Bezugsrahmen und Übergang am Geländerand

Die bestehende mittlere Erdkugel hat einen Radius von 6371 km. Höhen aus dem DEM werden als Kilometer über der Referenzkugel dargestellt. Der DEM-Höhenbezug wird in den Quelldaten dokumentiert. Diese Vereinfachung eignet sich für die Ortsansicht und schließt eine geodätische Höhenbestimmung aus.

Der lokale Ursprung liegt am Seeanker auf Höhe des DEM-Wasserspiegels. Die Geometrie speichert Ost-, Hoch- und Südrichtung in Kilometern relativ zu diesem Ursprung. Die Matrix der Gruppe verankert diese kleinen Vertexkoordinaten auf der Erdkugel. Uferdetails müssen dadurch im Vertexpuffer keine Differenzen aus erdradiusgroßen Zahlen bilden.

Auf den äußeren fünf Prozent des lokalen DEM-Patches laufen die Höhen in die vorhandene Globustopografie aus. Die globale Oberfläche liefert in der Randzone weiterhin ein deckendes Farbbild. Im Fußabdruck des DEM verschiebt der Vertexshader ausschließlich den Tiefenwert der groben Karte nach hinten. Die lokale Oberfläche kann dadurch kontinuierlich in dieses Bild einblenden. Bei der ersten Browserprüfung erzeugten komplementär ausgesiebte Fragmente einen sichtbaren gepunkteten Rechteckrand. Der Vergleichsflug mit deckender Unterlage und stetiger Randtransparenz schloss diese Naht und die Fuge am Ufer. Geringe Unterschiede bei Aufnahmezeit, Farbe und Auflösung können beim Zoomen erkennbar sein.

Die bisherige Kamera begrenzt ihre Nah- und Fernebene abhängig vom Abstand. Der lokale Zielpunkt folgt derselben Höhenüberblendung wie die Landschaft. Am Kamerastandort prüft ein zweiter DEM-Abgriff den Abstand zur realen Topografie. Bei Annäherung an eine Flanke hebt er das Auge auf mindestens 45 m über das Modellrelief. Near- und Far-Clipping, Augenabstand, Ort, Bildauflösung und Gewichte der drei Kartenstufen können über `geoObservatory().nyos` geprüft werden. Diese Werte dienen ausschließlich der technischen Prüfung.

## Daten und Ressourcen

`public/data/nyos/landscape.json` verzeichnet Ausdehnungen, Rastergrößen, Uferpolygon, Anker, DEM-Wasserhöhe und Bildpfade. Das Raster `elevation.i16` verwendet vorzeichenbehaftete 16-Bit-Meterwerte in Little Endian, von Nord nach Süd und innerhalb der Zeilen von West nach Ost. Bilddateien sind lokale WebP-Raster. Beim wiederholten Besuch nutzt die Szene bereits geladene Texturen, Gelände- und Wassergeometrien.

Nahe am See verwendet das Geländenetz mehr Originalstützpunkte als an den Mosaikrändern. Die Regionalansicht zeichnet dieses Netz in einem Durchgang. Unter etwa 8 km Kameraabstand prüfen bis zu 36 räumliche Abschnitte mit eigenen Begrenzungskugeln, welche Teile im Sichtkegel liegen. Diese Teilnetze teilen sich Positionen, Normalen, UVs und Material.

Die Globuskacheln entfallen in der Seeansicht erst, wenn vier Strahlen durch die Bildecken eine Ebene unterhalb der niedrigsten DEM-Höhe innerhalb der vollständig deckenden Landschaft treffen. Der Kamerastandort muss ebenfalls im inneren Fußabdruck liegen. Bei einem Blick zum Horizont, während des Zoomübergangs und im schematischen Schnitt bleibt die Unterlage erhalten. Das matte Gestein und die Vegetation verwenden diffuse Beleuchtung ihrer DEM-Normalen. Das Wasser behält seinen winkelabhängigen Glanz. Das gemeinsame LOD-System begrenzt den Kachelvorrat. Die adaptive Renderauflösung, lokale Gelände-Dreiecke, Texturen, Programme und tatsächlichen Bildabstände erscheinen im Browserprotokoll. Für die drei zusätzlichen Farbraster ergibt sich bei angenommener RGBA8-Dekodierung einschließlich aller Mipmapstufen ein Texturbudget von rund 31,2 MiB. Es entfallen 12,0 MiB auf das Kamerun-Raster (1536 × 1536), 10,75 MiB auf die mittlere Stufe (1536 × 1376) und 8,41 MiB auf die lokale Aufnahme (1220 × 1356). Geometriepuffer, Hilfsraster, Treiberallokationen sowie die vorhandenen Globusressourcen kommen hinzu. Die Zahl der Texturen oder Geometrien ist ein Ressourcenindikator. Browser stellen hier keine vollständige GPU-Speicherbelegung in Bytes bereit.

## Kontrollflug und Renderingvergleich

Für Gate A wurde die Fahrt in einem Chromium-Produktionsbuild mit WebGL 2 vollständig aufgezeichnet. Ein Nachflug mit 1280 × 800 CSS-Pixeln lieferte 43 aktive Flugproben. Die Kamera erreichte den Seeanker bei 6,43834° N, 10,298663° O. Die regionale Bildstufe wurde vor dem lokalen Relief sichtbar. Die Pixelprobe der ersten Fassung wies am DEM-Rand einen gesprenkelten Streifen aus. Bei der Nachprüfung war die Landschaft auch bei 15 km Abstand durchgehend. Drehung, erneuter Zoom und Rückflug blieben auf dem gleichen Koordinatensystem.

Die folgende zusätzliche Paarmessung verglich den früheren Renderpfad und den optimierten Pfad auf demselben Linux-Rechner in Chromium mit SwiftShader. Beide Builds wurden in dieselbe stationäre Kamerapose bei 3,27 km Abstand und 42° Neigung versetzt. Das Fenster maß 960 × 640 CSS-Pixel, der tatsächlich gerenderte Puffer 720 × 429 Pixel. Die Ausgabe blieb in beiden Fällen bei 0,75-facher Pixeldichte.

| Messung | Früherer Pfad | Diffuses Gelände, DEM-Teilkacheln und Frustumprüfung |
| --- | ---: | ---: |
| Ausgegebene Dreiecke | 81.460 | 46.960 |
| Draw Calls | 17 | 22 |
| Lokale DEM-Teilnetze im Bild | gesamtes Netz | 21 von 36 |
| Bildrate im kurzen Messfenster | 3,21 FPS | 5,80 FPS |
| Median / P95 des Bildabstands | 300 / 633 ms | 167 / 367 ms |
| GPU-Zeit einer verwertbaren Timer-Query | 255 ms | 134 ms |

Die räumliche Unterteilung verwendet zusätzliche Draw Calls und spart Dreiecke außerhalb des Sichtkegels. Die Messung bündelt mehrere Änderungen am Renderpfad. Belastung durch andere Cloud-Prozesse und adaptive Auflösung beeinflussen die Werte. Ein Einzelwert aus dem GPU-Timer beschreibt genau den abgefragten Frame. Die längeren Chromium-/WebKit-Messungen der ausgelieferten Fassung stehen im Prüfarchiv. Für Aussagen zum schulischen M1, zum iPad und zum Smartboard sind Messungen auf dem jeweiligen Gerät erforderlich.

## Gemeinsamer Seequerschnitt und Ereigniskamera

Der Nord-Süd-Schnitt ermittelt seine Uferendpunkte am echten Polygon. Das Tiefenprofil zwischen diesen Punkten ist ein Erklärungsmodell. Gelände und Wasser werden in einem begrenzten Ausschnitt derselben lokalen Szene geöffnet. Eine Blickrichtung von Osten macht den Schnitt lesbar. Wechselnde Bildschirmformate erhalten eine passende Startdistanz. Drehen, Neigen und Zoomen bleiben möglich. Das Modell der gelösten Anreicherung erhält eine eigene, ausdrücklich bezeichnete Analysefarbe.

Die Ereignisansicht beginnt im Schnitt mit angehaltener Modellzeit. Das Zustandsobjekt und die gezeichneten Objekte sind getrennt. Eine Pause friert den Fortschritt ein, ein Reset wählt wieder den anfänglichen Schnitt. Die Phase des Gasaustritts ist am See verortet. Für den räumlichen Zusammenhang führt einmalig eine unterbrechbare Kamerafahrt zur benachbarten Senke. Sie beginnt kurz vor dem Schließen des Schnitts. Wer die Kamera bereits selbst gedreht, geneigt oder gezoomt hat, behält den selbst gewählten Ausschnitt. Eine echte Pause mitten im automatischen Talflug hält auch Kamerapose und Zielhöhe an.

Die Wiedergabe benutzt sichtbare Framezeit mit begrenztem Zeitschritt. Im Hintergrund verstreicht keine Lehrzeit. Während des automatischen Talflugs haben Kamerafahrt und Modell denselben maximalen Fortschritt je Bild, damit auch bei niedriger Bildrate die räumliche Ansicht vor dem Ende der Phase erreicht wird. Der Fortschritt markiert die Reihenfolge der Modellphasen mit einer didaktisch gewählten Spieldauer.

Eine ergänzende Chromium-Probe stoppte den Talflug bei 2,317 km Kameraabstand und 74,95° Blickrichtung. Nach 750 ms waren Modellfortschritt und Kamerapose unverändert. Bei rund 82 Prozent Modellfortschritt war das Ziel bei 6,447° N und 10,297° O erreicht. Zurücksetzen öffnete wieder den Schnitt am See bei 2,2 km Kameraabstand und 80° Blickrichtung.
