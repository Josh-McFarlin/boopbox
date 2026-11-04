/* SPDX-License-Identifier: GPL-3.0-only */
/* The TRAINER firmware's UI on the host (tests/trainer_test.c): the real DSP, sequencer and song mode (hostsim.c), the
 * real UI (ui*.c), sections and projects (project.c, no flash) and the coach (trainer.c, its lessons from
 * build/trainer-fw/gen/trainer_lessons.h), on a framebuffer with panel doubles, as tests/ui_pages_test.c runs the UI.
 * The LCD doubles keep the coach's line (lcd_clip_y) as lcd.c does. */
#define FELUCCA_ARRANGER 1
#define FELUCCA_TRAINER 1
#define FELUCCA_FLASH 0
#define FELUCCA_OTA 0
#define main hostsim_main
#include "hostsim.c"
#undef main
#include <assert.h>
static uint16_t screen[240 * 240];
static uint8_t lcd_clip_y;
static void lcd_sync(void) {}
static void lcd_blit(uint32_t x, uint32_t y, uint32_t w, uint32_t h, const uint16_t *p)
{
    uint32_t i, j;
    assert(x + w <= 240 && y + h <= 240);
    if (y < lcd_clip_y) {
        if (y + h <= lcd_clip_y)
            return;
        p += (lcd_clip_y - y) * w, h -= lcd_clip_y - y, y = lcd_clip_y;
    }
    for (j = 0; j < h; j++)
        for (i = 0; i < w; i++)
            screen[(y + j) * 240 + x + i] = p[j * w + i];
}
#include "../firmware/src/gfx.c"
static void lcd_fill(uint32_t x, uint32_t y, uint32_t w, uint32_t h, uint16_t c)
{
    uint32_t i, j;
    assert(x + w <= 240 && y + h <= 240);
    if (y < lcd_clip_y) {
        if (y + h <= lcd_clip_y)
            return;
        h -= lcd_clip_y - y, y = lcd_clip_y;
    }
    for (j = 0; j < h; j++)
        for (i = 0; i < w; i++)
            screen[(y + j) * 240 + x + i] = swap16(c);
}
static int32_t encs[7];
static uint32_t fm1_ticks(void) { return fm1_ms * 1000u * 24u; }
#define FM1_TICKS_PER_US 24u
static int32_t fm1_enc_take(uint32_t e) { int32_t s = encs[e]; encs[e] = 0; return s; }
static uint8_t fm1_led[16], fm1_led_dim[16], fm1_led_bg[16];
static volatile uint16_t fm1_led_bg_ns;
#define FM1_NCOL 16u
static const int8_t FM1_KEYMAP[5][16];
static void fm1_led_key(uint32_t id, int on) { (void)id; (void)on; }
static uint32_t edges_btn, notes_seen;
static uint32_t fm1_input_edges(int x) { uint32_t e = edges_btn; (void)x; edges_btn = 0; return e; }
static uint32_t fm1_input_note_edges(void) { uint32_t e = fm1_in.notes & ~notes_seen; notes_seen = fm1_in.notes; return e; }
static void fm1_wdt_feed(void) {}
static int32_t fm1_adc_read(int c) { (void)c; return -1; }
static struct { uint32_t magic, stage, page, home, ui_frames; } felucca_dbg;
#define FELUCCA_ICONS 1
#define SCOPE_N 512u
static int16_t scope_buf[SCOPE_N], scope_bufr[SCOPE_N];
static uint32_t scope_w;
#include "../firmware/src/panel.c"
#include "../firmware/src/ui.c"
static int up_used(uint32_t k) { (void)k; return 0; }
static int up_load(uint32_t k) { (void)k; return 0; }
static int up_load_to(track_t *t, uint32_t k) { (void)t; (void)k; return 0; }
static int up_arp_of(uint32_t k, int16_t *a) { (void)k; (void)a; return 1; }
static uint32_t up_count(void) { return 0; }
static uint32_t up_nth(uint32_t n) { return n; }
static uint32_t up_rank(uint32_t s) { return s; }
static void up_name(uint32_t k, char *b) { (void)k; str_cpy(b, "-", 2); }
static void up_slot_label(char *b, uint32_t k) { fmt_int(b, (int32_t)k + 1); }
static void up_ui(uint32_t op, uint32_t k) { (void)op; (void)k; }
static uint32_t arrangement_ready(void);
static void arrangement_apply(uint32_t s);
static uint32_t section_bars(uint32_t s);
static void arrangement_save(void);
static int song_backup(void);
static void song_restore(void);
static int section_store(uint32_t s);
static void section_load(uint32_t s);
static int project_used(uint32_t i);
static void project_save(uint32_t i);
static void project_load(uint32_t i);
static void project_erase(uint32_t i);
#include "../firmware/src/ui_song.c"
#include "../firmware/src/ui_studio.c"
#include "../firmware/src/ui_pats.c"
#include "../firmware/src/icons.c"
#include "../firmware/src/ui_draw.c"
#include "../firmware/src/ui_vis.c"
#include "../firmware/src/ui_layers.c"
#include "../firmware/src/ui_menu.c"
#include "../firmware/src/ui_input.c"
/* the flash: the trainer's progress log sector only (0xFB000, NOR: erased to 0xFF, programming clears bits), in RAM;
 * the rest fails (no projects kept, as before) */
