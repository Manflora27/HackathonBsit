// Browser side of the AI proxy (/api/*). Every call has a non-AI fallback,
// so the app keeps working offline or when the proxy is down.
import { misconceptions } from "../data";
import type { Lang } from "../types";

import { readStream } from "./stream";

async function post<T>(path: string, body: unknown, timeoutMs = 9000): Promise<T | null> {
  if (!navigator.onLine) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Job 2: classify an error no buggy rule matched, against the closed misconception list. */
export async function classifyWithAi(input: {
  problem: string;
  previous: string;
  wrong: string;
  wrongTerms: { missing: string[]; extra: string[] } | null;
}): Promise<{ id: string | null; confidence: number } | null> {
  const r = await post<{ id: string | null; confidence: number }>("/api/ai", {
    op: "classify",
    ...input,
    candidates: misconceptions.map((m) => ({ id: m.id, title: m.title })),
  });
  if (!r) return null;
  const valid = r.id === null || misconceptions.some((m) => m.id === r.id);
  return valid ? r : null;
}

/** Photo of handwritten work -> typed lines (GLM vision). Mistakes are copied as written. */
export async function readWork(image: string): Promise<{ problem: string; steps: string[] } | null> {
  return post<{ problem: string; steps: string[] }>("/api/ai", { op: "read-work", image }, 30_000);
}

export interface PlacementQuestion {
  unitId: string;
  level: "current" | "foundation";
  kind: "typed" | "choice";
  prompt: string;
  given: string;
  expected: string;
  form: "any" | "expanded" | "factored" | "solved";
  choices: string[];
  answer: number;
}

/**
 * A starting-point check for one subject (text model), streamed: `onItems` gets the questions written so far
 * each time more arrive. With `final` false the last one may still be half-written. False offline, on error,
 * or after 20s without any sign of life; the caller falls back.
 */
export async function placementStream(subject: string, grade: number | null, lang: Lang, signal: AbortSignal,
  onItems: (items: PlacementQuestion[], final: boolean) => void): Promise<boolean> {
  if (!navigator.onLine) return false;
  const ctrl = new AbortController();
  signal.addEventListener("abort", () => ctrl.abort());
  let timer = setTimeout(() => ctrl.abort(), 20_000);
  let items: PlacementQuestion[] = [];
  try {
    const res = await fetch("/api/ai", {
      method: "POST", headers: { "content-type": "application/json" }, signal: ctrl.signal,
      body: JSON.stringify({ op: "placement", subject, grade, lang, stream: true }),
    });
    const done = await readStream(res, (soFar) => {
      items = ((soFar as { questions?: PlacementQuestion[] })?.questions ?? []).filter(Boolean);
      onItems(items, false);
    }, () => {
      // Reasoning pings count: medium reasoning can think 10-30s before the first question.
      clearTimeout(timer);
      timer = setTimeout(() => ctrl.abort(), 20_000);
    });
    if (done) onItems(items, true);
    return !!done;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// Spoken math -> typed notation. The tiered recognizer lives in ./speech:
// the browser's own speech recognition where available, otherwise a short
// clip transcribed on-device (works offline, in Firefox, in Capacitor).
// 18+ feature, see VoiceConsent.
export { canVoiceInput, startVoiceInput, getSpeechBackend, isNativePlatform, speechLang } from "./speech";
export type { SpeechBackend, VoiceCallbacks } from "./speech";

// Read aloud with the device's own voice (native TTS in the app, Web Speech in browsers).
export { readAloud, stopReadAloud } from "./tts";
export type { ReadAloudResult } from "./tts";

/** What the homework helper says about one question (api/ai.ts help). Fields fill in as it streams. */
export interface HelpAnswer {
  restate: string;
  subject: string;
  unitId: string;
  verdict: "correct" | "partly" | "incorrect" | "no_attempt";
  feedback: string;
  hint: string;
  steps: string[];
  answer: string;
  checkQuestion: string;
}

/**
 * Ask the homework helper about a question in any subject, streamed: `onPartial` gets the answer as it's written.
 * Sent: the question, the learner's attempt, their subjects, grade and language. Null offline, on error, or
 * after 30s without any sign of life.
 */
export async function askHelp(input: { question: string; work: string[]; subjects: string[]; grade: number | null; lang: Lang }, signal: AbortSignal,
  onPartial: (soFar: Partial<HelpAnswer>) => void): Promise<HelpAnswer | null> {
  if (!navigator.onLine) return null;
  const ctrl = new AbortController();
  signal.addEventListener("abort", () => ctrl.abort());
  let timer = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const res = await fetch("/api/ai", {
      method: "POST", headers: { "content-type": "application/json" }, signal: ctrl.signal,
      body: JSON.stringify({ op: "help", stream: true, ...input }),
    });
    return await readStream<HelpAnswer>(res, (soFar) => onPartial((soFar ?? {}) as Partial<HelpAnswer>), () => {
      clearTimeout(timer);
      timer = setTimeout(() => ctrl.abort(), 30_000);
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** A photo of a question in any subject -> its text and the learner's own working. Null on failure. */
export async function readQuestion(image: string): Promise<{ question: string; work: string[] } | null> {
  return post<{ question: string; work: string[] }>("/api/ai", { op: "read-question", image }, 30_000);
}

