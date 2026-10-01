import { useState } from "react";
import { Bilog } from "../components/Bilog";
import { PathMap } from "../components/PathMap";
import { Shell } from "../components/Shell";
import { skillById, skillTitle } from "../data";
import { useT } from "../i18n";
import { useStore } from "../store";

export default function MapPage() {
  const t = useT();
  const { progress, trace, lang, shareSkillMap, set, gapsFixed } = useStore();
  const fil = lang === "fil";
  const [picked, setPicked] = useState<string | null>(null);

  return (
    <Shell title={fil ? "Mga ugat ko" : "My roots"}>
      <div className="pointer-events-none float-right ml-2 mt-2">
        <Bilog size={54} sprout={gapsFixed.length > 0} mood={gapsFixed.length > 0 ? "happy" : trace?.rootSkill ? "found" : "idle"} />
      </div>
      <h1 className="mt-2 text-[34px] leading-tight">{fil ? "Saan nanggagaling ang math mo" : "Where your math grows from"}</h1>
      <p className="mt-1 text-[15px] text-muted">{fil ? "Nasa itaas ang Grade 9. Pababa, ang mga pundasyon." : "Grade 9 at the top. The foundations run underneath."}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px] text-muted">
        <span className="flex items-center gap-1.5"><span style={{ width: 12, height: 12 }} className="inline-block shrink-0 rounded-full bg-ok" />{fil ? "kaya mo na" : "mastered"}</span>
        <span className="flex items-center gap-1.5"><span style={{ width: 12, height: 12 }} className="inline-block shrink-0 rounded-full bg-gap" />gap</span>
        <span className="flex items-center gap-1.5"><span style={{ width: 12, height: 12 }} className="inline-block shrink-0 rounded-full border border-ink/30 bg-card" />{fil ? "hindi pa na-check" : "not checked yet"}</span>
      </div>
      <label className="card-flat mt-3 flex items-center justify-between gap-3 !p-3 text-[15px]">
        <span>{shareSkillMap ? (fil ? "Ibinahagi sa teacher" : "Shared with my teacher") : t("onlyYou")}</span>
        <input type="checkbox" className="h-5 w-5 accent-[#1e2b27]" checked={shareSkillMap} onChange={(e) => set({ shareSkillMap: e.target.checked })}
          aria-label="Share my skill map with my teacher" />
      </label>
      <div className="mt-4">
        <PathMap statuses={progress} root={trace?.rootSkill ?? null} path={trace?.rootSkill ? trace.path : []} onSelect={setPicked} />
      </div>
      {picked && (
        <div className="fixed inset-x-0 bottom-24 z-30 mx-auto max-w-md px-4">
          <div className="card !p-4">
            <div className="kicker text-muted">Grade {skillById[picked].grade}</div>
            <div className="font-display text-lg font-semibold">{skillTitle(picked, lang)}</div>
            <div className="text-sm text-muted">
              {progress[picked] === "mastered" ? (fil ? "Kaya mo na ito ✓" : "You've got this ✓") : progress[picked] === "gap" ? (fil ? "Ito ang gap mo" : "This is a gap") : fil ? "Hindi pa na-check" : "Not checked yet"}
            </div>
            <button className="btn-ghost btn-sm mt-3" onClick={() => setPicked(null)}>OK</button>
          </div>
        </div>
      )}
    </Shell>
  );
}
