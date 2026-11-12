/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Leo Kuroshita (@kurogedelic), Hügelton Instruments */
/* (1.8: out of main.c, so that the browser emulator, firmware/host/emu.c, powers on the same way) */
/* power-on: the tracks with their default sounds and kits (ui.c TRK_DEF), empty patterns */
UI_SMALL static __attribute__((noinline)) void felucca_init(void)
{
    uint32_t i;
    for (i = 0; i < G_COUNT; i++)
        song.g[i] = GP[i].def;
    fm6_init();                               /* every part's FM6 patch: the init voice */
    harm_defaults();                          /* the harmony: no progression (I), no track follows */
    for (i = 0; i < NTRK; i++) {
        track_power_on(i);
        trk[i].engine = trk[i].eng_req;       /* (nothing sounds yet: no fade) */
    }
    song.sel = 0;
    song.master_q12 = 2048;
    autosave_resume();                        /* the project as it was left (project.c) */
    song.g[G_SYNC] = (int16_t)lights_sync;    /* a setting of the FM-1 (panel.c) */
    song.g[G_MIDI] = (int16_t)lights_mout;
    song.g[G_ROUTE] = (int16_t)lights_min;
    song.g[G_CH1] = midi_set[0], song.g[G_CH2] = midi_set[1], song.g[G_CH3] = midi_set[2];   /* (2.6: GLO > MIDI, */
    song.g[G_DRCH] = midi_set[3], song.g[G_CHOTH] = midi_set[4], song.g[G_BEND] = midi_set[5];
    song.g[G_FXCH] = midi_set[6];
    song.g[G_DRMAP] = midi_set[7];                   /* (2.7) GLO > MIDI 3: DR MAP */
    song.g[G_CLKOUT] = midi_set[9];                  /* (2.7) GLO > MIDI 3: CLK OUT */
    song.g[G_RMCH] = midi_set[8];                    /* (2.7) GLO > MIDI 3: REMOTE */
    song.g[G_CH5] = midi_set[10], song.g[G_CH6] = midi_set[11];   /* (eight tracks) GLO > MIDI 4 */
    song.g[G_CH7] = midi_set[12], song.g[G_CH8] = midi_set[13];
    song.g[G_FXFADE] = fxfade;                        /* (2.7.2) GLO > MASTER 2: the punch-in FX fade */                    /* (2.7) GLO > MIDI 3: FX CH */   /* settings of the FM-1) */
    layers_init();                            /* the panel's layer buttons for the keys (ui_layers.c) */
    go_home();
    ui.force = 1;
}
