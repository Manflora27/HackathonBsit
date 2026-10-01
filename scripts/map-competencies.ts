/**
 * Attach every MATATAG learning competency to the plan unit (content topic) it belongs to.
 *
 *   python3 scripts/extract-matatag-competencies.py math.txt sci.txt > /tmp/competencies-raw.json
 *   npx tsx --env-file=.env.local scripts/map-competencies.ts /tmp/competencies-raw.json
 *
 * Writes src/data/competencies.json. The guides number competencies per quarter (Math also tags each with its
 * domain) but don't say which content topic each serves, so where a quarter/domain has more than one unit the
 * model assigns them, with full reasoning. Mechanical checks then insist every competency lands on exactly one
 * real unit of its own quarter (and domain); anything else fails the run rather than guessing.
 * IDs (MAT-G7-Q1-007, SCI-G7-Q4-012) are ours: DepEd publishes no codes for MATATAG competencies.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { chatJson, THOROUGH } from "../api/_openrouter.ts";
import { buildPlan, type PlanUnit } from "../src/data/curriculum.ts";

type Raw = Record<"math" | "science", Record<string, Record<string, { n: number; domain?: string; text: string }[]>>>;
const raw = JSON.parse(readFileSync(process.argv[2], "utf8")) as Raw;

interface Group { subject: "math" | "science"; grade: number; quarter: number; units: PlanUnit[]; comps: { n: number; text: string }[] }
const groups: Group[] = [];
for (const subject of ["math", "science"] as const) {
  for (const [g, quarters] of Object.entries(raw[subject])) {
    const grade = Number(g);
    const plan = buildPlan(subject, grade);
    for (const [q, comps] of Object.entries(quarters)) {
      const quarter = Number(q);
      // Math: a quarter mixes domains (NA, MG, DP) and each competency carries its own.
      const domains = subject === "math" ? [...new Set(comps.map((c) => c.domain!))] : [null];
      for (const d of domains) {
        const units = plan.filter((u) => u.quarter === quarter && (d === null || u.domain === d.toLowerCase()));
        if (!units.length) throw new Error(`${subject} G${grade} Q${quarter} ${d ?? ""}: no units in the plan`);
        groups.push({ subject, grade, quarter, units, comps: comps.filter((c) => d === null || c.domain === d) });
      }
    }
  }
}

const schema = {
  type: "object", additionalProperties: false, required: ["assign"],
  properties: { assign: { type: "array", items: { type: "object", additionalProperties: false, required: ["n", "topic"], properties: { n: { type: "integer" }, topic: { type: "integer" } } } } },
};

async function assign(g: Group): Promise<Map<number, string>> {
  if (g.units.length === 1) return new Map(g.comps.map((c) => [c.n, g.units[0].id]));
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await chatJson<{ assign: { n: number; topic: number }[] }>(
      "You align the Philippine DepEd MATATAG curriculum. Each numbered learning competency below serves exactly one of the content topics listed for the same quarter. "
        + "Assign every competency to the topic it develops (the one a teacher would be teaching when working on it). Use each competency number exactly once; topics are numbered from 1.",
      `${g.subject === "math" ? "Mathematics" : "Science"}, Grade ${g.grade}, Quarter ${g.quarter}.\n\nTopics:\n${g.units.map((u, i) => `${i + 1}. ${u.title}`).join("\n")}\n\nCompetencies:\n${g.comps.map((c) => `${c.n}. ${c.text}`).join("\n")}`,
      schema, "competency_topics", THOROUGH,
    );
    const map = new Map(r.assign.filter((a) => a.topic >= 1 && a.topic <= g.units.length).map((a) => [a.n, g.units[a.topic - 1].id]));
    if (g.comps.every((c) => map.has(c.n)) && map.size === g.comps.length) return map;
    console.warn(`  retry ${g.subject} G${g.grade} Q${g.quarter}: ${map.size}/${g.comps.length} assigned`);
  }
  throw new Error(`${g.subject} G${g.grade} Q${g.quarter}: model didn't assign every competency`);
}

const results: Map<number, string>[] = [];
let next = 0;
await Promise.all(Array.from({ length: 8 }, async () => {
  for (let i = next++; i < groups.length; i = next++) results[i] = await assign(groups[i]);
}));

const pad = (n: number, w: number) => String(n).padStart(w, "0");
const competencies = groups.flatMap((g, i) => g.comps.map((c) => ({
  id: `${g.subject === "math" ? "MAT" : "SCI"}-G${g.grade}-Q${g.quarter}-${pad(c.n, 3)}`,
  unit: results[i].get(c.n)!,
  text: c.text.charAt(0).toUpperCase() + c.text.slice(1),
}))).sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));

const covered = new Set(competencies.map((c) => c.unit));
const bare = groups.flatMap((g) => g.units).filter((u) => !covered.has(u.id));
writeFileSync("src/data/competencies.json", JSON.stringify({
  source: "DepEd MATATAG Curriculum Guides, Mathematics (Grades 1-10) and Science (Grades 3-10), August 2023. Competency text is DepEd's; ids are app-defined (DepEd publishes no MATATAG codes).",
  generatedAt: new Date().toISOString(),
  model: THOROUGH.model,
  competencies,
}, null, 1) + "\n");
console.log(`${competencies.length} competencies on ${covered.size} units; ${bare.length} units without one${bare.length ? `: ${bare.map((u) => u.id).join(", ")}` : ""}`);
