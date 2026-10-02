import { normalizeLang } from "./locales";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { setSelfYears, type Goal, type SubjectId } from "./data/curriculum";
import type { Attempt, Lang, SkillStatus } from "./types";
import type { PlacementQuestion } from "./ai/client";

export interface Trace {
  attemptId: string;
  problemId: string;
  misconceptionId: string | null;
  startSkill: string; // the problem's skill
  path: string[]; // problem skill -> misconception skill -> ... -> root
  rootSkill: string | null;
}


/** Where a starting-point check put the learner in one subject. `unitId` is a plan unit, `skillId` one of the built-in math skills (offline check). */
export interface Placement {
  at: number;
  score: number;
  total: number;
  /** true when a foundation from an earlier grade was missed: start there. */
  gap: boolean;
  unitId?: string;
  skillId?: string;
}

export interface PracticeResume {
  qi: number;
  results: (boolean | null)[];
}

/**
 * A starting-point check in progress, saved after every answer so a reload, a closed tab or a lost
 * connection picks up at the same question. Cleared when the check places the learner.
 */
export interface CheckResume {
  at: number;
  /** The round being asked (it moves to an earlier grade when every question at the lowest one was missed). */
  round: { subject: SubjectId; grade: number | null };
  /** Score from earlier rounds. */
  past: { score: number; total: number };
  questions: (PlacementQuestion & { skillId?: string; grade: number })[];
  answers: boolean[];
}

export interface Onboarding {
  name: string;
  subjects: SubjectId[];
  grade: number | null; // self-reported baseline, not a verified level
  goal: Goal | null;
  done: boolean;
  /** The school year `grade` belongs to (schoolYear()). Unset in saved state from older builds. */
  gradeYear?: number;
}

interface State {
  consent: { by: "self" | "guardian" | "school"; at: number } | null;
  role: "student" | "guest" | null;
  demo: boolean;
  /** Judging run: after a fresh onboarding, land in the seeded demo as that new student. */
  demoFlow: boolean;
  onboarding: Onboarding;
  lang: Lang;
  textScale: number;
  readableFont: boolean;
  reduceMotion: boolean;
  /** Exam-prep switch: lessons generate with six practice items and an exam tip until it's turned off. */
  examMode: boolean;
  placement: Partial<Record<SubjectId, Placement>>;
  progress: Record<string, SkillStatus>;
  attempts: Attempt[];
  trace: Trace | null;
  gapsFixed: string[];
  activeDays: string[];
  /** Points for right answers and finished skills. Earning any also marks today as practiced. */
  xp: number;
  /** Unfinished practice per lesson id, so leaving and coming back picks up at the same question. */
  practiceResume: Record<string, PracticeResume>;
  /** The account this device's data belongs to (account.ts). Null for a guest or the demo. */
  owner: string | null;
  /** Unfinished starting-point checks, per subject. */
  checkResume: Partial<Record<SubjectId, CheckResume>>;
  /** Self-learners only: move their plans up a level each new school year. Students in school always move up. */
  selfAdvance: boolean;
  /** School years a self-learner has moved up so far. */
  selfYears: number;
  /** A new school year just moved the learner up: Home says so once. */
  movedUp: boolean;

  set:(patch: Partial<State>) => void;
  setSkill: (id: string, status: SkillStatus) => void;
  addXp: (n: number) => void;
  /** Save (or with null, clear) a lesson's unfinished practice. */
  saveResume: (id: string, r: PracticeResume | null) => void;
  addAttempt: (a: Attempt) => void;
  updateAttempt: (id: string, patch: Partial<Attempt>) => void;
  resetDemo: () => void;
}

const initial = {
  consent: null,
  role: null,
  demo: false,
  demoFlow: false,
  onboarding: { name: "", subjects: [], grade: null, goal: null, done: false } as Onboarding,
  lang: "en" as Lang,
  textScale: 1,
  readableFont: false,
  reduceMotion: false,
  examMode: false,
  placement: {} as Partial<Record<SubjectId, Placement>>,
  progress: {},
  attempts: [],
  trace: null,
  gapsFixed: [] as string[],
  activeDays: [] as string[],
  xp: 0,
  practiceResume: {} as Record<string, PracticeResume>,
  checkResume: {} as Partial<Record<SubjectId, CheckResume>>,
  owner: null as string | null,
  selfAdvance: false,
  selfYears: 0,
  movedUp: false,
};

export const useStore = create<State>()(
  persist(
    (set) => ({
      ...initial,
      set: (patch) => set(patch),
      setSkill: (id, status) => {
        set((s) => ({ progress: { ...s.progress, [id]: status } }));
      },
      addXp: (n) => set((s) => {
        const day = new Date().toDateString();
        return { xp: s.xp + n, activeDays: s.activeDays.includes(day) ? s.activeDays : [...s.activeDays, day] };
      }),
      saveResume: (id, r) => set((s) => {
        const { [id]: _drop, ...rest } = s.practiceResume;
        return { practiceResume: r ? { ...rest, [id]: r } : rest };
      }),
      addAttempt: (a) => {
        set((s) => {
          const day = new Date(a.createdAt).toDateString();
          return { attempts: [...s.attempts, a], activeDays: s.activeDays.includes(day) ? s.activeDays : [...s.activeDays, day] };
        });
      },
      updateAttempt: (id, patch) =>
        set((s) => ({ attempts: s.attempts.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),
      resetDemo: () => set({ ...initial }),
    }),
    {
      name: "gapfinder-v1",
      // Saved state from older builds can lack newer fields (or whole objects). Merge nested objects so it never crashes.
      merge: (saved, current) => {
        const p = (saved ?? {}) as Partial<State>;
        // Older builds had a teacher role; everyone is a learner now.
        const role = (p.role as string | null | undefined) === "teacher" ? "student" : p.role ?? current.role;
        return { ...current, ...p, role, lang: normalizeLang(p.lang ?? current.lang), onboarding: { ...current.onboarding, ...(p.onboarding ?? {}) } };
      },
    },
  ),
);

// Plans read a self-learner's level through startGrade(), which lives with the curriculum data.
setSelfYears(useStore.getState().selfYears);
useStore.subscribe((s) => setSelfYears(s.selfYears));

// Keep tabs in sync: two tabs on the same device update live.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === "gapfinder-v1") useStore.persist.rehydrate();
  });
}

/** Days in a row with practice, ending today, or yesterday while today's is still to come. */
export function streak(days: string[], now = new Date()): number {
  const seen = new Set(days);
  const d = new Date(now);
  if (!seen.has(d.toDateString())) d.setDate(d.getDate() - 1);
  let n = 0;
  for (; seen.has(d.toDateString()); d.setDate(d.getDate() - 1)) n++;
  return n;
}

export const uid =() => Math.random().toString(36).slice(2, 10);
