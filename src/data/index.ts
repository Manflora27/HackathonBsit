import skillsJson from "./skills.json";
import misconceptionsJson from "./misconceptions.json";
import lessonsJson from "./lessons.json";
import problemsJson from "./problems.json";
import type { Lang, Lesson, Misconception, Problem, Skill } from "../types";

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

export function skillTitle(id: string, lang: Lang) {
  const s = skillById[id];
  return lang === "fil" ? s.titleFil : s.title;
}

export function misconceptionText(id: string, lang: Lang) {
  const m = misconceptionById[id];
  return lang === "fil" ? { title: m.titleFil, what: m.whatFil } : { title: m.title, what: m.what };
}
