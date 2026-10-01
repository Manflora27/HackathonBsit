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

/** Text with inline $...$ math. */
export function RichText({ text, className = "" }: { text: string; className?: string }) {
  const parts = text.split(/(\$[^$]+\$)/g);
  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.startsWith("$") && p.endsWith("$") ? <Math key={i} tex={p.slice(1, -1)} /> : <span key={i}>{p}</span>,
      )}
    </span>
  );
}

/** Turn a typed line like "(x+3)^2=49" into rough LaTeX for display before the engine answers. */
export function quickTex(s: string) {
  return s
    .replace(/sqrt\(([^)]*)\)/g, "\\sqrt{$1}")
    .replace(/\^(\d+|\([^)]*\))/g, (_, e) => `^{${e.replace(/^\(|\)$/g, "")}}`)
    .replace(/\*/g, " \\cdot ")
    .replace(/±/g, "\\pm ");
}
