import math, random, sys
from PIL import Image, ImageDraw, ImageFont
random.seed(7)
W = 240
TC = [(40,116,255),(30,196,96),(255,188,24),(255,92,28),(120,168,255),(110,220,160),(255,216,120),(255,160,120)]
WHITE=(240,240,240); GREY=(70,70,70); DK=(28,28,28)
def F(sz,b=True):
    return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono%s.ttf"%("-Bold" if b else ""), sz)
def mix(a,b,k): return tuple(int(a[i]+(b[i]-a[i])*k) for i in range(3))
def dim(c,k): return mix((0,0,0),c,k)
def new(): im=Image.new("RGB",(W,W),(0,0,0)); return im, ImageDraw.Draw(im)
def spectrum(n):
    return [max(0.05, min(1, 0.9*math.exp(-((i/n-0.18)**2)/0.03)+0.45*math.exp(-((i/n-0.55)**2)/0.02)+0.25*random.random())) for i in range(n)]

# 1 RADAR: 8 concentric rings x 16 steps, playhead sweep
def radar():
    im,d=new(); cx=cy=120; ph=0.37
    pat=[[random.random()<p for _ in range(16)] for p in (.5,.25,.3,.6,.2,.35,.15,.3)]
    for t in range(7,-1,-1):
        r0=28+t*11; r1=r0+8
        for s in range(16):
            a0=-90+s*22.5+1.5; a1=a0+19.5
            on=pat[t][s]; frac=s/16
            age=(ph-frac)%1
            if on:
                c = WHITE if age<1/16 else dim(TC[t], 0.35+0.65*max(0,1-age*1.5))
            else: c=(22,22,22)
            d.pieslice([cx-r1,cy-r1,cx+r1,cy+r1],a0,a1,fill=c)
            d.pieslice([cx-r0,cy-r0,cx+r0,cy+r0],a0-1,a1+1,fill=(0,0,0))
    a=math.radians(-90+ph*360)
    for k in range(30):
        aa=a-math.radians(k*1.2)
        d.line([cx,cy,cx+math.cos(aa)*118,cy+math.sin(aa)*118],fill=dim((255,255,255),0.25*(1-k/30)))
    d.line([cx,cy,cx+math.cos(a)*118,cy+math.sin(a)*118],fill=WHITE,width=2)
    d.ellipse([cx-20,cy-20,cx+20,cy+20],fill=(0,0,0),outline=GREY)
    d.text((cx,cy),"3.2",font=F(14),fill=WHITE,anchor="mm")
    return im

# 2 NOTEFALL: notes rise from a keyboard, coloured by track
def notefall():
    im,d=new(); kb=208; kw=240/28
    for t in range(8):
        y=kb
        for _ in range(9):
            y-= random.randint(6,30)
            ln=random.randint(4,26)
            if y-ln<0: break
            k=random.randint(0,27) if t not in (3,7) else random.choice([2,4,6,9])
            x=k*kw
            d.rectangle([x+1,y-ln,x+kw-1,y],fill=dim(TC[t],max(.35,y/kb)))
            y-=ln
    for k in range(28):
        x=k*kw; lit=random.random()<.18
        d.rectangle([x,kb+2,x+kw-1,239],fill=(TC[random.randint(0,7)] if lit else (220,220,220)))
        d.line([x,kb+2,x,239],fill=(0,0,0))
    for k in range(28):
        if k%7 in (0,1,3,4,5):
            x=(k+1)*kw-kw*0.3
            d.rectangle([x,kb+2,x+kw*0.6,kb+20],fill=(10,10,10))
    d.line([0,kb,239,kb],fill=WHITE)
    return im

