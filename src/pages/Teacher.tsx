import { useEffect, useMemo, useState } from "react";
import { teacherInsight } from "../ai/client";
import { Math } from "../components/Math";
import { Shell } from "../components/Shell";
import { misconceptionById, misconceptionText, misconceptions, problemById, skills as allSkills, skillTitle } from "../data";

// Foundational skills first, so the gap columns are visible without scrolling.
const skills = [...allSkills].sort((a, b) => a.grade - b.grade || a.y - b.y || a.x - b.x).reverse().sort((a, b) => a.grade - b.grade);
import { buildSeedClass, KYLA_ID } from "../data/seedClass";
import { uid, useStore } from "../store";
import type { SkillStatus, Student } from "../types";

const CLASS_CODE = "SAMP-924";

export default function Teacher() {
  const { lang, progress, attempts, shareSkillMap, practiceAssignments, set, updateAttempt, log } = useStore();
  const fil = lang === "fil";
  const seed = useMemo(buildSeedClass, []);
  const [confirm, setConfirm] = useState<{ skillId: string; ids: string[] } | null>(null);
  const [toast, setToast] = useState<{ id: string; text: string } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [insight, setInsight] = useState<{ text: string; ai: boolean } | null>(null);

  // Kyla is live: her assigned work (class-visible) and, if she shares it, her skill map.
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
  const students = [kyla, ...seed];

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

  function assign() {
    if (!confirm) return;
    const id = uid();
    set({ practiceAssignments: [...practiceAssignments, { id, skillId: confirm.skillId, studentIds: confirm.ids, createdAt: Date.now() }] });
    log({ action: "assign practice", suggestion: `group by gap: ${confirm.skillId}`, decision: `teacher assigned to ${confirm.ids.length}`, actor: "teacher" });
    setToast({ id, text: fil ? `Naipadala sa ${confirm.ids.length} student` : `Sent to ${confirm.ids.length} students` });
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

  const sel = students.find((s) => s.id === selected);

  return (
    <Shell wide>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm text-muted">Ms. Santos</div>
          <h1 className="text-2xl font-bold">Grade 9 – Sampaguita</h1>
          <div className="text-sm text-muted">
            {students.length} {fil ? "student" : "students"} · {fil ? "Class code" : "Class code"}{" "}
            <span className="chip bg-brand-soft font-mono text-brand">{CLASS_CODE}</span>
          </div>
        </div>
        <button className="btn-ghost text-sm" onClick={exportCsv}>⬇ CSV</button>
      </div>

      <section className="mt-5 grid gap-3 md:grid-cols-3">
        {groups.slice(0, 3).map(([sid, list], i) => {
          const still = list.filter((s) => s.skills[sid] !== "mastered");
          const fixed = list.length - still.length;
          return (
          <div key={sid} className={`card ${i === 0 ? "border-gap md:col-span-1" : ""}`} data-testid={`gap-group-${sid}`}>
            <div className="text-4xl font-extrabold text-gap" data-testid={i === 0 ? "top-gap-count" : undefined}>{list.length}</div>
            <div className="text-[15px]">
              {fil ? "student ang may gap sa" : "students share a gap in"} <b>{skillTitle(sid, lang)}</b>{" "}
              <span className="text-muted">(Grade {skills.find((s) => s.id === sid)?.grade})</span>
            </div>
            {fixed > 0 && (
              <div className="chip mt-2 bg-ok-soft text-ok" data-testid={i === 0 ? "top-gap-fixed" : undefined}>
                ✓ {fixed} {fil ? "ang nakaayos na" : fixed === 1 ? "already fixed it" : "already fixed it"}
              </div>
            )}
            {list.some((s) => s.live) && <div className="chip mt-2 ml-1 bg-brand-soft text-brand">● {fil ? "Kasama si Kyla — live" : "Includes Kyla — live"}</div>}
            {still.length > 0 && (
              <button className="btn-gap mt-3 w-full text-sm" onClick={() => setConfirm({ skillId: sid, ids: still.map((s) => s.id) })}
                data-testid={i === 0 ? "assign-top" : undefined}>
                {fil ? `Mag-assign ng practice sa ${still.length} na ito` : `Assign practice to these ${still.length}`}
              </button>
            )}
          </div>
          );
        })}
      </section>

      {insight && (
        <div className="card mt-3 border-brand/30 bg-brand-soft/40 text-[15px]">
          <span className="chip mr-2 bg-brand text-white">{insight.ai ? "AI " : ""}{fil ? "mungkahi" : "suggestion"}</span>
          {insight.text}
          <div className="mt-1 text-xs text-muted">
            {fil ? "Batay lang sa bilang ng class — walang pangalan na ipinadala. Ikaw ang magpapasya." : "Based only on class counts — no names were sent. You decide."}
          </div>
        </div>
      )}

      <section className="card mt-5 overflow-x-auto !p-0">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="sticky left-0 bg-card p-2 pl-4">{fil ? "Student" : "Student"}</th>
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
                onClick={() => setSelected(st.id)} data-testid={st.live ? "row-kyla" : undefined}>
                <td className="sticky left-0 bg-inherit p-2 pl-4 font-medium">
                  {st.name} {st.live && <span className="chip ml-1 bg-brand text-white">live</span>}
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
        <div className="fixed inset-0 z-30 flex justify-end bg-black/30" onClick={() => setSelected(null)}>
          <aside className="h-full w-full max-w-md overflow-y-auto bg-paper p-5" onClick={(e) => e.stopPropagation()}>
            <button className="text-sm text-muted" onClick={() => setSelected(null)}>✕ {fil ? "Isara" : "Close"}</button>
            <h2 className="mt-2 text-xl font-bold">{sel.name}</h2>
            <div className="text-sm text-muted">{fil ? "Nakikita ng AI bilang" : "Seen by the AI as"} “{sel.anonId}”</div>
            {sel.lastMisconception && (
              <div className="card mt-3">
                <div className="text-xs font-semibold uppercase text-muted">{fil ? "Huling diagnosis" : "Latest diagnosis"}</div>
                <div className="font-bold">{misconceptionText(sel.lastMisconception, lang).title}</div>
              </div>
            )}
            {sel.live && (
              <div className="mt-3 space-y-3">
                {classAttempts.length === 0 && <p className="text-sm text-muted">{fil ? "Wala pang ipinasa." : "No submitted work yet."}</p>}
                {classAttempts.map((a) => (
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
                      {fil ? "Diagnosis (puwedeng palitan)" : "Diagnosis (you can override)"}
                    </label>
                    <select
                      className="input mt-1 !font-sans !text-sm"
                      value={a.teacherOverride?.misconceptionId ?? a.analysis.misconception?.id ?? ""}
                      onChange={(e) => {
                        updateAttempt(a.id, { teacherOverride: { misconceptionId: e.target.value || null, note: "" } });
                        log({ action: "diagnosis", suggestion: a.analysis.misconception?.id ?? "none", decision: `teacher override: ${e.target.value}`, actor: "teacher" });
                      }}
                    >
                      <option value="">{fil ? "— walang pattern —" : "— no pattern —"}</option>
                      {misconceptions.map((m) => (
                        <option key={m.id} value={m.id}>
                          {misconceptionText(m.id, lang).title}
                        </option>
                      ))}
                    </select>
                    {a.teacherOverride && misconceptionById[a.teacherOverride.misconceptionId ?? ""] && (
                      <div className="mt-1 text-xs text-brand">{fil ? "Pinalitan mo ang diagnosis ng AI/engine." : "You overrode the engine's diagnosis."}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="mt-4 text-xs text-muted">
              {fil
                ? "Nakikita mo lang ang assigned na gawa, at ang skill map kung ibinahagi ito ng student."
                : "You only see assigned work, plus the skill map if the student chose to share it."}
            </p>
          </aside>
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/30 p-4 sm:items-center" role="dialog" aria-modal>
          <div className="card w-full max-w-md">
            <h2 className="text-lg font-bold">{fil ? "Ipadala ang practice?" : "Send practice?"}</h2>
            <p className="mt-2 text-[15px]">
              {fil ? "Matatanggap ng" : ""} <b>{confirm.ids.length}</b> {fil ? "student ang practice para sa" : "students will get practice on"} <b>{skillTitle(confirm.skillId, lang)}</b>.
            </p>
            <div className="mt-5 flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => setConfirm(null)}>{fil ? "Kanselahin" : "Cancel"}</button>
              <button className="btn-primary flex-1" onClick={assign} data-testid="confirm-assign">{fil ? "Ipadala" : "Send"}</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-4 rounded-xl bg-ink px-4 py-3 text-white shadow-lg" role="status">
          ✓ {toast.text}
          <button className="font-semibold text-amber-300" onClick={undo}>{fil ? "I-undo" : "Undo"}</button>
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
