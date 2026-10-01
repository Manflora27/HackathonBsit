import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../auth";
import { ensureVoiceConsent } from "../components/VoiceConsent";
import { getSpeechBackend } from "../ai/client";
import { isLocalVoiceReady, preloadLocalVoice } from "../ai/whisper";
import { Shell } from "../components/Shell";
import { streak, useStore } from "../store";
import { setAsideFor } from "../account";
import { AnimatePresence } from "motion/react";
import { JoinClassSheet } from "../components/JoinClassSheet";
import { SubjectIcon } from "../components/SubjectIcon";
import { syncClassProgress } from "../classroom";
import { usePlanContext } from "../plan";
import type { SubjectId } from "../data/curriculum";
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

/** The learner's own page: who they are, how they're doing, and the classes they're in (and joining one). */
function MeSection() {
  const t = useT();
  const { user, profile, classes, joinClass, error } = useAuth();
  const { onboarding, xp, activeDays, gapsFixed, demo } = useStore();
  const { grade, subjects } = usePlanContext();
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const name = profile?.display_name || onboarding.name || (demo ? "Kyla" : t("home.friend"));
  const signedIn = !!user && !demo;
  return (
    <section data-testid="me">
      <div className="mt-2 flex items-center gap-4">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/70 font-display text-[24px] shadow-[inset_0_1px_0_#fff]">
          {name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
        </span>
        <div className="min-w-0">
          <h1 className="truncate font-display text-[30px] leading-tight">{name}</h1>
          <p className="truncate text-[14px] text-muted">
            {[grade ? t("common.gradeN", { n: grade }) : t("me.selfLearner"), subjects.map((s) => t.subject(s)).join(", ")].filter(Boolean).join(" · ")}
          </p>
          {signedIn && <p className="truncate text-[13px] text-muted">{user!.email}</p>}
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-2 rounded-[22px] bg-white/45 px-3 py-3 text-center">
        <div><dt className="text-[12px] text-muted">{t("me.points")}</dt><dd className="font-display text-[22px]">{xp}</dd></div>
        <div><dt className="text-[12px] text-muted">{t("me.streak")}</dt><dd className="font-display text-[22px]">{streak(activeDays)}</dd></div>
        <div><dt className="text-[12px] text-muted">{t("me.gapsFixed")}</dt><dd className="font-display text-[22px]">{gapsFixed.length}</dd></div>
      </dl>

      <h2 className="kicker mt-6 text-muted">{t("me.classes")}</h2>
      {!signedIn ? (
        <p className="mt-2 text-[14.5px] text-muted">{t("me.signInForClasses")}</p>
      ) : (
        <>
          {classes.length === 0 && <p className="mt-2 text-[14.5px] text-muted">{t("me.noClasses")}</p>}
          <ul className="mt-2 divide-y divide-ink/10" data-testid="me-classes">
            {classes.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-3">
                <SubjectIcon id={(c.subject ?? "math") as SubjectId} size={38} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-[18px] leading-tight">{c.name}{c.section ? ` · ${c.section}` : ""}</span>
                  <span className="block text-[13px] text-muted">{[c.subject ? t.subject(c.subject) : null, c.grade ? t("common.gradeN", { n: c.grade }) : null].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="font-mono text-[12.5px] tracking-wider text-muted">{c.class_code}</span>
              </li>
            ))}
          </ul>
          <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (code.trim()) setJoining(true); }}>
            <input className="input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={t("me.classCode")}
              autoCapitalize="characters" spellCheck={false} data-testid="me-class-code" />
            <button className="btn-primary shrink-0" disabled={!code.trim()} data-testid="me-join">{t("home.join")}</button>
          </form>
          {error === "invalid" && <p className="mt-2 text-[13px] text-gap-dark">{t("home.couldntFindCodeCheck")}</p>}
          <p className="mt-2 text-[12.5px] text-muted">{t("settings.teacherSeesAssigned")}</p>
        </>
      )}

      <AnimatePresence>
        {joining && (
          <JoinClassSheet code={code} onClose={() => setJoining(false)} onConfirm={async () => {
            if (!(await joinClass(code))) return setJoining(false), false;
            void syncClassProgress(useStore.getState().progress);
            setJoining(false);
            setCode("");
            return true;
          }} />
        )}
      </AnimatePresence>
    </section>
  );
}

