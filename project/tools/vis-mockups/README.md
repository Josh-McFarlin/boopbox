# Visualiser mockups

The Python scripts that drew the visualiser designs in `assets/screens/` (`visualiser-concepts-*.png`,
`visualiser-picker.png`, `visualiser-final-six.png`, `night-drive-motion.gif`) and the videos in
`assets/screens/visualiser-animations/`. They are mockups, drawn with Pillow at the FM-1's 240 × 240; the
firmware draws the chosen six itself (`firmware/src/ui_vis.c`). They keep the layouts, colours and timings the
firmware follows.

Needs Python 3 with Pillow and NumPy; the videos need `ffmpeg`. Run from this folder:

| Script | Makes |
| --- | --- |
| `concepts.py OUT.png` | sheet 1 (1–9) |
| `more.py`, `scenic.py`, `gaps.py`, `gaps2.py`, `synth.py` | sheets 2–6 (10–54) |
| `song.py` | the example song (`$VIS_WORK/song.wav`, default `/tmp/vis-mockups`) |
| `anim.py ../../assets/screens/visualiser-animations` | the six animated with the song: a video each and all six (after `song.py`) |
| `anim_h.py OUT.mp4` | four ideas for HORIZON's ground |
| `sheets.py` | the notes-and-pitch, isometric and dense-city sheets, and the final six (stills from `anim.py`) |
| `picker.py OUT.png` | the picker: a row per kind of data |
| `drive_gif.py` | NIGHT DRIVE in motion (a GIF) |

The analysis in `anim.py` follows `ui_vis.c`: the scope's rising zero crossing and auto-scale, the 32 bands of a
512-point Hann FFT over 60 dB, the tracks' peaks over 48 dB with the VU fall (3 % a frame) and the one-second
peak hold.
