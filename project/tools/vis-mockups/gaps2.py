from common import *
from sheet import run
from scenic import sky, stars, sun, grid, PINK, CYAN, SUNA, SUNB
random.seed(9)
def wave(n, amp=1.0, ph=0.0):
    return [amp*(0.55*math.sin(i*0.09+ph)+0.25*math.sin(i*0.31+1+ph)+0.12*math.sin(i*0.77)+random.uniform(-.03,.03)) for i in range(n)]
LV=[.82,.55,.68,.95,.3,.6,.42,.74]; PK=[.9,.7,.75,.98,.45,.66,.6,.8]; MLV,MPK=.88,.96
def segcol(c,f,n=24): return (255,60,50) if f>=22*n/24 else (255,200,40) if f>=18*n/24 else c

# ---- waveform ----
def ribbon():  # the last frames recede in perspective as a neon ribbon; the front one is exact; kicks flash it white
    im,d=new(); 
    for k in range(9,-1,-1):
        z=k/9; s=1-z*0.55; yo=165-z*120; w=wave(240,1,k*0.12)
        pts=[(120+(i-120)*s, yo-v*60*s) for i,v in enumerate(w)]
        if k==0:
            d.polygon(pts+[(240,240),(0,240)],fill=(0,0,0))
            d.line(pts,fill=(255,140,220),width=4); d.line(pts,fill=WHITE,width=1)
        else:
            d.polygon(pts+[(120+120*s,240),(120-120*s,240)],fill=(0,0,0))
            d.line(pts,fill=mix(PINK,(40,20,120),z),width=2 if k<3 else 1)
    return im

def ocean():  # the wave is the sea, seen side-on; a little boat rides the surface; a kick throws spray
    im,d=new(); sky(d,(255,170,110),(120,170,230),120)
    d.rectangle([0,120,239,239],fill=(120,170,230))
    d.ellipse([170,20,206,56],fill=(255,240,200))
    for cx,cy in ((50,40),(80,30)): d.ellipse([cx-18,cy-7,cx+18,cy+7],fill=(255,250,245))
    w=wave(240); pts=[(i,130-v*55) for i,v in enumerate(w)]
    d.polygon(pts+[(239,239),(0,239)],fill=(20,90,170))
    for y in range(150,240,4): d.line([0,y,239,y],fill=mix((20,90,170),(5,25,70),(y-150)/90))
    d.line(pts,fill=(220,240,255),width=2)
    bx=150; by=pts[bx][1]; sl=(pts[bx+6][1]-pts[bx-6][1])/12; a=math.atan(sl)
    def rot(x,y): return (bx+x*math.cos(a)-y*math.sin(a), by+x*math.sin(a)+y*math.cos(a))
    d.polygon([rot(-14,-4),rot(14,-4),rot(9,4),rot(-9,4)],fill=(200,60,40))
    d.line([rot(0,-4),rot(0,-30)],fill=(60,40,30),width=2); d.polygon([rot(1,-28),rot(1,-8),rot(14,-8)],fill=WHITE)
    for i in range(14):
        x=60+random.uniform(-10,10); y=pts[60][1]-random.uniform(4,26); d.ellipse([x-1.5,y-1.5,x+1.5,y+1.5],fill=WHITE)
    return im

def vhs():  # a VHS tape played back: the wave with colour fringes and scan lines; a kick jolts the fringes apart
    im,d=new(); d.rectangle([0,0,239,239],fill=(14,10,40))
    w=wave(240); 
    for dx,c in ((-4,(255,0,80)),(4,(0,200,255))):
        d.line([(i+dx,120-v*85) for i,v in enumerate(w)],fill=c,width=2)
    d.line([(i,120-v*85) for i,v in enumerate(w)],fill=WHITE,width=2)
    for y in range(0,240,3): d.line([0,y,239,y],fill=(0,0,0))
    for y in (60,61,170):
        o=random.randint(-6,6); band=im.crop((0,y,240,y+4)); im.paste(band,(o,y))
    d.text((12,12),"PLAY ▶",font=F(14),fill=WHITE); d.text((12,212),"SP 0:01:24",font=F(12),fill=WHITE)
    return im

