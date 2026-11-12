from common import *
from scenic import sky, stars, sun, grid, PINK, CYAN, SUNA, SUNB
random.seed(4)
SKYA,SKYB=(10,0,30),(110,20,90); FLOOR=(8,0,18); GRID=(170,30,140)
DRUM=(3,7)   # tracks 4 and 8 are the drum machines by default

def roadroll():  # NIGHT DRIVE's road as a piano roll: notes ride towards you, across = pitch, colour = track; drums on the shoulders
    hz=96; im,d=new(); sky(d,SKYA,SKYB,hz); stars(d,40,60); sun(d,120,hz-12,34,clip=hz)
    d.rectangle([0,hz,239,239],fill=FLOOR)
    def X(u,y): k=(y-hz)/(239-hz); return 120+u*(10+k*150)
    d.polygon([(X(-1,hz),hz),(X(1,hz),hz),(X(1,239),239),(X(-1,239),239)],fill=(22,8,44))
    for k in range(25):
        u=-1+k/12; d.line([X(u,hz),hz,X(u,239),239],fill=(48,14,70) if k%12 else (110,30,120))
    d.line([X(-1,hz),hz,X(-1,239),239],fill=PINK,width=2); d.line([X(1,hz),hz,X(1,239),239],fill=PINK,width=2)
    for _ in range(26):
        t=random.choice([0,1,2,4,5,6]); p=random.randint(0,23); y0=random.uniform(hz+6,226); ln=random.uniform(.06,.2)*(y0-hz+20)
        u0=-1+p/12; u1=u0+1/12
        y1=min(236,y0+ln); d.polygon([(X(u0,y0)+1,y0),(X(u1,y0)-1,y0),(X(u1,y1)-1,y1),(X(u0,y1)+1,y1)],fill=TC[t])
    for side in (-1,1):
        t=DRUM[0] if side<0 else DRUM[1]
        for y in (120,150,196):
            d.polygon([(X(side*1.06,y),y),(X(side*1.2,y),y),(X(side*1.2,y+8),y+8),(X(side*1.06,y+8),y+8)],fill=TC[t])
    for k in range(24):
        u0=-1+k/12; lit=k in (5,14,19)
        d.polygon([(X(u0,228),228),(X(u0+1/12,228),228),(X(u0+1/12,239),239),(X(u0,239),239)],
                  fill=TC[random.choice([0,2,5])] if lit else ((235,235,240) if k%12 not in (1,3,6,8,10) else (30,20,40)),outline=(0,0,0))
    return im

def skyroll():  # shooting stars across the sunset: height = pitch (an octave a line), colour = track, the newest at the right; drums flash on the horizon
    hz=196; im,d=new(); sky(d,SKYA,SKYB,hz); stars(d,50,hz-20); sun(d,120,hz,40,clip=hz)
    d.rectangle([0,hz,239,239],fill=FLOOR); grid(d,hz,GRID,n=4,fan=30)
    for o in range(1,5): y=hz-o*40; d.line([0,y,239,y],fill=(70,20,90))
    d.line([214,10,214,hz],fill=(120,60,140))
    for _ in range(30):
        t=random.choice([0,1,2,4,5,6]); pitch=random.randint(4,175); x1=random.randint(10,214); ln=random.randint(8,40)
        y=hz-pitch
        for k in range(ln): d.point((x1-k,y),fill=dim(TC[t],1-k/ln))
        d.line([x1-ln//3,y,x1,y],fill=TC[t],width=2)
        if x1>205: d.ellipse([x1-3,y-3,x1+3,y+3],fill=WHITE)
    for i,t in enumerate(DRUM):
        for k in range(6):
            x=16+k*36+i*18; d.ellipse([x-3,hz-3,x+3,hz+3],fill=TC[t] if (k+i)%2 else dim(TC[t],.35))
    return im

def neonkeys():  # a neon keyboard lying on the grid; notes rise from their keys into the sunset as bars in the track's colour; drum pads at the sides
    hz=90; im,d=new(); sky(d,SKYA,SKYB,hz); stars(d,30,50); sun(d,120,hz-8,36,clip=hz)
    d.rectangle([0,hz,239,239],fill=FLOOR); grid(d,hz,dim(GRID,.5),n=6,fan=30)
    kb=196; n=24; kw=200/n; x0=20
    for _ in range(22):
        t=random.choice([0,1,2,4,5,6]); k=random.randint(0,n-1); y1=random.randint(hz+10,kb-6); ln=random.randint(8,40)
        x=x0+k*kw; d.rectangle([x+1,max(hz,y1-ln),x+kw-1,y1],fill=dim(TC[t],0.4+0.6*(y1-hz)/(kb-hz)))
    for k in range(n):
        x=x0+k*kw; black=k%12 in (1,3,6,8,10); lit=k in (4,9,16)
        c=TC[[0,2,5][[4,9,16].index(k)]] if lit else ((30,20,50) if black else (230,225,240))
        d.rectangle([x,kb,x+kw-1,kb+(18 if black else 30)],fill=c,outline=PINK if not black else (0,0,0))
    for i,t in enumerate(DRUM):
        x=2 if i==0 else 222; d.rounded_rectangle([x,kb,x+15,kb+30],3,fill=TC[t],outline=WHITE)
    d.line([0,kb-1,239,kb-1],fill=CYAN)
    return im
