# GeoRisiko G6.9 · Unterricht und Abnahme

**Was lernen wir heute?** öffnet sechs Themenbereiche, die Ortsauswahl und die gemeinsame Suche. Unter Vulkanismus führen Mauna Loa und Zaōzan auf die Erde. **Schnitt öffnen** wechselt von der georeferenzierten Oberfläche zum Anschauungsmodell des Untergrunds. **Zurück** führt zur gespeicherten Perspektive. Im Vollbild sind Themen und **?** unter **Steuerung** erreichbar. Mit **Beobachten ohne Ort** können Lernende zunächst eine eigene Beschreibung entwickeln.

Bei **Fachbegriffe** öffnet ein Klick auf eine Erdschale oder auf eine erläuterte Modellbeschriftung den zugehörigen Text. Mit **Schließen** oder Escape erscheint wieder das Modell. Die historischen Nyos-Messdiagramme, das Ulmener Maar und seine Modellgrenzen lassen sich über die Suche aufrufen. Für die Installation das DMG öffnen, die App nach Programme ziehen und von dort starten. [Installationsanleitung](mac-installation.md)

## Befunde aus dem Ausgangsstand

Im G6.8.2-Shader nahm das Gewicht der globalen Tagestextur mit der Kameradistanz und der Nähe zu einer regionalen Detailstufe ab. Das Gewicht berücksichtigte die geographische Abdeckung des Regionalbildes unzureichend. Dadurch konnte ein viel gröberes Weltbild auch außerhalb des Detailfensters sichtbar werden. G6.9 mischt die Detailstufen pro Bildpunkt und hält außerhalb des Fensters das weltweite Satellitenbild sichtbar. Die Quelldaten unterscheiden sich nach Aufnahmedatum, Auflösung und Lichtsituation. G6.9 überblendet an den Rändern. Die Ursache der auf dem physischen M1 berichteten roten und grünen Linien bleibt offen.

Die Erklärungen der Erdschalen lagen im ausgeblendeten Werkzeugbereich. Seismologische Beschriftungen waren Texte innerhalb einer für Zeigerereignisse durchlässigen Ebene. G6.9 nutzt für erläuterte Beschriftungen Schaltflächen und öffnet die Erklärung im sichtbaren Modellfenster.

## Entwicklungsentscheidung

| Anforderung | Stand und Grenze |
|---|---|
| Globale Landschaftsqualität | Teilweise erfüllt. Das globale Bildraster wächst von 6144 auf 8192 Pixel Breite. Das globale Höhenraster bleibt bei 0,5°. |
| Regionale Landschaftsqualität | Teilweise erfüllt. Nordwesteuropa und die zwei Vulkanfenster erhalten neue Satellitenbilder. Die Detailauflösung variiert räumlich. |
| Freie Orientierung | Teilweise erfüllt. Sichtstrahlen, Fensterausdehnung und vereinfachte Länderflächen bestimmen die Angabe. Küsten und länderübergreifende Ansichten werden verallgemeinert. |
| Texturübergänge | Teilweise erfüllt. Weiche geographische Ränder und durchgehende Welttextur. Der konkrete Befund am M1 benötigt eine Wiederholung. |
| Erdinneres | Teilweise erfüllt. Modellradien, Krustenüberhöhung, stoffliche und mechanische Gliederung bleiben erhalten. Oberflächenmaterialien, Schnittschattierung und Satellitenhaut sind überarbeitet. Modellfarben und Texturen sind veranschaulichend. |
| Vulkanlandschaften | Teilweise erfüllt. Zwei reale Gelände mit gemessenem Profil. Schichten, Gänge und Ausbruchsdynamik bleiben idealisiert. Der Vergleich gibt die unterschiedlichen Ausschnittbreiten an. |
| Prozesse im Raum | Teilweise erfüllt. Die beiden Vulkanfenster verbinden die echte Oberfläche mit den bestehenden Prozessmodellen. Die Prozessanimationen nutzen weiterhin eigene Koordinaten. |
| Themenauswahl | Erfüllt. Gemeinsame Suche und sechs Fachbereiche, einschließlich ihrer Raumbeispiele. |
| Kontextbezogene Hilfe | Für die protokollierten Ansichten erfüllt. G69.json enthält den tatsächlich geöffneten Text. Nicht jede Kombination sämtlicher Werkzeuge wurde einzeln erprobt. |
| Fachinformationen | Teilweise erfüllt. Schalen und Vulkanformen sind per Klick zugänglich. Die Inventare unterscheiden Bedienelemente und reine Beschriftungen. Ein vollständiger Nachweis jedes einzelnen geometrischen Treffers steht aus. |
| Wissenschaftliche Richtigkeit und Bestandsschutz | Fachliche Regressionen, Originaldaten und Produktprüfungen sind im Paket enthalten. Das zusätzliche Vulkanrelief beruht auf Messdaten, die innere Struktur auf einem Anschauungsmodell. |
| Performance und Offline-Nutzung | Messwerte der installierten App und der Einzel-HTML stehen im Abnahmebericht. Der virtuelle Apple-Silicon-Test erfasst Speicher und Bildzeiten. |
| Unterrichtstauglichkeit | Auf der Zielhardware für G6.9 noch nicht überprüfbar. Die Rückmeldung zur physischen Erprobung betrifft G6.8.2. |

Die Offline-Galerie zeigt Originalaufnahmen beider Produkte, Aufnahmen derselben Modelle beider Versionen und zusammenhängende Bedienabläufe. Die Aufnahmebreite eines Films kann von der Darstellungsauflösung des Smartboards abweichen.
