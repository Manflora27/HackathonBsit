import { TextToSpeech } from "@capacitor-community/text-to-speech";
import type { Lang } from "../types";
import { isNativePlatform } from "./speech";

// Read aloud with the device's own voice: no recordings, no third party, works offline.
//   - Android app: the system text-to-speech engine, through @capacitor-community/text-to-speech
//     (the WebView has no speechSynthesis, so Web Speech alone stays silent there).
//   - Browsers: Web Speech (speechSynthesis), preferring voices that run on the device.
// No common device voice speaks Cebuano; Filipino reads it closest, and when the device has no
// Filipino voice either, an English voice reads it rather than nothing.

export interface ReadAloudResult {
  /** done = read to the end; stopped = stopReadAloud() or a newer readAloud(); no-voice = nothing could speak. */
  outcome: "done" | "stopped" | "no-voice";
}

export interface ReadAloudCallbacks {
  /** Fires once a voice is chosen, just before it starts talking. */
  onStart?: (info: { englishFallback: boolean }) => void;
}

let session = 0;
let interrupt: (() => void) | null = null;

/** Stops whatever is being read. Safe to call any time. */
export function stopReadAloud() {
  session++;
  if (!interrupt) return; // nothing reading
  interrupt();
  interrupt = null;
  if (isNativePlatform()) void TextToSpeech.stop().catch(() => {});
  else if (hasWebSpeech()) speechSynthesis.cancel();
}

/** Reads `text` aloud, stopping anything already reading. Resolves when it ends, is stopped, or can't speak. */
export async function readAloud(text: string, lang: Lang, cb: ReadAloudCallbacks = {}): Promise<ReadAloudResult> {
  stopReadAloud();
  const id = session;
  const stopped = new Promise<"stopped">((resolve) => { interrupt = () => resolve("stopped"); });
  const chunks = sentences(text);
  if (!chunks.length) return { outcome: "done" };
  try {
    return isNativePlatform() ? await readNative(chunks, lang, id, stopped, cb) : await readWeb(chunks, lang, id, stopped, cb);
  } catch {
    // An engine that throws can't read here; say so instead of leaving the button stuck on Stop.
    if (id === session) stopReadAloud();
    return { outcome: "no-voice" };
  } finally {
    if (id === session) interrupt = null;
  }
}

/**
 * One sentence per utterance: Chrome goes quiet partway through a long utterance, and short
 * pieces let Stop take effect at once on every engine.
 */
function sentences(text: string): string[] {
  const out: string[] = [];
  for (const s of text.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s+/)) {
    if (s.length <= 220) { if (s) out.push(s); continue; }
    let cur = "";
    for (const part of s.split(/(?<=[,;:])\s+/)) {
      if (cur && cur.length + part.length > 220) { out.push(cur); cur = ""; }
      cur = cur ? `${cur} ${part}` : part;
    }
    if (cur) out.push(cur);
  }
  return out;
}

const WANT: Record<Lang, string[]> = { en: ["en-US", "en-GB", "en"], tl: ["fil-PH", "fil", "tl-PH", "tl"], ceb: ["fil-PH", "fil", "tl-PH", "tl"] };

// --- Android (Capacitor) -------------------------------------------------------------------------

async function nativeLang(lang: Lang): Promise<{ tag: string; englishFallback: boolean } | null> {
  const supported = (tag: string) => TextToSpeech.isLanguageSupported({ lang: tag }).then((r) => r.supported, () => false);
  for (const tag of WANT[lang]) if (await supported(tag)) return { tag, englishFallback: false };
  if (lang !== "en") for (const tag of WANT.en) if (await supported(tag)) return { tag, englishFallback: true };
  return null;
}

async function readNative(chunks: string[], lang: Lang, id: number, stopped: Promise<"stopped">, cb: ReadAloudCallbacks): Promise<ReadAloudResult> {
  const voice = await nativeLang(lang);
  if (id !== session) return { outcome: "stopped" };
  if (!voice) return { outcome: "no-voice" };
  cb.onStart?.({ englishFallback: voice.englishFallback });
  for (const chunk of chunks) {
    // stop() never settles a pending speak() on Android, so race it against our own stop signal.
    const r = await Promise.race([
      TextToSpeech.speak({ text: chunk, lang: voice.tag, rate: 0.95, category: "playback" }).then(() => "ok" as const, () => "error" as const),
      stopped,
    ]);
    if (r === "stopped" || id !== session) return { outcome: "stopped" };
    if (r === "error") return { outcome: "no-voice" };
  }
  return { outcome: "done" };
}

// --- Browsers (Web Speech) -----------------------------------------------------------------------

function hasWebSpeech() {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

// Voices load in the background on first ask; asking now means they're ready by the first tap,
// so speak() still runs inside the tap (iOS Safari only speaks from a user gesture).
if (hasWebSpeech()) speechSynthesis.getVoices();

function webVoices(): Promise<SpeechSynthesisVoice[]> {
  const now = speechSynthesis.getVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => resolve(speechSynthesis.getVoices());
    speechSynthesis.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, 1500);
  });
}

function pickWebVoice(voices: SpeechSynthesisVoice[], lang: Lang): { voice: SpeechSynthesisVoice; englishFallback: boolean } | null {
  const norm = (l: string) => l.toLowerCase().replace(/_/g, "-");
  const find = (tags: string[]) => {
    for (const tag of tags.map(norm)) {
      const hits = voices.filter((v) => norm(v.lang) === tag || norm(v.lang).startsWith(`${tag}-`));
      // On-device voices first: the network ones (e.g. Chrome's "Google ...") fail offline.
      const best = hits.find((v) => v.localService && v.default) ?? hits.find((v) => v.localService) ?? hits[0];
      if (best) return best;
    }
    return null;
  };
  const own = find(WANT[lang]);
  if (own) return { voice: own, englishFallback: false };
  const en = lang !== "en" ? find(WANT.en) : null;
  return en ? { voice: en, englishFallback: true } : null;
}

async function readWeb(chunks: string[], lang: Lang, id: number, stopped: Promise<"stopped">, cb: ReadAloudCallbacks): Promise<ReadAloudResult> {
  if (!hasWebSpeech()) return { outcome: "no-voice" };
  const voices = await webVoices();
  if (id !== session) return { outcome: "stopped" };
  const pick = pickWebVoice(voices, lang);
  if (!pick) return { outcome: "no-voice" };
  cb.onStart?.({ englishFallback: pick.englishFallback });
  speechSynthesis.cancel();
  speechSynthesis.resume(); // Chrome can be left paused by an earlier page; speak() then queues silently.
  let spoke = false;
  for (const chunk of chunks) {
    const u = new SpeechSynthesisUtterance(chunk);
    u.voice = pick.voice;
    u.lang = pick.voice.lang;
    u.rate = 0.95;
    const r = await Promise.race([
      new Promise<"ok" | "error">((resolve) => {
        u.onstart = () => { spoke = true; };
        u.onend = () => resolve("ok");
        u.onerror = (e) => resolve(e.error === "interrupted" || e.error === "canceled" ? "ok" : "error");
        speechSynthesis.speak(u);
      }),
      stopped,
    ]);
    if (r === "stopped" || id !== session) return { outcome: "stopped" };
    // A voice that fails before saying anything means this device can't read; later failures just end early.
    if (r === "error") return { outcome: spoke ? "done" : "no-voice" };
  }
  return { outcome: "done" };
}
