# Architektur und Entwicklung des Erdobservatoriums

## Gemeinsamer Kern

Vite baut das TypeScript-Projekt in src einmal nach dist. World, Planet, Kamera, Schalen, Tectonics und Nyos lesen ihre Texturen, Geometrien und Binärdaten über den vorhandenen Ressourcenpfad. Alle Laufzeitdateien stammen aus dem Checkout. Der Desktop-Build verpackt diesen Ordner unverändert in app.asar. Der Einzeldatei-Export serialisiert dieselben Ressourcen und stellt sie als eingebettete Blob-URLs bereit. Das Finder-Symbol verwendet die mitgelieferte Erdkarte und einen schematischen konzentrischen Schnitt. scripts/mac-icon.py reproduziert die Grafik.

Die Electron-Hülle unter desktop besitzt das Fenster, das Mac-Menü, die optionale lokale Geräteprüfung und den registrierten sicheren Origin georisiko://modell. Dessen Dateikatalog entsteht ausschließlich aus dist. Ein Request kann nur eine im Katalog aufgeführte Ressource auswählen. MIME-Typen, CSP und nosniff werden im Handler gesetzt. Der Renderer hat weder Node-Integration noch Dateisystemzugriff. Die Sandbox, Kontextisolation und webSecurity sind aktiv. Das Preload bietet ausschließlich das Umschalten und den Status des Präsentationsfensters an. Bildschirmmessungen und Speicherdialoge startet nur die Lehrkraft über das Mac-Menü. Die Browsersitzung liegt im Arbeitsspeicher. Die Anwendung enthält keine Analyse-, Konto- oder Update-Dienste.

## Funktionsbestand bei der Migration

- Globus mit Orientierung, freier Drehung, Zoom und fließenden Flügen. Hallig Hooge, Hanswarft, Helgoland und die Deutsche Bucht behalten ihre Bild- und Geländedaten.
- Vier zunächst anonyme Schalen mit einzeln freigebbaren Namen, Material und Entstehung, Transparenz, Krustenüberhöhung, Referenzmaßstab und Lithosphärenvergleich. Das P-/S-Wellen-Schema erklärt den Unterschied zwischen festen und flüssigen Stoffen.
- 52 anklickbare PB2002-Platten mit Lage, Nachbarn, Steckbrief und Kameraziel. 48 verortete Grenzvergleiche verwenden starre Körper. Die drei vertiefenden Schnittmodelle zeigen Island, Japan und Kalifornien.
- Relief, Seeschnitt, CO₂-Freisetzung, historischer Bezug und Schutzmaßnahmen am Nyos-See. Start, Pause, Reset und der Wechsel zwischen Modulen verwenden die gleichen Zustände in beiden Ausgaben.

## Phasen

| Phase | Gegenstand und technische Entscheidung |
|---|---|
| A · Mac-App-Sockel | Electron, lokaler Origin, ARM64-App-Bundle, DMG, gemeinsamer Vite-Build und Offlineprüfung. Die HTML dient der Sichtprüfung. |
| B · G4.4-Erdbeben | Ein eigenes regionales Prozessmodell kann Gelände, Spannungsaufbau, Hypozentrum, Epizentrum und Wellen koppeln. Die bestehende Navigation, Zeitsteuerung und Quellenanzeige bieten Anschlussstellen. |
| C · Grafikqualität | Materialvarianten, Relief, Beleuchtung und LOD an konkreten Regionalmodellen vergleichen. |
| D · Geologische Zeitreise | Historische Rekonstruktionen wie Pangäa benötigen datierte Plattenpolygone, Rotationsserien und Quellen. Zukunftsszenarien separat kennzeichnen. |
| E · Engine-Evaluation | Bei gemessenen Grenzen eine repräsentative Szene mit gleichem Bildausschnitt, Licht, Daten und Auflösung in einer zweiten Engine rendern und mit der ausgelieferten App vergleichen. |

## Konkrete Grafikgrenzen

Die adaptive Auflösung begrenzt das Pixelverhältnis heute auf höchstens 1,5 und kann es bis 0,75 absenken. Auf Retina und externem Display muss deshalb die reale Puffergröße zu jeder Bildratenmessung gespeichert werden. Höhere Detailstufen zuerst an einem regionalen Testgebiet profilieren. Das globale Höhenraster rechtfertigt keine beliebig feinen lokalen Geländeformen. Georeferenzierte regionale DEM-Kacheln, Fehlergrenzen, Ladebudget und Übergänge sind Voraussetzungen für größere Datensätze.

Die bestehende Three.js-Materialpipeline erlaubt ergänzende Normal- und Roughness-Maps, PBR und instanzierte Geometrien. Die bereits getrennten lokalen Szenen erlauben räumlich begrenzte Schatten und shaderbasierte Effekte. Draw Calls, aktive Shader, Texturen, P95 und Speicherentwicklung vor und nach jeder Erweiterung vergleichen. Große zukünftige Desktop-Ressourcen können im Bundle als lokale Dateien angefordert werden. Das Base64- und Startspeicherbudget der Test-HTML verlangt bei wachsenden Daten einen dokumentierten Testumfang. In dieser Fassung sind die fachlichen Inhalte identisch.

## Reproduzierbare Prüfung

Die Browserregression verwendet Chromium und WebKit, prüft die 52 Flächen und die mathematische Starrheit der 48 Grenzpaare. Der macOS-Workflow baut und prüft DMG und ZIP auf einem ARM64-Runner. LaunchServices öffnet die aus dem DMG kopierte App nach dem Auswerfen. Playwright steuert denselben ausführbaren Pfad, prüft Fenster, Offline-Ressourcen und Modellzustände und erfasst echte Renderbilder. Der HTML-Vergleich läuft im installierten Chrome auf demselben Runner. Prüfprotokoll, Szenenbilder, Ressourcenstichproben und Bedienfilm werden zusammen bereitgestellt. [Electron-Sicherheit](https://www.electronjs.org/docs/latest/tutorial/security) · [Privilegierte Protokolle](https://www.electronjs.org/docs/latest/api/protocol) · [Apple-Silicon-Runner](https://github.com/actions/runner-images)
