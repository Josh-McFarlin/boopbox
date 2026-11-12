from common import *
from sheet import run
random.seed(11)

def horizon():  # retro sun and a grid scrolling with the tempo; mountains = spectrum
    im,d=new(); hz=130
    for y in range(hz): d.line([0,y,239,y],fill=mix((10,0,30),(90,20,80),y/hz))
    for i in range(30): d.point((random.randint(0,239),random.randint(0,70)),fill=(200,200,220))
    cx,cy,r=120,100,48
    for y in range(cy-r,cy+r):
        if y>cy and (y-cy)%8<(y-cy)//10+1: continue
        w=int(math.sqrt(max(0,r*r-(y-cy)**2)))
        d.line([cx-w,y,cx+w,y],fill=mix((255,216,60),(255,60,120),(y-cy+r)/(2*r)))
    sp=spectrum(24); pts=[(0,hz)]
    for i,v in enumerate(sp): pts.append((i*240/23,hz-6-v*30))
    pts.append((239,hz)); d.polygon(pts,fill=(20,10,40),outline=TC[4])
    d.rectangle([0,hz,239,239],fill=(8,0,18))
    for k in range(-12,13): d.line([120+k*6,hz,120+k*40,239],fill=(200,40,160))
    z=0.4
    for i in range(10):
        y=hz+(239-hz)*((i+z)/10)**2.2; d.line([0,y,239,y],fill=(200,40,160))
    return im

def ripples():  # a drop per note on dark water; rings spread in track colours, a kick shakes all
    im,d=new()
    for x,y,t,r in [(60,70,0,44),(170,60,2,28),(130,150,3,60),(50,180,5,18),(200,170,7,36),(110,90,6,10)]:
        for k in range(4):
            rr=r-k*9
            if rr<2: break
            fade=1-(r/110)-k*0.2
            d.ellipse([x-rr,y-rr*0.55,x+rr,y+rr*0.55],outline=dim(TC[t],max(.15,fade)),width=2)
        if r<15: d.ellipse([x-2,y-2,x+2,y+2],fill=WHITE)
    return im

def garden():  # a flower a track: stem = level, bloom opens on its notes
    im,d=new()
    d.rectangle([0,214,239,239],fill=(30,20,10))
    for i in range(0,240,6): d.line([i,214,i+2,208],fill=(30,110,40))
    lv=[.9,.5,.7,1,.35,.6,.45,.8]; op=[1,.3,.8,.1,1,.5,0,.7]
    for t in range(8):
        x=16+t*29.5; top=214-30-lv[t]*140
        d.line([x,214,x+3*math.sin(t),top],fill=(40,150,60),width=2)
        d.polygon([(x,190-t*5),(x+12,182-t*5),(x+2,186-t*5)],fill=(40,150,60))
        r=4+op[t]*9
        for p in range(6):
            a=p*math.pi/3+t; px,py=x+math.cos(a)*r,top+math.sin(a)*r
            d.ellipse([px-r*0.7,py-r*0.7,px+r*0.7,py+r*0.7],fill=TC[t])
        d.ellipse([x-3,top-3,x+3,top+3],fill=(255,240,120))
    d.ellipse([10,10,40,40],fill=(255,220,90))
    return im

def poly():  # polyrhythm: 8 nested polygons, a dot per track running round, each corner a step
    im,d=new(); cx,cy=120,120; sides=[3,4,5,6,7,8,12,16]
    for t in range(7,-1,-1):
        r=22+t*13; n=sides[t]; ph=(0.37*(t+1))%1
        pts=[(cx+math.cos(2*math.pi*k/n-math.pi/2)*r,cy+math.sin(2*math.pi*k/n-math.pi/2)*r) for k in range(n)]
        d.polygon(pts,outline=dim(TC[t],.35))
        for k,p in enumerate(pts):
            hot=random.random()<.3
            d.ellipse([p[0]-2,p[1]-2,p[0]+2,p[1]+2],fill=TC[t] if hot else dim(TC[t],.4))
        s=ph*n; k=int(s); f=s-k; a,b=pts[k],pts[(k+1)%n]
        px,py=a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f
        d.ellipse([px-4,py-4,px+4,py+4],fill=WHITE,outline=TC[t])
    return im

