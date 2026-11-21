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
 * canvas holds 124): no cost to the audio. Drawn anti-aliased (vg.c, after h1's gfx.c: soft edges, glows, light beams,
 * dithered gradients), the motion on springs that follow the real frame time; each band is sent to the panel only in
 * the strips of 8 rows that changed since the last frame (vis_send). */
#include "vg.c"                                     /* anti-aliased drawing (after h1's gfx.c, MIT) */
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
    uint8_t kick, key[24], keyt[24], drum[2], drumt[2], fly0, flyh, flyq, tn;   /* a kick, KEY CITY's keys and drums,
                                                     * FLYOVER (flyq: flat rows in front, VIS_FLY: the screen flat) */
    uint32_t free_q8, last_ms, ms;                  /* beats (1/256) when stopped; the clock (ms) */
    uint32_t drv, spd, lastb;                       /* the drive: beats (1/256) that slow to a stop; its speed (256: on) */
    vis_tile_t tile[24];
    f32 dt;                                         /* this frame's time (s), for the springs */
    f32 barf[32], barv[32];                         /* the spectrum on springs (0..1000) */
    f32 sway, swayv;                                /* PALMS: the palms' lean, pushed by the mix */
} vs;
static uint32_t vis_sum[30];                        /* vis_send: each strip of 8 rows as the panel shows it (0: unknown) */
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
    vs.dt = (f32)(dt ? dt : 1u) * 0.001f;
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
    vg_spring(&vs.sway, &vs.swayv, (f32)vs.mlv * 0.001f * vg_sin((f32)vs.drv * (1.0f / 512.0f)), 4.0f, vs.dt);
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
            vg_spring(&vs.barf[i], &vs.barv[i], (f32)vs.bar[i], 38.0f, vs.dt);
        }
        /* FLYOVER: a row every other frame, the newest in front. Playing, the ground always moves (silent bars: flat
         * rows); stopped, it moves on while a note sounds and until the last peak has gone off the back, then holds */
        if (st == 3u && (song.playing || mpk >= VIS_FLY_QUIET || vs.flyq < VIS_FLY) && (vs.flyh ^= 1u) == 0u) {
            uint32_t top = 0;
            vs.fly0 = (uint8_t)((vs.fly0 + VIS_FLY - 1u) % VIS_FLY);
            for (i = 0; i < 32u; i++) {             /* (under VIS_FLY_QUIET: flat ground, not the noise floor) */
                uint32_t v = mpk >= VIS_FLY_QUIET ? (uint32_t)(vs.bar[i] * 255 / 1000) : 0u;
                vis_fly[vs.fly0][i] = (uint8_t)v;
                top = v > top ? v : top;
            }
            vs.flyq = top ? 0u : (uint8_t)(vs.flyq < VIS_FLY ? vs.flyq + 1u : VIS_FLY);
        }
    }
}

/* ---- drawing helpers (screen coordinates; vg.c clips to the band) ---- */
#define VW VC(255, 255, 255)
#define VCYAN VC(40, 220, 255)
#define VPINK VC(230, 50, 170)
#define VGOLD VC(255, 220, 70)
#define VFLOOR VC(8, 0, 18)
UI_SMALL static f32 vis_t(void) { return (f32)vs.ms * 0.001f; }
UI_SMALL static uint32_t vis_tcol(uint32_t t) { return t < NTRK ? vg_565(UI_COL[t]) : VPINK; }
/* stars, twinkling; a few with a halo */
UI_SMALL static void vis_stars(uint32_t n, uint32_t h, uint32_t s)
{
    f32 t = vis_t();
    while (n--) {
        f32 x = (f32)(vis_rnd(&s) % 2400u) * 0.1f, y = (f32)(vis_rnd(&s) % (h * 10u)) * 0.1f;
        uint32_t k = vis_rnd(&s);
        f32 b = 0.35f + (f32)(k % 100u) * 0.0055f;
        f32 tw = 0.7f + 0.3f * vg_sin(t * (0.25f + (f32)(k % 7u) * 0.09f) + (f32)(k % 97u) * 0.0103f);
        vg_mode(VG_ADD);
        vg_disc(x, y, k % 9u ? 0.5f : 0.85f, VC(225, 228, 255), b * tw);
        if (!(k % 13u))
            vg_glow(x, y, 4.5f, VC(150, 160, 255), 0.3f * tw);
        vg_mode(VG_PAINT);
    }
}
/* a filled ellipse, row by row (soft at the sides) */
UI_SMALL static void vis_ellipse(f32 cx, f32 cy, f32 rx, f32 ry, uint32_t c, f32 a)
{
    int32_t y;
    if (rx < 0.5f || ry < 0.5f)
        return;
    for (y = vg_ifloor(cy - ry); y <= (int32_t)(cy + ry) + 1; y++) {
        f32 d = ((f32)y - cy) / ry, w2 = 1.0f - d * d;
        if (w2 > 0.0f) {
            f32 hw = rx * vg_sqrt(w2);
            vg_rect(cx - hw + 0.5f, (f32)y, 2.0f * hw, 1.0f, c, a * (w2 < 0.15f ? w2 / 0.15f : 1.0f));
        }
    }
}
/* the sun, centre (cx, cy), radius r, above row clip: colour a at the top to b, the lower half striped; a haze around */
UI_SMALL static void vis_sun(f32 cx, f32 cy, f32 r, int32_t clip, uint32_t a, uint32_t b, uint32_t haze)
{
    int32_t y;
    vg_mode(VG_ADD);
    vg_glow(cx, cy, r * 2.1f, haze, 0.42f);
    vg_mode(VG_PAINT);
    for (y = vg_ifloor(cy - r); y <= (int32_t)(cy + r) && y < clip; y++) {
        f32 d = (f32)y - cy, w2 = r * r - d * d, q = d + r * 0.25f, hw;
        if (w2 <= 0.0f)
            continue;
        if (q > 0.0f && q - 8.0f * (f32)vg_ifloor(q * 0.125f) < q / 9.0f + 1.0f)
            continue;                               /* the stripes, wider lower down */
        hw = vg_sqrt(w2);
        vg_rect(cx - hw + 0.5f, (f32)y, 2.0f * hw, 1.0f, vg_mix(a, b, (d + r) / (2.0f * r)), 1.0f);
    }
}
/* the floor's rows in perspective: p 0 (the horizon hz) .. 1 (the bottom) */
UI_SMALL static f32 vis_floor(f32 hz, f32 p) { return hz + (239.0f - hz) * p * p; }
/* the grid: 25 lines to the horizon (fan: their spread at the bottom), n across it moving down with ph (0..1); fainter
 * with distance, a glow on the horizon */
