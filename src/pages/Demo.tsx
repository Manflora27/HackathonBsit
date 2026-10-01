import { useNavigate } from "react-router";
import { Icon } from "../components/Icon";
import { Shell } from "../components/Shell";
import { useStore } from "../store";

/** Seeded demo accounts for judging. Local only; nothing here touches real accounts. */
export default function Demo() {
  const nav = useNavigate();
  const { set, consent } = useStore();
  const enter = (role: "student" | "teacher") => {
    set({ role, demo: true, consent: consent ?? { by: "school", at: Date.now() } });
    nav(role === "teacher" ? "/teacher" : "/student");
  };
  return (
    <Shell tabs={false} back="/" title="Demo">
      <div className="kicker mt-3 text-gap-dark">Judging mode</div>
      <h1 className="mt-1 text-[32px] leading-tight">Pre-seeded accounts</h1>
      <p className="mt-2 text-[15px] text-muted">These skip sign-in and use sample data (Kyla and a class of 30). Real accounts live on the main screen.</p>
      <section className="card mt-5 !p-2">
        {([
          ["student", "demo-student", "Kyla", "Student, Grade 9", "bg-gap-soft text-gap-dark"],
          ["teacher", "demo-teacher", "Ms. Santos", "Teacher, 9-Sampaguita", "bg-ok-soft text-ok-dark"],
        ] as const).map(([role, tid, title, sub, tone], i) => (
          <button key={role} onClick={() => enter(role)} data-testid={tid}
            className={`flex w-full items-center gap-4 rounded-[22px] px-3 py-3.5 text-left transition hover:bg-white/40 ${i ? "border-t border-line" : ""}`}>
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-display text-[19px] ${tone}`}>{title[0]}</span>
            <span className="flex-1">
              <span className="block font-display text-[21px] leading-tight">{title}</span>
              <span className="block text-[14px] text-muted">{sub}</span>
            </span>
            <Icon name="arrow" size={20} className="text-muted" />
          </button>
        ))}
      </section>
    </Shell>
  );
}