def coaster():  # the wave as a rollercoaster track with its supports; the car rides it; kicks light the bulbs
    im,d=new(); sky(d,(20,10,60),(240,120,90),240); stars(d,25,70)
    w=wave(240); pts=[(i,120-v*80) for i,v in enumerate(w)]
    for x in range(0,240,10): d.line([x,pts[x][1]+2,x,239],fill=(70,30,60))
    for x in range(0,230,20): d.line([x,pts[x][1]+4,x+20,239],fill=(60,25,55))
    d.line(pts,fill=(255,230,240),width=3); d.line([(x,y+5) for x,y in pts],fill=(200,80,140),width=2)
    for x in range(4,240,12): d.ellipse([x-1,pts[x][1]-4,x+1,pts[x][1]-2],fill=SUNA if x%24==4 else (255,120,60))
    for k,cx in enumerate((150,163,176)):
        y=pts[cx][1]; d.rounded_rectangle([cx-6,y-11,cx+6,y-2],3,fill=TC[k*2+1])
    return im

# ---- levels ----
def sunburst():  # 8 rays round a sun: lit segments = level (yellow then red at the tips), a dot holds each peak; the sun fills with the master
    im,d=new(); cx,cy=120,120
    for t in range(8):
        a=math.radians(-90+t*45)
        n=int(LV[t]*12); pk=int(PK[t]*12)
        for s in range(12):
            r0=40+s*6.5; r1=r0+4.5; aa=0.17
            pts=[(cx+math.cos(a-aa*(40/r0))*r0,cy+math.sin(a-aa*(40/r0))*r0),(cx+math.cos(a+aa*(40/r0))*r0,cy+math.sin(a+aa*(40/r0))*r0),
                 (cx+math.cos(a+aa*(40/r1))*r1,cy+math.sin(a+aa*(40/r1))*r1),(cx+math.cos(a-aa*(40/r1))*r1,cy+math.sin(a-aa*(40/r1))*r1)]
            col=segcol(TC[t],s,12) if s<n else WHITE if s==pk else (26,26,30)
            d.polygon(pts,fill=col)
        lx,ly=cx+math.cos(a)*124,cy+math.sin(a)*124
    r=34; d.ellipse([cx-r,cy-r,cx+r,cy+r],fill=(30,30,30))
    fill=int(MLV*2*r)
    for y in range(cy+r-fill,cy+r):
        w=int(math.sqrt(max(0,r*r-(y-cy)**2))); d.line([cx-w,y,cx+w,y],fill=mix(SUNA,SUNB,(y-cy+r)/(2*r)))
    py=cy+r-int(MPK*2*r); d.line([cx-12,py,cx+12,py],fill=WHITE)
    return im

def blocks():  # isometric stacks of blocks, one per track and a white master; the top blocks turn red; a block floats at the peak
    im,d=new(); 
    def cube(x,y,s,c):
        top=[(x,y),(x+s,y-s/2),(x+2*s,y),(x+s,y+s/2)]
        d.polygon(top,fill=mix(c,WHITE,.25)); d.polygon([(x,y),(x+s,y+s/2),(x+s,y+s*1.5),(x,y+s)],fill=c)
        d.polygon([(x+s,y+s/2),(x+2*s,y),(x+2*s,y+s),(x+s,y+s*1.5)],fill=dim(c,.6))
    order=list(range(9))
    for t in order:
        master=t==8; v,p,c=(MLV,MPK,(225,225,225)) if master else (LV[t],PK[t],TC[t])
        x=4+t*24; base=226-t*4; s=11; n=int(v*16); pk=int(p*16)
        for f in range(n): cube(x,base-f*s*0.75,s,segcol(c,f,16))
        if pk>n: cube(x,base-pk*s*0.75,s,WHITE)
    return im

def fountains():  # 8 fountains and a big master in the middle: the jet's height = level, one drop hangs at the peak
    im,d=new(); sky(d,(10,10,40),(40,30,90),240); stars(d,30,60)
    d.rectangle([0,212,239,239],fill=(30,30,50))
    for y in range(20,212,24): d.line([0,y,4,y],fill=(90,90,120)); d.line([235,y,239,y],fill=(90,90,120))
    xs=[16,40,64,88,152,176,200,224]
    for t in range(9):
        master=t==8; x=120 if master else xs[t]; v,p,c=(MLV,MPK,(230,240,255)) if master else (LV[t],PK[t],TC[t])
        top=212-int(v*190); w=10 if master else 4
        for y in range(top,212,2):
            k=(y-top)/(212-top+1); d.line([x-w*(0.4+0.6*k),y,x+w*(0.4+0.6*k),y],fill=mix(WHITE,c,0.3+0.7*k))
        for s in (-1,1):
            for j in range(5): d.point((x+s*(w+j*2),top+4+j*j),fill=c)
        py=212-int(p*190); d.ellipse([x-2,py-3,x+2,py+1],fill=WHITE)
        d.ellipse([x-w-6,208,x+w+6,216],fill=dim(c,.5))
        d.text((x,230),"M" if master else str(t+1),font=F(9),fill=c,anchor="mm")
    return im

