import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { askHelp, readQuestion, type HelpAnswer } from "../ai/client";
import { cleanPartial } from "../ai/stream";
import { photoToDataUrl } from "../ai/image";
import { Bilog } from "../components/Bilog";
import { Icon } from "../components/Icon";
import { RichText } from "../components/Math";
import { MicButton } from "../components/MicButton";
import { Shell } from "../components/Shell";
import { unitById } from "../data/curriculum";
import { useT } from "../i18n";
import { usePlanContext } from "../plan";
import { useStore } from "../store";

/** A bare expression or equation (no words): the exact step checker can take it line by line. */
const isPlainMath = (s: string) => {
  const t = s.trim();
  return !!t && t.length < 80 && /^[\d\sa-z+\-*/^().,=√π<>]+$/i.test(t) && !/[a-z]{3,}/i.test(t.replace(/sqrt|sin|cos|tan|log|ln|pi/gi, ""));
};

/**
 * The homework helper, for any subject: type, snap or say the question (and your attempt, if you have one).
 * It says what's right and where it goes wrong, gives one hint first, and keeps the full explanation for when
 * you ask, so it teaches instead of just answering. Plain math with steps can also go to the exact checker.
 */
export default function Help() {
  const t = useT();
  const nav = useNavigate();
  const lang = useStore((s) => s.lang);
  const { grade, subjects } = usePlanContext();
  const [question, setQuestion] = useState("");
  const [work, setWork] = useState("");
  const [snap, setSnap] = useState<"idle" | "reading" | "failed">("idle");
  const [state, setState] = useState<"idle" | "asking" | "failed" | "offline">("idle");
  const [answer, setAnswer] = useState<Partial<HelpAnswer> | null>(null);
  const [reveal, setReveal] = useState(false);
  const photo = useRef<HTMLInputElement | null>(null);
  const ask = useRef<AbortController | null>(null);

  const lines = work.split("\n").map((l) => l.trim()).filter(Boolean);
  const mathy = isPlainMath(question);

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setSnap("reading");
    const out = await readQuestion(await photoToDataUrl(file)).catch(() => null);
    if (!out?.question) return setSnap("failed");
    setQuestion(out.question);
    if (out.work.length) setWork(out.work.join("\n"));
    setSnap("idle");
  }

  async function onAsk() {
    if (!navigator.onLine) return setState("offline");
    ask.current?.abort();
    const ctrl = new AbortController();
    ask.current = ctrl;
    setState("asking");
    setAnswer({});
    setReveal(false);
    const done = await askHelp({ question, work: lines, subjects, grade, lang }, ctrl.signal, (soFar) => !ctrl.signal.aborted && setAnswer(soFar));
    if (ctrl.signal.aborted) return;
    if (done) {
      setAnswer(done);
      setState("idle");
    } else setState(navigator.onLine ? "failed" : "offline");
  }

  function reset() {
    ask.current?.abort();
    setQuestion("");
    setWork("");
    setAnswer(null);
    setState("idle");
  }

  const unit = answer?.unitId ? unitById(answer.unitId) : null;
  const verdict = answer?.verdict && answer.verdict !== "no_attempt" ? answer.verdict : null;

  return (
    <Shell title={t("help.title")}>
      <div className="mt-2 flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <div className="kicker text-gap-dark">{t("help.kicker")}</div>
          <h1 className="mt-1 text-balance text-[30px] leading-[1.08]">{t("help.heading")}</h1>
        </div>
        <Bilog size={54} mood={state === "asking" ? "think" : verdict === "correct" ? "happy" : answer?.hint ? "found" : "watch"} />
      </div>

      <section className="mt-5 space-y-4">
        <div>
          <label className="kicker text-muted" htmlFor="hq">{t("help.questionLabel")}</label>
          <textarea id="hq" className="input mt-2 min-h-28 resize-y !font-sans !text-[17px] leading-snug" value={question} maxLength={1200}
            onChange={(e) => setQuestion(e.target.value)} placeholder={t("help.questionPlaceholder")} data-testid="help-question" />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button className="btn-ghost btn-sm" onClick={() => photo.current?.click()} disabled={snap === "reading"} data-testid="help-snap">
              <Icon name="camera" size={16} /> {snap === "reading" ? t("solve.reading") : t("help.snap")}
            </button>
            <input ref={photo} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={(e) => { void onPhoto(e.target.files?.[0]); e.target.value = ""; }} />
            <MicButton onText={(x) => setQuestion((q) => (q ? `${q} ${x}` : x))} testId="help-mic" />
            {snap === "failed" && <span className="text-[13px] text-gap-dark">{t("solve.snapFailed")}</span>}
          </div>
        </div>
        <div>
          <label className="kicker text-muted" htmlFor="hw">{t("help.workLabel")}</label>
          <textarea id="hw" className="input mt-2 min-h-20 resize-y !font-sans !text-[16px] leading-snug" value={work} maxLength={3000}
            onChange={(e) => setWork(e.target.value)} placeholder={t("help.workPlaceholder")} data-testid="help-work" />
        </div>
      </section>

      <button className="btn-primary mt-4 w-full !text-lg" disabled={!question.trim() || state === "asking"} onClick={() => void onAsk()} data-testid="help-ask">
        {state === "asking" ? t("help.thinking") : t("help.ask")}
      </button>
      {mathy && (
        // The exact checker proves each line instead of an AI reading it: worth offering for plain math.
        <button className="mt-3 w-full text-center text-[14px] text-muted underline decoration-dotted underline-offset-4"
          onClick={() => nav(`/solve/custom?given=${encodeURIComponent(question.trim())}${lines.length ? `&steps=${encodeURIComponent(lines.join("\n"))}` : ""}`)}
          data-testid="help-exact">
          {t("help.exactCheck")}
        </button>
      )}
      <p className="mt-3 flex items-start gap-2 text-[12.5px] text-muted"><Icon name="lock" size={13} className="mt-0.5 shrink-0" /> {t("help.privacy")}</p>

      {state === "offline" && <p className="card mt-5 text-[15px]">{t("help.offline")}</p>}
      {state === "failed" && (
        <div className="card mt-5">
          <p className="text-[15px]">{t("help.failed")}</p>
          <button className="btn-primary btn-sm mt-3" onClick={() => void onAsk()}>{t("unit.tryAgain")}</button>
        </div>
      )}

      {answer && state !== "failed" && state !== "offline" && (
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-6 space-y-4" aria-live="polite" data-testid="help-answer">
          {!answer.restate && <p className="text-[15px] text-muted">{t("help.thinkingLong")}</p>}
          {answer.restate && <p className="border-l-[3px] border-ink/20 pl-3 text-[15px] italic text-muted"><RichText text={cleanPartial(answer.restate)} /></p>}

          {verdict && (
            <span className={`chip ${verdict === "correct" ? "!bg-ok-soft text-ok-dark" : verdict === "partly" ? "!bg-ochre/15 text-ochre" : "!bg-gap-soft text-gap-dark"}`} data-testid="help-verdict">
              {t(verdict === "correct" ? "help.verdict.correct" : verdict === "partly" ? "help.verdict.partly" : "help.verdict.incorrect")}
            </span>
          )}
          {answer.feedback && <p className="prose-lesson"><RichText text={cleanPartial(answer.feedback)} /></p>}

          {answer.hint && (
            <div className="rounded-2xl bg-sky/10 px-4 py-3" data-testid="help-hint">
              <div className="kicker text-sky">{t("help.hint")}</div>
              <p className="prose-lesson mt-1"><RichText text={cleanPartial(answer.hint)} /></p>
            </div>
          )}

          {state === "idle" && !!answer.steps?.length && (
            !reveal ? (
              <button className="btn-ghost w-full" onClick={() => setReveal(true)} data-testid="help-reveal">{t("help.showExplanation")}</button>
            ) : (
              <div data-testid="help-explanation">
                <div className="kicker text-muted">{t("help.explanation")}</div>
                <ol className="prose-lesson mt-2 list-decimal space-y-2 pl-5">
                  {answer.steps.map((s, i) => <li key={i}><RichText text={s} /></li>)}
                </ol>
                {answer.answer && (
                  <div className="mt-3 rounded-2xl bg-ok-soft/70 px-4 py-3">
                    <div className="kicker text-ok-dark">{t("help.answer")}</div>
                    <p className="prose-lesson mt-1"><RichText text={answer.answer} /></p>
                  </div>
                )}
              </div>
            )
          )}

          {state === "idle" && answer.checkQuestion && (
            <div className="rounded-2xl bg-white/45 px-4 py-3">
              <div className="kicker text-muted">{t("help.tryThis")}</div>
              <p className="prose-lesson mt-1"><RichText text={answer.checkQuestion} /></p>
            </div>
          )}

          {state === "idle" && unit && (
            <button className="flex w-full items-center gap-3 rounded-2xl bg-ink px-4 py-3.5 text-left text-paper" onClick={() => nav(`/unit/${unit.id}`)} data-testid="help-unit">
              <span className="min-w-0 flex-1">
                <span className="kicker block text-paper/65">{t("help.learnIt")} · {t("common.gradeN", { n: unit.grade })}</span>
                <span className="mt-0.5 block font-display text-[18px] leading-tight">{t.unit(unit)}</span>
              </span>
              <Icon name="arrow" />
            </button>
          )}

          {state === "idle" && (
            <>
              <p className="text-[12.5px] text-muted">{t("help.aiNote")}</p>
              <button className="text-[14px] text-muted underline decoration-dotted underline-offset-4" onClick={reset} data-testid="help-new">{t("help.newQuestion")}</button>
            </>
          )}
        </motion.section>
      )}
    </Shell>
  );
}
