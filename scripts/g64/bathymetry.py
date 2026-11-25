"""Sample two PB2002 reference frames from SRTM15+ v2.7, GMT pixel-registered tiles.
Requires GDAL with JPEG2000 support, NumPy and Pillow. No run-time downloads.
"""
from pathlib import Path
from urllib.request import urlopen
from hashlib import sha256
from tempfile import TemporaryDirectory
import json
import numpy as np
from PIL import Image
from osgeo import gdal

root=Path(__file__).resolve().parents[2]
out=root/'public/data/g64'
steps=json.loads((root/'src/tectonics/steps.json').read_text())
fields=json.loads((root/'src/observatory/pb-fields.json').read_text())
results={}
with TemporaryDirectory() as work:
    for sid, width in [(1510,240),(2308,130)]:
        st=steps[sid-1];lon0=(st[3]+st[5])/2;lat0=(st[4]+st[6])/2
        strike=float(fields[sid-1][0]);angle=np.radians(strike)
        u,v=np.meshgrid(np.linspace(-.5,.5,193),np.linspace(-.375,.375,145))
        east=width*(u*np.cos(angle)-v*np.sin(angle));north=width*(-u*np.sin(angle)-v*np.cos(angle))
        distance=np.hypot(east,north)/6371; bearing=np.arctan2(east,north);phi=np.radians(lat0)
        lat=np.arcsin(np.sin(phi)*np.cos(distance)+np.cos(phi)*np.sin(distance)*np.cos(bearing))
        lon=lon0+np.degrees(np.arctan2(np.sin(bearing)*np.sin(distance)*np.cos(phi),np.cos(distance)-np.sin(phi)*np.sin(lat)))
        lat=np.degrees(lat);lon=(lon+180)%360-180
        height=np.zeros(lat.shape);source=[]
        for by,bx in sorted({(int(a//10)*10,int(b//10)*10) for a,b in zip(lat.ravel(),lon.ravel())}):
            name=f"{'N' if by>=0 else 'S'}{abs(by):02}{'E' if bx>=0 else 'W'}{abs(bx):03}.earth_relief_15s_p.jp2"
            url='https://oceania.generic-mapping-tools.org/server/earth/earth_relief/earth_relief_15s_p/'+name
            dest=Path(work)/name
            if not dest.exists():
                with urlopen(url,timeout=60) as res: dest.write_bytes(res.read())
            ds=gdal.Open(str(dest));band=ds.GetRasterBand(1);raw=band.ReadAsArray()
            assert raw.shape==(2400,2400)
            mask=(lat>=by)&(lat<by+10)&(lon>=bx)&(lon<bx+10)
            x=np.clip((lon[mask]-bx)*240-.5,0,2399); y=np.clip((by+10-lat[mask])*240-.5,0,2399)
            i=x.astype(int);j=y.astype(int);fx=x-i;fy=y-j;i1=np.minimum(i+1,2399);j1=np.minimum(j+1,2399)
            # GMT catalogue declares 0.5 m per packed integer. JP2 tiles hold packed elevations.
            height[mask]=.5*((1-fx)*(1-fy)*raw[j,i]+fx*(1-fy)*raw[j,i1]+(1-fx)*fy*raw[j1,i]+fx*fy*raw[j1,i1])
            source.append({'url':url,'sha256':sha256(dest.read_bytes()).hexdigest()})
        payload=np.rint(height).astype('<i2').tobytes();(out/f'bathy-{sid}.i16').write_bytes(payload)
        dy,dx=np.gradient(height);shade=np.clip(.88+(.66*dx-.4*dy)/300,.53,1.24)
        colors=np.array([[22,39,68],[38,68,91],[68,103,113],[99,134,135],[159,171,147]])
        rgb=np.stack([np.interp(height,[-10500,-6500,-3500,-1000,100],colors[:,i]) for i in range(3)],axis=-1)
        Image.fromarray(np.clip(rgb*shade[:,:,None],0,255).astype('uint8')).save(out/f'bathy-{sid}.webp',quality=94)
        results[str(sid)]=dict(widthKm=width,center=[lat0,lon0],strike=strike,grid=[193,145],rangeMetres=[round(height.min()),round(height.max())],sha256=sha256(payload).hexdigest(),sources=source)
        print(sid,results[str(sid)]['rangeMetres'],flush=True)
(out/'bathymetrie.json').write_text(json.dumps({'source':'SRTM15+ v2.7; Tozer et al. (2019), doi:10.1029/2019EA000658. GMT earth_relief_15s_p, 2025-05-01. CC BY 4.0.', 'regions':results},indent=2)+'\n')
