/* SPDX-License-Identifier: GPL-3.0-only */
/* SAVE > CLEAR > SONG (firmware/src/ui_input.c song_clear, project.c sections_clear) with the real project.c and
 * storage.c on the RAM flash of tests/editor_host.c: two detents of KNOB 1 make a new working loop, leave the four
 * sections empty in RAM and in flash, and the song order the default A B C D in loop mode. Refused while playing;
 * the user presets stay. */
#include "editor_host.c"

static int fails;
static void check(const char *what, int ok) { printf("%-72s %s\n", what, ok ? "ok" : "FAIL"); fails += !ok; }
static void frame(void) { ui_frame(); }
static void frames(uint32_t n) { while (n--) ui_frame(); }
static void turn1(void) { encs[panel.enc[EN_K1]] = 1; frame(); }

int main(void)
{
    uint32_t s, empty = 1, up_before;
    harness_init();
    check("the flash is there", flash_ok);
    transport_req = 2; frames(2);
    trk[0].step[0].time = ST_NOTE; trk[0].step[0].n = 1; trk[0].step[0].note[0] = 60;
    song.g[G_BPM] = 133;
    project_save(0);
    project_save(2);
    up_ui(2u, 0u);                                     /* (user preset 1 saved: it must stay) */
    up_before = up_used(0);
    arrangement.count = 2; arrangement.entry[0].scene = 2; arrangement.entry[1].scene = 0; arrangement.loop = 1;
    arrangement_enabled = 1;
    check("sections A and C saved", project_used(0) && project_used(2) && !project_used(1));

    go_home(); frame();
    open_family(FAM_SAVE); frame();
    while (strcmp(PAGES[ui.page].title, "CLEAR")) { open_family(FAM_SAVE); frame(); }
    song.playing = 1;
    turn1(); turn1();
    check("playing: refused, STOP THE SONG FIRST", !strcmp(ui.msg, "STOP THE SONG FIRST") && project_used(0));
    song.playing = 0; transport_req = 2; frames(2);

    turn1();
    check("one detent arms (TURN AGAIN), nothing cleared", ui.arm == G_CLRSONG && project_used(0) && song.g[G_BPM] == 133);
    turn1();
    check("the second: SONG CLEARED", !strcmp(ui.msg, "SONG CLEARED"));
    for (s = 0; s < 4u; s++)
        empty &= !project_used(s);
    check("every section empty in RAM", empty);
    for (s = 0, empty = 1; s < 4u; s++)
        empty &= st_load(OBJ_PROJECT0 + s, &proj_tmp, sizeof proj_tmp) <= 0;
    check("... and in flash (an empty object, as ERASE leaves)", empty);
    check("the working loop new: no notes, 90 BPM", project_empty() && song.g[G_BPM] == GP[G_BPM].def);
    check("the song order the default A B C D, loop mode",
          arrangement.count == 4u && !arrangement.loop && arrangement.entry[0].scene == 0u &&
          arrangement.entry[3].scene == 3u && !arrangement_enabled);
    check("the user presets stay", up_before && up_used(0));
    printf("song_clear: %s\n", fails ? "FAIL" : "ok");
    return fails != 0;
}
