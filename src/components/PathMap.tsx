import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { skillById, skills, skillTitle } from "../data";
import { useStore } from "../store";
import type { SkillStatus } from "../types";

// A short glyph per skill, drawn inside its level bubble.
const GLYPH: Record<string, string> = {
  quad_sqrt: "√=",
  quad_factor: "×0",
  quad_formula: "±",
  special_products: "( )²",
  factoring: "( )( )",
  rational_expr: "a⁄b",
  poly_mult: "▦",
  lin_eq: "x=",
  sqrt_roots: "√",
  distributive: "a( )",
  exponents: "xⁿ",
  like_terms: "+x",
  frac_ops: "½",
  int_ops: "−+",
};

const GRADE_TONE: Record<number, string> = { 9: "bg-brand text-white", 8: "bg-sky text-ink", 7: "bg-gap text-ink" };
const W = 320;
const SWING = [0, 70, 100, 70, 0, -70, -100, -70];
const STEP = 112;
const BAND = 64;

type Placed = { id: string; x: number; y: number };

function layout(ids: string[]) {
  const placed: Placed[] = [];
  const bands: { grade: number; y: number }[] = [];
  let y = 0;
  let lastGrade = -1;
  ids.forEach((id, i) => {
    const g = skillById[id].grade;
    if (g !== lastGrade) {
      bands.push({ grade: g, y });
      y += BAND;
      lastGrade = g;
    }
    placed.push({ id, x: W / 2 + SWING[i % SWING.length], y: y + 36 });
    y += STEP;
  });
  return { placed, bands, height: y + 10 };
}

/**
 * The skill map as a game-style level path, top (Grade 9) to bottom (Grade 7).
 * During a trace, a marker drops from node to node down to the root gap.
 */
export function PathMap({
  statuses,
  path = [],
  root = null,
  animate = false,
  only,
  onSelect,
}: {
  statuses: Record<string, SkillStatus>;
  path?: string[];
  root?: string | null;
  animate?: boolean;
  only?: string[];
  onSelect?: (id: string) => void;
}) {
  const lang = useStore((s) => s.lang);
  const reduce = useStore((s) => s.reduceMotion);
  const ids = useMemo(() => {
    const base = only ?? [...skills].sort((a, b) => b.grade - a.grade || a.y - b.y || a.x - b.x).map((s) => s.id);
    return base;
  }, [only]);
  const { placed, bands, height } = useMemo(() => layout(ids), [ids]);
  const pos = Object.fromEntries(placed.map((p) => [p.id, p]));

  const instant = !animate || reduce || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [lit, setLit] = useState(instant ? path.length : 0);
  useEffect(() => {
    if (instant) return setLit(path.length);
    setLit(0);
    const timers = path.map((_, i) => setTimeout(() => setLit(i + 1), 300 + i * 750));
    return () => timers.forEach(clearTimeout);
  }, [path.join(","), instant]); // eslint-disable-line react-hooks/exhaustive-deps

  const trail = path.slice(0, lit).map((id) => pos[id]).filter(Boolean);
  const marker = trail[trail.length - 1];
  const done = lit >= path.length && !!root;

  const d = placed.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
  const trailD = trail.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");

  return (
    <div className="relative mx-auto" style={{ width: W, height }}>
      <svg className="absolute inset-0" width={W} height={height} aria-hidden>
        <path d={d} fill="none" stroke="#1e1b3a" strokeOpacity={0.18} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 18" />
        {trail.length > 1 && (
          <motion.path
            d={trailD}
            fill="none"
            stroke="var(--color-gap)"
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray="10 10"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: instant ? 0 : 0.6 }}
          />
        )}
      </svg>

      {bands.map((b) => (
        <div key={b.grade} className="absolute inset-x-0 flex justify-center" style={{ top: b.y + 8 }}>
          <span className={`chip !border-[2.5px] !px-4 !py-1 font-display !text-[14px] ${GRADE_TONE[b.grade] ?? "bg-white"}`}>
            Grade {b.grade}
          </span>
        </div>
      ))}

      {placed.map((p) => {
        const st = statuses[p.id] ?? "unknown";
        const onPath = path.slice(0, lit).includes(p.id);
        const isRoot = done && p.id === root;
        const fill = isRoot || st === "gap" ? "bg-gap" : st === "mastered" ? "bg-ok text-white" : onPath ? "bg-gap-soft" : "bg-white";
        return (
          <button
            key={p.id}
            className="absolute flex w-[132px] -translate-x-1/2 -translate-y-[34px] flex-col items-center"
            style={{ left: p.x, top: p.y }}
            onClick={() => onSelect?.(p.id)}
            aria-label={`${skillTitle(p.id, lang)}, grade ${skillById[p.id].grade}, ${isRoot ? "root gap" : st}`}
            data-testid={`node-${p.id}`}
          >
            <motion.span
              className={`relative flex h-[68px] w-[68px] items-center justify-center rounded-full border-[3px] border-ink font-display text-[17px] font-semibold ${fill} ${isRoot ? "bob" : ""}`}
              style={{ boxShadow: "0 5px 0 var(--color-ink)" }}
              animate={isRoot ? { scale: [1, 1.15, 1] } : { scale: 1 }}
              transition={{ duration: 0.6 }}
            >
              {GLYPH[p.id]}
              {st === "mastered" && !isRoot && (
                <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-ink bg-white text-[13px] text-ok">✓</span>
              )}
              {(st === "gap" || isRoot) && (
                <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-ink bg-white text-[14px] text-gap-dark">!</span>
              )}
            </motion.span>
            <span className="mt-2 line-clamp-2 text-center text-[12.5px] font-extrabold leading-tight">{skillTitle(p.id, lang)}</span>
            {isRoot && (
              <span className="mt-1 rounded-full border-2 border-ink bg-ink px-2 py-0.5 font-display text-[12px] text-white">
                {lang === "fil" ? "ang gap!" : "the gap!"}
              </span>
            )}
          </button>
        );
      })}

      {marker && !done && (
        <motion.div
          className="pointer-events-none absolute h-5 w-5 rounded-full border-[3px] border-ink bg-gap"
          style={{ marginLeft: -10, marginTop: -58 }}
          initial={false}
          animate={{ left: marker.x, top: marker.y }}
          transition={{ type: "spring", stiffness: 220, damping: 14 }}
        />
      )}
    </div>
  );
}
