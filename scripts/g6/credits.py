"""Build the offline list of reproducible inputs, output sizes and digests."""
import hashlib,json
from pathlib import Path
root=Path(__file__).resolve().parents[2]
assets=root/'public/data/g6'
rows=[]
for p in sorted(assets.glob('*.webp')):
    name=p.stem
    if name=='botany':source='Eigene CC0-Modelle · acht Pflanzengruppen · scripts/g6/botany.py'
    elif name.startswith('facies'):source='Poly Haven · CC0 · facies-source.json · Farbe bzw. Normalen-RG und Rauheit-B'
    elif name=='earth-day':source='NASA Blue Marble Next Generation · earth-source.json · heutiger Globus'
    elif name.endswith('-relief'):source='Mapzen/Terrarium · '+name.replace('-relief','-source.json')+' · Hangnormalen und Horizontverschattung'
    else:source='EOX Sentinel-2 Cloudless 2024 · CC BY-NC-SA 4.0 · '+name.replace('-surface','')+'-source.json · Landschaft'
    rows.append((p.name,p.stat().st_size,hashlib.sha256(p.read_bytes()).hexdigest(),source))
notice=(root/'docs/g6-quellen.md').read_text()
notice+='\n## Lokale Bilddateien\n\nDateiname | Byte | SHA-256 | Herkunft und Nutzung\n'
notice+='\n'.join(' | '.join(map(str,row)) for row in rows)+'\n'
(root/'public/licenses/G6-Bildquellen.txt').write_text(notice)
