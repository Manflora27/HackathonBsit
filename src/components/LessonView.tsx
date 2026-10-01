import { useState } from "react";
import { motion } from "motion/react";
import { readAloud } from "../ai/client";
import { lessonText } from "../data";
import { useT } from "../i18n";
import { useStore } from "../store";
import type { Lang, Lesson } from "../types";
import { FigureView, WorkedSteps } from "./Figures";
import { Icon } from "./Icon";
import { RichText } from "./Math";

/** One concept question before practice: wrong picks show why, the right one lights up. */
function ConceptCheck({ check, answer }: { check: NonNullable<Lesson["en"]["check"]>; answer: number }) {
  const t = useT();
  const addXp = useStore((s) => s.addXp);
  const [pick, setPick] = useState<number | null>(null);
  const [tries, setTries] = useState(0);
  const solved = pick === answer;
  return (
    <section className="mt-8" data-testid="concept-check">
      <div className="kicker text-sky">{t("lesson.quickCheck")}</div>
      <p className="prose-lesson mt-2"><RichText text={check.question} /></p>
      <div className="mt-3 space-y-2" role="radiogroup">
        {check.choices.map((c, k) => {
          const state = pick !== k ? (solved ? "dim" : "idle") : k === answer ? "right" : "wrong";
          return (
            <motion.button key={`${k}-${tries}`} role="radio" aria-checked={pick === k} disabled={solved}
              onClick={() => { setPick(k); setTries((n) => n + 1); if (k === answer && tries === 0) addXp(5); }}
              animate={state === "right" ? { scale: [1, 1.03, 1] } : state === "wrong" ? { x: [0, -6, 6, -3, 0] } : {}}
              transition={{ duration: 0.35 }} whileTap={solved ? undefined : { scale: 0.97 }}
              className={`flex w-full items-center gap-3 rounded-2xl border border-white/60 px-3 py-3 text-left transition-colors duration-200 ${
                state === "right" ? "bg-ok-soft/90" : state === "wrong" ? "bg-gap-soft/90" : "bg-white/45"} ${state === "dim" ? "opacity-45" : ""}`}
              data-testid={`concept-choice-${k}`}>
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-display text-[13px] ${
                state === "right" ? "bg-ok text-white" : state === "wrong" ? "bg-gap text-white" : "bg-white/60 text-muted"}`}>
                {state === "right" ? <Icon name="check" size={15} /> : state === "wrong" ? <Icon name="close" size={15} /> : "ABC"[k]}
              </span>
              <span className="prose-lesson flex-1 !text-[16.5px] !leading-snug"><RichText text={c} /></span>
            </motion.button>
          );
        })}
      </div>
      {pick !== null && (
        <motion.p key={pick} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          className={`prose-lesson mt-3 !text-[16px] ${solved ? "text-ok-dark" : "text-gap-dark"}`} data-testid="concept-why">
          {solved ? <RichText text={check.why} /> : t("unit.notYetTryAgain")}
        </motion.p>
      )}
    </section>
  );
}

/**
 * The lesson, set straight on the page like a book: hook, the idea built up to its rule, a picture,
 * a worked example, the classic mistake, and one concept check. Then the practice button.
 */
export function LessonView({ lesson, lang, visual, onPractice }: { lesson: Lesson; lang: Lang; visual?: React.ReactNode; onPractice: () => void }) {
  const t = useT();
  const text = lessonText(lesson, lang);
  const [speaking, setSpeaking] = useState(false);
  const check = text.check?.choices.length && typeof lesson.checkAnswer === "number" && lesson.checkAnswer < text.check.choices.length ? text.check : null;
  return (
    <>
      {text.hook && (
        <p className="mt-5 border-l-[3px] border-gap/70 pl-4 font-serif text-[20px] italic leading-snug text-ink/90" data-testid="lesson-hook">
          <RichText text={text.hook} />
        </p>
      )}
      <section className="prose-lesson mt-5 space-y-4" data-testid="lesson-body">
        {text.body.map((para, i) => <p key={i}><RichText text={para} /></p>)}
      </section>
      <button className="btn-ghost btn-sm mt-4" onClick={async () => { setSpeaking(true); await readAloud(text.spoken, lang); setSpeaking(false); }} data-testid="read-aloud">
        <Icon name="speaker" size={18} /> {speaking ? "…" : t("common.readAloud")}
      </button>

      {lesson.figure && <div className="mt-6" data-testid="lesson-extras"><FigureView fig={lesson.figure} /></div>}
      {visual}
      {lesson.example && <div className="mt-8"><WorkedSteps example={lesson.example} lang={lang} /></div>}

      {text.pitfall && (
        <section className="mt-8 rounded-r-2xl border-l-[3px] border-gap bg-gap-soft/45 py-3 pl-4 pr-3" data-testid="lesson-pitfall">
          <div className="kicker text-gap-dark">{t("lesson.commonMistake")}</div>
          <p className="prose-lesson mt-1.5 !text-[16.5px]"><RichText text={text.pitfall} /></p>
        </section>
      )}

      {check && <ConceptCheck check={check} answer={lesson.checkAnswer!} />}

      <button className="btn-primary mt-8 w-full !text-lg" onClick={onPractice} data-testid="to-practice">
        {t("unit.letsPractice")} →
      </button>
    </>
  );
}
