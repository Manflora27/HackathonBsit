import { useStore } from "../store";

/**
 * The painted backdrop the glass sits on: soft pigment washes, contour lines,
 * paper fibers and grain. Fixed, so content glides over it and the blur reads.
 */
export function Ambient({ quiet = false }: { quiet?: boolean }) {
  const reduce = useStore((s) => s.reduceMotion);
  return (
    <div className={`ambient ${quiet ? "quiet" : ""}`} aria-hidden>
      <div className={`wash wash-a ${reduce ? "" : "drift-a"}`} />
      <div className={`wash wash-b ${reduce ? "" : "drift-b"}`} />
      <div className={`wash wash-c ${reduce ? "" : "drift-c"}`} />
      <div className="contour" />
      <div className="fiber" />
      <div className="grain" />
    </div>
  );
}
