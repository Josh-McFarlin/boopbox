/* SPDX-License-Identifier: GPL-3.0-only */
/* The screenshots of the README (tools/make_screens.py builds and runs this): the firmware's own UI on the host, as
 * the host tests drive it (tests/ui_pages_test.c's harness), with a demo project on the eight tracks playing. Writes
 * one 240 x 240 PPM per screen into the directory given.
 *   cc -O2 -w -Ibuild/gen -Ifirmware/src -Ifirmware/hal -Itests tools/screens_demo.c -lm && ./a.out OUTDIR [PALETTE] */
#define UI_PAGES_HARNESS_ONLY 1
#include "ui_pages_test.c"

static void open_page(uint32_t fam, const char *title)     /* the button tapped until its page of that title shows */
{
    uint32_t n;
    open_family(fam);
    frame();
    for (n = 0; n < 16u && strcmp(PAGES[ui.page].title, title); n++) {
        open_family(fam);
        frame();
    }
}

static void shot(const char *name)
{
    ui.force = 1;
    ui.msg_t = 0;
    frame();
    ppm(name);
}

static void synth_line(uint32_t ti, const uint8_t *notes, uint32_t n, uint32_t every, uint32_t len)
{
    track_t *t = &trk[ti];
    uint32_t j, k = 0;
    for (j = 0; j < NSTEP; j++)
        step_clear(&t->step[j]);
    t->p[P_SLEN] = (int16_t)len;
    for (j = 0; j < len; j += every, k++) {
        t->step[j].n = 1;
        t->step[j].note[0] = notes[k % n];
        t->step[j].time = ST_NOTE;
        t->step[j].vel = (uint8_t)(k % 4u ? 92u : 118u);
    }
}

static void demo_project(void)
{
    static const uint8_t BASS[] = {36, 36, 39, 41, 43, 41, 39, 34}, KEYS[] = {60, 63, 67, 58}, LEAD[] = {72, 75, 79, 77, 75, 72};
    static const uint8_t PAD[] = {55, 58}, PLUCK[] = {67, 70, 72, 74, 75, 74, 72, 70}, LEAD2[] = {84, 82, 79};
    /* the drum tracks: 4 a boom bap (kick, snare, hats), 8 percussion (rim, clap, open hat, shaker) */
    static const uint8_t BEAT[16] = {0x11, 0x10, 0x10, 0x11, 0x14, 0x10, 0x10, 0x21, 0x11, 0x10, 0x01, 0x10, 0x1C, 0x10, 0x10, 0x20};
    uint32_t i, j;
    for (i = 0; i < NTRK; i++) {                    /* the power-on sounds (params.c TRK_DEF), as the FM-1 starts */
        if (is_drum(&trk[i])) {
            trk[i].p[P_E0] = (int16_t)TRK_DEF[i][1];
            continue;
        }
        set_engine_of(&trk[i], TRK_DEF[i][1]);
        apply_preset_to(&trk[i], TRK_DEF[i][2]);
        trk[i].engine = trk[i].eng_req;
        for (j = 0; j < NSTEP; j++)
            step_clear(&trk[i].step[j]);
    }
    synth_line(0, BASS, sizeof BASS, 2, 16);
    synth_line(1, KEYS, sizeof KEYS, 4, 16);
    synth_line(2, LEAD, sizeof LEAD, 3, 16);
    synth_line(4, PAD, sizeof PAD, 8, 16);
    synth_line(5, PLUCK, sizeof PLUCK, 1, 8);
    synth_line(6, LEAD2, sizeof LEAD2, 5, 16);
    for (j = 0; j < 16u; j++) {
        dstep_t *d = &trk[3].dstep[j], *e = &trk[7].dstep[j];
        memset(d, 0, sizeof *d);
        memset(e, 0, sizeof *e);
        if (BEAT[j] & 1u) dstep_set(d, 0, LV_HARD, 0);
        if (BEAT[j] & 4u) dstep_set(d, 2, LV_NORM, 0);
        if (BEAT[j] & 8u) dstep_set(d, 3, LV_GHOST, 0);
        if (BEAT[j] & 0x10u) dstep_set(d, 4, j % 4u ? LV_SOFT : LV_NORM, j == 14u ? 2u : 0u);
        if (BEAT[j] & 0x20u) dstep_set(d, 5, LV_NORM, 0);
        if (j % 4u == 2u) dstep_set(e, 7, LV_NORM, 0);
        if (j % 8u == 4u) dstep_set(e, 3, LV_SOFT, 0);
        if (j % 2u) dstep_set(e, 13, LV_GHOST, 0);
        if (j == 15u) dstep_set(e, 5, LV_NORM, 0);
    }
    trk[3].p[P_SLEN] = trk[7].p[P_SLEN] = 16;
}

