"""Build reproducible ZIPs from the production build and the current browser run."""
import json,zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

root=Path(__file__).resolve().parents[1]
dist=root/'dist'
out=root/'artifacts';out.mkdir(exist_ok=True)
def files(folder):
    return {p.relative_to(folder).as_posix():p.read_bytes() for p in sorted(folder.rglob('*')) if p.is_file()}
def archive(name,entries):
    dest=out/('GeoRisiko-G1-'+name+'.zip')
    with zipfile.ZipFile(dest,'w') as z:
        for key,value in sorted(entries.items()):
            entry=zipfile.ZipInfo(key,date_time=(2026,1,1,0,0,0));entry.compress_type=zipfile.ZIP_DEFLATED
            entry.external_attr=0o644<<16;z.writestr(entry,value)
    with zipfile.ZipFile(dest) as z: assert z.testzip() is None
    print(dest.name, dest.stat().st_size)
web=files(dist);assert 'index.html' in web
source=(root/'docs/data-sources-and-licenses.md').read_bytes();web['Quellen.md']=source
sco=dict(web);sco['scorm.js']=(root/'scripts/scorm.js').read_bytes()
sco['index.html']=sco['index.html'].replace(b'</head>',b'<script src="./scorm.js"></script></head>')
ns='http://www.imsproject.org/xsd/imscp_rootv1p1p2';adl='http://www.adlnet.org/xsd/adlcp_rootv1p2'
ET.register_namespace('',ns);ET.register_namespace('adlcp',adl)
def tag(s):return '{'+ns+'}'+s
def add(el,name,value=None,**attrs):
    child=ET.SubElement(el,tag(name),attrs);child.text=value;return child
m=ET.Element(tag('manifest'),identifier='GEORISIKO-G1',version='1.0')
meta=add(m,'metadata');add(meta,'schema','ADL SCORM');add(meta,'schemaversion','1.2')
os=add(m,'organizations',default='ATLAS');org=add(os,'organization',identifier='ATLAS')
add(org,'title','GeoRisiko 3D');item=add(org,'item',identifier='OBSERVATORIUM',identifierref='SCO');add(item,'title','Erdobservatorium')
rs=add(m,'resources');r=add(rs,'resource',identifier='SCO',type='webcontent',href='index.html');r.set('{'+adl+'}scormtype','sco')
for name in sorted(sco):add(r,'file',href=name)
ET.indent(m);sco['imsmanifest.xml']=ET.tostring(m,encoding='utf-8',xml_declaration=True)
assert all(f.attrib['href'] in sco for f in ET.fromstring(sco['imsmanifest.xml']).iter(tag('file')))
archive('SCORM-1.2',sco)
checks=files(root/'test-results');result=json.loads(checks['results.json'])
assert not result.get('failure') and len(result['runs'])==2 and all(len(r['checks'])>=10 for r in result['runs'])
assert len([p for p in checks if p.endswith('.jpg')])>=9
review=dict(web);review.update({'Pruefung/'+k:v for k,v in checks.items()})
for name in ('quality-report','geoscience-validation','design-system','architecture-decision'):
    review['Pruefung/'+name+'.md']=(root/('docs/'+name+'.md')).read_bytes()
review['START-macOS.txt']='''GeoRisiko 3D · Lokale Sichtprüfung
ZIP in einen eigenen Ordner entpacken. Im Terminal „cd “ eingeben, den
entpackten Ordner ins Terminal ziehen und die Eingabetaste drücken.
Mit installiertem Python 3 starten:
  python3 -m http.server 8000 --bind 127.0.0.1
Im Browser http://127.0.0.1:8000 öffnen. Beenden mit Ctrl+C.
Die lokale Version enthält alle Geodaten. Dateien unter Pruefung enthalten
echte Bildschirmaufnahmen, Kameraproben und Testergebnisse.
'''.encode()
archive('Sichtpruefung',review)

