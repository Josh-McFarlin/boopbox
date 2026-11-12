// SPDX-License-Identifier: GPL-3.0-only
import { CMD, Link, fm1Ports, parse, req } from "../editor/lib/proto.js";
import config from "../../../shared/room-config.json";
import { parseKeyboardMessage } from "./keyboard-midi.js";
export { parseKeyboardMessage } from "./keyboard-midi.js";

function cleanVoice(dump) {
  if (dump.engine === config.engineNames.length) {
    const kit = dump.p[63];
    return config.shareableDrumKits.includes(kit) ? { engine: dump.engine, kit } : null;
  }
  if (dump.engine < 0 || dump.engine >= config.presetCounts.length || dump.engine === 4) return null;
  if (dump.preset < 0 || dump.preset >= config.presetCounts[dump.engine]) return null;
  return { engine: dump.engine, preset: dump.preset };
}

export async function connectFm1(onNote, onState) {
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
    let disconnected = false;
    const inputHandler = (event) => {
      const data = event.data;
      if (!data?.length) return;
      if (data[0] === 0xf0) {
        link.receive(data);
        return;
      }
      const note = parseKeyboardMessage(data);
      if (note) onNote(note.note, note.on, note.velocity);
    };
    pair.input.onmidimessage = inputHandler;
    if (pair.input.open) await pair.input.open().catch(() => {});
    try {
      const info = parse[CMD.INFO](await link.request(req.info(), { retries: 1 }));
      if (info.ntrk < 8 || info.nengines < config.presetCounts.length) {
        throw new Error("This room needs current BoopBox firmware with eight tracks.");
      }
      const stateHandler = (event) => {
        if (event.port?.id === pair.input.id && event.port.state === "disconnected") disconnect();
      };
      const disconnect = () => {
        if (disconnected) return;
        disconnected = true;
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
          return voice;
        },
      };
    } catch (error) {
      pair.input.onmidimessage = null;
      link.close();
      if (error.message.includes("current BoopBox")) throw error;
    }
  }
  throw new Error("No connected MIDI device answered as an FM-1. Check the cable and try again.");
}
