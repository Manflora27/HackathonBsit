import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { readAloud } from "../ai/client";
import { AreaModel } from "../components/AreaModel";
import { Math, RichText, quickTex } from "../components/Math";
import { Shell } from "../components/Shell";
import { BackButton, JourneyBar, ProgressDots, Sheet } from "../components/ui";
import { stuckHelp } from "../content/stuckHelp";
import { lessons, skillById, skillTitle } from "../data";
import { engine } from "../engine/client";
import { useT } from "../i18n";
import { useStore } from "../store";
import type { Form } from "../types";

type StuckMode = "menu" | "simple" | "hint" | "example";

export default function Learn() {
  const t = useT();
  const nav = useNavigate();
  const { skillId = "" } = useParams();
  const { lang, setSkill, trace, progress } = useStore();
  const fil = lang === "fil";
  const lesson = lessons[skillId];
  const skill = skillById[skillId];
  const [answers, setAnswers] = useState<string[]>(lesson?.practice.map(() => "") ?? []);
  const [results, setResults] = useState<(boolean | null)[]>(lesson?.practice.map(() => null) ?? []);
  const [hints, setHints] = useState<boolean[]>(lesson?.practice.map(() => false) ?? []);
  const [speaking, setSpeaking] = useState(false);
  const [stuck, setStuck] = useState<StuckMode | null>(null);
  const visualRef = useRef<HTMLElement>(null);

  if (!lesson || !skill)
    return (
      <Shell>
        <div className="card text-center">
          <p className="font-semibold">{fil ? "Hindi namin mahanap ang lesson na ito." : "We couldn't find this lesson."}</p>
          <button className="btn-primary mt-4" onClick={() => nav("/student")}>
            {fil ? "Pumunta sa Home" : "Go home"}
          </button>
        </div>
      </Shell>
    );
  const text = lesson[lang];
  const help = stuckHelp(skillId, lang);
  const goal = Math_min(2, lesson.practice.length);
  const correct = results.filter(Boolean).length;
  const mastered = correct >= goal;
  const answeredAny = results.some((r) => r !== null);

  async function check(i: number) {
    const p = lesson.practice[i];
    const r = await engine.check(p.given, answers[i], p.form);
    const next = results.map((x, j) => (j === i ? r.correct : x));
    setResults(next);
    if (next.filter(Boolean).length >= goal && progress[skillId] !== "mastered") {
      setSkill(skillId, "mastered");
    }
  }

  async function speak() {
    setSpeaking(true);
    await readAloud(text.spoken, lang);
    setSpeaking(false);
  }

  const sections = [
    { n: 1, en: "Explain", fil: "Paliwanag" },
    ...(lesson.visual ? [{ n: 2, en: "See it", fil: "Tingnan" }] : []),
    { n: lesson.visual ? 3 : 2, en: "Try one", fil: "Subukan" },
    { n: lesson.visual ? 4 : 3, en: "Practice", fil: "Practice" },
  ];
  const label = (k: number) => (fil ? sections[k].fil : sections[k].en);

  const practiceCard = (i: number) => {
    const p = lesson.practice[i];
    const r = results[i];
    return (
      <div key={i} className={`card p-4! transition-colors ${r === true ? "border-ok-line bg-ok-soft/40" : r === false ? "border-gap-line" : ""}`}>
        <div className="flex flex-wrap items-center gap-2 text-xl">
          <span className="text-sm text-muted">{p.prompt}:</span>
          <Math tex={quickTex(p.given)} />
        </div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (answers[i].trim()) check(i);
          }}
        >
          <input
            className="input"
            value={answers[i]}
            onChange={(e) => {
              setAnswers(answers.map((a, j) => (j === i ? e.target.value : a)));
              if (r === false) setResults(results.map((x, j) => (j === i ? null : x)));
            }}
            aria-label={`${p.prompt} ${p.given}`}
            placeholder={fil ? "Sagot mo" : "Your answer"}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            readOnly={r === true}
            data-testid={`practice-${i}`}
          />
          {r !== true && (
            <button className="btn-primary shrink-0" data-testid={`practice-check-${i}`}>
              {fil ? "I-check" : "Check"}
            </button>
          )}
        </form>
        <div aria-live="polite">
          {r === true && (
            <p className="gf-rise mt-2 flex items-center gap-2 text-sm font-semibold text-ok">
              <span aria-hidden className="flex h-5 w-5 items-center justify-center rounded-full bg-ok text-[11px] text-white">✓</span>
              {fil ? "Tama! Nakuha mo." : "Correct! You've got it."}
            </p>
          )}
          {r === false && (
            <div className="gf-rise mt-2 rounded-2xl bg-gap-soft/70 px-3 py-2 text-sm">
              <p className="font-semibold text-gap">{fil ? "Hindi pa — pero malapit na." : "Not yet — but you're close."}</p>
              <p className="mt-0.5">{formHint(p.form, fil)}</p>
              {help && !hints[i] && (
                <button className="mt-1 min-h-10 font-semibold text-brand-ink underline underline-offset-4" onClick={() => setHints(hints.map((h, j) => (j === i ? true : h)))}>
                  {fil ? "Bigyan ako ng hint" : "Give me a hint"}
                </button>
              )}
              {help && hints[i] && (
                <p className="mt-1.5 rounded-xl bg-card px-3 py-2">
                  💡 <RichText text={help.hint} />
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Shell>
      <BackButton onClick={() => nav(trace ? "/trace" : "/student")} label={fil ? "Bumalik" : "Back"} />
      <div className="mt-2">
        <JourneyBar stage={mastered ? "retry" : answeredAny ? "practice" : "learn"} />
      </div>

      <div className="eyebrow">Grade {skill.grade} · {fil ? "Ang skill na kulang" : "The missing skill"}</div>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight">{skillTitle(skillId, lang)}</h1>
      <p className="mt-1 text-muted">{fil ? "Ito ang nawawalang piraso. Pag-aralan natin nang magkasama." : "This is the missing piece. Let's learn it together."}</p>

      {/* 1. Explain */}
      <SectionHead n={sections[0].n} title={label(0)} />
      <section className="card space-y-3 text-[17px] leading-relaxed">
        {text.body.map((p, i) => (
          <p key={i}>
            <RichText text={p} />
          </p>
        ))}
        <button className="btn-soft text-sm" onClick={speak} disabled={speaking} data-testid="read-aloud">
          <span aria-hidden>🔊</span> {speaking ? (fil ? "Nagbabasa…" : "Reading…") : t("readAloud")}
        </button>
      </section>

      {/* 2. See it */}
      {lesson.visual === "area-model" && (
        <>
          <SectionHead n={sections[1].n} title={label(1)} />
          <section ref={visualRef} className="scroll-mt-20">
            <AreaModel b={3} />
          </section>
        </>
      )}

      {/* 3. Try one (with feedback) */}
      <SectionHead n={sections[lesson.visual ? 2 : 1].n} title={label(lesson.visual ? 2 : 1)} sub={fil ? "Isa muna. Walang bilangan dito." : "Just one to start. No pressure."} />
      {practiceCard(0)}

      {/* 4. Practice */}
      {lesson.practice.length > 1 && (
        <>
          <div className="mt-8 mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <StepNum n={sections[lesson.visual ? 3 : 2].n} />
              <h2 className="section-title">
                {t("practice")} · {correct}/{lesson.practice.length}
              </h2>
            </div>
            <ProgressDots done={Math_min(correct, goal)} goal={goal} label={fil ? `${correct} sa ${goal} na tama para ma-master` : `${correct} of ${goal} correct to master`} />
          </div>
          <p className="mb-2 text-sm text-muted">{fil ? `${goal} tamang sagot para ma-master ang skill.` : `${goal} correct answers to master this skill.`}</p>
          <div className="space-y-3">{lesson.practice.slice(1).map((_, k) => practiceCard(k + 1))}</div>
        </>
      )}

      {mastered && (
        <div className="gf-rise card mt-6 border-ok-line bg-ok-soft/60 text-center" data-testid="mastered">
          <div aria-hidden className="gf-burst mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ok text-2xl font-bold text-white">
            ✓
          </div>
          <div className="mt-3 text-lg font-extrabold text-ok">{skillTitle(skillId, lang)}</div>
          <p className="text-[15px]">{fil ? "Naayos mo ang gap. Ngayon, balikan natin ang orihinal na problem." : "Gap fixed. Now let's go back to the original problem."}</p>
          {trace ? (
            <button className="btn-primary mt-4 w-full" onClick={() => nav(`/solve/${trace.problemId}?mode=retry`)} data-testid="retry">
              {t("retry")} →
            </button>
          ) : (
            <button className="btn-primary mt-4 w-full" onClick={() => nav("/student")}>
              {fil ? "Bumalik sa Home" : "Back home"}
            </button>
          )}
        </div>
      )}

      {!mastered && (
        <button
          className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 inline-flex min-h-12 items-center gap-2 rounded-full bg-ink px-5 font-semibold text-white shadow-lg transition active:scale-95"
          onClick={() => setStuck("menu")}
          data-testid="stuck"
        >
          <span aria-hidden>🙋</span> {fil ? "Na-stuck ako" : "I'm stuck"}
        </button>
      )}

      {stuck && (
        <Sheet title={fil ? "Walang problema. Ano ang makakatulong?" : "No problem. What would help?"} onClose={() => setStuck(null)}>
          {stuck === "menu" ? (
            <ul className="mt-4 grid gap-2">
              {help && (
                <>
                  <StuckOption icon="🪶" label={fil ? "Ipaliwanag nang mas simple" : "Explain it simpler"} onClick={() => setStuck("simple")} />
                  <StuckOption icon="💡" label={fil ? "Bigyan ako ng hint" : "Give me a hint"} onClick={() => setStuck("hint")} />
                  <StuckOption icon="📝" label={fil ? "Ipakita ang halimbawa" : "Show me an example"} onClick={() => setStuck("example")} />
                </>
              )}
              {lesson.visual && (
                <StuckOption
                  icon="🧩"
                  label={fil ? "Ipakita gamit ang larawan" : "Show it visually"}
                  onClick={() => {
                    setStuck(null);
                    requestAnimationFrame(() => visualRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
                  }}
                />
              )}
              <StuckOption
                icon="🔊"
                label={speaking ? (fil ? "Nagbabasa…" : "Reading…") : t("readAloud")}
                onClick={speak}
              />
            </ul>
          ) : (
            <div className="mt-4">
              {stuck === "simple" && help && (
                <p className="rounded-2xl bg-brand-soft/50 p-4 text-lg leading-relaxed">
                  <RichText text={help.simple} />
                </p>
              )}
              {stuck === "hint" && help && (
                <p className="rounded-2xl bg-gap-soft/70 p-4 text-lg leading-relaxed">
                  💡 <RichText text={help.hint} />
                </p>
              )}
              {stuck === "example" && help && (
                <div className="rounded-2xl bg-paper p-4">
                  <div className="eyebrow">{fil ? "Halimbawa" : "Worked example"}</div>
                  <div className="mt-2 overflow-x-auto text-xl">
                    <Math tex={help.example.given} />
                  </div>
                  <ol className="mt-2 space-y-1.5">
                    {help.example.steps.map((s, i) => (
                      <li key={i} className="flex items-center gap-2 overflow-x-auto text-lg">
                        <span aria-hidden className="text-muted">→</span>
                        <Math tex={s} />
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              <div className="mt-4 flex gap-2">
                <button className="btn-ghost flex-1" onClick={() => setStuck("menu")}>
                  {fil ? "Iba pang tulong" : "Other help"}
                </button>
                <button className="btn-primary flex-1" onClick={() => setStuck(null)}>
                  {fil ? "Subukan ko ulit" : "Let me try"}
                </button>
              </div>
            </div>
          )}
        </Sheet>
      )}
    </Shell>
  );
}

function StepNum({ n }: { n: number }) {
  return (
    <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand-ink">
      {n}
    </span>
  );
}

function SectionHead({ n, title, sub }: { n: number; title: string; sub?: string }) {
  return (
    <div className="mt-8 mb-2">
      <div className="flex items-center gap-2">
        <StepNum n={n} />
        <h2 className="section-title">{title}</h2>
      </div>
      {sub && <p className="mt-1 ml-9 text-sm text-muted">{sub}</p>}
    </div>
  );
}

function StuckOption({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <li>
      <button onClick={onClick} className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-line bg-card px-4 text-left font-semibold transition hover:border-brand/40 hover:bg-brand-soft/40">
        <span aria-hidden className="text-xl">{icon}</span>
        {label}
        <span aria-hidden className="ml-auto text-muted">›</span>
      </button>
    </li>
  );
}

function formHint(form: Form, fil: boolean) {
  switch (form) {
    case "expanded":
      return fil ? "Siguraduhing naka-expand ito: walang parentheses, at pinagsama ang like terms." : "Make sure it's fully expanded: no parentheses left, like terms combined.";
    case "factored":
      return fil ? "Isulat ito bilang product ng mga factor, hal. (x+2)(x+3)." : "Write it as a product of factors, like (x+2)(x+3).";
    case "solved":
      return fil ? "Isulat ang lahat ng sagot, hal. x=2 or x=3." : "Write every solution, like x=2 or x=3.";
    default:
      return fil ? "Tingnan ulit ang bawat sign at numero, tapos subukan ulit." : "Check each sign and number again, then try once more.";
  }
}

function Math_min(a: number, b: number) {
  return a < b ? a : b;
}
