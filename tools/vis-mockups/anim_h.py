from common import SCREENS, WORK
import math, random, subprocess, sys
from PIL import Image, ImageDraw, ImageFont
import anim as A
from anim import S, FPS, NF
from common import TC, WHITE, mix, dim
from scenic import PINK, CYAN, SUNA
import song
HZ=A.HZH; HH=118; GRIDC=(200,40,160); FLOOR=(8,0,18)
XS=[3.6+i*7.45 for i in range(32)]
def Yp(p): return HZ+(239-HZ)*max(0,p)**2.2
def Xk(k,y): return 120+k*(6+34*(y-HZ)/(239-HZ))
def sky_and_range(d):
    top=[(x,HZ-3-v*HH) for x,v in zip(XS,S.bar)]
    d.polygon([(0,HZ)]+top+[(239,HZ)],fill=(16,4,34))
    for k in range(1,6): d.line([(x,y+k*7) for x,y in top],fill=mix((16,4,34),(150,40,170),0.5-k*0.08))
    d.line(top,fill=dim(CYAN,.45),width=4); d.line(top,fill=CYAN,width=2); d.line(top,fill=(210,250,255))
    for x,c in zip(XS,S.cap): d.rectangle([x-2,HZ-3-c*HH-3,x+2,HZ-3-c*HH-2],fill=WHITE)
    return top
def grid(d,col=GRIDC,glow=None):
    for k in range(-12,13): d.line([120+k*6,HZ,120+k*40,239],fill=col)
    z=S.beat%1
    for i in range(10):
        p=(i+z)/10; y=Yp(p); c=col
        if glow: c=mix(col,(255,220,255),glow(p))
        d.line([0,y,239,y],fill=c)

def reflection():
    im=A.BG_H.copy(); d=ImageDraw.Draw(im); top=sky_and_range(d)
    d.rectangle([0,HZ,239,239],fill=FLOOR)
    for y in range(HZ+1,239):                         # the range, mirrored in the floor, rippling
        k=(y-HZ)/(239-HZ)
        for x,ty in top[::1]:
            pass
    ref=[(x+2*math.sin(S.t*3+(HZ-ty)*0.15),HZ+(HZ-ty)*0.55) for x,ty in top]
    d.polygon([(0,HZ)]+ref+[(239,HZ)],fill=(34,10,66))
    for j in range(1,9): d.line([(x+1.5*math.sin(S.t*4+j),y-(y-HZ)*j/9) for x,y in ref],fill=mix((34,10,66),CYAN,0.28))
    d.line(ref,fill=dim(CYAN,.85),width=2)
    grid(d,col=mix(FLOOR,GRIDC,0.55)); return im

KTIMES=[]
def kickwaves():
    if S.kick==255: KTIMES.append(S.t)
    im=A.BG_H.copy(); d=ImageDraw.Draw(im); sky_and_range(d)
    d.rectangle([0,HZ,239,239],fill=FLOOR)
    waves=[(S.t-tk)/0.45 for tk in KTIMES if 0<=(S.t-tk)/0.45<=1.05]
    def glow(p): return max([0]+[max(0,1-abs(p-w)*7)*(1-w*0.5) for w in waves])
    grid(d,glow=glow)
    for w in waves:                                   # the wave front
        y=Yp(w); d.line([0,y,239,y],fill=mix(GRIDC,(255,240,255),1-w*0.6),width=2+int(w*3))
    if S.kick>180: d.line([0,HZ,239,HZ],fill=(255,200,255),width=2)
    return im

TRAILS=[]   # (start beat, lane, colour)
def lighttrails():
    for tr,m in S.notes:
        if tr in (3,7): continue
        TRAILS.append((S.beat,(m%12)-6,TC[tr]))
    im=A.BG_H.copy(); d=ImageDraw.Draw(im); sky_and_range(d)
    d.rectangle([0,HZ,239,239],fill=FLOOR); grid(d)
    keep=[]
    for b0,lane,c in TRAILS:
        s=(S.beat-b0)/1.5 if S.playing else (S.beat-b0)/1.5+ (S.t-song.PLAY)
        if s>1.25: continue
        keep.append((b0,lane,c))
        for q in range(20):                           # the streak: a bright head, a fading tail
            p0=s-q*0.02; p1=p0-0.02
            if p1<0 or p0>1.05: continue
            y0,y1=Yp(p0),Yp(p1); x0,x1=Xk(lane+0.5,y0),Xk(lane+0.5,y1)
            w=2+4*min(p0,1)
            d.line([(x1,y1),(x0,y0)],fill=mix(c,WHITE,0.6) if q==0 else dim(c,1-q/20),width=int(w))
    TRAILS[:]=keep; return im

TILES=[]    # (beat made, row, col, colour)
LASTB=[-1]
def dancefloor():
    b=int(S.beat)
    if S.playing and b!=LASTB[0]:
        LASTB[0]=b; r=random.Random(b)
        cols=[TC[t] for t in range(8) if S.tlv[t]>0.3] or [PINK]
        for _ in range(7): TILES.append((S.beat,r.randint(3,7),r.randint(-6,5),r.choice(cols)))
    im=A.BG_H.copy(); d=ImageDraw.Draw(im); sky_and_range(d)
    d.rectangle([0,HZ,239,239],fill=FLOOR)
    keep=[]
    for b0,row,col,c in TILES:
        age=S.beat-b0
        if age>2.5: continue
        keep.append((b0,row,col,c))
        p0=(row+age+(b0%1))/10; p1=p0+0.1
        if p0>1: continue
        y0,y1=Yp(p0),Yp(min(p1,1.0))
        quad=[(Xk(col,y0),y0),(Xk(col+1,y0),y0),(Xk(col+1,y1),y1),(Xk(col,y1),y1)]
        d.polygon(quad,fill=mix(FLOOR,c,max(0,1-age/2.5)))
    TILES[:]=keep; grid(d); return im

VARS=[("REFLECTION","the range mirrored in a glossy floor",reflection),("KICK WAVES","each kick rolls a wave across the grid",kickwaves),
      ("LIGHT TRAILS","each note shoots down a lane in its colour",lighttrails),("DANCE FLOOR","tiles light up on the beat in the tracks' colours",dancefloor)]
FT=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",20)
FS=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",15)
GW,GH=2*480+3*8,2*(480+52)+8
out=sys.argv[1]
p=subprocess.Popen(["ffmpeg","-y","-loglevel","error","-f","rawvideo","-pix_fmt","rgb24","-s",f"{GW}x{GH}","-r",str(FPS),"-i","-",
    "-i",WORK+"song.wav","-c:v","libx264","-pix_fmt","yuv420p","-crf","26","-c:a","aac","-b:a","128k","-shortest",out],stdin=subprocess.PIPE)
for i in range(NF):
    A.analyse(i)
    g=Image.new("RGB",(GW,GH),(28,28,32)); gd=ImageDraw.Draw(g)
    for j,(name,line,fn) in enumerate(VARS):
        fr=fn(); x=8+(j%2)*488; y=8+(j//2)*532
        if i==int(11.2*FPS): fr.save(WORK+f"h-{j}.png")
        g.paste(fr.resize((480,480),Image.NEAREST),(x,y))
        gd.text((x,y+484),f"{chr(65+j)}  {name}",font=FT,fill=(236,236,240)); gd.text((x+250,y+489),line,font=FS,fill=(150,150,158)) if False else gd.text((x,y+508),line,font=FS,fill=(150,150,158))
    p.stdin.write(g.tobytes())
p.stdin.close(); p.wait(); print("done")
