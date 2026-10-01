import { useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { Icon, InkCircle } from "../components/Icon";
import { EngineBadge, Shell } from "../components/Shell";
import { useStore } from "../store";

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

export default function Landing() {
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
    <Shell tabs={false}>
      <section className="pt-3">
        <RootDrawing />
        <div className="kicker mt-4 text-gap-dark">{fil ? "Para sa math na nakakalito" : "A diagnostic for math"}</div>
        <h1 className="mt-2 text-[40px] leading-[1.02]">
          {fil ? "Hindi ka mahina sa math." : "You're not bad at math."}
          <br />
          {fil ? "May " : "You're missing "}
          <InkCircle className="px-1 text-gap">{fil ? "isang" : "one"}</InkCircle>
          {fil ? " skill lang na kulang." : " skill."}
        </h1>
        <p className="mt-4 text-[17px] leading-relaxed text-muted">
          {fil
            ? "Isulat ang solusyon mo. Hahanapin namin ang linyang nagkamali, at ang skill mula sa mga nakaraang taon na nagdulot nito."
            : "Show your steps. We find the line that broke, and the skill from years back that caused it."}
        </p>
        <div className="mt-3">
          <EngineBadge />
        </div>
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
        <section className="card mt-7 !p-2">
          {(
            [
              ["student", "demo-student", "Kyla", fil ? "Student, Grade 9" : "Student, Grade 9", "bg-gap-soft text-gap-dark"],
              ["teacher", "demo-teacher", "Ms. Santos", fil ? "Teacher, 9-Sampaguita" : "Teacher, 9-Sampaguita", "bg-ok-soft text-ok-dark"],
              ["guest", "try-it", fil ? "Subukan lang" : "Just try it", fil ? "Walang account, ikaw lang ang makakakita" : "No account, only you can see it", "bg-soft text-ink"],
            ] as const
          ).map(([role, tid, title, sub, tone], i) => (
            <button key={role} className={`flex w-full items-center gap-4 rounded-[22px] px-3 py-3.5 text-left transition hover:bg-paper ${i ? "border-t border-line" : ""}`}
              onClick={() => enter(role)} data-testid={tid}>
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-display text-[19px] ${tone}`}>{title[0]}</span>
              <span className="flex-1">
                <span className="block font-display text-[21px] leading-tight">{title}</span>
                <span className="block text-[14px] text-muted">{sub}</span>
              </span>
              <Icon name="arrow" size={20} className="text-muted" />
            </button>
          ))}
        </section>
      )}
      {consent && <p className="mt-3 text-center text-[13px] text-muted">{fil ? "Mga demo account para sa judging" : "Demo accounts for judging"}</p>}
    </Shell>
  );
}
