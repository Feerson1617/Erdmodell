# Nyos-See · unabhängige technische und visuelle Abnahme

Der Git-Stand des untersuchten Produktionsbuilds steht in `Pruefstand.txt` und im jeweiligen JSON-Protokoll. Die Sichtprüfung enthält die lauffähige Fassung und die unveränderten Browseraufnahmen. Die Bilder und Messwerte werden aus der entpackbaren Anwendung unter einem verschachtelten Webpfad gewonnen.

## Was die Nachweise zeigen

| Prüfung | Unabhängiger Nachweis |
| --- | --- |
| Geographische Lage | Die Prüfung liest die ausgelieferten Höhendaten und die koordinierte Uferlinie unabhängig vom Renderer. Sie berechnet Fläche und Achsenausdehnung, vergleicht Wasser- und Rasterhöhe, prüft das Höhengefälle nördlich des Sees und die Lage bei etwa 6,44° N und 10,30° O. |
| Gemeinsame 3D-Welt | Der erste Anflug bei normaler Bewegung liefert Bildproben von der Erde bis zur lokalen Landschaft. Je Bild werden Position, Distanz, Kameraorientierung, Detailgewichte und die Identität des Canvas erfasst. Zwei verschiedene HTTP-Unterpfade werden in Browser- und Pakettests verwendet. |
| Tatsächliche Ansicht | Die PNG-Rasterprobe liest gerenderte WebGL-Pixel vor dem Browser-Compositing. JPGs dokumentieren die sichtbare Oberfläche einschließlich Legenden und Bedienelementen. Die Bedienungsaufzeichnung zeigt einen separaten, zusammenhängenden Ablauf. |
| Ressourcen | Die Prüfung erfasst Bildabstände in Millisekunden, den tatsächlich gerenderten Puffer, Dreiecke, GPU-Geometrien, Texturen und Shaderprogramme. Der JavaScript-Heap wird erfasst, wenn der Browser Zugriff gewährt. Programm- und Texturanzahl zeigen mögliche Lecks, erlauben jedoch keine Angabe der systemweiten GPU-Belegung in MiB. |

## Entwicklungskontrollen

**Erster Gate-A-Flug.** Der Test erreichte in Chromium dieselbe 3D-Landschaft über Afrika und Kamerun. Das von der Geodatenaufbereitung getrennt ausgewertete Raster umfasst 397 × 441 Höhenknoten von 670 bis 1.724 m. Die aus den 90 Uferpunkten berechnete Fläche beträgt rund 1,55 km². Die Ostflanke erreicht an der Kontrollstelle 1.190 m. Zwei weitere Kontrollstellen nördlich des Sees liegen bei 1.023 und 898 m. Die örtlichen Höhen stammen aus dem Oberflächenmodell. Die Ausdehnung eines historischen Gasstroms lässt sich daraus allein nicht bestimmen.

Beim ersten visuellen Durchgang zeigte die Regionsansicht einen gepunkteten rechteckigen Übergang am Rand des örtlichen Höhenmodells. Nach der Korrektur blieben das regionale Grundbild und die Geländeoberfläche während des Übergangs deckend. Ein zweiter tatsächlicher Kaltflug sowie neue Aufnahmen aus denselben Kameraposen bestätigten den durchgehenden Übergang und ein geschlossenes Westufer. Erst danach wurde Gate B freigegeben.

**Gate B.** Der freie Blickwechsel im örtlichen Schnitt wurde mit Maus und Zoom ausgeführt. Die unveränderten Bilder 05 und 06 zeigen den See vor und nach dieser Bewegung. Der modellierte Schnitt hat rund 1,32 km horizontale Spannweite und 208 m maximale Tiefe. Die Form ist beschriftet als schematisch. Bild 07 zeigt nach Freigabe die abgestufte Analysefarbe im Tiefenwasser. Im ruhenden Zustand erscheint kein freies Gas. Der Vergleich drei unmittelbar nacheinander gerenderter Bilder belegte einen sichtbaren und vollständig reversiblen Farbwechsel.

**Gate C.** In den eigens angehaltenen Browserbildern 08 und 09 wurden Entlösung im Wasser und Austritt an der Oberfläche getrennt betrachtet. Das erste Bild der Talphase erklärte die Analysefarbe unvollständig. Nach der Korrektur nennt die sichtbare Legende das farblose Gas und den schematischen Verlauf samt Reichweite. Im erneuten Browserlauf waren Start, Fortsetzen, Pause, Zeitlupe und Reset wirksam. Das freiwillig zuschaltbare Overlay verschwand beim Abschalten wieder vollständig. Die historische Ortsskizze ließ sich per Tastatur öffnen. In einer gesonderten Kameraprobe blieben auch mitten im Übergang Position, Blickrichtung und Zeitstand beim Pausieren bestehen.

