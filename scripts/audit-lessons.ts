/**
 * Lesson audit: make every lesson in the curriculum once, check it, and report what needs a human.
 *
 *   npm run audit:lessons -- [--subject math] [--grade 9] [--limit 20] [--concurrency 3] [--fresh] [--publish]
 *
 * For each unit (MATATAG Math G1-10, Science G3-10, Senior High subjects G11-12):
 *   1. Generate it exactly as the app does (api/lesson.ts generateLesson: graph points fixed,
 *      the concept check confirmed by a second independent reading).
 *   2. Exact checks: every practice key and every worked-example step with SymPy (the server's own
 *      api/verify.py), and every number-only "a = b" in the text (src/lessons/checks.ts, as the app does).
 *   3. A separate AI review against the unit's MATATAG topic: on topic, right grade level, explanation
 *      correct, answers correct, translations faithful. It only flags; it never passes what step 2 failed.
 *
 * Verdicts: fail (exact check failed: never published), flag (review raised an issue: a person reads it),
 * pass. --publish writes passing lessons to the shared cache, so learners get audited lessons first.
 * Lessons are saved under audit/lessons/ and reused on the next run (resume after a stop; --fresh redoes them).
 * Set OPENROUTER_REVIEW_MODEL to review with a different model than the one that writes (recommended).
 * Needs OPENROUTER_API_KEY (and SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY for --publish) in .env.local, and uv for SymPy.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { generateLesson } from "../api/lesson.ts";
import { ENGINE_VERIFIED, resolve, writeCache, type Target } from "../api/_lessons.ts";
import { chatJson, THOROUGH, type Route } from "../api/_openrouter.ts";
import { allUnits, buildPlan, subjectMeta, type PlanUnit } from "../src/data/curriculum.ts";
import { wrongClaims } from "../src/lessons/checks.ts";

const { values: arg } = parseArgs({
  options: {
    subject: { type: "string" },
    grade: { type: "string" },
    limit: { type: "string" },
    concurrency: { type: "string", default: "3" },
    fresh: { type: "boolean", default: false },
    publish: { type: "boolean", default: false },
  },
});

const DIR = "audit";
const LESSONS = join(DIR, "lessons");
mkdirSync(LESSONS, { recursive: true });

type Draft = Awaited<ReturnType<typeof generateLesson>>["draft"];
type Review = { on_topic: boolean; grade_level: boolean; explanation_correct: boolean; answers_correct: boolean; translations_faithful: boolean; issues: string[] };
type Exact = { keys: boolean[]; example: boolean | null };
interface Record_ {
  id: string;
  target: Target;
  draft?: Draft;
  notes: string[];
  error?: string;
  review?: Review;
  exact?: Exact;
  verdict?: "pass" | "flag" | "fail";
  reasons?: string[];
  at: string;
}

/** Every unit in the curriculum, once, narrowed by the flags. */
function unitsToAudit(): PlanUnit[] {
  return allUnits()
    .filter((u) => !arg.subject || u.subject === arg.subject)
    .filter((u) => !arg.grade || u.grade === Number(arg.grade))
    .slice(0, arg.limit ? Number(arg.limit) : undefined);
}

/**
 * The reviewer. Defaults to the lesson model; a different model catches more of the writer's own blind spots:
 * set OPENROUTER_REVIEW_MODEL (and OPENROUTER_REVIEW_PROVIDERS, comma-separated) in .env.local.
 */
const REVIEWER: Route = process.env.OPENROUTER_REVIEW_MODEL
  ? { model: process.env.OPENROUTER_REVIEW_MODEL, providers: (process.env.OPENROUTER_REVIEW_PROVIDERS ?? "").split(",").map((x) => x.trim()).filter(Boolean), effort: "medium" }
  : THOROUGH;

const REVIEW_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["on_topic", "grade_level", "explanation_correct", "answers_correct", "translations_faithful", "issues"],
  properties: {
    on_topic: { type: "boolean" }, grade_level: { type: "boolean" }, explanation_correct: { type: "boolean" },
    answers_correct: { type: "boolean" }, translations_faithful: { type: "boolean" },
    issues: { type: "array", items: { type: "string" } },
  },
};

