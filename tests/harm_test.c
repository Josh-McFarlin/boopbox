/* SPDX-License-Identifier: GPL-3.0-only */
/* Harmony (firmware/src/harmony.c): the note mapping alone (FOLLOW TRANS and SCALE, the key's move, every degree,
 * scales of 5..12 notes); played: a following track moves, one that does not (and a drum track) stays; the key, the
 * scale and the chord change on their boundary (NOW, BEAT, BAR); a progression round; a live chord (the CHORDS
 * screen's keys) over it; notes held across a change end as the notes they started (nothing left on); the stores
 * keep it (format 7; format 6 refused for it).
 *   cc -O2 -Ibuild/gen -Ifirmware/src -Ifirmware/hal tests/harm_test.c -lm */
#define main hostsim_main
#include "hostsim.c"
#undef main
#define PROJ_HOST 1
#include "../firmware/src/project.c"

static int fails;
static void check(int ok, const char *what)
{
    printf("harm: %-100s %s\n", what, ok ? "ok" : "FAIL");
    if (!ok)
        fails++;
}
static void reset(void)
{
    uint32_t i;
    memset(trk, 0, sizeof trk);
    memset(eng_arena_trk, 0, sizeof eng_arena_trk);
    memset(eng_arena_own, 0, sizeof eng_arena_own);
    memset(sl_buf_trk, 0, sizeof sl_buf_trk);
    memset(&drums, 0, sizeof drums);
    drums.set = -2;
    host_tracks_init();
    pat_reset_all();
    harm_defaults();
    for (i = 0; i < NTRK; i++) {
        if (!is_drum(&trk[i]))
            host_preset(&trk[i], TRK_DEF[i][1], TRK_DEF[i][2]);
        else
            trk[i].p[P_E0] = TRK_DEF[i][1];
        steps_clear(&trk[i]);
        trk[i].p[P_SLEN] = 4;
        trk[i].p[P_SDIV] = 2;
        trk[i].p[P_SSWING] = 0;
        trk[i].p[P_SGATE] = 64;
        trk[i].p[P_AMODE] = 0;
        trk[i].p[P_ROOT] = 0;
        trk[i].p[P_REL] = 0;
        trk[i].hfol = HF_OFF;
    }
    song.g[G_BPM] = 150;
    song.g[G_SWING] = 0;
    song.g[G_HKEY] = 0, song.g[G_HSCL] = 1, song.g[G_HQ] = HQ_NOW, song.g[G_HPROG] = 0;
    song.g[G_MIDI] = 1;
    song.g[G_CH1] = 1, song.g[G_CH2] = 2, song.g[G_CH3] = 3, song.g[G_DRCH] = 4;
    song.g[G_CH5] = 5, song.g[G_CH6] = 6, song.g[G_CH7] = 7, song.g[G_CH8] = 8;
    song.rec = 0, song.solo = 0, song.sel = 0;
    rec_wait = 0;
    mo_r = mo_w;
    usb.config = 1;
    memset(mo_set, 0, sizeof mo_set);
    harm_block();
}
typedef struct { uint32_t blk, trk, note, on, abs; } ev_t;
#define NEV 20000u
static ev_t ev[NEV];
static uint32_t nev, blkno;
static int32_t out[CTL * 2];
static void drain(void)
{
    while (mo_r != mo_w) {
        uint32_t pkt = midi_out_q[mo_r % MQ], st = (pkt >> 8) & 0xF0u, ch = (pkt >> 8) & 15u, i;
        mo_r++;
        if (st != 0x90u && st != 0x80u)
            continue;
        for (i = 0; i < NTRK && trk_midi_ch(i) != ch; i++)
            ;
        if (i == NTRK || nev >= NEV)
            continue;
        ev[nev].blk = blkno, ev[nev].trk = i, ev[nev].note = (pkt >> 16) & 127u;
        ev[nev].on = st == 0x90u && ((pkt >> 24) & 127u);
        ev[nev].abs = trk[i].seq_abs;
        nev++;
    }
}
static void block(void)
{
    mix_block(out, CTL);
    blkno++;
    drain();
}
static void blocks(uint32_t n)
{
    while (n--)
        block();
}
static uint32_t step_blocks(uint32_t n) { return (uint32_t)(((uint64_t)n * BEAT_U / 4u / (uint32_t)song.g[G_BPM] + CTL - 1u) / CTL); }
static void play(void)
{
    nev = 0, blkno = 0;
    transport_req = 1;
    block();
}
static void stop(void)
{
    transport_req = 2;
    blocks(FS / CTL);
    drain();
}
static void note1(track_t *t, uint32_t i, uint32_t note)
{
    uint8_t n = (uint8_t)note;
    put_step(t, i, 1, &n, ST_NOTE, 0);
}
static uint32_t notes_of(uint32_t k, uint32_t *n, uint32_t max)
{
    uint32_t i, c = 0;
    for (i = 0; i < nev && c < max; i++)
        if (ev[i].trk == k && ev[i].on)
            n[c++] = ev[i].note;
    return c;
}
static uint32_t all_active(void)
{
    uint32_t i, v, n = 0;
    for (i = 0; i < NTRK; i++)
        for (v = 0; v < NVOICE; v++)
            n += trk[i].v[v].active;
    return n;
}
static uint32_t midi_on(void)
{
    uint32_t i, w, n = 0;
    for (i = 0; i < NTRK; i++)
        for (w = 0; w < 4u; w++)
            n += (uint32_t)__builtin_popcount(mo_set[i][w]);
    return n;
}

