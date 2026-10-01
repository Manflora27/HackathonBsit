import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth, type AccountType } from "../auth";
import { Bilog, type BilogMood } from "../components/Bilog";
import { Icon, InkCircle } from "../components/Icon";
import { JoinClassSheet } from "../components/JoinClassSheet";
import { PlanReveal } from "../components/PlanReveal";
import { AnimatePresence } from "motion/react";
import { syncClassProgress } from "../classroom";
import { SubjectIcon } from "../components/SubjectIcon";
import { Shell } from "../components/Shell";
import { GRADES, requiredSubjectsForGrade, schoolYear, subjectGroupsFor, subjectsFor, type SubjectId } from "../data/curriculum";
import { useStore } from "../store";
import { useT } from "../i18n";

const STEPS = 3;

/** First-run onboarding: who you are, what you study and where you are now, then your plan. */
export default function Welcome() {
  const nav = useNavigate();
  const { user, profile, ready, completeProfile, joinClass, error } = useAuth();
  const { consent, role, set, lang, onboarding, demoFlow } = useStore();
  const t = useT();
  const guest = !user && role === "guest";

  const [step, setStep] = useState(1);
  const [name, setName] = useState(onboarding.name);
  const [type, setType] = useState<AccountType>("student");
  const [code, setCode] = useState("");
  const [subjects, setSubjects] = useState<SubjectId[]>(onboarding.subjects);
  const [grade, setGrade] = useState<number | null>(onboarding.grade);
  const [self, setSelf] = useState(onboarding.done && onboarding.grade === null && onboarding.subjects.length > 0);
  const [busy, setBusy] = useState(false);
  const [planReady, setPlanReady] = useState(false);
  const [codeError, setCodeError] = useState(false);
  /** The student saw what the class's teacher will see and said yes; only then is the class joined. */
  const [codeConfirmed, setCodeConfirmed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    if (!ready || onboarding.done) return; // done: finish() is already navigating
    if (!consent || (!user && !guest)) return void nav("/", { replace: true });
    if (profile?.onboarded_at) return void nav("/", { replace: true }); // already onboarded
    if (!name) setName((user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ?? "");
  }, [ready, user, profile, consent, guest, onboarding.done]); // eslint-disable-line react-hooks/exhaustive-deps

  const student = type === "student";
  const canNext1 = name.trim().length > 0;
  const canNext2 = !student || (subjects.length > 0 && (grade !== null || self));
  // Required subjects come preselected when a grade is picked; electives stay opt-in. Changing grade drops any that no longer apply.
  const pickGrade = (g: number) => {
    setGrade(g);
    setSelf(false);
    setSubjects((cur) => [...new Set([...cur.filter((s) => subjectsFor(g).includes(s)), ...requiredSubjectsForGrade(g)])]);
  };
  // Self-learners: no grade, every subject on offer, nothing preselected.
  const pickSelf = () => {
    setGrade(null);
    setSelf(true);
    setSubjects([]);
  };
  const toggle = (s: SubjectId) => setSubjects((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  async function finish() {
    setBusy(true);
    const picked = student ? subjects : [];
    if (user) {
      // Self-serve onboarding: the learner accepted the consent themselves. Guardian/school
      // provenance belongs to those flows; the landing's "school" default mislabelled it.
      const ok = await completeProfile({ name, type, consentBy: "self", language: lang, subjects: picked, grade, goal: null });
      if (!ok) return setBusy(false);
      if (student && code.trim() && codeConfirmed) {
        const joined = await joinClass(code);
        setCodeError(!joined);
        if (joined) void syncClassProgress(useStore.getState().progress);
      }
    }
    set({ role: demoFlow ? "student" : guest ? "guest" : type, demo: demoFlow, demoFlow: false, ...(demoFlow ? {} : { consent: { by: "self" as const, at: consent?.at ?? Date.now() } }), onboarding: { name: name.trim(), subjects: picked, grade, goal: null, done: true, gradeYear: schoolYear() } });
    setBusy(false);
    // Learners go straight to their first starting-point check; home is behind it, so "back" lands there.
    if (type === "teacher") return nav("/teacher", { replace: true });
    nav("/student", { replace: true });
    if (!demoFlow && picked[0]) nav(`/check/${picked[0]}`);
  }

  const next = () => {
    // A class code goes through the join confirmation before onboarding moves on.
    if (step === 1 && student && !guest && code.trim() && !codeConfirmed) return setConfirming(true);
    return step < STEPS ? setStep(step + 1) : void finish();
  };
  const canNext = step === 1 ? canNext1 : step === 2 ? canNext2 : true;
  // Teachers have no plan to build: they skip straight from step 1 to finish.
  const teacherDone = !student && step === 1;
  const showPlan = step === 3 && (grade !== null || self) && subjects.length > 0;
  // Bilog watches you type your name, then cheers when the plan assembles.
  const mood: BilogMood = step === 1 ? "watch" : step === 3 && planReady ? "happy" : "idle";

  return (
    <Shell tabs={false}>
      <div className="mt-3" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS} aria-valuenow={step}>
        <div className="flex items-center gap-2">
          {Array.from({ length: STEPS }, (_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < step ? "bg-ink/75" : "bg-ink/15"}`} />
          ))}
        </div>
        <div className="mt-2 text-right text-[12px] tracking-[0.14em] text-muted">{t("welcome.stepOf", { step, total: STEPS })}</div>
      </div>
      <div className="pointer-events-none float-right ml-2 mt-3">
        <Bilog size={58} mood={mood} />
      </div>

      {step === 1 && (
        <>
          <div className="kicker mt-5 text-gap-dark">{t("welcome.firstThingsFirst")}</div>
          <h1 className="mt-1 text-balance text-[34px] leading-[1.06]">{guest ? (t("welcome.hiWhatsName")) : t("welcome.whosUsingHopper")}</h1>
          <p className="mt-2 text-balance text-[16px] text-muted">
            {guest ? (t("welcome.wellBuildStudyPlan")) : t("welcome.oneMinuteSetUp")}
          </p>
          <div className="mt-8 space-y-9">
            <div>
              <label className="kicker text-muted" htmlFor="nm">{t("welcome.whatShouldCall")}</label>
              <input id="nm" className="mt-1 w-full border-0 border-b-2 border-ink/25 bg-transparent px-0 pb-2 font-display text-[34px] leading-tight outline-none transition placeholder:text-ink/25 focus:border-ink"
                placeholder={t("welcome.firstName")} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="given-name" data-testid="name" />
              <p className="mt-2 text-[13px] text-muted">
                {guest ? (t("welcome.staysDeviceNeverSent")) : t("welcome.teacherCanSeeNever")}
              </p>
            </div>

            {!guest && (
              <div>
                <div className="kicker text-muted">{t("welcome.iAm")}</div>
                <div className="mt-4 flex gap-10 pl-2" role="radiogroup">
                  {([
                    ["student", "Learner", t("welcome.learnFindMyGaps")],
                    ["teacher", "Teacher", t("welcome.runClass")],
                  ] as const).map(([v, title, sub]) => (
                    <button key={v} role="radio" aria-checked={type === v} onClick={() => setType(v)} data-testid={`type-${v}`} className="text-left">
                      <span className={`block font-display text-[30px] leading-none transition-colors ${type === v ? "text-ink" : "text-ink/40"}`}>
                        {type === v ? <InkCircle className="px-1.5 py-1">{title}</InkCircle> : <span className="px-1.5 py-1">{title}</span>}
                      </span>
                      <span className="mt-2 block max-w-[9.5rem] text-[13px] leading-snug text-muted">{sub}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {student && !guest && (
              <div>
                {!showCode && !code ? (
                  <button className="text-[15px] text-muted underline decoration-dotted underline-offset-4" onClick={() => setShowCode(true)} data-testid="show-code">
                    {t("welcome.haveClassCode")}
                  </button>
                ) : (
                  <>
                    <label className="kicker text-muted" htmlFor="cc">{t("welcome.classCodeOptional")}</label>
                    <input id="cc" className="mt-1 w-full border-0 border-b-2 border-ink/25 bg-transparent px-0 pb-2 font-mono text-[22px] outline-none transition placeholder:text-ink/25 focus:border-ink"
                      value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setCodeConfirmed(false); }} placeholder="SAMP-924" autoCapitalize="characters" spellCheck={false} data-testid="class-code" />
                    {codeError && <p className="mt-2 text-[13px] text-gap-dark">{t("welcome.couldntFindCodeCan")}</p>}
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div className="kicker mt-5 text-gap-dark">{t("welcome.studies")}</div>
          <h1 className="mt-1 text-balance text-[34px] leading-[1.06]">{t("welcome.whatStudying")}</h1>
          <div className="mt-7 space-y-8">
            <div>
              <div className="kicker text-muted">{t("welcome.whereInSchool")}</div>
              {/* A Margiela-style label: printed numerals on a white tag, the chosen one circled in pen. */}
              <div className="mt-3 rounded-[3px] bg-[#fdfcf8] px-2 py-2.5 shadow-[0_1px_2px_rgb(30_43_39/.08),0_14px_28px_-20px_rgb(30_43_39/.55)] ring-1 ring-ink/10"
                role="radiogroup" aria-label={t("welcome.whereInSchool")}>
                <div className="grid grid-cols-6">
                  {GRADES.map((g) => {
                    const on = grade === g;
                    return (
                      <button key={g} role="radio" aria-checked={on} onClick={() => pickGrade(g)} data-testid={`grade-${g}`}
                        aria-label={t("common.gradeN", { n: g })}
                        className={`flex h-12 items-center justify-center font-[Helvetica,Arial,sans-serif] text-[20px] tabular-nums tracking-tight transition-colors ${on ? "text-ink" : self ? "text-ink/25" : "text-ink/60"}`}>
                        {on ? <InkCircle className="min-w-[1.7em] px-1 py-0.5">{g}</InkCircle> : <span className="inline-flex min-w-[1.7em] justify-center px-1 py-0.5">{g}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
              <p className="mt-2 text-[12px] tracking-wide text-muted/80">{t("welcome.bands")}</p>
              <button role="radio" aria-checked={self} onClick={pickSelf} data-testid="self-learner"
                className={`ml-3 mt-4 text-left text-[15px] transition-colors ${self ? "text-ink" : "text-muted"}`}>
                {self ? <InkCircle className="px-2 py-1">{t("welcome.notInSchool")}</InkCircle> : <span className="inline-block px-2 py-1 underline decoration-dotted underline-offset-4">{t("welcome.notInSchool")}</span>}
              </button>
              <p className="mt-2 text-[13px] text-muted">
                {self ? t("welcome.selfLearnerNote") : t("welcome.justStartingPointNot")}
              </p>
            </div>

            <div>
              <div className="kicker text-muted">{t("welcome.subjectsPickOneMore")}</div>
              {grade === null && !self ? (
                <p className="mt-3 text-[15px] text-muted">{t("welcome.pickGradeSeeSubjects")}</p>
              ) : (
                subjectGroupsFor(grade).map((grp, _gi, all) => (
                  <div key={grp.id} className="mt-3">
                    {all.length > 1 && <div className="mb-2 font-display text-[17px] text-ink/70">{t.group(grp)}</div>}
                    <div className="grid grid-cols-2 gap-3">
                      {grp.subjects.map((sid) => (
                        <button key={sid} onClick={() => toggle(sid)} aria-pressed={subjects.includes(sid)} data-testid={`subject-${sid}`}
                          className={`rounded-2xl border p-4 text-left transition ${subjects.includes(sid) ? "border-ink/60 bg-white/85 shadow-[0_6px_14px_-10px_rgb(30_43_39/.6)]" : "border-white/60 bg-white/30"}`}>
                          <SubjectIcon id={sid} size={36} on={subjects.includes(sid)} />
                          <div className="mt-2.5 font-display text-[19px] leading-tight">{t.subject(sid)}</div>
                          <div className="mt-1 text-[13px] leading-snug text-muted">{t.subjectBlurb(sid)}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div className="kicker mt-5 text-gap-dark">{t("welcome.almostThere")}</div>
          {/* Only "ready" once it has actually assembled. */}
          <h1 className="mt-1 text-balance text-[34px] leading-[1.06]" aria-live="polite">{planReady ? t("welcome.planIsReady") : t("welcome.buildingPlan")}</h1>
          {showPlan && (
            <div className="mt-6">
              <div className="kicker text-gap-dark">{t("welcome.plan")}</div>
              <div className="mt-2"><PlanReveal subjects={subjects} grade={grade} onReady={() => setPlanReady(true)} /></div>
              <p className="mt-3 text-[13px] text-muted">
                {t("welcome.startHereWhenFind")}
              </p>
            </div>
          )}
        </>
      )}

      {error && <p className="mt-3 text-[14px] text-gap-dark">{error}</p>}
      <div className="h-20" aria-hidden />

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md">
        <div className="pointer-events-none absolute inset-x-0 -top-8 bottom-0 bg-gradient-to-t from-paper via-paper/85 to-transparent" aria-hidden />
        <div className="relative flex gap-3 px-4 pb-[max(env(safe-area-inset-bottom),14px)] pt-2">
          {step > 1 && <button className="btn-ghost" onClick={() => { setPlanReady(false); setStep(step - 1); }}><Icon name="back" size={18} /> {t("welcome.back")}</button>}
          <button className="btn-primary flex-1" disabled={!canNext || busy} onClick={teacherDone ? () => void finish() : next} data-testid={step === STEPS || teacherDone ? "finish-profile" : "next-step"}>
            {step === STEPS || teacherDone ? (t("welcome.start")) : t("welcome.next")} <Icon name="arrow" size={18} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {confirming && (
          // Joining happens at the end of onboarding (the profile has to exist first); this is the student's yes.
          <JoinClassSheet code={code} onClose={() => { setConfirming(false); setCode(""); }}
            onConfirm={async () => { setCodeConfirmed(true); setConfirming(false); setStep(step + 1); return true; }} />
        )}
      </AnimatePresence>
    </Shell>
  );
}
