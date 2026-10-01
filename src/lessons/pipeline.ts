import type { PlanUnit, SubjectId } from "../data/curriculum";
import type { Goal } from "../data/curriculum";
import type { Skill } from "../types";
import { deviceGet, deviceSet } from "./store";
import { engine } from "../engine/client";
import { supabase } from "../lib/supabase";
import type { Form, Lesson } from "../types";

export const LESSON_FORMAT = 3;
const current = (l: Lesson | null | undefined) => (l?.format ?? 1) >= LESSON_FORMAT;

export interface CachedLesson {
  lesson: Lesson;
  /** True only when every practice key passed the engine. Otherwise the UI says "AI-checked". */
  verified: boolean;
  source: "device" | "shared" | "generated";
}

const TIMEOUT_MS = 45_000;
/** Verifier tags the offline engine checks. Only "llm" units are published as AI-checked.
 * Statistics and geometry keys are verified as calculations: `given` is the computation, the engine confirms the value. */
const ENGINE_VERIFIED = new Set(["sympy", "arithmetic", "statistics", "geometry", "units", "chemistry"]);

type Draft = {
  /** Server signature over the generated lesson; lets /api/publish accept it into the shared cache. */
  sig?: string; en: Lesson["en"]; fil: Lesson["fil"]; ceb?: Lesson["ceb"]; example?: Lesson["example"]; figure?: Lesson["figure"]; checkAnswer?: number; practice: { prompt: string; given: string; form: Form; expected: string }[] };

/** What a lesson is about. Plan units and the original 14 skills both reduce to this. */
export interface LessonTarget {
  id: string;
  subject: SubjectId;
  grade: number;
  quarter: number;
  domain: string;
  title: string;
  verifier: PlanUnit["verifier"];
}

export const unitTarget = (u: PlanUnit): LessonTarget => ({ id: u.id, subject: u.subject, grade: u.grade, quarter: u.quarter, domain: u.domain, title: u.title, verifier: u.verifier });
export const skillTarget = (k: Skill): LessonTarget => ({ id: `skill:${k.id}`, subject: "math", grade: k.grade, quarter: 1, domain: k.id, title: k.title, verifier: "sympy" });

/**
 * The gate. Items whose key the engine confirms are kept as verified; items it proves wrong are dropped;
 * items it can't express at all (points, words) are kept as AI-checked with their key, so one odd topic
 * doesn't sink the lesson. The lesson is "verified" only when every item is.
 */
async function gate(unit: LessonTarget, d: Draft): Promise<{ lesson: Lesson; verified: boolean } | null> {
  const engineChecked = ENGINE_VERIFIED.has(unit.verifier);
  const kept: Lesson["practice"] = [];
  for (const p of d.practice) {
    const item = { prompt: p.prompt, given: p.given, form: p.form };
    if (!engineChecked) {
      kept.push({ ...item, expected: p.expected, ai: true });
      continue;
    }
    let reason = "unparsed";
    try {
      const r = await engine.check(p.given, p.expected, p.form);
      // The confirmed key stays with the item so a stuck learner can be shown it.
      if (r.correct) { kept.push({ ...item, expected: p.expected }); continue; }
      reason = r.reason ?? "not_equivalent";
      // Right answer, wrong form label (e.g. "solved" on a plain number): keep it, graded without the form rule.
      if (/^not_(solved|expanded|factored)$/.test(reason) && (await engine.check(p.given, p.expected, "any")).correct) {
        kept.push({ ...item, expected: p.expected, form: "any" });
        continue;
      }
    } catch { /* unparsed */ }
    if (reason === "unparsed" || reason === "unverifiable") kept.push({ ...item, expected: p.expected, ai: true });
  }
  if (kept.length < 2) return null; // too many provably wrong keys: discard (the caller retries once)
  const example = engineChecked ? await checkExample(d.example) : d.example;
  const lesson: Lesson = {
    en: d.en, fil: d.fil, ...(d.ceb ? { ceb: d.ceb } : {}),
    practice: kept,
    ...(example ? { example } : {}),
    ...(d.figure ? { figure: d.figure } : {}),
    ...(typeof d.checkAnswer === "number" ? { checkAnswer: d.checkAnswer } : {}),
    format: LESSON_FORMAT,
  };
  return { lesson, verified: engineChecked && kept.every((p) => !p.ai) };
}