# 3 SKYLINE: spectrum buildings with windows, moon pulses on kick
def skyline():
    im,d=new()
    for i in range(60):
        d.point((random.randint(0,239),random.randint(0,120)),fill=(random.randint(60,200),)*3)
    d.ellipse([168,22,212,66],fill=(250,236,190)); d.ellipse([162,16,218,72],outline=(120,110,80))
    sp=spectrum(16); x=0
    for i,v in enumerate(sp):
        bw=15; h=int(30+v*150); top=225-h
        c=TC[i*4//16]
        d.rectangle([x,top,x+bw-2,225],fill=(14,14,20))
        d.line([x,top,x+bw-2,top],fill=c)
        for wy in range(top+5,222,7):
            for wx in range(x+3,x+bw-4,5):
                if random.random()<0.25+0.6*v: d.rectangle([wx,wy,wx+2,wy+3],fill=dim(c,0.6+0.4*random.random()))
        x+=bw
    d.rectangle([0,226,239,239],fill=(10,10,10))
    for i in range(0,240,24): d.rectangle([i+4,232,i+14,233],fill=(90,90,90))
    return im

# 4 TUNNEL: squares rush outward, spawned on beats, coloured by the track
def tunnel():
    im,d=new(); cx,cy=120,118
    for k in range(14,0,-1):
        z=(k/14)**2.2; s=4+z*130; t=k%8
        c=dim(TC[[3,0,3,1,3,2,3,4,3,5,3,6,3,7][k-1]], 0.25+0.75*z)
        tw=math.radians(k*6)
        pts=[(cx+s*math.cos(tw+a)*1.414, cy+s*math.sin(tw+a)*1.414) for a in (math.pi/4,3*math.pi/4,5*math.pi/4,7*math.pi/4)]
        d.polygon(pts,outline=c,width=max(1,int(z*4)))
    for a in range(0,360,45):
        r=math.radians(a+20); d.line([cx,cy,cx+math.cos(r)*200,cy+math.sin(r)*200],fill=(30,30,30))
    d.ellipse([cx-3,cy-3,cx+3,cy+3],fill=WHITE)
    return im

# 5 FIREWORKS: each note launches a burst, height = pitch, size = velocity/level
def fireworks():
    im,d=new()
    for x,y,t,r,age in [(50,60,0,38,.6),(150,45,2,30,.3),(190,120,3,26,.15),(95,130,5,22,.8),(120,80,6,14,.05),(30,150,7,18,.4)]:
        n=18
        for i in range(n):
            a=2*math.pi*i/n+random.random()*.2
            for j in range(4):
                rr=r*(0.55+j*0.15); fall=(j*j)*age*1.2
                px,py=x+math.cos(a)*rr, y+math.sin(a)*rr+fall
                d.rectangle([px-1,py-1,px,py],fill=dim(TC[t],(0.3+0.2*j)*(1-age*0.6)))
            d.point((x+math.cos(a)*r, y+math.sin(a)*r+9*age), fill=WHITE if age<.3 else TC[t])
    for x,h,t in [(70,170,1),(210,190,4)]:
        for k in range(10): d.point((x+random.randint(-1,1),h+k*4),fill=dim(TC[t],1-k/10))
        d.rectangle([x-1,h-2,x+1,h],fill=WHITE)
    d.rectangle([0,228,239,239],fill=(12,12,12))
    for i in range(8): d.rectangle([8+i*29,232,28+i*29,235],fill=dim(TC[i],.5+.5*random.random()))
    return im

# 6 RIDGES: stacked spectra scrolling back, hidden lines removed (mountain range)
def ridges():
    im,d=new(); rows=22
    for r in range(rows):
        y0=40+r*8.5; depth=r/rows
        pts=[]
        for x in range(20,221,3):
            u=(x-120)/100; env=math.exp(-(u*u)*3.5)
            n=sum(math.sin(x*f+r*p)*a for f,p,a in ((.07,1.3,1),(.19,.7,.6),(.41,2.1,.35)))
            h=env*(18+22*abs(n))*(0.6+0.8*random.random()**3)*(0.4+0.6*depth)
            pts.append((x,y0-h))
        d.polygon(pts+[(220,240),(20,240)],fill=(0,0,0))
        c=mix((50,50,60),WHITE,depth) if r!=rows-1 else TC[0]
        d.line(pts,fill=c,width=1 if r<rows-1 else 2)
    return im

# 7 WARP: starfield, speed = mix level, kick flashes, streak colour = track that hit
def warp():
    im,d=new(); cx,cy=120,120
    for i in range(140):
        a=random.random()*2*math.pi; r=random.random()**0.7*170; l=r*0.18
        t=random.randint(0,7) if random.random()<.25 else None
        c=WHITE if t is None else TC[t]; k=min(1,r/120)
        d.line([cx+math.cos(a)*r,cy+math.sin(a)*r,cx+math.cos(a)*(r+l),cy+math.sin(a)*(r+l)],fill=dim(c,0.2+0.8*k),width=1 if r<90 else 2)
    d.ellipse([cx-10,cy-10,cx+10,cy+10],outline=(60,60,80))
    d.text((6,6),"128",font=F(11),fill=GREY); 
    return im

# 8 KALEIDO: the scope wave mirrored round six axes
def kaleido():
    im,d=new(); cx,cy=120,120
    wave=[math.sin(i*.21)*0.5+math.sin(i*.53+1)*0.3+random.uniform(-.15,.15) for i in range(60)]
    for s in range(12):
        base=math.radians(s*30); flip=-1 if s%2 else 1
        prev=None
        for i,v in enumerate(wave):
            r=10+i*1.8; a=base+flip*v*0.28
            p=(cx+math.cos(a)*r,cy+math.sin(a)*r)
            if prev: d.line([prev,p],fill=TC[(i//8)%8],width=2)
            prev=p
    for rr,c in ((40,TC[3]),(75,TC[0]),(105,TC[1])):
        pts=[(cx+math.cos(math.radians(k*60+30))*rr,cy+math.sin(math.radians(k*60+30))*rr) for k in range(6)]
        d.polygon(pts,outline=dim(c,.5))
    return im

# 9 BOOP: a face; mouth = mix level, eyes blink on the beat, 8 "hair" spikes = tracks
def boop():
    im,d=new(); cx,cy=120,128
    lv=[.9,.4,.7,1,.2,.5,.3,.6]
    for t in range(8):
        a=math.radians(-160+t*20); r0=78; r1=r0+12+lv[t]*28
        d.line([cx+math.cos(a)*r0,cy+math.sin(a)*r0,cx+math.cos(a)*r1,cy+math.sin(a)*r1],fill=TC[t],width=7)
        d.ellipse([cx+math.cos(a)*r1-5,cy+math.sin(a)*r1-5,cx+math.cos(a)*r1+5,cy+math.sin(a)*r1+5],fill=TC[t])
    d.rounded_rectangle([cx-76,cy-70,cx+76,cy+78],28,fill=(245,240,230))
    d.ellipse([cx-46,cy-30,cx-18,cy+2],fill=(0,0,0)); d.ellipse([cx+18,cy-30,cx+46,cy+2],fill=(0,0,0))
    d.ellipse([cx-38,cy-24,cx-30,cy-16],fill=WHITE); d.ellipse([cx+26,cy-24,cx+34,cy-16],fill=WHITE)
    d.ellipse([cx-64,cy+8,cx-44,cy+20],fill=(255,150,150)); d.ellipse([cx+44,cy+8,cx+64,cy+20],fill=(255,150,150))
    d.rounded_rectangle([cx-28,cy+16,cx+28,cy+52],14,fill=(40,10,10))
    for i in range(14):
        x=cx-24+i*3.6; h=4+abs(math.sin(i*.9))*12
        d.line([x,cy+34-h,x,cy+34+h],fill=TC[3])
    d.text((cx,226),"BOOP!",font=F(12),fill=GREY,anchor="mm")
    return im

if __name__=='__main__':
    ITEMS=[(radar,"RADAR","8 rings × 16 steps; a sweep lights the notes as they play"),
           (notefall,"NOTEFALL","notes rise off a keyboard, in their track's colour"),
           (skyline,"SKYLINE","the spectrum as a city at night; the moon pulses on kicks"),
           (tunnel,"TUNNEL","a ring flies out on every beat, coloured by the track that hit"),
           (fireworks,"FIREWORKS","a burst per note: height = pitch, size = level"),
           (ridges,"RIDGES","the spectrum scrolling back as a range of hills"),
           (warp,"WARP","a starfield; speed = the mix, coloured streaks = notes"),
           (kaleido,"KALEIDO","the scope wave mirrored round twelve spokes"),
           (boop,"BOOP","a face: mouth = the mix, blinks on beats, tufts = tracks")]
    BG,BEZEL,TITLE,SUB=(28,28,32),(10,10,12),(236,236,240),(150,150,158)
    S,PAD,BZ,R=480,30,8,14
    def font(b,s): return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf"%("-Bold" if b else ""),s)
    cols=3; rows=3; cw=S+2*BZ; ch=cw+70
    sh=Image.new("RGB",(PAD+cols*(cw+PAD),PAD+rows*(ch+PAD//2)),BG); dd=ImageDraw.Draw(sh)
    for k,(fn,title,line) in enumerate(ITEMS):
        x,y=PAD+(k%cols)*(cw+PAD),PAD+(k//cols)*(ch+PAD//2)
        dd.rounded_rectangle([x,y,x+cw-1,y+cw-1],R,fill=BEZEL)
        sh.paste(fn().resize((S,S),Image.NEAREST),(x+BZ,y+BZ))
        dd.text((x,y+cw+14),f"{k+1}  {title}",font=font(True,21),fill=TITLE)
        dd.text((x,y+cw+42),line,font=font(False,16),fill=SUB)
    sh.save(sys.argv[1],optimize=True); print(sh.size)
