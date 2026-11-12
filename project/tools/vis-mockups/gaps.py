from common import *
from sheet import run
from scenic import sky, stars, sun, grid, PINK, CYAN, SUNA, SUNB
random.seed(5)
def wave(n, amp=1.0, ph=0.0):
    return [amp*(0.55*math.sin(i*0.09+ph)+0.25*math.sin(i*0.31+1+ph)+0.12*math.sin(i*0.77)+random.uniform(-.04,.04)) for i in range(n)]
LV=[.82,.55,.68,.95,.3,.6,.42,.74]; PK=[.9,.7,.75,.98,.45,.66,.6,.8]; MLV,MPK=.88,.96

# ---- waveform, exact ----
def crt():  # a phosphor scope: graticule, the wave with its glow and the last frames fading
    im,d=new()
    d.rounded_rectangle([4,4,235,235],18,fill=(4,14,6))
    for i in range(1,10):
        x=4+i*23.1; d.line([x,8,x,231],fill=(14,40,18))
        d.line([8,x,231,x],fill=(14,40,18))
    for i in range(0,232,5): d.line([118,i,122,i],fill=(20,60,26)); d.line([i,118,i,122],fill=(20,60,26))
    for age,a in ((2,.18),(1,.35)):
        w=wave(220,1,age*0.15); d.line([(10+i,120-v*80) for i,v in enumerate(w)],fill=dim((60,255,110),a))
    w=wave(220); pts=[(10+i,120-v*80) for i,v in enumerate(w)]
    d.line(pts,fill=(30,120,50),width=4); d.line(pts,fill=(170,255,190),width=1)
    d.text((14,12),"CH1 MIX",font=F(9),fill=(60,180,90)); d.text((226,12),"TRIG",font=F(9),fill=(60,180,90),anchor="ra")
    return im

