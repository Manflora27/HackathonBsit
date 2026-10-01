import { REVIEW, chatJson, chatJsonStream, json, ndjson, type Sink } from "./_openrouter.js";
import { subjectMeta } from "../src/data/curriculum.js";
import { competenciesFor } from "../src/data/competencies.js";
import { resolve, sign, type Target } from "./_lessons.js";
import { checkFigure } from "../src/lessons/checks.js";

const FORMS = ["any", "expanded", "factored", "solved", "units", "chemistry"];


const num = { type: "number" };
const str = { type: "string" };
const arr = (items: object) => ({ type: "array", items });
const obj = (properties: Record<string, object>) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });

const text = obj({
  hook: str,
  body: arr(str),
  pitfall: str,
  check: obj({ question: str, choices: arr(str), why: str }),
  spoken: str,
});

// Strict JSON schema: every field is required, so the unused half of `figure` comes back empty and is dropped in shape().
const example = obj({
  problem: str,
  problemTyped: str,
  kind: { type: "string", enum: ["solve", "simplify"] },
  steps: arr(obj({ math: str, typed: str, why_en: str, why_fil: str, why_ceb: str })),
});
const figure = obj({
  kind: { type: "string", enum: ["plot", "numberline", "none"] },
  functions: arr(str),
  xMin: num, xMax: num, yMin: num, yMax: num,
  points: arr(obj({ x: num, y: num, label: str })),
  min: num, max: num,
  marks: arr(obj({ x: num, label: str, open: { type: "boolean" } })),
  shade: arr(obj({ from: num, to: num })),
});

const practice = {
  type: "array",
  items: {
    type: "object",
    additionalProperties: false,
    required: ["prompt", "given", "form", "expected"],
    properties: {
      prompt: { type: "string" },
      given: { type: "string" },
      form: { type: "string", enum: FORMS },
      expected: { type: "string" },
    },
  },
};

type TextLang = "en" | "fil" | "ceb";

/** Models write fields in schema order: the learner's own language goes first so it's what streams in first. */
function schemaFor(first: TextLang = "en") {
  const langs = [first, ...(["en", "fil", "ceb"] as const).filter((l) => l !== first)];
  const properties: Record<string, object> = { ...Object.fromEntries(langs.map((l) => [l, text])), example, figure, checkAnswer: { type: "integer" }, practice };
  return { type: "object", additionalProperties: false, required: Object.keys(properties), properties };
}

const HINTS: Record<string, string> = {
  statistics: "Use form 'any'. 'given' is the arithmetic to compute, e.g. (2+4+6)/3 for the mean of 2, 4, 6; put the words in 'prompt'.",
  geometry: "Use form 'any'. 'given' is the arithmetic of the formula, e.g. pi*3^2 for a circle of radius 3, expected 9pi; put the words in 'prompt'.",
  units: "Use form 'units'. 'given' is a computation with units, e.g. 100 m / 20 s; 'expected' carries a unit too, e.g. 5 m/s. Units allowed: m km cm mm s min h kg g N J W Pa Hz A V K mol L.",
  chemistry: "Use form 'chemistry'. 'given' is an UNBALANCED reaction like H2 + O2 -> H2O; 'expected' is the balanced one with smallest whole-number coefficients, e.g. 2H2 + O2 -> 2H2O. No charges or hydrates.",
};

// Only curriculum-level fields reach the model. The goal is the intent enum the learner picked
// onboarding (catch_up | keep_up | exam_prep | explore) — no name, no id, nothing personal.
const GOAL_HINTS: Record<string, string> = {
  catch_up: "This learner is catching up on skills from earlier grades and may not remember them: give the earlier skill a full short paragraph, re-teaching it with one tiny example before building on it.",
  keep_up: "This learner is keeping up with class: add one sentence tying the topic to what the class sees this quarter.",
  exam_prep: "This learner is preparing for an exam: write 6 practice items instead of 4 (two of them slightly trickier), and end the body with one short exam-tip sentence.",
  explore: "This learner is exploring at their own pace: add one sentence on where the idea shows up outside school.",
};