/** Explicit account erasure (RA 10173): server rows first, then this device. Two taps, no native dialogs. */
function DeleteAccount() {
  const t = useT();
  const nav = useNavigate();
  const s = useStore();
  const { deleteAccount, error } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  async function erase() {
    setBusy(true);
    const ok = await deleteAccount();
    setBusy(false);
    if (!ok) return; // error from the store is shown below
    s.resetDemo();
    nav("/", { replace: true });
  }
  if (!confirming) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted">{t("settings.deleteAccountBlurb")}</p>
        <button className="btn-ghost text-red-700" onClick={() => setConfirming(true)} data-testid="delete-account">
          {t("settings.deleteAccount")}
        </button>
      </div>
    );
  }
  return (
    <div className="rounded-2xl bg-red-50 p-3" data-testid="delete-account-confirm">
      <p className="text-[14px] font-semibold text-red-800">{t("settings.deleteAccountConfirm")}</p>
      {error && <p className="mt-1 text-[13px] text-red-700" data-testid="delete-account-error">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button className="btn-ghost" disabled={busy} onClick={() => setConfirming(false)}>
          {t("settings.deleteAccountCancel")}
        </button>
        <button className="btn-primary !bg-red-700" disabled={busy} onClick={() => void erase()} data-testid="delete-account-yes">
          {busy ? t("settings.deletingAccount") : t("settings.deleteAccountYes")}
        </button>
      </div>
    </div>
  );
}

export default function Settings() {
  const nav = useNavigate();
  const s = useStore();
  const t = useT();
  const { user, profile, signOut } = useAuth();
  const teacher = s.role === "teacher" || profile?.account_type === "teacher";

  function download() {
    const { progress, attempts, consent } = useStore.getState();
    const blob = new Blob([JSON.stringify({ consent, progress, attempts }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "my-hopper-data.json";
    a.click();
  }

  return (
    // Teachers come from the wide dashboard: same width, two columns, back to the dashboard, no learner-only options.
    <Shell wide={teacher} back={teacher ? "/teacher" : undefined} title={teacher ? t("settings.settings") : t("settings.me")}>
      {teacher ? (
        <>
          <h1 className="mt-2 font-display text-[30px] font-bold">{t("settings.settings")}</h1>
          {user && <p className="mt-1 text-[14px] text-muted">{profile?.display_name} · {user.email}</p>}
        </>
      ) : (
        <>
          <MeSection />
          <h2 className="mt-8 font-display text-[24px] font-bold">{t("settings.settings")}</h2>
        </>
      )}

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
          {!user && (
            <button
              className="btn-ghost text-red-700"
              data-testid="delete-device-data"
              onClick={() => {
                if (!confirm(t("settings.deleteAllDataDevice"))) return;
                s.resetDemo();
                nav("/");
              }}
            >
              {t("settings.deleteMyData")}
            </button>
          )}
        </div>
        {user && <DeleteAccount />}
      </section>

      {!teacher && (
        <section className="card mt-4 space-y-3">
          <h2 className="font-display text-xl font-semibold">{t("settings.study")}</h2>
          <label className="flex items-center justify-between gap-3">
            {t("settings.examMode")}
            <input type="checkbox" className="h-5 w-5 shrink-0 accent-[#1e2b27]" checked={s.examMode} onChange={(e) => s.set({ examMode: e.target.checked })} data-testid="exam-toggle" />
          </label>
          <p className="text-sm text-muted">{t("settings.examModeNote")}</p>
          {/* Students in school move up every June regardless; self-learners choose. */}
          {(profile?.current_grade ?? s.onboarding.grade) == null && (<>
            <label className="flex items-center justify-between gap-3">
              {t("settings.selfAdvance")}
              <input type="checkbox" className="h-5 w-5 shrink-0 accent-[#1e2b27]" checked={s.selfAdvance} onChange={(e) => s.set({ selfAdvance: e.target.checked })} data-testid="self-advance-toggle" />
            </label>
            <p className="text-sm text-muted">{t("settings.selfAdvanceNote")}</p>
          </>)}
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

      </div>

      <section className="mt-6 flex flex-wrap gap-2">
        {user && (
          // Signing out sets this device's data aside for the account (account.ts) and clears the screen,
          // so on a shared phone the next person starts fresh; signing back in here brings it back.
          <button className="btn-primary" data-testid="signout" onClick={async () => {
            const id = user.id;
            await signOut();
            setAsideFor(id);
            nav("/", { replace: true });
          }}>
            {t("settings.signOut")}
          </button>
        )}
        {/* Demo and guest only: signed in, these would just bounce back into the account (sign out instead). */}
        {!user && (
          <>
            <button className="btn-ghost" onClick={() => { s.set({ role: null, demo: false }); nav("/demo"); }}>
              {t("settings.switchDemoAccount")}
            </button>
            <button className="btn-ghost" data-testid="reset-demo" onClick={() => { s.resetDemo(); nav("/", { replace: true }); }}>
              ↺ {t("settings.resetDemoData")}
            </button>
          </>
        )}
      </section>
    </Shell>
  );
}
