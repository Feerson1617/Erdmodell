"""Derive orientation rings from Natural Earth 1:50m Admin 0 (GDAL)."""
import json, subprocess, sys, tempfile
from pathlib import Path

source = sys.argv[1] if len(sys.argv)>1 else "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson"
with tempfile.TemporaryDirectory() as tmp:
    path=Path(tmp)/"countries.geojson"
    subprocess.run(["ogr2ogr","-simplify",".04","-select","NAME_DE,CONTINENT",str(path),source],check=True)
    rows=[]
    for feature in json.loads(path.read_text())["features"]:
        props=feature["properties"]
        geometry=feature["geometry"]
        polygons=geometry["coordinates"] if geometry["type"]=="MultiPolygon" else [geometry["coordinates"]]
        for polygon in polygons:
            ring=[[round(x,3),round(y,3)] for x,y,*_ in polygon[0]]
            if len(ring)<4:continue
            x,y=zip(*ring)
            holes=[[[round(x,3),round(y,3)] for x,y,*_ in hole] for hole in polygon[1:]]
            rows.append([props["NAME_DE"],props["CONTINENT"],[min(x),min(y),max(x),max(y)],ring,*holes])
target=Path(__file__).resolve().parents[2]/"src/observatory/land-extents.json"
target.write_text(json.dumps(rows,ensure_ascii=False,separators=(",",":"))+"\n")
