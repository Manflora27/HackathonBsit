import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { engine } from "../engine/client";
import { checkPractice } from "../lessons/pipeline";
import { useT } from "../i18n";
import { useStore } from "../store";
import type { Lesson } from "../types";
import { Icon } from "./Icon";
import { Math, RichText, quickTex } from "./Math";
import { MicButton } from "./MicButton";

type Item = Lesson["practice"][number];

const XP_RIGHT = 10;
const XP_COMBO = 5;
export const XP_DONE = 25;

/** Words in `given` (beyond function names like sqrt, sin) mean it isn't math to typeset. */
const FUNCS = /^(sqrt|sin|cos|tan|log|ln|exp|abs|pi|mean|median|mode|diff|integrate|limit|min|max)$/i;
const hasWords = (s: string) => (s.match(/[A-Za-z]{3,}/g) ?? []).some((w) => !FUNCS.test(w));
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9=+\-*/^()]/g, "");

/** The task: the prompt as a sentence on its own line, then the math, large. Nothing shown twice. */
export function Question({ p }: { p: Item }) {
  const plain = p.form === "units" || p.form === "chemistry";
  const words = !plain && hasWords(p.given);
  // A wordy `given` that only restates the prompt's math ("f(4) where f(x)=3x+2") is dropped.
  const bits = p.given.split(/\s+/).filter((b) => /[0-9=]/.test(b));
  const repeated = words && bits.length > 0 && bits.every((b) => squash(p.prompt).includes(squash(b)));
  return (
    <div className="mt-3" data-testid="practice-question">
      <p className="prose-lesson !text-[19px] !leading-snug"><RichText text={repeated ? p.prompt : p.prompt.replace(/[:.]?\s*$/, ":")} /></p>
      {!repeated && (
        <div className="mt-3 overflow-x-auto rounded-2xl bg-white/45 px-4 py-4 text-center text-[26px]">
          {plain ? <span className="font-mono text-[20px]">{p.given}</span> : words ? <span className="prose-lesson !text-[19px]">{p.given}</span> : <Math tex={quickTex(p.given)} />}
        </div>
      )}
    </div>
  );
}

/** Where an answer can be shown: the generator's key, or the engine's solution for equations. */
async function answerFor(p: Item): Promise<string | null> {
  if (p.expected) return p.expected;
  if (p.form !== "solved") return null;
  const r = await engine.solve(p.given).catch(() => null);
  return r?.ok && r.answer ? r.answer : null;
}

/**
 * A lesson's practice set. Right answers earn points and build a combo; two misses on one
 * question offer the answer or a skip, so nobody gets stuck. Running out of questions before
 * `need` right ones ends on a retry screen, never a dead end.
 */
