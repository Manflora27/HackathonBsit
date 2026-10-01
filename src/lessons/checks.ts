/**
 * Exact checks on a generated lesson, beyond its answer keys. Pure functions: the browser gate,
 * the server (api/lesson.ts, api/publish.ts) and the audit script (scripts/audit-lessons.ts) all run them.
 *
 *  - numericClaims / wrongClaims: every arithmetic chain written in the explanation ("2(3)+5 = 11").
 *    Only number-only sides are checked (anything with letters is a definition), and they're plain numbers,
 *    so they're evaluated right here, identically in the browser, the server and the audit.
 *  - checkFigure: labelled points on a graph must lie on one of its functions.
 */
import { compile, tryCompile } from "../lib/expr";
import type { Figure, Lesson, LessonText } from "../types";

/** A side of an equation, from LaTeX to the engine's typed notation. Null if it isn't plain arithmetic. */
export function numericSide(tex: string): string | null {
  let s = tex.trim();
  if (!s || /\\text|\\mathrm|\\%|%|\\ldots|\\dots|°/.test(s)) return null;
  s = s
    .replace(/\\left|\\right|\\,|\\;|\\!|\\ /g, "")
    .replace(/−/g, "-")
    .replace(/\\(?:cdot|times)/g, "*")
    .replace(/\\div/g, "/")
    .replace(/(\d),(?=\d{3}\b)/g, "$1"); // 1,000 -> 1000
  // Mixed numbers: 2\frac{1}{2} is two and a half, not two times a half.
  s = s.replace(/(\d+)\s*\\d?frac\{(\d+)\}\{(\d+)\}/g, "($1+($2)/($3))");
  // \frac{a}{b} (innermost first, so nesting works)
  for (let n = 0; n < 8 && /\\d?frac/.test(s); n++) s = s.replace(/\\d?frac\{([^{}]*)\}\{([^{}]*)\}/g, "(($1)/($2))");
  s = s.replace(/\\sqrt\{([^{}]*)\}/g, "sqrt($1)").replace(/\^\{([^{}]*)\}/g, "^($1)").replace(/\\pi/g, "pi").replace(/[{}]/g, "");
  if (/\\/.test(s)) return null; // any other command: not plain arithmetic
  const bare = s.replace(/sqrt|pi/g, "");
  if (/[a-zA-Z,]/.test(bare) || !/\d/.test(bare)) return null;
  return s.replace(/\s+/g, "");
}

/** Every checkable "a = b" in one stretch of lesson text: consecutive number-only sides of each $...$ chain. */
export function claimsIn(text: string): [string, string][] {
  const out: [string, string][] = [];
  for (const m of text.matchAll(/\$\$([^$]+)\$\$|\$([^$]+)\$/g)) {
    const tex = m[1] ?? m[2];
    if (/\\neq|\\ne\b|\\le|\\ge|\\approx|\\sim|<|>|\\pm|\\mp/.test(tex)) continue;
    const sides = tex.split("=").map(numericSide);
    for (let i = 0; i + 1 < sides.length; i++) if (sides[i] && sides[i + 1]) out.push([sides[i]!, sides[i + 1]!]);
  }
  return out;
}

/**
 * The claims a lesson makes in every language: hook, body and the concept check's explanation.
 * The common-mistake paragraph is left out on purpose: it shows a wrong line.
 */
export function numericClaims(lesson: Pick<Lesson, "en" | "fil" | "ceb">): [string, string][] {
  const texts = (t: LessonText | undefined) => (t ? [t.hook ?? "", ...t.body, t.check?.why ?? ""] : []);
  const all = [lesson.en, lesson.fil, lesson.ceb].flatMap(texts).flatMap(claimsIn);
  const seen = new Set<string>();
  return all.filter(([a, b]) => !seen.has(`${a}=${b}`) && seen.add(`${a}=${b}`));
}

/** The value of a number-only side, or null if it can't be read. */
function value(side: string): number | null {
  try {
    const v = compile(side)(0);
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

/**
 * Does "a = b" hold? A side written as a plain decimal counts as rounded to the places shown,
 * so 1/3 = 0.33 holds, and 1/3 = 0.34 doesn't. Null when a side can't be read: not evidence either way.
 */
export function claimHolds(a: string, b: string): boolean | null {
  const x = value(a), y = value(b);
  if (x === null || y === null) return null;
  const places = Math.max(...[a, b].map((s) => (/^-?\d+\.(\d+)$/.exec(s)?.[1].length ?? 0)));
  const tol = places ? 0.5 * 10 ** -places + 1e-12 : 1e-9 * Math.max(1, Math.abs(x), Math.abs(y));
  return Math.abs(x - y) <= tol;
}

/** The claims in a lesson's text that are provably wrong. */
export function wrongClaims(lesson: Pick<Lesson, "en" | "fil" | "ceb">): [string, string][] {
  return numericClaims(lesson).filter(([a, b]) => claimHolds(a, b) === false);
}

/**
 * A graph with only the points that are on it. Unlabelled-but-wrong points mislead as much as wrong labels,
 * so a point on none of the functions is dropped; a graph whose functions don't parse is dropped whole.
 */
export function checkFigure(fig: Figure | undefined): { figure: Figure | undefined; dropped: string[] } {
  if (!fig || fig.kind !== "plot") return { figure: fig, dropped: [] };
  const fns = fig.functions.map(tryCompile).filter((f): f is NonNullable<typeof f> => !!f);
  if (!fns.length) return { figure: undefined, dropped: ["plot: no function parses"] };
  const tol = Math.max(1e-6, (fig.yMax - fig.yMin) * 0.01);
  const dropped: string[] = [];
  const points = fig.points.filter((p) => {
    const on = fns.some((f) => Math.abs(f(p.x) - p.y) <= tol);
    if (!on) dropped.push(`point (${p.x}, ${p.y}) ${p.label} is on no plotted function`);
    return on;
  });
  return { figure: { ...fig, points }, dropped };
}
