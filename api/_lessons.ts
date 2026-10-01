// Server-side truth about what a lesson id means, so a client can't ask for content under someone else's id.
import { createHmac, timingSafeEqual } from "node:crypto";
import { unitById, type SubjectId, type VerifierId } from "../src/data/curriculum.js";
import skillsJson from "../src/data/skills.json" with { type: "json" };

export interface Target {
  id: string;
  subject: SubjectId;
  grade: number;
  quarter: number;
  domain: string;
  title: string;
  verifier: VerifierId;
}

export function resolve(id: unknown): Target | null {
  if (typeof id !== "string") return null;
  if (id.startsWith("skill:")) {
    const k = (skillsJson.skills as { id: string; grade: number; title: string }[]).find((s) => s.id === id.slice(6));
    return k ? { id, subject: "math", grade: k.grade, quarter: 1, domain: k.id, title: k.title, verifier: "sympy" } : null;
  }
  const u = unitById(id);
  return u ? { id, subject: u.subject, grade: u.grade, quarter: u.quarter, domain: u.domain, title: u.title, verifier: u.verifier } : null;
}

/** Verifier tags the engine can check. Others are published unverified ("AI-checked").
 * This set is the verification queue's gate: a generated lesson's practice keys are
 * re-solved with the unit's verifier, failures are dropped, and only passing keys
 * reach the shared cache (see writeCache below). */
export const ENGINE_VERIFIED = new Set<VerifierId>(["sympy", "arithmetic", "statistics", "geometry", "units", "chemistry"]);

function secret() {
  const k = process.env.LESSON_SIGNING_KEY;
  if (!k) throw new Error("LESSON_SIGNING_KEY is not set");
  return k;
}

/** Signature over the lesson as the server generated it. Publishing requires it, so content can't be tampered with. */
export function sign(id: string, draft: unknown) {
  return createHmac("sha256", secret()).update(id).update("\0").update(JSON.stringify(draft)).digest("hex");
}

export function verifySig(id: string, draft: unknown, sig: unknown) {
  if (typeof sig !== "string") return false;
  const a = Buffer.from(sign(id, draft));
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

type CacheItem = { prompt: string; given: string; form: string; expected: string };

/**
 * Put a checked lesson in the shared cache (service role; only the server and the audit script do this).
 * `kept` is the practice that passed SymPy. Replaces an older row for the same unit.
 */
export async function writeCache(
  target: Target,
  clean: { en: unknown; fil: unknown; ceb?: unknown; example?: unknown; figure?: unknown; checkAnswer?: number },
  kept: CacheItem[],
  verified: boolean,
  audit?: { at: string; review: "pass" },
): Promise<"ok" | "failed" | "unconfigured"> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return "unconfigured";
  const content = {
    en: clean.en, fil: clean.fil, ...(clean.ceb ? { ceb: clean.ceb } : {}), ...(clean.example ? { example: clean.example } : {}), ...(clean.figure ? { figure: clean.figure } : {}),
    ...(typeof clean.checkAnswer === "number" && clean.checkAnswer >= 0 ? { checkAnswer: clean.checkAnswer } : {}),
    ...(audit ? { audit } : {}),
    // Keys are kept: SymPy just confirmed them, and a stuck learner can be shown one.
    format: 3, practice: kept.map(({ prompt, given, form, expected }) => ({ prompt, given, form, expected })),
  };
  const res = await fetch(`${url}/rest/v1/lesson_cache?on_conflict=unit_id`, {
    method: "POST",
    headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json", prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ unit_id: target.id, content, verified, verifier: target.verifier }),
  });
  return res.ok ? "ok" : "failed";
}
