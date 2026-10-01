import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { readAloud } from "../ai/client";
import { AreaModel } from "../components/AreaModel";
import { Bilog } from "../components/Bilog";
import { Keypad, type KeyAction } from "../components/Keypad";
import { Math, RichText, quickTex } from "../components/Math";
import { Shell } from "../components/Shell";
import { Icon } from "../components/Icon";
import { lessons, skillById, skillTitle } from "../data";
import { engine } from "../engine/client";
import { getLesson, skillTarget } from "../lessons/pipeline";
import { useT } from "../i18n";
import type { Lesson } from "../types";
import { useStore } from "../store";

export default function Learn() {
  const t = useT();
  const nav = useNavigate();
  const { skillId = "" } = useParams();
  const { lang, setSkill, trace, progress } = useStore();
  const fil = lang === "fil";
  const skill = skillById[skillId];
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [stage, setStage] = useState<"learn" | "practice">("learn");
  const [qi, setQi] = useState(0);
  const [answer, setAnswer] = useState("");
  const [results, setResults] = useState<(boolean | null)[]>([]);
  const [feedback, setFeedback] = useState<null | boolean>(null);
  const [speaking, setSpeaking] = useState(false);
  const [keypad, setKeypad] = useState(true);
  const visualRef = useRef<HTMLElement | null>(null);

  // Generated and verified lesson first (shared cache), the hand-authored one only if none is available.
  useEffect(() => {
    if (!skill) return;
    let live = true;
    getLesson(skillTarget(skill)).then((r) => {
      if (!live) return;
      const seed = lessons[skillId];
      const l = r ? { ...r.lesson, visual: seed?.visual } : seed ?? null;
      setLesson(l);
      setLoaded(true);
      setResults(l?.practice.map(() => null) ?? []);
    });
    return () => { live = false; };
  }, [skillId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!skill) return <Shell back="/student">Unknown skill.</Shell>;
  if (loaded && !lesson)
    return <Shell back="/student">{fil ? "Kailangan ng koneksyon para ihanda ang lesson na ito." : "This lesson needs a connection to prepare."}</Shell>;
  if (!lesson)
    return (
      <Shell tabs={false} back="/student" title={`Grade ${skill.grade}`}>
        <h1 className="font-display text-[30px] font-bold leading-tight">{skillTitle(skillId, lang)}</h1>
        <div className="mt-4 animate-pulse space-y-3" aria-busy data-testid="lesson-skeleton">
          <div className="card space-y-3">{[92, 100, 78].map((w, i) => <div key={i} className="h-4 rounded-full bg-soft" style={{ width: `${w}%` }} />)}</div>
        </div>
      </Shell>
    );
  const text = lesson[lang];
  const need = globalThis.Math.min(2, lesson.practice.length);
  const correct = results.filter(Boolean).length;
  const mastered = correct >= need;
  const p = lesson.practice[qi];

  async function check() {
    if (!answer.trim()) return;
    const r = await engine.check(p.given, answer, p.form);
    setFeedback(r.correct);
    if (r.correct) {
      const next = results.map((x, j) => (j === qi ? true : x));
      setResults(next);
      if (next.filter(Boolean).length >= need && progress[skillId] !== "mastered") setSkill(skillId, "mastered");
      setTimeout(() => {
        setFeedback(null);
        setAnswer("");
        if (qi < lesson!.practice.length - 1) setQi(qi + 1);
      }, 900);
    } else {
      setResults(results.map((x, j) => (j === qi ? false : x)));
    }
  }

  function onKey(a: KeyAction) {
    setFeedback(null);
    if ("enter" in a) return void check();
    if ("backspace" in a) return setAnswer((s) => s.slice(0, -1));
    if ("insert" in a) setAnswer((s) => s + a.insert);
  }

  return (
    <Shell tabs={false} back="/student" title={`Grade ${skill.grade} · ${fil ? "Ayusin ang gap" : "Fix the gap"}`}>
      <div className="flex items-start gap-3">
        <h1 className="min-w-0 flex-1 font-display text-[30px] font-bold leading-tight">{skillTitle(skillId, lang)}</h1>
        {!mastered && (
          <div className="-mt-1">
            <Bilog size={50} lookAt={visualRef}
              mood={stage === "learn" ? "learn" : feedback === true ? "happy" : feedback === false ? "found" : "watch"} />
          </div>
        )}
      </div>
      <div className="mt-2 flex gap-1.5" aria-label="progress">
        {["learn", "practice", "retry"].map((s, i) => (
          <span key={s} className={`h-3 flex-1 rounded-full border border-line ${i === 0 || (i === 1 && stage === "practice") || (i === 2 && mastered) ? "bg-ok" : "bg-card"}`} />
        ))}
      </div>

      {stage === "learn" && (
        <>
          <section className="card mt-4 space-y-3 text-[17px] leading-relaxed">
            {text.body.map((para, i) => (
              <p key={i}>
                <RichText text={para} />
              </p>
            ))}
            <button className="btn-ghost btn-sm" onClick={async () => {
              setSpeaking(true);
              await readAloud(text.spoken, lang);
              setSpeaking(false);
            }} data-testid="read-aloud">
              <Icon name="speaker" size={18} /> {speaking ? "…" : t("readAloud")}
            </button>
          </section>
          {lesson.visual === "area-model" && (
            <section className="mt-4" ref={visualRef}>
              <AreaModel b={3} />
            </section>
          )}
          <button className="btn-primary mt-5 w-full !text-lg" onClick={() => setStage("practice")} data-testid="to-practice">
            {fil ? "Practice na!" : "Let's practice!"} →
          </button>
        </>
      )}

      {stage === "practice" && !mastered && (
        <AnimatePresence mode="wait">
          <motion.section key={qi} initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -60, opacity: 0 }}
            className={`card mt-4 ${feedback === false ? "shake" : ""}`}>
            <div className="flex items-center justify-between">
              <span className="kicker text-muted">{t("practice")} {qi + 1}/{lesson.practice.length}</span>
              <span className="flex gap-1">
                {results.map((r, i) => (
                  <span key={i} className={`h-4 w-4 rounded-full border border-line ${r ? "bg-ok" : r === false ? "bg-gap" : "bg-card"}`} />
                ))}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-2xl bg-soft px-4 py-4 text-[26px]">
              <span className="font-display text-base text-muted">{p.prompt}:</span>
              <Math tex={quickTex(p.given)} />
            </div>
            <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); check(); }}>
              <input className="input" value={answer} onChange={(e) => { setFeedback(null); setAnswer(e.target.value); }}
                inputMode={keypad ? "none" : "text"} autoCapitalize="off" autoCorrect="off" spellCheck={false}
                placeholder={fil ? "Sagot mo" : "Your answer"} data-testid="practice-answer" />
              <button className="btn-primary shrink-0" data-testid="practice-check">OK</button>
            </form>
            {feedback !== null && (
              <motion.p initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className={`mt-3 rounded-2xl border border-line px-3 py-2 font-display text-[17px] ${feedback ? "bg-ok text-white" : "bg-gap"}`}>
                {feedback ? (fil ? "Tama!" : "Nice!") : p.form === "expanded" ? (fil ? "Hindi pa — siguraduhing naka-expand." : "Not yet — make sure it's fully expanded.") : fil ? "Hindi pa — subukan ulit." : "Not yet — try again."}
              </motion.p>
            )}
            {keypad && (
              <div className="mt-3">
                <Keypad value={answer} onKey={onKey} onTextMode={() => setKeypad(false)} />
              </div>
            )}
          </motion.section>
        </AnimatePresence>
      )}

      {mastered && (
        <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16 }}
          className="card mt-5 !bg-ok-soft/70 text-center" data-testid="mastered">
          <div className="flex justify-center"><Bilog size={72} mood="cheer" /></div>
          <div className="mt-1 font-display text-2xl font-bold">{fil ? "Naayos ang gap!" : "Gap fixed!"}</div>
          <p className="mt-1 text-[15px]">{fil ? "Ngayon, balikan ang problem na nagpahinto sa iyo." : "Now go back to the problem that stopped you."}</p>
          {trace ? (
            <button className="btn-primary mt-4 w-full !text-lg" onClick={() => nav(`/solve/${trace.problemId}?mode=retry`)} data-testid="retry">
              {t("retry")} <Icon name="arrow" size={18} />
            </button>
          ) : (
            <button className="btn-primary mt-4 w-full" onClick={() => nav("/student")}>{fil ? "Bumalik" : "Back home"}</button>
          )}
        </motion.div>
      )}
    </Shell>
  );
}
