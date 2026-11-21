/* SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Jake Handy (h1, https://github.com/jakehandy/h1: core/gfx.c, core/mathx.h)
 * Adapted for BoopBox, 2026: colour blending into the RGB565 canvas, drawn in bands.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
/* Anti-aliased vector drawing for the visualiser (ui_vis.c), after h1's gfx.c. h1 draws one ink colour in 8-bit shades
 * into a full-screen buffer; here every primitive has its own colour and is blended straight into the canvas (gfx.c
 * cv_px, RGB565 byte-swapped), which holds one band of the screen at a time: vg_begin() after cv_begin() takes the band
 * (cv_h rows, screen row = canvas row - cv_oy), and every primitive clips to it. Coordinates are the screen's, pixel
 * centres on integers. No memory of its own beyond a few words of state.
 *   modes  VG_PAINT  alpha over (the default: shapes, silhouettes, skies)
 *          VG_ADD    light added (glows, beams, neon cores)
 *          VG_MAX    each channel the brighter (line art that crosses itself without blowing out)
 * Every write goes through a 4 x 4 ordered dither down to RGB565, so a slow gradient or a faint glow does not band; a
 * colour that is already RGB565 (RGB()) comes back unchanged.
 * Single precision floats, main loop only: the audio code is integer and never touches the FPU's registers. */
typedef float f32;

static inline f32 vg_clampf(f32 x, f32 lo, f32 hi) { return x < lo ? lo : (x > hi ? hi : x); }
static inline f32 vg_sat(f32 x) { return x < 0.0f ? 0.0f : (x > 1.0f ? 1.0f : x); }
static inline f32 vg_absf(f32 x) { return x < 0.0f ? -x : x; }
static inline f32 vg_minf(f32 a, f32 b) { return a < b ? a : b; }
static inline f32 vg_maxf(f32 a, f32 b) { return a > b ? a : b; }
static inline int32_t vg_imin(int32_t a, int32_t b) { return a < b ? a : b; }
static inline int32_t vg_imax(int32_t a, int32_t b) { return a > b ? a : b; }
static inline int32_t vg_ifloor(f32 x)
{
    int32_t i = (int32_t)x;
    return (f32)i > x ? i - 1 : i;
}
static inline f32 vg_rsqrt(f32 x)                  /* 1/sqrt(x), x > 0: the bit trick and two Newton steps */
{
    union { f32 f; uint32_t u; } v;
    f32 y;
    v.f = x;
    v.u = 0x5f3759dfu - (v.u >> 1);
    y = v.f;
    y = y * (1.5f - 0.5f * x * y * y);
    y = y * (1.5f - 0.5f * x * y * y);
    return y;
}
static inline f32 vg_sqrt(f32 x) { return x <= 1e-12f ? 0.0f : x * vg_rsqrt(x); }
static inline f32 vg_sin(f32 t)                    /* sin(2 pi t), t in turns: a degree-9 polynomial on a quarter turn */
{
    f32 x, x2;
    t -= (f32)vg_ifloor(t);
    if (t > 0.5f) t -= 1.0f;
    if (t > 0.25f) t = 0.5f - t;
    else if (t < -0.25f) t = -0.5f - t;
    x = t * 6.28318531f;
    x2 = x * x;
    return x * (1.0f + x2 * (-0.16666667f + x2 * (0.0083333310f + x2 * (-0.00019840874f + x2 * 2.7525562e-06f))));
}
static inline f32 vg_cos(f32 t) { return vg_sin(t + 0.25f); }
/* a critically damped spring: x chases target at omega (rad/s) over dt seconds, at any frame rate */
static inline void vg_spring(f32 *x, f32 *v, f32 target, f32 omega, f32 dt)
{
    f32 f = 1.0f + 2.0f * dt * omega, oo = omega * omega, hoo = dt * oo, hhoo = dt * hoo, inv = 1.0f / (f + hhoo);
    f32 nx = (f * *x + dt * *v + hhoo * target) * inv;
    *v = (*v + hoo * (target - *x)) * inv;
    *x = nx;
}

enum { VG_PAINT, VG_ADD, VG_MAX };
#define VG_W 240
#define VC(r, g, b) ((uint32_t)(r) << 16 | (uint32_t)(g) << 8 | (uint32_t)(b))   /* a colour, 8 bits a channel */