/** An independent review: a fresh call that didn't write the lesson, judging it against the curriculum topic. */
async function review(u: PlanUnit, d: Draft): Promise<Review> {
  const siblings = buildPlan(u.subject, u.grade).filter((x) => x.quarter === u.quarter && x.id !== u.id).map((x) => x.title);
  const system = [
    "You review one lesson for Filipino learners against the DepEd MATATAG curriculum. Be strict and specific; you did not write it.",
    "on_topic: it teaches the stated topic (not a neighbouring one). grade_level: the depth and language suit the stated grade.",
    "explanation_correct: every statement, example and calculation is true; the common-mistake paragraph intentionally shows a wrong line, judge only whether it is explained correctly.",
    "answers_correct: every practice item's expected answer is right, and the concept check's marked choice is right.",
    "translations_faithful: the Tagalog (fil) and Bisaya (ceb) say the same as the English, naturally.",
    "issues: one short line per problem found, quoting the exact text. Empty if none.",
  ].join(" ");
  const user = JSON.stringify({
    subject: subjectMeta[u.subject].en, grade: u.grade, quarter: u.quarter, topic: u.title, same_quarter_topics: siblings,
    lesson: { en: d.en, fil: d.fil, ceb: d.ceb, example: d.example, figure: d.figure, practice: d.practice, concept_check_answer_index: d.checkAnswer },
  });
  return chatJson<Review>(system, user, REVIEW_SCHEMA, "lesson_review", REVIEWER);
}

async function make(u: PlanUnit): Promise<Record_> {
  const target = resolve(u.id)!;
  const rec: Record_ = { id: u.id, target, notes: [], at: new Date().toISOString() };
  for (let attempt = 0; attempt < 2 && !rec.draft; attempt++) {
    try {
      const r = await generateLesson(target, null);
      rec.draft = r.draft;
      rec.notes = r.notes;
      delete rec.error;
    } catch (e) {
      rec.error = String(e);
    }
  }
  if (rec.draft) {
    try {
      rec.review = await review(u, rec.draft);
    } catch (e) {
      rec.notes.push(`review failed: ${String(e)}`);
    }
  }
  return rec;
}

/** SymPy over every lesson at once: one Python process, the server's own check functions. */
function exactChecks(recs: Record_[]) {
  const todo = recs.filter((r) => r.draft);
  if (!todo.length) return;
  const file = join(tmpdir(), `hopper-audit-${Date.now()}.json`);
  writeFileSync(file, JSON.stringify(todo.map((r) => {
    const d = r.draft!;
    const ex = d.example as { problemTyped?: string; kind?: string; steps: { typed?: string }[] } | undefined;
    return {
      id: r.id,
      items: (d.practice as { given: string; expected: string; form: string }[]).map(({ given, expected, form }) => ({ given, expected, form })),
      example: ex?.problemTyped && ex.steps.every((s) => s.typed) ? { problem: ex.problemTyped, steps: ex.steps.map((s) => s.typed), kind: ex.kind ?? "solve" } : null,
    };
  })));
  const out = JSON.parse(execFileSync("uv", ["run", "--no-project", "--with", "sympy", "python", "scripts/verify_batch.py", file], { encoding: "utf8", maxBuffer: 64 << 20 })) as (Exact & { id: string })[];
  for (const o of out) {
    const r = todo.find((x) => x.id === o.id)!;
    r.exact = { keys: o.keys, example: o.example };
  }
}