UI_SMALL static void vis_grid(f32 hz, f32 ph, int32_t n, f32 fan, uint32_t c, f32 a)
{
    int32_t k;
    vg_mode(VG_ADD);
    vg_beam(-20.0f, hz, 260.0f, hz, 10.0f, 10.0f, c, 0.45f * a, 0.45f * a, 1.0f);
    for (k = -12; k <= 12; k++)
        vg_beam(120.0f + (f32)k * 6.0f, hz, 120.0f + (f32)k * fan, 240.0f, 0.9f, 1.8f, c, 0.12f * a, 0.95f * a, 0.0f);
    for (k = 0; k < n; k++) {
        f32 p = ((f32)k + ph) / (f32)n, y = vis_floor(hz, p);
        vg_line(-2.0f, y, 242.0f, y, 0.5f + 1.3f * p, c, (0.15f + 0.85f * p) * a);
    }
    vg_mode(VG_PAINT);
}
/* a smooth curve through n points (Catmull-Rom, sub steps a span) into out: the points written */
UI_SMALL static int32_t vis_smooth(const f32 *xy, int32_t n, int32_t sub, f32 *out)
{
    int32_t i, j, m = 0;
    for (i = 0; i + 1 < n; i++) {
        const f32 *p0 = xy + 2 * (i ? i - 1 : i), *p1 = xy + 2 * i, *p2 = xy + 2 * (i + 1), *p3 = xy + 2 * (i + 2 < n ? i + 2 : i + 1);
        for (j = 0; j < sub; j++) {
            f32 t = (f32)j / (f32)sub, t2 = t * t, t3 = t2 * t;
            out[m * 2] = 0.5f * (2.0f * p1[0] + (p2[0] - p0[0]) * t + (2.0f * p0[0] - 5.0f * p1[0] + 4.0f * p2[0] - p3[0]) * t2 +
                                 (3.0f * p1[0] - p0[0] - 3.0f * p2[0] + p3[0]) * t3);
            out[m * 2 + 1] = 0.5f * (2.0f * p1[1] + (p2[1] - p0[1]) * t + (2.0f * p0[1] - 5.0f * p1[1] + 4.0f * p2[1] - p3[1]) * t2 +
                                     (3.0f * p1[1] - p0[1] - 3.0f * p2[1] + p3[1]) * t3);
            m++;
        }
    }
    out[m * 2] = xy[2 * (n - 1)], out[m * 2 + 1] = xy[2 * (n - 1) + 1];
    return m + 1;
}
/* a neon polyline: a halo, the tube, a white-hot core */
UI_SMALL static void vis_neon_poly(const f32 *xy, int32_t n, f32 w, uint32_t c, f32 a)
{
    vg_mode(VG_ADD);
    vg_poly(xy, n, w * 2.6f, vg_scale(c, 0.22f), a);
    vg_mode(VG_MAX);
    vg_poly(xy, n, w, c, a);
    vg_poly(xy, n, w * 0.4f, vg_mix(c, VW, 0.75f), a);
    vg_mode(VG_PAINT);
}

/* the ground under a curve (xy: n points, x rising), down to row yb: a column at a time (no seams), its top edge soft,
 * the colour from ca at the curve to cb at yb */
UI_SMALL static void vis_under(const f32 *xy, int32_t n, f32 yb, uint32_t ca, uint32_t cb)
{
    int32_t x, i = 0, y;
    for (x = vg_imax(0, (int32_t)xy[0]); x < 240 && (f32)x <= xy[2 * (n - 1)]; x++) {
        f32 yt, fr;
        while (i + 2 < n && xy[2 * (i + 1)] < (f32)x)
            i++;
        fr = xy[2 * i + 2] > xy[2 * i] ? ((f32)x - xy[2 * i]) / (xy[2 * i + 2] - xy[2 * i]) : 0.0f;
        yt = xy[2 * i + 1] + (xy[2 * i + 3] - xy[2 * i + 1]) * vg_sat(fr);
        vg_level(1.0f);
        vg_rgb(ca);
        vg_put(x, vg_ifloor(yt + 0.5f), vg_cov((f32)vg_ifloor(yt + 0.5f) + 0.5f - yt));
        for (y = vg_imax(vg_ifloor(yt + 0.5f) + 1, -vg.oy); (f32)y < yb && y < vg.h - vg.oy; y++) {
            vg_rgb(vg_mix(ca, cb, ((f32)y - yt) / (yb - yt)));
            vg_put(x, y, 256);
        }
    }
}
/* a neon line */
UI_SMALL static void vis_neon(f32 x0, f32 y0, f32 x1, f32 y1, f32 w, uint32_t c)
{
    const f32 xy[4] = {x0, y0, x1, y1};
    vis_neon_poly(xy, 2, w, c, 1.0f);
}

/* ---- the styles (each draws the whole screen; called once per band) ---- */
/* a palm: the trunk a tapered curve from (bx, 239) through (mx, 150) to its crown (tx, ty), leaning by sway; six fronds
 * that droop and swing a little more than the crown */
