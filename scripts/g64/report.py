"""Validate both offline products' original evidence and publish a browsable comparison."""
from pathlib import Path
from hashlib import sha256
from zipfile import ZipFile, ZIP_DEFLATED
from statistics import median
from html import escape
import json

root=Path(__file__).resolve().parents[2]
base=root/'test-results/mac'
evidence=base/'G63'
def data(path):
    return json.loads(path.read_text())
def digest(path):
    return sha256(path.read_bytes()).hexdigest()
native=data(base/'Pruefung.json')
app,web=native['runs']
old,new=[data(evidence/group/'Unterricht.json') for group in ('Vorher','Nachher')]
science=data(evidence/'Fachtests.json')
perf=data(evidence/'Leistungsvergleich.json')
anchors=data(evidence/'Ankerpruefung.json')
assert anchors['flightFrames']>0 and anchors['staleLabels']==0 and max(r['error'] for r in anchors['rows'])<1e-7
assert native['arch']=='arm64' and native['restart']['verified'] and app['classroom']['elapsedMs']>=900000
assert all(not r['errors'] and not r['network'] for r in (app,web,old,new))
assert old['complete'] and new['complete']
assert old['engine']==new['engine']==perf['engine'], f"Chromium-Versionen für Vorher, Nachher und Messung: {old['engine']}, {new['engine']}, {perf['engine']}"
assert new['product'] in (base/'SHA256.txt').read_text()
assert perf['complete'] and len(perf['samples'])==12
assert science['steps']==5819 and science['subduction']==1127 and science['oblique']==435
assert len(new['films'])==8 and all(v['seconds']>=8 for v in new['films'])
names={v['name'] for v in old['shots']}
assert names<={v['name'] for v in new['shots']} and set(range(1,21))<={int(v[:2]) for v in names}
volcano=[data(evidence/group/'Vulkanpruefung.json') for group in ('Vorher','Nachher')]
assert all(v['complete'] and not v['network'] and not v['errors'] and v['engine']==perf['engine'] for v in volcano)
assert {c['label'] for c in volcano[1]['cases']}=={'Tonga','Japan','Island','Hawaii','Gakkelruecken'}
assert all(c['geometry']['inside'] for c in volcano[1]['cases'] if c['label'] in ('Tonga','Japan'))
assert len(volcano[1]['films'])==1 and volcano[1]['films'][0]['frames']>24
assert len(perf['future'])==12
assets=data(base/'G52/Ressourcen.json')
assert assets['resources']>=389
files={}
for path in evidence.rglob('*'):
    if path.is_file() and path.suffix in {'.json','.jpg','.mp4'}:files[str(path.relative_to(evidence))]=path
for path in base.rglob('*'):
    if path.is_file() and evidence not in path.parents and path.suffix in {'.json','.log','.txt','.jpg'}:files['Protokolle/'+str(path.relative_to(base))]=path
for name in ['g64-grafikpruefung.md','g64-plattentektonik.md','g64-bestand.md','g64-forschungsatlas.md','g631-fachpruefung.md','entwicklungsstand.md','curriculum-coverage.md','g63-unterricht.md','g62-lernmodell.md','g51-quellen.md','g5-quellen.md','g6-quellen.md','g61-landschaften.md','mac-installation.md']:
    files['Dokumentation/'+name]=root/'docs'/name
for path in (root/'public/licenses').glob('*'):
    if path.is_file():files['Lizenzen/'+path.name]=path
