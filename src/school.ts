/**
 * Classes, the quizzes and exams a teacher sends, and their results.
 * Teachers see a student only through these results (RLS in migration 0008): no skill maps, no self-practice.
 * Each call goes to Supabase, or to the on-device store when signed in with a local test account.
 */
import { MOCK_AUTH, useAuth } from "./auth";
import * as local from "./lib/localSchool";
import { supabase } from "./lib/supabase";

export type TestKind = "quiz" | "exam";
export interface ClassTest { id: string; classId: string; kind: TestKind; title: string; unitIds: string[]; studentIds: string[] | null; createdAt: string }
export interface TestResult { testId: string; userId: string; score: number; total: number; items: { unitId: string; right: boolean }[]; submittedAt: string }
export interface Pupil { id: string; name: string; joinedAt: string }

const me = () => useAuth.getState().user?.id ?? null;

type TestRow = { id: string; class_id: string; kind: TestKind; title: string; unit_ids: string[]; student_ids: string[] | null; created_at: string };
const fromRow = (r: TestRow): ClassTest => ({ id: r.id, classId: r.class_id, kind: r.kind, title: r.title, unitIds: r.unit_ids, studentIds: r.student_ids, createdAt: r.created_at });
type ResultRow = { assignment_id: string; user_id: string; score: number; total: number; items: TestResult["items"]; submitted_at: string };
const resultFrom = (r: ResultRow): TestResult => ({ testId: r.assignment_id, userId: r.user_id, score: r.score, total: r.total, items: r.items ?? [], submittedAt: r.submitted_at });
const TEST_COLS = "id, class_id, kind, title, unit_ids, student_ids, created_at";

/* ---- Teacher ------------------------------------------------------------ */

/** Students currently in the class. */
export async function fetchRoster(classId: string): Promise<Pupil[]> {
  if (MOCK_AUTH) {
    return local.load().members.filter((m) => m.classId === classId && m.role === "student" && m.leftAt === null)
      .map((m) => ({ id: m.userId, name: m.name, joinedAt: m.joinedAt }));
  }
  if (!supabase) return [];
  const { data } = await supabase.from("memberships").select("user_id, joined_at, profile:profiles(display_name)")
    .eq("class_id", classId).eq("role", "student").is("left_at", null);
  return ((data ?? []) as unknown as { user_id: string; joined_at: string; profile: { display_name: string } | null }[])
    .map((r) => ({ id: r.user_id, name: r.profile?.display_name ?? "Student", joinedAt: r.joined_at }));
}

