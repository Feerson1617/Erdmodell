# GeoRisiko 3D · Qualitätskorrektur G4.2.1

## In der Stunde

Öffnen Sie **Schalenschnitt**. Lassen Sie zunächst Formen, Lage und Größen vergleichen. „Einzelnen Namen zeigen“ gibt eine gewählte Schale frei. „Namen verbergen“ führt auch nach einer einzelnen Freigabe zur anonymen Ansicht zurück. Ein Tipp auf einen Namen öffnet höchstens zwei kurze Sätze neben dem Modell. „Schließen“ oder Escape schließt die Erklärung.

**Kruste verbreitern** eignet sich, um die schmale Außenschicht zu erkennen. **Lithosphäre vergleichen** schaltet automatisch auf die Referenzradien zurück. Die Schraffur reicht durch die Erdkruste in den starren obersten Mantel. Ihr unterer Rand deutet an, dass die Dicke örtlich variiert. Beide Anteile bleiben an ihren Materialfarben erkennbar. Die Erde behält ihre vier stofflichen Schalen. Auch unter der Lithosphäre ist das Gestein überwiegend fest. [USGS · Inside the Earth](https://pubs.usgs.gov/gip/dynamic/inside.html)

Unter **Plattentektonik** stehen „Plattengrenzen zeigen“, „Namen zeigen“ und „Bewegungen ansehen“ direkt zur Verfügung. Wählen Sie bei Island, Japan und Kalifornien jeweils eine Bewegung. Bei Japan taucht eine ozeanische Platte ab. An anderen zusammenlaufenden Grenzen können Kontinente aufeinanderstoßen. Kruste und starrer oberster Mantel bilden zusammen die bewegten Platten. Eine Platte kann sowohl Ozeanboden als auch Kontinente tragen. Ihre Bewegung dauert in der Natur sehr lange. [USGS · Understanding plate motions](https://pubs.usgs.gov/gip/dynamic/understanding.html) · [PB2002 und regionale Modelle](g2.1-daten.md)

„Weitere Einstellungen“ enthält die Grenztypen, die gezielte Plattenauswahl und Namen kleinerer Platten im Fernblick. Im regionalen Schnitt stehen zunächst bis zu vier wichtige Namen direkt am Objekt. Nach Freigabe kann die Lehrkraft einen weiteren Begriff wählen. Blickrichtung und Platz entscheiden, welche Schilder tatsächlich sichtbar sind. Der Schalter „Namen zeigen“ verbirgt sie gemeinsam.

Nach mehreren westwärts gerichteten Ortswechseln konnte in G4.2 der regionale Schnitt trotz passender Kamera verschwinden. G4.2.1 behandelt Längengrade auch nach mehreren Erdumrundungen zyklisch. Der Browserregressionstest wiederholt diese Route.

## Fachliche und didaktische Prüfung

Der Referenzradius der Erde beträgt 6371 km. Die Materialgrenzen liegen bei 6336, 3481 und 1221 km. Nur die ausdrücklich gekennzeichnete Krustenüberhöhung versetzt die oberste Grenze. Die Schraffur basiert ausschließlich auf der Referenzgeometrie und ist auf einen Ausschnitt begrenzt. Die regionalen Oberflächen, Bewegungen und Zeitabläufe sind schematisch. Lage und Orientierung folgen weiterhin den geographischen Daten. Der Grafikstil A, Gelände, Licht und die adaptive Renderauflösung werden aus G4.2 übernommen. [Fachprüfung der Grundlagen](grundlagen-g4.2.md) · [Regionale Fachquellen](g2.1-prozessmodelle.md)

Die Fachanforderungen Geographie Schleswig-Holstein (2015), Sekundarstufe I, Tabelle 1, nennen bei **F1 (S1)** den Aufbau der Erde als planetares Merkmal. **F2 (S5)** umfasst die Lageveränderung geotektonischer Platten. **F2 (S7)** umfasst das Darstellen des Ablaufs naturgeographischer Prozesse. Der Leitfaden (2016) verbindet Erdaufbau, Modellannahmen und Naturrisiken. Der Schalenschnitt ermöglicht den Strukturvergleich, die drei Beispiele die Beobachtung von Struktur und Prozess. Lehrkraft und Lernende gestalten Vorhersagen, Diskussion und Lernprodukte im Unterricht. Das schulinterne Curriculum lag nicht vor. [Fachportal Schleswig-Holstein](https://fachportal.lernnetz.de/sh/fachanforderungen/geographie.html) · [Josef Leisen · Lehr-Lern-Modell](https://www.lehr-lern-modell.de/)

## Abnahmenachweise im Sichtprüfungspaket

| Frage | Nachweis |
|---|---|
| Sind die Vergleichsmodi getrennt? | Ein gemeinsamer Modellzustand steuert beide Schalter. Der Browsertest prüft beide Wechselrichtungen, Referenzradien, Kamerapose, anonyme Darstellung und Reset. Bilder 04 und 05 zeigen die beiden Zustände. |
| Ist die Plattenkarte einfacher zu bedienen? | Bild 07 zeigt die Grundsteuerung. Die erweiterten Optionen bleiben nach dem Öffnen bei einer Filterwahl erreichbar. |
| Sind die Schilder lesbar? | Bild 11 und der Messbericht dokumentieren Schriftgröße und Touchfläche bei 1920 × 1080. Die tatsächliche Lesbarkeit aus der letzten Reihe muss im Klassenraum geprüft werden. |
| Funktionieren die Definitionen? | Bilder 03 und 12, die Touch- und Tastaturprüfung und die wiederholten Öffnungen im Leistungsvergleich prüfen diese Bedienfolge. |
| Folgen Schilder und Linien dem Gestein? | Die Browserprüfung vergleicht sichtbare Linienanfänge mit Projektionen der bewegten Objektanker. Die Aufnahme zeigt Wiedergabe, Drehung und Zoom. Die Verdeckungsprüfungen nutzen die tatsächlichen verformten Dreiecke. |
| Wie wirkt sich die Optimierung aus? | Unter `Pruefung/vergleich/Leistungsvergleich.md` stehen sieben gepaarte Messungen je Browser. `leistung.json` enthält Bildintervalle, CPU-Prozesszeiten, verfügbare GPU-Zeiten, DOM- und Geometriezähler. |
| Bleibt Variante A erhalten? | Material, Licht, Bewegungsgeometrie und Regler der Renderauflösung entsprechen dem Ausgangsstand. Aktuelle Bilder liegen unter `Pruefung/grundlagen/`, gleichartige Aufnahmen der geprüften Referenz unter `Pruefung/vergleich/g4.2/`. Auf dem Referenzbild 04 lässt sich die frühere Kombination beider Vereinfachungen erkennen. |
| Was bleibt offen? | Die Linux-Runner decken kein physisches MacBook, iPad oder Schul-Smartboard ab. Eine Messung der Auslastung einer physischen GPU, die Unterrichtserprobung und ein Import im schulischen itslearning-Mandanten stehen aus. |
| Welche Regressionen werden geprüft? | Die G1-, G2- und Nyos-Suiten prüfen unter anderem Wellen, Hooge, Helgoland, die drei Plattenregionen, CO₂-Freisetzung und Schutzmaßnahmen, einschließlich Datenfehlern und Ersatzdarstellungen. |
| Wo liegen die Pakete? | Am Actions-Lauf des PR stehen Unterricht, SCORM 1.2 und Sichtprüfung als einzelne ZIPs. Der Pakettest entpackt und öffnet jede Fassung. Die SCORM-Sitzung wird gegen eine LMS-API mit protokollierten Aufrufen geprüft. |

**Start auf dem Mac.** Unterrichts-ZIP vollständig entpacken und mit installiertem Python 3 `START.command` öffnen. Für das LMS das SCORM-ZIP importieren. Unter `Pruefung/grundlagen/Messbericht.md` stehen die Browser- und Smartboard-Messungen des zugehörigen Builds.
