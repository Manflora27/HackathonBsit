/**
 * Lesson text writes math as $inline$ and $$display$$. Models sometimes use the other LaTeX
 * delimiters, \(inline\) and \[display\], which RichText would print raw ("\(110^\circ\)").
 * normalizeMath rewrites those to the $ forms; text already in $ form is left exactly as it is.
 * Pure: the browser (RichText, read aloud, checks) and the server (api/lesson.ts) both run it.
 */

/** $$...$$ or $...$ spans, as RichText splits them. Delimiters inside these stay untouched. */
const DOLLAR_SPAN = /(\$\$[^$]+\$\$|\$[^$]+\$)/g;

/** \[...\] and \(...\), not when the backslash is itself escaped (\\[2pt] is a LaTeX line break). */
const BRACKET_SPAN = /(?<!\\)\\\[([\s\S]+?)(?<!\\)\\\]|(?<!\\)\\\(([\s\S]+?)(?<!\\)\\\)/g;

export function normalizeMath(text: string): string {
  if (!text || !/\\[[(]/.test(text)) return text;
  return text
    .split(DOLLAR_SPAN)
    .map((p, i) =>
      i % 2 === 1
        ? p
        : p.replace(BRACKET_SPAN, (whole, display: string | undefined, inline: string | undefined) => {
            const tex = (display ?? inline ?? "").trim();
            if (!tex || tex.includes("$")) return whole;
            return display !== undefined ? `$$${tex}$$` : `$${tex}$`;
          }),
    )
    .join("");
}

/** One LaTeX expression for <Math>: drops a wrapping $$ $$, $ $, \[ \] or \( \) if the model left one on. */
export function stripMathDelimiters(tex: string): string {
  const s = tex.trim();
  for (const [open, close] of [["$$", "$$"], ["$", "$"], ["\\[", "\\]"], ["\\(", "\\)"]]) {
    if (s.length <= open.length + close.length || !s.startsWith(open) || !s.endsWith(close)) continue;
    const inner = s.slice(open.length, -close.length);
    // "\(a\) + \(b\)" is two spans, not one wrapped expression: leave it as it is.
    return inner.includes(close) || inner.includes("$") ? tex : inner.trim();
  }
  return tex;
}

/** Every string in a lesson-shaped value, normalized. Keys and non-string values are kept as they are. */
export function normalizeMathDeep<T>(value: T): T {
  if (typeof value === "string") return normalizeMath(value) as T;
  if (Array.isArray(value)) return value.map(normalizeMathDeep) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalizeMathDeep(v)])) as T;
  }
  return value;
}
