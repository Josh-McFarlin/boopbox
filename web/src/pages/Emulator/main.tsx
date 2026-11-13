// SPDX-License-Identifier: GPL-3.0-only
import { createRoot } from "react-dom/client";
import "./emu.css";
import Emulator from "./index.tsx";

createRoot(document.getElementById("root")).render(<Emulator />);
