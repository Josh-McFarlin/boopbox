from common import *
from sheet import run
random.seed(21)
PINK=(230,50,170); CYAN=(40,220,255); SUNA=(255,220,70); SUNB=(255,50,130)

def sky(d,top,bot,hz):
    for y in range(hz): d.line([0,y,239,y],fill=mix(top,bot,y/hz))
def stars(d,n,ymax):
    for _ in range(n): d.point((random.randint(0,239),random.randint(0,ymax)),fill=(random.randint(120,230),)*3)
def sun(d,cx,cy,r,a=SUNA,b=SUNB,gaps=True,clip=999):
    for y in range(cy-r,min(cy+r,clip)):
        if gaps and y>cy-r//4 and (y-cy+r//4)%8<(y-cy+r//4)//9+1: continue
        w=int(math.sqrt(max(0,r*r-(y-cy)**2))); d.line([cx-w,y,cx+w,y],fill=mix(a,b,(y-cy+r)/(2*r)))
def grid(d,hz,col,z=0.4,n=10,fan=40):
    for k in range(-14,15): d.line([120+k*6,hz,120+k*fan,239],fill=col)
    for i in range(n):
        y=hz+(239-hz)*((i+z)/n)**2.2; d.line([0,y,239,y],fill=col)
def hills(d,hz,n,amp,fill,out,seed=0):
    sp=spectrum(n); pts=[(0,hz)]+[(i*240/(n-1),hz-4-v*amp) for i,v in enumerate(sp)]+[(239,hz)]
    d.polygon(pts,fill=fill,outline=out)

def drive():  # a night road: lane stripes pass on each beat, the city skyline is the spectrum
    im,d=new(); hz=120; sky(d,(5,0,25),(70,10,70),hz); stars(d,40,80); sun(d,120,104,40,clip=hz)
    sp=spectrum(30); x=0
    for v in sp:
        w=8; h=8+v*50; d.rectangle([x,hz-h,x+w-1,hz],fill=(15,5,30))
        for wy in range(int(hz-h)+3,hz-2,5):
            if random.random()<.4: d.point((x+3,wy),fill=CYAN if random.random()<.5 else PINK)
        x+=w
    d.rectangle([0,hz,239,239],fill=(10,0,20))
    d.polygon([(110,hz),(130,hz),(239,239),(0,239)],fill=(25,15,40))
    d.line([110,hz,0,239],fill=PINK,width=2); d.line([130,hz,239,239],fill=PINK,width=2)
    for i in range(6):
        t0=((i+.3)/6)**2; t1=((i+.6)/6)**2
        y0=hz+(239-hz)*t0; y1=hz+(239-hz)*t1; d.polygon([(120-1-t0*3,y0),(120+1+t0*3,y0),(120+1+t1*3,y1),(120-1-t1*3,y1)],fill=SUNA)
    from car import car
    car(d,120,226,False)
    return im

def palms():  # a beach at sunset: the waves are the waveform, the palms sway with the mix
    im,d=new(); hz=140; sky(d,(40,0,60),(255,110,80),hz); sun(d,120,128,50,(255,240,140),(255,80,90),clip=hz)
    for y in range(hz,240):
        k=(y-hz)/100; d.line([0,y,239,y],fill=mix((60,20,90),(10,0,30),k))
    for i in range(14):
        y=hz+4+i*i*0.55; w=48-i*2.5
        xo=4*math.sin(i*1.7)
        d.line([120-w+xo,y,120+w+xo,y],fill=mix((255,220,120),(255,80,110),i/14),width=2)
    for r in range(5):
        pts=[(x,hz+20+r*18+ (3+r)*math.sin(x/(9+r)+r)) for x in range(0,240,3)]
        d.line(pts,fill=mix(CYAN,(40,40,120),r/5))
    for bx,lean in ((28,0.35),(210,-0.3)):
        top=(bx+lean*100,50); d.line([(bx,239),((bx+top[0])/2+6*lean*10,150),top],fill=(10,0,15),width=6)
        for a in range(-150,30,30):
            r=math.radians(a); ex,ey=top[0]+math.cos(r)*40,top[1]+math.sin(r)*22+10
            d.line([top,((top[0]+ex)/2,(top[1]+ey)/2-8),(ex,ey)],fill=(10,0,15),width=4)
    return im

