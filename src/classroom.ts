/**
 * The classroom loop. Best-effort only: local state stays the source of truth on a device,
 * and every helper is a no-op when Supabase isn't configured, nobody is signed in, or the device is offline.
 *
 * Privacy rules (RA 10173):
 *  - Private practice never leaves the device. Attempts upload only when class-assigned.
 *  - Row Level Security decides who can read: teachers see attempts only on work they assigned,
 *    and test results (school.ts). Skill maps and self-practice are never visible to them.
 */
import { authConfigured, supabase } from "./lib/supabase";
import type { Attempt } from "./types";

const uuidLike = (v: string | null | undefined) => !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

async function signedIn() {
  if (!authConfigured || !supabase || typeof navigator === "undefined" || !navigator.onLine) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session ?? null;
  } catch {
    return null;
  }
}

/** Student -> Supabase: one attempt, when it is class-visible. Returns the server row id, or null. */
export async function pushAttempt(a: Attempt): Promise<string | null> {
  if (a.visibility !== "class") return null;
  const s = await signedIn();
  if (!s || !supabase) return null;
  try {
    const { data } = await supabase
      .from("attempts")
      .insert({
        user_id: s.user.id,
        assignment_id: uuidLike(a.assignmentId) ? a.assignmentId : null,
        problem_id: a.problemId,
        steps: a.steps,
        diagnosis: a.analysis,
        root_skill: a.rootSkill,
        visibility: "class",
        created_at: new Date(a.createdAt).toISOString(),
      })
      .select("id")
      .maybeSingle();
    return (data as { id: string } | null)?.id ?? null;
  } catch {
    return null;
  }
}

/** Teacher override, written back over RLS. */
export async function pushTeacherOverride(attemptId: string, override: { misconceptionId: string | null; note: string }) {
  const s = await signedIn();
  if (!s || !supabase || !uuidLike(attemptId)) return;
  try {
    await supabase.from("attempts").update({ teacher_override: override }).eq("id", attemptId);
  } catch {
    /* offline is fine */
  }
}
