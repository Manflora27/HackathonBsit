/**
 * Classes, the quizzes and exams a teacher sends, and their results.
 * Teachers see a student only through these results (RLS in migration 0008): no skill maps, no self-practice.
 * Each call goes to Supabase, or to the on-device store when signed in with a local test account.
 */
import { MOCK_AUTH, useAuth } from "./auth";
import * as local from "./lib/localSchool";
import { remote, report } from "./lib/remote";
import { supabase } from "./lib/supabase";

export type TestKind = "quiz" | "exam";
/** One question of a teacher's test, made and checked when the test was made (api/ai.ts makeTest). */
export interface TestQuestion {
  unitId: string;
  difficulty: "easy" | "medium" | "hard";
  kind: "typed" | "choice";
  prompt: string;
  given: string;
  expected: string;
  form: "any" | "expanded" | "factored" | "solved";
  choices: string[];
  answer: number;
  why: string;
}
export interface ClassTest { id: string; classId: string; kind: TestKind; title: string; unitIds: string[]; studentIds: string[] | null; createdAt: string;
  /** The test's own questions. Null on tests made before migration 0011: those use lesson practice. */
  questions: TestQuestion[] | null }
/** `q` is the question's index in the test (tests with their own questions), so the teacher sees which ones the class found hard. */
export interface TestResult { testId: string; userId: string; score: number; total: number; items: { unitId: string; right: boolean; q?: number }[]; submittedAt: string }
export interface Pupil { id: string; name: string; joinedAt: string }

const me = () => useAuth.getState().user?.id ?? null;

type TestRow = { id: string; class_id: string; kind: TestKind; title: string; unit_ids: string[]; student_ids: string[] | null; created_at: string; questions?: TestQuestion[] | null };
const fromRow = (r: TestRow): ClassTest => ({ id: r.id, classId: r.class_id, kind: r.kind, title: r.title, unitIds: r.unit_ids, studentIds: r.student_ids, createdAt: r.created_at, questions: r.questions ?? null });
type ResultRow = { assignment_id: string; user_id: string; score: number; total: number; items: TestResult["items"]; submitted_at: string };
const resultFrom = (r: ResultRow): TestResult => ({ testId: r.assignment_id, userId: r.user_id, score: r.score, total: r.total, items: r.items ?? [], submittedAt: r.submitted_at });
const TEST_COLS = "id, class_id, kind, title, unit_ids, student_ids, created_at, questions";

/* ---- Teacher ------------------------------------------------------------ */

export const ROSTER_PAGE = 100;
/** PostgREST answers at most this many rows per request (Supabase default max-rows); more must be paged. */
const MAX_ROWS = 1000;

/** One page of the students currently in the class, in join order, plus how many there are in all. */
export async function fetchRoster(classId: string, opts?: { offset?: number; limit?: number }): Promise<{ pupils: Pupil[]; total: number }> {
  const offset = opts?.offset ?? 0;
  const limit = opts?.limit ?? ROSTER_PAGE;
  if (MOCK_AUTH) {
    const all = local.load().members.filter((m) => m.classId === classId && m.role === "student" && m.leftAt === null)
      .map((m) => ({ id: m.userId, name: m.name, joinedAt: m.joinedAt }));
    return { pupils: all.slice(offset, offset + limit), total: all.length };
  }
  if (!supabase) return { pupils: [], total: 0 };
  const { data, count } = await remote("fetchRoster", () => supabase!.from("memberships").select("user_id, joined_at, profile:profiles(display_name)", { count: "exact" })
    .eq("class_id", classId).eq("role", "student").is("left_at", null).order("joined_at").order("user_id").range(offset, offset + limit - 1));
  const pupils = ((data ?? []) as unknown as { user_id: string; joined_at: string; profile: { display_name: string } | null }[])
    .map((r) => ({ id: r.user_id, name: r.profile?.display_name ?? "Student", joinedAt: r.joined_at }));
  return { pupils, total: count ?? pupils.length };
}

/** How many students are in the class, without fetching them. */
export async function countRoster(classId: string): Promise<number | null> {
  if (MOCK_AUTH) return (await fetchRoster(classId)).total;
  if (!supabase) return null;
  const { count, error } = await remote("countRoster", () => supabase!.from("memberships").select("user_id", { count: "exact", head: true })
    .eq("class_id", classId).eq("role", "student").is("left_at", null));
  return error ? null : count ?? 0;
}

