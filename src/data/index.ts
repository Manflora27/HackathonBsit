import skillsJson from "./skills.json";
import misconceptionsJson from "./misconceptions.json";
import lessonsJson from "./lessons.json";
import problemsJson from "./problems.json";
import type { Lang, Lesson, LessonText, Misconception, Problem, Skill } from "../types";
import { translateMaybe } from "../locales";

export const skills = skillsJson.skills as Skill[];
export const skillById = Object.fromEntries(skills.map((s) => [s.id, s])) as Record<string, Skill>;

export const misconceptions = misconceptionsJson.misconceptions as Misconception[];
export const misconceptionById = Object.fromEntries(misconceptions.map((m) => [m.id, m])) as Record<
  string,
  Misconception
>;

export const lessons = lessonsJson.lessons as unknown as Record<string, Lesson>;

export const problems = problemsJson.problems as Problem[];
export const problemById = Object.fromEntries(problems.map((p) => [p.id, p])) as Record<string, Problem>;
export const demoAssignment = problemsJson.assignment;

// English is in the data; translations are in the catalogs under skills.* and misconceptions.*.
export function skillTitle(id: string, lang: Lang) {
  return translateMaybe(lang, `skills.${id}`) ?? skillById[id].title;
}

export function misconceptionText(id: string, lang: Lang) {
  const m = misconceptionById[id];
  return {
    title: translateMaybe(lang, `misconceptions.${id}.title`) ?? m.title,
    what: translateMaybe(lang, `misconceptions.${id}.what`) ?? m.what,
  };
}

/** A lesson's text in the learner's language, falling back to English. */
export function lessonText(lesson: Lesson, lang: Lang): LessonText {
  return (lang === "tl" ? lesson.fil : lang === "ceb" ? lesson.ceb : undefined) ?? lesson.en;
}