static uint8_t flash_ok = 1, tr_flash[0x1000];
static uint32_t tr_erases, tr_progs;
#define TR_IN(off, n) ((off) >= 0xFB000u && (off) + (n) <= 0xFC000u)
static int st_read(uint32_t off, void *dst, uint32_t n)
{
    if (!TR_IN(off, n))
        return -1;
    memcpy(dst, &tr_flash[off - 0xFB000u], n);
    return 0;
}
static int st_erase(uint32_t off)
{
    if (!TR_IN(off, 0x1000u))
        return -1;
    memset(tr_flash, 0xFF, sizeof tr_flash);
    tr_erases++;
    return 0;
}
static int st_prog(uint32_t off, const void *src, uint32_t n)
{
    uint32_t i;
    if (!TR_IN(off, n))
        return -1;
    for (i = 0; i < n; i++)
        tr_flash[off - 0xFB000u + i] &= ((const uint8_t *)src)[i];
    tr_progs++;
    return 0;
}
#include "../firmware/src/storage.c"
#include "../firmware/src/project.c"
#include "../firmware/src/trainer.c"
#include "../firmware/src/splash.c"

/* ------------------------------------------------------------------ the panel, as a person uses it --- */
static void frame(void)
{
    uint32_t q;
    static int32_t o[CTL * 2];
    for (q = 0; q < 22u; q++)
        mix_block(o, CTL);
    ui_input();
    trainer_tick();
    ui_leds();
    ui_draw();
    trainer_draw();
    fm1_ms += 16;
}
static void frames(uint32_t n) { while (n--) frame(); }
static uint32_t BT(uint32_t b) { return 1u << panel.btn[b]; }
static void down(uint32_t b) { edges_btn |= BT(b); fm1_in.buttons |= BT(b); frame(); }
static void up(uint32_t b) { fm1_in.buttons &= ~BT(b); frame(); }
static void tap(uint32_t b) { down(b); up(b); }
/* a key (keys) played: a moment after what came before, as a person does (a key in the frame right after a page change is
 * not a step: the UI takes it as still held from before) */
static void key(uint32_t k) { frames(6); fm1_in.notes |= 1u << k; frame(); fm1_in.notes &= ~(1u << k); frame(); }
static void keys(uint32_t m) { frames(6); fm1_in.notes |= m; frame(); fm1_in.notes &= ~m; frame(); }
static void turn(uint32_t e, int32_t s) { encs[panel.enc[e]] = s; frame(); }
static void ppm(const char *dir, const char *name)
{
    char path[512];
    unsigned i;
    FILE *f;
    snprintf(path, sizeof path, "%s/%s.ppm", dir, name);
    f = fopen(path, "wb");
    assert(f);
    fprintf(f, "P6\n240 240\n255\n");
    for (i = 0; i < 240 * 240; i++) {
        uint16_t p = swap16(screen[i]);
        uint8_t rgb[3] = {(uint8_t)((p >> 11) * 255 / 31), (uint8_t)(((p >> 5) & 63) * 255 / 63), (uint8_t)((p & 31) * 255 / 31)};
        fwrite(rgb, 1, 3, f);
    }
    fclose(f);
}
static void host_boot(void)
{
    uint32_t i;
    memset(tr_flash, 0xFF, sizeof tr_flash);       /* (a new FM-1: the log sector erased) */
    panel = PANEL_DEFAULT;
    layers_init();
    settings.palette = PAL_SYNTH;
    palette_set(PAL_SYNTH);
    host_tracks_init();
    song.g[G_BPM] = 90;
    for (i = 0; i < NTRK; i++)
        track_power_on(i);
    for (i = 0; i < NTRK; i++)
        trk[i].engine = trk[i].eng_req;
    for (i = 0; i < 4u; i++)
        memset(&proj_slot[i], 0, sizeof proj_slot[i]);
    arr_defaults(&arrangement);
    go_home();
    ui.force = 1;
    frame();
}