/** Grade one practice answer: the engine for verified items; AI-checked items against their key. */
export async function checkPractice(p: Lesson["practice"][number], answer: string): Promise<boolean> {
  if (!p.ai) return (await engine.check(p.given, answer, p.form)).correct;
  const key = p.expected ?? "";
  try {
    const r = await engine.check(key, answer, p.form === "solved" ? "any" : p.form);
    if (r.correct || r.reason === "not_equivalent") return r.correct;
  } catch { /* fall through */ }
  const norm = (s: string) => s.toLowerCase().replace(/\s+|\*|\\/g, "").replace(/^[a-z]=/, "");
  return norm(answer) === norm(key);
}

/** A worked example is shown only if the engine agrees every step follows from the one before. */
async function checkExample(ex: Lesson["example"]): Promise<Lesson["example"] | undefined> {
  if (!ex?.problemTyped || ex.steps.some((s) => !s.typed)) return undefined;
  try {
    const a = await engine.analyze(ex.problemTyped, ex.steps.map((s) => s.typed!), ex.kind ?? "solve");
    return !a.error && a.steps.length === ex.steps.length && a.steps.every((s) => s.status === "ok") ? ex : undefined;
  } catch {
    return undefined;
  }
}

async function generate(unit: LessonTarget, goal: Goal | null): Promise<Draft | null> {
  if (!navigator.onLine) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch("/api/lesson", {
      method: "POST",
      headers: { "content-type": "application/json" },
      // goal is the learner's intent enum from onboarding; it only frames the writing.
      body: JSON.stringify({ id: unit.id, ...(goal ? { goal } : {}) }), // the server knows what the id means
      signal: ctrl.signal,
    });
    return res.ok ? ((await res.json()) as Draft) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function publish(id: string, draft: Draft) {
  try {
    await fetch("/api/publish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, draft, sig: draft.sig }) });
  } catch {
    /* best effort: the lesson already works on this device */
  }
}

/** device cache → shared cache → generate, verify, publish. Returns null when nothing is available (offline, timeout, failed gate).
 * `goal` frames a freshly generated lesson (see api/lesson.ts); cached lessons are served as-is, whatever the goal. */
export async function getLesson(unit: LessonTarget, goal: Goal | null = null): Promise<CachedLesson | null> {
  const local = await deviceGet<{ lesson: Lesson; verified: boolean }>(unit.id);
  // An old-format lesson still works offline; online, it's replaced by the richer one.
  if (local && (current(local.lesson) || !navigator.onLine)) return { ...local, source: "device" };

  if (supabase && navigator.onLine) {
    const { data } = await supabase.from("lesson_cache").select("content, verified").eq("unit_id", unit.id).maybeSingle();
    if (data && current(data.content as Lesson)) {
      const content = data.content as Lesson;
      // The server can't run the engine, so worked examples from the shared cache are re-checked here.
      const example = ENGINE_VERIFIED.has(unit.verifier) ? await checkExample(content.example) : content.example;
      // Items the engine can't check are graded against their stored key, as on the device that generated them.
      const practice = ENGINE_VERIFIED.has(unit.verifier) ? content.practice : content.practice.map((p) => ({ ...p, ai: true }));
      const hit = { lesson: { ...content, example, practice }, verified: data.verified as boolean };
      await deviceSet(unit.id, hit);
      return { ...hit, source: "shared" };
    }
  }

  // One retry: generation varies, and a second draft usually passes where the first didn't.
  let draft = await generate(unit, goal);
  let checked = draft && (await gate(unit, draft));
  if (draft && !checked) {
    draft = await generate(unit, goal);
    checked = draft && (await gate(unit, draft));
  }
  if (!draft || !checked) return local ? { ...local, source: "device" } : null;
  await deviceSet(unit.id, checked);
  if (draft.sig) void publish(unit.id, draft); // the server re-checks every key with SymPy before the shared cache accepts it
  return { ...checked, source: "generated" };
}
