import { useEffect, useState } from "react";
import { motion } from "motion/react";
import type { SubjectId } from "../data/curriculum";
import { useT } from "../i18n";
import { previewClass, type ClassPreview } from "../school";
import { Icon } from "./Icon";

/**
 * Before joining a class: which class this code is, who teaches it, and exactly what that teacher will see
 * and can do once the student joins. Nothing is shared until they press Join.
 */
export function JoinClassSheet({ code, onConfirm, onClose }: { code: string; onConfirm: () => Promise<boolean>; onClose: () => void }) {
  const t = useT();
  const [cls, setCls] = useState<ClassPreview | null | "loading">("loading");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    void previewClass(code).then((c) => live && setCls(c));
    return () => { live = false; };
  }, [code]);

  const subject = cls && cls !== "loading" && cls.subject ? t.subject(cls.subject as SubjectId) : t("join.thisSubject");
  const item = (icon: "check" | "close", text: string) => (
    <li className="flex items-start gap-2.5">
      <Icon name={icon} size={16} className={`mt-0.5 shrink-0 ${icon === "check" ? "text-ink/70" : "text-ok"}`} />
      <span>{text}</span>
    </li>
  );

  return (
    <motion.div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/30 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.aside initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal data-testid="join-sheet"
        className="glass-strong max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] px-5 pb-8 pt-4">
        <div className="mx-auto h-1 w-10 rounded-full bg-ink/15" />

        {cls === "loading" ? (
          <p className="mt-8 text-center text-[15px] text-muted">{t("join.checking")}</p>
        ) : !cls || cls.removed ? (
          <>
            <p className="mt-6 text-[16px]" data-testid="join-error">{cls?.removed ? t("home.removedFromClass") : t("home.couldntFindCodeCheck")}</p>
            <button className="btn-ghost mt-5 w-full" onClick={onClose}>{t("teacher.close")}</button>
          </>
        ) : (
          <>
            <div className="kicker mt-4 text-muted">{t("join.kicker")}</div>
            <h2 className="mt-1 text-[26px] leading-tight">{cls.name}{cls.section ? ` · ${cls.section}` : ""}</h2>
            <p className="mt-1 text-[14.5px] text-muted">
              {[subject, cls.grade ? t("common.gradeN", { n: cls.grade }) : null, cls.teacher ? t("join.taughtBy", { teacher: cls.teacher }) : null].filter(Boolean).join(" · ")}
            </p>

            <div className="kicker mt-6 text-ink">{t("join.canSee")}</div>
            <ul className="mt-2 space-y-2 text-[15px] leading-snug" data-testid="join-can-see">
              {item("check", t("join.seeName"))}
              {item("check", t("join.seeScores"))}
              {item("check", t("join.seeProgress", { subject }))}
            </ul>

            <div className="kicker mt-5 text-ink">{t("join.canDo")}</div>
            <ul className="mt-2 space-y-2 text-[15px] leading-snug">
              {item("check", t("join.doSend"))}
              {item("check", t("join.doRemove"))}
            </ul>

            <div className="kicker mt-5 text-ok-dark">{t("join.private")}</div>
            <ul className="mt-2 space-y-2 text-[15px] leading-snug" data-testid="join-private">
              {item("close", t("join.privOther", { subject }))}
              {item("close", t("join.privPractice"))}
            </ul>

            <div className="mt-7 flex gap-2">
              <button className="btn-ghost flex-1" onClick={onClose}>{t("teacher.cancel")}</button>
              <button className="btn-primary flex-1" disabled={busy} data-testid="join-confirm"
                onClick={async () => { setBusy(true); if (!(await onConfirm())) setBusy(false); }}>
                {t("join.confirm")}
              </button>
            </div>
          </>
        )}
      </motion.aside>
    </motion.div>
  );
}