/** Quizzes and exams sent to the class, newest first. */
export async function fetchTests(classId: string): Promise<ClassTest[]> {
  if (MOCK_AUTH) return local.load().tests.filter((t) => t.classId === classId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (!supabase) return [];
  const { data } = await supabase.from("assignments").select(TEST_COLS).eq("class_id", classId).in("kind", ["quiz", "exam"]).order("created_at", { ascending: false });
  return ((data ?? []) as TestRow[]).map(fromRow);
}

/** Results on those tests, from students still in the class. */
export async function fetchResults(classId: string): Promise<TestResult[]> {
  if (MOCK_AUTH) {
    const s = local.load();
    const tests = new Set(s.tests.filter((t) => t.classId === classId).map((t) => t.id));
    return s.results.filter((r) => tests.has(r.testId) && local.isStudentOf(s, classId, r.userId));
  }
  if (!supabase) return [];
  const ids = (await fetchTests(classId)).map((t) => t.id);
  if (!ids.length) return [];
  const { data } = await supabase.from("assignment_results").select("assignment_id, user_id, score, total, items, submitted_at").in("assignment_id", ids);
  return ((data ?? []) as ResultRow[]).map(resultFrom);
}

export async function sendTest(classId: string, t: { kind: TestKind; title: string; unitIds: string[]; studentIds: string[] | null }): Promise<ClassTest | null> {
  const uid = me();
  if (!uid) return null;
  if (MOCK_AUTH) {
    const test: ClassTest = { id: local.newId(), classId, ...t, createdAt: new Date().toISOString() };
    const ok = local.edit((s) => local.isTeacherOf(s, classId, uid) && (s.tests.push({ ...test, createdBy: uid }), true));
    return ok ? test : null;
  }
  if (!supabase) return null;
  const { data, error } = await supabase.from("assignments")
    .insert({ class_id: classId, kind: t.kind, title: t.title, unit_ids: t.unitIds, student_ids: t.studentIds, problem_ids: [], created_by: uid })
    .select(TEST_COLS).single();
  return error || !data ? null : fromRow(data as TestRow);
}

export async function deleteTest(id: string) {
  if (MOCK_AUTH) return void local.edit((s) => { s.tests = s.tests.filter((t) => t.id !== id); s.results = s.results.filter((r) => r.testId !== id); });
  await supabase?.from("assignments").delete().eq("id", id);
}

/** Take a student out of the class. Their progress and results stay theirs; the teacher stops seeing them. */
export async function removeStudent(classId: string, studentId: string): Promise<boolean> {
  const uid = me();
  if (MOCK_AUTH) {
    return local.edit((s) => {
      const m = s.members.find((x) => x.classId === classId && x.userId === studentId && x.role === "student" && x.leftAt === null);
      if (!uid || !local.isTeacherOf(s, classId, uid) || !m) return false;
      const now = new Date().toISOString();
      return Object.assign(m, { leftAt: now, removedAt: now }), true;
    });
  }
  if (!supabase) return false;
  return !(await supabase.rpc("remove_student", { cid: classId, student: studentId })).error;
}

/** Undo a removal. */
export async function readmitStudent(classId: string, studentId: string): Promise<boolean> {
  const uid = me();
  if (MOCK_AUTH) {
    return local.edit((s) => {
      const m = s.members.find((x) => x.classId === classId && x.userId === studentId && x.removedAt);
      if (!uid || !local.isTeacherOf(s, classId, uid) || !m) return false;
      return Object.assign(m, { leftAt: null, removedAt: null }), true;
    });
  }
  if (!supabase) return false;
  return !(await supabase.rpc("readmit_student", { cid: classId, student: studentId })).error;
}

/** Live updates for a teacher's class page. Local accounts update across tabs through storage events. */
export function watchClass(classId: string, onChange: () => void): () => void {
  if (MOCK_AUTH) {
    const fn = (e: StorageEvent) => e.key === "hopper-local-school" && onChange();
    window.addEventListener("storage", fn);
    return () => window.removeEventListener("storage", fn);
  }
  if (!supabase) return () => {};
  const ch = supabase.channel(`class-${classId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "assignment_results" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "memberships", filter: `class_id=eq.${classId}` }, onChange)
    .subscribe();
  return () => void supabase?.removeChannel(ch);
}

/* ---- Student ------------------------------------------------------------ */

export interface MyTest { test: ClassTest; className: string; result: TestResult | null }

/** Tests sent to me in the classes I'm in, newest first, with my result once taken. */
export async function fetchMyTests(): Promise<MyTest[]> {
  const uid = me();
  if (!uid) return [];
  if (MOCK_AUTH) {
    const s = local.load();
    return s.tests
      .filter((t) => local.isStudentOf(s, t.classId, uid) && (!t.studentIds || t.studentIds.includes(uid)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((t) => ({ test: t, className: s.classes.find((c) => c.id === t.classId)?.name ?? "", result: s.results.find((r) => r.testId === t.id && r.userId === uid) ?? null }));
  }
  if (!supabase) return [];
  const [{ data: tests }, { data: results }] = await Promise.all([
    supabase.from("assignments").select(`${TEST_COLS}, class:classes(name)`).in("kind", ["quiz", "exam"]).order("created_at", { ascending: false }),
    supabase.from("assignment_results").select("assignment_id, user_id, score, total, items, submitted_at").eq("user_id", uid),
  ]);
  const mine = ((results ?? []) as ResultRow[]).map(resultFrom);
  return ((tests ?? []) as unknown as (TestRow & { class: { name: string } | null })[])
    .map((r) => ({ test: fromRow(r), className: r.class?.name ?? "", result: mine.find((x) => x.testId === r.id) ?? null }));
}

/** Submit my result. Only right/wrong per item leaves the device, never the typed answers. */
export async function submitResult(testId: string, score: number, total: number, items: TestResult["items"]): Promise<boolean> {
  const uid = me();
  if (!uid) return false;
  if (MOCK_AUTH) {
    return local.edit((s) => {
      const t = s.tests.find((x) => x.id === testId);
      if (!t || !local.isStudentOf(s, t.classId, uid) || s.results.some((r) => r.testId === testId && r.userId === uid)) return false;
      s.results.push({ testId, userId: uid, score, total, items, submittedAt: new Date().toISOString() });
      return true;
    });
  }
  if (!supabase) return false;
  return !(await supabase.from("assignment_results").insert({ assignment_id: testId, user_id: uid, score, total, items })).error;
}
