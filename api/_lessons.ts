// Server-side truth about what a lesson id means, so a client can't ask for content under someone else's id.
import { createHmac, timingSafeEqual } from "node:crypto";
import { unitById, type VerifierId } from "../src/data/curriculum.js";
import skillsJson from "../src/data/skills.json" with { type: "json" };

export interface Target {
  id: string;
  subject: "math" | "science";
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
  return u ? { id, subject: u.subject, grade: u.grade, quarter: u.quarter, domain: u.domain, title: u.title.en, verifier: u.verifier } : null;
}

/** Verifier tags the engine can check. Others are published unverified ("AI-checked"). */
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
