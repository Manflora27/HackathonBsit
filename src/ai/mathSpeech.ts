import type { LessonText } from "../types";

// Lesson text -> words a voice can read. Lessons write math as $LaTeX$ (see RichText in
// components/Math.tsx); a voice reading "\frac{3}{4}" or "x^2" aloud is useless, so each math span
// becomes words: "3 over 4", "x squared", "the quantity x plus 3, squared". Math words stay in
// English for every language: that's how Philippine classrooms say them, in Taglish and Bisaya too.

const SYMBOLS: Record<string, string> = {
  "=": "equals",
  "<": "is less than",
  ">": "is greater than",
  "+": "plus",
  "*": "times",
  "/": "over",
  "%": "percent",
  "!": "factorial",
  ",": ",",
  ":": "to",
  "±": "plus or minus",
  "≤": "is less than or equal to",
  "≥": "is greater than or equal to",
  "≠": "is not equal to",
  "×": "times",
  "÷": "divided by",
  "π": "pi",
};

const COMMANDS: Record<string, string> = {
  pm: "plus or minus",
  mp: "minus or plus",
  cdot: "times",
  times: "times",
  div: "divided by",
  le: "is less than or equal to",
  leq: "is less than or equal to",
  ge: "is greater than or equal to",
  geq: "is greater than or equal to",
  ne: "is not equal to",
  neq: "is not equal to",
  approx: "is about",
  pi: "pi",
  theta: "theta",
  alpha: "alpha",
  beta: "beta",
  infty: "infinity",
  circ: "degrees",
  degree: "degrees",
  "%": "percent",
  Rightarrow: ", so",
  implies: ", so",
  to: "to",
  rightarrow: "to",
  quad: ",",
  qquad: ",",
  ldots: "and so on",
  dots: "and so on",
  cdots: "and so on",
};

/** Spacing and sizing commands that say nothing. */
const SILENT = new Set(["left", "right", "big", "Big", "bigl", "bigr", "displaystyle", ",", ";", "!", " ", "htmlClass"]);

/** Thrown for LaTeX the reader doesn't know, so the caller can fall back to the lesson's `spoken` text. */
export class UnspeakableMath extends Error {}

type Tok = { k: "num" | "id" | "cmd" | "sym" | "raw"; v: string };

/** Commands whose argument is words, not math: \text{or}. */
const TEXT_CMDS = new Set(["text", "textbf", "textit", "mathrm", "mathbf", "operatorname"]);

function tokenize(tex: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < tex.length) {
    const c = tex[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "\\") {
      const m = /^\\([a-zA-Z]+|.)/.exec(tex.slice(i));
      if (!m) throw new UnspeakableMath(tex);
      out.push({ k: "cmd", v: m[1] });
      i += m[0].length;
      if (TEXT_CMDS.has(m[1])) {
        // Keep the words inside as written, spaces and all.
        while (/\s/.test(tex[i] ?? "")) i++;
        if (tex[i] === "{") {
          let j = i + 1;
          let depth = 0;
          while (j < tex.length && !(tex[j] === "}" && depth === 0)) { depth += tex[j] === "{" ? 1 : tex[j] === "}" ? -1 : 0; j++; }
          out.push({ k: "raw", v: tex.slice(i + 1, j).replace(/[{}\\]/g, " ").replace(/\s+/g, " ").trim() });
          i = j + 1;
        }
      }
      continue;
    }
    const num = /^\d+(?:\.\d+)?/.exec(tex.slice(i));
    if (num) { out.push({ k: "num", v: num[0] }); i += num[0].length; continue; }
    if (/[a-zA-Z]/.test(c)) { out.push({ k: "id", v: c }); i++; continue; }
    out.push({ k: "sym", v: c });
    i++;
  }
  return out;
}

/**
 * A spoken piece, and whether it is one simple thing ("3", "x") that needs no "the quantity".
 * `paren` marks a bracketed group, said as "the quantity ..." once, exponent or not.
 */
type Spoken = { words: string; simple: boolean; paren?: boolean };

class Reader {
  private i = 0;
  private toks: Tok[];
  constructor(toks: Tok[]) { this.toks = toks; }

  private peek() { return this.toks[this.i]; }
  private next() { return this.toks[this.i++]; }
  private isSym(v: string) { const t = this.peek(); return !!t && t.k === "sym" && t.v === v; }

  /** Reads until `close` (a symbol) or the end. */
  seq(close?: string): string {
    const words: string[] = [];
    let prev: "start" | "op" | "atom" = "start";
    let prevAtom: Spoken | null = null;
    while (this.peek() && !(close && this.isSym(close))) {
      const t = this.peek()!;
      if (t.k === "sym" && t.v === "-") {
        this.next();
        words.push(prev === "atom" ? "minus" : "negative");
        prev = "op";
        continue;
      }
      if (t.k === "sym" && t.v in SYMBOLS && t.v !== "|") {
        this.next();
        words.push(SYMBOLS[t.v]);
        prev = "op";
        continue;
      }
      if (t.k === "cmd" && SILENT.has(t.v)) {
        this.next();
        if (t.v === "htmlClass") this.group(); // \htmlClass{name}{body}: skip the class name, read the body
        continue;
      }
      if (t.k === "cmd" && t.v in COMMANDS && !["pi", "theta", "alpha", "beta", "infty"].includes(t.v)) {
        this.next();
        words.push(COMMANDS[t.v]);
        prev = "op";
        continue;
      }
      const atom = this.atom();
      // Two bracketed groups side by side multiply: (x+3)(x+3).
      if (prev === "atom" && prevAtom && (!prevAtom.simple || !atom.simple)) words.push("times");
      words.push(atom.words);
      prev = "atom";
      prevAtom = atom;
    }
    return words.join(" ");
  }