def neon():  # the wave as a neon tube on a brick wall; it buzzes brighter on kicks
    im,d=new(); 
    for r in range(0,240,12):
        off=0 if (r//12)%2 else 12
        for c in range(-12,240,24): d.rectangle([c+off+1,r+1,c+off+22,r+10],fill=(40+random.randint(0,10),18,22))
    w=wave(200); pts=[(20+i,120-v*70) for i,v in enumerate(w)]
    for wd,c in ((11,(60,10,40)),(7,(140,20,90)),(4,(255,60,170)),(1,(255,220,240))): d.line(pts,fill=c,width=wd)
    for x in (20,219): d.rectangle([x-3,pts[0 if x==20 else -1][1]-3,x+3,pts[0 if x==20 else -1][1]+3],fill=(150,150,160))
    return im

def sunscope():  # HORIZON with the wave as its horizon: the sun sits on the waveform
    im,d=new(); hz=140; sky(d,(10,0,30),(110,20,90),hz); stars(d,30,70); sun(d,120,112,52,clip=hz+40)
    d.rectangle([0,hz,239,239],fill=(8,0,18)); grid(d,hz+12,(170,30,140),n=7,fan=36)
    w=wave(240); pts=[(i,hz-v*38) for i,v in enumerate(w)]
    d.polygon(pts+[(239,hz+12),(0,hz+12)],fill=(8,0,18))
    d.line(pts,fill=CYAN,width=2)
    return im

def seismo():  # a pen plotter: the wave drawn on paper that scrolls left; the pen is the newest sample
    im,d=new(); d.rectangle([0,0,239,239],fill=(236,230,212))
    for x in range(0,240,10): d.line([x,0,x,239],fill=(220,190,190) if x%50 else (200,150,150))
    for y in range(0,240,10): d.line([0,y,239,y],fill=(220,190,190) if y%50 else (200,150,150))
    w=wave(200); pts=[(i,120-v*85) for i,v in enumerate(w)]
    d.line(pts,fill=(30,30,90),width=1)
    px,py=pts[-1]; d.line([px,py,236,30],fill=(60,60,60),width=2); d.ellipse([px-3,py-3,px+3,py+3],fill=(180,30,30))
    d.rectangle([200,0,239,239],fill=(60,58,55)); d.rectangle([196,0,200,239],fill=(40,38,36))
    d.text((228,232),"124",font=F(9),fill=(200,200,190),anchor="rb")
    return im

# ---- levels, readable ----
def needles():  # 8 needle meters and a big master, each with a red peak lamp
    im,d=new()
    def meter(x,y,w,h,v,p,c,lab):
        d.rounded_rectangle([x,y,x+w,y+h],4,fill=(235,225,190),outline=(80,70,50))
        cx,cy=x+w/2,y+h*0.95; r=h*0.75
        for k in range(11):
            a=math.radians(-150+k*12); rr=r*(0.85 if k%5 else 0.78)
            d.line([cx+math.cos(a)*rr,cy+math.sin(a)*rr,cx+math.cos(a)*r,cy+math.sin(a)*r],fill=(200,40,30) if k>=8 else (40,40,40))
        a=math.radians(-150+v*120); d.line([cx,cy,cx+math.cos(a)*r*0.98,cy+math.sin(a)*r*0.98],fill=(20,20,20),width=2)
        d.ellipse([x+w-8,y+4,x+w-3,y+9],fill=(255,40,30) if p>.9 else (90,30,30))
        d.text((x+4,y+3),lab,font=F(9),fill=c)
    for t in range(8):
        meter(4+(t%4)*59,4+(t//4)*58,55,54,LV[t],PK[t],TC[t],str(t+1))
    meter(30,124,180,110,MLV,MPK,(30,30,30),"MASTER")
    return im

def towers():  # 8 towers: lit floors = level, a beacon on the roof = peak hold; the white tower = master
    im,d=new(); sky(d,(4,4,20),(30,10,50),240); stars(d,40,80)
    floors=24; fh=8
    for t in range(9):
        x=3+t*26; master=t==8
        v,p,c=(MLV,MPK,(235,235,235)) if master else (LV[t],PK[t],TC[t])
        n=int(v*floors); pk=int(p*floors)
        for f in range(floors):
            y=220-f*fh; on=f<n; col=c if on else (22,22,34)
            if on and f>floors*0.8: col=(255,70,60)
            d.rectangle([x,y-fh+2,x+21,y],fill=col)
        y=220-pk*fh; d.rectangle([x+8,y-fh-1,x+13,y-fh+3],fill=WHITE)
        if master: d.line([x+11,y-fh-1,x+11,y-fh-10],fill=(200,200,200))
        d.text((x+11,232),"M" if master else str(t+1),font=F(10),fill=c,anchor="mm")
    d.rectangle([0,221,239,223],fill=(60,60,70))
    return im

def pillars():  # HORIZON style: 8 neon pillars on the grid, a cap hovers at each peak; the sun = master
    im,d=new(); hz=150; sky(d,(10,0,30),(100,20,90),hz); stars(d,30,60)
    r=int(12+MLV*22); sun(d,120,44,r,gaps=False)
    d.rectangle([0,hz,239,239],fill=(8,0,18)); grid(d,hz,(150,30,130),n=7,fan=36)
    for t in range(8):
        x=14+t*28; base=hz+40; h=int(LV[t]*112)
        for y in range(base-h,base,5): d.rectangle([x,y,x+17,y+3],fill=mix(TC[t],WHITE,max(0,(base-y)/112-.75)))
        pk=base-int(PK[t]*112); d.rectangle([x,pk-3,x+17,pk-1],fill=WHITE)
        d.polygon([(x,base+2),(x+17,base+2),(x+21,base+8),(x-4,base+8)],fill=dim(TC[t],.4))
    return im

def tubes():  # glass tubes of liquid; a bubble floats at the peak; the wide tube is the master
    im,d=new(); d.rectangle([0,0,239,239],fill=(16,18,24))
    for t in range(9):
        master=t==8; x=8+t*22 if not master else 190; w=14 if not master else 40
        v,p,c=(MLV,MPK,(240,240,240)) if master else (LV[t],PK[t],TC[t])
        top,bot=20,214; h=bot-top
        d.rounded_rectangle([x-2,top-2,x+w+2,bot+2],w//2+2,fill=(50,56,70))
        d.rounded_rectangle([x,top,x+w,bot],w//2,fill=(8,10,14))
        ly=bot-int(v*h); d.rounded_rectangle([x+1,ly,x+w-1,bot-1],w//2-1,fill=c)
        d.line([x+3,ly+4,x+3,bot-8],fill=mix(c,WHITE,.6))
        d.ellipse([x+w/2-2,ly-3,x+w/2+2,ly+1],fill=mix(c,WHITE,.5))
        py=bot-int(p*h); d.ellipse([x+w/2-3,py-3,x+w/2+3,py+3],outline=WHITE)
        for k in range(0,h,h//8): d.line([x+w+2,bot-k,x+w+5,bot-k],fill=(90,90,100))
        d.text((x+w/2,232),"M" if master else str(t+1),font=F(9),fill=c,anchor="mm")
    return im

def console():  # a mixing desk: 8 channel strips and the master, LED ladders and dB readouts
    im,d=new(); d.rectangle([0,0,239,239],fill=(34,34,38))
    for t in range(9):
        master=t==8; x=3+t*26; v,p,c=(MLV,MPK,WHITE) if master else (LV[t],PK[t],TC[t])
        d.rectangle([x,4,x+23,235],fill=(24,24,28) if not master else (44,40,30))
        db=int(-48+v*48); d.rectangle([x+1,6,x+22,17],fill=(10,20,12)); d.text((x+12,12),f"{db}",font=F(8),fill=(120,255,140),anchor="mm")
        segs=26; n=int(v*segs); pk=int(p*segs)
        for s in range(segs):
            y=200-s*7; col=(255,60,50) if s>=22 else (255,200,40) if s>=17 else c
            d.rectangle([x+4,y-5,x+9,y],fill=col if s<n or s==pk else dim(col,.15))
        fy=200-int(v*0.9*170); d.rectangle([x+13,30,x+15,200],fill=(10,10,10)); d.rectangle([x+11,fy-5,x+18,fy+5],fill=(200,200,205)); d.line([x+11,fy,x+18,fy],fill=(30,30,30))
        d.text((x+12,222),"M" if master else str(t+1),font=F(10),fill=c,anchor="mm")
    return im

if __name__=='__main__': run([(crt,"CRT","a phosphor scope: graticule, glow, the last frames fading"),
     (neon,"NEON","the wave bent into a neon tube on a brick wall"),
     (sunscope,"SUNSET SCOPE","HORIZON with the waveform as its horizon"),
     (seismo,"PLOTTER","a pen draws the wave on paper scrolling left"),
     (needles,"NEEDLES","8 needle meters and the master, red peak lamps"),
     (towers,"TOWERS","8 towers + master: lit floors = level, beacon = peak"),
     (pillars,"PILLARS","HORIZON with 8 neon meters; the sun swells = master"),
     (tubes,"TUBES","liquid levels, a bubble at each peak; wide tube = master"),
     (console,"CONSOLE","a mixing desk: LED ladders, peak holds, dB readouts")],
    SCREENS+"visualiser-concepts-4.png", start=28)
