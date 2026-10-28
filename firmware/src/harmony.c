/* SPDX-License-Identifier: GPL-3.0-only */
/* Harmony: one key, one scale and one chord for the song, which the synth tracks that follow it (t->hfol) play their
 * sequenced notes in. The chord is a degree of the key's scale (I .. VII): from a progression (up to NHPROG chords, a
 * number of bars each, round, while playing and G_HPROG is on), or played live (the CHORDS screen's keys, latched:
 * harm.live), else I.
 *   FOLLOW TRANS: a note moves by the key's distance from the track's own ROOT (the key it was written in), then by
 *                 the chord root's semitones (chromatic: the pattern's shape kept exactly)
 *   FOLLOW SCALE: a note moves by the key's distance from the track's ROOT, is put into the scale (the nearest scale
 *                 tone below), then moves the chord's number of scale degrees (diatonic: a I triad becomes the scale's
 *                 own ii, IV ...)
 * Changes of the key, the scale and the chord take hold on a boundary (G_HQ: NOW, the next beat, the next bar), once a
 * block before the tracks' steps (harm_block): a note keeps the pitch it started with, and its note-off is that note's
 * (seq.c keeps the notes it started in seq_notes). Only the sequencer's notes move (steps, their ratchets, the step
 * components' notes); the keys, the arp and MIDI in play as they are. Drum tracks never follow. Bounded: a note is
 * moved with at most 12 x 8 scale lookups; nothing allocated; the ISR on core 0. */
enum { HF_OFF, HF_TRANS, HF_SCALE, HF_COUNT };   /* track_t.hfol */
enum { HQ_NOW, HQ_BEAT, HQ_BAR };                /* G_HQ */
#define NHPROG 8
typedef struct { uint8_t deg, bars; } hchord_t; /* a chord of the progression: its degree 0..6 (I..VII), 1..16 bars */
static struct {
    uint8_t n;                                   /* the progression's chords, 1..NHPROG */
    hchord_t c[NHPROG];
    uint8_t key, scl, deg;                       /* in force now (harm_block): the key 0..11, the scale, the chord's degree */
    uint8_t idx;                                 /* the progression's chord the song is on */
    volatile uint8_t live;                       /* a chord played live (the CHORDS screen's keys): degree + 1, 0 = none */
    uint32_t beat;                               /* the beat (clk_beat) last seen while playing */
    uint8_t seen;                                /* (beat is set) */
} harm;
static const char *const H_ROMAN[7] = {"I", "II", "III", "IV", "V", "VI", "VII"};