static struct {
    uint16_t *fb;                                  /* the band (cv_px) */
    int32_t h, oy;                                 /* its rows; screen row y is band row y + oy */
    int32_t mode, level;                           /* the primitive's alpha, 0..256 */
    int32_t r, g, b;                               /* its colour, 0..255 */
    f32 dim;
} vg = {0, 0, 0, VG_PAINT, 256, 255, 255, 255, 1.0f};
static const uint8_t VG_BAYER[16] = {0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5};

UI_SMALL static void vg_begin(void)
{
    vg.fb = cv_px;
    vg.h = (int32_t)cv_h;
    vg.oy = cv_oy;
    vg.mode = VG_PAINT;
    vg.dim = 1.0f;
}
UI_SMALL static void vg_mode(int32_t m) { vg.mode = m; }
UI_SMALL static void vg_dim(f32 k) { vg.dim = vg_sat(k); }
UI_SMALL static void vg_rgb(uint32_t c) { vg.r = (int32_t)(c >> 16 & 255u), vg.g = (int32_t)(c >> 8 & 255u), vg.b = (int32_t)(c & 255u); }
UI_SMALL static uint32_t vg_565(uint32_t c)                 /* RGB565 -> VC, by bit replication (exact back through the dither) */
{
    uint32_t r = c >> 11 & 31u, g = c >> 5 & 63u, b = c & 31u;
    return VC(r << 3 | r >> 2, g << 2 | g >> 4, b << 3 | b >> 2);
}
UI_SMALL static uint32_t vg_mix(uint32_t a, uint32_t b, f32 t)   /* a -> b, t 0..1 */
{
    int32_t k = (int32_t)(vg_sat(t) * 256.0f), ra = (int32_t)(a >> 16 & 255u), ga = (int32_t)(a >> 8 & 255u), ba = (int32_t)(a & 255u);
    return VC(ra + ((((int32_t)(b >> 16 & 255u) - ra) * k) >> 8), ga + ((((int32_t)(b >> 8 & 255u) - ga) * k) >> 8),
              ba + ((((int32_t)(b & 255u) - ba) * k) >> 8));
}
UI_SMALL static uint32_t vg_scale(uint32_t c, f32 t) { return vg_mix(0u, c, t); }
UI_SMALL static void vg_level(f32 a)
{
    a *= vg.dim;
    vg.level = a <= 0.0f ? 0 : (a >= 1.0f ? 256 : (int32_t)(a * 256.0f + 0.5f));
}
__attribute__((noinline)) UI_SMALL static uint16_t vg_pack(int32_t r, int32_t g, int32_t b, int32_t x, int32_t sy)
{
    int32_t d = VG_BAYER[(sy & 3) * 4 + (x & 3)];
    r = (r + (d >> 1)) >> 3, g = (g + (d >> 2)) >> 2, b = (b + (d >> 1)) >> 3;
    if (r > 31) r = 31;
    if (g > 63) g = 63;
    if (b > 31) b = 31;
    return swap16((uint32_t)(r << 11 | g << 5 | b));
}
/* one pixel of the band (x, band row y), a = 0..256 of the colour */
__attribute__((noinline)) UI_SMALL static void vg_ink(uint16_t *p, int32_t a, int32_t x, int32_t y)
{
    uint32_t d;
    int32_t r, g, b, cr, cg, cb;
    if (a <= 0)
        return;
    if (a > 256)
        a = 256;
    if (vg.mode == VG_PAINT && a == 256) {
        *p = vg_pack(vg.r, vg.g, vg.b, x, y - vg.oy);
        return;
    }
    d = swap16(*p);
    r = (int32_t)(d >> 11 & 31u), g = (int32_t)(d >> 5 & 63u), b = (int32_t)(d & 31u);
    r = r << 3 | r >> 2, g = g << 2 | g >> 4, b = b << 3 | b >> 2;
    if (vg.mode == VG_PAINT) {
        r += ((vg.r - r) * a) >> 8, g += ((vg.g - g) * a) >> 8, b += ((vg.b - b) * a) >> 8;
    } else {
        cr = (vg.r * a) >> 8, cg = (vg.g * a) >> 8, cb = (vg.b * a) >> 8;
        if (vg.mode == VG_ADD) {
            r += cr, g += cg, b += cb;
        } else {
            r = cr > r ? cr : r, g = cg > g ? cg : g, b = cb > b ? cb : b;
        }
    }
    *p = vg_pack(r, g, b, x, y - vg.oy);
}
/* screen (x, y), coverage 0..256 */
__attribute__((noinline)) UI_SMALL static void vg_put(int32_t x, int32_t y, int32_t cov)
{
    y += vg.oy;
    if ((uint32_t)x >= VG_W || (uint32_t)y >= (uint32_t)vg.h || cov <= 0)
        return;
    vg_ink(&vg.fb[y * VG_W + x], (cov > 256 ? 256 : cov) * vg.level >> 8, x, y);
}
static inline int32_t vg_cov(f32 c) { return c <= 0.0f ? 0 : (c >= 1.0f ? 256 : (int32_t)(c * 256.0f)); }
/* the band's screen rows, as edges: what a primitive may touch */
#define VG_Y0 ((f32)(-vg.oy) - 0.5f)
#define VG_Y1 ((f32)(vg.h - vg.oy) - 0.5f)

