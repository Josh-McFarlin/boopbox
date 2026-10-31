from PIL import Image, ImageDraw
from common import *
from scenic import sky, stars, sun, PINK, CYAN, SUNA, SUNB
random.seed(8)
LV=[.82,.55,.68,.95,.3,.6,.42,.74]; PK=[.9,.7,.75,.98,.45,.66,.6,.8]; MLV,MPK=.88,.96
SKYA,SKYB=(10,0,30),(110,20,90); FLOOR=(8,0,18); MW=(235,235,255)
def val(t): return (MLV,MPK,MW) if t==8 else (LV[t],PK[t],TC[t])
def zone(c,f,n): return (255,60,50) if f>=n*22/24 else (255,200,40) if f>=n*18/24 else c
SWEEP=0.0; NOSUN=False
def bg(hz=150):
    im,d=new(); sky(d,SKYA,SKYB,hz); stars(d,50,hz-50)
    if NOSUN:                                   # searchlights behind the city, sweeping with the beat
        for bx,ph in ((70,0.0),(170,1.6)):
            a=math.radians(-90+28*math.sin(SWEEP*math.pi/2+ph)); L=260
            ex,ey=bx+math.cos(a)*L,hz+40+math.sin(a)*L; px,py=-math.sin(a)*14,math.cos(a)*14
            d.polygon([(bx,hz+40),(ex+px,ey+py),(ex-px,ey-py)],fill=mix(SKYB,(255,255,255),0.16))
            d.line([(bx,hz+40),(ex,ey)],fill=mix(SKYB,(255,255,255),0.3))
        for k in range(4): d.line([0,hz-k*3,239,hz-k*3],fill=mix(SKYB,(255,80,170),0.25-k*0.05))
    else: sun(d,120,70,40)
    d.rectangle([0,hz,239,239],fill=FLOOR); return im,d
def lerp(a,b,u): return (a[0]+(b[0]-a[0])*u, a[1]+(b[1]-a[1])*u)
def up(p,h): return (p[0],p[1]-h)
def tower(d,cx,cy,w,H,n,lit,pk,c,floors=None,ghost=None):
    """an isometric tower: ground diamond centred (cx,cy), half-width w, height H; n floors, `lit` of them lit, peak floor pk"""
    N,E,S,W=(cx,cy-w/2),(cx+w,cy),(cx,cy+w/2),(cx-w,cy)
    d.polygon([W,S,up(S,H),up(W,H)],fill=(24,6,46)); d.polygon([S,E,up(E,H),up(S,H)],fill=(14,2,30))
    fh=H/n
    for f in range(n):
        on=f<lit; col=zone(c,f,n) if on else (40,14,64)
        if f==pk and pk>=lit and pk>0: col=WHITE
        for (A,B,shade) in ((W,S,1.0),(S,E,0.7)):
            for k in range(3):
                u0=(k+0.2)/3; u1=(k+0.8)/3
                p0=up(lerp(A,B,u0),f*fh+fh*0.25); p1=up(lerp(A,B,u1),f*fh+fh*0.25)
                q0=up(p0,fh*0.5); q1=up(p1,fh*0.5)
                d.polygon([p0,p1,q1,q0],fill=dim(col,shade) if on or col==WHITE else col)
    d.polygon([up(N,H),up(E,H),up(S,H),up(W,H)],fill=(30,8,56),outline=c)
    d.line([W,up(W,H)],fill=dim(c,.6)); d.line([S,up(S,H)],fill=c); d.line([E,up(E,H)],fill=dim(c,.6))
    if ghost is not None:
        g=[up(N,ghost),up(E,ghost),up(S,ghost),up(W,ghost)]; d.polygon(g,outline=WHITE)

