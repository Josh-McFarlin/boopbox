from common import SCREENS, WORK
import math, random, subprocess, sys, collections
import numpy as np
from PIL import Image, ImageDraw
from common import TC, WHITE, mix, dim, F, new
from scenic import sky, stars, sun, grid, PINK, CYAN, SUNA, SUNB
from car import car
import song, iso
SR, FPS = song.SR, 30
NF = int(song.LEN * FPS)
EDGE=[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,21,25,29,35,41,49,58,69,82,98,116,138,164,195,232]
HANN=0.5-0.5*np.cos(2*np.pi*np.arange(512)/512)
FLOOR=(8,0,18)

# ---------- the analysis, as ui_vis.c does it ----------
class State: pass
S=State()
S.scale=0.05; S.bar=np.zeros(32); S.cap=np.zeros(32); S.capv=np.zeros(32)
S.vu=np.zeros(9); S.pk=np.zeros(9); S.pkt=np.zeros(9); S.tlv=np.zeros(8)
S.kick=0; S.drive=0.0; S.speed=1.0
def lvl(a): return 0.0 if a<1e-6 else float(np.clip((20*np.log10(a)+48)/48,0,1))
def analyse(i):
    t=i/FPS; n=int(t*SR); p=int(max(0,i-1)/FPS*SR)
    w=song.MIX[max(0,n-512):n]; w=np.pad(w,(512-len(w),0))
    S.t=t; S.playing=t<song.PLAY; S.wave=w
    i0=0
    for k in range(1,512-240):
        if w[k-1]<0<=w[k]: i0=k; break
    S.i0=i0
    mpk=float(np.abs(w).max()); S.scale+=(max(mpk,0.05)-S.scale)/5
    X=np.abs(np.fft.rfft(w*HANN))/512
    for k in range(32):
        m=X[EDGE[k]:EDGE[k+1]].max(); v=0.0 if m<1e-7 else float(np.clip((20*np.log10(m/0.25)+60)/60,0,1))
        b=S.bar[k]*0.82; S.bar[k]=max(v,b)
        if S.bar[k]>=S.cap[k]: S.cap[k]=S.bar[k]; S.capv[k]=0
        else: S.capv[k]+=0.004; S.cap[k]=max(0,S.cap[k]-S.capv[k])
    for k in range(8): S.tlv[k]=lvl(float(np.abs(song.TR[k,p:max(n,p+1)]).max()))
    S.mlv=lvl(mpk)
    for k in range(9):
        v=S.tlv[k] if k<8 else S.mlv
        S.vu[k]=max(v,S.vu[k]-0.03)
        if v>=S.pk[k]: S.pk[k]=v; S.pkt[k]=0
        else:
            S.pkt[k]+=1
            if S.pkt[k]>30: S.pk[k]=max(0,S.pk[k]-0.02)
    t0=max(0,i-1)/FPS
    S.notes=[(tr,m) for (tt,tr,m) in song.NOTES if t0<tt<=t] if i else []
    if any(t0<k<=t for k in song.KICKS) and i: S.kick=255
    else: S.kick=max(0,S.kick-20)
    S.speed = 1.0 if S.playing else S.speed*0.94           # stopped: the car slows down and parks
    S.drive += S.speed*(song.BPM/60)/FPS
    S.beat = t*song.BPM/60 if S.playing else S.beat

# ---------- the six styles ----------
def bg_palms():
    random.seed(20); im,d=new(); hz=126
    sky(d,(40,0,60),(255,110,80),hz); sun(d,120,112,48,(255,240,140),(255,80,90),clip=hz)
    for y in range(hz,240): d.line([0,y,239,y],fill=mix((60,20,90),(10,0,30),(y-hz)/114))
    return im
def palms_overlay():
    im=Image.new("RGBA",(240,240),(0,0,0,0)); d=ImageDraw.Draw(im)
    for bx,lean in ((22,0.32),(218,-0.3)):
        top=(bx+lean*96,46); d.line([(bx,239),((bx+top[0])/2+4*lean*10,150),top],fill=(10,0,15,255),width=6)
        for a in range(-150,30,30):
            rr=math.radians(a); ex,ey=top[0]+math.cos(rr)*38,top[1]+math.sin(rr)*21+10
            d.line([top,((top[0]+ex)/2,(top[1]+ey)/2-8),(ex,ey)],fill=(10,0,15,255),width=4)
    return im
