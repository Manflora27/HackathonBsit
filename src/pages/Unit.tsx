import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { motion } from "motion/react";
import { useAuth } from "../auth";
import { lessonGoal } from "../goals";
import { Icon } from "../components/Icon";
import { Shell } from "../components/Shell";
import { unitById } from "../data/curriculum";
import { competenciesFor } from "../data/competencies";
import { getLesson, unitTarget, type CachedLesson, type LessonPreview } from "../lessons/pipeline";
import { templateLesson } from "../lessons/template";
import { useT } from "../i18n";
import { useStore } from "../store";
import { Bilog } from "../components/Bilog";
import { Burst, Practice, XP_DONE } from "../components/Practice";
import { LessonPreviewView, LessonView } from "../components/LessonView";

/** Lesson outline while the lesson is fetched or generated. */
function LessonSkeleton() {
  return (
    <div className="mt-4 animate-pulse space-y-4" aria-busy data-testid="lesson-skeleton">
      <div className="card space-y-3">
        {[92, 100, 78, 60].map((w, i) => <div key={i} className="h-4 rounded-full bg-soft" style={{ width: `${w}%` }} />)}
      </div>
      <div className="card space-y-3">
        <div className="h-3 w-24 rounded-full bg-soft" />
        <div className="h-14 rounded-2xl bg-soft" />
      </div>
    </div>
  );
}

export default function Unit() {
  const t = useT();
  const nav = useNavigate();
  const { unitId = "" } = useParams();
  const unit = unitById(unitId);
  const { lang, progress, setSkill, examMode, trace, onboarding } = useStore();
  const { profile } = useAuth();
  const [state, setState] = useState<"loading" | "failed" | CachedLesson>("loading");
  // Unfinished practice from an earlier visit: go straight back to it.
  const [stage, setStage] = useState<"learn" | "practice">(() => (useStore.getState().practiceResume[unitId] ? "practice" : "learn"));
  const [done, setDone] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [preview, setPreview] = useState<LessonPreview | null>(null);

  useEffect(() => {
    if (!unit) return;
    let live = true;
    setState("loading");
    setPreview(null);
    const streaming = { lang, onPreview: (p: LessonPreview) => live && setPreview(p) };
    getLesson(unitTarget(unit), lessonGoal({ examMode, behind: progress[unit.id] === "gap" || !!trace?.rootSkill }), streaming).then((r) => {
      if (!live) return;
      setPreview(null);
      // No generated lesson (offline, no model, or it failed its answer check): the bundled template.
      setState(r ?? { lesson: templateLesson(unitTarget(unit)), verified: true, source: "template" });
      setDone(false);
    });
    return () => { live = false; };
  }, [unitId, attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!unit) return <Shell back="/student">{t("common.unknownUnit")}</Shell>;
  // Top bar: just the subject. The page head carries the unit, sized to its length.
  const title = t.subject(unit.subject);
  const name = t.unit(unit);
  // Self-learners have no school calendar: no kicker at all (title already names the subject).
  const self = (profile?.current_grade ?? onboarding.grade) == null;
  const head = (
    <header className="mt-4">
      {!self && <div className="kicker text-muted">{t("unit.gradeQuarter", { grade: unit.grade, q: unit.quarter })}</div>}
      <h1 className={`mt-1.5 text-balance font-display leading-[1.12] ${name.length > 44 ? "text-[22px]" : name.length > 26 ? "text-[25px]" : "text-[28px]"}`}>{name}</h1>
    </header>
  );

  if (state === "loading") return <Shell tabs={false} back="/student" title={title}>{head}{preview ? <LessonPreviewView preview={preview} /> : <LessonSkeleton />}</Shell>;
  if (state === "failed")
    return (
      <Shell tabs={false} back="/student" title={title}>
        {head}
        <section className="card mt-4" data-testid="lesson-unavailable">
          {/* Offline is the usual reason; online, the lesson was made but failed its answer check. */}
          <p className="text-[17px]">{navigator.onLine ? t("unit.notReady") : t("unit.lessonNeedsConnectionPrepare")}</p>
          <p className="mt-1 text-[14px] text-muted">{navigator.onLine ? t("unit.notReadyText") : t("unit.staysPlanTryAgain")}</p>
          <button className="btn-primary mt-4" onClick={() => setAttempt((n) => n + 1)} data-testid="retry-lesson">{t("unit.tryAgain")}</button>
        </section>
      </Shell>
    );

  const { lesson, verified, source } = state;
  const comps = competenciesFor(unit.id);
  const need = globalThis.Math.min(2, lesson.practice.length);

  return (
    <Shell tabs={false} back="/student" title={title}>
      {head}
      <div className="mt-2 flex items-center gap-2 text-[13px] text-muted" data-testid="verified-badge">
        {verified ? <Icon name="check" size={14} className="text-ok" /> : <span className="chip !px-2 text-[11px]">AI</span>}
        {/* The template lesson's practice is algebra, checked by the math engine whatever the unit (lessons/template.ts). */}
        {t.verifier(!verified ? "llm" : source === "template" ? "sympy" : unit.verifier)}
      </div>

      {stage === "learn" && comps.length > 0 && (
        <details className="mt-4 rounded-2xl bg-white/40 px-4 py-3" data-testid="competencies">
          <summary className="cursor-pointer text-[14px] font-semibold">{t("unit.competencies")}</summary>
          <ul className="mt-2 space-y-1.5 text-[14px] leading-snug">
            {comps.map((c) => <li key={c.id}>{c.text} <span className="whitespace-nowrap text-[11px] text-muted">{c.id}</span></li>)}
          </ul>
          <p className="mt-2 text-[12px] text-muted">{t("unit.competencySource")}</p>
        </details>
      )}

      {stage === "learn" && <LessonView lesson={lesson} lang={lang} onPractice={() => setStage("practice")} />}

      {stage === "practice" && !done && (
        <Practice id={unit.id} key={attempt} items={lesson.practice} need={need} onReview={() => setStage("learn")}
          onDone={() => { setDone(true); if (progress[unit.id] !== "mastered") setSkill(unit.id, "mastered"); }} />
      )}

      {done && (
        <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16 }}
          className="card relative mt-5 !bg-ok-soft/70 text-center" data-testid="mastered">
          <Burst />
          <div className="flex justify-center"><Bilog size={72} mood="cheer" /></div>
          <div className="mt-1 font-display text-2xl font-bold">{t("unit.unitDone")}</div>
          <p className="mt-1 flex items-center justify-center gap-1 font-display text-[17px] text-gap"><Icon name="bolt" size={16} /> +{XP_DONE}</p>
          <button className="btn-primary mt-4 w-full" onClick={() => nav("/student")}>{t("unit.backHome")}</button>
        </motion.div>
      )}
    </Shell>
  );
}
