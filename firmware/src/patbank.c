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
 * (pat_chain, 2 to NCHAIN slots, PLAY on) plays its slots in turn, each its pattern for its repeats' loops (an asked
 * change goes first; the chain goes on from it). Scenes (below) ask every track for a pattern at once.
 * Bounded work: one encode and one decode a track and step at most, a bank move of PB_SIZE bytes at most. */
#define PB_SIZE 3072u
static uint8_t pb_buf[PB_SIZE];
static uint32_t pb_n;                            /* bytes used */
static volatile uint8_t pb_full;                 /* a change was refused: the pattern playing did not fit (the UI says so) */
enum { PQ_LOOP, PQ_BAR, PQ_2BAR, PQ_4BAR };      /* G_PATQ */

CTL_SMALL static int pb_find(uint32_t k, uint32_t pat)     /* track k's pattern pat: its entry's offset, -1: none (empty) */
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
CTL_SMALL static uint32_t pb_entry(uint32_t o) { return 4u + ((uint32_t)pb_buf[o + 1u] | (uint32_t)pb_buf[o + 2u] << 8); }
CTL_SMALL static void pb_drop(uint32_t k, uint32_t pat)    /* its entry out (the bank closes up) */
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
CTL_SMALL static void pb_drop_track(uint32_t k)            /* every pattern of track k out */
{
    uint32_t p;
    for (p = 0; p < NPAT; p++)
        pb_drop(k, p);
}
CTL_SMALL static uint32_t pb_used(uint32_t k)              /* the patterns of track k the bank holds, a bit each */
{
    uint32_t o = 0, m = 0;
    while (o + 4u <= pb_n) {
        if ((pb_buf[o] >> 4) == k)
            m |= 1u << (pb_buf[o] & 15u);
        o += pb_entry(o);
    }
    return m;
}
CTL_SMALL static int pat_empty(const track_t *t)           /* the pattern playing holds nothing (as steps_clear leaves it) */
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
CTL_SMALL static int pb_store(uint32_t k, uint32_t pat)
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
CTL_SMALL static void pb_load(uint32_t k, uint32_t pat)
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
CTL_SMALL static int pat_swap(uint32_t k, uint32_t pat)
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
/* the chain of track k: n slots (CH_SLOT bytes: a pattern and its repeats; 0: none). It plays with 2 slots or more and
 * PLAY on (pat_coff 0); fewer are kept (a chain being built). The slot playing: the first of the pattern playing. The UI,
 * with the IRQ off */
CTL_SMALL static void pat_chain_set(track_t *t, const uint8_t *p, uint32_t n)
{
    uint32_t i;
    n = n > NCHAIN ? NCHAIN : n;
    for (i = 0; i < n; i++)
        t->pat_chain[i] = (uint8_t)(p[i] & 0xF7u);
    t->pat_nchain = (uint8_t)n;
    t->pat_ci = 0;
    t->pat_cr = 0;
    for (i = 0; i < n; i++)
        if (CH_PAT(t->pat_chain[i]) == t->pat) {
            t->pat_ci = (uint8_t)i;
            break;
        }
}
CTL_SMALL static int chain_on(const track_t *t) { return !t->pat_coff && t->pat_nchain >= 2u; }
/* the grid step of track t at or after the next n-bar line (a bar: 4 beats from PLAY) */
CTL_SMALL static uint32_t pat_bar_step(const track_t *t, uint32_t bars)
{
    uint32_t span = 4u * bars, b = (clk_beat / span + 1u) * span, su = div_units(trk_div(t));
    if (su <= BEAT_U)
        return b * (BEAT_U / su);
    return (b + su / BEAT_U - 1u) / (su / BEAT_U);
}
/* once a block, before the tracks' steps (events_block): a change asked for is seen (its boundary), stopped it is made */
CTL_SMALL static void pat_block(void)
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
CTL_SMALL static int pat_loop_start(const track_t *t, uint32_t nabs, uint32_t len)
{
    if (comp_flow(t))
        return !t->cp_rep && (t->cp_adv + 1u) % len == 0u;
    return (nabs - t->seq_org) % len == 0u;
}
/* (seq_tick, on a step about to fire) a pattern change due on it: made; 1 if the track now plays another pattern from
 * its step 1 (seq_org is this step) */
