# GeoRisiko G4.3.1 · Abschlussbericht

Geprüfte Einzeldatei, SHA-256 `b42801b2c5ff63482c0896a399e95d3c7d4d9f0e57628769cc6ee3e933a64372`.

1. Im heutigen Weltatlas sind die Grenzpunkte ortsfest. Die frühere ortsabhängige Verformung im Bewegungsmodus wurde vollständig entfernt.
2. Alle 48 Vergleichspaare verwenden starre Drehungen. Maximal gemessene Distanzabweichung innerhalb eines Körpers: 2e-12 km. Die Orthogonalität der Körpermatrizen sichert die Distanzen für alle Meshpunkte.
3. Zwei Gesteinsausschnitte zeigen horizontale Relativbewegung an einem namentlich bekannten PB2002-Segment. Die ursprünglichen vertiefenden Prozesse bei Island, Japan und Kalifornien bleiben erhalten.
4. Die Ausgangsdaten sind pazifikfest. Der örtliche Vergleich teilt den Differenzvektor beider Winkelgeschwindigkeiten symmetrisch auf die Körper auf. Größte Abweichung von der gerundeten, veröffentlichten Segmentrichtung: 0.49°.
5. Dicke, Anfangsabstand und Zeit sind schematisch. Keine historische Rekonstruktion. Die geprüfte kontinuierliche Untergrenze des Abstands der beiden Körper beträgt über alle Paare 1.06 Modellkilometer. Beim Auseinanderrücken wird eine neutrale Zeichenfläche sichtbar.
6. Der helle Gesteinsstreifen zeigt den Versatz. Im Kalifornien-Vergleich verschoben sich die projizierten Punkte der beiden Körper relativ zueinander um 103 px (chromium) / 103 px (webkit). Start, Zwischenstand, Endstand und Reset sind echte Browseraufnahmen. Eine Unterrichtserprobung mit Lernenden steht aus.
7. Der Kameraabstand hängt von Umriss, Blickfeld und freiem Bildschirmraum ab. Die Tabelle unten zeigt die besonders geprüften Platten.
8. Beide Browser trafen alle 52 Platten mit Maus oder Touch auf dem gerenderten Körper. Nach dem Zentrieren waren jeweils weitere Platten sichtbar. Anschließende Rotation und Rückkehr zur Weltansicht wurden ausgeführt.
9. Alle Steckbriefe verwenden fest ausgewählte, verortete Beispiele. Die Himmelsrichtung bezieht sich auf die ausdrücklich benannte Nachbarplatte. Der Fachanhang erklärt die Auswahl.
10. Im Smartboard-Bild bei 1920 × 1080 sind der vollständige Plattenname, die drei kurzen Abschnitte und der Schließen-Knopf nebeneinander mit dem Globus lesbar. Im Tablet-Hochformat steht der Steckbrief unter dem Globus. Auch bei 1366 × 768 und 1024 × 768 wurde geprüft, dass der Steckbrief oben beginnt, der Titel sauber umbricht und das Schließziel mindestens 44 CSS-Pixel hoch ist. Die Lesbarkeit aus der letzten Reihe hängt vom realen Gerät und Raum ab.
11. Der Schalenschnitt öffnete sich anonym. Beide Browser gaben die vier Namen frei und öffneten und schlossen alle acht Antworten. Krustenmaßstab und Lithosphärenvergleich gehören zusätzlich zur Schalenregression.
12. Chromium und WebKit öffneten die Einzeldatei unter file:// bei gesperrtem HTTP(S). Es gab keine weiteren Dateianforderungen und keine Browserfehler.
13. Die Browserprotokolle belegen Flächentreffer, Kamera, Auswahl, Wiedergabe, Pause, Reset, Schalen, drei Regionen und Rückkehr. Die weiteren Testjobs im Pull Request prüfen auch Nyos, Navigation, Schulstunde und das entpackte SCORM-Paket.
14. Die folgenden Tabellen vergleichen dieselben Cloud-Browser, Auflösungen und Eingabefolgen. Die beiden Bewegungsansichten haben unterschiedliche Bildausschnitte. CPU-Prozent beziehen sich auf einen logischen Kern. Geometrien, Texturen und Programme sind Ressourcenindikatoren. GPU-Speicher in Bytes wurde nicht gemessen.
15. Die Werte betreffen Linux-Rendering. MacBook Air M1, iPad, physisches Smartboard und der Import ins produktive itslearning wurden nicht an Originalgeräten geprüft. Ein regionaler Schnitt kann auch Biegung oder Materialtransport erklären. Der Starrheitstest bezieht sich auf die beiden Körper jedes neuen Grenzvergleichs.
16. Die drei fertigen Dateien stehen im Ordner ausgabe des Entwicklungsbranches und als einzelne Artefakte des erfolgreichen Prüflaufs im Pull Request. Die gesicherte G4.3-Einzeldatei steht im selben Ordner. [Einzeldatei und ZIPs](https://github.com/Feerson1617/Erdmodell/tree/feature/georisiko-g4-3-1-plattenkorrektur/ausgabe) · [Prüfläufe](https://github.com/Feerson1617/Erdmodell/pull/10/checks)

## Kameraprüfung

Stichprobe aus dem vollständigen Chromium-Flächentest. Die Spannweite ist aus einem Raster auf der frei sichtbaren Modellfläche bestimmt.

| Platte | Kameraabstand (km) | erfasste Spannweite (px) | weitere sichtbare Platten |
|---|---:|---:|---:|
| Pazifische Platte | 19500 | 441 | 6 |
| Nordamerikanische Platte | 19500 | 341 | 9 |
| Eurasische Platte | 19500 | 390 | 11 |
| Afrikanische Platte | 19500 | 309 | 9 |
| Australische Platte | 19500 | 390 | 11 |
| Nazca-Platte | 16663 | 265 | 8 |
| Galápagosplatte | 660 | 221 | 3 |
| Futunaplatte | 1119 | 195 | 5 |

## Performancevergleich

| Engine | Version | Ansicht | FPS | P95 / längste Pause (ms) | Bilder >150 ms | CPU % | Geom. / Text. / Programme am Ende |
|---|---|---|---:|---:|---:|---:|---|
| chromium | G4.3 | Atlas | 3.3 | 667 / 783 | 33 | 378 | 87 / 4 / 5 |
| chromium | G4.3 | Bewegung | 3.2 | 467 / 633 | 46 | 395 | 87 / 4 / 5 |
| chromium | G4.3 | Wechsel | 3.1 | 750 / 1383 | 31 | 385 | 99 / 8 / 9 |
| chromium | G4.3 | Steckbriefe | 3.0 | 667 / 683 | 41 | 390 | 99 / 8 / 9 |
| chromium | G4.3.1 | Atlas | 3.3 | 667 / 1183 | 33 | 376 | 87 / 4 / 5 |
| chromium | G4.3.1 | Bewegung | 3.5 | 617 / 917 | 36 | 386 | 90 / 5 / 8 |
| chromium | G4.3.1 | Wechsel | 3.2 | 717 / 967 | 30 | 378 | 99 / 8 / 9 |
| chromium | G4.3.1 | Steckbriefe | 3.1 | 667 / 833 | 34 | 390 | 99 / 8 / 9 |
| webkit | G4.3.1 | Atlas | 8.6 | 134 / 136 | 0 | 348 | 87 / 4 / 5 |
| webkit | G4.3.1 | Bewegung | 13.4 | 83 / 89 | 0 | 359 | 90 / 5 / 8 |
| webkit | G4.3.1 | Wechsel | 11.5 | 136 / 143 | 0 | 326 | 99 / 8 / 9 |
| webkit | G4.3.1 | Steckbriefe | 8.8 | 129 / 132 | 0 | 339 | 99 / 8 / 9 |
| webkit | G4.3 | Atlas | 8.5 | 130 / 134 | 0 | 347 | 87 / 4 / 5 |
| webkit | G4.3 | Bewegung | 9.4 | 114 / 121 | 0 | 342 | 87 / 4 / 5 |
| webkit | G4.3 | Wechsel | 10.6 | 129 / 153 | 1 | 329 | 99 / 8 / 9 |
| webkit | G4.3 | Steckbriefe | 8.6 | 134 / 137 | 0 | 334 | 99 / 8 / 9 |

### Einordnung für den Unterricht

- Chromium erreichte in der Bewegung 3.2 Bilder/s mit G4.3 und 3.5 mit G4.3.1. Die längste Bildpause betrug 633 bzw. 917 ms.
- WebKit erreichte in der Bewegung 9.4 Bilder/s mit G4.3 und 13.4 mit G4.3.1. Die längste Bildpause betrug 121 bzw. 89 ms.

Am hellen Streifen lässt sich beim Anhalten erkennen, welche Seite sich wie weit verschoben hat. Die Beschriftungen ordnen beide Ausschnitte ihren Platten zu. Der globale Vergleich zeigt eine horizontale Bewegung. Für das Abtauchen eignet sich der Japan-Schnitt. Die gemessenen Bildpausen begrenzen die Flüssigkeit auf Software-Renderern.

Vom Browser gemeldete Renderer

- chromium — ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)
- webkit — Apple GPU

Beide Browser liefen im Linux-Container. WebKit kann die verallgemeinerte WebGL-Kennung „Apple GPU“ melden. Für die Einordnung der Messwerte gilt die tatsächliche Testumgebung.