for path in (root/'public/data').glob('g6*/*.json'):files['Quellen/'+str(path.relative_to(root/'public/data'))]=path
report=['# GeoRisiko G6.4 · Technischer Abnahmebericht','',f"Geprüfter Commit `{native['commit']}`. Vergleichsbasis ist G6.3.1, Commit `f3b752d4dcf941865f6e5b45ab44bd878c6ccedf`. [GitHub Actions](https://github.com/Feerson1617/Erdmodell/actions/runs/{native['run']})",'','## Wissenschaft und Unterricht','',
        'Die beiden starren Gesteinskörper verwenden entgegengesetzte halbe Rotationen. Die Pfeile zeigen die Tangenten dieser Bewegung. Der Rückweg vom geologischen Schnitt stellt den ausgewählten Grenzabschnitt wieder her. Untersucht wurden alle 5.819 Grenzabschnitte, alle 1.127 Subduktionspolungen, 435 schräge Subduktionsbewegungen sowie 43 komplexe Abschnitte mit unbekannter lokaler Bruchgeometrie.',
        'Die Phasentests prüfen den Ausgangszustand, Spannungsaufbau, Bruch, P- und S-Wellen, den Endzustand und den Reset. Die Farbe zur Spannungsanalyse kann getrennt geschaltet werden. Standort, berechnete Wasserstände und tatsächliche Weggeometrie bestimmen die sichtbaren Hinweise. Angaben über Schäden und Erholung sind qualitativ.',
        f"Geprüft wurden Präsentationsabläufe, die gezielte Namensfreigabe, beide Kameramodi und der vollständige Nyos-Ablauf. {len(old['shots'])+len(volcano[0]['shots'])} Originalbilder aus G6.3.1 und {len(new['shots'])+len(volcano[1]['shots'])} aus G6.4 stammen aus dem Bedienlauf. Die Protokolle enthalten Aktionen, Wartezeiten, Zustände und die sichtbaren Beschriftungen. Die Curriculummatrix ordnet die fachlichen und methodischen Lerngelegenheiten ein.",
        f"Ein physisch angeklickter Punkt auf dem Vergleichsweg wurde für {len(anchors['rows'])} Modellphasen aus dem getroffenen Dreieck und seinen aktuellen Vertices unabhängig nachgerechnet. In {anchors['flightFrames']} gerenderten Globusbildern beim Szenenwechsel waren keine regionalen Schilder sichtbar.",'','## Zusammenhängende Bedienfilme','']
for film in new['films']+volcano[1]['films']:report.append(f"- {film['name']} · {film['seconds']:.1f} s · {film['frames']} aufgezeichnete Bilder")
report+=['','## Kontrollierter Küstenvergleich','',f"Gleicher Browser {perf['engine']}, 1.920 × 1.080 Fensterpixel, 1.200 × 720 Renderpixel, dieselbe Kamera, dasselbe Unterrichtsprofil und derselbe Startzustand. Drei Wiederholungen zu je sechs Sekunden pro Bedingung. Gemessen wurden neu gerenderte Bilder.",'','| Version | Beschriftungen | Median Bilder/s | Einzelmessungen |','|---|---|---:|---|']
for version in ['G6.3.1','G6.4']:
    for namesOn in [True,False]:
        values=[v['log']['renderedFps'] for v in perf['samples'] if v['version']==version and v['names']==namesOn]
        report.append(f"| {version} | {('an' if namesOn else 'aus')} | {median(values):.1f} | "+', '.join(f'{x:.1f}' for x in values)+' |')
report+=['','## Vulkanische Prozesse im ausgeführten Modell','','Die Erklärung im Panel, die Phaseninformation und die Objektinformation wurden am ausgelieferten Produkt verglichen. Für Tonga und Japan wurde der Beginn des sichtbaren Magmawegs gegen die tatsächlich gerenderten Schnittdreiecke des Mantelkeils geprüft. Die Galerie enthält die beiden Versionen im selben geologischen Schnitt und einen durchgehenden Bedienfilm.', '','| Referenzfall | G6.3.1, Erklärung im Panel | G6.4, Erklärung im Panel |','|---|---|---|']
for previous,current in zip(volcano[0]['cases'],volcano[1]['cases'],strict=True):
    assert previous['label']==current['label']
    report.append(f"| {current['label']} | {previous['explanation']} | {current['explanation']} |")
report+=['','## Zwei Zukunftsgloben in Bewegung und in Ruhe','','Drei Messungen je Fassung und Zustand bei gleicher Kamera und Auflösung. Der animierte Vergleich beginnt bei +100 Millionen Jahren. Im pausierten Vergleich läuft die Bildschirmabfrage weiter. Der Renderer darf das letzte Bild wiederverwenden.','','| Fassung | Zustand | Neu gerenderte Bilder/s, Median | Bildschirmzyklen/s, Median | Änderungen im Seiteninhalt, Median |','|---|---|---:|---:|---:|']
for version in ['G6.3.1','G6.4']:
    for running in [True,False]:
        samples=[r for r in perf['future'] if r['version']==version and r['running']==running]
        report.append(f"| {version} | {('animiert' if running else 'pausiert')} | {median(r['log']['renderedFps'] for r in samples):.1f} | {median(r['log']['fps'] for r in samples):.1f} | {median(r['changes'] for r in samples)} |")
