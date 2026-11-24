"""Create the G5 deliverable exclusively from the actual packaged macOS exercise."""
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
import json,hashlib
root=Path(__file__).resolve().parents[2];out=root/'test-results/mac';g=out/'G5'
r=json.loads((out/'Pruefung.json').read_text());app,web=r['runs'];runlink='https://github.com/Feerson1617/Erdmodell/actions/runs/'+r['run']
assert r['arch']=='arm64' and r['electron']['packaged'] and r['windowReopened'] and not r.get('failure')
assert 'LaunchServices-Start' in (out/'installation.log').read_text()
assert all(not row['errors'] and not row['network'] and len(row['g5']['measurements'])>=10 for row in [app,web])
proof=app['g5'];assert sum(proof['boundaryModels'].values())==5819 and len(proof['boundaryModels'])==9
assert len(app['pairs'])==52 and len(set(p['step'] for p in app['pairs']))==48 and len(app['places'])==2
assert len(proof['pictures'])>=30 and len(proof['movies'])==5
for movie in proof['movies']:assert movie['frames']>=5 and (g/(movie['name']+'.mp4')).stat().st_size>15000
assert len(json.loads((g/'Grenzabschnitte.json').read_text()))==5819
stats=proof['measurements'];gpu=app['gpu'];hw=r['hardware'];commit=r['commit']
perf=', '.join(f"{x['scene']} {x['fps']:.1f} Bilder/s" for x in stats if x['scene'] in ['Globus','Erdbeben mit Wellen','Seebeben und Tsunami'])
questions=[
('Welche Grafikverbesserungen sind sichtbar?','Der Globus erhält eine aus ETOPO abgeleitete Relief- und Meeresbeleuchtung. In den Regionen öffnet sich die gemessene Geländeoberfläche zum Schnitt. Optische Satellitenbilder, Reliefnormalen, PBR-Rauheit, gestaffelte Gesteine und getrennte Gesteins- und Wasserbewegungen werden zusammen gerendert. Der Ordner Vergleich enthält echte Aufnahmen des Ausgangsstands.'),
('Welche Landschaften sind neu?','Parkfield, Tōhoku, Reykjanes, Zentralnepal, das Gebiet am Natronsee und Hawaii auf eigenen regionalen Höhenrastern.'),
('Welche wissenschaftlichen Daten sind eingebunden?','PB2002, USGS ComCat, Müller 2019, Davies/Green/Duarte 2018, Terrain Tiles, NASA GIBS und modifizierte Copernicus-Sentinel-2-Daten von EOX. Die Rechte und Verarbeitungen stehen im Quellenkatalog.'),
('Funktioniert die historische Zeitreise?','Ja. Wiedergabe, Pause, Stationssprung, freier Blick und Wechsel zur Gegenwart wurden auf der Kugel bedient.'),
('Welche Zeitschnitte sind verfügbar?','51 historische Zustände von 250 Millionen Jahren vor heute bis heute im Abstand von 5 Millionen Jahren.'),
('Wie entstehen die Übergänge?','pyGPlates rekonstruiert die Kontinentpolygone nach ihrem Gültigkeitsintervall und löst die zeitabhängigen Topologien einschließlich deformierender Netze auf. Die Ansicht blendet zwischen gültigen Zuständen über. Beim Zukunftsmodell bleiben die Kontinentteile starr und drehen sich gemäß den veröffentlichten Rotationen.'),
('Welche Zukunftsszenarien gibt es?','Pangaea Ultima und Aurica bis +250 Millionen Jahre, Novopangaea und Amasia bis +200. Zwei Modelle lassen sich bei gleichem Zeitpunkt gegenüberstellen.'),
('Wie ist die Unsicherheit sichtbar?','Die Zeitachse kennzeichnet mögliche Zukunft ausdrücklich als offene Entwicklung. Die Flächen zeigen kontinentale Lithosphäre.'),
('Sind alle Grenzabschnitte auswählbar?','Alle 5.819 Abschnitte haben einen eigenen Datensatz und verwenden dieselbe kugelgeometrische Trefferauswahl. Geografische Beispiele aller neun Zuordnungstypen wurden über das gerenderte Modell getroffen. Die vollständige Liste steht in G5/Grenzabschnitte.json.'),
('Wie viele Modelltypen gibt es?','Neun Grenzmodelle: Spreizung, kontinentale Dehnung, Subduktion, ozeanischer Inselbogen, Kollision, allgemeine Konvergenz, kontinentale und ozeanische Transformbewegung sowie komplexe Grenzen. Zusätzlich gibt es das platteninterne Hotspot-Modell.'),
('Welche Regionen sind geografisch spezifisch?','Die sechs Referenzregionen verwenden geografisch eingepasste Oberflächen. Bei Nyos, Hooge und Helgoland stammen die lokalen Geländemodelle aus dem geprüften Bestand.'),
('Wo ist die Darstellung schematisch?','In allen sechs Referenzregionen sind Bruchflächen, Zeitmaßstab und Verformungsamplitude idealisiert. Weitere Abschnitte verwenden regionale PB2002-Lage und Orientierung und allgemeine Geometrien. Subduktion wird aus einer unklaren Konvergenzlinie nicht abgeleitet.'),
('Ist die Erdbebenmechanik sichtbar?','Festhalten, elastischer Aufbau, lokaler Bruch, bleibender Versatz, vorübergehende Schwingung und unterschiedliche Wellenfronten werden im Schnitt gesteuert. Die helle Vergleichslinie in Kalifornien hilft, einen bleibenden seitlichen Versatz zu erkennen.'),
('Sind Hypozentrum und Epizentrum korrekt?','Der Modellherd liegt im Gestein am Ursprung der Bruchausbreitung. Das Epizentrum wird bei denselben horizontalen Koordinaten auf der Gelände- beziehungsweise Meeresbodenhöhe verankert. Die Abnahme prüft diese Beziehung.'),
('Wie unterscheiden sich P- und S-Wellen?','Im festen Gestein läuft der goldene P-Frontbogen voraus. Die zugehörigen Materialpunkte schwingen längs. Die türkisen S-Punkte schwingen quer. Die S-Welle wird im festen Material gezeigt.'),
('Wie werden Seebeben und Tsunami verglichen?','Am selben Meeresboden werden seitlicher und vertikaler Versatz verglichen. Nur im Szenario mit erheblicher Vertikalverlagerung treibt der Meeresboden die dargestellte lange Wasserwelle. Andere Auslöser wie Rutschungen werden erläutert.'),
('Sind Ursachen der Plattenbewegung sichtbar?','Der vergrößerte Mantelschnitt zeigt Wärmetransport, die Wirkung der Schwerkraft am Rücken und den Zug kalter, absinkender Lithosphäre. Die Pfeile sind qualitative Modelle.'),
('Sind Vulkanismus und Hotspots enthalten?','Rücken, Subduktionszone und Hotspot haben unterschiedliche Materialwege. Unter dem Inselbogen werden Fluide getrennt von Schmelze gezeigt. In der Hawaii-Szene wandert eine Kette vereinfachter Vulkane über die Quelle.'),
('Sind Verwundbarkeit, Resilienz und Schutz beobachtbar?','Bei identischem Ereignis ändern sich Bebauung, Standort, Schwingung und Bauweise. Markierte Wege und die Kombination aus Warnung und Vorbereitung lassen sich separat zuschalten.'),
('Wie wird die Sprache der Klasse 9 berücksichtigt?','Namen und vertiefende Erklärungen sind optional. Die Oberfläche verwendet kurze konkrete Sätze. Die Verständlichkeit wurde am Text geprüft. Ein Unterrichtsversuch mit der konkreten Lerngruppe steht aus.'),
('Welche curricularen Inhalte sind sichtbar?','Schalenbau und Lithosphäre, Gründe und Belege für Plattenbewegung, Kontinentalentwicklung, regionale Grenzprozesse, Erd- und Seebeben, Vulkanismus sowie Schutz und Verwundbarkeit. Die Matrix ordnet die Nachweise den Standards zu.'),
('Was bleibt offen?','Kompetenzerwerb und Stakeholder-Diskussion bleiben Aufgabe des Unterrichts. Es gibt keine physikalische Schadens-, Warn- oder Prognoserechnung. Weltweit gemessene lokale Bruchflächen, paläogeografische Küsten, Vegetation und Gelände für jedes Erdzeitalter sind nicht belegt.'),
('Wie flüssig ist die Darstellung?',perf+'. Die vollständige Tabelle enthält Bildabstände, Auflösungen und Prozesslast beider Produkte.'),
('Welche Hardware wurde gemessen?',f"{hw['cpu']}, {hw['cores']} logische Kerne, macOS {hw['macOS']}. Renderer {gpu}. Das persönliche MacBook Air M1 mit Smartboard und sein Temperaturverhalten wurden in diesem Runnerlauf nicht gemessen."),
('Was wurde aus dem Bestand geprüft?','Beide Ausgaben durchliefen die ursprünglichen Szenen. Die installierte App traf zusätzlich 52 Platten und spielte 48 verschiedene Vergleiche ab. Nyos einschließlich CO₂ und Schutz, Hooge und Helgoland sowie das erneute Öffnen des Fensters wurden geprüft.'),
('Welche Grenzen gelten?','Höhen, Reliefdetails und Sentinel-Mosaik stammen aus unterschiedlichen Aufnahmezeiten. Untergrund, vertikale Überhöhung, Wellen, Materialtransport und Menschen sind didaktische Modelle. Die private App ist ad hoc signiert. Eine Developer-ID und Notarisierung liegen nicht vor.'),
('Wo sind die Downloads?',f'Der erfolgreiche [Mac-Lauf]({runlink}) stellt DMG, vollständiges App-ZIP, Offline-HTML und Sichtprüfung einzeln bereit.')
]
lines=['# G5 · Abnahme des Earth Observatory','',f'Geprüfter Commit `{commit}`. [macOS-Lauf]({runlink})','',
'**Installation und Start.** hdiutil verifizierte und mountete das DMG. Nach dem Kopieren und Auswerfen startete LaunchServices die installierte ARM64-App. Beide Bundles wurden mit codesign überprüft. Die anschließende Bedienprüfung lief aus der installierten Kopie bei blockierten externen Webanfragen. Die separate HTML lief unter file:// im selben macOS-System.','']
for i,(q,a) in enumerate(questions,1):lines.extend([f'**{i}. {q}**',a,''])
lines.extend(['## Vergleich auf derselben virtuellen Maschine','',f"Angeforderter Viewport 1920 × 1080, natives Testfenster {r['windowContent']}. Virtuelle Anzeige {r['display']}. Renderpuffer je Szene unten. Die adaptive Auflösung kann sich zwischen den Produkten unterscheiden.",'',
'|Produkt und Szene|FPS|Median / P95 / längste Pause (ms)|CPU %|RSS Start → Ende (MiB)|Renderpuffer|Geometrien / Texturen / Programme / Draw Calls|','|---|---:|---|---:|---|---|---|'])
for row in [app,web]:
    for s in row['g5']['measurements']:
        a=s['states'][-1];size=', '.join(sorted({f"{v['resolution']['width']}×{v['resolution']['height']}" for v in s['states']}))
        lines.append(f"|{row['name']} · {s['scene']}|{s['fps']:.1f}|{s['median']:.1f} / {s['p95']:.1f} / {s['max']:.1f}|{s['cpuPercent']:.0f}|{s['rssBeforeMiB']:.0f} → {s['rssAfterMiB']:.0f}|{size}|{a['geometries']} / {a['textures']} / {a['programs']} / {a['draws']}|")