static void t_map(void)
{
    track_t *t;
    uint32_t d, ok;
    reset();
    t = &trk[0];
    check(harm_note(t, 60) == 60u, "FOLLOW OFF: the note as it is");
    t->hfol = HF_TRANS;
    harm.key = 2, harm.scl = 1, harm.deg = 0;
    check(harm_note(t, 60) == 62u && harm_note(t, 64) == 66u, "TRANS: key D over a pattern in C: everything +2 (C E -> D F#)");
    harm.key = 7;
    check(harm_note(t, 60) == 55u, "TRANS: key G: the nearer way, down a fourth (C -> G below)");
    harm.key = 0, harm.deg = 4;
    check(harm_note(t, 60) == 67u && harm_note(t, 64) == 71u, "TRANS: chord V in C major: +7 (C E -> G B)");
    harm.scl = 5, harm.deg = 3;                       /* (major pentatonic: C D E G A) */
    check(harm_note(t, 60) == 67u, "TRANS: degree 4 of a 5-note scale: its fourth tone (G)");
    t->hfol = HF_SCALE;
    harm.key = 0, harm.scl = 1;
    {
        static const uint8_t I[3] = {60, 64, 67}, W[7][3] = {{60, 64, 67}, {62, 65, 69}, {64, 67, 71}, {65, 69, 72},
                                                              {67, 71, 74}, {69, 72, 76}, {71, 74, 77}};
        uint32_t k;
        for (d = 0, ok = 1; d < 7u; d++) {
            harm.deg = (uint8_t)d;
            for (k = 0; k < 3u; k++)
                ok &= harm_note(t, I[k]) == W[d][k];
        }
        check(ok, "SCALE: a C triad on every degree of C major: the scale's own I ii iii IV V vi vii°");
    }
    harm.deg = 0;
    check(harm_note(t, 61) == 60u && harm_note(t, 63) == 62u, "SCALE: a note out of the scale: the nearest tone below (C# -> C, D# -> D)");
    harm.scl = 2, harm.deg = 0;                       /* C minor */
    check(harm_note(t, 64) == 63u && harm_note(t, 69) == 68u, "SCALE: C minor: E -> Eb, A -> Ab");
    harm.key = 9, harm.scl = 2, harm.deg = 0;         /* A minor, the pattern in C (ROOT 0) */
    check(harm_note(t, 60) == 57u && harm_note(t, 64) == 60u, "SCALE: key A minor: C E -> A C (moved by the key, put in the scale)");
    harm.scl = 0, harm.key = 0, harm.deg = 2;         /* CHR: degrees are semitones */
    check(harm_note(t, 60) == 62u, "SCALE in CHR: degree 3 = 2 semitones");
    harm.key = 0, harm.scl = 1, harm.deg = 6;
    check(harm_note(t, 126) == 127u && harm_note(t, 0) <= 11u, "a note near the ends: kept within 0..127");
    trk[3].hfol = HF_SCALE;
    check(harm_note(&trk[3], 38) == 38u, "a drum track never follows");
}

