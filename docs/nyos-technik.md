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

Die Globe-Kacheln entfallen in der Seeansicht erst, wenn vier Strahlen durch die Bildecken eine Ebene unterhalb der niedrigsten DEM-Höhe innerhalb der vollständig deckenden Landschaft treffen. Der Kamerastandort muss ebenfalls im inneren Fußabdruck liegen. Bei einem Blick zum Horizont, während des Zoomübergangs und im schematischen Schnitt bleibt die Unterlage erhalten. Das matte Gestein und die Vegetation verwenden diffuse Beleuchtung ihrer DEM-Normalen. Das Wasser behält seinen winkelabhängigen Glanz. Das gemeinsame LOD-System begrenzt den Kachelvorrat. Die adaptive Renderauflösung, lokale Gelände-Dreiecke, Texturen, Programme und tatsächlichen Bildabstände erscheinen im Browserprotokoll. Die Zahl der Texturen oder Geometrien ist ein Ressourcenindikator. Browser stellen hier keine vollständige GPU-Speicherbelegung in Bytes bereit.
