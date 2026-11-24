"""CC0 authored botanical silhouettes. Local seeded stems, needles and leaf sprays."""
from PIL import Image,ImageDraw
import random,math
from pathlib import Path
out=Path(__file__).resolve().parents[2]/'public/data/g6'
atlas=Image.new('RGBA',(1024,512))
for idx,name in enumerate(['grass','scrub','oak','conifer','moss','acacia','fern','reeds']):
    rng=random.Random(4041+idx);im=Image.new('RGBA',(384,384));d=ImageDraw.Draw(im)
    def leaf(x,y,rx,ry,color):
        d.ellipse((x-rx,y-ry,x+rx,y+ry),fill=color)
    def tone(base,k):return tuple(min(255,max(0,int(v*k))) for v in base)+(255,)
    if name in ['grass','reeds','fern']:
        for i in range(95 if name!='fern' else 32):
            x=192+rng.gauss(0,13);y=378;angle=rng.uniform(-1.31,1.31);length=rng.uniform(115,300)*(1-.24*abs(angle))
            if name=='reeds':angle*=.53
            base=(175,158,85) if name=='grass' else (89,126,65);col=tone(base,rng.uniform(.55,1.3))
            pts=[(x+math.sin(angle)*length*t*(.52+.48*t),y-length*(math.cos(angle*.62)*t-.27*abs(angle)*t*t)) for t in [j/10 for j in range(11)]]
            blade=rng.uniform(2,6);d.polygon([(a-blade*(1-j/10),b) for j,(a,b) in enumerate(pts)]+[(a+blade*(1-j/10),b) for j,(a,b) in reversed(list(enumerate(pts)))],fill=col)
            if name=='fern':
                for j,(a,b) in enumerate(pts[2:-1]):
                    for sign in [-1,1]:d.polygon([(a,b),(a+sign*(24-j*2),b-14),(a,b-4)],fill=col)
            if name=='reeds' and i%6==0:
                a,b=pts[-1];d.line((a,b+7,a+2,b-19),fill=(141,107,62,255),width=4)
    elif name=='moss':
        for i in range(1100):
            a=rng.random()*math.tau;t=rng.random()**.5;x=192+145*math.cos(a)*t;y=360-90*math.sin(math.pi*(1-t)/2)-rng.uniform(0,18)
            leaf(x,y,4,5,tone((117,130,81),rng.uniform(.58,1.22)))
    else:
        con=name=='conifer';ac=name=='acacia';oak=name=='oak'
        trunk=164 if ac else 120 if oak else 250 if con else 54
        d.polygon([(186,376),(190,375-trunk),(196,368-trunk),(199,376)],fill=(85,69,48,255))
        crowns=[]
        for j in range(34):
            if con:
                t=j/34;cx=192+rng.uniform(-1,1)*96*(1-t);cy=320-267*t
                bw=(64*(1-t)+7);bh=22
            else:
                a=rng.uniform(0,math.tau);r=rng.random()**.5
                cx=192+math.cos(a)*r*(128 if ac or oak else 118);cy=(148 if ac else 190 if oak else 270)+math.sin(a)*r*(33 if ac else 82 if oak else 49);bw=rng.uniform(22,41);bh=bw*(.6 if ac else .85)
            root=(192,374-trunk*(.28+rng.random()*.53));fork=(root[0]+(cx-root[0])*.47,root[1]+(cy-root[1])*.63)
            d.line([root,fork,(cx,cy)],fill=(88,74,51,255),width=3 if oak or ac else 2)
            crowns.append((cx,cy,bw,bh))
        for cx,cy,bw,bh in crowns:
            tint=rng.uniform(.74,1.17);base=(78,102,61) if oak else (59,98,77) if con else (120,123,68) if ac else (118,126,80)
            for k in range(96):
                a=rng.random()*math.tau;r=rng.random()**.5;x=cx+math.cos(a)*bw*r;y=cy+math.sin(a)*bh*r
                val=tint*(.91-.20*math.sin(a)*r+.12*rng.random())
                if con:d.polygon([(x-7,y+2),(x+8,y+4),(x+1,y-13)],fill=tone(base,val))
                else:leaf(x,y,rng.uniform(2,6),rng.uniform(2,5),tone(base,val))
    bbox=im.getbbox()
    im=im.crop((max(0,bbox[0]-2),max(0,bbox[1]-2),min(384,bbox[2]+2),384)).resize((248,248),Image.Resampling.LANCZOS)
    atlas.paste(im,((idx%4)*256+4,(idx//4)*256+4))
atlas.save(out/'botany.webp',quality=96,method=5)