def flyover():  # flying over a neon mesh: the spectrum pushes the ground up into peaks
    im,d=new(); hz=70; sky(d,(0,0,10),(40,0,60),hz); stars(d,30,60); sun(d,120,64,28,clip=hz)
    rows=16; cols=21; P=[]
    for r in range(rows):
        z=(r+0.3)/rows; y=hz+(239-hz)*z**1.8; row=[]
        sp=spectrum(cols)
        for c in range(cols):
            u=(c-(cols-1)/2)/((cols-1)/2); x=120+u*(30+z*260)
            h=(sp[c]**2)*(1-abs(u)*.3)*60*z*(1.2 if abs(u)<.5 else .6)
            row.append((x,y-h))
        P.append(row)
    d.rectangle([0,hz,239,239],fill=(5,0,15))
    for r in range(rows-1,-1,-1):
        col=mix((60,0,80),CYAN,r/rows)
        d.line(P[r],fill=col)
        if r<rows-1:
            for c in range(cols): d.line([P[r][c],P[r+1][c]],fill=mix((60,0,80),PINK,r/rows))
    return im

def aurora():  # northern lights: a curtain per band, swaying with the mix, over snowy peaks
    im,d=new(); sky(d,(0,4,20),(0,20,40),240); stars(d,80,140)
    sp=spectrum(48)
    for i,v in enumerate(sp):
        x=i*5; base=70+18*math.sin(i/6)+8*math.sin(i/2.3)
        h=30+v*70
        for y in range(int(base-h),int(base+10)):
            k=(y-(base-h))/(h+10)
            c=mix((150,40,200),(40,255,140),k)
            d.line([x,y,x+4,y],fill=dim(c,0.25+0.6*k*v))
    pts=[(0,240),(0,170),(40,130),(70,165),(110,115),(150,160),(185,135),(239,175),(239,240)]
    d.polygon(pts,fill=(15,20,40))
    for (x,y) in ((40,130),(110,115),(185,135)): d.polygon([(x,y),(x-12,y+14),(x+12,y+14)],fill=(200,210,230))
    d.rectangle([0,215,239,239],fill=(10,14,30))
    return im

def planetrise():  # a ringed planet rises on the grid; its ring brightens on the beat
    im,d=new(); hz=150; sky(d,(0,0,10),(30,0,50),hz); stars(d,70,140)
    cx,cy,r=120,120,52
    for y in range(cy-r,min(cy+r,hz)):
        w=int(math.sqrt(max(0,r*r-(y-cy)**2))); 
        for x in range(cx-w,cx+w):
            band=math.sin((y-cy)/5+ (x-cx)/40)*.5+.5
            d.point((x,y),fill=mix((70,20,140),(255,90,150),band*((x-cx+w)/(2*w+1))))
    d.ellipse([cx-100,cy-14,cx+100,cy+14],outline=SUNA,width=2)
    d.ellipse([cx-86,cy-10,cx+86,cy+10],outline=dim(PINK,.8),width=1)
    for y in range(cy-r,cy):
        w=int(math.sqrt(max(0,r*r-(y-cy)**2)))
        if cy-12<y<cy: d.line([cx-w,y,cx+w,y],fill=mix((70,20,140),(255,90,150),.5))
    d.rectangle([0,hz,239,239],fill=(5,0,15)); grid(d,hz,(0,170,220),z=.6,n=8,fan=30)
    return im

def parallax():  # dawn over layered mountains; each layer swells with a track's level
    im,d=new(); sky(d,(30,20,90),(255,150,120),240); sun(d,160,110,30,(255,250,200),(255,160,120),gaps=False)
    cols=[(110,70,140),(80,45,110),(55,25,85),(35,12,60),(18,4,35)]
    for L,c in enumerate(cols):
        base=110+L*26; pts=[(0,240)]
        for x in range(0,244,4):
            pts.append((x,base-(18+L*3)*abs(math.sin(x/(30-L*3)+L*1.7))-8*math.sin(x/9+L)))
        pts.append((239,240)); d.polygon(pts,fill=c)
    for i in range(6):
        x=40+i*28; y=60+7*math.sin(i); d.line([x,y,x+4,y-3,x+8,y],fill=(40,20,60))
    return im

