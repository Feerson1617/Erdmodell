# Installation und Geräteprüfung

## Unterrichtsgerät

Die private Entwicklungsfassung benötigt Apple Silicon und mindestens macOS 13 Ventura. Electron 45 setzt diese Betriebssystemversion voraus. [Systemanforderung von Electron](https://github.com/electron/electron/blob/v45.4.1/docs/breaking-changes.md#removed-macos-12-support)

 Der Build und der Test dokumentieren die tatsächlich verwendete macOS-Version und die vom Bundle deklarierte Mindestversion im Installationsprotokoll. Für das Öffnen der fertigen App sind ein Mac mit kompatiblem macOS und ein funktionierender WebGL-2-Grafikpfad erforderlich. Electron, Programmcode, Geodaten, Schriften und Texturen sind im Bundle enthalten.

1. Im erfolgreichen macOS-Lauf **GeoRisiko-G6.4-macOS-arm64.dmg** herunterladen. Die SHA-256-Prüfsummen der Installationsdateien und der HTML stehen im Abnahmepaket.
2. Das DMG doppelklicken und **GeoRisiko** über die Verknüpfung in **Programme** ziehen. Das Volume auswerfen.
3. **GeoRisiko** im Finder unter Programme doppelklicken. Beim App-ZIP das Archiv im Finder entpacken und die vollständige GeoRisiko.app nach Programme ziehen.
4. Für das Smartboard den gewünschten Bildschirm in den macOS-Displays auswählen. Das Fenster auf diesen Bildschirm ziehen. „Präsentieren“ oder **Control–Command–F** schaltet die Präsentation um. Der grüne macOS-Fensterknopf funktioniert ebenfalls. **⌘M**, **⌘W**, **⌘O** und **⌘Q** dienen zum Minimieren, Schließen, Öffnen des Modellfensters und Beenden.

## Gatekeeper

Die Ad-hoc-Signatur bindet den Inhalt des Bundles kryptografisch. Für diese Entwicklungsfassung gibt es weder einen von Apple bestätigten Entwicklernamen noch eine Notarisierung. Finder, Safari und andere Programme können Internetdownloads unter Quarantäne stellen. Ein lokaler Build auf dem eigenen Mac erhält beim Bauen gewöhnlich keine Download-Markierung. Die Abnahme befragt Gatekeeper mit spctl für eine separate, mit Download-Quarantäne markierte Kopie und protokolliert seine tatsächliche Bewertung. macOS-Version, Geräteverwaltung, Herkunft und Öffnungsweg können den Startdialog beeinflussen.

Wenn macOS eine geladene App zunächst sperrt, Herkunft und Prüfsumme anhand des eigenen Pull Requests kontrollieren. Nach dem Öffnungsversuch bei **Systemeinstellungen → Datenschutz & Sicherheit** unter **Sicherheit** die von Apple angebotene Einzelentscheidung **Dennoch öffnen** für GeoRisiko bestätigen. Bei einer Schadsoftware- oder Beschädigungswarnung die Datei verwerfen und die Herkunft prüfen. Auf verwalteten Schulgeräten entscheidet die zuständige Administration über die Freigabe. [Apple – eine App eines nicht verifizierten Entwicklers öffnen](https://support.apple.com/de-de/guide/mac-help/mh40616/mac) · [Apple – sicher Apps auf dem Mac öffnen](https://support.apple.com/de-de/102445)

## Kurz- und Unterrichtsprüfung auf dem eigenen M1

Die App am angeschlossenen Smartboard in der gewünschten Größe öffnen. Eine Szene wählen und gegebenenfalls die Bewegung starten. **Hilfe → Kurzprüfung (10 Sekunden) oder Ausführliche Unterrichtsprüfung (15 Minuten)** zeichnet Bildabstände und den Zustand des Renderers auf. Währenddessen kann die Lehrkraft die App weiter bedienen. Das Ergebnisfenster zeigt Bildrate, P95 und längste Pause. **JSON sichern** schreibt nur auf ausdrückliche Wahl in die gewählte Datei. Die Messung enthält technische Modell- und Prozessdaten. Es gibt keine Kennung für Lehrkräfte oder Lernende und keinen Upload.

Für vergleichbare Ergebnisse Auflösung und Skalierung des externen Displays, gewählte Szene und Präsentationszustand notieren. Globus, Schalenschnitt, Plattenbewegung, alle drei Regionalmodelle und Nyos nacheinander messen. Nach mehreren Modulwechseln wiederholen. Die tatsächlichen Renderpuffermaße stehen in den Zustandsproben. Der Prozessspeicher ist ein Indikator und enthält je nach Plattform gemeinsam genutzte Seiten. Die Cloudmessungen beantworten die Frage nach der Leistung dieses konkreten MacBook Air erst zusammen mit seiner Geräteprobe.
