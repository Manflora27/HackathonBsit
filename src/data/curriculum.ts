import type { Lang } from "../types.js";

/** Follows the Philippine system: Science is one integrated subject in Grades 3-10, and separate subjects in Grades 11-12. */
export type SubjectId = "math" | "science" | "physics" | "chemistry" | "biology";
export type VerifierId = "sympy" | "arithmetic" | "statistics" | "geometry" | "units" | "chemistry" | "llm";
export type Goal = "catch_up" | "keep_up" | "exam_prep" | "explore";

export const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export const subjectMeta: Record<SubjectId, { en: string; fil: string; blurb: { en: string; fil: string } }> = {
  math: {
    en: "Math", fil: "Math",
    blurb: { en: "Number sense, measurement, geometry, algebra, statistics", fil: "Number sense, pagsukat, geometry, algebra, statistics" },
  },
  science: {
    en: "Science", fil: "Science",
    blurb: { en: "Matter, living things, force and energy, earth and space", fil: "Matter, mga may buhay, force at energy, earth at space" },
  },
  physics: {
    en: "Physics", fil: "Physics",
    blurb: { en: "Motion, energy, waves, electricity", fil: "Galaw, energy, waves, kuryente" },
  },
  chemistry: {
    en: "Chemistry", fil: "Chemistry",
    blurb: { en: "Matter, atoms, reactions, solutions", fil: "Matter, atoms, reactions, solutions" },
  },
  biology: {
    en: "Biology", fil: "Biology",
    blurb: { en: "Cells, genetics, evolution, body systems", fil: "Cells, genetics, evolution, body systems" },
  },
};

/** Subjects offered at a grade, as in DepEd's K-12: Science from Grade 3 (integrated), then Physics, Chemistry and Biology in Senior High. */
export function subjectsForGrade(grade: number): SubjectId[] {
  if (grade >= 11) return ["math", "physics", "chemistry", "biology"];
  if (grade >= 3) return ["math", "science"];
  return ["math"];
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
  if (g <= 10) return [M.patterns, M.geometry, M.trig, M.data];
  return [M.functions, M.algebra, M.trig, M.data, ...(g === 12 ? [M.calculus] : [])];
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

// Senior High subjects are separate, each with its own plan.
const SHS_DOMAINS: Record<"physics" | "chemistry" | "biology", Domain[]> = {
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
};

function domainsFor(subject: SubjectId, grade: number): Domain[] {
  if (subject === "math") return mathDomains(grade);
  if (subject === "science") return scienceDomains(grade);
  return SHS_DOMAINS[subject];
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
  const m = /^(math|science|physics|chemistry|biology)-g(\d+)-q\d-/.exec(id);
  if (!m) return null;
  return buildPlan(m[1] as SubjectId, Number(m[2])).find((u) => u.id === id) ?? null;
}
