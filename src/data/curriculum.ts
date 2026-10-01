import type { Lang } from "../types.js";

export type SubjectId = "math" | "science";
export type VerifierId = "sympy" | "arithmetic" | "statistics" | "geometry" | "units" | "chemistry" | "llm";
export type Goal = "catch_up" | "keep_up" | "exam_prep" | "explore";

export const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export const subjectMeta: Record<SubjectId, { en: string; fil: string; blurb: { en: string; fil: string } }> = {
  math: {
    en: "Math", fil: "Math",
    blurb: { en: "Numbers, algebra, geometry, data", fil: "Numbers, algebra, geometry, data" },
  },
  science: {
    en: "Science", fil: "Science",
    blurb: { en: "Physics and chemistry, from the basics", fil: "Physics at chemistry, mula sa basics" },
  },
};

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

const MATH_DOMAINS = {
  number: D("number", "Numbers and operations", "Numbers at operations", "arithmetic"),
  fractions: D("fractions", "Fractions, decimals and percent", "Fractions, decimals at percent", "arithmetic"),
  measure: D("measure", "Measurement", "Pagsukat", "arithmetic"),
  geometry: D("geometry", "Geometry", "Geometry", "geometry"),
  patterns: D("patterns", "Patterns and algebra", "Patterns at algebra", "sympy"),
  algebra: D("algebra", "Algebra", "Algebra", "sympy"),
  functions: D("functions", "Functions and graphs", "Functions at graphs", "sympy"),
  data: D("data", "Data and probability", "Data at probability", "statistics"),
  trig: D("trig", "Trigonometry", "Trigonometry", "sympy"),
  calculus: D("calculus", "Limits and calculus", "Limits at calculus", "sympy"),
};

const SCI_DOMAINS = {
  matter: D("matter", "Matter", "Matter", "llm"),
  motion: D("motion", "Motion and forces", "Galaw at force", "units"),
  energy: D("energy", "Energy", "Energy", "units"),
  chem: D("chem", "Chemical reactions", "Chemical reactions", "chemistry"),
  living: D("living", "Living things", "Mga may buhay", "llm"),
  earth: D("earth", "Earth and space", "Earth at space", "llm"),
  physics: D("physics", "Physics", "Physics", "units"),
  chemistry: D("chemistry", "Chemistry", "Chemistry", "chemistry"),
};

function mathDomains(g: number): Domain[] {
  const M = MATH_DOMAINS;
  if (g <= 3) return [M.number, M.fractions, M.measure, M.geometry, M.data];
  if (g <= 6) return [M.number, M.fractions, M.measure, M.geometry, M.patterns, M.data];
  if (g <= 8) return [M.number, M.fractions, M.algebra, M.geometry, M.data];
  if (g <= 10) return [M.algebra, M.functions, M.geometry, M.trig, M.data];
  return [M.functions, M.algebra, M.trig, M.data, ...(g === 12 ? [M.calculus] : [])];
}

function scienceDomains(g: number): Domain[] {
  const S = SCI_DOMAINS;
  if (g <= 6) return [S.matter, S.motion, S.energy, S.living, S.earth];
  if (g <= 10) return [S.matter, S.motion, S.energy, S.chem, S.living, S.earth];
  return [S.physics, S.chemistry];
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
  const domains = subject === "math" ? mathDomains(grade) : scienceDomains(grade);
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
  const m = /^(math|science)-g(\d+)-q\d-/.exec(id);
  if (!m) return null;
  return buildPlan(m[1] as SubjectId, Number(m[2])).find((u) => u.id === id) ?? null;
}
