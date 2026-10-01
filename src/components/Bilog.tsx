import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { motion, type TargetAndTransition } from "motion/react";
import { useCalm } from "../lib/calm";
import { watch, type Looker } from "../lib/look";

/**
 * Bilog ("circle" in Filipino): the hand-drawn ink circle, given eyes.
 * It is the same mark that circles the wrong term and the root gap, so it
 * only ever acts out the product's own story:
 *
 *   watch → think → found (re-circles itself, persimmon) → dig (down the roots)
 *   → root → learn → happy / cheer (moss, a sprout grows) .
 *
 * Cheap on low-end phones: one small SVG, only transform / opacity / stroke
 * animate, eyes are moved by a shared loop in lib/look.ts, CSS idle
 * animations pause off screen, and everything is static under reduced motion.
 */
export type BilogMood = "idle" | "watch" | "think" | "found" | "dig" | "root" | "learn" | "happy" | "cheer";

type Vec = { x: number; y: number };

const LOOP = "M26 19.6 C 43.6 6.8, 78.8 10, 88.4 38.8 C 96.4 66, 72.4 91.6, 45.2 90 C 18 88.4, 5.2 66, 11.6 42 C 14.8 30.8, 22.8 22.8, 34 18";
const ECHO = "M21 31 C 29 15, 61 7, 81 22 C 97 36, 95 69, 76 83";
const PAPER = "M50 12 C 73 12, 89 27, 89 50 C 89 73, 72 89, 49 89 C 26 89, 11 73, 11 50 C 11 27, 27 12, 50 12Z";

const MOUTH: Record<BilogMood, string> = {
  idle: "M45 64 Q50.5 67.5 56 64",
  watch: "M46 64.5 Q50.5 66 55 64.5",
  think: "M46.5 65 Q49 63.5 54 65.5",
  found: "M47 64 Q50.5 70 54 64",
  dig: "M46 65.5 Q50.5 65 55 65.5",
  root: "M44 63 Q50.5 70 57 63",
  learn: "M45 64 Q50.5 68 56 64",
  happy: "M43 62.5 Q50.5 71 58 62.5",
  cheer: "M42 62 Q50.5 73 59 62",
};

const BROWS: Partial<Record<BilogMood, [string, string]>> = {
  found: ["M34 37 Q39 33 44 36", "M56 36 Q61 33 66 37"],
  root: ["M34 38 Q39 35 44 37", "M56 37 Q61 35 66 38"],
  dig: ["M35 39 Q40 39 45 41", "M55 41 Q60 39 65 39"],
  think: ["M34 39 Q39 36.5 44 38", "M56 36 Q61 34 66 36.5"],
};
const BROW_REST: [string, string] = ["M34 40 Q39 38 44 40", "M56 40 Q61 38 66 40"];

const STROKE: Record<BilogMood, string> = {
  idle: "var(--color-ink)",
  watch: "var(--color-ink)",
  think: "var(--color-ink)",
  learn: "var(--color-ink)",
  found: "var(--color-gap)",
  dig: "var(--color-gap)",
  root: "var(--color-gap)",
  happy: "var(--color-ok)",
  cheer: "var(--color-ok)",
};

// Where the eyes rest when nothing else asks for attention (null = free to track).
const FIXED: Partial<Record<BilogMood, Vec>> = {
  think: { x: -0.55, y: -0.85 },
  dig: { x: 0, y: 1 },
  happy: { x: 0, y: 0 },
  cheer: { x: 0, y: 0 },
};

