import { useState } from "react";
import { motion } from "motion/react";
import { useStore } from "../store";
import { translate } from "../locales";

/**
 * (a + b)² as a square cut into a², two a·b strips and b².
 * The two strips are the "2ab" a student drops when they write a² + b².
 * b can be a number (x + 3: pieces x², 9, 3x) or a letter (a + b: pieces a², b², ab).
 */
export function AreaModel({ a = "x", b = 3 }: { a?: string; b?: number | string }) {
  const lang = useStore((s) => s.lang);
  const reduce = useStore((s) => s.reduceMotion);
  // Opens on what the student wrote (a² and b²), so the first frame already says something.
  const FIRST = 1;
  const [stage, setStage] = useState(reduce ? 3 : FIRST);
  const X = 190; // px for x
  const B = 70; // px for b
  const S = X + B;
  const pad = 30;
  const fade = (on: boolean, delay = 0) => ({
    initial: false as const,
    animate: { opacity: on ? 1 : 0, scale: on ? 1 : 0.85 },
    transition: { duration: reduce ? 0 : 0.6, delay: reduce ? 0 : delay },
  });

  const num = typeof b === "number";
  const L = {
    side: `${a} + ${b}`,
    aSq: `${a}²`,
    bSq: num ? String(b * b) : `${b}²`,
    strip: num ? `${b}${a}` : `${a}${b}`,
    two: num ? `${2 * b}${a}` : `2${a}${b}`,
  };
  const captions = (["areaModel.caption1", "areaModel.caption2", "areaModel.caption3", "areaModel.caption4"] as const).map((k) => translate(lang, k, L));

  return (
    <div className="card !p-4">
      <p className="min-h-12 text-center font-display text-[17px]" aria-live="polite">{captions[stage]}</p>
      <div className="mb-3 mt-2 flex justify-center gap-2">
        {stage < 3 ? (
          <button className="btn-primary btn-sm" onClick={() => setStage((s) => s + 1)}>
            {translate(lang, "areaModel.next")} →
          </button>
        ) : (
          <button className="btn-ghost btn-sm" onClick={() => setStage(FIRST)}>
            {translate(lang, "areaModel.replay")}
          </button>
        )}
      </div>
      <svg viewBox={`0 0 ${S + pad * 2} ${S + pad * 2}`} className="mx-auto block w-full max-w-[340px]" role="img"
        aria-label={captions[3]}>
        <g transform={`translate(${pad},${pad})`}>
          {/* side labels */}
          <text x={X / 2} y={-10} textAnchor="middle" className="fill-muted text-[16px]">{a}</text>
          <text x={X + B / 2} y={-10} textAnchor="middle" className="fill-muted text-[16px]">{b}</text>
          <text x={-12} y={X / 2} textAnchor="middle" className="fill-muted text-[16px]">{a}</text>
          <text x={-12} y={X + B / 2} textAnchor="middle" className="fill-muted text-[16px]">{b}</text>

          <rect width={S} height={S} rx={6} fill="#fff" stroke="#1e2b27" strokeWidth={3} />

          <motion.g {...fade(stage >= 1)}>
            <rect width={X} height={X} fill="#e2e7de" stroke="#5b7f4f" strokeWidth={2} />
            <text x={X / 2} y={X / 2 + 8} textAnchor="middle" className="fill-brand text-[26px] font-semibold">{L.aSq}</text>
            <rect x={X} y={X} width={B} height={B} fill="#e2e7de" stroke="#5b7f4f" strokeWidth={2} />
            <text x={X + B / 2} y={X + B / 2 + 7} textAnchor="middle" className="fill-brand text-[20px] font-semibold">{L.bSq}</text>
          </motion.g>

          <motion.g {...fade(stage >= 2)}>
            <rect x={X} width={B} height={X} fill="#f7ddcf" stroke="#1e2b27" strokeWidth={3} />
            <text x={X + B / 2} y={X / 2 + 7} textAnchor="middle" className="fill-gap-dark font-display text-[22px] font-bold">{L.strip}</text>
          </motion.g>
          <motion.g {...fade(stage >= 2, 0.35)}>
            <rect y={X} width={X} height={B} fill="#f7ddcf" stroke="#1e2b27" strokeWidth={3} />
            <text x={X / 2} y={X + B / 2 + 7} textAnchor="middle" className="fill-gap-dark font-display text-[22px] font-bold">{L.strip}</text>
          </motion.g>
        </g>
      </svg>
    </div>
  );
}
