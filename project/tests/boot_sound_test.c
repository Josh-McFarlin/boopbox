/* SPDX-License-Identifier: GPL-3.0-only */
/* After an install (a power-on on the flash as it was), track 1 (and the other parts) sound as their sound: the
 * values the boot leaves equal the ones the same sound gets when it is loaded again. And a four-track working project
 * SLOOP (or Clipper) left in the flash is not read: the default sounds, an empty pattern. Exit status: failed checks. */
#include "editor_host.c"
static int fails;
static void check(int c, const char *what) { printf("boot_sound: %-80s %s\n", what, c ? "ok" : "FAIL"); fails += !c; }
static int16_t snapv[NPART][P_COUNT];
static void boot_as_main(void)
{
    uint32_t i;
    persist_boot();
    settings_init();
    panel_init();
    for (i = 0; i < G_COUNT; i++) song.g[i] = GP[i].def;
    fm6_init();
    for (i = 0; i < NTRK; i++) {
        track_t *t = &trk[i];
        track_defaults(t);
        if (i < NPART) { set_engine_of(t, TRK_DEF[i][0]); apply_preset_to(t, TRK_DEF[i][1]); t->engine = t->eng_req; }
        track_defaults_steps(t);
    }
    TDRUM->p[P_E0] = DRUM_DEFAULT_KIT;
    song.sel = 0;
    autosave_resume();
    layers_init();
    go_home();
    ui.force = 1;
}
static void compare(const char *when)
{
    uint32_t k, i;
    char b[160];
    for (k = 0; k < NPART; k++) {
        int16_t now[P_COUNT];
        uint32_t e = trk[k].eng_req, pi = trk[k].preset, bad = 0;
        memcpy(now, trk[k].p, sizeof now);
        memcpy(snapv[k], trk[k].p, sizeof now);
        apply_preset_to(&trk[k], pi);                 /* the same sound loaded again */
        for (i = 0; i < P_COUNT; i++)
            if (now[i] != trk[k].p[i]) {
                if (bad++ < 6)
                    printf("boot_sound: %s track %u (%s %s): p[%u] %s %d, loaded again %d\n", when, k + 1, ENGINES[e]->name,
                           ENGINES[e]->presets[pi % ENGINES[e]->npresets].name, i, i < P_E0 ? TP[i].label : "E", now[i], trk[k].p[i]);
            }
        snprintf(b, sizeof b, "%s: track %u plays its sound as loaded (every value)", when, k + 1);
        check(!bad, b);
        memcpy(trk[k].p, now, sizeof now);
    }
}
/* track k's note: its zero-crossing rate over 0.3 .. 0.8 s (Hz, the fundamental of a bass sine) */
static double note_hz(uint32_t k, uint32_t note)
{
    static int32_t o[CTL * 2];
    uint32_t b, i, zc = 0, n = 0;
    int32_t prev = 0;
    for (i = 0; i < NTRK; i++) trk_all_off(&trk[i]);
    for (b = 0; b < 600; b++) mix_block(o, CTL);
    trk_note_on(&trk[k], note, 100);
    for (b = 0; b < 1200; b++) {
        mix_block(o, CTL);
        if (b < 400) continue;
        for (i = 0; i < CTL; i++, n++) { int32_t y = o[2 * i]; if ((prev < 0) != (y < 0)) zc++; prev = y; }
    }
    trk_note_off(&trk[k], note);
    return zc / 2.0 * FS / n;
}
static void pitch_check(const char *when)
{
    uint32_t k;
    char b[160];
    for (k = 0; k < NPART; k++) {
        double a = note_hz(k, 48), c;
        apply_preset_to(&trk[k], trk[k].preset);
        c = note_hz(k, 48);
        printf("boot_sound: %s track %u note C3: %.1f Hz, the sound loaded again %.1f Hz\n", when, k + 1, a, c);
        snprintf(b, sizeof b, "%s: track %u at its pitch (as the sound loaded again)", when, k + 1);
        check(a > c * 0.97 && a < c * 1.03, b);
    }
}
/* the FM-1's key C4 (key 7) on track k: the note its voice plays */
static int key_note(uint32_t k)
{
    uint32_t i, f;
    int n = -1;
    song.sel = (uint8_t)k;
    for (f = 0; f < 4; f++) ui_frame();
    fm1_in.notes = 1u << 7;
    for (f = 0; f < 6; f++) ui_frame();
    for (i = 0; i < NVOICE; i++) if (trk[k].v[i].active && trk[k].v[i].gate) n = trk[k].v[i].note;
    fm1_in.notes = 0;
    for (f = 0; f < 30; f++) ui_frame();
    return n;
}
static void key_check(const char *when)
{
    uint32_t k;
    char b[160];
    for (k = 0; k < NPART; k++) {
        int a = key_note(k), c;
        printf("boot_sound: %s track %u: octave %d, TRN %d, key C4 plays note %d\n", when, k + 1, song.octave, trk[k].p[P_TRANS], a);
        apply_preset_to(&trk[k], trk[k].preset);
        c = key_note(k);
        printf("boot_sound: %s track %u: the sound loaded again, key C4 plays note %d\n", when, k + 1, c);
        snprintf(b, sizeof b, "%s: track %u, key C4 plays the same note as with the sound loaded again", when, k + 1);
        check(a == c, b);
    }
}
int main(void)
{
    uint32_t i;
    harness_init();
    memset(nor, 0xFF, sizeof nor);               /* 1. a first install: nothing in the flash */
    boot_as_main();
    compare("first power-on");
    boot_as_main();
    boot_as_main();
    key_check("first power-on");
    for (i = 0; i < 400; i++) ui_frame();         /* (an autosave) */
    persist_flush_now();
    boot_as_main();                               /* 2. an update: the flash as it was */
    compare("power-on after an update");
    boot_as_main();
    boot_as_main();
    key_check("power-on after an update");
    {   /* 3. a working project SLOOP (or Clipper) left in the flash: a four-track "FUN6", its check word right. BoopBox
         * does not read it: the power-on sounds, nothing in the pattern */
        static uint8_t q[3816];
        uint32_t h = 0x811C9DC5u, m = 0x46554E36u, n = sizeof q;
        memset(q, 0, sizeof q);
        memcpy(q, &m, 4), memcpy(q + 4, &n, 4);
        for (i = 0; i < n - 4u; i++) h = (h ^ q[i]) * 16777619u;
        memcpy(q + n - 4u, &h, 4);
        st_save(OBJ_AUTOSAVE, q, sizeof q);
        boot_as_main();
        printf("boot_sound: over SLOOP's project: track 1 %s %s, TRN %d\n", ENGINES[trk[0].eng_req]->name,
               ENGINES[trk[0].eng_req]->presets[trk[0].preset].name, trk[0].p[P_TRANS]);
        check(trk[0].eng_req == TRK_DEF[0][0] && trk[0].preset == TRK_DEF[0][1] && trk[0].p[P_TRANS] == -24,
              "over SLOOP's working project: not read, track 1 has its default sound (808 BOOM, TRN -24)");
        check(track_empty(&trk[0]), "... and an empty pattern");
        key_check("over SLOOP's working project");
    }
    printf("boot_sound: %d failed\n", fails);
    return fails != 0;
}
