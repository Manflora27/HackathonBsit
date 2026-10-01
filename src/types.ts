export type Lang = "en" | "fil";
export type Form = "any" | "expanded" | "factored" | "solved" | "units" | "chemistry";
export type SkillStatus = "unknown" | "gap" | "mastered";

export interface Probe {
  prompt: string;
  given: string;
  expected: string;
  form: Form;
}

export interface Skill {
  id: string;
  grade: number;
  x: number;
  y: number;
  matatag: string | null;
  title: string;
  titleFil: string;
  prereqs: string[];
  probes: Probe[];
}

export interface Misconception {
  id: string;
  skill: string;
  title: string;
  titleFil: string;
  what: string;
  whatFil: string;
}

export interface Problem {
  id: string;
  prompt: string;
  given: string;
  kind: "solve" | "simplify";
  skill: string;
}

export interface LessonText {
  body: string[];
  spoken: string;
}

export interface Lesson {
  visual?: "area-model";
  en: LessonText;
  fil: LessonText;
  practice: { prompt: string; given: string; form: Form }[];
}

/** Output of engine/gapfinder.py analyze(). */
export interface Analysis {
  problemLatex: string | null;
  steps: { input: string; latex: string | null; status: "ok" | "error" | "unverifiable" | "unparsed" | "skipped" }[];
  errorIndex: number | null;
  misconception: { id: string; confidence: number; source: "rule" | "ai" } | null;
  wrongTerms: { missing: string[]; extra: string[] } | null;
  expectedLatex: string | null;
  studentLatex: string | null;
  previousLatex?: string;
  complete: boolean;
  error?: string;
}

export interface CheckResult {
  correct: boolean;
  reason?: string;
  latex?: string;
}

export interface Attempt {
  id: string;
  problemId: string;
  steps: string[];
  analysis: Analysis;
  assignmentId: string | null;
  visibility: "private" | "class";
  rootSkill: string | null;
  createdAt: number;
  teacherOverride?: { misconceptionId: string | null; note: string };
}

export interface Student {
  id: string;
  name: string;
  anonId: string;
  skills: Record<string, SkillStatus>;
  lastMisconception?: string;
  rootGap?: string; // root gap found by this assessment
  live?: boolean;
}