/* rows y0..y1-1 (screen) from colour a to b, dithered: a sky */
UI_SMALL static void vg_vgrad(int32_t y0, int32_t y1, uint32_t a, uint32_t b)
{
    int32_t y, ya = vg_imax(y0, -vg.oy), yb = vg_imin(y1, vg.h - vg.oy);
    int32_t m = vg.mode;
    vg.mode = VG_PAINT;
    for (y = ya; y < yb; y++) {
        uint32_t c = vg_mix(a, b, (f32)(y - y0) / (f32)(y1 - y0));
        int32_t x, r = (int32_t)(c >> 16 & 255u), g = (int32_t)(c >> 8 & 255u), bl = (int32_t)(c & 255u);
        uint16_t *p = &vg.fb[(y + vg.oy) * VG_W], q[4];
        for (x = 0; x < 4; x++)
            q[x] = vg_pack(r, g, bl, x, y);
        for (x = 0; x < VG_W; x++)
            p[x] = q[x & 3];
    }
    vg.mode = m;
}

/* A line as the pixels within R of it, a column at a time along its major axis m, down each column over the pixels it
 * can reach; the distance across (S, 20 bits of fraction) and along (T, 16) are stepped as integers (h1's line_scan).
 * mstride, nstride: a step of m, of n in the band (1 or VG_W); m and n are band coordinates. skip: 1 leaves out the
 * round end at (m0, n0), 2 the one at (m1, n1) (a path's stroke over the one before). */
