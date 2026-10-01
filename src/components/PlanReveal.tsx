import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { buildPlan, startGrade, type SubjectId } from "../data/curriculum";
import { useStore } from "../store";
import { useT } from "../i18n";

/** The enrollment plan assembling itself: skeleton rows that resolve into units, one subject at a time. */
export function PlanReveal({ subjects, grade, onReady }: { subjects: SubjectId[]; grade: number | null; onReady?: () => void }) {
  const { reduceMotion } = useStore();
  const t = useT();
  const [ready, setReady] = useState(reduceMotion);
  useEffect(() => {
    if (reduceMotion) return void onReady?.();
    const id = setTimeout(() => {
      setReady(true);
      onReady?.();
    }, 1100);
    return () => clearTimeout(id);
  }, [reduceMotion]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-5" data-testid="plan" aria-busy={!ready}>
      {subjects.map((s) => {
        const units = buildPlan(s, startGrade(s, grade));
        // Self-learners get no school framing: subject only, no grade, no quarters.
        const head = grade === null ? t.subject(s) : `${t.subject(s)} · ${t("common.gradeN", { n: startGrade(s, grade) })}`;
        return (
          <section key={s}>
            <div className="kicker text-muted">{head}</div>
            <ul className="mt-2 divide-y divide-line rounded-2xl border border-line bg-white/40">
              {units.map((u, i) => (
                <li key={u.id} className="flex items-center gap-3 px-4 py-3">
                  {ready ? (
                    <motion.div className="flex w-full items-center gap-3" initial={reduceMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: reduceMotion ? 0 : i * 0.05 }}>
                      {/* School quarters mean nothing to self-learners (grade === null): the plan is just an ordered list. */}
                      {grade !== null && <span className="chip shrink-0 !px-2 text-[12px]">Q{u.quarter}</span>}
                      <span className="flex-1 text-[16px]">{t.unit(u)}</span>
                    </motion.div>
                  ) : (
                    <div className="flex w-full animate-pulse items-center gap-3" aria-hidden>
                      <span className="h-5 w-9 rounded-full bg-soft" />
                      <span className="h-4 flex-1 rounded-full bg-soft" style={{ maxWidth: `${55 + ((i * 17) % 35)}%` }} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
