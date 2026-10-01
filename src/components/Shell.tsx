import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
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
  if (state === "failed") return <span className="chip bg-red-100 text-red-800">Math checker failed to load</span>;
  return (
    <span className={`chip ${state === "ready" ? "bg-ok-soft text-ok" : "bg-brand-soft text-brand"}`}>
      {state === "ready" ? "● " + t("engineReady") : "◌ " + t("engineLoading")}
    </span>
  );
}

export function Shell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  const { lang, role, set, textScale, readableFont, reduceMotion } = useStore();
  const nav = useNavigate();
  useEffect(() => {
    document.documentElement.style.setProperty("--text-scale", String(textScale));
    document.documentElement.classList.toggle("readable-font", readableFont);
    document.documentElement.classList.toggle("reduce-motion", reduceMotion);
    document.documentElement.lang = lang === "fil" ? "fil" : "en";
  }, [textScale, readableFont, reduceMotion, lang]);

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
        <div className={`mx-auto flex items-center gap-3 px-4 py-3 ${wide ? "max-w-6xl" : "max-w-3xl"}`}>
          <Link to={role === "teacher" ? "/teacher" : role ? "/student" : "/"} className="flex items-center gap-2 font-bold">
            <img src="/icon.svg" alt="" className="h-7 w-7" />
            <span>Gap Finder</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <button
              className="chip border border-line bg-card px-3 py-1 text-ink"
              onClick={() => set({ lang: lang === "en" ? "fil" : "en" })}
              aria-label="Switch language"
            >
              {lang === "en" ? "EN" : "FIL"}
            </button>
            <button className="chip border border-line bg-card px-3 py-1 text-ink" onClick={() => nav("/settings")}
              aria-label="Settings">
              ⚙
            </button>
          </div>
        </div>
      </header>
      <main className={`mx-auto px-4 pb-24 pt-5 ${wide ? "max-w-6xl" : "max-w-3xl"}`}>{children}</main>
    </div>
  );
}
