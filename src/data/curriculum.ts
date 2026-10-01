
import { MATATAG_MATH, MATATAG_SCIENCE, type MatatagCode } from "./matatag.js";

/**
 * Subjects as DepEd offers them. Grades 1-2: Mathematics. Grades 3-10: Mathematics and an integrated Science.
 * Senior High (Strengthened SHS): core General Mathematics and General Science in Grade 11, then course electives
 * (Pre-Calculus, Basic Calculus, Finite and Advanced Mathematics, Physics, Chemistry, Biology, Earth and Space Science).
 * Source notes: docs/research/deped-curriculum-sources.md
 */
export type SubjectId =
  | "math" | "science"
  | "general-math" | "general-science"
  | "finite-math" | "pre-calculus" | "advanced-math" | "basic-calculus"
  | "physics" | "chemistry" | "biology" | "earth-space";
export type VerifierId = "sympy" | "arithmetic" | "statistics" | "geometry" | "units" | "chemistry" | "llm";
export type Goal = "catch_up" | "keep_up" | "exam_prep" | "explore";

export const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/**
 * English names here are canonical (the API prompts use them). Translations live in src/locales under
 * curriculum.subjects / groups / goals / domains / verifiers, keyed by id; a missing one shows the English.
 */
interface SubjectInfo { en: string; blurb: string }
const S = (en: string, blurb: string): SubjectInfo => ({ en, blurb });

export const subjectMeta: Record<SubjectId, SubjectInfo> = {
  math: S("Mathematics", "Number sense, measurement, geometry, algebra, statistics"),
  science: S("Science", "Matter, living things, force and energy, earth and space"),
  "general-math": S("General Mathematics", "Functions, business math, logic"),
  "general-science": S("General Science", "Matter, energy, living systems, earth systems"),
  "finite-math": S("Finite Mathematics", "Counting, probability, matrices, graphs"),
  "pre-calculus": S("Pre-Calculus", "Conics, trigonometry, series, vectors"),
  "advanced-math": S("Advanced Mathematics", "Functions, series, complex numbers, analytic geometry"),
  "basic-calculus": S("Basic Calculus", "Limits, derivatives, integrals"),
  physics: S("Physics", "Motion, energy, waves, electricity"),
  chemistry: S("Chemistry", "Matter, atoms, reactions, solutions"),
  biology: S("Biology", "Cells, genetics, evolution, body systems"),
  "earth-space": S("Earth and Space Science", "Earth's systems, climate, stars, hazards"),
};

export interface SubjectGroup { id: "subjects" | "core" | "math" | "science"; en: string; subjects: SubjectId[] }

/** The subjects offered at a grade, grouped the way a Senior High student meets them. Grades 1-10 are a single group. */
export function subjectGroupsForGrade(grade: number): SubjectGroup[] {
  if (grade >= 11) {
    const groups: SubjectGroup[] = [];
    if (grade === 11) groups.push({ id: "core", en: "Core subjects", subjects: ["general-math", "general-science"] });
    groups.push(
      { id: "math", en: "Math electives", subjects: ["pre-calculus", "basic-calculus", "finite-math", "advanced-math"] },
      { id: "science", en: "Science electives", subjects: ["physics", "chemistry", "biology", "earth-space"] },
    );
    return groups;
  }
  return [{ id: "subjects", en: "Subjects", subjects: grade >= 3 ? ["math", "science"] : ["math"] }];
}

export function subjectsForGrade(grade: number): SubjectId[] {
  return subjectGroupsForGrade(grade).flatMap((g) => g.subjects);
}

/** What a grade requires rather than offers as electives: the integrated subjects (Grades 1-10) and the Grade 11 core. Grade 12 is all electives. */
export function requiredSubjectsForGrade(grade: number): SubjectId[] {
  return subjectGroupsForGrade(grade).filter((g) => g.id === "subjects" || g.id === "core").flatMap((g) => g.subjects);
}

