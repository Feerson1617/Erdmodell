"""Package evidence from both completed ARM jobs. Abort on incomplete evidence."""
from pathlib import Path
from hashlib import sha256
from html import escape
import json
import zipfile

root = Path(__file__).resolve().parents[2]
out = root/'test-results/mac'
def read(name):
    return json.loads((out/name).read_text())
def digest(path):
    return sha256(path.read_bytes()).hexdigest()

raw = read('Pruefung.json')
app, web = raw['runs']
assert raw['arch']=='arm64' and raw['electron']['packaged'] and raw['restart']['verified']
assert app['classroom']['elapsedMs']>=900000 and all(not a['errors'] and not a['network'] for a in (app,web))
old,new = (read('G62/'+g+'/Unterricht.json') for g in ('Vorher','Nachher'))
assert all(r['complete'] and not r['errors'] and not r['network'] for r in (old,new))
assert old['size']==new['size']==dict(width=1920,height=1080)
assert len(new['movies'])==5 and all(m['frames']>=5 for m in new['movies'])
assert any(c.get('restored') for c in new['checks'])
assert len(old['measurements'])==len(new['measurements'])==2
assert new['product'] in (out/'SHA256.txt').read_text()
mech,geo=read('G51/Mechanik.json'),read('G62/Grenzerklaerungen.json')
assert len(mech['records'])==geo['steps']==5819 and mech['sub']==geo['sub']==1127
assert geo['plates']==52 and geo['pairs']==48 and len(geo['types'])==9
assert len(read('G521/Kontakte.json'))==30 and len(read('G521/Wasserbilanz.json'))==4
near=read('G61/Nahmodelle.json')
assert len(near['lava'])==9 and len(near['roots'])==6 and not near['errors'] and not near['net']
assets=read('G52/Ressourcen.json')
assert assets['resources']==len(assets['sha256'])>=389
groups={'Vorher':old,'Nachher':new}
pictures={g:{s['name']:s for s in data['shots']} for g,data in groups.items()}
assert set(range(1,31))<={int(n[:2]) for n in pictures['Nachher']}
assert set(pictures['Vorher'])<=set(pictures['Nachher'])
files={}
for group,shots in pictures.items():
    for name in shots:
        file=group+'/'+name+'.jpg'
        files[file]=out/'G62'/file
    files[group+'/Unterricht.json']=out/'G62'/group/'Unterricht.json'
for film in new['movies']:
    name=film['name']+'.mp4'
    files['Filme/'+name]=out/'G62/Nachher'/name
for rel in ['G62/Grenzerklaerungen.json','G62/Favorit-G61.json','Pruefung.json','SHA256.txt','installation.log','G52/Ressourcen.json','G51/Mechanik.json','G51/Zeitreise.log','G61/Nahmodelle.json','G521/Kontakte.json','G521/Bedienung.json','G521/Wasserbilanz.json','G521/Speicher.json']:
    files['Protokolle/'+rel]=out/rel
for name in ['curriculum-coverage.md','g62-lernmodell.md','g51-quellen.md','g5-quellen.md','g6-quellen.md','g61-landschaften.md','mac-installation.md']:
    files['Dokumentation/'+name]=root/'docs'/name
for path in (root/'public/licenses').iterdir():
    if path.is_file():files['Lizenzen/'+path.name]=path
for folder in ['g6','g61']:
    for path in (root/'public/data'/folder).glob('*.json'):
        files['Quellen/'+folder+'/'+path.name]=path
