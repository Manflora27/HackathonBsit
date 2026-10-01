import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { Math, quickTex } from "../components/Math";
import { Shell } from "../components/Shell";
import { BackButton, JourneyBar } from "../components/ui";
import { SkillMap } from "../components/SkillMap";
import { skillById, skills, skillTitle } from "../data";
import { engine } from "../engine/client";
import { useStore } from "../store";

/**
 * Gap tracing is a deterministic graph walk, not an AI decision:
 * probe each prerequisite of the current skill; a failed probe moves the
 * search one level down; when every prerequisite passes, the current skill
 * is the root gap.
 */
export default function Trace() {
  const nav = useNavigate();
  const { trace, set, setSkill, progress, lang, log, reduceMotion } = useStore();
  const reduce = reduceMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fil = lang === "fil";
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<null | "pass" | "fail">(null);
  const [passed, setPassed] = useState<string[]>([]);

  const current = trace?.path[trace.path.length - 1] ?? null;
  const queue = useMemo(() => {
    if (!current) return [];
    return skillById[current].prereqs.filter((p) => !passed.includes(p) && progress[p] !== "mastered");
  }, [current, passed, progress]);
  const probeSkill = trace?.rootSkill ? null : queue[0] ?? null;
  const probe = probeSkill ? skillById[probeSkill].probes[0] : null;

  // When nothing is left to probe, the current skill is the root gap.
  useEffect(() => {
    if (trace && !trace.rootSkill && current && queue.length === 0) {
      set({ trace: { ...trace, rootSkill: current } });
      setSkill(current, "gap");
      useStore.getState().updateAttempt(trace.attemptId, { rootSkill: current });
      log({ action: "gap trace", suggestion: trace.path.join(" → "), decision: `root gap: ${current}`, actor: "student" });
    }
  }, [queue.length, current]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!trace) {
    return (
      <Shell>
        <div className="card text-center">
          <div aria-hidden className="text-3xl">🧭</div>
          <p className="mt-2 font-semibold">{fil ? "Wala pang hinahanap na gap." : "No gap hunt in progress."}</p>
          <p className="text-sm text-muted">{fil ? "Mag-check ng solusyon para magsimula." : "Check a solution to start one."}</p>
          <button className="btn-primary mt-4" onClick={() => nav("/student")}>{fil ? "Pumunta sa Home" : "Go home"}</button>
        </div>
      </Shell>
    );
  }

  function goDeeper(skillId: string) {
    if (!trace) return;
    set({ trace: { ...trace, path: [...trace.path, skillId] } });
  }

  async function submitProbe() {
    if (!probe || !probeSkill || !trace) return;
    const r = await engine.check(probe.given, answer, probe.form);
    setFeedback(r.correct ? "pass" : "fail");
    setTimeout(() => {
      setFeedback(null);
      setAnswer("");
      if (r.correct) {
        setPassed((p) => [...p, probeSkill]);
        setSkill(probeSkill, "mastered");
      } else {
        goDeeper(probeSkill);
      }
    }, 900);
  }

  // "I'm not sure yet" is an honest answer: it counts as a miss, without the pressure of typing a guess.
  function unsure() {
    if (!probeSkill) return;
    setFeedback("fail");
    setTimeout(() => {
      setFeedback(null);
      setAnswer("");
      goDeeper(probeSkill);
    }, 900);
  }

  const root = trace.rootSkill;
  const top = skillById[trace.path[0]];
  const rootSkill = root ? skillById[root] : null;
  const statuses = { ...progress };
  for (const p of trace.path.slice(1)) if (!root || p !== root) statuses[p] = statuses[p] ?? "unknown";

  // Time-travel timeline: from the problem's grade back to the earliest grade in the map.
  const minGrade = Math_min(...skills.map((s) => s.grade));
  const grades = Array.from({ length: top.grade - minGrade + 1 }, (_, i) => top.grade - i);
  const deepest = skillById[trace.path[trace.path.length - 1]].grade;
  const lookingAt = probeSkill ? skillById[probeSkill].grade : deepest;

  return (
    <Shell>
      <BackButton onClick={() => nav("/student")} label={fil ? "Home" : "Home"} />
      <div className="mt-2">
        <JourneyBar stage="gap" />
      </div>

      <h1 className="text-2xl font-extrabold tracking-tight">
        {root ? (fil ? "Nahanap na ang ugat ng gap" : "Found the root gap") : fil ? "Bumabalik tayo sa nakaraan…" : "Traveling back in time…"}
      </h1>
      {!root && (
        <p className="mt-1 text-muted">
          {fil
            ? "Ilang mabilis na tanong mula sa mga naunang grade. Hindi ito test — paraan lang ito para mahanap kung saan nagsimula."
            : "A few quick questions from earlier grades. This isn't a test — it's how we find where it started."}
        </p>
      )}

      <ol className="mt-4 flex items-center" aria-label={fil ? "Timeline ng grade" : "Grade timeline"}>
        {grades.map((g, i) => {
          const reached = g >= deepest;
          const here = g === lookingAt && !root;
          const isRootGrade = root && g === rootSkill?.grade;
          return (
            <li key={g} className="flex flex-1 items-center last:flex-none">
              <span
                className={`flex h-11 min-w-11 shrink-0 flex-col items-center justify-center rounded-2xl border-2 px-2 text-center transition-colors duration-500 ${
                  isRootGrade
                    ? "border-gap bg-gap-soft text-gap"
                    : here
                      ? "border-brand bg-brand-soft text-brand-ink"
                      : reached
                        ? "border-gap-line bg-card text-ink"
                        : "border-line bg-card text-muted"
                }`}
                aria-current={here ? "step" : undefined}
              >
                <span className="text-[10px] font-semibold uppercase leading-none">Grade</span>
                <span className="text-base font-extrabold leading-tight">{g}</span>
              </span>
              {i < grades.length - 1 && (
                <span aria-hidden className={`mx-1 h-1 flex-1 rounded-full transition-colors duration-500 ${g - 1 >= deepest ? "bg-gap" : "bg-line"}`} />
              )}
            </li>
          );
        })}
      </ol>
      <p className="sr-only" aria-live="polite">
        {trace.path.map((s) => `Grade ${skillById[s].grade}`).join(" → ")}
      </p>

      {probe && probeSkill && (
        <motion.div key={probeSkill} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card mt-4" data-testid="probe">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip bg-brand-soft text-brand-ink">{fil ? "Mabilis na check" : "Quick check"}</span>
            <span className="chip bg-paper text-muted">Grade {skillById[probeSkill].grade}</span>
          </div>
          <div className="mt-2 text-sm font-semibold text-muted">{skillTitle(probeSkill, lang)}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-2xl">
            <span className="text-base text-muted">{probe.prompt}:</span>
            <Math tex={quickTex(probe.given)} />
          </div>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (answer.trim()) submitProbe();
            }}
          >
            <input
              className="input"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={fil ? "Sagot mo" : "Your answer"}
              aria-label={fil ? "Sagot mo" : "Your answer"}
              data-testid="probe-answer"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              disabled={!!feedback}
            />
            <button className="btn-primary shrink-0" data-testid="probe-submit" disabled={!!feedback}>
              OK
            </button>
          </form>
          {!feedback && (
            <button className="mt-2 min-h-11 text-sm font-medium text-muted underline underline-offset-4 hover:text-ink" onClick={unsure} data-testid="probe-unsure">
              {fil ? "Hindi pa ako sigurado" : "I'm not sure yet"}
            </button>
          )}
          <div aria-live="polite">
            {feedback && (
              <p className={`gf-rise mt-3 flex items-center gap-2 rounded-2xl px-3 py-2 font-semibold ${feedback === "pass" ? "bg-ok-soft text-ok" : "bg-gap-soft text-gap"}`}>
                <span aria-hidden>{feedback === "pass" ? "✓" : "⏪"}</span>
                {feedback === "pass"
                  ? fil
                    ? "Kaya mo ito. Hindi ito ang gap."
                    : "You've got this one. Not the gap."
                  : fil
                    ? "Magandang clue! Dito pa tayo bababa."
                    : "Good clue! Let's look one level deeper."}
              </p>
            )}
          </div>
        </motion.div>
      )}

      {rootSkill && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: reduce ? 0 : 0.3 + trace.path.length * 0.8 }}
          className="card mt-4 border-gap-line bg-gap-soft/60"
          data-testid="root-gap"
        >
          <div className="flex items-center gap-2">
            <span aria-hidden className="text-2xl">💡</span>
            <span className="text-sm font-bold uppercase tracking-wide text-gap">{fil ? "Natuklasan mo" : "You discovered it"}</span>
          </div>
          <div className="mt-2 text-2xl font-extrabold">{skillTitle(rootSkill.id, lang)}</div>
          {top.grade !== rootSkill.grade ? (
            <p className="mt-2 text-lg">
              {fil ? (
                <>
                  Ang pagkakamali mo sa <b>Grade {top.grade}</b> ay nagmula sa isang skill sa <b>Grade {rootSkill.grade}</b>.
                </>
              ) : (
                <>
                  Your <b>Grade {top.grade}</b> mistake comes from a <b>Grade {rootSkill.grade}</b> skill.
                </>
              )}
            </p>
          ) : (
            <p className="mt-2 text-lg">{fil ? "Ito ang eksaktong skill na aayusin natin." : "This is the exact skill we'll fix."}</p>
          )}
          <p className="mt-2 rounded-2xl bg-card/70 px-3 py-2 text-[15px]">
            {fil ? "Hindi ka mahina sa math — isang skill lang ito, at kaya itong ayusin." : "You're not bad at math — it's one skill, and it's fixable."}
            {rootSkill.matatag ? <span className="text-muted"> · MATATAG {rootSkill.matatag}</span> : ""}
          </p>
          <button className="btn-primary mt-4 w-full" onClick={() => nav(`/learn/${rootSkill.id}`)} data-testid="start-roadmap">
            {fil ? "Simulan ang roadmap" : "Start the roadmap"} →
          </button>
        </motion.div>
      )}

      <div className="mt-4">
        <SkillMap statuses={statuses} path={trace.path} root={root} animate height={340} />
      </div>
    </Shell>
  );
}

function Math_min(...n: number[]) {
  return n.reduce((a, b) => (a < b ? a : b));
}
