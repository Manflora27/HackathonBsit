import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../auth";
import { Icon } from "../components/Icon";
import { Math, quickTex } from "../components/Math";
import { EngineBadge, Shell } from "../components/Shell";
import { buildPlan, subjectLabel, verifierMeta } from "../data/curriculum";
import { demoAssignment, problemById, skillById, skillTitle } from "../data";
import { KYLA_ID } from "../data/seedClass";
import { useStore } from "../store";

const fil0 = (l: string) => l === "fil";

export default function StudentHome() {
  const nav = useNavigate();
  const { onboarding, attempts, lang, practiceAssignments, trace, gapsFixed, progress, demo } = useStore();
  const { profile, classes, joinClass, error } = useAuth();
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const name = demo ? "Kyla" : profile?.display_name ?? (fil0(lang) ? "kaibigan" : "friend");
  const signedIn = !demo && !!profile;
  const myClass = classes[0];
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
  const planSubjects = signedIn && profile?.subjects.length ? profile.subjects : onboarding.subjects;
  const planGrade = signedIn && profile?.current_grade ? profile.current_grade : onboarding.grade;
  const hour = new Date().getHours();
  const greet = fil ? (hour < 12 ? "Magandang umaga" : hour < 18 ? "Magandang hapon" : "Magandang gabi") : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <Shell>
      <section className="mt-2">
        <div className="kicker text-muted">{greet}</div>
        <h1 className="mt-1 text-[40px] leading-none" data-testid="greeting">{name}.</h1>
        <div className="mt-2">
          <EngineBadge />
        </div>
      </section>

      {trace && !trace.rootSkill && (
        <button className="btn-gap mt-5 w-full" onClick={() => nav("/trace")}>
          <Icon name="search" size={18} /> {fil ? "Ituloy ang paghahanap ng gap" : "Continue finding your gap"}
        </button>
      )}
      {trace?.rootSkill && progress[trace.rootSkill] !== "mastered" && (
        <button className="card mt-5 flex w-full items-center gap-4 !bg-gap-soft/70 !p-4 text-left" onClick={() => nav(`/learn/${trace.rootSkill}`)}>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gap font-display text-white">G{skillById[trace.rootSkill].grade}</span>
          <span className="flex-1">
            <span className="kicker block text-gap-dark">{fil ? "Ang ugat ng gap mo" : "The root of your gap"}</span>
            <span className="block font-display text-[20px] leading-tight">{skillTitle(trace.rootSkill, lang)}</span>
          </span>
          <Icon name="arrow" className="text-gap-dark" />
        </button>
      )}

      {assigned.map((p) => (
        <button key={p.id} className="card mt-4 flex w-full items-center gap-4 !p-4 text-left" onClick={() => nav(`/learn/${p.skillId}`)}>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ok-soft text-ok-dark"><Icon name="mail" /></span>
          <span className="flex-1">
            <span className="kicker block text-ok-dark">{fil ? "Bago mula kay Ms. Santos" : "New from Ms. Santos"}</span>
            <span className="block font-display text-[20px] leading-tight">{skillTitle(p.skillId, lang)}</span>
          </span>
          <Icon name="arrow" className="text-muted" />
        </button>
      ))}

      {signedIn && !myClass && (
        <section className="card mt-5" data-testid="join-class">
          <div className="kicker text-muted">{fil ? "May klase ka ba?" : "In a class?"}</div>
          <div className="mt-1 font-display text-[22px] leading-tight">{fil ? "Ilagay ang class code ng teacher mo" : "Enter your teacher's class code"}</div>
          <form className="mt-3 flex gap-2" onSubmit={async (e) => { e.preventDefault(); setJoining(true); await joinClass(code); setJoining(false); }}>
            <input className="input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="SAMP-924" autoCapitalize="characters" spellCheck={false} data-testid="class-code" />
            <button className="btn-primary shrink-0" disabled={!code.trim() || joining} data-testid="join-btn">{fil ? "Sumali" : "Join"}</button>
          </form>
          {error === "invalid" && <p className="mt-2 text-[14px] text-gap-dark">{fil ? "Hindi nahanap ang code na iyon. Tingnan sa teacher mo." : "We couldn't find that code. Check with your teacher, or just practice on your own."}</p>}
          <p className="mt-2 text-[13px] text-muted">{fil ? "Puwede ka ring mag-practice nang mag-isa." : "Or skip this and practice on your own."}</p>
        </section>
      )}
      {signedIn && myClass && (
        <div className="card-flat mt-5 flex items-center justify-between gap-3 !p-3 text-[15px]">
          <span><span className="kicker block text-muted">{fil ? "Klase" : "Your class"}</span><b className="font-display text-[18px] font-normal">{myClass.name}{myClass.section ? ` · ${myClass.section}` : ""}</b></span>
          <span className="chip">{myClass.class_code}</span>
        </div>
      )}

      {demo ? (
      <section className="card tape mt-6 !p-0" data-testid="assignment-card">
        <div className="flex items-end justify-between gap-3 px-5 pb-3 pt-5">
          <div>
            <div className="kicker text-muted">{demo ? `${fil ? "Assignment" : "Assignment"} · ${demoAssignment.teacher}` : fil ? "Panimulang check" : "Starter check"}</div>
            <div className="mt-1 font-display text-[24px] leading-tight">{demoAssignment.title}</div>
            <div className="mt-0.5 text-[14px] text-muted">
              {demo ? `${fil ? "Due sa Biyernes" : `Due ${demoAssignment.due}`} · ${fil ? "Makikita ng teacher" : "Your teacher can see this"}` : fil ? "Ikaw lang ang makakakita" : "Only you can see this"}
            </div>
          </div>
          <div className="text-right font-display text-[28px] leading-none">
            {doneCount}<span className="text-[17px] text-muted">/{demoAssignment.problemIds.length}</span>
          </div>
        </div>
        <div className="mx-5 h-1 overflow-hidden rounded-full bg-soft">
          <div className="h-full rounded-full bg-ok transition-all duration-700" style={{ width: `${(doneCount / demoAssignment.problemIds.length) * 100}%` }} />
        </div>
        <ul className="mt-2 px-2 pb-2">
          {demoAssignment.problemIds.map((pid, i) => {
            const st = statusOf(pid);
            return (
              <li key={pid} className={i ? "border-t border-line" : ""}>
                <button onClick={() => nav(`/solve/${pid}${demo ? `?assignment=${demoAssignment.id}` : ""}`)}
                  className="flex w-full items-center gap-4 rounded-2xl px-3 py-4 text-left transition hover:bg-paper" data-testid={`problem-${pid}`}>
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-[14px] ${st === "done" ? "bg-ok text-white" : st === "gap" ? "bg-gap text-white" : "border border-line text-muted"}`}>
                    {st === "done" ? <Icon name="check" size={16} strokeWidth={2.2} /> : i + 1}
                  </span>
                  <span className="flex-1 text-[20px]">
                    <Math tex={quickTex(problemById[pid].given)} />
                  </span>
                  <Icon name="chevron" size={18} className="text-muted" />
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      ) : (
        planGrade !== null && planSubjects.length > 0 && (
          <section className="mt-6 space-y-3" data-testid="plan-home">
            {planSubjects.map((sub) => {
              const next = buildPlan(sub, planGrade)[0];
              return (
                <button key={sub} className="card w-full !p-4 text-left" onClick={() => nav(`/unit/${next.id}`)} data-testid={`unit-${sub}`}>
                  <div className="kicker text-muted">{subjectLabel(sub, lang)} · {fil ? "Grade" : "Grade"} {planGrade}</div>
                  <div className="mt-1 font-display text-[22px] leading-tight">{fil ? "Susunod:" : "Up next:"} {next.title[lang]}</div>
                  <div className="mt-1 text-[14px] text-muted">Q{next.quarter} · {verifierMeta[next.verifier][lang]}</div>
                </button>
              );
            })}
          </section>
        )
      )}

      <section className="mt-4 grid grid-cols-2 gap-3">
        <button className="card !p-4 text-left" onClick={() => nav("/map")}>
          <Icon name="roots" size={24} className="text-ok" />
          <div className="mt-3 font-display text-[19px] leading-tight">{fil ? "Mga ugat ko" : "My roots"}</div>
          <div className="text-[14px] text-muted">{mastered} {fil ? "skill na kaya mo" : "skills mastered"}</div>
        </button>
        <button className="card !p-4 text-left" onClick={() => nav("/solve/custom")}>
          <Icon name="pencil" size={24} className="text-gap" />
          <div className="mt-3 font-display text-[19px] leading-tight">{fil ? "Na-stuck?" : "Stuck?"}</div>
          <div className="text-[14px] text-muted">{fil ? "I-check ang kahit anong problem" : "Check any problem"}</div>
        </button>
      </section>

      <p className="mt-6 flex items-center justify-center gap-2 text-[14px] text-muted">
        <Icon name="sprout" size={16} className="text-ok" />
        {gapsFixed.length} {fil ? "gap na naayos" : gapsFixed.length === 1 ? "gap fixed" : "gaps fixed"}
        <span className="opacity-40">·</span>
        <Icon name="lock" size={14} /> {fil ? "Pribado ang sariling practice" : "Self-practice is private"}
      </p>
    </Shell>
  );
}
