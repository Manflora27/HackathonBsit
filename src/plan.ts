import { useAuth } from "./auth";
import { buildPlan, foundationOf, startGrade, subjectsFor, unitById, type PlanUnit, type SubjectId } from "./data/curriculum";
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
 * One subject's roots as a single ordered line: from where the starting-point check placed the learner
 * up to their own grade, by grade then quarter. Earlier grades come from the grade-by-grade subject
 * (math or science) the foundations live in. Pure curriculum, so it's the same for everyone and needs no network.
 */
export function timeline(subject: SubjectId, grade: number | null, placement?: Placement): PlanUnit[] {
  const top = startGrade(subject, grade);
  const { base, lowest } = foundationOf(subject);
  const from = Math.max(lowest, Math.min(top, placedGrade(placement) ?? top));
  const units: PlanUnit[] = [];
  for (let g = from; g <= top; g++) units.push(...(g === top ? buildPlan(subject, g) : buildPlan(base, g)));
  return units.sort((a, b) => a.grade - b.grade || a.quarter - b.quarter);
}
