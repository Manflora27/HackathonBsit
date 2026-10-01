import type { Lang } from "../types";
import { formatMathLocally } from "./localMath";
import { transcribeLocal, type LocalSpeechStatus } from "./whisper";

// Tiered speech-to-text, one signature for web + Capacitor:
//   1. Web Speech API where the browser has it (instant, zero bundle).
//   2. Otherwise record a short clip and transcribe on-device with a local
//      Whisper model (works in Firefox, in Capacitor WebViews, and offline
//      once the model was downloaded).
//
// Transcript -> typed math prefers the server (/api/voice) when online and
// falls back to formatMathLocally, so voice keeps working with no connection.
//
// Capacitor notes: Android WebViews need RECORD_AUDIO in the manifest and iOS
// needs NSMicrophoneUsageDescription (see capacitor.config.ts / README); the
// code path is identical. If a WebView ever blocks getUserMedia, this module
// has a single seam to swap in: replace recordClip() with
// @capacitor/voice-recorder (request permission, start/stop, base64 -> Blob).

export type SpeechBackend = "web-speech" | "local" | "none";

export interface VoiceCallbacks {
  onSpeechEnd?: () => void;
  onStatus?: (s: LocalSpeechStatus) => void;
  onDone: (text: string | null) => void;
}

type SpeechEvent = { results: { [i: number]: { [j: number]: { transcript: string } } } };
type SpeechRec = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechEvent) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function SpeechCtor(): (new () => SpeechRec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function hasRecorder(): boolean {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") return false;
  return !!navigator.mediaDevices?.getUserMedia;
}

/** True inside the Capacitor native shell (vs. a plain mobile browser). */
export function isNativePlatform(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const c = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    return c?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

export function getSpeechBackend(): SpeechBackend {
  if (SpeechCtor() !== null) return "web-speech";
  if (hasRecorder()) return "local";
  return "none";
}

/** True when this device can listen at all (browser STT or local fallback). */
export const canVoiceInput = () => getSpeechBackend() !== "none";

async function post<T>(path: string, body: unknown, timeoutMs = 9000): Promise<T | null> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return null;
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

/** Transcript -> typed math. Server first when online, on-device otherwise. */
async function formatTranscript(heard: string): Promise<string> {
  const r = await post<{ text: string }>("/api/voice", { text: heard });
  if (r) return r.text;
  return formatMathLocally(heard);
}

export function speechLang(lang: Lang): string {
  // No common device model speaks Cebuano; Filipino is closest.
  return lang === "en" ? "en-US" : "fil-PH";
}

function startWebSpeech(lang: Lang, cb: VoiceCallbacks): () => void {
  const Ctor = SpeechCtor();
  if (!Ctor) {
    cb.onDone(null);
    return () => {};
  }
  const rec = new Ctor();
  rec.lang = speechLang(lang);
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  let heard = "";
  let settled = false;
  const finish = (text: string | null) => {
    if (settled) return;
    settled = true;
    cb.onDone(text);
  };
  rec.onresult = (e) => {
    heard = e.results?.[0]?.[0]?.transcript?.trim() ?? heard;
  };
  rec.onerror = () => finish(null);
  rec.onend = async () => {
    cb.onSpeechEnd?.();
    if (!heard) return finish("");
    finish(await formatTranscript(heard));
  };
  try {
    rec.start();
  } catch {
    finish(null);
    return () => {};
  }
  return () => {
    try {
      rec.stop();
    } catch {
      /* already stopped */
    }
  };
}

function pickMime(): string | undefined {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const m of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch {
      /* try next */
    }
  }
  return undefined;
}

// 60s cap so a forgotten recording can't fill storage, on web or native.
const MAX_RECORD_MS = 60_000;

function startLocalRecording(lang: Lang, cb: VoiceCallbacks): () => void {
  let settled = false;
  let recorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let capTimer: ReturnType<typeof setTimeout> | null = null;
  const finish = (text: string | null) => {
    if (settled) return;
    settled = true;
    if (capTimer) clearTimeout(capTimer);
    stream?.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {
        /* already stopped */
      }
    });
    stream = null;
    cb.onDone(text);
  };
  const stopFn = () => {
    if (settled || !recorder || recorder.state === "inactive") return;
    cb.onSpeechEnd?.();
    try {
      recorder.stop();
    } catch {
      finish(null);
    }
  };
  (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      finish(null); // mic blocked: caller shows the typed-instead note
      return;
    }
    if (settled) return;
    const chunks: Blob[] = [];
    try {
      recorder = new MediaRecorder(stream, pickMime() ? { mimeType: pickMime() } : undefined);
    } catch {
      finish(null);
      return;
    }
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    recorder.onerror = () => finish(null);
    recorder.onstop = async () => {
      if (settled) return;
      try {
        const blob = new Blob(chunks, { type: recorder?.mimeType || "audio/webm" });
        if (blob.size === 0) return finish("");
        const heard = await transcribeLocal(blob, lang, cb.onStatus);
        if (!heard) return finish("");
        finish(await formatTranscript(heard));
      } catch {
        finish(null);
      }
    };
    recorder.start();
    capTimer = setTimeout(stopFn, MAX_RECORD_MS);
  })();
  return stopFn;
}

/**
 * Starts listening. Returns a stop function. `onSpeechEnd` fires when the
 * learner stops talking, `onDone` with the typed math: "" for no math,
 * null when nothing could be heard.
 */
export function startVoiceInput(lang: Lang, cb: VoiceCallbacks): () => void {
  if (SpeechCtor() !== null) return startWebSpeech(lang, cb);
  if (hasRecorder()) return startLocalRecording(lang, cb);
  cb.onDone(null);
  return () => {};
}
