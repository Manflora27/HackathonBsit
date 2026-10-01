import type { PlanUnit } from "../data/curriculum";
import { engine } from "../engine/client";
import { supabase } from "../lib/supabase";
import type { Form, Lesson } from "../types";

export interface CachedLesson {
  lesson: Lesson;
  /** True only when every practice key passed the engine. Otherwise the UI says "AI-checked". */
  verified: boolean;
  source: "device" | "shared" | "generated";
}

const LS = (id: string) => `gf-lesson:${id}`;
const TIMEOUT_MS = 30_000;
/** Verifier tags the offline engine can check today. Others are published as AI-checked until their verifier exists. */
const ENGINE_VERIFIED = new Set(["sympy", "arithmetic"]);

type Draft = { en: Lesson["en"]; fil: Lesson["fil"]; practice: { prompt: string; given: string; form: Form; expected: string }[] };

function readDevice(id: string): { lesson: Lesson; verified: boolean } | null {
  try {
    const raw = localStorage.getItem(LS(id));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** The gate: keep only practice items whose key the engine accepts. */
async function gate(unit: PlanUnit, d: Draft): Promise<{ lesson: Lesson; verified: boolean } | null> {
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

async function generate(unit: PlanUnit): Promise<Draft | null> {
  if (!navigator.onLine) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch("/api/lesson", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subject: unit.subject, grade: unit.grade, quarter: unit.quarter, domain: unit.domain, title: unit.title.en, verifier: unit.verifier }),
      signal: ctrl.signal,
    });
    return res.ok ? ((await res.json()) as Draft) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** device cache → shared cache → generate, verify, publish. Returns null when nothing is available (offline, timeout, failed gate). */
export async function getLesson(unit: PlanUnit): Promise<CachedLesson | null> {
  const local = readDevice(unit.id);
  if (local) return { ...local, source: "device" };

  if (supabase && navigator.onLine) {
    const { data } = await supabase.from("lesson_cache").select("content, verified").eq("unit_id", unit.id).maybeSingle();
    if (data) {
      const hit = { lesson: data.content as Lesson, verified: data.verified as boolean };
      localStorage.setItem(LS(unit.id), JSON.stringify(hit));
      return { ...hit, source: "shared" };
    }
  }

  const draft = await generate(unit);
  if (!draft) return null;
  const checked = await gate(unit, draft);
  if (!checked) return null;
  localStorage.setItem(LS(unit.id), JSON.stringify(checked));
  if (supabase) await supabase.from("lesson_cache").insert({ unit_id: unit.id, content: checked.lesson, verified: checked.verified, verifier: unit.verifier });
  return { ...checked, source: "generated" };
}
