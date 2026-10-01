import type { Lang } from "../types.js";

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

interface SubjectInfo { en: string; fil: string; blurb: { en: string; fil: string } }
const S = (en: string, blurbEn: string, blurbFil: string = blurbEn, fil: string = en): SubjectInfo => ({ en, fil, blurb: { en: blurbEn, fil: blurbFil } });

export const subjectMeta: Record<SubjectId, SubjectInfo> = {
  math: S("Mathematics", "Number sense, measurement, geometry, algebra, statistics", "Number sense, pagsukat, geometry, algebra, statistics", "Mathematics"),
  science: S("Science", "Matter, living things, force and energy, earth and space", "Matter, mga may buhay, force at energy, earth at space"),
  "general-math": S("General Mathematics", "Functions, business math, logic"),
  "general-science": S("General Science", "Matter, energy, living systems, earth systems"),
  "finite-math": S("Finite Mathematics", "Counting, probability, matrices, graphs"),
  "pre-calculus": S("Pre-Calculus", "Conics, trigonometry, series, vectors"),
  "advanced-math": S("Advanced Mathematics", "Functions, series, complex numbers, analytic geometry"),
  "basic-calculus": S("Basic Calculus", "Limits, derivatives, integrals"),
  physics: S("Physics", "Motion, energy, waves, electricity", "Galaw, energy, waves, kuryente"),
  chemistry: S("Chemistry", "Matter, atoms, reactions, solutions"),
  biology: S("Biology", "Cells, genetics, evolution, body systems"),
  "earth-space": S("Earth and Space Science", "Earth's systems, climate, stars, hazards"),
};

export interface SubjectGroup { id: "core" | "math" | "science"; en: string; fil: string; subjects: SubjectId[] }

/** The subjects offered at a grade, grouped the way a Senior High student meets them. Grades 1-10 are a single group. */
export function subjectGroupsForGrade(grade: number): SubjectGroup[] {
  if (grade >= 11) {
    const groups: SubjectGroup[] = [];
    if (grade === 11) groups.push({ id: "core", en: "Core subjects", fil: "Core subjects", subjects: ["general-math", "general-science"] });
    groups.push(
      { id: "math", en: "Math electives", fil: "Math electives", subjects: ["pre-calculus", "basic-calculus", "finite-math", "advanced-math"] },
      { id: "science", en: "Science electives", fil: "Science electives", subjects: ["physics", "chemistry", "biology", "earth-space"] },
    );
    return groups;
  }
  return [{ id: "core", en: "Subjects", fil: "Mga subject", subjects: grade >= 3 ? ["math", "science"] : ["math"] }];
}

export function subjectsForGrade(grade: number): SubjectId[] {
  return subjectGroupsForGrade(grade).flatMap((g) => g.subjects);
}

export const goalMeta: Record<Goal, { en: string; fil: string }> = {
  catch_up: { en: "Catch up on what I missed", fil: "Habulin ang mga na-miss ko" },
  keep_up: { en: "Keep up in class", fil: "Makasabay sa klase" },
  exam_prep: { en: "Prepare for an exam", fil: "Maghanda sa exam" },
  explore: { en: "Just exploring", fil: "Nag-e-explore lang" },
};

/** A coarse domain of a subject at some grade. Wording is ours; structure follows grade, quarter, domain. */
interface Domain {
  id: string;
  en: string;
  fil: string;
  verifier: VerifierId;
}

const D = (id: string, en: string, fil: string, verifier: VerifierId): Domain => ({ id, en, fil, verifier });

// Math strands as in the K-12 curriculum.
const MATH_DOMAINS = {
  number: D("number", "Number sense", "Number sense", "arithmetic"),
  measure: D("measure", "Measurement", "Pagsukat", "arithmetic"),
  geometry: D("geometry", "Geometry", "Geometry", "geometry"),
  patterns: D("patterns", "Patterns and algebra", "Patterns at algebra", "sympy"),
  algebra: D("algebra", "Algebra", "Algebra", "sympy"),
  functions: D("functions", "Functions and graphs", "Functions at graphs", "sympy"),
  data: D("data", "Statistics and probability", "Statistics at probability", "statistics"),
  trig: D("trig", "Trigonometry", "Trigonometry", "sympy"),
  calculus: D("calculus", "Limits and calculus", "Limits at calculus", "sympy"),
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
    D("matter", "Matter", "Matter", g >= 8 ? "chemistry" : "llm"),
    D("living", "Living things and their environment", "Mga may buhay at kanilang kapaligiran", "llm"),
    D("force", "Force, motion and energy", "Force, galaw at energy", "units"),
    D("earth", "Earth and space", "Earth at space", "llm"),
  ];
}

