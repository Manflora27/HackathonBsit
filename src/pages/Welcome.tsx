import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth, type AccountType } from "../auth";
import { Bilog, type BilogMood } from "../components/Bilog";
import { Icon, InkCircle } from "../components/Icon";
import { PlanReveal } from "../components/PlanReveal";
import { Shell } from "../components/Shell";
import { GRADES, goalMeta, subjectMeta, subjectsForGrade, type Goal, type SubjectId } from "../data/curriculum";
import { useStore } from "../store";

const STEPS = 3;

/** First-run onboarding: who you are, what you study and where you are now, then your plan. */
export default function Welcome() {
  const nav = useNavigate();
  const { user, profile, ready, completeProfile, joinClass, error } = useAuth();
  const { consent, role, set, lang, onboarding, demoFlow } = useStore();
  const fil = lang === "fil";
  const guest = !user && role === "guest";

  const [step, setStep] = useState(1);
  const [name, setName] = useState(onboarding.name);
  const [type, setType] = useState<AccountType>("student");
  const [code, setCode] = useState("");
  const [subjects, setSubjects] = useState<SubjectId[]>(onboarding.subjects);
  const [grade, setGrade] = useState<number | null>(onboarding.grade);
  const [goal, setGoal] = useState<Goal | null>(onboarding.goal);
  const [busy, setBusy] = useState(false);
  const [codeError, setCodeError] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [planReady, setPlanReady] = useState(false);

  useEffect(() => {
    if (!ready || onboarding.done) return; // done: finish() is already navigating
    if (!consent || (!user && !guest)) return void nav("/", { replace: true });
    if (profile?.onboarded_at) return void nav("/", { replace: true }); // already onboarded
    if (!name) setName((user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ?? "");
  }, [ready, user, profile, consent, guest, onboarding.done]); // eslint-disable-line react-hooks/exhaustive-deps

  const student = type === "student";
  const canNext1 = name.trim().length > 0;
  const canNext2 = !student || (subjects.length > 0 && grade !== null);
  // Subjects depend on the grade (Science is one subject in Grades 3-10, then Physics, Chemistry and Biology), so changing grade drops any that no longer apply.
  const pickGrade = (g: number) => {
    setGrade(g);
    setSubjects((cur) => cur.filter((s) => subjectsForGrade(g).includes(s)));
  };
  const toggle = (s: SubjectId) => setSubjects((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  async function finish() {
    setBusy(true);
    const picked = student ? subjects : [];
    if (user) {
      const ok = await completeProfile({ name, type, consentBy: consent?.by ?? "self", language: lang, subjects: picked, grade, goal });
      if (!ok) return setBusy(false);
      if (student && code.trim()) setCodeError(!(await joinClass(code)));
    }
    set({ role: demoFlow ? "student" : guest ? "guest" : type, demo: demoFlow, demoFlow: false, onboarding: { name: name.trim(), subjects: picked, grade, goal, done: true } });
    setBusy(false);
    nav(type === "teacher" ? "/teacher" : "/student", { replace: true });
  }

  const next = () => (step < STEPS ? setStep(step + 1) : void finish());
  const canNext = step === 1 ? canNext1 : step === 2 ? canNext2 : true;
  // Teachers have no plan to build: they skip straight from step 1 to finish.
  const teacherDone = !student && step === 1;
  const showPlan = step === 3 && grade !== null && subjects.length > 0;
  // Bilog watches you type your name, then builds the plan with you.
  const mood: BilogMood = step === 1 ? "watch" : step === 2 ? "idle" : showPlan ? (planReady ? "happy" : "think") : "idle";

  return (
    <Shell tabs={false}>
      <div className="mt-3" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS} aria-valuenow={step}>
        <div className="flex items-center gap-2">
          {Array.from({ length: STEPS }, (_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < step ? "bg-ink/75" : "bg-ink/15"}`} />
          ))}
        </div>
        <div className="mt-2 text-right text-[12px] tracking-[0.14em] text-muted">{fil ? "HAKBANG" : "STEP"} {step} / {STEPS}</div>
      </div>
      <div className="pointer-events-none float-right ml-2 mt-3">
        <Bilog size={58} mood={mood} />
      </div>

      {step === 1 && (
        <>
          <div className="kicker mt-5 text-gap-dark">{fil ? "Una sa lahat" : "First things first"}</div>
          <h1 className="mt-1 text-balance text-[34px] leading-[1.06]">{guest ? (fil ? "Kumusta! Ano ang pangalan mo?" : "Hi! What's your name?") : fil ? "Sino ka sa Gap Finder?" : "Who's using Gap Finder?"}</h1>
          <p className="mt-2 text-balance text-[16px] text-muted">
            {guest ? (fil ? "Gagawa kami ng plano sa pag-aaral para sa iyo sa loob ng isang minuto. Walang account na kailangan." : "We'll build you a study plan in about a minute. No account needed.") : fil ? "Isang minuto lang para ihanda ang plano mo." : "One minute to set up your plan."}
          </p>
          <div className="mt-8 space-y-9">
            <div>
              <label className="kicker text-muted" htmlFor="nm">{fil ? "Ano ang itatawag namin sa iyo?" : "What should we call you?"}</label>
              <input id="nm" className="mt-1 w-full border-0 border-b-2 border-ink/25 bg-transparent px-0 pb-2 font-display text-[34px] leading-tight outline-none transition placeholder:text-ink/25 focus:border-ink"
                placeholder={fil ? "Unang pangalan" : "Your first name"} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="given-name" data-testid="name" />
              <p className="mt-2 text-[13px] text-muted">
                {guest ? (fil ? "Nasa device na ito lang. Hindi ito ipinapadala sa AI." : "Stays on this device. It's never sent to the AI.") : fil ? "Makikita ito ng teacher mo. Hindi ito ipinapadala sa AI." : "Your teacher can see this. It's never sent to the AI."}
              </p>
            </div>

            {!guest && (
              <div>
                <div className="kicker text-muted">{fil ? "Ako ay…" : "I am a…"}</div>
                <div className="mt-4 flex gap-10 pl-2" role="radiogroup">
                  {([
                    ["student", "Student", fil ? "Mag-aral at hanapin ang gap" : "Learn and find my gaps"],
                    ["teacher", "Teacher", fil ? "Pamahalaan ang klase" : "Run a class"],
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
                    {fil ? "May class code ka ba?" : "Have a class code?"}
                  </button>
                ) : (
                  <>
                    <label className="kicker text-muted" htmlFor="cc">{fil ? "Class code (opsyonal)" : "Class code (optional)"}</label>
                    <input id="cc" className="mt-1 w-full border-0 border-b-2 border-ink/25 bg-transparent px-0 pb-2 font-mono text-[22px] outline-none transition placeholder:text-ink/25 focus:border-ink"
                      value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="SAMP-924" autoCapitalize="characters" spellCheck={false} data-testid="class-code" />
                    {codeError && <p className="mt-2 text-[13px] text-gap-dark">{fil ? "Hindi nahanap ang code. Puwede mo itong idagdag mamaya." : "We couldn't find that code. You can add it later from home."}</p>}
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div className="kicker mt-5 text-gap-dark">{fil ? "Ikaw at ang pag-aaral mo" : "You and your studies"}</div>
          <h1 className="mt-1 text-balance text-[34px] leading-[1.06]">{fil ? "Ano ang aaralin mo?" : "What are you studying?"}</h1>
          <div className="mt-7 space-y-8">
            <div>
              <div className="kicker text-muted">{fil ? "Anong grade ka ngayon?" : "What grade are you in now?"}</div>
              <div className="mt-3 grid grid-cols-6 gap-2" role="radiogroup">
                {GRADES.map((g) => (
                  <button key={g} role="radio" aria-checked={grade === g} onClick={() => pickGrade(g)} data-testid={`grade-${g}`}
                    className={`rounded-xl border py-2 font-display text-[18px] transition ${grade === g ? "border-ink/60 bg-white/85 shadow-[0_6px_14px_-10px_rgb(30_43_39/.6)]" : "border-white/60 bg-white/30"}`}>{g}</button>
                ))}
              </div>
              <p className="mt-2 text-[13px] text-muted">
                {fil ? "Panimulang punto lang ito, hindi ito sukat ng level mo. Susubukan ng Gap Finder kung nasaan ka talaga." : "This is just a starting point, not a measure of your level. Gap Finder checks where you really are."}
              </p>
            </div>

            <div>
              <div className="kicker text-muted">
                {grade !== null && grade >= 11 ? (fil ? "Mga subject sa Senior High (pumili ng isa o higit pa)" : "Senior High subjects (pick one or more)") : fil ? "Mga subject (pumili ng isa o higit pa)" : "Subjects (pick one or more)"}
              </div>
              {grade === null ? (
                <p className="mt-3 text-[15px] text-muted">{fil ? "Pumili muna ng grade para makita ang mga subject mo." : "Pick your grade to see your subjects."}</p>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {subjectsForGrade(grade).map((s) => (
                    <button key={s} onClick={() => toggle(s)} aria-pressed={subjects.includes(s)} data-testid={`subject-${s}`}
                      className={`rounded-2xl border p-4 text-left transition ${subjects.includes(s) ? "border-ink/60 bg-white/85 shadow-[0_6px_14px_-10px_rgb(30_43_39/.6)]" : "border-white/60 bg-white/30"}`}>
                      <div className="font-display text-[20px]">{subjectMeta[s][lang]}</div>
                      <div className="mt-1 text-[13px] leading-snug text-muted">{subjectMeta[s].blurb[lang]}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="kicker text-muted">{fil ? "Wika" : "Language"}</div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {([["en", "English"], ["fil", "Filipino"]] as const).map(([v, label]) => (
                  <button key={v} onClick={() => set({ lang: v })} aria-pressed={lang === v} data-testid={`lang-${v}`}
                    className={`rounded-2xl border p-3 transition ${lang === v ? "border-ink/60 bg-white/85" : "border-white/60 bg-white/30"}`}>{label}</button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div className="kicker mt-5 text-gap-dark">{fil ? "Halos tapos na" : "Almost there"}</div>
          <h1 className="mt-1 text-balance text-[34px] leading-[1.06]">{fil ? "Ano ang layunin mo?" : "What's your goal?"}</h1>
          <div className="card mt-6">
            <div className="grid gap-2" role="radiogroup">
              {(Object.keys(goalMeta) as Goal[]).map((g) => (
                <button key={g} role="radio" aria-checked={goal === g} onClick={() => setGoal(g)} data-testid={`goal-${g}`}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${goal === g ? "border-ink/60 bg-white/70" : "border-white/60 bg-white/30"}`}>{goalMeta[g][lang]}</button>
              ))}
            </div>
          </div>
          {showPlan && grade !== null && (
            <div className="mt-6">
              <div className="kicker text-gap-dark">{fil ? "Ang plano mo" : "Your plan"}</div>
              <div className="mt-2"><PlanReveal subjects={subjects} grade={grade} onReady={() => setPlanReady(true)} /></div>
              <p className="mt-3 text-[13px] text-muted">
                {fil ? "Magsisimula ka rito. Kapag may nakitang gap, magdaragdag kami ng mga naunang skill." : "You start here. When we find a gap, we add the earlier skills it needs."}
              </p>
            </div>
          )}
        </>
      )}

      {error && <p className="mt-3 text-[14px] text-gap-dark">{error}</p>}
      <div className="mt-6 flex gap-3">
        {step > 1 && <button className="btn-ghost" onClick={() => { setPlanReady(false); setStep(step - 1); }}><Icon name="back" size={18} /> {fil ? "Balik" : "Back"}</button>}
        <button className="btn-primary flex-1" disabled={!canNext || busy} onClick={teacherDone ? () => void finish() : next} data-testid={step === STEPS || teacherDone ? "finish-profile" : "next-step"}>
          {step === STEPS || teacherDone ? (fil ? "Tapos na" : "Start") : fil ? "Susunod" : "Next"} <Icon name="arrow" size={18} />
        </button>
      </div>
    </Shell>
  );
}