def balloons():  # hot-air balloons rising with their track's level against an altitude scale; a flag marks the peak
    im,d=new(); sky(d,(120,190,250),(250,220,200),240)
    for y in range(20,205,23): d.line([0,y,239,y],fill=(255,255,255)); 
    d.rectangle([0,214,239,239],fill=(90,150,80))
    for t in range(9):
        master=t==8; x=15+t*26; v,p,c=(MLV,MPK,(250,250,250)) if master else (LV[t],PK[t],TC[t])
        y=200-int(v*170); r=11 if master else 9
        py=200-int(p*170)-r; d.line([x-8,py,x+8,py],fill=(255,60,50),width=2)
        d.line([x,y+r,x,212],fill=dim(c,.4))
        d.ellipse([x-r,y-r,x+r,y+r],fill=c); d.polygon([(x-r+2,y+4),(x+r-2,y+4),(x+3,y+r+4),(x-3,y+r+4)],fill=c)
        d.line([x,y-r,x,y+r+3],fill=mix(c,WHITE,.5)); d.rectangle([x-3,y+r+4,x+3,y+r+9],fill=(110,70,40))
        d.text((x,228),"M" if master else str(t+1),font=F(9),fill=dim(c,.8) if not master else (60,60,60),anchor="mm")
    return im

def striker():  # a fairground strength tester per track: the puck flies up to the level, the bell rings at clipping, a mark holds the peak
    im,d=new(); sky(d,(40,0,40),(10,0,20),240)
    for i in range(0,240,10): d.ellipse([i+3,4,i+7,8],fill=SUNA if i%20 else (255,80,80))
    for t in range(9):
        master=t==8; x=10+t*26; v,p,c=(MLV,MPK,WHITE) if master else (LV[t],PK[t],TC[t])
        top,bot=36,206
        d.rectangle([x,top,x+14,bot],fill=(240,230,210)); d.rectangle([x+5,top,x+9,bot],fill=(70,50,40))
        for k in range(1,10): d.line([x,bot-k*17,x+3,bot-k*17],fill=(120,90,70)); d.line([x+11,bot-k*17,x+14,bot-k*17],fill=(120,90,70))
        ring=v>0.92; d.ellipse([x-1,top-16,x+15,top],fill=SUNA if ring else (120,100,40))
        if ring:
            for a in range(0,180,40):
                r=math.radians(a+180); d.line([x+7+math.cos(r)*10,top-8+math.sin(r)*10,x+7+math.cos(r)*15,top-8+math.sin(r)*15],fill=SUNA)
        py=bot-int(v*(bot-top)); d.rectangle([x+2,py-4,x+12,py+4],fill=c)
        pk=bot-int(p*(bot-top)); d.line([x-2,pk,x+16,pk],fill=(255,60,50),width=2)
        d.rectangle([x-3,bot,x+17,bot+8],fill=(90,60,40))
        d.text((x+7,228),"M" if master else str(t+1),font=F(10),fill=c,anchor="mm")
    return im

if __name__=='__main__': run([(ribbon,"RIBBON","the last frames recede as a neon ribbon; front = exact"),
     (ocean,"OCEAN","the wave is the sea; a boat rides it, kicks throw spray"),
     (vhs,"VHS","the wave played off tape: fringes jolt apart on kicks"),
     (coaster,"COASTER","a rollercoaster on the wave; kicks light the bulbs"),
     (sunburst,"SUNBURST","8 rays of segments with peak dots; the sun = master"),
     (blocks,"BLOCKS","isometric stacks, red at the top; a block at each peak"),
     (fountains,"FOUNTAINS","jet height = level, a drop at the peak; centre = master"),
     (balloons,"BALLOONS","altitude = level on a scale; a red line at the peak"),
     (striker,"STRIKER","a puck flies to the level, the bell rings when it clips")],
    SCREENS+"visualiser-concepts-5.png", start=37)
