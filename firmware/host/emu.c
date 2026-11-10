/* SPDX-License-Identifier: GPL-3.0-only */
/* (1.8) The BoopBox emulator: the whole firmware's UI, sequencer and sound, as on the FM-1, compiled for the browser
 * (tools/build_emu.py: clang --target=wasm32, freestanding) and for the host (tests/emu_test.c). After JIANT FM's
 * emulator (web/emu). What is the FM-1's here is memory: the 240 x 240 screen (emu_screen, RGB565 as the LCD takes it),
 * the keys, buttons and knobs (emu_key, emu_button, emu_knob), the LEDs (emu_leds), the MASTER knob (emu_master), and
 * the 1 MiB SPI flash (emu_flash): projects, sections, settings, user presets and the FM6 bank are saved and loaded by
 * the firmware's own storage.c / project.c / upreset.c, so the page can keep the flash between visits. The audio is
 * pulled a block at a time (emu_render); the main loop's pass (emu_frame) runs between blocks, on the same thread, as
 * the FM-1's main loop runs between its audio interrupts. No USB, no MIDI, no second core, no update. */
#include <stdint.h>
#include <string.h>
#ifndef EMU_NATIVE
#define __attribute__(x)                /* (as tests/hostsim.c: the section placements mean nothing here) */
#endif
#define memset felucca_memset
#define memcpy felucca_memcpy
#define memcmp felucca_memcmp
#include "felucca_tables.h"
#include "../src/libc.c"
#undef memset
#undef memcpy
#undef memcmp
#define FELUCCA_ARRANGER 1
#define FELUCCA_FLASH 1
#define FELUCCA_OTA 0
#define FELUCCA_EDITOR 0
#define FELUCCA_CPU1 0
#define FELUCCA_USB_HOST 0
#define FELUCCA_TRAINER 0
#define FELUCCA_ICONS 1
#define FELUCCA_VIS 1

/* ---- the flash: 1 MiB of memory (the FM-1's SPI NOR), erased 0xFF */
#define EMU_FLASH (1u << 20)
static uint8_t emu_fl[EMU_FLASH];
static uint8_t emu_fl_dirty;            /* written since the page last took it (emu_flash_dirty) */
#define SMP_USER_XIP(k) (emu_fl + SMP_USER_OFF(k))
#define FM1_XIP(off) ((uintptr_t)(emu_fl + ((uint32_t)(off) & (EMU_FLASH - 1u))))   /* (hal/fm1_xip.h fm1_xip_ptr) */
#include "../hal/fm1_xip.h"

/* ---- the keys, buttons, knobs, LEDs (hal/fm1_input.h's, as memory) */
static struct { volatile uint32_t notes, buttons; } fm1_in;
static volatile uint32_t fm1_remote_btn;
static void fm1_irq_off(void) {}
static void fm1_irq_on(void) {}
static uint32_t irq_save(void) { return 0; }
static void irq_restore(uint32_t f) { (void)f; }
#include "../src/core.h"
#define TRK_DRUM 3u
#define TDRUM (&trk[TRK_DRUM])
#define NPART 3u
#include "../src/engines.c"
#include "../src/drums.c"
#include "../src/params.c"
#include "../src/voice.c"
#include "../src/slicer.c"
#include "../src/cpu1.h"                /* no second core here: every unit renders on this one */
static int cpu1_run(cpu1_job_t fn, uint32_t arg) { (void)fn; (void)arg; return 0; }
static int cpu1_wait(void) { return 0; }
static int cpu1_on(void) { return 0; }
static uint32_t cpu1_ticks(void) { return 0; }
#include "../src/fx.c"
static void fm1_delay_ms(uint32_t ms) { (void)ms; }
#include "../src/usb.c"
#include "../src/midi_uart.c"
#include "../src/arranger.c"
#include "../src/seq.c"

