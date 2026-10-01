/**
 * Build the shared prerequisite graph (src/data/prereqs.json): which earlier units each unit directly needs.
 *
 *   npm run build:prereqs -- [--subject math] [--grade 9] [--fresh] [--concurrency 4]
 *
 * For every unit in the curriculum:
 *   1. Propose: the model picks the unit's DIRECT prerequisites from a candidate list of earlier units
 *      (same or lower grade, up to 4 grades back, Math and Science both, so Physics can need algebra).
 *   2. Validate, mechanically: unknown ids and anything not earlier in the global order are dropped,
 *      so the graph can't have a cycle.
 *   3. Review: a separate call sees each proposed link and may only REMOVE ones that aren't truly needed.
 *      It can't add links, so errors lean toward a shorter path, never a longer one.
 *   4. Reduce: links already implied through another link are removed (A needs B needs C: A→C goes).
 * Then a report for a person (audit/prereqs-report.md): every unit's links with titles, plus warnings
 * (units with no prerequisites above the first grade, very long chains).
 * Proposals are saved under audit/prereqs/ and reused on the next run (--fresh redoes them).
 * Needs OPENROUTER_API_KEY in .env.local. Set OPENROUTER_REVIEW_MODEL to review with a different model.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { chatJson, TEXT, THOROUGH, type Route } from "../api/_openrouter.ts";
import { allUnits, foundationOf, subjectMeta, unitOrder, type PlanUnit } from "../src/data/curriculum.ts";

const { values: arg } = parseArgs({
  options: {
    subject: { type: "string" },
    grade: { type: "string" },
    fresh: { type: "boolean", default: false },
    concurrency: { type: "string", default: "4" },
  },
});

const DIR = join("audit", "prereqs");
mkdirSync(DIR, { recursive: true });
const OUT = join("src", "data", "prereqs.json");
const WINDOW = 4; // grades back a direct prerequisite may sit

const REVIEWER: Route = process.env.OPENROUTER_REVIEW_MODEL
  ? { model: process.env.OPENROUTER_REVIEW_MODEL, providers: (process.env.OPENROUTER_REVIEW_PROVIDERS ?? "").split(",").map((x) => x.trim()).filter(Boolean), effort: "medium" }
  : THOROUGH;

const units = allUnits();
const byId = new Map(units.map((u) => [u.id, u]));
const label = (u: PlanUnit) => `${subjectMeta[u.subject].en} G${u.grade} Q${u.quarter}: ${u.title}`;

/** Earlier units a unit may need: before it in the global order, within the grade window, Math and Science families. */
function candidates(u: PlanUnit): PlanUnit[] {
  const me = unitOrder(u.id);
  return units.filter((c) => unitOrder(c.id) < me && c.grade >= u.grade - WINDOW && c.grade <= u.grade);
}

const ids = { type: "array", items: { type: "string" } };
const PROPOSE = { type: "object", additionalProperties: false, required: ["needs"], properties: { needs: ids } };
const REVIEW = { type: "object", additionalProperties: false, required: ["keep"], properties: { keep: ids } };

async function propose(u: PlanUnit): Promise<string[]> {
  const list = candidates(u);
  if (!list.length) return [];
  const r = await chatJson<{ needs: string[] }>(
    [
      "You map prerequisites in the Philippine DepEd MATATAG curriculum.",
      "Given one unit and a list of earlier units, return the ids of its DIRECT prerequisites: the earlier units a learner must already know to learn this unit, and without which they would get stuck.",
      "Direct only: if A needs B and B needs C, list B, not C. Usually 1 to 3, at most 4. Return none if it builds on nothing in the list.",
      "Not related-but-optional topics, not the same idea at a lower level unless it is truly required. Use only ids from the list.",
    ].join(" "),
    `Unit: ${label(u)}\n\nEarlier units:\n${list.map((c) => `${c.id}: ${label(c)}`).join("\n")}`,
    PROPOSE, "prerequisites", THOROUGH,
  );
  return r.needs;
}

async function review(u: PlanUnit, proposed: string[]): Promise<string[]> {
  if (!proposed.length) return [];
  const r = await chatJson<{ keep: string[] }>(
    [
      "You check proposed prerequisite links in the Philippine DepEd MATATAG curriculum. You did not propose them.",
      "Keep a link only if a learner truly cannot learn the unit without the prerequisite. Remove links that are merely related, optional, or already covered by another kept link.",
      "Return the ids to keep, a subset of the proposed ones. Never add new ids.",
    ].join(" "),
    `Unit: ${label(u)}\n\nProposed prerequisites:\n${proposed.map((id) => `${id}: ${label(byId.get(id)!)}`).join("\n")}`,
    REVIEW, "prerequisite_review", REVIEWER,
  );
  return r.keep.filter((id) => proposed.includes(id));
}