run='https://github.com/Feerson1617/Erdmodell/actions/runs/'+str(raw['run'])
width=pictures['Nachher']['03-Subduktion']['canvas']['w']
pins=sorted({p['name'] for s in new['shots'] for p in s['pins']})
text=['# GeoRisiko G6.2 · Abschlussbericht','',f"Commit `{raw['commit']}`. Die installierte ARM64-App wurde vom ausgeworfenen DMG gestartet und nach dem Beenden erneut geöffnet. [GitHub-Actions-Lauf]({run})",'',
       '## Unterricht, Fachlichkeit und Auslieferung','',
       f"1. Bei 1.920 Pixeln Fensterbreite erhält das Modell {width:.0f} Pixel ({100*width/1920:.1f} %). Daneben stehen Bewegung, Ursache, mögliche Folgen, Ort und Modellgrenze.",
       "2. Erklären öffnet mit Grundbegriffen an sichtbaren Strukturen. Regionalmodell und Zeitreise zeigen die zur aktuellen Einstellung passende Erklärung. Vertiefungen und Quellen sind separat erreichbar.",
       "3. Neun Grenzklassen besitzen eigene Erklärungen. Geprüfte Häufigkeiten: "+', '.join(f'{k} {v}' for k,v in sorted(geo['types'].items()))+'. Der Hotspot ist ein zusätzliches Beispiel im Inneren einer Platte.',
       "4. Die Namen stammen von den beiden Seiten des PB2002-Grenzschritts. Alle 1.127 Subduktionspolungen wurden geprüft. Vor Japan taucht die Pazifische unter die Ochotskplatte.",
       "5. Die starren Ausschnitte zeigen die Relativbewegung. Mögliche Folgen stehen getrennt in der Erklärfläche. Der Wechsel zum geologischen Schnitt übernimmt die ID des gezeigten Grenzabschnitts.",
       "6. In den gespeicherten Bildern waren folgende räumliche Beschriftungen lesbar: "+', '.join(pins)+'.',
       "7. Schalen verwenden Schnittfläche und Referenzradien, Platten die rotierenden Ausschnitte. Regionalansichten verwenden bewegte Geometrie, Instanztransformationen und den aktiven Zeichenbereich. Für Nyos werden unter anderem Seeschnitt, Gasblasen und Rohr verwendet.",
       "8. Die Layoutprüfung berücksichtigt mehrere Platzierungen, belegte Rechtecke, Bedienflächen und Zeichenflächenrand. Ausgewählte und wichtige Begriffe haben Vorrang. Das Protokoll verzeichnet die im Browser tatsächlich sichtbaren Rechtecke.",
       "9. Unter anderem sind Schalen, Platten, Herd, Epizentrum, Wellenfronten, Gesteinsflächen, Lava und Schutzobjekte antippbar. Der regionale Treffpunkt dient als Anker der Erklärung.",
       "10. Bruchfortschritt, Wellenlaufzeit, Bewegung der Wasserzellen, Eruptionszustand, Alter und Zukunftsszenario bestimmen Phasentitel und Erläuterungen. Die ursprüngliche Uferlinie bleibt zum Vergleich sichtbar.",
       "11. Der Parkfield-Bedienlauf gibt bei angehaltenem Modell zuerst die Phase und dann einen Namen frei und verbirgt beides wieder.",
       "12. Modellzeit, Kamera und Wiedergabe wurden beim Moduswechsel verglichen. Ein tatsächlich mit G6.1 gespeicherter Favorit wurde in G6.2 geöffnet. Ein weiterer Favorit wurde nach dem Neustart der installierten App wiederhergestellt.",
       "13. Krustenüberhöhung, generalisierte Grenzlinien, idealisierter Untergrund, historische Rekonstruktionen und unsichere Zukünfte sind als Modellgrenzen erläutert.",
       "14. Parkfields lokale Geländemarken folgen dem Bruch. Ein explosiver Ausbruch auf Island lässt das lokale Lavafeld ruhen. Von dort und von der ruhigen japanischen Bucht gelangt man direkt zur modellierten regionalen Bewegung.",
       "15. Die regionale Lava auf Island ist breiter sichtbar. Bilder 21 und 21a erlauben einen Vergleich des Ausflusses auf regionalem und lokalem Gelände.",
       "16. Überarbeitet wurden der Materialkontrast im Schnitt, die lokale Vegetationsverteilung und die Ansicht an der Austrittsstelle. Auf Hawaii folgt der kurze Ausbruch auf die lange Wachstumsphase. Neun Versuche prüfen die gezeichneten Lavabahnen.",
       f"17. Grenztypen, Erdbeben, Zeitreise und Seebeben wurden vollständig bedient. {len(new['shots'])} Nachher-Bilder, {len(old['shots'])} Vorher-Bilder und fünf echte Bedienfilme dokumentieren die Schritte.",
       f"18. Geprüft wurden 5.819 Grenzabschnitte, 52 Platten, 48 unterschiedliche Atlasbeispiele, 30 Kontaktzustände, vier Wasserbilanzprofile sowie historische und zukünftige Kontinentalanordnungen. {assets['resources']} Ressourcen stimmen byteweise zwischen App und HTML überein.",
       f"19. Der Dauerlauf dauerte {app['classroom']['elapsedMs']/60000:.1f} Minuten auf {raw['hardware']['cpu']} mit macOS {raw['hardware']['macOS']}. Die Tabellen trennen neu gezeichnete Bilder von Browseraufrufen.",
       "20. Eine physische M1-/Smartboard-Erprobung und Unterrichtsbeobachtung stehen aus. Das Modell liefert qualitative Aussagen zu Risiken. Einzelne Pflanzen, Eruptionen und Überflutungsreichweiten sind exemplarisch. Bei engem Bildausschnitt können nachrangige Beschriftungen entfallen.",
       f"21. DMG, App-ZIP, Offline-HTML und Sichtprüfungs-ZIP sind Einzelartefakte im [macOS-Lauf]({run}). Die App ist ad hoc signiert. Die Hinweise zu Gatekeeper stehen in Dokumentation/mac-installation.md.",
       '', '## Paarmessung auf demselben virtuellen Mac','', 'Beide Chrome-Sitzungen laufen mit 1.920 × 1.080 CSS-Pixeln, festem Unterrichtsprofil und laufender Animation.',
       '', '| Szene | Version | Zeichenfläche | Renderbilder/s | Browseraufrufe/s | P95 ms | Max ms |','|---|---|---:|---:|---:|---:|---:|']
