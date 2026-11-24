"""Pack the production entry and its local dependencies into one portable HTML."""
import base64
import json
import mimetypes
import posixpath
import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]
dist = root / "dist"
output = root / "artifacts/GeoRisiko-G5-Web-Test.html"
(js_file,) = (dist / "assets").glob("*.js")
(css_file,) = (dist / "assets").glob("*.css")
assets = {}

def uri(path):
    content = (dist / path).read_bytes()
    mime = mimetypes.guess_type(path)[0] or "application/octet-stream"
    return "data:" + mime + ";base64," + base64.b64encode(content).decode("ascii")

for folder in ("assets", "data", "licenses"):
    for f in sorted((dist / folder).rglob("*")):
        if f.is_file() and f not in (js_file, css_file):
            key = f.relative_to(dist).as_posix()
            assets[key] = uri(key)

def embed_module_url(match):
    key = posixpath.normpath("assets/" + match[1])
    assert key in assets, key
    return "window.__geoAsset(" + json.dumps(key) + ")"

def embed_css_url(match):
    key = posixpath.normpath("assets/" + match[1].strip("'\x22"))
    return "url(" + assets[key] + ")"

js = re.sub(r'new URL\("([^"]+)",import.meta.url\).href', embed_module_url, js_file.read_text())
assert 'import.meta.url' not in js, "Unresolved module asset"
css = re.sub(r'url\(([^)]+)\)', embed_css_url, css_file.read_text())
loader = """window.__geoAsset = path => {
  if (urls.has(path)) return urls.get(path);
  const encoded = embedded[path];
  if (!encoded) throw new Error("Eingebettete Datei fehlt: " + path);
  const comma = encoded.indexOf(",");
  const bytes = Uint8Array.from(atob(encoded.slice(comma+1)), c => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], {type:encoded.slice(5,encoded.indexOf(";"))}));
  urls.set(path,url);
  return url;
};"""
js = re.sub(r'</script', lambda _: r'<\/script', js, flags=re.I)
html = f"""<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>GeoRisiko 3D · Web-Test</title><link rel="icon" href="data:,"><style>{css}</style></head>
<body><div id="app"></div><noscript>Zum Drehen des Erdmodells bitte JavaScript einschalten.</noscript>
<script>const embedded={json.dumps(assets,separators=(',',':'))}, urls=new Map();{loader}</script>
<script type="module">{js}</script></body></html>
"""
output.parent.mkdir(exist_ok=True)
output.write_text(html, encoding="utf-8")
print(output.name, output.stat().st_size, "Bytes")
