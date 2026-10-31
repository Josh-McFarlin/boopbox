/* SPDX-License-Identifier: GPL-3.0-only */
/* The full-screen visualiser (SLOOP 2.4; BoopBox: six scenes). On HOME (the TRACKS screen), HOME tapped opens it; HOME
 * again or any page closes it; SELECT steps through the styles (the name shows a second); a layer held shows its screen
 * as ever, then the visualiser comes back. The keys, PLAY and REC work as always.
 *   1 PALMS        the mix's wave, sample for sample, as the sea's front wave at sunset
 *   2 NIGHT DRIVE  a car on the road at night: the city is the spectrum, the road runs with the beat, the lights flare
 *                  on a kick; stopped, the car slows down and parks
 *   3 HORIZON      the spectrum as a neon range (caps that fall) over a grid; tiles light up on the beat in the colours
 *                  of the tracks playing
 *   4 FLYOVER      the spectrum over time as a terrain, bass in the middle, the newest in front
 *   5 DENSE CITY   the eight tracks and the master as towers of 24 floors (VU meters, peaks held); searchlights on the beat
 *   6 KEY CITY     the skyline as two octaves of keys: a note lights its tower in its track's colour; drums light the street
 * The designs: tools/vis-mockups (assets/screens/visualiser-final-six.png). It reads what the audio already leaves for
 * the UI: the scope buffers (audio.c, the mix at 22 kHz, as if MASTER were all the way up: the picture does not follow
 * the volume knob), the tracks' peaks (fx.c / drums.c, as the TRACKS meters read them), the notes that started (voice.c
 * vis_hit, vis_keys) and the transport clock. Drawn in the main loop, every other frame, in two bands of 120 rows (the
 * canvas holds 124): no cost to the audio. */
#define VIS_N 6u
#ifndef FELUCCA_VIS_STYLES
#define FELUCCA_VIS_STYLES 0x3Fu                    /* the styles built in, a bit each (bit 0: PALMS); SELECT steps over
                                                     * the others */
#endif
#define VIS_HAS(s) ((FELUCCA_VIS_STYLES >> (s)) & 1u)
static const char *const VIS_NAME[VIS_N] = {"PALMS", "NIGHT DRIVE", "HORIZON", "FLYOVER", "DENSE CITY", "KEY CITY"};
/* vis_on, vis_shown_last, vis_name_t: ui_draw.c; vis_style: panel.c (kept with the settings, taken modulo VIS_N) */
#define VIS_FFT 512u
#define VIS_FLY 16u                                 /* FLYOVER: the spectrum's last 16 rows */
#define VIS_FLY_QUIET 64                            /* FLYOVER: the mix's peak under this (of 32767): silent, it stops */
static int16_t vis_re[VIS_FFT] __attribute__((section(".pool"))), vis_im[VIS_FFT] __attribute__((section(".pool")));
#include "scratch.h"                                /* sloop-lab: this frame's scope snapshot, in the shared scratch */
#define vis_l (main_scratch.vis[0])
#define vis_r (main_scratch.vis[1])
_Static_assert(sizeof main_scratch.vis[0] == VIS_FFT * sizeof(int16_t), "the scratch holds the snapshot");
static uint8_t vis_fly[VIS_FLY][32] __attribute__((section(".pool")));
typedef struct {
    uint32_t born;                                  /* HORIZON: a tile of the dance floor, lit on a beat (vs.drv) */
    uint8_t row, trk;                               /* its row from the horizon, its track (NTRK: none, pink) */
    int8_t col;
} vis_tile_t;
static struct {
    int32_t scale, peak;                            /* the wave's auto-scale (a smoothed peak), this frame's peak */
    int16_t bar[32], cap[32], capv[32];             /* the spectrum: bars, caps and their fall speed (0..1000) */
    int16_t vu[NTRK + 1], pk[NTRK + 1], pkt[NTRK + 1];   /* DENSE CITY: the tracks and the master (NTRK), peak holds */
    int16_t tlv[NTRK], mlv;                         /* each track's level, the master's (0..1000) this frame */
    uint8_t kick, key[24], keyt[24], drum[2], drumt[2], fly0, flyh, tn;   /* a kick, KEY CITY's keys and drums, FLYOVER */
    uint32_t free_q8, last_ms, ms;                  /* beats (1/256) when stopped; the clock (ms) */
    uint32_t drv, spd, lastb;                       /* the drive: beats (1/256) that slow to a stop; its speed (256: on) */
    vis_tile_t tile[24];
} vs;
/* the spectrum's 32 bands: bins of the 512-point FFT at 22 050 Hz (43 Hz each), 40 Hz .. 10 kHz */
static const uint8_t VIS_EDGE[33] = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 21, 25, 29, 35,
                                     41, 49, 58, 69, 82, 98, 116, 138, 164, 195, 232};
#define V_CYAN RGB(40, 220, 255)
#define V_PINK RGB(230, 50, 170)
#define V_GOLD RGB(255, 220, 70)
#define V_FLOOR RGB(8, 0, 18)

UI_SMALL static int vis_shown(void) { return vis_on && !ui.home && !ui.menu && cur_page()->scope == SC_TRK; }
UI_SMALL static void vis_step(uint32_t dir)         /* vis_style on to the next style built in (dir 1 or VIS_N - 1) */
{
    uint32_t i, v = vis_style % VIS_N;
    for (i = 0; i < VIS_N; i++) {
        v = (v + dir) % VIS_N;
        if (VIS_HAS(v))
            break;
    }
    vis_style = (uint8_t)v;
}
UI_SMALL static void vis_open(void)
{
    if (!VIS_HAS(vis_style % VIS_N))
        vis_step(1);                                /* (the style kept with the settings is not built in) */
    vis_on = 1;
    vis_name_t = 30;
    ui.force = 1;
}
UI_SMALL static int32_t isin(uint32_t a) { return SINE[a & 1023u]; }          /* a: 1024 a turn; Q15 */
UI_SMALL static int32_t icos(uint32_t a) { return SINE[(a + 256u) & 1023u]; }
UI_SMALL static uint16_t mix565(uint16_t a, uint16_t b, int32_t k)              /* a -> b, k 0..256 */
{
    int32_t r = (a >> 11) + ((((b >> 11) - (a >> 11)) * k) >> 8);
    int32_t g = ((a >> 5) & 63) + (((((b >> 5) & 63) - ((a >> 5) & 63)) * k) >> 8);
    int32_t bl = (a & 31) + ((((b & 31) - (a & 31)) * k) >> 8);
    return (uint16_t)(r << 11 | g << 5 | bl);
}
UI_SMALL static uint16_t vis_mix(uint32_t a, uint32_t b, int32_t k) { return mix565((uint16_t)a, (uint16_t)b, clamp(k, 0, 256)); }
/* |x| (Q15) -> 0..1000 over 48 dB (8 log2: 6 dB a step of 8) */
UI_SMALL static int32_t vis_lvl(int32_t a)
{
    int32_t lg = 0, v;
    if (a < 0)
        a = -a;
    if (a < 16)
        return 0;
    while ((a >> lg) > 1)
        lg++;
    v = lg * 8 + (((a << 3) >> lg) & 7);           /* 120 = 0 dB */
    return clamp((v - 56) * 1000 / 64, 0, 1000);
}
UI_SMALL static uint32_t vis_rnd(uint32_t *s)                /* the same numbers every frame from the same seed */
{
    *s = *s * 1103515245u + 12345u;
    return *s >> 16;
}

