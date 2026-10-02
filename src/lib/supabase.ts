import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/**
 * Accounts are off: the app runs offline as a guest on this device (the offline happy path). To bring sign-in back,
 * set this to Boolean(url && key) again.
 */
export const authConfigured = false && Boolean(url && key);

/**
 * Local test accounts: sign-in creates accounts kept on this device (see auth.ts MOCK_AUTH), for the classroom
 * e2e tests. Dev server only, and only with VITE_LOCAL_ACCOUNTS=1: otherwise sign-in is real Supabase (Google
 * OAuth or an email link), in dev as in production.
 */
export const localAccounts = import.meta.env.DEV && import.meta.env.VITE_LOCAL_ACCOUNTS === "1";

/** Whether there's any way to sign in: real Supabase or local test accounts. */
export const signInAvailable = authConfigured || localAccounts;

export const supabase = authConfigured
  ? createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" } })
  : null;
