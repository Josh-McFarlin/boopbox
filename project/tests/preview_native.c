/* SPDX-License-Identifier: GPL-3.0-only */
/* Same browser adapter on the host, for sample-by-sample WASM comparisons. */
#include <stdio.h>
#define __attribute__(x)
#include "../firmware/host/preview.c"
int main(void)
{
    /* engine, preset, note, frames, the number of globals the editor knows (50: fewer than the eight-track
     * firmware's G_COUNT; the others keep their defaults, as in the browser), the parameters, those globals */
    int32_t config[5 + P_COUNT + G_COUNT], ng;
    if (fread(config, sizeof(int32_t), 5 + P_COUNT, stdin) != 5 + P_COUNT) return 1;
    ng = config[4];
    if (ng < 0 || ng > (int32_t)G_COUNT || fread(config + 5 + P_COUNT, sizeof(int32_t), (size_t)ng, stdin) != (size_t)ng) return 1;
    preview_init();
    preview_render(); /* the adapter obtains its initial output buffer before syncing */
    preview_track(0, config[0], config[1]);
    for (uint32_t i = 0; i < P_COUNT; i++) preview_param(0, i, config[5 + i]);
    for (uint32_t i = 0; i < (uint32_t)ng; i++) preview_global(i, config[5 + P_COUNT + i]);
    if (fread(transfer, FM6_PACKED, 1, stdin) != 1) return 1;
    preview_fm6(0);
    preview_note(0, config[2], 1);
    for (uint32_t i = 0; i < (uint32_t)config[3]; i += CTL) {
        if (i == (uint32_t)config[3] / 2u) preview_note(0, config[2], 0);
        if (fwrite(preview_render(), sizeof output, 1, stdout) != 1) return 1;
    }
    return 0;
}
