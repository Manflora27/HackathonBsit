import { engine } from "./client";

/**
 * Does a typed question's answer key hold? The engine solves `given` and compares it with `expected`.
 * A right answer under the wrong form label (e.g. "solved" on a plain number) is kept, graded without the form rule.
 * Returns the form to grade with, or null when the key is wrong or can't be read.
 */
export async function keyHolds(q: { given: string; expected: string; form: "any" | "expanded" | "factored" | "solved" }): Promise<typeof q.form | null> {
  try {
    const r = await engine.check(q.given, q.expected, q.form);
    if (r.correct) return q.form;
    if (/^not_(solved|expanded|factored)$/.test(r.reason ?? "") && (await engine.check(q.given, q.expected, "any")).correct) return "any";
  } catch { /* unparseable */ }
  return null;
}
