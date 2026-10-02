import { useNavigate } from "react-router";
import { Icon } from "../components/Icon";
import { Shell } from "../components/Shell";
import { useStore } from "../store";
import { useT } from "../i18n";

/** Seeded demo accounts for judging. Local only; nothing here touches real accounts. */
export default function Demo() {
  const nav = useNavigate();
  const t = useT();
  const { set, consent, resetDemo } = useStore();
  // Wipe local progress first so the run starts from nothing.
  const resetState = () => (resetDemo(), {});
  const enter = () => {
    set({ role: "student", demo: true, consent: consent ?? { by: "school", at: Date.now() } });
    nav("/student");
  };
  return (
    <Shell tabs={false} back="/" title={t("demo.title")}>
      <div className="kicker mt-3 text-gap-dark">{t("demo.kicker")}</div>
      <h1 className="mt-1 text-[32px] leading-tight">{t("demo.heading")}</h1>
      <p className="mt-2 text-[15px] text-muted">{t("demo.intro")}</p>
      <button className="card mt-5 flex w-full items-center gap-4 !p-4 text-left" data-testid="demo-fresh"
        onClick={() => { set({ ...resetState(), consent: consent ?? { by: "school", at: Date.now() }, role: "guest", demoFlow: true }); nav("/welcome"); }}>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink font-display text-[19px] text-white">1</span>
        <span className="flex-1">
          <span className="block font-display text-[21px] leading-tight">{t("demo.fresh")}</span>
          <span className="block text-[14px] text-muted">{t("demo.freshNote")}</span>
        </span>
        <Icon name="arrow" size={20} className="text-muted" />
      </button>
      <section className="card mt-4 !p-2">
        {([
          ["student", "demo-student", "Kyla", "Student, Grade 9", "bg-gap-soft text-gap-dark"],
        ] as const).map(([role, tid, title, sub, tone], i) => (
          <button key={role} onClick={enter} data-testid={tid}
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