def pyramid():  # a pyramid in the desert; lasers fire on the beat, one beam per track
    im,d=new(); hz=170; sky(d,(5,0,20),(60,0,60),hz); stars(d,60,130)
    tops=(120,60)
    for t,a in enumerate((-70,-50,-30,-12,12,30,50,70)):
        if t in (1,3,4,6):
            r=math.radians(a-90); d.line([tops,(tops[0]+math.cos(r)*300,tops[1]+math.sin(r)*300)],fill=TC[t],width=2)
    d.polygon([(40,hz),tops,(200,hz)],fill=(20,10,40),outline=PINK)
    d.polygon([tops,(120,hz),(200,hz)],fill=(35,15,60))
    for k in range(1,6):
        y=60+k*(hz-60)/6; w=(y-60)*80/(hz-60); d.line([120-w,y,120+w,y],fill=dim(PINK,.4))
    d.ellipse([112,52,128,68],fill=WHITE)
    d.rectangle([0,hz,239,239],fill=(25,10,30))
    for i in range(5):
        y=hz+5+i*i*3; d.line([0,y,239,y],fill=(80,30,70))
    return im

def moonlake():  # a moon over still water; its reflection breaks up with the mix
    im,d=new(); hz=130; sky(d,(0,0,15),(10,20,60),hz); stars(d,60,hz-10)
    d.ellipse([90,30,150,90],fill=(240,240,220)); d.ellipse([105,45,115,55],fill=(210,210,195)); d.ellipse([125,62,138,74],fill=(215,215,200))
    pts=[(0,hz),(0,118),(30,105),(60,116),(90,108),(140,118),(180,100),(215,112),(239,104),(239,hz)]
    d.polygon(pts,fill=(5,8,20))
    for y in range(hz,240): d.line([0,y,239,y],fill=mix((10,20,60),(0,0,10),(y-hz)/110))
    sp=spectrum(24)
    for i in range(24):
        y=hz+4+i*4.3; w=30-i*0.4+sp[i]*14; xo=sp[i]*10*math.sin(i*2.1)
        d.line([120-w+xo,y,120+w*0.6+xo,y],fill=dim((240,240,220),0.8-i/40),width=2)
    return im

def lasercity():  # a neon city; searchlights sweep with the bar, flash on kicks
    im,d=new(); hz=200; sky(d,(5,0,30),(50,0,60),hz)
    for t,(x,a) in enumerate(((30,-25),(90,10),(160,-8),(215,22))):
        r=math.radians(a-90); ex,ey=x+math.cos(r)*260,190+math.sin(r)*260
        d.polygon([(x,190),(ex-20,ey),(ex+20,ey)],fill=dim(TC[t*2],.18)); d.line([x,190,ex,ey],fill=dim(TC[t*2],.6))
    x=0
    while x<240:
        w=random.randint(14,28); h=random.randint(50,150)
        d.rectangle([x,hz-h,x+w-2,hz],fill=(10,0,25),outline=(60,0,90))
        if random.random()<.5: d.line([x+w//2,hz-h,x+w//2,hz-h-14],fill=(60,0,90)); d.point((x+w//2,hz-h-15),fill=(255,40,60))
        d.line([x+2,hz-h+6,x+w-4,hz-h+6],fill=random.choice([PINK,CYAN,SUNA]))
        x+=w
    d.rectangle([0,hz,239,239],fill=(5,0,15)); grid(d,hz,(120,0,140),n=6,fan=30)
    return im

if __name__=="__main__":
  run([(drive,"NIGHT DRIVE","a road at night: lane stripes pass on the beat; city = spectrum"),
     (palms,"PALMS","a sunset beach: waves = the waveform, sun on the water"),
     (flyover,"FLYOVER","flying low over a neon mesh pushed up by the spectrum"),
     (aurora,"AURORA","northern lights: a curtain a band, over snowy peaks"),
     (planetrise,"PLANETRISE","a ringed planet over the grid; the ring flares on beats"),
     (parallax,"DAWN","layered hills at dawn; each layer rises with a track"),
     (pyramid,"PYRAMID","a desert pyramid; a laser per track fires on its notes"),
     (moonlake,"MOONLAKE","a moon on still water; the reflection breaks with the mix"),
     (lasercity,"LASER CITY","a neon city; searchlights sweep the bar, flash on kicks")],
    SCREENS+"visualiser-concepts-3.png", start=19)