UI_SMALL static void vis_palm(f32 bx, f32 mx, f32 tx, f32 ty, f32 lean, f32 sway)
{
    static const int8_t FROND[6][2] = {{-36, 6}, {-22, -6}, {-2, -10}, {20, -6}, {36, 4}, {40, 16}};
    const uint32_t dark = VC(10, 0, 15);
    f32 px = bx, py = 239.0f, cx = tx + sway * 10.0f * lean, f;
    int32_t i;
    for (i = 1; i <= 10; i++) {                     /* the trunk: a quadratic, 8 px wide at the root, 4 at the crown */
        f32 t = (f32)i * 0.1f, u = 1.0f - t;
        f32 qx = u * u * bx + 2.0f * u * t * mx + t * t * cx, qy = u * u * 239.0f + 2.0f * u * t * 150.0f + t * t * ty;
        vg_beam(px, py, qx, qy, 8.0f - 4.0f * (t - 0.1f), 8.0f - 4.0f * t, dark, 1.0f, 1.0f, 0.0f);
        px = qx, py = qy;
    }
    for (i = 0; i < 6; i++) {                       /* the fronds: curves out and down, tapering to a point */
        f32 ex = cx + (f32)FROND[i][0] + sway * 14.0f * lean, ey = ty + (f32)FROND[i][1] + 6.0f;
        f32 mxf = (cx + ex) * 0.5f, myf = ty + (f32)FROND[i][1] * 0.5f - 12.0f, ox = cx, oy = ty;
        for (f = 0.125f; f <= 1.001f; f += 0.125f) {
            f32 u = 1.0f - f, qx = u * u * cx + 2.0f * u * f * mxf + f * f * ex, qy = u * u * ty + 2.0f * u * f * myf + f * f * ey;
            vg_beam(ox, oy, qx, qy, 5.0f * (1.125f - f), 5.0f * (1.0f - f) + 0.6f, dark, 1.0f, 1.0f, 0.0f);
            ox = qx, oy = qy;
        }
    }
    vg_disc(cx, ty + 1.0f, 3.5f, dark, 1.0f);
}
/* PALMS: the mix's wave is the sea's front wave at sunset; the sun's reflection shimmers with the mix; the palms sway */
UI_SMALL static void vis_palms(void)
{
    f32 xy[2 * 121], t = vis_t();
    int32_t x, k, i0 = (int32_t)vis_trig(), sc = vs.scale > 1600 ? vs.scale : 1600;
    vg_vgrad(0, 126, VC(40, 0, 60), VC(255, 110, 80));
    vis_stars(24u, 50u, 7u);
    vis_sun(120.0f, 112.0f, 48.0f, 126, VC(255, 240, 140), VC(255, 80, 90), VC(255, 120, 80));
    vg_vgrad(126, 240, VC(60, 20, 90), VC(10, 0, 30));
    vg_mode(VG_ADD);
    vg_beam(-10.0f, 126.0f, 250.0f, 126.0f, 5.0f, 5.0f, VC(255, 120, 90), 0.5f, 0.5f, 1.0f);
    for (k = 0; k < 10; k++) {                      /* the reflection: streaks that shimmer with the mix */
        f32 w = 44.0f - (f32)k * 3.2f, xo = vg_sin(t * 0.24f + (f32)k * 0.27f) * (f32)vs.mlv * 0.006f;
        f32 y = 129.0f + (f32)(k * k) * 0.5f;
        vg_beam(120.0f - w + xo, y, 120.0f + w + xo, y, 2.2f, 2.2f, vg_mix(VC(255, 220, 120), VC(255, 80, 110), (f32)k * 0.1f),
                0.75f - (f32)k * 0.05f, 0.75f - (f32)k * 0.05f, 0.4f);
    }
    vg_mode(VG_PAINT);
    for (k = 0; k < 3; k++) {                       /* the swells behind */
        for (x = 0; x <= 80; x++) {
            xy[x * 2] = (f32)(x * 3);
            xy[x * 2 + 1] = 140.0f + (f32)(k * 10) + 2.0f * vg_sin((f32)(x * 45 + k * 163) / 1024.0f + t * 0.25f);
        }
        vg_mode(VG_MAX);
        vg_poly(xy, 81, 1.2f, vg_mix(VC(90, 50, 160), VC(50, 36, 120), (f32)k * 0.33f), 1.0f);
    }
    vg_mode(VG_PAINT);
    for (x = 0; x <= 120; x++) {                    /* the front wave: the mix, sample for sample */
        f32 y = 190.0f - (f32)vis_l[i0 + x * 2] * 40.0f / (f32)sc;
        xy[x * 2] = (f32)(x * 2);
        xy[x * 2 + 1] = vg_clampf(y, 140.0f, 236.0f);
    }
    vis_under(xy, 121, 240.0f, VC(26, 8, 56), VC(10, 0, 28));                 /* the water under it */
    for (k = 4; k >= 1; k--) {                      /* the foam lines under the crest */
        f32 sh[2 * 121];
        for (x = 0; x <= 120; x++)
            sh[x * 2] = xy[x * 2], sh[x * 2 + 1] = xy[x * 2 + 1] + (f32)(k * 8);
        vg_mode(VG_MAX);
        vg_poly(sh, 121, 1.0f, VCYAN, 0.5f - (f32)k * 0.09f);
    }
    vis_neon_poly(xy, 121, 2.2f, VCYAN, 1.0f);
    vis_palm(22.0f, 50.0f, 53.0f, 46.0f, -1.0f, vs.sway);
    vis_palm(218.0f, 192.0f, 189.0f, 46.0f, 1.0f, vs.sway);
}
/* shapes from a table, around (ox, oy): {op << 4 | colour, then coordinates}: op 0 a rect (x, y, w, h), 1 a quad (four
 * points), 2 an ellipse (cx, cy, rx, ry); the colours from pal */
UI_SMALL static void vis_shapes(const int8_t (*p)[9], uint32_t n, f32 ox, f32 oy, const uint32_t *pal)
{
    for (; n--; p++) {
        const int8_t *s = *p;
        uint32_t c = pal[s[0] & 15];
        if (s[0] >> 4 == 0)
            vg_rect(ox + s[1], oy + s[2], s[3], s[4], c, 1.0f);
        else if (s[0] >> 4 == 2)
            vis_ellipse(ox + s[1], oy + s[2], s[3], s[4], c, 1.0f);
        else
            vg_quad(ox + s[1], oy + s[2], ox + s[3], oy + s[4], ox + s[5], oy + s[6], ox + s[7], oy + s[8], c, 1.0f);
    }
}
/* NIGHT DRIVE's car from behind, at (cx, by): the body, then its lights and window, then the wing */
static const uint32_t VIS_CARPAL[11] = {VC(6, 0, 12), VC(10, 6, 14), VC(46, 16, 72), VC(28, 8, 46), VC(40, 220, 255),
                                        VC(230, 230, 240), VC(20, 10, 30), VC(70, 70, 80), VC(30, 10, 50),
                                        VC(36, 12, 58), VC(28, 155, 179)};
