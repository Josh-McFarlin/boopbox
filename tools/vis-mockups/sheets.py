"""The sheets drawn from several scripts: the notes-and-pitch sheet, the isometric and dense cities, and the
final six (stills of the animation at bar 6: run anim.py first).
  python3 sheets.py"""
from common import SCREENS, WORK
from PIL import Image
from sheet import run
import notes2 as n, iso


def crop(path, h):
    im = Image.open(path)
    im.crop((0, 0, im.width, h)).save(path)


run([(n.sundial, "SUNDIAL", "the sun as a pitch clock: notes flare out at their note"),
     (n.highrise, "HIGHRISE", "a tower of keys: column = note, floor = octave"),
     (n.billboard, "BILLBOARD", "a roadside sign: each track's note by name"),
     (n.constellation, "CONSTELLATIONS", "each track's melody as stars joined in its colour"),
     (n.laserharp, "LASER HARP", "a beam per key fires up in the colour of the track"),
     (n.neonstaff, "NEON STAFF", "notes on a neon music staff across the sunset"),
     (n.keycity, "KEY CITY", "the skyline as a keyboard: a tower lights for its note")],
    SCREENS + "visualiser-concepts-notes.png", start=58)
run([(iso.isocity, "ISO CITY", "a zigzag city block: height = level, master in the middle"),
     (iso.isostreet, "ISO STREET", "towers down a street: lit floors = level"),
     (iso.isostack, "ISO STACK", "BLOCKS as buildings: floor slabs, one at the peak")],
    SCREENS + "visualiser-concepts-iso.png", start=65)
crop(SCREENS + "visualiser-concepts-iso.png", 600)
run([(iso.densecity, "DENSE CITY", "packed block: height = level, an outline at the peak"),
     (iso.densecity2, "DENSE CITY B", "packed block: lit floors = level, white floor = peak"),
     (iso.isocity, "ISO CITY", "the last version, for comparison")],
    SCREENS + "visualiser-concepts-dense-city.png", start=68)
crop(SCREENS + "visualiser-concepts-dense-city.png", 600)
L = lambda k: (lambda: Image.open(WORK + f"still-{k}.png").convert("RGB"))
run([(L("palms"), "PALMS", "the waveform: the sea's front wave, sample for sample"),
     (L("night-drive"), "NIGHT DRIVE", "kicks flare the lights; city = spectrum; road = the beat"),
     (L("horizon"), "HORIZON", "the spectrum: a neon range over a dance floor"),
     (L("flyover"), "FLYOVER", "the spectrum over time: a terrain, bass in the middle"),
     (L("dense-city-b"), "DENSE CITY B", "levels: 24 floors, peak holds; searchlights on the beat"),
     (L("key-city"), "KEY CITY", "notes and pitch: a tower a key, in perspective")],
    SCREENS + "visualiser-final-six.png")
crop(SCREENS + "visualiser-final-six.png", 1195)