/* ---- drawing helpers (canvas coordinates; cv_oy picks the band) ---- */
UI_SMALL static void vis_ellipse(int32_t cx, int32_t cy, int32_t rx, int32_t ry, uint16_t c)
{
    int32_t y;
    if (rx < 1 || ry < 1)
        return;
    for (y = -ry; y <= ry; y++) {
        int32_t w = 0;
        while (w <= rx && (w * w) * (ry * ry) + (y * y) * (rx * rx) <= (rx * rx) * (ry * ry))
            w++;
        if (w)
            cv_rect(cx - w + 1, cy + y, 2 * w - 1, 1, c);
    }
}
/* a line w px wide (the extra width across the line's main direction) */
UI_SMALL static void vis_wline(int32_t x0, int32_t y0, int32_t x1, int32_t y1, int32_t w, uint16_t c)
{
    int32_t i, v = (y1 > y0 ? y1 - y0 : y0 - y1) > (x1 > x0 ? x1 - x0 : x0 - x1);
    for (i = -w / 2; i < w - w / 2; i++)
        cv_line(x0 + (v ? i : 0), y0 + (v ? 0 : i), x1 + (v ? i : 0), y1 + (v ? 0 : i), c);
}
/* a polygon, points in 1/16 px (n <= 8), filled by scan lines (even-odd) inside the band */
UI_SMALL static void vis_poly(const int32_t *px, const int32_t *py, uint32_t n, uint16_t c)
{
    int32_t y0 = 0x7FFFFFFF, y1 = -0x7FFFFFFF, y;
    uint32_t i;
    for (i = 0; i < n; i++) {
        if (py[i] < y0) y0 = py[i];
        if (py[i] > y1) y1 = py[i];
    }
    y0 = y0 >> 4;
    y1 = (y1 + 15) >> 4;
    if (y0 < -cv_oy) y0 = -cv_oy;
    if (y1 > (int32_t)cv_h - cv_oy) y1 = (int32_t)cv_h - cv_oy;
    for (y = y0; y < y1; y++) {
        int32_t xs[8], m = 0, sy = y * 16 + 8, a, b;
        for (i = 0; i < n && m < 8; i++) {
            uint32_t j = (i + 1u) % n;
            if ((py[i] <= sy && py[j] > sy) || (py[j] <= sy && py[i] > sy))
                xs[m++] = px[i] + (sy - py[i]) * (px[j] - px[i]) / (py[j] - py[i]);
        }
        for (a = 1; a < m; a++)                     /* (a few points: insertion sort) */
            for (b = a; b > 0 && xs[b - 1] > xs[b]; b--) {
                int32_t t = xs[b]; xs[b] = xs[b - 1]; xs[b - 1] = t;
            }
        for (a = 0; a + 1 < m; a += 2)
            cv_rect((xs[a] + 8) >> 4, y, ((xs[a + 1] + 8) >> 4) - ((xs[a] + 8) >> 4), 1, c);
    }
}
/* a four-sided polygon, points in 1/16 px */
UI_SMALL static void vis_quad(int32_t x0, int32_t y0, int32_t x1, int32_t y1, int32_t x2, int32_t y2, int32_t x3, int32_t y3,
                     uint16_t c)
{
    const int32_t px[4] = {x0, x1, x2, x3}, py[4] = {y0, y1, y2, y3};
    vis_poly(px, py, 4u, c);
}
#define VQ(v) ((v) * 16)
/* the sky: rows y0..y1, colour a to b */
UI_SMALL static void vis_sky(int32_t y0, int32_t y1, uint32_t a, uint32_t b)
{
    int32_t y;
    for (y = y0; y < y1; y++)
        cv_rect(0, y, 240, 1, vis_mix(a, b, (y - y0) * 256 / (y1 - y0)));
}
UI_SMALL static void vis_stars(uint32_t n, uint32_t h, uint32_t s)
{
    while (n--) {
        uint32_t x = vis_rnd(&s) % 240u, y = vis_rnd(&s) % h, g = 120u + vis_rnd(&s) % 110u;
        cv_pset((int32_t)x, (int32_t)y, RGB(g, g, g));
    }
}
/* the sun, centre (cx, cy), radius r, above row clip: colour a at the top to b, the lower half striped */
UI_SMALL static void vis_sun(int32_t cx, int32_t cy, int32_t r, int32_t clip, uint32_t a, uint32_t b)
{
    int32_t y;
    for (y = cy - r; y < cy + r && y < clip; y++) {
        int32_t d = y - cy, q = d + r / 4, w = 0;
        if (q > 0 && q % 8 < q / 9 + 1)
            continue;                               /* the stripes, wider lower down */
        while ((w + 1) * (w + 1) <= r * r - d * d)
            w++;
        cv_rect(cx - w, y, 2 * w + 1, 1, vis_mix(a, b, (d + r) * 128 / r));
    }
}
/* the floor's rows in perspective: p 0 (the horizon hz) .. 256 (the bottom) */
UI_SMALL static int32_t vis_floor_y(int32_t hz, int32_t p) { return hz + (239 - hz) * p * p / 65536; }
/* the grid: 25 lines to the horizon (fan: their spread at the bottom), n across it, moving down with ph (0..255) */
UI_SMALL static void vis_grid(int32_t hz, uint32_t ph, int32_t n, int32_t fan, uint16_t c)
{
    int32_t k;
    for (k = -12; k <= 12; k++)
        cv_line(120 + k * 6, hz, 120 + k * fan, 239, c);
    for (k = 0; k < n; k++)
        cv_rect(0, vis_floor_y(hz, (k * 256 + (int32_t)ph) / n), 240, 1, c);
}
/* the scope snapshot from a rising zero crossing: the wave stands still */
UI_SMALL static uint32_t vis_trig(void)
{
    uint32_t i;
    for (i = 1; i + 240u < VIS_FFT; i++)
        if (vis_l[i - 1u] < 0 && vis_l[i] >= 0)
            return i;
    return 0;
}

