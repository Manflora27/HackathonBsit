import { useAuth } from "./auth";
import { startGrade, subjectsFor, unitById, type PlanUnit, type SubjectId } from "./data/curriculum";
import { pathFor } from "./data/graph";
import { skillById } from "./data";
import { useStore, type Placement } from "./store";

/** The learner's grade and subjects: the signed-in profile first, onboarding otherwise. */
export function usePlanContext(): { grade: number | null; subjects: SubjectId[] } {
  const { onboarding, demo } = useStore();
  const { profile } = useAuth();
  const signedIn = !demo && !!profile;
  const grade = signedIn && profile?.current_grade ? profile.current_grade : onboarding.grade;
  // Saved subjects from older builds (e.g. one combined "science" at Grade 11) are dropped if they no longer exist at that grade.
  const subjects = (signedIn && profile?.subjects.length ? profile.subjects : onboarding.subjects).filter((s) => subjectsFor(grade).includes(s));
  return { grade, subjects };
}

/** The grade a starting-point check placed the learner at, if below their own. */
function placedGrade(p: Placement | undefined): number | null {
  if (p?.unitId) return unitById(p.unitId)?.grade ?? null;
  if (p?.skillId) return skillById[p.skillId]?.grade ?? null;
  return null;
}

/**
 * One subject's roots as a single ordered line: from where the starting-point check placed the learner up to
 * their own grade, only the units their grade actually rests on (data/graph.ts), each after what it needs.
 * The graph is shared and shipped with the app; only the learner's progress is theirs.
 */
export function timeline(subject: SubjectId, grade: number | null, placement?: Placement): PlanUnit[] {
  const top = startGrade(subject, grade);
  return pathFor(subject, grade, placedGrade(placement) ?? top, placement?.unitId ? [placement.unitId] : []);
}

/**
 * Where the learner is now in one subject: the first unit from their starting point they haven't mastered.
 * Finishing a unit moves this forward, through the foundations and up into their own grade.
 * `behind` is true while that unit is still below their grade. Null until the starting-point check has run,
 * or once every unit up to their grade is mastered.
 */
export function currentUnit(subject: SubjectId, grade: number | null, placement: Placement | undefined, progress: Record<string, string>) {
  if (!placement) return null;
  const units = timeline(subject, grade, placement);
  const startAt = placement.unitId ? units.findIndex((u) => u.id === placement.unitId)
    : placement.skillId ? units.findIndex((u) => u.grade === skillById[placement.skillId!]?.grade) : 0;
  const start = Math.max(0, startAt);
  const index = units.findIndex((u, i) => i >= start && progress[u.id] !== "mastered");
  if (index < 0) return null;
  return { unit: units[index], index, start, units, behind: units[index].grade < startGrade(subject, grade) };
}
