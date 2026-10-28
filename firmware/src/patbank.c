/* SPDX-License-Identifier: GPL-3.0-only */
/* Patterns: NPAT a track. The one playing is the track's own (track_t: steps, nudges, fill conditions, locks, step
 * components, direction, seed, and its LEN); the others are kept as bytes (patcodec.c pat_put) in one bank shared by
 * the eight tracks, pb_buf: an entry is [track << 4 | pattern][its size, 2 bytes, low first][LEN][the pattern's bytes].
 * An empty pattern has no entry. The bank is the size a project can keep with room for the rest (PB_SIZE): a pattern
 * that does not fit is not taken (the change is refused and said: PATTERNS FULL), nothing is cut.
 * A change (t->pat_req, the UI) is quantized (G_PATQ): LOOP, at the track's own loop end (each track on its own
 * length); 1, 2 or 4 BARS, on the first step of the track at or after the next such bar (tracks asked together change
 * together). The audio ISR makes it on that step, before the step plays (seq.c seq_tick: pat_due, pat_swap): the
 * pattern playing into the bank, the new one out of it, the new one from its step 1. Stopped, at once. A chain
 * (pat_chain, 2 to NPAT patterns) plays its patterns in turn, one loop each (an asked change goes first).
 * Bounded work: one encode and one decode a track and step at most, a bank move of PB_SIZE bytes at most. */
#define PB_SIZE 3072u
static uint8_t pb_buf[PB_SIZE];
static uint32_t pb_n;                            /* bytes used */
static volatile uint8_t pb_full;                 /* a change was refused: the pattern playing did not fit (the UI says so) */
enum { PQ_LOOP, PQ_BAR, PQ_2BAR, PQ_4BAR };      /* G_PATQ */

static int pb_find(uint32_t k, uint32_t pat)     /* track k's pattern pat: its entry's offset, -1: none (empty) */
{
    uint32_t o = 0;
    while (o + 4u <= pb_n) {
        uint32_t sz = (uint32_t)pb_buf[o + 1u] | (uint32_t)pb_buf[o + 2u] << 8;
        if (pb_buf[o] == (uint8_t)(k << 4 | pat))
            return (int)o;
        o += 4u + sz;
    }
    return -1;
}
static uint32_t pb_entry(uint32_t o) { return 4u + ((uint32_t)pb_buf[o + 1u] | (uint32_t)pb_buf[o + 2u] << 8); }
static void pb_drop(uint32_t k, uint32_t pat)    /* its entry out (the bank closes up) */
{
    int o = pb_find(k, pat);
    uint32_t sz;
    if (o < 0)
        return;
    sz = pb_entry((uint32_t)o);
    {                                            /* (down, byte by byte: the firmware's libc has no memmove) */
        uint32_t i, n = pb_n - (uint32_t)o - sz;
        for (i = 0; i < n; i++)
            pb_buf[(uint32_t)o + i] = pb_buf[(uint32_t)o + sz + i];
    }
    pb_n -= sz;
}
static void pb_drop_track(uint32_t k)            /* every pattern of track k out */
{
    uint32_t p;
    for (p = 0; p < NPAT; p++)
        pb_drop(k, p);
}
static uint32_t pb_used(uint32_t k)              /* the patterns of track k the bank holds, a bit each */
{
    uint32_t o = 0, m = 0;
    while (o + 4u <= pb_n) {
        if ((pb_buf[o] >> 4) == k)
            m |= 1u << (pb_buf[o] & 15u);
        o += pb_entry(o);
    }
    return m;
}
static int pat_empty(const track_t *t)           /* the pattern playing holds nothing (as steps_clear leaves it) */
{
    uint32_t k;
    if (!track_empty(t) || comp_count(t, NSTEP) || t->cp_dir || t->cp_seed)
        return 0;
    for (k = 0; k < NLOCK; k++)
        if (t->lock[k].step != LOCK_FREE)
            return 0;
    for (k = 0; k < NSTEP; k++)
        if (t->micro[k] || step_fill(t, k))
            return 0;
    for (k = 0; k < NSTEP; k++)                  /* (a TIE, a note past n: track_empty does not see them) */
        if (!step_blank(t, k))
            return 0;
    return 1;
}
/* the pattern playing on track k into the bank as pattern pat (empty: no entry); 0: it does not fit (the bank as it was) */
static int pb_store(uint32_t k, uint32_t pat)
{
    track_t *t = &trk[k % NTRK];
    pw_t w = {0, 0, 0};
    int o;
    uint32_t old;
    if (pat_empty(t)) {
        pb_drop(k, pat);
        return 1;
    }
    pat_put(&w, t);                              /* (the size only) */
    o = pb_find(k, pat);
    old = o < 0 ? 0u : pb_entry((uint32_t)o);
    if (w.n > 0xFFFFu || pb_n - old + 4u + w.n > PB_SIZE)
        return 0;
    pb_drop(k, pat);
    pb_buf[pb_n] = (uint8_t)(k << 4 | pat);
    pb_buf[pb_n + 1u] = (uint8_t)w.n;
    pb_buf[pb_n + 2u] = (uint8_t)(w.n >> 8);
    pb_buf[pb_n + 3u] = (uint8_t)clamp(t->p[P_SLEN], 1, NSTEP);
    w.b = pb_buf + pb_n + 4u, w.max = w.n, w.n = 0;
    pat_put(&w, t);
    pb_n += 4u + w.n;
    return 1;
}
/* track k's pattern pat out of the bank into the track (none: an empty pattern, of the LEN it has now); the entry stays */
static void pb_load(uint32_t k, uint32_t pat)
{
    track_t *t = &trk[k % NTRK];
    int o = pb_find(k, pat);
    if (o < 0) {
        steps_clear(t);
        return;
    }
    {
        pr_t r = {pb_buf + o + 4u, pb_entry((uint32_t)o) - 4u, 0, 0};
        pat_get(&r, t);
        t->p[P_SLEN] = (int16_t)clamp(pb_buf[o + 3u], 1, NSTEP);
    }
}
static void seq_release(track_t *t);
/* track k plays pattern pat from now (the ISR on a step, or the UI with the IRQ off, stopped): the one playing kept in
 * the bank, pat taken out of it. 0: refused (the one playing does not fit: pb_full; nothing changed) */
