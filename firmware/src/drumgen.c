/* SPDX-License-Identifier: GPL-3.0-only */
/* Beats from the keys (1.9): on a drum track's PLAY page (SEQ), the white keys held make a whole pattern across the
 * kit. The same keys and the same SEED always make the same beat (no clock, no state: a hash of the two):
 *   - the lowest key held picks the groove: keys 1..8 HOUSE, ROCK, BOOM BAP, TRAP, BREAK, DEMBOW, DNB, ELECTRO;
 *     keys 9..16 the same eight, busier;
 *   - each other key held is a variation, and adds detail: ghost notes, open hats, percussion, a crash, a fill at the
 *     end of the pattern, hat rolls (more keys, more of them);
 *   - SEED (KNOB 2 of the PLAY page) gives each set of keys another beat (one key at SEED 0: its groove plain).
 * dg_make writes every lane of the pattern over the track's length (the rest of the 64 steps is cleared), with no lock,
 * nudge, condition or component left; the caller marks the undo and holds the IRQ off. Seeded by seq.c (included after
 * steps_clear): pure, host-testable (tests/drumgen_test.c). */
enum { DG_HOUSE, DG_ROCK, DG_BOOM, DG_TRAP, DG_BREAK, DG_DEMBOW, DG_DNB, DG_ELECTRO, DG_COUNT };
static const char *const DG_NAME[DG_COUNT] = {"HOUSE", "ROCK", "BOOM BAP", "TRAP", "BREAK", "DEMBOW", "DNB", "ELECTRO"};
/* one bar of 16 steps each, bit i = step i: kick, snare (or clap), its ghosts, closed hat, open hat */
static const uint16_t DG_BAR[DG_COUNT][5] = {
    {0x1111, 0x1010, 0x0000, 0x4444, 0x4444},          /* HOUSE: four on the floor, offbeat hats, clap */
    {0x0501, 0x1010, 0x0000, 0x5555, 0x4000},          /* ROCK */
    {0x0481, 0x1010, 0x0000, 0x5555, 0x0400},          /* BOOM BAP */
    {0x0881, 0x0100, 0x0000, 0xFFFF, 0x4000},          /* TRAP: half time, clap on 3, 16th hats that roll */
    {0x0C05, 0x9290, 0x8280, 0x5555, 0x0400},          /* BREAK */
    {0x1111, 0x4848, 0x0000, 0x5555, 0x0000},          /* DEMBOW */
    {0x0401, 0x1010, 0x0000, 0x5555, 0x0040},          /* DNB: two step */
    {0x0449, 0x1010, 0x0000, 0xFFFF, 0x0000},          /* ELECTRO */
};
#define DG_CLAP ((1u << DG_HOUSE) | (1u << DG_TRAP) | (1u << DG_ELECTRO))   /* the grooves on the clap, not the snare */
/* the lanes (drums.c LANE_NOTE) */
enum { DL_KICK, DL_KICK2, DL_SNARE, DL_CLAP, DL_HAT, DL_OPEN, DL_PEDAL, DL_RIM, DL_SNARE2, DL_TOMLO, DL_TOMHI,
       DL_CRASH, DL_RIDE, DL_SHAKER, DL_CONGA, DL_BELL };
static const uint8_t DG_PERC[6] = {DL_SHAKER, DL_CONGA, DL_RIM, DL_BELL, DL_RIDE, DL_PEDAL};   /* the extra layers */

static uint32_t dg_rng;
CTL_SMALL static uint32_t dg_rand(uint32_t n)       /* 0 .. n - 1 (xorshift32) */
{
    dg_rng ^= dg_rng << 13;
    dg_rng ^= dg_rng >> 17;
    dg_rng ^= dg_rng << 5;
    return n ? dg_rng % n : 0u;
}
CTL_SMALL static uint32_t dg_bits(uint32_t m)
{
    uint32_t n = 0;
    for (; m; m &= m - 1u)
        n++;
    return n;
}
/* a hit of lane l on step idx of the pattern being made (out of line: one copy of dstep_set, not one a call) */
static track_t *dg_t;
static uint32_t dg_len;
CTL_SMALL static void __attribute__((noinline)) dg_hit(uint32_t idx, uint32_t l, uint32_t lvl, uint32_t rat)
{
    if (idx < dg_len)
        dstep_set(&dg_t->dstep[idx], l, lvl, rat);
}
/* keys: the white keys held, bit k = key k + 1 (0: nothing is made, 0 returned); seed: the PLAY page's SEED. Returns
 * the groove + 1 */
