import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../auth";
import { Bilog } from "../components/Bilog";
import { Icon } from "../components/Icon";
import { Math, quickTex } from "../components/Math";
import { OfflinePack } from "../components/OfflinePack";
import { EngineBadge, Shell } from "../components/Shell";
import { buildPlan, startGrade, unitById, type SubjectId } from "../data/curriculum";
import { demoAssignment, problemById, skillById, skillTitle } from "../data";
import { KYLA_ID } from "../data/seedClass";
import { useStore } from "../store";
import { useT } from "../i18n";
import { SubjectIcon } from "../components/SubjectIcon";
import { usePlanContext } from "../plan";
import { fetchMyTests, type MyTest } from "../school";

export default function StudentHome() {
  const nav = useNavigate();
  const { onboarding, attempts, lang, practiceAssignments, trace, gapsFixed, progress, demo, placement } = useStore();
  const { profile, classes, joinClass, error } = useAuth();
  const t = useT();
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const rootRef = useRef<HTMLButtonElement | null>(null);
  const name = demo && !onboarding.name ? "Kyla" : profile?.display_name || onboarding.name || t("home.friend");
  const signedIn = !demo && !!profile;
  const [tests, setTests] = useState<MyTest[]>([]);
  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    fetchMyTests().then((x) => live && setTests(x));
    return () => { live = false; };
  }, [signedIn, classes.length]);
  const toTake = tests.filter((x) => !x.result);
  const recent = tests.filter((x) => x.result).slice(0, 3);
  const assigned = practiceAssignments.filter((p) => p.studentIds.includes(KYLA_ID));
  const mastered = Object.values(progress).filter((s) => s === "mastered").length;

  const statusOf = (pid: string) => {
    const mine = attempts.filter((a) => a.problemId === pid);
    if (!mine.length) return null;
    const last = mine[mine.length - 1];
    return last.analysis.errorIndex === null && last.analysis.complete ? "done" : "gap";
  };
  const doneCount = demoAssignment.problemIds.filter((p) => statusOf(p) === "done").length;
  const { grade: planGrade, subjects: planSubjects } = usePlanContext();
  const hour = new Date().getHours();
  const greet = t(hour < 12 ? "home.goodMorning" : hour < 18 ? "home.goodAfternoon" : "home.goodEvening");

  // Each subject starts where its starting-point check put the learner. Unchecked subjects have no "next" yet.
  const startOf = (sub: SubjectId) => {
    const p = placement[sub];
    if (!p) return null;
    if (p.skillId) return { route: `/learn/${p.skillId}`, title: skillTitle(p.skillId, lang), gap: p.gap, done: progress[p.skillId] === "mastered" };
    const u = (p.unitId && unitById(p.unitId)) || buildPlan(sub, startGrade(sub, planGrade))[0];
    return { route: `/unit/${u.id}`, title: t.unit(u), gap: p.gap, done: progress[u.id] === "mastered" };
  };
  const unchecked = planSubjects.find((s) => !placement[s]);
  const firstSub = planSubjects.find((s) => placement[s]);
  const first = firstSub ? startOf(firstSub) : null;
  const rootOpen = trace?.rootSkill && progress[trace.rootSkill] !== "mastered" ? trace.rootSkill : null;

  const row = "flex w-full items-center gap-4 py-3.5 text-left";
  const list = "mt-2 divide-y divide-ink/10 border-y border-ink/10";

  return (
    <Shell>
      <section className="mt-2 flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <div className="kicker text-muted">{greet}</div>
          <h1 className="mt-1 text-[40px] leading-none" data-testid="greeting">{name}.</h1>
        </div>
        <Bilog size={60} lookAt={rootRef} sprout={gapsFixed.length > 0}
          mood={trace && !trace.rootSkill ? "dig" : rootOpen ? "found" : "idle"} />
      </section>

      {/* Up next: one strong block */}
      {trace && !trace.rootSkill ? (
        <button className="mt-6 flex w-full items-center gap-4 rounded-[26px] bg-gap px-5 py-5 text-left text-white shadow-[0_18px_30px_-20px_rgb(166_58_27/.8)]" onClick={() => nav("/trace")}>
          <Icon name="search" size={26} />
          <span className="flex-1 font-display text-[22px] leading-tight">{t("home.continueFindingGap")}</span>
          <Icon name="arrow" />
        </button>
      ) : rootOpen ? (
        <button ref={rootRef} className="mt-6 flex w-full items-center gap-4 rounded-[26px] bg-gap px-5 py-5 text-left text-white shadow-[0_18px_30px_-20px_rgb(166_58_27/.8)]" onClick={() => nav(`/learn/${rootOpen}`)}>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/20 font-display">G{skillById[rootOpen].grade}</span>
          <span className="min-w-0 flex-1">
            <span className="kicker block text-white/75">{t("home.rootGap")}</span>
            <span className="mt-0.5 block font-display text-[22px] leading-tight">{skillTitle(rootOpen, lang)}</span>
          </span>
          <Icon name="arrow" />
        </button>
      ) : unchecked && !first ? (
        <button className="mt-6 w-full rounded-[26px] bg-ink px-5 py-6 text-left text-paper shadow-[0_18px_30px_-20px_rgb(30_43_39/.9)]"
          onClick={() => nav(`/check/${unchecked}`)} data-testid="find-start">
          <span className="flex items-center gap-3">
            <SubjectIcon id={unchecked} size={40} onColor />
            <span className="kicker text-paper/60">{t("check.title")}</span>
          </span>
          <span className="mt-3 block font-display text-[26px] leading-[1.1]">{t("home.findStart")}</span>
          <span className="mt-1.5 block text-[14px] text-paper/70">{t("home.findStartSub", { subject: t.subject(unchecked) })}</span>
          <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-paper px-5 py-2.5 text-[15px] font-semibold text-ink">
            {t("home.start")} <Icon name="arrow" size={16} />
          </span>
        </button>
      ) : firstSub && first ? (
        <button className={`mt-6 flex w-full items-center gap-4 rounded-[26px] px-5 py-5 text-left text-paper shadow-[0_18px_30px_-20px_rgb(30_43_39/.9)] ${first.gap ? "bg-gap" : "bg-ink"}`}
          onClick={() => nav(first.route)} data-testid="up-next">
          <SubjectIcon id={firstSub} size={46} onColor />
          <span className="min-w-0 flex-1">
            <span className="kicker block text-paper/70">{first.gap ? t("home.yourGap") : t("home.upNext")}</span>
            <span className="mt-0.5 block font-display text-[22px] leading-tight">{first.title}</span>
            <span className="mt-1 block text-[13px] text-paper/65">{t.subject(firstSub)} · {t("common.gradeN", { n: startGrade(firstSub, planGrade) })}</span>
          </span>
          <Icon name="arrow" />
        </button>
      ) : null}

      {assigned.map((p) => (
        <button key={p.id} className="mt-3 flex w-full items-center gap-4 rounded-[22px] bg-ok-soft/80 px-4 py-3.5 text-left" onClick={() => nav(`/learn/${p.skillId}`)}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ok text-white"><Icon name="mail" size={18} /></span>
          <span className="min-w-0 flex-1">
            <span className="kicker block text-ok-dark">{t("home.newFromMsSantos")}</span>
            <span className="block font-display text-[19px] leading-tight">{skillTitle(p.skillId, lang)}</span>
          </span>
          <Icon name="arrow" className="text-ok-dark" />
        </button>
      ))}

      {(toTake.length > 0 || recent.length > 0) && (
        <section className="mt-8" data-testid="teacher-tests">
          <div className="kicker text-muted">{t("classes.fromTeacher")}</div>
          <ul className={list}>
            {[...toTake, ...recent].map(({ test, className, result }) => (
              <li key={test.id}>
                <button className={row} onClick={() => nav(`/test/${test.id}`)} data-testid={`take-${test.title}`}>
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${result ? "bg-ok-soft text-ok-dark" : "bg-gap text-white"}`}>
                    <Icon name={result ? "check" : "pencil"} size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-[18px] leading-tight">{test.title}</span>
                    <span className="text-[13px] text-muted">{t(test.kind === "exam" ? "classes.exam" : "classes.quiz")} · {className}</span>
                  </span>
                  {result ? <span className="font-display text-[18px]">{result.score}/{result.total}</span> : <span className="chip !bg-gap-soft text-gap-dark">{t("classes.take")}</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {demo && (
        <section className="mt-8" data-testid="assignment-card">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <div className="kicker text-muted">{t("home.assignment")} · {demoAssignment.teacher}</div>
              <div className="mt-1 font-display text-[22px] leading-tight">{demoAssignment.title}</div>
              <div className="text-[13px] text-muted">{t("home.dueFriday")} · {t("home.teacherCanSee")}</div>
            </div>
            <div className="font-display text-[26px] leading-none">{doneCount}<span className="text-[16px] text-muted">/{demoAssignment.problemIds.length}</span></div>
          </div>
          <ul className={list}>
            {demoAssignment.problemIds.map((pid, i) => {
              const st = statusOf(pid);
              return (
                <li key={pid}>
                  <button onClick={() => nav(`/solve/${pid}?assignment=${demoAssignment.id}`)} className={row} data-testid={`problem-${pid}`}>
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-[14px] ${st === "done" ? "bg-ok text-white" : st === "gap" ? "bg-gap text-white" : "bg-white/55 text-muted"}`}>
                      {st === "done" ? <Icon name="check" size={16} strokeWidth={2.2} /> : i + 1}
                    </span>
                    <span className="flex-1 text-[20px]"><Math tex={quickTex(problemById[pid].given)} /></span>
                    <Icon name="chevron" size={18} className="text-muted" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {planSubjects.length > 0 && (
        <section className="mt-8" data-testid="plan-home">
          <div className="kicker text-muted">{t("home.subjects")}</div>
          <ul className={list}>
            {planSubjects.map((sub) => {
              const g = startGrade(sub, planGrade);
              const s = startOf(sub);
              return (
                <li key={sub} className="flex items-center gap-2">
                  <button className={`${row} min-w-0 flex-1`} onClick={() => nav(s ? s.route : `/check/${sub}`)} data-testid={`unit-${sub}`}>
                    <SubjectIcon id={sub} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-[19px] leading-tight">{t.subject(sub)}</span>
                      <span className={`mt-0.5 block truncate text-[13.5px] ${s?.gap ? "text-gap-dark" : "text-muted"}`}>
                        {t("common.gradeN", { n: g })} · {s ? (s.gap ? `${t("home.yourGap")}: ${s.title}` : t("home.nextIn", { unit: s.title })) : t("home.notChecked")}
                      </span>
                    </span>
                    {!s && <span className="shrink-0 rounded-full border border-ink/20 px-3 py-1 text-[13px] font-semibold">{t("home.check")}</span>}
                  </button>
                  {s && <OfflinePack subject={sub} grade={g} />}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <div className="kicker text-muted">{t("home.more")}</div>
        <ul className={list}>
          <li>
            <button className={row} onClick={() => nav("/solve/custom")}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/55 text-gap-dark"><Icon name="pencil" size={19} /></span>
              <span className="flex-1"><span className="block font-display text-[18px] leading-tight">{t("home.stuck")}</span><span className="text-[13.5px] text-muted">{t("home.checkAnyProblem")}</span></span>
              <Icon name="chevron" size={18} className="text-muted" />
            </button>
          </li>
          <li>
            <button className={row} onClick={() => nav("/map")}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/55 text-ok"><Icon name="roots" size={19} /></span>
              <span className="flex-1"><span className="block font-display text-[18px] leading-tight">{t("home.myRoots")}</span>{mastered > 0 && <span className="text-[13.5px] text-muted">{t.plural("home.skillsMastered", mastered)}</span>}</span>
              <Icon name="chevron" size={18} className="text-muted" />
            </button>
          </li>
          {signedIn && classes.map((c) => (
            <li key={c.id} className={row}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/55 text-muted"><Icon name="user" size={19} /></span>
              <span className="flex-1"><span className="block font-display text-[18px] leading-tight">{c.name}{c.section ? ` · ${c.section}` : ""}</span><span className="text-[13.5px] text-muted">{t("home.class2")}</span></span>
              <span className="chip">{c.class_code}</span>
            </li>
          ))}
          {signedIn && (
            <li className="py-3.5" data-testid="join-class">
              {!showJoin ? (
                <button className="flex w-full items-center gap-4 text-left" onClick={() => setShowJoin(true)}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/55 text-muted"><Icon name="user" size={19} /></span>
                  <span className="flex-1 text-[15px]">{classes.length ? t("classes.joinAnother") : t("home.joinPrompt")}</span>
                  <Icon name="chevron" size={18} className="text-muted" />
                </button>
              ) : (
                <>
                  <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); setJoining(true); if (await joinClass(code)) { setShowJoin(false); setCode(""); } setJoining(false); }}>
                    <input className="input" autoFocus value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="SAMP-924" autoCapitalize="characters" spellCheck={false} data-testid="class-code" />
                    <button className="btn-primary shrink-0" disabled={!code.trim() || joining} data-testid="join-btn">{t("home.join")}</button>
                  </form>
                  {error === "invalid" && <p className="mt-2 text-[13px] text-gap-dark">{t("home.couldntFindCodeCheck")}</p>}
                  {error === "removed" && <p className="mt-2 text-[13px] text-gap-dark">{t("home.removedFromClass")}</p>}
                </>
              )}
            </li>
          )}
        </ul>
      </section>

      <div className="mt-6 flex flex-col items-center gap-2 text-[13px] text-muted">
        <span className="flex items-center gap-2">
          {gapsFixed.length > 0 && (
            <>
              <Icon name="sprout" size={15} className="text-ok" />
              {t.plural("home.gapsFixed", gapsFixed.length)}
              <span className="opacity-40">·</span>
            </>
          )}
          <Icon name="lock" size={13} /> {t("home.selfPracticePrivate")}
        </span>
        <EngineBadge />
      </div>
    </Shell>
  );
}
