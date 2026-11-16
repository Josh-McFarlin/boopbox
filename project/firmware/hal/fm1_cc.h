/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Leo Kuroshita (@kurogedelic), Hügelton Instruments */
/* FM1_INLINE: register helpers that must inline into their caller, so the
 * SFR access sequence (and its timing, in ISRs and IRQ-off sections) is the
 * one written at the call site; -Os would otherwise out-line a helper with
 * several callers. RAM-resident code (.ram_text) may only use these, never
 * a called helper (build.py checks .ram_text for calls). */
#pragma once

#define FM1_INLINE static inline __attribute__((always_inline))

/* FM1_FAST: the 10 kHz TIMER5 tick's code (the ISR, the key and LED scan, the key velocity's sampling), in
 * .fast_text: copied to RAM at boot with .ram_text (app.ld, main.c), so the tick that runs 10,000 times a
 * second is not fetched through the XIP cache, where it competed with the audio render for the cache lines
 * and waited on the flash at every miss. Unlike .ram_text it may call code in flash (the USB and UART polls,
 * at 2 kHz): an ISR never runs while the flash is busy (fm1_flash.h: IRQs off). The host builds place nothing.
 * FM1_FAR(fn): RAM (0x01C0xxxx) and XIP (0x020xxxxx) are farther apart than a direct call reaches (23 bits),
 * so a call between .fast_text and flash code, either way, goes through a pointer the compiler cannot fold
 * back (as fm1_flash.h FL_FAR for the flash driver); the linker refuses a direct one. */
FM1_INLINE void *fm1__far(void *p) { void *volatile q = p; return q; }
#define FM1_FAR(fn) ((__typeof__(&fn))fm1__far((void *)&fn))
#ifdef __PI32V2__
#define FM1_FAST __attribute__((section(".fast_text")))
#else
#define FM1_FAST
#endif
