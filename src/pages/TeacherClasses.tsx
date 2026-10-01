import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { useAuth } from "../auth";
import { Icon } from "../components/Icon";
import { Shell } from "../components/Shell";
import { SubjectIcon } from "../components/SubjectIcon";
import { subjectsForGrade, type SubjectId } from "../data/curriculum";
import { useT } from "../i18n";
import { fetchRoster } from "../school";

/** A teacher's classes, and making a new one. */
export default function TeacherClasses() {
  const t = useT();
  const nav = useNavigate();
  const { profile, classes } = useAuth();
  const [adding, setAdding] = useState(classes.length === 0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const hour = new Date().getHours();

  useEffect(() => {
    let live = true;
    Promise.all(classes.map(async (c) => [c.id, (await fetchRoster(c.id)).length] as const)).then((r) => live && setCounts(Object.fromEntries(r)));
    return () => { live = false; };
  }, [classes]);

  return (
    <Shell>
      <div className="kicker mt-2 text-muted">{t(hour < 12 ? "home.goodMorning" : hour < 18 ? "home.goodAfternoon" : "home.goodEvening")}</div>
      <h1 className="mt-1 text-[36px] leading-none">{profile?.display_name || t("teacher.teacherFallback")}.</h1>

      {classes.length > 0 && (
        <>
          <h2 className="kicker mt-8 text-muted">{t("classes.yourClasses")}</h2>
          <ul className="mt-2 divide-y divide-ink/10 border-y border-ink/10" data-testid="class-list">
            {classes.map((c) => (
              <li key={c.id}>
                <button className="flex w-full items-center gap-4 py-3.5 text-left" onClick={() => nav(`/teacher/${c.id}`)} data-testid={`class-${c.class_code}`}>
                  <SubjectIcon id={(c.subject ?? "math") as SubjectId} size={42} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-[20px] leading-tight">{c.name}{c.section ? ` · ${c.section}` : ""}</span>
                    <span className="mt-0.5 block text-[13px] text-muted">
                      {c.subject ? `${t.subject(c.subject)} · ` : ""}{c.grade ? `${t("common.gradeN", { n: c.grade })} · ` : ""}{t.plural("teacher.studentCount", counts[c.id] ?? 0)}
                    </span>
                  </span>
                  <span className="font-mono text-[13px] tracking-wider text-muted">{c.class_code}</span>
                  <Icon name="chevron" size={16} className="text-muted" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <AnimatePresence initial={false}>
        {adding ? (
          <motion.div key="form" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <NewClass first={classes.length === 0} onCancel={classes.length ? () => setAdding(false) : undefined} onMade={(id) => nav(`/teacher/${id}`)} />
          </motion.div>
        ) : (
          <motion.button key="add" className="btn-ghost mt-5 w-full" onClick={() => setAdding(true)} data-testid="new-class">
            + {t("classes.newClass")}
          </motion.button>
        )}
      </AnimatePresence>
    </Shell>
  );
}

const GRADES = Array.from({ length: 12 }, (_, i) => i + 1);

function NewClass({ first, onCancel, onMade }: { first: boolean; onCancel?: () => void; onMade: (id: string) => void }) {
  const t = useT();
  const { createClass, error } = useAuth();
  const [name, setName] = useState("");
  const [section, setSection] = useState("");
  const [grade, setGrade] = useState(9);
  const options = subjectsForGrade(grade);
  const [subject, setSubject] = useState<SubjectId>("math");
  const [busy, setBusy] = useState(false);
  const subj = options.includes(subject) ? subject : options[0];

  return (
    <form className="mt-8" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      const id = await createClass({ name, section, subject: subj, grade });
      setBusy(false);
      if (id) onMade(id);
    }}>
      <h2 className="font-display text-[26px] leading-tight">{first ? t("classes.firstClass") : t("classes.newClass")}</h2>
      <p className="mt-1 text-[14.5px] text-muted">{t("classes.newClassSub")}</p>

      <label className="kicker mt-5 block text-muted" htmlFor="cn">{t("teacher.className")}</label>
      <input id="cn" className="input mt-2 !font-sans" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("teacher.classNamePlaceholder")} data-testid="class-name" />

      <label className="kicker mt-4 block text-muted" htmlFor="cs">{t("teacher.sectionOptional")}</label>
      <input id="cs" className="input mt-2 !font-sans" value={section} onChange={(e) => setSection(e.target.value)} placeholder="Sampaguita" data-testid="class-section" />

      <div className="kicker mt-4 text-muted">{t("classes.grade")}</div>
      <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup">
        {GRADES.map((g) => (
          <button key={g} type="button" role="radio" aria-checked={g === grade} onClick={() => setGrade(g)} data-testid={`class-grade-${g}`}
            className={`h-10 w-10 rounded-full font-display text-[15px] transition ${g === grade ? "bg-ink text-paper" : "bg-white/55"}`}>{g}</button>
        ))}
      </div>

      <div className="kicker mt-4 text-muted">{t("classes.subject")}</div>
      <div className="mt-2 flex flex-wrap gap-2" role="radiogroup">
        {options.map((s) => (
          <button key={s} type="button" role="radio" aria-checked={s === subj} onClick={() => setSubject(s)} data-testid={`class-subject-${s}`}
            className={`flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 text-[14px] font-semibold transition ${s === subj ? "bg-ink text-paper" : "bg-white/55"}`}>
            <SubjectIcon id={s} size={26} onColor={s === subj} /> {t.subject(s)}
          </button>
        ))}
      </div>

      {error && <p className="mt-3 text-[14px] text-gap-dark">{error}</p>}
      <div className="mt-6 flex gap-2">
        {onCancel && <button type="button" className="btn-ghost flex-1" onClick={onCancel}>{t("teacher.cancel")}</button>}
        <button className="btn-primary flex-1" disabled={!name.trim() || busy} data-testid="create-class">{t("teacher.createClass2")}</button>
      </div>
      <p className="mt-2 text-center text-[13px] text-muted">{t("teacher.youllGetCodeShare")}</p>
    </form>
  );
}
