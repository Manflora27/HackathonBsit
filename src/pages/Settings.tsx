import { useNavigate } from "react-router";
import { useAuth } from "../auth";
import { Shell } from "../components/Shell";
import { streak, useStore } from "../store";
import { setAsideFor } from "../account";
import { usePlanContext } from "../plan";
import { LANGS, useT } from "../i18n";
import type { Lang } from "../types";

/** The learner's own page: who they are and how they're doing. */
function MeSection() {
  const t = useT();
  const { user, profile } = useAuth();
  const { onboarding, xp, activeDays, gapsFixed, demo } = useStore();
  const { grade, subjects } = usePlanContext();
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

    </section>
  );
}

export default function Settings() {
  const nav = useNavigate();
  const s = useStore();
  const t = useT();
  const { user, profile, signOut, deleteAccount } = useAuth();

  function download() {
    const { progress, attempts, consent } = useStore.getState();
    const blob = new Blob([JSON.stringify({ consent, progress, attempts }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "my-hopper-data.json";
    a.click();
  }

  return (
    <Shell title={t("settings.me")}>
      <MeSection />
      <h2 className="mt-8 font-display text-[24px] font-bold">{t("settings.settings")}</h2>

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
        <p className="text-sm text-muted">{t("settings.privateNote")}</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={download}>⬇ {t("settings.downloadMyData")}</button>
        </div>
      </section>

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

      <section className="card mt-4 space-y-3">
        <h2 className="font-display text-xl font-semibold">{t("settings.aiTitle")}</h2>
        <p className="text-sm text-muted">{t("settings.aiText")}</p>
      </section>

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

      <section className="card mt-6 space-y-3 !border-red-700/25" data-testid="delete-account-section">
        <h2 className="font-display text-xl font-semibold text-red-800">{user ? t("settings.deleteAccount") : t("settings.deleteMyData")}</h2>
        <p className="text-sm text-muted">{user ? t("settings.deleteAccountNote") : t("settings.deleteDeviceNote")}</p>
        <button
          className="btn-ghost text-red-700"
          data-testid="delete-account"
          onClick={async () => {
            if (user) {
              // Signed in: erasure means the account and its server rows, not just this device.
              if (!confirm(t("settings.deleteAccountConfirm"))) return;
              if (!(await deleteAccount())) return alert(t("settings.deleteFailed"));
            } else if (!confirm(t("settings.deleteAllDataDevice"))) return;
            s.resetDemo();
            nav("/", { replace: true });
          }}
        >
          {user ? t("settings.deleteAccount") : t("settings.deleteMyData")}
        </button>
      </section>
    </Shell>
  );
}
