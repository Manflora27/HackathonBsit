import { useState } from "react";
import { useNavigate } from "react-router";
import { Shell } from "../components/Shell";
import { BackButton, Segmented, Sheet, Switch } from "../components/ui";
import { useStore } from "../store";

export default function Settings() {
  const nav = useNavigate();
  const s = useStore();
  const fil = s.lang === "fil";
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isStudent = s.role === "student";

  function download() {
    const { progress, attempts, consent, aiLog, shareSkillMap } = useStore.getState();
    const blob = new Blob([JSON.stringify({ consent, progress, attempts, shareSkillMap, aiLog }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "my-gap-finder-data.json";
    a.click();
  }

  return (
    <Shell tabs>
      {!isStudent && <BackButton onClick={() => nav(-1)} label={fil ? "Bumalik" : "Back"} />}
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Settings</h1>

      <h2 className="eyebrow mt-6">{fil ? "Pagbasa at wika" : "Reading & language"}</h2>
      <section className="card mt-2 divide-y divide-line py-2!">
        <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 py-2">
          <span className="font-medium">{fil ? "Wika" : "Language"}</span>
          <Segmented
            label={fil ? "Wika" : "Language"}
            value={s.lang}
            onChange={(v) => s.set({ lang: v })}
            options={[
              { value: "en", label: "English" },
              { value: "fil", label: "Filipino" },
            ]}
          />
        </div>
        <div className="py-2">
          <div className="flex min-h-14 flex-wrap items-center justify-between gap-3">
            <span className="font-medium">{fil ? "Laki ng text" : "Text size"}</span>
            <Segmented
              label={fil ? "Laki ng text" : "Text size"}
              value={s.textScale}
              onChange={(v) => s.set({ textScale: v })}
              options={[
                { value: 1, label: "A" },
                { value: 1.15, label: "A+" },
                { value: 1.3, label: "A++" },
              ]}
            />
          </div>
          <p className="rounded-2xl bg-paper px-3 py-2 text-muted" aria-hidden>
            {fil ? "Ganito kalaki ang text." : "This is how big your text will be."}
          </p>
        </div>
        <div className="py-2">
          <Switch
            checked={s.readableFont}
            onChange={(v) => s.set({ readableFont: v })}
            label={fil ? "Mas madaling basahing font" : "Easier-to-read font"}
            hint={fil ? "Mas malawak na letra at espasyo" : "Wider letters and spacing"}
          />
        </div>
        <div className="py-2">
          <Switch
            checked={s.reduceMotion}
            onChange={(v) => s.set({ reduceMotion: v })}
            label={fil ? "Bawasan ang animation" : "Reduce motion"}
            hint={fil ? "Walang galaw, agad lumalabas ang lahat" : "Things appear instantly, without movement"}
          />
        </div>
      </section>

      <h2 className="eyebrow mt-6">{fil ? "Privacy (RA 10173)" : "Privacy (RA 10173)"}</h2>
      <section className="card mt-2 space-y-3">
        <Switch
          checked={s.shareSkillMap}
          onChange={(v) => s.set({ shareSkillMap: v })}
          label={fil ? "Ibahagi ang skill map ko sa teacher" : "Share my skill map with my teacher"}
          hint={
            fil
              ? "Assigned na gawa lang ang nakikita ng teacher mo. Pribado ang sariling practice maliban kung ibahagi mo."
              : "Your teacher only sees assigned work. Self-practice stays private unless you share it."
          }
        />
        <div className="flex flex-col gap-2 border-t border-line pt-3 sm:flex-row">
          <button className="btn-ghost flex-1" onClick={download}>
            <span aria-hidden>⬇</span> {fil ? "I-download ang data ko" : "Download my data"}
          </button>
          <button className="btn-ghost flex-1 text-gap" onClick={() => setConfirmDelete(true)}>
            <span aria-hidden>🗑</span> {fil ? "Burahin ang data ko" : "Delete my data"}
          </button>
        </div>
      </section>

      <h2 className="eyebrow mt-6">{fil ? "AI log" : "AI decisions log"}</h2>
      <section className="card mt-2">
        <p className="text-sm text-muted">
          {fil ? "Bawat mungkahi ng AI at kung ano ang ginawa rito. Ang tama/mali ay laging sinusuri ng SymPy." : "Every AI suggestion and what happened to it. Right and wrong are always checked by SymPy."}
        </p>
        {s.aiLog.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{fil ? "Wala pa." : "Nothing yet."}</p>
        ) : (
          <ul className="mt-2 space-y-1.5 text-sm">
            {s.aiLog
              .slice(-8)
              .reverse()
              .map((e, i) => (
                <li key={i} className="rounded-xl bg-paper px-3 py-2">
                  <b>{e.action}</b>: {e.suggestion} → <i>{e.decision}</i> <span className="text-muted">({e.actor})</span>
                </li>
              ))}
          </ul>
        )}
      </section>

      <h2 className="eyebrow mt-6">Demo</h2>
      <section className="mt-2 flex flex-col gap-2 sm:flex-row">
        <button
          className="btn-ghost flex-1"
          onClick={() => {
            s.set({ role: null });
            nav("/");
          }}
        >
          {fil ? "Lumipat ng demo account" : "Switch demo account"}
        </button>
        <button
          className="btn-ghost flex-1"
          data-testid="reset-demo"
          onClick={() => {
            s.resetDemo();
            nav("/");
          }}
        >
          <span aria-hidden>↺</span> {fil ? "I-reset ang demo" : "Reset demo data"}
        </button>
      </section>

      {confirmDelete && (
        <Sheet title={fil ? "Burahin ang lahat ng data mo?" : "Delete all your data?"} onClose={() => setConfirmDelete(false)}>
          <p className="mt-2 text-[15px] text-muted">
            {fil
              ? "Mabubura ang progress, mga sagot, at AI log sa device na ito. Hindi na ito maibabalik."
              : "Your progress, answers and AI log on this device will be erased. This can't be undone."}
          </p>
          <div className="mt-5 flex gap-2">
            <button className="btn-ghost flex-1" onClick={() => setConfirmDelete(false)}>
              {fil ? "Huwag na" : "Keep my data"}
            </button>
            <button
              className="btn-gap flex-1"
              onClick={() => {
                s.resetDemo();
                nav("/");
              }}
            >
              {fil ? "Burahin" : "Delete"}
            </button>
          </div>
        </Sheet>
      )}
    </Shell>
  );
}
