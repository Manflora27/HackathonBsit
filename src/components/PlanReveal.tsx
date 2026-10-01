import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { buildPlan, subjectLabel, verifierMeta, type SubjectId } from "../data/curriculum";
import { useStore } from "../store";
import { Icon } from "./Icon";

/** The enrollment plan assembling itself: skeleton rows that resolve into units, one subject at a time. */
export function PlanReveal({ subjects, grade }: { subjects: SubjectId[]; grade: number }) {
  const { lang, reduceMotion } = useStore();
  const [ready, setReady] = useState(reduceMotion);
  useEffect(() => {
    if (reduceMotion) return;
    const id = setTimeout(() => setReady(true), 1100);
    return () => clearTimeout(id);
  }, [reduceMotion]);

  return (
    <div className="space-y-5" data-testid="plan" aria-busy={!ready}>
      {subjects.map((s) => {
        const units = buildPlan(s, grade);
        return (
          <section key={s}>
            <div className="kicker text-muted">{subjectLabel(s, lang)} · {lang === "fil" ? "Grade" : "Grade"} {grade}</div>
            <ul className="mt-2 divide-y divide-line rounded-2xl border border-line bg-white/40">
              {units.map((u, i) => (
                <li key={u.id} className="flex items-center gap-3 px-4 py-3">
                  {ready ? (
                    <motion.div className="flex w-full items-center gap-3" initial={reduceMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: reduceMotion ? 0 : i * 0.05 }}>
                      <span className="chip shrink-0 !px-2 text-[12px]">Q{u.quarter}</span>
                      <span className="flex-1 text-[16px]">{u.title[lang]}</span>
                      <span className={`flex items-center gap-1 text-[12px] ${verifierMeta[u.verifier].verified ? "text-ok-dark" : "text-muted"}`}
                        title={verifierMeta[u.verifier][lang]}>
                        {verifierMeta[u.verifier].verified ? <Icon name="check" size={14} strokeWidth={2.2} /> : <span aria-hidden>AI</span>}
                        <span className="sr-only">{verifierMeta[u.verifier][lang]}</span>
                      </span>
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