/**
 * Self-learners (not in school) have no grade: they see every subject, and each plan starts at a default level
 * (Grade 7 for the integrated subjects, the course itself for Senior High). Hopper's checks then find their real level.
 */
export function subjectGroupsFor(grade: number | null): SubjectGroup[] {
  if (grade !== null) return subjectGroupsForGrade(grade);
  return [
    { id: "subjects", en: "Subjects", subjects: ["math", "science"] },
    ...subjectGroupsForGrade(12),
  ];
}

export function subjectsFor(grade: number | null): SubjectId[] {
  return subjectGroupsFor(grade).flatMap((g) => g.subjects);
}

/**
 * The school year a date falls in, by the year it opened. Classes open in June, so May 2027 is still SY 2026-27.
 * Learners move up when a new one opens: the grade is what they're learning toward, never a pass/fail status.
 */
export function schoolYear(d = new Date()): number {
  return d.getMonth() >= 5 ? d.getFullYear() : d.getFullYear() - 1;
}

/** Subjects after moving up to `grade`: keep what it still offers, add what it requires (Grade 10 Science gives way to the Grade 11 core). */
export function promoteSubjects(subjects: SubjectId[], grade: number): SubjectId[] {
  const offered = subjectsForGrade(grade);
  return [...new Set([...subjects.filter((s) => offered.includes(s)), ...requiredSubjectsForGrade(grade)])];
}

/** School years a self-learner has chosen to move up since starting (opt-in; kept in sync by store.ts). */
let selfYears = 0;
export function setSelfYears(n: number) {
  selfYears = n;
}

/** The grade a subject's plan is built at: the learner's own, or the self-learner default plus any years moved up. */
export function startGrade(subject: SubjectId, grade: number | null): number {
  if (grade !== null) return grade;
  return subject === "math" || subject === "science" ? Math.min(10, 7 + selfYears) : Math.min(12, 11 + selfYears);
}

export const goalMeta: Record<Goal, { en: string }> = {
  catch_up: { en: "Catch up on what I missed" },
  keep_up: { en: "Keep up in class" },
  exam_prep: { en: "Prepare for an exam" },
  explore: { en: "Just learning" },
};

/** A coarse domain of a subject at some grade. Wording is ours; structure follows grade, quarter, domain. */
interface Domain {
  id: string;
  /** catalog key under curriculum.domains, e.g. "math.algebra" */
  key: string;
  en: string;
  verifier: VerifierId;
}

const D = (owner: string, id: string, en: string, verifier: VerifierId): Domain => ({ id, key: `${owner}.${id}`, en, verifier });

// Math strands as in the K-12 curriculum.
const MATH_DOMAINS = {
  number: D("math", "number", "Number sense", "arithmetic"),
  measure: D("math", "measure", "Measurement", "arithmetic"),
  geometry: D("math", "geometry", "Geometry", "geometry"),
  patterns: D("math", "patterns", "Patterns and algebra", "sympy"),
  algebra: D("math", "algebra", "Algebra", "sympy"),
  functions: D("math", "functions", "Functions and graphs", "sympy"),
  data: D("math", "data", "Statistics and probability", "statistics"),
  trig: D("math", "trig", "Trigonometry", "sympy"),
  calculus: D("math", "calculus", "Limits and calculus", "sympy"),
};

function mathDomains(g: number): Domain[] {
  const M = MATH_DOMAINS;
  if (g <= 6) return [M.number, M.measure, M.geometry, M.patterns, M.data];
  if (g <= 8) return [M.number, M.measure, M.geometry, M.patterns, M.data];
  return [M.patterns, M.geometry, M.trig, M.data];
}