static int pat_swap(uint32_t k, uint32_t pat)
{
    track_t *t = &trk[k % NTRK];
    pat %= NPAT;
    if (pat == t->pat)
        return 1;
    locks_restore(t);                            /* (the track's own values back before the pattern is kept) */
    if (!pb_store(k, t->pat)) {
        pb_full = 1;
        return 0;
    }
    seq_release(t);                              /* (the last pattern's notes end: the new one starts clean) */
    pb_load(k, pat);
    pb_drop(k, pat);                             /* (playing now: the track holds it) */
    t->pat = (uint8_t)pat;
    t->rh_n = 0;                                 /* (a recorded note held over: as far as it got) */
    t->rskip_n = 0;
    t->rskip_lanes = 0;
    t->rskip_abs = SEQ_NONE;
    if (undo.valid && undo.trk == k)
        undo.valid = 0;                          /* (the undo was the other pattern's) */
    comp_reset(t);
    return 1;
}
/* the chain of track k: n patterns (0 or 1: none). The UI, with the IRQ off */
static void pat_chain_set(track_t *t, const uint8_t *p, uint32_t n)
{
    uint32_t i;
    n = n > NPAT ? NPAT : n;
    for (i = 0; i < n; i++)
        t->pat_chain[i] = (uint8_t)(p[i] % NPAT);
    t->pat_nchain = (uint8_t)(n >= 2u ? n : 0u);
    t->pat_ci = 0;
    for (i = 0; i < t->pat_nchain; i++)
        if (t->pat_chain[i] == t->pat) {
            t->pat_ci = (uint8_t)i;
            break;
        }
}
/* the grid step of track t at or after the next n-bar line (a bar: 4 beats from PLAY) */
static uint32_t pat_bar_step(const track_t *t, uint32_t bars)
{
    uint32_t span = 4u * bars, b = (clk_beat / span + 1u) * span, su = div_units(trk_div(t));
    if (su <= BEAT_U)
        return b * (BEAT_U / su);
    return (b + su / BEAT_U - 1u) / (su / BEAT_U);
}
/* once a block, before the tracks' steps (events_block): a change asked for is seen (its boundary), stopped it is made */
static void pat_block(void)
{
    uint32_t i, q = (uint32_t)clamp(song.g[G_PATQ], PQ_LOOP, PQ_4BAR);
    static const uint8_t QB[4] = {0, 1, 2, 4};
    for (i = 0; i < NTRK; i++) {
        track_t *t = &trk[i];
        uint32_t req = t->pat_req;
        if (!req) {
            t->pat_arm = 0;
            continue;
        }
        if (!song.playing) {                     /* stopped: at once */
            if (!pat_swap(i, req - 1u))
                ;                                /* (pb_full: said) */
            t->pat_req = 0;
            t->pat_arm = 0;
            continue;
        }
        if (!t->pat_arm) {
            t->pat_arm = (uint8_t)req;
            t->pat_at = q == PQ_LOOP ? SEQ_NONE : pat_bar_step(t, QB[q]);
        } else if (t->pat_arm != req) {          /* (asked again for another: the same boundary) */
            t->pat_arm = (uint8_t)req;
        }
    }
}
/* the step track t fires now (grid step nabs, LEN len) starts its pattern's loop */
static int pat_loop_start(const track_t *t, uint32_t nabs, uint32_t len)
{
    if (comp_flow(t))
        return !t->cp_rep && (t->cp_adv + 1u) % len == 0u;
    return (nabs - t->seq_org) % len == 0u;
}
/* (seq_tick, on a step about to fire) a pattern change due on it: made; 1 if the track now plays another pattern from
 * its step 1 (seq_org is this step) */
