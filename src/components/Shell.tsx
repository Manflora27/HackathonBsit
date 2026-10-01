import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router";
import { engineState, onEngineState, startEngine } from "../engine/client";
import { useT } from "../i18n";
import { Ambient } from "./Ambient";
import { Icon, type IconName } from "./Icon";
import { useStore } from "../store";

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
  if (state === "failed") return <span className="chip bg-gap-soft text-gap-dark">Math checker failed to load</span>;
  return (
    <span className="chip !bg-transparent px-0 text-muted" data-testid="engine-badge">
      <span className={`h-1.5 w-1.5 rounded-full ${state === "ready" ? "bg-ok" : "animate-pulse bg-ochre"}`} />
      {state === "ready" ? t("engineReady") : t("engineLoading")}
    </span>
  );
}

export function Stats() {
  const { gapsFixed, activeDays } = useStore();
  return (
    <div className="flex items-center gap-2">
      <span className="chip !bg-transparent !px-1 text-[13px]" title="Days you practiced" aria-label={`${activeDays.length} days practiced`}>
        <Icon name="flame" size={16} className="text-ochre" /> {activeDays.length}
      </span>
      <span className="chip !bg-transparent !px-1 text-[13px]" title="Gaps fixed" aria-label={`${gapsFixed.length} gaps fixed`}>
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
    document.documentElement.lang = lang === "fil" ? "fil" : "en";
  }, [textScale, readableFont, reduceMotion, lang]);
}

const TABS: { to: string; icon: IconName; en: string; fil: string }[] = [
  { to: "/student", icon: "home", en: "Home", fil: "Home" },
  { to: "/map", icon: "roots", en: "Roots", fil: "Ugat" },
  { to: "/solve/custom", icon: "pencil", en: "Check", fil: "Check" },
  { to: "/settings", icon: "user", en: "Me", fil: "Ako" },
];

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
  const { lang, role, set } = useStore();
  const nav = useNavigate();
  const showTabs = tabs && role === "student";

  return (
    <div className={`relative mx-auto min-h-dvh ${wide ? "max-w-6xl" : "max-w-md"}`}>
      <Ambient />
      {bare && (
        <button className="absolute right-4 top-4 z-20 flex h-9 min-w-9 items-center justify-center rounded-full bg-white/60 px-2.5 text-[12.5px] font-bold tracking-wide shadow-[inset_0_1px_0_#fff]"
          onClick={() => set({ lang: lang === "en" ? "fil" : "en" })} aria-label="Switch language">
          {lang === "en" ? "EN" : "FIL"}
        </button>
      )}
      {!bare && <header className="sticky top-2 z-20 px-3 pt-1">
        <div className="glass flex h-14 items-center gap-2.5 rounded-full px-3">
          {back !== undefined ? (
            <button className="flex h-9 w-9 items-center justify-center rounded-full bg-white/60 shadow-[inset_0_1px_0_#fff]" aria-label="Back"
              onClick={() => (typeof back === "number" ? nav(back) : nav(back))}>
              <Icon name="back" size={18} />
            </button>
          ) : (
            <button onClick={() => nav(role === "teacher" ? "/teacher" : role ? "/student" : "/")} aria-label="Home">
              <img src="/icon.svg" alt="" className="h-8 w-8 rounded-[10px]" />
            </button>
          )}
          <div className="min-w-0 flex-1 truncate font-display text-[19px]">{title ?? "Gap Finder"}</div>
          {role === "student" && <Stats />}
          <button className="flex h-9 min-w-9 items-center justify-center rounded-full bg-white/60 px-2.5 text-[12.5px] font-bold tracking-wide shadow-[inset_0_1px_0_#fff]"
            onClick={() => set({ lang: lang === "en" ? "fil" : "en" })} aria-label="Switch language">
            {lang === "en" ? "EN" : "FIL"}
          </button>
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
                {lang === "fil" ? tab.fil : tab.en}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
