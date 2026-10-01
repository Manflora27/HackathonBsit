import data from "./competencies.json" with { type: "json" };

/**
 * MATATAG learning competencies (Math G1-10, Science G3-10), each attached to the plan unit that teaches it.
 * Text is DepEd's (Aug 2023 guides); ids like MAT-G7-Q1-007 are ours, since DepEd publishes no MATATAG codes.
 * Built by scripts/extract-matatag-competencies.py + scripts/map-competencies.ts. Senior High isn't mapped yet.
 */
export interface Competency { id: string; unit: string; text: string }

const byUnit = new Map<string, Competency[]>();
for (const c of data.competencies as Competency[]) byUnit.set(c.unit, [...(byUnit.get(c.unit) ?? []), c]);

/** What a unit's learner should be able to do by the end of it, in the guide's order. Empty if not mapped. */
export function competenciesFor(unitId: string): Competency[] {
  return byUnit.get(unitId) ?? [];
}

export const COMPETENCY_SOURCE = data.source;
