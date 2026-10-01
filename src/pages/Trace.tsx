import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { Math, quickTex } from "../components/Math";
import { Shell } from "../components/Shell";
import { SkillMap } from "../components/SkillMap";
import { skillById, skillTitle } from "../data";
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
  const { trace, set, setSkill, progress, lang, log } = useStore();
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
        <p>{fil ? "Wala pang ina-analyze na problem." : "No problem analyzed yet."}</p>
        <button className="btn-primary mt-3" onClick={() => nav("/student")}>OK</button>
      </Shell>
    );
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
        set({ trace: { ...trace, path: [...trace.path, probeSkill] } });
      }
    }, 900);
  }

  const root = trace.rootSkill;
  const top = skillById[trace.path[0]];
  const rootSkill = root ? skillById[root] : null;
  const statuses = { ...progress };
  for (const p of trace.path.slice(1)) if (!root || p !== root) statuses[p] = statuses[p] ?? "unknown";

  return (
    <Shell>
      <h1 className="text-xl font-bold">
        {root ? (fil ? "Nahanap na ang ugat ng gap" : "Found the root gap") : fil ? "Hinahanap ang ugat…" : "Tracing it back…"}
      </h1>

      <div className="mt-3">
        <SkillMap statuses={statuses} path={trace.path} root={root} animate height={430} />
      </div>
      <p className="mt-2 text-center text-sm text-muted" aria-live="polite">
        {trace.path.map((s) => `Grade ${skillById[s].grade}`).join("  →  ")}
      </p>

      {probe && probeSkill && (
        <motion.div key={probeSkill} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card mt-4" data-testid="probe">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">
            {fil ? "Mabilis na check" : "Quick check"} · {skillTitle(probeSkill, lang)} · Grade {skillById[probeSkill].grade}
          </div>
          <div className="mt-2 flex items-center gap-2 text-xl">
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
            <input className="input" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={fil ? "Sagot mo" : "Your answer"}
              data-testid="probe-answer" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
            <button className="btn-primary shrink-0" data-testid="probe-submit">OK</button>
          </form>
          {feedback && (
            <p className={`mt-2 font-semibold ${feedback === "pass" ? "text-ok" : "text-gap"}`}>
              {feedback === "pass"
                ? fil ? "✓ Kaya mo ito. Hindi ito ang gap." : "✓ You've got this one. Not the gap."
                : fil ? "! Dito pa tayo bababa." : "! Let's look one level deeper."}
            </p>
          )}
        </motion.div>
      )}

      {rootSkill && (
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 + trace.path.length * 0.8 }}
          className="card mt-4 border-gap bg-gap-soft/60" data-testid="root-gap">
          <div className="text-sm font-bold uppercase tracking-wide text-gap">{fil ? "Nahanap na" : "Found it"}</div>
          <div className="mt-1 text-2xl font-extrabold">{skillTitle(rootSkill.id, lang)}</div>
          {top.grade !== rootSkill.grade ? (
            <p className="mt-2 text-lg">
              {fil ? (
                <>Ang pagkakamali mo sa <b>Grade {top.grade}</b> ay nagmula sa isang skill sa <b>Grade {rootSkill.grade}</b>.</>
              ) : (
                <>Your <b>Grade {top.grade}</b> mistake comes from a <b>Grade {rootSkill.grade}</b> skill.</>
              )}
            </p>
          ) : (
            <p className="mt-2 text-lg">{fil ? "Ito ang eksaktong skill na aayusin natin." : "This is the exact skill we'll fix."}</p>
          )}
          <p className="mt-1 text-sm text-muted">
            {fil ? "Hindi ka mahina sa math — isang skill lang ito, at kaya itong ayusin." : "You're not bad at math — it's one skill, and it's fixable."}
            {rootSkill.matatag ? ` · MATATAG ${rootSkill.matatag}` : ""}
          </p>
          <button className="btn-primary mt-4 w-full" onClick={() => nav(`/learn/${rootSkill.id}`)} data-testid="start-roadmap">
            {fil ? "Simulan ang roadmap" : "Start the roadmap"} →
          </button>
        </motion.div>
      )}
    </Shell>
  );
}