/** Mechanical rules: known unit, strictly earlier in the global order (so no cycles), within the window, no duplicates. */
function valid(u: PlanUnit, list: string[]): string[] {
  const me = unitOrder(u.id);
  return [...new Set(list)].filter((id) => {
    const c = byId.get(id);
    return c && unitOrder(id) < me && c.grade >= u.grade - WINDOW;
  });
}

/** Drop a link when the prerequisite is already reachable through another of the unit's prerequisites. */
function reduce(edges: Record<string, string[]>) {
  const reach = new Map<string, Set<string>>();
  const ancestorsOf = (id: string): Set<string> => {
    if (reach.has(id)) return reach.get(id)!;
    const out = new Set<string>();
    reach.set(id, out); // acyclic by construction, so no infinite recursion
    for (const p of edges[id] ?? []) {
      out.add(p);
      for (const a of ancestorsOf(p)) out.add(a);
    }
    return out;
  };
  const out: Record<string, string[]> = {};
  for (const [id, ps] of Object.entries(edges)) {
    const kept = ps.filter((p) => !ps.some((q) => q !== p && ancestorsOf(q).has(p)));
    if (kept.length) out[id] = kept;
  }
  return out;
}

async function pool<T>(items: T[], n: number, fn: (x: T, i: number) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i], i);
    }
  }));
}

const todo = units.filter((u) => (!arg.subject || u.subject === arg.subject) && (!arg.grade || u.grade === Number(arg.grade)));
console.log(`Mapping prerequisites for ${todo.length} units…`);
await pool(todo, Number(arg.concurrency), async (u, i) => {
  const file = join(DIR, `${u.id}.json`);
  if (!arg.fresh && existsSync(file)) return;
  try {
    const proposed = valid(u, await propose(u));
    const kept = valid(u, await review(u, proposed));
    writeFileSync(file, JSON.stringify({ id: u.id, proposed, kept, at: new Date().toISOString() }, null, 2));
    console.log(`[${i + 1}/${todo.length}] ${u.id}: ${kept.length} of ${proposed.length} kept`);
  } catch (e) {
    console.warn(`[${i + 1}/${todo.length}] ${u.id}: FAILED ${String(e)}`);
  }
});

// Merge every saved unit (not just this run's), reduce, and write the graph the app ships.
const raw: Record<string, string[]> = {};
const missing: string[] = [];
for (const u of units) {
  const file = join(DIR, `${u.id}.json`);
  if (!existsSync(file)) { missing.push(u.id); continue; }
  const kept = valid(u, (JSON.parse(readFileSync(file, "utf8")) as { kept: string[] }).kept);
  if (kept.length) raw[u.id] = kept;
}
const edges = reduce(raw);
const prev = JSON.parse(readFileSync(OUT, "utf8")) as { version: number };
// A half-mapped graph would hide real prerequisites (unmapped units look like they need nothing), so the
// app's graph is only replaced once every unit is mapped. Partial runs still write the report.
if (!missing.length) writeFileSync(OUT, JSON.stringify({ version: prev.version + 1, generatedAt: new Date().toISOString(), model: TEXT.model, reviewer: REVIEWER.model, edges }, null, 2) + "\n");
else console.warn(`${missing.length} units not mapped yet: ${OUT} left unchanged.`);

// The report: what a person should read before this ships.
const depth = new Map<string, number>();
const deep = (id: string): number => depth.get(id) ?? (depth.set(id, 0), depth.set(id, 1 + Math.max(0, ...(edges[id] ?? []).map(deep))), depth.get(id)!);
const orphans = units.filter((u) => !edges[u.id] && u.grade > foundationOf(u.subject).lowest && !missing.includes(u.id));
const longest = [...units].map((u) => [u, deep(u.id)] as const).sort((a, b) => b[1] - a[1]).slice(0, 10);
const n = Object.values(edges).reduce((a, x) => a + x.length, 0);
writeFileSync(join("audit", "prereqs-report.md"), [
  `# Prerequisite graph v${prev.version + 1}, ${new Date().toISOString().slice(0, 10)}`,
  "",
  `${units.length} units, ${n} links. ${missing.length ? `**${missing.length} units not mapped yet** (run again).` : "All units mapped."}`,
  "",
  `## Units above their subject's first grade with no prerequisites (${orphans.length}): check these first`,
  ...orphans.map((u) => `- \`${u.id}\` ${label(u)}`),
  "",
  "## Longest chains",
  ...longest.map(([u, d]) => `- ${d} deep: \`${u.id}\` ${label(u)}`),
  "",
  "## Every link",
  ...units.filter((u) => edges[u.id]).map((u) => `- **${label(u)}** needs\n${edges[u.id].map((p) => `  - ${label(byId.get(p)!)}`).join("\n")}`),
  "",
].join("\n"));
console.log(`\n${n} links over ${Object.keys(edges).length} units → ${OUT}. Review: audit/prereqs-report.md`);
