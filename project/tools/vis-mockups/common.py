import math, os, random, sys
from pathlib import Path
SCREENS = str(Path(__file__).resolve().parents[2] / 'assets' / 'screens') + '/'   # where the sheets go
WORK = os.environ.get('VIS_WORK', '/tmp/vis-mockups') + '/'                       # the song, the stills
os.makedirs(WORK, exist_ok=True)
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

