import { motion } from "motion/react";
import { useMemo } from "react";
import { useStore } from "../store";

const COLORS = ["#d9532b", "#5b7f4f", "#c8912b", "#3d5a80", "#1e2b27"];

export function Confetti({ count = 28 }: { count?: number }) {
  const reduce = useStore((s) => s.reduceMotion);
  const bits = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: (Math.random() - 0.5) * 340,
        y: -120 - Math.random() * 220,
        r: Math.random() * 540 - 270,
        c: COLORS[i % COLORS.length],
        s: 8 + Math.random() * 8,
        round: Math.random() > 0.5,
      })),
    [count],
  );
  if (reduce) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2" aria-hidden>
      {bits.map((b, i) => (
        <motion.span
          key={i}
          className="absolute border border-line"
          style={{ width: b.s, height: b.s, background: b.c, borderRadius: b.round ? 999 : 3 }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{ x: b.x, y: [0, b.y, b.y + 320], opacity: [1, 1, 0], rotate: b.r }}
          transition={{ duration: 1.6, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}
