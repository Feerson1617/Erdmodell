"""Fetch the pinned open research inputs (development only)."""
import json,sys,subprocess,hashlib,zipfile
from pathlib import Path
dest=Path(sys.argv[1]);dest.mkdir(parents=True,exist_ok=True)
def fetch(url,path):
    subprocess.run(['curl','--fail','--location','--retry','3','--output',str(path),url],check=True)
zipname='Muller_etal_2019_Tectonics_PlateMotionModel_v3.0.zip'
archive=dest/zipname
fetch('https://zenodo.org/api/records/11601026/files/'+zipname+'/content',archive)
assert hashlib.md5(archive.read_bytes()).hexdigest()=='5e9ee8f142c30041a6abc2b217103bad'
with zipfile.ZipFile(archive) as z:
    for entry in z.namelist():
        if entry.startswith(('SimplifiedFiles/','StaticGeometries/ContinentalPolygons/')):z.extract(entry,dest/'past')
index=dest/'future-index.json';fetch('https://data.mendeley.com/public-api/datasets/342zcbtvw9/files?folder_id=root&version=1',index)
(dest/'future').mkdir(exist_ok=True)
for f in json.loads(index.read_text()):
    n=f['filename']
    if n.endswith('.rot') or n in ['ReadMe.txt','Matthews_Cont_Lith_extents.gpml']:
        p=dest/'future'/Path(n).name;details=f['content_details'];fetch(details['download_url'],p)
        assert hashlib.sha256(p.read_bytes()).hexdigest()==details['sha256_hash']
