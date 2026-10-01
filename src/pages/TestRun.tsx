import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { Bilog } from "../components/Bilog";
import { Icon } from "../components/Icon";
import { Math, RichText, quickTex } from "../components/Math";
import { MicButton } from "../components/MicButton";
import { Question } from "../components/Practice";
import { Shell } from "../components/Shell";
import { unitById } from "../data/curriculum";
import { useT } from "../i18n";
import { checkPractice, getLesson, unitTarget } from "../lessons/pipeline";
import { fetchMyTests, submitResult, type MyTest } from "../school";
import { useStore } from "../store";
import type { Lesson } from "../types";

/** A question as the student meets it: the test's own (with `q`, its index) or, on older tests, lesson practice. */
type Item = Lesson["practice"][number] & { unitId: string; kind?: "typed" | "choice"; choices?: string[]; answer?: number; why?: string; q?: number };
const QUIZ_MAX = 6;
const EXAM_PER_TOPIC = 3;
const EXAM_MAX = 12;

/** The test's questions: its own, written and checked when the teacher made it. Older tests use lesson practice. */
async function questionsFor(t: MyTest["test"]): Promise<Item[]> {
  if (t.questions?.length) return t.questions.map((x, q) => ({ ...x, q }));
  const per = t.kind === "quiz" ? QUIZ_MAX : EXAM_PER_TOPIC;
  const sets = await Promise.all(t.unitIds.map(async (id) => {
    const u = unitById(id);
    const r = u ? await getLesson(unitTarget(u)) : null;
    return (r?.lesson.practice ?? []).slice(0, per).map((p) => ({ ...p, unitId: id }));
  }));
  return sets.flat().slice(0, t.kind === "quiz" ? QUIZ_MAX : EXAM_MAX);
}

/**
 * Taking a quiz or exam a teacher sent: one try per question, no hints, the score at the end.
 * Only right/wrong per question goes to the teacher, never the typed answers.
 */
