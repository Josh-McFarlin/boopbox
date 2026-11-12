/* SPDX-License-Identifier: GPL-3.0-only */
/* (1.8) The browser emulator's core (firmware/host/emu.c) on the host: it powers on and draws the splash, then the
 * TRACKS screen; a key played sounds and lights; a button opens a page (the screen changes); a knob turned changes a
 * value; PLAY runs the sequencer; the MASTER knob scales the output; the autosave reaches the memory flash, and a new
 * power-on (another process, the same flash) comes back with the change. Screenshots: DIR/emu-*.ppm.
 *   cc -O1 -Ibuild/gen -Ifirmware/src tests/emu_test.c -o build/host/emu_test -lm && build/host/emu_test build/host */
#define EMU_NATIVE 1
#include "../firmware/host/emu.c"
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <sys/wait.h>

static int fails;
static const char *outdir = "build/host";
static void check(int ok, const char *what)
{
    printf("emu: %-96s %s\n", what, ok ? "ok" : "FAIL");
    fails += !ok;
}
static void ppm(const char *name)
{
    char path[512];
    FILE *f;
    uint32_t i;
    snprintf(path, sizeof path, "%s/emu-%s.ppm", outdir, name);
    if (!(f = fopen(path, "wb")))
        return;
    fprintf(f, "P6\n240 240\n255\n");
    for (i = 0; i < 240u * 240u; i++) {
        uint32_t c = swap16(emu_scr[i]);          /* (the LCD's byte order back to RGB565) */
        uint8_t px[3] = {(uint8_t)((c >> 11) << 3), (uint8_t)(((c >> 5) & 63u) << 2), (uint8_t)((c & 31u) << 3)};
        fwrite(px, 1, 3, f);
    }
    fclose(f);
}
static double run_ms(uint32_t ms)                 /* the audio for ms: its mean square */
{
    uint32_t n = ms * FS / 1000u / CTL + 1u, b, i;
    double e = 0;
    for (b = 0; b < n; b++) {
        const float *o = emu_render();
        for (i = 0; i < CTL * 2u; i++)
            e += (double)o[i] * o[i];
    }
    return e / (n * CTL * 2.0);
}
static uint32_t screen_hash(void)
{
    uint32_t h = 2166136261u, i;
    for (i = 0; i < 240u * 240u; i++)
        h = (h ^ emu_scr[i]) * 16777619u;
    return h;
}
static void tap(uint32_t b) { emu_button(b, 1); run_ms(60); emu_button(b, 0); run_ms(400); }

int main(int argc, char **argv)
{
    uint32_t h0, h1, lit = 0;
    double quiet, loud;
    if (argc > 1)
        outdir = argv[1];
    emu_init();
    emu_boot();
    run_ms(100);
    ppm("boot");
    check(emu_screen_n() > 0 && screen_hash() != 0, "powers on and draws");
    run_ms(2000);
    ppm("tracks");
    h0 = screen_hash();
    quiet = run_ms(300);
    check(quiet < 1e-8, "silent at rest");

    emu_key(7, 1, 100);                           /* C4 on the selected track */
    loud = run_ms(300);
    lit = emu_led(14u + 7u);
    emu_key(7, 0, 0);
    run_ms(1500);
    printf("emu:   a note: mean square %.6f (rest %.8f)\n", loud, quiet);
    check(loud > 1e-5, "a key played sounds");
    check(lit != 0, "... and lights its key (NOTES / the played key)");

    tap(B_ENV);
    ppm("env");
    h1 = screen_hash();
    check(h1 != h0, "a button (ENV) opens its page: the screen changes");
    {
        uint32_t a = screen_hash();
        emu_knob(EN_K1, 6);
        run_ms(300);
        ppm("env-k1");
        check(screen_hash() != a, "a knob turned changes the value shown");
    }
    tap(B_HOME);
    run_ms(500);
    {   /* the sound browser (PRESETS from HOME): SAVE breathes (4) up to full, HOME half lit (3); HOME closes it */
        uint32_t lo = 255u, hi = 0u, t, ok;
        emu_knob(EN_PRESET, 1);
        run_ms(300);
        ok = !ui.home && cur_page()->graph == GR_BROWSE && emu_led(B_SAVE) == 4u && emu_led(B_HOME) == 3u &&
             fm1_led_pwm_lvl[0] == LED_HALF;
        for (t = 0; t < LED_BREATH_MS; t += 20u) {
            run_ms(20);
            lo = fm1_led_pwm_lvl[1] < lo ? fm1_led_pwm_lvl[1] : lo;
            hi = fm1_led_pwm_lvl[1] > hi ? fm1_led_pwm_lvl[1] : hi;
        }
        ok &= lo <= LED_BREATH_LO + 2u && hi >= FM1_PWM_N - 2u;
        tap(B_HOME);
        run_ms(300);
        ok &= emu_led(B_SAVE) != 4u && emu_led(B_HOME) != 3u;
        check(ok, "the sound browser: SAVE breathes up to full, HOME half lit; gone once closed");
    }

    tap(B_PLAY);
    check(song.playing, "PLAY starts the sequencer");
    tap(B_PLAY);
    check(!song.playing, "... and stops it");
    {
        double before, after;
        emu_key(9, 1, 100);
        before = run_ms(400);
        emu_master(0);
        after = run_ms(400);
        emu_master(1023);
        emu_key(9, 0, 0);
        run_ms(1500);
        printf("emu:   a held note: %.6f; MASTER at 0: %.8f\n", before, after);
        check(before > 1e-5 && after < before / 1000.0, "the MASTER knob at 0: silent");
    }

    {   /* the autosave into the flash, then a new power-on from it */
        int16_t want = (int16_t)(trk[song.sel % NTRK].p[P_REL] == 40 ? 41 : 40);
        uint32_t sel = song.sel % NTRK, i;
        pid_t pid;
        int st = 0;
        trk[sel].p[P_REL] = want;
        for (i = 0; i < 30u && !emu_flash_dirty(); i++)
            run_ms(1000);
        check(i < 30u, "the autosave writes the memory flash (the page saves it then)");
        pid = fork();
        if (pid == 0) {                           /* a new power-on: the RAM from its start, the same flash */
            static uint8_t keep[EMU_FLASH];
            memcpy(keep, emu_fl, sizeof keep);
            memset(&trk, 0, sizeof trk);
            memset(&song, 0, sizeof song);
            emu_init();
            memcpy(emu_fl, keep, sizeof keep);
            emu_boot();
            run_ms(200);
            _exit(trk[sel].p[P_REL] == want ? 0 : 1);
        }
        waitpid(pid, &st, 0);
        check(WIFEXITED(st) && WEXITSTATUS(st) == 0, "a new power-on on the same flash: the project as it was left");
    }

    printf("emu: %s\n", fails ? "FAILED" : "all passed");
    return fails != 0;
}
