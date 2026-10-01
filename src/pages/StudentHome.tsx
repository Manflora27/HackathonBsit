import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Math, quickTex } from "../components/Math";
import { EngineBadge, Shell } from "../components/Shell";
import { SkillMap } from "../components/SkillMap";
import { demoAssignment, problemById, skillTitle } from "../data";
import { KYLA_ID } from "../data/seedClass";
import { useT } from "../i18n";
import { useStore } from "../store";

export default function StudentHome() {
  const t = useT();
  const nav = useNavigate();
  const { progress, attempts, lang, shareSkillMap, set, practiceAssignments, trace } = useStore();
  const [custom, setCustom] = useState("");
  const fil = lang === "fil";
  const assigned = practiceAssignments.filter((p) => p.studentIds.includes(KYLA_ID));

  const statusOf = (pid: string) => {
    const mine = attempts.filter((a) => a.problemId === pid);
    if (!mine.length) return null;
    const last = mine[mine.length - 1];
    return last.analysis.errorIndex === null && last.analysis.complete ? "done" : "gap";
  };

  return (
    <Shell>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{fil ? "Hi, Kyla!" : "Hi, Kyla!"}</h1>
        <EngineBadge />
      </div>

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-muted">{t("assignments")}</h2>
      {assigned.map((p) => (
        <Link key={p.id} to={`/learn/${p.skillId}`} className="card mt-2 block border-gap/50 bg-gap-soft/50">
          <div className="text-sm font-semibold text-gap">{fil ? "Bagong practice mula kay Ms. Santos" : "New practice from Ms. Santos"}</div>
          <div className="font-bold">{skillTitle(p.skillId, lang)}</div>
        </Link>
      ))}
      <div className="card mt-2" data-testid="assignment-card">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-bold">
              {demoAssignment.title} · {fil ? "mula kay" : "from"} {demoAssignment.teacher}
            </div>
            <div className="text-sm text-muted">
              {fil ? "Due sa Biyernes" : `Due ${demoAssignment.due}`} · {fil ? "Makikita ng teacher mo" : "Your teacher can see this"}
            </div>
          </div>
        </div>
        <ul className="mt-3 divide-y divide-line">
          {demoAssignment.problemIds.map((pid, i) => {
            const p = problemById[pid];
            const st = statusOf(pid);
            return (
              <li key={pid}>
                <button
                  onClick={() => nav(`/solve/${pid}?assignment=${demoAssignment.id}`)}
                  className="flex w-full items-center gap-3 py-3 text-left"
                  data-testid={`problem-${pid}`}
                >
                  <span className="w-6 text-sm text-muted">{i + 1}.</span>
                  <span className="text-sm text-muted">{p.prompt}:</span>
                  <Math tex={quickTex(problemById[pid].given)} />
                  <span className="ml-auto">
                    {st === "done" && <span className="chip bg-ok-soft text-ok">✓ {fil ? "Tapos" : "Done"}</span>}
                    {st === "gap" && <span className="chip bg-gap-soft text-gap">! {fil ? "May nahanap na gap" : "Gap found"}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {trace && !trace.rootSkill && (
          <button className="btn-gap mt-2 w-full" onClick={() => nav("/trace")}>
            {fil ? "Ituloy ang paghahanap ng gap" : "Continue finding your gap"} →
          </button>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t("mySkillMap")}</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={shareSkillMap} onChange={(e) => set({ shareSkillMap: e.target.checked })} />
          {shareSkillMap ? (fil ? "Ibinahagi sa teacher" : "Shared with my teacher") : t("onlyYou")}
        </label>
      </div>
      <div className="mt-2">
        <SkillMap statuses={progress} root={trace?.rootSkill ?? null} path={trace?.rootSkill ? trace.path : []} height={460} />
      </div>
      <p className="mt-2 text-sm text-muted">
        <span className="chip bg-ok-soft text-ok">✓ {fil ? "kaya mo na" : "mastered"}</span>{" "}
        <span className="chip bg-gap-soft text-gap">! {fil ? "gap" : "gap"}</span>{" "}
        {fil ? "Puti = hindi pa na-check." : "White = not checked yet."}
      </p>

      <div className="card mt-8">
        <h2 className="font-bold">{t("stuck")}</h2>
        <p className="text-sm text-muted">{fil ? "Isulat ang problem, tapos ang mga step mo." : "Type the problem, then your steps."}</p>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (custom.trim()) nav(`/solve/custom?given=${encodeURIComponent(custom.trim())}`);
          }}
        >
          <input className="input" placeholder="e.g. 3(x-2)=12" value={custom} onChange={(e) => setCustom(e.target.value)} />
          <button className="btn-primary shrink-0">{t("checkWork")}</button>
        </form>
      </div>
    </Shell>
  );
}
