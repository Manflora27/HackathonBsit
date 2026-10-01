import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Goal, SubjectId } from "./data/curriculum";
import type { Attempt, Lang, SkillStatus } from "./types";

export interface Trace {
  attemptId: string;
  problemId: string;
  misconceptionId: string | null;
  startSkill: string; // the problem's skill
  path: string[]; // problem skill -> misconception skill -> ... -> root
  rootSkill: string | null;
}

export interface PracticeAssignment {
  id: string;
  skillId: string;
  studentIds: string[];
  createdAt: number;
}

export interface AiLogEntry {
  at: number;
  action: string;
  suggestion: string;
  decision: string;
  actor: "student" | "teacher";
}

export interface Onboarding {
  subjects: SubjectId[];
  grade: number | null; // self-reported baseline, not a verified level
  goal: Goal | null;
  done: boolean;
}

interface State {
  consent: { by: "self" | "guardian" | "school"; at: number } | null;
  role: "student" | "teacher" | "guest" | null;
  demo: boolean;
  /** Judging run: after a fresh onboarding, land in the seeded demo as that new student. */
  demoFlow: boolean;
  onboarding: Onboarding;
  lang: Lang;
  textScale: number;
  readableFont: boolean;
  reduceMotion: boolean;
  shareSkillMap: boolean;
  progress: Record<string, SkillStatus>;
  attempts: Attempt[];
  trace: Trace | null;
  practiceAssignments: PracticeAssignment[];
  aiLog: AiLogEntry[];
  gapsFixed: string[];
  activeDays: string[];

  set: (patch: Partial<State>) => void;
  setSkill: (id: string, status: SkillStatus) => void;
  addAttempt: (a: Attempt) => void;
  updateAttempt: (id: string, patch: Partial<Attempt>) => void;
  log: (e: Omit<AiLogEntry, "at">) => void;
  resetDemo: () => void;
}

const initial = {
  consent: null,
  role: null,
  demo: false,
  demoFlow: false,
  onboarding: { subjects: [], grade: null, goal: null, done: false } as Onboarding,
  lang: "en" as Lang,
  textScale: 1,
  readableFont: false,
  reduceMotion: false,
  shareSkillMap: false,
  progress: {},
  attempts: [],
  trace: null,
  practiceAssignments: [],
  aiLog: [],
  gapsFixed: [] as string[],
  activeDays: [] as string[],
};

export const useStore = create<State>()(
  persist(
    (set) => ({
      ...initial,
      set: (patch) => set(patch),
      setSkill: (id, status) => set((s) => ({ progress: { ...s.progress, [id]: status } })),
      addAttempt: (a) =>
        set((s) => {
          const day = new Date(a.createdAt).toDateString();
          return { attempts: [...s.attempts, a], activeDays: s.activeDays.includes(day) ? s.activeDays : [...s.activeDays, day] };
        }),
      updateAttempt: (id, patch) =>
        set((s) => ({ attempts: s.attempts.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),
      log: (e) => set((s) => ({ aiLog: [...s.aiLog, { ...e, at: Date.now() }] })),
      resetDemo: () => set({ ...initial }),
    }),
    { name: "gapfinder-v1" },
  ),
);

// Keep tabs in sync: a student tab and a teacher tab on the same device update live.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === "gapfinder-v1") useStore.persist.rehydrate();
  });
}

export const uid = () => Math.random().toString(36).slice(2, 10);
