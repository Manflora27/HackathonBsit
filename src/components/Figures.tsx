import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Figure, Lang, NumberLineFigure, PlotFigure, WorkedExample } from "../types";
import { tryCompile } from "../lib/expr";
import { useT } from "../i18n";
import { Math as TeX, RichText as RichInline } from "./Math";

const INK = "var(--color-ink)";
/** Figure labels share the lesson's reading serif, so the picture reads as part of the page. */
const LABEL = { fontFamily: "var(--font-serif)" } as const;
const CURVES = ["var(--color-gap)", "var(--color-ok)", "var(--color-ochre)"];

/** Nice tick step for a range: 1, 2, 5, 10... */
function step(span: number) {
  const raw = span / 8;
  const p = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((m) => m * p).find((s) => s >= raw) ?? p * 10;
}
const ticks = (min: number, max: number) => {
  const s = step(max - min);
  const out: number[] = [];
  for (let v = Math.ceil(min / s) * s; v <= max + 1e-9; v += s) out.push(Number(v.toFixed(6)));
  return out;
};
const sane = (f: PlotFigure) => [f.xMin, f.xMax, f.yMin, f.yMax].every(Number.isFinite) && f.xMax > f.xMin && f.yMax > f.yMin;

export function Plot({ fig }: { fig: PlotFigure }) {
  const fns = fig.functions.map((src) => ({ src, f: tryCompile(src) })).filter((x) => x.f);
  if (!sane(fig) || !fns.length) return null;
  const W = 320, H = 240, P = 26;
  const sx = (x: number) => P + ((x - fig.xMin) / (fig.xMax - fig.xMin)) * (W - 2 * P);
  const sy = (y: number) => H - P - ((y - fig.yMin) / (fig.yMax - fig.yMin)) * (H - 2 * P);
  const inX = (v: number) => v >= fig.xMin && v <= fig.xMax;
  const inY = (v: number) => v >= fig.yMin && v <= fig.yMax;
  const pathFor = (f: (x: number) => number) => {
    let d = "", pen = false;
    const N = 240, yPad = (fig.yMax - fig.yMin) * 0.5;
    for (let k = 0; k <= N; k++) {
      const x = fig.xMin + ((fig.xMax - fig.xMin) * k) / N;
      const y = f(x);
      // lift the pen across gaps and asymptotes
      if (!Number.isFinite(y) || y < fig.yMin - yPad || y > fig.yMax + yPad) { pen = false; continue; }
      d += `${pen ? "L" : "M"}${sx(x).toFixed(1)} ${sy(y).toFixed(1)}`;
      pen = true;
    }
    return d;
  };
  const x0 = inX(0) ? sx(0) : P, y0 = inY(0) ? sy(0) : H - P;
  return (
    <figure data-testid="figure-plot">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full overflow-visible" style={LABEL} role="img" aria-label={fns.map((x) => `y = ${x.src}`).join(", ")}>
        <defs><clipPath id="plot-area"><rect x={P} y={P} width={W - 2 * P} height={H - 2 * P} /></clipPath></defs>
        {ticks(fig.xMin, fig.xMax).map((v) => <line key={`gx${v}`} x1={sx(v)} x2={sx(v)} y1={P} y2={H - P} stroke={INK} strokeOpacity=".14" strokeDasharray="1.5 4" strokeLinecap="round" />)}
        {ticks(fig.yMin, fig.yMax).map((v) => <line key={`gy${v}`} y1={sy(v)} y2={sy(v)} x1={P} x2={W - P} stroke={INK} strokeOpacity=".14" strokeDasharray="1.5 4" strokeLinecap="round" />)}
        <line x1={P} x2={W - P} y1={y0} y2={y0} stroke={INK} strokeOpacity=".7" strokeWidth="1.2" strokeLinecap="round" />
        <line y1={P} y2={H - P} x1={x0} x2={x0} stroke={INK} strokeOpacity=".7" strokeWidth="1.2" strokeLinecap="round" />
        {ticks(fig.xMin, fig.xMax).filter((v) => v !== 0).map((v) => (
          <text key={`tx${v}`} x={sx(v)} y={Math.min(y0 + 13, H - 6)} textAnchor="middle" fontSize="10" fill="var(--color-muted)">{v}</text>
        ))}
        {ticks(fig.yMin, fig.yMax).filter((v) => v !== 0).map((v) => (
          <text key={`ty${v}`} x={Math.max(x0 - 5, 12)} y={sy(v) + 3} textAnchor="end" fontSize="10" fill="var(--color-muted)">{v}</text>
        ))}
        <g clipPath="url(#plot-area)">
          {fns.map(({ src, f }, i) => (
            <motion.path key={src} d={pathFor(f!)} fill="none" stroke={CURVES[i % CURVES.length]} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"
              initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.1, delay: i * 0.3, ease: "easeInOut" }} />
          ))}
        </g>
        {fig.points.filter((p) => inX(p.x) && inY(p.y)).map((p) => (
          <g key={`${p.x},${p.y}`}>
            <circle cx={sx(p.x)} cy={sy(p.y)} r="4.5" fill={INK} stroke="var(--color-paper)" strokeWidth="2" />
            {p.label && <text x={sx(p.x) + 8} y={sy(p.y) - 8} fontSize="12" fontStyle="italic" fill={INK} stroke="var(--color-paper)" strokeWidth="4" strokeLinejoin="round" paintOrder="stroke">{p.label}</text>}
          </g>
        ))}
      </svg>
      <figcaption className="mt-1 flex flex-wrap justify-center gap-x-5 gap-y-1 text-[15px]">
        {fns.map(({ src }, i) => (
          <span key={src} className="flex items-center gap-1.5">
            <span className="h-[3px] w-5 rounded-full" style={{ background: CURVES[i % CURVES.length] }} />
            <TeX tex={`y = ${src.replace(/\*/g, " \\cdot ").replace(/sqrt\(([^)]*)\)/g, "\\sqrt{$1}")}`} />
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

export function NumberLine({ fig }: { fig: NumberLineFigure }) {
  if (!Number.isFinite(fig.min) || !Number.isFinite(fig.max) || fig.max <= fig.min) return null;
  const W = 320, H = 86, P = 18, Y = 46;
  const sx = (x: number) => P + ((x - fig.min) / (fig.max - fig.min)) * (W - 2 * P);
  const clamp = (v: number) => Math.max(fig.min, Math.min(fig.max, v));
  return (
    <figure data-testid="figure-numberline">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full overflow-visible" style={LABEL} role="img"
        aria-label={fig.marks.map((m) => m.label || String(m.x)).join(", ")}>
        {fig.shade.map((r, i) => (
          <motion.line key={i} x1={sx(clamp(r.from))} x2={sx(clamp(r.to))} y1={Y} y2={Y} stroke="var(--color-gap)" strokeWidth="7" strokeLinecap="round" strokeOpacity=".75"
            initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 0.9, delay: 0.2 }} />
        ))}
        <line x1={P - 8} x2={W - P + 8} y1={Y} y2={Y} stroke={INK} strokeWidth="1.6" markerEnd="url(#nl-arrow)" markerStart="url(#nl-arrow)" />
        <defs>
          <marker id="nl-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 10 5 0 10z" fill={INK} />
          </marker>
        </defs>
        {ticks(fig.min, fig.max).map((v) => (
          <g key={v}>
            <line x1={sx(v)} x2={sx(v)} y1={Y - 5} y2={Y + 5} stroke={INK} strokeOpacity=".6" />
            <text x={sx(v)} y={Y + 20} textAnchor="middle" fontSize="10.5" fill="var(--color-muted)">{v}</text>
          </g>
        ))}
        {fig.marks.filter((m) => m.x >= fig.min && m.x <= fig.max).map((m) => (
          <g key={`${m.x}${m.label}`}>
            <circle cx={sx(m.x)} cy={Y} r="6" fill={m.open ? "var(--color-paper)" : "var(--color-gap)"} stroke="var(--color-gap)" strokeWidth="2.2" />
            {m.label && <text x={sx(m.x)} y={Y - 14} textAnchor="middle" fontSize="13" fontStyle="italic" fill="var(--color-gap-dark)">{m.label}</text>}
          </g>
        ))}
      </svg>
    </figure>
  );
}

export function FigureView({ fig }: { fig: Figure | undefined }) {
  if (!fig) return null;
  if (fig.kind === "plot") return <Plot fig={fig} />;
  if (fig.kind === "numberline") return <NumberLine fig={fig} />;
  return null;
}

/** A worked example, one step at a time: the math line, then why it's allowed. */
export function WorkedSteps({ example, lang }: { example: WorkedExample; lang: Lang }) {
  const t = useT();
  const [shown, setShown] = useState(1);
  const why = (w: WorkedExample["steps"][number]["why"]) => (lang === "tl" ? w.fil : lang === "ceb" ? w.ceb : undefined) || w.en;
  const all = shown >= example.steps.length;
  return (
    <div className="border-t border-line pt-4" data-testid="worked-example">
      <div className="kicker text-gap-dark">{t("lesson.workedExample")}</div>
      <div className="mt-2 overflow-x-auto text-[20px]"><TeX tex={example.problem} block /></div>
      <ol className="mt-1">
        <AnimatePresence initial={false}>
          {example.steps.slice(0, shown).map((s, i) => (
            <motion.li key={i} className="flex gap-3 border-t border-line py-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink font-display text-[12px] text-paper">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="overflow-x-auto text-[18px]"><TeX tex={s.math} block /></div>
                <p className="prose-lesson mt-1 !text-[15.5px] !leading-snug text-muted"><RichInline text={why(s.why)} /></p>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
      <div className="mt-1 flex gap-2">
        {!all ? (
          <>
            <button className="btn-primary btn-sm" onClick={() => setShown((n) => n + 1)} data-testid="next-step-reveal">{t("lesson.nextStep")} →</button>
            <button className="btn-ghost btn-sm" onClick={() => setShown(example.steps.length)}>{t("lesson.showAll")}</button>
          </>
        ) : (
          example.steps.length > 1 && <button className="btn-ghost btn-sm" onClick={() => setShown(1)}>{t("areaModel.replay")}</button>
        )}
      </div>
    </div>
  );
}

