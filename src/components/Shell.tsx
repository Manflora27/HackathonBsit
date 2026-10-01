import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router";
import { engineState, onEngineState, startEngine } from "../engine/client";
import { useT } from "../i18n";
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
  if (state === "failed") return <span className="chip bg-red-100">Math checker failed to load</span>;
  return (
    <span className={`chip ${state === "ready" ? "bg-ok-soft" : "bg-brand-soft"}`} data-testid="engine-badge">
      <span className={`h-2 w-2 rounded-full ${state === "ready" ? "bg-ok" : "animate-pulse bg-brand"}`} />
      {state === "ready" ? t("engineReady") : t("engineLoading")}
    </span>
  );
}

export function Stats() {
  const { gapsFixed, activeDays } = useStore();
  return (
    <div className="flex items-center gap-2">
      <span className="chip bg-gap-soft text-[13px]" title="Days you practiced">🔥 {activeDays.length}</span>
      <span className="chip bg-ok-soft text-[13px]" title="Gaps fixed">🧩 {gapsFixed.length}</span>
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

const TABS = [
  { to: "/student", icon: "🏠", en: "Home", fil: "Home" },
  { to: "/map", icon: "🗺️", en: "Map", fil: "Mapa" },
  { to: "/solve/custom", icon: "✏️", en: "Check", fil: "Check" },
  { to: "/settings", icon: "⚙️", en: "Me", fil: "Ako" },
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
}: {
  children: React.ReactNode;
  wide?: boolean;
  tabs?: boolean;
  title?: React.ReactNode;
  back?: string | number;
}) {
  useApplyPrefs();
  const { lang, role, set } = useStore();
  const nav = useNavigate();
  const showTabs = tabs && role === "student";

  return (
    <div className={`mx-auto min-h-dvh ${wide ? "max-w-6xl" : "max-w-md"}`}>
      <header className="sticky top-0 z-20 bg-paper/85 backdrop-blur-md">
        <div className="flex h-14 items-center gap-2 px-4">
          {back !== undefined ? (
            <button className="btn-ghost btn-sm !min-h-9 !px-2.5" aria-label="Back"
              onClick={() => (typeof back === "number" ? nav(back) : nav(back))}>
              ←
            </button>
          ) : (
            <button onClick={() => nav(role === "teacher" ? "/teacher" : role ? "/student" : "/")} className="flex items-center gap-2" aria-label="Home">
              <img src="/icon.svg" alt="" className="h-8 w-8 rounded-[10px] border-2 border-ink" />
            </button>
          )}
          <div className="min-w-0 flex-1 truncate font-display text-lg font-semibold">{title ?? "Gap Finder"}</div>
          {role === "student" && <Stats />}
          <button className="btn-ghost btn-sm !min-h-9 !px-2.5 !text-[13px]" onClick={() => set({ lang: lang === "en" ? "fil" : "en" })}
            aria-label="Switch language">
            {lang === "en" ? "EN" : "FIL"}
          </button>
        </div>
      </header>
      <main className={`px-4 pt-2 ${showTabs ? "pb-28" : "pb-10"}`}>{children}</main>
      {showTabs && (
        <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md px-3 pb-[max(env(safe-area-inset-bottom),10px)]">
          <div className="card-flat flex justify-around !rounded-[22px] !p-1.5" style={{ boxShadow: "0 4px 0 var(--color-ink)" }}>
            {TABS.map((tab) => (
              <NavLink key={tab.to} to={tab.to} end={tab.to === "/student"}
                className={({ isActive }) =>
                  `flex flex-1 flex-col items-center rounded-2xl py-1.5 text-[12px] font-extrabold transition ${isActive ? "bg-brand-soft text-brand" : "text-muted"}`
                }>
                <span className="text-xl leading-none">{tab.icon}</span>
                {lang === "fil" ? tab.fil : tab.en}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
