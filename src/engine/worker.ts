/// <reference lib="webworker" />
// Runs the Python engine (engine/gapfinder.py) in Pyodide, off the UI thread.
import engineSource from "../../engine/gapfinder.py?raw";

type PyRun = (payload: string) => string;
let run: PyRun | null = null;

async function boot() {
  const base = new URL(import.meta.env.BASE_URL + "pyodide/", self.location.origin).href;
  const { loadPyodide } = await import(/* @vite-ignore */ base + "pyodide.mjs");
  const py = await loadPyodide({ indexURL: base });
  await py.loadPackage(["sympy"]);
  py.FS.writeFile("/home/pyodide/gapfinder.py", engineSource);
  py.runPython("import sys; sys.path.insert(0, '/home/pyodide')");
  run = py.pyimport("gapfinder").run as PyRun;
  // warm the parser/solver so the first real request is fast
  run(JSON.stringify({ op: "analyze", problem: "(x+1)^2=4", steps: ["x+1=2"] }));
}

const ready = boot();

self.onmessage = async (e: MessageEvent<{ id: number; payload: unknown }>) => {
  const { id, payload } = e.data;
  try {
    await ready;
    const out = JSON.parse(run!(JSON.stringify(payload)));
    self.postMessage({ id, ok: true, result: out });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err) });
  }
};

ready.then(
  () => self.postMessage({ id: -1, ok: true, result: "ready" }),
  (err) => self.postMessage({ id: -1, ok: false, error: String(err) }),
);
