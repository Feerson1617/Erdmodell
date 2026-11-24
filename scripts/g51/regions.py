"""Rebuild the compact companion to Bird's original step table and reference-site samples."""
from pathlib import Path
import csv, json, math, hashlib, sys
import numpy as np
root=Path(__file__).resolve().parents[2]
steps,lines,profile=map(Path,sys.argv[1:4])
assert hashlib.sha256(steps.read_bytes()).hexdigest()=='513babb111c65cd275274e2edcb249085d00e007c79d8755e1b4b79f60806f37'
identifiers={row[:5] for row in lines.read_text().splitlines() if row and row[0].isalpha()}
dem=np.fromfile(root/'public/data/relief.i16','<i2').reshape(361,721)
def height(lat,lon):
    x=((lon+180)%360)*2;y=max(0,min(360,(90-lat)*2));i=int(x);j=min(359,int(y));f=x-i;g=y-j
    return round(float((1-g)*((1-f)*dem[j,i]+f*dem[j,i+1])+g*((1-f)*dem[j+1,i]+f*dem[j+1,i+1])))
table=[];regional=[];refs={2877:'san',2629:'japan',4209:'island',2093:'himalaya',5505:'rift'}
for line in steps.read_text().splitlines():
    id=int(line[:4]);pair=line[6:11];assert pair in identifiers and id==len(table)+1
    strike=int(line[52:55]);div=float(line[66:72]);dex=float(line[73:79]);elev=int(line[80:86]);lat=(float(line[21:28])+float(line[38:45]))/2
    a=float(line[12:20]);lon=a+((float(line[29:37])-a+180)%360-180)/2
    table.append([strike,div,dex,elev,height(lat,lon),line[95:96]=='*'])
    # A 7×7 world-relief window. Transform from section coordinates into geographic coordinates.
    grid=[]
    for j in range(7):
        for i in range(7):
            dx=(i-3)*20;dz=(j-3)*15;r=math.radians(strike)
            east=dx*math.cos(r)-dz*math.sin(r);north=-dx*math.sin(r)-dz*math.cos(r)
            d=math.hypot(east,north)/6371;az=math.atan2(east,north);phi=math.radians(lat)
            out=math.asin(math.sin(phi)*math.cos(d)+math.cos(phi)*math.sin(d)*math.cos(az))
            dl=math.atan2(math.sin(az)*math.sin(d)*math.cos(phi),math.cos(d)-math.sin(phi)*math.sin(out))
            grid.append(height(math.degrees(out),lon+math.degrees(dl)))
    regional.extend(grid)
out=root/'src/observatory';(out/'pb-fields.json').write_text(json.dumps(table,separators=(',',':')))
dest=root/'public/data/g51';dest.mkdir(exist_ok=True)
np.asarray(regional,dtype='<i2').tofile(dest/'regional-relief.i16')
source=json.loads((root/'src/tectonics/steps.json').read_text())
(out/'reference-steps.json').write_text(json.dumps({name:source[i-1] for i,name in refs.items()},separators=(',',':')))
transect=[]
for r in csv.DictReader(profile.open()):
    east=(float(r['lon'])-143.25)*111.195*math.cos(math.radians(38.25));north=(float(r['lat'])-38.25)*111.195
    transect.append([round((east*math.cos(math.radians(13))-north*math.sin(math.radians(13)))*12/320,4),float(r['depth'])])
(out/'miyagi.json').write_text(json.dumps(sorted(transect,reverse=True),separators=(',',':')))
print(len(table),'steps;',len(transect),'Slab2 profile constraints;',len(regional),'elevations')
