import katex from "katex";
import { useMemo } from "react";

const OPTIONS = {
  throwOnError: false,
  trust: (ctx: { command: string }) => ctx.command === "\\htmlClass",
  strict: false as const,
};

export function Math({ tex, block = false, className = "" }: { tex: string; block?: boolean; className?: string }) {
  const html = useMemo(() => katex.renderToString(tex, { ...OPTIONS, displayMode: block }), [tex, block]);
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Lesson text: $$display$$ and $inline$ math, **bold** key terms. Everything else is plain text. */
export function RichText({ text, className = "" }: { text: string; className?: string }) {
  const parts = text.split(/(\$\$[^$]+\$\$|\$[^$]+\$)/g);
  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.startsWith("$$") && p.endsWith("$$") && p.length > 4 ? (
          <span key={i} className="my-2 block overflow-x-auto text-[1.1em]"><Math tex={p.slice(2, -2)} block /></span>
        ) : p.startsWith("$") && p.endsWith("$") && p.length > 2 ? (
          <Math key={i} tex={p.slice(1, -1)} />
        ) : (
          <Bold key={i} text={p} />
        ),
      )}
    </span>
  );
}

function Bold({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
        p.startsWith("**") && p.endsWith("**") && p.length > 4 ? <strong key={i} className="font-semibold text-ink">{p.slice(2, -2)}</strong> : p,
      )}
    </>
  );
}

/** Turn a typed line like "(x+3)^2=49" into rough LaTeX for display before the engine answers. */
export function quickTex(s: string) {
  return s
    .replace(/sqrt\(([^)]*)\)/g, "\\sqrt{$1}")
    .replace(/\(([^()]+)\)\/(\(([^()]+)\)|[\w.]+)/g, (_, a, b, inner) => `\\frac{${a}}{${inner ?? b}}`)
    .replace(/([\w.^]+)\/(\(([^()]+)\)|[\w.]+)/g, (_, a, b, inner) => `\\frac{${a}}{${inner ?? b}}`)
    .replace(/\^(\d+|\([^)]*\))/g, (_, e) => `^{${e.replace(/^\(|\)$/g, "")}}`)
    .replace(/\*/g, " \\cdot ")
    .replace(/±/g, "\\pm ")
    .replace(/\s*\bor\b\s*/g, "\\quad\\text{or}\\quad ");
}
