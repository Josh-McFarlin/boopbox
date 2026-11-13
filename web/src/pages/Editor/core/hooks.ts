// SPDX-License-Identifier: GPL-3.0-only
// What the core (device.js) asks of the pages, without importing them: each page's logic module fills its entries in
// when it loads (Object.assign(H, {...})). The defaults do nothing, so the core works whatever pages there are.
export const H = {
  /* library (pages/library): adopt the device's parameter layout for the stored patches */
  libAdopt: async (/* dev */) => {},
  /* tracks (pages/tracks): the mixer strips */
  readMixer: async () => {},            /* TRACK for each track -> dev.mix */
  mixFromDump: () => {},                /* the selected track's strip from its DUMP */
  mixTouched: (/* kind, i */) => false, /* the user is moving that strip's control */
  updateStrip: (/* i */) => {},
  panning: () => false,                 /* another track selected for a moment (v3 pan): its pushes are not ours */
  /* FM6 (pages/sound): the patch of a track that plays FM6 */
  fm6Names: (/* dev */) => {},
  fm6Follow: async () => {},
  fm6Later: () => {},
  fm6On: () => false,
  /* sequencer: the nudges / locks / fill of the selected track after a STEP_CHANGED push */
  refreshLocks: async () => {},
  /* LIVE: pushes while it shows */
  livePush: (/* frame */) => {},
  /* local preview (?mock=1): stop the browser audio on disconnect, the mock changed */
  stopPreview: () => {},
  previewChanged: (/* cmd, args */) => {},
};
