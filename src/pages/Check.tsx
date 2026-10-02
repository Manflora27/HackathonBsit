import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { placementStream, type PlacementQuestion } from "../ai/client";
import { templatePlacement } from "../lessons/template";
import { Bilog } from "../components/Bilog";
import { Icon } from "../components/Icon";
import { Math as TeX, RichText, quickTex } from "../components/Math";
import { MicButton } from "../components/MicButton";
import { Shell } from "../components/Shell";
import { SubjectIcon } from "../components/SubjectIcon";
import { skillTitle, skills } from "../data";
import { buildPlan, foundationOf, isMathSubject, startGrade, subjectMeta, unitById, type SubjectId } from "../data/curriculum";
import { engine } from "../engine/client";
import { useT } from "../i18n";
import { useAuth } from "../auth";
import { useStore, type Placement } from "../store";

/** A question plus where it points: a plan unit, or a built-in skill when the check ran offline. */
type Q = PlacementQuestion & { skillId?: string; grade: number };

/** Offline fallback for math: the built-in skill probes up to the learner's level, foundations first. */
function offlineQuestions(grade: number): Q[] {
  const top = Math.min(grade, 9);
  return skills.filter((s) => s.grade <= top).sort((a, b) => a.grade - b.grade).slice(-10).map((s) => ({
    unitId: "", skillId: s.id, grade: s.grade, level: s.grade < top ? "foundation" : "current", kind: "typed",
    prompt: s.probes[0].prompt, given: s.probes[0].given, expected: s.probes[0].expected,
    form: s.probes[0].form as Q["form"], choices: [], answer: 0,
  }));
}

/** A question as the model wrote it, if it's usable: a unit in this check, and a key or a valid choice. */
function toQ(q: PlacementQuestion, grade: number, math: boolean): Q | null {
  const unit = unitById(q.unitId);
  if (!unit) return null;
  const ok = q.kind === "typed" ? math && !!q.given && !!q.expected : q.choices.length >= 2 && q.answer >= 0 && q.answer < q.choices.length;
  return ok ? { ...q, grade: unit.grade ?? grade } : null;
}

const MAX_QUESTIONS = 10;
/** Fewer questions than this can't place anyone: better to say so than to guess from one or two answers. */
const MIN_QUESTIONS = 3;
/** An unfinished check older than this starts over: the learner has likely moved on since. */
const RESUME_FOR_MS = 7 * 24 * 3600_000;

/** Keep only questions whose answer key the engine confirms; multiple choice passes through. */
async function gate(qs: Q[]) {
  const ok: Q[] = [];
  for (const q of qs) {
    if (q.kind === "choice") { ok.push(q); continue; }
    try {
      const r = await engine.check(q.given, q.expected, q.form);
      if (r.correct) ok.push(q);
      // Right answer under the wrong form label: keep it, graded without the form rule.
      else if (/^not_(solved|expanded|factored)$/.test(r.reason ?? "") && (await engine.check(q.given, q.expected, "any")).correct) ok.push({ ...q, form: "any" });
    } catch { /* unparseable: drop */ }
  }
  return ok;
}

/** Where to start: the lowest-grade missed foundation, else the first missed current unit, else the first unit of the grade. */
function place(subject: SubjectId, grade: number, qs: Q[], right: boolean[]): Placement {
  const missed = qs.filter((_, i) => !right[i]);
  const target = missed.filter((q) => q.level === "foundation").sort((a, b) => a.grade - b.grade)[0] ?? missed[0];
  const base = { at: Date.now(), score: right.filter(Boolean).length, total: qs.length };
  if (!target) return { ...base, gap: false, unitId: buildPlan(subject, grade)[0]?.id };
  return { ...base, gap: target.level === "foundation", ...(target.skillId ? { skillId: target.skillId } : { unitId: target.unitId }) };
}