/* ---- the frame's data ---- */
/* beats since PLAY in 1/256 (stopped: a free count at the tempo, for what moves anyway) */
UI_SMALL static uint32_t vis_beat_q8(void)
{
    if (song.playing)
        return clk_beat * 256u + clk_pos / (BEAT_U / 256u);
    return vs.free_q8;
}
UI_SMALL static void vis_fft(void)
{
    uint32_t i, j = 0, bit, len;
    for (i = 0; i < VIS_FFT; i++) {                 /* Hann window */
        int32_t w = (32768 - icos(i * 2u)) >> 1;
        vis_re[i] = (int16_t)((vis_l[i] * w) >> 15);
        vis_im[i] = 0;
    }
    for (i = 1; i < VIS_FFT; i++) {                 /* bit reversal */
        for (bit = VIS_FFT >> 1; j & bit; bit >>= 1)
            j ^= bit;
        j ^= bit;
        if (i < j) {
            int16_t t = vis_re[i]; vis_re[i] = vis_re[j]; vis_re[j] = t;
        }
    }
    for (len = 2; len <= VIS_FFT; len <<= 1) {      /* radix 2, halved each stage (no overflow) */
        uint32_t half = len >> 1, k;
        for (i = 0; i < VIS_FFT; i += len)
            for (k = 0; k < half; k++) {
                uint32_t a = i + k, b = a + half, ix = k * (1024u / len);
                int32_t wr = icos(ix), wi = -isin(ix);
                int32_t tr = (vis_re[b] * wr - vis_im[b] * wi) >> 15, ti = (vis_re[b] * wi + vis_im[b] * wr) >> 15;
                int32_t ar = vis_re[a], ai = vis_im[a];
                vis_re[b] = (int16_t)((ar - tr) >> 1);
                vis_im[b] = (int16_t)((ai - ti) >> 1);
                vis_re[a] = (int16_t)((ar + tr) >> 1);
                vis_im[a] = (int16_t)((ai + ti) >> 1);
            }
    }
}
/* the 32 bands of the last FFT, 0..1000 (60 dB under a full-scale sine) */
UI_SMALL static void vis_bands(int16_t *out)
{
    uint32_t k, i;
    for (k = 0; k < 32u; k++) {
        int32_t m = 0, lg = 0, v;
        for (i = VIS_EDGE[k]; i < VIS_EDGE[k + 1] && i < VIS_FFT / 2u; i++) {
            int32_t a = vis_re[i] < 0 ? -vis_re[i] : vis_re[i], b = vis_im[i] < 0 ? -vis_im[i] : vis_im[i];
            int32_t mag = a > b ? a + b / 2 : b + a / 2;
            if (mag > m)
                m = mag;
        }
        if (m < 2) {
            out[k] = 0;
            continue;
        }
        while ((m >> lg) > 1)
            lg++;
        v = lg * 8 + (((m << 3) >> lg) & 7);        /* a full-scale sine: ~104 */
        out[k] = (int16_t)clamp((v - 24) * 1000 / 80, 0, 1000);
    }
}
UI_SMALL static void vis_update(void)
{
    uint32_t i, w, hit, keys, now = fm1_ms, dt, dq, st = vis_style % VIS_N;
    int32_t p8[NTRK], mpk = 0;
    /* the scope: the last 512 frames (left, right) */
    w = scope_w;
    for (i = 0; i < VIS_FFT; i++) {
        vis_l[i] = scope_buf[(w + i) & (SCOPE_N - 1u)];
        vis_r[i] = scope_bufr[(w + i) & (SCOPE_N - 1u)];
        if (vis_l[i] > mpk) mpk = vis_l[i];
        if (-vis_l[i] > mpk) mpk = -vis_l[i];
    }
    /* the tracks' peaks since the last look (as the TRACKS meters take them), the notes that started, a kick */
    fm1_irq_off();
    for (i = 0; i < NTRK; i++) {
        p8[i] = trk[i].peak;
        trk[i].peak = 0;
    }
    hit = vis_hit;
    vis_hit = 0;
    keys = vis_keys;
    vis_keys = 0;
    for (i = 0; i < 24u; i++) {                     /* KEY CITY: the keys fade; a note lights its key */
        vs.key[i] = (uint8_t)(vs.key[i] > 12u ? vs.key[i] - 12u : 0u);
        if ((keys >> i) & 1u) {
            vs.key[i] = 255;
            vs.keyt[i] = vis_keyt[i];
        }
    }
    if (vis_kick_hit) {
        vis_kick_hit = 0;
        vs.kick = 255;
    }
    fm1_irq_on();
    for (i = 0; i < 2u; i++)
        vs.drum[i] = (uint8_t)(vs.drum[i] > 31u ? vs.drum[i] - 31u : 0u);
    for (i = 0; i < NTRK; i++) {                    /* each track on its own; a drum track's hit lights the street */
        vs.tlv[i] = (int16_t)(trk_level(i) && !trk[i].p[P_MUTE] ? vis_lvl(p8[i]) : 0);
        if (((hit >> i) & 1u) && is_drum(&trk[i])) {
            vs.drum[i >> 2] = 255;
            vs.drumt[i >> 2] = (uint8_t)i;
        }
    }
    vs.mlv = (int16_t)vis_lvl(mpk);
    for (i = 0; i <= NTRK; i++) {                   /* DENSE CITY: fall 3 % a frame, peaks held a second */
        int32_t v = i < NTRK ? vs.tlv[i] : vs.mlv;
        vs.vu[i] = (int16_t)(v > vs.vu[i] - 30 ? v : vs.vu[i] - 30);
        if (v >= vs.pk[i]) {
            vs.pk[i] = (int16_t)v;
            vs.pkt[i] = 0;
        } else if (++vs.pkt[i] > 30) {
            vs.pk[i] = (int16_t)(vs.pk[i] > 20 ? vs.pk[i] - 20 : 0);
        }
    }
    vs.kick = (uint8_t)(vs.kick > 20 ? vs.kick - 20 : 0);
    /* the clock; the free beat count (stopped); the drive: the beats played, then slowing to a stop */
    dt = now - vs.last_ms;
    vs.last_ms = now;
    if (dt > 200u)
        dt = 200u;
    vs.ms += dt;
    dq = dt * (uint32_t)song.g[G_BPM] * 256u / 60000u;
    vs.free_q8 += dq;
    if (song.playing) {
        vs.spd = 256u;
        vs.drv = vis_beat_q8();
    } else {
        vs.spd = vs.spd * 15u / 16u;
        vs.drv += dq * vs.spd >> 8;
    }
    if (song.playing && vs.drv >> 8 != vs.lastb) {  /* HORIZON: a beat: seven tiles, the colours of the tracks playing */
        uint32_t s = vs.drv >> 8, n = 0, on[NTRK];
        vs.lastb = s;
        for (i = 0; i < NTRK; i++)
            if (vs.tlv[i] > 300)
                on[n++] = i;
        for (i = 0; i < 7u; i++) {
            vis_tile_t *t = &vs.tile[vs.tn];
            vs.tn = (uint8_t)((vs.tn + 1u) % 24u);
            t->born = vs.drv;
            t->row = (uint8_t)(3u + vis_rnd(&s) % 5u);
            t->col = (int8_t)(vis_rnd(&s) % 12u - 6u);
            t->trk = (uint8_t)(n ? on[vis_rnd(&s) % n] : NTRK);
        }
    }
    vs.peak = mpk;
    {                                               /* the wave's scale follows the peak */
        int32_t target = mpk < 1600 ? 1600 : mpk;
        vs.scale += (target - vs.scale) / 5;
    }
    if (st - 1u < 3u) {                             /* NIGHT DRIVE, HORIZON, FLYOVER: the spectrum */
        int16_t b[32];
        vis_fft();
        vis_bands(b);
        for (i = 0; i < 32u; i++) {                 /* the bars fall fast; a cap holds, then falls faster and faster */
            int32_t bar = vs.bar[i] - vs.bar[i] * 18 / 100;
            vs.bar[i] = (int16_t)(b[i] > bar ? b[i] : bar);
            if (vs.bar[i] >= vs.cap[i]) {
                vs.cap[i] = vs.bar[i];
                vs.capv[i] = 0;
            } else {
                vs.capv[i] = (int16_t)(vs.capv[i] + 4);
                vs.cap[i] = (int16_t)(vs.cap[i] > vs.capv[i] ? vs.cap[i] - vs.capv[i] : 0);
            }
        }
        if (st == 3u && mpk >= VIS_FLY_QUIET && (vs.flyh ^= 1u) == 0u) {   /* FLYOVER: a row every other frame, the
                                                     * newest in front; silent (no note sounding), it holds still */
            vs.fly0 = (uint8_t)((vs.fly0 + VIS_FLY - 1u) % VIS_FLY);
            for (i = 0; i < 32u; i++)
                vis_fly[vs.fly0][i] = (uint8_t)(vs.bar[i] * 255 / 1000);
        }
    }
}

