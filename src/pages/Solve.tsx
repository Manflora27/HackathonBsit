import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { classifyWithAi, readWork } from "../ai/client";
import { Bilog } from "../components/Bilog";
import { Math, RichText, quickTex } from "../components/Math";
import { EngineBadge, Shell } from "../components/Shell";
import { Icon } from "../components/Icon";
import { misconceptionById, misconceptionText, problemById, skillById, skillTitle } from "../data";
import { engine } from "../engine/client";
import { useT } from "../i18n";
import { uid, useStore } from "../store";
import type { Analysis, Problem } from "../types";
import { MicButton } from "../components/MicButton";
import { photoToDataUrl } from "../ai/image";

const DEMO_STEPS: Record<string, string[]> = {
  "p-kyla": ["x^2+9=49", "x^2=40", "x=±sqrt(40)"],
};

export default function Solve() {
  const t = useT();
  const nav = useNavigate();
  const { problemId = "custom" } = useParams();
  const [params] = useSearchParams();
  const retry = params.get("mode") === "retry";
  const assignmentId = params.get("assignment");
  const { lang, addAttempt, set, setSkill, trace, role } = useStore();

  const known = problemById[problemId];
  const [customGiven, setCustomGiven] = useState(params.get("given") ?? "");
  const problem: Problem =
    known ??
    ({ id: "custom", prompt: t("solve.problem"), given: customGiven, kind: customGiven.includes("=") ? "solve" : "simplify", skill: "lin_eq" } as Problem);

  // Steps handed over from Help (?steps=line\nline) start filled in.
  const [steps, setSteps] = useState<string[]>(() => params.get("steps")?.split("\n").filter(Boolean) ?? [""]);
  const [focus, setFocus] = useState<number | null>(known ? 0 : -1);
  const [confirm, setConfirm] = useState<{ latex: (string | null)[] } | null>(null);
  const [result, setResult] = useState<Analysis | null>(null);
  const [aiMc, setAiMc] = useState<{ id: string | null; confidence: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [problemTex, setProblemTex] = useState(quickTex(problem.given));
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const givenInput = useRef<HTMLInputElement | null>(null);
  const photoInput = useRef<HTMLInputElement | null>(null);
  const [snap, setSnap] = useState<"idle" | "reading" | "done" | "failed">("idle");

  // A photo of the paper becomes the typed lines (mistakes kept as written), then the learner checks them.
  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setSnap("reading");
    setResult(null);
    const out = await readWork(await photoToDataUrl(file)).catch(() => null);
    if (!out || (!out.problem && !out.steps.length)) return setSnap("failed");
    if (known) {
      const same = (a: string) => a.replace(/\s+/g, "") === problem.given.replace(/\s+/g, "");
      const lines = [out.problem, ...out.steps].filter((l) => l && !same(l));
      if (!lines.length) return setSnap("failed");
      setSteps(lines);
    } else {
      setCustomGiven(out.problem);
      setSteps(out.steps.length ? out.steps : [""]);
    }
    setFocus(null);
    setSnap("done");
  }

  // A spoken step goes into the box in focus, else the first empty one, else a new one.
  function onSpokenStep(text: string) {
    setResult(null);
    if (focus === -1) return setCustomGiven(text);
    setSteps((prev) => {
      const i = focus !== null && focus >= 0 ? focus : prev.findIndex((x) => !x.trim());
      if (i === -1) return [...prev, text];
      return prev.map((x, j) => (j === i ? text : x));
    });
  }
  const resultRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setProblemTex(quickTex(problem.given));
    if (problem.given) engine.preview(problem.given).then((r) => r.ok && r.latex && setProblemTex(r.latex));
  }, [problem.given]);

  useEffect(() => {
    if (result) setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
  }, [result]);

  const filled = steps.map((s) => s.trim()).filter(Boolean);
  const ready = filled.length > 0 && problem.given.trim().length > 0;

  function edit(i: number, value: string) {
    setResult(null);
    if (i === -1) setCustomGiven(value);
    else setSteps((prev) => prev.map((x, j) => (j === i ? value : x)));
  }

  // Enter on a step line opens the next one, like a new line in a notebook.
  function nextLine(from: number) {
    const next = from + 1;
    if (next >= steps.length) setSteps((x) => [...x, ""]);
    setFocus(next);
    setTimeout(() => inputs.current[next]?.focus(), 0);
  }

  async function openConfirm() {
    setFocus(null);
    setBusy(true);
    const previews = await Promise.all(filled.map((s) => engine.preview(s)));
    setBusy(false);
    setConfirm({ latex: previews.map((p) => (p.ok ? p.latex! : null)) });
  }

  async function check() {
    setConfirm(null);
    setBusy(true);
    const a = await engine.analyze(problem.given, filled, problem.kind);
    setBusy(false);
    setResult(a);
    setAiMc(null);

    const attemptId = uid();
    addAttempt({
      id: attemptId,
      problemId: problem.id,
      steps: filled,
      analysis: a,
      assignmentId,
      visibility: assignmentId ? "class" : "private",
      rootSkill: null,
      createdAt: Date.now(),
    });

    if (a.errorIndex === null && a.complete) {
      if (retry && trace) {
        for (const s of trace.path) setSkill(s, "mastered");
        const fixed = useStore.getState().gapsFixed;
        set({ trace: null, gapsFixed: trace.rootSkill && !fixed.includes(trace.rootSkill) ? [...fixed, trace.rootSkill] : fixed });
      }
      return;
    }
    if (a.errorIndex === null) return;
    let ai: { id: string | null; confidence: number } | null = null;
    if (!a.misconception) {
      // No known wrong rule matched: ask the AI to classify against the closed list.
      ai = await classifyWithAi({
        problem: problem.given,
        previous: a.previousLatex ?? "",
        wrong: a.steps[a.errorIndex]?.input ?? "",
        wrongTerms: a.wrongTerms,
      });
      setAiMc(ai);
    }
    set({
      trace: { attemptId, problemId: problem.id, misconceptionId: a.misconception?.id ?? null, startSkill: problem.skill, path: [problem.skill], rootSkill: null },
    });
  }

  const mcId = result?.misconception?.id ?? (aiMc && aiMc.confidence >= 0.6 ? aiMc.id : null);
  const mc = mcId && misconceptionById[mcId] ? misconceptionText(mcId, lang) : null;

  function startTrace() {
    const current = useStore.getState().trace;
    if (!current) return;
    const mSkill = mcId ? misconceptionById[mcId]?.skill : null;
    const path = mSkill && mSkill !== problem.skill ? [problem.skill, mSkill] : [problem.skill];
    set({ trace: { ...current, misconceptionId: mcId, path } });
    nav("/trace");
  }

  return (
    <Shell tabs={false} back={!known ? "/help" : role === "guest" ? "/" : "/student"} title={retry ? (t("solve.retry")) : problem.prompt}>
      {retry && (
        <div className="card-flat mb-3 flex items-center gap-2 !bg-gap-soft/70 !p-3 text-[15px] text-gap-dark">
          {t("solve.nowProblemStopped")}
        </div>
      )}

      <div className="mb-3 flex justify-center">
        <EngineBadge />
      </div>
      <section className="card relative overflow-hidden !p-0">
        <div className="flex items-start gap-3 border-b border-line px-5 pb-4 pt-5">
          <div className="min-w-0 flex-1">
          <div className="kicker text-muted">{problem.prompt}</div>
          {known ? (
            <div className="mt-1 text-[30px]" data-testid="problem">
              <Math tex={problemTex} />
            </div>
          ) : (
            <input
              ref={givenInput}
              className="input mt-2"
              placeholder="e.g. 3(x-2)=12"
              value={customGiven}
              data-math
              inputMode="text"
              enterKeyHint="next"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              onFocus={() => setFocus(-1)}
              onChange={(e) => edit(-1, e.target.value)}
              data-testid="custom-problem"
            />
          )}
          </div>
          <div className={`-mr-1 -mt-2 transition-opacity duration-300 ${result ? "opacity-0" : ""}`}>
            <Bilog size={50} mood={busy ? "think" : focus !== null && !confirm ? "watch" : "idle"} />
          </div>
        </div>

        {/* notebook lines */}
        <ol className="bg-[repeating-linear-gradient(transparent,transparent_63px,rgba(30,27,58,.08)_63px,rgba(30,27,58,.08)_64px)]">
          {steps.map((s, i) => {
            const idx = filled.indexOf(s.trim());
            const st = s.trim() && idx >= 0 ? result?.steps[idx]?.status : undefined;
            const isErr = st === "error" || st === "unparsed";
            return (
              <li key={i} className={`relative flex min-h-16 items-center gap-2 px-3 ${isErr ? "shake bg-gap-soft/60" : ""}`}>
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-display text-[13px] ${st === "ok" ? "bg-ok text-white" : isErr ? "bg-gap text-white" : "border border-line text-muted"}`}
                  aria-label={st ?? `step ${i + 1}`}>
                  {st === "ok" ? <Icon name="check" size={15} strokeWidth={2.4} /> : isErr ? "!" : i + 1}
                </span>
                <div className="min-w-0 flex-1 py-2">
                  <input
                    ref={(el) => {
                      inputs.current[i] = el;
                    }}
                    className={`w-full bg-transparent font-mono text-[18px] font-semibold outline-none placeholder:text-ink/30 ${focus === i ? "text-brand" : ""}`}
                    value={s}
                    data-math
                    inputMode="text"
                    enterKeyHint="next"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder={i === 0 ? (t("solve.firstStep")) : t("solve.nextStep")}
                    data-testid={`step-${i}`}
                    onFocus={() => setFocus(i)}
                    onChange={(e) => edit(i, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        nextLine(i);
                      }
                    }}
                  />
                  {s.trim() && (
                    <div className="text-[17px] text-ink/70">
                      <Math tex={quickTex(s)} />
                    </div>
                  )}
                </div>
                {steps.length > 1 && (
                  <button className="px-1 text-xl text-muted" aria-label={`Remove step ${i + 1}`} onClick={() => setSteps(steps.filter((_, j) => j !== i))}>
                    ×
                  </button>
                )}
              </li>
            );
          })}
        </ol>
        <div className="flex flex-wrap gap-2 border-t-2 border-line p-3">
          <button className="btn-ghost btn-sm" onClick={() => {
            setSteps([...steps, ""]);
            setFocus(steps.length);
            setTimeout(() => inputs.current[steps.length]?.focus(), 0);
          }}>
            + {t("common.addStep")}
          </button>
          {DEMO_STEPS[problem.id] && !retry && (
            <button className="btn-ghost btn-sm !text-muted" onClick={() => setSteps(DEMO_STEPS[problem.id])} data-testid="fill-demo">
              {t("solve.demoKylasWork")}
            </button>
          )}
          <button className="btn-ghost btn-sm" onClick={() => photoInput.current?.click()} disabled={snap === "reading"} data-testid="snap">
            <Icon name="camera" size={16} /> {snap === "reading" ? t("solve.reading") : t("solve.snap")}
          </button>
          <input ref={photoInput} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={(e) => { void onPhoto(e.target.files?.[0]); e.target.value = ""; }} data-testid="snap-input" />
          <MicButton onText={onSpokenStep} label={t("solve.sayStep")} testId="say-step" />
          {snap === "done" && <p className="w-full text-[13px] text-muted" role="status">{t("solve.snapDone")}</p>}
          {snap === "failed" && <p className="w-full text-[13px] text-gap-dark" role="status">{t("solve.snapFailed")}</p>}
        </div>
      </section>

      <button className="btn-primary mt-4 w-full !text-lg" disabled={!ready || busy} onClick={openConfirm} data-testid="check">
        {busy ? "…" : t("common.checkWork")}
      </button>

      <div ref={resultRef} className="scroll-mt-16">
        {result && <ResultPanel result={result} mc={mc} aiMc={aiMc} retry={retry} onTrace={startTrace} problem={problem} />}
      </div>

      <AnimatePresence>
        {confirm && (
          <motion.div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/30 p-3 backdrop-blur-sm" role="dialog" aria-modal
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="card glass-strong w-full max-w-md !rounded-[28px]" initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}>
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-ink/20" />
              <h2 className="font-display text-2xl font-semibold">{t("common.isThisWhatYouWrote")}</h2>
              <ol className="mt-3 space-y-2">
                {confirm.latex.map((l, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-2xl bg-soft px-3 py-2 text-[21px]">
                    <span className="font-display text-sm text-muted">{i + 1}</span>
                    {l ? <Math tex={l} /> : <span className="text-base text-gap-dark">{t("solve.couldntReadStep", { n: i + 1 })}</span>}
                  </li>
                ))}
              </ol>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button className="btn-ghost" onClick={() => setConfirm(null)}>{t("common.edit")}</button>
                <button className="btn-primary" disabled={confirm.latex.some((l) => !l)} onClick={check} data-testid="confirm">{t("common.yesCheck")}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Shell>
  );
}

function ResultPanel({
  result,
  mc,
  aiMc,
  retry,
  onTrace,
  problem,
}: {
  result: Analysis;
  mc: { title: string; what: string } | null;
  aiMc: { id: string | null; confidence: number } | null;
  retry: boolean;
  onTrace: () => void;
  problem: Problem;
}) {
  const t = useT();
  const nav = useNavigate();
  const { lang, role } = useStore();
  const markRef = useRef<HTMLDivElement | null>(null);

  if (result.error) return <div className="card mt-5">{t("solve.couldntReadProblemCan")}</div>;

  if (result.errorIndex === null) {
    if (!result.complete)
      return <div className="card mt-5 !bg-ok-soft/70 text-ok-dark">{t("common.notDoneYet")}</div>;
    return (
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16 }}
        className="card relative mt-5 !bg-ok-soft/70 text-center" data-testid="success">
        <div className="flex justify-center"><Bilog size={76} mood={retry ? "cheer" : "happy"} /></div>
        <div className="mt-2 font-display text-[28px] leading-tight">
          {retry ? (t("solve.problemStoppedSolved")) : t("common.allCorrect")}
        </div>
        {retry && <div className="mt-2 flex items-center justify-center gap-1.5 text-ok-dark"><Icon name="sprout" size={16} /> {t("solve.plusOneGapFixed")}</div>}
        {retry && (
          <button className="btn-ok mt-4 w-full" onClick={() => nav("/map")}>
            {t("solve.seeMySkillMap")} →
          </button>
        )}
        {!retry && role !== "guest" && (
          <button className="btn-ghost mt-4 w-full" onClick={() => nav("/student")}>{t("solve.backHome")}</button>
        )}
      </motion.div>
    );
  }

  const i = result.errorIndex;
  const source = result.misconception?.source ?? (aiMc ? "ai" : null);
  return (
    <motion.section initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className="card mt-5 !p-0" data-testid="diagnosis">
      <div className="flex items-start gap-3 px-5 pt-5">
        <div className="min-w-0 flex-1">
          <div className="kicker text-gap-dark">{t("common.foundIt")}</div>
          <div className="mt-1 font-display text-[26px] leading-tight">{t("solve.brokeAtStep", { n: i + 1 })}</div>
        </div>
        <div className="-mr-1 -mt-2"><Bilog size={54} mood="found" lookAt={markRef} /></div>
      </div>
      <div className="p-5">
        {result.steps[i]?.status === "unparsed" ? (
          <p>{t("solve.couldntReadStep", { n: i + 1 })}</p>
        ) : (
          <div className="space-y-2">
            <div className="rounded-2xl border-2 border-line px-4 py-3">
              <div className="kicker text-muted">{t("solve.wrote")}</div>
              <div className="mt-1 text-[22px]" data-testid="student-line">
                <Math tex={result.studentLatex ?? result.steps[i].latex ?? ""} />
              </div>
            </div>
            <div className="flex justify-center text-muted"><Icon name="arrow" size={16} className="rotate-90" /></div>
            <div ref={markRef} className="rounded-2xl bg-ok-soft/70 px-4 py-3">
              <div className="kicker text-ok-dark">{result.expectedLatex ? (t("solve.should")) : t("solve.missing")}</div>
              <div className="mt-1 text-[22px]" data-testid="expected-line">
                {result.expectedLatex ? (
                  <Math tex={result.expectedLatex} />
                ) : result.wrongTerms?.missing.length ? (
                  <Math tex={result.wrongTerms.missing.map((m) => `\\htmlClass{gf-mark}{${m}}`).join(",\\ ")} />
                ) : (
                  <span className="text-base text-muted">—</span>
                )}
              </div>
            </div>
          </div>
        )}

        {mc ? (
          <div className="mt-5">
            <div className="font-display text-[22px] leading-tight" data-testid="misconception">{mc.title}</div>
            <p className="mt-1.5 text-[16px] leading-relaxed">
              <RichText text={mc.what} />
            </p>
            <p className="mt-4 border-l-2 border-line pl-3 text-[13px] leading-relaxed text-muted">
                            <span>
                {source === "rule"
                  ? t("solve.matchedKnownMistakePattern")
                  : t("solve.aiSuggestion", { pct: globalThis.Math.round((aiMc?.confidence ?? 0) * 100) })}
              </span>
            </p>
          </div>
        ) : (
          <p className="mt-5 text-[16px]">
            {t("solve.foundStepButNot")}
          </p>
        )}

        <button className="btn-gap mt-5 w-full !text-lg" onClick={onTrace} data-testid="find-root">
          <Icon name="search" size={18} /> {t("common.findRoot")}
        </button>
        {skillById[problem.skill] && (
          <p className="mt-1 text-center text-xs text-muted">
            {skillTitle(problem.skill, lang)} · {t("common.gradeN", { n: skillById[problem.skill].grade })}
          </p>
        )}
      </div>
    </motion.section>
  );
}
