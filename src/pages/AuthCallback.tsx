import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../auth";
import { supabase } from "../lib/supabase";
import { Shell } from "../components/Shell";
import { useStore } from "../store";

/**
 * OAuth / magic-link landing: Supabase (PKCE, detectSessionInUrl) exchanges the
 * ?code for a session on client creation, but on slow networks the profile row
 * isn't back yet. Wait for both, then route: no profile -> onboarding,
 * teacher -> dashboard, everyone else -> home. Never leaves a signed-in user
 * staring at a dead button.
 */
export default function AuthCallback() {
  const nav = useNavigate();
  const { user, profile, profileReady, ready } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // If the URL still carries an error (denied consent, bad redirect), surface it.
    const params = new URLSearchParams(window.location.search);
    const urlError = params.get("error_description") || params.get("error");
    if (urlError) {
      setError(decodeURIComponent(urlError));
      return;
    }
    // Nudge an explicit exchange when the code is present but no session yet.
    // With detectSessionInUrl this is usually already done; the call is harmless otherwise.
    const code = params.get("code");
    if (!user && code && supabase) {
      supabase.auth.exchangeCodeForSession(code).then(({ error: exError }) => {
        if (!cancelled && exError) setError(exError.message);
      }).catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    }
    const id = setTimeout(() => {
      if (!cancelled && !useAuth.getState().user) {
        setError((prev) => prev ?? "Sign-in timed out. Check your connection, then try again from the start.");
      }
    }, 15000);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [user]);

  useEffect(() => {
    if (!ready || error) return;
    if (!user) return; // still exchanging the code; the timeout above reports failure
    if (!profileReady) return; // profile row still loading; don't flash onboarding
    const { consent, set } = useStore.getState();
    if (!consent) set({ consent: { by: "school" as const, at: Date.now() } });
    if (!profile || !profile.account_type || !profile.onboarded_at) {
      nav("/welcome", { replace: true });
      return;
    }
    set({ role: profile.account_type === "teacher" ? "teacher" : "student", demo: false });
    nav(profile.account_type === "teacher" ? "/teacher" : "/student", { replace: true });
  }, [ready, user, profile, profileReady, error, nav]);

  return (
    <Shell tabs={false} bare>
      <div className="flex min-h-[60dvh] flex-col items-center justify-center text-center">
        {error ? (
          <>
            <p className="max-w-sm text-[15px] text-gap-dark" data-testid="auth-callback-error">{error}</p>
            <button className="btn-primary mt-4" onClick={() => nav("/", { replace: true })}>
              Back to start
            </button>
          </>
        ) : (
          <>
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-ink/20 border-t-ink" aria-hidden />
            <p className="mt-4 text-[15px] text-muted" data-testid="auth-callback-loading">Signing you in…</p>
          </>
        )}
      </div>
    </Shell>
  );
}
