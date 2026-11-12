from common import *
from sheet import run
from scenic import sky, stars, sun, grid, PINK, CYAN, SUNA, SUNB
random.seed(3)
def wave(n, amp=1.0, ph=0.0):
    return [amp*(0.55*math.sin(i*0.07+ph)+0.25*math.sin(i*0.23+1+ph)+0.1*math.sin(i*0.61)+random.uniform(-.02,.02)) for i in range(n)]
LV=[.82,.55,.68,.95,.3,.6,.42,.74]; PK=[.9,.7,.75,.98,.45,.66,.6,.8]; MLV,MPK=.88,.96
SKYA,SKYB=(10,0,30),(110,20,90); FLOOR=(8,0,18); GRID=(170,30,140)
def segcol(c,f,n): return (255,60,50) if f>=n*22/24 else (255,200,40) if f>=n*18/24 else c
def base(hz,sunr=44,suny=None,st=40):
    im,d=new(); sky(d,SKYA,SKYB,hz); stars(d,st,hz-40); 
    if sunr: sun(d,120,suny or hz-20,sunr,clip=hz)
    d.rectangle([0,hz,239,239],fill=FLOOR); return im,d

# ---- waveform ----
def mirage():  # the wave is a neon mountain range on the horizon, mirrored in the glossy floor; kicks flare the sun
    hz=130; im,d=base(hz,46,80)
    w=wave(240); top=[(i,hz-34-v*28) for i,v in enumerate(w)]
    d.polygon(top+[(239,hz),(0,hz)],fill=(30,5,50)); d.line(top,fill=CYAN,width=2)
    ref=[(i,hz+(hz-y)*0.7) for i,y in top]
    d.polygon(ref+[(239,hz),(0,hz)],fill=(22,4,40)); d.line(ref,fill=dim(CYAN,.4))
    for k in range(1,6): d.line([(i,hz-(hz-y)*k/6) for i,y in top],fill=(70,20,100))
    for y in range(hz+4,hz+40,5):
        w2=int(40-(y-hz)*0.8); 
        if w2>0: d.line([120-w2,y,120+w2,y],fill=dim(SUNB,.5))
    for a in range(0,360,30):
        r=math.radians(a); d.line([120+math.cos(r)*50,80+math.sin(r)*50,120+math.cos(r)*58,80+math.sin(r)*58],fill=SUNA)
    return im

def wavegrid():  # FLYOVER where each grid row is an earlier frame: the front row is the wave now; kicks light the grid
    hz=90; im,d=base(hz,32,84)
    rows=12; P=[]
    for r in range(rows):
        z=(r+1)/rows; y=hz+12+(222-hz)*z**1.6; w=wave(241,1,(rows-1-r)*0.5); row=[]
        for c in range(0,241,8):
            u=(c-120)/120; row.append((120+u*(70+z*150), y-w[c]*(8+42*z**1.5)))
        P.append(row)
    for r in range(rows):
        d.polygon(P[r]+[(300,240),(-60,240)],fill=FLOOR)
        if r:
            for c in range(len(P[r])): d.line([P[r-1][c],P[r][c]],fill=mix((50,0,70),PINK,r/rows))
        d.line(P[r],fill=mix((60,0,90),CYAN,r/rows) if r<rows-1 else CYAN,width=1 if r<rows-1 else 3)
    d.line(P[-1],fill=WHITE)
    return im

def surf():  # PALMS with the wave as the breaking sea in front; the sun pulses on kicks
    hz=110; im,d=new(); sky(d,(40,0,60),(255,110,80),hz); sun(d,120,98,46,(255,240,140),(255,80,90),clip=hz)
    for y in range(hz,240): d.line([0,y,239,y],fill=mix((60,20,90),(10,0,30),(y-hz)/130))
    for i in range(8):
        y=hz+4+i*5; w=40-i*4; d.line([120-w,y,120+w,y],fill=mix((255,220,120),(255,80,110),i/8),width=2)
    w=wave(240); pts=[(i,175-v*45) for i,v in enumerate(w)]
    d.polygon(pts+[(239,239),(0,239)],fill=(25,5,50))
    for k in range(1,6): d.line([(x,y+k*9) for x,y in pts],fill=dim(CYAN,.5-k*.08))
    d.line(pts,fill=CYAN,width=2); d.line([(x,y-1) for x,y in pts],fill=WHITE)
    for bx,lean in ((14,0.3),(226,-0.3)):
        top=(bx+lean*90,44); d.line([(bx,239),((bx+top[0])/2+4*lean*10,140),top],fill=(10,0,15),width=6)
        for a in range(-150,30,30):
            r=math.radians(a); ex,ey=top[0]+math.cos(r)*36,top[1]+math.sin(r)*20+10
            d.line([top,((top[0]+ex)/2,(top[1]+ey)/2-8),(ex,ey)],fill=(10,0,15),width=4)
    return im