lifetime=json.loads((evidence/'Szenenfreigabe.json').read_text())
assert lifetime['complete'] and lifetime['released']>0 and not lifetime['errors']
report+=['',f"Beim Wechsel während der Grafikvorbereitung blieb das Material bis zum Abschluss verfügbar. Anschließend wurden {lifetime['released']} Materialfreigaben registriert. Der anschließende Wechsel nach Japan gelang."]
pixel=json.loads((evidence/'Zukunft-Bildvergleich.json').read_text())
assert pixel['complete'] and len(pixel['cases'])==4
report+=['','Die vier Zukunftsmodelle wurden mit identischer Perspektive und Modellzeit gegen G6.3.1 fotografisch verglichen. Je nach Fall waren publizierte Grenzlinien ein- oder ausgeblendet. Die Renderergebnisse stehen im Rohprotokoll Zukunft-Bildvergleich.json. Die Kontinentalpolygone und die gesonderten Grenzlinien bleiben vollständig erhalten. Die Zukunftsansicht lädt die ungenutzten Rasterzeitschnitte nicht mehr.']
report+=['','## Dauerlauf und Auslieferung','',f"Die vom DMG installierte App lief {app['classroom']['elapsedMs']/60000:.1f} Minuten auf {native['hardware']['cpu']} unter macOS {native['hardware']['macOS']}. Nach dem Neustart wurde die gespeicherte Unterrichtsansicht geprüft. {assets['resources']} Ressourcen stimmen zwischen App und Einzeldatei byteweise überein.",'','| Full-HD-Szene | Median neu gerenderte Bilder/s |','|---|---:|']
for scene in sorted({v['scene'] for v in app['classroom']['samples']}):
    values=[v['renderedFps'] for v in app['classroom']['samples'] if v['scene']==scene and v['width']==1920]
    if values:report.append(f'| {scene} | {median(values):.1f} |')
history=[s for s in app['classroom']['samples'] if s['scene']=='Zeitreise' and s['width']==1920]
for comparison,label in [(False,'Historische Zeitreise'),(True,'Zukunftsvergleich')]:
    subset=[s for s in history if s['futureComparison']==comparison]
    if subset:report.append(f"| {label} einzeln | {median(s['renderedFps'] for s in subset):.1f} |")
report+=['','Die Messung des Zukunftsvergleichs umfasst auch die Standzeit am Szenarioende. Bei unveränderter Darstellung verwendet die Zeitreise das zuletzt gerenderte Bild erneut. Die Rohdaten enthalten getrennte Zähler für Bildschirmzyklen und tatsächlich neu gerenderte Bilder.']
report+=['','## Grenzen der Abnahme','','Die Messungen stammen von virtueller Hardware. Eine physische M1-/Smartboard-Abnahme wurde auf Wunsch ausgelassen. Die Lernwirksamkeit im Unterricht wurde nicht empirisch erhoben. Bei verdeckten Objekten oder engem Bildausschnitt können Beschriftungen entfallen. Die Küstenrechnung ist eindimensional. Die vier Zukünfte sind veröffentlichte Möglichkeiten. Die ad hoc signierte App kann bei der ersten Installation eine lokale Gatekeeper-Freigabe erfordern.','',f"SHA-256 Offline-HTML G6.3.1 `{old['product']}` und G6.4 `{new['product']}`."]
models=data(evidence/'Plattentektonik/Prozesspruefung.json')
atlas=data(evidence/'Plattentektonik/Atlas-Browser.json')
geology=data(evidence/'Plattentektonik/Geologie.json')
assert app['tectonics']['complete'] and web['tectonics']['complete']
assert atlas['complete'] and atlas['favoriteRestored'] and not atlas['errors'] and not atlas['network']
assert models['complete'] and models['favorite'] and len(models['models'])==10 and len(models['states'])==9
assert models['mantleWedge']['closedSurfaces']==3 and min(models['mantleWedge']['spans'])>.3
assert len(models['smartboards'])==4 and all(v['ratio']>=.85 for v in models['smartboards'])
assert len(models['films'])==2 and all(f['frames']>=5 for f in models['films'])
assert geology['spreading'] and geology['deformation'] and len(geology['regions'])==2
report+=['','## G6.4 · Plattentektonik','',
         f"Der direkte Produktlauf im installierten Electron und im exportierten HTML umfasste Erdschnitte, Spreizungsmessung, Vergleich, geologische Phasen, Freigabe eines Namens und Wechsel zur Bathymetrie. Der erweiterte Browserlauf prüfte {len(models['models'])} Grenz- und Prozessmodelle und {len(models['states'])} Wilson-Stadien.",
         'Der Forschungsatlas prüfte unter anderem Japan, die Eifel, HOFN und zwei Stellen im Südatlantik. Gemessene Werte und Datenlücken stehen im Atlas-Browserprotokoll. Gespeicherte Ansichten wurden aus der normalen Bedienoberfläche wieder aufgerufen.',
         '','| Präsentationsformat | Anteil der Modellfläche |','|---|---:|']
