import { useRef, useState } from "react";
import { canVoiceInput, getSpeechBackend, startVoiceInput } from "../ai/client";
import { useStore } from "../store";
import { useT } from "../i18n";
import { Icon } from "./Icon";
import { ensureVoiceConsent } from "./VoiceConsent";

/**
 * Say a step or an answer. Tap to start, tap again to stop. The browser's
 * speech recognition writes it down where available; otherwise a short clip
 * is transcribed on this device (offline once the voice model is
 * downloaded). Typed math comes from our text model when online, from the
 * on-device formatter when not. 18+ only (see VoiceConsent); hidden where
 * the device can't listen at all.
 */
export function MicButton({ onText, label, className = "", testId }: { onText: (text: string) => void; label?: string; className?: string; testId?: string }) {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const [state, setState] = useState<"idle" | "listening" | "recording" | "writing">("idle");
  const [note, setNote] = useState<string | null>(null);
  const stop = useRef<null | (() => void)>(null);
  if (!canVoiceInput()) return null;

  async function tap() {
    setNote(null);
    if (state === "listening" || state === "recording") {
      stop.current?.();
      stop.current = null;
      setState("idle");
      return;
    }
    if (state !== "idle") return;
    if (!(await ensureVoiceConsent())) {
      setNote(useStore.getState().voiceAdult === false ? t("voice.adultsOnly") : t("voice.failed"));
      return;
    }
    // Local-fallback devices record a clip and transcribe it after the stop
    // tap; the web-speech path streams instead. Label accordingly up front.
    setState(getSpeechBackend() === "local" ? "recording" : "listening");
    stop.current = startVoiceInput(lang, {
      onSpeechEnd: () => setState("writing"),
      onStatus: (s) => setNote(s === "downloading" ? t("voice.downloading") : t("voice.transcribing")),
      onDone: (text) => {
        stop.current = null;
        setState("idle");
        if (text === null) setNote(t("voice.failed"));
        else if (!text) setNote(t("voice.noMath"));
        else onText(text);
      },
    });
  }

  const active = state === "listening" || state === "recording";
  const text =
    state === "listening" ? t("voice.listening") : state === "recording" ? t("voice.recording") : state === "writing" ? t("voice.writing") : label ?? t("voice.say");
  return (
    <span className="inline-flex flex-col">
      <button type="button" onClick={tap} disabled={state === "writing"} aria-pressed={active} data-testid={testId}
        className={`btn-ghost btn-sm ${active ? "!border-gap !text-gap-dark" : ""} ${className}`}>
        <span className="relative flex">
          <Icon name="mic" size={16} />
          {active && <span className="absolute -right-1 -top-1 h-2 w-2 animate-pulse rounded-full bg-gap" />}
        </span>
        {text}
      </button>
      {note && <span className="mt-1 text-[12px] text-gap-dark" role="status">{note}</span>}
    </span>
  );
}
