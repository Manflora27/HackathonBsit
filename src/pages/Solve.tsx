import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { classifyWithAi } from "../ai/client";
import { Bilog } from "../components/Bilog";
import { Keypad, type KeyAction } from "../components/Keypad";
import { Math, RichText, quickTex } from "../components/Math";
import { EngineBadge, Shell } from "../components/Shell";
import { Icon } from "../components/Icon";
import { misconceptionById, misconceptionText, problemById, skillById, skillTitle } from "../data";
import { engine } from "../engine/client";
import { useT } from "../i18n";
import { uid, useStore } from "../store";
import type { Analysis, Problem } from "../types";

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
  const { lang, addAttempt, set, setSkill, log, trace, role } = useStore();
  const fil = lang === "fil";

  const known = problemById[problemId];
  const [customGiven, setCustomGiven] = useState(params.get("given") ?? "");
  const problem: Problem =
    known ??
    ({ id: "custom", prompt: fil ? "Ang problem mo" : "Your problem", given: customGiven, kind: customGiven.includes("=") ? "solve" : "simplify", skill: "lin_eq" } as Problem);

  const [steps, setSteps] = useState<string[]>([""]);
  const [focus, setFocus] = useState<number | null>(known ? 0 : -1);
  const [textMode, setTextMode] = useState(false);
  const [confirm, setConfirm] = useState<{ latex: (string | null)[] } | null>(null);
  const [result, setResult] = useState<Analysis | null>(null);
  const [aiMc, setAiMc] = useState<{ id: string | null; confidence: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [problemTex, setProblemTex] = useState(quickTex(problem.given));
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const givenInput = useRef<HTMLInputElement | null>(null);
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

  function onKey(a: KeyAction) {
    if (focus === null) return;
    const el = focus === -1 ? givenInput.current : inputs.current[focus];
    const val = focus === -1 ? customGiven : steps[focus] ?? "";
    const start = el?.selectionStart ?? val.length;
    const end = el?.selectionEnd ?? val.length;
    if ("enter" in a) {
      const next = focus + 1;
      if (next >= steps.length) setSteps((s) => [...s, ""]);
      setFocus(next);
      setTimeout(() => inputs.current[next]?.focus(), 0);
      return;
    }
    let nextVal = val;
    let caret = start;
    if ("backspace" in a) {
      if (start === end && start > 0) {
        nextVal = val.slice(0, start - 1) + val.slice(end);
        caret = start - 1;
      } else {
        nextVal = val.slice(0, start) + val.slice(end);
      }
    } else if ("insert" in a) {
      nextVal = val.slice(0, start) + a.insert + val.slice(end);
      caret = start + a.insert.length;
    }
    edit(focus, nextVal);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
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
      if (ai) log({ action: "classify", suggestion: `${ai.id ?? "unknown"} (${globalThis.Math.round(ai.confidence * 100)}%)`, decision: "shown to student", actor: "student" });
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

  const keypadOpen = focus !== null && !textMode && !confirm;

  return (
    <Shell tabs={false} back={role === "guest" ? "/" : "/student"} title={retry ? (fil ? "Subukan ulit" : "Retry") : problem.prompt}>
      {retry && (
        <div className="card-flat mb-3 flex items-center gap-2 !bg-gap-soft/70 !p-3 text-[15px] text-gap-dark">
          {fil ? "Ngayon, ang problem na nagpahinto sa iyo." : "Now, the problem that stopped you."}
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
              inputMode={textMode ? "text" : "none"}
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
                    inputMode={textMode ? "text" : "none"}
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder={i === 0 ? (fil ? "Unang step mo…" : "Your first step…") : fil ? "Susunod na step…" : "Next step…"}
                    data-testid={`step-${i}`}
                    onFocus={() => setFocus(i)}
                    onChange={(e) => edit(i, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        onKey({ enter: true });
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
            + {t("addStep")}
          </button>
          {DEMO_STEPS[problem.id] && !retry && (
            <button className="btn-ghost btn-sm !text-muted" onClick={() => setSteps(DEMO_STEPS[problem.id])} data-testid="fill-demo">
              {fil ? "Demo: gawa ni Kyla" : "Demo: Kyla's work"}
            </button>
          )}
          {textMode && (
            <button className="btn-ghost btn-sm" onClick={() => setTextMode(false)}>
              <Icon name="keyboard" size={16} /> {fil ? "Math keypad" : "Math keypad"}
            </button>
          )}
        </div>
      </section>

      {!keypadOpen && (
        <button className="btn-primary mt-4 w-full !text-lg" disabled={!ready || busy} onClick={openConfirm} data-testid="check">
          {busy ? "…" : t("checkWork")}
        </button>
      )}

      <div ref={resultRef} className="scroll-mt-16">
        {result && <ResultPanel result={result} mc={mc} mcId={mcId} aiMc={aiMc} retry={retry} onTrace={startTrace} problem={problem} />}
      </div>

      {keypadOpen && <div className="h-[430px]" />}
      <AnimatePresence>
        {keypadOpen && (
          <motion.div
            className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md px-3 pb-[max(env(safe-area-inset-bottom),10px)]"
            initial={{ y: 320 }}
            animate={{ y: 0 }}
            exit={{ y: 320 }}
            transition={{ type: "spring", stiffness: 400, damping: 34 }}
          >
            <div className="mb-2 flex gap-2">
              <button className="btn-ghost btn-sm" onClick={() => setFocus(null)} aria-label="Hide keypad">⌄</button>
              <button className="btn-primary btn-sm flex-1" disabled={!ready || busy} onClick={openConfirm} data-testid="check">
                {t("checkWork")}
              </button>
            </div>
            <Keypad value={focus === -1 ? customGiven : steps[focus ?? 0] ?? ""} onKey={onKey} onTextMode={() => {
              setTextMode(true);
              const el = focus === -1 ? givenInput.current : inputs.current[focus ?? 0];
              el?.blur();
              setTimeout(() => el?.focus(), 50);
            }} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirm && (
          <motion.div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/30 p-3 backdrop-blur-sm" role="dialog" aria-modal
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="card glass-strong w-full max-w-md !rounded-[28px]" initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}>
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-ink/20" />
              <h2 className="font-display text-2xl font-semibold">{t("isThisWhatYouWrote")}</h2>
              <ol className="mt-3 space-y-2">
                {confirm.latex.map((l, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-2xl bg-soft px-3 py-2 text-[21px]">
                    <span className="font-display text-sm text-muted">{i + 1}</span>
                    {l ? <Math tex={l} /> : <span className="text-base text-gap-dark">{fil ? `Hindi mabasa ang step ${i + 1}. Pakiulit.` : `We couldn't read step ${i + 1}. Can you retype it?`}</span>}
                  </li>
                ))}
              </ol>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button className="btn-ghost" onClick={() => setConfirm(null)}>{t("edit")}</button>
                <button className="btn-primary" disabled={confirm.latex.some((l) => !l)} onClick={check} data-testid="confirm">{t("yesCheck")}</button>
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
  mcId,
  aiMc,
  retry,
  onTrace,
  problem,
}: {
  result: Analysis;
  mc: { title: string; what: string } | null;
  mcId: string | null;
  aiMc: { id: string | null; confidence: number } | null;
  retry: boolean;
  onTrace: () => void;
  problem: Problem;
}) {
  const t = useT();
  const nav = useNavigate();
  const { lang, log, role } = useStore();
  const fil = lang === "fil";
  const [flagged, setFlagged] = useState(false);
  const markRef = useRef<HTMLDivElement | null>(null);

  if (result.error) return <div className="card mt-5">{fil ? "Hindi mabasa ang problem. Pakiulit." : "We couldn't read the problem. Can you retype it?"}</div>;

  if (result.errorIndex === null) {
    if (!result.complete)
      return <div className="card mt-5 !bg-ok-soft/70 text-ok-dark">{t("notDoneYet")}</div>;
    return (
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16 }}
        className="card relative mt-5 !bg-ok-soft/70 text-center" data-testid="success">
        <div className="flex justify-center"><Bilog size={76} mood={retry ? "cheer" : "happy"} /></div>
        <div className="mt-2 font-display text-[28px] leading-tight">
          {retry ? (fil ? "Ang problem na nagpahinto sa iyo — nasagot mo!" : "The problem that stopped you — solved.") : t("allCorrect")}
        </div>
        {retry && <div className="mt-2 flex items-center justify-center gap-1.5 text-ok-dark"><Icon name="sprout" size={16} /> +1 {fil ? "gap na naayos" : "gap fixed"}</div>}
        {retry && (
          <button className="btn-ok mt-4 w-full" onClick={() => nav("/map")}>
            {fil ? "Tingnan ang skill map ko" : "See my skill map"} →
          </button>
        )}
        {!retry && role !== "guest" && (
          <button className="btn-ghost mt-4 w-full" onClick={() => nav("/student")}>{fil ? "Bumalik" : "Back home"}</button>
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
          <div className="kicker text-gap-dark">{t("foundIt")}</div>
          <div className="mt-1 font-display text-[26px] leading-tight">{fil ? `Nagkamali sa step ${i + 1}` : `It broke at step ${i + 1}`}</div>
        </div>
        <div className="-mr-1 -mt-2"><Bilog size={54} mood="found" lookAt={markRef} /></div>
      </div>
      <div className="p-5">
        {result.steps[i]?.status === "unparsed" ? (
          <p>{fil ? `Hindi mabasa ang step ${i + 1}. Pakiulit.` : `We couldn't read step ${i + 1}. Can you retype it?`}</p>
        ) : (
          <div className="space-y-2">
            <div className="rounded-2xl border-2 border-line px-4 py-3">
              <div className="kicker text-muted">{fil ? "Isinulat mo" : "You wrote"}</div>
              <div className="mt-1 text-[22px]" data-testid="student-line">
                <Math tex={result.studentLatex ?? result.steps[i].latex ?? ""} />
              </div>
            </div>
            <div className="flex justify-center text-muted"><Icon name="arrow" size={16} className="rotate-90" /></div>
            <div ref={markRef} className="rounded-2xl bg-ok-soft/70 px-4 py-3">
              <div className="kicker text-ok-dark">{result.expectedLatex ? (fil ? "Dapat ay" : "It should be") : fil ? "Kulang" : "Missing"}</div>
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
                  ? fil ? "Tumugma sa kilalang pattern ng pagkakamali (sigurado). Ang tama at mali ay sinuri ng SymPy, hindi ng AI." : "Matched a known mistake pattern exactly (certain). Right and wrong are checked by SymPy, not by AI."
                  : fil ? `Hula ng AI (${globalThis.Math.round((aiMc?.confidence ?? 0) * 100)}%). Ang tama at mali ay sinuri ng SymPy.` : `AI suggestion (${globalThis.Math.round((aiMc?.confidence ?? 0) * 100)}% confident). Right and wrong are checked by SymPy.`}
              </span>
            </p>
          </div>
        ) : (
          <p className="mt-5 text-[16px]">
            {fil ? "Nahanap namin ang step, pero hindi pa kilala ang pattern. Hanapin natin ang gap sa ilang mabilis na tanong." : "We found the step, but not a known pattern yet. Let's find the gap with a few quick questions."}
          </p>
        )}

        <button className="btn-gap mt-5 w-full !text-lg" onClick={onTrace} data-testid="find-root">
          <Icon name="search" size={18} /> {t("findRoot")}
        </button>
        <button
          className="mt-3 w-full py-2 text-sm text-muted underline decoration-dotted underline-offset-4"
          disabled={flagged}
          onClick={() => {
            setFlagged(true);
            log({ action: "diagnosis", suggestion: mcId ?? "none", decision: "student flagged as wrong", actor: "student" });
          }}
        >
          {flagged ? (fil ? "Salamat — makikita ito ng teacher mo" : "Thanks — your teacher will see this") : fil ? "Mukhang mali ang diagnosis?" : "Diagnosis doesn't seem right?"}
        </button>
        {skillById[problem.skill] && (
          <p className="mt-1 text-center text-xs text-muted">
            {skillTitle(problem.skill, lang)} · Grade {skillById[problem.skill].grade}
          </p>
        )}
      </div>
    </motion.section>
  );
}
