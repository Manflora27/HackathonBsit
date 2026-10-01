import { normalizeLang } from "./locales";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { pushAttempt } from "./classroom";
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

export interface Onboarding {
  name: string;
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
  /** Exam-prep switch: lessons generate with six practice items and an exam tip until it's turned off. */
  examMode: boolean;
  /** Voice input runs on the device's speech recognition and is 18+ only. null = age not attested yet. */
  voiceAdult: boolean | null;
  /** Voice input switched on. Only possible once voiceAdult === true. null = not asked yet. */
  voiceAi: boolean | null;
  placement: Partial<Record<SubjectId, Placement>>;
  progress: Record<string, SkillStatus>;
  attempts: Attempt[];
  trace: Trace | null;
  practiceAssignments: PracticeAssignment[];
  aiLog: AiLogEntry[];
  gapsFixed: string[];
  activeDays: string[];
  /** Points for right answers and finished skills. Earning any also marks today as practiced. */
  xp: number;
  /** Unfinished practice per lesson id, so leaving and coming back picks up at the same question. */
  practiceResume: Record<string, PracticeResume>;

  set: (patch: Partial<State>) => void;
  setSkill: (id: string, status: SkillStatus) => void;
  addXp: (n: number) => void;
  /** Save (or with null, clear) a lesson's unfinished practice. */
  saveResume: (id: string, r: PracticeResume | null) => void;
  addAttempt: (a: Attempt) => void;
  updateAttempt: (id: string, patch: Partial<Attempt>) => void;
  /** The learner's "share with my teacher" switch. Also syncs the flag and progress to the server. */
  setShareSkillMap: (on: boolean) => void;
  log: (e: Omit<AiLogEntry, "at">) => void;
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
  shareSkillMap: false,
  examMode: false,
  voiceAdult: null as boolean | null,
  voiceAi: null as boolean | null,
  placement: {} as Partial<Record<SubjectId, Placement>>,
  progress: {},
  attempts: [],
  trace: null,
  practiceAssignments: [],
  aiLog: [],
  gapsFixed: [] as string[],
  activeDays: [] as string[],
  xp: 0,
  practiceResume: {} as Record<string, PracticeResume>,
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
        void pushAttempt(a);
      },
      updateAttempt: (id, patch) =>
        set((s) => ({ attempts: s.attempts.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),
      setShareSkillMap: (on) => {
        set({ shareSkillMap: on });
      },
      log: (e) => set((s) => ({ aiLog: [...s.aiLog, { ...e, at: Date.now() }] })),
      resetDemo: () => set({ ...initial }),
    }),
    {
      name: "gapfinder-v1",
      // Saved state from older builds can lack newer fields (or whole objects). Merge nested objects so it never crashes.
      merge: (saved, current) => {
        const p = (saved ?? {}) as Partial<State>;
        return { ...current, ...p, lang: normalizeLang(p.lang ?? current.lang), onboarding: { ...current.onboarding, ...(p.onboarding ?? {}) } };
      },
    },
  ),
);

// Keep tabs in sync: a student tab and a teacher tab on the same device update live.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === "gapfinder-v1") useStore.persist.rehydrate();
  });
}

export const uid = () => Math.random().toString(36).slice(2, 10);
