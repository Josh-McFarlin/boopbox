from common import *
from scenic import sky, stars, sun, grid, PINK, CYAN, SUNA, SUNB
random.seed(12)
SKYA,SKYB=(10,0,30),(110,20,90); FLOOR=(8,0,18); GRID=(170,30,140)
DRUM=(3,7); SYN=[0,1,2,4,5,6]
NAMES=["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"]
def scene(hz,sr=40,sy=None,st=40):
    im,d=new(); sky(d,SKYA,SKYB,hz); stars(d,st,hz-30)
    if sr: sun(d,120,sy or hz-10,sr,clip=hz)
    d.rectangle([0,hz,239,239],fill=FLOOR); return im,d

def sundial():  # the sun as a pitch clock: a note flares out of the sun at its note's angle (C at the top), longer for higher octaves
    im,d=scene(200,0,st=60); cx,cy,r=120,104,40
    for k in range(12):
        a=math.radians(-90+k*30); d.line([cx+math.cos(a)*(r+4),cy+math.sin(a)*(r+4),cx+math.cos(a)*92,cy+math.sin(a)*92],fill=(50,14,70))
        d.text((cx+math.cos(a)*102,cy+math.sin(a)*100),NAMES[k],font=F(9),fill=(140,90,160),anchor="mm")
    for t,k,o,age in [(0,0,1,.1),(1,4,2,.4),(2,7,3,.0),(4,9,2,.6),(5,2,4,.2),(6,11,3,.3),(0,7,1,.8)]:
        a=math.radians(-90+k*30); L=r+6+o*11
        d.line([cx+math.cos(a)*(r+2),cy+math.sin(a)*(r+2),cx+math.cos(a)*L,cy+math.sin(a)*L],fill=dim(TC[t],1-age*.7),width=5)
        d.ellipse([cx+math.cos(a)*L-4,cy+math.sin(a)*L-4,cx+math.cos(a)*L+4,cy+math.sin(a)*L+4],fill=WHITE if age<.2 else TC[t])
    sun(d,cx,cy,r,gaps=True)
    grid(d,200,GRID,n=4,fan=30)
    for i,t in enumerate(DRUM):
        for k in range(4): x=20+k*60+i*30; d.ellipse([x-4,197,x+4,203],fill=TC[t] if k%2==i else dim(TC[t],.3))
    return im

def highrise():  # a neon tower whose windows are the keys: a column per note of the octave, a floor per octave; a window lights in the colour of the track playing it
    im,d=scene(214,46,120,50)
    x0,x1=36,204; cols=12; floors=7; ww=(x1-x0)/cols; fh=24; top=214-floors*fh-6
    d.rectangle([x0-4,top-10,x1+4,214],fill=(14,4,32),outline=PINK)
    d.line([120,top-10,120,top-30],fill=(150,150,170)); d.ellipse([117,top-34,123,top-28],fill=(255,40,60))
    lit={(0,3):0,(4,3):1,(7,4):2,(2,5):4,(9,4):5,(11,2):6,(7,3):0,(0,2):1}
    for f in range(floors):
        for c in range(cols):
            x=x0+c*ww; y=214-(f+1)*fh
            blk=c in (1,3,6,8,10)
            col=TC[lit[(c,f)]] if (c,f) in lit else ((26,8,46) if blk else (44,16,70))
            d.rectangle([x+2,y+4,x+ww-2,y+fh-3],fill=col)
        d.text((x0-8,214-(f+1)*fh+fh/2),str(f+1),font=F(8),fill=(120,80,150),anchor="rm")
    for c in range(cols):
        if len(NAMES[c])==1: d.text((x0+c*ww+ww/2,top-4),NAMES[c],font=F(8),fill=(120,80,150),anchor="mm")
    for i,t in enumerate(DRUM):
        x=12 if i==0 else 222; d.line([x,214,x,180],fill=(90,90,110),width=2); d.ellipse([x-6,172,x+6,184],fill=TC[t])
    return im