static void harm_defaults(void)                 /* one chord, I for 4 bars; C major (the key and scale are G_HKEY, G_HSCL) */
{
    uint32_t i;
    harm.n = 1;
    for (i = 0; i < NHPROG; i++)
        harm.c[i].deg = 0, harm.c[i].bars = 4;
    harm.live = 0;
    harm.idx = 0;
}
static int harm_default(void)                   /* the progression and the live chord as harm_defaults leaves them */
{
    uint32_t i;
    if (harm.n != 1u || harm.live)
        return 0;
    for (i = 0; i < NHPROG; i++)
        if (harm.c[i].deg || harm.c[i].bars != 4u)
            return 0;
    return 1;
}
static uint32_t harm_mask(uint32_t scl)         /* the scale's notes, a bit a semitone from the root (CHR: all) */
{
    uint32_t m = SCALE_MASK[scl < NSCALES ? scl : 1u] & 0xFFFu;
    return m ? m : 0xFFFu;
}
static int harm_in(uint32_t mask, int32_t key, int32_t n)   /* note n is in the scale of that key */
{
    return (int)((mask >> (uint32_t)((n - key + 1200) % 12)) & 1u);
}
/* the semitones from the key's root to the root of degree deg (0..6) of the scale (a scale of fewer notes: round) */
static int32_t harm_deg_semis(uint32_t scl, uint32_t deg)
{
    uint32_t mask = harm_mask(scl), s, d = 0;
    if (!deg)
        return 0;
    for (s = 1; d < deg && s < 12u * 8u; s++)
        if ((mask >> (s % 12u)) & 1u) {
            d++;
            if (d == deg)
                return (int32_t)s;
        }
    return 0;
}
/* the chord the song wants now: live, else the progression's at bar `bar` (while playing, PROG on), else I */
static uint32_t harm_want(uint32_t bar, int playing)
{
    uint32_t i, tot = 0, pos;
    if (harm.live)
        return (harm.live - 1u) % 7u;
    if (!song.g[G_HPROG] || !harm.n)
        return 0;
    for (i = 0; i < harm.n && i < NHPROG; i++)
        tot += harm.c[i].bars ? harm.c[i].bars : 1u;
    if (!playing || !tot) {
        harm.idx = 0;
        return harm.c[0].deg % 7u;
    }
    pos = bar % tot;
    for (i = 0; i + 1u < harm.n && i + 1u < NHPROG; i++) {
        uint32_t b = harm.c[i].bars ? harm.c[i].bars : 1u;
        if (pos < b)
            break;
        pos -= b;
    }
    harm.idx = (uint8_t)i;
    return harm.c[i].deg % 7u;
}
/* once a block, before the tracks' steps (events_block): the key, the scale and the chord on their boundary */
static void harm_block(void)
{
    uint32_t q = (uint32_t)clamp(song.g[G_HQ], HQ_NOW, HQ_BAR), due;
    int playing = song.playing != 0;
    if (!playing) {
        harm.seen = 0;
        due = 1;
    } else {
        uint32_t nb = !harm.seen || clk_beat != harm.beat;
        due = q == HQ_NOW || (nb && (q == HQ_BEAT || !(clk_beat & 3u) || !harm.seen));
        harm.beat = clk_beat;
        harm.seen = 1;
    }
    if (due) {
        harm.key = (uint8_t)((uint32_t)clamp(song.g[G_HKEY], 0, 11));
        harm.scl = (uint8_t)((uint32_t)clamp(song.g[G_HSCL], 0, NSCALES - 1));
        harm.deg = (uint8_t)harm_want(clk_beat / 4u, playing);
    }
}
/* note as track t plays it in the harmony now (t->hfol) */
static uint32_t harm_note(const track_t *t, uint32_t note)
{
    int32_t n = (int32_t)note, kd, key = harm.key;
    uint32_t mode = (uint32_t)t->hfol, mask, guard;
    if (mode == HF_OFF || mode >= HF_COUNT || is_drum(t))
        return note;
    kd = (key - t->p[P_ROOT] + 1200) % 12;
    if (kd > 6)
        kd -= 12;                                /* (the nearer way: up to a fifth down, a tritone up) */
    n += kd;
    if (mode == HF_TRANS) {
        n += harm_deg_semis(harm.scl, harm.deg);
    } else {
        int32_t d = harm.deg;
        mask = harm_mask(harm.scl);
        for (guard = 12; guard && !harm_in(mask, key, n); guard--)
            n--;                                 /* (into the scale: the nearest tone below) */
        for (guard = 12u * 8u; d > 0 && guard && n < 140; guard--) {
            n++;
            if (harm_in(mask, key, n))
                d--;
        }
    }
    return (uint32_t)clamp(n, 0, 127);
}
/* synth step s as track t plays it in the harmony (seq.c seq_fire: the step's copy cp_step) */
static void harm_apply(const track_t *t, step_t *s)
{
    uint32_t i;
    if (s->time != ST_NOTE)
        return;
    for (i = 0; i < s->n && i < 4u; i++)
        s->note[i] = (uint8_t)harm_note(t, s->note[i]);
}
/* (the CHORDS screen shown, no layer: seq.c key_down) key k plays a chord live: a white key its degree (C I, D II ..
 * B VII, every octave), a black key none (the progression again, or I) */
static void harm_key(uint32_t k)
{
    static const int8_t DEG[12] = {0, -1, 1, -1, 2, 3, -1, 4, -1, 5, -1, 6};
    int32_t d = DEG[(53u + k) % 12u];
    harm.live = (uint8_t)(d < 0 ? 0 : d + 1);
}