#define VG_Q18(v) ((int32_t)((v) * 262144.0f + ((v) < 0.0f ? -0.5f : 0.5f)))
UI_SMALL static void vg_scan(f32 m0, f32 n0, f32 m1, f32 n1, f32 um, f32 un, f32 len, f32 R, int32_t mlim, int32_t nlim,
                    int32_t mstride, int32_t nstride, int32_t skip, int32_t yband)
{
    const f32 slope = (n1 - n0) / (m1 - m0), reach = R / um + 0.01f;
    const f32 RR = R * R, solid = R > 1.0f ? (R - 1.0f) * (R - 1.0f) : -1.0f;
    const int32_t R20 = (int32_t)(R * 1048576.0f), LEN = (int32_t)(len * 65536.0f);
    const int32_t UM20 = (int32_t)(um * 1048576.0f + 0.5f), UN20 = (int32_t)(un * 1048576.0f + (un < 0.0f ? -0.5f : 0.5f));
    const int32_t UM16 = (UM20 + 8) >> 4, UN16 = (UN20 + 8) >> 4;
    const int32_t REACH = (int32_t)(reach * 262144.0f), SLOPE = VG_Q18(slope), N0 = VG_Q18(n0), N1 = VG_Q18(n1);
    const int32_t ma = vg_imax(0, vg_ifloor(m0 - R - 0.01f) + 1), mb = vg_imin(mlim - 1, vg_ifloor(m1 + R + 0.01f));
    const int32_t mi = vg_ifloor(m0) + 1, mj = -vg_ifloor(-m1) - 1;
    const int32_t lev = vg.level;
    int32_t NC, S, T, m = ma, nr;
    if (ma > mb)
        return;
    NC = m < mi ? N0 : m > mj ? N1 : VG_Q18(n0 + ((f32)m - m0) * slope);
    nr = ((NC - REACH) >> 18) + 1;
    {
        f32 pm = (f32)m - m0, pn = (f32)nr - n0;
        S = (int32_t)((pm * un - pn * um) * 1048576.0f);
        T = (int32_t)((pm * um + pn * un) * 65536.0f);
    }
    for (;;) {
        int32_t n, na = nr < 0 ? 0 : nr, nb = (NC + REACH) >> 18;
        if (nb > nlim - 1)
            nb = nlim - 1;
        if (na <= nb) {
            int32_t s = S - (na - nr) * UM20, t = T + (na - nr) * UN16;
            uint16_t *p = vg.fb + m * mstride + na * nstride;
            for (n = na; n <= nb; n++, p += nstride, s -= UM20, t += UN16) {
                int32_t c;
                if ((uint32_t)t <= (uint32_t)LEN) {
                    c = (R20 - (s < 0 ? -s : s)) >> 12;
                } else {                            /* past an end: how far from it */
                    f32 qm, qn, d2;
                    if (t < 0) {
                        if (skip & 1)
                            continue;
                        qm = (f32)m - m0, qn = (f32)n - n0;
                    } else {
                        if (skip & 2)
                            continue;
                        qm = (f32)m - m1, qn = (f32)n - n1;
                    }
                    d2 = qm * qm + qn * qn;
                    if (d2 >= RR)
                        continue;
                    c = d2 <= solid ? 256 : vg_cov(R - vg_sqrt(d2));
                }
                if (c > 0) {
                    int32_t x = mstride == 1 ? m : n, y = mstride == 1 ? n : m;
                    vg_ink(p, (c > 256 ? 256 : c) * lev >> 8, x, y + yband);
                }
            }
        }
        if (++m > mb)
            break;
        {
            int32_t n2;
            if (m < mi)
                NC = N0;
            else if (m > mj)
                NC = N1;
            else if (m == mi)
                NC = VG_Q18(n0 + ((f32)m - m0) * slope);
            else
                NC += SLOPE;
            n2 = ((NC - REACH) >> 18) + 1;
            S += UN20 - (n2 - nr) * UM20;
            T += UM16 + (n2 - nr) * UN16;
            nr = n2;
        }
    }
}
UI_SMALL static void vg_seg(f32 x0, f32 y0, f32 x1, f32 y1, f32 w, int32_t skip)
{
    f32 dx, dy, len2, inv, len, ux, uy, R;
    y0 += (f32)vg.oy, y1 += (f32)vg.oy;             /* to band rows */
    dx = x1 - x0, dy = y1 - y0, len2 = dx * dx + dy * dy;
    R = w * 0.5f + 0.5f;
    if (vg_minf(y0, y1) - R > (f32)vg.h || vg_maxf(y0, y1) + R < 0.0f)
        return;                                     /* (not in this band) */
    if (len2 < 1e-4f || !(vg_absf(x0) < 2048.0f && vg_absf(y0) < 2048.0f && vg_absf(x1) < 2048.0f && vg_absf(y1) < 2048.0f))
        return;
    if (!vg.level && vg.mode != VG_PAINT)
        return;
    inv = vg_rsqrt(len2);
    len = len2 * inv;
    ux = dx * inv, uy = dy * inv;
    if (vg_absf(dx) >= vg_absf(dy)) {
        if (x0 > x1)
            vg_scan(x1, y1, x0, y0, -ux, -uy, len, R, VG_W, vg.h, 1, VG_W, ((skip & 1) << 1) | (skip >> 1), 0);
        else
            vg_scan(x0, y0, x1, y1, ux, uy, len, R, VG_W, vg.h, 1, VG_W, skip, 0);
    } else {
        if (y0 > y1)
            vg_scan(y1, x1, y0, x0, -uy, -ux, len, R, vg.h, VG_W, VG_W, 1, ((skip & 1) << 1) | (skip >> 1), 0);
        else
            vg_scan(y0, x0, y1, x1, uy, ux, len, R, vg.h, VG_W, VG_W, 1, skip, 0);
    }
}
/* a line w wide, round caps */
UI_SMALL static void vg_line(f32 x0, f32 y0, f32 x1, f32 y1, f32 w, uint32_t c, f32 a)
{
    vg_rgb(c);
    vg_level(a);
    if ((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0) < 1e-4f)
        x0 -= 0.01f, x1 = x0 + 0.02f;               /* (a dot: the round caps of a line too short to see) */
    vg_seg(x0, y0, x1, y1, w, 0);
}
/* a dot of radius r (soft edge): a line too short to see, all round caps */
UI_SMALL static void vg_disc(f32 cx, f32 cy, f32 r, uint32_t c, f32 a) { vg_line(cx, cy, cx, cy, 2.0f * r, c, a); }
/* a polyline (xy: n points), joined: each stroke's round start left out under the one before (VG_MAX only) */
UI_SMALL static void vg_poly(const f32 *xy, int32_t n, f32 w, uint32_t c, f32 a)
{
    int32_t i;
    vg_rgb(c);
    vg_level(a);
    for (i = 0; i + 1 < n; i++)
        if ((xy[i * 2 + 2] - xy[i * 2]) * (xy[i * 2 + 2] - xy[i * 2]) + (xy[i * 2 + 3] - xy[i * 2 + 1]) * (xy[i * 2 + 3] - xy[i * 2 + 1]) >= 1e-4f)
            vg_seg(xy[i * 2], xy[i * 2 + 1], xy[i * 2 + 2], xy[i * 2 + 3], w, vg.mode == VG_MAX && i ? 1 : 0);
}
/* a ring of radius r, w wide (or a ring's arc from t0 to t1 turns: 0 east, clockwise on the screen) */
UI_SMALL static void vg_arc(f32 cx, f32 cy, f32 r, f32 t0, f32 t1, f32 w, uint32_t c, f32 a)
{
    f32 span = vg_absf(t1 - t0), px, py;
    int32_t n = (int32_t)(span * r * 0.9f) + 2, i;
    if (n > 96) n = 96;
    vg_rgb(c);
    vg_level(a);
    px = cx + r * vg_cos(t0), py = cy + r * vg_sin(t0);
    for (i = 1; i <= n; i++) {
        f32 t = t0 + (t1 - t0) * (f32)i / (f32)n, qx = cx + r * vg_cos(t), qy = cy + r * vg_sin(t);
        vg_seg(px, py, qx, qy, w, vg.mode == VG_MAX && i > 1 ? 1 : 0);
        px = qx, py = qy;
    }
}