export default function Check() {
  const { subject: raw } = useParams();
  const subject = (raw && raw in subjectMeta ? raw : "math") as SubjectId;
  const nav = useNavigate();
  const t = useT();
  const { lang, onboarding, placement, set, setSkill, addXp } = useStore();
  const { profile } = useAuth();
  const myGrade = profile?.current_grade ?? onboarding.grade;
  const grade = startGrade(subject, myGrade);
  const math = isMathSubject(subject);

  // Which grade this round of questions centres on. Missing every question at the lowest grade asked
  // says nothing about the grades below it, so the check steps further back instead of assuming them.
  // An unfinished check of this subject (a reload, a closed tab, a lost connection) picks up at the same question.
  // Its questions are reused only if there are enough to place from; otherwise the round is asked again.
  const [saved] = useState(() => {
    const r = useStore.getState().checkResume[subject];
    return r && Date.now() - r.at < RESUME_FOR_MS ? r : null;
  });
  const resumed = saved && saved.questions.length >= MIN_QUESTIONS ? saved : null;
  const [round, setRound] = useState<{ subject: SubjectId; grade: number | null }>(saved?.round ?? { subject, grade: myGrade });
  const [past, setPast] = useState(saved?.past ?? { score: 0, total: 0 });
  const [qs, setQs] = useState<Q[] | null>(resumed?.questions ?? null);
  const [failed, setFailed] = useState(false);
  /** Questions are still streaming in: running out of them means wait, not finish. */
  const [more, setMore] = useState(!resumed);
  const stream = useRef<AbortController | null>(null);
  /** The round restored from a saved check: its questions are already here, so nothing is streamed for it. */
  const resumedRound = useRef(resumed ? round : null);
  const [attempt, setAttempt] = useState(0);
  const [i, setI] = useState(resumed?.answers.length ?? 0);
  const [right, setRight] = useState<boolean[]>(resumed?.answers ?? []);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  /** The answer just given, shown for a beat before the next question: the picked choice (or -1 for typed) and whether it was right. */
  const [flash, setFlash] = useState<{ pick: number; right: boolean } | null>(null);
  /** This check has placed the learner. (A placement from an earlier check of the subject is not this one's result.) */
  const [placed, setPlaced] = useState(false);
  const result = placed ? placement[subject] ?? null : null;

  // Save after every answer (and each new round), so nothing answered is lost.
  useEffect(() => {
    if (result) return;
    set({ checkResume: { ...useStore.getState().checkResume, [subject]: { at: Date.now(), round, past, questions: qs ?? [], answers: right } } });
  }, [qs, right, round, past]); // eslint-disable-line react-hooks/exhaustive-deps

  // Each question shows up as soon as the model has written it and the engine has confirmed its key,
  // so the learner starts on question 1 while the rest are still being written. The model writes them easiest first.
  useEffect(() => {
    if (round === resumedRound.current && attempt === 0) return; // restored from a saved check
    let live = true;
    const ctrl = new AbortController();
    stream.current = ctrl;
    setMore(true);
    const at = startGrade(round.subject, round.grade);
    let count = 0;
    let chain = Promise.resolve();
    const add = (list: Q[]) => {
      chain = chain.then(async () => {
        for (const q of await gate(list)) {
          if (!live || ctrl.signal.aborted || count >= MAX_QUESTIONS) return;
          count++;
          setQs((prev) => [...(prev ?? []), q]);
        }
      });
    };
    (async () => {
      let handed = 0;
      await placementStream(round.subject, round.grade, lang, ctrl.signal, (items, final) => {
        for (const upTo = final ? items.length : items.length - 1; handed < upTo; handed++) {
          const q = toQ(items[handed], at, math);
          if (q) add([q]);
        }
      });
      await chain;
      if (ctrl.signal.aborted) return; // the check already ended
      // Too few usable questions (offline, or the model failed): the bundled template questions.
      if (live && count < 3) {
        for (const item of templatePlacement(buildPlan(round.subject, at))) {
          const q = toQ(item, at, math);
          if (q) add([q]);
        }
        await chain;
      }
      // Still too few: math has built-in ones.
      if (live && count < 3 && math) add(offlineQuestions(round.grade ?? grade));
      await chain;
      if (!live) return;
      if (count < MIN_QUESTIONS) setFailed(true);
      setMore(false);
    })();
    return () => { live = false; ctrl.abort(); };
  }, [subject, attempt, round]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(ok: boolean | null, pick?: number) {
    if (!qs || busy) return;
    const q = qs[i];
    setBusy(true);
    let correct = ok ?? false;
    if (ok === null && q.kind === "typed") correct = answer.trim() ? (await engine.check(q.given, answer, q.form).catch(() => ({ correct: false }))).correct : false;
    // "I don't know" moves on at once; a real answer gets a beat of feedback first.
    if (pick !== undefined) {
      setFlash({ pick, right: correct });
      if (correct) addXp(5);
      await new Promise((r) => setTimeout(r, correct ? 700 : 1100));
      setFlash(null);
    }
    const next = [...right, correct];
    if (q.skillId) setSkill(q.skillId, correct ? "mastered" : "gap");
    setRight(next);
    setAnswer("");
    setBusy(false);
    // Three misses in a row: the starting point is already clear, so stop instead of grinding through harder questions.
    const streak = next.length >= 3 && next.slice(-3).every((x) => !x);
    if (streak || (i + 1 >= qs.length && !more)) return finish(next);
    // Past the last question so far while more are coming: the next one shows the moment it arrives.
    setI(i + 1);
  }

  /** End the check: step further back if every question at the lowest grade was missed, else place the learner. */
  function finish(next: boolean[]) {
    if (!qs) return;
    stream.current?.abort(); // whatever is still being written won't be asked
    setMore(false);
    const asked = qs.slice(0, next.length);
    const low = globalThis.Math.min(...asked.map((x) => x.grade));
    const { base, lowest } = foundationOf(subject);
    if (low > lowest && asked.every((x, k) => x.grade !== low || !next[k])) {
      setPast({ score: past.score + next.filter(Boolean).length, total: past.total + next.length });
      setQs(null);
      setI(0);
      setRight([]);
      setRound({ subject: base, grade: low - 1 });
      return;
    }
    const placed = place(round.subject, round.grade ?? grade, asked, next);
    // After stepping back, even a clean round sits below the learner's grade: that's still a gap to fix.
    const p = { ...placed, score: placed.score + past.score, total: placed.total + past.total, gap: placed.gap || past.total > 0 };
    const { [subject]: _done, ...unfinished } = useStore.getState().checkResume;
    set({ placement: { ...useStore.getState().placement, [subject]: p }, checkResume: unfinished });
    setPlaced(true);
    setQs(asked);
    setI(next.length);
  }

  // The learner answered every question there was and the stream has now ended: that's the end of the check.
  useEffect(() => {
    if (!more && qs && !busy && !result && right.length > 0 && right.length >= qs.length) finish(right);
  }, [more]); // eslint-disable-line react-hooks/exhaustive-deps


  const q = qs?.[i];
  const target = result?.unitId ? unitById(result.unitId) : null;
  const targetName = target ? t.unit(target) : result?.skillId ? skillTitle(result.skillId, lang) : "";
  const route = target ? `/unit/${target.id}` : result?.skillId ? `/learn/${result.skillId}` : "/student";
  const fromGrade = target?.grade ?? (result?.skillId ? skills.find((s) => s.id === result.skillId)?.grade : grade) ?? grade;

  return (
    <Shell tabs={false} back="/student" title={t("check.title")}>
      <div className="mt-2 flex items-center gap-3">
        <SubjectIcon id={subject} size={40} />
        <div className="min-w-0 flex-1">
          <div className="kicker text-muted">{t("check.title")}</div>
          <div className="font-display text-[22px] leading-tight">{t.subject(subject)} · {t("common.gradeN", { n: grade })}</div>
        </div>
        <Bilog size={52} mood={result ? (result.gap ? "found" : "happy") : flash ? (flash.right ? "happy" : "found") : !qs && !failed ? "think" : "watch"} />
      </div>

      {qs && !result && !failed && (
        <div className="mt-5 flex gap-1.5" aria-hidden>
          {qs.map((_, k) => <span key={k} className={`h-1.5 flex-1 rounded-full transition-colors ${k < i ? "bg-ink/75" : k === i ? "bg-gap" : "bg-ink/15"}`} />)}
          {more && <span className="h-1.5 flex-1 animate-pulse rounded-full bg-ink/10" />}
        </div>
      )}

      {!qs && !failed && (
        <div className="mt-10 text-center" data-testid="check-loading">
          <p className="font-display text-[22px]">{t(past.total ? "check.goingBack" : "check.preparing")}</p>
          <p className="mx-auto mt-2 max-w-[18rem] text-[14px] text-muted">{t(past.total ? "check.goingBackText" : "check.intro")}</p>
          <div className="mx-auto mt-6 h-1 w-40 overflow-hidden rounded-full bg-ink/10"><div className="h-full w-1/3 animate-[slide_1.2s_ease-in-out_infinite] rounded-full bg-gap" /></div>
        </div>
      )}

      {qs && more && !result && i >= qs.length && (
        <div className="mt-10 text-center text-[15px] text-muted" data-testid="check-next-loading">
          <p>{t("check.nextLoading")}</p>
          <div className="mx-auto mt-4 h-1 w-32 overflow-hidden rounded-full bg-ink/10"><div className="h-full w-1/3 animate-[slide_1.2s_ease-in-out_infinite] rounded-full bg-gap" /></div>
        </div>
      )}

      {failed && (
        <div className="mt-10 text-center">
          <p className="text-[16px]">{t("check.needsConnection")}</p>
          <button className="btn-primary mt-4" onClick={() => {
            // Too few questions came through to place from: ask the round again from the start.
            setFailed(false); setQs(null); setI(0); setRight([]); setAttempt((n) => n + 1);
          }}>{t("check.retry")}</button>
        </div>
      )}

      <AnimatePresence mode="wait">
        {q && !result && !failed && (
          <motion.section key={i} className="mt-6" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }}
            data-testid="check-question">
            <div className="kicker text-muted">{more ? t("check.questionN", { n: i + 1 }) : t("check.questionOf", { n: i + 1, total: qs!.length })}</div>
            <h2 className="mt-2 text-[24px] leading-snug"><RichText text={q.prompt} /></h2>

            {q.kind === "typed" ? (
              <>
                <div className="mt-4 rounded-2xl bg-white/55 px-4 py-4 text-[26px]"><TeX tex={quickTex(q.given)} /></div>
                <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void submit(null, -1); }}>
                  <input className={`input transition-colors ${flash ? (flash.right ? "!border-ok !bg-ok-soft/80" : "!border-gap/60 !bg-gap-soft/60") : ""}`} value={answer} onChange={(e) => setAnswer(e.target.value)} data-math inputMode="text" enterKeyHint="done"
                    autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder={t("trace.answer")} data-testid="check-answer" />
                  <button className={`${flash?.right ? "btn-ok" : "btn-primary"} shrink-0`} disabled={!answer.trim() || busy} data-testid="check-submit">
                    {flash ? <Icon name={flash.right ? "check" : "close"} size={20} /> : "OK"}
                  </button>
                </form>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <MicButton onText={setAnswer} testId="answer-mic" />
                  <button className="text-[14px] text-muted underline decoration-dotted underline-offset-4" onClick={() => void submit(false)} data-testid="check-dont-know">{t("check.dontKnow")}</button>
                </div>
              </>
            ) : (
              <>
                <div className="mt-4 space-y-2" role="radiogroup">
                  {q.choices.map((c, k) => {
                    const picked = flash?.pick === k;
                    // After a miss, the right choice lights up too, so the check still teaches.
                    const state = !flash ? "idle" : picked ? (flash.right ? "right" : "wrong") : !flash.right && k === q.answer ? "answer" : "dim";
                    return (
                      <motion.button key={k} role="radio" aria-checked={picked} onClick={() => void submit(k === q.answer, k)} disabled={busy}
                        animate={state === "right" ? { scale: [1, 1.03, 1] } : state === "wrong" ? { x: [0, -6, 6, -3, 0] } : { scale: 1, x: 0 }}
                        transition={{ duration: 0.35 }} whileTap={busy ? undefined : { scale: 0.97 }}
                        className={`flex w-full items-center gap-4 rounded-2xl border border-white/60 px-3 py-3.5 text-left text-[17px] transition-colors duration-200 ${
                          state === "right" || state === "answer" ? "bg-ok-soft/90" : state === "wrong" ? "bg-gap-soft/90" : "bg-white/45"} ${state === "dim" ? "opacity-45" : ""}`}
                        data-testid={`check-choice-${k}`}>
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-[14px] transition-colors duration-200 ${
                          state === "right" || state === "answer" ? "bg-ok text-white" : state === "wrong" ? "bg-gap text-white" : "bg-white/55 text-muted"}`}>
                          {state === "right" || state === "answer" ? <Icon name="check" size={16} /> : state === "wrong" ? <Icon name="close" size={16} /> : "ABCD"[k]}
                        </span>
                        <span className="flex-1"><RichText text={c} /></span>
                      </motion.button>
                    );
                  })}
                </div>
                <button className="mt-4 text-[14px] text-muted underline decoration-dotted underline-offset-4" onClick={() => void submit(false)} data-testid="check-dont-know">{t("check.dontKnow")}</button>
              </>
            )}
          </motion.section>
        )}

        {result && (
          <motion.section key="result" className="mt-8" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} data-testid="check-result">
            <div className={`kicker ${result.gap ? "text-gap-dark" : "text-ok-dark"}`}>{t("check.resultKicker")}</div>
            <h2 className="mt-1 text-[30px] leading-[1.1]">
              {result.score === result.total ? t("check.readyTitle", { grade }) : result.gap ? t("check.startWith") : t("check.currentTitle")}
            </h2>
            <div className={`mt-4 rounded-2xl px-4 py-3.5 ${result.gap ? "bg-gap-soft/80" : "bg-white/60"}`} data-testid="check-target">
              <div className="kicker text-muted">{t("common.gradeN", { n: fromGrade })}</div>
              <div className="mt-0.5 font-display text-[21px] leading-tight">{targetName}</div>
            </div>
            <p className="mt-3 text-[15.5px] leading-snug text-muted">
              {result.gap
                ? t(qs!.some((qq, k) => qq.level === "current" && right[k]) ? "check.gapTextSome" : "check.gapText", { grade, from: fromGrade })
                : result.score === result.total
                  ? t("check.readyText", { grade })
                  : t("check.currentText", { grade })}
            </p>
            <p className="mt-4 flex items-center gap-2 text-[14px] text-muted"><Icon name="check" size={15} className="text-ok" /> {t("check.score", { score: result.score, total: result.total })}</p>
            <button className={`${result.gap ? "btn-gap" : "btn-primary"} mt-6 w-full !text-lg`} onClick={() => nav(route)} data-testid="check-start">
              {t("check.startLearning")} <Icon name="arrow" size={18} />
            </button>
            <button className="btn-ghost mt-3 w-full" onClick={() => nav("/student")}>{t("check.backHome")}</button>
          </motion.section>
        )}
      </AnimatePresence>
    </Shell>
  );
}
