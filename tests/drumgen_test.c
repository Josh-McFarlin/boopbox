/* SPDX-License-Identifier: GPL-3.0-only */
/* Beats from the keys (firmware/src/drumgen.c, 1.9): every set of keys and seed makes a beat, always the same one;
 * the lowest key picks the groove (kick on the one, its snare or clap); more keys, more detail; another seed or other
 * keys, another beat; nothing past the track's length; no lock, nudge, condition or component left; and how many of
 * the 65,535 sets x 256 seeds differ (a sample).
 *   cc -O2 -Ibuild/gen -Ifirmware/src -Ifirmware/hal tests/drumgen_test.c -lm */
#define main hostsim_main
#include "hostsim.c"
#undef main

static int fails;
static void check(int ok, const char *what)
{
    printf("drumgen: %-96s %s\n", what, ok ? "ok" : "FAIL");
    if (!ok)
        fails++;
}
static uint32_t hits(const track_t *t)
{
    uint32_t i, n = 0;
    for (i = 0; i < NSTEP; i++)
        n += dg_bits(dstep_mask(&t->dstep[i]));
    return n;
}
static uint32_t lanes(const track_t *t)
{
    uint32_t i, m = 0;
    for (i = 0; i < NSTEP; i++)
        m |= dstep_mask(&t->dstep[i]);
    return m;
}
static uint32_t hash(const track_t *t)
{
    uint32_t i, h = 2166136261u;
    const uint8_t *p = (const uint8_t *)t->dstep;
    for (i = 0; i < sizeof t->dstep; i++)
        h = (h ^ p[i]) * 16777619u;
    return h;
}

int main(void)
{
    static track_t a, b;
    uint32_t g, k, ok, n, i, len;
    static uint32_t seen[4096];
    a.kind = b.kind = TK_DRUM;
    a.p[P_SLEN] = b.p[P_SLEN] = 16;

    check(dg_make(&a, 0, 0) == 0u, "no key held: nothing made");
    ok = 1;
    for (g = 0; g < 16u; g++) {                      /* each key alone */
        uint32_t sn;
        if (dg_make(&a, 1u << g, 0) != g % DG_COUNT + 1u)
            ok = 0;
        sn = (DG_CLAP >> (g % DG_COUNT)) & 1u ? DL_CLAP : DL_SNARE;
        ok &= dstep_has(&a.dstep[0], DL_KICK) && dstep_lvl(&a.dstep[0], DL_KICK) == LV_HARD;
        ok &= ((lanes(&a) >> sn) & 1u) && ((lanes(&a) >> DL_HAT) & 1u);
        for (i = 0; i < 16u; i++)                    /* the groove's own snare where it has one */
            if ((DG_BAR[g % DG_COUNT][1] >> i) & 1u)
                ok &= dstep_has(&a.dstep[i], sn);
    }
    check(ok, "each key alone: its groove, the kick on the one (hard), its snare / clap where it lies, hats");

    a.p[P_SLEN] = b.p[P_SLEN] = 32;
    for (k = 1, ok = 1; k < 0x10000u; k += 97u) {   /* the same keys and seed: the same beat, again */
        dg_make(&a, k, k & 255u);
        dg_make(&b, k, k & 255u);
        ok &= !memcmp(a.dstep, b.dstep, sizeof a.dstep);
    }
    check(ok, "the same keys and seed: the same beat (every 97th set of keys)");

    dg_make(&a, 1u, 0);
    n = hits(&a);
    dg_make(&a, 1u | 2u | 4u | 8u | 16u | 32u, 0);
    check(hits(&a) > n && dg_bits(lanes(&a)) >= 6u, "six keys held: more hits and more sounds than one");
    check(dstep_has(&a.dstep[0], DL_CRASH), "four keys or more: a crash on the one");
    dg_make(&a, 1u << 8, 0);
    dg_make(&b, 1u, 0);
    check(hits(&a) > hits(&b), "key 9: HOUSE as key 1, busier");

    for (len = 1, ok = 1; len <= NSTEP; len++) {      /* nothing past the length */
        a.p[P_SLEN] = (int16_t)len;
        memset(a.dstep, 0xFF, sizeof a.dstep);
        dg_make(&a, 0xFFFFu, 3);
        for (i = len; i < NSTEP; i++)
            ok &= dstep_mask(&a.dstep[i]) == 0u;
        ok &= dstep_has(&a.dstep[0], DL_KICK);
    }
    check(ok, "every length 1 .. 64: the beat fills it, the steps past it are empty");

    a.p[P_SLEN] = 16;
    a.micro[3] = 9;
    a.fill[0] = 0xFF;
    a.lock[0].step = 2;
    a.lock[0].param = P_LEVEL;
    a.comp[0].step = 2;
    a.comp[0].type = CP_TRIG;
    dg_make(&a, 5u, 0);
    check(!a.micro[3] && !a.fill[0] && a.lock[0].step == LOCK_FREE && a.comp[0].type == CP_NONE,
          "a beat leaves no nudge, condition, lock or component of the pattern before");

    a.p[P_SLEN] = b.p[P_SLEN] = 32;
    for (n = 0, k = 1; k < 0x10000u; k += 211u) {     /* other keys or seeds, other beats */
        for (g = 0; g < 4u; g++) {
            uint32_t h;
            dg_make(&a, k, g * 61u);
            h = hash(&a);
            if (!((seen[(h >> 5) & 4095u] >> (h & 31u)) & 1u))
                n++;
            seen[(h >> 5) & 4095u] |= 1u << (h & 31u);
        }
    }
    printf("drumgen: %u different beats of %u (keys x seeds sampled)\n", n, 4u * ((0xFFFFu + 210u) / 211u));
    check(n * 10u >= 4u * ((0xFFFFu + 210u) / 211u) * 9u, "nine in ten of the sets of keys and seeds sampled: their own beat");
    dg_make(&a, 1u, 0);
    dg_make(&b, 1u, 9);
    check(memcmp(a.dstep, b.dstep, sizeof a.dstep) != 0, "one key: SEED 0 its plain groove, another SEED a variation");
    dg_make(&a, 1u | 16u, 0);
    dg_make(&b, 1u | 32u, 0);
    check(memcmp(a.dstep, b.dstep, sizeof a.dstep) != 0, "keys 1 + 5 and 1 + 6: two beats");

    printf(fails ? "drumgen: %d FAILED\n" : "drumgen: all ok\n", fails);
    return fails != 0;
}
