import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { Bilog } from "../components/Bilog";
import { Icon } from "../components/Icon";
import { Shell } from "../components/Shell";
import { SubjectIcon } from "../components/SubjectIcon";
import { skillById, skillTitle } from "../data";
import { startGrade, type PlanUnit, type SubjectId } from "../data/curriculum";
import { useT } from "../i18n";
import { currentUnit, timeline, usePlanContext } from "../plan";
import { useStore } from "../store";

type Status = "mastered" | "gap" | "doing" | "here" | "todo";

/** One subject's roots, as a line from where the learner started to their own grade. */
export default function MapPage() {
  const t = useT();
  const nav = useNavigate();
  const { progress, placement, practiceResume, trace, lang, gapsFixed } = useStore();
  const plan = usePlanContext();
  // No subjects yet (the stage demo): Kyla's Grade 9 math.
  const subjects: SubjectId[] = plan.subjects.length ? plan.subjects : ["math"];
  const grade = plan.subjects.length ? plan.grade : 9;
  const [subject, setSubject] = useState<SubjectId>(subjects.find((s) => placement[s]) ?? subjects[0]);
  const here = useRef<HTMLLIElement | null>(null);

  const p = placement[subject];
  const now = currentUnit(subject, grade, p, progress);
  const units = now?.units ?? timeline(subject, grade, p);
  const start = now?.start ?? 0;
  // "You are here": the first unit from the starting point that isn't mastered yet. Only once the check has run.
  const hereAt = now?.index ?? -1;
  const statusOf = (u: PlanUnit, i: number): Status =>
    progress[u.id] === "mastered" ? "mastered"
      : progress[u.id] === "gap" || (p?.gap && p.unitId === u.id) ? "gap"
        : practiceResume[u.id] ? "doing"
          : i === hereAt ? "here" : "todo";
  const done = units.filter((u) => progress[u.id] === "mastered").length;
  // Progress by grade along the path: foundations below the learner's grade, then their own.
  const top = startGrade(subject, grade);
  const grades = [...new Set(units.map((u) => u.grade))].map((g) => {
    const us = units.filter((u) => u.grade === g);
    return { g, n: us.length, done: us.filter((u) => progress[u.id] === "mastered").length };
  });
  const below = grades.filter((x) => x.g < top);
  const foundations = { done: below.reduce((a, x) => a + x.done, 0), n: below.reduce((a, x) => a + x.n, 0) };
  const own = grades.find((x) => x.g === top) ?? { g: top, n: 0, done: 0 };
  const gaps = units.filter((u, i) => statusOf(u, i) === "gap").length;
  const pctDone = Math.round((done / Math.max(1, units.length)) * 100);
  const rootOpen = trace?.rootSkill && progress[trace.rootSkill] !== "mastered" ? trace.rootSkill : null;

  useEffect(() => {
    here.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [subject]);

  return (
    <Shell title={t("map.myRoots")}>
      <div className="mt-2 flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-[32px] leading-tight">{t("map.title")}</h1>
          <p className="mt-1 text-[15px] text-muted">{t("map.timelineSub")}</p>
        </div>
        <Bilog size={54} sprout={gapsFixed.length > 0} mood={gapsFixed.length > 0 ? "happy" : rootOpen ? "found" : "idle"} />
      </div>

      {subjects.length > 1 && (
        <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist">
          {subjects.map((s) => (
            <button key={s} role="tab" aria-selected={s === subject} onClick={() => setSubject(s)} data-testid={`roots-${s}`}
              className={`flex shrink-0 items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 text-[14px] font-semibold transition ${s === subject ? "bg-ink text-paper" : "bg-white/55 text-ink"}`}>
              <SubjectIcon id={s} size={26} onColor={s === subject} /> {t.subject(s)}
            </button>
          ))}
        </div>
      )}

      {rootOpen && (
        <button className="mt-4 flex w-full items-center gap-3 rounded-[22px] bg-gap px-4 py-3.5 text-left text-white" onClick={() => nav(`/learn/${rootOpen}`)} data-testid="roots-trace">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 font-display">G{skillById[rootOpen].grade}</span>
          <span className="min-w-0 flex-1">
            <span className="kicker block text-white/75">{t("home.rootGap")}</span>
            <span className="block font-display text-[19px] leading-tight">{skillTitle(rootOpen, lang)}</span>
          </span>
          <Icon name="arrow" />
        </button>
      )}

      {!p ? (
        <button className="mt-4 flex w-full items-center gap-3 rounded-[22px] bg-ink px-4 py-3.5 text-left text-paper" onClick={() => nav(`/check/${subject}`)} data-testid="roots-check">
          <Icon name="compass" size={22} />
          <span className="flex-1 text-[15px]">{t("map.takeCheck")}</span>
          <Icon name="arrow" />
        </button>
      ) : (
        <section className="mt-5 rounded-[24px] bg-white/50 px-4 py-4 shadow-[0_12px_28px_-22px_rgb(30_43_39/.6)]" data-testid="roots-progress">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-[40px] leading-none">{pctDone}%</span>
            <span className="text-[14px] text-muted">{t("map.pathPct", { grade: top })}</span>
          </div>
          {/* One segment per grade on the path, sized by its topics, filled by what's mastered. */}
          <div className="mt-3 flex gap-1" aria-hidden>
            {grades.map((x) => (
              <div key={x.g} className="min-w-0" style={{ flex: x.n }}>
                <div className="h-2 overflow-hidden rounded-full bg-ink/10">
                  <motion.div className={`h-full rounded-full ${x.g < top ? "bg-ochre" : "bg-ok"}`} initial={{ width: 0 }}
                    animate={{ width: `${(x.done / Math.max(1, x.n)) * 100}%` }} transition={{ duration: 0.8 }} />
                </div>
                <div className="mt-1 truncate text-center text-[11px] text-muted">G{x.g}</div>
              </div>
            ))}
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
            {foundations.n > 0 && (
              <div><dt className="text-[12px] text-muted">{t("map.foundations")}</dt><dd className="font-display text-[20px]">{foundations.done}/{foundations.n}</dd></div>
            )}
            <div><dt className="text-[12px] text-muted">{t("common.gradeN", { n: top })}</dt><dd className="font-display text-[20px]">{own.done}/{own.n}</dd></div>
            <div><dt className="text-[12px] text-muted">{t("map.gapsOpen")}</dt><dd className={`font-display text-[20px] ${gaps ? "text-gap-dark" : ""}`}>{gaps}</dd></div>
          </dl>
          {now ? (
            <button className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-left text-paper" onClick={() => nav(`/unit/${now.unit.id}`)} data-testid="roots-next">
              <span className="min-w-0 flex-1">
                <span className="kicker block text-paper/65">{t("map.upNext")} · {t("common.gradeN", { n: now.unit.grade })}</span>
                <span className="block truncate font-display text-[17px]">{t.unit(now.unit)}</span>
              </span>
              <Icon name="arrow" />
            </button>
          ) : (
            <p className="mt-3 text-center text-[14px] text-ok-dark">{t("map.pathDone", { grade: top })}</p>
          )}
        </section>
      )}

      <ol className="relative mt-5" data-testid="roots-timeline">
        {/* The root line itself, behind the nodes. */}
        <span className="absolute bottom-3 left-[15px] top-3 w-[2px] rounded-full bg-ink/12" aria-hidden />
        {units.map((u, i) => {
          const s = statusOf(u, i);
          const newGrade = i === 0 || units[i - 1].grade !== u.grade;
          const before = i < start && s === "todo";
          return (
            <li key={u.id} ref={s === "here" || (hereAt < 0 && i === start) ? here : undefined} className="relative">
              {newGrade && (
                <div className={`relative mb-1 flex items-center gap-3 ${i ? "mt-5" : ""}`}>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-paper font-display text-[13px] ring-2 ring-ink/12">{u.grade}</span>
                  <span className="kicker flex-1 text-muted">{t("common.gradeN", { n: u.grade })}</span>
                  <span className="text-[12px] text-muted">{(() => { const x = grades.find((y) => y.g === u.grade); return x ? `${x.done}/${x.n}` : ""; })()}</span>
                </div>
              )}
              <button onClick={() => nav(`/unit/${u.id}`)} data-testid={`roots-unit-${u.id}`} data-status={s}
                className={`flex w-full items-center gap-3 rounded-2xl py-2.5 pr-2 text-left transition ${s === "here" ? "bg-white/60 shadow-[0_10px_24px_-18px_rgb(30_43_39/.6)]" : ""} ${before ? "opacity-55" : ""}`}>
                <Node s={s} />
                <span className="min-w-0 flex-1">
                  {s === "here" && <span className="kicker block text-gap-dark">{t("map.youAreHere")}</span>}
                  <span className={`block leading-snug ${s === "here" ? "font-display text-[18px]" : "text-[15.5px]"}`}>{t.unit(u)}</span>
                  <span className="block text-[12.5px] text-muted">
                    Q{u.quarter}{s === "mastered" ? ` · ${t("map.mastered")}` : s === "gap" ? ` · ${t("map.gapLegend")}` : s === "doing" ? ` · ${t("map.inProgress")}` : ""}
                  </span>
                </span>
                <Icon name="chevron" size={16} className="shrink-0 text-muted" />
              </button>
            </li>
          );
        })}
      </ol>

    </Shell>
  );
}

/** The dot on the line: filled moss when mastered, persimmon for a gap, a pulsing ring where the learner is. */
function Node({ s }: { s: Status }) {
  const base = "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full";
  if (s === "mastered") return <span className={`${base} bg-ok text-white`}><Icon name="check" size={16} /></span>;
  if (s === "gap") return <span className={`${base} bg-gap text-white`}><span className="h-2 w-2 rounded-full bg-white" /></span>;
  if (s === "here")
    return (
      <span className={`${base} bg-ink text-paper`}>
        <motion.span className="absolute inset-0 rounded-full ring-2 ring-ink/40" animate={{ scale: [1, 1.45], opacity: [0.8, 0] }} transition={{ duration: 1.6, repeat: Infinity }} />
        <Icon name="arrow" size={14} />
      </span>
    );
  if (s === "doing") return <span className={`${base} bg-paper ring-2 ring-ochre`}><span className="h-3 w-1.5 rounded-l-full bg-ochre" style={{ marginLeft: -6 }} /></span>;
  return <span className={`${base} bg-paper ring-2 ring-ink/15`} />;
}
