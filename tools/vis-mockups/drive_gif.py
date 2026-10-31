from common import SCREENS, WORK
import math, random
from PIL import Image, ImageDraw
from common import TC, mix, dim, WHITE
from scenic import sky, sun, PINK, CYAN, SUNA
from car import car
HZ=120
def city_pts():
    random.seed(1); return [random.random() for _ in range(30)]
CITY=city_pts()
STARS=[(random.randint(0,239),random.randint(0,80),random.randint(120,230)) for _ in range(40)]
WIN=[[random.random()<.4 for _ in range(20)] for _ in range(30)]
def frame(ph, kick):
    im=Image.new("RGB",(240,240)); d=ImageDraw.Draw(im)
    sky(d,(5,0,25),(70,10,70),HZ)
    for x,y,c in STARS: d.point((x,y),fill=(c,c,c))
    sun(d,120,104,40,clip=HZ)
    x=0
    for i,v in enumerate(CITY):     # the skyline is the spectrum: it moves with the music
        v=max(.05,min(1,v*(0.7+0.5*abs(math.sin(ph*math.pi*2+i)))))
        h=8+v*50; d.rectangle([x,HZ-h,x+7,HZ],fill=(15,5,30))
        for k,wy in enumerate(range(int(HZ-h)+3,HZ-2,5)):
            if WIN[i][k%20]: d.point((x+3,wy),fill=CYAN if (i+k)%2 else PINK)
        x+=8
    d.rectangle([0,HZ,239,239],fill=(10,0,20))
    d.polygon([(110,HZ),(130,HZ),(239,239),(0,239)],fill=(25,15,40))
    d.line([110,HZ,0,239],fill=PINK,width=2); d.line([130,HZ,239,239],fill=PINK,width=2)
    def Y(s): return HZ+(239-HZ)*s**2.2
    N=6
    for i in range(-1,N):            # lane stripes: one slot a beat, rushing towards you
        s0=(i+ph%1)/N; s1=s0+0.5/N
        if s1<=0 or s0>=1: continue
        s0=max(s0,0); s1=min(s1,1)
        y0,y1=Y(s0),Y(s1); w0,w1=1+s0*4,1+s1*4
        d.polygon([(120-w0,y0),(120+w0,y0),(120+w1,y1),(120-w1,y1)],fill=SUNA)
    for i in range(-1,4):            # roadside posts, half as many: they sweep past
        s=(i+ph%1)/4
        if not 0<s<1: continue
        y=Y(s); sp=10+s*130; h=3+s*28
        for side in (-1,1):
            x=120+side*sp; d.line([x,y,x,y-h],fill=(90,40,110),width=max(1,int(s*3))); d.ellipse([x-1-s*2,y-h-1-s*2,x+1+s*2,y-h+1+s*2],fill=CYAN)
    car(d,120,226,kick)
    return im
frames=[]; F=12
for b in range(2):
    for k in range(F):
        frames.append(frame(b+k/F, kick=k<3).resize((480,480),Image.NEAREST))
frames[0].save(SCREENS+"night-drive-motion.gif",save_all=True,append_images=frames[1:],duration=42,loop=0,optimize=True)
print(len(frames))
