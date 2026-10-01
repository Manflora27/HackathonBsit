/**
 * The prerequisite graph: one, shared by every learner, shipped with the app (src/data/prereqs.json,
 * made and reviewed by scripts/build-prereqs.ts). Each unit lists the units it directly needs; links only
 * point to earlier units in the global order (curriculum.unitOrder), so the graph has no cycles and the
 * global order is already a valid learning order.
 *
 * Per learner there is only progress. A learner's path is computed on the device from the graph and that progress.
 */
import prereqs from "./prereqs.json";
import { allUnits, buildPlan, foundationOf, startGrade, unitById, unitOrder, type PlanUnit, type SubjectId } from "./curriculum";

const EDGES = (prereqs as { edges: Record<string, string[]> }).edges;

/** True once the reviewed graph is in. Until then paths fall back to the plain grade-by-grade sequence. */
export const hasGraph = Object.keys(EDGES).length > 0;

/** Units this one directly needs. */
export function needs(id: string): string[] {
  return EDGES[id] ?? [];
}

/** Everything a set of units rests on, transitively (not including the units themselves). */
export function ancestors(ids: string[]): Set<string> {
  const out = new Set<string>();
  const stack = [...ids];
  while (stack.length) for (const p of needs(stack.pop()!)) if (!out.has(p)) (out.add(p), stack.push(p));
  return out;
}

/**
 * A learner's path in one subject: their grade's units, plus `include` (the gap the starting-point check
 * found), and everything those rest on from `fromGrade` up, in an order where every unit comes after what
 * it needs. Mastered units stay on it (shown as done, not hidden).
 * Without the graph: every unit of the grade-by-grade subject from `fromGrade` up, as before.
 */
export function pathFor(subject: SubjectId, grade: number | null, fromGrade: number, include: string[] = []): PlanUnit[] {
  const top = startGrade(subject, grade);
  const targets = buildPlan(subject, top);
  const { base, lowest } = foundationOf(subject);
  const from = Math.max(lowest, Math.min(top, fromGrade));
  let units: PlanUnit[];
  if (!hasGraph) {
    units = [];
    for (let g = from; g < top; g++) units.push(...buildPlan(base, g));
    units.push(...targets);
  } else {
    // Only what the grade's units actually need, across subjects (Physics can need Grade 8 algebra).
    const need = ancestors([...targets.map((u) => u.id), ...include]);
    for (const id of include) need.add(id);
    units = [...targets, ...[...need].map(unitById).filter((u): u is PlanUnit => !!u && u.grade >= from && u.grade < top)];
  }
  // The global order respects every link, so sorting by it is a valid learning order.
  return [...new Map(units.map((u) => [u.id, u])).values()].sort((a, b) => unitOrder(a.id) - unitOrder(b.id));
}

/** For checks and the review report: the whole graph as [unit, prerequisite] pairs. */
export function allEdges(): [string, string][] {
  return allUnits().flatMap((u) => needs(u.id).map((p) => [u.id, p] as [string, string]));
}
