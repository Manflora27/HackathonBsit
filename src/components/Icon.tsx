// Small hand-tuned line icons (1.6px stroke) that match the ink drawing style.
const PATHS = {
  home: "M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z",
  roots: "M12 3v6m0 0c0 4-5 4-6 9m6-9c0 4 5 4 6 9m-6-9v12",
  pencil: "m14.5 5.5 4 4M5 19l1-4.5L15.8 4.7a1.4 1.4 0 0 1 2 0l1.5 1.5a1.4 1.4 0 0 1 0 2L9.5 18z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8c.8-3.5 3.6-5.5 7-5.5s6.2 2 7 5.5",
  flame: "M12 21c3.6 0 6-2.4 6-5.6 0-3.8-3.4-5.6-4.2-9.4-1.9 1.4-2.6 3.3-2.5 5.2-1-.6-1.7-1.6-1.9-2.8C7.6 10 6 12.4 6 15.4 6 18.6 8.4 21 12 21z",
  sprout: "M12 20v-8m0 0c0-3.6-2.6-6-6.5-6 0 3.6 2.6 6 6.5 6zm0 0c0-3 2.2-5 5.5-5 0 3-2.2 5-5.5 5z",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zm9 2-4-4",
  speaker: "M5 9.5h3l4.5-4v13l-4.5-4H5zM16 9a4 4 0 0 1 0 6m2.5-8.5a7.5 7.5 0 0 1 0 11",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z",
  mail: "M4 6h16v12H4zm0 0 8 7 8-7",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  back: "M19 12H5m6-6-6 6 6 6",
  check: "m5 12.5 4.5 4.5L19 7.5",
  compass: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm3.5-12.5-2 5-5 2 2-5z",
  keyboard: "M3 7h18v10H3zm4 7h10M7 10h.01M10 10h.01M13 10h.01M16 10h.01",
  download: "M12 4v11m-5-5 5 5 5-5M5 20h14",
  chevron: "m9 6 6 6-6 6",
  close: "M6 6l12 12M18 6 6 18",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, className = "", strokeWidth = 1.6 }: { name: IconName; size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}

/** The hand-drawn circle motif as an inline element (wraps its children). */
export function InkCircle({ children, className = "", color = "var(--color-gap)", draw = true }: { children: React.ReactNode; className?: string; color?: string; draw?: boolean }) {
  return (
    <span className={`relative inline-flex items-center justify-center ${className}`}>
      {children}
      <svg viewBox="0 0 120 120" preserveAspectRatio="none" className="pointer-events-none absolute -inset-[18%] h-[136%] w-[136%] overflow-visible" aria-hidden>
        <path
          d="M30 22 C 52 6, 96 10, 108 46 C 118 80, 88 112, 54 110 C 20 108, 4 80, 12 50 C 16 36, 26 26, 40 20"
          fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" vectorEffect="non-scaling-stroke"
          pathLength={1} strokeDasharray={1} strokeDashoffset={draw ? 1 : 0}
          style={draw ? { animation: "gf-ring 0.8s 0.2s cubic-bezier(.65,0,.35,1) forwards" } : undefined}
        />
      </svg>
    </span>
  );
}
