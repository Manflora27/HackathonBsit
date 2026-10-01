import { Shell } from "../components/Shell";
import { SkillMap } from "../components/SkillMap";
import { Switch } from "../components/ui";
import { skills, skillTitle } from "../data";
import { useT } from "../i18n";
import { useStore } from "../store";
import type { SkillStatus } from "../types";

const STATUS_STYLE: Record<SkillStatus, { icon: string; dot: string }> = {
  mastered: { icon: "✓", dot: "bg-ok text-white" },
  gap: { icon: "!", dot: "bg-gap text-white" },
  unknown: { icon: "", dot: "border-2 border-line bg-card" },
};

export default function MapPage() {
  const t = useT();
  const { progress, trace, lang, shareSkillMap, set } = useStore();
  const fil = lang === "fil";
  const grades = [...new Set(skills.map((s) => s.grade))].sort((a, b) => b - a);
  const statusLabel = (s: SkillStatus) =>
    s === "mastered" ? (fil ? "Kaya mo na" : "Mastered") : s === "gap" ? (fil ? "Gap na inaayos" : "Gap to fix") : fil ? "Hindi pa na-check" : "Not checked yet";

  return (
    <Shell tabs>
      <h1 className="text-2xl font-extrabold tracking-tight">{t("mySkillMap")}</h1>
      <p className="mt-1 text-muted">
        {fil ? "Bawat skill ay nakapatong sa mga skill sa ilalim nito. Ang gap ay kung saan nagsisimula ang pag-aayos." : "Each skill sits on the skills below it. A gap is just where the fixing starts."}
      </p>

      <ul className="mt-3 flex flex-wrap gap-2 text-sm" aria-label={fil ? "Legend" : "Legend"}>
        {(["mastered", "gap", "unknown"] as const).map((s) => (
          <li key={s} className="flex items-center gap-1.5 rounded-full bg-card px-3 py-1 shadow-[var(--shadow-soft)]">
            <span aria-hidden className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${STATUS_STYLE[s].dot}`}>
              {STATUS_STYLE[s].icon}
            </span>
            {statusLabel(s)}
          </li>
        ))}
      </ul>

      <div className="mt-4">
        <SkillMap statuses={progress} root={trace?.rootSkill ?? null} path={trace?.rootSkill ? trace.path : []} height={440} />
      </div>

      <div className="card mt-4">
        <Switch
          checked={shareSkillMap}
          onChange={(v) => set({ shareSkillMap: v })}
          label={fil ? "Ibahagi sa teacher ko" : "Share with my teacher"}
          hint={shareSkillMap ? (fil ? "Nakikita ng teacher mo ang map na ito." : "Your teacher can see this map.") : t("onlyYou")}
        />
      </div>

      <h2 className="eyebrow mt-7">{fil ? "Lahat ng skill, ayon sa grade" : "All skills by grade"}</h2>
      <div className="mt-2 space-y-3">
        {grades.map((g) => {
          const list = skills.filter((s) => s.grade === g);
          const done = list.filter((s) => progress[s.id] === "mastered").length;
          return (
            <section key={g} className="card p-4!">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">Grade {g}</h3>
                <span className="text-sm text-muted">
                  {done}/{list.length} {fil ? "kaya mo na" : "mastered"}
                </span>
              </div>
              <ul className="mt-2 divide-y divide-line">
                {list.map((s) => {
                  const st = progress[s.id] ?? "unknown";
                  return (
                    <li key={s.id} className="flex min-h-11 items-center gap-3 py-1.5">
                      <span aria-hidden className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${STATUS_STYLE[st].dot}`}>
                        {STATUS_STYLE[st].icon}
                      </span>
                      <span className="flex-1 text-[15px]">{skillTitle(s.id, lang)}</span>
                      <span className={`chip ${st === "mastered" ? "bg-ok-soft text-ok" : st === "gap" ? "bg-gap-soft text-gap" : "bg-paper text-muted"}`}>{statusLabel(st)}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </Shell>
  );
}