#ifndef SCREENS_DEMO_NO_MAIN                        /* (tools/screens_all.c: its helpers, its own main) */
int main(int argc, char **argv)
{
    static const struct { uint8_t style; const char *name; } VIS[6] = {
        {0, "vis-palms"}, {1, "vis-night-drive"}, {2, "vis-horizon"}, {3, "vis-flyover"}, {4, "vis-dense-city"},
        {5, "vis-key-city"}};
    uint32_t i;
    outdir = argc > 1 ? argv[1] : "/tmp";
    panel = PANEL_DEFAULT;
    layers_init();
    settings.palette = (uint8_t)(argc > 2 ? atoi(argv[2]) % (int)NPALETTES : 4);   /* MONO at power-on (panel.c) */
    palette_set(settings.palette);
    host_tracks_init();
    demo_project();
    boopbox_splash();
    ppm("boot");
    song.g[G_BPM] = 92;
    transport_req = 1;
    frames(90);

    /* the main screens */
    song.sel = 0; go_home(); frames(6); shot("tracks-1-4");
    song.sel = 5; go_home(); frames(6); shot("tracks-5-8");
    song.sel = 0; go_home(); frames(2);
    open_page(FAM_SEQ, "PATTERNS");
    for (i = 0; i < 3u; i++) {                          /* a few patterns copied: pattern 1 into 2, 3 and 5 of track 1 */
        static const int8_t AT[3] = {1, 1, 2};
        encs[panel.enc[EN_K1]] = AT[i]; frame();
        encs[panel.enc[EN_K4]] = 1; frame();
        encs[panel.enc[EN_K4]] = 1; frame();
    }
    encs[panel.enc[EN_K1]] = -4; frame();
    shot("patterns");
    song.sel = 3; studio_open(SC_DRUM); frames(16);
    drum_lane = 4; drum_cursor = 6; drum_page = 0; drums.hits[3] = 1u | 1u << 4; shot("drums");
    song.sel = 0; go_home(); frames(2);
    open_page(FAM_SEQ, "NOTES"); cursor_set(0); frames(4); shot("notes");
    go_home(); frames(2);
    press(B_FX); frames(24); shot("layer-fx"); release(B_FX); frames(4);
    song.sel = 5; go_home(); frames(2);
    press(B_GLO); frames(30); key(1); shot("layer-mix-5-8"); key(1); release(B_GLO); frames(4);
    transport_req = 2; frames(2);                       /* (the progression edited stopped, as the host test does) */
    song.sel = 0; go_home(); frames(2);
    harm_defaults();
    open_page(FAM_SCL, "CHORDS");
    {                                                   /* a progression: vi IV I V, a bar each, in A minor's key */
        static const uint8_t DEG[4] = {5, 3, 0, 4};
        harm.n = 4;
        for (i = 0; i < 4u; i++)
            harm.c[i].deg = DEG[i], harm.c[i].bars = 1;
        song.g[G_HPROG] = 1;
        trk[1].hfol = HF_SCALE, trk[2].hfol = HF_TRANS, trk[5].hfol = HF_SCALE;
    }
    transport_req = 1; frames(60);
    shot("chords");
    go_home(); frames(2);
    open_page(FAM_SEQ, "SONG"); frames(2); shot("song");
    go_home(); frames(2);
    open_page(FAM_ENV, "ENV"); frames(4); shot("page-env");
    go_home(); frames(2);
    press(B_HOME); frames(60); release(B_HOME); frames(30); ppm("menu");   /* (the menu draws a row a frame) */
    press(B_HOME); frames(60); release(B_HOME); frames(2);

    /* the visualiser: its six styles */
    song.sel = 0; go_home(); frames(4);
    for (i = 0; i < 6u; i++) {
        vis_style = VIS[i].style;
        vis_open();
        frames(40);
        vis_name_t = 0;
        shot(VIS[i].name);
        go_home();
        frames(2);
    }
    return 0;
}
#endif
