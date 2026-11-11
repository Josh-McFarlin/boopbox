/* SPDX-License-Identifier: GPL-3.0-only */
/* NRPN (seq.c midi_nrpn, 1.8, after JIANT FM's NRPN map): CC99 0 + CC98 n select track parameter n, CC6 / CC38 set it
 * with 14 bits over its range (CC6 alone: 7 bits); the selection stays; CC99 other than 0 and an RPN end it; nothing is
 * selected at power-on; a drum track and the engine's EDIT values use their own ranges; the plain CC map still works.
 * With --write FILE it writes the NRPN map (docs/NRPN.md) from the firmware's own tables; run_tests.sh checks that the
 * committed file is what this writes.
 *   cc -O2 -w -Ibuild/gen -Ifirmware/src -Ifirmware/hal tests/nrpn_test.c -lm */
#define main hostsim_main
#include "hostsim.c"
#undef main

static int fails;
static void check(int ok, const char *what)
{
    printf("nrpn: %-90s %s\n", what, ok ? "ok" : "FAIL");
    if (!ok)
        fails++;
}
static void cc(track_t *t, uint32_t c, uint32_t v) { midi_cc(t, c, v); }
static void nrpn(track_t *t, uint32_t id, uint32_t x14)
{
    cc(t, 99, 0);
    cc(t, 98, id);
    cc(t, 6, x14 >> 7);
    cc(t, 38, x14 & 127u);
}
static track_t *synth(void)
{
    uint32_t i;
    for (i = 0; i < NTRK; i++)
        if (!is_drum(&trk[i]))
            return &trk[i];
    return &trk[0];
}
static track_t *drum(void)
{
    uint32_t i;
    for (i = 0; i < NTRK; i++)
        if (is_drum(&trk[i]))
            return &trk[i];
    return 0;
}

static void range(FILE *f, const param_desc_t *d)
{
    int32_t v;
    fprintf(f, "%d..%d | %d |", d->min, d->max, d->def);
    if (d->names) {
        for (v = d->min; v <= d->max; v++)
            fprintf(f, " %s", d->names[v]);
    }
}
static int write_doc(const char *path)
{
    FILE *f = fopen(path, "w");
    uint32_t i, e, k;
    if (!f)
        return 1;
    fprintf(f, "# BoopBox: the NRPN map\n\n"
               "<!-- Generated from firmware/src/params.c and the engines by tests/nrpn_test.c (`nrpn_test --write`);\n"
               "     tests/run_tests.sh fails when this file and the firmware differ. Do not edit by hand. -->\n\n"
               "Every parameter of a track's sound, mix and sequencer can be set over MIDI with an **NRPN** (after JIANT FM's\n"
               "NRPN map), with more resolution than a CC. The CC map (CC5 7 10 71..75 91 93 94, CC11, CC64) and MIDI LEARN are\n"
               "unchanged.\n\n"
               "- **Select:** CC99 (NRPN MSB) **0**, then CC98 (NRPN LSB) the parameter's number below, on the channel the\n"
               "  track plays (MIDI 3 > IN = CH n sends it to the selected track).\n"
               "- **The value:** CC6 (data entry MSB) then CC38 (LSB): 14 bits, 0..16383, over the parameter's range:\n"
               "  `v = min + (x * (max - min) + 8191) / 16383`. CC6 alone is a 7-bit value (`x = msb * 129`).\n"
               "- The parameter stays selected: more CC6 / CC38 set it again. CC99 with another value, or CC101 / CC100 (an\n"
               "  RPN), end the selection. Nothing is selected at power-on.\n"
               "- A **drum track** takes LVL, REV and DLY over its own drum mix ranges; its other numbers set the track's\n"
               "  values as on a synth track.\n\n"
               "## Track parameters (CC99 0)\n\n"
               "| CC98 | parameter | range | default | values |\n| --- | --- | --- | --- | --- |\n");
    for (i = 0; i < P_E0; i++) {
        fprintf(f, "| %u | %s | ", i, TP[i].label);
        range(f, &TP[i]);
        fprintf(f, " |\n");
    }
    fprintf(f, "\n## The engine's EDIT values (CC98 %u..%u)\n\n"
               "Each engine gives these eight its own meaning (the EDIT page's knobs); the range is the engine's.\n\n"
               "| engine | CC98 | parameter | range | default | values |\n| --- | --- | --- | --- | --- | --- |\n",
            (unsigned)P_E0, (unsigned)P_E7);
    for (e = 0; e < NENGINES; e++)
        for (k = 0; k < 8u; k++) {
            const param_desc_t *d = &ENGINES[e]->edit[k];
            if (!d->label || d->max <= d->min)
                continue;
            fprintf(f, "| %s | %u | %s | ", ENGINES[e]->name, (unsigned)(P_E0 + k), d->label);
            range(f, d);
            fprintf(f, " |\n");
        }
    fclose(f);
    return 0;
}

