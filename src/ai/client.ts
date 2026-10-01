// Browser side of the AI proxy (/api/*). Every call has a non-AI fallback,
// so the app keeps working offline or when the proxy is down.
import { misconceptions } from "../data";
import type { Lang } from "../types";

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
  const text = input.lang === "fil"
    ? `${input.count} sa ${input.classSize} ang kulang sa "${input.skill}". Mungkahi: 10-minutong mini-lesson gamit ang area model, tapos 3 practice item bago ang susunod na quiz.`
    : `${input.count} of ${input.classSize} students are missing "${input.skill}". Suggestion: a 10-minute mini-lesson with the area model, then 3 practice items before the next quiz.`;
  return { text, ai: false };
}

const audioCache = new Map<string, string>();

/** Read aloud: OpenRouter TTS through the proxy, falling back to the device voice. */
export async function readAloud(text: string, lang: Lang) {
  const key = `${lang}:${text}`;
  let url = audioCache.get(key);
  if (!url && navigator.onLine) {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, lang }),
      });
      if (res.ok && res.headers.get("content-type")?.includes("audio")) {
        url = URL.createObjectURL(await res.blob());
        audioCache.set(key, url);
      }
    } catch {
      /* fall through to device voice */
    }
  }
  if (url) {
    const audio = new Audio(url);
    await audio.play().catch(() => {});
    await new Promise((r) => (audio.onended = r));
    return;
  }
  if ("speechSynthesis" in window) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === "fil" ? "fil-PH" : "en-US";
    await new Promise<void>((resolve) => {
      u.onend = () => resolve();
      u.onerror = () => resolve();
      speechSynthesis.speak(u);
    });
  }
}
