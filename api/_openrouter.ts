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
    "x-title": "Hopper",
  };
}

const list = (v: string | undefined, d: string) => (v ?? d).split(",").map((s) => s.trim()).filter(Boolean);

/** A model pinned to an ordered list of providers. OpenRouter never routes it anywhere else. */
export interface Route {
  model: string;
  providers: string[];
  /** GLM 5.3 Flash can't switch reasoning off on these providers; "low" keeps a lesson around 6s instead of 30s. */
  effort?: "minimal" | "low" | "medium" | "high";
}

/** Text and vision: lessons, mistake classification, teacher tips, reading photos of work, voice transcripts. */
export const TEXT: Route = {
  model: process.env.OPENROUTER_TEXT_MODEL ?? "z-ai/glm-5.3-flash",
  providers: list(process.env.OPENROUTER_TEXT_PROVIDERS, "together,baseten"),
  effort: (process.env.OPENROUTER_TEXT_EFFORT as Route["effort"]) ?? "low",
};

export const provider = (r: Route) => ({ order: r.providers, allow_fallbacks: false });

export type Part =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }

export async function chatJson<T>(system: string, user: string | Part[], schema: object, name: string, route: Route = TEXT): Promise<T> {
  const body = {
    model: route.model,
    provider: provider(route),
    ...(route.effort ? { reasoning: { effort: route.effort } } : {}),
    temperature: 0,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_schema", json_schema: { name, strict: true, schema } },
  };
  let last = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${BASE}/chat/completions`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
    if (!res.ok) {
      last = `${res.status} ${(await res.text()).slice(0, 200)}`;
      continue;
    }
    const data = await res.json();
    try {
      return JSON.parse(data.choices[0].message.content) as T;
    } catch {
      last = "malformed output"; // retry once, then give up so the client falls back
    }
  }
  throw new Error(`model call failed: ${last}`);
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

export const OPENROUTER_BASE = BASE;
