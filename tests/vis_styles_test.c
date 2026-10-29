/* SPDX-License-Identifier: GPL-3.0-only */
/* The visualiser with only some of its styles built in (FELUCCA_VIS_STYLES, ui_vis.c): opened on a style kept with the
 * settings that is not built in, it shows the next one that is; SELECT steps over the missing ones both ways; every
 * style built in draws.
 *   cc -O2 -Ibuild/gen -Ifirmware/src -Ifirmware/hal tests/vis_styles_test.c -lm */
#define FELUCCA_VIS_STYLES 0x533u                   /* OSCILLOSCOPE, SPECTRUM, VU METERS, CIRCLE, BOUNCE, WIRES */
#define UI_PAGES_HARNESS_ONLY 1
#include "ui_pages_test.c"

static uint32_t lit(void)                           /* the lit pixels under the name row */
{
    uint32_t i, n = 0;
    for (i = 240u * 24u; i < 240u * 240u; i++)
        n += screen[i] != 0;
    return n;
}

int main(int argc, char **argv)
{
    static const uint8_t FWD[6] = {5, 8, 10, 0, 1, 4}, BACK[6] = {1, 0, 10, 8, 5, 4};
    uint32_t i, j, ok;
    outdir = argc > 1 ? argv[1] : "/tmp";
    panel = PANEL_DEFAULT;
    layers_init();
    host_tracks_init();
    for (i = 0; i < NTRK; i++)
        if (!is_drum(&trk[i])) {
            set_engine_of(&trk[i], 0);
            apply_preset_to(&trk[i], 0);
            trk[i].engine = trk[i].eng_req;
        }
    for (j = 0; j < 16u; j += 2u) {                 /* (a note every other step: something to show) */
        step_t *s = &trk[0].step[j];
        memset(s, 0, sizeof *s);
        s->n = 1, s->note[0] = (uint8_t)(48u + j), s->time = ST_NOTE, s->vel = 100;
    }
    trk[0].p[P_SLEN] = 16;
    transport_req = 1;
    frames(60);
    song.sel = 0;
    go_home();
    frames(3);

    vis_style = 2;                                  /* SPECTROGRAM: kept with the settings, not built in */
    vis_open();
    frames(4);
    check(vis_shown() && vis_style == 4, "vis styles: opened on a style not built in: the next one built in (VU METERS)");
    for (i = 0, ok = 1; i < 6u; i++) {
        vis_select(1);
        ok &= vis_style == FWD[i];
    }
    check(ok, "vis styles: SELECT right steps over the styles not built in (VU, CIRCLE, BOUNCE, WIRES, SCOPE, SPECTRUM)");
    for (i = 0, ok = 1; i < 6u; i++) {
        vis_select(-1);
        ok &= vis_style == BACK[i];
    }
    check(ok, "vis styles: SELECT left the same way back");
    for (i = 0, ok = 1; i < 6u; i++) {
        uint32_t n;
        vis_select(1);
        frames(40);
        vis_name_t = 0, ui.msg_t = 0, ui.force = 1;
        frames(4);
        n = lit();
        if (!n) {
            printf("   style %u drew nothing\n", vis_style + 1u);
            ok = 0;
        }
    }
    check(ok, "vis styles: every style built in draws");
    vis_style = 2;                                  /* (set directly, past vis_open / vis_select: nothing of it is built) */
    vis_name_t = 0, ui.msg_t = 0, ui.force = 1;
    frames(4);
    check(lit() == 0, "vis styles: a style not built in draws nothing (SPECTROGRAM set directly)");
    vis_on = 0;
    go_home();
    frames(2);
    printf(fails ? "vis styles: %d FAILED\n" : "vis styles: all passed\n", fails);
    return fails != 0;
}
