# G5.1 · Daten, Verfahren und Modellgrenzen

## Heutige Platten und Relief

Peter Birds PB2002 enthält die gerichtete Linienführung, die Platten links und rechts, die Bewegung der linken relativ zur rechten Platte, Divergenz, dextrale Komponente und ETOPO5-Höhe. Alle 5.819 Datensätze wurden über das Linienkennzeichen mit der Originalgeometrie verbunden. Bei einem ausdrücklich als SUB klassifizierten Schritt taucht bei `/` die rechte Platte unter die linke, bei `` die linke unter die rechte. Die Abtauchrichtung steht quer zum lokalen Streichen. Die Orientierung der Kamera ändert die Plattenzuordnung nicht. 769 Schritte tragen den Schrägstrich, 358 den Rückstrich. Eine negative Divergenz allein belegt keine Subduktion. Die Regel für die gesonderte Inselbogendarstellung verwendet die Oberplatten Marianen, Tonga und Kermadec. Sie ist keine vollständige Inselbogenkartierung. [Bird 2003](https://doi.org/10.1029/2001GC000252) · [Originaldatensatz und Beschreibung](https://peterbird.name/publications/2003_PB2002/2003_PB2002.htm)

Jede regionale Vorschau hat ein gedrehtes Fenster aus dem lokalen globalen 0,5°-Höhenraster. Die sieben mal sieben Stützwerte sind interpoliert. Die Punktangabe Land oder Meer stammt getrennt davon aus der Originaltabelle. In Küstennähe können die Produkte abweichen. Sechs Referenzregionen nutzen dichtere Höhen-, Bild-, Normalen- und Umgebungsraster aus G5. Die 3D-Gesteinstextur ist eine Materialdarstellung. Die Untergrundkörper außerhalb des japanischen Profils sind geologisch begründete Anschauungsmodelle. [Gelände, Nutzungsrechte und Auflösung](g5-quellen.md)

## Tōhoku und Erdbeben

Der USGS-Slab2-Eingangsdatensatz `jap_SR_myg.csv` enthält 13 seismische Tiefenstützpunkte im Miyagi-Profil. Die 3D-Kontaktfläche folgt der Projektion dieser Punkte quer zum Graben. Meeresspiegel und Gelände teilen sich den vertikalen Maßstab. Zwischen den Stützpunkten wird linear interpoliert, außerhalb setzt sich die Randneigung schematisch fort. Das Profil legt keinen einzelnen historischen Bruch fest. Die Höhenüberhöhung in Japan beträgt 4,7. [USGS Slab2](https://doi.org/10.5066/F7PV6JNV) · [Verwendete Datenversion](https://github.com/usgs/slab2/blob/f53d627ef36cc6a566c6ccd241f7d931fee8ef63/1120database/jap_SR_myg.csv)

Der globale Katalog umfasst 697 überprüfte Erdbeben ab Magnitude 6 in den Jahren 2019–2023. Der regionale Querschnitt verwendet eine gesonderte ComCat-Abfrage ab Magnitude 4,5 im räumlichen Fenster 37–40° N und 138–145° O. Nach Auswahl von Erd­beben mit Reviewed-Status, nichtnegativer Tiefe und maximal 100 km Abstand entlang des Grabens bleiben 176 Ereignisse. Jeder Punkt behält die Ereigniskennung, die Tiefe und den Magnitudentyp. Ein 200 km breiter Streifen wird im Querschnitt zusammengefasst. Der abfallende Gürtel ist ein Beobachtungsmuster. Die Linie beruht auf unabhängigen seismischen Profildaten. [ComCat-Abfrage](https://earthquake.usgs.gov/fdsnws/event/1/query?format=csv&starttime=2019-01-01&endtime=2024-01-01&minlatitude=37&maxlatitude=40&minlongitude=138&maxlongitude=145&minmagnitude=4.5&orderby=time-asc)

P- und S-Geschwindigkeiten und Modellzeiten dienen dem qualitativen Vergleich. Der Kontakt bestimmt Herd, Bewegung und Bruch. Das horizontale maritime Vergleichsbeben verwendet eine eigene Transformgrenze. Das vertikale Ereignis verwendet die Überschiebung vor Japan. Eine eindimensionale Flachwassergleichung mit bewegtem Boden, variabler Tiefe und Trockenfallen liefert die Wasseroberfläche. Küstenform, Zeit und Amplitude sind für die Anschauung vereinfacht. Sie erlauben keine Aussage über Warnzeiten oder reale Überflutungsflächen. [NOAA · Tsunamis](https://www.noaa.gov/education/resource-collections/ocean-coasts/tsunamis)

## Vulkanismus im Inselbogen

Der 480 km breite Schnitt verläuft vom dokumentierten Zaozan (38,1439° N, 140,4397° O) auf Honshū zum Schnittpunkt mit der kartierten Achse des Japangrabens. Seine eigenen Terrarium-Höhen, EOX-Sentinel-2-Oberfläche und NASA-GIBS-Umgebung werden mit `scripts/g51/zao.py` erzeugt. Die Einzelquellen und ihre Prüfsummen stehen in `data/g51/zao/sources.json`. Das Gelände zeigt den realen Berg. Materialwege unter dem Vulkan und die beiden Ausbruchsformen sind ausdrücklich schematisch. Für dieses Parallelprofil wird die Form der abtauchenden Platte idealisiert. Das gemessene Miyagi-Profil gehört zur gesonderten Tōhoku-Erdbebenszene. [Smithsonian Global Volcanism Program, Zaozan](https://volcano.si.edu/volcano.cfm?vn=283190)

## Vergangene und mögliche künftige Erde

Müller et al. 2019 liefern 519 hier zeitlich gültige kontinentale Geometrien mit 335 Rekonstruktionskennungen. pyGPlates berechnet für 251 Zeiten zwischen 0 und 250 Ma die endlichen Rotationen. Die Darstellung interpoliert auf der Kugel und beachtet die Gültigkeit der Flächen. Grenztopologien und deformierende Netze werden zusätzlich aus 51 aufgelösten Zeitschnitten eingeblendet. Alte Küsten und die Topologie eines zwischen zwei Zeitschnitten neu entstehenden Ozeanbeckens sind unsicher. Eine Spur folgt einem mitrotierenden Bezugspunkt im ausgewählten Kontinentalbereich. [Modell und Lizenz](g5-quellen.md) · [Rekonstruktion](https://doi.org/10.1029/2018TC005462)

Die vier Modelle von Davies, Green und Duarte sind hypothetische Zukunftsentwürfe. 479 veröffentlichte Liniensegmente aus ihren GPML-Dateien werden nur in ihrem jeweiligen Gültigkeitsintervall eingeblendet. Diese Modelllinien verwenden die Originalzuordnung der Plattenkennungen. Einige Grenzlinien stehen im Modellkoordinatensystem still, während sich Kontinente bewegen. Der gemeinsame Zeitraum wird beim Vergleich begrenzt. Die Linien sind keine Vorhersage neu entstandener Ozeanböden. [Datensammlung und Rechte](https://doi.org/10.17632/342zcbtvw9.1)

Die Stationen HOFN und REYK in Island sowie KOKB auf Kauaʻi liefern horizontale MIDAS-Geschwindigkeiten im globalen Bezugsrahmen IGS14. Die Komponenten sind von m/Jahr nach mm/Jahr umgerechnet. Sie beschreiben die Bewegung der Station im Bezugsrahmen. Für eine relative Plattenbewegung müssten zwei geeignete Lösungen verglichen werden. Das Projekt gibt die Stationswerte und ihre Beobachtungszeiträume wieder. [Nevada Geodetic Laboratory, MIDAS IGS14](https://geodesy.unr.edu/velocities/midas.IGS14.txt) · [MIDAS-Verfahren](https://doi.org/10.1002/2015JB012552)

## Reproduktion

Die Rohdateien der folgenden Tabelle werden den Skripten in `scripts/g51/` als Argumente übergeben. Die historischen und zukünftigen Modelldateien stammen aus der G5-Quellenpipeline. Alle zur Vorführung benötigten Ableitungen liegen lokal im Projekt. Die Rechte der ursprünglichen Datenanbieter und die nichtkommerziellen Bild- und Zukunftsmodell-Lizenzen aus dem Bestandskatalog gelten fort.

| Eingabe | SHA-256 der ausgewerteten Bytes |
|---|---|
| PB2002 Schritte | `513babb111c65cd275274e2edcb249085d00e007c79d8755e1b4b79f60806f37` |
| PB2002 Linien | `d75631c5c85a1ccf42ba4714902d9bee973069e162403e3467b5855fb9b3efba` |
| Slab2 Miyagi | `4598d067d58ec025a80cece3e87b74d52f55309256862716582207e2b3052f80` |
| ComCat-Abfrage Japan | `0e8241c8a2b99723d5b33eed7a995342daa81eb5b9584463f95f671d5081756a` |
| MIDAS-Tabelle | `0e3ac38650780a517b142c07bf21be9cda8c426b37c20940d6db693c7fe9a036` |