def runner():  # NIGHT DRIVE side-on: the wave is a neon highway, a car drives it with its lights; kicks flare the headlights
    hz=170; im,d=base(hz,50,150,60)
    x=0
    while x<240:
        w=random.randint(10,22); h=random.randint(20,70); d.rectangle([x,hz-h,x+w-2,hz],fill=(20,5,40))
        for wy in range(hz-h+3,hz-2,5):
            if random.random()<.35: d.point((x+random.randint(2,w-4),wy),fill=random.choice([CYAN,PINK,SUNA]))
        x+=w
    w=wave(240); pts=[(i,135-v*55) for i,v in enumerate(w)]
    d.polygon(pts+[(239,239),(0,239)],fill=(14,0,28))
    d.line(pts,fill=PINK,width=2); d.line([(x,y+6) for x,y in pts],fill=dim(PINK,.5))
    for x in range(0,240,16): d.line([x,pts[x][1]+7,x,239],fill=(40,10,60))
    cx=min(range(60,200),key=lambda i:abs(pts[i+8][1]-pts[i-8][1])); y=pts[cx][1]
    a=math.atan((pts[cx+8][1]-pts[cx-8][1])/16)
    def R(px,py): return (cx+px*math.cos(a)-py*math.sin(a), y+px*math.sin(a)+py*math.cos(a))
    d.polygon([R(16,-7),R(64,-18),R(64,2)],fill=mix(SKYB,(255,240,180),.35))
    d.polygon([R(-16,-2),R(16,-2),R(16,-8),R(6,-14),R(-8,-14),R(-16,-8)],fill=(30,10,50),outline=CYAN)
    d.polygon([R(-4,-12),R(5,-12),R(10,-8),R(-4,-8)],fill=(80,200,255))
    tx,ty=R(-16,-6); d.rectangle([tx-2,ty-1,tx,ty+1],fill=(255,30,40))
    for wx in (-9,9):
        qx,qy=R(wx,-2); d.ellipse([qx-3,qy-3,qx+3,qy+3],fill=(10,10,10),outline=PINK)
    return im

# ---- levels ----
def neoncity():  # the NIGHT DRIVE city as meters: 8 towers and a white master, lit floors = level, a beacon at the peak
    hz=200; im,d=base(hz,58,120,50)
    for t in range(9):
        master=t==8; x=3+t*26; v,p,c=(MLV,MPK,(235,235,255)) if master else (LV[t],PK[t],TC[t])
        fl=22; fh=8; n=int(v*fl); pk=int(p*fl)
        d.rectangle([x,hz-fl*fh-2,x+22,hz],fill=(16,4,34),outline=(60,20,90))
        for f in range(fl):
            y=hz-2-f*fh
            on=f<n; col=segcol(c,f,fl) if on else (34,12,56)
            for wx in range(x+3,x+20,5): d.rectangle([wx,y-5,wx+2,y-1],fill=col)
        y=hz-2-pk*fh; d.line([x+11,y-2,x+11,y-9],fill=(150,150,170)); d.ellipse([x+9,y-12,x+13,y-8],fill=WHITE)
        d.line([x,hz,x+22,hz],fill=c,width=2)
    for k in range(1,5): d.line([0,hz+k*k*2+2,239,hz+k*k*2+2],fill=GRID)
    for t in range(9):
        x=3+t*26; c=(235,235,255) if t==8 else TC[t]; d.text((x+11,233),"M" if t==8 else str(t+1),font=F(9),fill=c,anchor="mm")
    return im

def lanes():  # the grid's lanes are the meters: each fills from the front towards the horizon; a crossbar holds the peak
    hz=70; im,d=base(hz,40,60)
    order=[0,1,2,3,8,4,5,6,7]
    def X(u,z): return 120+u*(8+z*230)
    for i,t in enumerate(order):
        master=t==8; v,p,c=(MLV,MPK,WHITE) if master else (LV[t],PK[t],TC[t])
        u0=(i-4.5)/4.5*0.5; u1=(i-3.5)/4.5*0.5
        segs=20; n=int(v*segs); pk=int(p*segs)
        for s in range(segs):
            z0=1-s/segs; z1=1-(s+0.75)/segs
            y0=hz+(239-hz)*z0**1.6; y1=hz+(239-hz)*z1**1.6
            col=segcol(c,s,segs) if s<n else WHITE if s==pk else (34,10,50)
            d.polygon([(X(u0,z0**1.6)+1,y0),(X(u1,z0**1.6)-1,y0),(X(u1,z1**1.6)-1,y1),(X(u0,z1**1.6)+1,y1)],fill=col)
    return im

