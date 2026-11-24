"""Create reproducible local observations, independent from explanatory fault models."""
from pathlib import Path
import csv, hashlib, json, urllib.request, sys
root = Path(__file__).resolve().parents[2]
out = root / 'public/data/g5'
out.mkdir(parents=True, exist_ok=True)
url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=csv&starttime=2019-01-01&endtime=2024-01-01&minmagnitude=6&eventtype=earthquake&orderby=time-asc'
raw = Path(sys.argv[1]).read_bytes() if len(sys.argv)>1 else urllib.request.urlopen(url).read()
data = list(csv.DictReader(raw.decode().splitlines()))
rows = [[r['id'], r['time'][:10], float(r['longitude']), float(r['latitude']), float(r['depth']), float(r['mag']),r['magType']] for r in data if r['type']=='earthquake' and r['time']<'2024-01-01']
assert len(set(r[0] for r in rows))==len(rows) and all(r[5]>=6 for r in rows)
(out/'comcat.json').write_text(json.dumps(dict(query=url,sha256=hashlib.sha256(raw).hexdigest(),fields=['id','date','lon','lat','depthKm','mag','magType'],events=rows),separators=(',',':')))
