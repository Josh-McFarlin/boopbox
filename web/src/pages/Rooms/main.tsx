// SPDX-License-Identifier: GPL-3.0-only
import { createRoot } from "react-dom/client";
import Rooms from "./index.tsx";
import "../../styles/site.css";

createRoot(document.getElementById("root")!).render(<Rooms />);
