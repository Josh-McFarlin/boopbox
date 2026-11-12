import random, sys, textwrap
from PIL import Image, ImageDraw, ImageFont
import iso as c8, notes2 as c9
import concepts as c1, more as c2, scenic as c3, gaps as c4, gaps2 as c5, synth as c6, notes_sw as c7
def font(b,s): return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf"%("-Bold" if b else ""),s)
CH="chosen"; NEW="new"
ROWS=[
 ("WAVEFORM","the mix's wave, sample for sample","replaces OSCILLOSCOPE, CIRCLE's ring",
  "Covered by PALMS: draw its front wave exactly",
  [(c3.palms,20,"PALMS",CH,"front wave made exact"),(c6.surf,48,"SURF"),(c6.runner,49,"HIGHWAY"),(c6.mirage,46,"MIRAGE"),
   (c6.wavegrid,47,"WAVE GRID"),(c4.sunscope,30,"SUNSET SCOPE"),(c4.crt,28,"CRT"),(c4.neon,29,"NEON"),(c4.seismo,31,"PLOTTER"),
   (c5.ocean,38,"OCEAN"),(c5.vhs,39,"VHS"),(c5.coaster,40,"COASTER"),(c5.ribbon,37,"RIBBON")]),
 ("KICKS","a flash or a swell on every kick","replaces CIRCLE's swell",
  "Covered by NIGHT DRIVE: its tail lights flash",
  [(c3.drive,19,"NIGHT DRIVE",CH,"new car: lights flare"),(c6.surf,48,"SURF","","sun pulses"),(c6.runner,49,"HIGHWAY","","headlights flare"),
   (c6.mirage,46,"MIRAGE","","sun's rays flare"),(c3.lasercity,27,"LASER CITY","","searchlights flash"),(c1.skyline,3,"SKYLINE","","moon pulses"),
   (c2.monitor,16,"MONITOR","","taller blip"),(c1.warp,7,"WARP","","the screen flashes"),(c5.vhs,39,"VHS","","fringes jolt"),
   (c5.ocean,38,"OCEAN","","spray"),(c4.neon,29,"NEON","","tube buzzes")]),
 ("SPECTRUM","32 bands, 40 Hz to 10 kHz, with falling caps","replaces SPECTRUM",
  "Covered three times: add 32 bands and caps",
  [(c2.horizon,10,"HORIZON",CH,"hills: add caps"),(c3.drive,19,"NIGHT DRIVE",CH,"city: add caps"),(c3.flyover,21,"FLYOVER",CH,"mesh: add caps"),
   (c2.ledboard,18,"LED BOARD"),(c1.skyline,3,"SKYLINE"),(c1.ridges,6,"RIDGES"),(c2.glyphs,14,"GLYPHS"),(c3.aurora,22,"AURORA")]),
 ("LEVELS","8 tracks + master, peak holds, yellow and red zones","replaces VU METERS",
  "Covered by DENSE CITY B: 24 floors, as VU METERS",
  [(c8.densecity2,69,"DENSE CITY B",CH,"lit floors = level"),(c8.densecity,68,"DENSE CITY","","height = level"),(c6.lanes,51,"LANES","","24 segments, gentler"),(c8.isocity,65,"ISO CITY"),(c8.isostreet,66,"ISO STREET"),(c8.isostack,67,"ISO STACK"),(c6.neoncity,50,"NEON CITY"),(c6.sunslice,54,"SUNSLICE"),(c6.peaks,52,"PEAKS"),
   (c6.lasers,53,"LASERS"),(c4.pillars,34,"PILLARS"),(c4.towers,33,"TOWERS"),(c4.console,36,"CONSOLE"),(c4.tubes,35,"TUBES"),
   (c4.needles,32,"NEEDLES"),(c5.sunburst,41,"SUNBURST"),(c5.blocks,42,"BLOCKS"),(c5.fountains,43,"FOUNTAINS"),
   (c5.balloons,44,"BALLOONS"),(c5.striker,45,"STRIKER")]),
 ("NOTES & PITCH","every track's notes, their pitch, drum or synth","replaces BOUNCE, WIRES",
  "Covered by KEY CITY",
  [(c9.keycity,64,"KEY CITY",CH,"skyline = keyboard"),(c9.laserharp,62,"LASER HARP",NEW,"a beam per key"),(c9.billboard,60,"BILLBOARD",NEW,"note names"),(c9.highrise,59,"HIGHRISE",NEW,"note x octave"),(c9.sundial,58,"SUNDIAL",NEW,"a pitch clock"),(c9.constellation,61,"CONSTELLATIONS",NEW,"melody lines"),(c9.neonstaff,63,"NEON STAFF",NEW,"sheet music"),(c7.roadroll,55,"ROAD ROLL","","road = piano roll"),(c7.skyroll,56,"SKY ROLL","","shooting stars, height = pitch"),
   (c7.neonkeys,57,"NEON KEYS","","notes rise off neon keys"),(c1.notefall,2,"NOTEFALL"),(c1.fireworks,5,"FIREWORKS","","height = pitch")]),
]
T=200; G=16; PER=8; LW=300; PAD=30; TH=T+50
BG=(28,28,32); BEZ=(10,10,12); TIT=(236,236,240); SUB=(150,150,158); GOLD=(255,196,40); GRN=(80,220,120); NEWC=(80,200,255); OPEN=(255,110,90)
H=PAD+70
for r in ROWS: H+=((len(r[4])+PER-1)//PER)*TH+40
W=PAD+LW+PER*(T+G)+PAD
im=Image.new("RGB",(W,H),BG); d=ImageDraw.Draw(im)
d.text((PAD,PAD),"Pick one design per row",font=font(True,30),fill=TIT)
d.text((PAD+420,PAD+10),"★ chosen   ● new   every design shown covers its row's data fully (some with the change noted)",font=font(False,17),fill=SUB)
y=PAD+70
for name,what,rep,status,opts in ROWS:
    d.line([PAD,y-14,W-PAD,y-14],fill=(60,60,66))
    d.text((PAD,y),name,font=font(True,24),fill=TIT)
    yy=y+34
    for line in textwrap.wrap(what,32)+textwrap.wrap(rep,32):
        d.text((PAD,yy),line,font=font(False,15),fill=SUB); yy+=20
    yy+=10
    for line in textwrap.wrap(status,28):
        d.text((PAD,yy),line,font=font(True,15),fill=GRN); yy+=20
    for i,o in enumerate(opts):
        fn,num,label=o[:3]; tag=o[3] if len(o)>3 else ""; note=o[4] if len(o)>4 else ""
        random.seed(num*7919)
        x=PAD+LW+(i%PER)*(T+G); ty=y+(i//PER)*TH
        col=GOLD if tag==CH else NEWC if tag==NEW else BEZ
        d.rounded_rectangle([x-4,ty-4,x+T+3,ty+T+3],8,fill=col)
        im.paste(fn().resize((T,T),Image.LANCZOS),(x,ty))
        pre="★ " if tag==CH else "● " if tag==NEW else ""
        d.text((x,ty+T+8),f"{pre}{num} {label}",font=font(True,14),fill=GOLD if tag==CH else NEWC if tag==NEW else TIT)
        if note: d.text((x,ty+T+27),note,font=font(False,12),fill=SUB)
    y+=((len(opts)+PER-1)//PER)*TH+40
im.save(sys.argv[1],optimize=True); print(im.size)
