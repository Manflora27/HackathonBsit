import { useEffect, useState } from "react";
import { type SubjectId } from "../data/curriculum";
import { downloadPack, packStatus } from "../lessons/pack";
import { useStore } from "../store";
import { Icon } from "./Icon";

/** "Download for offline" for one subject and grade. */
export function OfflinePack({ subject, grade }: { subject: SubjectId; grade: number }) {
  const fil = useStore((s) => s.lang) === "fil";
  const [st, setSt] = useState<{ have: number; total: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(0);

  useEffect(() => { void packStatus(subject, grade).then(setSt); }, [subject, grade]);
  if (!st) return null;
  const complete = st.have === st.total;

  async function go() {
    setBusy(true);
    setFailed(0);
    const r = await downloadPack(subject, grade, (have, total) => setSt({ have, total }));
    setFailed(r.failed);
    setBusy(false);
  }

  return (
    <div className="card-flat mt-2 flex items-center gap-3 !p-3 text-[14px]" data-testid={`pack-${subject}`}>
      <Icon name="download" size={18} className={complete ? "text-ok" : "text-muted"} />
      <div className="flex-1">
        <div>
          {complete ? (fil ? "Handa na offline" : "Ready offline") : fil ? "I-download para sa offline" : "Download for offline"}
          <span className="text-muted"> · {st.have}/{st.total}</span>
        </div>
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-soft"><div className="h-full rounded-full bg-ok transition-all" style={{ width: `${(st.have / st.total) * 100}%` }} /></div>
        {failed > 0 && <div className="mt-1 text-gap-dark">{fil ? `${failed} lesson ang hindi nakuha. Subukan ulit online.` : `${failed} lessons couldn't be prepared. Try again when online.`}</div>}
      </div>
      {!complete && <button className="btn-ghost btn-sm" onClick={go} disabled={busy} data-testid={`pack-go-${subject}`}>{busy ? "…" : fil ? "Kunin" : "Get"}</button>}
    </div>
  );
}
