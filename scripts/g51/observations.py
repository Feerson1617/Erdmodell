"""Format measured observations. Both source tables store measurements independently of the 3-D fault."""
import csv,json,sys,math,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[2]/'src/observatory'
japan,gnss=map(Path,sys.argv[1:])
events=[]
for r in csv.DictReader(japan.open()):
    if r['type']!='earthquake' or r['status']!='reviewed' or r['time']>='2024-01-01':continue
    lat=float(r['latitude']);lon=float(r['longitude']);depth=float(r['depth'])
    east=(lon-143.25)*111.195*math.cos(math.radians(38.25));north=(lat-38.25)*111.195;angle=math.radians(13)
    x=east*math.cos(angle)-north*math.sin(angle);along=east*math.sin(angle)+north*math.cos(angle)
    if abs(along)<=100 and depth>=0:events.append([r['id'],round(x,2),depth,lat,lon,r['time'][:10],float(r['mag']),r['magType']])
(root/'japan-events.json').write_text(json.dumps(events,separators=(',',':')))
rows=[]
for line in gnss.read_text().splitlines():
    r=line.split()
    if r and r[0] in ('HOFN','REYK','KOKB'):
        rows.append(dict(id=r[0],lat=float(r[-3]),lon=(float(r[-2])+180)%360-180,east=round(float(r[8])*1000,2),north=round(float(r[9])*1000,2),start=r[2],end=r[3]))
assert len(rows)==3
(root/'gnss.json').write_text(json.dumps(rows,separators=(',',':')))
print(len(events),'events;',len(rows),'GNSS records;',[(p.name,hashlib.sha256(p.read_bytes()).hexdigest()) for p in (japan,gnss)])
