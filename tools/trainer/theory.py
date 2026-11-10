# SPDX-License-Identifier: GPL-3.0-only
"""The TRAINER's "why" pages: what each step does in terms of music, by topic. HOME held during a level opens the
topic of the step you are on; SELECT turns its pages (tools/trainer/lessons.py says which topic each step has).

Each topic: a title (up to 22 characters) and pages; each page a paragraph, wrapped to the screen by lessons.py (it
fails when a page does not fit: about 10 lines of 28 characters). Written in plain words, for someone who has never
studied music: what you are doing, why it sounds the way it does, and the idea to take to other songs."""

TOPICS = {
    # ---------------------------------------------------------------- the parts of a track
    "PARTS": ("TRACKS ARE PARTS", [
        "A song is a few parts playing together, each with a job. The drums keep time. The bass holds the ground "
        "and says which chord we are on. Chords fill the middle. A melody or hook sits on top and is what you hum.",
        "Each of the FM-1's tracks plays one part. Giving every part its own track lets you change its sound, "
        "its rhythm and its volume without touching the others, and mute it to take it out of the song.",
    ]),
    "SOUNDS": ("SOUND IS STYLE", [
        "The same notes on a different sound can be a different genre. A dusty, soft kit and a warm electric "
        "piano say lo-fi; bright saws and big drums say synthwave; a sub bass and a heavy kit say dubstep.",
        "Pick sounds that do not fight: one sound low and round for the bass, something soft for chords, "
        "something clear and short for a melody. Contrast between the parts makes each one easier to hear.",
    ]),
    "GRID": ("STEPS, BEATS, BARS", [
        "Most pop, dance and hip hop is in 4/4: four beats to a bar. You count 1 2 3 4, 1 2 3 4. The drum grid "
        "splits one bar into 16 steps, four steps for each beat.",
        "So the beats fall on steps 1, 5, 9 and 13: those are the keys you would clap on. The steps between are "
        "the 'ands' and 'e's of the count (1 e and a 2 e and a...). Placing a sound on or between the beats is "
        "what makes a rhythm feel steady or bouncy.",
    ]),
    # ---------------------------------------------------------------- level 1: lo-fi
    "KICK": ("THE KICK", [
        "The kick drum is the low thump that drives the groove. A kick on step 1, the first beat, tells the "
        "listener where each bar starts.",
        "Steps 8 and 11 are not on a beat: they land just before beat 3 and after it. Hitting off the beat is "
        "called syncopation. It gives hip hop its lazy bounce, because your ear expects beat 3 and the kick "
        "comes a little early instead.",
    ]),
    "BACKBEAT": ("THE BACKBEAT", [
        "The snare on beats 2 and 4 (steps 5 and 13) is the backbeat. It is the snap you clap along to in "
        "almost every pop, rock, hip hop and R&B song.",
        "Kick on the strong beats and snare on the weak ones makes a push and pull: boom, clap, boom, clap. "
        "Layering a clap on the snare (level 2) makes that backbeat wider and brighter.",
    ]),
    "HATS": ("HI-HATS KEEP TIME", [
        "The hi-hat is the ticking that fills the space between kick and snare. On every other step it plays "
        "eighth notes: 1 and 2 and 3 and 4 and. That steady pulse is what you feel as the tempo.",
        "Hats only on the offbeats (steps 3, 7, 11, 15, the 'ands') give the classic disco and synthwave lift: "
        "each hat answers a kick. An open hat rings longer than a closed one and pushes the energy up.",
    ]),
    "TEMPO": ("TEMPO AND FEEL", [
        "Tempo is the speed of the beat, in beats per minute (BPM). Each style lives in a range: lo-fi and "
        "boom bap around 70-90, synthwave around 80-120, house about 120-128, dubstep about 140-150.",
        "A slower tempo leaves space between notes and feels relaxed; a faster one feels urgent. Dubstep at 150 "
        "uses half-time drums, so it feels like 75: fast hats over a slow, heavy beat.",
    ]),
    "SWING": ("SWING", [
        "Swing delays every second note of a pair a little, so even notes become long-short, long-short. "
        "Straight eighths sound like a machine; swung ones sound like a person playing.",
        "Lo-fi and boom bap lean on swing for their laid-back, slightly drunk feel. The hook gets the same swing "
        "as the drums so the two lock together instead of rubbing.",
    ]),
    "KEY": ("THE KEY", [
        "A key is the note a song feels at home on, called the tonic, plus the set of notes that sound right "
        "with it. First Light is in A, Neon Avenue and Lanterns in D.",
        "Setting the key here makes the keys and chords follow it, so what you play stays in the song's notes. "
        "Melodies and bass lines that end on the tonic sound finished; ending elsewhere sounds like a question.",
    ]),
    "MINOR": ("MAJOR AND MINOR", [
        "A scale is the set of seven notes a key uses. The major scale sounds bright and settled; the natural "
        "minor scale sounds darker, moodier or more wistful. All three songs here are in minor.",
        "The difference is a few notes: minor lowers the 3rd, 6th and 7th steps of the scale. A minor uses "
        "only the white keys from A to A. D minor is the same pattern from D, with one black key, B flat.",
    ]),
    "VALUES": ("NOTE VALUES", [
        "A step does not have to be a sixteenth. DIV sets how long each step lasts: a quarter note is one beat, "
        "an eighth half a beat, a sixteenth a quarter of a beat, and 1BAR a whole bar.",
        "LEN is how many steps the pattern has. Together they set how long it is: 16 quarters, 32 eighths or "
        "4 one-bar steps all last four bars. Slow parts like chords use long steps; busy parts use short ones.",
    ]),
    "BASS1": ("A BASS LINE", [
        "This bass line plays the root of each chord, the note the chord is named after: A under A minor, D "
        "under D minor, F under F major, E under E minor. That is the bass's main job: naming the chord.",
        "The repeated notes (A A, F F) and the G at the end are for movement: G walks up to the A at the start "
        "of the loop, so the end leads back to the beginning. Lines that step toward the next chord feel smooth.",
    ]),
    "GATE": ("NOTE LENGTH (GATE)", [
        "GATE is how long each note is held, as a share of its step. Short notes (staccato) leave gaps and feel "
        "punchy and rhythmic. Long notes (legato) join up and feel smooth and full.",
        "Bass and pads usually want long notes so the low end and the harmony never drop out. Stabs and plucks "
        "want short ones so the rhythm is clear. Over 100% a note overlaps the next and they blend.",
    ]),
    "SEVENTH": ("SEVENTH CHORDS", [
        "A chord is notes stacked in steps of a third: root, third, fifth. That three-note chord is a triad. "
        "Add one more third on top, the seventh, and you get a seventh chord.",
        "Sevenths sound softer, richer and a bit jazzy: they are the sound of lo-fi, neo-soul and jazz. Chord "
        "mode builds the whole chord from one key, always using the song's scale, so every chord fits the key.",
    ]),
    "PROG1": ("i - iv - VI - v", [
        "The four chords are A minor 7, D minor 7, F major 7 and E minor 7. Numbered by where they start in the "
        "A minor scale, that is i - iv - VI - v (small numbers are minor chords, big ones major).",
        "i is home, iv moves away, VI brightens (a major chord inside a minor key), and v leans back toward "
        "home so the loop wants to start again. One chord a bar, round and round: a very common lo-fi loop.",
    ]),
    "REGISTER": ("REGISTER: HIGH AND LOW", [
        "Register is how high or low a part sits. Parts that share a register blur together; spread out, each "
        "can be heard. A good default: bass low, chords in the middle, melody on top.",
        "That is why the chords go an octave down and the hook an octave up. An octave is the same note at "
        "double or half the pitch: same name, same role, a different place in the mix.",
    ]),
    "SPACE": ("REVERB: SPACE", [
        "Reverb is the sound of a room: the reflections after a note. A little puts a part in a space; a lot "
        "pushes it far away. Dry sounds feel close and in your face.",
        "Use more reverb on soft, sustained parts (pads, keys, piano) and less on bass and kick, which turn "
        "muddy with it. Different amounts on different parts give the mix depth, front to back.",
    ]),
    "PENTA": ("THE PENTATONIC HOOK", [
        "The hook uses only five notes: A C D E G, the A minor pentatonic scale. It leaves out the two notes "
        "of the scale that can clash with the chords, so almost any order sounds good over this loop.",
        "That is why pentatonic melodies are everywhere, from blues to pop to video games. The hook starts high "
        "on E and steps down to A, the tonic: a falling line that comes home at the end.",
    ]),
    "ECHO": ("DELAY: ECHOES", [
        "Delay repeats a sound after a set time. FDBK is how many times it repeats; TIME is the gap. Timed to "
        "the beat, the echoes become part of the rhythm.",
        "1/8D is a dotted eighth, three sixteenths long. Echoes on dotted eighths land between the notes you "
        "played, so a simple line sounds busy and rolling: the classic synthwave and U2 guitar trick.",
    ]),
    "MUTES": ("ARRANGING WITH MUTES", [
        "A loop gets boring if everything plays all the time. Arranging is choosing which parts play when. "
        "Starting thin and adding parts builds energy; taking parts away gives the ear a rest.",
        "Muting while the loop plays is how DJs and producers perform live: chords and hook first as an intro, "
        "then drums and bass come in, then everything. Each change feels like a new section.",
    ]),
    "DONE1": ("WHAT YOU MADE", [
        "A lo-fi hip hop loop: a syncopated kick, a backbeat, swung hats, a bass on the chord roots, four "
        "seventh chords (i - iv - VI - v in A minor), and a pentatonic hook with echo and room.",
        "Those pieces work in most styles. Change the tempo, the kit and the swing and the same ideas become "
        "boom bap, R&B or chillhop.",
    ]),
    # ---------------------------------------------------------------- level 2: synthwave
    "FLOOR": ("FOUR ON THE FLOOR", [
        "A kick on every beat (steps 1, 5, 9, 13) is called four on the floor. It is the steady heartbeat of "
        "disco, house, techno and synthwave: easy to dance to, because every beat is marked.",
        "With the kick that busy, the other drums mark the rest: the backbeat snare on 2 and 4, hats on the "
        "offbeats between the kicks.",
    ]),
    "DYNAMICS": ("ACCENTS AND GHOSTS", [
        "Dynamics are how loud each hit is. Real drummers never hit every note the same: some are accented, "
        "some are soft ghost notes. That rise and fall is what makes a pattern feel alive.",
        "A hard snare makes the backbeat crack. Ghost hats fill the gaps without crowding them. An accented "
        "note in a bass or lead stresses the start of a phrase or the last note before the loop comes round.",
    ]),
    "ROLL": ("ROLLS AND RATCHETS", [
        "A ratchet plays one step as several fast hits. A short roll at the end of a bar is a fill: it tells "
        "the listener something is coming and leads them into the next bar.",
        "Drummers do the same with a quick snare or hat flam before the 1. Keep fills short and at the ends of "
        "bars or phrases, so the groove itself stays steady.",
    ]),
    "BASS2": ("THE OCTAVE BASS", [
        "Synthwave bass often bounces between a note and the same note an octave up, every eighth: D low, D "
        "high, D low... It drives the song forward like an engine.",
        "The notes are the chord roots again, one bar each: D, B flat, F, C. With 32 eighth-note steps the "
        "pattern is four bars long, one bar for each chord. The accent on the very last note kicks the loop over.",
    ]),
    "PROG2": ("i - VI - III - VII", [
        "D minor, B flat major, F major, C major: i - VI - III - VII in D minor. Three major chords after a minor "
        "one make it sound hopeful and big. It is one of the most used progressions in pop and film music.",
        "The chords are inversions: B flat played as D F B flat, F as C F A. Their notes move as little as "
        "possible from chord to chord (voice leading), so the pad glides instead of jumping around.",
    ]),
    "PADS": ("PADS", [
        "A pad is a soft, held sound that fills the middle of the mix, like strings in an orchestra. Each chord "
        "lasts a whole bar, so the pad is the bed everything else sits on.",
        "Long notes, a slow attack or lots of reverb make a pad smooth; it should be heard as a colour more than "
        "as notes. Short, busy parts on top stand out clearly against it.",
    ]),
    "ARP": ("ARPEGGIOS", [
        "An arpeggio plays a chord's notes one at a time instead of together. The pluck plays D, A, F, A, C... "
        "notes of D minor and the chords around it, on sixteenths.",
        "Arpeggios add motion and sparkle without new harmony, and they are a signature of synth music. Panned "
        "left, with echoes, the pluck fills the space without covering the lead.",
    ]),
    "MIX": ("BALANCE AND PAN", [
        "Mixing is setting each part's level and place. Pan places a part left or right in the stereo field; "
        "level sets how loud it is. Parts that would cover each other become clear when they are apart.",
        "Keep the kick, bass and lead in the middle, they carry the song. Move supporting parts (plucks, pads, "
        "percussion) to the sides and a little quieter. The loudest part is the one the listener follows.",
    ]),
    "SECTIONS": ("VERSE AND CHORUS", [
        "Songs repeat sections so the listener can learn them, and change between sections to stay interesting. "
        "The verse sets the mood; the chorus is the big moment with the hook.",
        "Here both use the same chords and bass, so they belong together. The chorus adds a lead melody and "
        "busier drums. Patterns let each track keep both versions and switch between them in time.",
        "On the PATTERNS page the white keys are the pads: keys 1 to 8 play the track's patterns 1 to 8, on the bar. "
        "The lit key is the pattern playing; a blinking one waits for its moment.",
    ]),
    "SCENES": ("SCENES", [
        "A scene is one moment of the song: a pattern for every track, played together. Scene 1 is the verse "
        "(every track on pattern 1), scene 2 the chorus (every track on pattern 2).",
        "White keys 9 to 16 launch scenes 1 to 8 on any of the three pages: every track changes at once, on the "
        "bar. That is how you play a song live: verse, chorus, verse.",
    ]),
    "CHAINS": ("CHAINS", [
        "A chain plays a track's patterns in order, each for its repeats, then starts again. Verse beat x3, then "
        "the chorus beat once: the drums play a fill every fourth bar, by themselves.",
        "Fills mark the end of a phrase: four bars is the most common phrase length, so a change in bar 4 tells "
        "the listener something new is coming.",
    ]),
    "OPENHAT": ("OPEN HATS AND FILLS", [
        "Turning the closed offbeat hats into open hats makes the chorus wider and more energetic without "
        "changing the beat. Small changes in the drums are often all a new section needs.",
        "The soft low tom on step 15 is a tiny fill: a lower sound right before the 1 pulls the ear into the "
        "next bar.",
    ]),
    "LEAD": ("A LEAD MELODY", [
        "The lead plays the chorus melody. Its first note in each bar is a chord tone: D over D minor, F over "
        "B flat, C over F, E over C. Chord tones on strong beats sound stable; other notes between them add movement.",
        "The accents on each bar's first note shape the phrase, like stressed syllables in a sentence. Repeating "
        "a short idea with small changes is what makes a melody catchy.",
    ]),
    "DONE2": ("WHAT YOU MADE", [
        "A synthwave song with a verse and a chorus: four on the floor with a backbeat, an octave bass, a pad "
        "playing i - VI - III - VII with voice leading, an arpeggio with dotted echoes, and a lead in the chorus.",
        "Launching scenes is how you play a song's parts live on the FM-1; a chain varies one track by itself. "
        "Level 3 saves the parts as sections and puts them in order.",
    ]),
    # ---------------------------------------------------------------- level 3: melodic dubstep
    "HALFTIME": ("HALF-TIME", [
        "At 150 BPM, a snare on beats 2 and 4 would feel frantic. Dubstep puts it on beat 3 only (step 9). "
        "That halves the feel: the music moves at 150, but the beat lands like 75.",
        "That is half-time: fast hats and details over a slow, heavy groove. The kick on 1 and just after 3 "
        "(step 11) leaves room for the bass, which carries the weight.",
    ]),
    "CRASH": ("MARKING THE ONE", [
        "A crash cymbal on the first beat of a phrase announces a new section, like a capital letter starts a "
        "sentence. Here it hits once every four bars.",
        "Music is built in phrases of 4 and 8 bars. Marking the start of each one helps the listener feel the "
        "shape of the song even when nothing else changes.",
    ]),
    "SUB": ("SUB BASS", [
        "A sub bass is almost a pure low tone: you feel it as much as hear it. One long D, the root of the "
        "chord, held through the whole bar, fills the bottom of the drop.",
        "With a sub that big, other parts stay out of the low end. The side-chain pump (later) ducks the music "
        "under each kick so kick and sub take turns instead of fighting.",
    ]),
    "STABS": ("STABS AND THE ENVELOPE", [
        "A stab is a short, punchy chord hit. The rhythm here is syncopated (steps 1, 4, 7, 9, 13, 15): the "
        "chords dance around the beat instead of sitting on it.",
        "The envelope shapes each note: ATTACK is how fast it starts, RELEASE how fast it fades after. Attack 0 "
        "and a short release make the chord start instantly and stop clean: the stab.",
    ]),
    "PUMP": ("THE SIDE-CHAIN PUMP", [
        "DUCK turns the synths down on every kick and lets them swell back. The mix breathes in time: the "
        "pumping sound of EDM, house and dubstep.",
        "It also makes room: the kick punches through because everything else steps aside for a moment. "
        "Producers call it side-chain compression, after the studio trick that first made it.",
    ]),
    "ONECHORD": ("ONE CHORD, MANY PARTS", [
        "This whole song stays on one chord, D minor: D, F, A. Nothing changes key or harmony, yet it does not "
        "feel static, because the parts change around it.",
        "Rhythm (stabs, piano), length (the long pad, the sub), register (sub low, piano middle) and space "
        "(reverb) all vary. When harmony stays put, texture and arrangement carry the song.",
    ]),
    "RISER": ("RISERS AND TENSION", [
        "A riser is a sound that climbs in pitch, brightness or volume. Over bars 3 and 4 it builds anticipation "
        "for what comes next, the way a drum roll does.",
        "Its note is G, the 4th above D: not in the D minor chord, so it hangs unresolved. Tension that is "
        "released when the next section lands is the engine of every build and drop.",
    ]),
    "BUILD": ("THE BUILD", [
        "The build is the section before the drop. Its job is tension: a kick on every beat, a snare roll that "
        "speeds up bar by bar (quarters, eighths, sixteenths, then ratchets), and a filter opening.",
        "Getting faster and brighter tells the listener a big moment is coming. Then the drop arrives and all "
        "that energy lands at once.",
    ]),
    "BREAK": ("THE BREAK", [
        "After a drop, the break takes things away: just hats, the pad and the sub. Space lets the listener "
        "breathe and makes the next drop hit harder by contrast.",
        "Contrast is the point of sections: loud against quiet, busy against sparse, full against thin.",
    ]),
    "FILTER": ("THE FILTER SWEEP", [
        "A low-pass filter cuts the high frequencies and makes a sound darker. Opening it slowly brings the "
        "brightness back: the pad gets clearer and more exciting as the bar goes on.",
        "A lock sets the filter on one step; SLIDE glides to it over the step, so the whole bar sweeps. Sweeps "
        "are one of the main tools of builds in electronic music.",
    ]),
    "FORM": ("SONG FORM", [
        "A song is sections in order. Here: A the intro (piano alone), B the build, C the drop, D the break. The "
        "song plays A4 B4 C8 D8 B4 C8 A4: bars of each.",
        "Intro, build, drop, break, build, drop, outro is the shape of most EDM. Sections last 4 or 8 bars, "
        "so changes land where the listener expects them. Ending on the intro brings the song full circle.",
    ]),
    "DONE3": ("WHAT YOU MADE", [
        "A melodic dubstep track on one chord: half-time drums, a sub, stabs pumping under the kick, piano, pad, "
        "a riser, a build with a roll and a filter sweep, and four sections in a song.",
        "Holding SAVE and tapping keys 1 to 4 plays the sections live, so you can perform it differently every "
        "time.",
    ]),
}