def isocity():  # a zigzag city block, two rows deep, so no tower hides another: 8 towers and a white master in the middle; height = level, a white outline at the peak
    im,d=bg(110)
    ox,oy,cw=120,124,25
    def P(gx,gy): return (ox+(gx-gy)*cw, oy+(gx+gy)*cw/2)
    for k in range(-1,7):
        d.line([P(k-0.5,-1.5),P(k-0.5,5.5)],fill=(110,20,100)); d.line([P(-1.5,k-0.5),P(5.5,k-0.5)],fill=(110,20,100))
    spots=[(0,4),(0,3),(1,3),(1,2),(2,2),(2,1),(3,1),(3,0),(4,0)]
    order=[0,1,2,3,8,4,5,6,7]
    items=sorted(zip(spots,order),key=lambda z:z[0][0]+z[0][1])
    for (gx,gy),t in items:
        v,p,c=val(t); cx,cy=P(gx,gy); n=14; H=8+v*92; w=11
        tower(d,cx,cy,w,H,n,n,-1,c)
        if p>v+0.02:
            gh=8+p*92; N,E,S,W=(cx,cy-w/2),(cx+w,cy),(cx,cy+w/2),(cx-w,cy)
            d.polygon([up(N,gh),up(E,gh),up(S,gh),up(W,gh)],outline=WHITE)
    for (gx,gy),t in items:
        cx,cy=P(gx,gy); d.text((cx,cy+14),"M" if t==8 else str(t+1),font=F(9),fill=val(t)[2],anchor="mm")
    return im

def isostreet():  # a row of towers down an isometric street, 8 and a master at the end: each tower's lit floors = level, red near the top, a white floor at the peak
    im,d=bg(120)
    for k in range(10):
        a=(8+k*24,128+k*11); d.line([a,(a[0]+40,a[1]-20)],fill=(110,20,100))
    d.line([(0,150),(239,270)],fill=PINK,width=2)
    for t in range(9):
        v,p,c=val(t); cx=20+t*24; cy=124+t*11; n=16
        tower(d,cx,cy,14,112,n,int(v*n),int(p*n),c)
    for t in range(9):
        c=val(t)[2]; d.text((22+t*24,140+t*11),"M" if t==8 else str(t+1),font=F(8),fill=c,anchor="mm")
    return im

def isostack():  # BLOCKS as buildings: each tower is a stack of floor slabs, yellow then red near the top; one slab floats at the peak; a white master
    im,d=bg(140)
    for k in range(-6,12):
        d.line([(k*30,250),(k*30+200,150)],fill=(90,16,90))
    for t in range(9):
        v,p,c=val(t); cx=14+t*26; cy=220-t*4; n=16; n_on=int(v*n); pk=int(p*n); sh=8
        for f in range(n_on):
            col=zone(c,f,n); y=cy-f*sh
            N,E,S,W=(cx,y-6),(cx+11,y),(cx,y+6),(cx-11,y)
            d.polygon([W,S,up(S,sh-2),up(W,sh-2)],fill=dim(col,.85)); d.polygon([S,E,up(E,sh-2),up(S,sh-2)],fill=dim(col,.55))
            d.polygon([up(N,sh-2),up(E,sh-2),up(S,sh-2),up(W,sh-2)],fill=mix(col,WHITE,.25))
            for wx in (-7,-3):
                d.line([(cx+wx,y+3+wx*0.5-sh+4),(cx+wx,y+wx*0.5-sh+6)],fill=dim(col,.4))
        if pk>n_on:
            y=cy-pk*sh; N,E,S,W=(cx,y-6),(cx+11,y),(cx,y+6),(cx-11,y)
            d.polygon([W,S,up(S,sh-2),up(W,sh-2)],fill=(220,220,230)); d.polygon([S,E,up(E,sh-2),up(S,sh-2)],fill=(170,170,190))
            d.polygon([up(N,sh-2),up(E,sh-2),up(S,sh-2),up(W,sh-2)],fill=WHITE)
        d.text((cx,cy+16),"M" if t==8 else str(t+1),font=F(9),fill=c,anchor="mm")
    return im

