/* SPDX-License-Identifier: GPL-3.0-only */
/* The visualiser (ui_vis.c) with only some of its six styles built in (FELUCCA_VIS_STYLES): opened on a style kept
 * with the settings that is not built in, it shows the next one that is; SELECT steps over the missing ones both ways;
 * every style built in draws, one not built in nothing. And what the styles read: a note lights its key (KEY CITY,
 * a chord all its keys), the tracks' levels and peaks (DENSE CITY), tiles on the beat (HORIZON), the drive slowing to
 * a stop after STOP (NIGHT DRIVE).
 *   cc -O2 -Ibuild/gen -Ifirmware/src -Ifirmware/hal tests/vis_styles_test.c -lm */
#define FELUCCA_VIS_STYLES 0x36u                    /* NIGHT DRIVE, HORIZON, DENSE CITY, KEY CITY (not PALMS, FLYOVER) */
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
    static const uint8_t FWD[4] = {2, 4, 5, 1}, BACK[4] = {5, 4, 2, 1};
    uint32_t i, j, ok, keys = 0, tiles = 0, d0, d1;
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
    for (j = 0; j < 16u; j += 2u) {                 /* (a note every other step, a chord on the first: something to show) */
        step_t *s = &trk[0].step[j];
        memset(s, 0, sizeof *s);
        s->n = 1, s->note[0] = (uint8_t)(48u + j), s->time = ST_NOTE, s->vel = 100;
    }
    trk[0].step[0].n = 3, trk[0].step[0].note[1] = 52, trk[0].step[0].note[2] = 55;
    trk[0].p[P_SLEN] = 16;
    transport_req = 1;
    frames(60);
    song.sel = 0;
    go_home();
    frames(3);

    vis_style = 0;                                  /* PALMS: kept with the settings, not built in */
    vis_open();
    frames(4);
    check(vis_shown() && vis_style == 1, "vis styles: opened on a style not built in: the next one built in (NIGHT DRIVE)");
    for (i = 0, ok = 1; i < 4u; i++) {
        vis_select(1);
        ok &= vis_style == FWD[i];
    }
    check(ok, "vis styles: SELECT right steps over the styles not built in (HORIZON, DENSE CITY, KEY CITY, NIGHT DRIVE)");
    for (i = 0, ok = 1; i < 4u; i++) {
        vis_select(-1);
        ok &= vis_style == BACK[i];
    }
    check(ok, "vis styles: SELECT left the same way back");
    for (i = 0, ok = 1; i < 4u; i++) {
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
    for (i = 0; i < 120u; i++) {                    /* (four seconds: the pattern twice) */
        frame();
        for (j = 0; j < 24u; j++)
            keys |= (uint32_t)(vs.key[j] > 200u) << j;
        for (j = 0; j < 24u; j++)
            tiles += vs.tile[j].born != 0u;
    }
    check(keys & (1u << 0) && keys & (1u << 4) && keys & (1u << 7) && keys & (1u << 14),
          "vis styles: KEY CITY: a note lights its key (C3, a chord's E3 and G3 too, D4)");
    check(!(keys & (1u << 1)), "vis styles: KEY CITY: a key not played stays dark (C#3)");
    check(vs.pk[0] > 300 && vs.pk[NTRK] > 300 && vs.vu[3] < 50,
          "vis styles: DENSE CITY: track 1 and the master rise, a silent track stays down");
    check(tiles >= 7u, "vis styles: HORIZON: tiles on the beat");
    transport_req = 2;                              /* STOP: the car slows down and parks */
    frames(120);
    d0 = vs.drv;
    frames(30);
    d1 = vs.drv;
    check(!song.playing && vs.spd == 0u && d0 == d1, "vis styles: NIGHT DRIVE: stopped, the drive slows to a stop");
    vis_style = 3;                                  /* (set directly, past vis_open / vis_select: nothing of it is built) */
    vis_name_t = 0, ui.msg_t = 0, ui.force = 1;
    frames(4);
    check(lit() == 0, "vis styles: a style not built in draws nothing (FLYOVER set directly)");
    vis_on = 0;
    go_home();
    frames(2);
    printf(fails ? "vis styles: %d FAILED\n" : "vis styles: all passed\n", fails);
    return fails != 0;
}
