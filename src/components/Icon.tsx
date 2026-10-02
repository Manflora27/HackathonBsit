import { useLayoutEffect, useRef } from "react";

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
  stop: "M7.5 6.5h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z",
  mail: "M4 6h16v12H4zm0 0 8 7 8-7",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  back: "M19 12H5m6-6-6 6 6 6",
  check: "m5 12.5 4.5 4.5L19 7.5",
  bolt: "M13 3 5 13.5h6L10 21l8-10.5h-6z",
  compass: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm3.5-12.5-2 5-5 2 2-5z",
  keyboard: "M3 7h18v10H3zm4 7h10M7 10h.01M10 10h.01M13 10h.01M16 10h.01",
  download: "M12 4v11m-5-5 5 5 5-5M5 20h14",
  chevron: "m9 6 6 6-6 6",
  close: "M6 6l12 12M18 6 6 18",
  mic: "M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm-6-3a6 6 0 0 0 12 0m-6 6v3",
  camera: "M4 8h3.5L9 6h6l1.5 2H20v11H4zm8 9a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  rewind: "M11 7 5 12l6 5zM19 7l-6 5 6 5z",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0-4a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.5 3.5 6 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-6-3.5-9s1-6.5 3.5-9z",
  // subjects
  "s-math": "M5 7h5M7.5 4.5v5M14 7h5M5.5 15l4 4m0-4-4 4M14 15.5h5M14 18.5h5",
  "s-science": "M9 3h6M10 3v6.5L5.2 18.2A1.8 1.8 0 0 0 6.8 21h10.4a1.8 1.8 0 0 0 1.6-2.8L14 9.5V3M7.5 15h9",
  "s-general-math": "M4 20h16M4 20V4M6.5 17C9 17 10 8 13 8s3.5 5 6 5",
  "s-general-science": "M10 3h4l-.8 7h-2.4zM12 10v3M6 21h12M9 21v-2a5 5 0 0 1 9.5-2.2M14 13a3 3 0 0 1 0 6",
  "s-finite-math": "M5 5h14v14H5zM9 9h.01M15 9h.01M12 12h.01M9 15h.01M15 15h.01",
  "s-pre-calculus": "M3 12c2.3-6 5.7-6 9 0s6.7 6 9 0M3 4v16M3 12h18",
  "s-advanced-math": "M7.5 9a3 3 0 1 0 0 6c2.5 0 6.5-6 9-6a3 3 0 1 1 0 6c-2.5 0-6.5-6-9-6z",
  "s-basic-calculus": "M15.5 4c-2.2-1.2-4.3 0-4.8 3l-1.4 10c-.5 3-2.6 4.2-4.8 3M15 13l4 4m0-4-4 4",
  "s-physics": "M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM3.5 12a8.5 3.5 0 1 0 17 0 8.5 3.5 0 1 0-17 0M7.75 4.64a8.5 3.5 60 1 0 8.5 14.72 8.5 3.5 60 1 0-8.5-14.72M7.75 19.36a8.5 3.5 -60 1 0 8.5-14.72 8.5 3.5 -60 1 0-8.5 14.72",
  "s-chemistry": "M12 3l7 4v8l-7 4-7-4V7zM12 3v4M12 15v4M5 7l3.5 2M19 7l-3.5 2M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",
  "s-biology": "M7 3c0 6 10 6 10 12 0 3-2 5-3 6M17 3c0 6-10 6-10 12 0 3 2 5 3 6M8.5 6.5h7M8.5 17.5h7M10 11h4",
  "s-earth-space": "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM4.5 16c-2 2.7.4 3.8 5.5 2.2S20.7 11.6 20.7 9c0-1.3-1.6-1.7-3.9-1.3",
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
  const ref = useRef<SVGPathElement>(null);
  // non-scaling-stroke makes Chromium measure dashes in screen px (pathLength is ignored),
  // so measure the ring's on-screen length and animate in those units for an even sweep.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!draw || !el) return;
    const measure = () => {
      const m = el.getScreenCTM();
      const total = el.getTotalLength();
      let len = 0;
      if (m) {
        let prev: DOMPoint | null = null;
        for (let i = 0; i <= 64; i++) {
          const pt = el.getPointAtLength((total * i) / 64).matrixTransform(m);
          if (prev) len += Math.hypot(pt.x - prev.x, pt.y - prev.y);
          prev = pt;
        }
      }
      len = Math.ceil(len || total) + 4;
      el.style.strokeDasharray = `${len} ${len}`;
      return [{ strokeDashoffset: len }, { strokeDashoffset: 0 }];
    };
    el.style.opacity = "1";
    const anim = el.animate(measure(), { duration: 700, delay: 100, easing: "cubic-bezier(.4,0,.2,1)", fill: "both" });
    // Late font loads resize the box; re-measure so the sweep stays continuous.
    const ro = new ResizeObserver(() => anim.effect && (anim.effect as KeyframeEffect).setKeyframes(measure()));
    ro.observe(el.ownerSVGElement ?? el);
    return () => { ro.disconnect(); anim.cancel(); };
  }, [draw]);
  return (
    <span className={`relative inline-flex items-center justify-center ${className}`}>
      {children}
      <svg viewBox="0 0 120 120" preserveAspectRatio="none" className="pointer-events-none absolute -inset-[18%] h-[136%] w-[136%] overflow-visible" aria-hidden>
        <path ref={ref}
          d="M30 22 C 52 6, 96 10, 108 46 C 118 80, 88 112, 54 110 C 20 108, 4 80, 12 50 C 16 36, 26 26, 40 20"
          fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" vectorEffect="non-scaling-stroke"
          style={draw ? { opacity: 0 } : undefined}
        />
      </svg>
    </span>
  );
}
