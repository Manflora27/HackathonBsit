import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { BRUSH, CONTOUR, FIBER, GRAIN } from "./assets/textures";

const root = document.documentElement.style;
root.setProperty("--tex-grain", GRAIN);
root.setProperty("--tex-fiber", FIBER);
root.setProperty("--tex-contour", CONTOUR);
root.setProperty("--tex-brush", BRUSH);
import { startEngine } from "./engine/client";

startEngine(); // start loading Pyodide + SymPy immediately

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