for v in models['smartboards']:report.append(f"| {v['width']} × {v['height']} | {100*v['ratio']:.1f} % |")
report+=['','Die Werte bezeichnen die sichtbare Zeichenfläche. Der Anteil des gezeichneten Gesteins hängt vom gewählten Zoom ab. Die Bilder sind Originalaufnahmen. Die Blocklandschaften sind idealisiert. Einen fotorealistischen Standard aller weltweiten Grenzräume und eine physische Geräteabnahme bescheinigt diese Prüfung nicht.']
processPerf=data(evidence/'Plattentektonik/Prozessleistung.json')
assert len(processPerf['samples'])==4
report+=['','### Prozessmodelle am virtuellen Mac','','Gemessen bei 1.920 × 1.080 Fensterpixeln. Die separate Spalte gibt den tatsächlich gerenderten Framebuffer an.','','| Modelle | Zustand | Neue Bilder/s | P95 Bildabstand | Größter Bildabstand | Renderziel |','|---:|---|---:|---:|---:|---|']
for q in processPerf['samples']:
    res=q['resolution']
    report.append(f"| {q['n']} | {'animiert' if q['running'] else 'pausiert'} | {q['renderedFps']:.1f} | {q['p95Ms']:.1f} ms | {q['maxMs']:.1f} ms | {res['width']} × {res['height']} |")
reportPath=base/'Abnahmebericht.md';reportPath.write_text('\n'.join(report)+'\n');files[reportPath.name]=reportPath
html=['<!doctype html><html lang="de"><meta charset="utf-8"><title>GeoRisiko G6.4 · Sichtprüfung</title><style>body{margin:3vw;background:#152a22;color:#f5f2e7;font:18px system-ui}a{color:#bde4ca}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));gap:1em}img{width:100%;height:auto}figure{margin:0}</style><h1>GeoRisiko G6.4</h1><p><a href="Abnahmebericht.md">Technischer Abnahmebericht</a> · <a href="Dokumentation/g64-plattentektonik.md">Fachwissenschaftlicher Prüfbericht</a> · <a href="Dokumentation/g64-grafikpruefung.md">Grafischer Qualitätsbericht</a> · <a href="Dokumentation/curriculum-coverage.md">Curriculare Abdeckung</a> · <a href="Dokumentation/g64-bestand.md">Bestandsanalyse</a></p><h2>Bedienfilme</h2>']
for f in new['films']+volcano[1]['films']:
    name=escape(f['name']);html.append(f'<p><a href="Nachher/{name}.mp4">{name}</a> · {f["seconds"]:.1f} Sekunden</p>')
for shot in sorted([v['name'] for v in new['shots']]+volcano[1]['shots']):
    html.append('<h2>'+escape(shot)+'</h2><section>')
    for group in ['Vorher','Nachher']:
        path=group+'/'+shot+'.jpg'
        if path in files:html.append(f'<figure><a href="{path}"><img loading="lazy" src="{path}" alt="{escape(shot)}"></a><figcaption>{group}</figcaption></figure>')
    html.append('</section>')
html+=['<h2>Plattentektonik · neue Prozessmodelle und Daten</h2>']
for f in models['films']:
    name=escape(f['name']);html.append(f'<p><a href="Plattentektonik/{name}.mp4">{name}</a></p>')
html.append('<section>')
for n in models['shots']+atlas['shots']:
    name=escape(n);html.append(f'<figure><a href="Plattentektonik/{name}.jpg"><img loading="lazy" src="Plattentektonik/{name}.jpg" alt="{name}"></a><figcaption>{name}</figcaption></figure>')
html.append('</section>')
gallery=base/'Sichtpruefung.html';gallery.write_text('\n'.join(html)+'</html>');files[gallery.name]=gallery
dest=root/'artifacts/GeoRisiko-G6.4-Sichtpruefung.zip';dest.parent.mkdir(exist_ok=True)
with ZipFile(dest,'w',ZIP_DEFLATED) as z:
    for name,path in sorted(files.items()):z.write(path,name)
    z.writestr('SHA256-Inhalt.txt',''.join(digest(p)+'  '+n+'\n' for n,p in sorted(files.items())))
with ZipFile(dest) as z:assert z.testzip() is None
print(dest,len(files),'Dateien')
