import { useEffect, useState } from "react";
import { type SubjectId } from "../data/curriculum";
import { downloadPack, packStatus } from "../lessons/pack";
import { Icon } from "./Icon";
import { useT } from "../i18n";

/**
 * "Download for offline" for one subject and grade, as a small round button:
 * a ring fills as lessons are saved, and it turns into a check once the whole plan is on the device.
 */
export function OfflinePack({ subject, grade }: { subject: SubjectId; grade: number }) {
  const t = useT();
  const [st, setSt] = useState<{ have: number; total: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(0);

  useEffect(() => { void packStatus(subject, grade).then(setSt); }, [subject, grade]);
  if (!st) return null;
  const complete = st.have === st.total;
  const R = 15, C = 2 * Math.PI * R;
  const label = `${complete ? t("offline.readyOffline") : t("offline.downloadOffline")} · ${st.have}/${st.total}`;

  async function go(e: React.MouseEvent) {
    e.stopPropagation();
    setBusy(true);
    setFailed(0);
    const r = await downloadPack(subject, grade, (have, total) => setSt({ have, total }));
    setFailed(r.failed);
    setBusy(false);
  }

  return (
    <span className="relative inline-flex" data-testid={`pack-${subject}`}>
      <button type="button" onClick={go} disabled={busy || complete} aria-label={label} title={failed ? t("offline.failed", { count: failed }) : label}
        className={`relative flex h-9 w-9 items-center justify-center rounded-full ${complete ? "text-ok" : failed ? "text-gap-dark" : "text-muted"}`} data-testid={`pack-go-${subject}`}>
        <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="18" cy="18" r={R} fill="none" stroke="currentColor" strokeOpacity=".18" strokeWidth="2" />
          <circle cx="18" cy="18" r={R} fill="none" stroke="var(--color-ok)" strokeWidth="2" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - st.have / st.total)} className="transition-[stroke-dashoffset] duration-500" />
        </svg>
        <Icon name={complete ? "check" : "download"} size={15} strokeWidth={complete ? 2.4 : 1.8} className={busy ? "animate-pulse" : ""} />
      </button>
    </span>
  );
}
