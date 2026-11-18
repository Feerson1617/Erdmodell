"""Offline authoring step, see docs/data-sources-and-licenses.md for input URLs."""
import argparse, io, json, math, zipfile, subprocess, tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter
import numpy as np

parser=argparse.ArgumentParser()
for key in ['wheel','land','osm','relief']: parser.add_argument('--'+key,required=True)
args=parser.parse_args()
out=Path('public/data')
out.mkdir(exist_ok=True, parents=True)
def save(name,obj): (out/name).write_text(json.dumps(obj,separators=(',',':')))
with zipfile.ZipFile(args.wheel) as z:
    im=Image.open(io.BytesIO(z.read('mpl_toolkits/basemap_data/bmng.jpg'))).convert('RGB')
    (out/'BASEMAP-LICENSE.txt').write_bytes(z.read('basemap_data-2.0.0.dist-info/licenses/LICENSE.mit'))
rgb=np.asarray(im.resize((4096,2048)),dtype=float)
v=rgb.max(axis=2); ocean=(rgb[:,:,2]>rgb[:,:,0]*1.24)&(rgb[:,:,2]>rgb[:,:,1]*1.13)
rgb[ocean]=rgb[ocean]*[.46,.79,.82]+[11,39,51]
rgb[~ocean]=rgb[~ocean]*[1.06,1.03,.91]+[9,13,10]
photo=Image.fromarray(np.uint8(rgb.clip(0,255)))
photo.save(out/'earth.webp',quality=91)
small=photo.resize((512,256));small.save(out/'earth-base.webp',quality=80)
soft=photo.resize((1536,768)).filter(ImageFilter.SMOOTH_MORE).quantize(colors=42,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE).convert('RGB')
soft=ImageEnhance.Color(soft).enhance(.79);soft.save(out/'earth-soft.webp',quality=88)
with tempfile.TemporaryDirectory() as tmp:
    tif=tmp+'/height.tif'
    subprocess.run(['gdal_translate','-q','-unscale','-ot','Float32','-outsize','721','361','-r','bilinear',args.relief,tif],check=True)
    np.rint(np.asarray(Image.open(tif))).astype('<i2').tofile(out/'relief.i16')
land=json.loads(Path(args.land).read_text())
mini=Image.new('RGB',(720,360),'#172e37'); draw=ImageDraw.Draw(mini)
bounds=[4,51,13,59]; region=Image.new('RGB',(1152,1024),'#356878'); rd=ImageDraw.Draw(region)
def regional(pt):return ((pt[0]-4)*128,(59-pt[1])*128)
for f in land['features']:
    g=f['geometry']
    for poly in (g['coordinates'] if g['type']=='MultiPolygon' else [g['coordinates']]):
        for i,ring in enumerate(poly):
            draw.polygon([((x+180)*2,(90-y)*2) for x,y in ring],fill='#527269' if i==0 else '#172e37')
            if any(2<x<15 and 49<y<61 for x,y in ring):
                rd.polygon([regional(p) for p in ring],fill='#89946e' if i==0 else '#356878')
mini.save(out/'locator.webp',lossless=True)
region.save(out/'region.webp',quality=94)
d=json.loads(Path(args.osm).read_text()); nodes={e['id']:[round(e['lon'],7),round(e['lat'],7)] for e in d['elements'] if e['type']=='node'}
ways=[(e.get('tags',{}),[nodes[i] for i in e['nodes']]) for e in d['elements'] if e['type']=='way' and 'tags' in e]
coast=next(p for t,p in ways if t.get('name')=='Hooge' and t.get('natural')=='coastline')
mounds=[{'name':e['tags']['name'],'point':nodes[e['id']]} for e in d['elements'] if e['type']=='node' and e.get('tags',{}).get('place') and 'warft' in e['tags'].get('name','').lower()]
buildings=[p[:-1] for t,p in ways if t.get('building') and p[0]==p[-1] and 8.508<np.mean(p,axis=0)[0]<8.574]
box=[8.48,54.54,8.604,54.60]
def xy(pt):return ((pt[0]-box[0])/(box[2]-box[0])*2048,(box[3]-pt[1])/(box[3]-box[1])*1664)
tex=Image.new('RGB',(2048,1664),'#477d87');dr=ImageDraw.Draw(tex)
for t,p in ways:
    if t.get('wetland')=='tidalflat' and p[0]==p[-1]:dr.polygon([xy(v) for v in p],fill='#74918b')
dr.polygon([xy(v) for v in coast],fill='#9cae78')
for t,p in ways:
    points=[xy(v) for v in p]
    if t.get('landuse') in ('meadow','residential','grass') and p[0]==p[-1]:dr.polygon(points,fill={'meadow':'#8ca472','residential':'#aaa884','grass':'#a4b77b'}[t['landuse']])
    if t.get('natural')=='water' and p[0]==p[-1]:dr.polygon(points,fill='#688e88')
    if t.get('waterway') in ('ditch','stream'):dr.line(points,fill='#739383',width=1 if t['waterway']=='ditch' else 2)
    if 'highway' in t:dr.line(points,fill='#c4bd9e',width=2 if t['highway'] in ['tertiary','service'] else 1)
tex.save(out/'hooge.webp',quality=94)
save('hooge.json',{'bounds':box,'coast':coast,'mounds':mounds,'buildings':buildings})
# Fall back to a separate simplified, georeferenced bitmap if detailed assets are missing.
print(len(buildings),'buildings,',len(mounds),'warften')