static int pat_due(track_t *t, uint32_t nabs, uint32_t len, uint32_t start)
{
    uint32_t k = trk_index(t), want = NPAT;
    if (t->pat_arm && t->pat_req == t->pat_arm &&
        (start || (t->pat_at == SEQ_NONE ? pat_loop_start(t, nabs, len) : (int32_t)(nabs - t->pat_at) >= 0)))
        want = t->pat_arm - 1u;
    else if (t->pat_nchain >= 2u && !t->pat_req && !start && pat_loop_start(t, nabs, len))
        want = t->pat_chain[(t->pat_ci + 1u) % t->pat_nchain];
    if (want >= NPAT)
        return 0;
    if (want == t->pat_arm - 1u && t->pat_arm) {
        t->pat_req = 0;
        t->pat_arm = 0;
    }
    if (t->pat_nchain >= 2u) {                   /* (the chain goes on from the pattern playing) */
        uint32_t c;
        for (c = 0; c < t->pat_nchain; c++)
            if (t->pat_chain[(t->pat_ci + 1u + c) % t->pat_nchain] == want) {
                t->pat_ci = (uint8_t)((t->pat_ci + 1u + c) % t->pat_nchain);
                break;
            }
    }
    if (want == t->pat || !pat_swap(k, want))
        return 0;
    t->seq_org = nabs;
    return 1;
}
/* no pattern but each track's playing one (pattern 1), no chain, the bank empty: a NEW project, a load (before its own) */
static void pat_reset_all(void)
{
    uint32_t i;
    pb_n = 0;
    for (i = 0; i < NTRK; i++) {
        track_t *t = &trk[i];
        t->pat = 0;
        t->pat_req = t->pat_arm = 0;
        t->pat_nchain = t->pat_ci = 0;
        t->seq_org = 0;
    }
}
/* an entry read from a project (format 7 'P'): track k's pattern pat, LEN len, n bytes. 0: not taken (no room, or
 * not one of this firmware's) */
static int pb_add_raw(uint32_t k, uint32_t pat, uint32_t len, const uint8_t *b, uint32_t n)
{
    if (k >= NTRK || pat >= NPAT || n > 0xFFFFu || pb_find(k, pat) >= 0 || pb_n + 4u + n > PB_SIZE)
        return 0;
    pb_buf[pb_n] = (uint8_t)(k << 4 | pat);
    pb_buf[pb_n + 1u] = (uint8_t)n;
    pb_buf[pb_n + 2u] = (uint8_t)(n >> 8);
    pb_buf[pb_n + 3u] = (uint8_t)clamp((int32_t)len, 1, NSTEP);
    memcpy(pb_buf + pb_n + 4u, b, n);
    pb_n += 4u + n;
    return 1;
}