static uint16_t emu_scr[240u * 240u];   /* the LCD's memory, as lcd_blit sends it (RGB565, bytes swapped: gfx.c) */
static uint32_t emu_scr_n;              /* blits since the start: the page redraws when it moves */
static void lcd_sync(void) {}
static void lcd_blit(uint32_t x, uint32_t y, uint32_t w, uint32_t h, const uint16_t *p)
{
    uint32_t i, j;
    if (x + w > 240u || y + h > 240u)
        return;
    for (j = 0; j < h; j++)
        for (i = 0; i < w; i++)
            emu_scr[(y + j) * 240u + x + i] = p[j * w + i];
    emu_scr_n++;
}
#include "../src/gfx.c"
static void lcd_fill(uint32_t x, uint32_t y, uint32_t w, uint32_t h, uint16_t c)
{
    uint32_t i, j;
    if (x + w > 240u || y + h > 240u)
        return;
    for (j = 0; j < h; j++)
        for (i = 0; i < w; i++)
            emu_scr[(y + j) * 240u + x + i] = swap16(c);
    emu_scr_n++;
}
#define FM1_TICKS_PER_US 24u
static uint32_t fm1_ticks(void) { return fm1_ms * 1000u * FM1_TICKS_PER_US; }
static int32_t emu_enc[7];
static int32_t fm1_enc_take(uint32_t e) { int32_t s = emu_enc[e % 7u]; emu_enc[e % 7u] = 0; return s; }
#define FM1_NCOL 11u
static uint8_t fm1_led[FM1_NCOL], fm1_led_dim[FM1_NCOL], fm1_led_bg[FM1_NCOL];
static volatile uint16_t fm1_led_bg_ns;
/* key id at (physical column, packed row bit): hal/fm1_input.h's (the LEDs sit on the same places) */
static const int8_t FM1_KEYMAP[6][FM1_NCOL] = {
    {-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1},
    { 5, 11,  4, 10,  3,  9,  2,  8, -1, -1, -1},
    {34, 35, 36, 37, 38, 40, 39, 13,  7,  6, 12},
    {23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33},
    { 0,  1, 15, 14, 17, 16, 19, 18, 20, 21, 22},
    {-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1},
};
static void fm1_led_key(uint32_t id, int on)
{
    uint32_t p, r;
    for (p = 0; p < FM1_NCOL; p++)
        for (r = 1; r < 5u; r++)
            if (FM1_KEYMAP[r][p] == (int8_t)id) {
                if (on)
                    fm1_led[p] |= (uint8_t)(1u << r);
                else
                    fm1_led[p] &= (uint8_t)~(1u << r);
            }
}
static uint32_t emu_pressed, emu_notes_seen;
static uint32_t fm1_input_edges(uint32_t *released) { uint32_t e = emu_pressed; if (released) *released = 0; emu_pressed = 0; return e; }
static uint32_t fm1_input_note_edges(void) { uint32_t e = fm1_in.notes & ~emu_notes_seen; emu_notes_seen = fm1_in.notes; return e; }
static void fm1_wdt_feed(void) {}
static int32_t emu_pot = 1023;
static int32_t fm1_adc_read(int c) { return c == 4 ? emu_pot : -1; }
static struct { uint32_t magic, stage, page, home, ui_frames; } felucca_dbg;
#define SCOPE_N 512u
static int16_t scope_buf[SCOPE_N], scope_bufr[SCOPE_N];
static uint32_t scope_w;
#include "../src/panel.c"
#include "../src/ui.c"
#include "../src/ui_song.c"
#include "../src/ui_studio.c"
#include "../src/ui_pats.c"
#include "../src/icons.c"
#include "../src/ui_draw.c"
#include "../src/ui_vis.c"
#include "../src/ui_layers.c"
#include "../src/ui_menu.c"
#include "../src/ui_input.c"
#include "../src/splash.c"

/* ---- storage.c on the memory flash (the FM-1's fl_* driver's places and rules: fm1_flash.h) */
#include "../hal/fm1_flash_map.h"
static uint8_t flash_ok;
static int st_read(uint32_t off, void *dst, uint32_t n)
{
    if (off >= EMU_FLASH || n > EMU_FLASH - off)
        return -1;
    memcpy(dst, emu_fl + off, n);
    return 0;
}
static int st_erase(uint32_t off)
{
    if (!FL_STORE_OK(off, 0x1000u) || (off & 0xFFFu))
        return -8;
    memset(emu_fl + off, 0xFF, 0x1000u);
    emu_fl_dirty = 1;
    return 0;
}
static int st_prog(uint32_t off, const void *src, uint32_t n)
{
    uint32_t i;
    const uint8_t *s = src;
    if (!FL_STORE_OK(off, n))
        return -8;
    for (i = 0; i < n; i++)
        emu_fl[off + i] &= s[i];        /* (NOR: programming only clears bits) */
    emu_fl_dirty = 1;
    return 0;
}
#define ST_XIP_PTR(off) fm1_xip_ptr(off)
#include "../src/storage.c"
#include "../src/upreset.c"
static uint32_t fl_jedec_ram(void) { return 0x856014u; }
#define FL_FAR(f) f
static void fl_plain_window_init(void) {}
#include "../src/project.c"
#include "../src/power_on.c"

/* ---- the main loop's pass and the audio (main.c's, without the hardware) */
static int32_t emu_block[CTL * 2];
static float emu_out[CTL * 2];
static uint32_t emu_blocks;             /* audio blocks since the last pass */

void emu_master(uint32_t v);

