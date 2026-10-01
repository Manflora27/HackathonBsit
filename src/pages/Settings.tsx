import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../auth";
import { ensureVoiceConsent } from "../components/VoiceConsent";
import { getSpeechBackend } from "../ai/client";
import { isLocalVoiceReady, preloadLocalVoice } from "../ai/whisper";
import { Shell } from "../components/Shell";
import { useStore } from "../store";
import { LANGS, useT } from "../i18n";
import type { Lang } from "../types";

/** One-time download of the on-device voice model (Settings, on Wi-Fi is best). */
function OfflineVoice() {
  const t = useT();
  const [state, setState] = useState<"idle" | "busy" | "ready" | "failed">(isLocalVoiceReady() ? "ready" : "idle");
  // Where the browser already listens, the download only matters offline.
  // Where it can't (Firefox, Capacitor shell), this IS the voice input.
  const needed = getSpeechBackend() === "local";
  async function download() {
    setState("busy");
    try {
      await preloadLocalVoice();
      setState("ready");
    } catch {
      setState("failed");
    }
  }
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted">
        {state === "ready" ? t("voice.offlineReady") : needed ? t("voice.offlineNeeded") : t("voice.offlineOptional")}
      </span>
      {state === "ready" ? (
        <span className="text-sm text-gap-dark" data-testid="offline-voice-ready">✓</span>
      ) : (
        <button className="btn-ghost btn-sm" disabled={state === "busy"} onClick={download} data-testid="offline-voice-download">
          {state === "busy" ? t("voice.downloading") : state === "failed" ? t("voice.offlineFailed") : t("voice.downloadOffline")}
        </button>
      )}
    </div>
  );
}

export default function Settings() {
  const nav = useNavigate();
  const s = useStore();
  const t = useT();
  const { user, profile, signOut, deleteAccount } = useAuth();
  const teacher = s.role === "teacher" || profile?.account_type === "teacher";

  function download() {
    const { progress, attempts, consent, aiLog, shareSkillMap } = useStore.getState();
    const blob = new Blob([JSON.stringify({ consent, progress, attempts, shareSkillMap, aiLog }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "my-hopper-data.json";
    a.click();
  }

  return (
    // Teachers come from the wide dashboard: same width, two columns, back to the dashboard, no learner-only options.
    <Shell wide={teacher} back={teacher ? "/teacher" : undefined} title={t("settings.me")}>
      <h1 className="mt-2 font-display text-[30px] font-bold">{t("settings.settings")}</h1>
      {user && <p className="mt-1 text-[14px] text-muted">{profile?.display_name} · {user.email}</p>}

      <div className={teacher ? "mt-4 grid items-start gap-4 md:grid-cols-2 [&>section]:!mt-0" : ""}>

      <section className="card mt-4 space-y-4">
        <h2 className="font-display text-xl font-semibold">{t("settings.reading")}</h2>
        <label className="flex items-center justify-between gap-3">
          {t("settings.language")}
          <select className="input !w-40 !font-sans !text-base" value={s.lang} onChange={(e) => s.set({ lang: e.target.value as Lang })} data-testid="lang-select">
            {LANGS.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
        </label>
        <label className="flex items-center justify-between gap-3">
          {t("settings.textSize")}
          <select className="input !w-40 !font-sans !text-base" value={s.textScale} onChange={(e) => s.set({ textScale: Number(e.target.value) })}>
            <option value={1}>100%</option>
            <option value={1.15}>115%</option>
            <option value={1.3}>130%</option>
          </select>
        </label>
        <label className="flex items-center justify-between gap-3">
          {t("settings.easierReadFont")}
          <input type="checkbox" className="h-5 w-5 accent-[#1e2b27]" checked={s.readableFont} onChange={(e) => s.set({ readableFont: e.target.checked })} />
        </label>
        <label className="flex items-center justify-between gap-3">
          {t("settings.reduceMotion")}
          <input type="checkbox" className="h-5 w-5 accent-[#1e2b27]" checked={s.reduceMotion} onChange={(e) => s.set({ reduceMotion: e.target.checked })} />
        </label>
      </section>

      <section className="card mt-4 space-y-3">
        <h2 className="font-display text-xl font-semibold">{t("settings.privacyRa10173")}</h2>
        {!teacher && <p className="text-sm text-muted">{t("settings.teacherSeesAssigned")}</p>}
        {teacher && <p className="text-sm text-muted">{t("teacher.youOnlySeeAssigned")}</p>}
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={download}>⬇ {t("settings.downloadMyData")}</button>
          <button
            className="btn-ghost text-red-700"
            onClick={async () => {
              if (user) {
                // Signed in: erasure means the account and its server rows, not just this device.
                if (!confirm(t("settings.deleteAccountConfirm"))) return;
                if (!(await deleteAccount())) return alert(t("settings.deleteFailed"));
              } else if (!confirm(t("settings.deleteAllDataDevice"))) return;
              s.resetDemo();
              nav("/");
            }}
          >
            {t("settings.deleteMyData")}
          </button>
        </div>
      </section>

      {!teacher && (
        <section className="card mt-4 space-y-3">
          <h2 className="font-display text-xl font-semibold">{t("settings.study")}</h2>
          <label className="flex items-center justify-between gap-3">
            {t("settings.examMode")}
            <input type="checkbox" className="h-5 w-5 shrink-0 accent-[#1e2b27]" checked={s.examMode} onChange={(e) => s.set({ examMode: e.target.checked })} data-testid="exam-toggle" />
          </label>
          <p className="text-sm text-muted">{t("settings.examModeNote")}</p>
        </section>
      )}

      <section className="card mt-4 space-y-3">
        <h2 className="font-display text-xl font-semibold">{t("settings.aiTitle")}</h2>        <p className="text-sm text-muted">{t("settings.aiText")}</p>
        {!teacher && <label className="flex items-center justify-between gap-3">
          {t("settings.voiceToggle")}
          <input type="checkbox" className="h-5 w-5 shrink-0 accent-[#1e2b27]" checked={s.voiceAi === true}
            onChange={async (e) => {
              // Turning it on asks the 18+ question once; under-18s stay off.
              if (!e.target.checked) return s.set({ voiceAi: false });
              s.set({ voiceAi: await ensureVoiceConsent() });
            }} data-testid="voice-toggle" />
        </label>}
        {!teacher && <p className="text-sm text-muted">{t("settings.aiVoice")}</p>}
        {!teacher && <OfflineVoice />}
      </section>

      <section className="card mt-4 space-y-2">
        <h2 className="font-display text-xl font-semibold">{t("settings.aiDecisionsLog")}</h2>
        {s.aiLog.length === 0 ? (
          <p className="text-sm text-muted">{t("settings.nothingYet")}</p>
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
      </div>

      <section className="mt-6 flex flex-wrap gap-2">
        {user && (
          <button className="btn-primary" data-testid="signout" onClick={async () => { await signOut(); s.set({ role: null, demo: false }); nav("/"); }}>
            {t("settings.signOut")}
          </button>
        )}
        <button className="btn-ghost" onClick={() => { s.set({ role: null, demo: false }); nav(user ? "/" : "/demo"); }}>
          {user ? (t("settings.backStart")) : t("settings.switchDemoAccount")}
        </button>
        <button className="btn-ghost" data-testid="reset-demo" onClick={() => { s.resetDemo(); nav("/"); }}>
          ↺ {t("settings.resetDemoData")}
        </button>
      </section>
    </Shell>
  );
}
