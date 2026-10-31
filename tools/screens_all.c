/* SPDX-License-Identifier: GPL-3.0-only */
/* Every screen of the firmware (tools/make_all_screens.py builds and runs this): the boot screen, every page of the
 * page table (params.c PAGES), the EDIT page of every engine, every layer held, the drum and REC screens, the menu's
 * sections and the visualiser, drawn by the firmware's own code on the host with tools/screens_demo.c's demo project
 * on the eight tracks playing. Writes one 240 x 240 PPM a screen into the directory given, and a list of them
 * (index.txt: group, file, title, a line).
 * PALETTE: the menu's COLOR, its number in gfx.c PALETTES (default 5, SYNTHWAVE, as at power-on).
 *   cc -O2 -w -Ibuild/gen -Ifirmware/src -Ifirmware/hal -Itests -Itools tools/screens_all.c -lm && ./a.out OUTDIR [PALETTE] */
#define SCREENS_DEMO_NO_MAIN 1
#include "screens_demo.c"

static FILE *idx;

static void put(const char *group, const char *name, const char *title, const char *line)
{
    shot(name);
    fprintf(idx, "%s\t%s\t%s\t%s\n", group, name, title, line);
}

static const char *const FAM_NAME[FAM_COUNT] = {"HOME", "ENV", "LFO", "FX", "SCL", "EDIT", "GLO", "SAVE", "ARP", "SEQ",
                                                "TRK"};

static void show_page(uint32_t j)                   /* page j of PAGES, as the buttons open it */
{
    ui.page = (uint8_t)j;
    ui.home = 0;
    ui.fam_last[PAGES[j].fam] = (uint8_t)j;
    ui.msg_t = 0;
    page_entered();
    frames(6);
}

static void slug(char *d, const char *fam, const char *title)
{
    uint32_t n = 0;
    const char *s;
    for (s = fam; *s && n < 30u; s++)
        d[n++] = (char)(*s >= 'A' && *s <= 'Z' ? *s + 32 : *s);
    d[n++] = '-';
    for (s = title; *s && n < 60u; s++)
        d[n++] = (char)(*s >= 'A' && *s <= 'Z' ? *s + 32 : (*s >= '0' && *s <= '9') || (*s >= 'a' && *s <= 'z') ? *s : '-');
    d[n] = 0;
}

static void layer(uint32_t b, const char *name, const char *title, const char *line)
{
    press(b);
    frames(30);
    put("layers", name, title, line);
    release(b);
    frames(4);
}