static const int8_t VIS_CAR[16][9] = {
    {0x20, 0, 0, 56, 6}, {0x01, -56, -12, 12, 12}, {0x01, 44, -12, 12, 12},                  /* shadow, tyres */
    {0x12, -50, -30, 50, -30, 48, -10, -48, -10}, {0x13, -48, -10, 48, -10, 44, -4, -44, -4},  /* body, bumper */
    {0x04, -50, -30, 101, 1}, {0x05, -12, -17, 25, 7}, {0x06, -8, -14, 17, 1},               /* rim, the plate */
    {0x27, -24, -7, 3, 2}, {0x27, 24, -7, 3, 2}, {0x18, -38, -31, 38, -31, 26, -46, -26, -46}, /* exhausts, cabin */
    {0x04, -26, -46, 53, 1}, {0x09, -54, -36, 109, 4}, {0x0A, -54, -36, 109, 1},             /* roof, the wing */
    {0x09, -37, -32, 3, 2}, {0x09, 35, -32, 3, 2}};                                          /* its posts */
/* the car; the kick (0..1) flares its lights onto the road */
UI_SMALL static void vis_car(f32 cx, f32 by, f32 kick)
{
    uint32_t red = vg_mix(VC(190, 20, 40), VC(255, 60, 70), kick);
    int32_t i;
    vg_mode(VG_ADD);                                /* the lights on the road */
    vg_beam(cx, by + 2.0f, cx, by + 14.0f, 96.0f, 130.0f, VC(160, 20, 50), 0.25f + 0.5f * kick, 0.0f, 1.0f);
    vg_mode(VG_PAINT);
    vis_shapes(VIS_CAR, 11u, cx, by, VIS_CARPAL);
    for (i = 0; i < 10; i++) {                      /* the light bar, louvred */
        vg_rect(cx - 44.0f + (f32)(i * 9), by - 26.0f, 8.0f, 7.0f, red, 1.0f);
        vg_rect(cx - 44.0f + (f32)(i * 9), by - 23.0f, 8.0f, 1.0f, vg_scale(red, 0.6f), 1.0f);
    }
    vg_mode(VG_ADD);
    vg_beam(cx - 46.0f, by - 23.0f, cx + 46.0f, by - 23.0f, 12.0f + 10.0f * kick, 12.0f + 10.0f * kick, VC(255, 40, 60),
            0.35f + 0.5f * kick, 0.35f + 0.5f * kick, 1.0f);
    vg_mode(VG_PAINT);
    {                                               /* the rear window: the sunset in it */
        const f32 q[8] = {cx - 24.0f, by - 44.5f, cx + 25.0f, by - 44.5f, cx + 36.0f, by - 31.5f, cx - 35.0f, by - 31.5f};
        vg_fillg(q, 4, VC(255, 190, 80), by - 44.0f, VC(200, 40, 150), by - 32.0f, 1.0f);
    }
    vis_shapes(VIS_CAR + 11, 5u, cx, by, VIS_CARPAL);
}
/* NIGHT DRIVE: the city is the spectrum (a cap light on each roof), the road runs with the beat (three lane stripes and
 * one pair of posts a beat: the car at speed); stopped, it slows and the car parks */
#define VIS_DRIVE_SPD 3u
UI_SMALL static void vis_drive(void)
{
    f32 ph = (f32)((vs.drv * VIS_DRIVE_SPD) & 255u) / 256.0f, ph2 = (f32)((vs.drv * VIS_DRIVE_SPD / 2u) & 255u) / 256.0f;
    int32_t i, j;
    vg_vgrad(0, 121, VC(5, 0, 25), VC(70, 10, 70));
    vis_stars(40u, 80u, 2u);
    vis_sun(120.0f, 104.0f, 40.0f, 120, VGOLD, VC(255, 50, 130), VC(255, 70, 140));
    for (i = 0; i < 30; i++) {                      /* a building a band */
        int32_t k = i * 32 / 30;
        f32 h = 6.0f + vs.barf[k] * 0.062f, ch = 6.0f + (f32)vs.cap[k] * 0.062f, x = (f32)(i * 8);
        uint32_t s = (uint32_t)i * 977u;
        vg_rect(x, 120.0f - h, 8.0f, h, VC(15, 5, 30), 1.0f);
        vg_mode(VG_ADD);
        for (j = 0; 120.0f - h + 3.0f + (f32)(j * 5) < 118.0f; j++)
            if (vis_rnd(&s) % 5u < 2u)
                vg_rect(x + 3.0f, 120.0f - h + 3.0f + (f32)(j * 5), 1.0f, 1.0f, (i + j) & 1 ? VCYAN : VPINK, 0.9f);
        vg_rect(x + 2.0f, 120.0f - ch - 2.0f, 4.0f, 2.0f, VC(255, 90, 160), 1.0f);
        vg_glow(x + 4.0f, 120.0f - ch - 1.0f, 5.0f, VC(255, 60, 150), 0.35f);
        vg_mode(VG_PAINT);
    }
    vg_vgrad(120, 240, VC(10, 0, 20), VC(16, 2, 30));
    {
        const f32 road[8] = {110.0f, 120.0f, 130.0f, 120.0f, 240.0f, 240.0f, 0.0f, 240.0f};
        vg_fillg(road, 4, VC(20, 12, 34), 120.0f, VC(34, 20, 52), 240.0f, 1.0f);
    }
    vis_neon(110.0f, 120.0f, 0.0f, 240.0f, 1.8f, VPINK);
    vis_neon(130.0f, 120.0f, 240.0f, 240.0f, 1.8f, VPINK);
    for (i = -1; i < 6; i++) {                      /* the lane stripes */
        f32 s0 = ((f32)i + ph) / 6.0f, s1 = s0 + 0.082f, y0, y1;
        if (s1 <= 0.0f || s0 >= 1.0f)
            continue;
        s0 = vg_maxf(s0, 0.0f), s1 = vg_minf(s1, 1.0f);
        y0 = vis_floor(120.0f, s0), y1 = vis_floor(120.0f, s1);
        vg_quad(119.0f - s0 * 4.0f, y0, 121.0f + s0 * 4.0f, y0, 121.0f + s1 * 4.0f, y1, 119.0f - s1 * 4.0f, y1, VGOLD, 1.0f);
    }
    for (i = -1; i < 4; i++) {                      /* the posts along the road, at half the stripes' pace */
        f32 s = ((f32)i + ph2) / 4.0f, y, sp, h, r;
        if (s <= 0.0f || s >= 1.0f)
            continue;
        y = vis_floor(120.0f, s), sp = 10.0f + s * 130.0f, h = 3.0f + s * 28.0f, r = 0.8f + s * 2.2f;
        for (j = -1; j <= 1; j += 2) {
            f32 px = 120.0f + (f32)j * sp;
            vg_line(px, y, px, y - h, 0.8f + s * 2.5f, VC(90, 40, 110), 1.0f);
            vg_mode(VG_ADD);
            vg_glow(px, y - h, r * 5.0f, VCYAN, 0.5f);
            vg_disc(px, y - h, r, VC(190, 250, 255), 1.0f);
            vg_mode(VG_PAINT);
        }
    }
    vis_car(120.0f, 226.0f, (f32)vs.kick / 255.0f);
}
/* HORIZON: the spectrum as a neon range (32 bands, caps that fall) over a grid running down a line a beat; on each beat
 * tiles light up in the colours of the tracks playing and ride the grid towards you */
