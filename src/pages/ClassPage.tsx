import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { useAuth } from "../auth";
import { Icon } from "../components/Icon";
import { Shell } from "../components/Shell";
import { SubjectIcon } from "../components/SubjectIcon";
import { buildPlan, unitById, type PlanUnit, type SubjectId } from "../data/curriculum";
import { useT } from "../i18n";
import { makeTest } from "../ai/client";
import { keyHolds } from "../engine/keys";
import { Math as TeX, RichText, quickTex } from "../components/Math";
import { ROSTER_PAGE, type TestQuestion, deleteTest, fetchResults, fetchRoster, fetchSubjectProgress, fetchTests, readmitStudent, removeStudent, sendTest, watchClass, type ClassTest, type Pupil, type TestKind, type TestResult } from "../school";
import { useStore } from "../store";

const pct = (score: number, total: number) => Math.round((score / Math.max(1, total)) * 100);

/** Topics most often missed across a set of results: [unitId, misses, attempts], worst first. */
function missedTopics(results: TestResult[]) {
  const by = new Map<string, { miss: number; n: number }>();
  for (const r of results) for (const it of r.items) {
    const e = by.get(it.unitId) ?? { miss: 0, n: 0 };
    e.n++;
    if (!it.right) e.miss++;
    by.set(it.unitId, e);
  }
  return [...by.entries()].filter(([, e]) => e.miss > 0).sort((a, b) => b[1].miss / b[1].n - a[1].miss / a[1].n);
}

/**
 * One class: who's in it, the quizzes and exams sent, and how students did on them. That's all a teacher
 * sees of a student here: results on tests this class was sent, nothing from their own practice.
 */
