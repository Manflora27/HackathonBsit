// Browser side of the AI proxy (/api/*). Every call has a non-AI fallback,
// so the app keeps working offline or when the proxy is down.
import { misconceptions } from "../data";
import type { Lang } from "../types";
import { translate } from "../locales";

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

/** Job 5: one-line teaching suggestion from aggregate numbers only. */
export async function teacherInsight(input: { skill: string; count: number; classSize: number; lang: Lang }) {
  const r = await post<{ text: string }>("/api/ai", { op: "insight", ...input });
  if (r?.text) return { text: r.text, ai: true };
  const text = translate(input.lang, "teacher.insightFallback", { count: input.count, size: input.classSize, skill: input.skill });
  return { text, ai: false };
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

/** A starting-point check for one subject (GLM). Null offline or on failure; the caller falls back. */
export async function placementCheck(subject: string, grade: number | null, lang: Lang) {
  return post<{ grade: number; questions: PlacementQuestion[] }>("/api/ai", { op: "placement", subject, grade, lang }, 30_000);
}

// Spoken math -> typed notation. The tiered recognizer lives in ./speech:
// the browser's own speech recognition where available, otherwise a short
// clip transcribed on-device (works offline, in Firefox, in Capacitor).
// 18+ feature, see VoiceConsent.
export { canVoiceInput, startVoiceInput, getSpeechBackend, isNativePlatform, speechLang } from "./speech";
export type { SpeechBackend, VoiceCallbacks } from "./speech";

/** Read aloud with the device's own voice. No recordings, no third party. */
export async function readAloud(text: string, lang: Lang) {
  if (!("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  // No common device voice speaks Cebuano; the Filipino voice reads it closest.
  u.lang = lang === "en" ? "en-US" : "fil-PH";
  await new Promise<void>((resolve) => {
    u.onend = () => resolve();
    u.onerror = () => resolve();
    speechSynthesis.speak(u);
  });
}