// Only curriculum-level fields reach the model. No user data.
async function generate(b: Target, goal: string | null, stream?: { lang: TextLang; sink: Sink }) {
  const system = [
    "You are an expert teacher writing one lesson for a Filipino learner, aligned to the standard school curriculum. The learner may have no teacher nearby: the lesson alone must make the idea click, not just state it.",
    "Teach in this order, the way people actually learn: a concrete puzzle first, the idea built from numbers the learner can check, the general rule only after the pattern is seen, then why it works, then the classic mistake.",
    "Return three versions of the text: 'en' English, 'fil' Tagalog (Filipino), 'ceb' Cebuano (Bisaya). Keep math terms learners use in class (e.g. equation, factor) in English inside the Tagalog and Bisaya. Write naturally in each language, not word-for-word.",
    "'hook': 1-2 sentences, a concrete everyday situation in the Philippines (jeepney fares, a sari-sari store, rice harvest, load, typhoon rainfall) or a small puzzle that this topic answers. End it with the question.",
    "'body': 3-5 short paragraphs. (1) Work the hook with real, small numbers, one move at a time, so the learner sees the pattern happen. (2) Name the pattern: state the general rule once, on its own line as $$...$$. (3) Explain WHY the rule works in plain words or a picture-in-words, never 'because that's the formula'. (4) If it relies on an earlier skill, say which and remind how it goes in one sentence. Define every new term the first time it appears and mark it **bold**. No worked example here (that goes in 'example').",
    "'pitfall': the single most common mistake on this topic, shown concretely (the wrong line in $...$), then one sentence on why it's wrong and how to catch it.",
    "'check': one multiple-choice question with exactly 3 'choices' that tests understanding, not computation; the wrong choices are the mistakes real learners make. 'why' explains the right choice in 1-2 sentences. 'checkAnswer' is the index (0-2) of the right choice; keep the choices in the same order in every language.",
    "'spoken': the hook and body as they'd be read aloud, math in words.",
    "Write math as LaTeX: inline $...$, and an important equation on its own as $$...$$. Short sentences. Keep the reading level to the stated grade.",
    "'example' is ONE worked example solved step by step, 3-6 steps. 'problem' is its LaTeX; 'problemTyped' the same in typed notation (like practice 'given').",
    "'problemTyped' is ONE expression or ONE equation (e.g. x^2+7x+10, 3(x-2)=12, 2*4+3, -7+12), nothing else.",
    "Step 1 is the first change, never a copy of the problem. Each step rewrites the WHOLE previous line into an equivalent one: 'math' is the new line in LaTeX, 'typed' the same line in typed notation.",
    "Typed lines contain no words, commas, side calculations, or extra = signs: put reasoning like 'two numbers that multiply to 10 and add to 7' in the why, not the line.",
    "For an equation every line is an equation (last one like x=6, or x=2 or x=3); for an expression every line is an expression (last one the simplified or factored form).",
    "'why_en', 'why_fil', 'why_ceb' say in one short sentence what was done and the reason behind it, the thought a good tutor would say out loud.",
    "A checker verifies each typed line equals the one before it and drops a wrong example. 'kind' is 'solve' for equations, 'simplify' for expressions.",
    "'figure' adds a picture when it helps, ideally of the hook's own numbers: 'plot' for functions, graphs, slopes, parabolas, systems (functions are typed in x like 2x+3 or x^2-4, pick a window that shows the key points, label them in 'points');",
    "'numberline' for integers, inequalities, absolute value, ordering numbers ('marks' with open=true when the value is excluded, 'shade' ranges). Otherwise 'none'. Fill fields of the unused kind with 0 and empty lists.",
    ...(goal === "exam_prep"
      ? ["Then write 6 practice items, two of them slightly trickier than the rest. 'given' is a typed expression or equation (e.g. (x+1)(x+4), 2x+3=11, 3/4+1/2) with no words."]
      : ["Then write 4 practice items. 'given' is a typed expression or equation (e.g. (x+1)(x+4), 2x+3=11, 3/4+1/2) with no words."]),
    "'expected' is the correct final answer in the same typed notation. 'form' is one of: expanded, factored, solved, any.",
    "A calculator will check every 'expected'; a wrong key discards the lesson, so compute carefully and prefer simple numbers.",
    "The calculator reads 'given' literally, so it must contain the whole task as math: limits as limit((x^2-9)/(x-3), x, 3); derivatives as diff(x^3, x); definite integrals as integrate(3x+1, (x, 0, 2)); angles in degrees as cos(60*pi/180); mean and median as mean(2,4,6), median(3,5,7). For an equation, 'expected' is the solution like x=4 and form 'solved'; for a value to compute, form 'any'.",
    "Never put words, points like (2,3), or descriptions in 'given'. If a topic can't be written that way (e.g. a circle from its center and radius), give the equation to rearrange or a value to compute instead.",
    ...(HINTS[b.verifier] ? [HINTS[b.verifier]] : []),
    ...(goal && GOAL_HINTS[goal] ? [GOAL_HINTS[goal]] : []),
  ].join(" ");
  // The unit's DepEd learning competencies: the lesson and its practice should get the learner able to do these.
  const comps = competenciesFor(b.id);
  const user = `Subject: ${subjectMeta[b.subject].en}. Grade ${b.grade}, quarter ${b.quarter}. Domain: ${b.title}. Answers are checked by: ${b.verifier}.`
    + (comps.length ? `\nLearning competencies this lesson serves (DepEd MATATAG): by the end the learner can\n${comps.map((c) => `- ${c.text}`).join("\n")}\nTeach toward these and make the practice exercise them; if there are many, focus on the ones that can be practiced with a calculation.` : "");
  const schema = schemaFor(stream?.lang);
  return shape(stream ? await chatJsonStream<Raw>(system, user, schema, "lesson", stream.sink) : await chatJson<Raw>(system, user, schema, "lesson"));
}

