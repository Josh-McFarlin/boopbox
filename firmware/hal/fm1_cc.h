/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Leo Kuroshita (@kurogedelic), Hügelton Instruments */
/* FM1_INLINE: register helpers that must inline into their caller, so the
 * SFR access sequence (and its timing, in ISRs and IRQ-off sections) is the
 * one written at the call site; -Os would otherwise out-line a helper with
 * several callers. RAM-resident code (.ram_text) may only use these, never
 * a called helper (build.py checks .ram_text for calls). */
#pragma once

#define FM1_INLINE static inline __attribute__((always_inline))

/* fm1_opaque(p): p, with the compiler no longer knowing what it points at: reads through it are reads of the memory
 * (trainer.c: the song area, a const array in the image whose bytes the package changes; the old clang folds reads of
 * a const array, even a weak one, into its initializer) */
FM1_INLINE const void *fm1_opaque(const void *p)
{
    __asm__("" : "+r"(p));
    return p;
}