export default function ClassPage() {
  const t = useT();
  const nav = useNavigate();
  const { classId = "" } = useParams();
  const { classes } = useAuth();
  const cls = classes.find((c) => c.id === classId);
  const [tab, setTab] = useState<"students" | "tests">("students");
  const [roster, setRoster] = useState<Pupil[] | null>(null);
  /** Students in the class in all; the roster holds the pages loaded so far. */
  const [total, setTotal] = useState(0);
  const [moreBusy, setMoreBusy] = useState(false);
  /** The realtime connection is down: results may be stale until it's back. */
  const [offline, setOffline] = useState(false);
  const [tests, setTests] = useState<ClassTest[]>([]);
  const [results, setResults] = useState<TestResult[]>([]);
  const [composing, setComposing] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [removed, setRemoved] = useState<Pupil | null>(null);
  const [copied, setCopied] = useState(false);

  // Reloads keep as many roster pages as were already shown, so a live update doesn't collapse "Show more".
  const shown = useRef(ROSTER_PAGE);
  const load = useCallback(async () => {
    const [r, ts, rs] = await Promise.all([fetchRoster(classId, { limit: shown.current }), fetchTests(classId), fetchResults(classId)]);
    setRoster(r.pupils);
    setTotal(r.total);
    setTests(ts);
    setResults(rs);
  }, [classId]);
  useEffect(() => { void load(); return watchClass(classId, () => void load(), (live) => setOffline(!live)); }, [classId, load]);
  async function showMore() {
    setMoreBusy(true);
    const r = await fetchRoster(classId, { offset: roster?.length ?? 0 });
    setRoster((prev) => [...(prev ?? []), ...r.pupils.filter((p) => !prev?.some((x) => x.id === p.id))]);
    setTotal(r.total);
    shown.current = (roster?.length ?? 0) + r.pupils.length;
    setMoreBusy(false);
  }

  if (!cls) return <Navigate to="/teacher" replace />;
  const subject = (cls.subject ?? "math") as SubjectId;
  const grade = cls.grade ?? 9;
  const avg = results.length ? Math.round(results.reduce((a, r) => a + pct(r.score, r.total), 0) / results.length) : null;
  const worst = missedTopics(results)[0];
  const pupil = roster?.find((p) => p.id === picked) ?? null;

  return (
    // Wide on a computer: students and tests side by side. On a phone they're two tabs.
    <Shell wide back="/teacher" title={cls.name}>
      <header className="mt-2 flex items-start gap-3">
        <SubjectIcon id={subject} size={44} />
        <div className="min-w-0 flex-1">
          <div className="kicker text-muted">{t.subject(subject)} · {t("common.gradeN", { n: grade })}</div>
          <h1 className="mt-0.5 text-[30px] leading-[1.05]">{cls.name}{cls.section ? ` · ${cls.section}` : ""}</h1>
        </div>
      </header>
      <div className="mt-4 flex items-center gap-3">
        <span className="font-mono text-[22px] tracking-[0.18em]" data-testid="class-code-display">{cls.class_code}</span>
        <button className="btn-ghost btn-sm" onClick={() => { void navigator.clipboard?.writeText(cls.class_code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
          {copied ? <Icon name="check" size={15} /> : null} {t("teacher.copy")}
        </button>
      </div>
      <p className="mt-1 text-[13px] text-muted">{t("teacher.studentsEnterTheirHome")}</p>

      {offline && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-ochre/15 px-4 py-2.5 text-[14px]" role="status" data-testid="live-off">
          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-ochre" />
          <span className="flex-1">{t("classes.liveOff")}</span>
          <button className="font-semibold underline decoration-dotted underline-offset-4" onClick={() => void load()}>{t("classes.refresh")}</button>
        </div>
      )}

      {/* The class at a glance, from test results only. */}
      {avg !== null && (
        <div className="mt-6 grid grid-cols-2 gap-x-6 border-y border-ink/10 py-4" data-testid="class-summary">
          <div>
            <div className="kicker text-muted">{t("classes.average")}</div>
            <div className="font-display text-[34px] leading-none">{avg}%</div>
            <div className="mt-1 text-[12.5px] text-muted">{t.plural("classes.acrossTests", tests.length)}</div>
          </div>
          {worst && (
            <div className="min-w-0">
              <div className="kicker text-gap-dark">{t("classes.mostMissed")}</div>
              <div className="mt-1 line-clamp-2 font-display text-[16px] leading-tight">{titleOf(t, worst[0])}</div>
              <div className="mt-1 text-[12.5px] text-muted">{t("classes.missedPct", { n: pct(worst[1].miss, worst[1].n) })}</div>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 flex gap-1 rounded-full bg-ink/[.06] p-1 md:hidden" role="tablist">
        {(["students", "tests"] as const).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} data-testid={`tab-${k}`}
            className={`flex-1 rounded-full py-2 text-[14px] font-semibold transition ${tab === k ? "bg-white text-ink shadow-[0_4px_12px_-6px_rgb(30_43_39/.5)]" : "text-muted"}`}>
            {k === "students" ? `${t("teacher.students2")} · ${roster ? total : "…"}` : `${t("classes.tests")} · ${tests.length}`}
          </button>
        ))}
      </div>

      <div className="md:mt-8 md:grid md:grid-cols-2 md:items-start md:gap-10">
      <section className={tab === "students" ? "" : "hidden md:block"}>
      <h2 className="kicker hidden text-muted md:block">{t("teacher.students2")} · {roster ? total : "…"}</h2>
      {(
        roster && roster.length === 0 ? (
          <p className="mt-6 text-[15px] text-muted">{t("classes.noStudents", { code: cls.class_code })}</p>
        ) : (
          <ul className="mt-3 divide-y divide-ink/10" data-testid="roster">
            {roster?.map((p) => {
              const mine = results.filter((r) => r.userId === p.id);
              const sent = tests.filter((x) => !x.studentIds || x.studentIds.includes(p.id)).length;
              const score = mine.length ? Math.round(mine.reduce((a, r) => a + pct(r.score, r.total), 0) / mine.length) : null;
              return (
                <li key={p.id}>
                  <button className="flex w-full items-center gap-3 py-3 text-left" onClick={() => setPicked(p.id)} data-testid={`pupil-${p.name}`}>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/60 font-display text-[14px]">{initials(p.name)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-semibold">{p.name}</span>
                      <span className="block text-[13px] text-muted">{t("classes.testsDone", { done: mine.length, total: sent })}</span>
                    </span>
                    {score !== null && <span className={`font-display text-[20px] ${score >= 75 ? "text-ok-dark" : score >= 50 ? "text-ochre" : "text-gap-dark"}`}>{score}%</span>}
                    <Icon name="chevron" size={16} className="text-muted" />
                  </button>
                </li>
              );
            })}
          </ul>
        )
      )}
      {roster && roster.length < total && (
        <button className="btn-ghost mt-3 w-full" disabled={moreBusy} onClick={() => void showMore()} data-testid="roster-more">
          {t("classes.showMore", { n: Math.min(ROSTER_PAGE, total - roster.length), left: total - roster.length })}
        </button>
      )}

      </section>

      <section className={tab === "tests" ? "" : "hidden md:block"}>
      <h2 className="kicker hidden text-muted md:block">{t("classes.tests")} · {tests.length}</h2>
      {(
        <>
          {!composing && (
            <button className="btn-primary mt-4 w-full" onClick={() => setComposing(true)} data-testid="compose-test">
              + {t("classes.sendTest")}
            </button>
          )}
          <AnimatePresence>
            {composing && (
              <Composer subject={subject} grade={grade} onCancel={() => setComposing(false)} onSend={async (x) => {
                const sent = await sendTest(cls.id, { ...x, studentIds: null });
                if (sent) setTests((prev) => [sent, ...prev]);
                setComposing(false);
              }} />
            )}
          </AnimatePresence>
          {tests.length === 0 && !composing && <p className="mt-5 text-[15px] text-muted">{t("classes.noTests")}</p>}
          <ul className="mt-4 divide-y divide-ink/10" data-testid="tests">
            {tests.map((x) => <TestRow key={x.id} test={x} roster={roster ?? []} classSize={total} results={results.filter((r) => r.testId === x.id)}
              onDelete={async () => { await deleteTest(x.id); setTests((p) => p.filter((y) => y.id !== x.id)); setResults((p) => p.filter((r) => r.testId !== x.id)); }} />)}
          </ul>
        </>
      )}
      </section>
      </div>

      <AnimatePresence>
        {pupil && (
          <PupilSheet pupil={pupil} classId={cls.id} subject={subject} grade={grade} tests={tests} results={results.filter((r) => r.userId === pupil.id)} onClose={() => setPicked(null)}
            onRemove={async () => {
              if (!(await removeStudent(cls.id, pupil.id))) return;
              setPicked(null);
              setRemoved(pupil);
              setRoster((r) => r?.filter((x) => x.id !== pupil.id) ?? r);
              setTotal((n) => n - 1);
              setResults((r) => r.filter((x) => x.userId !== pupil.id));
            }} />
        )}
      </AnimatePresence>

      {removed && (
        <div className="fixed inset-x-0 bottom-5 z-40 mx-auto flex w-fit max-w-[92vw] items-center gap-4 rounded-full bg-ink px-5 py-3 text-paper shadow-lg" role="status" data-testid="removed-toast">
          <span className="truncate">{t("teacher.removedName", { name: removed.name })}</span>
          <button className="font-semibold text-ochre" onClick={async () => { await readmitStudent(cls.id, removed.id); setRemoved(null); void load(); }} data-testid="undo-remove">{t("teacher.undo")}</button>
          <button className="text-paper/60" aria-label={t("teacher.close")} onClick={() => setRemoved(null)}>✕</button>
        </div>
      )}
      <button className="mt-10 text-[13px] text-muted underline decoration-dotted underline-offset-4" onClick={() => nav("/teacher")}>{t("classes.allClasses")}</button>
    </Shell>
  );
}

const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const titleOf = (t: ReturnType<typeof useT>, unitId: string) => { const u = unitById(unitId); return u ? t.unit(u) : unitId; };

/** One sent test: who's done it and how they did; open it for the per-student list and missed topics. */
function TestRow({ test, roster, classSize, results, onDelete }: { test: ClassTest; roster: Pupil[]; classSize: number; results: TestResult[]; onDelete: () => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  // The list shows the roster pages loaded so far; the count is the whole class (or everyone the test went to).
  const meant = test.studentIds ? roster.filter((p) => test.studentIds!.includes(p.id)) : roster;
  const meantCount = test.studentIds ? test.studentIds.length : classSize;
  const avg = results.length ? Math.round(results.reduce((a, r) => a + pct(r.score, r.total), 0) / results.length) : null;
  const missed = missedTopics(results).slice(0, 3);
  // Tests with their own questions: which questions the class found hardest (lowest share right), with at least one answer.
  const hardest = (test.questions ?? []).map((q, i) => {
    const its = results.flatMap((r) => r.items.filter((it) => it.q === i));
    return { q, n: its.length, right: its.filter((it) => it.right).length };
  }).filter((x) => x.n > 0).sort((a, b) => a.right / a.n - b.right / b.n).slice(0, 3);
  return (
    <li className="py-3" data-testid={`test-${test.title}`}>
      <button className="flex w-full items-center gap-3 text-left" onClick={() => setOpen(!open)}>
        <span className={`chip shrink-0 ${test.kind === "exam" ? "!bg-sky/15 text-sky" : "!bg-ochre/15 text-ochre"}`}>{t(test.kind === "exam" ? "classes.exam" : "classes.quiz")}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-semibold">{test.title}</span>
          <span className="block text-[13px] text-muted">
            {t("classes.doneOf", { done: results.length, total: meantCount })}{avg !== null ? ` · ${t("classes.avg", { n: avg })}` : ""} · {new Date(test.createdAt).toLocaleDateString()}
          </span>
        </span>
        <Icon name="chevron" size={16} className={`text-muted transition ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-3 pl-1">
          {hardest.length > 0 && (
            <div className="mb-3" data-testid="hardest-questions">
              <div className="kicker text-gap-dark">{t("classes.hardest")}</div>
              <ul className="mt-1 space-y-1.5 text-[14.5px]">
                {hardest.map(({ q, n, right }, k) => (
                  <li key={k} className="flex justify-between gap-3">
                    <span className="min-w-0 line-clamp-2"><RichText text={q.prompt} /></span>
                    <span className="shrink-0 text-muted">{t("classes.rightPct", { n: pct(right, n) })}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {missed.length > 0 && (
            <>
              <div className="kicker text-gap-dark">{t("classes.mostMissed")}</div>
              <ul className="mt-1 space-y-1 text-[14.5px]">
                {missed.map(([id, e]) => <li key={id} className="flex justify-between gap-3"><span className="min-w-0 truncate">{titleOf(t, id)}</span><span className="shrink-0 text-muted">{pct(e.miss, e.n)}%</span></li>)}
              </ul>
            </>
          )}
          <ul className="mt-3 space-y-1 text-[14.5px]">
            {meant.map((p) => {
              const r = results.find((x) => x.userId === p.id);
              return (
                <li key={p.id} className="flex justify-between gap-3">
                  <span className="truncate">{p.name}</span>
                  <span className={r ? "font-semibold" : "text-muted"}>{r ? `${r.score}/${r.total}` : t("teacher.sentWaiting")}</span>
                </li>
              );
            })}
          </ul>
          <button className="mt-3 text-[13px] text-gap-dark underline decoration-dotted underline-offset-4" onClick={onDelete}>{t("classes.deleteTest")}</button>
        </motion.div>
      )}
    </li>
  );
}

type Mix = "easier" | "balanced" | "harder";
const COUNTS: Record<TestKind, number[]> = { quiz: [5, 8, 10], exam: [10, 15, 20] };

/**
 * Making a quiz (one topic) or exam (several) from the class's own curriculum. The teacher picks topics, how many
 * questions and how hard; questions are then written for the test and checked (math keys by the engine here,
 * multiple-choice keys by an independent reading on the server). The teacher sees every question and can drop
 * any before sending. Everyone in the class gets the same questions.
 */
function Composer({ subject, grade, onCancel, onSend }: {
  subject: SubjectId; grade: number; onCancel: () => void;
  onSend: (x: { kind: TestKind; title: string; unitIds: string[]; questions: TestQuestion[] }) => Promise<void>;
}) {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const units = useMemo(() => buildPlan(subject, grade), [subject, grade]);
  const [kind, setKind] = useState<TestKind>("quiz");
  const [chosen, setChosen] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [count, setCount] = useState(8);
  const [mix, setMix] = useState<Mix>("balanced");
  const [stage, setStage] = useState<"pick" | "making" | "review" | "failed">("pick");
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [busy, setBusy] = useState(false);
  const making = useRef<AbortController | null>(null);
  useEffect(() => () => making.current?.abort(), []);
  const toggle = (id: string) => setChosen((c) => (kind === "quiz" ? [id] : c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const autoTitle = chosen.length === 1 ? t.unit(unitById(chosen[0]) as PlanUnit) : chosen.length ? t("classes.examTitle", { n: chosen.length }) : "";
  const quarters = [1, 2, 3, 4].map((q) => ({ q, units: units.filter((u) => u.quarter === q) })).filter((x) => x.units.length);

  async function make() {
    making.current?.abort();
    const ctrl = new AbortController();
    making.current = ctrl;
    setStage("making");
    setQuestions([]);
    const out = await makeTest({ unitIds: chosen, count, mix, lang }, ctrl.signal, (soFar) => !ctrl.signal.aborted && setQuestions(soFar.slice(0, -1)));
    if (ctrl.signal.aborted) return;
    if (!out) return setStage("failed");
    // Typed keys are proven here by the engine; a wrong one is dropped rather than put in front of a class.
    const kept: TestQuestion[] = [];
    for (const q of out) {
      if (q.kind === "choice") { kept.push(q); continue; }
      const form = await keyHolds(q);
      if (form) kept.push({ ...q, form });
    }
    if (ctrl.signal.aborted) return;
    setQuestions(kept);
    setStage(kept.length ? "review" : "failed");
  }

  if (stage !== "pick") {
    return (
      <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4" data-testid="composer-review">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-display text-[20px] leading-tight">{title.trim() || autoTitle}</h3>
          <span className="shrink-0 text-[13px] text-muted">{stage === "making" ? t("classes.writing") : t.plural("classes.questionCount", questions.length)}</span>
        </div>
        {stage === "failed" && <p className="mt-3 text-[14.5px] text-gap-dark">{t("classes.makeFailed")}</p>}
        <ol className="mt-3 space-y-2">
          {questions.map((q, i) => (
            <li key={i} className="rounded-2xl bg-white/50 px-3.5 py-3" data-testid="composer-question">
              <div className="flex items-center gap-2">
                <span className="font-display text-[13px] text-muted">{i + 1}</span>
                <span className={`chip !px-2 text-[11px] ${q.difficulty === "hard" ? "!bg-gap-soft text-gap-dark" : q.difficulty === "medium" ? "!bg-ochre/15 text-ochre" : "!bg-ok-soft text-ok-dark"}`}>
                  {t(q.difficulty === "hard" ? "classes.hard" : q.difficulty === "medium" ? "classes.medium" : "classes.easy")}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-muted">{unitById(q.unitId) ? t.unit(unitById(q.unitId)!) : ""}</span>
                {stage === "review" && (
                  <button className="text-[13px] text-muted underline decoration-dotted underline-offset-4" onClick={() => setQuestions((qs) => qs.filter((_, k) => k !== i))}
                    aria-label={t("classes.dropQuestion")}>{t("classes.drop")}</button>
                )}
              </div>
              <p className="prose-lesson mt-1.5 !text-[15.5px] !leading-snug"><RichText text={q.prompt} /></p>
              {q.kind === "typed" ? (
                <p className="mt-1 text-[15px]"><TeX tex={quickTex(q.given)} /> <span className="text-muted">→</span> <span className="text-ok-dark"><TeX tex={quickTex(q.expected)} /></span></p>
              ) : (
                <ul className="mt-1 space-y-0.5 text-[14px]">
                  {q.choices.map((c, k) => <li key={k} className={k === q.answer ? "font-semibold text-ok-dark" : "text-muted"}>{"ABCD"[k]}. <RichText text={c} /></li>)}
                </ul>
              )}
            </li>
          ))}
          {stage === "making" && <li className="h-16 animate-pulse rounded-2xl bg-white/40" aria-busy />}
        </ol>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn-ghost flex-1" onClick={() => { making.current?.abort(); setStage("pick"); }}>{t("welcome.back")}</button>
          {stage !== "making" && <button className="btn-ghost flex-1" onClick={() => void make()} data-testid="remake-test">{t("classes.remake")}</button>}
          <button className="btn-primary w-full" disabled={stage !== "review" || questions.length < 3 || busy} data-testid="send-test"
            onClick={async () => { setBusy(true); await onSend({ kind, title: title.trim() || autoTitle, unitIds: chosen, questions }); setBusy(false); }}>
            {t("classes.sendCount", { n: questions.length })}
          </button>
        </div>
        <p className="mt-2 text-center text-[12.5px] text-muted">{t("classes.sendNote")}</p>
      </motion.section>
    );
  }

  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4" data-testid="composer">
      <div className="flex gap-1 rounded-full bg-ink/[.06] p-1" role="radiogroup">
        {(["quiz", "exam"] as const).map((k) => (
          <button key={k} role="radio" aria-checked={kind === k} data-testid={`kind-${k}`}
            onClick={() => { setKind(k); setChosen((c) => (k === "quiz" ? c.slice(0, 1) : c)); setCount(k === "quiz" ? 8 : 15); }}
            className={`flex-1 rounded-full py-2 text-[14px] font-semibold transition ${kind === k ? "bg-ink text-paper" : "text-muted"}`}>
            {t(k === "quiz" ? "classes.quizOne" : "classes.examMany")}
          </button>
        ))}
      </div>
      <div className="mt-4 max-h-[46vh] overflow-y-auto pr-1">
        {quarters.map(({ q, units: us }) => (
          <div key={q} className="mb-3">
            <div className="kicker text-muted">{t("classes.quarter", { n: q })}</div>
            {us.map((u) => {
              const on = chosen.includes(u.id);
              return (
                <button key={u.id} onClick={() => toggle(u.id)} data-testid={`topic-${u.id}`} aria-pressed={on}
                  className={`mt-1 flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-[15px] transition ${on ? "bg-ink text-paper" : "bg-white/45"}`}>
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center ${kind === "quiz" ? "rounded-full" : "rounded-md"} border ${on ? "border-paper bg-paper text-ink" : "border-ink/30"}`}>
                    {on && <Icon name="check" size={13} />}
                  </span>
                  <span className="min-w-0 flex-1 leading-snug">{t.unit(u)}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="kicker mt-3 text-muted">{t("classes.howMany")}</div>
      <div className="mt-2 flex gap-1.5" role="radiogroup">
        {COUNTS[kind].map((n) => (
          <button key={n} role="radio" aria-checked={count === n} onClick={() => setCount(n)} data-testid={`count-${n}`}
            className={`h-10 flex-1 rounded-full font-display text-[15px] transition ${count === n ? "bg-ink text-paper" : "bg-white/55"}`}>{n}</button>
        ))}
      </div>
      <div className="kicker mt-3 text-muted">{t("classes.difficulty")}</div>
      <div className="mt-2 flex gap-1.5" role="radiogroup">
        {(["easier", "balanced", "harder"] as const).map((m) => (
          <button key={m} role="radio" aria-checked={mix === m} onClick={() => setMix(m)} data-testid={`mix-${m}`}
            className={`h-10 flex-1 rounded-full text-[14px] font-semibold transition ${mix === m ? "bg-ink text-paper" : "bg-white/55"}`}>
            {t(m === "easier" ? "classes.mixEasier" : m === "harder" ? "classes.mixHarder" : "classes.mixBalanced")}
          </button>
        ))}
      </div>

      <label className="kicker mt-3 block text-muted" htmlFor="tt">{t("classes.testTitle")}</label>
      <input id="tt" className="input mt-2 !font-sans" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={autoTitle} data-testid="test-title" />
      <div className="mt-4 flex gap-2">
        <button className="btn-ghost flex-1" onClick={onCancel}>{t("teacher.cancel")}</button>
        <button className="btn-primary flex-1" disabled={!chosen.length} onClick={() => void make()} data-testid="make-test">{t("classes.makeQuestions")}</button>
      </div>
    </motion.section>
  );
}

/** One student, as this class sees them: their results on its tests, and removal. */
function PupilSheet({ pupil, classId, subject, grade, tests, results, onClose, onRemove }: {
  pupil: Pupil; classId: string; subject: SubjectId; grade: number; tests: ClassTest[]; results: TestResult[]; onClose: () => void; onRemove: () => Promise<void>;
}) {
  const t = useT();
  const [confirm, setConfirm] = useState(false);
  const missed = missedTopics(results).slice(0, 4);
  const [progress, setProgress] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    let live = true;
    void fetchSubjectProgress(classId, pupil.id, subject).then((p) => live && setProgress(p));
    return () => { live = false; };
  }, [classId, pupil.id, subject]);
  return (
    <motion.div className="fixed inset-0 z-30 flex items-end justify-center bg-ink/30 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.aside initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} onClick={(e) => e.stopPropagation()} data-testid="pupil-sheet"
        className="glass-strong max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] px-5 pb-8 pt-4">
        <div className="mx-auto h-1 w-10 rounded-full bg-ink/15" />
        <div className="mt-4 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/70 font-display">{initials(pupil.name)}</span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[24px] leading-tight">{pupil.name}</h2>
            <div className="text-[13px] text-muted">{t("classes.joinedOn", { date: new Date(pupil.joinedAt).toLocaleDateString() })}</div>
          </div>
        </div>

        <SubjectProgress progress={progress} subject={subject} grade={grade} />

        <div className="kicker mt-6 text-muted">{t("classes.results")}</div>
        {results.length === 0 ? <p className="mt-1 text-[14.5px] text-muted">{t("classes.noResults")}</p> : (
          <ul className="mt-1 divide-y divide-ink/10">
            {results.map((r) => {
              const test = tests.find((x) => x.id === r.testId);
              return (
                <li key={r.testId} className="flex items-center justify-between gap-3 py-2.5 text-[15px]">
                  <span className="min-w-0 truncate">{test?.title ?? "—"}</span>
                  <span className="shrink-0 font-display text-[18px]">{r.score}/{r.total}</span>
                </li>
              );
            })}
          </ul>
        )}
        {missed.length > 0 && (
          <>
            <div className="kicker mt-5 text-gap-dark">{t("classes.needsWork")}</div>
            <ul className="mt-1 space-y-1 text-[14.5px]">{missed.map(([id]) => <li key={id}>· {titleOf(t, id)}</li>)}</ul>
          </>
        )}
        <p className="mt-5 text-[12.5px] text-muted">{t("classes.privacyNote")}</p>

        <div className="mt-6 border-t border-ink/10 pt-4">
          {!confirm ? (
            <button className="text-[14.5px] font-semibold text-gap-dark" onClick={() => setConfirm(true)} data-testid="remove-student">{t("teacher.removeFromClass")}</button>
          ) : (
            <div data-testid="remove-confirm">
              <p className="text-[14.5px]">{t.rich("teacher.removeConfirm", { name: <b>{pupil.name}</b> })}</p>
              <div className="mt-3 flex gap-2">
                <button className="btn-ghost btn-sm flex-1" onClick={() => setConfirm(false)}>{t("teacher.cancel")}</button>
                <button className="btn-gap btn-sm flex-1" onClick={() => void onRemove()} data-testid="confirm-remove">{t("teacher.remove")}</button>
              </div>
            </div>
          )}
        </div>
      </motion.aside>
    </motion.div>
  );
}

/**
 * A student's progress in this class's subject, and nothing else of their learning: how much of this grade's
 * plan they've finished, foundations from earlier grades they've closed, and where they're stuck right now.
 */
function SubjectProgress({ progress, subject, grade }: { progress: Record<string, string> | null; subject: SubjectId; grade: number }) {
  const t = useT();
  const plan = useMemo(() => buildPlan(subject, grade), [subject, grade]);
  if (!progress) return <div className="mt-6 h-16 animate-pulse rounded-2xl bg-white/40" aria-busy />;
  const name = t.subject(subject);
  const done = plan.filter((u) => progress[u.id] === "mastered").length;
  const earlier = Object.entries(progress).filter(([id, st]) => st === "mastered" && (unitById(id)?.grade ?? grade) < grade).length;
  const stuck = Object.entries(progress).filter(([, st]) => st === "gap").map(([id]) => unitById(id)).filter((u): u is PlanUnit => !!u)
    .sort((a, b) => a.grade - b.grade || a.quarter - b.quarter).slice(0, 5);
  return (
    <section className="mt-6" data-testid="subject-progress">
      <div className="kicker text-muted">{t("join.progressTitle", { subject: name })}</div>
      {!Object.keys(progress).length ? (
        <p className="mt-1 text-[14.5px] text-muted">{t("join.progressNone", { subject: name })}</p>
      ) : (
        <>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-[26px] leading-none">{done}/{plan.length}</span>
            <span className="text-[13.5px] text-muted">{t("join.progressGrade", { grade })}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/10"><div className="h-full rounded-full bg-ok" style={{ width: `${pct(done, plan.length)}%` }} /></div>
          {earlier > 0 && <p className="mt-1.5 text-[13px] text-muted">{t("join.progressEarlier", { n: earlier })}</p>}
          {stuck.length > 0 && (
            <>
              <div className="kicker mt-4 text-gap-dark">{t("join.progressStuck")}</div>
              <ul className="mt-1 space-y-1 text-[14.5px]">
                {stuck.map((u) => <li key={u.id} className="flex justify-between gap-3"><span className="min-w-0 truncate">{t.unit(u)}</span><span className="shrink-0 text-muted">{t("common.gradeN", { n: u.grade })}</span></li>)}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
