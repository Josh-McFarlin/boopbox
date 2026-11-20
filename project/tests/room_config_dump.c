/* SPDX-License-Identifier: GPL-3.0-only */
/* The firmware's engines, factory presets, sound controls, sample sets and drum kits as JSON, for
 * tests/room_config_test.py: the jam rooms' list of what can be shared (shared/room-config.json) must match the
 * firmware, or the rooms mute a track whose factory sound they don't know.
 *   cc -O2 -w -Ibuild/gen -Ifirmware/src -Itests tests/room_config_dump.c -lm */
#define main hostsim_main
#include "hostsim.c"
#undef main

int main(void)
{
    uint32_t e, j;
    printf("{\"engines\": [");
    for (e = 0; e < NENGINES; e++) {
        const engine_t *g = ENGINES[e];
        printf("%s{\"name\": \"%s\", \"presets\": %u, \"edit\": {", e ? ", " : "", g->name, (unsigned)g->npresets);
        for (j = 0; j < 8u; j++)
            printf("%s\"%u\": [\"%s\", %d, %d]", j ? ", " : "", (unsigned)(P_E0 + j), g->edit[j].label,
                   g->edit[j].min, g->edit[j].max);
        printf("}}");
    }
    printf("], \"factory_sample_sets\": %u, \"factory_kits\": %u, \"fm6_factory_patches\": %u, \"fm6_patch\": %u}\n",
           (unsigned)SMP_NSETS, (unsigned)(DRUM_SAMPLED + DS_NKITS), (unsigned)FM6_NFACTORY, (unsigned)(P_E0 + 7));
    return 0;
}
