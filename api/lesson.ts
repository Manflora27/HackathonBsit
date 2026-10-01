import { chatJson, json } from "./_openrouter";

const FORMS = ["any", "expanded", "factored", "solved", "units", "chemistry"];

const text = {
  type: "object",
  additionalProperties: false,
  required: ["body", "spoken"],
  properties: { body: { type: "array", items: { type: "string" } }, spoken: { type: "string" } },
};

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["en", "fil", "practice"],
  properties: {
    en: text,
    fil: text,
    practice: {
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
    },
  },
};

const HINTS: Record<string, string> = {
  statistics: "Use form 'any'. 'given' is the arithmetic to compute, e.g. (2+4+6)/3 for the mean of 2, 4, 6; put the words in 'prompt'.",
  geometry: "Use form 'any'. 'given' is the arithmetic of the formula, e.g. pi*3^2 for a circle of radius 3, expected 9pi; put the words in 'prompt'.",
  units: "Use form 'units'. 'given' is a computation with units, e.g. 100 m / 20 s; 'expected' carries a unit too, e.g. 5 m/s. Units allowed: m km cm mm s min h kg g N J W Pa Hz A V K mol L.",
  chemistry: "Use form 'chemistry'. 'given' is an UNBALANCED reaction like H2 + O2 -> H2O; 'expected' is the balanced one with smallest whole-number coefficients, e.g. 2H2 + O2 -> 2H2O. No charges or hydrates.",
};

// Only curriculum-level fields reach the model. No user data.
async function generate(b: { subject: string; grade: number; quarter: number; domain: string; title: string; verifier: string }) {
  const system = [
    "You write one short lesson for a Filipino learner, aligned to the standard school curriculum.",
    "Return an English and a Filipino version. Each has 2-4 short body paragraphs and a 'spoken' version for read-aloud.",
    "Write math inline as $...$ LaTeX. Keep the reading level to the stated grade.",
    "Then write 4 practice items. 'given' is a typed expression or equation (e.g. (x+1)(x+4), 2x+3=11, 3/4+1/2) with no words.",
    "'expected' is the correct final answer in the same typed notation. 'form' is one of: expanded, factored, solved, any.",
    "A calculator will check every 'expected'; a wrong key discards the lesson, so compute carefully and prefer simple numbers.",
    ...(HINTS[b.verifier] ? [HINTS[b.verifier]] : []),
  ].join(" ");
  const user = `Subject: ${b.subject}. Grade ${b.grade}, quarter ${b.quarter}. Domain: ${b.title}. Answers are checked by: ${b.verifier}.`;
  return chatJson(system, user, schema, "lesson");
}

export async function POST(req: Request) {
  try {
    const b = await req.json();
    const ok = typeof b.subject === "string" && typeof b.title === "string" && Number.isInteger(b.grade) && b.grade >= 1 && b.grade <= 12;
    if (!ok) return json({ error: "bad request" }, 400);
    return json(await generate({ ...b, title: b.title.slice(0, 80), subject: b.subject.slice(0, 20), verifier: String(b.verifier).slice(0, 20) }));
  } catch (e) {
    return json({ error: String(e) }, 502);
  }
}