CTL_SMALL static uint32_t __attribute__((noinline)) dg_make(track_t *t, uint32_t keys, uint32_t seed)
{
    uint32_t len = trk_len(t), lo, g, d, i, b, l, s, fs, sn, pl[2];
    uint16_t bar[5];
    uint8_t pe[2], pr[2];
    keys &= 0xFFFFu;
    seed &= 0xFFu;
    if (!keys)
        return 0;
    for (lo = 0; !((keys >> lo) & 1u); lo++)
        ;
    g = lo % DG_COUNT;
    d = dg_bits(keys) + (lo >= DG_COUNT ? 2u : 0u);   /* the detail: 1 (one of keys 1..8) .. */
    sn = (DG_CLAP >> g) & 1u ? DL_CLAP : DL_SNARE;
    fs = d >= 3u && len >= 8u ? len - (d >= 5u ? 4u : 2u) : len;   /* where the fill starts (len: none) */
    dg_rng = (keys * 0x9E3779B1u) ^ (seed + 1u) * 0x85EBCA77u;
    dg_rng = dg_rng ? dg_rng : 1u;
    for (i = 0; i < 4u; i++)
        dg_rand(1);
    steps_clear(t);
    memset(t->micro, 0, sizeof t->micro);
    dg_t = t;
    dg_len = len;
    for (i = 0; i < 5u; i++)
        bar[i] = DG_BAR[g][i];
    if (lo >= DG_COUNT)                                 /* busier: hats in 16ths (and d + 2: more of everything) */
        bar[3] = 0xFFFFu;
    for (i = seed ? 0u : 1u; i < d && i < 4u; i++)      /* each variation: a kick more, on a step free of the snare (one
                                                         * key at SEED 0: the groove as it is) */
        if (dg_rand(3))
            bar[0] |= (uint16_t)(1u << (1u + dg_rand(15)));
    if (d >= 2u)
        bar[3] &= (uint16_t)~bar[4];                   /* an open hat chokes the closed one on its step */
    else
        bar[4] = 0;
    i = dg_rand(6);                                    /* two different percussion layers */
    pl[0] = DG_PERC[i];
    pl[1] = DG_PERC[(i + 1u + dg_rand(5)) % 6u];
    for (l = 0; l < 2u; l++)                           /* their rhythms, euclidean: 3..7 hits a bar, turned */
        pe[l] = (uint8_t)(3u + dg_rand(5)), pr[l] = (uint8_t)dg_rand(16);
    for (b = 0; b * 16u < len; b++) {
        uint32_t k = bar[0], gh = 0;
        if ((b & 1u) && (d >= 2u || seed))             /* the second bar of two answers the first: a kick more */
            k |= 1u << (2u + dg_rand(14));
        for (i = seed ? 0u : 1u; i < d && i < 5u; i++)  /* ghost snares, on the off 16ths */
            gh |= 1u << (1u + 2u * dg_rand(8));
        k &= ~(uint32_t)bar[1];                         /* (no kick added on the snare) */
        k |= DG_BAR[g][0];
        for (s = 0; s < 16u; s++) {
            uint32_t idx = b * 16u + s, hat = idx < fs ? bar[3] >> s & 1u : 0u;
            if ((k >> s) & 1u)
                dg_hit(idx, DL_KICK, s ? LV_NORM : LV_HARD, 0);
            if ((bar[1] >> s) & 1u) {
                dg_hit(idx, sn, (bar[2] >> s) & 1u ? LV_GHOST : LV_NORM, 0);
                if (d >= 5u && sn == DL_SNARE && !((bar[2] >> s) & 1u))
                    dg_hit(idx, DL_CLAP, LV_SOFT, 0);  /* the clap on the snare */
            } else if ((gh >> s) & 1u) {
                dg_hit(idx, DL_SNARE, LV_GHOST, 0);
            }
            if (hat)
                dg_hit(idx, DL_HAT, s % 4u == 0u ? LV_NORM : s & 1u ? LV_GHOST : LV_SOFT,
                       (g == DG_TRAP || d >= 6u) && (s & 3u) == 3u && dg_rand(3) == 0u ? 1u + dg_rand(2) : 0u);
            if (idx < fs && ((bar[4] >> s) & 1u))
                dg_hit(idx, DL_OPEN, LV_NORM, 0);
            for (l = 0; l + 3u <= d && l < 2u; l++)     /* the percussion layers (three keys: one, four: two) */
                if (((s + 16u - pr[l]) % 16u * pe[l]) % 16u < pe[l])
                    dg_hit(idx, pl[l], l ? LV_GHOST : LV_SOFT, 0);
        }
    }
    if (d >= 4u)
        dg_hit(0, DL_CRASH, LV_NORM, 0);
    for (i = fs; i < len; i++) {                        /* a fill at the end: snare and toms, the last 2 or 4 steps */
        static const uint8_t FL[4] = {DL_SNARE, DL_TOMHI, DL_TOMLO, DL_SNARE2};
        dg_hit(i, FL[dg_rand(4)], i + 1u == len ? LV_HARD : LV_NORM, dg_rand(4) == 0u);
    }
    t->seq_active = 1;
    return g + 1u;
}