for group,data in groups.items():
    for m in data['measurements']:
        assert m['frames']>0 and m['profile']['profile']=='classroom'
        r=m['resolution']
        text.append(f"| {m['name']} | {group} | {r['width']} × {r['height']} | {m['renderedFps']:.1f} | {m['raf']:.1f} | {m['p95']:.1f} | {m['max']:.1f} |")
text+=['','## Dauerlauf der installierten App im Automatikprofil','','| Szene | Fenster | Zeichenfläche | Renderbilder/s | Browseraufrufe/s | P95 ms | Prozessbaum RSS MiB |','|---|---:|---:|---:|---:|---:|---:|']
for m in app['classroom']['samples']:
    r=m['states'][-1]['resolution']
    text.append(f"| {m['scene']} | {m['width']} × {m['height']} | {r['width']} × {r['height']} | {m['renderedFps']:.1f} | {m['fps']:.1f} | {m['p95']:.1f} | {m['rssAfterMiB']:.0f} |")
text+=['','## Bildvergleich und Integrität','','Vorher stammt aus der G6.1-Einzeldatei zum gesicherten Stand d4b45df. Nachher stammt aus der G6.2-Einzeldatei. Unterschiedliche Zuschnitte im Grenzvergleich ergeben sich aus der neuen Aufteilung. Bei 07 zeigt G6.1 den kartierten Abschnitt und G6.2 seinen anwählbaren starren Vergleich. Zusätzliche Freigabe-, Layout- und Präsentationsbilder dokumentieren G6.2.','','SHA-256 der Einzeldateien','',f"- G6.1 `{old['product']}`",f"- G6.2 `{new['product']}`",'','Die Unterrichtsprotokolle enthalten die Handlungen, Phasen, Beschriftungsrechtecke und Messwerte. Protokolle/Pruefung.json enthält die Messreihe der installierten App, Qualitätsschaltungen, Speicher und Fehlerlisten.']
report=out/'Abnahmebericht.md'
report.write_text('\n'.join(text)+'\n')
files[report.name]=report
html=['<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GeoRisiko G6.2 · Sichtprüfung</title><style>body{margin:3vw;background:#182722;color:#f1f1e4;font:16px system-ui}a{color:#b5e1cd}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));gap:1em}figure{margin:0}img{width:100%;height:auto}</style><h1>GeoRisiko G6.2 · Sichtprüfung</h1><p><a href="Abnahmebericht.md">Abnahmebericht und Messwerte</a></p><h2>Unterrichtsfilme</h2><ul>']
for m in new['movies']:
    n=escape(m['name'])
    html.append(f'<li><a href="Filme/{n}.mp4">{n}</a> · {m["seconds"]:.1f} s</li>')
html.append('</ul>')
for name in sorted(pictures['Nachher']):
    n=escape(name)
    html.append(f'<h2>{n}</h2><section>')
    for group,idx in pictures.items():
        if name in idx:
            src=group+'/'+n+'.jpg'
            html.append(f'<figure><a href="{src}"><img loading="lazy" src="{src}" alt="{n}"></a><figcaption>{group}</figcaption></figure>')
    html.append('</section>')
gallery=out/'Sichtpruefung.html'
gallery.write_text('\n'.join(html)+'</html>')
files[gallery.name]=gallery
dest=root/'artifacts/GeoRisiko-G6.2-Sichtpruefung.zip'
dest.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(dest,'w',zipfile.ZIP_DEFLATED) as archive:
    for name,path in sorted(files.items()):archive.write(path,name)
    archive.writestr('SHA256-Inhalt.txt',''.join(digest(p)+'  '+n+'\n' for n,p in sorted(files.items())))
with zipfile.ZipFile(dest) as archive:assert archive.testzip() is None
print(dest,len(files))
