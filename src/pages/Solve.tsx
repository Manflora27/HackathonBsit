import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { motion } from "motion/react";
import { classifyWithAi } from "../ai/client";
import { Math, RichText, quickTex } from "../components/Math";
import { EngineBadge, Shell } from "../components/Shell";
import { BackButton, JourneyBar, Sheet, type Stage } from "../components/ui";
import { misconceptionById, misconceptionText, problemById, skillById, skillTitle } from "../data";
import { engine } from "../engine/client";
import { useT } from "../i18n";
import { uid, useStore } from "../store";
import type { Analysis, Problem } from "../types";

const KEYS = ["²", "^", "√(", "±", "(", ")", "/", "−", "x"];

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

  const problem: Problem =
    problemById[problemId] ??
    ({
      id: "custom",
      prompt: fil ? "Problem mo" : "Your problem",
      given: params.get("given") ?? "",
      kind: (params.get("given") ?? "").includes("=") ? "solve" : "simplify",
      skill: "lin_eq",
    } as Problem);

  const [steps, setSteps] = useState<string[]>([""]);
  const [focus, setFocus] = useState(0);
  const [confirm, setConfirm] = useState<{ latex: (string | null)[] } | null>(null);
  const [result, setResult] = useState<Analysis | null>(null);
  const [aiMc, setAiMc] = useState<{ id: string | null; confidence: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [problemTex, setProblemTex] = useState(quickTex(problem.given));
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  // Remember what was fixed before a successful retry clears the trace (for the mastery summary).
  const [fixedSkill] = useState(retry ? (trace?.rootSkill ?? null) : null);
  const [fixedPath] = useState(retry && trace ? [...trace.path].reverse() : []);

  useEffect(() => {
    engine.preview(problem.given).then((r) => r.ok && r.latex && setProblemTex(r.latex));
  }, [problem.given]);

  const filled = steps.map((s) => s.trim()).filter(Boolean);

  const insert = (k: string) => {
    const el = inputs.current[focus];
    const val = steps[focus] ?? "";
    const ins = k === "²" ? "^2" : k === "−" ? "-" : k;
    const pos = el?.selectionStart ?? val.length;
    const next = val.slice(0, pos) + ins + val.slice(pos);
    setSteps(steps.map((s, i) => (i === focus ? next : s)));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(pos + ins.length, pos + ins.length);
    });
  };

  async function openConfirm() {
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
        // the payoff: the problem that stopped her is solved
        for (const s of trace.path) setSkill(s, "mastered");
        set({ trace: null });
      }
      return;
    }
    if (a.errorIndex !== null && !a.misconception) {
      // No known wrong rule matched: ask the AI to classify against the closed list.
      const ai = await classifyWithAi({
        problem: problem.given,
        previous: a.previousLatex ?? "",
        wrong: a.steps[a.errorIndex]?.input ?? "",
        wrongTerms: a.wrongTerms,
      });
      setAiMc(ai);
      if (ai) log({ action: "classify", suggestion: `${ai.id ?? "unknown"} (${Math_round(ai.confidence)})`, decision: "shown to student", actor: "student" });
    }
    set({
      trace: {
        attemptId,
        problemId: problem.id,
        misconceptionId: a.misconception?.id ?? null,
        startSkill: problem.skill,
        path: [problem.skill],
        rootSkill: null,
      },
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

  const stage: Stage = retry
    ? result && result.errorIndex === null && result.complete
      ? "mastery"
      : "retry"
    : result && result.errorIndex !== null
      ? "find"
      : "work";

  return (
    <Shell>
      <div className="flex items-center justify-between gap-2">
        <BackButton onClick={() => nav(role === "guest" ? "/" : "/student")} label={fil ? "Bumalik" : "Back"} />
        <EngineBadge />
      </div>
      <div className="mt-2">
        <JourneyBar stage={stage} />
      </div>

      {retry && (
        <div className="gf-rise flex items-start gap-3 rounded-2xl border border-ok-line bg-ok-soft px-4 py-3">
          <span aria-hidden className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ok text-sm font-bold text-white">
            ✓
          </span>
          <p className="text-[15px]">
            {fixedSkill && (
              <b className="block">
                {fil ? "Naayos mo ang " : "You fixed "}
                {skillTitle(fixedSkill, lang)}.
              </b>
            )}
            {fil ? "Ngayon, subukan ulit ang problem na nagpahinto sa iyo." : "Now try the problem that stopped you."}
          </p>
        </div>
      )}

      <div className="card mt-3">
        <div className="eyebrow">{problem.prompt}</div>
        <div className="mt-1 overflow-x-auto text-2xl" data-testid="problem">
          <Math tex={problemTex} />
        </div>
        {!result && !retry && (
          <p className="mt-2 text-sm text-muted">
            {fil
              ? "Isulat ang bawat step sa sariling linya. Walang pressure — tinitingnan lang natin kung paano ka nag-iisip."
              : "Write each step on its own line. No pressure — we're just looking at how you think."}
          </p>
        )}
      </div>

      <ol className="mt-4 space-y-3" aria-label={fil ? "Mga step mo" : "Your steps"}>
        {steps.map((s, i) => {
          const st = result?.steps[filled.indexOf(s.trim())]?.status;
          const isErr = result && result.errorIndex !== null && filled[result.errorIndex] === s.trim();
          return (
            <li
              key={i}
              className={`card p-3! transition-colors ${isErr ? "border-gap-line bg-gap-soft/50 ring-2 ring-gap/25" : st === "ok" ? "border-ok-line" : ""}`}
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    st === "ok" ? "bg-ok text-white" : st === "error" ? "bg-gap text-white" : "bg-brand-soft text-brand-ink"
                  }`}
                >
                  {st === "ok" ? "✓" : st === "error" ? "!" : i + 1}
                </span>
                <input
                  ref={(el) => {
                    inputs.current[i] = el;
                  }}
                  className="input"
                  value={s}
                  inputMode="text"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-label={`${t("step")} ${i + 1}`}
                  placeholder={i === 0 ? "e.g. x^2+6x+9=49" : fil ? "Susunod na step…" : "Next step…"}
                  data-testid={`step-${i}`}
                  onFocus={() => setFocus(i)}
                  onChange={(e) => {
                    setResult(null);
                    setSteps(steps.map((x, j) => (j === i ? e.target.value : x)));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (i === steps.length - 1) setSteps([...steps, ""]);
                      setTimeout(() => inputs.current[i + 1]?.focus(), 0);
                    }
                  }}
                />
                {steps.length > 1 && (
                  <button
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl text-muted hover:bg-paper hover:text-ink"
                    aria-label={`${fil ? "Alisin ang step" : "Remove step"} ${i + 1}`}
                    onClick={() => setSteps(steps.filter((_, j) => j !== i))}
                  >
                    ×
                  </button>
                )}
              </div>
              {s.trim() && (
                <div className="mt-1.5 overflow-x-auto pl-10 text-lg text-ink/80">
                  <Math tex={quickTex(s)} />
                  {st === "ok" && <span className="sr-only">{fil ? "tama" : "checks out"}</span>}
                  {st === "error" && <span className="sr-only">{fil ? "dito titingnan" : "let's look here"}</span>}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {stage !== "mastery" && (
        <>
          <div className="mt-3 grid grid-cols-5 gap-1.5 sm:flex sm:flex-wrap" role="group" aria-label={fil ? "Mga math key" : "Math keys"}>
            {KEYS.map((k) => (
              <button key={k} className="btn-ghost px-0! font-mono text-lg sm:min-w-12" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(k)}>
                {k}
              </button>
            ))}
            <button className="btn-soft col-span-5 sm:col-span-1" onClick={() => setSteps([...steps, ""])}>
              + {t("addStep")}
            </button>
          </div>
          {DEMO_STEPS[problem.id] && !retry && (
            <button
              className="mt-2 min-h-11 text-sm font-medium text-muted underline underline-offset-4"
              onClick={() => setSteps(DEMO_STEPS[problem.id])}
              data-testid="fill-demo"
            >
              {fil ? "Demo: sagot ni Kyla" : "Demo: Kyla's work"}
            </button>
          )}

          <div className="sticky bottom-0 z-10 -mx-4 mt-4 bg-paper px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button className="btn-primary w-full text-lg" disabled={!filled.length || busy} onClick={openConfirm} data-testid="check">
              {busy ? (fil ? "Tinitingnan…" : "Looking…") : t("checkWork")}
            </button>
          </div>
        </>
      )}

      {confirm && (
        <Sheet title={t("isThisWhatYouWrote")} onClose={() => setConfirm(null)}>
          <p className="mt-1 text-sm text-muted">
            {fil ? "Siguraduhin nating tama ang pagbasa namin bago mag-check." : "Let's make sure we read it right before checking."}
          </p>
          <ol className="mt-4 space-y-2">
            {confirm.latex.map((l, i) => (
              <li key={i} className="flex items-center gap-3 rounded-2xl bg-paper px-3 py-2.5 text-xl">
                <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-card text-sm font-bold text-muted">
                  {i + 1}
                </span>
                {l ? (
                  <span className="overflow-x-auto">
                    <Math tex={l} />
                  </span>
                ) : (
                  <span className="text-base text-gap">
                    {fil ? `Hindi namin mabasa ang step ${i + 1}. Pakiulit?` : `We couldn't read step ${i + 1}. Can you retype it?`}
                  </span>
                )}
              </li>
            ))}
          </ol>
          <div className="mt-5 flex gap-2">
            <button className="btn-ghost flex-1" onClick={() => setConfirm(null)}>
              {t("edit")}
            </button>
            <button className="btn-primary flex-[2]" disabled={confirm.latex.some((l) => !l)} onClick={check} data-testid="confirm">
              {t("yesCheck")}
            </button>
          </div>
        </Sheet>
      )}

      <div aria-live="polite">
        {result && (
          <ResultPanel
            result={result}
            mc={mc}
            mcId={mcId}
            aiMc={aiMc}
            retry={retry}
            onTrace={startTrace}
            problem={problem}
            fixedSkill={fixedSkill}
            fixedPath={fixedPath}
          />
        )}
      </div>
    </Shell>
  );
}

