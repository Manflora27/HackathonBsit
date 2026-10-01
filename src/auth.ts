import type { User } from "@supabase/supabase-js";
import { create } from "zustand";
import type { Goal, SubjectId } from "./data/curriculum";
import { localAccounts, supabase } from "./lib/supabase";
import * as local from "./lib/localSchool";
import { report } from "./lib/remote";
import type { Lang } from "./types";

export type AccountType = "student" | "teacher";
export interface Profile {
  id: string;
  display_name: string;
  account_type: AccountType | null;
  language: Lang;
  subjects: SubjectId[];
  current_grade: number | null;
  /** The school year current_grade belongs to (migration 0009). Absent until that migration runs. */
  grade_year?: number | null;
  goal: Goal | null;
  onboarded_at: string | null;
}
export interface ClassRow {
  id: string;
  name: string;
  section: string | null;
  class_code: string;
  /** What the class studies. Older classes (before migration 0008) have neither. */
  subject?: SubjectId | null;
  grade?: number | null;
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
  /** Emails a magic sign-in link. Resolves true once it's sent. */
  signInEmail: (email: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  /** Deletes the account and everything it owns (server first, then the device store). Resolves true on success. */
  deleteAccount: () => Promise<boolean>;
  completeProfile: (p: {
    name: string;
    type: AccountType;
    consentBy: "self" | "guardian" | "school";
    language: Lang;
    subjects: SubjectId[];
    grade: number | null;
    goal: Goal | null;
  }) => Promise<boolean>;
  /** Change fields of my own profile. */
  updateProfile: (patch: Partial<Profile>) => Promise<boolean>;
  joinClass: (code: string) => Promise<boolean>;
  /** Resolves the new class's id, or null. */
  createClass: (c: { name: string; section: string; subject: SubjectId; grade: number }) => Promise<string | null>;
}

let started = false;

/**
 * Local test accounts, for the e2e tests (VITE_LOCAL_ACCOUNTS=1 on the dev server): sign-in creates a pseudo account
 * kept on this device, same flow, no network. Never in a deployed build. Every local account shares one on-device
 * classroom (lib/localSchool), so a teacher and a student can take turns. Without the flag, sign-in is real Supabase;
 * for Google to come back to localhost, add http://localhost:5175/** to the project's Auth redirect URLs.
 */
export const MOCK_AUTH = localAccounts;
const MOCK_KEY = "hopper-test-account";
const mockUserLoad = (): User | null => {
  try {
    return (JSON.parse(localStorage.getItem(MOCK_KEY) ?? "{}") as { user?: User }).user ?? null;
  } catch {
    return null;
  }
};
const mockUserSave = (user: User | null) => localStorage.setItem(MOCK_KEY, JSON.stringify({ user }));
/** The signed-in local account's profile and classes. */
const mockState = (user: User | null) => ({
  user,
  profile: user ? local.load().profiles[user.id] ?? null : null,
  classes: user ? local.classesOf(user.id) : [],
});
const mockUser = (email: string, name: string) =>
  ({ id: `test-${email}`, email, aud: "authenticated", app_metadata: { provider: "test" }, user_metadata: { full_name: name }, created_at: new Date().toISOString() }) as unknown as User;

const makeCode = (name: string) => {
  const letters = (name.replace(/[^a-z]/gi, "").toUpperCase() + "XXXX").slice(0, 4);
  return `${letters}-${Math.floor(100 + Math.random() * 900)}`;
};

export const useAuth = create<AuthState>((set, get) => ({
  ready: !supabase || MOCK_AUTH,
  user: null,
  profile: null,
  classes: [],
  roster: [],
  error: null,
  ...(MOCK_AUTH ? mockState(mockUserLoad()) : {}),

  init() {
    if (started || !supabase || MOCK_AUTH) return;
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
    if (MOCK_AUTH) return set(mockState(get().user));
    const { user } = get();
    if (!supabase || !user) return;
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    set({ profile: (profile as Profile | null) ?? null });
    if (!profile) return set({ classes: [], roster: [] });

    const { data: mem } = await supabase
      .from("memberships")
      .select("role, class:classes(id, name, section, class_code, subject, grade)")
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
    if (MOCK_AUTH) {
      const user = mockUser("test.learner@hopper.local", "Test Learner");
      mockUserSave(user);
      return set({ ...mockState(user), error: null });
    }
    if (!supabase) return;
    set({ error: null });
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin + "/welcome" } });
    if (error) set({ error: error.message });
  },

