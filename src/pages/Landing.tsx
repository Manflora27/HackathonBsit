import { useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { EngineBadge, Shell } from "../components/Shell";
import { useStore } from "../store";

function HeroPath() {
  const reduce = useStore((s) => s.reduceMotion);
  const nodes = [
    { g: 9, x: 40, glyph: "√=", tone: "bg-brand text-white" },
    { g: 8, x: 150, glyph: "( )²", tone: "bg-sky" },
    { g: 7, x: 70, glyph: "▦", tone: "bg-gap" },
  ];
  return (
    <div className="relative mx-auto h-[250px] w-[230px]" aria-hidden>
      <svg className="absolute inset-0" width="230" height="250">
        <path d="M74,40 C140,60 190,70 184,120 C178,170 110,170 104,205" fill="none" stroke="#1e1b3a" strokeOpacity=".25" strokeWidth="8"
          strokeDasharray="1 16" strokeLinecap="round" />
      </svg>
      {nodes.map((n, i) => (
        <motion.div
          key={n.g}
          className="absolute flex flex-col items-center"
          style={{ left: n.x, top: i * 82 + 4 }}
          initial={reduce ? false : { scale: 0, y: -20 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ delay: 0.2 + i * 0.25, type: "spring", stiffness: 260, damping: 15 }}
        >
          <span className={`flex h-[66px] w-[66px] items-center justify-center rounded-full border-[3px] border-ink font-display text-lg ${n.tone} ${i === 2 ? "bob" : ""}`}
            style={{ boxShadow: "0 5px 0 #1e1b3a" }}>
            {n.glyph}
          </span>
        </motion.div>
      ))}
      {[["Grade 9", 112, 26], ["Grade 8", 6, 108], ["Grade 7", 146, 190]].map(([label, x, y]) => (
        <span key={label as string} className="absolute font-display text-sm text-muted" style={{ left: x as number, top: y as number }}>
          {label}
        </span>
      ))}
      <motion.span
        className="absolute rounded-full border-2 border-ink bg-ink px-2 py-0.5 font-display text-xs text-white"
        style={{ left: 142, top: 214 }}
        initial={reduce ? false : { opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.1 }}
      >
        ← the gap!
      </motion.span>
    </div>
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
      <section className="pt-2 text-center">
        <HeroPath />
        <h1 className="mt-2 font-display text-[34px] font-bold leading-[1.05]">
          {fil ? "Hindi ka mahina sa math." : "You're not bad at math."}
          <span className="mt-1 block text-brand">{fil ? "Isang skill lang ang kulang." : "You're missing one skill."}</span>
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-[16px] text-muted">
          {fil
            ? "Isulat ang solusyon mo. Hahanapin namin ang linyang nagkamali — at ang skill mula sa mga nakaraang taon na nagdulot nito."
            : "Show your steps. We find the line that broke — and the skill from years back that caused it."}
        </p>
        <div className="mt-3">
          <EngineBadge />
        </div>
      </section>

      {!consent ? (
        <section className="card mt-6">
          <h2 className="font-display text-xl font-semibold">{fil ? "Bago tayo magsimula 👋" : "Before we start 👋"}</h2>
          <ul className="mt-3 space-y-2 text-[15px]">
            {[
              ["📝", fil ? "Math work at skill progress lang ang kinokolekta namin." : "We only collect your math work and skill progress."],
              ["🎯", fil ? "Para lang ito sa paghahanap ng gap mo at pagtuturo." : "It's used only to find your gaps and teach you."],
              ["🕶️", fil ? "Hindi nakikita ng AI ang pangalan mo — random ID lang." : "The AI never sees your name — only a random ID."],
              ["🎙️", fil ? "Ang voice ay tina-transcribe at binubura agad." : "Voice is transcribed, then deleted. No audio is kept."],
              ["🗑️", fil ? "I-download o burahin ang data mo anumang oras." : "Download or delete your data anytime."],
            ].map(([icon, text]) => (
              <li key={text} className="flex gap-3">
                <span className="text-lg">{icon}</span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
          <fieldset className="mt-4 space-y-2">
            <legend className="kicker text-muted">{fil ? "Sino ang pumapayag?" : "Who's giving consent?"}</legend>
            {(
              [
                ["school", fil ? "Naka-enroll ako sa klase (sa school)" : "I'm in a class (through my school)"],
                ["guardian", fil ? "Wala pa akong 18, pumayag ang guardian ko" : "I'm under 18 — my parent/guardian agrees"],
                ["self", fil ? "18 na ako o higit pa" : "I'm 18 or older"],
              ] as const
            ).map(([v, label]) => (
              <label key={v}
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border-[2.5px] px-3 py-2.5 text-[15px] transition ${by === v ? "border-ink bg-brand-soft" : "border-ink/20"}`}>
                <input type="radio" name="by" className="h-5 w-5 accent-[#6c3ce9]" checked={by === v} onChange={() => setBy(v)} />
                {label}
              </label>
            ))}
          </fieldset>
          <label className="mt-4 flex items-start gap-3 text-[15px]">
            <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[#6c3ce9]" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>{fil ? "Nabasa ko at pumapayag ako (RA 10173, Data Privacy Act)." : "I've read this and agree (RA 10173, Data Privacy Act of 2012)."}</span>
          </label>
          <button className="btn-primary mt-5 w-full" disabled={!agree} onClick={() => set({ consent: { by, at: Date.now() } })}>
            {fil ? "Tara na!" : "Let's go!"}
          </button>
        </section>
      ) : (
        <section className="mt-6 space-y-3">
          {(
            [
              ["student", "demo-student", "🎒", fil ? "Ako si Kyla" : "I'm Kyla", fil ? "Student · Grade 9" : "Student · Grade 9", "bg-brand-soft"],
              ["teacher", "demo-teacher", "📋", fil ? "Ako si Ms. Santos" : "I'm Ms. Santos", fil ? "Teacher · 9-Sampaguita" : "Teacher · 9-Sampaguita", "bg-ok-soft"],
              ["guest", "try-it", "✏️", fil ? "Subukan — walang account" : "Just try it", fil ? "Walang account · Ikaw lang ang makakakita" : "No account · Only you can see it", "bg-gap-soft"],
            ] as const
          ).map(([role, tid, icon, title, sub, tone]) => (
            <button key={role} className="card flex w-full items-center gap-4 !p-4 text-left transition active:translate-y-1 active:!shadow-none"
              onClick={() => enter(role)} data-testid={tid}>
              <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-[2.5px] border-ink text-2xl ${tone}`}>{icon}</span>
              <span className="flex-1">
                <span className="block font-display text-xl font-semibold">{title}</span>
                <span className="block text-sm text-muted">{sub}</span>
              </span>
              <span className="font-display text-2xl">→</span>
            </button>
          ))}
          <p className="pt-1 text-center text-xs text-muted">{fil ? "Demo accounts para sa judging" : "Demo accounts for judging"}</p>
        </section>
      )}
    </Shell>
  );
}
