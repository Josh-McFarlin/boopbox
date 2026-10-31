from common import *
def run(ITEMS,out,start=1):
    BG,BEZEL,TITLE,SUB=(28,28,32),(10,10,12),(236,236,240),(150,150,158)
    S,PAD,BZ,R=480,30,8,14
    def font(b,s): return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf"%("-Bold" if b else ""),s)
    cols=3; rows=3; cw=S+2*BZ; ch=cw+70
    sh=Image.new("RGB",(PAD+cols*(cw+PAD),PAD+rows*(ch+PAD//2)),BG); dd=ImageDraw.Draw(sh)
    for k,(fn,title,line) in enumerate(ITEMS):
        x,y=PAD+(k%cols)*(cw+PAD),PAD+(k//cols)*(ch+PAD//2)
        dd.rounded_rectangle([x,y,x+cw-1,y+cw-1],R,fill=BEZEL)
        sh.paste(fn().resize((S,S),Image.NEAREST),(x+BZ,y+BZ))
        dd.text((x,y+cw+14),f"{k+start}  {title}",font=font(True,21),fill=TITLE)
        dd.text((x,y+cw+42),line,font=font(False,16),fill=SUB)
    sh.save(out,optimize=True); print(sh.size)
    