// Senior High courses, each with its own plan. Domains are ours (coarse); a course's guide has the real competencies.
const SHS_DOMAINS: Partial<Record<SubjectId, Domain[]>> = {
  "general-math": [
    D("functions", "Functions and their graphs", "Functions at graphs nito", "sympy"),
    D("exp-log", "Rational, exponential and logarithmic functions", "Rational, exponential at logarithmic functions", "sympy"),
    D("business", "Business math: interest and annuities", "Business math: interest at annuities", "arithmetic"),
    D("logic", "Logic and reasoning", "Logic at reasoning", "llm"),
  ],
  "general-science": [
    D("nature", "Nature of science and measurement", "Kalikasan ng science at pagsukat", "llm"),
    D("matter-energy", "Matter and energy", "Matter at energy", "units"),
    D("living", "Living systems", "Mga living system", "llm"),
    D("earth", "Earth systems", "Mga earth system", "llm"),
  ],
  "finite-math": [
    D("counting", "Sets and counting", "Sets at counting", "statistics"),
    D("probability", "Probability", "Probability", "statistics"),
    D("matrices", "Matrices and linear systems", "Matrices at linear systems", "sympy"),
    D("graphs", "Graphs and networks", "Graphs at networks", "llm"),
  ],
  "pre-calculus": [
    D("conics", "Conic sections", "Conic sections", "sympy"),
    D("trig", "Trigonometric functions and identities", "Trigonometric functions at identities", "sympy"),
    D("series", "Sequences, series and induction", "Sequences, series at induction", "sympy"),
    D("vectors", "Polar coordinates and vectors", "Polar coordinates at vectors", "sympy"),
  ],
  "advanced-math": [
    D("functions", "Algebraic and transcendental functions", "Algebraic at transcendental functions", "sympy"),
    D("series", "Sequences and series", "Sequences at series", "sympy"),
    D("complex", "Complex numbers", "Complex numbers", "sympy"),
    D("analytic", "Analytic geometry", "Analytic geometry", "sympy"),
  ],
  "basic-calculus": [
    D("limits", "Limits and continuity", "Limits at continuity", "sympy"),
    D("derivatives", "Derivatives", "Derivatives", "sympy"),
    D("applications", "Applications of derivatives", "Applications ng derivatives", "sympy"),
    D("integrals", "Integrals", "Integrals", "sympy"),
  ],
  physics: [
    D("motion", "Motion and forces", "Galaw at force", "units"),
    D("energy", "Work, energy and power", "Work, energy at power", "units"),
    D("waves", "Waves and optics", "Waves at optics", "units"),
    D("electricity", "Electricity and magnetism", "Kuryente at magnetism", "units"),
  ],
  chemistry: [
    D("matter", "Matter and measurement", "Matter at pagsukat", "llm"),
    D("atoms", "Atoms and the periodic table", "Atoms at periodic table", "llm"),
    D("reactions", "Chemical reactions and stoichiometry", "Chemical reactions at stoichiometry", "chemistry"),
    D("solutions", "Solutions, acids and bases", "Solutions, acids at bases", "llm"),
  ],
  biology: [
    D("cells", "Cells", "Cells", "llm"),
    D("genetics", "Heredity and genetics", "Heredity at genetics", "llm"),
    D("evolution", "Evolution and ecology", "Evolution at ecology", "llm"),
    D("body", "Body systems", "Mga body system", "llm"),
  ],
  "earth-space": [
    D("earth", "Earth's structure and processes", "Estruktura at proseso ng Earth", "llm"),
    D("climate", "Atmosphere and climate", "Atmosphere at climate", "llm"),
    D("space", "Stars and the solar system", "Mga bituin at solar system", "llm"),
    D("hazards", "Resources and hazards", "Resources at hazards", "llm"),
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
  title: { en: string; fil: string };
  verifier: VerifierId;
  /** Lessons are generated and cached on demand. "outline" means none exists yet. */
  status: "outline";
}

/** The enrollment plan: the syllabus for the learner's stated class. The gap finder can insert earlier units later. */
export function buildPlan(subject: SubjectId, grade: number): PlanUnit[] {
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
        title: { en: d.en, fil: d.fil },
        verifier: d.verifier,
        status: "outline",
      }),
    );
  });
  return units.sort((a, b) => a.quarter - b.quarter);
}

export const verifierMeta: Record<VerifierId, { en: string; fil: string; verified: boolean }> = {
  sympy: { en: "Verified by SymPy", fil: "Beripikado ng SymPy", verified: true },
  arithmetic: { en: "Verified exactly", fil: "Eksaktong beripikado", verified: true },
  statistics: { en: "Verified by calculation", fil: "Beripikado sa kalkulasyon", verified: true },
  geometry: { en: "Verified by calculation", fil: "Beripikado sa kalkulasyon", verified: true },
  units: { en: "Verified with units", fil: "Beripikado gamit ang units", verified: true },
  chemistry: { en: "Verified by balancing", fil: "Beripikado sa balancing", verified: true },
  llm: { en: "AI-checked", fil: "Sinuri ng AI", verified: false },
};

export const subjectLabel = (s: SubjectId, lang: Lang) => subjectMeta[s][lang];

/** Resolve a unit id like "math-g8-q2-algebra" back to its plan unit. */
export function unitById(id: string): PlanUnit | null {
  const m = /^([a-z-]+)-g(\d+)-q\d-/.exec(id);
  if (m && !(m[1] in subjectMeta)) return null;
  if (!m) return null;
  return buildPlan(m[1] as SubjectId, Number(m[2])).find((u) => u.id === id) ?? null;
}
