import type { User } from "@supabase/supabase-js";
import { create } from "zustand";
import type { Goal, SubjectId } from "./data/curriculum";
import { supabase } from "./lib/supabase";

export type AccountType = "student" | "teacher";
export interface Profile {
  id: string;
  display_name: string;
  account_type: AccountType | null;
  language: "en" | "fil";
  subjects: SubjectId[];
  current_grade: number | null;
  goal: Goal | null;
  onboarded_at: string | null;
}
export interface ClassRow {
  id: string;
  name: string;
  section: string | null;
  class_code: string;
}
export interface RosterRow {
  user_id: string;
  display_name: string;
  joined_at: string;
}

interface AuthState {
  ready: boolean;
  user: User | null;
  profile: Profile | null;
  classes: ClassRow[];
  roster: RosterRow[];
  error: string | null;
  init: () => void;
  refresh: () => Promise<void>;
  signInGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  completeProfile: (p: {
    name: string;
    type: AccountType;
    consentBy: "self" | "guardian" | "school";
    language: "en" | "fil";
    subjects: SubjectId[];
    grade: number | null;
    goal: Goal | null;
  }) => Promise<boolean>;
  joinClass: (code: string) => Promise<boolean>;
  createClass: (name: string, section: string) => Promise<boolean>;
}

let started = false;

const makeCode = (name: string) => {
  const letters = (name.replace(/[^a-z]/gi, "").toUpperCase() + "XXXX").slice(0, 4);
  return `${letters}-${Math.floor(100 + Math.random() * 900)}`;
};

export const useAuth = create<AuthState>((set, get) => ({
  ready: !supabase,
  user: null,
  profile: null,
  classes: [],
  roster: [],
  error: null,

  init() {
    if (started || !supabase) return;
    started = true;
    supabase.auth.getSession().then(({ data }) => {
      set({ user: data.session?.user ?? null });
      get().refresh().finally(() => set({ ready: true }));
    });
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ user: session?.user ?? null });
      if (session?.user) void get().refresh();
      else set({ profile: null, classes: [], roster: [] });
    });
  },

  async refresh() {
    const { user } = get();
    if (!supabase || !user) return;
    const { data: profile } = await supabase.from("profiles").select("id, display_name, account_type, language, subjects, current_grade, goal, onboarded_at").eq("id", user.id).maybeSingle();
    set({ profile: (profile as Profile | null) ?? null });
    if (!profile) return set({ classes: [], roster: [] });

    const { data: mem } = await supabase
      .from("memberships")
      .select("role, class:classes(id, name, section, class_code)")
      .eq("user_id", user.id)
      .is("left_at", null);
    const classes = ((mem ?? []) as unknown as { class: ClassRow }[]).map((m) => m.class).filter(Boolean);
    set({ classes });

    if ((profile as Profile).account_type === "teacher" && classes[0]) {
      const { data: r } = await supabase
        .from("memberships")
        .select("user_id, joined_at, profile:profiles(display_name)")
        .eq("class_id", classes[0].id)
        .eq("role", "student")
        .is("left_at", null);
      set({
        roster: ((r ?? []) as unknown as { user_id: string; joined_at: string; profile: { display_name: string } | null }[]).map((x) => ({
          user_id: x.user_id,
          joined_at: x.joined_at,
          display_name: x.profile?.display_name ?? "Student",
        })),
      });
    }
  },

  async signInGoogle() {
    if (!supabase) return;
    set({ error: null });
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin + "/welcome" } });
    if (error) set({ error: error.message });
  },

  async signOut() {
    await supabase?.auth.signOut();
    set({ user: null, profile: null, classes: [], roster: [] });
  },

  async completeProfile({ name, type, consentBy, language, subjects, grade, goal }) {
    const { user } = get();
    if (!supabase || !user) return false;
    set({ error: null });
    const { error } = await supabase.from("profiles").upsert({
      id: user.id, display_name: name.trim(), account_type: type, language, subjects,
      current_grade: grade, goal, onboarded_at: new Date().toISOString(),
    });
    if (error) return set({ error: error.message }), false;
    await supabase.from("consents").insert({ user_id: user.id, type: "data_processing", version: "2026-10-01", given_by: consentBy });
    await get().refresh();
    return true;
  },

  async joinClass(code) {
    if (!supabase) return false;
    set({ error: null });
    const { error } = await supabase.rpc("join_class", { code });
    if (error) return set({ error: /invalid class code/.test(error.message) ? "invalid" : error.message }), false;
    await get().refresh();
    return true;
  },

  async createClass(name, section) {
    const { user } = get();
    if (!supabase || !user) return false;
    set({ error: null });
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await supabase
        .from("classes")
        .insert({ name: name.trim(), section: section.trim() || null, class_code: makeCode(name), owner_id: user.id })
        .select("id")
        .single();
      if (!error && data) {
        await supabase.from("memberships").insert({ user_id: user.id, class_id: data.id, role: "teacher" });
        await get().refresh();
        return true;
      }
      if (error && error.code !== "23505") return set({ error: error.message }), false; // retry only on duplicate code
    }
    return set({ error: "Couldn't generate a class code. Try again." }), false;
  },
}));