export default function TestRun() {
  const t = useT();
  const nav = useNavigate();
  const { testId = "" } = useParams();
  const { practiceResume, saveResume, addXp } = useStore();
  const key = `test:${testId}`;
  const [mine, setMine] = useState<MyTest | null | undefined>(undefined);
  const [items, setItems] = useState<Item[] | null>(null);
  const [qi, setQi] = useState(() => practiceResume[key]?.qi ?? 0);
  const [right, setRight] = useState<boolean[]>(() => (practiceResume[key]?.results ?? []).map(Boolean));
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<boolean | null>(null);

  useEffect(() => {
    let live = true;
    fetchMyTests().then(async (all) => {
      const m = all.find((x) => x.test.id === testId) ?? null;
      if (!live) return;
      setMine(m);
      if (m && !m.result) setItems(await questionsFor(m.test));
    });
    return () => { live = false; };
  }, [testId]);

  async function finish(all: boolean[]) {
    const score = all.filter(Boolean).length;
    saveResume(key, null);
    addXp(score * 5);
    setSent(await submitResult(testId, score, all.length, all.map((r, i) => ({ unitId: items![i].unitId, right: r, ...(items![i].q !== undefined ? { q: items![i].q } : {}) }))));
  }

  async function next(pick?: number) {
    if (!items || busy) return;
    const item = items[qi];
    if (item.kind === "choice" ? pick === undefined : !answer.trim()) return;
    setBusy(true);
    const ok = item.kind === "choice" ? pick === item.answer : await checkPractice(item, answer).catch(() => false);
    const all = [...right, ok];
    setRight(all);
    setAnswer("");
    setBusy(false);
    if (all.length >= items.length) return void finish(all);
    setQi(qi + 1);
    saveResume(key, { qi: qi + 1, results: all });
  }

  const title = mine ? t(mine.test.kind === "exam" ? "classes.exam" : "classes.quiz") : "";
  if (mine === undefined || (mine && !mine.result && items === null))
    return <Shell tabs={false} back="/student" title={title}><p className="mt-10 text-center text-muted">{t("classes.preparing")}</p></Shell>;
  if (mine === null) return <Shell tabs={false} back="/student"><p className="mt-10 text-center text-muted">{t("classes.testGone")}</p></Shell>;

  const done = mine.result ?? (items && right.length >= items.length ? { score: right.filter(Boolean).length, total: items.length } : null);
  return (
    <Shell tabs={false} back="/student" title={title}>
      <div className="mt-2 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="kicker text-muted">{mine.className}</div>
          <h1 className="mt-0.5 text-[26px] leading-tight">{mine.test.title}</h1>
        </div>
        <Bilog size={50} mood={done ? (done.score / done.total >= 0.75 ? "cheer" : "happy") : "watch"} />
      </div>

      {done ? (
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-8" data-testid="test-done">
          <div className="kicker text-ok-dark">{t("classes.yourScore")}</div>
          <div className="font-display text-[56px] leading-none" data-testid="test-score">{done.score}<span className="text-[28px] text-muted">/{done.total}</span></div>
          <p className="mt-2 text-[15px] text-muted">{sent === false ? t("classes.notSent") : t("classes.sentToTeacher")}</p>
          {items && right.length === items.length && (
            <ul className="mt-6 divide-y divide-ink/10 border-y border-ink/10" data-testid="test-review">
              {items.map((p, i) => (
                <li key={i} className="flex items-start gap-3 py-3">
                  <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white ${right[i] ? "bg-ok" : "bg-gap"}`}>
                    <Icon name={right[i] ? "check" : "close"} size={14} />
                  </span>
                  <span className="min-w-0 flex-1 text-[15px]">
                    <span className="prose-lesson block !text-[16px] !leading-snug"><RichText text={p.prompt} /></span>
                    {!right[i] && p.kind === "choice" && p.choices && p.answer !== undefined && (
                      <span className="mt-1 block text-[14px] text-muted">{t("practice.answerIs")}: <RichText text={p.choices[p.answer]} /></span>
                    )}
                    {!right[i] && p.kind !== "choice" && p.expected && <span className="mt-1 block text-[14px] text-muted">{t("practice.answerIs")}: <Math tex={quickTex(p.expected)} /></span>}
                    {!right[i] && p.why && <span className="mt-1 block text-[14px] text-muted"><RichText text={p.why} /></span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <button className="btn-primary mt-6 w-full" onClick={() => nav("/student")}>{t("unit.backHome")}</button>
        </motion.section>
      ) : items!.length === 0 ? (
        <p className="mt-8 text-[15.5px]">{t("classes.testNeedsConnection")}</p>
      ) : (
        <>
          <div className="mt-5 flex gap-1" aria-hidden>
            {items!.map((_, k) => <span key={k} className={`h-1.5 flex-1 rounded-full ${k < qi ? "bg-ink/70" : k === qi ? "bg-gap" : "bg-ink/15"}`} />)}
          </div>
          <AnimatePresence mode="wait">
            <motion.section key={qi} initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -40, opacity: 0 }} className="mt-5">
              <div className="kicker text-muted">{t("check.questionOf", { n: qi + 1, total: items!.length })}</div>
              {items![qi].kind === "choice" ? (
                <>
                  <p className="prose-lesson mt-3 !text-[19px] !leading-snug"><RichText text={items![qi].prompt} /></p>
                  <div className="mt-4 space-y-2" role="radiogroup">
                    {items![qi].choices!.map((c, k) => (
                      <button key={k} role="radio" aria-checked={false} disabled={busy} onClick={() => void next(k)} data-testid={`test-choice-${k}`}
                        className="flex w-full items-center gap-4 rounded-2xl border border-white/60 bg-white/45 px-3 py-3.5 text-left text-[17px]">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/55 font-display text-[14px] text-muted">{"ABCD"[k]}</span>
                        <span className="flex-1"><RichText text={c} /></span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (<>
              <Question p={items![qi]} />
              <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void next(); }}>
                <input className="input" value={answer} onChange={(e) => setAnswer(e.target.value)} data-math inputMode="text" enterKeyHint="done"
                  autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder={t("unit.answer")} data-testid="test-answer" />
                <button className="btn-primary shrink-0" disabled={busy || !answer.trim()} data-testid="test-next">
                  {qi === items!.length - 1 ? t("classes.finish") : <Icon name="arrow" size={18} />}
                </button>
              </form>
              <div className="mt-2"><MicButton onText={setAnswer} testId="answer-mic" /></div>
              </>)}
              <p className="mt-4 text-[13px] text-muted">{t("classes.oneTry")}</p>
            </motion.section>
          </AnimatePresence>
        </>
      )}
    </Shell>
  );
}
