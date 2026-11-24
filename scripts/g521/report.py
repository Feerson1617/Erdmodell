"""Compact, verified evidence from the exact DMG installation and standalone export."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from hashlib import sha256
import json
import statistics
from html import escape

root = Path(__file__).resolve().parents[2]
out = root / 'test-results/mac'
load = lambda name: json.loads((out / name).read_text())
raw = load('Pruefung.json')
app, web = raw['runs']
contacts, water = load('G521/Kontakte.json'), load('G521/Wasserbilanz.json')
res, mech = load('G52/Ressourcen.json'), load('G51/Mechanik.json')
assert raw['arch'] == 'arm64' and raw['electron']['packaged'] and raw['restart']['verified']
assert raw['restart']['before'] == raw['restart']['after'] and raw['restart']['firstPID'] != raw['restart']['secondPID']
assert not raw.get('failure') and all(not r['errors'] and not r['network'] for r in raw['runs'])
assert res['resources'] == len(res['sha256']) >= 348 and len(mech['records']) == 5819 and mech['sub'] == 1127
assert len(contacts) == 30 and len(water) == 4 and app['classroom']['elapsedMs'] >= 900000
assert all(len(r['g52']['steps']) == 13 and len(r['g52']['transfer']) == 5 for r in raw['runs'])
lesson = app['g52']
assert len(lesson['movies']) == 2 and all(v['frames'] >= 5 for v in lesson['movies'])
files = {}
for f in ['Pruefung.json','installation.log','G52/Ressourcen.json','G51/Mechanik.json','G51/Zeitreise.log','G521/Kontakte.json','G521/Wasserbilanz.json','G521/Speicher.json','G521/Bedienung.json','SHA256.txt']:
    files[f] = out / f
for f in ['g521-unterricht.md','g521-kaltstart.json','curriculum-coverage.md','g51-quellen.md','mac-installation.md']:
    files['Dokumentation/'+f] = root / 'docs' / f
for p in (root / 'docs/g521-vergleich').iterdir(): files['Vorher/'+p.name] = p
for p in (out/'G521').glob('*.jpg'): files['Aktuell/'+p.name] = p
for f in lesson['pictures']: files['Aktuell/'+f+'.jpg'] = out/'G52'/(f+'.jpg')
for v in lesson['movies']: files['Filme/'+v['name']+'.mp4'] = out/'G52'/(v['name']+'.mp4')
def table(headers, rows):
    return ['| '+' | '.join(headers)+' |','|'+'---|'*len(headers)]+['| '+' | '.join(map(str,row))+' |' for row in rows]
text=['# Unterrichtsprüfung G5.2.1','',f"Commit `{raw['commit']}` · GitHub Actions {raw['run']}.",
      f"Virtueller ARM64-Mac, {raw['hardware']['cpu']}, macOS {raw['hardware']['macOS']}. Die Tests liefen auf der vom ausgeworfenen DMG installierten App und der offline geöffneten HTML. Der physische Schul-Mac und das Smartboard wurden auf Wunsch ausgelassen.",
      '', '## Befunde', '',
      'Im Graben gingen in der Referenz die äußeren Blöcke auch unter der Störungswurzel auseinander. Der Absenkungsbetrag läuft jetzt an dieser Wurzel aus, der tiefere Mantel ist ein zusammenhängender Körper. Am Rand des Geländeauschnitts klingt die Verformung aus. Am Rücken fehlte zwischen den auseinanderrückenden Platten Kruste. Der neue basaltische Körper wächst mit der Öffnung, darunter reicht der Mantel durch die Achse. Die Fotografien zeigen mehrere tatsächliche Modellphasen.',
      '', 'Bei Überschiebungen folgten Ober- und Unterplatte verschiedenen Netzen. Die neuen Volumenkörper teilen sich eine Oberfläche und eine schmale Scherzone. Die vordere Schnittfläche bleibt bei seitlicher Bewegung des kalifornischen Vergleichswegs ortsfest. Gestein und Vegetation folgen dem bewegten Gelände.',
      '', 'Die Tabelle enthält Maximalwerte über fünf Phasen, 185 senkrechte Proben je Schnitt und drei zusätzliche Tiefenschnitte im Volumen. Die Werte sind Modelleinheiten. Kontakte zwischen triangulierten, gekrümmten Flächen können zwischen Stützstellen abweichen. Diese Stichproben beweisen keine exakte globale Volumenerhaltung.', '']
text += table(['Gebiet','Spalt vorne','Überlappung vorne','Spalt innen','Hohlraumanteil innen','Geländeabweichung vorne'],[
    [s]+[f"{max(r[k] for r in rows):.5f}" for k in ['gap','overlap','maxVoid']]+[f"{max(r['voidVolume']/r['sampledVolume'] for r in rows):.6%}",f"{max(r['skin'] for r in rows):.5f}"]
    for s in dict.fromkeys(r['site'] for r in contacts) for rows in [[r for r in contacts if r['site']==s]]])
text+=['','Die bisher schwach erkennbare Welle erhält eine seitliche Analyse mit Ruhelinie, Tiefenmarke und gekennzeichneter Überhöhung. Wasser, Grund und benetzte Fläche stammen aus demselben Solver. Die Differenz am japanischen Geländegitter gegenüber dem Solver beträgt maximal %.8f.'%max(r['bedMismatch'] for r in contacts if r['site']=='japan'),'']
text+=table(['Profil','Zellen','Max. neu nass','Am Ende','Bilanzrest','Max. Wasserstandsänderung'],[[n,s['cells'],s['most'],s['final'],f"{s['budget']['residual']:.2e}",f"{s['maxSignal']:.5f}"] for n,w in water.items() for s in w['stats']])
nass=water['Kueste']['stats']
text+=['','Bei feinerem Raster verändert sich die benetzte Strecke im Küstenmodell. Die maximale Breite zuvor trockener, benetzter Rasterzellen beträgt '+', '.join(f"{r['dx']*r['most']:.3f}" for r in nass)+' Modelleinheiten. Eine rasterunabhängig konvergierte Überflutungsgrenze ist daraus nicht ableitbar. Beide Zusatzprofile blieben endlich, das ungestörte Wasser am Hang blieb in Ruhe.']
text+=['','Die Oberfläche in Parkfield zeigt den lokalen Spannungsaufbau vor dem Bruch und seine anschließende Entlastung. Wegversatz (Anfang, Aufbau, Bruch, Ende) in Modelleinheiten: '+', '.join(f'{n:.4f}' for n in lesson['marker'].values())+'.',
       '',f"Favorit nach vollständigem Prozessende und Neustart mit gleichem Profil wiederhergestellt (PID {raw['restart']['firstPID']} → {raw['restart']['secondPID']}). Einzelheiten zu Kamera, Phase und Schaltern stehen in Pruefung.json.",
       '', '## Unterricht und Szenenwechsel','']
text+=table(['Modellhandlung','Bedienelemente','ms'],[[v['label'],', '.join(v['actions']) or 'Beobachtungszeit',v['ms']] for v in lesson['steps']+lesson['transfer']])
text+=['','Die gemessenen Zeiten enthalten das tatsächliche Bedienen, Rendern und Abwarten des Kamerastillstands. Der Test erfasst technische Zustände. Lernerfolg und Schülerreaktionen wurden nicht erhoben.','']
text+=table(['Lokales Ereignis','Phase','Ressourcen ms','Solver ms','Geometrie ms','Kompilierung ms','Wechsel ms','Cache'],[[t['event'],t['progress']]+[round(t.get(k,0),1) for k in ['dataMs','solverMs','geometryMs','warmShaderMs','localSwitchMs','reused']] for t in lesson['switches']])
text+=['','## Leistung','','Im getrennten Linux-Vergleich dauerte das synchrone Auslesen der 96 × 72 Farbproben zur Platzierung der Geländedetails beim kalten Öffnen Japans 2.014 und 2.192 ms. Mit CPU-gestütztem Lesecanvas waren es 6,6 und 9,0 ms. Vier unabhängige Browserstarts, unveränderte Textur und Probenzahl, Chromium 141 mit SwiftShader. Die App bereitet außerdem die Shader vor dem ersten regionalen Bild vor. Die folgenden Werte stammen aus den beiden ausgelieferten Produkten auf dem virtuellen Mac.','']
text+=table(['Produkt','Kurzes Messfenster','FPS','P95 ms','Längste Pause ms'],[[r['name'],s['scene'],round(s['fps'],1),round(s['p95'],1),round(s['max'],1)] for r in raw['runs'] for s in r['g5']['measurements']])
long=app['classroom']['samples']
text+=['','15-Minuten-Durchlauf mit wechselnden Szenen. Einzelne lange Frames können weiterhin auftreten.','']
text+=table(['Breite','Szene','FPS','P95 ms','Max ms'],[[width,scene,round(1000/statistics.mean(gaps),1),round(sorted(gaps)[int(.95*(len(gaps)-1))],1),round(max(gaps),1)] for width,scene in sorted({(s['width'],s['scene']) for s in long}) for gaps in [[g for s in long if s['width']==width and s['scene']==scene for g in s['gaps']]]])
text+=['','Bisheriger G5.2-Vergleich bei 1920 × 1080: Parkfield 45,6 FPS, Tōhoku 57,4 FPS, Vulkanismus 59,9 FPS, Zeitreise rund 60 FPS. Die Einzelmessungen hängen vom virtuellen Runner und der Szenenphase ab.','',
       'Offline wurden 5.819 Grenzdatensätze und 1.127 Subduktionspolungen geprüft. Die Zeitreise, vier Zukunftsszenarien, Schalen, 52 Plattenvergleiche und Nyos gehörten zur Regression. Signatur, Entpacken und lokaler Start sind in installation.log dokumentiert.']
report=out/'Abnahmebericht.md';report.write_text('\n'.join(text)+'\n');files[report.name]=report
entries=['<!doctype html><html lang="de"><meta charset="utf-8"><title>GeoRisiko G5.2.1 · Bildvergleich</title><style>body{background:#20312f;color:#fff;font:16px system-ui}section{display:flex;gap:1rem}figure{margin:0;flex:1}img{width:100%}h2{margin-top:2rem}</style><h1>GeoRisiko · gerenderte Vergleichsaufnahmen</h1>']
for path in sorted(files):
    if path.startswith('Aktuell/') and path.endswith('.jpg'):
        name=path.split('/')[-1];entries.append('<h2>'+escape(name.removesuffix('.jpg'))+'</h2><section>')
        for group in ['Vorher','Aktuell']:
            dest=group+'/'+name
            if dest in files: entries.append(f'<figure><img loading="lazy" src="{escape(dest)}"><figcaption>{group}</figcaption></figure>')
        entries.append('</section>')
index=out/'Sichtpruefung.html';index.write_text('\n'.join(entries)+'</html>');files[index.name]=index
dest=root/'artifacts/GeoRisiko-G5.2.1-Sichtpruefung.zip'
with ZipFile(dest,'w',ZIP_DEFLATED) as z:
    for name,p in sorted(files.items()): z.write(p,name)
    z.writestr('SHA256-Inhalt.txt',''.join(sha256(p.read_bytes()).hexdigest()+'  '+n+'\n' for n,p in sorted(files.items())))
with ZipFile(dest) as z: assert z.testzip() is None
print(dest.name,len(files),'Dateien')