/* ---- the styles (each draws the whole screen; called once per band) ---- */
/* PALMS: the mix's wave is the sea's front wave at sunset; the sun's reflection shimmers with the mix */
UI_SMALL static void vis_palms(void)
{
    static const int8_t FROND[6][2] = {{-33, 0}, {-19, -8}, {0, -11}, {19, -8}, {33, 0}, {38, 10}};
    int32_t x, k, y, py = 0, i0 = (int32_t)vis_trig(), sc = vs.scale > 1600 ? vs.scale : 1600;
    vis_sky(0, 126, RGB(40, 0, 60), RGB(255, 110, 80));
    vis_sun(120, 112, 48, 126, RGB(255, 240, 140), RGB(255, 80, 90));
    vis_sky(126, 240, RGB(60, 20, 90), RGB(10, 0, 30));
    for (k = 0; k < 10; k++) {
        int32_t w = 44 - k * 16 / 5, xo = (isin(vs.ms * 3u / 2u + (uint32_t)k * 277u) * (vs.mlv * 6 / 1000)) >> 15;
        cv_rect(120 - w + xo, 129 + k * k / 2, 2 * w, 2, vis_mix(RGB(255, 220, 120), RGB(255, 80, 110), k * 26));
    }
    for (k = 0; k < 3; k++)                         /* the swells behind */
        for (x = 0; x < 240; x += 3) {
            y = 140 + k * 10 + ((isin((uint32_t)(x * 15 + k * 163) + vs.ms / 4u) * 2) >> 15);
            if (x)
                cv_line(x - 3, py, x, y, vis_mix(RGB(70, 40, 130), RGB(40, 30, 100), k * 85));
            py = y;
        }
    for (x = 0; x < 240; x++) {                     /* the front wave: the mix, sample for sample */
        y = clamp(190 - vis_l[i0 + x] * 40 / sc, 140, 236);
        cv_rect(x, y, 1, 240 - y, RGB(20, 4, 44));
        if (x) {
            for (k = 1; k < 5; k++)
                cv_line(x - 1, py + k * 8, x, y + k * 8, vis_mix(0, V_CYAN, 108 - k * 20));
            vis_wline(x - 1, py + 1, x, y + 1, 2, V_CYAN);
            cv_line(x - 1, py - 1, x, y - 1, RGB(220, 250, 255));
        }
        py = y;
    }
    for (k = 0; k < 2; k++) {                       /* two palms leaning in */
        int32_t bx = k ? 218 : 22, mx = k ? 192 : 50, tx = k ? 189 : 53, f;
        vis_wline(bx, 239, mx, 150, 6, RGB(10, 0, 15));
        vis_wline(mx, 150, tx, 46, 6, RGB(10, 0, 15));
        for (f = 0; f < 6; f++) {
            int32_t ex = tx + FROND[f][0], ey = 46 + FROND[f][1], fx = (tx + ex) / 2, fy = (46 + ey) / 2 - 8;
            vis_wline(tx, 46, fx, fy, 4, RGB(10, 0, 15));
            vis_wline(fx, fy, ex, ey, 4, RGB(10, 0, 15));
        }
    }
}
/* shapes from a table, around (ox, oy): {op << 4 | colour, then coordinates}: op 0 a rect (x, y, w, h), 1 a quad (four
 * points), 2 an ellipse (cx, cy, rx, ry); the colours from pal */
UI_SMALL static void vis_shapes(const int8_t (*p)[9], uint32_t n, int32_t ox, int32_t oy, const uint16_t *pal)
{
    for (; n--; p++) {
        const int8_t *s = *p;
        uint16_t c = pal[s[0] & 15];
        if (s[0] >> 4 == 0)
            cv_rect(ox + s[1], oy + s[2], s[3], s[4], c);
        else if (s[0] >> 4 == 2)
            vis_ellipse(ox + s[1], oy + s[2], s[3], s[4], c);
        else
            vis_quad(VQ(ox + s[1]), VQ(oy + s[2]), VQ(ox + s[3]), VQ(oy + s[4]), VQ(ox + s[5]), VQ(oy + s[6]),
                     VQ(ox + s[7]), VQ(oy + s[8]), c);
    }
}
/* NIGHT DRIVE's car from behind, at (cx, by): the body, then its lights and window, then the wing */
static const uint16_t VIS_CARPAL[11] = {RGB(6, 0, 12), RGB(10, 6, 14), RGB(46, 16, 72), RGB(28, 8, 46), V_CYAN,
                                        RGB(230, 230, 240), RGB(20, 10, 30), RGB(70, 70, 80), RGB(30, 10, 50),
                                        RGB(36, 12, 58), RGB(28, 155, 179)};
static const int8_t VIS_CAR[16][9] = {
    {0x20, 0, 0, 56, 6}, {0x01, -56, -12, 12, 12}, {0x01, 44, -12, 12, 12},                  /* shadow, tyres */
    {0x12, -50, -30, 50, -30, 48, -10, -48, -10}, {0x13, -48, -10, 48, -10, 44, -4, -44, -4},  /* body, bumper */
    {0x04, -50, -30, 101, 1}, {0x05, -12, -17, 25, 7}, {0x06, -8, -14, 17, 1},               /* rim, the plate */
    {0x27, -24, -7, 3, 2}, {0x27, 24, -7, 3, 2}, {0x18, -38, -31, 38, -31, 26, -46, -26, -46}, /* exhausts, cabin */
    {0x04, -26, -46, 53, 1}, {0x09, -54, -36, 109, 4}, {0x0A, -54, -36, 109, 1},             /* roof, the wing */
    {0x09, -37, -32, 3, 2}, {0x09, 35, -32, 3, 2}};                                          /* its posts */
/* the car; a kick flares its lights onto the road */
UI_SMALL static void vis_car(int32_t cx, int32_t by, int kick)
{
    uint16_t red = kick ? RGB(255, 50, 60) : RGB(190, 20, 40);
    int32_t i;
    for (i = 0; kick && i < 6; i++)
        cv_rect(cx - 46 - i * 4, by + 2 + i * 2, 93 + i * 8, 1, vis_mix(RGB(25, 15, 40), RGB(150, 20, 40), 154 - i * 26));
    vis_shapes(VIS_CAR, 11u, cx, by, VIS_CARPAL);
    for (i = 0; i < 10; i++) {                      /* the light bar, louvred */
        cv_rect(cx - 44 + i * 9, by - 26, 8, 7, red);
        cv_rect(cx - 44 + i * 9, by - 23, 8, 1, vis_mix(0, red, 154));
    }
    for (i = 0; kick && i < 9; i += 8)
        cv_rect(cx - 46, by - 27 + i, 93, 1, RGB(255, 120, 130));
    for (i = 0; i < 13; i++)                        /* the rear window: the sunset in it */
        cv_rect(cx - 24 - i * 6 / 7, by - 44 + i, 49 + i * 12 / 7, 1, vis_mix(RGB(255, 190, 80), RGB(200, 40, 150), i * 20));
    vis_shapes(VIS_CAR + 11, 5u, cx, by, VIS_CARPAL);
}
/* NIGHT DRIVE: the city is the spectrum (a cap light on each roof), the road runs with the beat (three lane stripes and
 * one pair of posts a beat: the car at speed); stopped, it slows and the car parks */