**Gate D.** Der erste Browserdurchgang zeigte die drei späteren Schutzansichten. Im Rohr hielt die Richtungsanzeige auf Befehl an. Sie erschien vor dem kontrollierten Austritt am oberen Rohrende. Die Zeitdarstellung verbindet Entnahme und abnehmenden Gasvorrat über Jahre. Das Zurücksetzen stellte den ruhenden Ausgangszustand wieder her. Das Messprofil zeigte mehrere Probentiefen. In der räumlichen Vorsorge waren die neutral beschrifteten Beispielpunkte „Talboden“ und „Hang“ zu sehen. Nach der Rückkehr zur historischen Situation verschwanden alle Schutzobjekte. Im korrigierten Rohrquerschnitt wurden vor dem Schalten zwei visuell identische Referenzbilder geprüft. Beim Ein- und beim Ausblenden der Analysefarbe änderten sich jeweils 1,37 % der Modellpixel. Das ausgeschaltete Bild entsprach wieder exakt der Referenz.

Die getrennten lokalen Entwicklungsläufe auf Linux nutzten Chromium mit SwiftShader auf geteilter Rechenleistung. Im Kontrolllauf B wurden für die Seeansicht bei 1.080 × 624 Renderpixeln 4,0 Bilder/s und ein 95. Perzentil von 433 ms gemessen. Im Kontrolllauf C waren es bei gleicher Geometrieansicht 1,9 Bilder/s und 1.350 ms. Für die späte Ereignisphase ergab der korrigierte Kontrolllauf C2 1,4 Bilder/s und 883 ms. Diese Software-Renderwerte zeigen deutlich sichtbare Bildsprünge. Die Endmessungen für den Auslieferungsstand stehen separat im paketierten Messbericht.

## Antworten zur Übergabe

| Frage | Einordnung |
| --- | --- |
| 1. Geographische Originaldaten | Das Projekt nutzt die Copernicus-DEM-Kachel N06/E010, natürliche Farben von Sentinel-2A vom 10. Januar 2025 und die regionale NASA-Blue-Marble-Karte. Die lokale Wasserlinie wurde aus derselben Sentinel-Beobachtung gewonnen. |
| 2. Genauigkeit des Geländes | Das Höhenmodell hat etwa 31 m horizontalen Probenabstand. Die feineren Bilddaten enthalten keine zusätzlichen Höhenmessungen. Vegetationsoberflächen, das gerundete Höhenraster und die vereinfachte Netzgeometrie begrenzen die Geländegenauigkeit. Es gibt keine lokale Vermessungsabnahme. |
| 3. Geodaten und Erklärungsmodelle | Ufer, Oberflächenhöhen und Satellitenfarbe sind geographisch registriert. Unterwasserprofil, vertikaler Schnitt, Tiefenfärbung sowie Ereignis und Schutzgeräte werden als Erklärungsmodelle verwendet. Die Talreliefs besitzen reale Höhen. Die farbige Ausbreitung ist qualitativ. |
| 4. Sichtbarkeit des CO₂ | Die einblendbare Analysefarbe ordnet dem Tiefenwasser einen stärkeren Farbton zu. Gelöstes CO₂ ist normalerweise unsichtbar. Gasblasen treten im Modell erst bei der Entlösung während des Ereignisses auf. Das farblose CO₂ in der Luft erhält ausschließlich auf Wunsch eine gesondert gekennzeichnete Analyseansicht. |
| 5. Ereignis 1986 | CO₂ aus dem See wurde freigesetzt. In tieferen Geländelagen und betroffenen Siedlungen starben Menschen und Tiere. Die Entstehung des Maares liegt zeitlich davor. |
| 6. Historische Unsicherheit | Die Modellfolge zeigt, wie Druckabnahme, Entlösung und Auftrieb einander verstärken können. Der unmittelbare Auslöser vom 21. August 1986 ist ungeklärt. Der kausale Ablauf und die Ortsübersicht bilden weder eine sekundengenaue Beobachtung noch eine Konzentrationsmessung nach. |
| 7. Risikominderung | In einer eigenen späteren Situation lassen sich kontrollierte Entgasung über ein Rohr, Überwachung und räumliche Vorsorge vergleichen. Eine Rangliste oder ein aktueller Gefahrenstatus wird daraus nicht abgeleitet. |
| 8. Kamerafahrt | Dasselbe Canvas und dieselbe Kamera verbinden Erde, Kamerun, Umgebung und lokales Ufer. Das JSON enthält aufeinanderfolgende Bildproben mit Kamerapose, geografischem Ziel und Sichtbarkeitsgewichten. |
| 9. Bildrate | Der im Sichtprüfungs-ZIP beiliegende Messbericht nennt für jeden Browser die beobachtete FPS-Zahl, typische und maximale Bildabstände, Auflösung, GPU-Objektanzahl und verfügbaren Heap. Nur Messungen des in diesem ZIP ausgewiesenen Commits gehören zum Auslieferungsnachweis. |
| 10. Sichtbare Grenzen | Das Datenmaterial ist eine Trockenzeitaufnahme. Bei starkem Zoom werden die begrenzte Fotoauflösung und die modellierte Uferkante sichtbar. Die Schnittöffnung legt eine erläuterte Annahme zur Beckenform frei. Wind, Luftdurchmischung und Gaswege werden qualitativ dargestellt. |
| 11. Regressionen | Der vollständige Workflow prüft außer Nyos die anonyme Schalenansicht, Rotation, Maßstabswechsel, Plattentektonik, Hooge, Helgoland, Geräteprofile und die entpackten Pakete. Die tatsächlichen Ergebnisse und Grenzen sind in den mitgelieferten Protokollen dokumentiert. |
| 12. Pakete | Die Artefakte heißen `GeoRisiko-G4-Nyos-Unterricht.zip`, `GeoRisiko-G4-Nyos-SCORM-1.2.zip` und `GeoRisiko-G4-Nyos-Sichtpruefung.zip`. Die Unterrichtsfassung startet über den mitgelieferten Loopback-Server. Der PR und sein erfolgreicher Actions-Lauf enthalten die Zuordnung zum Auslieferungscommit. |
| 13. Vor Ort | Die Lehrkraft sollte die Modellfläche, Lesbarkeit, Touchziele, Bildrate und den lokalen Starter auf der konkreten Ausstattung prüfen. Der physische MacBook-/Smartboard-/iPad-Test und der Import im konkreten Schul-LMS bleiben gesonderte Nachweise. |