def _dense(fixed):
    im,d=bg(104)
    ox,oy,cw=120,122,25
    def P(gx,gy): return (ox+(gx-gy)*cw, oy+(gx+gy)*cw/2)
    gl=Image.new("RGBA",(240,240),(0,0,0,0)); gd=ImageDraw.Draw(gl)      # the ground grid, only below the horizon
    for k in range(-3,9):
        gd.line([P(k-0.5,-3.5),P(k-0.5,7.5)],fill=(90,16,90,255)); gd.line([P(-3.5,k-0.5),P(7.5,k-0.5)],fill=(90,16,90,255))
    gd.rectangle([0,0,239,104],fill=(0,0,0,0)); im.paste(gl,(0,0),gl)
    spots=[(0,4),(0,3),(1,3),(1,2),(2,2),(2,1),(3,1),(3,0),(4,0)]
    order=[0,1,2,3,8,4,5,6,7]
    data=dict(zip(spots,order))
    rnd=random.Random(5)
    cells=[]
    for gx in range(-3,7):
        for gy in range(-3,7):
            s=gx+gy
            if (gx,gy) in data: cells.append((s,gx,gy,'data'))
            elif s<=3 and s>=-2 and -5<=gx-gy<=5: cells.append((s,gx,gy,'back'))
            elif s>=5 and s<=7 and -5<=gx-gy<=5: cells.append((s,gx,gy,'front'))
    for s,gx,gy,kind in sorted(cells):
        cx,cy=P(gx,gy); w=12
        if kind=='back':
            H=rnd.randint(18,62)+(3-s)*4
            if abs(cx-120)<60: H=min(H,int(cy-58)) if cy-58>8 else 8
            n=max(2,int(H/7))
            N,E,S,W=(cx,cy-w/2),(cx+w,cy),(cx,cy+w/2),(cx-w,cy)
            d.polygon([W,S,up(S,H),up(W,H)],fill=(20,6,40)); d.polygon([S,E,up(E,H),up(S,H)],fill=(12,2,26))
            d.polygon([up(N,H),up(E,H),up(S,H),up(W,H)],fill=(28,8,50),outline=(70,24,100))
            for f in range(n):
                for (A,B) in ((W,S),(S,E)):
                    for k in range(3):
                        if rnd.random()<.18:
                            p=up(lerp(A,B,(k+.5)/3),f*7+3); d.rectangle([p[0]-1,p[1]-2,p[0],p[1]],fill=rnd.choice([(255,190,90),(120,200,255),(255,110,180)]))
        elif kind=='front':
            H=rnd.randint(5,10)
            N,E,S,W=(cx,cy-w/2),(cx+w,cy),(cx,cy+w/2),(cx-w,cy)
            d.polygon([W,S,up(S,H),up(W,H)],fill=(26,8,48)); d.polygon([S,E,up(E,H),up(S,H)],fill=(16,4,32))
            d.polygon([up(N,H),up(E,H),up(S,H),up(W,H)],fill=(36,12,62),outline=(80,30,110))
            if rnd.random()<.5: d.line([up(lerp(W,S,.2),H*.5),up(lerp(W,S,.8),H*.5)],fill=rnd.choice([PINK,CYAN]))
        else:
            t=data[(gx,gy)]; v,p,c=val(t); n=24 if fixed else 14
            if fixed:
                tower(d,cx,cy,w,100,n,int(v*n),int(p*n),c)
            else:
                H=8+v*92; tower(d,cx,cy,w,H,n,n,-1,c)
                if p>v+0.02:
                    gh=8+p*92; N,E,S,W=(cx,cy-w/2),(cx+w,cy),(cx,cy+w/2),(cx-w,cy)
                    d.polygon([up(N,gh),up(E,gh),up(S,gh),up(W,gh)],outline=WHITE)
    for (gx,gy),t in data.items():
        cx,cy=P(gx,gy); d.text((cx,cy+13),"M" if t==8 else str(t+1),font=F(9),fill=WHITE if t==8 else val(t)[2],anchor="mm")
    return im
def densecity(): return _dense(False)
def densecity2(): return _dense(True)