#define VIS_DRIVE_SPD 3u
UI_SMALL static void vis_drive(void)
{
    uint32_t ph = (vs.drv * VIS_DRIVE_SPD) & 255u, ph2 = (vs.drv * VIS_DRIVE_SPD / 2u) & 255u;
    int32_t i, j;
    vis_sky(0, 120, RGB(5, 0, 25), RGB(70, 10, 70));
    vis_stars(40u, 80u, 2u);
    vis_sun(120, 104, 40, 120, V_GOLD, RGB(255, 50, 130));
    for (i = 0; i < 30; i++) {                      /* a building a band */
        int32_t k = i * 32 / 30, h = 6 + vs.bar[k] * 62 / 1000, ch = 6 + vs.cap[k] * 62 / 1000, x = i * 8;
        uint32_t s = (uint32_t)i * 977u;
        cv_rect(x, 120 - h, 8, h, RGB(15, 5, 30));
        for (j = 0; 120 - h + 3 + j * 5 < 118; j++)
            if (vis_rnd(&s) % 5u < 2u)
                cv_pset(x + 3, 120 - h + 3 + j * 5, (i + j) & 1 ? V_CYAN : V_PINK);
        cv_rect(x + 2, 120 - ch - 2, 4, 2, RGB(255, 90, 160));
    }
    cv_rect(0, 120, 240, 120, RGB(10, 0, 20));
    vis_quad(VQ(110), VQ(120), VQ(130), VQ(120), VQ(239), VQ(239), VQ(0), VQ(239), RGB(25, 15, 40));
    vis_wline(110, 120, 0, 239, 2, V_PINK);
    vis_wline(130, 120, 239, 239, 2, V_PINK);
    for (i = -1; i < 6; i++) {                      /* the lane stripes */
        int32_t s0 = (i * 256 + (int32_t)ph) / 6, s1 = s0 + 21, y0, y1;
        if (s1 <= 0 || s0 >= 256)
            continue;
        s0 = s0 < 0 ? 0 : s0, s1 = s1 > 256 ? 256 : s1;
        y0 = vis_floor_y(120, s0), y1 = vis_floor_y(120, s1);
        vis_quad(VQ(120) - 16 - s0 / 4, VQ(y0), VQ(120) + 16 + s0 / 4, VQ(y0), VQ(120) + 16 + s1 / 4, VQ(y1),
                 VQ(120) - 16 - s1 / 4, VQ(y1), V_GOLD);
    }
    for (i = -1; i < 4; i++) {                      /* the posts along the road, at half the stripes' pace */
        int32_t s = (i * 256 + (int32_t)ph2) / 4, y, sp, h, r;
        if (s <= 0 || s >= 256)
            continue;
        y = vis_floor_y(120, s), sp = 10 + s * 130 / 256, h = 3 + s * 28 / 256, r = 1 + s * 2 / 256;
        for (j = -1; j <= 1; j += 2) {
            vis_wline(120 + j * sp, y, 120 + j * sp, y - h, 1 + s * 3 / 256, RGB(90, 40, 110));
            vis_ellipse(120 + j * sp, y - h, r, r, V_CYAN);
        }
    }
    vis_car(120, 226, vs.kick > 100);
}
/* HORIZON: the spectrum as a neon range (32 bands, caps that fall) over a grid running down a line a beat; on each beat
 * tiles light up in the colours of the tracks playing and ride the grid towards you */
UI_SMALL static void vis_horizon(void)
{
    int32_t x, k, top[32];
    uint32_t i;
    vis_sky(0, 150, RGB(6, 0, 22), RGB(70, 14, 80));
    vis_stars(60u, 110u, 10u);
    for (k = 0; k < 10; k++)                        /* the haze on the horizon */
        cv_rect(0, 150 - k, 240, 1, vis_mix(RGB(70, 14, 80), RGB(255, 70, 170), (10 - k) * 13));
    for (k = 0; k < 32; k++)
        top[k] = 147 - vs.bar[k] * 118 / 1000;
    for (x = 0; x < 240; x++) {                     /* the range: filled, with contours inside */
        int32_t u = clamp((x - 4) * 2, 0, 31 * 15), b = u / 15, y = b < 31 ? top[b] + (top[b + 1] - top[b]) * (u % 15) / 15 : top[31];
        cv_rect(x, y, 1, 150 - y, RGB(16, 4, 34));
        for (k = 1; k < 6 && y + k * 7 < 150; k++)
            cv_pset(x, y + k * 7, vis_mix(RGB(16, 4, 34), RGB(150, 40, 170), 128 - k * 20));
    }
    for (k = 0; k < 31; k++) {                      /* its edge, neon */
        int32_t x0 = 4 + k * 15 / 2, x1 = 4 + (k + 1) * 15 / 2;
        vis_wline(x0, top[k] + 1, x1, top[k + 1] + 1, 4, vis_mix(0, V_CYAN, 115));
        vis_wline(x0, top[k], x1, top[k + 1], 2, V_CYAN);
        cv_line(x0, top[k], x1, top[k + 1], RGB(210, 250, 255));
    }
    for (k = 0; k < 32; k++)
        cv_rect(2 + k * 15 / 2, 144 - vs.cap[k] * 118 / 1000, 5, 2, 0xFFFFu);
    cv_rect(0, 150, 240, 90, V_FLOOR);
    for (i = 0; i < 24u; i++) {                     /* the dance floor */
        const vis_tile_t *t = &vs.tile[i];
        int32_t age = (int32_t)(vs.drv - t->born), p0, p1, y0, y1, w0, w1;
        if (!t->born || age < 0 || age >= 640)
            continue;
        p0 = (t->row * 256 + age) / 10, p1 = p0 + 26;
        if (p0 >= 256)
            continue;
        y0 = vis_floor_y(150, p0), y1 = vis_floor_y(150, p1 > 256 ? 256 : p1);
        w0 = 6 + 34 * (y0 - 150) / 89, w1 = 6 + 34 * (y1 - 150) / 89;
        vis_quad(VQ(120 + t->col * w0), VQ(y0), VQ(120 + (t->col + 1) * w0), VQ(y0), VQ(120 + (t->col + 1) * w1), VQ(y1),
                 VQ(120 + t->col * w1), VQ(y1), vis_mix(V_FLOOR, t->trk < NTRK ? UI_COL[t->trk] : V_PINK, 256 - age * 256 / 640));
    }
    vis_grid(150, vs.drv & 255u, 10, 40, RGB(200, 40, 160));
}
/* FLYOVER: a column of the terrain, colour by height (cyan, pink, gold), dimmer further back */
UI_SMALL static uint16_t vis_fly_col(int32_t v, int32_t z)
{
    uint16_t c = v < 128 ? vis_mix(V_CYAN, V_PINK, v * 2) : vis_mix(V_PINK, V_GOLD, (v - 128) * 2);
    return vis_mix(0, c, 64 + z * 3 / 4);
}
/* FLYOVER: the spectrum over time as a terrain, mirrored (bass in the middle), flat ground out to the edges; the
 * newest row in front. Hidden lines: drawn front to back, each pixel only above what is already in front (hor) */