/* A filled convex polygon (n <= 8 points), the colour running from ca at row ya to cb at row yb (and holding outside
 * them); soft edges. h1's fill_poly, the gradient in colour instead of ink. */
UI_SMALL static void vg_fillg(const f32 *xy, int32_t n, uint32_t ca, f32 ya, uint32_t cb, f32 yb, f32 a)
{
    f32 ex[8], ey[8], ec[8], ea[8], ei[8], minx = 1e9f, maxx = -1e9f, miny = 1e9f, maxy = -1e9f, area = 0.0f, sgn;
    f32 grad = yb != ya ? 1.0f / (yb - ya) : 0.0f;
    int32_t i, x, y, x0, x1, y0, y1, shade = ca != cb && grad != 0.0f;
    if (n < 3 || n > 8)
        return;
    vg_rgb(ca);
    vg_level(a);
    for (i = 0; i < n; i++) {
        f32 ax = xy[2 * i], ay = xy[2 * i + 1];
        int32_t j = i + 1 < n ? i + 1 : 0;
        f32 bx = xy[2 * j], by = xy[2 * j + 1], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, inv;
        area += ax * by - bx * ay;
        minx = vg_minf(minx, ax), maxx = vg_maxf(maxx, ax);
        miny = vg_minf(miny, ay), maxy = vg_maxf(maxy, ay);
        inv = l2 > 1e-8f ? vg_rsqrt(l2) : 0.0f;
        ex[i] = -dy * inv, ey[i] = dx * inv;
        ec[i] = -(ex[i] * ax + ey[i] * ay);
    }
    sgn = area >= 0.0f ? 1.0f : -1.0f;
    x0 = vg_imax(0, vg_ifloor(minx - 1.0f));
    x1 = vg_imin(VG_W - 1, vg_ifloor(maxx + 2.0f));
    y0 = vg_imax(-vg.oy, vg_ifloor(miny - 1.0f));
    y1 = vg_imin(vg.h - vg.oy - 1, vg_ifloor(maxy + 2.0f));
    for (i = 0; i < n; i++) {
        ea[i] = sgn * ex[i];
        ei[i] = ea[i] > 1e-6f || ea[i] < -1e-6f ? 1.0f / ea[i] : 0.0f;
    }
    for (y = y0; y <= y1; y++) {
        f32 xa = (f32)x0, xb = (f32)x1, ia = (f32)x0, ib = (f32)x1;
        int32_t a0, a1, i0, i1, none = 0;
        for (i = 0; i < n; i++) {
            f32 cc = sgn * (ey[i] * (f32)y + ec[i]);
            if (ei[i] == 0.0f) {
                if (cc <= -0.5f) none = 1;
                if (cc < 0.51f) ib = ia - 1.0f;
            } else if (ea[i] > 0.0f) {
                xa = vg_maxf(xa, (-0.51f - cc) * ei[i]);
                ia = vg_maxf(ia, (0.51f - cc) * ei[i]);
            } else {
                xb = vg_minf(xb, (-0.51f - cc) * ei[i]);
                ib = vg_minf(ib, (0.51f - cc) * ei[i]);
            }
        }
        if (none || xb < xa)
            continue;
        if (shade)
            vg_rgb(vg_mix(ca, cb, ((f32)y - ya) * grad));
        a0 = vg_imax(x0, vg_ifloor(xa));
        a1 = vg_imin(x1, vg_ifloor(xb) + 1);
        i0 = vg_ifloor(ia) + 1;
        i1 = vg_ifloor(ib);
        if (i1 < i0)
            i0 = a1 + 1, i1 = a1;
        for (x = a0; x <= a1; x++) {
            f32 d = 1e9f;
            if (x >= i0 && x <= i1) {               /* the inside of the row in one run */
                uint16_t *p = &vg.fb[(y + vg.oy) * VG_W + x];
                for (; x <= i1; x++, p++)
                    vg_ink(p, vg.level, x, y + vg.oy);
                x = i1;
                continue;
            }
            for (i = 0; i < n && d > -0.5f; i++) {
                f32 e = sgn * (ex[i] * (f32)x + ey[i] * (f32)y + ec[i]);
                if (e < d)
                    d = e;
            }
            if (d > -0.5f)
                vg_put(x, y, vg_cov(d + 0.5f));
        }
    }
}
UI_SMALL static void vg_fill(const f32 *xy, int32_t n, uint32_t c, f32 a) { vg_fillg(xy, n, c, 0.0f, c, 0.0f, a); }
UI_SMALL static void vg_quad(f32 x0, f32 y0, f32 x1, f32 y1, f32 x2, f32 y2, f32 x3, f32 y3, uint32_t c, f32 a)
{
    const f32 xy[8] = {x0, y0, x1, y1, x2, y2, x3, y3};
    vg_fill(xy, 4, c, a);
}

