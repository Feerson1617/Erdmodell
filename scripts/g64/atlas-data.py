"""Build the two 1-degree, north-up GMT grids and the NOAA volcano-location snapshot.

Run with Python 3, GDAL and NumPy. Output contains measured or published values only.
Volcano catalogue pagination is checked to prevent a partial offline archive.
"""
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
from pathlib import Path
from tempfile import TemporaryDirectory
from datetime import date
from urllib.request import urlopen
import json
from osgeo import gdal
import numpy as np

gdal.UseExceptions()
sources = {
    'age': dict(creator='Seton et al. (2020), EarthByte; GMT grid derivative',
                citation='https://doi.org/10.1029/2020GC009214', archive='https://doi.org/10.5281/zenodo.6782543',
                rights='CC BY 4.0', timeReference='GTS2012; model of present-day oceanic crustal age'),
    'magnetik': dict(creator='Meyer, Saltus & Chulliat (2017), NOAA NCEI; GMT grid derivative',
                citation='https://doi.org/10.7289/V5H70CVX', rights='Public NOAA data; attribution requested',
                reference='Sea level over oceans, EMAG2v3'),
    'volcanoes': dict(creator='NOAA NCEI/WDS, Volcano Locations Database',
                citation='https://doi.org/10.7289/V5JW8BSH', rights='Publicly available factual catalogue entries; attribute NOAA NCEI/WDS'),
}

out=Path(__file__).resolve().parents[2]/'public/data/g64'
out.mkdir(parents=True,exist_ok=True)
def fetch(url):
    with urlopen(url,timeout=45) as response:
        return response.read()

records={}
with TemporaryDirectory() as scratch:
    for key,collection in [('age','age'),('magnetik','mag')]:
        field='earth_'+collection
        url=f'https://oceania.generic-mapping-tools.org/server/earth/{field}/{field}_01d_g.grd'
        raw=fetch(url)
        path=Path(scratch)/(key+'.nc')
        path.write_bytes(raw)
        ds=gdal.Open('NETCDF:"'+str(path)+'":z')
        assert (ds.RasterXSize,ds.RasterYSize)==(361,181)
        assert np.allclose(ds.GetGeoTransform(),[-180.5,1,0,90.5,0,-1])
        band=ds.GetRasterBand(1)
        values=band.ReadAsArray()
        assert np.array_equal(values[:,0],values[:,-1])
        packed=values[:,:360].astype('<i2').tobytes()
        (out/(key+'.i16')).write_bytes(packed)
        records[key]=dict(url=url,sourceSHA256=sha256(raw).hexdigest(),sha256=sha256(packed).hexdigest(),
                          shape=[181,360],scale=band.GetScale(),offset=band.GetOffset(),nodata=band.GetNoDataValue(),
                          lon0=-180,lat0=90,spacing=1,registration='node',units='Ma' if key=='age' else 'nT')
root='https://www.ngdc.noaa.gov/hazel/hazard-service/api/v1/volcanolocs?itemsPerPage=100&page='
def page(number):
    raw=fetch(root+str(number))
    return json.loads(raw),sha256(raw).hexdigest()
first,h=page(1)
with ThreadPoolExecutor(max_workers=4) as pool:
    pages=[(first,h),*pool.map(page,range(2,first['totalPages']+1))]
rows=[row for payload,_ in pages for row in payload['items']]
assert len(rows)==first['totalItems']==len({r['id'] for r in rows})
features=[[r['id'],r['name'],r['latitude'],r['longitude'],r.get('morphology') or ''] for r in rows if r.get('latitude') is not None and r.get('longitude') is not None]
(out/'vulkane.json').write_text(json.dumps(features,ensure_ascii=False,separators=(',',':')))
records['volcanoes']=dict(sha256=sha256((out/'vulkane.json').read_bytes()).hexdigest(),url=root+'1',rows=len(features),total=len(rows),pages=[h for _,h in pages],
                         fields=['NOAA ID','name','latitude','longitude','morphology'],scope='NOAA NCEI volcano locations')
for key,info in sources.items():
    records[key].update(info)
(out/'quellen.json').write_text(json.dumps(dict(retrieved=str(date.today()),datasets=records),indent=2)+'\n')