int main(int argc, char **argv)
{
    static const struct { uint8_t style; const char *name, *title; } VIS[6] = {
        {0, "vis-palms", "PALMS"}, {1, "vis-night-drive", "NIGHT DRIVE"}, {2, "vis-horizon", "HORIZON"},
        {3, "vis-flyover", "FLYOVER"}, {4, "vis-dense-city", "DENSE CITY"}, {5, "vis-key-city", "KEY CITY"}};
    char path[512], name[64], title[64], line[96];
    uint32_t i, j, k;
    outdir = argc > 1 ? argv[1] : "/tmp";
    snprintf(path, sizeof path, "%s/index.txt", outdir);
    idx = fopen(path, "w");
    assert(idx);
    panel = PANEL_DEFAULT;
    layers_init();
    settings.palette = (uint8_t)(argc > 2 ? atoi(argv[2]) % (int)NPALETTES : 5);
    palette_set(settings.palette);
    host_tracks_init();
    demo_project();
    boopbox_splash();
    ppm("boot");
    fprintf(idx, "system\tboot\tBOOT\tthe name and the version\n");
    song.g[G_BPM] = 92;
    transport_req = 1;
    frames(90);

    /* the home screen, both banks */
    song.sel = 0; go_home(); frames(6); put("home", "tracks-1-4", "TRACKS 1-4", "the home screen, bank 1");
    song.sel = 5; go_home(); frames(6); put("home", "tracks-5-8", "TRACKS 5-8", "the home screen, bank 2");

    /* every page of the page table: a synth track (track 1, ANALOG, so EDIT > FILTER shows), the drum track for the
     * pages of its own */
    for (j = 0; j < NPAGES; j++) {
        const page_t *pg = &PAGES[j];
        song.sel = pg->scope == SC_DRUM ? 3 : 0;
        go_home(); frames(2);
        if (pg->scope == SC_DRUM) {
            studio_open(SC_DRUM); frames(10);
            drum_lane = 4; drum_cursor = 6; drum_page = 0;
        } else {
            show_page(j);
        }
        slug(name, FAM_NAME[pg->fam], pg->title);
        snprintf(title, sizeof title, "%s > %s", FAM_NAME[pg->fam], pg->title);
        snprintf(line, sizeof line, "page %u of %u", (unsigned)j + 1u, (unsigned)NPAGES);
        put("pages", name, title, line);
    }

    /* the drum track's own pages: the shared ones it has (FX > SLICER, SEQ > TIMING ...) and the grid's views */
    song.sel = 3; go_home(); frames(2);
    studio_open(SC_DRUM); frames(10);
    drum_lane = 4; drum_cursor = 6;
    drum_page = 1; put("drums", "drums-kit", "DRUMS: KIT", "the kit's 16 sounds");
    drum_page = 2; put("drums", "drums-sound", "DRUMS: SOUND", "a sound's TUNE and DECAY");
    drum_page = 0;
    tap(B_OCTUP); frames(2); press(B_OCTUP); frames(30); release(B_OCTUP); frames(2);
    put("drums", "drums-sheet", "DRUMS: a hit's sheet", "OCT+ held on the grid");
    ui.sheet = 0; frames(2);
    for (j = 0; j < NPAGES; j++) {
        const page_t *pg = &PAGES[j];
        if (pg->scope == SC_DRUM || pg->scope == SC_TRK || pg->scope == SC_PATS || pg->scope == SC_SONG ||
            pg->scope == SC_HARM || pg->scope == SC_GLOBAL || !page_for_drum(pg))
            continue;
        go_home(); frames(2);
        show_page(j);
        slug(name, FAM_NAME[pg->fam], pg->title);
        snprintf(path, sizeof path, "drum-%s", name);
        snprintf(title, sizeof title, "%s > %s (drum track)", FAM_NAME[pg->fam], pg->title);
        put("drums", path, title, "a page the drum track shares");
    }
    go_home(); frames(2);
    for (j = 0; j < NPAGES; j++)
        if (PAGES[j].fam == FAM_ENV) break;
    show_page(j);
    put("drums", "drum-env-no-sound", "ENV (drum track)", "a page of a synth sound: DRUM TRACK");

    /* the EDIT page of every engine, on track 2 (its first preset) */
    song.sel = 1; go_home(); frames(2);
    {
        uint32_t e0 = trk[1].eng_req, p0 = trk[1].preset;
        for (i = 0; i < NENGINES; i++) {
            set_engine_of(&trk[1], i);
            apply_preset_to(&trk[1], 0);
            trk[1].engine = trk[1].eng_req;
            frames(4);
            for (j = 0; j < NPAGES; j++)
                if (PAGES[j].fam == FAM_EDIT) break;
            show_page(j);
            snprintf(name, sizeof name, "engine-%s-edit1", ENGINES[i]->name);
            for (k = 0; name[k]; k++)
                name[k] = (char)(name[k] >= 'A' && name[k] <= 'Z' ? name[k] + 32 : name[k] == ' ' ? '-' : name[k]);
            snprintf(title, sizeof title, "%s: EDIT 1", ENGINES[i]->name);
            put("engines", name, title, ENGINES[i]->presets[0].name);
            show_page(j + 1u);
            name[str_len(name) - 1u] = '2';
            snprintf(title, sizeof title, "%s: EDIT 2", ENGINES[i]->name);
            put("engines", name, title, ENGINES[i]->presets[0].name);
            go_home(); frames(2);
        }
        set_engine_of(&trk[1], e0);
        apply_preset_to(&trk[1], p0);
        trk[1].engine = trk[1].eng_req;
        frames(4);
    }

    /* the layers: each button held */
    song.sel = 0; go_home(); frames(4);
    layer(B_FX, "layer-fx", "FX held: PUNCH-IN", "27 effects on the keys");
    layer(B_SEQ, "layer-seq", "SEQ held: STEPS", "the steps on the white keys");
    layer(B_EDIT, "layer-edit", "EDIT held: ERASE", "a key erases; OCT- / OCT+ undo / redo");
    layer(B_ARP, "layer-arp", "ARP held: ROLL", "a key rolls; KNOB 1 the rate");
    layer(B_SCL, "layer-scl", "SEL held: KEY", "a key sets the song's key");
    layer(B_GLO, "layer-glo", "GLO held: MIX", "mute, solo, fill, tap tempo");
    layer(B_SAVE, "layer-save", "SAVE held: SONG", "sections A-D: play / store");
    song.sel = 3; go_home(); frames(4);
    layer(B_SEQ, "layer-seq-drum", "SEQ held (drum track)", "the sound played last on the keys");
    song.sel = 0; go_home(); frames(4);

    /* REC */
    transport_req = 2; frames(4);
    song.playing = 0; song.rec = 0; rec_wait = 0;
    tap(B_REC); frames(4); put("rec", "rec-armed", "REC: armed", "the first note starts the loop");
    tap(B_REC); frames(4);
    {
        static track_t keep[NTRK];
        memcpy(keep, trk, sizeof keep);
        for (i = 0; i < NTRK; i++) steps_clear(&trk[i]);
        rec_tempo = 0; rec_count = 0;
        rec_wait = 1; frames(4); put("rec", "rec-free", "REC: free", "an empty project: no tempo, no grid");
        rec_tempo = 1; frames(4); put("rec", "rec-tempo", "REC: tempo", "recorded at the tempo set");
        rec_count = 1; frames(4); put("rec", "rec-count-in", "REC: count-in", "after a bar's count-in");
        rec_wait = 0; rec_tempo = 0; rec_count = 0;
        memcpy(trk, keep, sizeof keep);
    }
    go_home(); frames(4);
    press(B_REC); frames(50); put("rec", "rec-hold-clear", "REC held: CLEAR", "the ring: held to the end, cleared");
    fm1_in.buttons &= ~BT(B_REC); edges_btn = 0; frames(1);
    if (ui.hold_kind) { ui.hold_kind = 0; }
    frames(4);
    transport_req = 1; frames(30);

    /* NOTES: a note's sheet */
    song.sel = 0; go_home(); frames(2);
    open_page(FAM_SEQ, "NOTES"); cursor_set(0); frames(4);
    press(B_OCTUP); frames(30); release(B_OCTUP); frames(2);
    put("pages", "seq-notes-sheet", "SEQ > NOTES: a note's sheet", "OCT+ held");
    ui.sheet = 0;

    /* the menu (HOME held): its five sections and ABOUT */
    go_home(); frames(2);
    {
        static const char *const SEC[MS_COUNT][2] = {{"menu-screen", "MENU: SCREEN"}, {"menu-lights", "MENU: LIGHTS"},
                                                     {"menu-audio", "MENU: AUDIO"}, {"menu-seq", "MENU: SEQ"},
                                                     {"menu-system", "MENU: SYSTEM"}};
        for (i = 0; i < MS_COUNT; i++) {
            ui.menu = 1; ui.menu_sel = MS_FIRST[i]; ui.force = 1; frames(30);
            ui.msg_t = 0; ppm(SEC[i][0]);
            fprintf(idx, "system\t%s\t%s\tHOME held; SELECT the section\n", SEC[i][0], SEC[i][1]);
        }
        ui.menu = 2; ui.force = 1; frames(30); ppm("menu-about");
        fprintf(idx, "system\tmenu-about\tABOUT\tthe version, the credits\n");
        ui.menu = 0; ui.force = 1; frames(4);
    }

    /* the visualiser */
    song.sel = 0; go_home(); frames(4);
    for (i = 0; i < 6u; i++) {
        vis_style = VIS[i].style;
        vis_open();
        frames(40);
        vis_name_t = 0;
        snprintf(line, sizeof line, "the visualiser, style %u of 6", (unsigned)i + 1u);
        put("visualiser", VIS[i].name, VIS[i].title, line);
        go_home();
        frames(2);
    }
    fclose(idx);
    return 0;
}
