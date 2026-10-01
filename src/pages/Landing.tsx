import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { motion } from "motion/react";
import { Bilog } from "../components/Bilog";
import { useCalm } from "../lib/calm";
import { Icon, InkCircle } from "../components/Icon";
import { Shell } from "../components/Shell";
import { useAuth } from "../auth";
import { authConfigured } from "../lib/supabase";
import { useStore } from "../store";

/** Bilog watches the drawing trace down, and lights up when the root gets circled. */
function HeroDrawing() {
  const calm = useCalm();
  const [drawn, setDrawn] = useState(false);
  const found = calm || drawn;
  const rootRef = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    const id = setTimeout(() => setDrawn(true), 2300); // when the drawing circles G7
    return () => clearTimeout(id);
  }, []);
  return (
    <div className="relative">
      <RootDrawing />
      {/* invisible anchor over the G7 root, for Bilog's eyes */}
      <span ref={rootRef} className="absolute bottom-[8%] left-1/2 h-2 w-2" aria-hidden />
      <div className="pointer-events-none absolute -left-[68px] top-[34%]">
        <Bilog size={52} mood={found ? "found" : "watch"} lookAt={rootRef} />
      </div>
    </div>
  );
}

/** Thin-line drawing of a mistake being traced down to its root. */
function RootDrawing() {
  const reduce = useStore((s) => s.reduceMotion);
  const t = (d: number) => (reduce ? { duration: 0 } : { duration: 0.9, delay: d, ease: "easeInOut" as const });
  return (
    <svg viewBox="0 0 300 210" className="mx-auto w-full max-w-[300px]" aria-hidden>
      <g fill="none" stroke="var(--color-ink)" strokeWidth="1.3" strokeLinecap="round" opacity=".28">
        <path d="M150 34 C150 80 82 70 74 118" />
        <path d="M150 34 C150 80 226 72 228 118" />
        <path d="M74 118 C74 150 40 150 36 182" />
        <path d="M228 118 C228 150 262 152 266 182" />
        <path d="M228 118 C228 150 190 150 186 182" />
      </g>
      <motion.path d="M150 34 C150 80 104 76 110 118 C116 158 150 150 150 176" fill="none" stroke="var(--color-gap)" strokeWidth="2.4"
        strokeLinecap="round" initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={t(0.3)} />
      {[
        [150, 34, "G9", "var(--color-card)"],
        [110, 118, "G8", "var(--color-card)"],
        [36, 182, "", "var(--color-ok)"],
        [266, 182, "", "var(--color-ok)"],
        [186, 182, "", "var(--color-card)"],
      ].map(([x, y, label, fill], i) => (
        <g key={i}>
          <circle cx={x as number} cy={y as number} r={label ? 17 : 9} fill={fill as string} stroke="var(--color-ink)" strokeOpacity=".3" strokeWidth="1.3" />
          {label && <text x={x as number} y={(y as number) + 5} textAnchor="middle" fontFamily="Young Serif" fontSize="13" fill="var(--color-ink)">{label}</text>}
        </g>
      ))}
      <motion.g initial={{ opacity: reduce ? 1 : 0, scale: reduce ? 1 : 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={t(1.1)} style={{ transformOrigin: "150px 182px" }}>
        <circle cx="150" cy="182" r="17" fill="var(--color-gap)" />
        <text x="150" y="187" textAnchor="middle" fontFamily="Young Serif" fontSize="13" fill="#fff">G7</text>
      </motion.g>
      <motion.path d="M128 172 C 132 152, 172 150, 176 176 C 180 202, 136 210, 126 190 C 122 180, 128 168, 140 163" fill="none" stroke="var(--color-gap)"
        strokeWidth="1.8" strokeLinecap="round" initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={t(1.5)} />
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="#fff" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3zM12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.600 0-4.800-1.800-5.600-4.100H3.100v2.600A10 10 0 0 0 12 22zM6.400 13.900a6 6 0 0 1 0-3.800V7.500H3.100a10 10 0 0 0 0 9zM12 5.900c1.500 0 2.800.5 3.800 1.500l2.900-2.900A10 10 0 0 0 3.100 7.500l3.300 2.600C7.200 7.700 9.400 5.900 12 5.900z"/>
    </svg>
  );
}

export default function Landing() {
  const nav = useNavigate();
  const { consent, set, lang } = useStore();
  const [by, setBy] = useState<"self" | "guardian" | "school">("school");
  const [agree, setAgree] = useState(false);
  const fil = lang === "fil";

  const { user, profile, ready, error, signInGoogle } = useAuth();

  useEffect(() => {
    if (!consent || !ready || !user) return;
    if (!profile) return void nav("/welcome", { replace: true });
    set({ role: profile.account_type === "teacher" ? "teacher" : "student", demo: false });
    nav(profile.account_type === "teacher" ? "/teacher" : "/student", { replace: true });
  }, [consent, ready, user, profile]); // eslint-disable-line react-hooks/exhaustive-deps

  const guest = () => {
    set({ role: "guest", demo: false });
    nav("/welcome");
  };

  return (
    <Shell tabs={false} bare>
      <section>
        <div className="mx-auto w-[40%] max-w-[150px]"><HeroDrawing /></div>
        <div className="kicker mt-3 text-gap-dark">{fil ? "Para sa math na nakakalito" : "A diagnostic for math"}</div>
        <h1 className="mt-1.5 text-[28px] leading-[1.06]">
          {fil ? "Hindi ka mahina sa math." : "You're not bad at math."}
          <br />
          {fil ? "May " : "You're missing "}
          <InkCircle className="px-1 text-gap">{fil ? "isang" : "one"}</InkCircle>
          {fil ? " skill lang na kulang." : " skill."}
        </h1>
        <p className="mt-2 text-[14px] leading-snug text-muted">
          {fil
            ? "Isulat ang solusyon mo. Hahanapin namin ang linyang nagkamali, at ang skill mula sa mga nakaraang taon na nagdulot nito."
            : "Show your steps. We find the line that broke, and the skill from years back that caused it."}
        </p>
      </section>

      {!consent ? (
        <section className="card mt-7">
          <h2 className="text-[24px]">{fil ? "Bago tayo magsimula" : "Before we start"}</h2>
          <ul className="mt-3 divide-y divide-line text-[15px]">
            {[
              fil ? "Math work at skill progress lang ang kinokolekta namin." : "We only collect your math work and skill progress.",
              fil ? "Para lang ito sa paghahanap ng gap mo at pagtuturo." : "It's used only to find your gaps and teach you.",
              fil ? "Hindi nakikita ng AI ang pangalan mo, random ID lang." : "The AI never sees your name, only a random ID.",
              fil ? "Ang voice ay tina-transcribe at binubura agad." : "Voice is transcribed, then deleted. No audio is kept.",
              fil ? "I-download o burahin ang data mo anumang oras." : "Download or delete your data anytime.",
            ].map((text, i) => (
              <li key={i} className="flex gap-3 py-2.5">
                <span className="font-display text-gap">{i + 1}</span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
          <fieldset className="mt-4 space-y-2">
            <legend className="kicker mb-2 text-muted">{fil ? "Sino ang pumapayag?" : "Who's giving consent?"}</legend>
            {(
              [
                ["school", fil ? "Naka-enroll ako sa klase (sa school)" : "I'm in a class (through my school)"],
                ["guardian", fil ? "Wala pa akong 18, pumayag ang guardian ko" : "I'm under 18 and my parent or guardian agrees"],
                ["self", fil ? "18 na ako o higit pa" : "I'm 18 or older"],
              ] as const
            ).map(([v, label]) => (
              <label key={v}
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-[15px] transition ${by === v ? "border-ink/50 bg-paper" : "border-line"}`}>
                <input type="radio" name="by" className="h-4 w-4 accent-[#1e2b27]" checked={by === v} onChange={() => setBy(v)} />
                {label}
              </label>
            ))}
          </fieldset>
          <label className="mt-4 flex items-start gap-3 text-[15px]">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-[#1e2b27]" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>{fil ? "Nabasa ko at pumapayag ako (RA 10173, Data Privacy Act)." : "I've read this and agree (RA 10173, Data Privacy Act of 2012)."}</span>
          </label>
          <button className="btn-primary mt-5 w-full" disabled={!agree} onClick={() => set({ consent: { by, at: Date.now() } })}>
            {fil ? "Tara na" : "Let's go"} <Icon name="arrow" size={18} />
          </button>
        </section>
      ) : (
        <section className="card mt-5 !p-5">
          <h2 className="text-[22px]">{fil ? "Mag-sign in" : "Sign in to save your roots"}</h2>
                    {authConfigured ? (
            <button className="btn-primary mt-5 w-full" onClick={signInGoogle} disabled={!ready} data-testid="google-signin">
              <GoogleMark /> {fil ? "Magpatuloy gamit ang Google" : "Continue with Google"}
            </button>
          ) : (
            <p className="mt-3 rounded-2xl bg-gap-soft/70 px-3 py-2 text-[13px] text-gap-dark" data-testid="auth-unconfigured">
              {fil ? "Hindi pa nakakonekta ang sign-in." : "Sign-in isn't connected yet (add the Supabase keys)."}
            </p>
          )}
          {error && <p className="mt-3 text-[14px] text-gap-dark">{error}</p>}
          <div className="my-3 flex items-center gap-3 text-[12px] uppercase tracking-[0.16em] text-muted">
            <span className="rule" /> {fil ? "o" : "or"} <span className="rule" />
          </div>
          <button className="btn-ghost w-full" onClick={guest} data-testid="try-it">
            {fil ? "Subukan nang walang account" : "Try without an account"}
          </button>
        </section>
      )}
      {consent && (
        <p className="mt-4 text-center text-[13px] text-muted">
          <Link to="/demo" className="underline decoration-dotted underline-offset-4" data-testid="to-demo">{fil ? "Mga demo account para sa judging" : "Demo accounts for judging"}</Link>
        </p>
      )}
    </Shell>
  );
}
