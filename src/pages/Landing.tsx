import { useState } from "react";
import { useNavigate } from "react-router";
import { EngineBadge, Shell } from "../components/Shell";
import { useT } from "../i18n";
import { useStore } from "../store";

export default function Landing() {
  const t = useT();
  const nav = useNavigate();
  const { consent, set, lang } = useStore();
  const [by, setBy] = useState<"self" | "guardian" | "school">("school");
  const [agree, setAgree] = useState(false);
  const fil = lang === "fil";

  const enter = (role: "student" | "teacher" | "guest") => {
    set({ role });
    nav(role === "teacher" ? "/teacher" : role === "guest" ? "/solve/p-try-1" : "/student");
  };

  return (
    <Shell>
      <section className="pt-6 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          {fil ? "Hindi ka mahina sa math." : "You're not bad at math."}
          <br />
          <span className="text-brand">{fil ? "May isang skill lang na kulang." : "You're missing one skill."}</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
          {fil
            ? "Isulat ang solusyon mo step by step. Hahanapin namin ang eksaktong linya kung saan ito nagkamali, at ang skill mula sa mga nakaraang taon na nagdulot nito."
            : "Write your solution step by step. We find the exact line where it went wrong, and the skill from years back that caused it."}
        </p>
        <div className="mt-3">
          <EngineBadge />
        </div>
      </section>

      {!consent ? (
        <section className="card mx-auto mt-8 max-w-xl">
          <h2 className="text-lg font-bold">{fil ? "Bago tayo magsimula" : "Before we start"}</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] text-muted">
            <li>{fil ? "Ang kinokolekta lang namin: ang math work mo at ang progress mo sa skills." : "We only collect your math work and your skill progress."}</li>
            <li>{fil ? "Ginagamit lang ito para hanapin ang gap mo at turuan ka." : "It's used only to find your gaps and teach you."}</li>
            <li>{fil ? "Hindi ipinapadala sa AI ang pangalan mo — random ID lang (hal. \"Student 402\")." : "The AI never sees your name — only a random ID like \"Student 402\"."}</li>
            <li>{fil ? "Kung gagamit ka ng boses, ita-transcribe ito at buburahin agad. Hindi namin sine-save ang audio." : "If you use voice, it's transcribed and then discarded. We never store the audio."}</li>
            <li>{fil ? "Puwede mong i-download o burahin ang data mo anumang oras sa Settings." : "You can download or delete your data anytime in Settings."}</li>
          </ul>
          <fieldset className="mt-4 space-y-2 text-[15px]">
            <legend className="font-semibold">{fil ? "Sino ang nagbibigay ng pahintulot?" : "Who is giving consent?"}</legend>
            {(
              [
                ["school", fil ? "Naka-enroll ako sa klase (consent sa pamamagitan ng school)" : "I'm in a class (consent through my school)"],
                ["guardian", fil ? "Wala pa akong 18 at pumayag ang magulang/guardian ko" : "I'm under 18 and my parent/guardian agrees"],
                ["self", fil ? "18 taong gulang na ako o higit pa" : "I'm 18 or older"],
              ] as const
            ).map(([v, label]) => (
              <label key={v} className="flex items-center gap-2">
                <input type="radio" name="by" checked={by === v} onChange={() => setBy(v)} />
                {label}
              </label>
            ))}
          </fieldset>
          <label className="mt-4 flex items-start gap-2 text-[15px]">
            <input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>{fil ? "Nabasa ko ito at pumapayag ako (RA 10173, Data Privacy Act)." : "I've read this and agree (RA 10173, Data Privacy Act of 2012)."}</span>
          </label>
          <button className="btn-primary mt-4 w-full" disabled={!agree} onClick={() => set({ consent: { by, at: Date.now() } })}>
            {fil ? "Magpatuloy" : "Continue"}
          </button>
        </section>
      ) : (
        <section className="mx-auto mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
          <button className="card text-left transition hover:border-brand" onClick={() => enter("student")} data-testid="demo-student">
            <div className="text-2xl">🎒</div>
            <div className="mt-2 font-bold">{fil ? "Demo bilang Student" : "Demo as Student"}</div>
            <div className="text-sm text-muted">Kyla · Grade 9</div>
          </button>
          <button className="card text-left transition hover:border-brand" onClick={() => enter("teacher")} data-testid="demo-teacher">
            <div className="text-2xl">📋</div>
            <div className="mt-2 font-bold">{fil ? "Demo bilang Teacher" : "Demo as Teacher"}</div>
            <div className="text-sm text-muted">Ms. Santos · 9-Sampaguita</div>
          </button>
          <button className="card text-left transition hover:border-brand" onClick={() => enter("guest")} data-testid="try-it">
            <div className="text-2xl">✏️</div>
            <div className="mt-2 font-bold">{fil ? "Subukan — walang account" : "Try it — no account"}</div>
            <div className="text-sm text-muted">{t("onlyYou")}</div>
          </button>
        </section>
      )}
    </Shell>
  );
}
