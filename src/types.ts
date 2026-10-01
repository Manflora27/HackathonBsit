/** UI and content language. Catalogs live in src/locales. */
export type Lang = "en" | "tl" | "ceb";
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
  prereqs: string[];
  probes: Probe[];
}

export interface Misconception {
  id: string;
  skill: string;
  title: string;
  what: string;
}

export interface Problem {
  id: string;
  prompt: string;
  given: string;
  kind: "solve" | "simplify";
  skill: string;
}

/**
 * A lesson's words, ordered the way people learn: a concrete hook, the idea built up from real numbers
 * to the rule (body), then the mistake most learners make. Older lessons only have body + spoken.
 */
export interface LessonText {
  hook?: string;
  body: string[];
  pitfall?: string;
  /** One concept question before practice: the right choice is Lesson.checkAnswer, `why` explains it. */
  check?: { question: string; choices: string[]; why: string };
  spoken: string;
}

/** A worked example, revealed one step at a time. Math is LaTeX; each step's reason is in every language. */
export interface WorkedExample {
  problem: string;
  /** Typed forms, for the engine to check each step follows from the last. */
  problemTyped?: string;
  kind?: "solve" | "simplify";
  steps: { math: string; typed?: string; why: { en: string; fil: string; ceb?: string } }[];
}

/** A graph of one or more functions of x, optionally with labelled points. Expressions use x, + - * / ^, sqrt, sin, cos, abs, pi. */
export interface PlotFigure {
  kind: "plot";
  functions: string[];
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  points: { x: number; y: number; label: string }[];
}

/** A number line with marked values (open = not included) and shaded ranges, e.g. for inequalities. */
export interface NumberLineFigure {
  kind: "numberline";
  min: number;
  max: number;
  marks: { x: number; label: string; open: boolean }[];
  shade: { from: number; to: number }[];
}

export type Figure = PlotFigure | NumberLineFigure;

export interface Lesson {
  visual?: "area-model";
  /** Sides of the area-model square: (a + b)². b is a number, e.g. x + 3, or a letter, e.g. a + b. */
  visualArgs?: { a: string; b: number | string };
  en: LessonText;
  /** Tagalog. Stored as "fil" because cached and shared lessons already use that key. */
  fil: LessonText;
  /** Bisaya. Older cached lessons lack it and show English. */
  ceb?: LessonText;
  /** `ai` items are ones the engine can't express (e.g. points, circles from words): graded against the AI's `expected`. */
  practice: { prompt: string; given: string; form: Form; expected?: string; ai?: boolean }[];
  example?: WorkedExample;
  figure?: Figure;
  /** Index of the right choice in every language's `check`. */
  checkAnswer?: number;
  /** 2 = worked example / figure fields; 3 = hook, pitfall, concept check, and practice keys kept. Older cached lessons are regenerated when online. */
  format?: number;
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
