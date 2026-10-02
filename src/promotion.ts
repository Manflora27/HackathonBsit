import { useEffect } from "react";
import { MOCK_AUTH, useAuth } from "./auth";
import { promoteSubjects, schoolYear } from "./data/curriculum";
import { useStore } from "./store";

/**
 * A new school year moves students up a grade on their first visit, whatever their results: the grade is the
 * knowledge they're aiming at, not a status they pass into. Mastered units stay mastered, and anything still
 * missing from earlier grades stays on their timeline. Self-learners move up only if they switched it on.
 */
export function useSchoolYearRollover() {
  const { ready, profile, updateProfile } = useAuth();
  useEffect(() => {
    const now = schoolYear();
    const s = useStore.getState();
    // This device's onboarding (guests, and the fallback when signed in).
    const o = s.onboarding;
    if (o.done && o.gradeYear !== now) {
      const years = o.gradeYear === undefined ? 0 : now - o.gradeYear; // older builds: start counting from now
      if (years > 0 && o.grade !== null) {
        const grade = Math.min(12, o.grade + years);
        s.set({ onboarding: { ...o, grade, subjects: promoteSubjects(o.subjects, grade), gradeYear: now }, movedUp: s.movedUp || grade > o.grade });
      } else if (years > 0 && s.selfAdvance) {
        s.set({ onboarding: { ...o, gradeYear: now }, selfYears: s.selfYears + years, movedUp: true });
      } else {
        s.set({ onboarding: { ...o, gradeYear: now } });
      }
    }

    // The signed-in profile. The server keeps the year too, so a second device doesn't promote again.
    // Skipped until migration 0009 adds grade_year (select * leaves it out), or every visit would promote.
    if (!ready || !profile?.current_grade || !profile.onboarded_at || !(MOCK_AUTH || "grade_year" in profile)) return;
    const since = profile.grade_year ?? schoolYear(new Date(profile.onboarded_at));
    if (since >= now) return;
    const grade = Math.min(12, profile.current_grade + now - since);
    void updateProfile({ current_grade: grade, subjects: promoteSubjects(profile.subjects, grade), grade_year: now }).then((ok) => {
      if (ok && grade > profile.current_grade!) useStore.getState().set({ movedUp: true });
    });
  }, [ready, profile, updateProfile]);
}