static void t_play(void)
{
    track_t *t, *u;
    uint32_t n[256], c, i, ok;
    reset();
    t = &trk[0], u = &trk[1];
    for (i = 0; i < 4u; i++)
        note1(t, i, 60), note1(u, i, 72);
    t->hfol = HF_SCALE;                               /* track 2 does not follow */
    song.g[G_HKEY] = 0, song.g[G_HSCL] = 1;
    harm.live = 5;                                    /* (a live chord: degree V) */
    play();
    blocks(step_blocks(4) - 1u);
    c = notes_of(0, n, 256);
    for (i = 0, ok = c == 4u; i < c; i++)
        ok &= n[i] == 67u;
    check(ok, "a following track (SCALE) on chord V: C -> G");
    c = notes_of(1, n, 256);
    for (i = 0, ok = c == 4u; i < c; i++)
        ok &= n[i] == 72u;
    check(ok, "a track that does not follow: as written");
    stop();
    check(all_active() == 0u && midi_on() == 0u, "  .. STOP: nothing on");
    /* BAR: a chord asked for mid-bar takes hold on the next bar line */
    song.g[G_HQ] = HQ_BAR;
    harm.live = 0;
    play();
    blocks(step_blocks(2));
    harm.live = 4;                                    /* IV, asked on step 3 of bar 1 */
    blocks(step_blocks(14));                          /* to the end of bar 1 .. the next one */
    c = notes_of(0, n, 256);
    ok = c >= 16u && n[0] == 60u && n[2] == 60u && n[15] == 60u;
    blocks(step_blocks(2));
    c = notes_of(0, n, 256);
    ok &= c >= 17u && n[16] == 65u;
    check(ok, "BAR: a chord asked for in bar 1 plays from bar 2's first step (C until then, F after)");
    stop();
    /* BEAT */
    song.g[G_HQ] = HQ_BEAT;
    harm.live = 0;
    play();
    blocks(step_blocks(1));
    harm.live = 2;                                    /* ii, asked on step 2 */
    blocks(step_blocks(8));
    c = notes_of(0, n, 256);
    check(c >= 6u && n[0] == 60u && n[1] == 60u && n[3] == 60u && n[4] == 62u && n[5] == 62u,
          "BEAT: asked on step 2: the next beat (step 5) plays it");
    stop();
    /* a progression: I (1 bar), vi (1 bar), IV (2 bars), round */
    harm.live = 0;
    harm.n = 3;
    harm.c[0].deg = 0, harm.c[0].bars = 1;
    harm.c[1].deg = 5, harm.c[1].bars = 1;
    harm.c[2].deg = 3, harm.c[2].bars = 2;
    song.g[G_HPROG] = 1;
    song.g[G_HQ] = HQ_NOW;
    play();
    blocks(step_blocks(16 * 5) - 1u);
    c = notes_of(0, n, 512);
    {
        static const uint32_t W[5] = {60, 69, 65, 65, 60};
        uint32_t b;
        for (b = 0, ok = c >= 80u; b < 5u && ok; b++)
            for (i = 0; i < 16u; i++)
                ok &= n[b * 16u + i] == W[b];
        check(ok, "a progression I (1 bar) vi (1) IV (2), round: C, A, F, F, C");
    }
    harm.live = 7;                                    /* a live chord over the progression: vii (degree + 1) */
    blocks(step_blocks(4));
    c = notes_of(0, n, 512);
    ok = n[c - 1u] == 71u;
    harm.live = 0;                                    /* (a black key: back to the progression) */
    blocks(step_blocks(4));
    c = notes_of(0, n, 512);
    ok &= n[c - 1u] == 60u || n[c - 1u] == 69u || n[c - 1u] == 65u;
    stop();
    check(ok, "a live chord (vii) over the progression; let go: the progression again");
    /* a held note across a change: it ends as the note it started */
    reset();
    t = &trk[0];
    t->hfol = HF_TRANS;
    note1(t, 0, 60);
    put_step(t, 1, 0, 0, ST_TIE, 0);
    put_step(t, 2, 0, 0, ST_TIE, 0);
    put_step(t, 3, 0, 0, ST_TIE, 0);
    t->p[P_SGATE] = 120;
    play();
    blocks(step_blocks(1));
    harm.live = 3;                                    /* (III while C sounds) */
    blocks(step_blocks(5));
    {
        uint32_t k, on60 = 0, off60 = 0, other_on = 0;
        for (k = 0; k < nev; k++) {
            if (ev[k].note == 60u)
                on60 += ev[k].on, off60 += !ev[k].on;
            else if (ev[k].on)
                other_on++;
        }
        stop();
        check(on60 == 1u && off60 == 1u && other_on >= 1u && midi_on() == 0u && all_active() == 0u,
              "a note held through a chord change: its own note-off; the next pass in the new chord; nothing left on");
    }
}

