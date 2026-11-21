/* SPDX-License-Identifier: GPL-3.0-only */
/* (1.8) The parameter display (params.c param_format) of the exponential formats, TIME, LFO Hz, CUTOFF and dB, computed
 * from FM6's 2^x table (exp_scale) instead of the four tables gen_tables.py writes: every value 0..127 shows the same
 * string and unit as the tables gave (the tables are read here only).
 *   cc -O2 -w -Ibuild/gen -Ifirmware/src -Ifirmware/hal tests/display_test.c -lm */
#define main hostsim_main
#include "hostsim.c"
#undef main

/* the display as the tables gave it (params.c before 1.8) */
static void old_format(uint32_t fmt, int32_t v, char *val, const char **unit)
{
    switch (fmt) {
    case F_TIME: {
        uint32_t ms10 = TIME_MS_X10[v & 127];
        if (ms10 < 100u) {
            fmt_fix(val, (int32_t)ms10, 1);
            *unit = "ms";
        } else if (ms10 < 10000u) {
            fmt_int(val, (int32_t)((ms10 + 5u) / 10u));
            *unit = "ms";
        } else {
            fmt_fix(val, (int32_t)(ms10 / 100u), 2);
            if (ms10 >= 100000u)
                fmt_fix(val, (int32_t)(ms10 / 1000u), 1);
            *unit = "s";
        }
        break;
    }
    case F_LFOHZ: {
        uint32_t h = LFO_HZ_X100[v & 127];
        if (h < 1000u)
            fmt_fix(val, (int32_t)h, 2);
        else
            fmt_fix(val, (int32_t)(h / 10u), 1);
        *unit = "Hz";
        break;
    }
    case F_CUTOFF: {
        uint32_t h = CUTOFF_HZ[v & 127];
        if (h < 1000u) {
            fmt_int(val, (int32_t)h);
            *unit = "Hz";
        } else if (h < 10000u) {
            fmt_fix(val, (int32_t)(h / 100u), 1);
            *unit = "kHz";
        } else {
            fmt_int(val, (int32_t)((h + 500u) / 1000u));
            *unit = "kHz";
        }
        break;
    }
    default:
        if (v <= 0) {
            str_cpy(val, "OFF", 6);
            *unit = "";
        } else if (LEVEL_DB_X10[v] > -100) {
            fmt_fix(val, LEVEL_DB_X10[v], 1);
            *unit = "dB";
        } else {
            fmt_int(val, (LEVEL_DB_X10[v] - 5) / 10);
            *unit = "dB";
        }
    }
}

int main(void)
{
    static const uint8_t FMT[4] = {F_TIME, F_LFOHZ, F_CUTOFF, F_DB};
    uint32_t f, bad = 0, n = 0;
    int32_t v;
    for (f = 0; f < 4u; f++)
        for (v = 0; v < 128; v++) {
            param_desc_t d = {"X", FMT[f], 0, 127, 0, 0};
            char a[16] = {0}, b[16] = {0};
            const char *ua = "", *ub = "";
            old_format(FMT[f], v, a, &ua);
            param_format(&d, v, b, &ub);
            n++;
            if (strcmp(a, b) || strcmp(ua, ub)) {
                printf("display: format %u value %d: was \"%s %s\", now \"%s %s\"\n", (unsigned)FMT[f], (int)v, a, ua, b, ub);
                bad++;
            }
        }
    printf("display: %u values of TIME, LFO Hz, CUTOFF and dB: %u different\n", n, bad);
    return bad != 0;
}
