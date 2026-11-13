// SPDX-License-Identifier: GPL-3.0-only
// 14 · Power-on and other combinations.
import { B, Steps } from "../components/ui.jsx";
import { SPECIAL } from "../data/reference.js";

export default function Special() {
  return (
    <>
      <Steps items={SPECIAL} />
      <p className="m-0 mt-6 text-[15px]">Something wrong with a button or knob? Run the <B>hardware calibration</B> (hold HOME → SYSTEM). To reinstall or go back to the official
        firmware, use the <a href="../installer/" className="text-blue">installer</a>.</p>
    </>
  );
}
