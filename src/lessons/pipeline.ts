import type { PlanUnit, SubjectId } from "../data/curriculum";
import type { Skill } from "../types";
import { deviceGet, deviceSet } from "./store";
import { engine } from "../engine/client";
import { supabase } from "../lib/supabase";
import type { Form, Lesson } from "../types";

export interface CachedLesson {
  lesson: Lesson;
  /** True only when every practice key passed the engine. Otherwise the UI says "AI-checked". */
  verified: boolean;
  source: "device" | "shared" | "generated";
}

const TIMEOUT_MS = 30_000;
/** Verifier tags the offline engine checks. Only "llm" units are published as AI-checked.
 * Statistics and geometry keys are verified as calculations: `given` is the computation, the engine confirms the value. */
const ENGINE_VERIFIED = new Set(["sympy", "arithmetic", "statistics", "geometry", "units", "chemistry"]);

type Draft = {
  /** Server signature over the generated lesson; lets /api/publish accept it into the shared cache. */
  sig?: string; en: Lesson["en"]; fil: Lesson["fil"]; practice: { prompt: string; given: string; form: Form; expected: string }[] };

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

export const unitTarget = (u: PlanUnit): LessonTarget => ({ id: u.id, subject: u.subject, grade: u.grade, quarter: u.quarter, domain: u.domain, title: u.title.en, verifier: u.verifier });
export const skillTarget = (k: Skill): LessonTarget => ({ id: `skill:${k.id}`, subject: "math", grade: k.grade, quarter: 1, domain: k.id, title: k.title, verifier: "sympy" });

/** The gate: keep only practice items whose key the engine accepts. */
async function gate(unit: LessonTarget, d: Draft): Promise<{ lesson: Lesson; verified: boolean } | null> {
  const engineChecked = ENGINE_VERIFIED.has(unit.verifier);
  const kept: Draft["practice"] = [];
  for (const p of d.practice) {
    if (!engineChecked) {
      kept.push(p);
      continue;
    }
    try {
      if ((await engine.check(p.given, p.expected, p.form)).correct) kept.push(p);
    } catch {
      /* unparseable item: drop it */
    }
  }
  if (kept.length < 2) return null; // too many wrong keys: discard the whole lesson
  const lesson: Lesson = { en: d.en, fil: d.fil, practice: kept.map(({ prompt, given, form }) => ({ prompt, given, form })) };
  return { lesson, verified: engineChecked };
}

async function generate(unit: LessonTarget): Promise<Draft | null> {
  if (!navigator.onLine) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch("/api/lesson", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: unit.id }), // the server knows what the id means
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

/** device cache → shared cache → generate, verify, publish. Returns null when nothing is available (offline, timeout, failed gate). */
export async function getLesson(unit: LessonTarget): Promise<CachedLesson | null> {
  const local = await deviceGet<{ lesson: Lesson; verified: boolean }>(unit.id);
  if (local) return { ...local, source: "device" };

  if (supabase && navigator.onLine) {
    const { data } = await supabase.from("lesson_cache").select("content, verified").eq("unit_id", unit.id).maybeSingle();
    if (data) {
      const hit = { lesson: data.content as Lesson, verified: data.verified as boolean };
      await deviceSet(unit.id, hit);
      return { ...hit, source: "shared" };
    }
  }

  const draft = await generate(unit);
  if (!draft) return null;
  const checked = await gate(unit, draft);
  if (!checked) return null;
  await deviceSet(unit.id, checked);
  if (draft.sig) void publish(unit.id, draft); // the server re-checks every key with SymPy before the shared cache accepts it
  return { ...checked, source: "generated" };
}