/* a filled rectangle, (x, y) its top-left pixel (a quad: edges on the pixels' edges are crisp, fractions soft) */
UI_SMALL static void vg_rect(f32 x, f32 y, f32 w, f32 h, uint32_t c, f32 a)
{
    if (w > 0.0f && h > 0.0f)
        vg_quad(x - 0.5f, y - 0.5f, x + w - 0.5f, y - 0.5f, x + w - 0.5f, y + h - 0.5f, x - 0.5f, y + h - 0.5f, c, a);
}

/* ---- soft things: light, not line. Their alpha changes from pixel to pixel (16 bits, dithered down) ---- */
__attribute__((noinline)) UI_SMALL static void vg_soft(int32_t x, int32_t y, int32_t v)   /* screen (x, y), v 0..65535 */
{
    int32_t q;
    if (v <= 0)
        return;
    q = (v + (VG_BAYER[(y & 3) * 4 + (x & 3)] << 4)) >> 8;
    if (q <= 0)
        return;
    vg_ink(&vg.fb[(y + vg.oy) * VG_W + x], q > 256 ? 256 : q, x, y + vg.oy);
}
/* a round light: a at the middle, nothing at r (falls as (1 - d^2/r^2)^2) */
UI_SMALL static void vg_glow(f32 cx, f32 cy, f32 r, uint32_t c, f32 a)
{
    int32_t x, y, x0, x1, y0, y1, m = vg.mode;
    f32 ir2, peak;
    a = vg_sat(a * vg.dim);
    if (r < 1.0f || a < 0.004f)
        return;
    vg_rgb(c);
    if (m == VG_MAX)
        vg.mode = VG_ADD;
    ir2 = 1.0f / (r * r);
    peak = a * 65535.0f;
    y0 = vg_imax(-vg.oy, vg_ifloor(cy - r) + 1);
    y1 = vg_imin(vg.h - vg.oy - 1, vg_ifloor(cy + r));
    for (y = y0; y <= y1; y++) {
        f32 dy = (f32)y - cy, hw2 = r * r - dy * dy, hw;
        if (hw2 <= 0.0f)
            continue;
        hw = vg_sqrt(hw2);
        x0 = vg_imax(0, vg_ifloor(cx - hw) + 1);
        x1 = vg_imin(VG_W - 1, vg_ifloor(cx + hw));
        for (x = x0; x <= x1; x++) {
            f32 dx = (f32)x - cx, f = 1.0f - (dx * dx + dy * dy) * ir2;
            if (f > 0.0f)
                vg_soft(x, y, (int32_t)(f * f * peak));
        }
    }
    vg.mode = m;
}
/* a stroke whose width and alpha run from w0, a0 to w1, a1; soft 0: a crisp edge, 1: brightest on its axis, nothing
 * at its edge */
