import type { Analysis, CheckResult, Form } from "../types";

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();
let readyState: "loading" | "ready" | "failed" = "loading";
const listeners = new Set<(s: typeof readyState) => void>();

function setState(s: typeof readyState) {
  readyState = s;
  listeners.forEach((fn) => fn(s));
}

export function startEngine() {
  if (worker) return;
  worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (e) => {
    const { id, ok, result, error } = e.data;
    if (id === -1) return setState(ok ? "ready" : "failed");
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    if (ok) p.resolve(result);
    else p.reject(new Error(error));
  };
}

export function engineState() {
  return readyState;
}

export function onEngineState(fn: (s: typeof readyState) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function call<T>(payload: Record<string, unknown>): Promise<T> {
  startEngine();
  const id = nextId++;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    worker!.postMessage({ id, payload });
  });
}

export const engine = {
  analyze: (problem: string, steps: string[], kind: "solve" | "simplify" = "solve") =>
    call<Analysis>({ op: "analyze", problem, steps, kind }),
  check: (expected: string, answer: string, form: Form = "any") =>
    call<CheckResult>({ op: "check", expected, answer, form }),
  preview: (text: string) => call<{ ok: boolean; latex?: string; error?: string }>({ op: "preview", text }),
  solve: (problem: string) => call<{ ok: boolean; answer?: string }>({ op: "solve", problem }),
};
