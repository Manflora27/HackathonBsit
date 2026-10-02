import type { User } from "@supabase/supabase-js";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { create } from "zustand";
import type { Goal, SubjectId } from "./data/curriculum";
import { localAccounts, supabase } from "./lib/supabase";
import { report } from "./lib/remote";
import type { Lang } from "./types";

/** Everyone is a learner. Older rows may still say "teacher"; the app treats them as learners. */
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

interface AuthState {
  ready: boolean;
  user: User | null;
  profile: Profile | null;
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
    consentBy: "self" | "guardian" | "school";
    language: Lang;
    subjects: SubjectId[];
    grade: number | null;
    goal: Goal | null;
  }) => Promise<boolean>;
  /** Change fields of my own profile. */
  updateProfile: (patch: Partial<Profile>) => Promise<boolean>;
}

let started = false;

/**
 * Inside the Android app, Google refuses to sign in within the app's web view, so sign-in opens in the system
 * browser and comes back to the app on this link (the intent filter in AndroidManifest.xml). The link must be
 * listed in Supabase's Auth redirect URLs (com.hopper.math://**).
 */
const native = Capacitor.isNativePlatform();
const NATIVE_REDIRECT = "com.hopper.math://auth/callback";
const redirectTo = () => (native ? NATIVE_REDIRECT : window.location.origin + "/welcome");

/**
 * Local test accounts, for the e2e tests (VITE_LOCAL_ACCOUNTS=1 on the dev server): sign-in creates a pseudo account
 * kept on this device, same flow, no network. Never in a deployed build. Without the flag, sign-in is real Supabase;
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
/** Local accounts' profiles, by user id. */
const PROFILES_KEY = "hopper-test-profiles";
const mockProfiles = (): Record<string, Profile> => {
  try {
    return JSON.parse(localStorage.getItem(PROFILES_KEY) ?? "{}") as Record<string, Profile>;
  } catch {
    return {};
  }
};
const mockProfileEdit = (fn: (all: Record<string, Profile>) => void) => {
  const all = mockProfiles();
  fn(all);
  localStorage.setItem(PROFILES_KEY, JSON.stringify(all));
};
/** The signed-in local account's profile. */
const mockState = (user: User | null) => ({ user, profile: user ? mockProfiles()[user.id] ?? null : null });
const mockUser = (email: string, name: string) =>
  ({ id: `test-${email}`, email, aud: "authenticated", app_metadata: { provider: "test" }, user_metadata: { full_name: name }, created_at: new Date().toISOString() }) as unknown as User;


export const useAuth = create<AuthState>((set, get) => ({
  ready: !supabase || MOCK_AUTH,
  user: null,
  profile: null,
  error: null,
  ...(MOCK_AUTH ? mockState(mockUserLoad()) : {}),

  init() {
    if (started || !supabase || MOCK_AUTH) return;
    started = true;
    if (native) {
      // The browser hands back a one-time code; trading it for a session signs the app in (onAuthStateChange below).
      void App.addListener("appUrlOpen", async ({ url }) => {
        if (!url.startsWith(NATIVE_REDIRECT) || !supabase) return;
        void Browser.close().catch(() => {});
        const code = new URL(url).searchParams.get("code");
        if (!code) return;
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) set({ error: error.message });
      });
    }
    supabase.auth.getSession().then(({ data }) => {
      set({ user: data.session?.user ?? null });
      get().refresh().finally(() => set({ ready: true }));
    });
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ user: session?.user ?? null });
      if (session?.user) void get().refresh();
      else set({ profile: null });
    });
  },

  async refresh() {
    if (MOCK_AUTH) return set(mockState(get().user));
    const { user } = get();
    if (!supabase || !user) return;
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    set({ profile: (profile as Profile | null) ?? null });
  },

  async signInGoogle() {
    if (MOCK_AUTH) {
      const user = mockUser("test.learner@hopper.local", "Test Learner");
      mockUserSave(user);
      return set({ ...mockState(user), error: null });
    }
    if (!supabase) return;
    set({ error: null });
    const { data, error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo(), skipBrowserRedirect: native } });
    if (error) return set({ error: error.message });
    if (native && data.url) await Browser.open({ url: data.url });
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
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirectTo() } });
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
    set({ user: null, profile: null });
  },

  async deleteAccount() {
    if (MOCK_AUTH) {
      const id = get().user?.id;
      if (id) mockProfileEdit((all) => { delete all[id]; });
      mockUserSave(null);
      set({ user: null, profile: null, error: null });
      return true;
    }
    if (!supabase || !get().user) return false;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return false;
    const res = await fetch("/api/delete-account", { method: "POST", headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) return false;
    await supabase.auth.signOut();
    set({ user: null, profile: null, error: null });
    return true;
  },

  async completeProfile({ name, consentBy, language, subjects, grade, goal }) {
    const { user } = get();
    if (!user) return false;
    set({ error: null });
    const row = { id: user.id, display_name: name.trim(), account_type: "student" as const, language, subjects, current_grade: grade, goal, onboarded_at: new Date().toISOString() };
    if (MOCK_AUTH) {
      mockProfileEdit((all) => { all[user.id] = row; });
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
    if (MOCK_AUTH) mockProfileEdit((all) => { all[user.id] = { ...all[user.id], ...patch }; });
    else if (!supabase || (await supabase.from("profiles").update(patch).eq("id", user.id)).error) return false;
    set({ profile: { ...profile, ...patch } });
    return true;
  },
}));
