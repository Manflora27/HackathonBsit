import { useState } from "react";
import { motion } from "motion/react";
import { useStore } from "../store";

/**
 * (x + b)^2 as a square cut into x², two b·x strips and b².
 * The two strips are the "2bx" a student drops when they write x² + b².
 */
export function AreaModel({ b = 3 }: { b?: number }) {
  const lang = useStore((s) => s.lang);
  const reduce = useStore((s) => s.reduceMotion);
  const [stage, setStage] = useState(reduce ? 3 : 0);
  const X = 190; // px for x
  const B = 70; // px for b
  const S = X + B;
  const pad = 30;
  const fade = (on: boolean, delay = 0) => ({
    initial: false as const,
    animate: { opacity: on ? 1 : 0, scale: on ? 1 : 0.85 },
    transition: { duration: reduce ? 0 : 0.6, delay: reduce ? 0 : delay },
  });

  const captions =
    lang === "fil"
      ? [
          "Isang square na ang gilid ay x + " + b + ".",
          "Hatiin: x² at " + b * b + " — ito ang nakita mo.",
          "Pero may dalawa pang piraso: " + b + "x at " + b + "x.",
          `Kabuuan: x² + ${2 * b}x + ${b * b}. Ang ${2 * b}x ang nawala.`,
        ]
      : [
          "A square whose side is x + " + b + ".",
          "Cut it: x² and " + b * b + " — the two pieces you wrote.",
          "But there are two more pieces: " + b + "x and " + b + "x.",
          `Total area: x² + ${2 * b}x + ${b * b}. The ${2 * b}x is what went missing.`,
        ];

  return (
    <div className="card !p-4">
      <svg viewBox={`0 0 ${S + pad * 2} ${S + pad * 2}`} className="mx-auto block w-full max-w-[340px]" role="img"
        aria-label={captions[3]}>
        <g transform={`translate(${pad},${pad})`}>
          {/* side labels */}
          <text x={X / 2} y={-10} textAnchor="middle" className="fill-muted text-[16px]">x</text>
          <text x={X + B / 2} y={-10} textAnchor="middle" className="fill-muted text-[16px]">{b}</text>
          <text x={-12} y={X / 2} textAnchor="middle" className="fill-muted text-[16px]">x</text>
          <text x={-12} y={X + B / 2} textAnchor="middle" className="fill-muted text-[16px]">{b}</text>

          <rect width={S} height={S} rx={6} fill="#fff" stroke="#1e1b3a" strokeWidth={3} />

          <motion.g {...fade(stage >= 1)}>
            <rect width={X} height={X} fill="#e9e0ff" stroke="#6c3ce9" strokeWidth={2} />
            <text x={X / 2} y={X / 2 + 8} textAnchor="middle" className="fill-brand text-[26px] font-semibold">x²</text>
            <rect x={X} y={X} width={B} height={B} fill="#e9e0ff" stroke="#6c3ce9" strokeWidth={2} />
            <text x={X + B / 2} y={X + B / 2 + 7} textAnchor="middle" className="fill-brand text-[20px] font-semibold">{b * b}</text>
          </motion.g>

          <motion.g {...fade(stage >= 2)}>
            <rect x={X} width={B} height={X} fill="#ffe7cc" stroke="#1e1b3a" strokeWidth={3} />
            <text x={X + B / 2} y={X / 2 + 7} textAnchor="middle" className="fill-gap-dark font-display text-[22px] font-bold">{b}x</text>
          </motion.g>
          <motion.g {...fade(stage >= 2, 0.35)}>
            <rect y={X} width={X} height={B} fill="#ffe7cc" stroke="#1e1b3a" strokeWidth={3} />
            <text x={X / 2} y={X + B / 2 + 7} textAnchor="middle" className="fill-gap-dark font-display text-[22px] font-bold">{b}x</text>
          </motion.g>
        </g>
      </svg>
      <p className="mt-3 min-h-12 text-center font-display text-[17px]" aria-live="polite">{captions[stage]}</p>
      <div className="mt-2 flex justify-center gap-2">
        {stage < 3 ? (
          <button className="btn-primary btn-sm" onClick={() => setStage((s) => s + 1)}>
            {lang === "fil" ? "Susunod" : "Next"} →
          </button>
        ) : (
          <button className="btn-ghost btn-sm" onClick={() => setStage(0)}>
            {lang === "fil" ? "Ulitin" : "Replay"}
          </button>
        )}
      </div>
    </div>
  );
}
