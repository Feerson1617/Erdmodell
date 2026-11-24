# GeoRisiko G6.1 im Unterricht

In der Regionalübersicht von Parkfield bleibt der Vergleichsweg über der Verwerfung sichtbar. Unter **Ansicht** öffnet die Lehrkraft den lokalen Landschaftsausschnitt oder die bodennahe Kamera. **Untergrund öffnen** führt zum geologischen Schnitt des Regionalmodells. Der Regler behält beim Perspektivwechsel seine Modellzeit. Kameraposition, Blickziel und Ansicht lassen sich als Favorit speichern. **Beobachten** verbirgt die Erklärungen weiterhin.

| Blick auf das Modell | Aussage und räumlicher Maßstab |
|---|---|
| Globus | Globale Kartierung und Rekonstruktionen der Erdoberfläche |
| Regionalübersicht | Relief aus Geodaten. Parkfield umfasst 38 km, Reykjanes 65 km und Tōhoku 320 km. Die Einzelvegetation des Vorgängers entfällt auf dieser Ebene. |
| Nahmodell | Eine lokale Koordinateneinheit der Landschaft entspricht einem Meter. Der Vordergrund zeigt einige zehn Meter, der Horizont reicht weiter. Pflanzen, Geröll und Spaltenformen sind beispielhaft gesetzt. |
| Prozessdetail | Vergleichsweg, Bruch, Wellen, Magmatransport und Küstenüberflutung werden mit den bestehenden Modellkernen beziehungsweise der gekennzeichneten schematischen Ereignisdarstellung untersucht. |

## Drei Referenzlandschaften

**Parkfield.** Das USGS-Höhenmodell bestimmt die großen Formen des 1,8 km breiten Nahfensters. Das dazu passend ausgeschnittene NAIP-Luftbild tritt in der Ferne stärker hervor. Im Vordergrund tragen ungleich große Geländedreiecke kleinräumige Rinnen, Kiesflächen und fotografische Bodenmaterialien. Die beiden Seiten der illustrativen Störung nehmen ihre bewurzelten Objekte bei einem Versatz mit. Der lokale Bruchverlauf und die Einzelpflanzen sind keine örtliche Vermessung.

