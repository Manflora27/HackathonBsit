// Offline transcript -> typed math. Fallback when /api/voice is unreachable
// (offline, or the server is down). English + Tagalog + Bisaya number words,
// including the Spanish-derived forms common in PH classrooms (dose, trese).
// Conservative by design: returns "" when there is no math, so the caller
// shows "didn't catch any math" instead of typing a wrong answer.

const FRACTIONS: Array<[RegExp, string]> = [
  [/\bone half\b|\ba half\b|\bkalahati\b|\bkatunga\b/g, "1/2"],
  [/\bone third\b/g, "1/3"],
  [/\btwo thirds\b/g, "2/3"],
  [/\bone quarter\b|\ba quarter\b/g, "1/4"],
  [/\bthree quarters\b/g, "3/4"],
];

const PHRASES: Array<[RegExp, string]> = [
  [/\bdivided by\b/g, " / "],
  [/\bmultiplied by\b/g, " * "],
  [/\bis equal to\b/g, " = "],
  [/\bequals\b|\bequal\b/g, " = "],
  [/\bto the power of\b|\bto the power\b/g, " ^ "],
  [/\bsquare root of\b|\bsquare root\b/g, " sqrt "],
  [/\bopen parenthesis\b|\bopen bracket\b/g, " ( "],
  [/\bclose parenthesis\b|\bclose bracket\b/g, " ) "],
];

const WORDS: Record<string, string> = {
  // operators
  plus: "+", minus: "-", times: "*", over: "/", divided: "/", multiplied: "*",
  // powers / misc
  squared: "^2", cubed: "^3", power: "^", negative: "-", point: ".",
  // the letter x is often heard as "ex", y as "why", 0 as "oh"
  ex: "x", why: "y", oh: "0",
  // English 0-20, tens, scales
  zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6",
  seven: "7", eight: "8", nine: "9", ten: "10", eleven: "11", twelve: "12",
  thirteen: "13", fourteen: "14", fifteen: "15", sixteen: "16", seventeen: "17",
  eighteen: "18", nineteen: "19", twenty: "20", thirty: "30", forty: "40",
  fifty: "50", sixty: "60", seventy: "70", eighty: "80", ninety: "90",
  hundred: "100", thousand: "1000",
  // Spanish-derived, used in all three languages
  onse: "11", dose: "12", trese: "13", katorse: "14", kinse: "15",
  disisais: "16", disisyete: "17", disiotso: "18", disnuebe: "19", bente: "20",
  trenta: "30", kwarenta: "40", singkwenta: "50", sisenta: "60", sitenta: "70",
  otsenta: "80", nobenta: "90",
  // Tagalog
  isa: "1", isang: "1", dalawa: "2", tatlo: "3", apat: "4", lima: "5", anim: "6",
  pito: "7", walo: "8", siyam: "9", sampu: "10", labingisa: "11",
  labindalawa: "12", dalawampu: "20", tatlumpu: "30", apatnapu: "40",
  limampu: "50", animnapu: "60", pitumpu: "70", walumpu: "80",
  siyamnapu: "90", daan: "100", libo: "1000",
  // Bisaya (Cebuano)
  usa: "1", duha: "2", tulo: "3", upat: "4", unom: "6", napulo: "10",
  napulog: "11", kawhaan: "20", katloan: "30", kapatan: "40", kalimaan: "50",
  kanuman: "60", kapituan: "70", kawaloan: "80", kasiyaman: "90",
  gatos: "100", // libo shared with Tagalog
};

const TENS = new Set(["20", "30", "40", "50", "60", "70", "80", "90"]);

/** "twenty one" -> 21. Tokens are number strings here, e.g. ["20","1"]. */
function foldTens(tokens: string[]): string[] {
  const out: string[] = [];
  for (const t of tokens) {
    const prev = out[out.length - 1];
    if (prev !== undefined && TENS.has(prev) && /^[1-9]$/.test(t)) {
      out[out.length - 1] = String(Number(prev) + Number(t));
    } else {
      out.push(t);
    }
  }
  return out;
}

export function formatMathLocally(transcript: string): string {
  let s = transcript.toLowerCase().trim();
  if (!s) return "";
  for (const [re, to] of FRACTIONS) s = s.replace(re, ` ${to} `);
  for (const [re, to] of PHRASES) s = s.replace(re, to);
  // Single tokens: known words become math, bare digits/symbols/x/y pass
  // through, everything else (filler like "what is", "please") is dropped.
  const raw = s.split(/[\s,?.!;]+/).filter(Boolean);
  const kept: string[] = [];
  for (const tok of raw) {
    // Math-shaped tokens ("1/2", "x^2", "+") pass through as-is.
    if (/^[0-9x().+\-*/^=]+$/.test(tok) || tok === "y" || tok === "sqrt") {
      kept.push(tok);
      continue;
    }
    if (/^[a-z]+$/.test(tok) && tok in WORDS) kept.push(WORDS[tok]);
  }
  let out = foldTens(kept).join("");
  out = out.replace(/sqrt(\d+)/g, "sqrt($1)").replace(/sqrt([xy])/g, "sqrt($1)");
  // sqrt(16 stays open when the utterance continues ("sqrt of 16 plus 1"):
  // close it at the end of a digit run only if nothing follows. Keep simple:
  // balance an unclosed sqrt( at the end of the string.
  const opens = (out.match(/sqrt\(/g) ?? []).length;
  const closes = (out.match(/\)/g) ?? []).length;
  if (opens > closes && /[0-9)]$/.test(out)) out += ")".repeat(opens - closes);
  if (out === "x" || out === "y") return out;
  const hasDigit = /[0-9]/.test(out);
  const hasXWithOp = /[xy]/.test(out) && /[+\-*/^=().]/.test(out);
  if (!hasDigit && !hasXWithOp) return "";
  return out.slice(0, 200);
}