static void t_ratchet_keys(void)
{
    track_t *t;
    uint32_t n[64], c, i, ok;
    reset();
    t = &trk[0];
    t->hfol = HF_SCALE;
    note1(t, 0, 60);
    t->step[0].rat = 2;                               /* (x3) */
    comp_set(t, 1, CP_TONE, 2, 0);
    note1(t, 1, 60);
    harm.live = 5;
    play();
    blocks(step_blocks(2) - 1u);
    c = notes_of(0, n, 64);
    for (i = 0, ok = c == 4u; i < 3u && ok; i++)
        ok &= n[i] == 67u;
    ok &= c == 4u && n[3] == 69u;                     /* (TONE +2 = D, then V: D -> A) */
    stop();
    check(ok, "a ratchet's hits and a step component's note move with the harmony too (G x3, then D -> A)");
    {   /* the keys play as they are */
        uint32_t before = 0, v;
        harm_key(0);                                  /* (key 0 is F3: degree IV) */
        check(harm.live == 4u, "harm_key: F (key 0): IV; a black key: none");
        harm_key(1);
        check(harm.live == 0u, "  .. F#: none");
        harm.live = 5;
        input_on(t, 60, 100);
        blocks(4);
        for (v = 0; v < NVOICE; v++)
            before |= t->v[v].active && t->v[v].note == 60u;
        input_off(t, 60);
        blocks(FS / CTL);
        check(before, "a key played by hand: its own note (the harmony moves only the sequencer's)");
    }
}

static void t_store(void)
{
    static project_t p;
    uint32_t ok;
    reset();
    trk[2].hfol = HF_SCALE;
    trk[5].hfol = HF_TRANS;
    song.g[G_HKEY] = 4, song.g[G_HSCL] = 2, song.g[G_HQ] = HQ_BEAT, song.g[G_HPROG] = 1;
    harm.n = 2;
    harm.c[0].deg = 3, harm.c[0].bars = 2;
    harm.c[1].deg = 4, harm.c[1].bars = 6;
    ok = proj_capture(&p) && p.magic == PROJ_MAGIC;
    check(ok, "harmony used: saved");
    reset();
    proj_apply(&p, 1);
    ok = trk[2].hfol == HF_SCALE && trk[5].hfol == HF_TRANS && trk[0].hfol == HF_OFF && song.g[G_HKEY] == 4 &&
         song.g[G_HSCL] == 2 && song.g[G_HQ] == HQ_BEAT && song.g[G_HPROG] == 1 && harm.n == 2u &&
         harm.c[0].deg == 3u && harm.c[0].bars == 2u && harm.c[1].deg == 4u && harm.c[1].bars == 6u;
    check(ok, "loaded: each track's FOLLOW, the key, scale, quantization, the progression");
}

int main(void)
{
    t_map();
    t_play();
    t_ratchet_keys();
    t_store();
    printf(fails ? "harm: %d FAILED\n" : "harm: all passed\n", fails);
    return fails != 0;
}