UI_SMALL static void vis_horizon(void)
{
    f32 pt[2 * 32], ridge[2 * 94], sh[2 * 94];
    int32_t x, k, n;
    uint32_t i;
    vg_vgrad(0, 151, VC(6, 0, 22), VC(70, 14, 80));
    vis_stars(60u, 110u, 10u);
    vg_mode(VG_ADD);
    vg_glow(120.0f, 158.0f, 120.0f, VC(140, 20, 110), 0.5f);
    vg_mode(VG_PAINT);
    for (k = 0; k < 32; k++)
        pt[k * 2] = 4.0f + (f32)k * 7.5f, pt[k * 2 + 1] = 147.0f - vg_clampf(vs.barf[k], 0.0f, 1000.0f) * 0.118f;
    pt[0] = -6.0f, pt[62] = 246.0f;                 /* (out to the edges) */
    n = vis_smooth(pt, 32, 3, ridge);
    vis_under(ridge, n, 151.0f, VC(34, 10, 64), VC(14, 2, 30));                /* the range */
    for (k = 1; k < 6; k++) {                       /* contours inside */
        for (x = 0; x < n; x++)
            sh[x * 2] = ridge[x * 2], sh[x * 2 + 1] = vg_minf(ridge[x * 2 + 1] + (f32)(k * 7), 152.0f);
        vg_mode(VG_MAX);
        vg_poly(sh, n, 0.9f, VC(150, 40, 170), 0.55f - (f32)k * 0.09f);
    }
    vg_mode(VG_PAINT);
    vis_neon_poly(ridge, n, 2.4f, VCYAN, 1.0f);
    vg_mode(VG_ADD);
    for (k = 0; k < 32; k++) {                      /* the caps */
        f32 cx = 4.0f + (f32)k * 7.5f, cy = 144.5f - (f32)vs.cap[k] * 0.118f;
        vg_glow(cx, cy, 6.0f, VCYAN, 0.35f);
        vg_rect(cx - 2.0f, cy - 0.5f, 5.0f, 2.0f, VW, 1.0f);
    }
    vg_mode(VG_PAINT);
    vg_vgrad(151, 240, VC(10, 0, 22), VFLOOR);
    for (i = 0; i < 24u; i++) {                     /* the dance floor */
        const vis_tile_t *t = &vs.tile[i];
        int32_t age = (int32_t)(vs.drv - t->born);
        f32 p0, p1, y0, y1, w0, w1, fade;
        uint32_t c;
        if (!t->born || age < 0 || age >= 640)
            continue;
        p0 = ((f32)(t->row * 256 + age) / 10.0f) / 256.0f, p1 = vg_minf(p0 + 0.1f, 1.0f);
        if (p0 >= 1.0f)
            continue;
        y0 = vis_floor(151.0f, p0), y1 = vis_floor(151.0f, p1);
        w0 = 6.0f + 34.0f * (y0 - 151.0f) / 89.0f, w1 = 6.0f + 34.0f * (y1 - 151.0f) / 89.0f;
        fade = 1.0f - (f32)age / 640.0f;
        c = vis_tcol(t->trk);
        vg_quad(120.0f + (f32)t->col * w0, y0, 120.0f + (f32)(t->col + 1) * w0, y0, 120.0f + (f32)(t->col + 1) * w1, y1,
                120.0f + (f32)t->col * w1, y1, c, fade * 0.85f);
        vg_mode(VG_ADD);
        vg_glow(120.0f + ((f32)t->col + 0.5f) * (w0 + w1) * 0.5f, (y0 + y1) * 0.5f, (w0 + w1) * 0.7f, c, fade * 0.35f);
        vg_mode(VG_PAINT);
    }
    vis_grid(151.0f, (f32)(vs.drv & 255u) / 256.0f, 10, 40.0f, VC(200, 40, 160), 1.0f);
}
/* FLYOVER: a column of the terrain, colour by height (cyan, pink, gold) */
UI_SMALL static uint32_t vis_fly_col(int32_t v)
{
    return v < 128 ? vg_mix(VCYAN, VPINK, (f32)v / 128.0f) : vg_mix(VPINK, VGOLD, (f32)(v - 128) / 128.0f);
}
/* FLYOVER: the spectrum over time as a terrain, mirrored (bass in the middle), flat ground out to the edges; the
 * newest row in front. Hidden lines: drawn front to back, each pixel only above what is already in front (hor);
 * fainter with distance */
