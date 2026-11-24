"""Rotate broad illustrative study areas with the historical model. Not specimen locations."""
from pathlib import Path
import json,sys,pygplates as pg
rot=pg.RotationModel(next(Path(sys.argv[1]).rglob('*CombinedRotations.rot')))
areas=[('Paranábecken',201,-25,-51,'fossil'),('Karoo-Becken',701,-30,25,'fossil'),('Appalachen',101,46,-66,'rock'),('Schottische Highlands',301,57,-4.5,'rock'),('Südamerikanischer Kontinentalrand',201,-18,-38,'margin'),('Afrikanischer Kontinentalrand',701,-19,11,'margin'),('Indien',501,20,78,'india'),('Australien',801,-24,135,'australia')]
rows=[]
for name,pid,lat,lon,kind in areas:
    seq=[(rot.get_rotation(t,pid)*pg.PointOnSphere(lat,lon)).to_lat_lon() for t in range(0,251,5)]
    rows.append(dict(name=name,kind=kind,coords=[[round(a,3),round(b,3)] for a,b in seq]))
(Path(__file__).resolve().parents[2]/'public/data/g5/evidence.json').write_text(json.dumps(rows,ensure_ascii=False,separators=(',',':')))
