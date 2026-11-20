# G4.3.1 · Fachanhang zum Plattenatlas

## Unterricht

Der Atlas zeigt die heutige Lage aller 52 PB2002-Platten. Jede Lithosphärenplatte umfasst die Kruste und den starren obersten Mantel. Das grafische Kartenbild öffnet sich, um die Platten sichtbar zu machen. Farben und Dicke sind didaktisch gewählt.

Eine Fläche antippen und „Zentrieren“ wählen, um ihre Lage und ihre Nachbarn zu betrachten. „Grenze ansehen“ führt an das Beispiel im Steckbrief und hält beide Gesteinsausschnitte in ihrer Ausgangslage. „Platten bewegen“, „Pause“ und der Kreispfeil steuern die Bewegung. Der helle Gesteinsstreifen hilft, den Versatz zu sehen. Ohne vorausgehende Auswahl führt „Platten bewegen“ nach Island. „Zur Weltansicht“ bringt den Globus zurück. Die drei ausführlicheren regionalen Prozessmodelle stehen unter „Bewegungen ansehen“.

## Gegenstand und Bezugssystem

Die Weltkarte übernimmt die vektorisierten PB2002-Umrisse und ihre bisherigen Dreiecke. Alle Körper im Atlas behalten im Modell der Gegenwart ihre Form und Lage. Der Grenzvergleich verwendet zwei farblich zugeordnete Gesteinsausschnitte an einem ausgewählten Grenzsegment. Die örtlichen Ausschnitte haben schematische Schnittkanten, geologische Textur, eine überhöhte Dicke und einen sichtbaren Anfangsabstand. Betrachtet wird die Bewegung über die Grenze hinweg. Die neutrale Fläche darunter dient nur als Darstellungshintergrund. Der helle Streifen ist eine modellierte Orientierungshilfe. [Bird (2003), *An updated digital model of plate boundaries*](https://doi.org/10.1029/2001GC000252) · [Vektorumrisse](https://github.com/fraxen/tectonicplates/blob/339b0c56563c118307b1f4542703047f5f698fae/GeoJSON/PB2002_plates.json)

Die Ausgangspole beziehen sich auf die Pazifische Platte. Ihre Nullrotation ist eine Wahl des Bezugssystems. Jeder Zweibuchstabencode verbindet genau einen Pol mit einem Umriss. Die Quelldatei enthält Polbreite, Pollänge und die positive Winkelgeschwindigkeit gegen den Uhrzeigersinn. Die Prüfung vergleicht alle 52 Zuordnungen mit der unveränderten Originaltabelle. [PB2002-Rotationspole mit Herkunft je Platte](https://github.com/fraxen/tectonicplates/blob/339b0c56563c118307b1f4542703047f5f698fae/original/PB2002_poles.dat.txt)

Für linke und rechte Platte gilt am Ortsvektor **r** die momentane Relativgeschwindigkeit **v = (ω links − ω rechts) × r**. Links und rechts folgen dem digitalisierten Verlauf des Grenzsegments. Im symmetrischen Vergleich erhalten die beiden Körper halbe, entgegengesetzte Drehwinkel um die gemeinsame relative Eulerachse. Ihre relative Drehung entspricht der aus dem Differenzvektor fortgeschriebenen momentanen Bewegung. Auch die Pazifische Platte kann sich deshalb im Bild bewegen. Gespielt wird ein kurzer, örtlich für die Sichtbarkeit skalierter Modellweg. Geschwindigkeit, Dauer und Weglänge lassen sich zwischen Beispielen aus der Animation nicht ablesen. Die Simulation datiert keine frühere Erdoberfläche. [Originaltabelle und Feldbeschreibung der Grenzbewegungen](https://github.com/fraxen/tectonicplates/blob/339b0c56563c118307b1f4542703047f5f698fae/original/PB2002_steps_desc.txt)

Beide Körper drehen sich um den Erdmittelpunkt. In jedem Körper wird derselbe orthogonale Rotationstransform auf sämtliche Punkte angewendet. Material, Oberfläche und Seiten bewegen sich gemeinsam. Für Konvergenz ist der Anfangsabstand so gewählt, dass die Bewegung vor einer Berührung endet. Der Japan-Vergleich zeigt die horizontale Annäherung. Der gesonderte Japan-Schnitt erklärt das Abtauchen. Die regionalen Prozessschnitte behalten ihre eigenen Anschauungsmodelle für Vorgänge an einer Grenze.

## Auswahl der Beispiele

Die 52 Steckbriefe verwenden eine redaktionell festgelegte Liste von 48 unterschiedlichen PB2002-Segmenten. Einige Platten teilen dasselbe Beispiel. Parkfield verdeutlicht seitliches Vorbeigleiten, Island das Auseinanderrücken, Japan und Chile das Abtauchen, der Himalaya die Kontinentkollision und der Ostafrikanische Graben die Dehnung kontinentaler Kruste. Auch für die Mikroplatten ist je ein namentlich verortetes Beispiel hinterlegt. Die Richtung im Steckbrief gilt für diesen Ort und die genannte Nachbarplatte. Die vollständige Zuordnung samt Prüfung steht in der Datei geometrie.json im Sichtprüfungs-ZIP. [Datengrundlage und regionale Prozessmodelle](g2.1-daten.md) · [Earle, Plate Motions and Plate Boundary Processes](https://opentextbc.ca/physicalgeology2ed/chapter/10-4-plate-plate-motions/)

## Kamera und Informationen

„Zentrieren“ verwendet einen Innenpunkt des Vektorumrisses sowie den größten Winkelabstand seiner Eckpunkte auf der Kugel. Damit werden Datumsgrenze und Polgebiete ohne Sprung in den Koordinaten behandelt. Perspektivisches Blickfeld, Fenstergröße, sichtbare Höhe und der von der Seitenleiste freie Bildbereich bestimmen den Abstand. Sehr große Platten erhalten eine überschaubare Halbkugel. Ein eigener Zielpunkt und ein schräger Blick gelten für das jeweilige Grenzbeispiel. Nach der Kamerafahrt ist die Drehung frei.

Beim Schalenbau bleiben Namen zunächst verborgen. Die Materialantworten unterscheiden feste Gesteinskruste, überwiegend festen und langfristig verformbaren Mantel sowie flüssigen äußeren und festen inneren Metallkern. Die Entstehungstexte trennen frühe Metall-Gesteins-Trennung, spätere Erstarrung des inneren Kerns und fortdauernde Neubildung und Veränderung der Kruste. Genaue Anfangszeiten sind offen. [NASA, Aufbau der Erde](https://science.nasa.gov/earth/facts/) · [Earle, frühe Differentiation der Erde](https://opentextbc.ca/physicalgeology2ed/chapter/22-4-earths-first-2-billion-years/) · [Earle, seismische Evidenz](https://opentextbc.ca/geology/chapter/9-1-understanding-earth-through-seismology/)

## Betriebsformen

Die Einzeldatei enthält Programm, Schrift, Daten und Texturen und startet über file://. Der SCORM-Kurs wird im LMS entpackt und per HTTP(S) im Kursfenster geöffnet. Er meldet nur LMSInitialize und LMSFinish und schreibt keine Schülerdaten, Punktwerte oder Lernstände. Die G4.3-Einzeldatei unter ausgabe/GeoRisiko-Erdmodell-G4.3.html bleibt als Rückfall erhalten.

Für eine Reproduktion im Repository dienen npm ci, npm run build, npm run test:plattenatlas und python3 scripts/atlas_review.py. Der SCORM-Export läuft über python3 scripts/package.py --scorm. Vollständige Paket- und Regressionstests laufen im Pull Request.