def peaks():  # FLYOVER's mountains as meters: a neon peak per track and a big master; the tip turns red near clipping, a star holds the peak
    hz=210; im,d=base(hz,34,60,60)
    order=[0,1,2,3,8,4,5,6,7]
    for i,t in enumerate(order):
        master=t==8; v,p,c=(MLV,MPK,(235,235,255)) if master else (LV[t],PK[t],TC[t])
        cx=14+i*26.5; hw=16 if master else 13; H=180
        h=int(v*H); top=hz-h
        d.polygon([(cx-hw,hz),(cx,top),(cx+hw,hz)],fill=(20,4,40))
        for k in range(1,6):
            y=hz-h*k/6; w=hw*(1-k/6); d.line([cx-w,y,cx+w,y],fill=dim(c,.5))
        d.line([(cx-hw,hz),(cx,top),(cx+hw,hz)],fill=c,width=2)
        if h>0.75*H:
            f=0.75*H/h; d.line([(cx-hw*(1-f),hz-h*f),(cx,top),(cx+hw*(1-f),hz-h*f)],fill=(255,60,50),width=2)
        py=hz-int(p*H); d.line([cx-3,py,cx+3,py],fill=WHITE); d.line([cx,py-3,cx,py+3],fill=WHITE)
    grid(d,hz,GRID,n=4,fan=30)
    for i,t in enumerate(order):
        cx=14+i*26.5; c=(235,235,255) if t==8 else TC[t]; d.text((cx,232),"M" if t==8 else str(t+1),font=F(9),fill=c,anchor="mm")
    return im

def lasers():  # a laser show from the horizon: a fan of 8 beams and a white master in the middle; beam length = level, a dot at the peak
    hz=200; im,d=base(hz,0,st=60)
    sun(d,120,hz,30,clip=hz)
    order=[0,1,2,3,8,4,5,6,7]
    for i,t in enumerate(order):
        master=t==8; v,p,c=(MLV,MPK,WHITE) if master else (LV[t],PK[t],TC[t])
        a=math.radians(-90+(i-4)*17); L=185; segs=16; n=int(v*segs); pk=int(p*segs)
        for s in range(segs):
            r0=36+s*(L-36)/segs; r1=r0+(L-36)/segs*0.7
            col=segcol(c,s,segs) if s<n else None
            p0=(120+math.cos(a)*r0,hz+math.sin(a)*r0); p1=(120+math.cos(a)*r1,hz+math.sin(a)*r1)
            if col: d.line([p0,p1],fill=dim(col,.45),width=6); d.line([p0,p1],fill=col,width=2)
            else: d.line([p0,p1],fill=(40,10,60),width=2)
            if s==pk: d.ellipse([p1[0]-3,p1[1]-3,p1[0]+3,p1[1]+3],fill=WHITE)
    grid(d,hz,GRID,n=4,fan=30)
    return im

def sunslice():  # the striped sun as the meters: 9 slices, each lit from the centre out to its level; ticks hold the peaks
    hz=200; im,d=base(hz,0,st=50)
    cx,cy,r=120,104,92; order=[0,1,2,3,4,5,6,7,8]
    for i,t in enumerate(order):
        master=t==8; v,p,c=(MLV,MPK,WHITE) if master else (LV[t],PK[t],TC[t])
        y0=cy-r+i*20.4+2; y1=y0+15
        ym=(y0+y1)/2; full=int(math.sqrt(max(0,r*r-(ym-cy)**2)))
        d.rectangle([cx-full,y0,cx+full,y1],fill=(40,8,60))
        segs=12; n=int(v*segs); pk=int(p*segs)
        for s in range(segs):
            a0=full*s/segs; a1=full*(s+0.8)/segs
            col=mix(SUNA,SUNB,i/8) if not master else WHITE
            col=segcol(col,s,segs) if s>=segs*18/24 else col
            if s<n:
                d.rectangle([cx+a0,y0,cx+a1,y1],fill=col); d.rectangle([cx-a1,y0,cx-a0,y1],fill=col)
            if s==pk and pk>=n:
                d.rectangle([cx+a0,y0,cx+a1,y1],fill=WHITE); d.rectangle([cx-a1,y0,cx-a0,y1],fill=WHITE)
        d.rectangle([cx-2,y0,cx+1,y1],fill=c)
        d.text((8,ym),"M" if master else str(t+1),font=F(10),fill=c,anchor="lm")
    grid(d,hz,GRID,n=4,fan=30)
    return im

if __name__=='__main__': run([(mirage,"MIRAGE","the wave is the neon range on the horizon, mirrored below"),
     (wavegrid,"WAVE GRID","FLYOVER where the front row is the wave, older rows behind"),
     (surf,"SURF","PALMS with the wave as the sea in front; sun pulses on kicks"),
     (runner,"HIGHWAY","NIGHT DRIVE side-on: a car drives the wave; kicks flare its lights"),
     (neoncity,"NEON CITY","8 towers + master: lit floors = level, beacon = peak"),
     (lanes,"LANES","each lane of the road fills towards the horizon with its level"),
     (peaks,"PEAKS","a neon mountain per track, a star at its peak; centre = master"),
     (lasers,"LASERS","a fan of beams from the horizon: length = level; centre = master"),
     (sunslice,"SUNSLICE","the sun's 9 stripes light out from the centre to each level")],
    SCREENS+"visualiser-concepts-6.png", start=46)
