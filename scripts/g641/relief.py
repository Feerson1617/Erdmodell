"""Extract dimensionless relief detail for idealised landscapes from licensed project DEMs."""
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

root=Path(__file__).resolve().parents[2]
inputs={"mountain":"g5/terrain/himalaya","rift":"g5/terrain/rift","ocean":"g64/bathy-2308","arc":"g64/bathy-1510","shear":"g5/terrain/san","island":"g5/terrain/hawaii"}
result={}
for key,file in inputs.items():
    grid=np.fromfile(root/"public/data"/(file+".i16"),dtype="<i2").reshape(145,193).astype(float)
    scaled=(grid-grid.min())/(grid.max()-grid.min())
    im=Image.fromarray(np.uint8(255*scaled)).resize((65,49),Image.Resampling.LANCZOS)
    detail=np.asarray(im,dtype=float)-np.asarray(im.filter(ImageFilter.GaussianBlur(3)),dtype=float)
    result[key]=np.rint(np.clip(detail/(np.percentile(abs(detail),97) or 1),-1,1)*100).astype(int).ravel().tolist()
(root/"src/observatory/relief-samples.json").write_text(json.dumps(result,separators=(",",":"))+"\n")
