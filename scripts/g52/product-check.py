"""Compare the renderer and local assets in the delivered App-ZIP with its offline HTML."""
import base64
import hashlib
import json
import posixpath
import re
import struct
import sys
from pathlib import Path
from zipfile import ZipFile

app_zip, html_path, output = map(Path,sys.argv[1:])
html=html_path.read_text()
embedded=json.loads(re.search(r'<script>const embedded=(.+?), urls=new Map\(\);',html).group(1))
with ZipFile(app_zip) as z:
    package=z.read("GeoRisiko.app/Contents/Resources/app.asar")
header_size=struct.unpack_from("<I",package,4)[0]
json_size=struct.unpack_from("<I",package,12)[0]
header=json.loads(package[16:16+json_size])
dist=header["files"]["dist"]["files"]
def contents(items,prefix=""):
    for name,entry in items.items():
        path=prefix+name
        if "files" in entry:
            yield from contents(entry["files"],path+"/")
        else:
            start=8+header_size+int(entry["offset"])
            yield path,package[start:start+entry["size"]]
files=dict(contents(dist))
js,=[key for key in files if key.startswith("assets/") and key.endswith(".js")]
css,=[key for key in files if key.startswith("assets/") and key.endswith(".css")]
resources={key:value for key,value in files.items() if key.startswith(("assets/","data/","licenses/")) and key not in (js,css)}
assert set(embedded)==set(resources)
hashes={}
for key,raw in resources.items():
    assert base64.b64decode(embedded[key].split(",",1)[1],validate=True)==raw,key
    hashes[key]=hashlib.sha256(raw).hexdigest()
def asset(path):
    return posixpath.normpath("assets/"+path)
module=re.sub(r'new URL\("([^"]+)",import.meta.url\).href',lambda m:"window.__geoAsset("+json.dumps(asset(m[1]))+")",files[js].decode())
module=re.sub(r'</script',lambda _:r'<\/script',module,flags=re.I)
style=re.sub(r'url\(([^)]+)\)',lambda m:"url("+embedded[asset(m[1].strip("'\""))]+")",files[css].decode())
assert re.search(r'<script type="module">(.*)</script></body>',html,re.S).group(1)==module
assert re.search(r'<style>(.*?)</style></head>',html,re.S).group(1)==style
output.parent.mkdir(parents=True,exist_ok=True)
output.write_text(json.dumps({"resources":len(resources),"module":js,"stylesheet":css,"sha256":hashes},indent=2)+"\n")
print(len(resources),"bytegleiche Ressourcen, identischer Renderer und identisches Stylesheet nach Offline-Einbettung")