def glyphs():  # falling glyph columns; each column a band of the spectrum, its speed = the band's level
    im,d=new(); f=F(10); sp=spectrum(20); ch="0123456789ABCDEF<>/+=*#"
    for c in range(20):
        x=c*12+1; head=int(sp[c]*22); col=TC[c*8//20]
        for r in range(head):
            k=r/head
            d.text((x,r*11),random.choice(ch),font=f,fill=WHITE if r==head-1 else dim(col,0.15+0.85*k))
    return im

def aquarium():  # a fish per track; it darts on its notes, bubbles rise with the level
    im,d=new()
    for y in range(240): d.line([0,y,239,y],fill=mix((0,40,70),(0,8,20),y/240))
    for x in range(0,240,4): d.line([x,226+2*math.sin(x/9),x,239],fill=(70,60,40))
    for x,h in ((30,90),(200,70),(215,110)):
        pts=[(x+6*math.sin(y/10),226-y) for y in range(h)]; d.line(pts,fill=(30,120,60),width=3)
    for t in range(8):
        x=20+random.random()*190; y=30+t*23; s=10+(t%4)*3; dirn=1 if t%2 else -1
        d.ellipse([x-s,y-s*0.55,x+s,y+s*0.55],fill=TC[t])
        tx=x-dirn*s; d.polygon([(tx,y),(tx-dirn*8,y-6),(tx-dirn*8,y+6)],fill=TC[t])
        ex=x+dirn*s*0.5; d.ellipse([ex-2,y-3,ex+1,y],fill=WHITE)
        for b in range(t%3+1): bx=x+dirn*s+dirn*3; by=y-8-b*9; d.ellipse([bx-2,by-2,bx+2,by+2],outline=(150,200,230))
    return im

def monitor():  # a heart monitor: a blip per beat, its height = the kick; one trace per bank
    im,d=new()
    for x in range(0,240,20): d.line([x,0,x,239],fill=(0,30,10))
    for y in range(0,240,20): d.line([0,y,239,y],fill=(0,30,10))
    def trace(y0,c,cut,amp):
        pts=[]
        for x in range(240):
            p=(x%60)
            v=0
            if p==28: v=-0.3
            elif p==30: v=1
            elif p==32: v=-0.5
            elif 40<p<48: v=0.15*math.sin((p-40)/8*math.pi)
            pts.append((x,y0-v*amp))
        d.line([q for q in pts if q[0]<cut],fill=c,width=2)
        d.line([q for q in pts if q[0]>cut+10],fill=dim(c,.35),width=1)
        d.ellipse([cut-3,pts[cut][1]-3,cut+3,pts[cut][1]+3],fill=WHITE)
    trace(80,(40,255,120),170,50); trace(170,TC[3],170,35)
    d.text((8,8),"♥ 124",font=F(16),fill=(40,255,120)); d.text((232,8),"BAR 9",font=F(11),fill=GREY,anchor="ra")
    return im

def chladni():  # sand on a plate settles into the pattern of the note being played
    im,d=new(); m,n=3,5
    for _ in range(9000):
        x,y=random.random(),random.random()
        v=math.cos(n*math.pi*x)*math.cos(m*math.pi*y)-math.cos(m*math.pi*x)*math.cos(n*math.pi*y)
        if abs(v)<0.12+0.02*random.random():
            px,py=int(10+x*220),int(10+y*220)
            d.point((px,py),fill=mix(TC[2],WHITE,random.random()*.5))
    d.rectangle([9,9,230,230],outline=(50,50,50))
    d.text((120,234),"A3",font=F(9),fill=GREY,anchor="mb")
    return im

def ledboard():  # a dot-matrix sign: the tempo and section scroll by, the spectrum lights the dots below
    im,d=new(); cell=6
    txt=Image.new("1",(80,8)); ImageDraw.Draw(txt).text((0,-2),"124 A",font=F(9),fill=1)
    for r in range(40):
        for c in range(40):
            x,y=c*cell+1,r*cell+1; on=None
            if 4<=r<12:
                tx=c-6
                if 0<=tx<80 and txt.getpixel((tx,r-4)): on=(255,60,40)
            if r>=16:
                v=spectrum(1)[0] if False else None
            d.ellipse([x,y,x+cell-2,y+cell-2],fill=on or (24,8,8))
    sp=spectrum(40)
    for c in range(40):
        h=int(sp[c]*22)
        for k in range(h):
            r=39-k; x,y=c*cell+1,r*cell+1
            col=(255,200,40) if k>15 else (255,120,30) if k>9 else (60,220,90)
            d.ellipse([x,y,x+cell-2,y+cell-2],fill=col)
    return im

if __name__=='__main__': run([(horizon,"HORIZON","a sun and a grid scrolling with the tempo; hills = spectrum"),
     (ripples,"RIPPLES","each note drops in the water: rings in its track's colour"),
     (garden,"GARDEN","a flower a track: grows with its level, blooms on notes"),
     (poly,"POLYRHYTHM","a shape per track; a dot runs round, corners = steps"),
     (glyphs,"GLYPHS","falling characters, a column a band, faster when louder"),
     (aquarium,"AQUARIUM","a fish a track: darts on its notes, bubbles with level"),
     (monitor,"MONITOR","a heart monitor: a blip a beat, taller on kicks"),
     (chladni,"CHLADNI","sand on a plate settles into the shape of the note"),
     (ledboard,"LED BOARD","a dot-matrix sign: tempo and section, spectrum below")],
    SCREENS+"visualiser-concepts-2.png", start=10)
