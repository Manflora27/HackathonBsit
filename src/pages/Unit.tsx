import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { readAloud } from "../ai/client";
import { Icon } from "../components/Icon";
import { Keypad, type KeyAction } from "../components/Keypad";
import { Math, RichText, quickTex } from "../components/Math";
import { Shell } from "../components/Shell";
import { subjectLabel, unitById, verifierMeta } from "../data/curriculum";
import { engine } from "../engine/client";
import { getLesson, type CachedLesson } from "../lessons/pipeline";
import { useT } from "../i18n";
import { useStore } from "../store";

/** Lesson outline while the lesson is fetched or generated. */
function LessonSkeleton() {
  return (
    <div className="mt-4 animate-pulse space-y-4" aria-busy data-testid="lesson-skeleton">
      <div className="card space-y-3">
        {[92, 100, 78, 60].map((w, i) => <div key={i} className="h-4 rounded-full bg-soft" style={{ width: `${w}%` }} />)}
      </div>
      <div className="card space-y-3">
        <div className="h-3 w-24 rounded-full bg-soft" />
        <div className="h-14 rounded-2xl bg-soft" />
      </div>
    </div>
  );
}

export default function Unit() {
  const t = useT();
  const nav = useNavigate();
  const { unitId = "" } = useParams();
  const unit = unitById(unitId);
  const { lang, progress, setSkill } = useStore();
  const fil = lang === "fil";
  const [state, setState] = useState<"loading" | "failed" | CachedLesson>("loading");
  const [stage, setStage] = useState<"learn" | "practice">("learn");
  const [qi, setQi] = useState(0);
  const [answer, setAnswer] = useState("");
  const [results, setResults] = useState<(boolean | null)[]>([]);
  const [feedback, setFeedback] = useState<null | boolean>(null);
  const [keypadPref, setKeypad] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!unit) return;
    let live = true;
    setState("loading");
    getLesson(unit).then((r) => {
      if (!live) return;
      setState(r ?? "failed");
      setResults(r?.lesson.practice.map(() => null) ?? []);
    });
    return () => { live = false; };
  }, [unitId, attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!unit) return <Shell back="/student">Unknown unit.</Shell>;
  const title = `${unit.title[lang]} · ${fil ? "Grade" : "Grade"} ${unit.grade}`;
  const head = (
    <>
      <div className="kicker text-muted">{subjectLabel(unit.subject, lang)} · Q{unit.quarter}</div>
      <h1 className="mt-1 font-display text-[30px] font-bold leading-tight">{unit.title[lang]}</h1>
    </>
  );

  if (state === "loading") return <Shell tabs={false} back="/student" title={title}>{head}<LessonSkeleton /></Shell>;
  if (state === "failed")
    return (
      <Shell tabs={false} back="/student" title={title}>
        {head}
        <section className="card mt-4" data-testid="lesson-unavailable">
          <p className="text-[17px]">{fil ? "Kailangan ng koneksyon para ihanda ang lesson na ito." : "This lesson needs a connection to prepare."}</p>
          <p className="mt-1 text-[14px] text-muted">{fil ? "Nasa plano mo pa rin ito. Subukan ulit kapag online ka na." : "It stays in your plan. Try again when you're online."}</p>
          <button className="btn-primary mt-4" onClick={() => setAttempt((n) => n + 1)} data-testid="retry-lesson">{fil ? "Subukan ulit" : "Try again"}</button>
        </section>
      </Shell>
    );

  const { lesson, verified } = state;
  const text = lesson[lang];
  const need = globalThis.Math.min(2, lesson.practice.length);
  const mastered = results.filter(Boolean).length >= need;
  const p = lesson.practice[qi];
  const keypad = keypadPref && p.form !== "units" && p.form !== "chemistry"; // letters and arrows need the device keyboard

  async function check() {
    if (!answer.trim()) return;
    const r = await engine.check(p.given, answer, p.form);
    setFeedback(r.correct);
    if (r.correct) {
      const next = results.map((x, j) => (j === qi ? true : x));
      setResults(next);
      if (next.filter(Boolean).length >= need && progress[unit!.id] !== "mastered") setSkill(unit!.id, "mastered");
      setTimeout(() => {
        setFeedback(null);
        setAnswer("");
        if (qi < lesson.practice.length - 1) setQi(qi + 1);
      }, 900);
    } else setResults(results.map((x, j) => (j === qi ? false : x)));
  }

  function onKey(a: KeyAction) {
    setFeedback(null);
    if ("enter" in a) return void check();
    if ("backspace" in a) return setAnswer((s) => s.slice(0, -1));
    if ("insert" in a) setAnswer((s) => s + a.insert);
  }

  return (
    <Shell tabs={false} back="/student" title={title}>
      {head}
      <div className="mt-2 flex items-center gap-2 text-[13px] text-muted" data-testid="verified-badge">
        {verified ? <Icon name="check" size={14} className="text-ok" /> : <span className="chip !px-2 text-[11px]">AI</span>}
        {verified ? verifierMeta[unit.verifier][lang] : verifierMeta.llm[lang]}
      </div>

      {stage === "learn" && (
        <>
          <section className="card mt-4 space-y-3 text-[17px] leading-relaxed" data-testid="lesson-body">
            {text.body.map((para, i) => <p key={i}><RichText text={para} /></p>)}
            <button className="btn-ghost btn-sm" onClick={() => readAloud(text.spoken, lang)} data-testid="read-aloud">
              <Icon name="speaker" size={18} /> {t("readAloud")}
            </button>
          </section>
          <button className="btn-primary mt-5 w-full !text-lg" onClick={() => setStage("practice")} data-testid="to-practice">
            {fil ? "Practice na!" : "Let's practice!"} →
          </button>
        </>
      )}

      {stage === "practice" && !mastered && (
        <AnimatePresence mode="wait">
          <motion.section key={qi} initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -60, opacity: 0 }} className={`card mt-4 ${feedback === false ? "shake" : ""}`}>
            <span className="kicker text-muted">{t("practice")} {qi + 1}/{lesson.practice.length}</span>
            <div className="mt-3 flex items-center gap-2 rounded-2xl bg-soft px-4 py-4 text-[26px]">
              <span className="font-display text-base text-muted">{p.prompt}:</span>
              {p.form === "units" || p.form === "chemistry" ? <span className="font-mono text-[20px]">{p.given}</span> : <Math tex={quickTex(p.given)} />}
            </div>
            <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void check(); }}>
              <input className="input" value={answer} onChange={(e) => { setFeedback(null); setAnswer(e.target.value); }} inputMode={keypad ? "none" : "text"}
                autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder={fil ? "Sagot mo" : "Your answer"} data-testid="practice-answer" />
              <button className="btn-primary shrink-0" data-testid="practice-check">OK</button>
            </form>
            {feedback !== null && (
              <p className={`mt-3 rounded-2xl border border-line px-3 py-2 font-display text-[17px] ${feedback ? "bg-ok text-white" : "bg-gap"}`}>
                {feedback ? (fil ? "Tama!" : "Nice!") : fil ? "Hindi pa — subukan ulit." : "Not yet — try again."}
              </p>
            )}
            {keypad && <div className="mt-3"><Keypad value={answer} onKey={onKey} onTextMode={() => setKeypad(false)} /></div>}
          </motion.section>
        </AnimatePresence>
      )}

      {mastered && (
        <div className="card mt-5 !bg-ok-soft/70 text-center" data-testid="mastered">
          <div className="font-display text-2xl font-bold">{fil ? "Tapos ang unit!" : "Unit done!"}</div>
          <button className="btn-primary mt-4 w-full" onClick={() => nav("/student")}>{fil ? "Bumalik" : "Back home"}</button>
        </div>
      )}
    </Shell>
  );
}