type Raw = {
  en: unknown; fil: unknown; ceb: unknown; checkAnswer: number; practice: unknown[];
  example: { problem: string; problemTyped: string; kind: "solve" | "simplify"; steps: { math: string; typed: string; why_en: string; why_fil: string; why_ceb: string }[] };
  figure: { kind: "plot" | "numberline" | "none"; functions: string[]; xMin: number; xMax: number; yMin: number; yMax: number; points: { x: number; y: number; label: string }[];
    min: number; max: number; marks: { x: number; label: string; open: boolean }[]; shade: { from: number; to: number }[] };
};

/** The model's flat answer -> the Lesson shape the app stores. `typed` lines stay so the client can verify them. */
function shape(r: Raw) {
  const f = r.figure;
  const figure =
    f.kind === "plot" && f.functions.length && f.xMax > f.xMin && f.yMax > f.yMin
      ? { kind: "plot", functions: f.functions.slice(0, 3), xMin: f.xMin, xMax: f.xMax, yMin: f.yMin, yMax: f.yMax, points: f.points.slice(0, 6) }
      : f.kind === "numberline" && f.max > f.min
        ? { kind: "numberline", min: f.min, max: f.max, marks: f.marks.slice(0, 6), shade: f.shade.slice(0, 3) }
        : undefined;
  const e = r.example;
  const example = e.steps.length
    ? {
        problem: e.problem, problemTyped: e.problemTyped, kind: e.kind,
        steps: e.steps.slice(0, 8).map((s) => ({ math: s.math, typed: s.typed, why: { en: s.why_en, fil: s.why_fil, ceb: s.why_ceb } })),
      }
    : undefined;
  return { en: r.en, fil: r.fil, ceb: r.ceb, checkAnswer: r.checkAnswer, practice: r.practice, ...(example ? { example } : {}), ...(figure ? { figure } : {}) };
}

type Draft = ReturnType<typeof shape>;
type Check = { question: string; choices: string[]; why: string };

/**
 * A second, independent reading of the concept check: a fresh call sees only the question and choices
 * and picks the answer. If it disagrees with the generator's key, the key can't be trusted.
 */
async function secondOpinion(c: Check): Promise<number | null> {
  try {
    const r = await chatJson<{ answer: number }>(
      "Answer the multiple-choice question. Reply with the 0-based index of the single correct choice. If none or more than one is correct, reply -1.",
      `${c.question}\n${c.choices.map((x, i) => `${i}. ${x}`).join("\n")}`,
      { type: "object", additionalProperties: false, required: ["answer"], properties: { answer: { type: "integer" } } },
      "concept_check",
      REVIEW,
    );
    return r.answer;
  } catch {
    return null;
  }
}

/**
 * Generate, then repair what can be checked exactly before the draft is signed: graph points that aren't
 * on their function are removed, and a concept check the second reading disagrees with is removed.
 * `notes` lists what was dropped, for the audit report.
 */
export async function generateLesson(target: Target, goal: string | null, stream?: Parameters<typeof generate>[2]): Promise<{ draft: Draft; notes: string[] }> {
  const draft = await generate(target, goal, stream);
  const notes: string[] = [];
  const fig = checkFigure(draft.figure as never);
  notes.push(...fig.dropped);
  const en = draft.en as { check?: Check };
  const langs = [draft.en, draft.fil, draft.ceb] as { check?: Check }[];
  const n = en.check?.choices.length ?? 0;
  let keep = n === 3 && langs.every((l) => l?.check?.choices.length === n) && draft.checkAnswer >= 0 && draft.checkAnswer < n;
  if (keep) {
    const other = await secondOpinion(en.check!);
    if (other !== draft.checkAnswer) {
      keep = false;
      notes.push(`concept check: key says ${draft.checkAnswer}, second reading says ${other}`);
    }
  } else if (n) notes.push("concept check: malformed");
  if (!keep) for (const l of langs) if (l) delete l.check;
  return { draft: { ...draft, ...(fig.figure ? { figure: fig.figure } : { figure: undefined }), checkAnswer: keep ? draft.checkAnswer : -1 }, notes };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const target = resolve(body.id);
    if (!target) return json({ error: "unknown lesson" }, 400);
    const goal = typeof body.goal === "string" && body.goal in GOAL_HINTS ? body.goal : null;
    // Streamed: the text shows up as it's written; the finished, repaired and signed lesson comes last.
    if (body.stream) {
      const lang: TextLang = body.lang === "ceb" ? "ceb" : body.lang === "tl" || body.lang === "fil" ? "fil" : "en";
      return ndjson(async (sink) => {
        const { draft } = await generateLesson(target, goal, { lang, sink });
        return { ...(draft as object), sig: sign(target.id, draft) };
      });
    }
    const { draft } = await generateLesson(target, goal);
    // Signed so /api/publish can tell this exact content came from here.
    return json({ ...(draft as object), sig: sign(target.id, draft) });
  } catch (e) {
    return json({ error: String(e) }, 502);
  }
}