lines.extend(['','Die CPU-Zeit ist die Summe des Prozessbaums. 100 % entsprechen einem logischen Kern. RSS enthält gemeinsam genutzte Speicherseiten. Pruefung.json enthält Einzelbildabstände, Ladezeiten, Zwischenstände und Ressourcen nach wiederholten Wechseln.',''])
(out/'G5-Abnahmebericht.md').write_text('\n'.join(lines))
files={p.relative_to(out).as_posix():p for p in out.rglob('*') if p.is_file() and (p.parent==out or p.parent==g) and p.suffix in ('.jpg','.json','.png','.log','.md','.mp4')};files['SHA256.txt']=out/'SHA256.txt'
for n in ['curriculum-coverage.md','g5-quellen.md','g5-unterricht.md','g5-referenz.json','mac-installation.md']:files['Dokumentation/'+n]=root/'docs'/n
for p in (root/'docs/g5-bildvergleich').iterdir():files['Vergleich/G4.3.1-Mac/'+p.name]=p
files['Dokumentation/README.md']=root/'README.md';dest=root/'artifacts/GeoRisiko-G5.2.1-Sichtpruefung.zip'
with ZipFile(dest,'w',ZIP_DEFLATED) as z:
    for filename,path in sorted(files.items()):z.write(path,filename)
with ZipFile(dest) as z:assert z.testzip() is None
print(dest.name,len(files),hashlib.sha256(dest.read_bytes()).hexdigest())
