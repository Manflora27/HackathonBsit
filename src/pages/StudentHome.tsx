import { useNavigate } from "react-router";
import { Math, quickTex } from "../components/Math";
import { EngineBadge, Shell } from "../components/Shell";
import { demoAssignment, problemById, skillById, skillTitle } from "../data";
import { KYLA_ID } from "../data/seedClass";
import { useStore } from "../store";

export default function StudentHome() {
  const nav = useNavigate();
  const { attempts, lang, practiceAssignments, trace, gapsFixed, progress } = useStore();
  const fil = lang === "fil";
  const assigned = practiceAssignments.filter((p) => p.studentIds.includes(KYLA_ID));
  const mastered = Object.values(progress).filter((s) => s === "mastered").length;

  const statusOf = (pid: string) => {
    const mine = attempts.filter((a) => a.problemId === pid);
    if (!mine.length) return null;
    const last = mine[mine.length - 1];
    return last.analysis.errorIndex === null && last.analysis.complete ? "done" : "gap";
  };
  const doneCount = demoAssignment.problemIds.filter((p) => statusOf(p) === "done").length;

  return (
    <Shell>
      <section className="mt-1 flex items-end justify-between">
        <div>
          <div className="kicker text-muted">{fil ? "Magandang araw" : "Welcome back"}</div>
          <h1 className="font-display text-[32px] font-bold leading-none">Hi, Kyla!</h1>
        </div>
        <EngineBadge />
      </section>

      {trace && !trace.rootSkill && (
        <button className="btn-gap mt-4 w-full" onClick={() => nav("/trace")}>
          🔎 {fil ? "Ituloy ang paghahanap ng gap" : "Continue finding your gap"}
        </button>
      )}
      {trace?.rootSkill && progress[trace.rootSkill] !== "mastered" && (
        <button className="card mt-4 flex w-full items-center gap-3 !bg-gap-soft !p-4 text-left" onClick={() => nav(`/learn/${trace.rootSkill}`)}>
          <span className="flex h-12 w-12 items-center justify-center rounded-full border-[2.5px] border-ink bg-gap font-display text-lg">!</span>
          <span className="flex-1">
            <span className="kicker block text-gap-dark">{fil ? "Ang gap mo" : "Your gap"} · Grade {skillById[trace.rootSkill].grade}</span>
            <span className="block font-display text-lg font-semibold leading-tight">{skillTitle(trace.rootSkill, lang)}</span>
          </span>
          <span className="font-display text-xl">→</span>
        </button>
      )}

      {assigned.map((p) => (
        <button key={p.id} className="card mt-4 flex w-full items-center gap-3 !bg-brand-soft !p-4 text-left" onClick={() => nav(`/learn/${p.skillId}`)}>
          <span className="text-3xl">📬</span>
          <span className="flex-1">
            <span className="kicker block text-brand">{fil ? "Bago mula kay Ms. Santos" : "New from Ms. Santos"}</span>
            <span className="block font-display text-lg font-semibold leading-tight">{skillTitle(p.skillId, lang)}</span>
          </span>
          <span className="font-display text-xl">→</span>
        </button>
      ))}

      <section className="card mt-4 !p-0" data-testid="assignment-card">
        <div className="flex items-center gap-3 border-b-[2.5px] border-ink p-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border-[2.5px] border-ink bg-sky text-2xl">🧭</span>
          <div className="flex-1">
            <div className="font-display text-lg font-semibold leading-tight">{demoAssignment.title}</div>
            <div className="text-sm text-muted">
              {demoAssignment.teacher} · {fil ? "Biyernes" : demoAssignment.due} · {fil ? "Makikita ng teacher" : "Teacher can see"}
            </div>
          </div>
          <span className="font-display text-lg">{doneCount}/{demoAssignment.problemIds.length}</span>
        </div>
        <div className="h-3 border-b-[2.5px] border-ink bg-soft">
          <div className="h-full bg-ok transition-all" style={{ width: `${(doneCount / demoAssignment.problemIds.length) * 100}%` }} />
        </div>
        <ul>
          {demoAssignment.problemIds.map((pid, i) => {
            const st = statusOf(pid);
            return (
              <li key={pid} className={i ? "border-t-2 border-dashed border-ink/15" : ""}>
                <button onClick={() => nav(`/solve/${pid}?assignment=${demoAssignment.id}`)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                  data-testid={`problem-${pid}`}>
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[2.5px] border-ink font-display ${st === "done" ? "bg-ok text-white" : st === "gap" ? "bg-gap" : "bg-white"}`}>
                    {st === "done" ? "✓" : st === "gap" ? "!" : i + 1}
                  </span>
                  <span className="flex-1 text-[19px]">
                    <Math tex={quickTex(problemById[pid].given)} />
                  </span>
                  <span className="font-display text-lg text-muted">›</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-3">
        <button className="card !p-4 text-left" onClick={() => nav("/map")}>
          <div className="text-2xl">🗺️</div>
          <div className="mt-1 font-display text-lg font-semibold leading-tight">{fil ? "Skill map ko" : "My skill map"}</div>
          <div className="text-sm text-muted">{mastered} {fil ? "kaya mo na" : "mastered"}</div>
        </button>
        <button className="card !p-4 text-left" onClick={() => nav("/solve/custom")}>
          <div className="text-2xl">✏️</div>
          <div className="mt-1 font-display text-lg font-semibold leading-tight">{fil ? "Na-stuck?" : "Stuck?"}</div>
          <div className="text-sm text-muted">{fil ? "I-check ang kahit anong problem" : "Check any problem"}</div>
        </button>
      </section>

      <p className="mt-5 text-center text-sm text-muted">
        🧩 {gapsFixed.length} {fil ? "gap na naayos" : gapsFixed.length === 1 ? "gap fixed" : "gaps fixed"} · {fil ? "Pribado ang sariling practice" : "Self-practice is private"}
      </p>
    </Shell>
  );
}