int main(int argc, char **argv)
{
    track_t *s, *d;
    if (argc == 3 && !strcmp(argv[1], "--write"))
        return write_doc(argv[2]);
    host_tracks_init();
    s = synth();
    d = drum();

    s->p[P_LEVEL] = 50;
    cc(s, 6, 127);
    check(s->p[P_LEVEL] == 50, "nothing selected at power-on: a stray CC6 sets nothing");

    nrpn(s, P_LEVEL, 16383);
    check(s->p[P_LEVEL] == 127, "LEVEL 16383 = its max");
    nrpn(s, P_LEVEL, 0);
    check(s->p[P_LEVEL] == 0, "LEVEL 0 = its min");
    nrpn(s, P_PAN, 8192);
    check(s->p[P_PAN] == 0, "PAN (-64..63) 8192 = the middle");
    nrpn(s, P_PAN, 0);
    check(s->p[P_PAN] == -64, "PAN 0 = -64");
    nrpn(s, P_TRANS, 16383);
    check(s->p[P_TRANS] == 24, "TRANS 16383 = +24");

    cc(s, 6, 64);
    check(s->p[P_TRANS] == (int16_t)(-24 + (64 * 129 * 48 + 8191) / 16383), "the selection stays: CC6 alone, 7 bits x 129");
    cc(s, 38, 127);
    check(s->p[P_TRANS] == (int16_t)(-24 + (((64u << 7) | 127u) * 48 + 8191) / 16383), "CC38 after CC6: 14 bits");

    cc(s, 101, 0);
    s->p[P_TRANS] = 3;
    cc(s, 6, 0);
    check(s->p[P_TRANS] == 3, "an RPN (CC101) ends the selection");

    cc(s, 99, 1);
    cc(s, 98, P_LEVEL);
    s->p[P_LEVEL] = 77;
    cc(s, 6, 0);
    check(s->p[P_LEVEL] == 77, "CC99 other than 0: no track parameter selected");

    cc(s, 99, 0);
    cc(s, 98, 127);
    cc(s, 6, 0);
    check(s->p[P_LEVEL] == 77, "a number past the table selects nothing");

    {
        const param_desc_t *ed = &ENGINES[s->eng_req % NENGINES]->edit[0];
        nrpn(s, P_E0, 16383);
        check(ed->max <= ed->min || s->p[P_E0] == ed->max, "the engine's EDIT 1 (CC98 P_E0) over the engine's own range");
    }

    if (d) {
        const param_desc_t *dl = track_desc(d, P_LEVEL);
        nrpn(d, P_LEVEL, 16383);
        check(d->p[P_LEVEL] == dl->max, "drum track: LVL over the drum mix's range");
        nrpn(d, P_PAN, 0);
        check(d->p[P_PAN] == -64, "drum track: PAN");
    }

    nrpn(s, P_LEVEL, 0);
    cc(s, 7, 127);
    check(s->p[P_LEVEL] == 127, "the CC map still works beside NRPN (CC7 LEVEL)");
    {
        track_t *o = s == &trk[0] ? &trk[1] : &trk[0];
        int16_t keep = o->p[P_LEVEL];
        nrpn(s, P_LEVEL, 0);
        cc(o, 6, 127);
        check(o->p[P_LEVEL] == keep, "each track its own selection");
    }

    printf("nrpn: %s\n", fails ? "FAILED" : "all passed");
    return fails != 0;
}