UI_SMALL static void vis_flyover(void)
{
    int16_t hor[240], ry[240], px[81], py[81], pv[81], qx[81], qy[81];
    int32_t a, c, x, k, z, n = 0;
    vis_sky(0, 70, RGB(0, 0, 10), RGB(30, 0, 50));
    vis_stars(70u, 64u, 21u);
    for (k = 0; k < 8; k++)
        cv_rect(0, 70 - k, 240, 1, vis_mix(RGB(30, 0, 50), RGB(60, 180, 255), (8 - k) * 11));
    cv_rect(0, 70, 240, 170, RGB(4, 0, 12));
    for (x = 0; x < 240; x++)
        hor[x] = 240;
    for (a = 0; a < 15; a++) {                      /* the rows, front (the newest) to back */
        z = 256 - (a * 256 + (vs.flyh ? 0 : 128)) / 14;
        if (z <= 10)
            break;
        for (c = 0; c < 81; c++) {
            int32_t u = (c - 40) * 256 / 24, au = u < 0 ? -u : u, v = au <= 256 ? vis_fly[(vs.fly0 + a) % VIS_FLY][au * 32 / 257] : 0;
            pv[c] = (int16_t)v;
            px[c] = (int16_t)(120 + u * (84 + z * 44 / 256) / 256);
            py[c] = (int16_t)(76 + 160 * z / 256 * z / 256 - v * (v + 256) / 512 * (6 + 64 * z / 256) / 256);
        }
        for (x = 0; x < 240; x++)
            ry[x] = 240;
        for (c = 0; c < 81; c++) {                  /* the lines to the row in front, under what hides them */
            if (n) {                                /* (only this band's rows of it; its colour once) */
                int32_t y0 = py[c], y1 = qy[c], dy = y1 - y0, y = y0 > -cv_oy ? y0 : -cv_oy;
                uint16_t lc = vis_mix(0, vis_fly_col(pv[c], z), 154);
                for (; y <= y1 && y < 120 - cv_oy; y++) {
                    x = dy ? px[c] + (qx[c] - px[c]) * (y - y0) / dy : px[c];
                    if ((uint32_t)x < 240u && y < hor[x])
                        cv_pset(x, y, lc);
                }
            }
            if (c) {                                /* the row itself */
                int32_t x0 = px[c - 1], x1 = px[c];
                uint16_t rc = vis_fly_col((pv[c - 1] + pv[c]) / 2, z);
                for (x = x0 < 0 ? 0 : x0; x <= x1 && x < 240; x++) {
                    int32_t y = x1 > x0 ? py[c - 1] + (py[c] - py[c - 1]) * (x - x0) / (x1 - x0) : py[c];
                    if (y < hor[x]) {
                        cv_pset(x, y, a ? rc : 0xFFFFu);
                        if (!a)
                            cv_pset(x, y + 1, rc);
                    }
                    if (y < ry[x])
                        ry[x] = (int16_t)y;
                }
            }
        }
        for (x = 0; x < 240; x++)
            if (ry[x] < hor[x])
                hor[x] = ry[x];
        for (c = 0; c < 81; c++)
            qx[c] = px[c], qy[c] = py[c];
        n = 1;
    }
}
/* DENSE CITY: an isometric box on the ground diamond centred (cx, cy), half-width w, h high: two faces and the roof */
UI_SMALL static void vis_box(int32_t cx, int32_t cy, int32_t w, int32_t h, uint16_t l, uint16_t r, uint16_t t, uint16_t e)
{
    int32_t i;
    if (cy + w / 2 < -cv_oy || cy - h - w / 2 >= 120 - cv_oy)
        return;                                     /* (not in this band) */
    for (i = 0; i < w; i++) {                       /* a column at a time, from the sides in: the faces, the roof */
        int32_t d = i / 2;
        cv_rect(cx - w + i, cy - h + d, 1, h + 1, l);
        cv_rect(cx + w - 1 - i, cy - h + d, 1, h + 1, r);
        cv_rect(cx - w + i, cy - h - d, 1, 2 * d + 1, t);
        cv_rect(cx + w - 1 - i, cy - h - d, 1, 2 * d + 1, t);
    }
    cv_line(cx - w, cy - h, cx, cy - w / 2 - h, e);
    cv_line(cx, cy - w / 2 - h, cx + w, cy - h, e);
    cv_line(cx + w, cy - h, cx, cy + w / 2 - h, e);
    cv_line(cx, cy + w / 2 - h, cx - w, cy - h, e);
    cv_rect(cx - w, cy - h, 1, h + 1, vis_mix(0, e, 154));
    cv_rect(cx, cy + w / 2 - h, 1, h + 1, e);
    cv_rect(cx + w, cy - h, 1, h + 1, vis_mix(0, e, 154));
}
/* DENSE CITY: track t's tower (NTRK: the master), 24 floors lit to its level, yellow then red at the top as VU METERS,
 * the peak floor white */
UI_SMALL static void vis_tower(int32_t cx, int32_t cy, uint32_t t)
{
    uint16_t c = t < NTRK ? UI_COL[t] : RGB(235, 235, 255);
    int32_t on = vs.vu[t] * 24 / 1000, pk = vs.pk[t] * 24 / 1000, f, k;
    vis_box(cx, cy, 12, 100, RGB(24, 6, 46), RGB(14, 2, 30), RGB(30, 8, 56), c);
    for (f = 0; f < 24; f++) {
        uint16_t col = f < on ? (f >= 22 ? RGB(255, 60, 50) : f >= 18 ? RGB(255, 200, 40) : c) : RGB(40, 14, 64);
        int32_t y = cy - f * 25 / 6 - 1;
        if (y + 7 < -cv_oy || y - 1 >= 120 - cv_oy)
            continue;                               /* (not in this band) */
        if (f == pk && pk >= on && pk > 0)
            col = 0xFFFFu;
        for (k = 0; k < 3; k++) {                   /* three windows on each face, two px high */
            int32_t u0 = k * 4 + 1, u1 = k * 4 + 3;
            uint16_t sh = f < on || col == 0xFFFFu ? vis_mix(0, col, 179) : col;
            cv_line(cx - 12 + u0, y + u0 / 2, cx - 12 + u1, y + u1 / 2, col);
            cv_line(cx - 12 + u0, y + u0 / 2 - 1, cx - 12 + u1, y + u1 / 2 - 1, col);
            cv_line(cx + u0, y + 6 - u0 / 2, cx + u1, y + 6 - u1 / 2, sh);
            cv_line(cx + u0, y + 5 - u0 / 2, cx + u1, y + 5 - u1 / 2, sh);
        }
    }
}
/* DENSE CITY: a line of the ground's grid, from (x0, y0) down 1 px a row and 2 across (dir -1 left, 1 right): only the
 * rows below the horizon and in this band, only on the screen */