function judge(r: Record_) {
  const reasons: string[] = [];
  if (!r.draft) {
    r.verdict = "fail";
    r.reasons = [`not generated: ${r.error ?? "unknown"}`];
    return;
  }
  const engine = ENGINE_VERIFIED.has(r.target.verifier);
  const ex = r.exact;
  if (ex) {
    const good = ex.keys.filter(Boolean).length;
    if (engine && good < 2) reasons.push(`only ${good} of ${ex.keys.length} answer keys verified`);
    for (const [a, b] of wrongClaims(r.draft as never)) reasons.push(`wrong calculation in text: ${a} = ${b}`);
  } else reasons.push("exact checks did not run");
  if (reasons.length) {
    r.verdict = "fail";
    r.reasons = reasons;
    return;
  }
  const rv = r.review;
  const flags = !rv ? ["no review"] : [
    ...(!rv.on_topic ? ["off topic"] : []), ...(!rv.grade_level ? ["wrong grade level"] : []),
    ...(!rv.explanation_correct ? ["explanation has an error"] : []), ...(!rv.answers_correct ? ["an answer may be wrong"] : []),
    ...(!rv.translations_faithful ? ["translation drifts"] : []), ...rv.issues,
  ];
  if (ex?.example === false) r.notes.push("worked example failed its step check (dropped when served)");
  r.verdict = flags.length ? "flag" : "pass";
  r.reasons = flags;
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

const save = (r: Record_) => writeFileSync(join(LESSONS, `${r.id}.json`), JSON.stringify(r, null, 2));

const units = unitsToAudit();
console.log(`Auditing ${units.length} units${arg.fresh ? " (fresh)" : ""}…`);
const recs: Record_[] = [];
await pool(units, Number(arg.concurrency), async (u, i) => {
  const path = join(LESSONS, `${u.id}.json`);
  const old = !arg.fresh && existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as Record_) : null;
  const r = old?.draft ? old : await make(u);
  if (!old?.draft) save(r);
  recs.push(r);
  console.log(`[${i + 1}/${units.length}] ${u.id} ${old?.draft ? "(saved)" : r.draft ? "generated" : "FAILED"}`);
});

exactChecks(recs.filter((r) => !r.exact || arg.fresh));
for (const r of recs) {
  judge(r);
  save(r);
}

if (arg.publish) {
  let n = 0;
  for (const r of recs.filter((x) => x.verdict === "pass")) {
    const engine = ENGINE_VERIFIED.has(r.target.verifier);
    const practice = r.draft!.practice as { prompt: string; given: string; form: string; expected: string }[];
    const kept = engine ? practice.filter((_, i) => r.exact!.keys[i]) : practice;
    const example = r.exact!.example === false ? undefined : r.draft!.example;
    const res = await writeCache(r.target, { ...(r.draft as object), example } as never, kept, engine, { at: r.at, review: "pass" });
    if (res === "ok") n++;
    else console.warn(`publish ${r.id}: ${res}`);
  }
  console.log(`Published ${n} audited lessons to the shared cache.`);
}

// The report: totals by subject and grade, then everything a person should look at.
const by = new Map<string, { pass: number; flag: number; fail: number }>();
for (const r of recs) {
  const k = `${subjectMeta[r.target.subject].en} · Grade ${r.target.grade}`;
  const e = by.get(k) ?? { pass: 0, flag: 0, fail: 0 };
  e[r.verdict!]++;
  by.set(k, e);
}
const total = { pass: 0, flag: 0, fail: 0 };
for (const r of recs) total[r.verdict!]++;
const line = (r: Record_) => `- \`${r.id}\` ${r.target.title}\n${(r.reasons ?? []).map((x) => `  - ${x}`).join("\n")}`;
const md = [
  `# Lesson audit, ${new Date().toISOString().slice(0, 10)}`,
  "",
  `${recs.length} lessons: **${total.pass} pass**, **${total.flag} flagged** for a person to read, **${total.fail} failed** exact checks.`,
  "",
  "| Subject · grade | pass | flag | fail |",
  "|---|---|---|---|",
  ...[...by.entries()].sort().map(([k, e]) => `| ${k} | ${e.pass} | ${e.flag} | ${e.fail} |`),
  "",
  "## Failed exact checks (never published; regenerate with --fresh)",
  ...recs.filter((r) => r.verdict === "fail").map(line),
  "",
  "## Flagged by review (read the lesson in audit/lessons/<id>.json)",
  ...recs.filter((r) => r.verdict === "flag").map(line),
  "",
].join("\n");
writeFileSync(join(DIR, "report.md"), md);
console.log(`\n${total.pass} pass · ${total.flag} flagged · ${total.fail} failed. Report: audit/report.md`);
