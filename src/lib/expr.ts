/**
 * A tiny parser for y = f(x) expressions from lessons: numbers, x, + - * / ^, parentheses,
 * implicit multiplication (2x, 3(x+1), x(x-2)), and sqrt sin cos tan abs ln log exp, pi, e.
 * No eval: unknown input throws, and the graph is skipped.
 */
type Fn = (x: number) => number;

const FUNCS: Record<string, (v: number) => number> = {
  sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan, abs: Math.abs,
  ln: Math.log, log: Math.log10, exp: Math.exp,
};

export function compile(src: string): Fn {
  const s = src.replace(/\s+/g, "").replace(/^y=/, "").replace(/\*\*/g, "^").replace(/π/g, "pi");
  let i = 0;
  const peek = () => s[i];
  const eat = (c: string) => (s[i] === c ? (i++, true) : false);

  // expr := term (('+'|'-') term)*
  function expr(): Fn {
    let left = term();
    for (;;) {
      if (eat("+")) { const a = left, b = term(); left = (x) => a(x) + b(x); }
      else if (eat("-")) { const a = left, b = term(); left = (x) => a(x) - b(x); }
      else return left;
    }
  }
  // term := unary (('*'|'/'|implicit) unary)*
  function term(): Fn {
    let left = unary();
    for (;;) {
      if (eat("*")) { const a = left, b = unary(); left = (x) => a(x) * b(x); }
      else if (eat("/")) { const a = left, b = unary(); left = (x) => a(x) / b(x); }
      else if (peek() && /[\w(.]/.test(peek()!)) { const a = left, b = unary(); left = (x) => a(x) * b(x); }
      else return left;
    }
  }
  function unary(): Fn {
    if (eat("-")) { const a = unary(); return (x) => -a(x); }
    if (eat("+")) return unary();
    return power();
  }
  // power := atom ('^' unary)?   (right-associative)
  function power(): Fn {
    const base = atom();
    if (eat("^")) { const e = unary(); return (x) => Math.pow(base(x), e(x)); }
    return base;
  }
  function atom(): Fn {
    const c = peek();
    if (c === undefined) throw new Error("unexpected end");
    if (eat("(")) {
      const inner = expr();
      if (!eat(")")) throw new Error("missing )");
      return inner;
    }
    const num = /^\d*\.?\d+/.exec(s.slice(i));
    if (num) {
      i += num[0].length;
      const v = Number(num[0]);
      return () => v;
    }
    const word = /^[a-z]+/i.exec(s.slice(i));
    if (word) {
      const w = word[0].toLowerCase();
      if (w in FUNCS) {
        i += w.length;
        const f = FUNCS[w];
        const arg = atom();
        return (x) => f(arg(x));
      }
      // a run like "xy" or "pix" is read one symbol at a time
      if (w.startsWith("pi")) { i += 2; return () => Math.PI; }
      if (w[0] === "x") { i += 1; return (x) => x; }
      if (w[0] === "e") { i += 1; return () => Math.E; }
    }
    throw new Error(`unexpected "${c}"`);
  }

  const f = expr();
  if (i !== s.length) throw new Error(`unexpected "${s[i]}"`);
  return f;
}

export function tryCompile(src: string): Fn | null {
  try {
    const f = compile(src);
    f(0.5); // smoke test
    return f;
  } catch {
    return null;
  }
}
