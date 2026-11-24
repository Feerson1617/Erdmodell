"""Derive two attributed surface traces; no inverse fault mechanism is inferred from epicentres."""
import csv,io,json,hashlib,math
from pathlib import Path
from urllib.request import urlopen
root=Path(__file__).resolve().parents[2];sfile=root/'src/observatory/sites.json'
gem='https://raw.githubusercontent.com/GEMScienceTools/gem-global-active-faults/56816508ad92fd6846dad1163b1c8c01376a2cd1/geojson/gem_active_faults.geojson'
trench='https://raw.githubusercontent.com/usgs/slab2/f53d627ef36cc6a566c6ccd241f7d931fee8ef63/slab2code/library/misc/trenches_usgs_2017_depths.csv'
def get(u):
    with urlopen(u,timeout=60) as response:return response.read()
a=get(gem);b=get(trench)
fault=next(f for f in json.loads(a)['features'] if f['properties'].get('catalog_id')=='UCF_32' and f['properties'].get('name')=='San Andreas (Parkfield)')
points=fault['geometry']['coordinates'];(x1,y1),(x2,y2)=points
sites=json.loads(sfile.read_text());san=sites['san'];san['lat']=(y1+y2)/2;san['lon']=(x1+x2)/2;san['strike']=round(math.degrees(math.atan2((x1-x2)*math.cos(math.radians(san['lat'])),y1-y2))%360,3)
sfile.write_text(json.dumps(sites,indent=2)+'\n')
rows=sorted([[float(r['lon']),float(r['lat']),float(r['depth'])] for r in csv.DictReader(io.StringIO(b.decode())) if r['slab']=='jap' and 36.8<float(r['lat'])<39.8],key=lambda r:r[1])
out={'san':dict(name='Kartierte San-Andreas-Störung',source=gem,sha256=hashlib.sha256(a).hexdigest(),license='CC BY-SA 4.0',points=points),'japan':dict(name='Japangraben im Slab2-Datensatz',source=trench,sha256=hashlib.sha256(b).hexdigest(),license='USGS public domain',points=rows)}
(root/'src/observatory/traces.json').write_text(json.dumps(out,indent=2,ensure_ascii=False)+'\n')
