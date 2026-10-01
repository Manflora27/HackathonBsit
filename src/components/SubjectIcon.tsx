import type { SubjectId } from "../data/curriculum";
import { Icon, type IconName } from "./Icon";

/** Each subject's line icon, in a soft round badge. Math subjects warm, science subjects green. */
const SCIENCE = new Set<SubjectId>(["science", "general-science", "physics", "chemistry", "biology", "earth-space"]);

export function SubjectIcon({ id, size = 40, on = false, onColor = false }: { id: SubjectId; size?: number; on?: boolean; onColor?: boolean }) {
  const sci = SCIENCE.has(id);
  const tone = onColor ? "bg-white/20 text-white" : on ? (sci ? "bg-ok text-white" : "bg-gap text-white") : sci ? "bg-ok-soft text-ok" : "bg-gap-soft text-gap-dark";
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full transition-colors ${tone}`} style={{ width: size, height: size }} aria-hidden>
      <Icon name={`s-${id}` as IconName} size={Math.round(size * 0.55)} strokeWidth={1.7} />
    </span>
  );
}
