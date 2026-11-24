"""Package measured material from the installed app and paired offline HTML sessions."""
from pathlib import Path
import json, math, statistics, zipfile
from hashlib import sha256
from html import escape

root=Path(__file__).resolve().parents[2]
out=root/'test-results/mac'
def read(path): return json.loads((out/path).read_text())
def digest(path): return sha256(path.read_bytes()).hexdigest()
raw=read('Pruefung.json')
app,web=raw['runs']
assert raw['arch']=='arm64' and raw['electron']['packaged'] and raw['restart']['verified']
assert app['classroom']['elapsedMs']>=900000 and all(not r['errors'] and not r['network'] for r in [app,web])
assert len(read('G521/Kontakte.json'))==30 and len(read('G521/Wasserbilanz.json'))==4
mech=read('G51/Mechanik.json');assert len(mech['records'])==5819 and mech['sub']==1127
resources=read('G52/Ressourcen.json');assert resources['resources']==len(resources['sha256'])>=348
runs={g:read('G6/'+g+'/Aufnahmen.json') for g in ['Vorher','Nachher','Unterricht','Maximal']}
index={g:{row['name']:row for row in rows} for g,rows in runs.items()}
assert set(index['Vorher'])==set(index['Nachher'])
assert set(range(1,28))<=set(int(x[:2]) for x in index['Nachher'])
def flatten(value):
    if isinstance(value,dict):return sum((flatten(value[k]) for k in sorted(value)),[])
    if isinstance(value,list):return sum((flatten(v) for v in value),[])
    return [value]
def compare(a,b):
    x,y=flatten(a),flatten(b)
    return len(x)==len(y) and all(math.isclose(i,j,abs_tol=.0005) if type(i) in [float,int] and type(j) in [float,int] else i==j for i,j in zip(x,y))
for name,old in index['Vorher'].items():
    new=index['Nachher'][name]
    assert compare(old['camera'],new['camera']), (name,old['camera'],new['camera'])
    assert compare(old.get('phase'),new.get('phase')) and old.get('playing')==new.get('playing') and old.get('cut')==new.get('cut'),name
    assert old['viewport']==new['viewport'] and all(old['resolution'][k]==new['resolution'][k] for k in ['width','height']),name
files={}
for rel in ['Pruefung.json','installation.log','SHA256.txt','G52/Ressourcen.json','G51/Mechanik.json','G51/Zeitreise.log','G521/Kontakte.json','G521/Bedienung.json','G521/Wasserbilanz.json','G521/Speicher.json']:
    files[rel]=out/rel
for g,rows in runs.items():
    files[g+'/Messungen.json']=out/'G6'/g/'Aufnahmen.json'
    for row in rows:files[g+'/'+row['name']+'.jpg']=out/'G6'/g/(row['name']+'.jpg')
for movie in app['g52']['movies']:
    assert movie['frames']>=5
    files['Filme/'+movie['name']+'.mp4']=out/'G52'/(movie['name']+'.mp4')
assert len(app['g52']['movies'])==2
for f in ['g6-quellen.md','g6-grafik.md','g521-unterricht.md','curriculum-coverage.md','mac-installation.md']:
    files['Dokumentation/'+f]=root/'docs'/f