CTL_SMALL static int pat_due(track_t *t, uint32_t nabs, uint32_t len, uint32_t start)
{
    uint32_t k = trk_index(t), want = NPAT, n = t->pat_nchain;
    int next = -1;                               /* (the chain's next slot, when the chain makes the change) */
    if (t->pat_arm && t->pat_req == t->pat_arm &&
        (start || (t->pat_at == SEQ_NONE ? pat_loop_start(t, nabs, len) : (int32_t)(nabs - t->pat_at) >= 0))) {
        want = t->pat_arm - 1u;
    } else if (chain_on(t) && !t->pat_req && !start && pat_loop_start(t, nabs, len)) {
        uint32_t ci = t->pat_ci % n;
        if (CH_PAT(t->pat_chain[ci]) == t->pat && t->pat_cr + 1u < CH_REP(t->pat_chain[ci])) {
            t->pat_cr++;                         /* (the slot's repeats: another loop of it) */
            return 0;
        }
        next = (int)((ci + 1u) % n);
        want = CH_PAT(t->pat_chain[next]);
    }
    if (want >= NPAT)
        return 0;
    if (want == t->pat_arm - 1u && t->pat_arm) {
        t->pat_req = 0;
        t->pat_arm = 0;
    }
    if (next >= 0) {
        t->pat_ci = (uint8_t)next;
    } else if (n) {                              /* (asked for: the chain goes on from its next slot of that pattern) */
        uint32_t c;
        for (c = 0; c < n; c++)
            if (CH_PAT(t->pat_chain[(t->pat_ci + 1u + c) % n]) == want) {
                t->pat_ci = (uint8_t)((t->pat_ci + 1u + c) % n);
                break;
            }
    }
    t->pat_cr = 0;
    if (want == t->pat || !pat_swap(k, want))
        return 0;
    t->seq_org = nabs;
    return 1;
}
/* ---- scenes: a moment of the song, each track's pattern in it (SCN_KEEP: the track goes on with what it plays) and a
 * name (N_SCN). Launched, every track of it is asked for its pattern (quantized as any change: G_PATQ); the scene is
 * the one playing once they all made it. Saved with the project ('C', project.c); by default scene s is pattern s on
 * every track, no name. The UI's (ui_pats.c); the ISR only makes the changes asked for */
#define NSCENE 8u
#define SCN_KEEP 8u
#define SCN_NONE 0xFFu
static const char *const N_SCN[] = {"-", "INTRO", "VERSE", "PRE", "CHORUS", "BRIDGE", "BREAK", "BUILD", "DROP",
                                    "OUTRO", "FILL", "HOOK", "SOLO", "ALT", "A", "B", "C", "D", "END"};
#define NSCN_NAMES (sizeof N_SCN / sizeof N_SCN[0])
static uint8_t scn_pat[NSCENE][NTRK];
static uint8_t scn_name[NSCENE];
static uint8_t scn_cur = SCN_NONE, scn_ask = SCN_NONE;    /* the scene playing (last made), the one asked for */
CTL_SMALL static void scn_defaults(void)
{
    uint32_t s, k;
    for (s = 0; s < NSCENE; s++) {
        scn_name[s] = 0;
        for (k = 0; k < NTRK; k++)
            scn_pat[s][k] = (uint8_t)s;
    }
    scn_cur = scn_ask = SCN_NONE;
}
CTL_SMALL static int scn_default(void)          /* (nothing to save) */
{
    uint32_t s, k;
    for (s = 0; s < NSCENE; s++) {
        if (scn_name[s])
            return 0;
        for (k = 0; k < NTRK; k++)
            if (scn_pat[s][k] != s)
                return 0;
    }
    return 1;
}
/* scene s asked for: each of its tracks its pattern (a track already playing it with nothing else asked: unchanged) */
CTL_SMALL static void scn_launch(uint32_t s)
{
    uint32_t k;
    s %= NSCENE;
    for (k = 0; k < NTRK; k++) {
        uint32_t p = scn_pat[s][k];
        if (p >= NPAT)
            continue;
        if (p != trk[k].pat || trk[k].pat_req)
            trk[k].pat_req = (uint8_t)(p + 1u);
    }
    scn_ask = (uint8_t)s;
}
/* (the UI, every frame) the scene asked for is the one playing once none of its tracks waits for its pattern; a track
 * asked for another pattern meanwhile, or one that could not change (PATTERNS FULL), ends the wait as well */
CTL_SMALL static void scn_poll(void)
{
    uint32_t k, wait = 0;
    if (scn_ask >= NSCENE)
        return;
    for (k = 0; k < NTRK; k++) {
        uint32_t p = scn_pat[scn_ask][k];
        if (p < NPAT && trk[k].pat_req == p + 1u)
            wait = 1;
    }
    if (!wait) {
        scn_cur = scn_ask;
        scn_ask = SCN_NONE;
    }
}
/* the patterns playing now into scene s (its name kept) */
CTL_SMALL static void scn_store(uint32_t s)
{
    uint32_t k;
    for (k = 0; k < NTRK; k++)
        scn_pat[s % NSCENE][k] = trk[k].pat;
    scn_cur = (uint8_t)(s % NSCENE);
}
/* no pattern but each track's playing one (pattern 1), no chain, the bank empty: a NEW project, a load (before its own) */
CTL_SMALL static void pat_reset_all(void)
{
    uint32_t i;
    pb_n = 0;
    for (i = 0; i < NTRK; i++) {
        track_t *t = &trk[i];
        t->pat = 0;
        t->pat_req = t->pat_arm = 0;
        t->pat_nchain = t->pat_ci = t->pat_cr = t->pat_coff = 0;
        t->seq_org = 0;
    }
    scn_defaults();                              /* (and the scenes: the project's too) */
}
/* an entry read from a project (format 7 'P'): track k's pattern pat, LEN len, n bytes. 0: not taken (no room, or
 * not one of this firmware's) */
CTL_SMALL static int pb_add_raw(uint32_t k, uint32_t pat, uint32_t len, const uint8_t *b, uint32_t n)
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
