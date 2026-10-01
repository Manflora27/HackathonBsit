import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { create } from "zustand";
import { useT } from "../i18n";
import { useStore } from "../store";
import { Icon } from "./Icon";

/**
 * The 18+ gate for voice input. The feature uses the browser's speech
 * recognition where it can listen, otherwise a short clip transcribed
 * on-device (see src/ai/speech.ts) — but it stays adults-only: speaking
 * sends audio through the browser's speech service or the transcript
 * through our text model, which is more than we ask of minors.
 * Asked once, the first time a voice feature is tapped; changeable in Settings.
 */
const useAsk = create<{ resolve: ((ok: boolean) => void) | null }>(() => ({ resolve: null }));

/** Resolves true when voice input may run. Opens the 18+ notice if the learner hasn't decided yet. */
export function ensureVoiceConsent(): Promise<boolean> {
  const s = useStore.getState();
  if (s.voiceAdult === false) return Promise.resolve(false);
  if (s.voiceAdult === true) {
    if (s.voiceAi === null) s.set({ voiceAi: true });
    return Promise.resolve(s.voiceAi !== false);
  }
  return new Promise((resolve) => useAsk.setState({ resolve }));
}

export function VoiceConsentSheet() {
  const resolve = useAsk((s) => s.resolve);
  const set = useStore((s) => s.set);
  const t = useT();
  const answer = (adult: boolean) => {
    set({ voiceAdult: adult, voiceAi: adult });
    resolve?.(adult);
    useAsk.setState({ resolve: null });
  };
  // Portaled to <body> so it sits above everything, including the fixed math keypad.
  return createPortal(
    <AnimatePresence>
      {resolve && (
        <motion.div className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/30 px-3 pb-[max(env(safe-area-inset-bottom),12px)]"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => answer(false)}>
          <motion.div role="dialog" aria-modal="true" aria-labelledby="voice-title" className="card w-full max-w-md !p-5"
            initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} onClick={(e) => e.stopPropagation()} data-testid="voice-consent">
            <div className="flex items-center gap-2 text-gap-dark"><Icon name="speaker" size={18} /><span className="kicker">18+</span></div>
            <h2 id="voice-title" className="mt-1 text-[24px] leading-tight">{t("voice.consentTitle")}</h2>
            <p className="mt-3 text-[15px] leading-snug">{t("voice.consentWhat")}</p>
            <p className="mt-2 text-[15px] leading-snug">{t("voice.consentPrivacy")}</p>
            <p className="mt-2 text-[14px] leading-snug text-muted">{t("voice.consentWithout")}</p>
            <div className="mt-5 flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => answer(false)} data-testid="voice-decline">{t("voice.under18")}</button>
              <button className="btn-primary flex-1" onClick={() => answer(true)} data-testid="voice-allow">{t("voice.allow")}</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
