// Shared OpenRouter helpers. The key lives only here, on the server.
const BASE = "https://openrouter.ai/api/v1";

export function key() {
  const k = process.env.OPENROUTER_API_KEY;
  if (!k) throw new Error("OPENROUTER_API_KEY is not set");
  return k;
}

export function headers() {
  return {
    authorization: `Bearer ${key()}`,
    "content-type": "application/json",
    "x-title": "Gap Finder",
  };
}

// Fast tier for live calls; OpenRouter tries the fallback if the first model fails.
export const FAST_MODELS = (process.env.OPENROUTER_FAST_MODELS ?? "openrouter/auto").split(",");

export async function chatJson<T>(system: string, user: string, schema: object, name: string): Promise<T> {
  const body = {
    models: FAST_MODELS,
    temperature: 0,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_schema", json_schema: { name, strict: true, schema } },
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${BASE}/chat/completions`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
    if (!res.ok) continue;
    const data = await res.json();
    try {
      return JSON.parse(data.choices[0].message.content) as T;
    } catch {
      // malformed output: retry once, then give up so the client falls back
    }
  }
  throw new Error("model call failed");
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

export const OPENROUTER_BASE = BASE;