// Integrated Science (Grades 3-10): Matter; Living Things and Their Environment; Force, Motion and Energy; Earth and Space.
function scienceDomains(g: number): Domain[] {
  return [
    D("science", "matter", "Matter", g >= 8 ? "chemistry" : "llm"),
    D("science", "living", "Living things and their environment", "llm"),
    D("science", "force", "Force, motion and energy", "units"),
    D("science", "earth", "Earth and space", "llm"),
  ];
}

// Senior High courses, each with its own plan. Domains are ours (coarse); a course's guide has the real competencies.
const SHS_DOMAINS: Partial<Record<SubjectId, Domain[]>> = {
  "general-math": [
    D("general-math", "functions", "Functions and their graphs", "sympy"),
    D("general-math", "exp-log", "Rational, exponential and logarithmic functions", "sympy"),
    D("general-math", "business", "Business math: interest and annuities", "arithmetic"),
    D("general-math", "logic", "Logic and reasoning", "llm"),
  ],
  "general-science": [
    D("general-science", "nature", "Nature of science and measurement", "llm"),
    D("general-science", "matter-energy", "Matter and energy", "units"),
    D("general-science", "living", "Living systems", "llm"),
    D("general-science", "earth", "Earth systems", "llm"),
  ],
  "finite-math": [
    D("finite-math", "counting", "Sets and counting", "statistics"),
    D("finite-math", "probability", "Probability", "statistics"),
    D("finite-math", "matrices", "Matrices and linear systems", "sympy"),
    D("finite-math", "graphs", "Graphs and networks", "llm"),
  ],
  "pre-calculus": [
    D("pre-calculus", "conics", "Conic sections", "sympy"),
    D("pre-calculus", "trig", "Trigonometric functions and identities", "sympy"),
    D("pre-calculus", "series", "Sequences, series and induction", "sympy"),
    D("pre-calculus", "vectors", "Polar coordinates and vectors", "sympy"),
  ],
  "advanced-math": [
    D("advanced-math", "functions", "Algebraic and transcendental functions", "sympy"),
    D("advanced-math", "series", "Sequences and series", "sympy"),
    D("advanced-math", "complex", "Complex numbers", "sympy"),
    D("advanced-math", "analytic", "Analytic geometry", "sympy"),
  ],
  "basic-calculus": [
    D("basic-calculus", "limits", "Limits and continuity", "sympy"),
    D("basic-calculus", "derivatives", "Derivatives", "sympy"),
    D("basic-calculus", "applications", "Applications of derivatives", "sympy"),
    D("basic-calculus", "integrals", "Integrals", "sympy"),
  ],
  physics: [
    D("physics", "motion", "Motion and forces", "units"),
    D("physics", "energy", "Work, energy and power", "units"),
    D("physics", "waves", "Waves and optics", "units"),
    D("physics", "electricity", "Electricity and magnetism", "units"),
  ],
  chemistry: [
    D("chemistry", "matter", "Matter and measurement", "llm"),
    D("chemistry", "atoms", "Atoms and the periodic table", "llm"),
    D("chemistry", "reactions", "Chemical reactions and stoichiometry", "chemistry"),
    D("chemistry", "solutions", "Solutions, acids and bases", "llm"),
  ],
  biology: [
    D("biology", "cells", "Cells", "llm"),
    D("biology", "genetics", "Heredity and genetics", "llm"),
    D("biology", "evolution", "Evolution and ecology", "llm"),
    D("biology", "body", "Body systems", "llm"),
  ],
  "earth-space": [
    D("earth-space", "earth", "Earth's structure and processes", "llm"),
    D("earth-space", "climate", "Atmosphere and climate", "llm"),
    D("earth-space", "space", "Stars and the solar system", "llm"),
    D("earth-space", "hazards", "Resources and hazards", "llm"),
  ],
};

function domainsFor(subject: SubjectId, grade: number): Domain[] {
  if (subject === "math") return mathDomains(grade);
  if (subject === "science") return scienceDomains(grade);
  return SHS_DOMAINS[subject] ?? [];
}

