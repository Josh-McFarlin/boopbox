/* SPDX-License-Identifier: GPL-3.0-only */
/* The editor protocol's PATS push (v14, firmware/src/editor.c ed_pats_now): WATCH bit 2 turns it on, a pattern or a
 * scene asked for goes out at once with PAT Q, again when the change is made, and never without bit 2. On the harness
 * tests/editor_host.c, as tests/editor_repro.c. */
#include "editor_host.c"

static uint8_t pats[16][16];                           /* the PATS frames pushed: their 11 bytes */
static uint32_t npats, nframes;
static uint8_t frame[1024];
static uint32_t frame_n;
static void take_pushes(void)                          /* every frame out of the SysEx ring (rx_take keeps the last) */
{
    while (so_r != so_w) {
        uint32_t pkt = sx_out_q[so_r % SXQ], cin = pkt & 15u, k, nb = cin == 4u || cin == 7u ? 3u : cin == 6u ? 2u : 1u;
        so_r++;
        for (k = 0; k < nb; k++) {
            uint8_t b = (uint8_t)(pkt >> (8u * (k + 1u)));
            if (b == 0xF0u) frame_n = 0;
            if (frame_n < sizeof frame) frame[frame_n++] = b;
            if (b == 0xF7u) {
                nframes++;
                if (frame_n == 4u + 1u + 11u + 1u && frame[4] == ED_PATS && npats < 16u)
                    memcpy(pats[npats++], frame + 5, 11);
            }
        }
    }
}
static void ed(uint32_t cmd, const uint8_t *a, uint32_t na)
{
    uint8_t f[64];
    f[0] = ED_HDR0; f[1] = ED_HDR1; f[2] = ED_HDR2; f[3] = (uint8_t)cmd;
    memcpy(f + 4, a, na);
    usb_sysex(f, 4 + na);
}
static void pass(void)                                 /* a main-loop pass of the editor's sync */
{
    fm1_ms += 10;
    ed_w.last_ms = fm1_ms;
    ed_service();
    take_pushes();
}
static int fails;
static void check(const char *what, int ok) { printf("%-72s %s\n", what, ok ? "ok" : "FAIL"); fails += !ok; }

int main(void)
{
    uint8_t a[1];
    harness_init();
    a[0] = 3;                                          /* v4 only: no PATS */
    ed(ED_WATCH, a, 1);
    check("WATCH 3: the reply is 3 (no PATS bit)", rx_last[5] == 3u);
    trk[2].pat_req = 4u;                               /* track 3 asks for pattern 4 */
    pass(); pass();
    check("... and no PATS for a pattern asked for", npats == 0u);
    trk[2].pat_req = 0;
    a[0] = 7;
    ed(ED_WATCH, a, 1);
    check("WATCH 7: the reply sets bit 2", rx_last[5] == 7u);
    pass();
    check("nothing pushed while nothing changes", npats == 0u);
    song.g[G_PATQ] = 2;                                /* PAT Q 2 BARS */
    trk[2].pat_req = 4u;
    pass();
    check("a pattern asked for: PATS at once", npats == 1u);
    check("... track 3: pattern 0 playing, 3 asked for (bits 3..6 = 4)", pats[0][2] == (0u | 4u << 3));
    check("... the other tracks: nothing asked", pats[0][0] == 0u && pats[0][7] == 0u);
    check("... no scene, PAT Q 2", pats[0][8] == 127u && pats[0][9] == 127u && pats[0][10] == 2u);
    pass(); pass();
    check("pushed once, not again while it waits", npats == 1u);
    trk[2].pat = 3u;                                   /* the audio ISR makes the change */
    trk[2].pat_req = 0;
    pass();
    check("the change made: PATS again, pattern 3 playing, nothing asked", npats == 2u && pats[1][2] == 3u);
    scn_launch(5);                                     /* a scene: every track asked for pattern 5 */
    sync_reload = 1;                                   /* (the UI asks for a RELOAD too, in the same pass) */
    pass();
    check("a scene launched: PATS with every track asking, the scene asked for", npats == 3u
          && pats[2][0] == (6u << 3) && pats[2][2] == (3u | 6u << 3) && pats[2][8] == 5u);
    a[0] = 0;
    ed(ED_WATCH, a, 1);
    trk[0].pat_req = 2u;
    pass();
    check("WATCH 0: no more PATS", npats == 3u);
    printf("%s\n", fails ? "PATS TEST FAILED" : "editor PATS push passed");
    return fails != 0;
}