BG_P=bg_palms(); OV_P=palms_overlay()
def palms():
    im=BG_P.copy(); d=ImageDraw.Draw(im); hz=126; t=S.t
    for i in range(10):
        y=hz+3+i*i*0.5; w=44-i*3.2; xo=S.mlv*6*math.sin(t*9+i*1.7)
        d.line([120-w+xo,y,120+w+xo,y],fill=mix((255,220,120),(255,80,110),i/10),width=2)
    for r in range(3):
        d.line([(x,hz+14+r*10+2*math.sin(x/11+r+t*1.5)) for x in range(0,240,3)],fill=mix((70,40,130),(40,30,100),r/3))
    w=S.wave[S.i0:S.i0+240]; pts=[(i,int(np.clip(190-v/S.scale*40,140,236))) for i,v in enumerate(w)]
    d.polygon(pts+[(239,239),(0,239)],fill=(20,4,44))
    for k in range(1,5): d.line([(x,y+k*8) for x,y in pts],fill=dim(CYAN,.42-k*.08))
    d.line(pts,fill=CYAN,width=2); d.line([(x,y-1) for x,y in pts],fill=(220,250,255))
    im.paste(OV_P,(0,0),OV_P); return im

HZD=120
random.seed(1); CITYW=[[random.random()<.4 for _ in range(20)] for _ in range(30)]
random.seed(2); STD=[(random.randint(0,239),random.randint(0,80),random.randint(120,230)) for _ in range(40)]
def bg_drive():
    im,d=new(); sky(d,(5,0,25),(70,10,70),HZD)
    for x,y,c in STD: d.point((x,y),fill=(c,c,c))
    sun(d,120,104,40,clip=HZD); return im
BG_D=bg_drive()
def drive():
    im=BG_D.copy(); d=ImageDraw.Draw(im)
    for i in range(30):                                   # the skyline: the spectrum, a building a band
        k=i*32//30; h=6+S.bar[k]*62; x=i*8; ch=6+S.cap[k]*62
        d.rectangle([x,HZD-h,x+7,HZD],fill=(15,5,30))
        for j,wy in enumerate(range(int(HZD-h)+3,HZD-2,5)):
            if CITYW[i][j%20]: d.point((x+3,wy),fill=CYAN if (i+j)%2 else PINK)
        d.rectangle([x+2,HZD-ch-2,x+5,HZD-ch-1],fill=(255,90,160))
    d.rectangle([0,HZD,239,239],fill=(10,0,20))
    d.polygon([(110,HZD),(130,HZD),(239,239),(0,239)],fill=(25,15,40))
    d.line([110,HZD,0,239],fill=PINK,width=2); d.line([130,HZD,239,239],fill=PINK,width=2)
    def Y(s): return HZD+(239-HZD)*s**2.2
    ph=S.drive
    for i in range(-1,6):
        s0=(i+ph%1)/6; s1=s0+0.5/6
        if s1<=0 or s0>=1: continue
        s0=max(s0,0); s1=min(s1,1); y0,y1=Y(s0),Y(s1); w0,w1=1+s0*4,1+s1*4
        d.polygon([(120-w0,y0),(120+w0,y0),(120+w1,y1),(120-w1,y1)],fill=SUNA)
    for i in range(-1,4):
        s=(i+(ph/2)%1)/4
        if not 0<s<1: continue
        y=Y(s); sp=10+s*130; h=3+s*28
        for side in (-1,1):
            x=120+side*sp; d.line([x,y,x,y-h],fill=(90,40,110),width=max(1,int(s*3))); d.ellipse([x-1-s*2,y-h-1-s*2,x+1+s*2,y-h+1+s*2],fill=CYAN)
    car(d,120,226,S.kick>100); return im

HZH=150
def bg_horizon():
    random.seed(10); im,d=new(); hz=HZH
    for y in range(hz): d.line([0,y,239,y],fill=mix((6,0,22),(70,14,80),(y/hz)**1.5))
    for i in range(60): d.point((random.randint(0,239),random.randint(0,110)),fill=(random.randint(120,230),)*3)
    for k in range(10): d.line([0,hz-k,239,hz-k],fill=mix((70,14,80),(255,70,170),0.5*(1-k/10)))   # the haze on the horizon
    return im