UI_SMALL static void vis_grid_iso(int32_t x0, int32_t y0, int32_t dir, uint16_t c)
{
    int32_t y = y0 > 105 ? y0 : 105;
    if (y < -cv_oy)
        y = -cv_oy;
    for (; y < 120 - cv_oy; y++) {
        int32_t x = x0 + dir * 2 * (y - y0);
        if (x >= -1 && x < 240)
            cv_rect(x, y, 2, 1, c);
    }
}
/* DENSE CITY: a packed block at night, isometric; the eight tracks' towers and the master's in a zigzag (none hides
 * another), lit floors = the level, the peak floor white; searchlights behind sweep with the beat */
UI_SMALL static void vis_city(void)
{
    static const int8_t SPOT[9][3] = {{0, 4, 0}, {0, 3, 1}, {1, 3, 2}, {1, 2, 3}, {2, 2, NTRK}, {2, 1, 4}, {3, 1, 5},
                                      {3, 0, 6}, {4, 0, 7}};
    int32_t k, s, gx;
    vis_sky(0, 104, RGB(10, 0, 30), RGB(110, 20, 90));
    vis_stars(50u, 54u, 5u);
    for (k = 0; k < 2; k++) {                       /* the searchlights */
        int32_t bx = k ? 170 : 70;
        uint32_t a = 768u + (uint32_t)((isin(vs.drv + (uint32_t)k * 261u) * 80) >> 15);
        int32_t ex = bx + ((icos(a) * 260) >> 15), ey = 144 + ((isin(a) * 260) >> 15);
        int32_t ox = (-isin(a) * 14) >> 15, oy = (icos(a) * 14) >> 15;
        const int32_t px[3] = {VQ(bx), VQ(ex + ox), VQ(ex - ox)}, py[3] = {VQ(144), VQ(ey + oy), VQ(ey - oy)};
        vis_poly(px, py, 3u, vis_mix(RGB(110, 20, 90), 0xFFFFu, 41));
        cv_line(bx, 144, ex, ey, vis_mix(RGB(110, 20, 90), 0xFFFFu, 77));
    }
    for (k = 0; k < 4; k++)
        cv_rect(0, 104 - k * 3, 240, 1, vis_mix(RGB(110, 20, 90), RGB(255, 80, 170), 64 - k * 13));
    cv_rect(0, 104, 240, 136, V_FLOOR);
    for (k = -3; k < 9; k++) {                      /* the ground's grid, below the horizon */
        vis_grid_iso(120 + (k + 3) * 25, 124 + (k - 4) * 25 / 2, -1, RGB(90, 16, 90));
        vis_grid_iso(120 - (k + 3) * 25, 124 + (k - 4) * 25 / 2, 1, RGB(90, 16, 90));
    }
    for (s = -6; s <= 12; s++)                      /* the block, back to front */
        for (gx = -3; gx <= 6; gx++) {
            int32_t gy = s - gx, d = gx - gy, cx = 120 + d * 25, cy = 124 + s * 25 / 2, t = -1, h, f;
            uint32_t r = (uint32_t)(gx * 16 + gy + 100) * 2654435761u;
            if (gy < -3 || gy > 6 || d < -5 || d > 5)
                continue;
            for (k = 0; k < 9; k++)
                if (SPOT[k][0] == gx && SPOT[k][1] == gy)
                    t = SPOT[k][2];
            if (t >= 0) {
                vis_tower(cx, cy, (uint32_t)t);
            } else if (s >= -2 && s <= 3) {         /* the city behind, its windows lit here and there */
                h = 18 + (int32_t)(vis_rnd(&r) % 45u) + (3 - s) * 4;
                if (cx > 60 && cx < 180 && h > cy - 58)
                    h = cy - 58 > 8 ? cy - 58 : 8;
                vis_box(cx, cy, 12, h, RGB(20, 6, 40), RGB(12, 2, 26), RGB(28, 8, 50), RGB(70, 24, 100));
                for (f = 0; f < h / 7; f++)
                    for (k = 0; k < 6; k++)
                        if (vis_rnd(&r) % 100u < 18u) {
                            int32_t u = (k % 3) * 4 + 2, wx = k < 3 ? cx - 12 + u : cx + u;
                            cv_rect(wx, (k < 3 ? cy + u / 2 : cy + 6 - u / 2) - f * 7 - 5, 1, 2,
                                    k & 1 ? RGB(255, 190, 90) : (k & 2 ? RGB(120, 200, 255) : RGB(255, 110, 180)));
                        }
            } else if (s >= 5 && s <= 7) {          /* low buildings in front, some with a neon sign */
                h = 5 + (int32_t)(vis_rnd(&r) % 6u);
                vis_box(cx, cy, 12, h, RGB(26, 8, 48), RGB(16, 4, 32), RGB(36, 12, 62), RGB(80, 30, 110));
                if (vis_rnd(&r) & 1u)
                    cv_line(cx - 10, cy + 1 - h / 2, cx - 3, cy + 4 - h / 2, vis_rnd(&r) & 1u ? V_PINK : V_CYAN);
            }
        }
    for (k = 0; k < 9; k++) {                       /* the labels */
        char lab[2] = {(char)(SPOT[k][2] < NTRK ? '1' + SPOT[k][2] : 'M'), 0};
        int32_t cx = 120 + (SPOT[k][0] - SPOT[k][1]) * 25, cy = 124 + (SPOT[k][0] + SPOT[k][1]) * 25 / 2;
        cv_text(cx - 4, cy + 6, &FONT_S, lab, SPOT[k][2] < NTRK ? UI_COL[SPOT[k][2]] : 0xFFFFu);
    }
}
/* KEY CITY: key k's tower (0..23: C3..B4; a note lands on its key in these two octaves): x, width - 1, height; black? */
UI_SMALL static uint32_t vis_keygeo(uint32_t k, int32_t *x, int32_t *wd, int32_t *h)
{
    static const uint8_t WI[12] = {0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6};   /* white key, or the white one before */
    uint32_t pc = k % 12u, blk = (0x54Au >> pc) & 1u;
    int32_t i = (int32_t)(k / 12u * 7u + WI[pc]);
    if (blk) {
        *x = (i + 1) * 120 / 7 - 3, *wd = 5, *h = 60 + ((isin((uint32_t)i * 163u) * 8) >> 15);
    } else {
        *x = i * 120 / 7 + 3, *wd = 10;
        *h = 110 + ((isin((uint32_t)i * 212u) * 12) >> 15) + (WI[pc] == 0u || WI[pc] == 3u ? 30 : 0);
    }
    return blk;
}
/* KEY CITY: a tower, lit in its track's colour while its key sounds; the white keys' towers in one-point perspective
 * (the wall facing the middle and, below eye level, the roof: to (120, 96)), the black keys' flat in the gaps */