const BODY: Partial<Record<BilogMood, TargetAndTransition>> = {
  found: { scale: [1, 0.9, 1.06, 1], rotate: 0, y: 0, transition: { duration: 0.55, ease: "easeOut" } },
  root: { scale: [1, 1.1, 1], rotate: 0, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
  dig: { y: [0, 3, 0], rotate: 0, scale: 1, transition: { duration: 0.9, repeat: Infinity, ease: "easeInOut" } },
  learn: { rotate: -6, y: 0, scale: 1, transition: { type: "spring", stiffness: 160, damping: 14 } },
  happy: { y: [0, -4, 0], rotate: 0, scale: 1, transition: { duration: 0.4, ease: "easeOut" } },
  cheer: { y: [0, -9, 0], scale: [1, 1.05, 1], rotate: 0, transition: { duration: 0.6, ease: "easeOut" } },
};
const BODY_REST: TargetAndTransition = { y: 0, rotate: 0, scale: 1, transition: { type: "spring", stiffness: 200, damping: 18 } };

const RANGE = { x: 6, y: 5 };
const happyEyes = (m: BilogMood) => m === "happy" || m === "cheer";

export function Bilog({
  mood = "idle",
  size = 56,
  lookAt,
  look,
  sprout = false,
  className = "",
}: {
  mood?: BilogMood;
  size?: number;
  /** An element to glance at when the pointer is idle (e.g. the circled term). */
  lookAt?: RefObject<Element | null>;
  /** Override where the eyes rest, -1..1 on each axis. */
  look?: Vec | null;
  /** Show the sprout, already grown (mastery that stays). `cheer` grows it live. */
  sprout?: boolean;
  className?: string;
}) {
  const calm = useCalm();
  const svg = useRef<SVGSVGElement>(null);
  const eyes = useRef<SVGGElement>(null);
  const looker = useRef<Looker | null>(null);
  const [blinkDelay] = useState(() => `${-(Math.random() * 5).toFixed(2)}s`); // instances blink out of step
  const clip = useId();

  // Re-draw the circle whenever Bilog "finds" something: the teacher's mark, live.
  const [circleKey, setCircleKey] = useState(0);
  const prev = useRef(mood);
  useEffect(() => {
    const ring = (m: BilogMood) => m === "found" || m === "root" || m === "cheer";
    if (ring(mood) && prev.current !== mood) setCircleKey((k) => k + 1);
    prev.current = mood;
  }, [mood]);

  const rest = look !== undefined ? look : (FIXED[mood] ?? null);

  useEffect(() => {
    if (calm || !svg.current || !eyes.current) return;
    looker.current = watch(svg.current, eyes.current, svg.current, RANGE);
    return () => {
      looker.current?.dispose();
      looker.current = null;
    };
  }, [calm]);

  useEffect(() => {
    if (calm) {
      const r = rest ?? { x: 0, y: 0 };
      eyes.current?.setAttribute("transform", `translate(${r.x * RANGE.x} ${r.y * RANGE.y})`);
      return;
    }
    looker.current?.setFixed(rest);
  }, [calm, rest?.x, rest?.y]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    looker.current?.setTarget(lookAt?.current ?? null);
  });

  const t = (d: number, delay = 0) => (calm ? { duration: 0 } : { duration: d, delay, ease: [0.65, 0, 0.35, 1] as const });
  const brows = BROWS[mood];
  const growing = mood === "cheer";
  const showSprout = sprout || growing;

  return (
    <svg ref={svg} viewBox="0 -18 100 118" width={size} height={size * 1.18} className={`bilog shrink-0 ${className}`} aria-hidden>
      <defs>
        <clipPath id={clip}>
          <path d={PAPER} />
        </clipPath>
      </defs>

      {showSprout && (
        <g>
          <motion.path d="M50 14 C 50 6, 49 0, 50 -7" fill="none" stroke="var(--color-ok)" strokeWidth={2.6} strokeLinecap="round"
            initial={growing && !calm ? { pathLength: 0 } : false} animate={{ pathLength: 1 }} transition={t(0.45, 0.35)} />
          <motion.path d="M50 -1 C 42 -1, 37 -6, 37 -11 C 44 -11, 50 -7, 50 -1Z" fill="var(--color-ok)"
            style={{ transformBox: "fill-box", transformOrigin: "100% 100%" }}
            initial={growing && !calm ? { scale: 0 } : false} animate={{ scale: 1 }}
            transition={calm ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 12, delay: 0.7 }} />
          <motion.path d="M50 -5 C 58 -5, 63 -10, 63 -15 C 56 -15, 50 -11, 50 -5Z" fill="var(--color-ok)"
            style={{ transformBox: "fill-box", transformOrigin: "0% 100%" }}
            initial={growing && !calm ? { scale: 0 } : false} animate={{ scale: 1 }}
            transition={calm ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 12, delay: 0.85 }} />
        </g>
      )}

      <motion.g style={{ transformBox: "view-box", transformOrigin: "50px 50px" }} initial={false} animate={calm ? BODY_REST : (BODY[mood] ?? BODY_REST)}>
        <path d={PAPER} fill="var(--color-card)" />
        {/* a faint wash of the mood's colour, inside the paper */}
        <g clipPath={`url(#${clip})`}>
          <circle cx="50" cy="104" r="40" fill={STROKE[mood]} opacity={mood === "idle" || mood === "watch" ? 0 : 0.07} className="bilog-wash" />
        </g>

        <g className={mood === "think" && !calm ? "bilog-spin" : undefined}>
          <motion.path key={circleKey} d={LOOP} fill="none" strokeWidth={3.4} strokeLinecap="round" className="bilog-loop"
            style={{ stroke: STROKE[mood] }} initial={calm ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={t(0.7)} />
          <path d={ECHO} fill="none" strokeWidth={1.3} strokeLinecap="round" className="bilog-loop" style={{ stroke: STROKE[mood], opacity: 0.3 }} />
        </g>

        <motion.g initial={calm ? false : { opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} transition={calm ? { duration: 0 } : { delay: 0.35, type: "spring", stiffness: 320, damping: 16 }}
          style={{ transformBox: "view-box", transformOrigin: "50px 54px" }}>
          {happyEyes(mood) && (
            <g fill="var(--color-gap-soft)">
              <ellipse cx="31" cy="60" rx="5.5" ry="3.2" />
              <ellipse cx="70" cy="60" rx="5.5" ry="3.2" />
            </g>
          )}
          <g ref={eyes}>
            {[0, 1].map((i) => (
              <motion.path key={i} d={(brows ?? BROW_REST)[i]} fill="none" stroke="var(--color-ink)" strokeWidth={2} strokeLinecap="round"
                initial={false} animate={{ d: (brows ?? BROW_REST)[i], opacity: brows ? 0.85 : 0 }} transition={t(0.25)} />
            ))}
            {happyEyes(mood) ? (
              <g fill="none" stroke="var(--color-ink)" strokeWidth={2.6} strokeLinecap="round">
                <path d="M35 51.5 Q40 45.5 45 51.5" />
                <path d="M56 51.5 Q61 45.5 66 51.5" />
              </g>
            ) : (
              <g className={calm ? undefined : "bilog-blink"} style={{ animationDelay: blinkDelay }}>
                {[40, 61].map((cx) => (
                  <g key={cx}>
                    <motion.ellipse cx={cx} cy={50} fill="var(--color-ink)" initial={false}
                      animate={mood === "found" ? { rx: 4.8, ry: 6.6 } : mood === "think" ? { rx: 4.2, ry: 4.4 } : { rx: 4.1, ry: 5.5 }}
                      transition={calm ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 18 }} />
                    <circle cx={cx + 1.3} cy={48} r={1.35} fill="var(--color-card)" />
                  </g>
                ))}
              </g>
            )}
          </g>
          <motion.path d={MOUTH[mood]} fill="none" stroke="var(--color-ink)" strokeWidth={2.4} strokeLinecap="round"
            initial={false} animate={{ d: MOUTH[mood] }} transition={calm ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 20 }} />
        </motion.g>
      </motion.g>
    </svg>
  );
}
