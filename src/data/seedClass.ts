import type { SkillStatus, Student } from "../types";
import { skills } from "./index";

// Demo class for Ms. Santos, Grade 9 – Sampaguita. Names are fictional.
const NAMES = [
  "Andrea Cruz", "Miguel Reyes", "Bea Santos", "Paolo Garcia", "Janelle Mendoza", "Carlo Bautista",
  "Trisha Villanueva", "Jomar Dela Cruz", "Nicole Ramos", "Rafael Aquino", "Erika Navarro", "Kevin Castillo",
  "Angela Flores", "Marco Torres", "Sofia Gonzales", "Daniel Rivera", "Patricia Lim", "Gabriel Tan",
  "Hannah Ocampo", "Joshua Domingo", "Clarisse Pascual", "Adrian Mercado", "Isabel Salazar", "Renz Manalo",
  "Camille Javier", "Luis Fernandez", "Mae Robles", "Enzo Valdez", "Rica Soriano",
];

// Who shares which root gap (before Kyla is diagnosed: 13 on poly_mult).
const GAP_PLAN: { gap: string; count: number; misconception: string }[] = [
  { gap: "poly_mult", count: 13, misconception: "binomial_square" },
  { gap: "int_ops", count: 6, misconception: "sign_not_changed" },
  { gap: "frac_ops", count: 4, misconception: "fraction_add_across" },
];

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

/** Skills that depend (directly or not) on `id`; a gap there leaves them unmastered. */
function dependents(id: string): Set<string> {
  const out = new Set<string>();
  let frontier = [id];
  while (frontier.length) {
    const next: string[] = [];
    for (const s of skills) {
      if (s.prereqs.some((p) => frontier.includes(p)) && !out.has(s.id)) {
        out.add(s.id);
        next.push(s.id);
      }
    }
    frontier = next;
  }
  return out;
}

export const KYLA_ID = "s-kyla";

export function buildSeedClass(): Student[] {
  const rand = rng(42);
  let i = 0;
  const students: Student[] = NAMES.map((name, n) => {
    let plan: (typeof GAP_PLAN)[number] | undefined;
    let acc = 0;
    for (const g of GAP_PLAN) {
      if (n < acc + g.count) {
        plan = g;
        break;
      }
      acc += g.count;
    }
    const blocked = plan ? dependents(plan.gap) : new Set<string>();
    const statuses: Record<string, SkillStatus> = {};
    for (const s of skills) {
      if (plan && s.id === plan.gap) statuses[s.id] = "gap";
      else if (blocked.has(s.id)) statuses[s.id] = "unknown";
      else statuses[s.id] = s.grade <= 8 || rand() > 0.35 ? "mastered" : "unknown";
    }
    i += 1;
    return {
      id: `s-${i}`,
      name,
      anonId: `Student ${400 + i}`,
      skills: statuses,
      lastMisconception: plan?.misconception,
      rootGap: plan?.gap,
    };
  });
  return students;
}
