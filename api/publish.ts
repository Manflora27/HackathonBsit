// Publishes a server-generated lesson to the shared cache after re-checking every answer key with SymPy (api/verify.py).
// Only this function writes lesson_cache (service role), so clients can't publish content of their own.
import { json } from "./_openrouter.js";
import { ENGINE_VERIFIED, resolve, verifySig } from "./_lessons.js";

type Item = { prompt: string; given: string; form: string; expected: string };

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
    const ok = checked ? await checkKeys(clean.practice, new URL(req.url).origin) : clean.practice.map(() => true);
    const kept = (clean.practice as Item[]).filter((_, i) => ok[i]);
    if (kept.length < 2) return json({ error: "too few verified practice items" }, 422);

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return json({ error: "cache not configured" }, 503);
    const content = { en: clean.en, fil: clean.fil, practice: kept.map(({ prompt, given, form }) => ({ prompt, given, form })) };
    const res = await fetch(`${url}/rest/v1/lesson_cache`, {
      method: "POST",
      headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json", prefer: "resolution=ignore-duplicates" },
      body: JSON.stringify({ unit_id: target.id, content, verified: checked, verifier: target.verifier }),
    });
    return res.ok ? json({ ok: true, verified: checked }) : json({ error: "cache write failed" }, 502);
  } catch (e) {
    return json({ error: String(e) }, 502);
  }
}