function Math_round(n: number) {
  return `${globalThis.Math.round(n * 100)}%`;
}

function ResultPanel({
  result,
  mc,
  mcId,
  aiMc,
  retry,
  onTrace,
  problem,
  fixedSkill,
  fixedPath,
}: {
  result: Analysis;
  mc: { title: string; what: string } | null;
  mcId: string | null;
  aiMc: { id: string | null; confidence: number } | null;
  retry: boolean;
  onTrace: () => void;
  problem: Problem;
  fixedSkill: string | null;
  fixedPath: string[];
}) {
  const t = useT();
  const nav = useNavigate();
  const { lang, log } = useStore();
  const fil = lang === "fil";
  const [flagged, setFlagged] = useState(false);

  if (result.error)
    return (
      <div className="card mt-5 border-gap-line bg-gap-soft/50">
        <p className="font-semibold">{fil ? "Hmm, may hindi kami nabasa." : "Hmm, something didn't read right."}</p>
        <p className="mt-1 text-sm text-muted">{result.error}</p>
      </div>
    );

  if (result.errorIndex === null) {
    if (!result.complete)
      return (
        <div className="gf-rise card mt-5 flex items-start gap-3 border-brand/25 bg-brand-soft/50">
          <span aria-hidden className="text-2xl">
            👍
          </span>
          <p>{t("notDoneYet")}</p>
        </div>
      );
    return (
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="card mt-5 border-ok-line bg-ok-soft/60 text-center"
        data-testid="success"
      >
        <div aria-hidden className="gf-burst mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-ok text-3xl font-bold text-white">
          ✓
        </div>
        <div className="mt-4 text-xl font-extrabold text-ok">
          {retry ? (fil ? "Ang problem na nagpahinto sa iyo — nasagot mo!" : "The problem that stopped you — solved.") : t("allCorrect")}
        </div>
        {retry && fixedSkill && (
          <>
            <p className="mt-2 text-[15px]">
              {fil
                ? "Hindi ka mahina sa math. May kulang lang na isang skill — at nahanap at naayos mo ito."
                : "You weren't bad at math. You were missing one skill — and you found it and fixed it."}
            </p>
            <div className="mx-auto mt-4 max-w-sm rounded-2xl bg-card p-3 text-left">
              <div className="eyebrow">{fil ? "Ang natuklasan mo" : "What you discovered"}</div>
              <ul className="mt-2 space-y-1.5">
                {fixedPath.map((sk) => (
                  <li key={sk} className="flex items-center gap-2 text-sm">
                    <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ok text-[11px] font-bold text-white">
                      ✓
                    </span>
                    <span className="flex-1">{skillTitle(sk, lang)}</span>
                    <span className="text-xs text-muted">Grade {skillById[sk]?.grade}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
        {retry && (
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button className="btn-primary" onClick={() => nav("/map")}>
              {fil ? "Tingnan ang skill map ko" : "See my skill map"} →
            </button>
            <button className="btn-ghost" onClick={() => nav("/progress")}>
              {fil ? "Ang progress ko" : "My progress"}
            </button>
          </div>
        )}
      </motion.div>
    );
  }

  const i = result.errorIndex;
  const source = result.misconception?.source ?? (aiMc ? "ai" : null);
  return (
    <motion.section initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="card mt-5 border-gap-line" data-testid="diagnosis">
      <div className="flex items-center gap-3">
        <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gap-soft text-xl">
          🔍
        </span>
        <div>
          <div className="text-lg font-extrabold">{fil ? "Malapit na!" : "Almost!"}</div>
          <div className="text-[15px] text-muted">{fil ? `Tingnan natin ang step ${i + 1}.` : `Let's look at step ${i + 1}.`}</div>
        </div>
      </div>
      {result.steps[i]?.status === "unparsed" ? (
        <p className="mt-3">{fil ? `Hindi namin mabasa ang step ${i + 1}. Pakiulit?` : `We couldn't read step ${i + 1}. Can you retype it?`}</p>
      ) : (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className="rounded-2xl border border-line bg-paper p-3">
            <div className="eyebrow">{fil ? "Isinulat mo" : "You wrote"}</div>
            <div className="mt-1 overflow-x-auto text-xl" data-testid="student-line">
              <Math tex={result.studentLatex ?? result.steps[i].latex ?? ""} />
            </div>
          </div>
          <div className="rounded-2xl border border-gap-line bg-gap-soft/50 p-3">
            <div className="eyebrow text-gap!">{result.expectedLatex ? (fil ? "Dapat ay" : "It should be") : fil ? "Ang kulang" : "What's missing"}</div>
            <div className="mt-1 overflow-x-auto text-xl" data-testid="expected-line">
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
        <div className="mt-4 rounded-2xl bg-brand-soft/50 p-4">
          <div className="eyebrow">{fil ? "Ang nangyari" : "What happened"}</div>
          <div className="mt-1 text-lg font-bold" data-testid="misconception">
            {mc.title}
          </div>
          <p className="mt-1 text-[15px]">
            <RichText text={mc.what} />
          </p>
        </div>
      ) : (
        <p className="mt-4 text-[15px]">
          {fil
            ? "Nahanap namin ang step, pero hindi pa namin kilala ang pattern. Hahanapin natin ang gap sa pamamagitan ng ilang mabilis na tanong."
            : "We found the step, but not a known pattern yet. Let's find the gap with a few quick questions."}
        </p>
      )}

      <p className="mt-3 text-[15px]">
        {fil
          ? "Karaniwan ito, at isa itong clue. Kadalasan, may isang mas naunang skill sa likod nito. Hanapin natin."
          : "This is really common, and it's a clue. Usually one earlier skill is behind it. Let's find it."}
      </p>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <button className="btn-gap flex-1" onClick={onTrace} data-testid="find-root">
          {t("findRoot")} →
        </button>
        <button
          className="btn-ghost text-sm"
          disabled={flagged}
          onClick={() => {
            setFlagged(true);
            log({ action: "diagnosis", suggestion: mcId ?? "none", decision: "student flagged as wrong", actor: "student" });
          }}
        >
          {flagged
            ? fil
              ? "Salamat — makikita ito ng teacher mo"
              : "Thanks — your teacher will see this"
            : fil
              ? "Mukhang hindi ito tama"
              : "This doesn't seem right"}
        </button>
      </div>
      <p className="mt-3 text-xs text-muted">
        {source === "rule"
          ? fil
            ? "Evidence: tumugma sa isang kilalang pattern (sigurado). Ang tama/mali ay sinuri ng SymPy, hindi ng AI."
            : "Evidence: matched a known pattern exactly (certain). Right and wrong are checked by SymPy, not by AI."
          : source === "ai"
            ? fil
              ? `Evidence: hula ng AI (${globalThis.Math.round((aiMc?.confidence ?? 0) * 100)}% confidence). Ang tama/mali ay sinuri ng SymPy.`
              : `Evidence: AI suggestion (${globalThis.Math.round((aiMc?.confidence ?? 0) * 100)}% confidence). Right and wrong are checked by SymPy.`
            : ""}
        {skillById[problem.skill] && ` · ${skillTitle(problem.skill, lang)} · Grade ${skillById[problem.skill].grade}`}
      </p>
    </motion.section>
  );
}
