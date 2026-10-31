/* SPDX-License-Identifier: GPL-3.0-only */
/* The firmware's project format 7 (firmware/src/project.c, patcodec.c, patbank.c, harmony.c) for the web editor's
 * codec (web/editor.html PROJ7), checked by web/test_web.mjs:
 *   proj7_tool gen OUT        a project of every kind of content the editor reads and writes (eight tracks, patterns in
 *                             the bank, chains, step components, locks, nudges, fill conditions, a dense pattern stored
 *                             whole, drum lanes, a progression, FOLLOW): the bytes the firmware captures
 *   proj7_tool load IN OUT    IN loaded as the firmware loads a project (proj_import, proj7_apply), captured again into
 *                             OUT; stdout: what it holds, a line a track (the pattern playing, the chain, the bank's
 *                             patterns, the components, the direction, LEN) and the progression. Exit 2: not a project.
 * Built by tests/run_tests.sh into build/host/proj7_tool. */
#define main hostsim_main
#include <stddef.h>
#include "hostsim.c"
#undef main
#define PROJ_HOST 1
#include "../firmware/src/project.c"

static project_t P;

static void reset(void)
{
    uint32_t i;
    memset(trk, 0, sizeof trk);
    memset(&drums, 0, sizeof drums);
    drums.set = -2;
    host_tracks_init();
    pat_reset_all();
    harm_defaults();
    for (i = 0; i < NTRK; i++)
        steps_clear(&trk[i]);
    song.sel = 0;
}
static void note(track_t *t, uint32_t k, uint32_t n0, uint32_t n1)
{
    step_t *s = &t->step[k];
    memset(s, 0, sizeof *s);
    s->note[0] = (uint8_t)n0;
    s->note[1] = (uint8_t)n1;
    s->n = n1 ? 2u : 1u;
    s->time = ST_NOTE;
    s->vel = (uint8_t)(60u + k);
}
static int out(const char *path)
{
    FILE *f;
    if (!proj_capture(&P))
        return 1;
    f = fopen(path, "wb");
    if (!f)
        return 1;
    fwrite(&P, 1, P.size, f);
    fclose(f);
    return 0;
}
static int gen(const char *path)
{
    track_t *t = &trk[0], *d = &trk[3], *x = &trk[1];
    uint32_t k;
    reset();
    /* track 1: pattern 3 in the bank (notes 40.., LEN 8), then pattern 1 playing: notes 60.., a lock, nudges, a fill
     * condition, components (TONE, PARAM, COND), direction PEND, a seed; the chain 1 3 1 */
    t->p[P_SLEN] = 8;
    for (k = 0; k < 8; k++)
        note(t, k, 40u + k, 0);
    pb_store(0, 2);
    steps_clear(t);
    t->p[P_SLEN] = 16;
    for (k = 0; k < 16; k += 2)
        note(t, k, 60u + k, k == 4 ? 67u : 0u);
    t->micro[3] = -9;
    t->micro[6] = 12;
    t->fill[1] = (uint8_t)(FC_FILL << 2);
    t->lock[0].step = 4;
    t->lock[0].param = P_ED_FLT;
    t->lock[0].val = 40;
    t->lock[1].step = 8;
    t->lock[1].param = (uint8_t)((P_E0 + 2) | LOCK_SLIDE);
    t->lock[1].val = 9;
    comp_set(t, 2, CP_TONE, 5, 0);
    comp_set(t, 6, CP_PARAM, P_ED_FLT, 40);
    comp_set(t, 10, CP_COND, 1, 4);
    t->cp_dir = DIR_PEND;
    t->cp_seed = 7;
    {
        uint8_t ch[3] = {0, 2, 0};
        pat_chain_set(t, ch, 3);
    }
    /* track 2: a dense pattern (four notes a step, every step, nudged): its steps and nudges stored whole */
    x->p[P_SLEN] = 64;
    for (k = 0; k < NSTEP; k++) {
        step_t *s = &x->step[k];
        s->note[0] = (uint8_t)(48u + k % 12u), s->note[1] = 52, s->note[2] = 55, s->note[3] = 59;
        s->n = 4, s->time = ST_NOTE, s->flags = 1, s->vel = 90, s->lvl = 0x1B, s->rat = 0x24;
        x->micro[k] = (int8_t)((int32_t)(k % 7u) - 3);
    }
    x->hfol = HF_SCALE;
    /* track 4 (drums): kick and snare with levels and ratchets, a TUNE / DECAY; pattern 2 in the bank: hats */
    for (k = 0; k < 16; k++)
        if (!(k % 4u))
            dstep_set(&d->dstep[k], 0, LV_NORM, 0);
    dstep_set(&d->dstep[4], 4, LV_HARD, 1);
    d->p[P_SLEN] = 16;
    pb_store(3, 1);
    steps_clear(d);
    dstep_set(&d->dstep[0], 0, LV_NORM, 0);
    dstep_set(&d->dstep[8], 2, LV_GHOST, 2);
    drum_tune[3][2] = 3;
    drum_dec[3][2] = -2;
    /* track 6: its own LEN in the bank's pattern 5 */
    trk[5].p[P_SLEN] = 12;
    note(&trk[5], 0, 72, 0);
    pb_store(5, 4);
    steps_clear(&trk[5]);
    trk[5].p[P_SLEN] = 16;
    /* the progression: I (2 bars), IV (2), V (4) */
    harm.n = 3;
    harm.c[0].deg = 0, harm.c[0].bars = 2;
    harm.c[1].deg = 3, harm.c[1].bars = 2;
    harm.c[2].deg = 4, harm.c[2].bars = 4;
    song.sel = 2;
    return out(path);
}
static int load(const char *in, const char *path)
{
    static uint8_t buf[PROJ_MAX + 64];
    FILE *f = fopen(in, "rb");
    long n;
    uint32_t i, k;
    if (!f)
        return 2;
    n = (long)fread(buf, 1, sizeof buf, f);
    fclose(f);
    reset();
    if (!proj_import(&P, buf, (int)n))
        return 2;
    proj7_apply(&P, 1);
    for (i = 0; i < NTRK; i++) {
        track_t *t = &trk[i];
        printf("T%u kind %u pat %u chain", i, t->kind, t->pat);
        for (k = 0; k < t->pat_nchain; k++)
            printf(" %u", t->pat_chain[k]);
        printf(" bank %u comps %u dir %u seed %u len %d hfol %d", pb_used(i), comp_count(t, NSTEP), t->cp_dir, t->cp_seed,
               t->p[P_SLEN], t->hfol);
        for (k = 0; k < NCOMP; k++)
            if (t->comp[k].type != CP_NONE)
                printf(" c%u:%u:%d:%d", t->comp[k].step, t->comp[k].type, t->comp[k].a, t->comp[k].b);
        printf(" n0 %u\n", is_drum(t) ? (uint32_t)t->dstep[0].on[0] : (uint32_t)t->step[0].note[0]);
    }
    printf("H %u", harm.n);
    for (k = 0; k < harm.n; k++)
        printf(" %u:%u", harm.c[k].deg, harm.c[k].bars);
    printf("\nS %u\n", song.sel);
    return out(path);
}
int main(int argc, char **argv)
{
    if (argc >= 3 && !strcmp(argv[1], "gen"))
        return gen(argv[2]);
    if (argc >= 4 && !strcmp(argv[1], "load"))
        return load(argv[2], argv[3]);
    fprintf(stderr, "proj7_tool gen OUT | load IN OUT\n");
    return 1;
}
