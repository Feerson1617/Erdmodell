"""Assemble the release evidence from the installed ARM64 app and independent HTML."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib
import json
import statistics

root = Path(__file__).resolve().parents[2]
out = root/'test-results/mac'
raw = json.loads((out/'Pruefung.json').read_text())
app, web = raw['runs']
assert raw['arch']=='arm64' and not raw.get('failure') and raw['electron']['packaged'] and raw['windowReopened']
assert 'LaunchServices-Start' in (out/'installation.log').read_text()
assert raw['security']==dict(sandbox=True,contextIsolation=True,nodeIntegration=False,webSecurity=True)
assert all(not row['errors'] and not row['network'] for row in (app,web))
assert len(app['pairs'])==52 and len({p['step'] for p in app['pairs']})==48
assert set(app['places'])=={'hooge','helgoland'}
mech=json.loads((out/'G51/Mechanik.json').read_text())
assert len(mech['records'])==5819 and mech['sub']==1127 and len(mech['results'])==4
for row in (app,web):
    trials=row['g5']['boundaryTrials']
    assert len({t['id'] for t in trials})>=30 and len({t['category'] for t in trials})==7
assert app['g51']['dimensions']==[1920,1080]
assert len(app['g51']['pictures'])>=30 and len(app['g51']['movies'])==2
for group,folder in [(app['g5'],'G5'),(app['g51'],'G51')]:
    for video in group['movies']:
        assert video['frames']>=5 and (out/folder/(video['name']+'.mp4')).stat().st_size>0
    for photo in group['pictures']:
        assert (out/folder/(photo+'.jpg')).stat().st_size>1000
long=app['classroom'];samples=long['samples'];assert long['elapsedMs']>=900000 and len({s['width'] for s in samples})==3
assert len({s['scene'] for s in samples})==4
summary=[]
for width in sorted({s['width'] for s in samples}):
    rows=[s for s in samples if s['width']==width]
    for label in sorted({s['scene'] for s in rows}):
        group=[s for s in rows if s['scene']==label]
        gaps=sorted(g for s in group for g in s['gaps'])
        summary.append((width,group[0]['height'],label,len(group),1000*len(gaps)/sum(gaps),statistics.median(gaps),gaps[int(.95*(len(gaps)-1))],max(gaps),max(s['rssAfterMiB'] for s in group)))
duration=long['elapsedMs']/60000
fps=[r[4] for r in summary]
trials=app['g5']['boundaryTrials']
hw=raw['hardware']
url='https://github.com/Feerson1617/Erdmodell/actions/runs/'+raw['run']
worst=max(r['maxPlaneError'] for r in mech['results'])
questions=[
('Welche fachlichen Fehler aus G5 wurden behoben?','Polung, Relativbewegung und die Art der Erdkruste werden getrennt ausgewertet. Der Herd folgt der Kontaktgeometrie. Aus einem Seitenversatz am Meeresboden wird keine Überschiebung in derselben Landschaft.'),
('Woher stammt die Subduktionspolung?','Aus den gerichteten PB2002-Linien und der Kennzeichnung der 1.127 SUB-Schritte. Bei 769 Schritten taucht die rechte Platte ab, bei 358 die linke. Die übrigen Abschnitte erhalten keine abtauchende Platte.'),
('Wie wurden Plattennamen und Bewegung geprüft?',f'Alle 5.819 Paare und alle Subduktionsrichtungen wurden automatisiert geprüft. Die Geschwindigkeit bezeichnet die Bewegung der linken relativ zur rechten Platte. {len(trials)} räumlich verteilte Grenzen wurden im Globus angeklickt und im zugehörigen Modell geöffnet.'),
('Wie unterscheiden sich die Störungen?','Steiler Seitenversatz in Parkfield, schräger Abschiebungskontakt und absinkender Mittelblock im Rift, flacher Überschiebungskontakt und Krustenwurzel im Himalaya sowie die gebogene ozeanische Platte vor Japan.'),
('Liegen Herd und Bruch auf dem Kontakt?',f'Der Test prüft Herd, gezeichnete Bruchfront und das senkrecht darüber liegende Epizentrum. Größter Abstand der geprüften Bruchfrontpunkte von der analytischen Fläche in X-Richtung: {worst:.2g} Modell­einheiten.'),
('Stimmen Versatz und Bewegungsrichtung?','Die Zeichenpuffer beider Seiten werden mit ihren Ruhekoordinaten verglichen. Die Tests prüfen die gegenläufige Horizontalverschiebung, den Grabenmittelblock und die Neigung beziehungsweise den Sinn der Überschiebungen. Die geprüften Vertexproben kehren beim Reset exakt zurück.'),
('Wie entstehen Wellen und Bodenerschütterung?','Bruch und Wellen starten am Herd. Weg und Modellgeschwindigkeit bestimmen die Ankunft. Der P-Impuls trifft bei gleichem Weg früher ein. Die örtliche Schwingung klingt ab, der statische Versatz bleibt. Im Wasser erscheint nur die Druckwelle.'),
('Funktioniert der Seebebenvergleich?','Die Wahl lädt jeweils ein neues Modell mit eigener Region und Störung. Die native App und die HTML haben die zwei Varianten am Bedienelement gewechselt.'),
('Was unterscheidet Seebeben und Tsunami?','Ein Seebeben ist ein Bruch unter dem Meer. Ob im Modell eine lange Wasserwelle entsteht, hängt vom vertikalen Meeresbodenversatz ab. Ein zweites Beispiel zeigt einen untermeerischen Seitenversatz. Andere Auslöser wie Rutschungen sind im Text benannt.'),
('Wie entsteht die Wasserbewegung?','Ein bewegter Boden treibt ein eindimensionales Flachwassermodell mit 121 Zellen an. Die Wassermenge wird zwischen Nachbarzellen ausgetauscht. Unterschiedliche Wassertiefen und das Trockenfallen ergeben eine sich räumlich verändernde Welle.'),
('Welche wissenschaftlichen Grenzen bestehen?','Das Miyagi-Profil stützt die Kontaktgeometrie an einer Linie. Die 3D-Fortsetzung, die meisten anderen Untergründe, Zeiten und Amplituden sind schematisch. Die Küstensimulation dient keiner örtlichen Gefahrenprognose.'),
('Was hat sich sichtbar verbessert?','Der beobachtbare Unterschied liegt in den räumlich verschiedenen Gesteinskörpern, dem absinkenden Mittelblock, dem abtauchenden Plattenteil, den Bruchbewegungen und der berechneten Wasseroberfläche. Vergleich/G5 enthält Originalaufnahmen der Vorgängerversion.'),
('Wie unterscheiden sich Gesteine und Schnitte?','Die Schnittvolumina besitzen Seiten, Rückseiten und Tiefenausdehnung. Sediment, kontinentale und basaltische Kruste, kalter Plattenmantel und heißeres Mantelgestein haben verschiedene Materialreaktionen. Die Materialkoordinaten gehen bei der Verformung mit dem Gestein mit.'),
('Welche Landschaften wurden überarbeitet?','Alle sechs Referenzregionen verwenden den weicheren Übergang zwischen Kern- und Umgebungsrelief. Parkfield und Tōhoku haben unterschiedliche Kontaktformen und eigene Detailkameras. In Island, Ostafrika, im Himalaya und auf Hawaii sind die Prozesse jeweils separat prüfbar. Der Vulkanquerschnitt verbindet den realen Zaozan auf Honshū mit dem kartierten Japangraben und verwendet dafür einen eigenen regionalen Bild- und Höhenausschnitt.'),
('Welche historischen Bewegungen sind geometrisch?','519 zeitgültige kontinentale Geometrien mit 335 Rekonstruktionskennungen drehen sich auf der Kugel nach Müller et al. 2019. Die Rotationswerte zwischen den 251 Jahresmillionen-Stützstellen werden interpoliert.'),
('Wofür bleiben Zeitschnitte erforderlich?','Grenztopologien und deformierende Zonen beruhen auf 51 aufgelösten Ständen in 5-Millionen-Jahre-Schritten. Zwischenstände werden überblendet. Für frühere Küsten, Klima oder Vegetation wird keine Ortsgenauigkeit beansprucht.'),
('Welche Kontinentalbereiche lassen sich verfolgen?','Sieben ausgewählte Bereiche lassen sich mit einer Bewegungsbahn und optional mitlaufender Kamera verfolgen. Ausgewählt wird ein mitrotierender Bezugspunkt. Alle sieben und alle historischen Stützzeiten wurden bedient.'),
('Welche zukünftigen Grenzen sind enthalten?','Die vier Zukunftsmodelle verwenden ihre veröffentlichten Rücken- und Subduktionslinien und deren Gültigkeitsintervalle. Alle zwölf gerichteten Modellpaare wurden am gleichen Zeitpunkt verglichen.'),
('Welche wissenschaftlichen Belege sind hinzugekommen?','13 seismische Tiefenstützpunkte vor Japan, 176 projizierte regionale Katalogbeben und drei dokumentierte GNSS-Lösungen. Die vorhandenen Magnetstreifen, Fossilbezüge und 697 globalen Katalogereignisse bleiben zugänglich.'),
('Wie zeigen sich Vulkanismus und Ausbruchsarten?','Am Rücken, im Inselbogen und bei Hawaii unterscheiden sich Schmelzursache und räumlicher Weg. Niedriges Schildrelief, Vulkanöffnung, Lavafluss und eine Aschewolke mit Auswurf werden durch unterschiedliche Geometrien dargestellt.'),
('Wie werden Verwundbarkeit und Resilienz beobachtbar?','Bei unveränderter Quelle lassen sich Boden, Bebauungsdichte und Aussteifung wechseln. In einem separaten Küstenraum verändern Warnung, Weg, höherer Standort und Wiederherstellung der Versorgung die beobachtbare Situation.'),
('Funktioniert Beobachten?','Im direkt bedienbaren globalen Modus verschwinden reguläre Erläuterungen und Namen. Die neutrale Modellzeit, Wiedergabe und unverzichtbare Modellkennzeichnungen bleiben sichtbar. Die native Bedienprobe stellt den Erklärmodus wieder her.'),
('Sind die Texte für Klasse 9 geeignet?','Die Erklärungen verwenden kurze Sätze und koppeln Begriffe wie Erdbebenherd, Subduktion und Intensität an ein sichtbares Objekt oder einen Vorgang. Eine sprachliche Erprobung mit der konkreten Klasse steht aus.'),
('Welche curricularen Zusammenhänge sind abgedeckt?','Erdschalen, Lithosphäre und Kräfte, Drift und Belege, Grenzprozesse und Gebirgsbildung, Erd- und Seebeben, Vulkanismus, Gefährdung sowie Vorsorge. Die Matrix nennt Bedienweg, Kompetenzbezug, Quelle, Aussagegrenze und Bildnachweis.'),
('Welche Inhalte oder Nachweise fehlen?','Eine Fachdebatte über Standortwahl, Akteure, Kosten und gesellschaftliche Entscheidungen sowie die individuelle Kompetenzbewertung erfordern Unterricht. Eine vollständige geologische Detailkartierung und lokale Schadensberechnung sind nicht Gegenstand des Modells.'),
('Welche Leistung wurde wirklich gemessen?',f'{duration:.1f} Minuten mit {len(samples)} Messfenstern, vier Szenentypen und drei Viewports. Die aggregierten Bildraten pro Auflösung und Szene liegen zwischen {min(fps):.1f} und {max(fps):.1f} FPS. Bildabstände, Prozesslast, Speicher und GPU-Zähler stehen in Pruefung.json.'),
('Welche Hardware wurde verwendet?',f"{hw['cpu']}, {hw['cores']} logische Kerne, macOS {hw['macOS']}, {app['gpu']}. Die Displaygrößen der Langzeitprüfung sind gerenderte Viewports des virtuellen Runners. Das physische Schulgerät, die thermische Dauerlast am MacBook Air M1 und ein angeschlossenes Smartboard wurden hier nicht gemessen."),
('Bleibt Nyos verfügbar?','Der Start, Geländeschnitt, gelöstes CO₂, Ereignis, Reset und Schutz durch Entgasung wurden in beiden Produkten bedient. Die native App lud die lokalen Nyos-Daten. Hooge und Helgoland öffneten ebenfalls.'),
('Welche Regressionen wurden geprüft?','Native und HTML-Bedienprüfung, 52 Platten mit 48 verschiedenen Grenzvergleichen, regionale Film- und Bildfolgen, Themenwechsel, Paare, Offlinezugriffe und Sicherheitsvorgaben. Die eigenen Geometrie- und Zeitprotokolle liegen unter G51. Die zusätzliche Browsermatrix läuft separat am selben Commit.'),
('Wo befinden sich die vier Dateien?',f'DMG, vollständiges App-ZIP, Einzel-HTML und dieses Sichtprüfungspaket stehen als vier einzelne Artefakte im [macOS-Lauf]({url}). Das DMG wurde verifiziert, gemountet, ausgeworfen und die kopierte App gestartet. Die Ad-hoc-Signatur ist lokal prüfbar. Gatekeepers Bewertung der markierten Testkopie steht in installation.log.'),
]
intro=['# GeoRisiko G5.2 · Bestands- und Leistungstests','',f'Commit `{raw["commit"]}`. [Prüflauf]({url})','',
       'Die Serien G5 und G51 sind neue Originalaufnahmen aus der installierten App. Der JPEG-Bildkopf jeder Einzelaufnahme wurde auf 1920 × 1080 Pixel geprüft, auch nach einem nativen Vollbildwechsel. Vergleich/G5 enthält die entsprechenden früheren Bildschirmaufnahmen. Die Serie G5 verwendet die Bedienfolge des Ausgangsstands. Die neue Serie G51 umfasst zusätzlich Detailansichten.','']
for i,(title,answer) in enumerate(questions,1):
    intro.extend([f'**{i}. {title}**','',answer,''])
intro.extend(['## Langzeittest der installierten App','','15 Sekunden je Messfenster. Übergänge und Öffnen und Schließen der Modelle zählen zur Gesamtdauer. Die Bildraten sind aus allen einzelnen Bildabständen je Szene und Viewport berechnet. RSS summiert den Prozessbaum und kann gemeinsam genutzte Seiten mehrfach zählen.','',
'|Viewport|Szene|Fenster|FPS|Median ms|P95 ms|Längste Pause ms|Max. RSS nach Messung MiB|','|---|---|---:|---:|---:|---:|---:|---:|'])
for width,height,label,n,f,m,p,mx,rss in summary:
    intro.append(f'|{width}×{height}|{label}|{n}|{f:.1f}|{m:.1f}|{p:.1f}|{mx:.1f}|{rss:.0f}|')
intro.extend(['','## Vergleich App und Einzel-HTML','','|Produkt|Szene|FPS|P95 ms|Längste Pause ms|CPU %|RSS vor / nach MiB|','|---|---|---:|---:|---:|---:|---:|'])
for row in (app,web):
    for s in row['g5']['measurements']:
        intro.append(f"|{row['name']}|{s['scene']}|{s['fps']:.1f}|{s['p95']:.1f}|{s['max']:.1f}|{s['cpuPercent']:.0f}|{s['rssBeforeMiB']:.0f} / {s['rssAfterMiB']:.0f}|")
(out/'Bestandspruefung.md').write_text('\n'.join(intro)+'\n')
files={p.relative_to(out).as_posix():p for p in out.rglob('*') if p.is_file() and p.parent.name!='film' and p.suffix in {'.md','.jpg','.png','.log','.mp4','.json'}}
files['SHA256-Produkte.txt']=out/'SHA256.txt'
for name in ['curriculum-coverage.md','g51-quellen.md','g5-quellen.md','g5-unterricht.md','g5-referenz.json','mac-installation.md']:
    files['Dokumentation/'+name]=root/'docs'/name
for p in (root/'docs/g51-bildvergleich').iterdir():files['Vergleich/G5/'+p.name]=p
import sys
sys.path.insert(0,str(root/'scripts/g52'))
from report import evidence
files.update(evidence(root,out,raw))
files['Dokumentation/g52-unterricht.md']=root/'docs/g52-unterricht.md'
dest=root/'artifacts/GeoRisiko-G5.2-Sichtpruefung.zip'
with ZipFile(dest,'w',ZIP_DEFLATED) as z:
    for name,p in sorted(files.items()):z.write(p,name)
    z.writestr('SHA256-Inhalt.txt',''.join(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+name+'\n' for name,p in sorted(files.items())))
with ZipFile(dest) as z:assert z.testzip() is None
print(dest.name,len(files),'Dateien',hashlib.sha256(dest.read_bytes()).hexdigest())

