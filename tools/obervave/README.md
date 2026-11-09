# OberVave's programs

`obv_params.h` and `obv_patches.h` are OberVave 3.3.2's own files, unchanged:
<https://github.com/zvenson/obervave>, commit `099ccd6f30a83591cea3521efaec6d3546004036`,
`firmware/src/`. Copyright (C) 2026 zvenson, GPL-3.0-only (OberVave's `LICENSING.md`: "The synth ...
the programs").

BoopBox does not compile them. `tools/gen_obv.py` reads them and writes `build/gen/felucca_obv.h`: the
70 programs packed for the OBERVAVE engine (`firmware/src/eng_obv.c`), and one BoopBox preset per program.
To take a newer OberVave's programs, replace both files and build again.
