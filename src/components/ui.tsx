import { useEffect, useRef } from "react";
import { useStore } from "../store";

export type Stage = "work" | "find" | "gap" | "learn" | "practice" | "retry" | "mastery";

const STAGES: { id: Stage; en: string; fil: string }[] = [
  { id: "work", en: "Show your work", fil: "Ipakita ang solusyon" },
  { id: "find", en: "Spot the step", fil: "Hanapin ang step" },
  { id: "gap", en: "Discover the gap", fil: "Tuklasin ang gap" },
  { id: "learn", en: "Learn it", fil: "Pag-aralan" },
  { id: "practice", en: "Practice", fil: "Mag-practice" },
  { id: "retry", en: "Retry", fil: "Subukan ulit" },
  { id: "mastery", en: "Mastered", fil: "Kaya mo na" },
];

/** Where the student is on Problem → Work → Find → Gap → Learn → Practice → Retry → Mastery. */
export function JourneyBar({ stage }: { stage: Stage }) {
  const fil = useStore((s) => s.lang) === "fil";
  const at = STAGES.findIndex((s) => s.id === stage);
  return (
    <nav aria-label={fil ? "Nasaan ka sa journey" : "Your journey"} className="mb-4">
      <ol className="flex items-center gap-1">
        {STAGES.map((s, i) => (
          <li key={s.id} className="flex flex-1 items-center" aria-current={i === at ? "step" : undefined}>
            <span className="sr-only">{fil ? s.fil : s.en}{i < at ? (fil ? " (tapos)" : " (done)") : ""}</span>
            <span
              aria-hidden
              className={`h-2 w-full rounded-full transition-colors duration-500 ${
                i < at ? "bg-ok" : i === at ? (stage === "mastery" ? "bg-ok" : "bg-brand") : "bg-line"
              }`}
            />
          </li>
        ))}
      </ol>
      <div className="mt-1.5 flex items-baseline justify-between text-xs">
        <span className="font-semibold text-ink">{fil ? STAGES[at].fil : STAGES[at].en}</span>
        <span className="text-muted">
          {at + 1} / {STAGES.length}
        </span>
      </div>
    </nav>
  );
}

export function Switch({ checked, onChange, label, hint, testId }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; testId?: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
      <span>
        <span className="block font-medium">{label}</span>
        {hint && <span className="block text-sm text-muted">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} data-testid={testId} />
      <span
        aria-hidden
        className="relative h-7 w-12 shrink-0 rounded-full bg-line transition-colors peer-checked:bg-brand peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand/50 after:absolute after:top-1 after:left-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5"
      />
    </label>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-2xl bg-paper p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`min-h-10 min-w-12 rounded-xl px-3 text-sm font-semibold transition ${
            o.value === value ? "bg-card text-brand-ink shadow-sm" : "text-muted hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Dots toward a goal, e.g. 2 correct answers to master a skill. */
export function ProgressDots({ done, goal, label }: { done: number; goal: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5" role="img" aria-label={label}>
      {Array.from({ length: goal }, (_, i) => (
        <span key={i} className={`h-3 w-3 rounded-full border-2 transition-colors ${i < done ? "border-ok bg-ok" : "border-line bg-card"}`} />
      ))}
    </span>
  );
}

/** Mobile bottom sheet; centered dialog on wider screens. Escape closes it. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close.current();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus();
    };
  }, []);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="gf-rise w-full max-w-md rounded-t-[1.75rem] bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl outline-none sm:rounded-[1.75rem]"
      >
        <div aria-hidden className="mx-auto -mt-1 mb-3 h-1.5 w-10 rounded-full bg-line sm:hidden" />
        <h2 className="text-lg font-bold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-medium text-muted hover:text-ink">
      <span aria-hidden>←</span> {label}
    </button>
  );
}