def billboard():  # a roadside billboard: each track's note by name, lit on each new note; the drum tracks show the sound hit
    im,d=scene(190,40,170,40)
    d.polygon([(110,190),(130,190),(239,239),(0,239)],fill=(25,15,40)); d.line([110,190,0,239],fill=PINK,width=2); d.line([130,190,239,239],fill=PINK,width=2)
    d.rectangle([14,18,226,166],fill=(10,0,24),outline=CYAN,width=2)
    for x in (40,200): d.rectangle([x-2,166,x+2,194],fill=(60,40,80))
    vals=["C3","E4","G4","KICK","A3","D5","B4","SNARE"]; fresh=[1,0,1,1,0,0,1,0]
    for t in range(8):
        cx=20+(t%4)*52; cy=26+(t//4)*70
        d.rectangle([cx,cy,cx+46,cy+62],fill=(20,6,40) if not fresh[t] else dim(TC[t],.25),outline=dim(TC[t],.8))
        d.text((cx+4,cy+3),str(t+1),font=F(9),fill=TC[t])
        sz=18 if len(vals[t])<4 else 11
        d.text((cx+23,cy+36),vals[t],font=F(sz),fill=WHITE if fresh[t] else TC[t],anchor="mm")
    return im

def constellation():  # each track's melody as a constellation: a star per note, height = pitch, joined in its colour, drifting left; drums twinkle on the horizon
    im,d=scene(206,30,206,90)
    for o in range(1,5): y=206-o*44; d.line([0,y,239,y],fill=(50,16,70)); d.text((4,y-2),f"C{o+1}",font=F(7),fill=(110,70,140),anchor="lb")
    for t in (0,2,5,6):
        x=random.randint(0,30); y=random.randint(40,180); pts=[]
        while x<230:
            pts.append((x,y)); x+=random.randint(14,34); y=max(20,min(196,y+random.choice([-22,-11,-6,0,6,11,22])))
        d.line(pts,fill=dim(TC[t],.5))
        for i,(px,py) in enumerate(pts):
            s=2 if i<len(pts)-1 else 4
            d.ellipse([px-s,py-s,px+s,py+s],fill=TC[t] if i<len(pts)-1 else WHITE)
    grid(d,206,GRID,n=3,fan=30)
    for i,t in enumerate(DRUM):
        for k in range(5): x=14+k*50+i*24; d.line([x-4,206,x+4,206],fill=TC[t]); d.line([x,202,x,210],fill=TC[t])
    return im

def laserharp():  # a laser harp on the grid: a beam per key across two octaves; a beam fires up in the colour of the track that plays it
    im,d=scene(150,44,120,60)
    grid(d,150,dim(GRID,.6),n=6,fan=30)
    n=24; x0=12; w=216/n
    lit={3:0,7:2,10:1,15:4,19:5,22:6,12:0}
    for k in range(n):
        x=x0+k*w+w/2; blk=k%12 in (1,3,6,8,10)
        if k in lit:
            c=TC[lit[k]]; d.line([x,206,x,10],fill=dim(c,.35),width=6); d.line([x,206,x,10],fill=c,width=2); d.line([x,206,x,10],fill=WHITE,width=1) if k in (7,19) else None
        else: d.line([x,206,x,130],fill=(60,20,80) if blk else (90,30,110))
        d.rectangle([x-3,206,x+3,214],fill=(30,20,40) if blk else (200,200,215))
    d.rectangle([x0-2,214,x0+218,218],fill=PINK)
    for i,t in enumerate(DRUM):
        x=4 if i==0 else 232; d.rectangle([x,150,x+4,218],fill=TC[t] if i==0 else dim(TC[t],.3))
    return im

def neonstaff():  # a neon music staff across the sunset sky: notes appear on it as glowing heads (treble and bass), scrolling left; drums on a rhythm line below
    im,d=scene(212,30,212,40)
    def staff(y0):
        for k in range(5): d.line([16,y0+k*10,234,y0+k*10],fill=(200,120,220))
    staff(40); staff(120)
    d.text((22,62),"𝄞",font=F(30),fill=(230,150,240),anchor="mm") if False else d.text((18,64),"G",font=F(16),fill=(230,150,240),anchor="lm")
    d.text((18,140),"F",font=F(16),fill=(230,150,240),anchor="lm")
    d.line([200,30,200,170],fill=(255,255,255))
    for _ in range(18):
        t=random.choice(SYN); x=random.randint(40,198); st=random.choice((40,120)); step=random.randint(-2,10); y=st+40-step*5
        d.ellipse([x-5,y-4,x+5,y+4],fill=TC[t]); d.line([x+5,y,x+5,y-22],fill=TC[t])
        if step<0 or step>8:
            for ly in range(st+50, y+1, 10) if step<0 else range(st-10, y-1, -10): d.line([x-8,ly,x+8,ly],fill=(200,120,220))
    d.line([16,186,234,186],fill=(120,60,140))
    for i,t in enumerate(DRUM):
        for k in range(8): x=40+k*20+i*10; d.rectangle([x,182-i*6,x+4,186-i*6],fill=TC[t])
    return im

def keycity():  # NIGHT DRIVE's skyline as a keyboard: tall towers are the white keys, short dark ones the black keys; a tower lights in the colour of the track playing its note
    hz=200; im,d=scene(hz,50,150,50)
    n=14; w=240/n; lit={2:0,4:2,9:5,11:1}; blit={3:4,8:6}
    for k in range(n):
        x=k*w; h=110+12*math.sin(k*1.3)+(30 if k%7 in (0,4) else 0)
        c=TC[lit[k]] if k in lit else None
        d.rectangle([x+1,hz-h,x+w-2,hz],fill=dim(c,.35) if c else (22,6,44),outline=c or (70,24,100))
        for wy in range(int(hz-h)+6,hz-4,7):
            for wx in (x+4,x+9):
                d.point((wx,wy),fill=c if c else ((70,30,100) if random.random()<.7 else SUNA))
        if c: d.rectangle([x+1,hz-h-3,x+w-2,hz-h],fill=WHITE)
    for k in range(n-1):
        if k%7 in (2,6): continue
        x=(k+1)*w-5; h=60+8*math.sin(k)
        c=TC[blit[k]] if k in blit else None
        d.rectangle([x,hz-h,x+9,hz],fill=dim(c,.5) if c else (8,0,20),outline=c or (50,14,70))
    grid(d,hz,GRID,n=4,fan=30)
    for i,t in enumerate(DRUM):
        for k in range(4): x=10+k*60+i*30; d.ellipse([x-3,hz+16,x+3,hz+22],fill=TC[t] if (k+i)%2 else dim(TC[t],.3))
    return im
