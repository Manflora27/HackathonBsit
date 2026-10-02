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
  effort?: "none" | "minimal" | "low" | "medium" | "high";
}

/** Text only: lessons, placement checks, mistake classification, teacher tips, reviews. Fast, high throughput. */
export const TEXT: Route = {
  // Cost (OpenRouter list, Oct 2026 — verify live, we pin providers so check theirs):
  // $0.30 / $1.20 per 1M input / output tokens on Makora and Together; reasoning tokens bill as output, so medium
  // reasoning (a few thousand per call) roughly triples a call. Placement ~2k in + ~4k out (~$0.005); a lesson is
  // the big one (~$0.02-0.03) but the shared lesson cache amortizes it to ~once per unit.
  model: process.env.OPENROUTER_TEXT_MODEL ?? "deepseek/deepseek-v4.1-flash",
  // Makora first, Together if it's down: in a side-by-side placement run at medium reasoning (Oct 2026) Makora gave
  // the first text in 8.7s, Together 15.3s, Modal 21s, Fireworks 28s; DeepSeek's own endpoint lacks strict
  // structured outputs. Same price on both ($0.30 / $1.20 per 1M). One run: re-measure before trusting it.
  providers: list(process.env.OPENROUTER_TEXT_PROVIDERS, "makora,together"),
  // Medium reasoning: better questions and lessons, at the cost of ~10-30s of silent thinking before the first
  // word (streamed pings keep the client from timing out). "none" starts text in ~1s if speed matters more.
  effort: (process.env.OPENROUTER_TEXT_EFFORT as Route["effort"]) ?? "medium",
};

/** The text model for calls that check an answer rather than write for a learner (same reasoning as TEXT). */
export const REVIEW: Route = TEXT;

/** The text model with its own default (full) reasoning: offline build and audit scripts, where nobody waits. */
export const THOROUGH: Route = { model: TEXT.model, providers: TEXT.providers };

/** Images: reading a photo of handwritten work. The text model can't see. */
export const VISION: Route = {
  // Cost (OpenRouter list, Oct 2026): ~$0.075 / $0.25 per 1M in / out. One read is the
  // shrunk photo (1280px JPEG, ~1-3k image tokens) + a short reply: roughly $0.001.
  model: process.env.OPENROUTER_VISION_MODEL ?? "z-ai/glm-5.3-flash",
  providers: list(process.env.OPENROUTER_VISION_PROVIDERS, "together,baseten"),
  // GLM 5.3 Flash can't switch reasoning off on these providers; "low" keeps a read around 6s instead of 30s.
  effort: (process.env.OPENROUTER_VISION_EFFORT as Route["effort"]) ?? "low",
};

export const provider = (r: Route) => ({ order: r.providers, allow_fallbacks: false });

export type Part =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }

export async function chatJson<T>(system: string, user: string | Part[], schema: object, name: string, route: Route = TEXT): Promise<T> {
  const body = {
    model: route.model,
    // An empty provider list means OpenRouter's own routing (e.g. an audit reviewer model).
    ...(route.providers.length ? { provider: provider(route) } : {}),
    ...(route.effort ? { reasoning: { effort: route.effort } } : {}),
    temperature: 0,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_schema", json_schema: { name, strict: true, schema } },
  };
  let last = "";
  // Retry exactly once, then give up so the client falls back. Cost bound: no call ever costs more than 2x its single-try price.
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

/** Where a streamed answer goes: its text as it's written, and a sign of life while the model is still reasoning. */
export interface Sink { text(chunk: string): void; alive(): void }

/**
 * chatJson, streamed: `sink.text` gets the raw JSON text as the model writes it, so the client can show a lesson
 * or the first question long before the whole answer exists. While the model reasons (no text yet) `sink.alive`
 * fires, so the client knows the call isn't stuck. Resolves to the parsed result at the end.
 * Retries once only if nothing was streamed yet; after that a failure can't be undone on the client.
 */
export async function chatJsonStream<T>(system: string, user: string, schema: object, name: string, sink: Sink, route: Route = TEXT): Promise<T> {
  const body = {
    model: route.model,
    ...(route.providers.length ? { provider: provider(route) } : {}),
    ...(route.effort ? { reasoning: { effort: route.effort } } : {}),
    temperature: 0,
    stream: true,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_schema", json_schema: { name, strict: true, schema } },
  };
  let last = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${BASE}/chat/completions`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
    if (!res.ok || !res.body) {
      last = `${res.status} ${(await res.text()).slice(0, 200)}`;
      continue;
    }
    let text = "";
    let buf = "";
    const decoder = new TextDecoder();
    // Server-sent events: "data: {...}" lines, ": comment" keep-alives, "data: [DONE]" at the end.
    for await (const bytes of res.body as unknown as AsyncIterable<Uint8Array>) {
      buf += decoder.decode(bytes, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop()!;
      for (const line of lines) {
        if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
        const delta = JSON.parse(line.slice(6)).choices?.[0]?.delta;
        if (delta?.content) {
          text += delta.content;
          sink.text(delta.content);
        } else if (delta?.reasoning) sink.alive();
      }
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      last = "malformed output";
      if (text) break; // the client already saw part of it
    }
  }
  throw new Error(`model call failed: ${last}`);
}

/**
 * A streamed response as newline-delimited JSON: {"t":"text","d":chunk} while the model writes, {"t":"alive"}
 * at most every 2s while it reasons, then whatever `run` returns as {"t":"done",...}, or {"t":"error"} if it throws.
 */
export function ndjson(run: (sink: Sink) => Promise<object>): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const line = (o: object) => ctrl.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      let pinged = 0;
      const sink: Sink = {
        text: (d) => line({ t: "text", d }),
        alive: () => { if (Date.now() - pinged > 2000) { pinged = Date.now(); line({ t: "alive" }); } },
      };
      try {
        line({ t: "done", ...(await run(sink)) });
      } catch (e) {
        line({ t: "error", error: String(e) });
      }
      ctrl.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" } });
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

export const OPENROUTER_BASE = BASE;