BG_H=bg_horizon()
def horizon():
    im=BG_H.copy(); d=ImageDraw.Draw(im); hz=HZH; Hh=118
    xs=[3.6+i*7.45 for i in range(32)]
    top=[(x,hz-3-v*Hh) for x,v in zip(xs,S.bar)]
    d.polygon([(0,hz)]+top+[(239,hz)],fill=(16,4,34))
    for k in range(1,6): d.line([(x,y+k*7) for x,y in top],fill=mix((16,4,34),(150,40,170),0.5-k*0.08))   # contour lines inside the range
    d.line(top,fill=dim(CYAN,.45),width=4); d.line(top,fill=CYAN,width=2); d.line(top,fill=(210,250,255))
    for x,c in zip(xs,S.cap): d.rectangle([x-2,hz-3-c*Hh-3,x+2,hz-3-c*Hh-2],fill=WHITE)
    d.rectangle([0,hz,239,239],fill=FLOOR)
    b=int(S.beat)                                     # the dance floor: on each beat, tiles light up in the colours
    if S.playing and b!=H_LASTB[0]:                   # of the tracks playing, then ride the grid towards you and fade
        H_LASTB[0]=b; r=random.Random(b)
        cols=[TC[t] for t in range(8) if S.tlv[t]>0.3] or [PINK]
        for _ in range(7): H_TILES.append((S.beat,r.randint(3,7),r.randint(-6,5),r.choice(cols)))
    def Yp(p): return hz+(239-hz)*max(0,p)**2.2
    def Xk(k,y): return 120+k*(6+34*(y-hz)/(239-hz))
    keep=[]
    for b0,row,col,c in H_TILES:
        age=S.beat-b0
        if age>2.5: continue
        keep.append((b0,row,col,c))
        p0=(row+age+(b0%1))/10; p1=p0+0.1
        if p0>1: continue
        y0,y1=Yp(p0),Yp(min(p1,1.0))
        d.polygon([(Xk(col,y0),y0),(Xk(col+1,y0),y0),(Xk(col+1,y1),y1),(Xk(col,y1),y1)],fill=mix(FLOOR,c,max(0,1-age/2.5)))
    H_TILES[:]=keep
    for k in range(-12,13): d.line([120+k*6,hz,120+k*40,239],fill=(200,40,160))
    z=S.beat%1
    for i in range(10):
        y=hz+(239-hz)*((i+z)/10)**2.2; d.line([0,y,239,y],fill=(200,40,160))
    return im
H_TILES=[]; H_LASTB=[-1]

HZF=70
def bg_fly():
    random.seed(21); im,d=new(); hz=HZF
    for y in range(hz): d.line([0,y,239,y],fill=mix((0,0,10),(30,0,50),y/hz))
    for i in range(70): d.point((random.randint(0,239),random.randint(0,hz-6)),fill=(random.randint(110,230),)*3)
    for k in range(8): d.line([0,hz-k,239,hz-k],fill=mix((30,0,50),(60,180,255),0.35*(1-k/8)))
    d.rectangle([0,hz,239,239],fill=(4,0,12)); return im
BG_F=bg_fly(); HIST=collections.deque(maxlen=16)
def hcol(v): return mix(CYAN,PINK,v*2) if v<0.5 else mix(PINK,SUNA,(v-0.5)*2)
def flyover(i):
    if i%2==0: HIST.appendleft(S.bar.copy())
    im=BG_F.copy(); d=ImageDraw.Draw(im); hz=HZF; rows=14; frac=(i%2)/2; NC=49+2*16
    P=[]; V=[]
    for a in range(min(len(HIST),rows+1)-1,-1,-1):        # oldest (back) first
        z=1-(a+frac)/rows
        if z<=0.04: continue
        y=hz+6+(236-hz)*z**1.6; sp=HIST[a]; row=[]; vals=[]
        for c in range(NC):                                 # the spectrum in the middle, flat ground out past both edges
            u=(c-(NC-1)/2)/24; v=sp[min(31,int(abs(u)*32))] if abs(u)<=1 else 0.0
            row.append((120+u*(76+z*64), y-v**1.2*(6+64*z))); vals.append(v)
        P.append((z,row)); V.append(vals)
    for r,(z,row) in enumerate(P):
        d.polygon(row+[(row[-1][0],240),(row[0][0],240)],fill=(4,0,12))
        fade=0.25+0.75*z
        if r:
            pz,prow=P[r-1]
            for c in range(NC): d.line([prow[c],row[c]],fill=dim(hcol(V[r][c]),fade*0.6))
        for c in range(NC-1): d.line([row[c],row[c+1]],fill=dim(hcol((V[r][c]+V[r][c+1])/2),fade),width=2 if r==len(P)-1 else 1)
    return im

