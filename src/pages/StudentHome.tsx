import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Math, quickTex } from "../components/Math";
import { EngineBadge, Shell } from "../components/Shell";
import { SkillMap } from "../components/SkillMap";
import { demoAssignment, problemById, skills, skillTitle } from "../data";
import { KYLA_ID } from "../data/seedClass";
import { useT } from "../i18n";
import { useStore } from "../store";

export default function StudentHome() {
  const t = useT();
  const nav = useNavigate();
  const { progress, attempts, lang, practiceAssignments, trace } = useStore();
  const [custom, setCustom] = useState("");
  const fil = lang === "fil";
  const assigned = practiceAssignments.filter((p) => p.studentIds.includes(KYLA_ID));
  const mastered = skills.filter((s) => progress[s.id] === "mastered").length;
  const fixed = attempts.filter((a) => a.rootSkill && progress[a.rootSkill] === "mastered").length;

  const statusOf = (pid: string) => {
    const mine = attempts.filter((a) => a.problemId === pid);
    if (!mine.length) return null;
    const last = mine[mine.length - 1];
    return last.analysis.errorIndex === null && last.analysis.complete ? "done" : "gap";
  };

  // One obvious next step when a gap hunt is in progress.
  const resume = trace
    ? trace.rootSkill
      ? { to: `/learn/${trace.rootSkill}`, title: fil ? "Ituloy ang lesson" : "Continue your lesson", sub: skillTitle(trace.rootSkill, lang) }
      : { to: "/trace", title: fil ? "Ituloy ang paghahanap ng gap" : "Continue finding your gap", sub: fil ? "Ilang mabilis na tanong na lang" : "Just a few quick questions left" }
    : null;

  return (
    <Shell tabs>
      <section className="gf-rise">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-extrabold tracking-tight">{fil ? "Hi, Kyla! 👋" : "Hi, Kyla! 👋"}</h1>
          <EngineBadge />
        </div>
        <p className="mt-1 text-muted">
          {fil ? "Bawat pagkakamali ay clue. Tuklasin natin ang kulang." : "Every mistake is a clue. Let's discover what's missing."}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Link to="/progress" className="card p-4! transition hover:border-ok-line">
            <div className="text-2xl font-extrabold text-ok">
              {mastered}
              <span className="text-base font-semibold text-muted">/{skills.length}</span>
            </div>
            <div className="text-sm text-muted">{fil ? "skills na kaya mo" : "skills mastered"}</div>
          </Link>
          <Link to="/progress" className="card p-4! transition hover:border-gap-line">
            <div className="text-2xl font-extrabold text-gap">{fixed}</div>
            <div className="text-sm text-muted">{fil ? "gap na naayos" : "gaps found & fixed"}</div>
          </Link>
        </div>
      </section>

      {resume && (
        <button
          onClick={() => nav(resume.to)}
          className="gf-rise mt-4 flex w-full items-center gap-4 rounded-card bg-brand p-4 text-left text-white shadow-md transition active:scale-[.99]"
        >
          <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-xl">▶</span>
          <span className="min-w-0">
            <span className="block text-xs font-semibold uppercase tracking-wider text-white/80">{fil ? "Ituloy" : "Pick up where you left off"}</span>
            <span className="block font-bold">{resume.title}</span>
            <span className="block truncate text-sm text-white/85">{resume.sub}</span>
          </span>
        </button>
      )}

      <h2 className="eyebrow mt-7">{t("assignments")}</h2>
      {assigned.map((p) => (
        <Link key={p.id} to={`/learn/${p.skillId}`} className="card mt-2 flex items-center gap-3 border-gap-line bg-gap-soft/60">
          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-card text-lg">✨</span>
          <span>
            <span className="block text-sm font-semibold text-gap">{fil ? "Bagong practice mula kay Ms. Santos" : "New practice from Ms. Santos"}</span>
            <span className="block font-bold">{skillTitle(p.skillId, lang)}</span>
          </span>
        </Link>
      ))}
      <div className="card mt-2" data-testid="assignment-card">
        <div className="font-bold">
          {demoAssignment.title} · {fil ? "mula kay" : "from"} {demoAssignment.teacher}
        </div>
        <div className="text-sm text-muted">
          {fil ? "Due sa Biyernes" : `Due ${demoAssignment.due}`} · {fil ? "Makikita ng teacher mo" : "Your teacher can see this"}
        </div>
        <ul className="mt-3 space-y-2">
          {demoAssignment.problemIds.map((pid, i) => {
            const p = problemById[pid];
            const st = statusOf(pid);
            return (
              <li key={pid}>
                <button
                  onClick={() => nav(`/solve/${pid}?assignment=${demoAssignment.id}`)}
                  className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-line bg-paper/60 px-3 py-2 text-left transition hover:border-brand/40 hover:bg-brand-soft/40"
                  data-testid={`problem-${pid}`}
                >
                  <span
                    aria-hidden
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      st === "done" ? "bg-ok text-white" : st === "gap" ? "bg-gap-soft text-gap" : "bg-card text-muted"
                    }`}
                  >
                    {st === "done" ? "✓" : st === "gap" ? "!" : i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-muted">{p.prompt}</span>
                    <Math tex={quickTex(problemById[pid].given)} className="text-lg" />
                  </span>
                  {st === "done" && <span className="chip bg-ok-soft text-ok">{fil ? "Tapos" : "Done"}</span>}
                  {st === "gap" && <span className="chip bg-gap-soft text-gap">{fil ? "May nahanap na gap" : "Gap found"}</span>}
                  {!st && <span aria-hidden className="text-muted">›</span>}
                </button>
              </li>
            );
          })}
        </ul>
        {trace && !trace.rootSkill && (
          <button className="btn-gap mt-3 w-full" onClick={() => nav("/trace")}>
            {fil ? "Ituloy ang paghahanap ng gap" : "Continue finding your gap"} →
          </button>
        )}
      </div>

      <div className="card mt-7">
        <h2 className="section-title">{t("stuck")}</h2>
        <p className="text-sm text-muted">
          {fil ? "Isulat ang problem, tapos ang mga step mo. Hahanapin natin ang eksaktong step." : "Type the problem, then your steps. We'll find the exact step together."}
        </p>
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (custom.trim()) nav(`/solve/custom?given=${encodeURIComponent(custom.trim())}`);
          }}
        >
          <input
            className="input"
            placeholder="e.g. 3(x-2)=12"
            aria-label={fil ? "Ang problem mo" : "Your problem"}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <button className="btn-primary shrink-0">{t("checkWork")}</button>
        </form>
      </div>

      <div className="mt-7 flex items-center justify-between">
        <h2 className="eyebrow">{t("mySkillMap")}</h2>
        <Link to="/map" className="text-sm font-semibold text-brand-ink">
          {fil ? "Buksan" : "Open"} →
        </Link>
      </div>
      <Link to="/map" className="mt-2 block" aria-label={fil ? "Buksan ang skill map" : "Open my skill map"}>
        <div className="pointer-events-none">
          <SkillMap statuses={progress} root={trace?.rootSkill ?? null} path={trace?.rootSkill ? trace.path : []} height={260} />
        </div>
      </Link>
    </Shell>
  );
}
