import type { Lang } from "../types";

// Truly on-device speech-to-text for the offline fallback (and for browsers /
// WebViews with no SpeechRecognition, e.g. Firefox and Capacitor shells).
// The model loads lazily on first use only, so the main bundle stays small;
// progress is reported so the UI can say "getting the offline voice ready".
//
// Model: Xenova/whisper-tiny (~75MB, multilingual). English-only
// "Xenova/whisper-tiny.en" is smaller/faster if you drop the Filipino path.
// Whisper has no Tagalog/Cebuano output head, so non-English uses
// auto-detect; the transcript is then mapped by localMath, which does know
// those number words.

export const WHISPER_MODEL_ID = "Xenova/whisper-tiny";

export type LocalSpeechStatus = "downloading" | "transcribing";

type Transcriber = (audio: Float32Array, options?: Record<string, unknown>) => Promise<{ text: string }>;

let modelPromise: Promise<Transcriber> | null = null;
let modelReady = false;

/** True once the model finished loading and later clips transcribe instantly. */
export function isLocalVoiceReady(): boolean {
  return modelReady;
}

function loadModel(onStatus?: (s: LocalSpeechStatus) => void): Promise<Transcriber> {
  if (!modelPromise) {
    modelPromise = (async () => {
      const { pipeline } = await import("@huggingface/transformers");
      const pipe = (await pipeline("automatic-speech-recognition", WHISPER_MODEL_ID, {
        device: "wasm",
        progress_callback: (p: { status?: string }) => {
          if (p && typeof p.status === "string" && p.status !== "ready") onStatus?.("downloading");
        },
      })) as unknown as Transcriber;
      modelReady = true;
      return pipe;
    })();
    // Let a failed load retry next time instead of sticking forever.
    modelPromise.catch(() => {
      modelPromise = null;
    });
  }
  return modelPromise;
}

/** Warm the model (e.g. from Settings, on Wi-Fi) so later clips are instant. */
export async function preloadLocalVoice(onStatus?: (s: LocalSpeechStatus) => void): Promise<void> {
  await loadModel(onStatus);
}

/** MediaRecorder output (webm/opus, mp4, …) -> 16kHz mono PCM for Whisper. */
async function blobToPcm16k(blob: Blob): Promise<Float32Array> {
  const raw = await blob.arrayBuffer();
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) throw new Error("no audio decoder");
  const ctx = new Ctor();
  try {
    const decoded = await ctx.decodeAudioData(raw.slice(0));
    const rate = decoded.sampleRate;
    const n = decoded.numberOfChannels;
    const len = decoded.length;
    const mono = new Float32Array(len);
    for (let c = 0; c < n; c++) {
      const ch = decoded.getChannelData(c);
      for (let i = 0; i < len; i++) mono[i] += ch[i] / n;
    }
    if (rate === 16000) return mono;
    const outLen = Math.floor((len * 16000) / rate);
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const pos = (i * rate) / 16000;
      const i0 = Math.floor(pos);
      const i1 = Math.min(i0 + 1, len - 1);
      out[i] = mono[i0] + (mono[i1] - mono[i0]) * (pos - i0);
    }
    return out;
  } finally {
    await ctx.close().catch(() => {});
  }
}

export async function transcribeLocal(blob: Blob, lang: Lang, onStatus?: (s: LocalSpeechStatus) => void): Promise<string> {
  onStatus?.("downloading");
  const pipe = await loadModel(onStatus);
  const pcm = await blobToPcm16k(blob);
  if (pcm.length < 1600) return ""; // <0.1s: nothing was said
  onStatus?.("transcribing");
  const out = await pipe(pcm, {
    task: "transcribe",
    chunk_length_s: 30,
    stride_length_s: 5,
    // Whisper has no Filipino head: English gets a hint, others auto-detect.
    ...(lang === "en" ? { language: "english" } : {}),
  });
  return (out?.text ?? "").trim();
}
