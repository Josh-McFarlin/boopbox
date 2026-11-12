// SPDX-License-Identifier: GPL-3.0-only
import { CMD, Link, fm1Ports, parse, req } from "../editor/lib/proto.js";
import config from "../../../shared/room-config.json" with { type: "json" };
import { parseKeyboardMessage } from "./keyboard-midi.js";
export { parseKeyboardMessage } from "./keyboard-midi.js";

function cleanVoice(dump) {
  if (dump.engine === config.engineNames.length) {
    const kit = dump.p[63];
    return config.shareableDrumKits.includes(kit) ? { engine: dump.engine, kit } : null;
  }
  if (dump.engine < 0 || dump.engine >= config.presetCounts.length || dump.engine === 4) return null;
  if (dump.preset < 0 || dump.preset >= config.presetCounts[dump.engine]) return null;
  if (dump.engine === 9 && (dump.p[70] < 0 || dump.p[70] >= config.presetCounts[9])) return null;
  const allowlist = config.shareableParameters[dump.engine];
  if (!allowlist) return null;
  const params = {};
  for (const [id, [min, max]] of Object.entries(allowlist)) {
    const value = dump.p[Number(id)];
    if (Number.isSafeInteger(value) && value >= min && value <= max) params[id] = value;
  }
  return { engine: dump.engine, preset: dump.preset, params };
}

export async function connectFm1(onNote, onState, onParameter = () => {}) {
  if (!navigator.requestMIDIAccess) throw new Error("This browser does not support USB MIDI access.");
  let access;
  try {
    access = await navigator.requestMIDIAccess({ sysex: true });
  } catch {
    throw new Error("Allow MIDI access to connect the FM-1.");
  }
  const pairs = fm1Ports(access);
  if (!pairs.length) throw new Error("Connect the FM-1 with its USB MIDI cable, then try again.");

  for (const pair of pairs) {
    const link = new Link((data) => pair.output.send(data), { timeout: 400 });
    let sharedVoice = null;
    let keepalive = null;
    link.onPush = (frame) => {
      if (frame.cmd === CMD.RELOAD) {
        sharedVoice = null;
        return;
      }
      if (!sharedVoice) return;
      let change;
      if (frame.cmd === CMD.CHANGED) {
        change = parse[CMD.CHANGED](frame.a);
        if (change.scope !== 0) return;
      } else if (frame.cmd === CMD.TRACK_CHANGED) {
        change = parse[CMD.TRACK_CHANGED](frame.a);
        if (change.track !== sharedVoice.track) return;
      } else {
        return;
      }
      const range = config.shareableParameters[sharedVoice.engine]?.[change.id];
      if (!range || !Number.isSafeInteger(change.value) || change.value < range[0] || change.value > range[1]) return;
      sharedVoice.params[change.id] = change.value;
      onParameter(change.id, change.value);
    };
    let disconnected = false;
    const inputHandler = (event) => {
      const data = event.data;
      if (!data?.length) return;
      if (data[0] === 0xf0) {
        if (data.length <= 512) link.receive(data);
        return;
      }
      const note = parseKeyboardMessage(data);
      if (note) onNote(note.note, note.on, note.velocity);
    };
    pair.input.onmidimessage = inputHandler;
    if (pair.input.open) await pair.input.open().catch(() => {});
    try {
      const info = parse[CMD.INFO](await link.request(req.info(), { retries: 1 }));
      if (info.ntrk < 8 || info.nengines < config.presetCounts.length || info.pe0 !== 63 || info.pcount < 71) {
        throw new Error("This room needs current BoopBox firmware with eight tracks and supported sound controls.");
      }
      const watch = parse[CMD.WATCH](await link.request(req.watch(3), { retries: 1 }));
      if ((watch.on & 3) !== 3) {
        throw new Error("Update the FM-1 firmware to share live sound controls.");
      }
      keepalive = globalThis.setInterval(() => {
        if (!disconnected) link.request(req.ping(), { timeout: 300, retries: 0, quiet: true }).catch(() => {});
      }, 2000);
      const stateHandler = (event) => {
        if (event.port?.id === pair.input.id && event.port.state === "disconnected") disconnect();
      };
      const disconnect = () => {
        if (disconnected) return;
        disconnected = true;
        if (keepalive !== null) globalThis.clearInterval(keepalive);
        pair.input.onmidimessage = null;
        link.close();
        onState("disconnected");
      };
      access.onstatechange = stateHandler;
      onState("connected");
      return {
        input: pair.input,
        link,
        close() {
          if (access.onstatechange === stateHandler) access.onstatechange = null;
          disconnect();
        },
        async getSelectedVoice() {
          const selection = parse[CMD.TRACK](await link.request(req.track()));
          const dump = parse[CMD.TRACK_DUMP](await link.request(req.trackDump(selection.sel)), info);
          const voice = cleanVoice(dump);
          if (!voice) {
            throw new Error("Choose a built-in synth preset or a factory drum kit. User samples and custom presets cannot be shared.");
          }
          if (voice.engine !== config.engineNames.length) {
            sharedVoice = { engine: voice.engine, preset: voice.preset, track: selection.sel, params: { ...voice.params } };
          } else {
            sharedVoice = null;
          }
          return voice;
        },
      };
    } catch (error) {
      if (keepalive !== null) globalThis.clearInterval(keepalive);
      pair.input.onmidimessage = null;
      link.close();
      if (error.message.includes("current BoopBox")) throw error;
    }
  }
  throw new Error("No connected MIDI device answered as an FM-1. Check the cable and try again.");
}
