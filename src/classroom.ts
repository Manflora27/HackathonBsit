/**
 * The classroom loop. Best-effort only: local state stays the source of truth on a device,
 * and every helper is a no-op when Supabase isn't configured, nobody is signed in, or the device is offline.
 * Failures don't interrupt the learner, but they are logged (lib/remote.ts), never swallowed.
 *
 * Privacy rules (RA 10173):
 *  - Private practice never leaves the device. Attempts upload only when class-assigned.
 *  - Unit progress (finished / stuck) uploads only for the subject of a class the student is in, and
 *    only that class's teacher can read it (migration 0010). Other subjects stay on the device.
 *  - Row Level Security decides who can read: teachers see attempts only on work they assigned,
 *    and test results (school.ts). Skill maps and self-practice are never visible to them.
 */
import { MOCK_AUTH, useAuth } from "./auth";
import * as local from "./lib/localSchool";
import { remote, report } from "./lib/remote";
import { authConfigured, supabase } from "./lib/supabase";
import type { Attempt, SkillStatus } from "./types";

const uuidLike = (v: string | null | undefined) => !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

async function signedIn() {
  if (!authConfigured || !supabase || typeof navigator === "undefined" || !navigator.onLine) return null;
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) report("getSession", error);
    return data.session ?? null;
  } catch (e) {
    report("getSession", e);
    return null;
  }
}

/** Student -> Supabase: one attempt, when it is class-visible. Returns the server row id, or null. */
export async function pushAttempt(a: Attempt): Promise<string | null> {
  if (a.visibility !== "class") return null;
  const s = await signedIn();
  if (!s || !supabase) return null;
  // One try: a retried insert after a lost answer would count the attempt twice in the teacher's view.
  const { data } = await remote("pushAttempt", () => supabase!
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
    .maybeSingle(), { tries: 1 });
  return (data as { id: string } | null)?.id ?? null;
}

/** Teacher override, written back over RLS. */
export async function pushTeacherOverride(attemptId: string, override: { misconceptionId: string | null; note: string }) {
  const s = await signedIn();
  if (!s || !supabase || !uuidLike(attemptId)) return;
  await remote("pushTeacherOverride", () => supabase!.from("attempts").update({ teacher_override: override }).eq("id", attemptId));
}

/** Subjects of the classes I'm in as a student: the only progress a teacher may see. */
function sharedSubjects(): string[] {
  return [...new Set(useAuth.getState().classes.map((c) => c.subject).filter((x): x is NonNullable<typeof x> => !!x))];
}

/** Plan unit ids start with their subject and grade: "math-g8-q1-na". Built-in skills and other subjects don't match. */
const inSubject = (unitId: string, subjects: string[]) => subjects.some((s) => unitId.startsWith(`${s}-g`));

/** Student -> Supabase: progress on units of a class subject, so that class's teacher can follow it. */
export async function pushProgress(entries: [unitId: string, status: SkillStatus][]) {
  const subjects = sharedSubjects();
  const rows = entries.filter(([id]) => inSubject(id, subjects));
  if (!rows.length) return;
  if (MOCK_AUTH) {
    const uid = useAuth.getState().user?.id;
    if (uid) local.edit((s) => { s.progress[uid] = { ...s.progress[uid], ...Object.fromEntries(rows) }; });
    return;
  }
  const s = await signedIn();
  if (!s || !supabase) return;
  const at = new Date().toISOString();
  // Upserts are safe to retry: the same row lands either way.
  await remote("pushProgress", () => supabase!.from("skill_progress")
    .upsert(rows.map(([skill_id, status]) => ({ user_id: s.user.id, skill_id, status, updated_at: at }))));
}

/** Bring the teacher's view up to date: everything already done in class subjects (after joining, or after being offline). */
export function syncClassProgress(progress: Record<string, SkillStatus>) {
  return pushProgress(Object.entries(progress));
}