/** Quizzes and exams sent to the class, newest first. Bounded; history beyond the cap stays in the database, not on the page. */
export async function fetchTests(classId: string, opts?: { limit?: number }): Promise<ClassTest[]> {
  const limit = opts?.limit ?? 50;
  if (MOCK_AUTH) return local.load().tests.filter((t) => t.classId === classId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  if (!supabase) return [];
  const { data } = await remote("fetchTests", () => supabase!.from("assignments").select(TEST_COLS).eq("class_id", classId).in("kind", ["quiz", "exam"]).order("created_at", { ascending: false }).range(0, limit - 1));
  return ((data ?? []) as TestRow[]).map(fromRow);
}

/**
 * Results on the latest tests, from students still in the class. Bounded by test count first; then paged,
 * because 20 tests x 60 students is already past the 1000 rows one request returns, and the rest would be
 * dropped without an error.
 */
export async function fetchResults(classId: string, opts?: { tests?: number }): Promise<TestResult[]> {
  const testLimit = opts?.tests ?? 20;
  if (MOCK_AUTH) {
    const s = local.load();
    const tests = new Set(s.tests.filter((t) => t.classId === classId).map((t) => t.id));
    return s.results.filter((r) => tests.has(r.testId) && local.isStudentOf(s, classId, r.userId));
  }
  if (!supabase) return [];
  const ids = (await fetchTests(classId, { limit: testLimit })).map((t) => t.id);
  if (!ids.length) return [];
  const rows: ResultRow[] = [];
  for (let from = 0; ; from += MAX_ROWS) {
    const { data, error } = await remote("fetchResults", () => supabase!.from("assignment_results").select("assignment_id, user_id, score, total, items, submitted_at")
      .in("assignment_id", ids).order("submitted_at").order("user_id").range(from, from + MAX_ROWS - 1));
    rows.push(...((data ?? []) as ResultRow[]));
    if (error || (data ?? []).length < MAX_ROWS) break;
  }
  return rows.map(resultFrom);
}

export async function sendTest(classId: string, t: { kind: TestKind; title: string; unitIds: string[]; studentIds: string[] | null; questions: TestQuestion[] | null }): Promise<ClassTest | null> {
  const uid = me();
  if (!uid) return null;
  if (MOCK_AUTH) {
    const test: ClassTest = { id: local.newId(), classId, ...t, createdAt: new Date().toISOString() };
    const ok = local.edit((s) => local.isTeacherOf(s, classId, uid) && (s.tests.push({ ...test, createdBy: uid }), true));
    return ok ? test : null;
  }
  if (!supabase) return null;
  // One try: a retried insert whose first answer was lost would send the test twice.
  const { data, error } = await remote("sendTest", () => supabase!.from("assignments")
    .insert({ class_id: classId, kind: t.kind, title: t.title, unit_ids: t.unitIds, student_ids: t.studentIds, questions: t.questions, problem_ids: [], created_by: uid })
    .select(TEST_COLS).single(), { tries: 1 });
  return error || !data ? null : fromRow(data as TestRow);
}

export async function deleteTest(id: string) {
  if (MOCK_AUTH) return void local.edit((s) => { s.tests = s.tests.filter((t) => t.id !== id); s.results = s.results.filter((r) => r.testId !== id); });
  if (supabase) await remote("deleteTest", () => supabase!.from("assignments").delete().eq("id", id));
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
  return !(await remote("removeStudent", () => supabase!.rpc("remove_student", { cid: classId, student: studentId }))).error;
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
  return !(await remote("readmitStudent", () => supabase!.rpc("readmit_student", { cid: classId, student: studentId }))).error;
}

/**
 * Live updates for a teacher's class page. Changes are batched (a whole class submitting a quiz is one reload,
 * not forty). `onLive` says whether the live connection is up; after it drops and comes back, `onChange` fires
 * once so whatever happened in between is picked up. Local accounts update across tabs through storage events.
 */
export function watchClass(classId: string, onChange: () => void, onLive?: (live: boolean) => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const changed = () => {
    clearTimeout(timer);
    timer = setTimeout(onChange, 1500);
  };
  // Back online after a drop: the realtime socket rejoins on its own, but refetch now rather than wait.
  const online = () => onChange();
  window.addEventListener("online", online);
  if (MOCK_AUTH) {
    const fn = (e: StorageEvent) => e.key === "hopper-local-school" && changed();
    window.addEventListener("storage", fn);
    return () => { clearTimeout(timer); window.removeEventListener("storage", fn); window.removeEventListener("online", online); };
  }
  if (!supabase) return () => window.removeEventListener("online", online);
  let closed = false;
  let dropped = false;
  const ch = supabase.channel(`class-${classId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "assignment_results" }, changed)
    .on("postgres_changes", { event: "*", schema: "public", table: "memberships", filter: `class_id=eq.${classId}` }, changed)
    .subscribe((status, err) => {
      if (closed) return;
      if (status === "SUBSCRIBED") {
        onLive?.(true);
        if (dropped) onChange();
        dropped = false;
      } else {
        // CHANNEL_ERROR, TIMED_OUT, CLOSED: supabase-js keeps retrying; the page says updates are paused.
        if (!dropped) report(`watchClass ${status}`, err ?? status);
        dropped = true;
        onLive?.(false);
      }
    });
  return () => {
    closed = true;
    clearTimeout(timer);
    window.removeEventListener("online", online);
    void supabase?.removeChannel(ch);
  };
}

/**
 * One student's progress in this class's subject: unit id -> finished ("mastered") or stuck ("gap").
 * The database only returns units of the class subject (migration 0010); other subjects never reach a teacher.
 */
export async function fetchSubjectProgress(classId: string, studentId: string, subject: string): Promise<Record<string, string>> {
  const uid = me();
  if (MOCK_AUTH) {
    const s = local.load();
    if (!uid || !local.isTeacherOf(s, classId, uid) || !local.isStudentOf(s, classId, studentId)) return {};
    return Object.fromEntries(Object.entries(s.progress[studentId] ?? {}).filter(([id]) => id.startsWith(`${subject}-g`)));
  }
  if (!supabase) return {};
  const { data } = await remote("fetchSubjectProgress", () => supabase!.from("skill_progress").select("skill_id, status")
    .eq("user_id", studentId).like("skill_id", `${subject}-g%`));
  return Object.fromEntries(((data ?? []) as { skill_id: string; status: string }[]).map((r) => [r.skill_id, r.status]));
}

/* ---- Student ------------------------------------------------------------ */

export interface ClassPreview { name: string; section: string | null; subject: string | null; grade: number | null; teacher: string | null; removed: boolean }

/** What a class code leads to, before joining: the class and its teacher. Null when no class has that code. */
export async function previewClass(code: string): Promise<ClassPreview | null> {
  const want = code.trim().toUpperCase();
  if (MOCK_AUTH) {
    const s = local.load();
    const c = s.classes.find((x) => x.class_code.toUpperCase() === want);
    if (!c) return null;
    const uid = me();
    return { name: c.name, section: c.section, subject: c.subject ?? null, grade: c.grade ?? null, teacher: s.profiles[c.ownerId]?.display_name ?? null,
      removed: s.members.some((m) => m.classId === c.id && m.userId === uid && !!m.removedAt) };
  }
  if (!supabase) return null;
  const { data } = await remote("previewClass", () => supabase!.rpc("class_preview", { code: want }));
  return ((data ?? []) as ClassPreview[])[0] ?? null;
}

export interface MyTest { test: ClassTest; className: string; result: TestResult | null }

/** Tests sent to me in the classes I'm in, newest first (the latest 50), with my result once taken. */
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
  const { data: tests } = await remote("fetchMyTests", () => supabase!.from("assignments").select(`${TEST_COLS}, class:classes(name)`)
    .in("kind", ["quiz", "exam"]).order("created_at", { ascending: false }).range(0, 49));
  const ids = ((tests ?? []) as TestRow[]).map((t) => t.id);
  const { data: results } = ids.length
    ? await remote("fetchMyResults", () => supabase!.from("assignment_results").select("assignment_id, user_id, score, total, items, submitted_at").eq("user_id", uid).in("assignment_id", ids))
    : { data: [] };
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
  // Safe to retry: one result per student per test, so a retry after a lost answer hits "already there" (23505), which means it was saved.
  const { error } = await remote("submitResult", () => supabase!.from("assignment_results").insert({ assignment_id: testId, user_id: uid, score, total, items }));
  return !error || error.code === "23505";
}
