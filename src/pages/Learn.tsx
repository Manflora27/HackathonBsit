import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { motion } from "motion/react";
import { useAuth } from "../auth";
import { lessonGoal } from "../goals";
import { AreaModel } from "../components/AreaModel";
import { Bilog } from "../components/Bilog";
import { Shell } from "../components/Shell";
import { Icon } from "../components/Icon";
import { lessons, skillById, skillTitle } from "../data";
import { getLesson, skillTarget } from "../lessons/pipeline";
import { useT } from "../i18n";
import type { Lesson } from "../types";
import { useStore } from "../store";
import { Burst, Practice, XP_DONE } from "../components/Practice";
import { LessonView } from "../components/LessonView";

export default function Learn() {
  const t = useT();
  const nav = useNavigate();
  const { skillId = "" } = useParams();
  const { lang, setSkill, trace, progress, examMode } = useStore();
  const { classes } = useAuth();
  const skill = skillById[skillId];
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loaded, setLoaded] = useState(false);
  // Unfinished practice from an earlier visit: go straight back to it.
  const [stage, setStage] = useState<"learn" | "practice">(() => (useStore.getState().practiceResume[skillId] ? "practice" : "learn"));
  const [mastered, setMastered] = useState(false);
  const [feedback, setFeedback] = useState<null | boolean>(null);
  const visualRef = useRef<HTMLElement | null>(null);

  // Generated and verified lesson first (shared cache), the hand-authored one only if none is available.
  useEffect(() => {
    if (!skill) return;
    let live = true;
    getLesson(skillTarget(skill), lessonGoal({ examMode, behind: progress[skillId] === "gap" || !!trace?.rootSkill, inClass: classes.length > 0 })).then((r) => {
      if (!live) return;
      const seed = lessons[skillId];
      const l = r ? { ...r.lesson, visual: seed?.visual, visualArgs: seed?.visualArgs } : seed ?? null;
      setLesson(l);
      setLoaded(true);
      setMastered(false);
    });
    return () => { live = false; };
  }, [skillId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!skill) return <Shell back="/student">{t("common.unknownSkill")}</Shell>;
  if (loaded && !lesson)
    return <Shell back="/student">{t("learn.lessonNeedsConnectionPrepare")}</Shell>;
  if (!lesson)
    return (
      <Shell tabs={false} back="/student" title={t("common.gradeN", { n: skill.grade })}>
        <h1 className="font-display text-[30px] font-bold leading-tight">{skillTitle(skillId, lang)}</h1>
        <div className="mt-4 animate-pulse space-y-3" aria-busy data-testid="lesson-skeleton">
          <div className="card space-y-3">{[92, 100, 78].map((w, i) => <div key={i} className="h-4 rounded-full bg-soft" style={{ width: `${w}%` }} />)}</div>
        </div>
      </Shell>
    );
  const need = globalThis.Math.min(2, lesson.practice.length);

  return (
    <Shell tabs={false} back="/student" title={t("learn.fixGap")}>
      <div className="flex items-start gap-3">
        <h1 className="min-w-0 flex-1 font-display text-[30px] font-bold leading-tight">{skillTitle(skillId, lang)}</h1>
        {!mastered && (
          <div className="-mt-1">
            <Bilog size={50} lookAt={visualRef}
              mood={stage === "learn" ? "learn" : feedback === true ? "happy" : feedback === false ? "found" : "watch"} />
          </div>
        )}
      </div>
      <div className="mt-2 flex gap-1.5" aria-label="progress">
        {["learn", "practice", "retry"].map((s, i) => (
          <span key={s} className={`h-3 flex-1 rounded-full border border-line ${i === 0 || (i === 1 && stage === "practice") || (i === 2 && mastered) ? "bg-ok" : "bg-card"}`} />
        ))}
      </div>

      {stage === "learn" && (
        <LessonView lesson={lesson} lang={lang} onPractice={() => setStage("practice")}
          visual={lesson.visual === "area-model" && (
            <section className="mt-6" ref={visualRef}>
              <AreaModel a={lesson.visualArgs?.a} b={lesson.visualArgs?.b} />
            </section>
          )} />
      )}

      {stage === "practice" && !mastered && (
        <Practice id={skillId} items={lesson.practice} need={need} onFeedback={setFeedback} onReview={() => setStage("learn")}
          onDone={() => { setMastered(true); if (progress[skillId] !== "mastered") setSkill(skillId, "mastered"); }} />
      )}

      {mastered && (
        <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16 }}
          className="card relative mt-5 !bg-ok-soft/70 text-center" data-testid="mastered">
          <Burst />
          <div className="flex justify-center"><Bilog size={72} mood="cheer" /></div>
          <div className="mt-1 font-display text-2xl font-bold">{t("learn.gapFixed")}</div>
          <p className="mt-1 flex items-center justify-center gap-1 font-display text-[17px] text-gap"><Icon name="bolt" size={16} /> +{XP_DONE}</p>
          <p className="mt-1 text-[15px]">{t("learn.nowGoBackProblem")}</p>
          {trace ? (
            <button className="btn-primary mt-4 w-full !text-lg" onClick={() => nav(`/solve/${trace.problemId}?mode=retry`)} data-testid="retry">
              {t("common.retry")} <Icon name="arrow" size={18} />
            </button>
          ) : (
            <button className="btn-primary mt-4 w-full" onClick={() => nav("/student")}>{t("learn.backHome")}</button>
          )}
        </motion.div>
      )}
    </Shell>
  );
}
