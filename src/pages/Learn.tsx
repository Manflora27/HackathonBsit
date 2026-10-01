import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { readAloud } from "../ai/client";
import { AreaModel } from "../components/AreaModel";
import { Math, RichText, quickTex } from "../components/Math";
import { Shell } from "../components/Shell";
import { lessons, skillById, skillTitle } from "../data";
import { engine } from "../engine/client";
import { useT } from "../i18n";
import { useStore } from "../store";

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
  const [speaking, setSpeaking] = useState(false);

  if (!lesson || !skill) return <Shell>Unknown skill.</Shell>;
  const text = lesson[lang];
  const correct = results.filter(Boolean).length;
  const mastered = correct >= Math_min(2, lesson.practice.length);

  async function check(i: number) {
    const p = lesson.practice[i];
    const r = await engine.check(p.given, answers[i], p.form);
    const next = results.map((x, j) => (j === i ? r.correct : x));
    setResults(next);
    if (next.filter(Boolean).length >= Math_min(2, lesson.practice.length) && progress[skillId] !== "mastered") {
      setSkill(skillId, "mastered");
    }
  }

  return (
    <Shell>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">
        Grade {skill.grade} · {fil ? "Roadmap" : "Roadmap"}
      </div>
      <h1 className="text-2xl font-bold">{skillTitle(skillId, lang)}</h1>

      <section className="card mt-4 space-y-3 text-[17px] leading-relaxed">
        {text.body.map((p, i) => (
          <p key={i}>
            <RichText text={p} />
          </p>
        ))}
        <button
          className="btn-ghost text-sm"
          onClick={async () => {
            setSpeaking(true);
            await readAloud(text.spoken, lang);
            setSpeaking(false);
          }}
          data-testid="read-aloud"
        >
          🔊 {speaking ? "…" : t("readAloud")}
        </button>
      </section>

      {lesson.visual === "area-model" && (
        <section className="mt-4">
          <AreaModel b={3} />
        </section>
      )}

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-muted">
        {t("practice")} · {correct}/{lesson.practice.length}
      </h2>
      <div className="mt-2 space-y-3">
        {lesson.practice.map((p, i) => (
          <div key={i} className={`card !p-4 ${results[i] === true ? "border-ok" : results[i] === false ? "border-gap" : ""}`}>
            <div className="flex items-center gap-2 text-lg">
              <span className="text-sm text-muted">{p.prompt}:</span>
              <Math tex={quickTex(p.given)} />
            </div>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (answers[i].trim()) check(i);
              }}
            >
              <input
                className="input"
                value={answers[i]}
                onChange={(e) => setAnswers(answers.map((a, j) => (j === i ? e.target.value : a)))}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                data-testid={`practice-${i}`}
              />
              <button className="btn-primary shrink-0" data-testid={`practice-check-${i}`}>OK</button>
            </form>
            {results[i] === true && <p className="mt-1 text-sm font-semibold text-ok">✓ {fil ? "Tama" : "Correct"}</p>}
            {results[i] === false && (
              <p className="mt-1 text-sm font-semibold text-gap">
                ! {p.form === "expanded" ? (fil ? "Hindi pa tama — siguraduhing naka-expand ito." : "Not yet — make sure it's fully expanded.") : fil ? "Hindi pa tama — subukan ulit." : "Not yet — try again."}
              </p>
            )}
          </div>
        ))}
      </div>

      {mastered && (
        <div className="card mt-5 border-ok bg-ok-soft/60" data-testid="mastered">
          <div className="text-lg font-bold text-ok">✓ {skillTitle(skillId, lang)}</div>
          <p className="text-[15px]">{fil ? "Naayos mo ang gap. Ngayon, balikan natin ang orihinal na problem." : "Gap fixed. Now let's go back to the original problem."}</p>
          {trace ? (
            <button className="btn-primary mt-3 w-full" onClick={() => nav(`/solve/${trace.problemId}?mode=retry`)} data-testid="retry">
              {t("retry")} →
            </button>
          ) : (
            <button className="btn-primary mt-3 w-full" onClick={() => nav("/student")}>
              {fil ? "Bumalik" : "Back home"}
            </button>
          )}
        </div>
      )}
    </Shell>
  );
}

function Math_min(a: number, b: number) {
  return a < b ? a : b;
}
