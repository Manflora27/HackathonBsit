import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router";
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
  if (state === "failed") return <span className="chip bg-gap-soft text-gap">! Math checker couldn't load. Try reloading.</span>;
  return (
    <span className={`chip ${state === "ready" ? "bg-ok-soft text-ok" : "bg-brand-soft text-brand-ink"}`} role="status">
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${state === "ready" ? "bg-ok" : "animate-pulse bg-brand"}`} />
      {state === "ready" ? t("engineReady") : t("engineLoading")}
    </span>
  );
}

const TABS = [
  { to: "/student", icon: "⌂", en: "Home", fil: "Home" },
  { to: "/map", icon: "◈", en: "Skill map", fil: "Skill map" },
  { to: "/progress", icon: "▲", en: "Progress", fil: "Progress" },
  { to: "/settings", icon: "⚙", en: "Settings", fil: "Settings" },
];

/**
 * `tabs` shows the student bottom bar (Home / Skill map / Progress / Settings).
 * Flow screens (solve, trace, lesson) leave it off so the student can focus.
 */
export function Shell({ children, wide = false, tabs = false }: { children: React.ReactNode; wide?: boolean; tabs?: boolean }) {
  const { lang, role, set, textScale, readableFont, reduceMotion } = useStore();
  const nav = useNavigate();
  const fil = lang === "fil";
  const showTabs = tabs && role === "student";
  useEffect(() => {
    document.documentElement.style.setProperty("--text-scale", String(textScale));
    document.documentElement.classList.toggle("readable-font", readableFont);
    document.documentElement.classList.toggle("reduce-motion", reduceMotion);
    document.documentElement.lang = lang === "fil" ? "fil" : "en";
  }, [textScale, readableFont, reduceMotion, lang]);

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-paper">
        <div className={`mx-auto flex items-center gap-3 px-4 py-2 ${wide ? "max-w-6xl" : "max-w-3xl"}`}>
          <Link to={role === "teacher" ? "/teacher" : role ? "/student" : "/"} className="flex min-h-11 items-center gap-2 font-bold">
            <img src="/icon.svg" alt="" className="h-7 w-7" />
            <span>Gap Finder</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <button
              className="min-h-10 rounded-full border border-line bg-card px-3 text-xs font-bold"
              onClick={() => set({ lang: lang === "en" ? "fil" : "en" })}
              aria-label={fil ? "Palitan ang wika (ngayon: Filipino)" : "Switch language (now: English)"}
            >
              {lang === "en" ? "EN" : "FIL"}
            </button>
            {!showTabs && (
              <button className="h-10 w-10 rounded-full border border-line bg-card text-lg" onClick={() => nav("/settings")} aria-label="Settings">
                <span aria-hidden>⚙</span>
              </button>
            )}
          </div>
        </div>
      </header>
      <main className={`mx-auto px-4 pt-5 ${showTabs ? "pb-28" : "pb-24"} ${wide ? "max-w-6xl" : "max-w-3xl"}`}>{children}</main>
      {showTabs && (
        <nav aria-label={fil ? "Pangunahing menu" : "Main"} className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card pb-[env(safe-area-inset-bottom)]">
          <ul className="mx-auto grid max-w-3xl grid-cols-4">
            {TABS.map((tab) => (
              <li key={tab.to}>
                <NavLink
                  to={tab.to}
                  className={({ isActive }) =>
                    `flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${isActive ? "text-brand-ink" : "text-muted hover:text-ink"}`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span aria-hidden className={`flex h-7 w-12 items-center justify-center rounded-full text-base ${isActive ? "bg-brand-soft" : ""}`}>
                        {tab.icon}
                      </span>
                      {fil ? tab.fil : tab.en}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