Die Fachgrundlage für Ereignis und Schutz erläutert der Fachanhang. Datenbeschreibung und Nachnutzungsbedingungen stehen in der Geodatendokumentation. [Geowissenschaftlicher Fachanhang](nyos-geowissenschaften.md) · [Geodaten](nyos-geodaten.md)

## Prüfpfade

Der Standardlauf `node tests/nyos.mjs` verwendet Chromium und WebKit. Mit `NYOS_GATE=A`, `B`, `C` oder `D` lässt sich ein begrenzter Zwischenstand separat prüfen. Solche Teilläufe erzeugen eigene Protokolle und ersetzen den vollständigen Abnahmenachweis nicht. Geodatenfehler, fehlende Renderbilder, unerwartete externe Anfragen und Browserfehler führen im regulären Pfad zum Fehlschlag.

Vor dem Prüflauf müssen der Produktionsbuild und die Playwright-Browser vorliegen. Das Sichtprüfungs-ZIP enthält die ursprünglichen JPGs, die Bedienaufzeichnung sowie die Rohmessungen in `pruefung.json`. Jeder Bildnachweis trägt im Protokoll seinen SHA-256-Prüfwert. Die tabellarischen Bildzeiten stehen im beigefügten Messbericht.

## Grenzen der Abnahme

Der digitale Oberflächenraster prüft Gelände und Ufer am Standort. Er liefert keine vermessene Unterwassergeometrie. Ein erfolgreicher Bildvergleich bestätigt die Sichtbarkeit eines Modells und seiner Zustandsänderung. Die Rekonstruktion des exakten historischen Auslösers, örtlicher CO₂-Konzentrationen und Gefährdungsgrenzen ist daraus nicht möglich.

Die Browserläufe verwenden eine Linux-Umgebung. Die ausgewiesenen Bildraten gehören zu den im Protokoll benannten Renderern und Auflösungen. Am MacBook Air M1, dem schulischen Smartboard und einem physischen iPad bleiben vor der Stunde Bildrate, Spiegelung, Fernlesbarkeit und Touchreaktion zu prüfen. Die SCORM-Prüfung verwendet einen simulierten LMS-Host. Die Freigabe im konkreten itslearning-Schulmandanten steht aus.