export interface PlanUnit {
  id: string;
  subject: SubjectId;
  grade: number;
  quarter: 1 | 2 | 3 | 4;
  domain: string;
  /** English title; titleKey finds its translation under curriculum.domains */
  title: string;
  titleKey: string;
  verifier: VerifierId;
  /** Lessons are generated and cached on demand. "outline" means none exists yet. */
  status: "outline";
}

/** The plan unit for a MATATAG Math domain or Science theme, with the topics the guide lists. */
const MATATAG_VERIFIER: Record<MatatagCode, VerifierId> = { NA: "sympy", MG: "geometry", DP: "statistics" };

/** Science quarters are themed; the theme picks the unit's strand and verifier. */
function scienceTheme(theme: string, grade: number): { id: string; verifier: VerifierId } {
  const t = theme.toLowerCase();
  if (t.includes("material")) return { id: "matter", verifier: grade >= 8 ? "chemistry" : "llm" };
  if (t.includes("life") || t.includes("living")) return { id: "living", verifier: "llm" };
  if (t.includes("force")) return { id: "force", verifier: "units" };
  return { id: "earth", verifier: "llm" };
}

/** MATATAG Math (Grades 1-10): one unit per content domain per quarter, in the guide's own sequence. */
function matatagMathPlan(grade: number): PlanUnit[] {
  const quarters = MATATAG_MATH[grade] ?? {};
  const units: PlanUnit[] = [];
  for (const quarter of [1, 2, 3, 4] as const) {
    for (const d of quarters[quarter] ?? []) {
      const slug = d.code.toLowerCase();
      units.push(...perTopic(`math-g${grade}-q${quarter}-${slug}`, d.topics, {
        subject: "math", grade, quarter, domain: slug, verifier: MATATAG_VERIFIER[d.code],
      }));
    }
  }
  return units;
}

/**
 * One unit per topic the guide lists, so every topic gets its own place on the path and its own lesson.
 * The first topic keeps the domain's id (saved progress, placements and cached lessons still point at it);
 * the rest are numbered after it.
 */
function perTopic(base: string, topics: string[], at: Omit<PlanUnit, "id" | "title" | "titleKey" | "status">): PlanUnit[] {
  return topics.map((topic, i) => {
    const id = i ? `${base}-${i + 1}` : base;
    return { ...at, id, title: topic.charAt(0).toUpperCase() + topic.slice(1), titleKey: `matatag.${id}`, status: "outline" };
  });
}

/** MATATAG Science (Grades 3-10): each quarter's theme, one unit per topic. */
function matatagSciencePlan(grade: number): PlanUnit[] {
  const quarters = MATATAG_SCIENCE[grade] ?? {};
  const units: PlanUnit[] = [];
  for (const quarter of [1, 2, 3, 4] as const) {
    const rec = quarters[quarter];
    if (!rec) continue;
    const theme = scienceTheme(rec.theme, grade);
    units.push(...perTopic(`science-g${grade}-q${quarter}-${theme.id}`, rec.topics, {
      subject: "science", grade, quarter, domain: theme.id, verifier: theme.verifier,
    }));
  }
  return units;
}

/** Senior High keeps its coarse course domains until the Strengthened SHS guides are mapped. */
function domainPlan(subject: SubjectId, grade: number): PlanUnit[] {
  const domains = domainsFor(subject, grade);
  const units: PlanUnit[] = [];
  const quarters = [1, 2, 3, 4] as const;
  domains.forEach((d, i) => {
    // Spread domains across the quarters; larger domain lists get two quarters.
    const qs = domains.length <= 3 ? quarters : [quarters[i % 4]];
    qs.forEach((quarter) =>
      units.push({
        id: `${subject}-g${grade}-q${quarter}-${d.id}`,
        subject, grade, quarter, domain: d.id,
        title: d.en,
        titleKey: d.key,
        verifier: d.verifier,
        status: "outline",
      }),
    );
  });
  return units.sort((a, b) => a.quarter - b.quarter);
}

