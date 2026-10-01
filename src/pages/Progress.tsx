import { Link } from "react-router";
import { Shell } from "../components/Shell";
import { problemById, skillById, skills, skillTitle } from "../data";
import { useStore } from "../store";

/** Growth, not rank: what you've mastered and what you've discovered. No points, streaks or leaderboards. */
export default function Progress() {
  const { progress, attempts, lang } = useStore();
  const fil = lang === "fil";
  const grades = [...new Set(skills.map((s) => s.grade))].sort((a, b) => a - b);
  const mastered = skills.filter((s) => progress[s.id] === "mastered").length;
  const discoveries = attempts.filter((a) => a.rootSkill).slice().reverse();
  const fixed = discoveries.filter((a) => progress[a.rootSkill!] === "mastered").length;
  const solved = new Set(attempts.filter((a) => a.analysis.errorIndex === null && a.analysis.complete).map((a) => a.problemId)).size;

  return (
    <Shell tabs>
      <h1 className="text-2xl font-extrabold tracking-tight">{fil ? "Ang progress ko" : "My progress"}</h1>
      <p className="mt-1 text-muted">{fil ? "Bawat gap na nahanap mo ay isang hakbang pasulong." : "Every gap you find is a step forward."}</p>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat value={mastered} label={fil ? "skills na kaya mo" : "skills mastered"} tone="text-ok" />
        <Stat value={`${fixed}/${discoveries.length}`} label={fil ? "gap na naayos" : "gaps fixed"} tone="text-gap" />
        <Stat value={solved} label={fil ? "problem na nasagot" : "problems solved"} tone="text-brand-ink" />
      </div>

      <h2 className="eyebrow mt-7">{fil ? "Mga skill ayon sa grade" : "Skills by grade"}</h2>
      <div className="card mt-2 space-y-4">
        {grades.map((g) => {
          const list = skills.filter((s) => s.grade === g);
          const done = list.filter((s) => progress[s.id] === "mastered").length;
          const pct = Math.round((done / list.length) * 100);
          return (
            <div key={g}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-semibold">Grade {g}</span>
                <span className="text-muted">
                  {done} / {list.length}
                </span>
              </div>
              <div
                className="mt-1.5 h-3 overflow-hidden rounded-full bg-paper"
                role="progressbar"
                aria-valuenow={done}
                aria-valuemin={0}
                aria-valuemax={list.length}
                aria-label={`Grade ${g}`}
              >
                <div className="h-full origin-left rounded-full bg-ok transition-transform duration-700" style={{ transform: `scaleX(${pct / 100})` }} />
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="eyebrow mt-7">{fil ? "Mga natuklasan mo" : "Your discoveries"}</h2>
      {discoveries.length === 0 ? (
        <div className="card mt-2 text-center">
          <div aria-hidden className="text-3xl">🔭</div>
          <p className="mt-2 font-semibold">{fil ? "Wala pa — at okay lang iyon." : "Nothing yet — and that's okay."}</p>
          <p className="text-sm text-muted">
            {fil ? "Kapag nag-check ka ng solusyon, dito lalabas ang mga gap na nahanap at naayos mo." : "When you check a solution, the gaps you find and fix will show up here."}
          </p>
          <Link to="/student" className="btn-primary mt-4">
            {fil ? "Mag-check ng solusyon" : "Check a solution"}
          </Link>
        </div>
      ) : (
        <ol className="mt-2 space-y-2">
          {discoveries.map((a) => {
            const root = a.rootSkill!;
            const done = progress[root] === "mastered";
            const top = problemById[a.problemId] ? skillById[problemById[a.problemId].skill] : null;
            return (
              <li key={a.id} className="card flex items-center gap-3 p-4!">
                <span
                  aria-hidden
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-lg font-bold ${done ? "bg-ok text-white" : "bg-gap-soft text-gap"}`}
                >
                  {done ? "✓" : "!"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{skillTitle(root, lang)}</div>
                  <div className="text-sm text-muted">
                    {top && top.grade !== skillById[root].grade
                      ? fil
                        ? `Galing sa Grade ${skillById[root].grade}, nakita sa Grade ${top.grade}`
                        : `From Grade ${skillById[root].grade}, found in Grade ${top.grade}`
                      : `Grade ${skillById[root].grade}`}
                    {" · "}
                    {new Date(a.createdAt).toLocaleDateString(fil ? "fil-PH" : "en-PH", { month: "short", day: "numeric" })}
                  </div>
                </div>
                {done ? (
                  <span className="chip bg-ok-soft text-ok">{fil ? "Naayos" : "Fixed"}</span>
                ) : (
                  <Link to={`/learn/${root}`} className="btn-soft min-h-10! px-3! text-sm">
                    {fil ? "Ayusin" : "Fix it"}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Shell>
  );
}

function Stat({ value, label, tone }: { value: number | string; label: string; tone: string }) {
  return (
    <div className="card p-3! text-center">
      <div className={`text-2xl font-extrabold ${tone}`}>{value}</div>
      <div className="text-xs leading-tight text-muted">{label}</div>
    </div>
  );
}