  /** One thing with its exponent: 3, x, (x+3)^2, \frac{a}{b}, \sqrt{x}. */
  private atom(): Spoken {
    let base = this.primary();
    if (base.paren && !this.isSym("^")) base = { words: `the quantity ${base.words},`, simple: false };
    while (this.isSym("_")) { this.next(); base = { words: `${base.words} sub ${this.group().words}`, simple: base.simple }; }
    if (this.isSym("^")) {
      this.next();
      const exp = this.group();
      const of = base.simple ? base.words : base.paren ? `the quantity ${base.words},` : `${base.words},`;
      if (exp.words === "degrees") return { words: `${base.words} degrees`, simple: base.simple };
      if (exp.words === "2") return { words: `${of} squared`, simple: false };
      if (exp.words === "3") return { words: `${of} cubed`, simple: false };
      return { words: `${of} to the power of ${exp.words}${exp.simple ? "" : ","}`, simple: false };
    }
    return base;
  }

  private primary(): Spoken {
    const t = this.next();
    if (!t) throw new UnspeakableMath("unexpected end");
    if (t.k === "num" || t.k === "id") return { words: t.v, simple: true };
    if (t.k === "sym") {
      if (t.v === "(" || t.v === "[") {
        const inner = this.seq(t.v === "(" ? ")" : "]");
        this.next();
        return { words: inner, simple: false, paren: true };
      }
      if (t.v === "{") { const inner = this.seq("}"); this.next(); return { words: inner, simple: !inner.includes(" ") }; }
      if (t.v === "|") { const inner = this.seq("|"); this.next(); return { words: `the absolute value of ${inner},`, simple: false }; }
      throw new UnspeakableMath(t.v);
    }
    switch (t.v) {
      case "frac":
      case "dfrac":
      case "tfrac": {
        const num = this.group();
        const den = this.group();
        if (num.simple && den.simple) return { words: `${num.words} over ${den.words}`, simple: false };
        return { words: `the fraction ${num.words}, over ${den.words},`, simple: false };
      }
      case "sqrt": {
        let index = "";
        if (this.isSym("[")) { this.next(); index = this.seq("]"); this.next(); }
        const body = this.group();
        const root = index === "3" ? "cube root" : index ? `root ${index}` : "square root";
        return { words: `the ${root} of ${body.words}${body.simple ? "" : ","}`, simple: false };
      }
      case "text":
      case "textbf":
      case "textit":
      case "mathrm":
      case "mathbf":
      case "operatorname": {
        const g = this.peek()?.k === "raw" ? this.next()!.v : "";
        return { words: g, simple: !g.includes(" ") };
      }
      case "lvert":
      case "vert": {
        const words: string[] = [];
        while (this.peek() && !(this.peek()!.k === "cmd" && ["rvert", "vert"].includes(this.peek()!.v))) words.push(this.atom().words);
        this.next();
        return { words: `the absolute value of ${words.join(" ")},`, simple: false };
      }
      default:
        if (t.v in COMMANDS) return { words: COMMANDS[t.v], simple: true };
        throw new UnspeakableMath(`\\${t.v}`);
    }
  }

  /** A {braced} argument, or the single token LaTeX allows without braces (x^2, \frac12). */
  private group(): Spoken {
    if (this.isSym("{")) {
      this.next();
      const inner = this.seq("}");
      this.next();
      return { words: inner, simple: !inner.includes(" ") };
    }
    const t = this.peek();
    if (t?.k === "num" && t.v.length > 1 && !t.v.includes(".")) {
      // \frac12 means 1 over 2: an unbraced argument is one digit; the rest stays for the next read.
      const digit = t.v[0];
      t.v = t.v.slice(1);
      return { words: digit, simple: true };
    }
    return this.primary();
  }
}

/** One LaTeX span as words. Throws UnspeakableMath on anything it can't read reliably. */
export function speakTex(tex: string): string {
  const r = new Reader(tokenize(tex));
  return r.seq().replace(/\s+,/g, ",").replace(/,(\s*,)+/g, ",").replace(/,\s*$/, "").replace(/\s+/g, " ").trim();
}

/**
 * Lesson text ($math$, $$display$$, **bold**) as plain words. Throws UnspeakableMath when a span
 * can't be read, so the caller can fall back to the hand-written `spoken` text.
 */
export function speakableText(text: string): string {
  return text
    .split(/(\$\$[^$]+\$\$|\$[^$]+\$)/g)
    .map((p) => {
      if (p.startsWith("$$") && p.endsWith("$$") && p.length > 4) return ` ${speakTex(p.slice(2, -2))}. `;
      if (p.startsWith("$") && p.endsWith("$") && p.length > 2) return speakTex(p.slice(1, -1));
      return p;
    })
    .join("")
    .replace(/\*\*/g, "")
    .replace(/\s+([.,;:!?])/g, "$1")
    .replace(/([.,])\1+/g, "$1")
    .replace(/,\./g, ".")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * What "Read aloud" says for a lesson: what's on the page above and around the button (hook, the
 * explanation, then the common mistake under its label), with math as words. Falls back to the
 * lesson's hand-written `spoken` text when some math can't be read reliably.
 */
export function lessonSpeech(text: Pick<LessonText, "hook" | "body" | "pitfall" | "spoken">, mistakeLabel: string): string {
  const sentence = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);
  try {
    const parts = [text.hook, ...text.body].filter((p): p is string => !!p?.trim()).map((p) => sentence(speakableText(p)));
    if (text.pitfall?.trim()) parts.push(`${sentence(mistakeLabel)} ${sentence(speakableText(text.pitfall))}`);
    if (parts.length) return parts.join(" ");
  } catch (e) {
    if (!(e instanceof UnspeakableMath)) throw e;
  }
  return text.spoken;
}
