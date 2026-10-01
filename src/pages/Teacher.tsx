import { useEffect, useMemo, useRef, useState } from "react";
import { teacherInsight } from "../ai/client";
import { Bilog } from "../components/Bilog";
import { Math } from "../components/Math";
import { Shell } from "../components/Shell";
import { pushTeacherOverride } from "../classroom";
import TeacherClasses from "./TeacherClasses";
import { misconceptionById, misconceptionText, misconceptions, problemById, skills as allSkills, skillTitle } from "../data";
import { useT } from "../i18n";

// Foundational skills first, so the gap columns are visible without scrolling.
const skills = [...allSkills].sort((a, b) => a.grade - b.grade || a.y - b.y || a.x - b.x).reverse().sort((a, b) => a.grade - b.grade);
import { buildSeedClass, KYLA_ID } from "../data/seedClass";
import { uid, useStore } from "../store";
import type { Analysis, SkillStatus, Student } from "../types";

const CLASS_CODE = "SAMP-924";

/** The shape the slide-over renders, for local demo attempts and server attempts alike. */
type ShownAttempt = {
  id: string;
  problemId: string;
  assignmentId?: string | null;
  analysis: Analysis;
  teacherOverride?: { misconceptionId: string | null; note: string };
};

/**
 * The stage demo's class: Ms. Santos's Grade 9 with Kyla live on this device, plus a seeded class.
 * Real teachers use TeacherClasses / ClassPage instead.
 */
