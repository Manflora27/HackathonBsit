import { useNavigate } from "react-router";
import { useAuth } from "../auth";
import { Shell } from "../components/Shell";
import { useStore } from "../store";

export default function Settings() {
  const nav = useNavigate();
  const s = useStore();
  const fil = s.lang === "fil";
  const { user, profile, signOut } = useAuth();

  function download() {
    const { progress, attempts, consent, aiLog, shareSkillMap } = useStore.getState();
    const blob = new Blob([JSON.stringify({ consent, progress, attempts, shareSkillMap, aiLog }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "my-hopper-data.json";
    a.click();
  }

  return (
    <Shell title={fil ? "Ako" : "Me"}>
      <h1 className="font-display text-[30px] font-bold">{fil ? "Settings" : "Settings"}</h1>
      {user && <p className="mt-1 text-[14px] text-muted">{profile?.display_name} · {user.email} · {profile?.account_type}</p>}

      <section className="card mt-4 space-y-4">
        <h2 className="font-display text-xl font-semibold">{fil ? "Pagbasa" : "Reading"}</h2>
        <label className="flex items-center justify-between gap-3">
          {fil ? "Wika ng paliwanag" : "Explanation language"}
          <select className="input !w-40 !font-sans !text-base" value={s.lang} onChange={(e) => s.set({ lang: e.target.value as "en" | "fil" })}>
            <option value="en">English</option>
            <option value="fil">Filipino</option>
          </select>
        </label>
        <label className="flex items-center justify-between gap-3">
          {fil ? "Laki ng text" : "Text size"}
          <select className="input !w-40 !font-sans !text-base" value={s.textScale} onChange={(e) => s.set({ textScale: Number(e.target.value) })}>
            <option value={1}>100%</option>
            <option value={1.15}>115%</option>
            <option value={1.3}>130%</option>
          </select>
        </label>
        <label className="flex items-center justify-between gap-3">
          {fil ? "Mas madaling basahing font" : "Easier-to-read font"}
          <input type="checkbox" className="h-5 w-5 accent-[#1e2b27]" checked={s.readableFont} onChange={(e) => s.set({ readableFont: e.target.checked })} />
        </label>
        <label className="flex items-center justify-between gap-3">
          {fil ? "Bawasan ang animation" : "Reduce motion"}
          <input type="checkbox" className="h-5 w-5 accent-[#1e2b27]" checked={s.reduceMotion} onChange={(e) => s.set({ reduceMotion: e.target.checked })} />
        </label>
      </section>

      <section className="card mt-4 space-y-3">
        <h2 className="font-display text-xl font-semibold">{fil ? "Privacy (RA 10173)" : "Privacy (RA 10173)"}</h2>
        <label className="flex items-center justify-between gap-3">
          {fil ? "Ibahagi ang skill map ko sa teacher" : "Share my skill map with my teacher"}
          <input type="checkbox" className="h-5 w-5 accent-[#1e2b27]" checked={s.shareSkillMap} onChange={(e) => s.set({ shareSkillMap: e.target.checked })} />
        </label>
        <p className="text-sm text-muted">
          {fil
            ? "Assigned na gawa lang ang nakikita ng teacher mo. Pribado ang sariling practice maliban kung ibahagi mo."
            : "Your teacher only sees assigned work. Self-practice stays private unless you share it."}
        </p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={download}>⬇ {fil ? "I-download ang data ko" : "Download my data"}</button>
          <button
            className="btn-ghost text-red-700"
            onClick={() => {
              if (confirm(fil ? "Burahin ang lahat ng data mo sa device na ito?" : "Delete all your data on this device?")) {
                s.resetDemo();
                nav("/");
              }
            }}
          >
            {fil ? "Burahin ang data ko" : "Delete my data"}
          </button>
        </div>
      </section>

      <section className="card mt-4 space-y-2">
        <h2 className="font-display text-xl font-semibold">{fil ? "AI log" : "AI decisions log"}</h2>
        {s.aiLog.length === 0 ? (
          <p className="text-sm text-muted">{fil ? "Wala pa." : "Nothing yet."}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {s.aiLog.slice(-8).reverse().map((e, i) => (
              <li key={i} className="rounded-lg bg-paper px-2 py-1">
                <b>{e.action}</b>: {e.suggestion} → <i>{e.decision}</i> <span className="text-muted">({e.actor})</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 flex flex-wrap gap-2">
        {user && (
          <button className="btn-primary" data-testid="signout" onClick={async () => { await signOut(); s.set({ role: null, demo: false }); nav("/"); }}>
            {fil ? "Mag-sign out" : "Sign out"}
          </button>
        )}
        <button className="btn-ghost" onClick={() => { s.set({ role: null, demo: false }); nav(user ? "/" : "/demo"); }}>
          {user ? (fil ? "Bumalik sa simula" : "Back to start") : fil ? "Lumipat ng demo account" : "Switch demo account"}
        </button>
        <button className="btn-ghost" data-testid="reset-demo" onClick={() => { s.resetDemo(); nav("/"); }}>
          ↺ {fil ? "I-reset ang demo" : "Reset demo data"}
        </button>
      </section>
    </Shell>
  );
}
