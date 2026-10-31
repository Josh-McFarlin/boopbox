from common import mix, dim, WHITE, F
PINK=(230,50,170); CYAN=(40,220,255)
def car(d, cx=120, by=224, kick=False):
    """a low retro sports car seen from behind; on a kick the tail lights flare and light the road"""
    red=(255,50,60) if kick else (190,20,40)
    if kick:                                            # the glow of the tail lights on the road
        for k in range(6):
            d.line([cx-46-k*4,by+2+k*2,cx+46+k*4,by+2+k*2],fill=mix((25,15,40),(150,20,40),0.6-k*0.1))
    d.ellipse([cx-56,by-6,cx+56,by+6],fill=(6,0,12))                       # shadow
    for s in (-1,1):                                                         # tyres
        d.rectangle([cx+s*44-(0 if s>0 else 12),by-12,cx+s*44+(12 if s>0 else 0),by],fill=(10,6,14))
    d.polygon([(cx-50,by-30),(cx+50,by-30),(cx+48,by-10),(cx-48,by-10)],fill=(46,16,72))   # rear panel
    d.polygon([(cx-48,by-10),(cx+48,by-10),(cx+44,by-4),(cx-44,by-4)],fill=(28,8,46))     # bumper
    d.line([cx-50,by-30,cx+50,by-30],fill=CYAN)                                            # rim light
    d.line([cx-50,by-30,cx-48,by-10],fill=dim(CYAN,.5)); d.line([cx+50,by-30,cx+48,by-10],fill=dim(CYAN,.5))
    for i in range(10):                                                      # the full-width light bar, louvred
        x=cx-44+i*9; d.rectangle([x,by-26,x+7,by-20],fill=red)
        d.line([x,by-23,x+7,by-23],fill=dim(red,.6))
    if kick:
        d.rectangle([cx-46,by-27,cx+46,by-19],outline=(255,120,130))
    d.rectangle([cx-12,by-17,cx+12,by-11],fill=(230,230,240))               # number plate
    d.text((cx,by-14),"BOOP",font=F(6),fill=(20,10,30),anchor="mm")
    for s in (-1,1):                                                         # exhausts
        d.ellipse([cx+s*24-3,by-9,cx+s*24+3,by-5],fill=(70,70,80)); d.ellipse([cx+s*24-2,by-8,cx+s*24+2,by-6],fill=(10,10,10))
    d.polygon([(cx-38,by-31),(cx+38,by-31),(cx+26,by-46),(cx-26,by-46)],fill=(30,10,50))    # cabin
    for k in range(13):                                                      # the rear window: the sunset in it
        y=by-44+k; w=24+k*0.85
        d.line([cx-w,y,cx+w,y],fill=mix((255,190,80),(200,40,150),k/13))
    d.line([cx-26,by-46,cx+26,by-46],fill=CYAN)
    d.rectangle([cx-54,by-36,cx+54,by-33],fill=(36,12,58),outline=dim(CYAN,.7))   # wing
    for s in (-1,1): d.rectangle([cx+s*36-1,by-33,cx+s*36+1,by-30],fill=(36,12,58))