export function Practice({ id, items, need, onFeedback, onDone, onReview }: {
  /** The lesson's id: unfinished practice is saved under it and picked up on return. */
  id: string;
  items: Item[];
  need: number;
  onFeedback?: (right: boolean | null) => void;
  onDone: () => void;
  onReview: () => void;
}) {
  const t = useT();
  const { addXp, saveResume } = useStore();
  // A saved run only counts if it was for this same set of questions.
  const [saved] = useState(() => {
    const r = useStore.getState().practiceResume[id];
    return r && r.results.length === items.length && r.qi < items.length ? r : null;
  });
  const [qi, setQi] = useState(saved?.qi ?? 0);
  const [answer, setAnswer] = useState("");
  const [results, setResults] = useState<(boolean | null)[]>(() => saved?.results ?? items.map(() => null));
  const [feedback, setFeedbackState] = useState<null | boolean>(null);
  const [misses, setMisses] = useState(0);
  const [key, setKey] = useState<string | null | undefined>(undefined); // undefined: not fetched yet
  const [revealed, setRevealed] = useState(false);
  const [combo, setCombo] = useState(0);
  const [gain, setGain] = useState<{ n: number; id: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [ended, setEnded] = useState(false);
  const p = items[qi];
  const score = results.filter(Boolean).length;

  // A run that reached the end isn't resumed: coming back starts from the lesson, since that's what they need next.
  useEffect(() => { saveResume(id, ended ? null : { qi, results }); }, [id, qi, results, ended]); // eslint-disable-line react-hooks/exhaustive-deps

  const setFeedback = (v: boolean | null) => { setFeedbackState(v); onFeedback?.(v); };

  function clearQuestion() {
    setFeedback(null);
    setAnswer("");
    setMisses(0);
    setKey(undefined);
    setRevealed(false);
  }

  function advance() {
    clearQuestion();
    if (qi < items.length - 1) setQi(qi + 1);
    else setEnded(true);
  }

  async function check() {
    if (!answer.trim() || busy || feedback === true) return;
    setBusy(true);
    const right = await checkPractice(p, answer).catch(() => false);
    setBusy(false);
    setFeedback(right);
    if (right) {
      const next = results.map((x, j) => (j === qi ? true : x));
      setResults(next);
      const n = XP_RIGHT + (combo >= 1 ? XP_COMBO : 0);
      addXp(n);
      setGain({ n, id: Date.now() });
      setCombo(combo + 1);
      setTimeout(() => {
        if (next.filter(Boolean).length >= need) { addXp(XP_DONE); saveResume(id, null); onDone(); }
        else advance();
      }, 1000);
    } else {
      if (results[qi] === null) setResults(results.map((x, j) => (j === qi ? false : x)));
      setCombo(0);
      const m = misses + 1;
      setMisses(m);
      if (m === 2) answerFor(p).then(setKey);
    }
  }

  function restart() {
    setResults(items.map(() => null));
    setQi(0);
    setCombo(0);
    setEnded(false);
    clearQuestion();
  }

  const dots = (
    <span className="flex gap-1">
      {results.map((r, i) => (
        <motion.span key={`${i}-${r}`} initial={r === null ? false : { scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 15 }}
          className={`h-3.5 w-3.5 rounded-full border border-line ${r ? "bg-ok" : r === false ? "bg-gap" : i === qi && !ended ? "bg-ink/25" : "bg-card"}`} />
      ))}
    </span>
  );

  if (ended)
    return (
      <motion.section initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mt-8 text-center" data-testid="practice-end">
        <div className="flex justify-center">{dots}</div>
        <h2 className="mt-3 font-display text-[24px]">{t("practice.endTitle")}</h2>
        <p className="mt-1 text-[15.5px] text-muted">{t("practice.endText", { score, total: items.length, need })}</p>
        <button className="btn-primary mt-5 w-full" onClick={restart} data-testid="practice-again">
          <Icon name="rewind" size={18} /> {t("practice.again")}
        </button>
        <button className="btn-ghost mt-3 w-full" onClick={onReview}>{t("practice.review")}</button>
      </motion.section>
    );

  return (
    <AnimatePresence mode="wait">
      <motion.section key={qi} initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -60, opacity: 0 }}
        className={`relative mt-6 ${feedback === false ? "shake" : ""}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="kicker text-muted">{t("common.practice")} {qi + 1}/{items.length}</span>
          {dots}
        </div>
        <AnimatePresence>
          {combo >= 2 && (
            <motion.div key={combo} initial={{ y: -6, opacity: 0, scale: 0.8 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="chip mt-2 !bg-gap-soft text-gap-dark" data-testid="combo">
              <Icon name="flame" size={14} /> {t("practice.inARow", { n: combo })}
            </motion.div>
          )}
        </AnimatePresence>
        <Question p={p} />

        {revealed ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-3" data-testid="practice-revealed">
            <div className="rounded-2xl border border-ok/30 bg-ok-soft/70 px-4 py-3">
              <div className="kicker text-ok-dark">{t("practice.answerIs")}</div>
              <div className="mt-1 text-[22px]">{p.form === "units" || p.form === "chemistry" ? <span className="font-mono">{key}</span> : <Math tex={quickTex(key ?? "")} />}</div>
            </div>
            <button className="btn-primary mt-3 w-full" onClick={advance} data-testid="practice-next">
              {t("practice.next")} <Icon name="arrow" size={18} />
            </button>
          </motion.div>
        ) : (
          <>
            <form className="relative mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void check(); }}>
              <input className={`input transition-colors ${feedback === true ? "!border-ok !bg-ok-soft/80" : feedback === false ? "!border-gap/60" : ""}`}
                value={answer} onChange={(e) => { setFeedback(null); setAnswer(e.target.value); }} data-math inputMode="text" enterKeyHint="done"
                autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder={t("unit.answer")} data-testid="practice-answer" />
              <button className={`${feedback === true ? "btn-ok" : "btn-primary"} shrink-0 !px-5`} disabled={busy} data-testid="practice-check">
                {feedback === true ? <Icon name="check" size={20} /> : "OK"}
              </button>
              <AnimatePresence>
                {gain && feedback === true && (
                  <motion.span key={gain.id} initial={{ y: 0, opacity: 0, scale: 0.6 }} animate={{ y: -34, opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 18 }}
                    className="pointer-events-none absolute -top-2 right-1 flex items-center gap-0.5 font-display text-[17px] text-gap">
                    <Icon name="bolt" size={15} /> +{gain.n}
                  </motion.span>
                )}
              </AnimatePresence>
            </form>
            <div className="mt-2"><MicButton onText={(x) => { setFeedback(null); setAnswer(x); }} testId="answer-mic" /></div>
            <AnimatePresence>
              {feedback !== null && (
                <motion.p initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
                  className={`mt-3 flex items-center gap-2 rounded-2xl px-4 py-2.5 font-display text-[17px] ${feedback ? "bg-ok text-white" : "bg-gap-soft text-gap-dark"}`}>
                  <Icon name={feedback ? "check" : "close"} size={18} />
                  {feedback ? t("unit.nice") : p.form === "expanded" ? t("learn.notYetMakeSure") : t("unit.notYetTryAgain")}
                </motion.p>
              )}
            </AnimatePresence>
            {misses >= 2 && feedback !== true && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 flex flex-wrap items-center gap-2" data-testid="practice-stuck">
                <span className="mr-auto text-[14px] text-muted">{t("practice.stuck")}</span>
                {key && <button className="btn-ghost btn-sm" onClick={() => { setFeedback(null); setRevealed(true); }} data-testid="practice-reveal">{t("practice.showAnswer")}</button>}
                <button className="btn-ghost btn-sm" onClick={advance} data-testid="practice-skip">{t("practice.skip")} <Icon name="chevron" size={14} /></button>
              </motion.div>
            )}
          </>
        )}
      </motion.section>
    </AnimatePresence>
  );
}

const BURST = ["#5b7f4f", "#d9532b", "#c8912b", "#3d5a80", "#5b7f4f", "#d9532b", "#c8912b", "#3d5a80", "#5b7f4f", "#d9532b", "#c8912b", "#3d5a80", "#5b7f4f", "#d9532b"];

/** A one-shot burst of confetti from the center of its parent, for finishing a skill. */
export function Burst() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
      {BURST.map((c, i) => {
        const a = (i / BURST.length) * 2 * globalThis.Math.PI;
        const r = 90 + (i % 3) * 30;
        return (
          <motion.span key={i} className="absolute left-1/2 top-12 h-2.5 w-1.5 rounded-sm" style={{ background: c }}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
            animate={{ x: globalThis.Math.cos(a) * r, y: globalThis.Math.sin(a) * r * 0.7 + 40, opacity: 0, rotate: 180 + i * 40 }}
            transition={{ duration: 1.1, ease: "easeOut", delay: 0.05 }} />
        );
      })}
    </div>
  );
}
