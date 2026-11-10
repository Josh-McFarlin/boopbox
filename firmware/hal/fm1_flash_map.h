/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Leo Kuroshita (@kurogedelic), Hügelton Instruments */
/* (1.8) The FM-1's flash map: where BoopBox keeps its own data, apart from the driver (fm1_flash.h) so that the browser
 * emulator (firmware/host/emu.c) keeps the same places and rules on its memory flash. */
#pragma once
#include <stdint.h>

#define FL_DATA_LO      0x00097000u                /* Felucca main store */
#define FL_DATA_HI      0x000E0000u
#define FL_GLOB_LO      0x000FC000u                /* Felucca superblock / globals */
#define FL_GLOB_HI      0x000FF000u
#define FL_OTA_LO       0x000E0000u                /* M-UPGRADE loader staging, ota.c */
#define FL_OTA_HI       0x000E5000u
#define FL_FM6_LO       0x000E5000u                /* the FM6 patch bank (fm6_bank.c), A / B sectors; SLOOP 2.4 */
#define FL_FM6_HI       0x000E7000u
#define FL_USR4_LO      0x000E7000u                /* the user sample slot USR4 (eng_sample.c), 80 KiB; SLOOP 2.4 */
#define FL_USR4_HI      0x000FB000u                /* (0xFB000..0xFBFFF stays free) */
/* [off, off + n) inside [lo, hi), without wrapping: off + n can overflow, and
 * the 1 MiB part ignores the high address bits, so a wrapped range lands low. */
#define FL_IN(off, n, lo, hi) ((uint32_t)(off) >= (lo) && (uint32_t)(off) <= (hi) && \
                               (uint32_t)(n) <= (hi) - (uint32_t)(off))
/* Felucca's own store (projects, user samples; settings; the FM6 bank) */
#if defined(FELUCCA_TRAINER) && FELUCCA_TRAINER
#define FL_TRN_LO       0x000FB000u                /* the trainer's progress log (trainer.c TR_LOG), one sector */
#define FL_TRN_HI       0x000FC000u
#define FL_TRN_OK(off, n) FL_IN(off, n, FL_TRN_LO, FL_TRN_HI)
#else
#define FL_TRN_OK(off, n) 0
#endif
#define FL_STORE_OK(off, n) (FL_IN(off, n, FL_DATA_LO, FL_DATA_HI) || FL_IN(off, n, FL_GLOB_LO, FL_GLOB_HI) || \
                             FL_IN(off, n, FL_FM6_LO, FL_FM6_HI) || FL_IN(off, n, FL_USR4_LO, FL_USR4_HI) || \
                             FL_TRN_OK(off, n))