void emu_init(void)
{
    sine_fill();                        /* (no constructors run in the wasm: what felucca_init builds at power-on) */
    font_fill();
    memset(emu_fl, 0xFF, sizeof emu_fl);
}
/* power on, the flash as it is now (the page may have put a saved one in emu_flash first) */
void emu_boot(void)
{
    persist_boot();                     /* (main.c fm1_main, without the hardware) */
    settings_init();
    panel_init();
    felucca_init();
    emu_master((uint32_t)emu_pot);
    lcd_clear();
    ui.force = 1;
}
/* the main loop's pass: every ~16 ms of audio */
void emu_frame(void)
{
    ui_input();
    ui_leds();
    ui_draw();
    if (kv_poll(is_drum(TSEL) ? 0xFFFFFu : 0u, fm1_in.notes, fm1_ms))   /* (the menu's KEYS settings; no sensing here) */
        kv_cal_dirty = 1;
    autosave_tick();                    /* the working project into flash, when quiet */
    sections_flush();                   /* live sections / the recorded song, when quiet */
}
/* one audio block: CTL stereo frames, -1..1, left right interleaved */
float *emu_render(void)
{
    uint32_t i;
    fm6_poll();
    mix_block(emu_block, CTL);
    for (i = 1; i < CTL; i += 2u) {     /* the scope, as audio.c fills it (the visualiser) */
        scope_bufr[scope_w & (SCOPE_N - 1u)] = vis_tap[2u * i + 1u];
        scope_buf[scope_w++ & (SCOPE_N - 1u)] = vis_tap[2u * i];
    }
    for (i = 0; i < CTL * 2u; i++)
        emu_out[i] = (float)clamp(emu_block[i], -32768, 32767) / 32768.0f;
    if (++emu_blocks * CTL * 1000u >= 16u * FS) {   /* (~16 ms: the main loop's pace on the FM-1) */
        emu_blocks = 0;
        fm1_ms += 16;
        emu_frame();
    }
    return emu_out;
}
uint32_t emu_frames(void) { return CTL; }
uint32_t emu_rate(void) { return FS; }
uint16_t *emu_screen(void) { return emu_scr; }
uint32_t emu_screen_n(void) { return emu_scr_n; }
uint8_t *emu_leds(void) { return fm1_led; }
uint8_t *emu_leds_dim(void) { return fm1_led_dim; }
uint8_t *emu_flash(void) { return emu_fl; }
uint32_t emu_flash_size(void) { return EMU_FLASH; }
/* 1 once after the firmware wrote the flash (the page saves it then) */
uint32_t emu_flash_dirty(void) { uint32_t d = emu_fl_dirty; emu_fl_dirty = 0; return d; }
/* note key k (0 F3 .. 26 G5) down / up, at velocity vel (1..127): played as MENU > KEYS > VELOCITY says (OFF: 100) */
void emu_key(uint32_t k, uint32_t down, uint32_t vel)
{
    if (k >= 27u)
        return;
    if (down)
        kv.velx[k] = (uint8_t)((KV_VEL_MODE() && vel ? (vel > 127u ? 127u : vel) : 100u) ^ 100u);
    if (down)
        fm1_in.notes |= 1u << k;
    else
        fm1_in.notes &= ~(1u << k);
}
/* button b (panel.c B_*: its label, wherever HARDWARE CALIBRATION put it) down / up */
void emu_button(uint32_t b, uint32_t down)
{
    uint32_t bit;
    if (b >= NB)
        return;
    bit = 1u << panel.btn[b];
    if (down) {
        if (!(fm1_in.buttons & bit))
            emu_pressed |= bit;
        fm1_in.buttons |= bit;
    } else {
        fm1_in.buttons &= ~bit;
    }
}
/* knob e (panel.c E_*: SELECT, the four, ALGORITHM, PRESETS) turned s detents (+ clockwise) */
void emu_knob(uint32_t e, int32_t s)
{
    if (e < NE)
        emu_enc[panel.enc[e] % 7u] += s;
}
/* the MASTER knob, 0..1023 (main.c: the level is its square) */
void emu_master(uint32_t v)
{
    emu_pot = (int32_t)(v > 1023u ? 1023u : v);
    song.master_q12 = ((uint32_t)emu_pot * (uint32_t)emu_pot) >> 8;
}
/* the LED of button b (panel.c B_*, its label: 0..13) / note key k (14 + k), lit (2), glowing (1) or off (0) */
uint32_t emu_led(uint32_t id)
{
    uint32_t p, r;
    if (id < NB)
        id = panel.btn[id];                 /* (the label's place on the panel: HARDWARE CALIBRATION's) */
    for (p = 0; p < FM1_NCOL; p++)
        for (r = 1; r < 5u; r++)
            if (FM1_KEYMAP[r][p] == (int8_t)id)
                return (fm1_led[p] >> r) & 1u ? 2u : ((fm1_led_dim[p] | fm1_led_bg[p]) >> r) & 1u ? 1u : 0u;
    return 0;
}