UI_SMALL static void vg_beam(f32 x0, f32 y0, f32 x1, f32 y1, f32 w0, f32 w1, uint32_t c, f32 a0, f32 a1, f32 soft)
{
    f32 dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy, len, il, ux, uy, h0 = w0 * 0.5f, h1 = w1 * 0.5f;
    f32 hm = vg_maxf(h0, h1) + 1.0f, bias;
    int32_t x, y, ya, yb, bx0, bx1;
    a0 = vg_sat(a0 * vg.dim), a1 = vg_sat(a1 * vg.dim);
    if (l2 < 0.25f || (a0 < 0.004f && a1 < 0.004f))
        return;
    vg_rgb(c);
    il = vg_rsqrt(l2);
    len = l2 * il;
    ux = dx * il, uy = dy * il;
    soft = vg_sat(soft);
    bias = 0.5f * (1.0f - soft);
    ya = vg_imax(-vg.oy, vg_ifloor(vg_minf(y0, y1) - hm));
    yb = vg_imin(vg.h - vg.oy - 1, vg_ifloor(vg_maxf(y0, y1) + hm) + 1);
    bx0 = vg_imax(0, vg_ifloor(vg_minf(x0, x1) - hm));
    bx1 = vg_imin(VG_W - 1, vg_ifloor(vg_maxf(x0, x1) + hm) + 1);
    for (y = ya; y <= yb; y++) {
        int32_t xa = bx0, xb = bx1;
        f32 ry = (f32)y - y0, al, pe;
        if (uy > 0.05f || uy < -0.05f) {
            f32 xc = x0 + ry * ux / uy, hx = hm / vg_absf(uy);
            xa = vg_imax(xa, vg_ifloor(xc - hx));
            xb = vg_imin(xb, vg_ifloor(xc + hx) + 1);
        }
        al = ((f32)xa - x0) * ux + ry * uy;
        pe = ((f32)xa - x0) * uy - ry * ux;
        for (x = xa; x <= xb; x++, al += ux, pe += uy) {
            f32 t, hw, e, cv, d = pe < 0.0f ? -pe : pe;
            if (al <= -0.5f || al >= len + 0.5f)
                continue;
            t = vg_sat(al * il);
            hw = h0 + (h1 - h0) * t;
            e = 1.0f + soft * (hw - 1.0f);
            if (e < 1.0f) e = 1.0f;
            cv = (hw - d) / e + bias;
            if (cv <= 0.0f)
                continue;
            if (cv > 1.0f) cv = 1.0f;
            if (al < 0.5f) cv *= al + 0.5f;
            else if (al > len - 0.5f) cv *= len + 0.5f - al;
            vg_soft(x, y, (int32_t)(cv * (a0 + (a1 - a0) * t) * 65535.0f));
        }
    }
}