UI_SMALL static void vis_keytower(uint32_t k)
{
    int32_t x, wd, h, y, it = vs.key[k];
    uint32_t blk = vis_keygeo(k, &x, &wd, &h), lit = it > 5;
    uint16_t c = UI_COL[vs.keyt[k] % NTRK];
    int32_t x1 = x + wd, top = 200 - h;
    uint16_t fr = lit ? vis_mix(0, c, 115 + it * 115 / 255) : blk ? RGB(8, 0, 20) : RGB(22, 6, 44);
    uint16_t sd = lit ? vis_mix(0, fr, 154) : blk ? RGB(16, 4, 34) : RGB(32, 10, 58);
    uint16_t rf = lit ? vis_mix(fr, 0xFFFFu, 64) : blk ? RGB(30, 10, 54) : RGB(52, 20, 86);
    uint16_t ed = lit ? vis_mix(c, 0xFFFFu, it * 102 / 255) : blk ? RGB(50, 14, 70) : RGB(70, 24, 100);
#define VB(p, e) (VQ(p) + VQ((e) - (p)) * 51 / 256)          /* towards the vanishing point by a fifth */
    if (!blk) {
        int32_t sx = x + x1 < 240 ? x1 : x;
        vis_quad(VQ(sx), VQ(200), VQ(sx), VQ(top), VB(sx, 120), VB(top, 96), VB(sx, 120), VB(200, 96), sd);
        for (y = top + 6; y < 196; y += 7)
            cv_pset(sx + (120 - sx) * 51 / 512, y + (96 - y) * 51 / 512, lit ? vis_mix(c, 0xFFFFu, it * 77 / 255) : RGB(50, 20, 80));
        if (top > 96)
            vis_quad(VQ(x), VQ(top), VQ(x1), VQ(top), VB(x1, 120), VB(top, 96), VB(x, 120), VB(top, 96), rf);
    }
    cv_rect(x, top, wd + 1, 200 - top, fr);
    cv_rect(x, top, wd + 1, 1, blk ? rf : ed);
    cv_rect(x, top, 1, 200 - top, ed);
    cv_rect(x1, top, 1, 200 - top, blk ? sd : ed);
    if (!blk) {
        uint32_t s = k * 131u;
        for (y = top + 6; y < 196; y += 7) {
            uint32_t on = lit || vis_rnd(&s) % 10u < 7u;
            uint16_t wc = lit ? vis_mix(c, 0xFFFFu, it / 2) : RGB(70, 30, 100);
            if (on)
                cv_pset(x + 3, y, wc), cv_pset(x1 - 3, y, wc);
        }
    }
    if (it > 153)
        cv_rect(x, top - 2, wd + 1, 3, 0xFFFFu);
}
/* KEY CITY: the skyline as two octaves of keys: a note lights its tower in its track's colour, beaming into the sky and
 * shining on the wet street; a drum track's hits light the street lights */
UI_SMALL static void vis_keycity(void)
{
    static const uint8_t WPC[7] = {0, 2, 4, 5, 7, 9, 11};
    int32_t k, i, y, x, wd, h;
    vis_sky(0, 200, RGB(4, 0, 18), RGB(60, 10, 70));
    vis_stars(70u, 140u, 64u);
    cv_rect(0, 200, 240, 40, RGB(6, 0, 16));
    vis_grid(200, 0u, 4, 30, RGB(110, 20, 110));
    for (k = 0; k < 24; k++) {                      /* the beams and the reflections of the lit towers */
        int32_t it = vs.key[k], top, cx, hw;
        uint16_t c = UI_COL[vs.keyt[k] % NTRK];
        if (it <= 5)
            continue;
        vis_keygeo((uint32_t)k, &x, &wd, &h);
        top = 200 - h, cx = x + wd / 2;
        for (y = top - 2; y >= 0; y -= 2) {
            int32_t q = (top - y) * 256 / top, f = (256 - q) * (256 - q) / 256;
            hw = wd / 4 + 1 + q * 5 / 256;
            cv_rect(cx - hw, y, 2 * hw + 1, 2, vis_mix(RGB(14, 2, 32), c, it * 141 / 255 * f / 256));
            cv_rect(cx - 1, y, 3, 2, vis_mix(RGB(14, 2, 32), vis_mix(c, 0xFFFFu, 128), it * 204 / 255 * (256 - q) / 256));
        }
        for (y = 202; y < 238; y += 3)
            cv_rect(x + 2, y, wd - 3, 1, vis_mix(RGB(6, 0, 16), c, it * 102 / 255 * (40 - (y - 200)) / 40));
    }
    for (i = 0; i < 7; i++) {                       /* the white keys' towers, the outer ones first */
        vis_keytower(WPC[i]);
        vis_keytower(12u + WPC[6 - i]);
    }
    for (k = 0; k < 24; k++)
        if ((0x54Au >> (k % 12)) & 1u)
            vis_keytower((uint32_t)k);
    for (i = 0; i < 2; i++)                         /* the street lights: the drum tracks */
        for (k = 0; k < 4; k++) {
            int32_t lx = 10 + k * 60 + i * 30;
            uint16_t c = UI_COL[vs.drumt[i] % NTRK];
            if (vs.drum[i] > 128)
                vis_ellipse(lx, 219, 6, 6, vis_mix(RGB(6, 0, 16), c, 150));
            vis_ellipse(lx, 219, 3, 3, vis_mix(0, c, 77 + vs.drum[i] * 178 / 255));
        }
}

/* the visualiser, every other frame: the update, then both bands */
UI_SMALL static void vis_draw(void)
{
    uint32_t pass;
    if (!vis_shown_last || ui.force) {
        vis_shown_last = 1;
        lcd_fill(0, 0, 240, 240, C_BLACK);
    } else if (ui.frame & 1u) {
        return;
    }
    vis_update();
    for (pass = 0; pass < 2u; pass++) {
        cv_begin(240, 120, C_BLACK);
        cv_oy = -(int32_t)(pass * 120u);
        switch (vis_style % VIS_N) {
        case 0: if (VIS_HAS(0)) vis_palms(); break;
        case 1: if (VIS_HAS(1)) vis_drive(); break;
        case 2: if (VIS_HAS(2)) vis_horizon(); break;
        case 3: if (VIS_HAS(3)) vis_flyover(); break;
        case 4: if (VIS_HAS(4)) vis_city(); break;
        default: if (VIS_HAS(5)) vis_keycity(); break;
        }
        if (!pass && (vis_name_t || ui.msg_t)) {    /* the style's name a second (or a message) */
            char n[8];
            const char *s = ui.msg_t ? ui.msg : VIS_NAME[vis_style % VIS_N];
            cv_rect(0, 0, 240, 20, C_BLACK);
            cv_text(120 - text_w(&FONT_S, s) / 2, 2, &FONT_S, s, C_WHITE);
            if (!ui.msg_t) {                        /* (its place among the styles built in: 3/6) */
                uint32_t k, at = 0, nb = 0;
                for (k = 0; k < VIS_N; k++)
                    if (VIS_HAS(k)) {
                        nb++;
                        if (k <= vis_style % VIS_N)
                            at++;
                    }
                fmt_int(n, (int32_t)at);
                n[str_len(n) + 1u] = 0;
                n[str_len(n)] = '/';
                fmt_int(n + str_len(n), (int32_t)nb);
                cv_text(4, 2, &FONT_S, n, C_DIM);
            }
        }
        cv_oy = 0;
        cv_blit(0, pass * 120u);
    }
    if (vis_name_t)
        vis_name_t--;
}
/* SELECT on the visualiser: the next / previous style (round) */
UI_SMALL static void vis_select(int32_t s)
{
    vis_step(s > 0 ? 1u : VIS_N - 1u);
    vis_name_t = 30;
    ui.force = 1;
    settings_later = 1;                                 /* (kept with the settings, once stopped) */
}