UI_SMALL static void vis_flyover(void)
{
    int16_t hor[240], ry[240], px[81], py[81], pv[81], qx[81], qy[81];
    int32_t a, c, x, z, n = 0;
    vg_vgrad(0, 71, VC(0, 0, 10), VC(30, 0, 50));
    vis_stars(70u, 64u, 21u);
    vg_mode(VG_ADD);
    vg_beam(-20.0f, 70.0f, 260.0f, 70.0f, 16.0f, 16.0f, VC(60, 180, 255), 0.55f, 0.55f, 1.0f);
    vg_mode(VG_PAINT);
    vg_vgrad(71, 240, VC(4, 0, 14), VC(2, 0, 8));
    vg_level(1.0f);
    for (x = 0; x < 240; x++)
        hor[x] = 240;
    for (a = 0; a < 15; a++) {                      /* the rows, front (the newest) to back */
        f32 fog;
        z = 256 - (a * 256 + (vs.flyh ? 0 : 128)) / 14;
        if (z <= 10)
            break;
        fog = 0.3f + 0.7f * (f32)z / 256.0f;
        for (c = 0; c < 81; c++) {
            int32_t u = (c - 40) * 256 / 24, au = u < 0 ? -u : u, v = au <= 256 ? vis_fly[(vs.fly0 + a) % VIS_FLY][au * 32 / 257] : 0;
            pv[c] = (int16_t)v;
            px[c] = (int16_t)(120 + u * (84 + z * 44 / 256) / 256);
            py[c] = (int16_t)(76 + 160 * z / 256 * z / 256 - v * (v + 256) / 512 * (6 + 64 * z / 256) / 256);
        }
        for (x = 0; x < 240; x++)
            ry[x] = 240;
        for (c = 0; c < 81; c++) {
            if (n) {                                /* the line to the row in front, under what hides it */
                int32_t y, y0 = py[c], y1 = qy[c], dy = y1 - y0;
                vg_rgb(vg_scale(vis_fly_col(pv[c]), 0.6f * fog));
                for (y = y0; y <= y1; y++) {
                    x = dy ? px[c] + (qx[c] - px[c]) * (y - y0) / dy : px[c];
                    if ((uint32_t)x < 240u && y < hor[x])
                        vg_put(x, y, 256);
                }
            }
            if (c) {                                /* the row itself (the front one white, on its colour) */
                int32_t x0 = px[c - 1], x1 = px[c];
                uint32_t rc = vg_scale(vis_fly_col((pv[c - 1] + pv[c]) / 2), a ? fog : 1.0f);
                for (x = x0 < 0 ? 0 : x0; x <= x1 && x < 240; x++) {
                    int32_t y = x1 > x0 ? py[c - 1] + (py[c] - py[c - 1]) * (x - x0) / (x1 - x0) : py[c];
                    if (y < hor[x]) {
                        vg_rgb(a ? rc : VW);
                        vg_put(x, y, 256);
                        if (!a) {
                            vg_rgb(rc);
                            vg_put(x, y + 1, 256);
                        }
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
/* DENSE CITY: an isometric box on the ground diamond centred (cx, cy), half-width w, h high: two faces, the roof, its
 * edges lit in e */
UI_SMALL static void vis_box(f32 cx, f32 cy, f32 w, f32 h, uint32_t l, uint32_t r, uint32_t t, uint32_t e)
{
    if (cy + w * 0.5f < (f32)(-vg.oy) - 2.0f || cy - h - w * 0.5f >= (f32)(vg.h - vg.oy) + 2.0f)
        return;                                     /* (not in this band) */
    vg_quad(cx - w, cy - h, cx, cy + w * 0.5f - h, cx, cy + w * 0.5f, cx - w, cy, l, 1.0f);
    vg_quad(cx, cy + w * 0.5f - h, cx + w, cy - h, cx + w, cy, cx, cy + w * 0.5f, r, 1.0f);
    vg_quad(cx - w, cy - h, cx, cy - w * 0.5f - h, cx + w, cy - h, cx, cy + w * 0.5f - h, t, 1.0f);
    vg_mode(VG_MAX);
    vg_line(cx - w, cy - h, cx, cy - w * 0.5f - h, 1.0f, e, 1.0f);
    vg_line(cx, cy - w * 0.5f - h, cx + w, cy - h, 1.0f, e, 1.0f);
    vg_line(cx + w, cy - h, cx, cy + w * 0.5f - h, 1.0f, e, 1.0f);
    vg_line(cx, cy + w * 0.5f - h, cx - w, cy - h, 1.0f, e, 1.0f);
    vg_line(cx - w, cy - h, cx - w, cy, 1.0f, e, 0.6f);
    vg_line(cx, cy + w * 0.5f - h, cx, cy + w * 0.5f, 1.0f, e, 1.0f);
    vg_line(cx + w, cy - h, cx + w, cy, 1.0f, e, 0.6f);
    vg_mode(VG_PAINT);
}
/* DENSE CITY: track t's tower (NTRK: the master), 24 floors lit to its level, yellow then red at the top as VU METERS,
 * the peak floor white, a glow on its roof as loud as it is */
UI_SMALL static void vis_tower(f32 cx, f32 cy, uint32_t t)
{
    uint32_t c = t < NTRK ? vg_565(UI_COL[t]) : VC(235, 235, 255);
    int32_t on = vs.vu[t] * 24 / 1000, pk = vs.pk[t] * 24 / 1000, f, k;
    vis_box(cx, cy, 12.0f, 100.0f, VC(24, 6, 46), VC(14, 2, 30), VC(30, 8, 56), c);
    for (f = 0; f < 24; f++) {
        uint32_t col = f < on ? (f >= 22 ? VC(255, 60, 50) : f >= 18 ? VC(255, 200, 40) : c) : VC(40, 14, 64);
        f32 y = cy - (f32)(f * 25) / 6.0f - 1.0f;
        if (y + 7.0f < (f32)(-vg.oy) || y - 1.0f >= (f32)(vg.h - vg.oy))
            continue;                               /* (not in this band) */
        if (f == pk && pk >= on && pk > 0)
            col = VW;
        vg_mode(VG_MAX);
        for (k = 0; k < 3; k++) {                   /* three windows on each face */
            f32 u0 = (f32)(k * 4 + 1), u1 = (f32)(k * 4 + 3);
            uint32_t sh = f < on || col == VW ? vg_scale(col, 0.7f) : col;
            vg_line(cx - 12.0f + u0, y + u0 * 0.5f - 0.5f, cx - 12.0f + u1, y + u1 * 0.5f - 0.5f, 1.6f, col, 1.0f);
            vg_line(cx + u0, y + 5.5f - u0 * 0.5f, cx + u1, y + 5.5f - u1 * 0.5f, 1.6f, sh, 1.0f);
        }
        vg_mode(VG_PAINT);
    }
    vg_mode(VG_ADD);
    vg_glow(cx, cy - 100.0f, 10.0f + (f32)vs.vu[t] * 0.02f, c, 0.15f + (f32)vs.vu[t] * 0.0005f);
    vg_mode(VG_PAINT);
}
/* DENSE CITY: a line of the ground's grid, from (x0, y0) down 1 px a row and 2 across (dir -1 left, 1 right), below the
 * horizon */
UI_SMALL static void vis_grid_iso(f32 x0, f32 y0, f32 dir, uint32_t c)
{
    f32 ya = vg_maxf(y0, 105.0f);
    vg_line(x0 + dir * 2.0f * (ya - y0), ya, x0 + dir * 2.0f * (241.0f - y0), 241.0f, 1.0f, c, 0.8f);
}
/* DENSE CITY: a packed block at night, isometric; the eight tracks' towers and the master's in a zigzag (none hides
 * another), lit floors = the level, the peak floor white; searchlights behind sweep with the beat */
UI_SMALL static void vis_city(void)
{
    static const int8_t SPOT[9][3] = {{0, 4, 0}, {0, 3, 1}, {1, 3, 2}, {1, 2, 3}, {2, 2, NTRK}, {2, 1, 4}, {3, 1, 5},
                                      {3, 0, 6}, {4, 0, 7}};
    int32_t k, s, gx;
    vg_vgrad(0, 105, VC(10, 0, 30), VC(110, 20, 90));
    vis_stars(50u, 54u, 5u);
    vg_mode(VG_ADD);
    for (k = 0; k < 2; k++) {                       /* the searchlights */
        f32 bx = k ? 170.0f : 70.0f, an = 0.75f + 0.078f * vg_sin((f32)vs.drv / 1024.0f + (f32)k * 0.255f);
        f32 ex = bx + 260.0f * vg_cos(an), ey = 144.0f + 260.0f * vg_sin(an);
        vg_beam(bx, 144.0f, ex, ey, 4.0f, 34.0f, VC(255, 220, 255), 0.4f, 0.0f, 1.0f);
        vg_beam(bx, 144.0f, ex, ey, 1.5f, 6.0f, VW, 0.35f, 0.0f, 1.0f);
    }
    vg_beam(-20.0f, 104.0f, 260.0f, 104.0f, 14.0f, 14.0f, VC(255, 80, 170), 0.45f, 0.45f, 1.0f);
    vg_mode(VG_PAINT);
    vg_vgrad(105, 240, VFLOOR, VC(4, 0, 10));
    vg_mode(VG_ADD);
    for (k = -3; k < 9; k++) {                      /* the ground's grid, below the horizon */
        vis_grid_iso(120.0f + (f32)((k + 3) * 25), 124.0f + (f32)((k - 4) * 25) * 0.5f, -1.0f, VC(90, 16, 90));
        vis_grid_iso(120.0f - (f32)((k + 3) * 25), 124.0f + (f32)((k - 4) * 25) * 0.5f, 1.0f, VC(90, 16, 90));
    }
    vg_mode(VG_PAINT);
    for (s = -6; s <= 12; s++)                      /* the block, back to front */
        for (gx = -3; gx <= 6; gx++) {
            int32_t gy = s - gx, d = gx - gy, t = -1, h, f;
            f32 cx = 120.0f + (f32)(d * 25), cy = 124.0f + (f32)(s * 25) * 0.5f;
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
                if (cx > 60.0f && cx < 180.0f && (f32)h > cy - 58.0f)
                    h = cy - 58.0f > 8.0f ? (int32_t)(cy - 58.0f) : 8;
                vis_box(cx, cy, 12.0f, (f32)h, VC(20, 6, 40), VC(12, 2, 26), VC(28, 8, 50), VC(70, 24, 100));
                vg_mode(VG_ADD);
                for (f = 0; f < h / 7; f++)
                    for (k = 0; k < 6; k++)
                        if (vis_rnd(&r) % 100u < 18u) {
                            f32 u = (f32)((k % 3) * 4 + 2), wx = k < 3 ? cx - 12.0f + u : cx + u;
                            vg_rect(wx, (k < 3 ? cy + u * 0.5f : cy + 6.0f - u * 0.5f) - (f32)(f * 7) - 5.0f, 1.0f, 2.0f,
                                    k & 1 ? VC(255, 190, 90) : (k & 2 ? VC(120, 200, 255) : VC(255, 110, 180)), 0.9f);
                        }
                vg_mode(VG_PAINT);
            } else if (s >= 5 && s <= 7) {          /* low buildings in front, some with a neon sign */
                h = 5 + (int32_t)(vis_rnd(&r) % 6u);
                vis_box(cx, cy, 12.0f, (f32)h, VC(26, 8, 48), VC(16, 4, 32), VC(36, 12, 62), VC(80, 30, 110));
                if (vis_rnd(&r) & 1u)
                    vis_neon(cx - 10.0f, cy + 1.0f - (f32)h * 0.5f, cx - 3.0f, cy + 4.5f - (f32)h * 0.5f, 1.0f,
                             vis_rnd(&r) & 1u ? VPINK : VCYAN);
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
    int32_t xi, wdi, hi;
    uint32_t blk = vis_keygeo(k, &xi, &wdi, &hi), lit = vs.key[k] > 5;
    f32 it = (f32)vs.key[k] / 255.0f, x = (f32)xi, wd = (f32)wdi, x1 = x + wd, top = 200.0f - (f32)hi, y;
    uint32_t c = vg_565(UI_COL[vs.keyt[k] % NTRK]);
    uint32_t fr = lit ? vg_scale(c, 0.45f + it * 0.45f) : blk ? VC(8, 0, 20) : VC(22, 6, 44);
    uint32_t sd = lit ? vg_scale(fr, 0.6f) : blk ? VC(16, 4, 34) : VC(32, 10, 58);
    uint32_t rf = lit ? vg_mix(fr, VW, 0.25f) : blk ? VC(30, 10, 54) : VC(52, 20, 86);
    uint32_t ed = lit ? vg_mix(c, VW, it * 0.4f) : blk ? VC(50, 14, 70) : VC(70, 24, 100);
#define VB(p, e) ((p) + ((e) - (p)) * 0.2f)        /* towards the vanishing point by a fifth */
    if (!blk) {
        f32 sx = x + x1 < 240.0f ? x1 + 0.5f : x - 0.5f;
        vg_quad(sx, 200.0f, sx, top - 0.5f, VB(sx, 120.0f), VB(top - 0.5f, 96.0f), VB(sx, 120.0f), VB(200.0f, 96.0f), sd, 1.0f);
        vg_mode(VG_ADD);
        for (y = top + 6.0f; y < 196.0f; y += 7.0f)
            vg_disc(sx + (120.0f - sx) * 0.1f, y + (96.0f - y) * 0.1f, 0.6f, lit ? vg_mix(c, VW, it * 0.3f) : VC(50, 20, 80), 0.8f);
        vg_mode(VG_PAINT);
        if (top > 96.0f)
            vg_quad(x - 0.5f, top - 0.5f, x1 + 0.5f, top - 0.5f, VB(x1 + 0.5f, 120.0f), VB(top - 0.5f, 96.0f), VB(x - 0.5f, 120.0f),
                    VB(top - 0.5f, 96.0f), rf, 1.0f);
    }
    vg_rect(x, top, wd + 1.0f, 200.0f - top, fr, 1.0f);
    vg_mode(VG_MAX);
    vg_line(x, top, x1, top, 1.0f, blk ? rf : ed, 1.0f);
    vg_line(x, top, x, 200.0f, 1.0f, ed, 1.0f);
    vg_line(x1, top, x1, 200.0f, 1.0f, blk ? sd : ed, 1.0f);
    vg_mode(VG_PAINT);
    if (!blk) {
        uint32_t s = k * 131u;
        vg_mode(VG_ADD);
        for (y = top + 6.0f; y < 196.0f; y += 7.0f) {
            uint32_t on = lit || vis_rnd(&s) % 10u < 7u;
            uint32_t wc = lit ? vg_mix(c, VW, it * 0.5f) : VC(70, 30, 100);
            if (on)
                vg_rect(x + 3.0f, y, 1.0f, 1.0f, wc, 0.9f), vg_rect(x1 - 3.0f, y, 1.0f, 1.0f, wc, 0.9f);
        }
        vg_mode(VG_PAINT);
    }
    if (it > 0.6f) {
        vg_mode(VG_ADD);
        vg_glow(x + wd * 0.5f, top, wd * 1.6f, c, it * 0.6f);
        vg_rect(x, top - 1.5f, wd + 1.0f, 3.0f, VW, (it - 0.6f) * 2.5f);
        vg_mode(VG_PAINT);
    }
}
/* KEY CITY: the skyline as two octaves of keys: a note lights its tower in its track's colour, beaming into the sky and
 * shining on the wet street; a drum track's hits light the street lights */
UI_SMALL static void vis_keycity(void)
{
    static const uint8_t WPC[7] = {0, 2, 4, 5, 7, 9, 11};
    int32_t k, i, x, wd, h;
    vg_vgrad(0, 201, VC(4, 0, 18), VC(60, 10, 70));
    vis_stars(70u, 140u, 64u);
    vg_vgrad(200, 240, VC(10, 0, 24), VC(4, 0, 12));
    vis_grid(200.0f, 0.0f, 4, 30.0f, VC(110, 20, 110), 0.8f);
    vg_mode(VG_ADD);
    for (k = 0; k < 24; k++) {                      /* the beams and the reflections of the lit towers */
        f32 it = (f32)vs.key[k] / 255.0f, top, cx;
        uint32_t c = vg_565(UI_COL[vs.keyt[k] % NTRK]);
        if (vs.key[k] <= 5)
            continue;
        vis_keygeo((uint32_t)k, &x, &wd, &h);
        top = 200.0f - (f32)h, cx = (f32)x + (f32)wd * 0.5f;
        vg_beam(cx, top, cx, -4.0f, (f32)wd * 0.6f, (f32)wd * 0.6f + 12.0f, c, it * 0.55f, 0.0f, 1.0f);
        vg_beam(cx, top, cx, -4.0f, 2.0f, 3.0f, vg_mix(c, VW, 0.5f), it * 0.8f, 0.0f, 1.0f);
        vg_beam(cx, 201.0f, cx, 239.0f, (f32)wd, (f32)wd * 0.6f, c, it * 0.45f, 0.0f, 0.6f);
    }
    vg_mode(VG_PAINT);
    for (i = 0; i < 7; i++) {                       /* the white keys' towers, the outer ones first */
        vis_keytower(WPC[i]);
        vis_keytower(12u + WPC[6 - i]);
    }
    for (k = 0; k < 24; k++)
        if ((0x54Au >> (k % 12)) & 1u)
            vis_keytower((uint32_t)k);
    vg_mode(VG_ADD);
    for (i = 0; i < 2; i++)                         /* the street lights: the drum tracks */
        for (k = 0; k < 4; k++) {
            f32 lx = (f32)(10 + k * 60 + i * 30), d = (f32)vs.drum[i] / 255.0f;
            uint32_t c = vg_565(UI_COL[vs.drumt[i] % NTRK]);
            vg_glow(lx, 219.0f, 6.0f + 12.0f * d, c, 0.2f + 0.5f * d);
            vg_disc(lx, 219.0f, 2.5f, vg_mix(c, VW, d * 0.5f), 0.4f + 0.6f * d);
        }
    vg_mode(VG_PAINT);
}

/* the band just drawn (screen rows y0..), to the panel: only its strips of 8 rows that changed since the last frame,
 * each run of them in one transfer */
UI_SMALL static void vis_send(uint32_t y0)
{
    uint32_t s, n = cv_h / 8u, run = 0, s0 = 0;
    for (s = 0; s <= n; s++) {
        int dirty = 0;
        if (s < n) {
            const uint32_t *w = (const uint32_t *)(const void *)&cv_px[s * 8u * 240u];
            uint32_t i, hsum = 2166136261u, k = y0 / 8u + s;
            for (i = 0; i < 8u * 240u / 2u; i++)
                hsum = (hsum ^ w[i]) * 16777619u;
            hsum |= 1u;                             /* (0 is "unknown") */
            dirty = vis_sum[k] != hsum;
            vis_sum[k] = hsum;
        }
        if (dirty && !run)
            s0 = s, run = 1;
        if (!dirty && run) {
            lcd_blit(0, y0 + s0 * 8u, 240, (s - s0) * 8u, cv_px + s0 * 8u * 240u);
            run = 0;
        }
    }
}
/* the visualiser, every other frame: the update, then both bands */
__attribute__((noinline)) UI_SMALL static void vis_draw(void)
{
    uint32_t pass;
    if (!vis_shown_last || ui.force) {
        uint32_t k;
        vis_shown_last = 1;
        lcd_clear();
        for (k = 0; k < 30u; k++)
            vis_sum[k] = 0;                         /* (the panel shows none of it now) */
    } else if (ui.frame & 1u) {
        return;
    }
    vis_update();
    for (pass = 0; pass < 2u; pass++) {
        cv_begin(240, 120, C_BLACK);
        cv_oy = -(int32_t)(pass * 120u);
        vg_begin();
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
        vis_send(pass * 120u);
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
