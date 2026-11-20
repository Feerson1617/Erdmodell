# GeoRisiko 3D · Plattenatlas und Erdschalen

Die Einzeldatei `GeoRisiko-Erdmodell-G4.3.html` lässt sich per Doppelklick in einem Browser mit WebGL 2 öffnen. Die hochgeladene Ausgangsdatei liegt unter `sicherung/Erdmodell.html`. Ihre SHA-256-Prüfsumme lautet `7d89cb8cdc4611f6c2fc3971b7293784402a3d1497114cf2c791fa700390f3bd`.

## Im Unterricht

Im Schalenschnitt bleiben die Namen zunächst verborgen. Die Lehrkraft kann einzelne Namen oder alle vier freigeben. Eine freigegebene Beschriftung öffnet die kurze Definition. Die beiden Fragen darunter geben Material und Entstehung einzeln frei.

„Plattentektonik“ öffnet das geografische Kartenbild. Die Abdeckung gehört zur Grafik. Eine Lithosphärenplatte umfasst die Kruste und den starren obersten Mantel. Darunter liegt überwiegend festes Mantelgestein, das sich über lange Zeit verformen kann.

Eine Fläche antippen, um sie anzuheben und ihren Namen und Steckbrief zu lesen. „Zentrieren“ holt auch kleine Platten in den Blick. „Weltansicht“ führt zum ganzen Plattenmosaik zurück. „Platten bewegen“ startet die Bewegung. Pause hält sie an, der Kreispfeil daneben stellt die Ausgangslage her. Unter „Bewegungen ansehen“ zeigen Island, Japan und Kalifornien die drei Grenzprozesse aus der Nähe.

## Geometrie und Bewegungen

Peter Birds PB2002 enthält 52 Platten. Zu jeder Platte verbindet der originale Zweibuchstabencode den Umriss, den Namen und genau einen veröffentlichten Rotationspol. Platten können Meeresboden und Kontinente tragen. Die geografische Textur liegt auf den gewölbten Flächen. Die Schnittkanten verdeutlichen ihre schematisch überhöhte Dicke. Die Farben dienen der Unterscheidung. [Peter Bird (2003), *An updated digital model of plate boundaries*](https://doi.org/10.1029/2001GC000252) · [Verwendete Umrisse](https://github.com/fraxen/tectonicplates/blob/339b0c56563c118307b1f4542703047f5f698fae/GeoJSON/PB2002_plates.json)

Das Bezugssystem ist pazifikfest. Im Atlas steht die Pazifische Platte deshalb still. Bei Kalifornien bewegen sich die beiden Platten dennoch relativ zueinander. An einem Ort liefert das Kreuzprodukt aus Winkelgeschwindigkeit und Ortsvektor die Tangentialrichtung. Der vollständige Durchlauf entspricht im Inneren großer Platten der rechnerischen Fortschreibung der heutigen Rotation über zwei Millionen Jahre. „Langsamer“ ändert nur die Abspielzeit. [Originale Rotationspole mit Herkunft je Platte](https://github.com/fraxen/tectonicplates/blob/339b0c56563c118307b1f4542703047f5f698fae/original/PB2002_poles.dat.txt)

Eine langfristige Rekonstruktion müsste wandernde Plattengrenzen sowie die Bildung und den Verbrauch von Lithosphäre einbeziehen. Hier drehen sich die Plattenkörper um ihre Eulerpole. Auf dem Weg zum heutigen Rand nimmt der dargestellte Versatz ab, am gemeinsamen Saum ist er null. Dadurch bleibt die Oberfläche geschlossen. An schmalen Dreiecken begrenzt die Aufbereitung den Versatz zusätzlich, um ein Umklappen einzelner Flächen zu verhindern. Diese grafische Anpassung betrifft kleine Platten anteilig stärker. Die Randverformung und Schichtdicke lassen sich nicht als Messwerte interpretieren. Die regionalen Modelle zeigen, wie Gestein an Grenzen entsteht, abtaucht oder seitlich versetzt wird.

Jeder Steckbrief beschreibt ein konkretes PB2002-Grenzsegment. Die Tabelle gibt den Azimut der linken relativ zur rechten Platte an. Für die Gegenrichtung kommen 180° hinzu. Die Oberfläche rundet auf acht Himmelsrichtungen. Der Grenztext bezieht sich auf denselben Abschnitt. Beispiele sind Parkfield (2877), Island (4209), Japan (2629) und der Ostafrikanische Graben (5502). Der Futuna-Beschriftungspunkt liegt innerhalb des überprüften Vektorumrisses. [Feldbeschreibung der Geschwindigkeiten und Grenztypen](https://github.com/fraxen/tectonicplates/blob/339b0c56563c118307b1f4542703047f5f698fae/original/PB2002_steps_desc.txt)

## Fachliche Grundlage der Schalentexte

Seismische Beobachtungen belegen den überwiegend festen Mantel und den flüssigen äußeren Kern. Im inneren Kern ist Eisen unter hohem Druck fest. Zusammensetzung und Zustand sind unterschiedlich gut auflösbar. Die kurzen Antworten nennen die Hauptbestandteile. [NASA, Earth Facts](https://science.nasa.gov/earth/facts/) · [Earle, Understanding Earth Through Seismology](https://opentextbc.ca/geology/chapter/9-1-understanding-earth-through-seismology/)

Die Trennung dichter Metallschmelzen und leichteren silikatischen Materials erklärt die grundlegende Gliederung in Kern und Mantel. Kruste entstand und entsteht durch mehrere Prozesse, darunter die Abkühlung von Schmelzen. Der innere Kern wächst beim Abkühlen durch Erstarrung. Die Antworten verzichten auf eine genaue Datierung seines Wachstumsbeginns und auf ein einheitliches Bildungsalter der Kruste. [Physical Geology, Earth’s First 2 Billion Years](https://opentextbc.ca/physicalgeology2ed/chapter/22-4-earths-first-2-billion-years/) · [USGS, Understanding Plate Motions](https://pubs.usgs.gov/gip/dynamic/understanding.html)

## Reproduktion und Betriebsformen

`npm ci`, `npm run build` und `npm run standalone` erzeugen die Einzeldatei im Ordner `artifacts`. Texturen, Geodaten, Schrift und Programm stammen aus demselben Produktionsbuild wie das LMS-Paket. Das Exportskript bettet diese Ressourcen ein. Die beiden PB2002-Quelldateien lassen sich mit `python scripts/prepare_mosaic.py PB2002_plates.json PB2002_poles.dat.txt` mit NumPy und Shapely 2.1.2 aufbereiten. Das Skript kontrolliert die SHA-256-Prüfsummen beider Quellen. Zum normalen Bauen ist die GIS-Software entbehrlich.

`npm run test:plattenatlas` prüft die Einzeldatei und die Sicherung unter file:// in Chromium und WebKit. Das Protokoll führt pro Platte den Flächentreffer, alle drei Texte und die Verschiebung eines tatsächlich gerenderten Oberflächenpunkts auf. Es enthält auch Kamerakontrollen, Rücksetzung und warme GPU-Ressourcenzähler. Die Schaltfläche zur Gerätepräsentation lässt sich weiterhin an der Unterrichtshardware erproben.

`python3 scripts/package.py --scorm` erzeugt den eigenständigen SCORM-1.2-Kurs. Das LMS entpackt die Dateien und lädt das Modell im Kursfenster. Der reguläre Start öffnet die Gesamtanwendung. Der Unterrichtseinstieg vom 20. November ist zusätzlich über `?unterricht=schalenbau` erreichbar. Das LMS erhält nur Sitzungsbeginn und Sitzungsende.
