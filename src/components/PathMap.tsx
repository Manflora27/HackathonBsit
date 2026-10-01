import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { skillById, skills, skillTitle } from "../data";
import { useStore } from "../store";
import type { SkillStatus } from "../types";
import { InkCircle } from "./Icon";

// A short glyph per skill, set in the serif inside its node.
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

const W = 340;
type Pt = { id: string; x: number; y: number };

/** Full map: a root system. Advanced skills on top, foundations below, real prerequisite edges between them. */
function treeLayout() {
  const rowH = 148;
  const pts: Pt[] = skills.map((s) => ({ id: s.id, x: 44 + s.x * 84, y: 70 + s.y * rowH }));
  const bands: { grade: number; y: number }[] = [];
  const seen = new Set<number>();
  for (const s of [...skills].sort((a, b) => a.y - b.y)) {
    if (!seen.has(s.grade)) {
      seen.add(s.grade);
      bands.push({ grade: s.grade, y: 70 + s.y * rowH - 50 });
    }
  }
  const edges = skills.flatMap((s) => s.prereqs.map((p) => ({ from: p, to: s.id })));
  return { pts, bands, edges, height: 70 + 4 * rowH + 90 };
}

/** Trace view: just the chain being dug through, top to bottom. */
function chainLayout(ids: string[]) {
  const pts: Pt[] = ids.map((id, i) => ({ id, x: W / 2 + (i % 2 ? 58 : -58) * (i ? 1 : 0), y: 58 + i * 132 }));
  const edges = ids.slice(1).map((id, i) => ({ from: id, to: ids[i] }));
  return { pts, bands: [] as { grade: number; y: number }[], edges, height: 58 + (ids.length - 1) * 132 + 96 };
}

function curve(a: Pt, b: Pt) {
  // from a (lower) up to b (upper), vertical tangents: reads like a root
  const my = (a.y + b.y) / 2;
  return `M${a.x},${a.y} C${a.x},${my} ${b.x},${my} ${b.x},${b.y}`;
}

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
  const { pts, bands, edges, height } = useMemo(() => (only ? chainLayout(only) : treeLayout()), [only?.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const pos = Object.fromEntries(pts.map((p) => [p.id, p]));

  const instant = !animate || reduce || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [lit, setLit] = useState(instant ? path.length : 0);
  useEffect(() => {
    if (instant) return setLit(path.length);
    setLit(0);
    const timers = path.map((_, i) => setTimeout(() => setLit(i + 1), 250 + i * 700));
    return () => timers.forEach(clearTimeout);
  }, [path.join(","), instant]); // eslint-disable-line react-hooks/exhaustive-deps

  const litIds = path.slice(0, lit);
  const done = lit >= path.length && !!root;
  const onTrail = (from: string, to: string) => {
    const i = litIds.indexOf(to);
    return i >= 0 && litIds[i + 1] === from;
  };

  return (
    <div className="relative mx-auto" style={{ width: W, height }}>
      {bands.map((b) => (
        <div key={b.grade} className="absolute inset-x-0 flex items-center gap-3" style={{ top: b.y }}>
          <span className="font-display text-[15px] text-muted">Grade {b.grade}</span>
          <span className="rule flex-1" />
        </div>
      ))}

      <svg className="absolute inset-0 overflow-visible" width={W} height={height} aria-hidden>
        {edges.map((e) => {
          const a = pos[e.from];
          const b = pos[e.to];
          if (!a || !b) return null;
          const hot = onTrail(e.from, e.to);
          return (
            <g key={`${e.from}-${e.to}`}>
              <path d={curve(a, b)} fill="none" stroke="var(--color-ink)" strokeOpacity={hot ? 0 : 0.16} strokeWidth={1.4} />
              {hot && (
                <motion.path d={curve(a, b)} fill="none" stroke="var(--color-gap)" strokeWidth={2.6} strokeLinecap="round"
                  initial={{ pathLength: instant ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: instant ? 0 : 0.55, ease: "easeInOut" }} />
              )}
            </g>
          );
        })}
      </svg>

      {pts.map((p) => {
        const st = statuses[p.id] ?? "unknown";
        const isRoot = done && p.id === root;
        const isLit = litIds.includes(p.id);
        const tone =
          isRoot || st === "gap"
            ? "bg-gap text-white border-gap"
            : st === "mastered"
              ? "bg-ok text-white border-ok"
              : isLit
                ? "bg-gap-soft text-gap-dark border-gap"
                : "bg-card text-ink border-ink/25";
        const node = (
          <span className={`flex h-12 w-12 items-center justify-center rounded-full border-[1.5px] font-display text-[15px] transition-colors duration-500 ${tone}`}
            style={{ boxShadow: "0 6px 14px -8px rgb(30 43 39 / .45)" }}>
            {GLYPH[p.id]}
          </span>
        );
        return (
          <button
            key={p.id}
            className="absolute flex w-[92px] -translate-x-1/2 -translate-y-6 flex-col items-center"
            style={{ left: p.x, top: p.y }}
            onClick={() => onSelect?.(p.id)}
            aria-label={`${skillTitle(p.id, lang)}, grade ${skillById[p.id].grade}, ${isRoot ? "root gap" : st}`}
            data-testid={`node-${p.id}`}
          >
            <motion.span initial={false} animate={isRoot ? { scale: [1, 1.12, 1] } : { scale: 1 }} transition={{ duration: 0.6 }} className={isRoot ? "bob" : ""}>
              {isRoot ? <InkCircle>{node}</InkCircle> : node}
            </motion.span>
            <span className={`mt-1.5 line-clamp-3 text-center text-[11.5px] leading-[1.2] ${isRoot || isLit ? "font-bold text-ink" : "text-muted"}`}>
              {skillTitle(p.id, lang)}
            </span>
            {only && (
              <span className="mt-0.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted">Grade {skillById[p.id].grade}</span>
            )}
            {isRoot && <span className="mt-1 font-display text-[14px] italic text-gap-dark">{lang === "fil" ? "ang ugat" : "the root"}</span>}
          </button>
        );
      })}
    </div>
  );
}
