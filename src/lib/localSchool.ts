/**
 * Local test accounts' classroom: one small store on this device, shared by every local account,
 * so a teacher account and a student account can be signed into in turn and see the same classes,
 * tests and results. It mirrors the rules the database enforces (supabase/migrations 0007-0008).
 * Dev only (see MOCK_AUTH); deployed builds always use Supabase.
 */
import type { Profile, ClassRow } from "../auth";
import type { TestQuestion } from "../school";

export interface LocalMember { classId: string; userId: string; name: string; role: "student" | "teacher"; joinedAt: string; leftAt: string | null; removedAt: string | null }
export interface LocalTest { id: string; classId: string; kind: "quiz" | "exam"; title: string; unitIds: string[]; studentIds: string[] | null; createdBy: string; createdAt: string; questions: TestQuestion[] | null }
export interface LocalResult { testId: string; userId: string; score: number; total: number; items: { unitId: string; right: boolean; q?: number }[]; submittedAt: string }

interface School {
  profiles: Record<string, Profile>;
  classes: (ClassRow & { ownerId: string })[];
  members: LocalMember[];
  tests: LocalTest[];
  results: LocalResult[];
  /** Unit progress students share with the classes they're in (only units of a joined class's subject). */
  progress: Record<string, Record<string, string>>;
}

const KEY = "hopper-local-school";
const empty = (): School => ({ profiles: {}, classes: [], members: [], tests: [], results: [], progress: {} });

export function load(): School {
  try {
    return { ...empty(), ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return empty();
  }
}

/** Read, change, write back. Returns whatever the change returns. */
export function edit<T>(fn: (s: School) => T): T {
  const s = load();
  const out = fn(s);
  localStorage.setItem(KEY, JSON.stringify(s));
  return out;
}

export const newId = () => crypto.randomUUID();
const active = (m: LocalMember) => m.leftAt === null;

/** Classes this account is in, as teacher or student. */
export function classesOf(userId: string): ClassRow[] {
  const s = load();
  const ids = new Set(s.members.filter((m) => m.userId === userId && active(m)).map((m) => m.classId));
  return s.classes.filter((c) => ids.has(c.id)).map(({ ownerId: _o, ...c }) => c);
}

export function isTeacherOf(s: School, classId: string, userId: string) {
  return s.members.some((m) => m.classId === classId && m.userId === userId && m.role === "teacher" && active(m));
}

export function isStudentOf(s: School, classId: string, userId: string) {
  return s.members.some((m) => m.classId === classId && m.userId === userId && m.role === "student" && active(m));
}
