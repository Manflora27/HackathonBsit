import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { Math, quickTex } from "../components/Math";
import { PathMap } from "../components/PathMap";
import { Shell } from "../components/Shell";
import { Icon } from "../components/Icon";
import { skillById, skillTitle } from "../data";
import { engine } from "../engine/client";
import { useStore } from "../store";
import { useT } from "../i18n";

/**
 * Gap tracing is a deterministic graph walk, not an AI decision:
 * probe each prerequisite of the current skill; a failed probe moves the
 * search one level down; when every prerequisite passes, the current skill
 * is the root gap.
 */
export default function Trace() {
  const nav = useNavigate();
  const { trace, set, setSkill, progress, lang } = useStore();
  const t = useT();
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

  useEffect(() => {
    if (trace && !trace.rootSkill && current && queue.length === 0) {
      set({ trace: { ...trace, rootSkill: current } });
      setSkill(current, "gap");
      useStore.getState().updateAttempt(trace.attemptId, { rootSkill: current });
    }
  }, [queue.length, current]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!trace) {
    return (
      <Shell back="/student">
        <p className="mt-4">{t("trace.noProblemAnalyzedYet")}</p>
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
    }, 1000);
  }


  const root = trace.rootSkill;
  const top = skillById[trace.path[0]];
  const rootSkill = root ? skillById[root] : null;
  const revealDelay = 0.4 + trace.path.length * 0.75;

  return (
    <Shell tabs={false} back="/student" title={root ? (t("trace.found")) : t("trace.diggingGap")}>
      <div className="flex justify-center">
        <span className="chip glass text-[13px]">{trace.path.map((s) => `G${skillById[s].grade}`).join(" → ")}{!root && " → ?"}</span>
      </div>
      <div className="mt-3">
        <PathMap statuses={progress} path={trace.path} root={root} animate only={trace.path}
          guide={root ? "root" : feedback === "pass" ? "happy" : feedback === "fail" ? "found" : "dig"} />
      </div>

      <AnimatePresence mode="wait">
        {probe && probeSkill && (
          <motion.div key={probeSkill} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className={`card mt-2 ${feedback === "fail" ? "shake" : ""}`} data-testid="probe">
            <div className="kicker text-muted">
              {t("trace.quickCheck")} · {t("common.gradeN", { n: skillById[probeSkill].grade })}
            </div>
            <div className="font-display text-lg font-semibold leading-tight">{skillTitle(probeSkill, lang)}</div>
            <div className="mt-3 flex items-center gap-2 rounded-2xl bg-soft px-4 py-3 text-[24px]">
              <span className="font-display text-base text-muted">{probe.prompt}:</span>
              <Math tex={quickTex(probe.given)} />
            </div>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (answer.trim()) submitProbe();
              }}
            >
              <input className="input" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={t("trace.answer")}
                data-math inputMode="text" enterKeyHint="done"
                data-testid="probe-answer" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
              <button className="btn-primary shrink-0" data-testid="probe-submit">OK</button>
            </form>
            {feedback && (
              <motion.p initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className={`mt-3 rounded-2xl border border-line px-3 py-2 font-display text-[17px] ${feedback === "pass" ? "bg-ok text-white" : "bg-gap"}`}>
                {feedback === "pass"
                  ? t("trace.youveGotOneNot")
                  : t("trace.letsLookOneLevel")}
              </motion.p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {rootSkill && (
        <motion.div initial={{ opacity: 0, y: 40, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: revealDelay, type: "spring", stiffness: 240, damping: 18 }}
          className="card mt-2 !p-0" data-testid="root-gap">
          <div className="px-5 pt-5">
            <div className="kicker text-gap-dark">{t("trace.foundRoot")}</div>
          </div>
          <div className="px-5 pb-5 pt-1">
            <div className="font-display text-[30px] leading-tight">{skillTitle(rootSkill.id, lang)}</div>
            {top.grade !== rootSkill.grade ? (
              <div className="mt-3 flex items-center gap-3 rounded-2xl bg-soft p-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line bg-brand font-display text-white">G{top.grade}</span>
                <span className="font-display text-xl">←</span>
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line bg-gap font-display">G{rootSkill.grade}</span>
                <span className="text-[15px] leading-snug">
                  {t.rich("trace.mistakeComesFrom", {
                    from: <b>{t("trace.gradeN", { n: top.grade })}</b>,
                    to: <b>{t("trace.gradeN", { n: rootSkill.grade })}</b>,
                  })}
                </span>
              </div>
            ) : (
              <p className="mt-2 text-[16px]">{t("trace.exactSkillWellFix")}</p>
            )}
            <p className="mt-3 text-[15px] text-muted">
              {t("trace.youreNotBadMath")}
              {rootSkill.matatag ? ` · MATATAG ${rootSkill.matatag}` : ""}
            </p>
            <button className="btn-primary mt-4 w-full !text-lg" onClick={() => nav(`/learn/${rootSkill.id}`)} data-testid="start-roadmap">
              {t("trace.fixMyGap")} <Icon name="arrow" size={18} />
            </button>
          </div>
        </motion.div>
      )}
    </Shell>
  );
}