for p in sorted((root/'public/data/g6').glob('*.json')):files['Quellen/'+p.name]=p
files['Quellen/G6-Bildquellen.txt']=root/'public/licenses/G6-Bildquellen.txt'
text=['# GeoRisiko G6 · Abnahme','',f"Commit `{raw['commit']}` · Actions-Lauf {raw['run']}.",
    f"Virtueller ARM64-Mac · {raw['hardware']['cpu']} · macOS {raw['hardware']['macOS']}. Der physische MacBook-Air-M1- und Smartboard-Test wurde auf Wunsch übersprungen.",
    '', '## Bildvergleich und Messverfahren','',
    'Die Originalbilder in Vorher und Nachher stammen aus der offline geöffneten Einzeldatei. G5.2.1 wurde aus 439a6b6 gebaut. Beide Versionen liefen nacheinander in eigenen Chrome-Profilen auf derselben Maschine. Fenstergröße, Kamerapose, Modellzeit, Pause und Zeichenfläche wurden paarweise geprüft. Die Messbank fixiert einen Framebuffer-Pixel je CSS-Pixel. Beim regulären 15-Minuten-Lauf regelt die App ihre Auflösung selbst.',
    '',f"SHA-256 des gebauten G5.2.1-Exports: {digest(root/'.scratch/g521-reference/artifacts/GeoRisiko-G5.2.1-Web-Test.html')}. SHA-256 von G6: {digest(root/'artifacts/GeoRisiko-G6-Web-Test.html')}.",
    '',f"{len(index['Vorher'])} Bildpaare. Die Messfenster umfassen 2,5 Sekunden nach Eingabe. Unter animation stehen eigene Messungen ab der angegebenen Startphase mit laufendem Modell. Gaps, Median, P95, längste Pause, Speicher, Dreiecke, Geometrien, Texturen und Zeichenaufrufe stehen in Messungen.json. Der Speicherwert summiert die RSS-Werte des Browser-Prozessbaums einschließlich gemeinsam genutzter Seiten.",
    '', '## Grafikprofile und Leistung','',
    '| Ansicht und Zustand | Fassung | FPS | Median ms | P95 ms | Max ms | Draw Calls | Dreiecke | RSS MiB | Szenenaufruf ms |',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|']
for group,rows in runs.items():
    for row in rows:
        for field,state in [('data','Pause'),('animation','läuft')]:
            if data:=row.get(field):
                text.append('| '+' | '.join(str(x) for x in [row['name']+' '+state,group,round(data['fps'],1),round(data['median'],1),round(data['p95'],1),round(data['max'],1),row['draws'],row['triangles'],round(row['rssMiB']),round(row['loadMs'])])+' |')
text+=['','Szenenaufruf 0 bedeutet, dass für diesen Kameraschritt kein Modul geladen wurde. Der erste Parkfield-Aufruf einer Sitzung und der erneute Aufruf am Ende dokumentieren den kalten und warmen Pfad.',
    '', '## Dauerlauf der installierten App','',f"Dauer {app['classroom']['elapsedMs']/60000:.1f} Minuten. Die folgenden Werte fassen alle gespeicherten Bildabstände bei 1920 Pixel Fensterbreite pro Modell zusammen.",'','| Modell | FPS | P95 ms | Max ms |','|---|---:|---:|---:|']
long=app['classroom']['samples']
for scene in sorted({r['scene'] for r in long if r['width']==1920}):
    gaps=sorted(g for row in long if row['width']==1920 and row['scene']==scene for g in row['gaps']);text.append(f"| {scene} | {1000/statistics.mean(gaps):.1f} | {gaps[int(.95*(len(gaps)-1))]:.1f} | {max(gaps):.1f} |")
text+=['','## Funktion, Umfang und Grenzen','',f"Geprüft wurden 30 Kontaktzustände, vier Wasserbilanzen, 5.819 Grenzabschnitte und 1.127 Subduktionspolungen. Die Klasse nutzte im automatisierten Durchlauf die Unterrichtsansichten, die Favoritenspeicherung, die Modellphasen und den Perspektivwechsel. Das Protokoll enthält außerdem Schalentests, Orte, Nyos, historische Rekonstruktionen, Zukunftsvergleiche und den Neustart des installierten Programms. {resources['resources']} Ressourcen des App-Archivs wurden byteweise mit dem Inhalt der HTML verglichen.",
    '', 'Die gestalterische Einordnung der Referenzregionen, Quellen, Profilstufen und verbleibenden Schwächen steht in Dokumentation/g6-grafik.md. Leistungswerte gelten für die dokumentierte virtuelle Maschine.']
report=out/'G6-Abnahme.md';report.write_text('\n'.join(text)+'\n');files['Abnahmebericht.md']=report
html=['<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>GeoRisiko – Sichtprüfung G6</title><style>body{background:#172724;color:#ebf0eb;font:16px system-ui;margin:2vw}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr));gap:1vw}figure{margin:0}img{width:100%;height:auto}a{color:#c2ddc8}h2{margin-top:2rem}</style><h1>GeoRisiko G6 · Sichtprüfung</h1><p><a href="Abnahmebericht.md">Abnahmebericht mit Messwerten</a></p>']
for name in index['Nachher']:
    html+=['<h2>'+escape(name)+'</h2><section>']
    for g in ['Vorher','Nachher','Unterricht','Maximal']:
        if name in index[g]:
            src=escape(g+'/'+name+'.jpg');html.append(f'<figure><a href="{src}"><img loading="lazy" src="{src}" alt="{escape(name)}"></a><figcaption>{g}</figcaption></figure>')
    html.append('</section>')
html.append('</html>');gallery=out/'G6-Sichtpruefung.html';gallery.write_text('\n'.join(html));files['Sichtpruefung.html']=gallery
dest=root/'artifacts/GeoRisiko-G6-Sichtpruefung.zip'
with zipfile.ZipFile(dest,'w',zipfile.ZIP_DEFLATED) as z:
    for name,p in sorted(files.items()):z.write(p,name)
    z.writestr('SHA256-Inhalt.txt',''.join(digest(p)+'  '+n+'\n' for n,p in sorted(files.items())))
with zipfile.ZipFile(dest) as z:assert z.testzip() is None
print(dest,len(files))