**Reykjanes.** Ein lang gestreckter Rücken mit einer Spalte und dunklen basaltischen Flächen ersetzt die hohe runde Vulkanform. Die exemplarische Nahansicht zeigt Schutt, Moose und eine eingeschnittene Spalte. Beim Abspielen im Vulkanmodul tritt eine Lavazunge auf. **Vulkanöffnung · Nahblick** zeigt die Austrittsstelle auch am regionalen Vulkanmodell. Neue Abschnitte müssen auf der aktuellen Geländeoberfläche am Ende sowie an drei Zwischenpunkten abfallen. In einer Senke endet der jeweilige Arm. Eine dunkle Kruste, unregelmäßige Risse und die heißere Front folgen der Modellzeit. Eine explosive Wolke dient als Vergleichsereignis. Basaltische Spalteneruptionen sind für Reykjanes besonders charakteristisch. [Smithsonian Global Volcanism Program, Reykjanes](https://volcano.si.edu/volcano.cfm?vn=371020)

**Tōhoku.** Im repräsentativen Küstenausschnitt liegen Laub- und Nadelgehölze am Hang. Lichtdurchlässigkeit und Bodenfarbe ändern sich im flachen Uferwasser. Die ruhige Nahbucht hat keine eigene Überflutungssimulation. Für das Seebeben wechselt die Lehrkraft zur regionalen Ansicht **Entstehung am Meeresboden** und zum **Küstenmodell**. Dort bestimmen die vorhandenen Flachwasserzellen die Wasserhöhe und die Benetzung. Stochastisch verteilte Oberflächennormalen ändern die Reflexion. Der Solver erhält dadurch keine zusätzliche Welle.

Hawaii zeigt breite, niedrige Schilde über der länger beständigen modellierten Schmelzquelle. Junge Flächen im Nahmodell tragen wenig Bewuchs. Für Zentralnepal und den ostafrikanischen Graben verwenden Gelände, Schutt und Vegetation dieselbe Meterkonvention mit anderen Verteilungsmustern. Bei Zaozan bleibt das regionale Höhenmodell sichtbar. Eruption und Magmatransport sind Anschauungsereignisse. [USGS Hawaiian Volcano Observatory](https://www.usgs.gov/observatories/hvo) · [Smithsonian Global Volcanism Program, Zaozan](https://volcano.si.edu/volcano.cfm?vn=283190)

## Was sich bei Nähe, Bewegung und Licht ändert

Im Vordergrund verwenden die fünf offline mitgelieferten glTF-Modelle verzweigte Holzgeometrie, Blattwerk, Gras und fotografierte Gesteinsoberflächen. Eigene dreidimensionale Triebe, Grashalme, Moose, Platten, Palmen und Savannengehölze ergänzen sie. Die mittlere Distanz verwendet Ansichten derselben Modelle als Impostors und vereinfachte Steine. In der Ferne übernehmen Relief, Luftbild und flächige Bedeckung. Bei einem Stufenwechsel bleiben die Wurzelmatrizen gleich. Weiches Himmelslicht hellt Schatten für den Klassenraum auf. Die Nahsonne beleuchtet die tatsächlichen Oberflächen und erzeugt Schatten im Unterrichts- und Maximalprofil.

Die Schnittmaterialien besitzen mineralabhängige Klüftung, Schichtung, Helligkeitswechsel an Kontakten und bildbasierte Normalen. **Modell steuern → Analysefarben im Schnitt** hebt die Körper für die Besprechung farblich hervor. Die Farben dienen der Unterscheidung. Schichtkontakte und geprüfte Bewegungsgeometrien stammen weiterhin aus den wissenschaftlichen Modellen.

## Automatik und Ladezeit

Beim G6-Parkfield-Kaltstart des Referenzlaufs entfielen rund 2,45 Sekunden auf die Shader-Vorbereitung und 2,41 Sekunden auf die erste Zeichnung. Der gesamte Bedienweg dauerte rund 8,47 Sekunden. Ein einzelner großer Abstand zwischen zwei Browseraufrufen konnte die G6-Sparstufe auslösen. G6 konnte anschließend höchstens auf Stufe 1 zurückkehren.

G6.1 trennt Browseraufrufe, neu gezeichnete Bilder, wiederverwendete Bilder, Ladezeit, Aufwärmphase, Kamera und Animation. Nach 1,4 Sekunden Aufwärmen bewertet die Automatik zusammenhängende aktive Bildabstände in Fenstern von mindestens 2,5 Sekunden. Drei schnelle Fenster über 51 FPS erhöhen die Qualität um eine Stufe, zwei langsame unter 29 FPS senken sie um eine Stufe. Eine Umschaltung hat 3,2 Sekunden Einschwingzeit. Einzelne Hänger tragen höchstens 350 Millisekunden zu einem Fenster bei. Nach ihrer Rückkehr verwendet eine Region ihre zuletzt ermittelte Stufe. Die Rohprotokolle weisen tatsächliche Renderauflösung, Speicher, Qualitätswechsel, Bildpausen und Renderaufrufe aus.

Die Materialbibliothek wird beim Öffnen der Erdbebenkarte vorbereitet. Nahdetails laden beim ersten Aufruf des Ausschnitts. Das Programm hält eine Parkfield-Unterrichtsszene für den erneuten Einstieg und lädt die fünf unterschiedlichen Objektvorlagen höchstens einmal pro Sitzung. Ein wiedergeöffneter Unterrichtsraum startet mit den ursprünglichen Bedieneinstellungen.

## Modellgrenzen

Die Nahlandschaften zeigen typische Gelände- und Vegetationsformen. Nur für Parkfield enthält das Nahmodell ein zusätzliches lagegleiches Luftbild und Höhenraster. Blattbüschel, entfernte Impostors und wiederkehrende Objektformen bleiben erkennbar. Das Meer verwendet Oberflächennormalen und modellierte Himmelsreflexion. Die Eruptionswolke besteht aus räumlich verteilten Partikelschichten. Ein Fotovergleich mit einem nachweislich identischen Geländepunkt oder die Vorhersage einer konkreten Eruption ist damit nicht möglich.

Der Prüfbericht ordnet Geschwindigkeiten dem tatsächlich verwendeten System zu. Die G6- und G5.2.1-Ausgaben bleiben an ihren eigenen Commits und Pull Requests abrufbar. [G6](https://github.com/Feerson1617/Erdmodell/pull/16) · [G5.2.1](https://github.com/Feerson1617/Erdmodell/tree/439a6b69e250060ffb39f8ab9aad653775c4289d)
