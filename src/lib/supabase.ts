import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** True when the Supabase project keys are present. Without them, only guest mode and /demo work. */
export const authConfigured = Boolean(url && key);

/**
 * Local test accounts: on the dev server, sign-in creates accounts kept on this device (see auth.ts MOCK_AUTH).
 * On with Supabase keys unless VITE_REAL_AUTH=1; VITE_LOCAL_ACCOUNTS=1 turns them on without keys (the classroom tests).
 */
export const localAccounts = import.meta.env.DEV && import.meta.env.VITE_REAL_AUTH !== "1" && (authConfigured || import.meta.env.VITE_LOCAL_ACCOUNTS === "1");

/** Whether there's any way to sign in: real Supabase or local test accounts. */
export const signInAvailable = authConfigured || localAccounts;

export const supabase = authConfigured
  ? createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" } })
  : null;