function TeacherDashboard() {
  const { lang, progress, attempts, shareSkillMap, practiceAssignments, set, updateAttempt, log } = useStore();
  const t = useT();
  const seed = useMemo(buildSeedClass, []);
  const [confirm, setConfirm] = useState<{ skillId: string; ids: string[] } | null>(null);
  const [toast, setToast] = useState<{ id: string; text: string } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [insight, setInsight] = useState<{ text: string; ai: boolean } | null>(null);
  const [openSent, setOpenSent] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement | null>(null);

  // Kyla is live on this device: her assigned work (class-visible) and, if she shares it, her skill map.
  const classAttempts = attempts.filter((a) => a.visibility === "class");
  const kylaGap = classAttempts.map((a) => a.rootSkill).filter(Boolean).pop() ?? null;
  const kylaSkills: Record<string, SkillStatus> = {};
  for (const s of skills) kylaSkills[s.id] = shareSkillMap ? (progress[s.id] ?? "unknown") : "unknown";
  if (kylaGap) kylaSkills[kylaGap] = progress[kylaGap] === "mastered" ? "mastered" : "gap";
  const kyla: Student = {
    id: KYLA_ID,
    name: "Kyla Manalastas",
    anonId: "Student 402",
    skills: kylaSkills,
    lastMisconception: classAttempts.map((a) => a.teacherOverride?.misconceptionId ?? a.analysis.misconception?.id).filter(Boolean).pop() ?? undefined,
    rootGap: kylaGap ?? undefined,
    live: true,
  };
  const students: Student[] = [kyla, ...seed];

  const groups = useMemo(() => {
    const out: Record<string, Student[]> = {};
    for (const st of students) if (st.rootGap) (out[st.rootGap] ??= []).push(st);
    return Object.entries(out).sort((a, b) => b[1].length - a[1].length);
  }, [students]);

  const top = groups[0];
  useEffect(() => {
    if (!top) return;
    // Only aggregate numbers go to the AI — never names.
    teacherInsight({ skill: skillTitle(top[0], "en"), count: top[1].length, classSize: students.length, lang }).then(setInsight);
  }, [top?.[0], top?.[1].length, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  async function assign() {
    if (!confirm) return;
    const id = uid();
    set({ practiceAssignments: [...practiceAssignments, { id, skillId: confirm.skillId, studentIds: confirm.ids, createdAt: Date.now() }] });
    log({ action: "assign practice", suggestion: `group by gap: ${confirm.skillId}`, decision: `teacher assigned to ${confirm.ids.length}`, actor: "teacher" });
    setToast({ id, text: t.plural("teacher.sentTo", confirm.ids.length) });
    setConfirm(null);
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 8000);
  }

  function undo() {
    if (!toast) return;
    set({ practiceAssignments: useStore.getState().practiceAssignments.filter((p) => p.id !== toast.id) });
    log({ action: "assign practice", suggestion: "-", decision: "teacher undid assignment", actor: "teacher" });
    setToast(null);
  }

  function exportCsv() {
    const header = ["student", ...skills.map((s) => s.id)];
    const rows = students.map((s) => [s.name, ...skills.map((k) => s.skills[k.id])]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "9-sampaguita-skills.csv";
    a.click();
  }

  function override(a: ShownAttempt, misconceptionId: string | null) {
    const patch = { misconceptionId, note: "" };
    updateAttempt(a.id, { teacherOverride: patch });
    void pushTeacherOverride(a.id, patch);
    log({ action: "diagnosis", suggestion: a.analysis.misconception?.id ?? "none", decision: `teacher override: ${misconceptionId ?? "none"}`, actor: "teacher" });
  }

  const sel = students.find((s) => s.id === selected);
  const shownAttempts: ShownAttempt[] = classAttempts;

  return (
    <Shell wide title={t("teacher.myClass")}>
      {(
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="kicker text-muted">Ms. Santos</div>
            <h1 className="font-display text-[30px] font-bold leading-tight">{t("common.gradeN", { n: 9 })} – Sampaguita</h1>
            <div className="text-sm text-muted">
              {t.plural("teacher.studentCount", students.length)} · {t("teacher.classCode")}{" "}
              <span className="chip bg-brand-soft font-mono text-brand">{CLASS_CODE}</span>
            </div>
          </div>
          <button className="btn-ghost btn-sm" onClick={exportCsv}>⬇ CSV</button>
        </div>
      )}

      <section className="mt-5 grid gap-3 md:grid-cols-3">
        {groups.slice(0, 3).map(([sid, list], i) => {
          const still = list.filter((s) => s.skills[sid] !== "mastered");
          const fixed = list.length - still.length;
          return (
          <div key={sid} ref={i === 0 ? topRef : undefined} className={`card ${i === 0 ? "!bg-gap-soft/70" : ""}`} data-testid={`gap-group-${sid}`}>
            <div className="flex items-center gap-3">
              <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-line font-display text-[32px] font-bold ${i === 0 ? "bg-gap" : "bg-card"}`}
                data-testid={i === 0 ? "top-gap-count" : undefined}>{list.length}</div>
            <div className="text-[15px] leading-snug">
              {t.rich("teacher.shareGapIn", {
                skill: <b className="font-display text-[17px] font-semibold">{skillTitle(sid, lang)}</b>,
                grade: <span className="text-muted">({t("common.gradeN", { n: skills.find((s) => s.id === sid)?.grade ?? "" })})</span>,
              })}
            </div>
            </div>
            {fixed > 0 && (
              <div className="chip mt-2 bg-ok-soft text-ok" data-testid={i === 0 ? "top-gap-fixed" : undefined}>
                ✓ {t("teacher.alreadyFixed", { count: fixed })}
              </div>
            )}
            {list.some((s) => s.live) && <div className="chip mt-2 ml-1 bg-brand-soft text-brand">● {t("teacher.includesKylaLive")}</div>}
            {still.length > 0 && (
              <button className={`${i === 0 ? "btn-gap" : "btn-ghost"} btn-sm mt-3 w-full`} onClick={() => setConfirm({ skillId: sid, ids: still.map((s) => s.id) })}
                data-testid={i === 0 ? "assign-top" : undefined}>
                {t("teacher.assignTo", { count: still.length })}
              </button>
            )}
          </div>
          );
        })}
      </section>

      {insight && students.length > 0 && (
        <div className="card mt-4 flex items-start gap-3 !bg-brand-soft/70 text-[15px]">
          <Bilog size={44} mood={toast ? "happy" : "found"} lookAt={topRef} />
          <div className="min-w-0 flex-1">
            <span className="chip mr-2 bg-brand text-white">{insight.ai ? "AI " : ""}{t("teacher.suggestion")}</span>
            {insight.text}
            <div className="mt-1 text-xs text-muted">
              {t("teacher.basedOnlyClassCounts")}
            </div>
          </div>
        </div>
      )}

      <SentHistory
        assignments={
          practiceAssignments.map((p) => ({
            id: p.id,
            skillId: p.skillId,
            createdAt: p.createdAt,
            studentIds: p.studentIds,
          }))
        }
        students={students}
        attemptsFor={(id) => (id === KYLA_ID ? classAttempts : [])}
        showEmpty={false}
        expanded={openSent}
        onToggle={(id) => setOpenSent((cur) => (cur === id ? null : id))}
        onSelect={setSelected}
        onRemove={(id) => {
          set({ practiceAssignments: useStore.getState().practiceAssignments.filter((p) => p.id !== id) });
          log({ action: "assign practice", suggestion: "-", decision: "teacher removed assignment", actor: "teacher" });
          if (openSent === id) setOpenSent(null);
        }}
      />

      <section className="mt-5 space-y-2 md:hidden">
        <h2 className="kicker text-muted">{t("teacher.students2")}</h2>
        {students.map((st) => {
          const gaps = Object.entries(st.skills).filter(([, v]) => v === "gap").map(([k]) => k);
          const done = Object.values(st.skills).filter((v) => v === "mastered").length;
          return (
            <button key={st.id} className={`card-flat flex w-full items-center gap-3 !p-3 text-left ${st.live ? "!bg-brand-soft" : ""}`}
              onClick={() => setSelected(st.id)} data-testid={st.live ? "row-kyla" : undefined}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-card font-display">
                {st.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-extrabold">{st.name} {st.live && <span className="chip ml-1 bg-brand text-white">{t("teacher.live")}</span>}</span>
                <span className="block truncate text-[13px] text-muted">
                  {gaps.length ? `! ${gaps.map((g) => skillTitle(g, lang)).join(", ")}` : `✓ ${t("teacher.masteredCount", { count: done })}`}
                </span>
              </span>
              <span className="font-display text-muted">›</span>
            </button>
          );
        })}
      </section>

      <section className="card mt-5 hidden overflow-x-auto !p-0 md:block">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="sticky left-0 bg-white/60 p-2 pl-4">{t("teacher.student")}</th>
              {skills.map((s) => (
                <th key={s.id} className="p-1 text-center text-[11px] font-medium text-muted" title={skillTitle(s.id, lang)}>
                  G{s.grade}
                  <div className="mx-auto max-w-[64px] truncate">{skillTitle(s.id, lang).split(" ").slice(0, 2).join(" ")}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((st) => (
              <tr key={st.id} className={`cursor-pointer border-b border-line/60 hover:bg-paper ${st.live ? "bg-brand-soft/30" : ""}`}
                onClick={() => setSelected(st.id)}>
                <td className="sticky left-0 bg-inherit p-2 pl-4 font-medium">
                  {st.name} {st.live && <span className="chip ml-1 bg-brand text-white">{t("teacher.live")}</span>}
                </td>
                {skills.map((s) => (
                  <td key={s.id} className="p-1 text-center">
                    <Cell status={st.skills[s.id]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {sel && (
        <div className="fixed inset-0 z-30 flex justify-end bg-ink/30 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <aside className="h-full w-full max-w-md overflow-y-auto glass-strong !rounded-none p-5" onClick={(e) => e.stopPropagation()}>
            <button className="text-sm text-muted" onClick={() => setSelected(null)}>✕ {t("teacher.close")}</button>
            <h2 className="mt-2 text-xl font-bold">{sel.name}</h2>
            <div className="text-sm text-muted">{t("teacher.seenAiAs")} “{sel.anonId}”</div>
            {sel.lastMisconception && (
              <div className="card mt-3">
                <div className="text-xs font-semibold uppercase text-muted">{t("teacher.latestDiagnosis")}</div>
                <div className="font-bold">{misconceptionText(sel.lastMisconception, lang).title}</div>
              </div>
            )}
            {sel.live && (
              <div className="mt-3 space-y-3">
                {shownAttempts.length === 0 && <p className="text-sm text-muted">{t("teacher.noSubmittedWorkYet")}</p>}
                {shownAttempts.map((a) => (
                  <div key={a.id} className="card">
                    <div className="text-sm text-muted">{problemById[a.problemId]?.given}</div>
                    <ol className="mt-1 space-y-1">
                      {a.analysis.steps.map((s, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className={s.status === "error" ? "text-gap" : "text-ok"}>{s.status === "error" ? "!" : s.status === "ok" ? "✓" : "·"}</span>
                          {s.latex && <Math tex={s.latex} />}
                        </li>
                      ))}
                    </ol>
                    <label className="mt-3 block text-xs font-semibold uppercase text-muted">
                      {t("teacher.diagnosisCanOverride")}
                    </label>
                    <select
                      className="input mt-1 !font-sans !text-sm"
                      value={a.teacherOverride?.misconceptionId ?? a.analysis.misconception?.id ?? ""}
                      onChange={(e) => override(a, e.target.value || null)}
                    >
                      <option value="">{t("teacher.noPattern")}</option>
                      {misconceptions.map((m) => (
                        <option key={m.id} value={m.id}>
                          {misconceptionText(m.id, lang).title}
                        </option>
                      ))}
                    </select>
                    {a.teacherOverride && misconceptionById[a.teacherOverride.misconceptionId ?? ""] && (
                      <div className="mt-1 text-xs text-brand">{t("teacher.overrodeEnginesDiagnosis")}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="mt-4 text-xs text-muted">
              {t("teacher.youOnlySeeAssigned")}
            </p>
          </aside>
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-ink/30 p-3 backdrop-blur-sm sm:items-center" role="dialog" aria-modal>
          <div className="card w-full max-w-md">
            <h2 className="font-display text-2xl font-semibold">{t("teacher.sendPractice")}</h2>
            <p className="mt-2 text-[15px]">
              {t.rich("teacher.confirmPractice", { count: <b>{confirm.ids.length}</b>, skill: <b>{skillTitle(confirm.skillId, lang)}</b> })}
            </p>
            <div className="mt-5 flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => setConfirm(null)}>{t("teacher.cancel")}</button>
              <button className="btn-primary flex-1" onClick={assign} data-testid="confirm-assign">{t("teacher.send")}</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-4 whitespace-nowrap rounded-2xl border border-line bg-ink px-4 py-3 font-display text-white" role="status">
          ✓ {toast.text}
          <button className="font-semibold text-amber-300" onClick={undo}>{t("teacher.undo")}</button>
        </div>
      )}
    </Shell>
  );
}

function Cell({ status }: { status: SkillStatus }) {
  if (status === "gap") return <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-gap text-xs font-bold text-white" aria-label="gap">!</span>;
  if (status === "mastered") return <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-ok-soft text-xs text-ok" aria-label="mastered">✓</span>;
  return <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-paper text-xs text-muted" aria-label="not checked">·</span>;
}

type SentItem = { id: string; skillId: string; createdAt: string | number; studentIds: string[] };
type PerStudent = "done" | "tried" | "waiting";

/**
 * Previously sent practice with per-student performance. Same card/chip/button
 * vocabulary as the student app. "Done" means the skill shows mastered or a
 * linked attempt checked out correct; "tried" means an attempt exists but the
 * gap is still open; otherwise waiting.
 */
function SentHistory({
  assignments,
  students,
  attemptsFor,
  showEmpty,
  expanded,
  onToggle,
  onSelect,
  onRemove,
}: {
  assignments: SentItem[];
  students: Student[];
  attemptsFor: (studentId: string) => { assignmentId?: string | null; analysis: Analysis }[];
  showEmpty: boolean;
  expanded: string | null;
  onToggle: (id: string) => void;
  onSelect: (studentId: string) => void;
  onRemove: (id: string) => void;
}) {
  const { lang } = useStore();
  const t = useT();
  if (!assignments.length && !showEmpty) return null;
  const byId = new Map(students.map((s) => [s.id, s]));

  const statusOf = (st: Student | undefined, skillId: string, assignmentId: string): PerStudent => {
    if (!st) return "waiting";
    if (st.skills[skillId] === "mastered") return "done";
    const linked = attemptsFor(st.id).filter((a) => a.assignmentId === assignmentId);
    if (!linked.length) return "waiting";
    return linked.some((a) => a.analysis.errorIndex === null && a.analysis.complete) ? "done" : "tried";
  };

  return (
    <section className="mt-5" data-testid="sent-history" aria-label={t("teacher.sentTitle")}>
      <h2 className="kicker text-muted">{t("teacher.sentTitle")} · {assignments.length}</h2>
      {assignments.length === 0 ? (
        <p className="mt-2 text-[15px] text-muted">{t("teacher.sentEmpty")}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {assignments.map((a) => {
            const targets = a.studentIds.length ? a.studentIds : students.map((s) => s.id);
            const states = targets.map((id) => statusOf(byId.get(id), a.skillId, a.id));
            const done = states.filter((s) => s === "done").length;
            const tried = states.filter((s) => s === "tried").length;
            const pct = targets.length ? globalThis.Math.round((done / targets.length) * 100) : 0;
            const open = expanded === a.id;
            const when = (() => {
              const d = new Date(a.createdAt);
              return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
            })();
            return (
              <li key={a.id} className="card !p-4" data-testid={`sent-item-${a.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-display text-[18px] leading-tight">{a.skillId ? skillTitle(a.skillId, lang) : "—"}</div>
                    <div className="mt-1 text-[13px] text-muted">
                      {when}{when ? " · " : ""}{t.plural("teacher.sentTo", targets.length)}
                      {tried > 0 && done < targets.length ? ` · ${tried} ${t("teacher.sentTried")}` : ""}
                    </div>
                  </div>
                  <span className={`chip shrink-0 ${done === targets.length && targets.length > 0 ? "bg-ok-soft text-ok" : "bg-brand-soft text-brand"}`}>
                    {t("teacher.sentDoneOf", { done, total: targets.length })}
                  </span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink/10" aria-hidden>
                  <div className="h-full rounded-full bg-ok transition-all" style={{ width: `${pct}%` }} />
                </div>
                {open && (
                  <ul className="mt-3 divide-y divide-line border-t border-line">
                    {targets.map((id) => {
                      const st = byId.get(id);
                      const s = statusOf(st, a.skillId, a.id);
                      return (
                        <li key={id}>
                          <button className="flex w-full items-center gap-3 py-2.5 text-left" onClick={() => st && onSelect(st.id)}>
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-card font-display text-[13px]">
                              {(st?.name ?? "?").split(" ").map((w) => w[0]).slice(0, 2).join("")}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{st?.name ?? id}</span>
                            <span className={`chip shrink-0 ${s === "done" ? "bg-ok-soft text-ok" : s === "tried" ? "bg-gap-soft text-gap-dark" : "bg-paper text-muted"}`}>
                              {s === "done" ? `✓ ${t("teacher.sentDone")}` : s === "tried" ? `! ${t("teacher.sentTried")}` : `· ${t("teacher.sentWaiting")}`}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <div className="mt-3 flex gap-2">
                  <button className="btn-ghost btn-sm flex-1" onClick={() => onToggle(a.id)} data-testid={`sent-toggle-${a.id}`}>
                    {open ? t("teacher.sentHide") : t("teacher.sentViewStudents")}
                  </button>
                  <button className="btn-ghost btn-sm" onClick={() => onRemove(a.id)} aria-label={t("teacher.sentRemove")}>
                    ✕
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Teachers: their classes (TeacherClasses, ClassPage). The stage demo keeps its sample class. */
export default function Teacher() {
  const demo = useStore((x) => x.demo);
  return demo ? <TeacherDashboard /> : <TeacherClasses />;
}