def densecity():
    iso.NOSUN=True; iso.SWEEP=S.drive; iso.LV=list(S.vu[:8]); iso.PK=list(S.pk[:8]); iso.MLV=S.vu[8]; iso.MPK=S.pk[8]
    random.seed(0); return iso.densecity2()

# KEY CITY: 14 white-key towers and 10 black-key towers, two octaves from C3; a note outside lands in them
WHITE_PC=[0,2,4,5,7,9,11]; BLACK_AFTER={1:0,3:1,6:3,8:4,10:5}
KEYS=[0.0]*24; KEYC=[TC[0]]*24; DRUMI=[0.0,0.0]
random.seed(64); KWIN=[[random.random()<.7 for _ in range(60)] for _ in range(24)]
def bg_key():
    random.seed(64); im,d=new(); hz=200
    sky(d,(4,0,18),(60,10,70),hz); stars(d,70,hz-60)
    d.rectangle([0,hz,239,239],fill=(6,0,16)); grid(d,hz,(110,20,110),n=4,fan=30); return im
BG_K=bg_key(); BEAMS=[]; LAST_BEAMS=[]
def keycity():
    for tr,m in S.notes:
        if tr in (3,7): DRUMI[0 if tr==3 else 1]=1.0; continue
        k=(m-48)%24; KEYS[k]=1.0; KEYC[k]=TC[tr]
    im=BG_K.copy(); d=ImageDraw.Draw(im); hz=200; n=14; w=240/n
    BEAMS.clear()
    for k,(x,wd,h,c,it) in enumerate(LAST_BEAMS):            # the beams of last frame's lit towers, under the towers
        top=hz-h; cx=x+wd/2
        for y in range(int(top)-1,-1,-2):
            k=(top-y)/top; hw=wd*0.22+1+k*5
            d.line([cx-hw,y,cx+hw,y],fill=mix((14,2,32),c,0.55*it*(1-k)**1.5)); d.line([cx-hw,y+1,cx+hw,y+1],fill=mix((14,2,32),c,0.55*it*(1-k)**1.5))
            d.line([cx-1,y,cx+1,y],fill=mix((14,2,32),mix(c,WHITE,.5),0.8*it*(1-k)**1.2))
        for y in range(hz+2,239,3): d.line([x+2,y,x+wd-2,y],fill=mix((6,0,16),c,0.4*it*(1-(y-hz)/40)))
    VX,VY,DF=120,96,0.24                              # one-point perspective: side walls and roofs run to (VX, VY)
    def draw(x,wd,h,k,black):
        df=0.09 if black else 0.2
        def back(px,py): return (px+(VX-px)*df, py+(VY-py)*df)
        it=KEYS[k]; c=KEYC[k]; x1=x+wd; top=hz-h
        lit=it>0.02
        if lit: BEAMS.append((x,wd,h,c,it))
        front=dim(c,.45+.45*it) if lit else ((8,0,20) if black else (22,6,44))
        side=dim(front,.6) if lit else ((16,4,34) if black else (32,10,58)); roof=mix(front,WHITE,.25) if lit else ((30,10,54) if black else (52,20,86))
        edge=mix(c,WHITE,.4*it) if lit else ((50,14,70) if black else (70,24,100))
        if not black:                                   # white keys: the wall that faces the middle, and the roof below eye level
            sx=x1 if (x+x1)/2<VX else x
            sb,st=back(sx,hz),back(sx,top)
            d.polygon([(sx,hz),(sx,top),st,sb],fill=side,outline=dim(edge,.6))
            for wy in range(int(top)+6,hz-4,7):
                px=sx+(VX-sx)*df*0.5; py=wy+(VY-wy)*df*0.5
                d.point((px,py),fill=mix(c,WHITE,.3*it) if lit else (50,20,80))
            if top>VY:
                d.polygon([(x,top),(x1,top),back(x1,top),back(x,top)],fill=roof,outline=edge)
        d.rectangle([x,top,x1,hz],fill=front,outline=edge)
        if black:                                       # black keys sit in the gaps: a flat front, a lit cap
            d.line([x,top,x1,top],fill=roof); d.line([x1,top+1,x1,hz],fill=side)
        if lit:
            for wy in range(int(top)+6,hz-4,7):
                for wx in (x+3,x1-3): d.point((wx,wy),fill=mix(c,WHITE,.5*it))
            if it>0.6: d.rectangle([x,top-2,x1,top],fill=WHITE)
        elif not black:
            for j,wy in enumerate(range(int(top)+6,hz-4,7)):
                if KWIN[k][j%60]: d.point((x+4,wy),fill=(70,30,100)); d.point((x1-4,wy),fill=(70,30,100))
    whites=[]; blacks=[]
    for o in range(2):
        for wi,pc in enumerate(WHITE_PC):
            idx=o*7+wi; whites.append((idx*w+3,w-7,110+12*math.sin(idx*1.3)+(30 if wi in (0,3) else 0),o*12+pc))
        for pc,after in BLACK_AFTER.items():
            idx=o*7+after; blacks.append(((idx+1)*w-3.5,5,60+8*math.sin(idx),o*12+pc))
    far=lambda t: -abs(t[0]+t[1]/2-VX)                  # the towers furthest out first, so the inner ones overlap them
    for t in sorted(whites,key=far): draw(*t,False)
    for t in sorted(blacks,key=far): draw(*t,True)
    LAST_BEAMS[:]=BEAMS
    for k in range(24): KEYS[k]=max(0,KEYS[k]-0.045)
    for i,tr in enumerate((3,7)):
        for k in range(4):
            x=10+k*60+i*30; c=dim(TC[tr],.3+.7*DRUMI[i])
            d.ellipse([x-3,hz+16,x+3,hz+22],fill=c)
            if DRUMI[i]>0.5: d.ellipse([x-6,hz+13,x+6,hz+25],outline=dim(TC[tr],.6))
        DRUMI[i]=max(0,DRUMI[i]-0.12)
    return im