/** The enrollment plan: the syllabus for the learner's stated class, following the DepEd guide per quarter. */
export function buildPlan(subject: SubjectId, grade: number): PlanUnit[] {
  if (subject === "math" && MATATAG_MATH[grade]) return matatagMathPlan(grade);
  if (subject === "science" && MATATAG_SCIENCE[grade]) return matatagSciencePlan(grade);
  return domainPlan(subject, grade);
}

/**
 * Every unit in the curriculum once, in one global order: grade, then quarter, then the guide's own order.
 * Prerequisite links (data/graph.ts) may only point backwards in this order, which keeps the graph acyclic.
 */
let all: PlanUnit[] | null = null;
export function allUnits(): PlanUnit[] {
  if (all) return all;
  const seen = new Map<string, PlanUnit>();
  for (let g = 1; g <= 12; g++) for (const s of subjectsForGrade(g)) for (const u of buildPlan(s, g)) if (!seen.has(u.id)) seen.set(u.id, u);
  all = [...seen.values()].sort((a, b) => a.grade - b.grade || a.quarter - b.quarter);
  return all;
}

let order: Map<string, number> | null = null;
/** A unit's position in the global order (-1 if unknown). */
export function unitOrder(id: string): number {
  order ??= new Map(allUnits().map((u, i) => [u.id, i]));
  return order.get(id) ?? -1;
}

export const verifierMeta: Record<VerifierId, { en: string; verified: boolean }> = {
  sympy: { en: "Verified by SymPy", verified: true },
  arithmetic: { en: "Verified exactly", verified: true },
  statistics: { en: "Verified by calculation", verified: true },
  geometry: { en: "Verified by calculation", verified: true },
  units: { en: "Verified with units", verified: true },
  chemistry: { en: "Verified by balancing", verified: true },
  llm: { en: "AI-checked", verified: false },
};


/** Resolve a unit id like "math-g8-q2-na" back to its plan unit. */
export function unitById(id: string): PlanUnit | null {
  const m = /^([a-z-]+)-g(\d+)-q\d-/.exec(id);
  if (m && !(m[1] in subjectMeta)) return null;
  if (!m) return null;
  return buildPlan(m[1] as SubjectId, Number(m[2])).find((u) => u.id === id) ?? null;
}

const MATH_FAMILY = new Set<SubjectId>(["math", "general-math", "finite-math", "pre-calculus", "advanced-math", "basic-calculus"]);
export const isMathSubject = (s: SubjectId) => MATH_FAMILY.has(s);

/**
 * What a starting-point check draws from: the learner's own units, plus foundations from one and two grades
 * earlier. Senior High courses rest on Grade 9-10 Mathematics or Science. Unique by domain, so every unit is a real lesson.
 */
/** The grade-by-grade subject a subject's foundations live in, and the first grade it's taught. */
export function foundationOf(subject: SubjectId): { base: SubjectId; lowest: number } {
  const base: SubjectId = subject === "math" || subject === "science" ? subject : isMathSubject(subject) ? "math" : "science";
  return { base, lowest: base === "science" ? 3 : 1 };
}

export function placementUnits(subject: SubjectId, grade: number): { current: PlanUnit[]; foundation: PlanUnit[] } {
  // Every topic once (Senior High domains repeat across quarters with the same title).
  const uniq = (us: PlanUnit[]) => us.filter((u, i) => us.findIndex((v) => v.title === u.title && v.grade === u.grade) === i);
  const current = uniq(buildPlan(subject, grade));
  const { base, lowest } = foundationOf(subject);
  const earlier = subject === base ? [grade - 1, grade - 2] : [10, 9];
  const foundation = uniq(earlier.filter((g) => g >= lowest).flatMap((g) => buildPlan(base, g)));
  return { current, foundation };
}
