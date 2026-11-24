"""Coarse geographic surround for each local DEM, on the same tangent grid."""
from terrain import sites,grid,sample,out
from PIL import Image
import numpy as np,json
from concurrent.futures import ThreadPoolExecutor
def build(item):
    key,s=item;s=dict(s,width=s['width']*4)
    lon,lat=grid(s,145,109)
    zoom={'san':8,'japan':5,'himalaya':6,'hawaii':5,'rift':7,'island':7}[key];side=256*2**zoom
    dem,tiles=sample((lon+180)/360*side,(1-np.arcsinh(np.tan(np.deg2rad(lat)))/np.pi)/2*side,256,'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/'+str(zoom)+'/{x}/{y}.png',True)
    (out/(key+'-context.i16')).write_bytes(dem.tobytes())
    lon,lat=grid(s,576,432);rgb,images=sample((lon+180)/4.5*512,(90-lat)/4.5*512,512,'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/BlueMarble_ShadedRelief_Bathymetry/default/500m/6/{y}/{x}.jpeg',False)
    Image.fromarray(rgb).save(out/(key+'-context.webp'),quality=82)
    return { 'site':key,'grids':[145,109,576,432],'tiles':[u for x,y,u in tiles+images] }
with ThreadPoolExecutor(max_workers=2) as pool:rows=list(pool.map(build,sites.items()))
(out/'context-sources.json').write_text(json.dumps(rows,separators=(',',':')))