STYLES=[("palms","PALMS",lambda i:palms()),("night-drive","NIGHT DRIVE",lambda i:drive()),("horizon","HORIZON",lambda i:horizon()),
        ("flyover","FLYOVER",flyover),("dense-city-b","DENSE CITY B",lambda i:densecity()),("key-city","KEY CITY",lambda i:keycity())]
def main():
    OUT=sys.argv[1]
    def ff(path,w,h):
        return subprocess.Popen(["ffmpeg","-y","-loglevel","error","-f","rawvideo","-pix_fmt","rgb24","-s",f"{w}x{h}","-r",str(FPS),"-i","-",
            "-i",WORK+"song.wav","-c:v","libx264","-pix_fmt","yuv420p","-crf","26","-preset","medium","-c:a","aac","-b:a","128k","-shortest",path],stdin=subprocess.PIPE)
    pipes=[ff(f"{OUT}/visualiser-{k}.mp4",480,480) for k,_,_ in STYLES]
    GW,GH=3*480+4*8,2*(480+34)+8
    grid_p=ff(f"{OUT}/visualiser-all-six.mp4",GW,GH)
    from PIL import ImageFont
    FT=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",20)
    for i in range(NF):
        analyse(i)
        g=Image.new("RGB",(GW,GH),(28,28,32)); gd=ImageDraw.Draw(g)
        for j,(key,name,fn) in enumerate(STYLES):
            f1=fn(i)
            if i==int(11.2*FPS): f1.save(WORK+f'still-{key}.png')
            fr=f1.resize((480,480),Image.NEAREST)
            pipes[j].stdin.write(fr.tobytes())
            x=8+(j%3)*(480+8); y=8+(j//3)*(480+34)
            g.paste(fr,(x,y)); gd.text((x,y+484),name,font=FT,fill=(236,236,240))
        tl="PLAYING" if S.playing else "STOPPED"
        gd.text((GW-8,GH-30),f"{tl}  bar {int(S.beat//4)+1}" if S.playing else tl,font=FT,fill=(150,150,158),anchor="ra")
        grid_p.stdin.write(g.tobytes())
        if i%60==0: print(i,"/",NF,flush=True)
    for p in pipes+[grid_p]: p.stdin.close(); p.wait()
    print("done")
if __name__=='__main__': main()
