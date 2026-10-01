import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { motion } from "motion/react";
import { classifyWithAi } from "../ai/client";
import { Math, RichText, quickTex } from "../components/Math";
import { EngineBadge, Shell } from "../components/Shell";
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
    ({ id: "custom", prompt: fil ? "Problem mo" : "Your problem", given: params.get("given") ?? "", kind: (params.get("given") ?? "").includes("=") ? "solve" : "simplify", skill: "lin_eq" } as Problem);

  const [steps, setSteps] = useState<string[]>([""]);
  const [focus, setFocus] = useState(0);
  const [confirm, setConfirm] = useState<{ latex: (string | null)[] } | null>(null);
  const [result, setResult] = useState<Analysis | null>(null);
  const [aiMc, setAiMc] = useState<{ id: string | null; confidence: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [problemTex, setProblemTex] = useState(quickTex(problem.given));
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

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

  return (
    <Shell>
      <div className="flex items-center justify-between gap-2">
        <button className="text-sm text-muted" onClick={() => nav(role === "guest" ? "/" : "/student")}>
          ← {fil ? "Bumalik" : "Back"}
        </button>
        <EngineBadge />
      </div>

      {retry && (
        <div className="mt-3 rounded-xl bg-brand-soft px-4 py-2 text-sm font-medium text-brand">
          {fil ? "Ngayon, subukan ulit ang problem na nagpahinto sa iyo." : "Now try the problem that stopped you."}
        </div>
      )}

      <div className="card mt-3">
        <div className="text-sm font-semibold text-muted">{problem.prompt}</div>
        <div className="mt-1 text-2xl" data-testid="problem">
          <Math tex={problemTex} />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {steps.map((s, i) => {
          const st = result?.steps[filled.indexOf(s.trim())]?.status;
          const isErr = result && result.errorIndex !== null && filled[result.errorIndex] === s.trim();
          return (
            <div key={i} className={`card !p-3 ${isErr ? "border-gap ring-2 ring-gap/30" : ""}`}>
              <div className="flex items-center gap-2">
                <span className="w-14 shrink-0 text-xs font-semibold uppercase text-muted">
                  {t("step")} {i + 1}
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
                  placeholder={i === 0 ? "e.g. x^2+6x+9=49" : ""}
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
                <span className="w-6 text-center text-lg" aria-label={st ?? ""}>
                  {st === "ok" ? <span className="text-ok">✓</span> : st === "error" ? <span className="text-gap">!</span> : st === "unverifiable" ? "?" : ""}
                </span>
                {steps.length > 1 && (
                  <button className="text-muted" aria-label="Remove step" onClick={() => setSteps(steps.filter((_, j) => j !== i))}>
                    ×
                  </button>
                )}
              </div>
              {s.trim() && (
                <div className="mt-1 pl-16 text-lg text-ink/80">
                  <Math tex={quickTex(s)} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Math keys">
        {KEYS.map((k) => (
          <button key={k} className="btn-ghost !px-3 !py-1.5 font-mono" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(k)}>
            {k}
          </button>
        ))}
        <button className="btn-ghost !py-1.5" onClick={() => setSteps([...steps, ""])}>
          + {t("addStep")}
        </button>
        {DEMO_STEPS[problem.id] && !retry && (
          <button className="btn-ghost !py-1.5 text-muted" onClick={() => setSteps(DEMO_STEPS[problem.id])} data-testid="fill-demo">
            {fil ? "Demo: sagot ni Kyla" : "Demo: Kyla's work"}
          </button>
        )}
      </div>

      <button className="btn-primary mt-5 w-full text-lg" disabled={!filled.length || busy} onClick={openConfirm} data-testid="check">
        {busy ? "…" : t("checkWork")}
      </button>

      {confirm && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/30 p-4 sm:items-center" role="dialog" aria-modal>
          <div className="card w-full max-w-md">
            <h2 className="text-lg font-bold">{t("isThisWhatYouWrote")}</h2>
            <ol className="mt-3 space-y-2">
              {confirm.latex.map((l, i) => (
                <li key={i} className="flex items-center gap-3 text-xl">
                  <span className="w-6 text-sm text-muted">{i + 1}.</span>
                  {l ? (
                    <Math tex={l} />
                  ) : (
                    <span className="text-base text-gap">
                      {fil ? `Hindi mabasa ang step ${i + 1}. Pakiulit.` : `We couldn't read step ${i + 1}. Can you retype it?`}
                    </span>
                  )}
                </li>
              ))}
            </ol>
            <div className="mt-5 flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => setConfirm(null)}>
                {t("edit")}
              </button>
              <button className="btn-primary flex-1" disabled={confirm.latex.some((l) => !l)} onClick={check} data-testid="confirm">
                {t("yesCheck")}
              </button>
            </div>
          </div>
        </div>
      )}

      {result && <ResultPanel result={result} mc={mc} mcId={mcId} aiMc={aiMc} retry={retry} onTrace={startTrace} problem={problem} />}
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
  const { lang, log } = useStore();
  const fil = lang === "fil";
  const [flagged, setFlagged] = useState(false);

  if (result.error) return <div className="card mt-5 text-gap">{result.error}</div>;

  if (result.errorIndex === null) {
    if (!result.complete)
      return <div className="card mt-5 border-brand/30 bg-brand-soft/40">{t("notDoneYet")}</div>;
    return (
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="card mt-5 border-ok bg-ok-soft text-center" data-testid="success">
        <div className="text-4xl">🎉</div>
        <div className="mt-1 text-xl font-bold text-ok">
          {retry ? (fil ? "Ang problem na nagpahinto sa iyo — nasagot mo!" : "The problem that stopped you — solved.") : t("allCorrect")}
        </div>
        {retry && (
          <button className="btn-primary mt-4" onClick={() => nav("/student")}>
            {fil ? "Tingnan ang skill map ko" : "See my skill map"} →
          </button>
        )}
      </motion.div>
    );
  }

  const i = result.errorIndex;
  const source = result.misconception?.source ?? (aiMc ? "ai" : null);
  return (
    <motion.section initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="card mt-5 border-gap" data-testid="diagnosis">
      <div className="text-sm font-bold uppercase tracking-wide text-gap">
        {t("foundIt")}: {t("step")} {i + 1}
      </div>
      {result.steps[i]?.status === "unparsed" ? (
        <p className="mt-2">{fil ? `Hindi mabasa ang step ${i + 1}. Pakiulit.` : `We couldn't read step ${i + 1}. Can you retype it?`}</p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-paper p-3">
            <div className="text-xs font-semibold uppercase text-muted">{fil ? "Isinulat mo" : "You wrote"}</div>
            <div className="mt-1 text-xl" data-testid="student-line">
              <Math tex={result.studentLatex ?? result.steps[i].latex ?? ""} />
            </div>
          </div>
          <div className="rounded-xl bg-paper p-3">
            <div className="text-xs font-semibold uppercase text-muted">
              {result.expectedLatex ? (fil ? "Dapat ay" : "It should be") : fil ? "Kulang" : "Missing"}
            </div>
            <div className="mt-1 text-xl" data-testid="expected-line">
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
        <div className="mt-4">
          <div className="text-lg font-bold" data-testid="misconception">{mc.title}</div>
          <p className="mt-1 text-[15px]">
            <RichText text={mc.what} />
          </p>
          <p className="mt-2 text-xs text-muted">
            {source === "rule"
              ? fil
                ? "Evidence: tumugma sa isang kilalang pattern ng pagkakamali (sigurado). Ang tama/mali ay sinuri ng SymPy, hindi ng AI."
                : "Evidence: matched a known mistake pattern exactly (certain). Right and wrong are checked by SymPy, not by AI."
              : fil
                ? `Evidence: hula ng AI (${globalThis.Math.round((aiMc?.confidence ?? 0) * 100)}% confidence). Ang tama/mali ay sinuri ng SymPy.`
                : `Evidence: AI suggestion (${globalThis.Math.round((aiMc?.confidence ?? 0) * 100)}% confidence). Right and wrong are checked by SymPy.`}
          </p>
        </div>
      ) : (
        <p className="mt-4 text-[15px]">
          {fil
            ? "Nahanap namin ang step, pero hindi pa namin kilala ang pattern. Hahanapin natin ang gap sa pamamagitan ng ilang mabilis na tanong."
            : "We found the step, but not a known pattern yet. Let's find the gap with a few quick questions."}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
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
          {flagged ? (fil ? "Salamat — makikita ito ng teacher mo" : "Thanks — your teacher will see this") : fil ? "Mukhang mali ito" : "This doesn't seem right"}
        </button>
      </div>
      <p className="mt-3 text-xs text-muted">
        {skillById[problem.skill] && `${fil ? "Problem skill" : "Problem skill"}: ${skillTitle(problem.skill, lang)} · Grade ${skillById[problem.skill].grade}`}
      </p>
    </motion.section>
  );
}