  async signInEmail(email) {
    if (MOCK_AUTH) {
      const user = mockUser(email.trim().toLowerCase(), email.split("@")[0]);
      mockUserSave(user);
      set({ ...mockState(user), error: null });
      return true;
    }
    if (!supabase) return false;
    set({ error: null });
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: window.location.origin + "/welcome" } });
    if (error) return set({ error: error.message }), false;
    return true;
  },

  async signOut() {
    if (MOCK_AUTH) mockUserSave(null);
    else if (supabase) {
      // Offline or an expired session makes the server call fail; this device must still forget the session,
      // or the start page would sign the learner straight back in.
      const { error } = await supabase.auth.signOut().catch((e) => ({ error: e }));
      if (error) {
        report("signOut", error);
        await supabase.auth.signOut({ scope: "local" }).catch(() => {});
      }
    }
    set({ user: null, profile: null, classes: [], roster: [] });
  },

  async deleteAccount() {
    if (MOCK_AUTH) {
      const id = get().user?.id;
      // Like the server: the account and everything it owns go; classes it taught go with it.
      if (id) local.edit((sc) => {
        delete sc.profiles[id];
        const taught = new Set(sc.classes.filter((c) => c.ownerId === id).map((c) => c.id));
        sc.classes = sc.classes.filter((c) => !taught.has(c.id));
        sc.members = sc.members.filter((m) => m.userId !== id && !taught.has(m.classId));
        sc.tests = sc.tests.filter((t) => !taught.has(t.classId));
        sc.results = sc.results.filter((r) => r.userId !== id && sc.tests.some((t) => t.id === r.testId));
      });
      mockUserSave(null);
      set({ user: null, profile: null, classes: [], roster: [], error: null });
      return true;
    }
    if (!supabase || !get().user) return false;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return false;
    const res = await fetch("/api/delete-account", { method: "POST", headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) return false;
    await supabase.auth.signOut();
    set({ user: null, profile: null, classes: [], roster: [], error: null });
    return true;
  },

  async completeProfile({ name, type, consentBy, language, subjects, grade, goal }) {
    const { user } = get();
    if (!user) return false;
    set({ error: null });
    const row = { id: user.id, display_name: name.trim(), account_type: type, language, subjects, current_grade: grade, goal, onboarded_at: new Date().toISOString() };
    if (MOCK_AUTH) {
      local.edit((sc) => { sc.profiles[user.id] = row; });
      return set({ profile: row }), true;
    }
    if (!supabase) return false;
    let { error } = await supabase.from("profiles").upsert(row);
    // Until migration 0006 runs, the column only accepts en/fil. The UI language lives on the device, so don't block onboarding on it.
    if (error?.code === "23514" && language !== "en") ({ error } = await supabase.from("profiles").upsert({ ...row, language: "en" }));
    if (error) return set({ error: error.message }), false;
    await supabase.from("consents").insert({ user_id: user.id, type: "data_processing", version: "2026-10-01", given_by: consentBy });
    await get().refresh();
    return true;
  },

  async updateProfile(patch) {
    const { user, profile } = get();
    if (!user || !profile) return false;
    if (MOCK_AUTH) local.edit((sc) => { sc.profiles[user.id] = { ...sc.profiles[user.id], ...patch }; });
    else if (!supabase || (await supabase.from("profiles").update(patch).eq("id", user.id)).error) return false;
    set({ profile: { ...profile, ...patch } });
    return true;
  },

  async joinClass(code) {
    if (MOCK_AUTH) {
      const user = get().user;
      if (!user) return false;
      // Same rules as join_class() in the database.
      const err = local.edit((sc) => {
        const c = sc.classes.find((x) => x.class_code.toUpperCase() === code.trim().toUpperCase());
        if (!c) return "invalid";
        const m = sc.members.find((x) => x.classId === c.id && x.userId === user.id);
        if (m?.removedAt) return "removed";
        const name = sc.profiles[user.id]?.display_name ?? "Student";
        if (m) Object.assign(m, { leftAt: null, name });
        else sc.members.push({ classId: c.id, userId: user.id, name, role: "student", joinedAt: new Date().toISOString(), leftAt: null, removedAt: null });
        return null;
      });
      if (err) return set({ error: err }), false;
      return set({ classes: local.classesOf(user.id), error: null }), true;
    }
    if (!supabase) return false;
    set({ error: null });
    const { error } = await supabase.rpc("join_class", { code });
    if (error) return set({ error: /invalid class code/.test(error.message) ? "invalid" : /removed from this class/.test(error.message) ? "removed" : error.message }), false;
    await get().refresh();
    return true;
  },

  async createClass({ name, section, subject, grade }) {
    const { user } = get();
    if (!user) return null;
    const row = { name: name.trim(), section: section.trim() || null, subject, grade };
    if (MOCK_AUTH) {
      const id = local.newId();
      local.edit((sc) => {
        let code = makeCode(name);
        while (sc.classes.some((c) => c.class_code === code)) code = makeCode(name);
        sc.classes.push({ id, ...row, class_code: code, ownerId: user.id });
        sc.members.push({ classId: id, userId: user.id, name: sc.profiles[user.id]?.display_name ?? "Teacher", role: "teacher", joinedAt: new Date().toISOString(), leftAt: null, removedAt: null });
      });
      set({ classes: local.classesOf(user.id), roster: [], error: null });
      return id;
    }
    if (!supabase) return null;
    set({ error: null });
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await supabase
        .from("classes")
        .insert({ ...row, class_code: makeCode(name), owner_id: user.id })
        .select("id")
        .single();
      if (!error && data) {
        await supabase.from("memberships").insert({ user_id: user.id, class_id: data.id, role: "teacher" });
        await get().refresh();
        return data.id as string;
      }
      if (error && error.code !== "23505") return set({ error: error.message }), null; // retry only on duplicate code
    }
    return set({ error: "Couldn't generate a class code. Try again." }), null;
  },
}));
