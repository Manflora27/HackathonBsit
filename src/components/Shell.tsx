import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router";
import { MotionConfig, motion } from "motion/react";
import { engineState, onEngineState, startEngine } from "../engine/client";
import { LANGS, useT, type StringKey } from "../i18n";
import type { Lang } from "../types";
import { Ambient } from "./Ambient";
import { Icon, type IconName } from "./Icon";
import { streak, useStore } from "../store";
import { MathStrip } from "./MathStrip";

export function EngineBadge() {
  const t = useT();
  const [state, setState] = useState(engineState());
  useEffect(() => {
    startEngine();
    const off = onEngineState(setState);
    return () => {
      off();
    };
  }, []);
  if (state === "failed") return <span className="chip bg-gap-soft text-gap-dark">{t("shell.checkerFailed")}</span>;
  return (
    <span className="chip !bg-transparent px-0 text-muted" data-testid="engine-badge">
      <span className={`h-1.5 w-1.5 rounded-full ${state === "ready" ? "bg-ok" : "animate-pulse bg-ochre"}`} />
      {state === "ready" ? t("common.engineReady") : t("common.engineLoading")}
    </span>
  );
}

export function Stats() {
  const { gapsFixed, activeDays, xp } = useStore();
  const t = useT();
  const shown = useRef(xp);
  const bump = xp !== shown.current;
  const days = streak(activeDays);
  return (
    <div className="flex items-center gap-2">
      <span className="chip !bg-transparent !px-1 text-[13px]" title={t("shell.xp")} aria-label={t("shell.xpCount", { count: xp })}>
        <Icon name="bolt" size={16} className="text-gap" />
        {/* Bumps whenever points land, so a right answer is felt up here too. */}
        <motion.span key={xp} initial={bump ? { scale: 1.6, color: "#d9532b" } : false} animate={{ scale: 1, color: "#1e2b27" }}
          transition={{ type: "spring", stiffness: 420, damping: 14 }}>{xp}</motion.span>
      </span>
      {/* Unlit until today's practice: yesterday's streak is still alive, just waiting. */}
      <span className="chip !bg-transparent !px-1 text-[13px]" title={t("shell.daysPracticed")} aria-label={t("shell.daysPracticedCount", { count: days })} data-testid="streak">
        <Icon name="flame" size={16} className={activeDays.includes(new Date().toDateString()) ? "text-ochre" : "text-muted"} /> {days}
      </span>
      <span className="chip !bg-transparent !px-1 text-[13px]" title={t("shell.gapsFixed")} aria-label={t("shell.gapsFixedCount", { count: gapsFixed.length })}>
        <Icon name="sprout" size={16} className="text-ok" /> {gapsFixed.length}
      </span>
    </div>
  );
}

function useApplyPrefs() {
  const { lang, textScale, readableFont, reduceMotion } = useStore();
  useEffect(() => {
    document.documentElement.style.setProperty("--text-scale", String(textScale));
    document.documentElement.classList.toggle("readable-font", readableFont);
    document.documentElement.classList.toggle("reduce-motion", reduceMotion);
    document.documentElement.lang = lang;
  }, [textScale, readableFont, reduceMotion, lang]);
}

const TABS: { to: string; icon: IconName; label: StringKey }[] = [
  { to: "/student", icon: "home", label: "nav.home" },
  { to: "/map", icon: "roots", label: "nav.roots" },
  { to: "/help", icon: "pencil", label: "nav.help" },
  { to: "/settings", icon: "user", label: "nav.me" },
];

/** Header pill: shows the current language's short code; tapping opens the device's own picker with every language. */
function LangButton({ className }: { className: string }) {
  const { lang, set } = useStore();
  const t = useT();
  return (
    <label className={`cursor-pointer gap-1 ${className.includes("absolute") ? "" : "relative"} ${className}`} title={t("nav.switchLanguage")}>
      <Icon name="globe" size={15} className="opacity-70" />
      {SHORT[lang]}
      <Icon name="chevron" size={12} className="rotate-90 opacity-60" />
      <select className="absolute inset-0 cursor-pointer appearance-none opacity-0" value={lang} aria-label={t("nav.switchLanguage")}
        onChange={(e) => set({ lang: e.target.value as Lang })} data-testid="lang-menu">
        {LANGS.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
      </select>
    </label>
  );
}
const SHORT: Record<Lang, string> = { en: "EN", tl: "TL", ceb: "BIS" };

/**
 * Mobile-first frame: a phone-width column (centered on desktop),
 * a slim top bar, and a bottom tab bar in the thumb zone.
 */
export function Shell({
  children,
  wide = false,
  tabs = true,
  title,
  back,
  bare = false,
}: {
  children: React.ReactNode;
  wide?: boolean;
  tabs?: boolean;
  title?: React.ReactNode;
  back?: string | number;
  /** No top bar: just a small language pill. For full-screen first impressions. */
  bare?: boolean;
}) {
  useApplyPrefs();
  const { role, reduceMotion } = useStore();
  const t = useT();
  const nav = useNavigate();
  const showTabs = tabs && role === "student";

  return (
    <MotionConfig reducedMotion={reduceMotion ? "always" : "user"}>
    <div className={`relative mx-auto min-h-dvh ${wide ? "max-w-6xl" : "max-w-md"}`}>
      <Ambient quiet={bare} />
      {bare && (
        <LangButton className="absolute right-4 top-4 z-20 flex h-9 min-w-9 items-center justify-center rounded-full bg-white/60 px-2.5 text-[12.5px] font-bold tracking-wide shadow-[inset_0_1px_0_#fff]" />
      )}
      {!bare && <header className="sticky top-2 z-20 px-3 pt-1">
        <div className="glass flex h-14 items-center gap-2.5 rounded-full px-3">
          {back !== undefined ? (
            <button className="flex h-9 w-9 items-center justify-center rounded-full bg-white/60 shadow-[inset_0_1px_0_#fff]" aria-label={t("common.back")}
              onClick={() => (typeof back === "number" ? nav(back) : nav(back))}>
              <Icon name="back" size={18} />
            </button>
          ) : (
            <button onClick={() => nav(role ? "/student" : "/")} aria-label={t("common.home")}>
              <img src="/icon.svg" alt="" className="h-8 w-8 rounded-[10px]" />
            </button>
          )}
          <div className="min-w-0 flex-1 truncate font-display text-[19px]">{title ?? "Hopper"}</div>
          {role === "student" && <Stats />}
          <LangButton className="flex h-9 min-w-9 items-center justify-center rounded-full bg-white/60 px-2.5 text-[12.5px] font-bold tracking-wide shadow-[inset_0_1px_0_#fff]" />
        </div>
      </header>}
      <main className={`px-4 ${bare ? "pt-12" : "pt-4"} ${showTabs ? "pb-28" : bare ? "pb-6" : "pb-10"}`}>{children}</main>
      {showTabs && (
        <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md px-3 pb-[max(env(safe-area-inset-bottom),10px)]">
          <div className="glass-dark flex justify-around rounded-full p-1.5 text-paper">
            {TABS.map((tab) => (
              <NavLink key={tab.to} to={tab.to} end={tab.to === "/student"}
                className={({ isActive }) =>
                  `flex flex-1 flex-col items-center gap-0.5 rounded-full py-2 text-[11px] font-bold tracking-wide transition ${isActive ? "bg-white/90 text-ink shadow-[0_6px_14px_-8px_rgb(0_0_0/.6)]" : "text-paper/65"}`
                }>
                <Icon name={tab.icon} size={20} />
                {t(tab.label)}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
      <MathStrip />
    </MotionConfig>
  );
}
