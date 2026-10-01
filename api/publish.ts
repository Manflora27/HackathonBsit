// Publishes a server-generated lesson to the shared cache after re-checking every answer key with SymPy (api/verify.py).
// Only this function writes lesson_cache (service role), so clients can't publish content of their own.
import { json } from "./_openrouter.js";
import { ENGINE_VERIFIED, resolve, verifySig, writeCache } from "./_lessons.js";
import { wrongClaims } from "../src/lessons/checks.js";

type Item = { prompt: string; given: string; form: string; expected: string };

/** SymPy's verdicts on the answer keys. */
async function checkKeys(items: Item[], origin: string): Promise<boolean[]> {
  const res = await fetch(`${origin}/api/verify`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-verify-key": process.env.LESSON_SIGNING_KEY ?? "" },
    body: JSON.stringify({ items: items.map(({ given, expected, form }) => ({ given, expected, form })) }),
  });
  if (!res.ok) throw new Error("verify unavailable");
  return (await res.json()).results as boolean[];
}

export async function POST(req: Request) {
  try {
    const { id, draft, sig } = await req.json();
    const target = resolve(id);
    // The signature covers the draft exactly as generated (without the sig field itself).
    const { sig: _drop, ...clean } = draft ?? {};
    if (!target || !verifySig(target.id, clean, sig)) return json({ error: "not a server-generated lesson" }, 403);

    const checked = ENGINE_VERIFIED.has(target.verifier);
    // A wrong line of arithmetic in the explanation keeps the whole lesson out of the shared cache, in every subject.
    if (wrongClaims(clean).length) return json({ error: "lesson text has a wrong calculation" }, 422);
    const ok = checked ? await checkKeys(clean.practice, new URL(req.url).origin) : clean.practice.map(() => true);
    const kept = (clean.practice as Item[]).filter((_, i) => ok[i]);
    if (kept.length < 2) return json({ error: "too few verified practice items" }, 422);

    const res = await writeCache(target, clean, kept, checked);
    if (res === "unconfigured") return json({ error: "cache not configured" }, 503);
    return res === "ok" ? json({ ok: true, verified: checked }) : json({ error: "cache write failed" }, 502);
  } catch (e) {
    return json({ error: String(e) }, 502);
  }
}
