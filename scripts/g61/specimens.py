"""Build offline, single-specimen glTFs from original CC0 Poly Haven models."""
import concurrent.futures, hashlib, io, json, struct, subprocess, tempfile
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components

root=Path(__file__).resolve().parents[2]
out=root/'public/data/g61'
def fetch(url):
    return subprocess.check_output(['curl','-fsSL','--retry','3',url])
def checked(ref):
    data=fetch(ref['url'])
    assert hashlib.md5(data).hexdigest()==ref['md5']
    return data
def convert(spec):
    name,mesh_id,ratio=spec
    ref=json.loads(fetch('https://api.polyhaven.com/files/'+name))['gltf']['1k']['gltf']
    src=checked(ref);g=json.loads(src);refs=ref['include'];buf=checked(refs[g['buffers'][0]['uri']])
    urls={ref['url']:hashlib.sha256(src).hexdigest(),refs[g['buffers'][0]['uri']]['url']:hashlib.sha256(buf).hexdigest()}
    final={'asset':{'version':'2.0','copyright':'Poly Haven · CC0'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'mesh':0}],'meshes':[{'primitives':[]}],'materials':[],'buffers':[{}],'bufferViews':[],'accessors':[],'textures':[],'images':[]}
    data=bytearray()
    def add(raw):
        data.extend(bytes(-len(data)%4));start=len(data);data.extend(raw);l=final['bufferViews'];l.append(dict(buffer=0,byteOffset=start,byteLength=len(raw)));return len(l)-1
    def read(i):
        a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];dtype={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']]
        dims={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];offset=a.get('byteOffset',0)+v.get('byteOffset',0)
        return np.ndarray((a['count'],dims),dtype=dtype,buffer=buf,offset=offset,strides=(v.get('byteStride',dims*np.dtype(dtype).itemsize),np.dtype(dtype).itemsize)).copy()
    def accessor(array,kind):
        a=dict(bufferView=add(array.tobytes()),componentType=5123 if array.dtype=='uint16' else 5125 if array.dtype=='uint32' else 5126,count=len(array),type=kind)
        if kind=='VEC3':a.update(min=array.min(axis=0).tolist(),max=array.max(axis=0).tolist())
        final['accessors'].append(a);return len(final['accessors'])-1
    for prim in g['meshes'][mesh_id]['primitives']:
        att=prim['attributes'];pos=read(att['POSITION']);idx=read(prim['indices']).astype('uint32').ravel();m=g['materials'][prim['material']]
        base=m['pbrMetallicRoughness']['baseColorTexture'];uv=read(att['TEXCOORD_'+str(base.get('texCoord',0))]);tr=base.get('extensions',{}).get('KHR_texture_transform',{})
        uv=(uv*np.array(tr.get('scale',[1,1]))+np.array(tr.get('offset',[0,0]))).astype('<f4')
        if len(idx)>900000:
            tri=idx.reshape(-1,3);edges=coo_matrix((np.ones(len(idx),np.uint8),(tri.ravel(),tri[:,[1,2,0]].ravel())),shape=(len(pos),len(pos))).tocsr()
            size,label=connected_components(edges,directed=False)
            rng=np.random.default_rng(611);canopy=name=='tree_small_02'
            chosen=rng.random(size)<(.073 if canopy else .049)
            if size>200:
                idx=tri[chosen[label[tri[:,0]]]].ravel()
                counts=np.maximum(1,np.bincount(label));centres=np.stack([np.bincount(label,weights=pos[:,k])/counts for k in range(3)],axis=1)
                pos=(centres[label]+(pos-centres[label])*(3.0 if canopy else 2.9)).astype('<f4')
        with tempfile.TemporaryDirectory() as d:
            td=Path(d);pos.tofile(td/'pos');idx.tofile(td/'idx')
            subprocess.run(['node',str(root/'scripts/g61/reduce.mjs'),d,str(ratio)],check=True)
            reduced=np.fromfile(td/'result','<u4')
        vertices,remapped=np.unique(reduced,return_inverse=True)
        attributes=dict(POSITION=accessor(pos[vertices],'VEC3'),NORMAL=accessor(read(att['NORMAL'])[vertices],'VEC3'),TEXCOORD_0=accessor(uv[vertices],'VEC2'))
        material=dict(name=m['name'],doubleSided=True,pbrMetallicRoughness=dict(roughnessFactor=.90,metallicFactor=0))
        if m.get('alphaMode','OPAQUE')!='OPAQUE':material.update(alphaMode='MASK',alphaCutoff=.40)
        def image(slot,texture,limit):
            im=g['images'][g['textures'][texture['index']]['source']];r=refs[im['uri']];raw=checked(r);urls[r['url']]=hashlib.sha256(raw).hexdigest()
            img=Image.open(io.BytesIO(raw));img.thumbnail((limit,limit),Image.Resampling.LANCZOS);encoded=io.BytesIO()
            mime='image/png' if 'A' in img.getbands() else 'image/jpeg'
            img.save(encoded,format='PNG' if mime.endswith('png') else 'JPEG',quality=86,optimize=True)
            i=len(final['images']);final['images'].append(dict(bufferView=add(encoded.getvalue()),mimeType=mime));final['textures'].append(dict(source=i));return dict(index=i)
        material['pbrMetallicRoughness']['baseColorTexture']=image('color',base,512)
        if name=='rock_07':material['normalTexture']=image('normal',m['normalTexture'],512)
        final['meshes'][0]['primitives'].append(dict(attributes=attributes,indices=accessor(remapped.astype('uint16' if len(vertices)<65536 else 'uint32'),'SCALAR'),material=len(final['materials'])))
        final['materials'].append(material)
    data.extend(bytes(-len(data)%4));final['buffers'][0]['byteLength']=len(data)
    js=json.dumps(final,separators=(',',':')).encode();js+=b' '*(-len(js)%4)
    glb=struct.pack('<4sII',b'glTF',2,28+len(js)+len(data))+struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(data),b'BIN\0')+data
    file=out/(name+'.glb');file.write_bytes(glb)
    authors=json.loads(fetch('https://api.polyhaven.com/info/'+name)).get('authors',{})
    print(name,len(glb),flush=True)
    return dict(file=file.name,authors=authors,license='CC0-1.0',source='https://polyhaven.com/a/'+name,sourceFiles=urls,bytes=len(glb),sha256=hashlib.sha256(glb).hexdigest(),mesh=mesh_id,targetFraction=ratio)
if __name__=='__main__':
    specs=[('rock_07',0,.14),('shrub_02',1,.38),('tree_small_02',0,.10),('grass_medium_01',0,.40),('pine_tree_01',1,.16)]
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:rows=list(pool.map(convert,specs))
    (out/'specimens.json').write_text(json.dumps(rows,indent=2)+'\n')
